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
import {
  buildReportText,
  formatReportDate,
  markedTextFileName,
  reportFileName,
  type ReportOptions,
} from './report'
import { buildMarks, buildSegments, type CvMark, type MarkKind, type MarkSegment } from './marks'
import type { AiAnalysis } from './ai'
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
  if (line.startsWith('Skor: ')) return 'score'
  // Kepala bagian ditulis HURUF BESAR dan diakhiri ":" di teks laporan
  // ("SKOR PER ASPEK:", "KEKUATAN:", "ANALISIS AI:", …).
  if (line.endsWith(':') && line === line.toUpperCase()) return 'section'
  // Sub-kepala di dalam bagian AI ("Saran Penulisan Ulang:", "Kekurangan:").
  if (line.endsWith(':') && line.length <= 40) return 'sub'
  // Baris meta tepat di bawah judul.
  if (
    line.startsWith('Tanggal analisis: ') ||
    line.startsWith('Posisi target: ') ||
    line.startsWith('Total kata: ')
  ) {
    return 'meta'
  }
  return 'body'
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
    const text = raw.trim()

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

  addPdfFooters(doc)
  return doc
}

// Kaki halaman di setiap halaman: sumber dokumen + nomor halaman.
function addPdfFooters(doc: jsPDF) {
  const total = doc.getNumberOfPages()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(130)
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.text('Screening CV — screening-cv-app.vercel.app', MARGIN, PAGE_H - 8)
    const label = `Halaman ${p} dari ${total}`
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

// ---------- PDF teks CV bertanda ----------
//
// Dokumen pendamping laporan: teks CV yang dianalisis, digambar dengan
// sorotan warna yang sama seperti panel "Teks CV dengan Tanda" di
// layar, ditambah legenda dan daftar keterangan semua tanda. Rentang
// tandanya memakai hasil buildMarks/buildSegments dari marks.ts —
// modul ini tidak punya logika tanda atau kamus sendiri. Tanda yang
// pemeriksaannya termasuk daftar "Prioritas Perbaikan" digambar oranye
// (peringkatnya diteruskan dari result.priorities ke buildMarks) dan
// keterangannya diawali label "Prioritas #N —". Berbeda dari
// laporan, dokumen ini memang memuat teks CV pengguna; ia hanya dibuat
// saat pengguna sendiri menekan tombol unduhnya, dan tidak disimpan
// ke mana pun selain berkas yang diunduh itu.

export interface MarkedTextPdfOptions {
  // Hasil Analisis AI — tanda kutipan AI ikut digambar bila ada.
  ai?: AiAnalysis | null
  // Posisi target yang diisi pengguna saat analisis (opsional).
  targetRole?: string
  // Tanggal analisis. Bila diberikan, dicantumkan di kepala dokumen.
  date?: Date
}

// Warna sorotan — sama persis dengan panel layar (App.css):
// .mark-weak #fef08a, .mark-typo #fecdd3, .mark-ai #bfdbfe.
const MARK_FILL: Partial<Record<MarkKind, [number, number, number]>> = {
  'frasa-lemah': [254, 240, 138],
  'salah-eja': [254, 205, 211],
  saya: [254, 205, 211],
  ai: [191, 219, 254],
}
// Warna gaya prioritas — sama dengan .mark-priority di layar (#fdba74):
// tanda yang pemeriksaannya termasuk daftar "Prioritas Perbaikan"
// digambar oranye, menang atas warna jenis tandanya.
const PRIORITY_FILL: [number, number, number] = [253, 186, 116]
// Warna penanda entri — sama dengan .entry-flag di layar (#dc2626),
// dan varian prioritasnya .entry-flag.flag-priority (#ea580c).
const FLAG_RED: [number, number, number] = [220, 38, 38]
const FLAG_PRIORITY: [number, number, number] = [234, 88, 12]

const MARK_KIND_LABEL: Record<MarkKind, string> = {
  'frasa-lemah': 'Frasa lemah & klise',
  'salah-eja': 'Salah eja',
  saya: 'Kata "saya" berlebihan',
  entri: 'Entri tanpa hasil terukur',
  ai: 'Saran penulisan ulang AI',
}

// Potong teks untuk kutipan di keterangan: rangkaian spasi diringkas
// menjadi satu, maksimal `max` karakter, elipsis bila terpotong.
function clipQuote(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
}

// Atom tata letak aliran teks bertanda: kata, spasi, baris baru paksa,
// dan penanda titik entri.
type FlowAtom =
  | { type: 'word'; text: string; mark: CvMark | null }
  | { type: 'space'; mark: CvMark | null }
  | { type: 'newline' }
  | { type: 'point'; mark: CvMark }

// Memecah segmen panel menjadi atom: kata per kata (tanda segmennya
// menempel ke setiap kata), rangkaian spasi biasa diringkas menjadi
// satu spasi, dan setiap '\n' menjadi atom baris baru tersendiri.
function tokenizeSegments(segments: MarkSegment[]): FlowAtom[] {
  const atoms: FlowAtom[] = []
  for (const seg of segments) {
    if (seg.type === 'point') {
      atoms.push({ type: 'point', mark: seg.mark })
      continue
    }
    const mark = seg.type === 'mark' ? seg.mark : null
    for (const part of seg.text.split(/(\s+)/)) {
      if (part === '') continue
      if (!/^\s+$/.test(part)) {
        atoms.push({ type: 'word', text: part, mark })
        continue
      }
      let spacePushed = false
      for (const chunk of part.split(/(\n)/)) {
        if (chunk === '') continue
        if (chunk === '\n') {
          atoms.push({ type: 'newline' })
          spacePushed = false
        } else if (!spacePushed) {
          atoms.push({ type: 'space', mark })
          spacePushed = true
        }
      }
    }
  }
  return atoms
}

// Satu item yang sudah ditempatkan pada baris tata letak berjalan.
interface FlowItem {
  kind: 'word' | 'space' | 'flag'
  text: string
  x: number
  width: number
  mark: CvMark | null
}

// Bangun dokumen jsPDF teks CV bertanda. Diekspor untuk uji.
export function buildMarkedTextPdfDoc(
  result: AnalysisResult,
  cvText: string,
  opts: MarkedTextPdfOptions = {},
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const ai = opts.ai ?? null
  // Daftar prioritas hasil analisis diteruskan agar peringkat tanda di
  // PDF sama persis dengan panel layar dan daftar "Prioritas Perbaikan".
  const marks = buildMarks(cvText, ai, result.priorities)
  const segments = buildSegments(cvText, marks)
  // Tanda yang benar-benar tergambar adalah tanda pada segmen render:
  // penanda titik yang jatuh di dalam sorotan lain dilewati
  // buildSegments (sama seperti panel layar), jadi daftar keterangan
  // menuruti daftar ini agar selalu cocok dengan yang terlihat.
  const drawnMarks: CvMark[] = []
  for (const seg of segments) {
    if (seg.type !== 'text' && !drawnMarks.includes(seg.mark)) drawnMarks.push(seg.mark)
  }
  const checkMessage = (checkId: string | null): string | null =>
    checkId
      ? (result.aspects.flatMap((a) => a.checks).find((c) => c.id === checkId)?.message ?? null)
      : null

  const RIGHT = PAGE_W - MARGIN
  let y = MARGIN

  const ensureSpace = (needed: number) => {
    if (y + needed > BOTTOM) {
      doc.addPage()
      y = MARGIN
    }
  }
  // Tulis teks terbungkus (kepala dokumen & keterangan tanda).
  const writeLines = (
    text: string,
    style: { size: number; bold?: boolean; indent?: number; lineH: number },
  ) => {
    const indent = style.indent ?? 0
    doc.setFont('helvetica', style.bold ? 'bold' : 'normal')
    doc.setFontSize(style.size)
    const wrapped = doc.splitTextToSize(text, CONTENT_W - indent) as string[]
    for (const w of wrapped) {
      ensureSpace(style.lineH)
      doc.text(w, MARGIN + indent, y)
      y += style.lineH
    }
  }
  // Kepala bagian bergaris, gaya sama dengan PDF laporan.
  const writeSection = (title: string) => {
    y += 3.5
    ensureSpace(9.5)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12.5)
    doc.text(title, MARGIN, y)
    y += 6
    doc.setDrawColor(160)
    doc.setLineWidth(0.3)
    doc.line(MARGIN, y - 3.4, RIGHT, y - 3.4)
    y += 0.5
  }

  // ----- Kepala dokumen -----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.text('Teks CV dengan Tanda', MARGIN, y)
  y += 9.5
  if (opts.date) {
    writeLines(`Tanggal analisis: ${formatReportDate(opts.date)}`, { size: 10.5, lineH: 5 })
  }
  const role = opts.targetRole?.trim()
  if (role) writeLines(`Posisi target: ${role}`, { size: 10.5, lineH: 5 })

  // ----- Legenda -----
  writeSection('LEGENDA:')
  const legendRow = (
    fill: [number, number, number] | null,
    label: string,
    flagColor: [number, number, number] = FLAG_RED,
  ) => {
    ensureSpace(5.4)
    if (fill) {
      doc.setFillColor(...fill)
      doc.rect(MARGIN, y - 3.1, 6, 3.6, 'F')
    } else {
      // Kotak contoh penanda entri: token "[!]" tebal merah (glif aman
      // WinAnsi) — simbol yang sama yang digambar di aliran teks.
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10.5)
      doc.setTextColor(...flagColor)
      doc.text('[!]', MARGIN, y)
      doc.setTextColor(0)
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10.5)
    doc.text(label, MARGIN + 8.5, y)
    y += 5.4
  }
  if (drawnMarks.some((m) => m.priorityRank !== undefined)) {
    legendRow(PRIORITY_FILL, 'Oranye — prioritas perbaikan')
  }
  legendRow([254, 240, 138], 'Kuning — frasa lemah & klise')
  legendRow([254, 205, 211], 'Merah muda — salah eja / kata "saya" berlebihan')
  if (drawnMarks.some((m) => m.kind === 'ai')) {
    legendRow([191, 219, 254], 'Biru — kalimat yang disarankan AI untuk ditulis ulang')
  }
  if (drawnMarks.some((m) => m.kind === 'entri')) {
    legendRow(
      null,
      'Penanda entri pengalaman tanpa hasil terukur (angka pencapaian)',
      drawnMarks.some((m) => m.kind === 'entri' && m.priorityRank !== undefined)
        ? FLAG_PRIORITY
        : FLAG_RED,
    )
  }

  // ----- Aliran teks CV bertanda -----
  writeSection('TEKS CV:')
  const BODY = 10.5
  const LINE_H = 5.6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(BODY)
  const spaceW = doc.getTextWidth(' ')
  let x = MARGIN
  let items: FlowItem[] = []

  // Gambar satu baris yang sudah tertata: persegi latar sorotan lebih
  // dulu (per rentang tanda yang berurutan pada baris ini), lalu
  // teksnya di atas sorotan.
  const renderLine = () => {
    const line = [...items]
    while (line.length && line[line.length - 1].kind === 'space') line.pop()
    let runMark: CvMark | null = null
    let runFrom = 0
    let runTo = 0
    const flushRun = () => {
      if (!runMark) return
      // Gaya prioritas menang atas warna jenis tanda, sama seperti panel.
      const fill =
        runMark.priorityRank !== undefined ? PRIORITY_FILL : MARK_FILL[runMark.kind]
      if (fill) {
        doc.setFillColor(...fill)
        doc.rect(runFrom - 0.5, y - 3.9, runTo - runFrom + 1, 5.3, 'F')
      }
      runMark = null
    }
    for (const it of line) {
      if (it.kind !== 'flag' && it.mark) {
        if (runMark && runMark.id === it.mark.id) {
          runTo = it.x + it.width
        } else {
          flushRun()
          runMark = it.mark
          runFrom = it.x
          runTo = it.x + it.width
        }
      } else {
        flushRun()
      }
    }
    flushRun()
    for (const it of line) {
      if (it.kind === 'space') continue
      doc.setFontSize(BODY)
      if (it.kind === 'flag') {
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(
          ...(it.mark?.priorityRank !== undefined ? FLAG_PRIORITY : FLAG_RED),
        )
        doc.text('[!]', it.x, y)
        doc.setTextColor(0)
      } else {
        doc.setFont('helvetica', 'normal')
        doc.text(it.text, it.x, y)
      }
    }
  }

  // Selesaikan baris berjalan: gambar di posisi y saat ini (pindah
  // halaman dulu bila sudah melewati batas bawah), lalu maju satu
  // baris. Baris kosong (baris baru berturutan) maju lebih pendek.
  const finalizeLine = () => {
    if (y > BOTTOM) {
      doc.addPage()
      y = MARGIN + 4
    }
    renderLine()
    const advance = items.length === 0 ? LINE_H * 0.55 : LINE_H
    items = []
    x = MARGIN
    y += advance
  }

  const placeWord = (text: string, mark: CvMark | null, flag = false) => {
    doc.setFont('helvetica', flag ? 'bold' : 'normal')
    doc.setFontSize(BODY)
    const w = doc.getTextWidth(text) + (flag ? 1.6 : 0)
    if (x > MARGIN && x + w > RIGHT) finalizeLine()
    if (!flag && w > CONTENT_W) {
      // Kata tunggal lebih lebar dari kolom (mis. URL panjang): pecah
      // menjadi potongan yang muat, tanda tetap menempel.
      const chunks = doc.splitTextToSize(text, CONTENT_W) as string[]
      chunks.forEach((chunk, ci) => {
        if (ci > 0) finalizeLine()
        placeWord(chunk, mark)
      })
      return
    }
    items.push({ kind: flag ? 'flag' : 'word', text, x, width: w, mark })
    x += w
  }

  const placeSpace = (mark: CvMark | null) => {
    if (items.length === 0) return // spasi di awal baris dibuang
    if (x + spaceW > RIGHT) return // spasi di ujung baris: kata berikutnya membungkus
    items.push({ kind: 'space', text: ' ', x, width: spaceW, mark })
    x += spaceW
  }

  for (const atom of tokenizeSegments(segments)) {
    if (atom.type === 'newline') finalizeLine()
    else if (atom.type === 'space') placeSpace(atom.mark)
    else if (atom.type === 'point') placeWord('[!]', atom.mark, true)
    else placeWord(atom.text, atom.mark)
  }
  finalizeLine()

  // ----- Keterangan tanda -----
  y += 2
  writeSection('KETERANGAN TANDA:')
  if (drawnMarks.length === 0) {
    writeLines(
      'Tidak ada tanda pada teks ini — tidak ditemukan frasa lemah, kata salah eja dari daftar periksa, kata "saya" yang berlebihan, atau entri pengalaman tanpa angka.',
      { size: 10.5, lineH: 5.4 },
    )
  }
  drawnMarks.forEach((mark, i) => {
    let quote: string
    if (mark.kind === 'entri') {
      const nl = cvText.indexOf('\n', mark.start)
      quote = clipQuote(cvText.slice(mark.start, nl === -1 ? undefined : nl), 80)
    } else {
      quote = clipQuote(cvText.slice(mark.start, mark.end), 110)
    }
    writeLines(
      `${i + 1}. ${mark.priorityRank !== undefined ? `Prioritas #${mark.priorityRank} — ` : ''}${MARK_KIND_LABEL[mark.kind]} — “${quote}”`,
      {
        size: 11,
        bold: true,
        lineH: 5.6,
      },
    )
    const notes: string[] = []
    if (mark.kind === 'frasa-lemah') {
      notes.push('Frasa generik yang diklaim hampir semua pelamar tanpa bukti.')
    } else if (mark.kind === 'salah-eja') {
      notes.push(
        mark.correction
          ? `“${mark.label}” adalah bentuk tidak baku. Bentuk bakunya: “${mark.correction}”.`
          : 'Kata ini tidak sesuai dengan bentuk baku bahasa Indonesia.',
      )
    } else if (mark.kind === 'saya') {
      notes.push(
        'Salah satu kemunculan kata "saya" di bagian pengalaman; jumlah keseluruhannya dinilai berlebihan.',
      )
    } else if (mark.kind === 'entri') {
      notes.push(
        'Entri pengalaman ini belum memuat satu pun hasil terukur (angka pencapaian). Yang kurang adalah angka yang belum ditulis — tambahkan angka hasil nyata dari pekerjaanmu di entri ini.',
      )
    } else if (mark.kind === 'ai' && ai && mark.aiIndex !== undefined) {
      const rewrite = ai.saranPenulisanUlang[mark.aiIndex]
      if (rewrite) {
        notes.push(`Saran AI: ${rewrite.saran}`)
        if (rewrite.alasan) notes.push(`Alasan: ${rewrite.alasan}`)
      }
    }
    const msg = checkMessage(mark.checkId)
    if (msg) notes.push(msg)
    for (const note of notes) {
      writeLines(note, { size: 10.5, indent: 5, lineH: 5.4 })
    }
    y += 2
  })

  addPdfFooters(doc)
  return doc
}

// Isi mentah berkas PDF teks bertanda (untuk uji: awalan "%PDF").
export function buildMarkedTextPdfBytes(
  result: AnalysisResult,
  cvText: string,
  opts: MarkedTextPdfOptions = {},
): Uint8Array {
  return new Uint8Array(buildMarkedTextPdfDoc(result, cvText, opts).output('arraybuffer'))
}

// Berkas PDF teks bertanda siap unduh: Blob + nama berkas
// teks-cv-bertanda-<tanggal>.pdf.
export function buildMarkedTextPdf(
  result: AnalysisResult,
  cvText: string,
  opts: MarkedTextPdfOptions = {},
): { blob: Blob; fileName: string } {
  const doc = buildMarkedTextPdfDoc(result, cvText, opts)
  return {
    blob: doc.output('blob'),
    fileName: markedTextFileName(opts.date ?? new Date()),
  }
}
