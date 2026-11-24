// Logika penilaian CV berbasis aturan (rule-based), 100% berjalan di browser.
// Total selalu 100 poin. Komposisi dasar: 6 aspek, 23 pemeriksaan —
// ditambah 2 pemeriksaan kondisional (relevansi ringkasan dan relevansi
// pengalaman, hanya bila posisi target diisi) dan 1 aspek kondisional
// (Kecocokan dengan Lowongan, hanya bila deskripsi lowongan diisi; aspek
// lain diskalakan proporsional ×0,8 sehingga total tetap 100).
//
// Riwayat pendekatan: pengetatan berbasis kuota angka (2026-11-19 pagi)
// DIBATALKAN atas koreksi pengguna. Kekuatan penilaian kini datang dari
// keluasan aspek yang dinilai: selain pemeriksaan dasar v1, kini dinilai
// juga kedalaman entri pengalaman, frasa lemah/klise, sertifikasi &
// pelatihan, bahasa asing, konsistensi format periode & urutan kronologis,
// kerapian bahasa, dan relevansi ringkasan terhadap posisi target.
// Kuota pemeriksaan dasar tetap memakai ambang v1 (kata kerja aksi ≥5,
// angka pencapaian ≥3, skill ≥8, panjang ideal 220–900 kata, label ≥85).
//
// Peningkatan standar 2026-11-21 (tetap berbasis aspek, BUKAN kuota):
// dimensi yang paling menentukan di mata perekrut kini ikut dinilai —
// kecocokan kata kunci lowongan masuk skor (aspek kondisional di atas),
// relevansi pengalaman terhadap posisi target, linimasa pengalaman
// (kesenjangan panjang & kebaruan peran terakhir), lokasi domisili pada
// aspek Kontak, dan proyek/magang/organisasi sebagai bukti pengalaman
// (keadilan bagi fresh graduate). Ambang pemeriksaan lama tidak diubah;
// bobot di dalam aspek Pengalaman & Kontak dibagi ulang untuk memberi
// ruang bagi dimensi baru, total aspek tetap sama.

import { expandJobTitle } from './jobGlossary'

export type CheckStatus = 'baik' | 'kurang' | 'buruk'

export interface CheckItem {
  id: string
  aspect: string
  title: string
  score: number
  max: number
  status: CheckStatus
  message: string
}

export interface AspectResult {
  name: string
  score: number
  max: number
  checks: CheckItem[]
}

export interface KeywordResult {
  percent: number
  found: string[]
  missing: string[]
  total: number
}

export interface AnalysisResult {
  total: number
  label: string
  aspects: AspectResult[]
  strengths: CheckItem[]
  priorities: CheckItem[]
  keywords: KeywordResult | null
  // true bila deskripsi lowongan diisi DAN menghasilkan kata kunci,
  // sehingga aspek "Kecocokan dengan Lowongan" ikut menentukan skor.
  jobMatchApplied: boolean
  roleWarning: string | null
  portfolioUrl: string | null
  wordCount: number
}

export interface AnalyzeOptions {
  targetRole?: string
  jobDesc?: string
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

function statusOf(score: number, max: number): CheckStatus {
  if (score >= max) return 'baik'
  if (score <= 0) return 'buruk'
  return 'kurang'
}

function makeCheck(
  id: string,
  aspect: string,
  title: string,
  score: number,
  max: number,
  message: string,
): CheckItem {
  return { id, aspect, title, score, max, status: statusOf(score, max), message }
}

// ---------- Deteksi nomor HP Indonesia ----------

export function findPhone(text: string): string | null {
  const candidates = text.match(/\+?\(?\d[\d\s().-]{6,}\d/g) ?? []
  for (const candidate of candidates) {
    const digits = candidate.replace(/\D/g, '')
    // 08xx: total 10-14 digit
    if (/^08\d{8,12}$/.test(digits)) return candidate.trim()
    // 628xx: total 11-15 digit
    if (/^628\d{8,12}$/.test(digits)) return candidate.trim()
  }
  // Lintasan kedua (audit 2026-11-24): kandidat rakus di atas menelan
  // rangkaian digit lain yang sebaris tanpa koma — "2020 - 2022
  // 081234567890" menjadi satu kandidat 20 digit yang gagal uji, sehingga
  // nomor sah tidak pernah dicoba sendiri. Cari pola yang berjangkar pada
  // awalan nomor HP Indonesia (08 / 628) di mana pun di teks, lalu uji
  // digitnya dengan aturan yang sama persis. Jangkar awalan + penjaga
  // "tidak didahului digit" membuat rentang tahun ("2015-2020") dan
  // angka lain tetap tidak terbaca sebagai nomor HP.
  const anchored =
    text.match(/(?<!\d)(?:\+?\(?62[\s().-]?|0)8(?:[\s().-]?\d){8,12}(?!\d)/g) ?? []
  for (const candidate of anchored) {
    const digits = candidate.replace(/\D/g, '')
    if (/^08\d{8,12}$/.test(digits)) return candidate.trim()
    if (/^628\d{8,12}$/.test(digits)) return candidate.trim()
  }
  return null
}

export function detectPhone(text: string): boolean {
  return findPhone(text) !== null
}

// ---------- Deteksi link portofolio ----------

const PORTFOLIO_DOMAINS = [
  'github.com',
  'gitlab.com',
  'behance.net',
  'dribbble.com',
  'kaggle.com',
  'bitbucket.org',
  'codepen.io',
  'artstation.com',
  'notion.site',
  'notion.so',
]

const PORTFOLIO_SUFFIXES = ['.vercel.app', '.netlify.app', '.github.io']

const URL_PATTERN =
  /(https?:\/\/[^\s,;<>)\]]+|www\.[^\s,;<>)\]]+|[a-z0-9-]+\.[a-z]{2,}(?:\.[a-z]{2,})?(?:\/[\w\-./#?=&%+]*)?)/gi

function domainOf(raw: string): string {
  return raw
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    .toLowerCase()
}

export function findPortfolio(text: string): string | null {
  // 1) URL pada domain portofolio yang dikenal, di mana pun di CV.
  const urls = text.match(URL_PATTERN) ?? []
  for (const raw of urls) {
    const clean = raw.replace(/[.)]+$/, '')
    const domain = domainOf(clean)
    const known =
      PORTFOLIO_DOMAINS.some((d) => domain === d || domain.endsWith('.' + d)) ||
      PORTFOLIO_SUFFIXES.some((s) => domain.endsWith(s))
    if (known) return clean
  }
  // 2) URL apa pun pada baris berlabel "portofolio"/"portfolio".
  for (const line of text.split('\n')) {
    if (/portofolio|portfolio/i.test(line)) {
      const labeled = line.match(URL_PATTERN) ?? []
      for (const raw of labeled) {
        const clean = raw.replace(/[.)]+$/, '')
        // Hindari menangkap kata "portofolio" itu sendiri atau domain tanpa TLD jelas.
        if (domainOf(clean).includes('.')) return clean
      }
    }
  }
  return null
}

// ---------- Ekstraksi bagian (section) berdasarkan heading ----------

const ALL_HEADING_WORDS = [
  'ringkasan',
  'tentang saya',
  'profil',
  'summary',
  'profile',
  'objective',
  'tentang',
  'pengalaman',
  'experience',
  'pekerjaan',
  'work history',
  'riwayat kerja',
  'pendidikan',
  'education',
  'keahlian',
  'skill',
  'kemampuan',
  'kompetensi',
  'tools',
  'teknologi',
  'proyek',
  'project',
  'sertifikasi',
  'certification',
  'kontak',
  'contact',
  'bahasa',
  'language',
  'languages',
]

// Kosakata kata yang lazim menyusun baris heading bagian CV. Sebuah baris
// hanya dianggap heading bila SELURUH katanya berasal dari kosakata ini
// (angka tahun diperbolehkan) DAN baris itu memuat salah satu kata/frasa
// target sebagai kata utuh. Aturan ini memperbaiki bug audit 2026-11-24:
// pencocokan substring lama ("includes") membuat kalimat narasi pendek
// seperti "Saya profesional berpengalaman." dianggap heading (potongan
// "pengalaman" di dalam "berpengalaman"), sehingga bagian ringkasan dan
// pengalaman terpotong hilang; bullet seperti "- Led training…" juga
// bisa menyamar menjadi heading bagian lain. Kalimat narasi hampir selalu
// memuat kata kerja/kata di luar kosakata ini, jadi aturan kata-utuh +
// kosakata penuh aman untuk heading sungguhan ("Pengalaman Kerja",
// "Riwayat Pendidikan", "Keahlian & Tools", "Bahasa", …).
const HEADING_VOCAB = new Set([
  ...ALL_HEADING_WORDS.flatMap((w) => w.split(' ')),
  // Kata penyusun daftar heading lain (proyek/magang) + penghubung dan
  // kata pelengkap yang lazim pada baris heading sungguhan.
  'magang', 'internship', 'kepanitiaan', 'pkl', 'volunteer', 'relawan',
  'kegiatan', 'dan', 'and', 'asing', 'organisasi', 'praktik', 'praktek',
  'singkat', 'diri', 'teknis', 'pribadi', 'profesional', 'pelatihan',
  'kursus', 'komputer', 'inggris', 'mandarin', 'jepang', 'korea', 'arab',
  'jerman', 'prancis', 'belanda', 'spanyol',
])

function isHeadingLine(line: string, words: string[]): boolean {
  if (BULLET_LINE.test(line)) return false
  const trimmed = line
    .trim()
    .toLowerCase()
    .replace(/^#+\s*/, '')
    .replace(/[:：]\s*$/, '')
    .trim()
  if (trimmed.length === 0 || trimmed.length > 60) return false
  const tokens: string[] = trimmed.match(/[a-z]+|\d+/g) ?? []
  if (tokens.length === 0) return false
  if (!tokens.every((t) => /^\d+$/.test(t) || HEADING_VOCAB.has(t))) return false
  return words.some((w) => {
    const wt = w.toLowerCase().split(' ')
    if (wt.length === 1) return tokens.includes(wt[0])
    for (let i = 0; i + wt.length <= tokens.length; i++) {
      if (wt.every((x, k) => tokens[i + k] === x)) return true
    }
    return false
  })
}

// Kata heading bagian ringkasan/profil — satu-satunya daftar yang
// dipakai penilaian (analyzeCv) dan pembaca bagian ringkasan lain
// (contoh personal), agar keduanya selalu membaca bagian yang sama.
const SUMMARY_HEADINGS = [
  'ringkasan', 'tentang saya', 'profil', 'summary', 'profile', 'objective', 'tentang',
]

// Isi bagian ringkasan/profil dari teks CV (string kosong bila tidak ada).
export function getSummarySection(text: string): string {
  return getSection(text, SUMMARY_HEADINGS)
}

function getSection(text: string, targets: string[]): string {
  const lines = text.split('\n')
  let start = -1
  for (let i = 0; i < lines.length; i++) {
    if (isHeadingLine(lines[i], targets)) {
      start = i
      break
    }
  }
  if (start === -1) return ''
  const collected: string[] = []
  for (let i = start + 1; i < lines.length; i++) {
    if (isHeadingLine(lines[i], ALL_HEADING_WORDS)) break
    collected.push(lines[i])
  }
  return collected.join('\n').trim()
}

// Kata heading bagian keahlian — satu-satunya daftar yang dipakai
// penilaian dan pembaca item keahlian lain (contoh personal).
const SKILL_HEADINGS = ['keahlian', 'skill', 'kemampuan', 'kompetensi', 'tools', 'teknologi']

// Item-item pada bagian keahlian, diekstrak dengan cara yang persis
// sama dengan yang dihitung pemeriksaan daftar keahlian — dipakai
// penilaian dan lapisan tampilan dari sumber yang sama.
export function getSkillItems(rawText: string): string[] {
  const section = getSection(rawText, SKILL_HEADINGS)
  if (!section) return []
  return section
    .split(/[\n,;•·|]+/)
    .map((s) => s.replace(/^\s*[-*]\s*/, '').trim())
    .filter((s) => s.length >= 2)
}

// Pola sebutan kemampuan bahasa asing di dalam teks — pola yang sama
// yang dipakai pemeriksaan bahasa untuk membedakan "disebut di dalam
// CV" dari "sudah menjadi bagian tersendiri".
export const LANGUAGE_MENTION =
  /(bahasa\s+(inggris|mandarin|jepang|korea|arab|jerman|prancis|belanda|spanyol)|toefl|ielts|jlpt|hsk)/i

// Item-item pada bagian bahasa, diekstrak dengan cara yang persis
// sama dengan yang dihitung pemeriksaan bahasa asing.
export function getLanguageItems(rawText: string): string[] {
  const section = getSection(rawText, ['bahasa', 'language', 'languages'])
  if (!section) return []
  return section
    .split(/[\n,;•·|]+/)
    .map((s) => s.replace(/^\s*[-*]\s*/, '').trim())
    .filter((s) => s.length >= 2)
}

export const BULLET_LINE = /^\s*(?:[-•*·]|\d+[.)])\s+/

// Memecah teks menjadi baris beserta offset awal tiap baris di teks asli.
function splitLinesWithOffsets(text: string): { line: string; start: number }[] {
  const lines: { line: string; start: number }[] = []
  let start = 0
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === '\n') {
      lines.push({ line: text.slice(start, i), start })
      start = i + 1
    }
  }
  return lines
}

// Rentang isi bagian pengalaman di teks asli: dari awal baris pertama
// sesudah heading sampai akhir baris terakhir sebelum heading bagian
// berikutnya. Inilah SATU-SATUNYA logika penentu batas bagian pengalaman:
// getExperienceSection (isi bagian untuk penilaian) dan penemu
// kemunculan bersama di bawah sama-sama memakainya, jadi kemunculan
// tidak pernah dihitung dari bagian yang berbeda dari yang dinilai.
export interface SectionRange {
  start: number
  end: number
}

// SEMUA rentang bagian pengalaman di teks. CV nyata sering memisahkan
// "Pengalaman Kerja" dan "Pengalaman Organisasi/Magang" menjadi dua
// bagian berheading sendiri — audit 2026-11-24 menemukan versi lama yang
// hanya membaca bagian pertama membuat kedalaman entri & linimasa
// mengabaikan peran di bagian kedua dan mengeluh peran terakhir sudah
// lama berakhir padahal ada peran baru di bagian berikutnya.
export function getExperienceSectionRanges(text: string): SectionRange[] {
  const targets = ['pengalaman', 'experience', 'pekerjaan', 'work history', 'riwayat kerja']
  const lines = splitLinesWithOffsets(text)
  const ranges: SectionRange[] = []
  let i = 0
  while (i < lines.length) {
    if (!BULLET_LINE.test(lines[i].line) && isHeadingLine(lines[i].line, targets)) {
      let last = -1
      let j = i + 1
      for (; j < lines.length; j++) {
        if (!BULLET_LINE.test(lines[j].line) && isHeadingLine(lines[j].line, ALL_HEADING_WORDS)) break
        last = j
      }
      if (last >= i + 1) {
        ranges.push({
          start: lines[i + 1].start,
          end: lines[last].start + lines[last].line.length,
        })
      }
      i = j
    } else {
      i++
    }
  }
  return ranges
}

export function getExperienceSectionRange(text: string): SectionRange | null {
  return getExperienceSectionRanges(text)[0] ?? null
}

// Varian ekstraksi khusus bagian pengalaman: baris bullet tidak pernah
// dianggap heading (bullet yang menyebut kata "proyek" dsb. tidak memotong
// bagian secara keliru). Isi SEMUA bagian pengalaman digabungkan agar
// setiap pemeriksaan menilai keseluruhan riwayat, bukan bagian pertama
// saja.
function getExperienceSection(text: string): string {
  const ranges = getExperienceSectionRanges(text)
  if (ranges.length === 0) return ''
  return ranges
    .map((r) => text.slice(r.start, r.end))
    .join('\n')
    .trim()
}

// ---------- Kata kerja aksi & hasil terukur ----------

export const ACTION_VERBS = [
  'meningkatkan',
  'mengelola',
  'membangun',
  'mengembangkan',
  'menganalisis',
  'memimpin',
  'merancang',
  'mengotomatisasi',
  'mencapai',
  'menurunkan',
  'menghemat',
  'membuat',
  'menjual',
  'melatih',
  'increased',
  'managed',
  'developed',
  'built',
  'led',
  'created',
  'improved',
  'analyzed',
  'designed',
  'automated',
  'reduced',
]

function countActionVerbs(lowerText: string): number {
  let found = 0
  for (const verb of ACTION_VERBS) {
    if (new RegExp(`\\b${verb}\\b`, 'i').test(lowerText)) found++
  }
  return found
}

function countMeasurableResults(text: string): number {
  let t = text
  // Buang rangkaian mirip nomor HP/telepon agar digitnya tidak terhitung.
  t = t.replace(/\+?\(?\d[\d\s().-]{6,}\d/g, ' ')
  // Buang tahun kalender 19xx/20xx (termasuk rentang tahun).
  t = t.replace(/\b(19|20)\d{2}\b/g, ' ')
  // Nominal Rp dihitung sekali, lalu dibuang agar tidak terhitung ganda via satuan.
  const rpMatches = t.match(/rp\s*\d[\d.,]*/gi) ?? []
  t = t.replace(/rp\s*\d[\d.,]*/gi, ' ')
  const unitMatches =
    t.match(/\d+(?:[.,]\d+)?\s*(%|juta|ribu|orang|klien|proyek|jam|hari|bulan|tahun)/gi) ?? []
  return rpMatches.length + unitMatches.length
}

// ---------- Struktur entri pengalaman (kedalaman entri) ----------

interface ExperienceEntryInfo {
  hasTitle: boolean
  hasCompany: boolean
  hasPeriod: boolean
}

function parseExperienceEntry(line: string): ExperienceEntryInfo {
  const hasPeriod =
    /\b(19|20)\d{2}\b/.test(line) || /\b(sekarang|saat ini|present)\b/i.test(line)
  const companyMatch = line.match(
    /\b(?:PT|CV|UD)\.?\s+[A-Za-z][A-Za-z&.]*(\s+[A-Za-z][A-Za-z&.]*)*/,
  )
  const hasCompany =
    companyMatch !== null ||
    /(universitas|institut|politeknik|akademi|yayasan|bank|kementerian|dinas|rumah sakit|sekolah)/i.test(
      line,
    ) ||
    // Pola umum CV Indonesia tanpa awalan PT/CV: "Jabatan — Nama Tempat
    // (periode)" atau "Jabatan di Nama Tempat" — nama berhuruf kapital
    // setelah tanda pisah / kata "di" dianggap nama perusahaan/tempat kerja.
    /(?:—|–|\s-\s)\s*[A-Z][A-Za-z]*/.test(line) ||
    /\bdi\s+[A-Z]/.test(line)
  const rest = line
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(companyMatch?.[0] ?? ' ', ' ')
  const titleWords = rest.match(/[A-Za-z]{3,}/g) ?? []
  const hasTitle = titleWords.length >= 1
  return { hasTitle, hasCompany, hasPeriod }
}

interface ExperienceBlock {
  complete: boolean
  hasContent: boolean
  // Kelengkapan komponen entri dari parseExperienceEntry (judul /
  // perusahaan / periode) — disimpan agar lapisan tampilan bisa
  // menyebut komponen yang kurang tanpa menghitung ulang.
  info: ExperienceEntryInfo
  startYear: number | null
  endYear: number | null // null bila peran masih berjalan (saat ini)
  isCurrent: boolean
  // Indeks baris (di dalam baris-baris bagian pengalaman) yang menjadi
  // awal entri (baris judul bila ada, jika tidak baris jangkar) dan baris
  // isi terakhir entri.
  firstLine: number
  lastLine: number
}

// Memecah bagian pengalaman menjadi entri. Jangkar entri = baris BUKAN
// bullet yang memuat tahun/periode (format umum: "Jabatan — Perusahaan
// (2022–2024)" dalam satu baris, atau baris periode tepat di bawah baris
// judul). Isi entri = baris-baris setelah jangkar sampai jangkar berikutnya;
// baris non-bullet terakhir sebelum jangkar berikutnya dianggap judul
// entri berikutnya, bukan isi.
function parseExperienceBlocks(section: string): ExperienceBlock[] {
  if (!section) return []
  const lines = section.split('\n')
  const hasPeriodMark = (l: string) =>
    /\b(19|20)\d{2}\b/.test(l) || /\b(sekarang|saat ini|present)\b/i.test(l)
  const anchors: number[] = []
  lines.forEach((l, i) => {
    if (!BULLET_LINE.test(l) && hasPeriodMark(l)) anchors.push(i)
  })
  if (anchors.length === 0) return []

  // Baris judul yang masuk akal: pendek dan bukan kalimat (tidak diakhiri
  // tanda titik). Audit 2026-11-24: tanpa penjaga ini, baris paragraf
  // uraian entri sebelumnya dicuri sebagai "judul" entri berikutnya
  // (pengelompokan entri bergeser — uraian Kasir terbaca sebagai judul
  // entri Staf Gudang), terutama bila baris jangkar berikutnya sebenarnya
  // sudah memuat judul + perusahaan sendiri.
  const isPlausibleTitle = (l: string) => {
    const t = l.trim()
    return t.length > 0 && t.length <= 60 && !BULLET_LINE.test(l) && !/[.!?…]$/.test(t)
  }
  const anchorSelfTitled = (idx: number) => {
    const info = parseExperienceEntry(lines[idx])
    return info.hasTitle && info.hasCompany
  }

  // Judul entri pertama bisa berada pada baris tepat sebelum jangkar pertama.
  let pendingTitle = ''
  let pendingTitleIdx = -1
  if (!anchorSelfTitled(anchors[0])) {
    for (let i = anchors[0] - 1; i >= 0; i--) {
      if (lines[i].trim() === '') continue
      if (isPlausibleTitle(lines[i])) {
        pendingTitle = lines[i]
        pendingTitleIdx = i
      }
      break
    }
  }

  const blocks: ExperienceBlock[] = []
  for (let k = 0; k < anchors.length; k++) {
    const a = anchors[k]
    const end = k + 1 < anchors.length ? anchors[k + 1] : lines.length
    let body = lines.slice(a + 1, end)
    let nextTitle = ''
    let nextTitleIdx = -1
    if (k + 1 < anchors.length && !anchorSelfTitled(anchors[k + 1])) {
      let lastIdx = -1
      for (let i = body.length - 1; i >= 0; i--) {
        if (body[i].trim() !== '') {
          lastIdx = i
          break
        }
      }
      if (lastIdx >= 0 && isPlausibleTitle(body[lastIdx])) {
        nextTitle = body[lastIdx]
        nextTitleIdx = a + 1 + lastIdx
        body = body.slice(0, lastIdx)
      }
    }
    const contentCount = body.filter((l) => l.trim() !== '').length
    const info = parseExperienceEntry(`${pendingTitle} ${lines[a]}`)
    const anchorText = `${pendingTitle} ${lines[a]}`
    const firstLine = pendingTitleIdx >= 0 ? pendingTitleIdx : a
    const lastLine = a + body.length
    pendingTitle = nextTitle
    pendingTitleIdx = nextTitleIdx
    const years = (lines[a].match(/\b(?:19|20)\d{2}\b/g) ?? []).map((y) => parseInt(y, 10))
    const isCurrent = /\b(sekarang|saat ini|present|hingga kini)\b/i.test(anchorText)
    blocks.push({
      complete: info.hasTitle && info.hasCompany && info.hasPeriod && contentCount >= 1,
      hasContent: contentCount >= 1,
      info,
      startYear: years.length > 0 ? years[0] : null,
      endYear: isCurrent ? null : years.length > 1 ? years[years.length - 1] : (years[0] ?? null),
      isCurrent,
      firstLine,
      lastLine,
    })
  }
  return blocks
}

// ---------- Rincian entri pengalaman untuk lapisan tampilan ----------

export interface ExperienceEntryDetail {
  // Baris-baris entri (judul/jangkar pertama sampai isi terakhir),
  // sudah di-trim dan tanpa baris kosong.
  lines: string[]
  text: string
  hasTitle: boolean
  hasCompany: boolean
  hasPeriod: boolean
  hasContent: boolean
  complete: boolean
  // Hasil terukur di dalam teks entri ini saja — dihitung dengan
  // penghitung yang sama persis dengan pemeriksaan hasil terukur.
  measurableCount: number
  // Periode entri dari baris jangkar yang sama yang dibaca pemeriksaan
  // linimasa & konsistensi: tahun mulai, tahun selesai (null bila
  // peran masih berjalan), dan penanda peran saat ini.
  startYear: number | null
  endYear: number | null
  isCurrent: boolean
}

// Entri pengalaman beserta kelengkapan komponen dan isinya, dari parser
// entri yang sama dengan pemeriksaan kedalaman entri. Dipakai lapisan
// tampilan (contoh personal di "Lihat contoh") agar kutipan selalu
// menunjuk entri yang sama dengan yang dinilai — bukan hasil parse kedua.
export function getExperienceEntryDetails(rawText: string): ExperienceEntryDetail[] {
  const section = getExperienceSection(rawText)
  if (!section) return []
  const sectionLines = section.split('\n')
  return parseExperienceBlocks(section).map((b) => {
    const lines = sectionLines
      .slice(b.firstLine, b.lastLine + 1)
      .map((l) => l.trim())
      .filter((l) => l !== '')
    const text = lines.join('\n')
    return {
      lines,
      text,
      hasTitle: b.info.hasTitle,
      hasCompany: b.info.hasCompany,
      hasPeriod: b.info.hasPeriod,
      hasContent: b.hasContent,
      complete: b.complete,
      measurableCount: countMeasurableResults(text),
      startYear: b.startYear,
      endYear: b.endYear,
      isCurrent: b.isCurrent,
    }
  })
}

// ---------- Penemu kemunculan bersama ----------

// Kemunculan sebuah teks di CV, sebagai rentang offset karakter di teks
// asli. Pemeriksaan memakai penemu kemunculan dari modul ini — yang
// berbagi kamus, regex, ambang, dan parser yang persis sama — agar
// bukti yang dihitung selalu konsisten antar-pemeriksaan.
export interface TextOccurrence {
  start: number
  end: number
}

// Ambang kata "saya" di bagian pengalaman mulai dianggap berlebihan —
// dipakai pemeriksaan kerapian bahasa dari sumber ini.
export const SAYA_OVERUSE_THRESHOLD = 4

// Semua kemunculan kata "saya" di bagian pengalaman, sebagai offset di
// teks asli. Dihitung dari string bagian yang persis sama dengan yang
// dihitung pemeriksaan kerapian bahasa (getExperienceSection), jadi
// jumlahnya selalu sama dengan angka pada pesan pemeriksaan itu.
export function findSayaOccurrences(rawText: string): TextOccurrence[] {
  const out: TextOccurrence[] = []
  for (const range of getExperienceSectionRanges(rawText)) {
    const rawSection = rawText.slice(range.start, range.end)
    const lead = rawSection.length - rawSection.trimStart().length
    const section = rawSection.trim()
    if (!section) continue
    const base = range.start + lead
    for (const m of section.matchAll(/\bsaya\b/gi)) {
      const idx = m.index ?? 0
      out.push({ start: base + idx, end: base + idx + m[0].length })
    }
  }
  return out
}

// ---------- Konsistensi format periode ----------

export type PeriodFamily = 'tahun' | 'bulan' | 'angka'

export interface PeriodExpr {
  family: PeriodFamily
  raw: string
  index: number
}

export const PERIOD_FAMILY_LABEL: Record<PeriodFamily, string> = {
  tahun: 'rentang tahun (mis. 2021–2024)',
  bulan: 'bulan–tahun (mis. Jan 2022)',
  angka: 'angka (mis. 01/2022)',
}

function extractPeriodExprs(text: string): PeriodExpr[] {
  const exprs: PeriodExpr[] = []
  const rangeRe =
    /\b(?:19|20)\d{2}\s*[-–—]\s*(?:(?:19|20)\d{2}|sekarang|present|saat ini)/gi
  const monthRe =
    /\b(?:jan(?:uari|uary)?|feb(?:ruari|ruary)?|mar(?:et|ch)?|apr(?:il)?|mei|may|jun(?:i|e)?|jul(?:i|y)?|agu(?:stus)?|aug(?:ust)?|sep(?:tember)?|okt(?:ober)?|oct(?:ober)?|nov(?:ember)?|des(?:ember)?|dec(?:ember)?)\s+(?:19|20)\d{2}/gi
  const numRe = /\b(?:0?[1-9]|1[0-2])\/(?:19|20)\d{2}/g
  for (const m of text.matchAll(rangeRe)) {
    exprs.push({ family: 'tahun', raw: m[0], index: m.index ?? 0 })
  }
  for (const m of text.matchAll(monthRe)) {
    exprs.push({ family: 'bulan', raw: m[0], index: m.index ?? 0 })
  }
  for (const m of text.matchAll(numRe)) {
    exprs.push({ family: 'angka', raw: m[0], index: m.index ?? 0 })
  }
  // Audit 2026-11-24: satu periode "Jan 2020 - Present" tertangkap DUA
  // kali — sebagai bulan ("Jan 2020") dan sebagai rentang tahun
  // ("2020 - Present") — sehingga CV yang formatnya konsisten pun
  // dituduh campur aduk. Ekspresi rentang tahun yang rentangnya tumpang
  // tindih dengan ekspresi bulan adalah ekspresi bulan yang sama (diawali
  // nama bulan), jadi yang rentang tahun dibuang.
  const monthSpans = exprs
    .filter((e) => e.family === 'bulan')
    .map((e) => ({ start: e.index, end: e.index + e.raw.length }))
  const deduped = exprs.filter((e) => {
    if (e.family !== 'tahun') return true
    const end = e.index + e.raw.length
    return !monthSpans.some((s) => e.index < s.end && s.start < end)
  })
  return deduped.sort((a, b) => a.index - b.index)
}

// Ekspresi periode yang terbaca di teks, dari penemu yang sama persis
// dengan pemeriksaan konsistensi format — dipakai lapisan tampilan
// (contoh personal) agar gaya yang dikutip selalu gaya yang dinilai.
export function getPeriodExprs(rawText: string): PeriodExpr[] {
  return extractPeriodExprs(rawText)
}

// ---------- Frasa lemah & klise ----------

// Frasa generik yang diklaim hampir semua pelamar tanpa bukti. Pencocokan
// memakai frasa inti, sehingga varian "mampu/dapat/bisa bekerja …"
// ikut tertangkap oleh frasa intinya.
export const WEAK_PHRASES: { core: string; display: string }[] = [
  { core: 'bertanggung jawab atas', display: 'bertanggung jawab atas' },
  { core: 'bertanggungjawab atas', display: 'bertanggungjawab atas' },
  { core: 'pekerja keras', display: 'pekerja keras' },
  { core: 'bekerja di bawah tekanan', display: '(mampu/dapat) bekerja di bawah tekanan' },
  {
    core: 'bekerja dalam tim maupun individu',
    display: 'dapat bekerja dalam tim maupun individu',
  },
  {
    core: 'bersedia ditempatkan di mana saja',
    display: 'bersedia ditempatkan di mana saja',
  },
  {
    core: 'bersedia ditempatkan dimana saja',
    display: 'bersedia ditempatkan dimana saja',
  },
]

export interface WeakPhraseOccurrence extends TextOccurrence {
  core: string
  display: string
}

// Semua kemunculan frasa lemah di teks, sebagai offset di teks asli.
// Pencariannya persis seperti pemeriksaan frasa lemah: substring frasa
// inti di teks huruf-kecil — jadi kemunculan yang ditemukan selalu
// frasa yang sama yang mengurangi poin pemeriksaan itu.
export function findWeakPhraseOccurrences(rawText: string): WeakPhraseOccurrence[] {
  const lower = rawText.toLowerCase()
  const out: WeakPhraseOccurrence[] = []
  for (const p of WEAK_PHRASES) {
    let idx = lower.indexOf(p.core)
    while (idx !== -1) {
      out.push({ start: idx, end: idx + p.core.length, core: p.core, display: p.display })
      idx = lower.indexOf(p.core, idx + p.core.length)
    }
  }
  return out
}

function findWeakPhrases(lowerText: string): string[] {
  const occurrences = findWeakPhraseOccurrences(lowerText)
  return WEAK_PHRASES.filter((p) => occurrences.some((o) => o.core === p.core)).map(
    (p) => p.display,
  )
}

// ---------- Kerapian bahasa: kata yang sering salah eja ----------

// Daftar kecil kata yang bentuk tidak bakunya sangat sering muncul di CV
// (rujukan: bentuk baku KBBI). Ini BUKAN pemeriksaan tata bahasa menyeluruh.
export const TYPO_WORDS: { wrong: string; right: string }[] = [
  { wrong: 'aktifitas', right: 'aktivitas' },
  { wrong: 'praktek', right: 'praktik' },
  { wrong: 'ijin', right: 'izin' },
  { wrong: 'resiko', right: 'risiko' },
  { wrong: 'standart', right: 'standar' },
  { wrong: 'nasehat', right: 'nasihat' },
  { wrong: 'silahkan', right: 'silakan' },
  { wrong: 'merubah', right: 'mengubah' },
  { wrong: 'jaman', right: 'zaman' },
  { wrong: 'apotik', right: 'apotek' },
  { wrong: 'fotocopy', right: 'fotokopi' },
  { wrong: 'telpon', right: 'telepon' },
  { wrong: 'kreatifitas', right: 'kreativitas' },
  { wrong: 'efektifitas', right: 'efektivitas' },
  { wrong: 'obyek', right: 'objek' },
  { wrong: 'subyek', right: 'subjek' },
]

export function findTypos(lowerText: string): { wrong: string; right: string }[] {
  return TYPO_WORDS.filter((t) => new RegExp(`\\b${t.wrong}\\b`).test(lowerText))
}

// ---------- Lokasi domisili (kelengkapan kontak) ----------

// Kota-kota yang umum menjadi domisili pencari kerja di Indonesia.
// Perekrut menyaring kandidat berdasarkan domisili, jadi kota yang
// tertera di area kontak adalah kelengkapan kontak yang nyata.
const CITY_NAMES = [
  'banda aceh', 'lhokseumawe', 'medan', 'binjai', 'padang sidempuan',
  'pekanbaru', 'dumai', 'batam', 'tanjungpinang', 'padang', 'bukittinggi',
  'payakumbuh', 'jambi', 'palembang', 'lubuklinggau', 'prabumulih',
  'bengkulu', 'bandar lampung', 'metro', 'pangkalpinang', 'serang',
  'cilegon', 'tangerang selatan', 'tangerang', 'jakarta', 'bogor', 'depok',
  'bekasi', 'karawang', 'cikarang', 'purwakarta', 'bandung', 'cimahi',
  'cirebon', 'sukabumi', 'tasikmalaya', 'garut', 'cianjur', 'indramayu',
  'semarang', 'salatiga', 'magelang', 'surakarta', 'solo', 'tegal',
  'pekalongan', 'purwokerto', 'cilacap', 'klaten', 'kudus', 'jepara',
  'yogyakarta', 'jogja', 'sleman', 'bantul', 'surabaya', 'sidoarjo',
  'gresik', 'malang', 'batu', 'kediri', 'blitar', 'mojokerto', 'pasuruan',
  'probolinggo', 'jember', 'banyuwangi', 'madiun', 'tulungagung',
  'tuban', 'lamongan', 'jombang', 'nganjuk', 'ponorogo', 'denpasar',
  'badung', 'gianyar', 'singaraja', 'mataram', 'bima', 'kupang',
  'pontianak', 'singkawang', 'palangkaraya', 'banjarmasin', 'banjarbaru',
  'balikpapan', 'samarinda', 'bontang', 'tarakan', 'manado', 'bitung',
  'tomohon', 'gorontalo', 'palu', 'makassar', 'parepare', 'palopo',
  'kendari', 'bau-bau', 'ambon', 'ternate', 'tidore', 'jayapura', 'sorong',
  'manokwari', 'merauke', 'timika',
]

const CITY_PATTERN = new RegExp(
  `\\b(${[...CITY_NAMES]
    .sort((a, b) => b.length - a.length)
    .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')})\\b`,
  'i',
)

// Lokasi dicari di (1) baris berlabel domisili/alamat, lalu (2) blok
// header — baris-baris sebelum heading bagian pertama (area kontak).
// Kota yang hanya muncul di riwayat sekolah/kantor lama tidak dihitung,
// karena yang dinilai adalah domisili yang tertera sebagai kontak.
export function findLocation(text: string): string | null {
  const lines = text.split('\n')
  for (const line of lines) {
    if (/(domisili|alamat|berdomisili)/i.test(line) && !line.includes('@')) {
      const m = line.match(CITY_PATTERN)
      if (m) return m[0]
      const rest = line
        .replace(/.*?(domisili|alamat|berdomisili)\s*[:\-]?\s*/i, '')
        .trim()
      if (/[A-Za-z]{3,}/.test(rest)) return rest.split(/[|,]/)[0].trim()
    }
  }
  for (const line of lines) {
    if (isHeadingLine(line, ALL_HEADING_WORDS)) break
    const m = line.match(CITY_PATTERN)
    if (m) return m[0]
  }
  return null
}

// ---------- Linimasa pengalaman ----------

interface TimelineAssessment {
  // Skor pada skala maks 3: komponen kesenjangan (0/2) + kebaruan (0/1).
  score3: number
  message: string
}

// Satu kesenjangan antar-entri yang terdeteksi dari tahun-tahun CV.
export interface TimelineGap {
  fromYear: number // tahun berakhirnya entri sebelum jeda
  toYear: number // tahun mulainya entri sesudah jeda
  years: number // panjang jeda (toYear - fromYear)
}

// Fakta linimasa dari periode entri yang terbaca — satu-satunya sumber
// angka jeda & kebaruan, dipakai pemeriksaan linimasa DAN contoh
// personalnya agar keduanya selalu menyebut tahun yang sama.
export interface TimelineFacts {
  datedCount: number
  gaps: TimelineGap[]
  hasCurrent: boolean
  latestEnd: number
  yearsSinceEnd: number
  stale: boolean
}

function computeTimelineFacts(
  blocks: ExperienceBlock[],
  currentYear: number,
): TimelineFacts | null {
  const dated = blocks.filter((b) => b.startYear !== null)
  if (dated.length === 0) return null
  const sorted = [...dated].sort((a, b) => (a.startYear ?? 0) - (b.startYear ?? 0))
  const gaps: TimelineGap[] = []
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    if (prev.isCurrent) continue
    const prevEnd = prev.endYear ?? prev.startYear ?? 0
    const years = (sorted[i].startYear ?? 0) - prevEnd
    if (years >= 3) {
      gaps.push({ fromYear: prevEnd, toYear: sorted[i].startYear ?? 0, years })
    }
  }
  const hasCurrent = dated.some((b) => b.isCurrent)
  const latestEnd = Math.max(
    ...dated.map((b) => (b.isCurrent ? currentYear : (b.endYear ?? b.startYear ?? 0))),
  )
  const yearsSinceEnd = currentYear - latestEnd
  return {
    datedCount: dated.length,
    gaps,
    hasCurrent,
    latestEnd,
    yearsSinceEnd,
    stale: !hasCurrent && yearsSinceEnd >= 4,
  }
}

// Fakta linimasa dari teks CV mentah, dari parser entri yang sama
// dengan pemeriksaan linimasa. Null bila tidak ada entri berperiode
// yang terbaca — lapisan tampilan lalu memakai contoh generik.
export function getTimelineFacts(rawText: string): TimelineFacts | null {
  const section = getExperienceSection(rawText)
  if (!section) return null
  return computeTimelineFacts(parseExperienceBlocks(section), new Date().getFullYear())
}

// Menilai linimasa dari periode entri yang TERBACA: (a) kesenjangan
// panjang antar-entri tanpa penjelasan, (b) kebaruan — peran terakhir
// sudah lama berakhir dan tidak ada peran saat ini. Bila tidak ada
// entri berperiode yang terbaca, pemeriksaan tidak mengarang nilai:
// skor 0 dengan pesan bahwa linimasa belum bisa dinilai.
function assessTimeline(blocks: ExperienceBlock[], currentYear: number): TimelineAssessment {
  const facts = computeTimelineFacts(blocks, currentYear)
  if (!facts) {
    return {
      score3: 0,
      message:
        'Periode tiap entri pengalaman tidak terbaca tahunnya, sehingga linimasa (kesenjangan antarpekerjaan dan kebaruan peran terakhir) belum bisa dinilai. Tulis periode yang jelas pada tiap entri, misalnya (2022–2024) atau (2022–Sekarang).',
    }
  }
  const gapIssues = facts.gaps.map(
    (g) =>
      `ada kesenjangan sekitar ${g.years} tahun (antara ±${g.fromYear} dan ±${g.toYear}) tanpa penjelasan di CV`,
  )
  const gapScore = gapIssues.length > 0 ? 0 : 2
  const recencyScore = facts.stale ? 0 : 1
  const parts: string[] = []
  if (gapIssues.length > 0) {
    parts.push(`Linimasa terbaca: ${gapIssues.join('; ')}.`)
    parts.push(
      'Kesenjangan bukan otomatis buruk (kuliah, keluarga, wirausaha, merawat orang tua), tetapi tanpa penjelasan rekruter akan bertanya-tanya — tambahkan satu baris aktivitas pengisi pada periode itu.',
    )
  }
  if (facts.stale) {
    parts.push(
      `Pengalaman terakhir yang terbaca berakhir sekitar ${facts.latestEnd} (${facts.yearsSinceEnd} tahun lalu) dan tidak ada peran saat ini yang tercantum. Bila kamu masih bekerja/berkegiatan, cantumkan peran terkinimu; bila memang ada jeda, jelaskan singkat aktivitasmu pada periode itu.`,
    )
  }
  if (parts.length === 0) {
    parts.push(
      `Linimasa pengalaman terbaca rapi dari ${facts.datedCount} entri berperiode: tidak ada kesenjangan panjang antar-entri${
        facts.hasCurrent
          ? ', dan ada peran yang masih berjalan saat ini.'
          : `, dan peran terakhir berakhir sekitar ${facts.latestEnd} (belum lama).`
      }`,
    )
  }
  return { score3: gapScore + recencyScore, message: parts.join(' ') }
}

// ---------- Proyek / magang / organisasi sebagai bukti pengalaman ----------

const PROJECT_HEADING_WORDS = [
  'proyek', 'project', 'magang', 'internship', 'pengalaman organisasi',
  'organisasi', 'kepanitiaan', 'praktik kerja', 'pkl', 'volunteer',
  'relawan', 'kegiatan',
]

// Ekstraktor khusus bagian proyek/magang. Berbeda dari getSection umum:
// baris yang tampak seperti entri (bullet, atau mengandung tahun
// 19xx/20xx) TIDAK PERNAH dianggap batas bagian — mengikuti guard
// BULLET_LINE di getExperienceSection, ditambah guard tahun. Tanpa ini,
// judul entri seperti "Dashboard Harga Bahan Pokok — Proyek Kuliah
// (2025)" mengandung kata heading "proyek" sehingga bagian terpotong
// menjadi kosong dan fresh graduate yang memakai judul umum "Proyek
// Kuliah / Proyek Akhir / Proyek Pribadi" kehilangan poin proyek
// (bug 2026-11-21), padahal CV yang sama berjudul "Tugas Akhir" lolos.
function getProjectSection(text: string): string {
  const lines = text.split('\n')
  const isEntryLine = (l: string) =>
    BULLET_LINE.test(l) || /\b(?:19|20)\d{2}\b/.test(l)
  const isBoundary = (l: string) =>
    !isEntryLine(l) && isHeadingLine(l, ALL_HEADING_WORDS)
  let start = -1
  for (let i = 0; i < lines.length; i++) {
    if (!isEntryLine(lines[i]) && isHeadingLine(lines[i], PROJECT_HEADING_WORDS)) {
      start = i
      break
    }
  }
  if (start === -1) return ''
  const collected: string[] = []
  for (let i = start + 1; i < lines.length; i++) {
    if (isBoundary(lines[i])) break
    collected.push(lines[i])
  }
  return collected.join('\n').trim()
}

interface ProjectAssessment {
  score: number // skala maks 2
  message: string
}

// Keadilan untuk fresh graduate (pasar utama situs ini): proyek, magang,
// PKL, dan pengalaman organisasi yang DIURAIKAN isinya adalah bukti
// pengalaman yang sah. Bila pengalaman kerja formal sudah ada, bagian
// proyek hanya penguat — ketiadaannya netral, tidak menghukum.
function assessProjects(text: string, formalEntryCount: number): ProjectAssessment {
  const section = getProjectSection(text)
  const lines = section ? section.split('\n').filter((l) => l.trim() !== '') : []
  const words = section ? countWords(section) : 0
  const substantive = lines.length >= 2 || words >= 15
  if (section && substantive) {
    return {
      score: 2,
      message: `Bagian proyek/magang/organisasi ditemukan dengan uraian isi (${lines.length} baris). Bagi perekrut, proyek dan magang yang diuraikan tugas serta hasilnya adalah bukti pengalaman yang sah — terutama bagi fresh graduate yang belum punya pekerjaan formal.`,
    }
  }
  if (section) {
    return {
      score: 1,
      message:
        'Bagian proyek/magang/organisasi ditemukan, tetapi isinya sangat singkat (baru judul). Uraikan tugas, tools, dan hasilmu di dalamnya agar terbaca sebagai pengalaman betulan, bukan sekadar daftar nama kegiatan.',
    }
  }
  if (formalEntryCount >= 1) {
    return {
      score: 2,
      message:
        'Tidak ada bagian proyek/magang/organisasi terpisah, tetapi pengalaman kerja formalmu sudah tercantum sebagai bukti pengalaman utama — pemeriksaan ini netral untukmu; proyek hanya menjadi penguat tambahan bila ada.',
    }
  }
  return {
    score: 0,
    message:
      'Tidak ditemukan pengalaman kerja formal maupun bagian proyek/magang/organisasi. Bagi fresh graduate, proyek kuliah/sekolah, magang, PKL, kepanitiaan, atau kegiatan organisasi yang diuraikan isinya adalah bukti pengalaman utama — tambahkan bagian "Proyek" atau "Magang" berisi tugas dan hasilmu.',
  }
}

// ---------- Penskalaan aspek untuk mode lowongan ----------

// Dalam mode lowongan, aspek dasar diskalakan proporsional (faktor 0,8)
// agar aspek "Kecocokan dengan Lowongan" (maks 20) muat dan total tetap
// 100. Skor tiap pemeriksaan diskalakan dengan rasio yang sama; selisih
// pembulatan maks diserap pemeriksaan terbesar di aspeknya.
function scaleAspect(aspect: AspectResult, factor: number): AspectResult {
  const targetMax = Math.round(aspect.max * factor)
  const maxes = aspect.checks.map((c) => Math.max(1, Math.round(c.max * factor)))
  let diff = targetMax - maxes.reduce((s, x) => s + x, 0)
  if (aspect.checks.length > 0) {
    let idx = maxes.indexOf(Math.max(...maxes))
    while (diff > 0) {
      maxes[idx] += 1
      diff -= 1
    }
    while (diff < 0 && maxes[idx] > 1) {
      maxes[idx] -= 1
      diff += 1
    }
  }
  const checks = aspect.checks.map((c, i) => {
    const nm = maxes[i]
    const ns = c.max === 0 ? 0 : Math.min(nm, Math.round((c.score * nm) / c.max))
    return { ...c, score: ns, max: nm, status: statusOf(ns, nm) }
  })
  return {
    name: aspect.name,
    max: targetMax,
    score: checks.reduce((s, c) => s + c.score, 0),
    checks,
  }
}

// ---------- Kata kunci lowongan ----------

const STOPWORDS = new Set([
  // Bahasa Indonesia
  'yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'dengan', 'adalah', 'ini', 'itu',
  'atau', 'serta', 'dalam', 'pada', 'sebagai', 'juga', 'akan', 'tidak', 'bisa',
  'dapat', 'harus', 'memiliki', 'selama', 'antara', 'tentang', 'oleh', 'kami',
  'kita', 'anda', 'saya', 'mereka', 'setelah', 'sebelum', 'lebih', 'sangat',
  'baik', 'baru', 'lain', 'bekerja', 'kerja', 'minimal', 'maksimal', 'tahun',
  'bulan', 'hari', 'orang', 'tim', 'perusahaan', 'bidang', 'posisi', 'sudah',
  'agar', 'saat', 'secara', 'menjadi', 'melakukan', 'memastikan', 'membantu',
  // English
  'the', 'and', 'for', 'with', 'our', 'you', 'are', 'will', 'have', 'has',
  'from', 'this', 'that', 'who', 'can', 'all', 'any', 'per', 'including',
  'work', 'working', 'experience', 'years', 'year', 'job', 'role', 'team',
  'able', 'strong', 'skills', 'skill', 'knowledge', 'using', 'use', 'etc',
])

function extractJobKeywords(jobDesc: string, cvLower: string): KeywordResult {
  const words = jobDesc.toLowerCase().match(/[a-z0-9][a-z0-9+#.-]*/g) ?? []
  const freq = new Map<string, number>()
  for (const w of words) {
    const clean = w.replace(/^[.-]+|[.-]+$/g, '')
    if (clean.length <= 2 || STOPWORDS.has(clean)) continue
    freq.set(clean, (freq.get(clean) ?? 0) + 1)
  }
  const selected = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 18)
    .map(([w]) => w)
  const found: string[] = []
  const missing: string[] = []
  for (const kw of selected) {
    const pattern = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (pattern.test(cvLower)) found.push(kw)
    else missing.push(kw)
  }
  return {
    percent: selected.length ? Math.round((found.length / selected.length) * 100) : 0,
    found,
    missing,
    total: selected.length,
  }
}

// Kata jabatan generik yang tidak membantu menilai relevansi ringkasan.
const ROLE_GENERIC_WORDS = new Set([
  'staff', 'staf', 'junior', 'senior', 'kepala', 'head', 'lead', 'chief',
  'manager', 'manajer', 'officer', 'executive', 'eksekutif', 'specialist',
  'spesialis', 'supervisor', 'koordinator', 'asisten', 'assistant',
  'intern', 'magang', 'freelance', 'konsultan', 'consultant',
])

// Kata-kata bermakna dari posisi target (tanpa kata jabatan generik) —
// ekstraksi yang sama yang dipakai pemeriksaan relevansi ringkasan &
// pengalaman; dipakai juga lapisan tampilan dari sumber yang sama.
// Singkatan pekerjaan diperluas dulu lewat glosarium (jobGlossary.ts):
// "QC" menghasilkan kata "quality"/"control" yang bisa dicocokkan ke
// isi CV, bukan potongan "qc" yang tidak pernah muncul di teks CV.
// Hasilnya dideduplikasi agar kata hasil perluasan yang berulang
// tidak digandakan.
export function getRoleWords(role: string): string[] {
  const words = expandJobTitle(role)
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 3 && !ROLE_GENERIC_WORDS.has(w))
  return [...new Set(words)]
}

// ---------- Prioritas perbaikan (sumber bersama) ----------

// Memilih & mengurutkan prioritas perbaikan dari semua pemeriksaan:
// yang belum berstatus "baik", terurut dari kehilangan poin terbesar
// (seri dipecahkan oleh bobot aspek yang lebih besar). INI satu-satunya
// tempat kriteria prioritas didefinisikan: daftar "Prioritas Perbaikan"
// di UI dirender dari AnalysisResult.priorities hasil fungsi ini, dan
// peringkat per pemeriksaan diturunkan dari daftar yang sama lewat
// priorityRanks di bawah — jangan duplikasi kriterianya di tempat lain.
export function selectPriorities(checks: CheckItem[], aspects: AspectResult[]): CheckItem[] {
  const aspectMaxByName = new Map(aspects.map((a) => [a.name, a.max]))
  return checks
    .filter((c) => c.status !== 'baik')
    .sort(
      (a, b) =>
        b.max - b.score - (a.max - a.score) ||
        (aspectMaxByName.get(b.aspect) ?? 0) - (aspectMaxByName.get(a.aspect) ?? 0),
    )
}

// Peringkat prioritas per id pemeriksaan (1 = prioritas tertinggi),
// diturunkan dari daftar prioritas yang sudah terurut, agar nomor
// prioritas selalu sama dengan urutan daftar "Prioritas Perbaikan".
export function priorityRanks(priorities: CheckItem[]): Map<string, number> {
  const ranks = new Map<string, number>()
  priorities.forEach((c, i) => {
    if (!ranks.has(c.id)) ranks.set(c.id, i + 1)
  })
  return ranks
}

// ---------- Fungsi analisis utama ----------

export function analyzeCv(rawText: string, options: AnalyzeOptions = {}): AnalysisResult {
  const text = rawText ?? ''
  const lower = text.toLowerCase()
  const totalWords = countWords(text)

  const summarySection = getSummarySection(text)
  const experienceSection = getExperienceSection(text)
  const role = options.targetRole?.trim() ?? ''

  // ===== KONTAK (maks 20) =====
  // Kandidat email pertama yang BENAR-BENAR valid strukturnya: regex saja
  // menerima domain rusak seperti "gmail..com" (audit 2026-11-24), jadi
  // tiap kandidat diperiksa label domain dan titik gandanya.
  const emailCandidates =
    lower.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g) ?? []
  const emailFound = emailCandidates.find((cand) => {
    const at = cand.indexOf('@')
    const local = cand.slice(0, at)
    const domain = cand.slice(at + 1)
    if (!local || !domain) return false
    if (local.includes('..') || domain.includes('..')) return false
    if (local.startsWith('.') || local.endsWith('.')) return false
    return domain
      .split('.')
      .every((label) => label.length > 0 && !label.startsWith('-') && !label.endsWith('-'))
  })
  const emailMatch = emailFound ?? null
  const emailScore = emailMatch ? 7 : 0

  const phone = findPhone(text)
  const phoneScore = phone ? 6 : 0

  const linkedinScore = lower.includes('linkedin.com') ? 4 : 0

  const portfolioUrl = findPortfolio(text)
  const portfolioScore = portfolioUrl ? 2 : 0

  // Lokasi domisili: perekrut menyaring kandidat berdasarkan domisili,
  // jadi kota yang tertera di area kontak dinilai sebagai kelengkapan
  // kontak (1 poin diambil dari link portofolio; total Kontak tetap 20).
  const location = findLocation(text)
  const locationScore = location ? 1 : 0

  const kontakChecks = [
    makeCheck(
      'email', 'Kontak', 'Email valid', emailScore, 7,
      emailMatch
        ? `Email terbaca: ${emailMatch}`
        : 'Alamat email tidak ditemukan atau formatnya tidak valid. Cantumkan email profesional yang aktif.',
    ),
    makeCheck(
      'hp', 'Kontak', 'Nomor HP Indonesia', phoneScore, 6,
      phone
        ? `Nomor HP terbaca: ${phone}`
        : 'Nomor HP Indonesia tidak ditemukan. Cantumkan nomor aktif, misalnya 08xx atau +62 8xx.',
    ),
    makeCheck(
      'linkedin', 'Kontak', 'LinkedIn', linkedinScore, 4,
      linkedinScore
        ? 'Tautan LinkedIn tercantum.'
        : 'Tautan LinkedIn tidak ditemukan. Cantumkan URL profil LinkedIn agar rekruter mudah memverifikasi profilmu.',
    ),
    makeCheck(
      'portofolio', 'Kontak', 'Link portofolio', portfolioScore, 2,
      portfolioUrl
        ? `Portofolio terbaca: ${portfolioUrl}`
        : 'Link portofolio tidak ditemukan. Cantumkan alamat GitHub, Behance, Kaggle, atau website portofolio pribadi (kata "portofolio" saja tanpa alamat tidak dihitung).',
    ),
    makeCheck(
      'lokasi', 'Kontak', 'Lokasi domisili', locationScore, 1,
      location
        ? `Domisili terbaca: ${location}. Perekrut memang menyaring kandidat berdasarkan domisili, jadi keterangan ini membantu.`
        : 'Kota domisili tidak ditemukan di area kontak. Cantumkan kota tempat tinggalmu saat ini (mis. "Jakarta" atau "Domisili: Bandung") — banyak rekruter menyaring kandidat berdasarkan domisili sebelum membaca isi CV.',
    ),
  ]

  // ===== RINGKASAN (maks 10) =====
  // Bila posisi target diisi DAN punya kata bermakna, aspek ini dipecah:
  // ringkasan (maks 7) + relevansi ringkasan terhadap posisi target (maks 3).
  const summaryWords = summarySection ? countWords(summarySection) : 0
  const roleWords = getRoleWords(role)
  const hasRole = roleWords.length > 0

  const summaryScoreFull =
    summaryWords >= 40 ? 10 : summaryWords >= 20 ? 7 : summaryWords >= 8 ? 4 : summaryWords >= 1 ? 2 : 0
  const summaryScoreSplit =
    summaryWords >= 40 ? 7 : summaryWords >= 20 ? 5 : summaryWords >= 8 ? 3 : summaryWords >= 1 ? 1 : 0
  const summaryMessage =
    summaryWords === 0
      ? 'Bagian ringkasan/profil tidak ditemukan. Tambahkan ringkasan 40 kata atau lebih yang menjelaskan keahlian dan pencapaian utamamu.'
      : `Ringkasan berisi ${summaryWords} kata. ${summaryWords >= 40 ? 'Panjangnya sudah ideal.' : 'Idealnya 40 kata atau lebih agar cukup menjelaskan nilai jualmu.'}`

  const ringkasanChecks: CheckItem[] = [
    makeCheck(
      'ringkasan', 'Ringkasan', 'Ringkasan profesional',
      hasRole ? summaryScoreSplit : summaryScoreFull, hasRole ? 7 : 10,
      summaryMessage,
    ),
  ]

  if (hasRole) {
    const summaryLower = summarySection.toLowerCase()
    const headWord = roleWords[0]
    const relevanceScore = !summarySection
      ? 0
      : summaryLower.includes(headWord)
        ? 3
        : roleWords.some((w) => summaryLower.includes(w))
          ? 2
          : 0
    ringkasanChecks.push(
      makeCheck(
        'relevansi-ringkasan', 'Ringkasan', 'Relevansi ringkasan dengan posisi target',
        relevanceScore, 3,
        !summarySection
          ? `Posisi target "${role}" belum bisa dinilai dari ringkasan karena bagian ringkasan belum ada. Tulis ringkasan yang menyebut bidang/posisi yang kamu tuju.`
          : relevanceScore === 3
            ? `Ringkasan menyebut bidang/posisi yang dituju ("${headWord}") sesuai posisi target "${role}".`
            : relevanceScore === 2
              ? `Ringkasan menyebut sebagian kata dari posisi target "${role}", tetapi kata utamanya ("${headWord}") belum muncul. Sebutkan posisi/bidang yang dituju secara eksplisit di ringkasan.`
              : `Ringkasan sama sekali tidak menyebut posisi/bidang "${role}" yang kamu tuju. Sesuaikan kalimat pertama ringkasan dengan posisi target agar rekruter langsung melihat relevansinya.`,
      ),
    )
  }

  // ===== PENGALAMAN (maks 28) =====
  // Bobot di dalam aspek ini dibagi ulang (2026-11-21) untuk memberi
  // ruang bagi dimensi baru — linimasa, proyek/magang, dan (bila posisi
  // target diisi) relevansi pengalaman. Ambang/syarat pemeriksaan lama
  // TIDAK berubah; hanya nilai poinnya diskalakan ke maks barunya.
  // Tanpa peran: heading 5, kata kerja 5, hasil terukur 6, kedalaman 4,
  // frasa 3, linimasa 3, proyek 2 = 28.
  // Dengan peran: kata kerja 4, hasil terukur 5, linimasa 2, dan
  // relevansi pengalaman 3 menggantikan selisihnya = tetap 28.
  const verbMax = hasRole ? 4 : 5
  const measurableMax = hasRole ? 5 : 6
  const linimasaMax = hasRole ? 2 : 3

  const hasExperienceHeading =
    /(pengalaman|experience|pekerjaan|work history|riwayat kerja)/i.test(lower)
  const experienceHeadingScore = hasExperienceHeading ? 5 : 0

  const verbCount = countActionVerbs(lower)
  const verbScore =
    verbCount >= 5
      ? verbMax
      : verbCount >= 3
        ? Math.round((verbMax * 2) / 3)
        : verbCount >= 1
          ? Math.round(verbMax / 3)
          : 0

  const measurableCount = countMeasurableResults(text)
  const measurableScore =
    measurableCount >= 3
      ? measurableMax
      : measurableCount === 2
        ? Math.round((measurableMax * 2) / 3)
        : measurableCount === 1
          ? Math.round(measurableMax / 3)
          : 0

  // Kedalaman entri: tiap entri dinilai kelengkapannya
  // (jabatan + perusahaan + periode + uraian isi).
  const expBlocks = parseExperienceBlocks(experienceSection)
  const completeEntries = expBlocks.filter((b) => b.complete).length
  const shallowEntries = expBlocks.filter((b) => !b.hasContent).length
  let depthScore = 0
  if (expBlocks.length > 0) {
    const ratio = completeEntries / expBlocks.length
    depthScore = ratio >= 1 ? 4 : ratio >= 0.5 ? 2 : completeEntries >= 1 ? 1 : 0
  }
  const depthMessage = !experienceSection
    ? 'Bagian pengalaman tidak ditemukan, jadi kedalaman entri belum bisa dinilai. Buat bagian "Pengalaman" dengan satu entri per pekerjaan.'
    : expBlocks.length === 0
      ? 'Tidak ditemukan entri pengalaman yang terbaca strukturnya (baris jabatan/perusahaan yang memuat periode). Tulis tiap pekerjaan sebagai baris judul, misalnya "Kasir — Toko Berkah (2022–2024)", lalu uraikan isinya di bawahnya.'
      : `Ditemukan ${expBlocks.length} entri pengalaman. ${completeEntries} entri lengkap (jabatan + perusahaan + periode + uraian isi)${shallowEntries > 0 ? `; ${shallowEntries} entri hanya berisi judul/periode tanpa uraian isi` : ''}. ${depthScore >= 5 ? 'Kedalaman entrinya sudah baik.' : 'Setiap entri idealnya memuat jabatan, nama perusahaan, periode, dan uraian pencapaian — entri yang hanya berisi judul terlihat kosong bagi rekruter.'}`

  // Frasa lemah & klise: hanya dinilai bila ada isi ringkasan/pengalaman;
  // CV tanpa kedua bagian itu tidak mendapat poin dari ketiadaan frasa.
  const weakPhrases = findWeakPhrases(lower)
  const hasNarrative = summarySection.trim() !== '' || experienceSection.trim() !== ''
  const weakPhraseScore = !hasNarrative
    ? 0
    : weakPhrases.length === 0
      ? 3
      : weakPhrases.length === 1
        ? 2
        : weakPhrases.length === 2
          ? 1
          : 0
  const weakPhraseMessage = !hasNarrative
    ? 'Belum ada bagian ringkasan/pengalaman yang bisa dinilai frasanya. Tulis kedua bagian itu dengan kalimat konkret berbasis bukti.'
    : weakPhrases.length === 0
      ? 'Tidak ditemukan frasa klise yang umum (mis. "pekerja keras", "bertanggung jawab atas") di dalam CV.'
      : `Ditemukan ${weakPhrases.length} frasa generik tanpa bukti: ${weakPhrases.map((p) => `"${p}"`).join(', ')}. Frasa seperti ini diklaim hampir semua pelamar sehingga tidak membedakanmu — ganti dengan bukti konkret (angka, hasil, contoh pekerjaan).`

  // Linimasa pengalaman: kesenjangan panjang antar-entri dan kebaruan
  // peran terakhir, dinilai dari periode yang terbaca per entri.
  const timeline = assessTimeline(expBlocks, new Date().getFullYear())
  const linimasaScore =
    linimasaMax === 3 ? timeline.score3 : Math.round((timeline.score3 * linimasaMax) / 3)

  // Proyek/magang/organisasi sebagai bukti pengalaman (fresh graduate).
  const projectAssessment = assessProjects(text, expBlocks.length)

  const pengalamanChecks = [
    makeCheck(
      'pengalaman-heading', 'Pengalaman', 'Bagian pengalaman kerja', experienceHeadingScore, 5,
      hasExperienceHeading
        ? 'Bagian pengalaman kerja ditemukan.'
        : 'Bagian pengalaman kerja tidak ditemukan. Buat bagian "Pengalaman" yang berisi riwayat pekerjaanmu.',
    ),
    makeCheck(
      'kata-kerja-aksi', 'Pengalaman', 'Kata kerja aksi', verbScore, verbMax,
      `Ditemukan ${verbCount} kata kerja aksi berbeda (mis. meningkatkan, mengelola, membangun). ${verbCount >= 5 ? 'Sudah bervariasi.' : 'Gunakan minimal 5 kata kerja aksi berbeda untuk menunjukkan peran aktifmu.'}`,
    ),
    makeCheck(
      'hasil-terukur', 'Pengalaman', 'Hasil terukur (angka pencapaian)', measurableScore, measurableMax,
      `Ditemukan ${measurableCount} angka pencapaian (persen, jumlah, atau nominal — tahun dan nomor HP tidak dihitung). ${measurableCount >= 3 ? 'Sudah meyakinkan.' : 'Tambahkan hasil terukur, misalnya "meningkatkan penjualan 30%" atau "mengelola 15 orang".'}`,
    ),
    makeCheck(
      'kedalaman-entri', 'Pengalaman', 'Kedalaman entri pengalaman', depthScore, 4,
      depthMessage,
    ),
    makeCheck(
      'frasa-lemah', 'Pengalaman', 'Frasa lemah & klise', weakPhraseScore, 3,
      weakPhraseMessage,
    ),
    makeCheck(
      'linimasa', 'Pengalaman', 'Linimasa pengalaman', linimasaScore, linimasaMax,
      timeline.message,
    ),
    makeCheck(
      'proyek', 'Pengalaman', 'Proyek / magang sebagai bukti pengalaman', projectAssessment.score, 2,
      projectAssessment.message,
    ),
  ]

  // Relevansi pengalaman terhadap posisi target (kondisional): jabatan
  // dan isi pengalaman dinilai keterkaitannya dengan bidang posisi yang
  // dituju — bukan hanya ringkasannya.
  if (hasRole) {
    const expLower = experienceSection.toLowerCase()
    const titleText = experienceSection
      .split('\n')
      .filter((l) => !BULLET_LINE.test(l))
      .join(' ')
      .toLowerCase()
    const titleHits = roleWords.filter((w) => titleText.includes(w))
    const sectionHits = roleWords.filter((w) => expLower.includes(w))
    const missingWords = roleWords.filter((w) => !expLower.includes(w))
    const relevanceExpScore = !experienceSection
      ? 0
      : titleHits.length > 0
        ? 3
        : sectionHits.length === roleWords.length && roleWords.length > 0
          ? 2
          : sectionHits.length > 0
            ? 1
            : 0
    pengalamanChecks.push(
      makeCheck(
        'relevansi-pengalaman', 'Pengalaman', 'Relevansi pengalaman dengan posisi target',
        relevanceExpScore, 3,
        !experienceSection
          ? `Posisi target "${role}" belum bisa dinilai relevansinya karena bagian pengalaman belum ada. Pengalaman (termasuk magang dan proyek) yang berkaitan dengan bidang posisi yang dituju adalah bukti terkuat bagi rekruter.`
          : relevanceExpScore === 3
            ? `Jabatan di pengalamanmu menyebut kata kunci posisi target "${role}" (${titleHits.map((w) => `"${w}"`).join(', ')}) — relevansinya langsung terlihat oleh rekruter.`
            : relevanceExpScore === 2
              ? `Isi pengalamanmu menyebut semua kata kunci posisi target "${role}" (${sectionHits.map((w) => `"${w}"`).join(', ')}), tetapi belum muncul di judul jabatan. Bila memang sesuai, sebutkan bidang itu di judul entri pengalamanmu.`
              : relevanceExpScore === 1
                ? `Pengalamanmu baru menyebut sebagian kata kunci posisi target "${role}" (${sectionHits.map((w) => `"${w}"`).join(', ')}); yang belum terbaca: ${missingWords.map((w) => `"${w}"`).join(', ')}. Tonjolkan tugas dan hasil yang paling berkaitan dengan bidang yang dituju.`
                : `Pengalamanmu tidak menyebut satu pun kata kunci posisi target "${role}" (${roleWords.map((w) => `"${w}"`).join(', ')}). Bila ada tugas/proyek yang berkaitan, tonjolkan; bila memang berpindah bidang, jelaskan jembatannya di ringkasan (kursus, proyek pribadi, magang).`,
      ),
    )
  }

  // ===== PENDIDIKAN (maks 12) =====
  const hasEducation =
    /(pendidikan|education|universitas|sekolah|sma|smk|diploma|sarjana|s1|s2|d3|d4)\b/i.test(lower)
  const educationScore = hasEducation ? 6 : 0

  const educationSection = getSection(text, ['pendidikan', 'education'])
  const hasGpa =
    /(ipk|gpa)\s*[:\-]?\s*[0-4]([.,]\d{1,2})?/i.test(text) ||
    /\b3[.,]\d{2}\b/.test(educationSection)
  const gpaScore = hasGpa ? 3 : 0

  // Sertifikasi & pelatihan sebagai bagian tersendiri.
  const certSection = getSection(text, [
    'sertifikasi', 'pelatihan', 'kursus', 'sertifikat', 'certification', 'training', 'diklat',
  ])
  const certItems = certSection
    ? certSection
        .split(/[\n,;•·|]+/)
        .map((s) => s.replace(/^\s*[-*]\s*/, '').trim())
        .filter((s) => s.length >= 2)
    : []
  const certMentioned =
    /(sertifikat|sertifikasi|certified|certificate|bnsp|lisensi)\b/i.test(text)
  const certScore = certItems.length >= 1 ? 3 : certMentioned ? 1 : 0

  const pendidikanChecks = [
    makeCheck(
      'pendidikan', 'Pendidikan', 'Pendidikan tercantum', educationScore, 6,
      hasEducation
        ? 'Informasi pendidikan ditemukan.'
        : 'Informasi pendidikan tidak ditemukan. Cantumkan jenjang pendidikan terakhir dan nama institusinya.',
    ),
    makeCheck(
      'ipk', 'Pendidikan', 'IPK / GPA', gpaScore, 3,
      hasGpa
        ? 'IPK/GPA tercantum.'
        : 'IPK/GPA tidak tercantum. Jika IPK-mu baik (mis. di atas 3,00), cantumkan untuk memperkuat profil.',
    ),
    makeCheck(
      'sertifikasi', 'Pendidikan', 'Sertifikasi & pelatihan', certScore, 3,
      certItems.length >= 1
        ? `Bagian sertifikasi/pelatihan ditemukan dengan ${certItems.length} item. Sertifikasi yang relevan memperkuat kredibilitas di luar pendidikan formal.`
        : certMentioned
          ? 'Ada sebutan sertifikat/sertifikasi di dalam CV, tetapi belum menjadi bagian tersendiri. Buat bagian "Sertifikasi & Pelatihan" agar mudah ditemukan rekruter dan ATS.'
          : 'Bagian sertifikasi/pelatihan tidak ditemukan. Bila kamu punya sertifikat kursus, pelatihan, atau lisensi yang relevan, cantumkan dalam bagian tersendiri — ini nilai tambah di luar pendidikan formal.',
    ),
  ]

  // ===== KEAHLIAN (maks 10) =====
  const skillItems = getSkillItems(text)
  const skillCount = skillItems.length
  const skillScore =
    skillCount >= 8 ? 8 : skillCount >= 5 ? 5 : skillCount >= 3 ? 3 : skillCount >= 1 ? 1 : 0

  // Bahasa asing sebagai bagian pendukung tersendiri.
  const langItems = getLanguageItems(text)
  const langMentioned = LANGUAGE_MENTION.test(text)
  const langScore = langItems.length >= 1 ? 2 : langMentioned ? 1 : 0

  const keahlianChecks = [
    makeCheck(
      'keahlian', 'Keahlian', 'Daftar keahlian / skill', skillScore, 8,
      skillCount === 0
        ? 'Bagian keahlian tidak ditemukan. Buat bagian "Keahlian" dan daftarkan minimal 8 skill yang relevan, pisahkan dengan koma.'
        : `Ditemukan ${skillCount} item keahlian. ${skillCount >= 8 ? 'Jumlahnya sudah cukup.' : 'Idealnya cantumkan minimal 8 skill yang relevan dengan posisi yang dilamar.'}`,
    ),
    makeCheck(
      'bahasa', 'Keahlian', 'Bahasa asing', langScore, 2,
      langItems.length >= 1
        ? `Bagian bahasa ditemukan (${langItems.slice(0, 3).join(', ')}${langItems.length > 3 ? ', …' : ''}). Kemampuan bahasa asing adalah nilai tambah yang sering dicari perusahaan.`
        : langMentioned
          ? 'Kemampuan bahasa asing disebut di dalam CV, tetapi belum menjadi bagian/keterangan tersendiri. Tulis di bagian "Bahasa" beserta tingkat kemahirannya (mis. Bahasa Inggris — aktif, TOEFL 550).'
          : 'Kemampuan bahasa asing tidak tercantum. Bila kamu menguasai bahasa asing (mis. Bahasa Inggris), cantumkan beserta tingkat kemahirannya — banyak lowongan menjadikannya nilai tambah atau syarat.',
    ),
  ]

  // ===== FORMAT & ATS (maks 20) =====
  // Teks kosong (0 kata) tidak mendapat poin panjang sama sekali — cabang
  // akhir skala (1 poin) hanya untuk CV berisi yang panjangnya di luar
  // rentang berskor (audit 2026-11-24: CV kosong sebelumnya tetap
  // menerima 1 poin panjang + 2 poin kerapian = total 3).
  const lengthScore =
    totalWords === 0
      ? 0
      : totalWords >= 220 && totalWords <= 900
        ? 8
        : (totalWords >= 130 && totalWords <= 219) || (totalWords >= 901 && totalWords <= 1100)
          ? 5
          : totalWords >= 60 && totalWords <= 129
            ? 2
            : 1
  const hasYears = /\b(19|20)\d{2}\b/.test(text)
  const yearsScore = hasYears ? 4 : 0
  const bulletCount = text
    .split('\n')
    .filter((line) => /^\s*([\-•*]|\d+[.)])\s+/.test(line)).length
  const bulletScore = bulletCount >= 6 ? 3 : bulletCount >= 3 ? 2 : bulletCount >= 1 ? 1 : 0

  // Konsistensi format: gaya penulisan periode seragam di seluruh CV +
  // urutan entri pengalaman dari yang terbaru (kronologis terbalik).
  const periodExprs = extractPeriodExprs(text)
  const families = new Set(periodExprs.map((e) => e.family))
  const entryYears = expBlocks
    .map((b) => b.startYear)
    .filter((y): y is number => y !== null)
  const isReverseChrono = entryYears.every((y, i) => i === 0 || y <= entryYears[i - 1])
  let consistencyScore = 0
  let consistencyMessage = ''
  if (periodExprs.length === 0) {
    consistencyScore = 0
    consistencyMessage =
      'Belum ada periode yang terbaca formatnya (rentang tahun, bulan–tahun, atau angka), jadi konsistensi format belum bisa dinilai. Tulis periode tiap entri dengan satu format yang sama.'
  } else if (periodExprs.length === 1) {
    consistencyScore = 2
    consistencyMessage = `Baru satu periode terbaca ("${periodExprs[0].raw}"), jadi konsistensi format dan urutan kronologis belum bisa dinilai penuh. Pastikan semua entri memakai format periode yang sama dan diurutkan dari yang terbaru.`
  } else {
    const familyScore = families.size === 1 ? 2 : 0
    const chronoScore = entryYears.length < 2 || isReverseChrono ? 1 : 0
    consistencyScore = familyScore + chronoScore
    const parts: string[] = []
    if (families.size === 1) {
      parts.push(
        `Format periode konsisten memakai gaya ${PERIOD_FAMILY_LABEL[periodExprs[0].family]} di seluruh CV.`,
      )
    } else {
      const examples = [...families]
        .map((f) => {
          const ex = periodExprs.find((e) => e.family === f)
          return `${PERIOD_FAMILY_LABEL[f]} ("${ex?.raw}")`
        })
        .join(' dan ')
      parts.push(
        `Format penulisan periode campur aduk: ditemukan gaya ${examples}. Pilih SATU format untuk semua entri agar CV terlihat rapi dan profesional.`,
      )
    }
    if (entryYears.length >= 2) {
      parts.push(
        isReverseChrono
          ? 'Urutan entri pengalaman sudah dari yang terbaru.'
          : `Urutan entri pengalaman belum dari yang terbaru (tahun mulai yang terbaca: ${entryYears.join(', ')}). Rekruter membaca dari pengalaman terakhir — urutkan entri dari tahun mulai paling baru.`,
      )
    }
    consistencyMessage = parts.join(' ')
  }

  // Kerapian bahasa: kata ganti "saya" berlebihan di bagian pengalaman +
  // kata yang sering salah eja. Ini pemeriksaan dasar dari daftar kecil,
  // bukan pemeriksaan tata bahasa menyeluruh.
  const typos = findTypos(lower)
  // Jumlah kata "saya" diambil dari penemu kemunculan bersama di atas.
  const sayaCount = findSayaOccurrences(text).length
  const sayaOverused = sayaCount >= SAYA_OVERUSE_THRESHOLD
  // Teks yang benar-benar kosong (0 kata) tidak bisa dinilai kerapiannya —
  // jangan beri nilai penuh yang lalu tampil sebagai "kekuatan" (audit
  // 2026-11-24: CV kosong sebelumnya menerima total 3 dari panjang +
  // kerapian). Penjaga sengaja dipersempit ke kasus kosong persis: CV
  // naratif tanpa heading (seperti CV lemah patokan) tetap dinilai seperti
  // sebelumnya agar patokan terkunci tidak bergeser.
  const neatnessScore =
    totalWords === 0
      ? 0
      : Math.max(0, 2 - (typos.length > 0 ? 1 : 0) - (sayaOverused ? 1 : 0))
  const neatnessParts: string[] = []
  if (typos.length > 0) {
    neatnessParts.push(
      `Ditemukan kata yang sering salah eja: ${typos
        .slice(0, 4)
        .map((t) => `"${t.wrong}" (baku: "${t.right}")`)
        .join(', ')}. Periksa kembali ejaan sebelum mengirim CV.`,
    )
  }
  if (sayaOverused) {
    neatnessParts.push(
      `Kata "saya" muncul ${sayaCount} kali di bagian pengalaman. Poin pengalaman yang profesional biasanya langsung diawali kata kerja tanpa kata ganti orang pertama.`,
    )
  }
  const neatnessMessage =
    totalWords === 0
      ? 'Belum ada teks yang bisa dinilai kerapiannya. Tulis isi CV dulu — kerapian bahasa dinilai dari teks tersebut.'
      : neatnessParts.length > 0
      ? neatnessParts.join(' ')
      : 'Tidak ditemukan kata yang sering salah eja dari daftar periksa dasar, dan pemakaian kata ganti "saya" di bagian pengalaman masih wajar. (Pemeriksaan ini hanya menandai contoh dari daftar kecil kata yang sering salah eja — bukan pemeriksaan tata bahasa menyeluruh.)'

  const formatChecks = [
    makeCheck(
      'panjang', 'Format & ATS', 'Panjang CV', lengthScore, 8,
      `CV berisi ${totalWords} kata. Rentang ideal 220–900 kata (sekitar 1–2 halaman).`,
    ),
    makeCheck(
      'periode', 'Format & ATS', 'Tahun / periode kerja', yearsScore, 4,
      hasYears
        ? 'Tahun/periode tercantum pada riwayatmu.'
        : 'Tidak ada tahun/periode yang tercantum. Tulis periode kerja dan pendidikan, misalnya 2021–2024.',
    ),
    makeCheck(
      'bullet', 'Format & ATS', 'Struktur bullet', bulletScore, 3,
      `Ditemukan ${bulletCount} baris bullet. ${bulletCount >= 6 ? 'Struktur poin-poinnya sudah rapi.' : 'Bullet artinya uraian tugas dan pencapaian ditulis sebagai poin-poin terpisah — satu poin untuk satu tugas/pencapaian, satu poin per baris, diawali tanda • atau - — bukan ditulis menyatu dalam satu paragraf panjang. Susun pencapaianmu dalam poin-poin seperti itu agar mudah dipindai rekruter dan sistem ATS.'}`,
    ),
    makeCheck(
      'konsistensi-format', 'Format & ATS', 'Konsistensi format & urutan', consistencyScore, 3,
      consistencyMessage,
    ),
    makeCheck(
      'kerapian-bahasa', 'Format & ATS', 'Kerapian bahasa', neatnessScore, 2,
      neatnessMessage,
    ),
  ]

  // ===== Agregasi =====
  const aspectDefs: { name: string; max: number; checks: CheckItem[] }[] = [
    { name: 'Kontak', max: 20, checks: kontakChecks },
    { name: 'Ringkasan', max: 10, checks: ringkasanChecks },
    { name: 'Pengalaman', max: 28, checks: pengalamanChecks },
    { name: 'Pendidikan', max: 12, checks: pendidikanChecks },
    { name: 'Keahlian', max: 10, checks: keahlianChecks },
    { name: 'Format & ATS', max: 20, checks: formatChecks },
  ]

  const baseAspects: AspectResult[] = aspectDefs.map((a) => ({
    name: a.name,
    max: a.max,
    score: a.checks.reduce((sum, c) => sum + c.score, 0),
    checks: a.checks,
  }))

  // ===== Kata kunci lowongan =====
  // Bila deskripsi lowongan diisi dan menghasilkan kata kunci, kecocokan
  // kata kunci menjadi aspek tersendiri yang MASUK skor (maks 20) dan
  // aspek dasar diskalakan proporsional (×0,8) agar total tetap 100.
  // Tanpa deskripsi lowongan, komposisi skor persis seperti sebelumnya
  // dan kata kunci tidak dihitung sama sekali.
  const jobDesc = options.jobDesc?.trim() ?? ''
  const keywords = jobDesc ? extractJobKeywords(jobDesc, lower) : null
  const jobMatchApplied = !!keywords && keywords.total > 0

  let aspects = baseAspects
  if (jobMatchApplied && keywords) {
    aspects = baseAspects.map((a) => scaleAspect(a, 0.8))
    const jobScore = Math.round((keywords.percent / 100) * 20)
    const missingPreview = keywords.missing.slice(0, 5).join(', ')
    aspects = [
      ...aspects,
      {
        name: 'Kecocokan dengan Lowongan',
        max: 20,
        score: jobScore,
        checks: [
          makeCheck(
            'kecocokan-lowongan', 'Kecocokan dengan Lowongan', 'Kecocokan kata kunci lowongan',
            jobScore, 20,
            `Ditemukan ${keywords.found.length} dari ${keywords.total} kata kunci teratas lowongan di CV-mu (${keywords.percent}%). Skor keseluruhanmu kini mencakup kecocokan dengan lowongan ini — aspek ini khusus untuk lowongan yang kamu tempel dan berubah bila lowongannya berganti.${
              keywords.missing.length > 0
                ? ` Kata kunci penting yang belum ada: ${missingPreview}${keywords.missing.length > 5 ? ', …' : ''}. Tambahkan hanya kata kunci yang benar-benar sesuai pengalamanmu.`
                : ' Semua kata kunci teratas lowongan sudah ada di CV-mu.'
            }`,
          ),
        ],
      },
    ]
  }

  const allChecks = aspects.flatMap((a) => a.checks)
  const total = aspects.reduce((sum, a) => sum + a.score, 0)
  const label =
    total >= 85
      ? 'Sangat Siap Dilamar'
      : total >= 70
        ? 'Sudah Bagus'
        : total >= 50
          ? 'Perlu Perbaikan'
          : 'Perlu Dirombak Dulu'

  const strengths = allChecks.filter((c) => c.status === 'baik')
  const priorities = selectPriorities(allChecks, aspects)

  // ===== Peringatan posisi (tidak mengubah skor) =====
  let roleWarning: string | null = null
  if (role) {
    const firstWord = role.toLowerCase().match(/[a-z]+/)?.[0] ?? ''
    if (firstWord && !lower.includes(firstWord)) {
      roleWarning = `Posisi target "${role}" tidak disebut di dalam CV. Sebutkan posisi atau bidang ini di ringkasan atau pengalamanmu agar CV terlihat relevan.`
    }
  }

  return {
    total,
    label,
    aspects,
    strengths,
    priorities,
    keywords,
    jobMatchApplied,
    roleWarning,
    portfolioUrl,
    wordCount: totalWords,
  }
}
