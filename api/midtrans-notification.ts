// POST /api/midtrans-notification — URL notifikasi (webhook) resmi
// yang didaftarkan di dashboard Midtrans.
//
// Endpoint ini STATELESS dengan sengaja: ia hanya memverifikasi bahwa
// notifikasi benar-benar berasal dari Midtrans (signature_key cocok
// dengan SHA512 yang dihitung dari body + Server Key server) lalu
// menjawab 200 agar Midtrans mencatat pengiriman berhasil. Status
// pembayaran resmi TIDAK diambil dari body notifikasi ini — situs
// selalu menarik status lewat /api/check-transaction langsung ke
// Midtrans, jadi tidak ada status yang bisa dipalsukan lewat webhook.

import {
  parseJsonBody,
  readMidtransConfig,
  verifyNotificationSignature,
  type MidtransApiRequest,
  type MidtransApiResponse,
} from './_midtrans.js'

export default async function handler(req: MidtransApiRequest, res: MidtransApiResponse): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Metode tidak diizinkan. Gunakan POST.' })
    return
  }

  const config = readMidtransConfig()
  if (config.mode === 'off') {
    res.status(503).json({ error: 'Pembayaran otomatis belum aktif di server.' })
    return
  }

  const body = parseJsonBody(req)
  if (!body) {
    res.status(400).json({ error: 'Body notifikasi tidak valid (bukan JSON objek).' })
    return
  }

  // Field wajib notifikasi Midtrans; tanpa ini signature tidak bisa
  // dihitung dan notifikasi dianggap tidak valid.
  const required = ['order_id', 'status_code', 'gross_amount', 'signature_key']
  const missing = required.filter((key) => typeof body[key] !== 'string' || !body[key])
  if (missing.length > 0) {
    res.status(400).json({ error: `Body notifikasi tidak lengkap: ${missing.join(', ')}.` })
    return
  }

  if (!verifyNotificationSignature(body, config.serverKey)) {
    console.error(`[midtrans-notification] Signature tidak cocok untuk order ${String(body.order_id)}`)
    res.status(403).json({ error: 'Signature tidak valid.' })
    return
  }

  res.status(200).json({ ok: true })
}
