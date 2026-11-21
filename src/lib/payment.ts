// Pembayaran Analisis AI lewat QRIS manual (keputusan pengguna, 2026-11-21).
//
// Analisis standar (rule-based) tetap gratis. Analisis AI berbayar
// AI_PRICE per analisis, dibayar dengan memindai QRIS GoPay Merchant milik
// pemilik situs. QRIS statis tidak mengirim notifikasi apa pun ke situs,
// jadi alurnya berbasis kepercayaan: pengguna membayar, menekan tombol
// "Saya Sudah Membayar", dan kredit AI di perangkatnya bertambah.
// Nominal yang dibayar = AI_PRICE + kode unik 2 digit, agar admin mudah
// mencocokkan pembayaran di riwayat merchant.
//
// Kredit hanya berupa angka di localStorage perangkat pengguna sendiri —
// bukan data server, bukan bukti pembayaran. Modul ini murni dan bisa
// diuji: semua fungsi menerima storage opsional (mock di Node).

import type { StorageLike } from './history'

// Harga satu Analisis AI dalam Rupiah. Satu konstanta tunggal agar mudah
// diganti bila harga berubah.
export const AI_PRICE = 5000

export const AI_CREDITS_STORAGE_KEY = 'screening-cv:ai-credits:v1'
export const AI_PENDING_CODE_STORAGE_KEY = 'screening-cv:ai-pending-code:v1'

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

// ---------- Kredit AI ----------

// Baca saldo kredit. Data rusak/hilang → 0, tidak pernah crash.
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

// Tambah kredit (bawaan: 1, sesuai satu pembayaran) dan kembalikan saldo baru.
export function addCredit(
  storage: StorageLike | null = defaultStorage(),
  count = 1,
): number {
  const next = getCredits(storage) + Math.max(0, Math.floor(count))
  saveCredits(next, storage)
  return next
}

// Pakai 1 kredit. true bila saldo cukup dan kredit berhasil dikurangi;
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

// ---------- Klaim order Midtrans (pembayaran otomatis) ----------
//
// Saat pembayaran otomatis (Midtrans) terkonfirmasi lunas oleh server,
// frontend menambah kredit lalu mencatat order_id-nya di sini. Catatan
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
// BARU dicatat (kredit boleh ditambah), false bila sudah pernah
// diklaim sebelumnya (jangan tambah kredit lagi).
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
