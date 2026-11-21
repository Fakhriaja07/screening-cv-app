// POST /api/create-transaction — buat transaksi Snap Midtrans untuk
// satu kredit Analisis AI, kembalikan token Snap ke frontend.
//
// Harga diambil dari konstanta bersama AI_PRICE (src/lib/payment.ts) —
// nominal tidak diterima dari klien sama sekali, jadi tidak bisa
// dimanipulasi dari browser. Server Key hanya dipakai di server untuk
// Basic Auth ke API Midtrans.

import {
  basicAuthHeader,
  clientIp,
  fetchWithTimeout,
  makeRateLimiter,
  readMidtransConfig,
  type MidtransApiRequest,
  type MidtransApiResponse,
} from './_midtrans'
import {
  MIDTRANS_ENABLED_PAYMENTS,
  MIDTRANS_ITEM_ID,
  MIDTRANS_ITEM_NAME,
  buildOrderId,
} from '../src/lib/midtrans'
import { AI_PRICE } from '../src/lib/payment'

const UPSTREAM_TIMEOUT_MS = 15_000

// Pembuatan transaksi dibatasi ringan per IP: cukup untuk menahan
// pembuatan order spam tanpa mengganggu pengguna normal.
const isRateLimited = makeRateLimiter(10, 10 * 60 * 1000)

export default async function handler(
  req: MidtransApiRequest,
  res: MidtransApiResponse,
): Promise<void> {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Metode tidak diizinkan. Gunakan POST.' })
    return
  }

  const config = readMidtransConfig()
  if (config.mode === 'off') {
    res.status(503).json({
      error:
        'Pembayaran otomatis belum aktif di server. Gunakan pembayaran QRIS manual yang tersedia di halaman.',
    })
    return
  }

  if (isRateLimited(clientIp(req))) {
    res.status(429).json({
      error: 'Terlalu banyak percobaan pembayaran dari koneksimu. Tunggu beberapa menit lalu coba lagi.',
    })
    return
  }

  const orderId = buildOrderId()

  let upstream: Response
  try {
    upstream = await fetchWithTimeout(
      `${config.snapHost}/snap/v1/transactions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: basicAuthHeader(config.serverKey),
        },
        body: JSON.stringify({
          transaction_details: {
            order_id: orderId,
            gross_amount: AI_PRICE,
          },
          item_details: [
            {
              id: MIDTRANS_ITEM_ID,
              price: AI_PRICE,
              quantity: 1,
              name: MIDTRANS_ITEM_NAME,
            },
          ],
          // Hanya QRIS & e-wallet (dokumentasi Snap: QRIS generik
          // memakai nilai "other_qris").
          enabled_payments: MIDTRANS_ENABLED_PAYMENTS,
        }),
      },
      UPSTREAM_TIMEOUT_MS,
    )
  } catch {
    res.status(502).json({
      error: 'Layanan pembayaran (Midtrans) sedang tidak bisa dihubungi. Coba lagi nanti.',
    })
    return
  }

  let data: Record<string, unknown> = {}
  try {
    const parsed: unknown = await upstream.json()
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      data = parsed as Record<string, unknown>
    }
  } catch {
    data = {}
  }

  if (!upstream.ok || typeof data.token !== 'string' || !data.token) {
    // Diagnosis aman: sertakan status + pesan resmi Midtrans
    // (error_messages) — tidak termasuk kunci atau header apa pun.
    const messages = Array.isArray(data.error_messages)
      ? data.error_messages.filter((m): m is string => typeof m === 'string').join('; ')
      : ''
    console.error(
      `[create-transaction] Midtrans HTTP ${upstream.status}${messages ? `: ${messages}` : ''}`,
    )
    res.status(502).json({
      error: 'Midtrans menolak pembuatan transaksi. Coba lagi nanti.',
      detail: `Midtrans HTTP ${upstream.status}${messages ? `: ${messages}` : ''}`,
    })
    return
  }

  res.status(200).json({
    token: data.token,
    redirectUrl: typeof data.redirect_url === 'string' ? data.redirect_url : '',
    orderId,
  })
}
