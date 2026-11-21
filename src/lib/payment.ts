// Pembayaran Analisis AI lewat QRIS manual + kode token sekali pakai
// (keputusan pengguna, 2026-11-21).
//
// Analisis standar (rule-based) tetap gratis. Analisis AI berbayar
// AI_PRICE per analisis, dibayar dengan memindai QRIS GoPay Merchant milik
// pemilik situs. QRIS statis tidak mengirim notifikasi apa pun ke situs,
// jadi pembayaran tidak bisa diverifikasi otomatis oleh situs. Alurnya:
// pengguna membayar nominal tepat (AI_PRICE + kode unik 2 digit, agar
// admin mudah mencocokkan di riwayat merchant), menghubungi admin dengan
// bukti bayar, admin memberikan 1 KODE TOKEN, lalu pengguna menukarkan
// kode itu di kartu Analisis AI untuk mendapat 1 token.
//
// Mekanisme ini menggantikan tombol konfirmasi "Saya Sudah Membayar"
// yang berbasis kepercayaan — tombol itu dihapus pada 2026-11-21 karena
// siapa pun bisa mengklaim kredit tanpa membayar (pemilik membuktikannya
// sendiri). Situs hanya menyimpan hash SHA-256 kode yang sah
// (src/lib/tokenCodes.ts); kode aslinya dipegang admin di luar repo.
//
// Token hanya berupa angka di localStorage perangkat pengguna sendiri —
// bukan data server. Penanda kode yang sudah ditukar juga tersimpan per
// perangkat, jadi batas jujurnya: kode yang sama masih bisa ditukar di
// perangkat lain; perlindungan utamanya adalah kode hanya dibagikan
// admin setelah pembayaran diperiksa. Modul ini murni dan bisa diuji:
// semua fungsi menerima storage opsional (mock di Node).

import type { StorageLike } from './history'
import { TOKEN_CODE_HASHES } from './tokenCodes'

// Harga satu Analisis AI dalam Rupiah. Satu konstanta tunggal agar mudah
// diganti bila harga berubah.
export const AI_PRICE = 5000

// Tautan kontak admin (mis. WhatsApp) untuk meminta kode token setelah
// membayar. Kosong = belum diisi: UI menampilkan langkah menghubungi
// admin sebagai teks instruksi biasa, tanpa tautan. Isi nanti dengan
// tautan admin, mis. "https://wa.me/62...".
export const ADMIN_CONTACT_URL = ''

// Kunci storage saldo TIDAK diganti walau istilahnya kini "token"
// (sebelumnya "kredit"), agar saldo pengguna lama tidak hilang.
export const AI_CREDITS_STORAGE_KEY = 'screening-cv:ai-credits:v1'
export const AI_PENDING_CODE_STORAGE_KEY = 'screening-cv:ai-pending-code:v1'
export const REDEEMED_CODES_STORAGE_KEY = 'screening-cv:redeemed-codes:v1'

function defaultStorage(): StorageLike | null {
  try {
    const ls = (globalThis as { localStorage?: StorageLike }).localStorage
    return ls ?? null
  } catch {
    return null
  }
}

// ---------- Format ----------

// "Rp5.000" — pemisah ribuan gaya id-ID.
export function formatRupiah(amount: number): string {
  return `Rp${new Intl.NumberFormat('id-ID').format(amount)}`
}

// ---------- Token AI (saldo) ----------

// Baca saldo token. Data rusak/hilang → 0, tidak pernah crash.
export function getCredits(
  storage: StorageLike | null = defaultStorage(),
): number {
  if (!storage) return 0
  try {
    const raw = storage.getItem(AI_CREDITS_STORAGE_KEY)
    if (!raw) return 0
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'number' || !Number.isFinite(parsed)) return 0
    return Math.max(0, Math.floor(parsed))
  } catch {
    return 0
  }
}

function saveCredits(
  credits: number,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return
  try {
    storage.setItem(AI_CREDITS_STORAGE_KEY, JSON.stringify(Math.max(0, Math.floor(credits))))
  } catch {
    // Kuota penuh / penyimpanan tidak tersedia: abaikan, jangan crash.
  }
}

// Tambah token (bawaan: 1, sesuai satu pembayaran) dan kembalikan saldo
// baru. Dipakai jalur redeem kode token dan klaim pembayaran otomatis
// (Midtrans) — TIDAK lagi dari tombol konfirmasi kepercayaan.
export function addCredit(
  storage: StorageLike | null = defaultStorage(),
  count = 1,
): number {
  const next = getCredits(storage) + Math.max(0, Math.floor(count))
  saveCredits(next, storage)
  return next
}

// Pakai 1 token. true bila saldo cukup dan token berhasil dikurangi;
// false bila saldo 0 (saldo tidak berubah).
export function consumeCredit(
  storage: StorageLike | null = defaultStorage(),
): boolean {
  const current = getCredits(storage)
  if (current <= 0) return false
  saveCredits(current - 1, storage)
  return true
}

// ---------- Kode unik nominal ----------

function isValidCode(v: unknown): v is number {
  return (
    typeof v === 'number' &&
    Number.isFinite(v) &&
    Number.isInteger(v) &&
    v >= 1 &&
    v <= 99
  )
}

// Kode unik 2 digit (1–99) untuk percobaan pembelian yang sedang berjalan.
// Kode dibuat sekali lalu disimpan, agar nominal yang ditampilkan tidak
// berubah-ubah saat halaman dimuat ulang; setelah pembayaran dikonfirmasi,
// kode dibersihkan dan percobaan berikutnya mendapat kode baru.
export function getOrCreatePendingCode(
  storage: StorageLike | null = defaultStorage(),
  random: () => number = Math.random,
): number {
  if (storage) {
    try {
      const raw = storage.getItem(AI_PENDING_CODE_STORAGE_KEY)
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        if (isValidCode(parsed)) return parsed
      }
    } catch {
      // Data rusak: buat kode baru di bawah.
    }
  }
  const code = 1 + Math.floor(random() * 99)
  if (storage) {
    try {
      storage.setItem(AI_PENDING_CODE_STORAGE_KEY, JSON.stringify(code))
    } catch {
      // Abaikan kegagalan menyimpan; kode tetap dipakai untuk sesi ini.
    }
  }
  return code
}

export function clearPendingCode(
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return
  try {
    storage.removeItem(AI_PENDING_CODE_STORAGE_KEY)
  } catch {
    // Abaikan: tidak ada yang perlu dilakukan bila storage tidak tersedia.
  }
}

// Nominal persis yang harus dibayar untuk kode tertentu: harga + kode unik
// (mis. kode 37 → Rp5.037).
export function amountForCode(code: number): number {
  return AI_PRICE + code
}

// ---------- Kode token sekali pakai (redeem) ----------
//
// Pengguna menerima 1 kode dari admin setelah pembayarannya diperiksa.
// Kode berbentuk "CVAI-XXXXXX". Situs tidak menyimpan kode asli — hanya
// hash SHA-256-nya (TOKEN_CODE_HASHES). Penukaran: input dinormalisasi
// (trim + uppercase), di-hash, lalu dicocokkan ke daftar hash. Hash kode
// yang berhasil ditukar dicatat di perangkat ini; penukaran ulang kode
// yang sama di perangkat yang sama ditolak.

// Normalisasi input kode: buang spasi tepi dan samakan huruf besar.
export function normalizeTokenCode(input: string): string {
  return input.trim().toUpperCase()
}

// SHA-256 hex memakai Web Crypto (tersedia di browser modern lewat HTTPS
// dan di Node modern). hashFn bisa disuntikkan untuk pengujian.
export async function sha256Hex(text: string): Promise<string> {
  const subtle = (globalThis as { crypto?: Crypto }).crypto?.subtle
  if (!subtle) throw new Error('Web Crypto tidak tersedia di lingkungan ini.')
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

const REDEEMED_CODES_MAX = 200

function loadRedeemedHashes(storage: StorageLike | null): string[] {
  if (!storage) return []
  try {
    const raw = storage.getItem(REDEEMED_CODES_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is string => typeof v === 'string')
  } catch {
    return []
  }
}

// Apakah hash kode ini sudah pernah ditukar di perangkat ini?
export function isCodeRedeemed(
  codeHash: string,
  storage: StorageLike | null = defaultStorage(),
): boolean {
  return loadRedeemedHashes(storage).includes(codeHash)
}

// Catat hash kode sebagai sudah ditukar. true bila BARU dicatat;
// false bila sudah tercatat atau penyimpanan tidak tersedia.
export function markCodeRedeemed(
  codeHash: string,
  storage: StorageLike | null = defaultStorage(),
): boolean {
  if (!storage) return false
  const hashes = loadRedeemedHashes(storage)
  if (hashes.includes(codeHash)) return false
  hashes.push(codeHash)
  try {
    storage.setItem(REDEEMED_CODES_STORAGE_KEY, JSON.stringify(hashes.slice(-REDEEMED_CODES_MAX)))
  } catch {
    // Gagal menyimpan: jangan perlakukan penukaran sebagai berhasil.
    return false
  }
  return true
}

export type RedeemTokenResult = { ok: true; balance: number } | { ok: false }

// Tukarkan kode token: sukses menambah tepat 1 token dan mengembalikan
// saldo baru. Gagal (kode tidak dikenal, sudah ditukar di perangkat ini,
// atau penyimpanan tidak tersedia) tidak mengubah saldo apa pun. Semua
// kegagalan sengaja disamaratakan — UI menampilkan satu pesan umum.
export async function redeemTokenCode(
  input: string,
  storage: StorageLike | null = defaultStorage(),
  hashFn: (text: string) => Promise<string> = sha256Hex,
): Promise<RedeemTokenResult> {
  const normalized = normalizeTokenCode(input)
  if (!normalized || !storage) return { ok: false }
  let hash: string
  try {
    hash = (await hashFn(normalized)).toLowerCase()
  } catch {
    return { ok: false }
  }
  if (!TOKEN_CODE_HASHES.includes(hash)) return { ok: false }
  if (!markCodeRedeemed(hash, storage)) return { ok: false }
  return { ok: true, balance: addCredit(storage) }
}

// ---------- Klaim order Midtrans (pembayaran otomatis) ----------
//
// Saat pembayaran otomatis (Midtrans) terkonfirmasi lunas oleh server,
// frontend menambah token lalu mencatat order_id-nya di sini. Catatan
// ini mencegah order yang sama diklaim ulang dari browser yang sama
// (mis. polling ganda atau tombol ditekan dua kali). Ini pengaman sisi
// klien — keputusan "lunas" sendiri selalu datang dari server situs
// yang menarik status resmi ke Midtrans, bukan dari browser.

export const AI_CLAIMED_ORDERS_STORAGE_KEY = 'screening-cv:ai-claimed-orders:v1'
const CLAIMED_ORDERS_MAX = 50

function loadClaimedOrders(storage: StorageLike | null): string[] {
  if (!storage) return []
  try {
    const raw = storage.getItem(AI_CLAIMED_ORDERS_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is string => typeof v === 'string')
  } catch {
    return []
  }
}

export function isOrderClaimed(
  orderId: string,
  storage: StorageLike | null = defaultStorage(),
): boolean {
  return loadClaimedOrders(storage).includes(orderId)
}

// Catat order sebagai sudah diklaim. Mengembalikan true bila order ini
// BARU dicatat (token boleh ditambah), false bila sudah pernah
// diklaim sebelumnya (jangan tambah token lagi).
export function markOrderClaimed(
  orderId: string,
  storage: StorageLike | null = defaultStorage(),
): boolean {
  if (!storage) return false
  const orders = loadClaimedOrders(storage)
  if (orders.includes(orderId)) return false
  orders.push(orderId)
  try {
    storage.setItem(
      AI_CLAIMED_ORDERS_STORAGE_KEY,
      JSON.stringify(orders.slice(-CLAIMED_ORDERS_MAX)),
    )
  } catch {
    // Gagal menyimpan: perlakukan sebagai belum tercatat agar tidak
    // mengklaim berhasil secara keliru.
    return false
  }
  return true
}
