// Fitur bagikan hasil — Fase 4 roadmap.
// Teks bagikan dan kartu gambar HANYA memakai data skor: skor total, label
// verdict, posisi target, dan prioritas perbaikan utama (judul + pesan
// pemeriksaan, yang bersifat generik). Isi CV, nama, email, dan data pribadi
// lainnya TIDAK PERNAH masuk ke teks/gambar bagikan. Kartu digambar 100%
// di browser pengguna lewat Canvas API — tidak ada data yang dikirim ke
// server untuk membuat gambar ini.

import type { AnalysisResult } from './analyze'

export const SITE_URL = 'https://screening-cv-app.vercel.app/'
export const SHARE_CARD_WIDTH = 1200
export const SHARE_CARD_HEIGHT = 630

export interface ShareData {
  total: number
  label: string
  role: string // posisi target; '' bila tidak diisi
  topFixTitle: string // judul prioritas perbaikan pertama; '' bila tidak ada
  topFixMessage: string // pesan prioritas pertama; '' bila tidak ada
}

export function shareDataFromResult(result: AnalysisResult, role: string): ShareData {
  const top = result.priorities[0]
  return {
    total: result.total,
    label: result.label,
    role: role.trim(),
    topFixTitle: top ? top.title : '',
    topFixMessage: top ? top.message : '',
  }
}

// ---------- Util teks murni (bisa diuji tanpa browser) ----------

// Potong teks pada batas kata, tambahkan elipsis bila terpotong.
export function truncateText(text: string, maxChars: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= maxChars) return clean
  const cut = clean.slice(0, maxChars)
  const lastSpace = cut.lastIndexOf(' ')
  const base = lastSpace > maxChars * 0.5 ? cut.slice(0, lastSpace) : cut
  return `${base.trimEnd()}…`
}

// Bungkus teks menjadi baris-baris dengan panjang maksimum per baris.
// Kata yang lebih panjang dari satu baris dipotong keras. Bila jumlah baris
// melebihi maxLines, baris terakhir dipotong aman dan diberi elipsis.
export function wrapText(text: string, maxCharsPerLine: number, maxLines?: number): string[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean || maxCharsPerLine < 1) return []
  const lines: string[] = []
  let current = ''
  const flush = () => {
    if (current) lines.push(current)
    current = ''
  }
  for (const word of clean.split(' ')) {
    let rest = word
    while (rest.length > maxCharsPerLine) {
      flush()
      lines.push(rest.slice(0, maxCharsPerLine))
      rest = rest.slice(maxCharsPerLine)
    }
    if (!rest) continue
    if (!current) {
      current = rest
    } else if (current.length + 1 + rest.length <= maxCharsPerLine) {
      current += ` ${rest}`
    } else {
      flush()
      current = rest
    }
  }
  flush()
  if (maxLines !== undefined && lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    const last = kept[kept.length - 1]
    kept[kept.length - 1] = last.length >= maxCharsPerLine
      ? `${last.slice(0, maxCharsPerLine - 1)}…`
      : `${last}…`
    return kept
  }
  return lines
}

// Teks yang dibagikan ke WhatsApp/Telegram/X atau disalin pengguna.
export function buildShareText(data: ShareData): string {
  const lines: string[] = [
    `Skor CV saya: ${data.total}/100 — ${data.label} (Screening CV)`,
  ]
  if (data.role) {
    lines.push(`Posisi target: ${data.role}`)
  }
  if (data.topFixTitle) {
    const fix = data.topFixMessage
      ? `${data.topFixTitle} — ${truncateText(data.topFixMessage, 200)}`
      : data.topFixTitle
    lines.push(`Perbaikan utama saya berikutnya: ${fix}`)
  } else {
    lines.push('Semua pemeriksaan lolos dengan poin penuh — tidak ada perbaikan utama yang tersisa.')
  }
  lines.push('Yuk cek CV-mu juga — gratis, tanpa daftar, hasilnya langsung di browser:')
  lines.push(SITE_URL)
  return lines.join('\n')
}

// ---------- URL intent berbagi ----------

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

export function telegramShareUrl(text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(SITE_URL)}&text=${encodeURIComponent(text)}`
}

export function xShareUrl(text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
}

// ---------- Kartu gambar PNG (Canvas API, hanya di browser) ----------

// Warna cincin skor — sama seperti cincin skor di halaman hasil.
export function scoreColor(total: number): string {
  if (total >= 85) return '#16a34a'
  if (total >= 70) return '#0ea5e9'
  if (total >= 50) return '#f59e0b'
  return '#dc2626'
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// Gambar kartu hasil 1200×630 bergaya og-image Versi B (latar terang,
// aksen teal). Mengembalikan Blob PNG, atau null bila Canvas tidak tersedia.
export function buildShareCardBlob(data: ShareData): Promise<Blob | null> {
  if (typeof document === 'undefined') return Promise.resolve(null)
  const canvas = document.createElement('canvas')
  canvas.width = SHARE_CARD_WIDTH
  canvas.height = SHARE_CARD_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)

  const W = SHARE_CARD_WIDTH
  const H = SHARE_CARD_HEIGHT
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  const TEAL = '#0d9488'
  const TEAL_DARK = '#0f766e'
  const INK = '#0f172a'
  const BODY = '#334155'
  const MUTED = '#64748b'

  // Latar terang + bilah aksen teal di tepi atas.
  ctx.fillStyle = '#f1f5f9'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = TEAL
  ctx.fillRect(0, 0, W, 14)

  // Panel putih kartu.
  roundedRectPath(ctx, 48, 48, W - 96, H - 96, 28)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 2
  ctx.stroke()

  const left = 96
  const right = W - 96

  // Merek kecil di atas.
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = TEAL_DARK
  ctx.font = `700 26px ${FONT}`
  ctx.fillText('SCREENING CV', left, 122)

  // Judul kartu.
  ctx.fillStyle = INK
  ctx.font = `800 58px ${FONT}`
  ctx.fillText('Skor CV Saya', left, 192)

  // ----- Cincin skor (kiri) -----
  const cx = 220
  const cy = 392
  const radius = 104
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 20
  ctx.stroke()
  const frac = Math.max(0, Math.min(100, data.total)) / 100
  if (frac > 0) {
    ctx.beginPath()
    ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2)
    ctx.strokeStyle = scoreColor(data.total)
    ctx.lineWidth = 20
    ctx.lineCap = 'round'
    ctx.stroke()
    ctx.lineCap = 'butt'
  }
  ctx.textAlign = 'center'
  ctx.fillStyle = INK
  ctx.font = `800 84px ${FONT}`
  ctx.fillText(String(data.total), cx, cy + 16)
  ctx.fillStyle = MUTED
  ctx.font = `600 25px ${FONT}`
  ctx.fillText('/ 100', cx, cy + 52)
  ctx.textAlign = 'left'

  // ----- Kolom kanan: verdict, posisi, perbaikan utama -----
  const colX = 392
  const colMax = right - colX

  ctx.fillStyle = INK
  ctx.font = `800 44px ${FONT}`
  ctx.fillText(truncateText(data.label, 30), colX, 300)

  let cursorY = 348
  if (data.role) {
    ctx.fillStyle = BODY
    ctx.font = `400 28px ${FONT}`
    ctx.fillText(truncateText(`Posisi target: ${data.role}`, 42), colX, cursorY)
    cursorY += 42
  }

  ctx.strokeStyle = '#ccfbf1'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(colX, cursorY - 8)
  ctx.lineTo(colX + Math.min(220, colMax), cursorY - 8)
  ctx.stroke()
  cursorY += 34

  ctx.fillStyle = TEAL_DARK
  ctx.font = `700 23px ${FONT}`
  ctx.fillText(data.topFixTitle ? 'PERBAIKAN UTAMA BERIKUTNYA' : 'HASIL PEMERIKSAAN', colX, cursorY)
  cursorY += 44

  const fixText = data.topFixTitle
    ? data.topFixMessage
      ? `${data.topFixTitle} — ${data.topFixMessage}`
      : data.topFixTitle
    : 'Semua pemeriksaan lolos dengan poin penuh. CV ini sudah kuat — tinggal sesuaikan kata kunci untuk tiap lowongan.'
  ctx.fillStyle = BODY
  ctx.font = `400 29px ${FONT}`
  for (const line of wrapText(fixText, 44, 3)) {
    ctx.fillText(line, colX, cursorY)
    cursorY += 40
  }

  // ----- Kaki kartu -----
  ctx.fillStyle = TEAL_DARK
  ctx.font = `600 24px ${FONT}`
  ctx.fillText('Screening CV — screening-cv-app.vercel.app', left, 540)
  ctx.textAlign = 'right'
  ctx.fillStyle = MUTED
  ctx.font = `400 22px ${FONT}`
  ctx.fillText('Hasil analisis otomatis', right, 540)
  ctx.textAlign = 'left'

  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png')
    } catch {
      resolve(null)
    }
  })
}
