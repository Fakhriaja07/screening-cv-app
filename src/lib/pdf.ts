// Pembangun berkas PDF laporan hasil analisis — tombol "Unduh Laporan
// (PDF)" di kartu Analisis AI mengunduh berkas PDF sungguhan yang dibuat
// di browser dengan jsPDF (bukan dialog cetak/window.print).
//
// Isi dokumen berasal dari pembangun bersama buildReportText
// (src/lib/report.ts): baris-baris teksnya ditata ulang di sini menjadi
// dokumen A4 — judul besar tebal, kepala bagian tebal, teks terbungkus,
// dan halaman lanjut otomatis. Laporan hanya berisi HASIL analisis,
// tidak pernah memuat teks CV, dan tidak disimpan ke mana pun selain
// berkas yang diunduh pengguna sendiri.
import { jsPDF } from 'jspdf'
import { buildReportText, reportFileName, type ReportOptions } from './report'
import type { AnalysisResult } from './analyze'

// Geometri A4 (mm): 210 × 297, margin 16 di semua sisi.
const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 16
const CONTENT_W = PAGE_W - MARGIN * 2
const BOTTOM = PAGE_H - MARGIN

type LineStyle = 'title' | 'meta' | 'score' | 'section' | 'sub' | 'body'

// Klasifikasikan satu baris teks laporan menjadi gaya tampilan PDF.
function styleOf(line: string, isFirst: boolean): LineStyle {
  if (isFirst) return 'title'
  if (line.startsWith('Skor: ') || line.startsWith('Score: ')) return 'score'
  // Kepala bagian ditulis HURUF BESAR dan diakhiri ":" di teks laporan
  // ("SKOR PER ASPEK:", "KEKUATAN:", "ANALISIS AI:", …).
  if (line.endsWith(':') && line === line.toUpperCase()) return 'section'
  // Sub-kepala di dalam bagian AI ("Saran Penulisan Ulang:", "Kekurangan:").
  if (line.endsWith(':') && line.length <= 40) return 'sub'
  // Baris meta tepat di bawah judul.
  if (
    line.startsWith('Tanggal analisis: ') ||
    line.startsWith('Posisi target: ') ||
    line.startsWith('Total kata: ') ||
    line.startsWith('Analysis date: ') ||
    line.startsWith('Target position: ') ||
    line.startsWith('Total words: ')
  ) {
    return 'meta'
  }
  return 'body'
}

// Sanitasi teks untuk font helvetica jsPDF (encoding WinAnsi).
// Probe audit 2026-11-24 membuktikan karakter di luar WinAnsi dirender
// RUSAK oleh jsPDF: "→" tercetak "!’", "✓" menjadi "'", "🚀" menjadi
// "Ø=Þ€", "★" menjadi "&". Jawaban AI sering memakai panah/centang/
// bintang seperti itu — petakan ke padanan aman dan buang sisanya.
// Yang terbukti aman dipertahankan: ASCII, Latin-1 (é, ñ, …), dan
// tanda baca WinAnsi seperti — – • “ ” ‘ ’ € ™. Sanitasi hanya di
// lapisan PDF ini; teks sumber di report.ts tidak diubah.
const PDF_CHAR_MAP: Record<string, string> = {
  '→': '->',
  '⇒': '->',
  '➜': '->',
  '➔': '->',
  '➡': '->',
  '←': '<-',
  '⇐': '<-',
  '⬅': '<-',
  '✓': 'v',
  '✔': 'v',
  '☑': 'v',
  '★': '*',
  '☆': '*',
  '×': 'x',
  '\t': ' ',
}
const WINANSI_PUNCT = new Set([...'•–—‘’“”‚„†‡…‰‹›€™'])

export function sanitizePdfText(text: string): string {
  let out = ''
  for (const ch of text) {
    const mapped = PDF_CHAR_MAP[ch]
    if (mapped !== undefined) {
      out += mapped
      continue
    }
    const cp = ch.codePointAt(0) ?? 0
    if ((cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff) || WINANSI_PUNCT.has(ch)) {
      out += ch
    }
    // Karakter lain (emoji, simbol di luar WinAnsi) dibuang.
  }
  return out
}

const FONT_SIZE: Record<LineStyle, number> = {
  title: 17,
  meta: 10.5,
  score: 13,
  section: 12.5,
  sub: 11,
  body: 11,
}
const LINE_HEIGHT: Record<LineStyle, number> = {
  title: 8,
  meta: 5,
  score: 6.5,
  section: 6,
  sub: 5.4,
  body: 5.4,
}

// Bangun dokumen jsPDF dari hasil analisis. Diekspor untuk uji.
export function buildReportPdfDoc(result: AnalysisResult, opts: ReportOptions = {}): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const lines = buildReportText(result, opts).split('\n')
  let y = MARGIN

  const ensureSpace = (needed: number) => {
    if (y + needed > BOTTOM) {
      doc.addPage()
      y = MARGIN
    }
  }

  lines.forEach((raw, i) => {
    if (raw.trim() === '') {
      y += 2.5
      return
    }
    const style = styleOf(raw, i === 0)
    // Baris kelanjutan (mis. "   Saran: …" pada saran AI) diberi indentasi.
    const indent = /^\s/.test(raw) ? 5 : 0
    const text = sanitizePdfText(raw.trim())

    doc.setFont('helvetica', style === 'body' || style === 'meta' ? 'normal' : 'bold')
    doc.setFontSize(FONT_SIZE[style])
    if (style === 'section') {
      y += 3.5
      ensureSpace(LINE_HEIGHT[style] + 3)
    } else {
      ensureSpace(LINE_HEIGHT[style])
    }
    const wrapped = doc.splitTextToSize(text, CONTENT_W - indent) as string[]
    wrapped.forEach((w, wi) => {
      if (wi > 0) ensureSpace(LINE_HEIGHT[style])
      doc.text(w, MARGIN + indent, y)
      y += LINE_HEIGHT[style]
    })
    if (style === 'section') {
      // Garis tipis di bawah kepala bagian.
      doc.setDrawColor(160)
      doc.setLineWidth(0.3)
      doc.line(MARGIN, y - 3.4, PAGE_W - MARGIN, y - 3.4)
      y += 0.5
    }
    if (style === 'title') y += 1.5
  })

  addPdfFooters(doc, opts.lang)
  return doc
}

// Kaki halaman di setiap halaman: sumber dokumen + nomor halaman.
function addPdfFooters(doc: jsPDF, lang?: ReportOptions['lang']) {
  const total = doc.getNumberOfPages()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(130)
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.text('Screening CV — screening-cv-app.vercel.app', MARGIN, PAGE_H - 8)
    const label = lang === 'en' ? `Page ${p} of ${total}` : `Halaman ${p} dari ${total}`
    doc.text(label, PAGE_W - MARGIN - doc.getTextWidth(label), PAGE_H - 8)
  }
  doc.setTextColor(0)
}

// Isi mentah berkas PDF (untuk uji: awalan "%PDF" + ukuran wajar).
export function buildReportPdfBytes(
  result: AnalysisResult,
  opts: ReportOptions = {},
): Uint8Array {
  return new Uint8Array(buildReportPdfDoc(result, opts).output('arraybuffer'))
}

// Berkas PDF siap unduh: Blob + nama berkas laporan-cv-<tanggal>.pdf.
export function buildReportPdf(
  result: AnalysisResult,
  opts: ReportOptions = {},
): { blob: Blob; fileName: string } {
  const doc = buildReportPdfDoc(result, opts)
  return {
    blob: doc.output('blob'),
    fileName: reportFileName(opts.date ?? new Date()),
  }
}
