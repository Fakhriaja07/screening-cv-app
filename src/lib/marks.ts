// Penanda teks CV: mengubah bukti yang SUDAH dipakai penilaian menjadi
// rentang sorotan pada teks CV asli, untuk panel "Teks CV dengan Tanda".
//
// Modul ini TIDAK memiliki kamus atau logika penilaian sendiri. Semua
// buktinya diambil dari penemu bersama di analyze.ts — kamus frasa lemah,
// kamus salah eja, ambang & penghitung kata "saya", parser entri
// pengalaman, dan penghitung hasil terukur yang sama persis dengan yang
// dipakai pemeriksaan — sehingga tanda tidak mungkin berbeda dari skor.
// Teks CV hanya diproses dari state di memori; tidak ada yang disimpan
// ke localStorage (kebijakan privasi situs tetap utuh).
import {
  SAYA_OVERUSE_THRESHOLD,
  findSayaOccurrences,
  findTypoOccurrences,
  findWeakPhraseOccurrences,
  getExperienceEntrySpans,
} from './analyze'
import type { AiAnalysis } from './ai'

export type MarkKind = 'frasa-lemah' | 'salah-eja' | 'saya' | 'entri' | 'ai'

export interface CvMark {
  id: string
  kind: MarkKind
  // Rentang offset karakter di teks CV asli. Untuk penanda baris entri,
  // start === end: penanda titik di awal baris, bukan sorotan teks —
  // yang kurang dari entri itu adalah angka yang BELUM ditulis, jadi
  // tidak ada teks yang bisa disorot.
  start: number
  end: number
  // Id pemeriksaan terkait di analyze.ts — UI mengambil judul, pesan,
  // dan contoh perbaikannya dari hasil analisis. null untuk tanda AI.
  checkId: string | null
  label: string
  // Bentuk baku, khusus tanda salah eja.
  correction?: string
  // Indeks ke aiResult.saranPenulisanUlang, khusus tanda AI.
  aiIndex?: number
}

// ---------- Tanda dari analisis standar ----------

export function buildStandardMarks(cvText: string): CvMark[] {
  const marks: CvMark[] = []

  // Frasa lemah & klise → sorotan kuning.
  for (const occ of findWeakPhraseOccurrences(cvText)) {
    marks.push({
      id: `frasa-lemah@${occ.start}`,
      kind: 'frasa-lemah',
      start: occ.start,
      end: occ.end,
      checkId: 'frasa-lemah',
      label: occ.display,
    })
  }

  // Kata yang sering salah eja → sorotan merah muda.
  for (const occ of findTypoOccurrences(cvText)) {
    marks.push({
      id: `salah-eja@${occ.start}`,
      kind: 'salah-eja',
      start: occ.start,
      end: occ.end,
      checkId: 'kerapian-bahasa',
      label: cvText.slice(occ.start, occ.end),
      correction: occ.right,
    })
  }

  // Kata "saya" ditandai HANYA bila pemeriksaan kerapian bahasa memang
  // menilainya berlebihan (jumlah kemunculan mencapai ambang bersama) —
  // pemakaian wajar tidak ditandai sama sekali.
  const sayaOccurrences = findSayaOccurrences(cvText)
  if (sayaOccurrences.length >= SAYA_OVERUSE_THRESHOLD) {
    for (const occ of sayaOccurrences) {
      marks.push({
        id: `saya@${occ.start}`,
        kind: 'saya',
        start: occ.start,
        end: occ.end,
        checkId: 'kerapian-bahasa',
        label: cvText.slice(occ.start, occ.end),
      })
    }
  }

  // Entri pengalaman tanpa hasil terukur → penanda titik di awal baris
  // entri. Entrinya adalah entri yang sama yang diurai parser penilaian,
  // dan ketiadaan angkanya dihitung penghitung hasil terukur yang sama.
  for (const span of getExperienceEntrySpans(cvText)) {
    if (!span.hasMeasurableResult) {
      marks.push({
        id: `entri@${span.start}`,
        kind: 'entri',
        start: span.start,
        end: span.start,
        checkId: 'hasil-terukur',
        label: 'Entri pengalaman tanpa hasil terukur',
      })
    }
  }

  return marks
}

// ---------- Tanda dari Analisis AI ----------

// Menormalkan teks untuk pencocokan kutipan AI: huruf kecil + semua
// rangkaian spasi/baris-baru menjadi satu spasi. `map[i]` adalah offset
// di teks asli dari karakter yang menghasilkan karakter ternormalisasi
// ke-i, agar rentang hasil bisa dipetakan balik ke teks asli.
function normalizeWithMap(text: string): { normalized: string; map: number[] } {
  let normalized = ''
  const map: number[] = []
  let pendingSpace = -1
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (/\s/.test(ch)) {
      if (normalized.length > 0 && pendingSpace === -1) pendingSpace = i
      continue
    }
    if (pendingSpace !== -1) {
      normalized += ' '
      map.push(pendingSpace)
      pendingSpace = -1
    }
    normalized += ch.toLowerCase()
    map.push(i)
  }
  return { normalized, map }
}

function normalizePlain(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

// Mencari rentang kutipan "asli" dari AI di teks CV: pencocokan persis
// terlebih dahulu, lalu ternormalisasi (abaikan huruf besar/kecil dan
// perbedaan spasi/baris-baru). Mengembalikan null bila tetap tidak
// ditemukan — pemanggil melewati tanda itu secara diam-diam, karena
// tanda yang dipaksakan di tempat yang salah lebih buruk daripada
// tidak ada tanda (daftar saran AI tetap tampil seperti biasa).
export function findAiQuoteRange(
  cvText: string,
  quote: string,
): { start: number; end: number } | null {
  const q = quote ?? ''
  if (q.trim().length === 0) return null
  const exact = cvText.indexOf(q)
  if (exact !== -1) return { start: exact, end: exact + q.length }
  const needle = normalizePlain(q)
  if (needle.length === 0) return null
  const { normalized, map } = normalizeWithMap(cvText)
  const at = normalized.indexOf(needle)
  if (at === -1) return null
  return { start: map[at], end: map[at + needle.length - 1] + 1 }
}

export function buildAiMarks(cvText: string, ai: AiAnalysis): CvMark[] {
  const marks: CvMark[] = []
  ai.saranPenulisanUlang.forEach((rewrite, i) => {
    const range = findAiQuoteRange(cvText, rewrite.asli)
    if (!range) return
    marks.push({
      id: `ai@${i}@${range.start}`,
      kind: 'ai',
      start: range.start,
      end: range.end,
      checkId: null,
      label: 'Kalimat yang disarankan AI untuk ditulis ulang',
      aiIndex: i,
    })
  })
  return marks
}

// ---------- Resolusi tumpang tindih (deterministik) ----------

// Prioritas bila dua sorotan tumpang tindih: saran AI paling spesifik
// (satu kalimat utuh), lalu salah eja (satu kata persis), lalu frasa
// lemah, terakhir kata "saya". Sorotan berprioritas lebih rendah yang
// tumpang tindih dibuang — informasinya tetap ada di daftar pemeriksaan.
// Penanda titik entri tidak pernah dibuang oleh aturan ini.
const MARK_PRIORITY: Record<MarkKind, number> = {
  ai: 4,
  'salah-eja': 3,
  'frasa-lemah': 2,
  saya: 1,
  entri: 0,
}

export function resolveMarkOverlaps(marks: CvMark[]): CvMark[] {
  const ranges = marks
    .filter((m) => m.end > m.start)
    .sort(
      (a, b) =>
        a.start - b.start ||
        MARK_PRIORITY[b.kind] - MARK_PRIORITY[a.kind] ||
        b.end - b.start - (a.end - a.start),
    )
  const kept: CvMark[] = []
  let keptEnd = -1
  for (const m of ranges) {
    if (m.start >= keptEnd) {
      kept.push(m)
      keptEnd = m.end
    }
  }
  const points = marks.filter((m) => m.end === m.start)
  return [...kept, ...points].sort(
    (a, b) => a.start - b.start || a.end - a.start - (b.end - b.start),
  )
}

export function buildMarks(cvText: string, ai: AiAnalysis | null): CvMark[] {
  const all = buildStandardMarks(cvText)
  if (ai) all.push(...buildAiMarks(cvText, ai))
  return resolveMarkOverlaps(all)
}

// ---------- Segmen render ----------

// Memecah teks menjadi segmen untuk dirender panel: teks biasa, teks
// bertanda (dengan tandanya), dan penanda titik entri. Gabungan teks
// semua segmen non-titik selalu persis teks asli. Penanda titik yang
// jatuh di dalam rentang sorotan lain dilewati agar render tidak rusak
// atau bersarang ganda.
export type MarkSegment =
  | { type: 'text'; text: string }
  | { type: 'mark'; text: string; mark: CvMark }
  | { type: 'point'; mark: CvMark }

export function buildSegments(text: string, marks: CvMark[]): MarkSegment[] {
  const sorted = [...marks].sort(
    (a, b) => a.start - b.start || a.end - a.start - (b.end - b.start),
  )
  const segments: MarkSegment[] = []
  let cursor = 0
  const pushText = (from: number, to: number) => {
    if (to > from) segments.push({ type: 'text', text: text.slice(from, to) })
  }
  for (const m of sorted) {
    if (m.start < cursor) continue
    pushText(cursor, m.start)
    if (m.end > m.start) {
      segments.push({ type: 'mark', text: text.slice(m.start, m.end), mark: m })
      cursor = m.end
    } else {
      segments.push({ type: 'point', mark: m })
      cursor = m.start
    }
  }
  pushText(cursor, text.length)
  return segments
}
