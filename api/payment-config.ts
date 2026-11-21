// GET /api/payment-config — beri tahu frontend mode pembayaran
// otomatis Midtrans yang aktif di server, tanpa membocorkan kunci.
//
// Mode diturunkan dari env server (MIDTRANS_SERVER_KEY,
// MIDTRANS_CLIENT_KEY, MIDTRANS_IS_PRODUCTION):
// - "off": kunci belum terpasang → frontend memakai paywall QRIS
//   manual yang sudah berjalan.
// - "sandbox" / "production": frontend boleh menawarkan pembayaran
//   otomatis; Client Key ikut dibagikan karena memang publik (dipakai
//   sebagai data-client-key Snap JS di browser). Server Key TIDAK
//   pernah keluar dari server.

import {
  readMidtransConfig,
  type MidtransApiRequest,
  type MidtransApiResponse,
} from './_midtrans'

export default function handler(req: MidtransApiRequest, res: MidtransApiResponse): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Metode tidak diizinkan. Gunakan GET.' })
    return
  }

  const config = readMidtransConfig()
  if (config.mode === 'off') {
    res.status(200).json({ mode: 'off' })
    return
  }
  res.status(200).json({ mode: config.mode, clientKey: config.clientKey })
}
