// Logika murni integrasi Midtrans untuk pembayaran Analisis AI.
//
// Modul ini TIDAK menyentuh jaringan, DOM, atau process.env secara
// langsung — semua fungsi menerima input eksplisit agar bisa diuji di
// Node (scripts/run-tests.ts) dan dipakai bersama oleh frontend
// (src/lib/midtransClient.ts) dan backend (api/_midtrans.ts).
//
// Dokumentasi acuan (resmi Midtrans):
// - Snap create transaction: POST {snapHost}/snap/v1/transactions
// - Core API GET status:      GET  {apiHost}/v2/{order_id}/status
// - Signature notifikasi:     SHA512(order_id + status_code + gross_amount + Server Key)
// - enabled_payments QRIS di Snap memakai nilai "other_qris" (QRIS
//   generik); "gopay" dan "shopeepay" adalah e-wallet (keduanya juga
//   menampilkan varian QRIS mereka di halaman Snap).

export type MidtransMode = 'off' | 'sandbox' | 'production'

// Hasil pemetaan status transaksi Midtrans untuk kebutuhan situs:
// paid = kredit boleh diterbitkan; pending = bayar belum selesai;
// failed = transaksi berakhir tanpa pembayaran; unknown = tidak dikenal.
export type PaymentCheckState = 'paid' | 'pending' | 'failed' | 'unknown'

export interface MidtransEnvLike {
  serverKey?: string
  clientKey?: string
  isProduction?: string
}

// Mode ditentukan murni dari env: kedua kunci harus terpasang;
// MIDTRANS_IS_PRODUCTION === "true" persis → production; terpasang
// tapi nilai lain → sandbox; kunci tidak lengkap → off (paywall
// manual tetap menjadi jalur aktif).
export function resolveMidtransMode(env: MidtransEnvLike): MidtransMode {
  const server = (env.serverKey ?? '').trim()
  const client = (env.clientKey ?? '').trim()
  if (!server || !client) return 'off'
  return env.isProduction === 'true' ? 'production' : 'sandbox'
}

export function snapHostFor(mode: Exclude<MidtransMode, 'off'>): string {
  return mode === 'production'
    ? 'https://app.midtrans.com'
    : 'https://app.sandbox.midtrans.com'
}

// Host Core API berbeda dari host Snap (dokumentasi resmi Midtrans:
// API Base URL sandbox https://api.sandbox.midtrans.com,
// production https://api.midtrans.com).
export function apiHostFor(mode: Exclude<MidtransMode, 'off'>): string {
  return mode === 'production'
    ? 'https://api.midtrans.com'
    : 'https://api.sandbox.midtrans.com'
}

export function snapJsUrlFor(mode: Exclude<MidtransMode, 'off'>): string {
  return `${snapHostFor(mode)}/snap/snap.js`
}

// Metode pembayaran yang diaktifkan di Snap: QRIS generik + e-wallet
// saja, sesuai fokus produk (tanpa kartu/VA/gerai).
export const MIDTRANS_ENABLED_PAYMENTS = ['other_qris', 'gopay', 'shopeepay']

// Item transaksi Snap untuk satu kredit Analisis AI. Harga diambil dari
// AI_PRICE (src/lib/payment.ts) oleh pemanggil — tidak diduplikasi di sini.
export const MIDTRANS_ITEM_ID = 'analisis-ai'
export const MIDTRANS_ITEM_NAME = 'Analisis AI CV'

const ORDER_ID_PATTERN = /^AICV-[A-Za-z0-9]+-[A-Za-z0-9]{6}$/

// order_id unik per transaksi: "AICV-<timestamp base36>-<acak 6>".
// `now` dan `random` bisa disuntikkan untuk pengujian deterministik.
export function buildOrderId(
  now: number = Date.now(),
  random: () => number = Math.random,
): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let suffix = ''
  for (let i = 0; i < 6; i++) {
    suffix += alphabet[Math.floor(random() * alphabet.length) % alphabet.length]
  }
  return `AICV-${now.toString(36)}-${suffix}`
}

export function isValidOrderId(value: unknown): value is string {
  return typeof value === 'string' && ORDER_ID_PATTERN.test(value)
}

export interface MappedTransactionStatus {
  paid: boolean
  state: PaymentCheckState
}

// Petakan respons GET Status Midtrans menjadi keputusan situs.
// Sumber kebenaran pembayaran adalah respons server Midtrans ini —
// bukan callback Snap di browser.
// - settlement → lunas.
// - capture → lunas hanya bila fraud_status "accept"; "challenge"
//   berarti menunggu peninjauan (pending); "deny" → gagal.
// - pending → belum selesai.
// - expire / cancel / deny / failure → gagal.
// - Selain itu (termasuk body tidak valid) → unknown.
// Bila expectedAmount diisi, status lunas hanya diakui bila
// gross_amount respons sama persis — pengaman tambahan agar transaksi
// bernominal lain tidak pernah menerbitkan kredit.
export function mapMidtransStatus(
  body: unknown,
  expectedAmount?: number,
): MappedTransactionStatus {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { paid: false, state: 'unknown' }
  }
  const obj = body as Record<string, unknown>
  const status = typeof obj.transaction_status === 'string' ? obj.transaction_status : ''
  const fraud = typeof obj.fraud_status === 'string' ? obj.fraud_status : ''

  let mapped: MappedTransactionStatus
  switch (status) {
    case 'settlement':
      mapped = { paid: true, state: 'paid' }
      break
    case 'capture':
      if (fraud === 'accept') mapped = { paid: true, state: 'paid' }
      else if (fraud === 'deny') mapped = { paid: false, state: 'failed' }
      else mapped = { paid: false, state: 'pending' }
      break
    case 'pending':
      mapped = { paid: false, state: 'pending' }
      break
    case 'expire':
    case 'cancel':
    case 'deny':
    case 'failure':
      mapped = { paid: false, state: 'failed' }
      break
    default:
      mapped = { paid: false, state: 'unknown' }
  }

  if (mapped.paid && expectedAmount !== undefined) {
    const gross = Number(obj.gross_amount)
    if (!Number.isFinite(gross) || gross !== expectedAmount) {
      return { paid: false, state: 'unknown' }
    }
  }
  return mapped
}
