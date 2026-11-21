// GET /api/check-transaction?order_id=AICV-... — tanyakan status
// resmi transaksi ke Midtrans (Core API GET Status) dan petakan
// menjadi keputusan situs.
//
// INILAH sumber kebenaran pembayaran (pull-based): kredit Analisis AI
// hanya diterbitkan frontend setelah endpoint ini menjawab
// { paid: true } — callback Snap di browser tidak pernah cukup,
// karena callback berjalan di perangkat pengguna dan bisa diakali.

import {
  basicAuthHeader,
  clientIp,
  fetchWithTimeout,
  makeRateLimiter,
  queryParam,
  readMidtransConfig,
  type MidtransApiRequest,
  type MidtransApiResponse,
} from './_midtrans.js'
import { isValidOrderId, mapMidtransStatus } from '../src/lib/midtrans.js'
import { AI_PRICE } from '../src/lib/payment.js'

const UPSTREAM_TIMEOUT_MS = 15_000

// Frontend melakukan polling ±3 detik selama maks ±2 menit per
// percobaan bayar, jadi batas per IP dibuat longgar (120/10 menit).
const isRateLimited = makeRateLimiter(120, 10 * 60 * 1000)

export default async function handler(
  req: MidtransApiRequest,
  res: MidtransApiResponse,
): Promise<void> {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Metode tidak diizinkan. Gunakan GET.' })
    return
  }

  const config = readMidtransConfig()
  if (config.mode === 'off') {
    res.status(503).json({
      error: 'Pembayaran otomatis belum aktif di server.',
    })
    return
  }

  const orderId = queryParam(req, 'order_id')
  if (!isValidOrderId(orderId)) {
    res.status(400).json({ error: 'order_id tidak valid.' })
    return
  }

  if (isRateLimited(clientIp(req))) {
    res.status(429).json({
      error: 'Terlalu banyak pemeriksaan status dari koneksimu. Tunggu sebentar lalu coba lagi.',
    })
    return
  }

  let upstream: Response
  try {
    upstream = await fetchWithTimeout(
      `${config.apiHost}/v2/${encodeURIComponent(orderId)}/status`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: basicAuthHeader(config.serverKey),
        },
      },
      UPSTREAM_TIMEOUT_MS,
    )
  } catch {
    res.status(502).json({
      error: 'Layanan pembayaran (Midtrans) sedang tidak bisa dihubungi. Coba lagi nanti.',
    })
    return
  }

  // Transaksi belum dikenal Midtrans (mis. Snap belum pernah dibuka /
  // order_id asing): bukan error server — statusnya "unknown".
  if (upstream.status === 404) {
    res.status(200).json({ paid: false, state: 'unknown' })
    return
  }

  let data: unknown = null
  try {
    data = await upstream.json()
  } catch {
    data = null
  }

  if (!upstream.ok) {
    console.error(`[check-transaction] Midtrans HTTP ${upstream.status} untuk ${orderId}`)
    res.status(502).json({
      error: 'Midtrans mengembalikan kesalahan saat memeriksa status. Coba lagi nanti.',
      detail: `Midtrans HTTP ${upstream.status}`,
    })
    return
  }

  // Nominal ikut diverifikasi: status lunas hanya diakui untuk
  // transaksi bernilai persis harga Analisis AI.
  const mapped = mapMidtransStatus(data, AI_PRICE)
  res.status(200).json({ paid: mapped.paid, state: mapped.state })
}
