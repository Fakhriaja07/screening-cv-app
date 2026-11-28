// Logika penilaian CV berbasis aturan (rule-based), 100% berjalan di browser.
// Total selalu 100 poin. Komposisi dasar: 6 aspek, 27 pemeriksaan —
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
//
// Pengetatan 2026-11-24 (persetujuan pengguna; tetap berbasis aspek,
// BUKAN kuota — ambang pemeriksaan lama tidak diubah): lima dimensi
// baru yang sebelumnya tidak dinilai sama sekali kini ikut diperiksa —
// profesionalitas alamat email (Kontak), kestabilan karier gabungan
// job hopping + tumpang tindih periode (Pengalaman), konsistensi klaim
// "X tahun pengalaman" terhadap linimasa nyata (Pengalaman), dan nama
// file CV (Format & ATS). Bobot didanai dari dalam aspeknya sendiri:
// Kontak — email 7→6, HP 6→5, email profesional baru 2 (total tetap
// 20); Pengalaman — heading 5→4, hasil terukur 6/5→5/4, kedalaman 4→3,
// frasa 3→2, kestabilan baru 2, konsistensi klaim baru 2 (total tetap
// 28); Format & ATS — panjang 8→7, periode 4→3, nama file baru 2
// (total tetap 20). Patokan memang bergerak karena dimensi yang dinilai
// bertambah — pergerakannya diukur & dicatat di ROADMAP.md.

import { expandJobTitle } from './jobGlossary.js'
import type { Lang } from './lang.js'

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
  // Posisi penentu skor (winning role) untuk tiap pemeriksaan relevansi
  // kondisional — posisi yang hasil penilaiannya dipakai sebagai skor
  // pemeriksaan itu. Null bila pemeriksaan itu tidak ada (tidak ada
  // posisi berkriteria). Pada pemakaian satu posisi, nilainya posisi
  // itu sendiri; pada banyak posisi, inilah dasar tampilan jujur
  // "skor relevansi mengikuti posisi: X" di UI.
  relevanceWinners: {
    ringkasan: string | null
    pengalaman: string | null
  }
}

export interface AnalyzeOptions {
  targetRole?: string
  // Posisi yang dilamar bisa lebih dari satu (keputusan pengguna
  // 2026-11-28, maksimal MAX_TARGET_ROLES): kedua pemeriksaan relevansi
  // dinilai untuk SETIAP posisi dan skor yang dipakai adalah hasil
  // TERBAIK di antaranya ("skor mengikuti posisi yang paling cocok").
  // Bila bidang ini diisi, ia yang dipakai; targetRole tunggal hanya
  // dipakai bila targetRoles tidak diberikan sama sekali. Daftar kosong
  // atau satu posisi berperilaku persis seperti jalur lama.
  targetRoles?: string[]
  jobDesc?: string
  // Nama berkas yang diunggah pengguna (mis. "CV_Budi.pdf"), diteruskan
  // lapisan baca-berkas/App agar nama file ikut dinilai. Kosong/tidak
  // diisi (teks ditempel manual) → pemeriksaan nama file netral penuh.
  fileName?: string
  lang?: Lang
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

// Label inline "Label: isi" pada satu baris, mis. "Keahlian: Python,
// SQL, Excel". Banyak CV nyata (terutama hasil ketik manual/ekspor
// sederhana) menulis bagian sebagai baris berlabel begini, bukan judul
// terstruktur — ekstraktor lama tidak membacanya sama sekali sehingga
// aspeknya jatuh 0 (ulasan eksternal 2026-11-28). Label harus PERSIS
// salah satu target pemanggil (kata/frasa utuh, case-insensitive) dan
// barisnya bukan bullet; kalimat narasi bertitik dua ("Tujuan: menjadi
// …") tidak pernah cocok karena labelnya bukan label yang dikenal.
function matchInlineLabel(line: string): { label: string; content: string } | null {
  if (BULLET_LINE.test(line)) return null
  const m = /^\s*([^:：]{1,40})\s*[:：]\s*(\S[\s\S]*)$/.exec(line)
  if (!m) return null
  const label = m[1].trim().toLowerCase().replace(/^#+\s*/, '')
  if (!label) return null
  return { label, content: m[2].trim() }
}

// Semua label bagian yang dikenal + label kontak umum — dipakai hanya
// sebagai penanda BERHENTI saat mengumpulkan isi bagian inline (baris
// berlabel berikutnya memulai bagian lain), bukan sebagai target.
const INLINE_STOP_LABELS = new Set([
  ...SUMMARY_HEADINGS,
  'keahlian', 'skill', 'kemampuan', 'kompetensi', 'tools', 'teknologi',
  'bahasa', 'language', 'languages',
  'pendidikan', 'education',
  'sertifikasi', 'pelatihan', 'kursus', 'sertifikat', 'certification', 'training', 'diklat',
  'pengalaman', 'experience', 'pekerjaan', 'work history', 'riwayat kerja',
  'proyek', 'project', 'magang',
  'email', 'telepon', 'hp', 'phone', 'alamat', 'lokasi', 'nama', 'name',
  'kontak', 'contact', 'portofolio', 'portfolio', 'linkedin', 'website',
])

function getSection(text: string, targets: string[]): string {
  const lines = text.split('\n')
  let start = -1
  for (let i = 0; i < lines.length; i++) {
    if (isHeadingLine(lines[i], targets)) {
      start = i
      break
    }
  }
  if (start !== -1) {
    const collected: string[] = []
    for (let i = start + 1; i < lines.length; i++) {
      if (isHeadingLine(lines[i], ALL_HEADING_WORDS)) break
      collected.push(lines[i])
    }
    return collected.join('\n').trim()
  }
  // Fallback label inline: hanya menyala bila TIDAK ada heading
  // terstruktur untuk target ini (heading selalu menang), jadi jalur
  // kode CV terstruktur — termasuk semua CV patokan — tidak berubah.
  const targetSet = new Set(targets.map((t) => t.toLowerCase()))
  for (let i = 0; i < lines.length; i++) {
    const hit = matchInlineLabel(lines[i])
    if (!hit || !targetSet.has(hit.label)) continue
    const collected: string[] = [hit.content]
    for (let j = i + 1; j < lines.length; j++) {
      if (isHeadingLine(lines[j], ALL_HEADING_WORDS)) break
      const next = matchInlineLabel(lines[j])
      if (next && INLINE_STOP_LABELS.has(next.label)) break
      collected.push(lines[j])
    }
    return collected.join('\n').trim()
  }
  return ''
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
  // Inggris lanjutan (2026-11-25): kata kerja lampau kuat yang lazim di
  // CV berbahasa Inggris, agar cakupan kamus Inggris setara dengan
  // daftar Indonesia di atas (sebelumnya hanya 11 kata).
  'delivered',
  'launched',
  'spearheaded',
  'coordinated',
  'achieved',
  'generated',
  'negotiated',
  'supervised',
  'trained',
  'mentored',
  'implemented',
  'executed',
  'streamlined',
  'optimized',
  'resolved',
  'produced',
  'presented',
  'directed',
  'oversaw',
  'facilitated',
  'engineered',
  'deployed',
  'maintained',
  'tested',
]

function countActionVerbs(lowerText: string): number {
  let found = 0
  for (const verb of ACTION_VERBS) {
    if (new RegExp(`\\b${verb}\\b`, 'i').test(lowerText)) found++
  }
  return found
}

// Satuan Inggris untuk hasil terukur (2026-11-25) — sejajar daftar
// satuan Indonesia pada penghitung di bawah: kata benda hasil/objek
// kerja yang lazim mengikuti angka pencapaian di CV berbahasa Inggris
// (people≈orang, clients≈klien, projects≈proyek, hours≈jam, days≈hari,
// months≈bulan, years≈tahun, plus kata hasil khas Inggris seperti
// users/records/downloads). Tidak ada tumpang tindih ejaan dengan
// satuan Indonesia, jadi hitungan teks Indonesia tidak berubah.
const MEASURABLE_UNITS_EN = [
  'users', 'customers', 'clients', 'records', 'transactions', 'projects',
  'team members', 'members', 'people', 'students', 'orders', 'sales',
  'leads', 'accounts', 'tickets', 'reports', 'documents', 'products',
  'stores', 'branches', 'employees', 'hours', 'days', 'weeks', 'months',
  'years', 'calls', 'emails', 'articles', 'posts', 'campaigns', 'events',
  'participants', 'downloads', 'subscribers', 'followers', 'visitors',
  'units', 'items', 'cases',
]

// Angka format Inggris: ribuan berpemisah koma (50,000 / 1,200,000)
// dengan desimal titik opsional, atau angka polos/desimal (15 / 2.5).
// Pemisah ribuan TITIK khas Indonesia tidak ditafsir ulang di sini —
// pola angka ini hanya dipakai bersama penanda Inggris ($/USD, satuan
// Inggris, akhiran K, pengganda x), tidak pernah berdiri sendiri.
const MEASURABLE_NUMBER_EN = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?`

// Pola hasil terukur berbahasa Inggris: nominal $/USD (termasuk $10K),
// angka + satuan Inggris (termasuk notasi K: "50K users"), dan
// pengganda Nx ("3x revenue"). Penjaga bawaan pola: "3x4" (pas foto)
// dan "24x7" tidak cocok karena setelah x wajib ada batas kata; angka
// tahun polos disaring terpisah di countMeasurableResults.
const MEASURABLE_EN_RE = new RegExp(
  String.raw`(?:us)?\$\s*(?:${MEASURABLE_NUMBER_EN})[kK]?|\busd\s*(?:${MEASURABLE_NUMBER_EN})[kK]?|(?:${MEASURABLE_NUMBER_EN})\s*[kK]\s*(?:${MEASURABLE_UNITS_EN.join('|')})|(?:${MEASURABLE_NUMBER_EN})\s*(?:${MEASURABLE_UNITS_EN.join('|')})|(?:${MEASURABLE_NUMBER_EN})x\b`,
  'gi',
)

function countMeasurableResults(text: string): number {
  let t = text
  // Pola Inggris diekstrak PALING AWAL, sebelum pembersih nomor HP di
  // bawah menelan rangkaian angka koma panjang (baginya "1,200,000"
  // terbaca seperti nomor telepon). Semua pola Inggris mensyaratkan
  // penanda khas ($/USD/satuan Inggris/K/Nx) yang tidak pernah dihitung
  // penghitung lama, jadi hasil hitung teks Indonesia tidak berubah.
  let enCount = 0
  t = t.replace(MEASURABLE_EN_RE, (m) => {
    const num = /\d[\d.,]*/.exec(m)?.[0] ?? ''
    // Tahun kalender polos bukan hasil terukur ("2020 users" terbaca
    // sebagai pengguna tahun 2020), konsisten dengan pembersihan tahun
    // di bawah — kecocokan seperti itu dibiarkan agar aturan lama yang
    // membersihkannya. Nominal $/USD dan notasi K berangka mirip tahun
    // tetap dihitung: penandanya menunjukkan jumlah, bukan tahun.
    if (
      /^(19|20)\d{2}$/.test(num) &&
      !m.includes('$') &&
      !/usd/i.test(m) &&
      !/[kK]/.test(m)
    ) {
      return m
    }
    enCount++
    return ' '
  })
  // Buang rangkaian mirip nomor HP/telepon agar digitnya tidak terhitung.
  t = t.replace(/\+?\(?\d[\d\s().-]{6,}\d/g, ' ')
  // Buang tahun kalender 19xx/20xx (termasuk rentang tahun).
  t = t.replace(/\b(19|20)\d{2}\b/g, ' ')
  // Nominal Rp dihitung sekali, lalu dibuang agar tidak terhitung ganda via satuan.
  const rpMatches = t.match(/rp\s*\d[\d.,]*/gi) ?? []
  t = t.replace(/rp\s*\d[\d.,]*/gi, ' ')
  const unitMatches =
    t.match(/\d+(?:[.,]\d+)?\s*(%|juta|ribu|orang|klien|proyek|jam|hari|bulan|tahun)/gi) ?? []
  return enCount + rpMatches.length + unitMatches.length
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
  // Teks baris judul + jangkar entri ("Jabatan — Perusahaan (periode)")
  // — dipakai pemeriksaan kestabilan karier untuk mengenali jenis
  // entri (magang/proyek/freelance vs formal) dan menyebut nama peran
  // pada pesan tumpang tindih.
  headingText: string
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
      headingText: anchorText.replace(/\s+/g, ' ').trim(),
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

// ---------- Kata ganti "I" pada CV berbahasa Inggris ----------

// Padanan komponen "saya berlebihan" untuk CV berbahasa Inggris
// (2026-11-25): kata ganti orang pertama "I" yang berulang di bagian
// pengalaman. Diterapkan dengan TIGA penjaga berlapis agar tidak
// pernah menghukum CV Indonesia secara keliru:
// (1) teks harus dominan bahasa Inggris menurut kata fungsi — teks
//     Indonesia atau campuran tidak pernah masuk jalur ini;
// (2) "I" dicocokkan case-sensitive pada teks ASLI (bukan huruf kecil),
//     sehingga yang terhitung hanya huruf kapital "I" yang berdiri
//     sendiri persis seperti kata ganti Inggris;
// (3) "I" hanya dihitung bila langsung diikuti kata kerja Inggris
//     (pola "I managed …", "I was …"). Pola angka Romawi yang lazim di
//     CV Indonesia — "Juara I lomba …", "Tahap I …", "Semester I …",
//     "Peringkat I …" — selalu diikuti kata Indonesia, jadi tidak
//     terhitung; nama Bali seperti "I Made …" juga tidak, karena kata
//     sesudahnya bukan kata kerja Inggris.
const EN_FUNCTION_WORDS = new Set([
  'the', 'and', 'of', 'to', 'in', 'for', 'with', 'on', 'at', 'by',
  'from', 'an', 'a', 'is', 'are', 'was', 'were', 'be', 'been', 'or',
  'it', 'its', 'my', 'our', 'your', 'their', 'this', 'that', 'these',
  'those', 'who', 'which', 'when', 'where', 'while', 'also', 'into',
])
const ID_FUNCTION_WORDS = new Set([
  'yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'dengan', 'pada',
  'adalah', 'ini', 'itu', 'juga', 'dalam', 'sebagai', 'atau', 'tidak',
  'telah', 'selama', 'setiap', 'oleh', 'karena', 'dapat', 'bisa',
  'saya', 'kami', 'kita', 'serta', 'maupun', 'antara', 'hingga',
  'melalui', 'terhadap', 'berbagai',
])

// Bahasa dominan teks dari kata fungsi: bahasa Inggris harus jelas
// mendominasi (≥10 kata fungsi Inggris DAN >2× kata fungsi Indonesia).
// Di luar keadaan itu teks dianggap bukan CV Inggris dan komponen "I"
// tidak dinilai sama sekali — pilihan aman untuk teks campuran.
export function isDominantEnglish(rawText: string): boolean {
  const tokens = rawText.toLowerCase().match(/[a-z]+/g) ?? []
  let en = 0
  let id = 0
  for (const t of tokens) {
    if (EN_FUNCTION_WORDS.has(t)) en++
    else if (ID_FUNCTION_WORDS.has(t)) id++
  }
  return en >= 10 && en > id * 2
}

// Kata yang lazim langsung mengikuti kata ganti "I" dalam kalimat CV
// Inggris: kata kerja bantu + kata kerja lampau umum (termasuk seluruh
// kata kerja aksi Inggris pada ACTION_VERBS).
const I_FOLLOW_WORDS = new Set([
  'am', 'was', 'were', 'have', 'has', 'had', 'do', 'did', 'can',
  'could', 'will', 'would',
  'increased', 'managed', 'developed', 'built', 'led', 'created',
  'improved', 'analyzed', 'designed', 'automated', 'reduced',
  'delivered', 'launched', 'spearheaded', 'coordinated', 'achieved',
  'generated', 'negotiated', 'supervised', 'trained', 'mentored',
  'implemented', 'executed', 'streamlined', 'optimized', 'resolved',
  'produced', 'presented', 'directed', 'oversaw', 'facilitated',
  'engineered', 'deployed', 'maintained', 'tested',
  'worked', 'handled', 'completed', 'assisted', 'prepared', 'ensured',
  'served', 'wrote', 'ran', 'used', 'helped', 'supported', 'provided',
  'performed', 'planned', 'organized', 'processed', 'monitored',
  'documented', 'operated', 'collaborated', 'communicated',
])

// Semua kemunculan kata ganti "I" di bagian pengalaman yang lolos
// ketiga penjaga di atas, sebagai offset di teks asli. Mengembalikan
// array kosong untuk teks yang tidak dominan bahasa Inggris.
export function findFirstPersonIOccurrences(rawText: string): TextOccurrence[] {
  if (!isDominantEnglish(rawText)) return []
  const out: TextOccurrence[] = []
  for (const range of getExperienceSectionRanges(rawText)) {
    const rawSection = rawText.slice(range.start, range.end)
    const lead = rawSection.length - rawSection.trimStart().length
    const section = rawSection.trim()
    if (!section) continue
    const base = range.start + lead
    for (const m of section.matchAll(/\bI[ \t]+([A-Za-z]+)/g)) {
      const next = (m[1] ?? '').toLowerCase()
      if (!I_FOLLOW_WORDS.has(next)) continue
      const idx = m.index ?? 0
      out.push({ start: base + idx, end: base + idx + 1 })
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

export const PERIOD_FAMILY_LABEL_EN: Record<PeriodFamily, string> = {
  tahun: 'year range (e.g. 2021–2024)',
  bulan: 'month–year (e.g. Jan 2022)',
  angka: 'numeric (e.g. 01/2022)',
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
  // Klise bahasa Inggris (2026-11-25): padanan langsung daftar Indonesia
  // di atas — klaim generik yang sama, dalam bahasa Inggris. Varian eja
  // (bertanda hubung / tanpa) dimasukkan sebagai entri terpisah, meniru
  // pola varian eja pada daftar Indonesia.
  { core: 'responsible for', display: 'responsible for' },
  { core: 'hard worker', display: 'hard worker' },
  { core: 'hardworking', display: 'hardworking' },
  { core: 'team player', display: 'team player' },
  { core: 'fast learner', display: 'fast learner' },
  { core: 'quick learner', display: 'quick learner' },
  { core: 'self-motivated', display: 'self-motivated' },
  { core: 'self motivated', display: 'self motivated' },
  { core: 'detail-oriented', display: 'detail-oriented' },
  { core: 'detail oriented', display: 'detail oriented' },
  { core: 'go-getter', display: 'go-getter' },
  { core: 'go getter', display: 'go getter' },
  { core: 'work under pressure', display: '(able to) work under pressure' },
  {
    core: 'willing to be placed anywhere',
    display: 'willing to be placed anywhere',
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
  // Salah eja bahasa Inggris yang sangat lazim di CV (2026-11-25).
  // Setiap bentuk "wrong" di sini BUKAN kata yang sah dalam bahasa
  // Inggris maupun Indonesia, sehingga tidak ada risiko positif-palsu
  // pada CV Indonesia. Dua kandidat sengaja TIDAK dimasukkan:
  // 'teh' (salah eja "the", tetapi kata Indonesia yang sah untuk
  // minuman — CV F&B Indonesia bisa memuatnya secara sah) dan
  // 'calender' (salah eja "calendar", tetapi juga nama mesin yang sah
  // di industri kertas/tekstil — "calender operator" adalah jabatan
  // sungguhan).
  { wrong: 'recieve', right: 'receive' },
  { wrong: 'seperate', right: 'separate' },
  { wrong: 'occured', right: 'occurred' },
  { wrong: 'managment', right: 'management' },
  { wrong: 'experince', right: 'experience' },
  { wrong: 'experiance', right: 'experience' },
  { wrong: 'definately', right: 'definitely' },
  { wrong: 'succesful', right: 'successful' },
  { wrong: 'acheive', right: 'achieve' },
  { wrong: 'developement', right: 'development' },
  { wrong: 'employement', right: 'employment' },
  { wrong: 'knowlege', right: 'knowledge' },
  { wrong: 'languge', right: 'language' },
  { wrong: 'similiar', right: 'similar' },
  { wrong: 'writting', right: 'writing' },
  { wrong: 'tommorow', right: 'tomorrow' },
  { wrong: 'truely', right: 'truly' },
  { wrong: 'wich', right: 'which' },
  { wrong: 'adress', right: 'address' },
  { wrong: 'collegue', right: 'colleague' },
  { wrong: 'commited', right: 'committed' },
  { wrong: 'refering', right: 'referring' },
  { wrong: 'requirment', right: 'requirement' },
  { wrong: 'strenght', right: 'strength' },
  { wrong: 'enviroment', right: 'environment' },
  { wrong: 'goverment', right: 'government' },
  { wrong: 'accomodate', right: 'accommodate' },
  { wrong: 'responsibilty', right: 'responsibility' },
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

// Satu periode entri yang TIDAK SAH secara kalender: terbalik (tahun
// selesai lebih awal dari tahun mulai) atau berada di masa depan
// (tahun mulai melewati tahun berjalan). Periode seperti ini tidak
// bisa dipakai menilai linimasa — tanggal yang mustahil bukan bukti
// riwayat yang rapi.
export interface InvalidPeriod {
  startYear: number
  endYear: number | null // null bila peran ditandai masih berjalan
  kind: 'terbalik' | 'masa-depan'
}

// Fakta linimasa dari periode entri yang terbaca — satu-satunya sumber
// angka jeda & kebaruan, dipakai pemeriksaan linimasa DAN contoh
// personalnya agar keduanya selalu menyebut tahun yang sama. Jeda dan
// kebaruan dihitung HANYA dari entri berperiode yang sah; periode
// tidak sah dipisahkan ke invalidPeriods (keputusan pengguna
// 2026-11-24: periode terbalik/masa depan tidak lagi berpoin penuh).
export interface TimelineFacts {
  datedCount: number // jumlah entri berperiode yang SAH
  gaps: TimelineGap[]
  hasCurrent: boolean
  latestEnd: number
  yearsSinceEnd: number
  stale: boolean
  invalidPeriods: InvalidPeriod[]
}

function computeTimelineFacts(
  blocks: ExperienceBlock[],
  currentYear: number,
): TimelineFacts | null {
  const dated = blocks.filter((b) => b.startYear !== null)
  if (dated.length === 0) return null
  const invalidPeriods: InvalidPeriod[] = []
  const valid: ExperienceBlock[] = []
  for (const b of dated) {
    const start = b.startYear ?? 0
    if (start > currentYear) {
      invalidPeriods.push({ startYear: start, endYear: b.endYear, kind: 'masa-depan' })
    } else if (!b.isCurrent && b.endYear !== null && b.endYear < start) {
      invalidPeriods.push({ startYear: start, endYear: b.endYear, kind: 'terbalik' })
    } else {
      valid.push(b)
    }
  }
  const sorted = [...valid].sort((a, b) => (a.startYear ?? 0) - (b.startYear ?? 0))
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
  const hasCurrent = valid.some((b) => b.isCurrent)
  const latestEnd =
    valid.length === 0
      ? 0
      : Math.max(
          ...valid.map((b) => (b.isCurrent ? currentYear : (b.endYear ?? b.startYear ?? 0))),
        )
  const yearsSinceEnd = currentYear - latestEnd
  return {
    datedCount: valid.length,
    gaps,
    hasCurrent,
    latestEnd,
    yearsSinceEnd,
    stale: valid.length > 0 && !hasCurrent && yearsSinceEnd >= 4,
    invalidPeriods,
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
// sudah lama berakhir dan tidak ada peran saat ini, (c) periode tidak
// sah — terbalik atau di masa depan (keputusan pengguna 2026-11-24).
// Periode tidak sah diperlakukan setara kesenjangan: komponen jeda
// (2 poin) hilang, karena urutan waktu yang mustahil tidak bisa
// diverifikasi kerapihannya; kebaruan hanya dinilai dari entri sah.
// Bila tidak ada entri berperiode yang terbaca, pemeriksaan tidak
// mengarang nilai: skor 0 dengan pesan bahwa linimasa belum bisa
// dinilai.
function assessTimeline(blocks: ExperienceBlock[], currentYear: number, lang: Lang = 'id'): TimelineAssessment {
  const facts = computeTimelineFacts(blocks, currentYear)
  if (!facts) {
    return {
      score3: 0,
      message:
        lang === 'en'
          ? 'The period of each experience entry has no readable year, so the timeline (gaps between jobs and how recent your latest role is) cannot be assessed yet. Write a clear period on each entry, for example (2022–2024) or (2022–Present).'
          : 'Periode tiap entri pengalaman tidak terbaca tahunnya, sehingga linimasa (kesenjangan antarpekerjaan dan kebaruan peran terakhir) belum bisa dinilai. Tulis periode yang jelas pada tiap entri, misalnya (2022–2024) atau (2022–Sekarang).',
    }
  }
  const invalidIssues = facts.invalidPeriods.map((p) =>
    lang === 'en'
      ? p.kind === 'terbalik'
        ? `the period ${p.startYear}–${p.endYear} is reversed (the end year is earlier than the start year)`
        : `the period ${p.startYear}–${p.endYear ?? 'Present'} is in the future (the start year is after the current year ${currentYear})`
      : p.kind === 'terbalik'
        ? `periode ${p.startYear}–${p.endYear} terbalik (tahun selesai lebih awal dari tahun mulai)`
        : `periode ${p.startYear}–${p.endYear ?? 'Sekarang'} berada di masa depan (tahun mulai melewati tahun berjalan ${currentYear})`,
  )
  const gapIssues = facts.gaps.map((g) =>
    lang === 'en'
      ? `there is a gap of about ${g.years} years (between around ${g.fromYear} and around ${g.toYear}) with no explanation in the CV`
      : `ada kesenjangan sekitar ${g.years} tahun (antara ±${g.fromYear} dan ±${g.toYear}) tanpa penjelasan di CV`,
  )
  const gapScore = gapIssues.length > 0 || invalidIssues.length > 0 ? 0 : 2
  const recencyScore = facts.datedCount === 0 || facts.stale ? 0 : 1
  const parts: string[] = []
  if (invalidIssues.length > 0) {
    parts.push(
      lang === 'en'
        ? `Found periods that don't make sense: ${invalidIssues.join('; ')}.`
        : `Ditemukan periode yang tidak masuk akal: ${invalidIssues.join('; ')}.`,
    )
    parts.push(
      lang === 'en'
        ? 'Impossible dates make recruiters doubt your whole history — fix how those periods are written before you apply.'
        : 'Tanggal yang mustahil membuat rekruter meragukan seluruh riwayatmu — perbaiki penulisan periode itu sebelum melamar.',
    )
  }
  if (gapIssues.length > 0) {
    parts.push(
      lang === 'en'
        ? `Timeline as read: ${gapIssues.join('; ')}.`
        : `Linimasa terbaca: ${gapIssues.join('; ')}.`,
    )
    parts.push(
      lang === 'en'
        ? 'A gap is not automatically bad (study, family, running a business, caring for parents), but without an explanation recruiters will wonder — add one line about what you did during that period.'
        : 'Kesenjangan bukan otomatis buruk (kuliah, keluarga, wirausaha, merawat orang tua), tetapi tanpa penjelasan rekruter akan bertanya-tanya — tambahkan satu baris aktivitas pengisi pada periode itu.',
    )
  }
  if (facts.stale) {
    parts.push(
      lang === 'en'
        ? `Your most recent readable experience ended around ${facts.latestEnd} (${facts.yearsSinceEnd} years ago) and no current role is listed. If you are still working or active, include your latest role; if there was a break, briefly explain what you did during that time.`
        : `Pengalaman terakhir yang terbaca berakhir sekitar ${facts.latestEnd} (${facts.yearsSinceEnd} tahun lalu) dan tidak ada peran saat ini yang tercantum. Bila kamu masih bekerja/berkegiatan, cantumkan peran terkinimu; bila memang ada jeda, jelaskan singkat aktivitasmu pada periode itu.`,
    )
  }
  if (parts.length === 0) {
    parts.push(
      lang === 'en'
        ? `Your experience timeline reads cleanly from ${facts.datedCount} dated entries: no long gaps between entries${
            facts.hasCurrent
              ? ', and there is a role still ongoing.'
              : `, and your latest role ended around ${facts.latestEnd} (not long ago).`
          }`
        : `Linimasa pengalaman terbaca rapi dari ${facts.datedCount} entri berperiode: tidak ada kesenjangan panjang antar-entri${
            facts.hasCurrent
              ? ', dan ada peran yang masih berjalan saat ini.'
              : `, dan peran terakhir berakhir sekitar ${facts.latestEnd} (belum lama).`
          }`,
    )
  }
  return { score3: gapScore + recencyScore, message: parts.join(' ') }
}

// ---------- Kestabilan karier: job hopping & tumpang tindih periode ----------

// Penanda entri BUKAN pekerjaan formal pada baris judul entri: magang,
// PKL/praktik kerja, proyek, dan freelance/paruh waktu yang dinyatakan
// eksplisit. Pola-pola itu sah dan umum (terutama bagi fresh graduate),
// jadi tidak dihitung sebagai pindah-pindah kerja dan tidak dituduh
// tumpang tindih dengan pekerjaan formal. "Project Manager" / "Manajer
// Proyek" adalah jabatan formal, bukan entri proyek — kata proyek yang
// diikuti kata manajer tidak diperlakukan sebagai penanda.
const NON_FORMAL_ENTRY =
  /\b(magang|internship|intern|pkl|praktik kerja|freelance|paruh waktu|part[\s-]?time)\b|\b(proyek|project)\b(?!\s+(manager|manajer|management))/i

function isNonFormalEntry(headingText: string): boolean {
  return NON_FORMAL_ENTRY.test(headingText)
}

// Entri berperiode yang SAH secara kalender — filter yang sama dengan
// fakta linimasa: periode terbalik dan masa depan dikeluarkan (keduanya
// sudah ditangani pemeriksaan linimasa, bukan dihitung dua kali di sini).
function validDatedBlocks(blocks: ExperienceBlock[], currentYear: number): ExperienceBlock[] {
  return blocks.filter((b) => {
    if (b.startYear === null) return false
    if (b.startYear > currentYear) return false
    if (!b.isCurrent && b.endYear !== null && b.endYear < b.startYear) return false
    return true
  })
}

interface CareerStabilityAssessment {
  score2: number // skala maks 2
  message: string
}

// Job hopping dan tumpang tindih periode digabung dalam SATU
// pemeriksaan "Kestabilan karier" (pengetatan 2026-11-24): keduanya
// membaca fakta linimasa yang sama dan sama-sama menjawab satu
// pertanyaan rekruter — "apakah riwayat orang ini stabil?" — jadi dua
// pemeriksaan mungil terpisah hanya akan memecah aspek tanpa menambah
// makna. Aturannya definisional pada pemeriksaan BARU ini (bukan kuota
// pemeriksaan lama): peran formal berdurasi < 12 bulan — pada
// penulisan tahun saja, peran yang mulai dan selesai di tahun yang
// sama — yang berulang (≥3 peran singkat, atau mayoritas dari ≥3 peran
// formal bertanggal) terbaca sebagai pola pindah-pindah; dua peran
// formal yang periodenya beririsan ≥ 1 tahun kalender (pada resolusi
// tahun, itu jaminan tumpang tindih nyata > 3 bulan; irisan lebih
// tipis tidak dituduhkan karena bulan mulai/selesai tidak terbaca)
// terbaca sebagai tanggal yang bertabrakan. Aman/netral bila entri
// bertanggal < 2: pola memang belum bisa terbentuk.
function assessCareerStability(
  blocks: ExperienceBlock[],
  currentYear: number,
  lang: Lang = 'id',
): CareerStabilityAssessment {
  const valid = validDatedBlocks(blocks, currentYear)
  if (valid.length === 0) {
    return {
      score2: 0,
      message:
        lang === 'en'
          ? 'There are no valid dated experience entries yet to assess career stability (patterns of job hopping and overlapping roles). Write a clear period on each experience entry so your career timeline can be assessed.'
          : 'Belum ada entri pengalaman berperiode yang sah untuk dinilai kestabilan kariernya (pola pindah-pindah kerja dan tumpang tindih antarperan). Tulis periode yang jelas pada tiap entri pengalaman agar linimasa kariermu bisa dinilai.',
    }
  }
  const formal = valid.filter((b) => !isNonFormalEntry(b.headingText))
  if (formal.length === 0) {
    return {
      score2: 2,
      message:
        lang === 'en'
          ? 'The dated entries found so far are internships, projects, or freelance work — those patterns naturally involve moving around and are not counted as job hopping. Formal career stability will be assessed once you have dated formal work history.'
          : 'Entri berperiode yang terbaca baru berupa magang/proyek/freelance — pola-pola itu memang lazim berpindah-pindah dan tidak dihitung sebagai job hopping. Kestabilan karier formal dinilai begitu ada riwayat pekerjaan formal berperiode.',
    }
  }
  const shortRoles = formal.filter(
    (b) => !b.isCurrent && b.endYear !== null && b.endYear <= (b.startYear ?? 0),
  )
  const hopping =
    shortRoles.length >= 3 || (formal.length >= 3 && shortRoles.length * 2 > formal.length)
  const endOf = (b: ExperienceBlock) =>
    b.isCurrent ? currentYear : (b.endYear ?? b.startYear ?? 0)
  let overlapPair: [ExperienceBlock, ExperienceBlock] | null = null
  outer: for (let i = 0; i < formal.length; i++) {
    for (let j = i + 1; j < formal.length; j++) {
      const overlapYears =
        Math.min(endOf(formal[i]), endOf(formal[j])) -
        Math.max(formal[i].startYear ?? 0, formal[j].startYear ?? 0)
      if (overlapYears >= 1) {
        overlapPair = [formal[i], formal[j]]
        break outer
      }
    }
  }
  const issues = (hopping ? 1 : 0) + (overlapPair ? 1 : 0)
  const parts: string[] = []
  if (hopping) {
    parts.push(
      lang === 'en'
        ? `${shortRoles.length} of your ${formal.length} formal roles were short (less than 12 months — starting and ending in the same year). Moving this quickly makes recruiters worry you will leave again before they recoup the cost of training you. If those short roles were actually contracts, projects, or freelance work, say so explicitly — e.g. "(6-month contract)" or "Freelance" — so they don't read as job hopping.`
        : `${shortRoles.length} dari ${formal.length} peran formalmu berdurasi singkat (kurang dari 12 bulan — mulai dan selesai di tahun yang sama). Pola berpindah-pindah secepat ini membuat rekruter khawatir kamu akan keluar lagi sebelum balik modal melatihmu. Bila peran-peran singkat itu memang kontrak, proyek, atau freelance, tulis eksplisit — mis. "(kontrak 6 bulan)" atau "Freelance" — agar tidak terbaca sebagai job hopping.`,
    )
  }
  if (overlapPair) {
    parts.push(
      lang === 'en'
        ? `The periods "${overlapPair[0].headingText}" and "${overlapPair[1].headingText}" overlap for quite a while. Two formal jobs running at the same time looks odd — check your start and end dates again; if one was actually part-time or freelance alongside your main job, say so explicitly so it doesn't read as a date error.`
        : `Periode "${overlapPair[0].headingText}" dan "${overlapPair[1].headingText}" tumpang tindih cukup lama. Dua pekerjaan formal yang berjalan bersamaan terbaca janggal — periksa kembali tanggal mulai/selesaimu; bila salah satunya memang paruh waktu atau freelance di sela pekerjaan utama, tulis eksplisit agar tidak terbaca sebagai kesalahan tanggal.`,
    )
  }
  if (parts.length === 0) {
    parts.push(
      lang === 'en'
        ? `From ${formal.length} dated formal roles: no pattern of job hopping (repeated short roles) and no overlapping periods between roles — your career timeline reads as stable.`
        : `Dari ${formal.length} peran formal berperiode: tidak ditemukan pola job hopping (peran singkat yang berulang) dan tidak ada periode antarperan yang tumpang tindih — linimasa kariermu terbaca stabil.`,
    )
  }
  return { score2: 2 - issues, message: parts.join(' ') }
}

// ---------- Konsistensi klaim lama pengalaman ----------

// Angka tahun pada klaim: digit ("5 tahun", "5+ years") atau kata
// bilangan Indonesia yang lazim pada ringkasan ("dua tahun").
const CLAIM_WORD_NUMBERS: Record<string, number> = {
  satu: 1,
  dua: 2,
  tiga: 3,
  empat: 4,
  lima: 5,
  enam: 6,
  tujuh: 7,
  delapan: 8,
  sembilan: 9,
  sepuluh: 10,
  sebelas: 11,
  'dua belas': 12,
}
const CLAIM_NUMBER_PATTERN =
  '(\\d+(?:[.,]\\d+)?|dua belas|sebelas|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh)'

// Klaim lama pengalaman terbesar yang tertulis di teks ("5 tahun
// pengalaman", "pengalaman selama 3 tahun", "5 years of experience"),
// atau null bila tidak ada klaim berbentuk angka. Polanya berjangkar
// pada kata "pengalaman"/"experience" agar durasi lain (masa sekolah,
// lama proyek) tidak terbaca sebagai klaim.
export function findExperienceClaimYears(text: string): number | null {
  const lower = text.toLowerCase()
  const patterns = [
    new RegExp(`\\b${CLAIM_NUMBER_PATTERN}\\s*(?:tahun|thn)\\s+(?:pengalaman|berpengalaman)\\b`, 'g'),
    new RegExp(`\\bpengalaman\\s+(?:selama\\s+)?${CLAIM_NUMBER_PATTERN}\\s*(?:tahun|thn)\\b`, 'g'),
    /\b(\d+(?:[.,]\d+)?)\s*\+?\s*years?\s+of\s+(?:professional\s+)?experience\b/g,
    /\bexperience\s+of\s+(\d+(?:[.,]\d+)?)\s*years?\b/g,
  ]
  let max: number | null = null
  for (const re of patterns) {
    for (const m of lower.matchAll(re)) {
      const raw = m[1]
      const value = /^\d/.test(raw)
        ? parseFloat(raw.replace(',', '.'))
        : CLAIM_WORD_NUMBERS[raw]
      if (typeof value === 'number' && !Number.isNaN(value)) {
        if (max === null || value > max) max = value
      }
    }
  }
  return max
}

// Total durasi nyata dari entri berperiode yang sah, dalam tahun:
// interval yang tumpang tindih digabung dulu agar tahun yang sama
// tidak dihitung dua kali.
function totalExperienceYears(blocks: ExperienceBlock[], currentYear: number): number {
  const intervals = validDatedBlocks(blocks, currentYear)
    .map((b) => ({
      start: b.startYear ?? 0,
      end: b.isCurrent ? currentYear : (b.endYear ?? b.startYear ?? 0),
    }))
    .sort((a, b) => a.start - b.start)
  let total = 0
  let cur: { start: number; end: number } | null = null
  for (const iv of intervals) {
    if (!cur) {
      cur = { ...iv }
    } else if (iv.start <= cur.end) {
      cur.end = Math.max(cur.end, iv.end)
    } else {
      total += cur.end - cur.start
      cur = { ...iv }
    }
  }
  if (cur) total += cur.end - cur.start
  return total
}

function formatYears(n: number, lang: Lang = 'id'): string {
  if (Number.isInteger(n)) return String(n)
  return lang === 'en' ? String(n) : String(n).replace('.', ',')
}

interface ClaimConsistencyAssessment {
  score2: number // skala maks 2
  message: string
}

// Klaim "X tahun pengalaman" adalah kalimat yang paling sering
// diperiksa rekruter terhadap linimasa — dan paling mudah dibesarkan.
// Pemeriksaan ini (pengetatan 2026-11-24) membandingkan klaim terbesar
// di teks dengan total durasi nyata yang terhitung dari periode entri.
// Toleransi 1 tahun menampung perbedaan cara menghitung (pembulatan,
// tahun berjalan). TANPA klaim atau TANPA entri bertanggal,
// pemeriksaan lulus/netral penuh: ketiadaan klaim bukan kesalahan.
function assessClaimConsistency(
  text: string,
  blocks: ExperienceBlock[],
  currentYear: number,
  lang: Lang = 'id',
): ClaimConsistencyAssessment {
  const claim = findExperienceClaimYears(text)
  if (claim === null) {
    return {
      score2: 2,
      message:
        lang === 'en'
          ? 'No numeric claim about years of experience (e.g. "5 years of experience") was found in your CV text, so there is no claim to check against your timeline. If you make a claim like that in your summary, make sure it matches your actual total experience period.'
          : 'Tidak ditemukan klaim lama pengalaman berbentuk angka (mis. "5 tahun pengalaman") di teks CV, jadi tidak ada klaim yang perlu dicocokkan dengan linimasa. Bila kamu menulis klaim seperti itu di ringkasan, pastikan sesuai dengan total periode pengalamanmu yang sebenarnya.',
    }
  }
  if (validDatedBlocks(blocks, currentYear).length === 0) {
    return {
      score2: 2,
      message:
        lang === 'en'
          ? `You claim ${formatYears(claim, lang)} years of experience, but the periods on your experience entries have no readable years, so the claim cannot be checked yet. Write a clear period on each entry (e.g. 2021–2024) so recruiters — and this check — can verify your claim.`
          : `Kamu mengklaim ${formatYears(claim)} tahun pengalaman, tetapi periode entri pengalamanmu tidak terbaca tahunnya sehingga klaim itu belum bisa dicocokkan. Tulis periode yang jelas pada tiap entri (mis. 2021–2024) agar rekruter — dan pemeriksaan ini — bisa memverifikasi klaimmu.`,
    }
  }
  const actual = totalExperienceYears(blocks, currentYear)
  if (claim - actual > 1) {
    return {
      score2: 0,
      message:
        lang === 'en'
          ? `There is a mismatch in your experience claim: your CV text claims ${formatYears(claim, lang)} years of experience, but the total duration calculated from your experience entry periods is only about ${formatYears(actual, lang)} years. A claim larger than your timeline is easy to spot when recruiters add up your dates, and it damages trust in the whole CV — adjust the claim to match reality, or complete the periods for experience entries that are missing them.`
          : `Ada ketidaksesuaian klaim pengalaman: teks CV-mu mengklaim ${formatYears(claim)} tahun pengalaman, tetapi total durasi yang terhitung dari periode entri pengalamanmu hanya sekitar ${formatYears(actual)} tahun. Klaim yang lebih besar dari linimasa mudah terbongkar saat rekruter menjumlahkan tanggalmu dan merusak kepercayaan pada seluruh CV — sesuaikan klaimnya dengan kenyataan, atau lengkapi entri pengalaman yang belum tertulis periodenya.`,
    }
  }
  return {
    score2: 2,
    message:
      lang === 'en'
        ? `Your claim of ${formatYears(claim, lang)} years of experience lines up with the timeline as read (the total duration of your experience entries comes to about ${formatYears(actual, lang)} years) — recruiters can verify your claim from your own dates.`
        : `Klaim ${formatYears(claim)} tahun pengalaman sejalan dengan linimasa yang terbaca (total durasi entri pengalamanmu terhitung sekitar ${formatYears(actual)} tahun) — klaimmu bisa diverifikasi rekruter dari tanggal-tanggalmu sendiri.`,
  }
}

// ---------- Profesionalitas alamat email ----------

// Kata panggilan/alay yang jelas tidak profesional sebagai alamat
// email lamaran. Daftar ini SENGAJA konservatif dan pencocokannya per
// token utuh (setelah membuang angka di akhir token dan akhiran huruf
// alay seperti "z"), sehingga nama orang sungguhan tidak ikut
// tertandai — termasuk nama yang mengandung potongan kata ini, mis.
// "Cantika" (bukan "cantik"). Bila ragu, email diluluskan.
const UNPROFESSIONAL_EMAIL_WORDS = new Set([
  'cakep', 'imut', 'ganteng', 'cantik', 'sayang', 'kece', 'unyu',
  'maniez', 'gaul', 'sexy', 'princess', 'babe', 'honey', 'ayang',
  'bebeb', 'cinta', 'cool',
])

export interface EmailProfessionalAssessment {
  ok: boolean
  reason: string | null
}

export function assessEmailProfessional(email: string, lang: Lang = 'id'): EmailProfessionalAssessment {
  const local = email.split('@')[0]?.toLowerCase() ?? ''
  const digitCount = (local.match(/\d/g) ?? []).length
  if (digitCount >= 5) {
    return {
      ok: false,
      reason:
        lang === 'en'
          ? `a long run of numbers (${digitCount} digits) in the email name`
          : `deretan angka yang panjang (${digitCount} digit) pada nama email`,
    }
  }
  const tokens = local.split(/[._\-+]+/).filter(Boolean)
  for (const token of tokens) {
    const noDigits = token.replace(/\d+$/, '')
    const core = noDigits.replace(/[zsx]{1,2}$/, '')
    if (UNPROFESSIONAL_EMAIL_WORDS.has(core) || UNPROFESSIONAL_EMAIL_WORDS.has(noDigits)) {
      return {
        ok: false,
        reason:
          lang === 'en'
            ? `the word "${core}", which sounds like a nickname or slang, in the email name`
            : `kata "${core}" yang terkesan panggilan/alay pada nama email`,
      }
    }
  }
  return { ok: true, reason: null }
}

// ---------- Nama file CV ----------

// Kata generik pada nama file yang tidak menyebut siapa/pelamar apa.
const GENERIC_FILENAME_WORDS = new Set([
  'cv', 'resume', 'curriculum', 'vitae', 'final', 'baru', 'terbaru',
  'revisi', 'fix', 'dokumen', 'document', 'untitled', 'copy', 'salinan',
  'the', 'dan', 'file', 'berkas', 'lamaran',
])

export interface FileNameAssessment {
  score2: number // skala maks 2
  message: string
}

// Nama file adalah hal pertama yang dilihat rekruter & sistem ATS
// sebelum CV dibuka (pengetatan 2026-11-24). Hanya dinilai bila
// pengguna mengunggah berkas; teks yang ditempel manual membuat
// pemeriksaan ini netral penuh (tidak tampil sebagai kegagalan).
// Nama wajar = memuat kata yang menyerupai nama pelamar/posisi.
export function assessFileName(fileName: string, lang: Lang = 'id'): FileNameAssessment {
  const trimmed = fileName.trim()
  if (!trimmed) {
    return {
      score2: 2,
      message:
        lang === 'en'
          ? 'You pasted your CV text (rather than uploading a file), so the file name is not assessed and this check is neutral. When you later send your CV as a file, use a file name that includes your name — e.g. "CV_Name_Role.pdf" — because recruiters and ATS systems see the file name before opening your CV.'
          : 'Kamu menempel teks CV (bukan mengunggah file), jadi nama file tidak dinilai dan pemeriksaan ini netral. Bila nanti kamu mengirim CV sebagai file, pakai nama file yang memuat namamu — mis. "CV_Nama_Posisi.pdf" — karena rekruter dan sistem ATS melihat nama file sebelum membuka CV-mu.',
    }
  }
  const base = trimmed.split(/[\\/]/).pop() ?? trimmed
  const stem = base.replace(/\.[a-z0-9]+$/i, '')
  const lowerStem = stem.toLowerCase()
  const tokens = stem
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[\s_\-.()[\]]+/)
    .map((t) => t.toLowerCase())
    .filter(Boolean)
  const nameLike = tokens.filter(
    (t) => /^[a-z]+$/.test(t) && t.length >= 3 && !GENERIC_FILENAME_WORDS.has(t),
  )
  const severeJunk =
    /untitled/.test(lowerStem) ||
    /banget/.test(lowerStem) ||
    /^document\s*\(?\d*\)?$/.test(lowerStem.trim()) ||
    /^(scan|img|dsc|foto|photo)[\s_\-]?\d+$/.test(lowerStem.trim()) ||
    !/[a-z]/.test(lowerStem)
  if (severeJunk || nameLike.length === 0) {
    return {
      score2: 0,
      message:
        lang === 'en'
          ? `The file name "${base}" is too generic or looks like a random download or scan — it contains no applicant name or role. Recruiters receive dozens of files; a name like this is easy to mix up and looks unprepared. Change it to the pattern "CV_Name_Role.pdf", e.g. "CV_Budi_Santoso.pdf" or "BudiSantoso_DataAnalyst.pdf".`
          : `Nama file "${base}" terlalu generik atau terkesan asal unduh/scan — tidak ada nama pelamar atau posisi di dalamnya. Rekruter menerima puluhan file; nama seperti ini mudah tertukar dan terkesan tidak disiapkan. Ganti menjadi pola "CV_Nama_Posisi.pdf", mis. "CV_Budi_Santoso.pdf" atau "BudiSantoso_DataAnalyst.pdf".`,
    }
  }
  const filler = tokens.filter((t) =>
    ['final', 'revisi', 'fix', 'baru', 'terbaru', 'copy', 'salinan'].includes(t),
  )
  const repeatedLetter = tokens.some((t) => /(.)\1{2,}/.test(t))
  if (filler.length > 0 || repeatedLetter) {
    return {
      score2: 1,
      message:
        lang === 'en'
          ? `The file name "${base}" already includes your name/role, but it still looks like a draft (${filler.length > 0 ? `the word "${filler[0]}"` : 'repeated letters in one of the words'}). For a file sent to recruiters, remove the draft markers — e.g. just "CV_Name_Role.pdf" without "final/revision/fix".`
          : `Nama file "${base}" sudah memuat nama/posisimu, tetapi masih menyisakan kesan draf (${filler.length > 0 ? `kata "${filler[0]}"` : 'huruf berulang pada salah satu kata'}). Untuk berkas yang dikirim ke rekruter, buang penanda drafnya — mis. cukup "CV_Nama_Posisi.pdf" tanpa "final/revisi/fix".`,
    }
  }
  return {
    score2: 2,
    message:
      lang === 'en'
        ? `The file name "${base}" is already professional: it includes a clear name/role and is easy for recruiters to recognise among stacks of other applicants' files.`
        : `Nama file "${base}" sudah profesional: memuat nama/posisi yang jelas, mudah dikenali rekruter di antara tumpukan berkas pelamar lain.`,
  }
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
function assessProjects(text: string, formalEntryCount: number, lang: Lang = 'id'): ProjectAssessment {
  const section = getProjectSection(text)
  const lines = section ? section.split('\n').filter((l) => l.trim() !== '') : []
  const words = section ? countWords(section) : 0
  const substantive = lines.length >= 2 || words >= 15
  if (section && substantive) {
    return {
      score: 2,
      message:
        lang === 'en'
          ? `A project/internship/organisation section was found with its content described (${lines.length} lines). For recruiters, projects and internships with tasks and results described count as valid proof of experience — especially for fresh graduates who don't yet have formal jobs.`
          : `Bagian proyek/magang/organisasi ditemukan dengan uraian isi (${lines.length} baris). Bagi perekrut, proyek dan magang yang diuraikan tugas serta hasilnya adalah bukti pengalaman yang sah — terutama bagi fresh graduate yang belum punya pekerjaan formal.`,
    }
  }
  if (section) {
    return {
      score: 1,
      message:
        lang === 'en'
          ? 'A project/internship/organisation section was found, but its content is very brief (just titles). Describe your tasks, tools, and results in it so it reads as real experience, not just a list of activity names.'
          : 'Bagian proyek/magang/organisasi ditemukan, tetapi isinya sangat singkat (baru judul). Uraikan tugas, tools, dan hasilmu di dalamnya agar terbaca sebagai pengalaman betulan, bukan sekadar daftar nama kegiatan.',
    }
  }
  if (formalEntryCount >= 1) {
    return {
      score: 2,
      message:
        lang === 'en'
          ? 'There is no separate project/internship/organisation section, but your formal work experience is already listed as your main proof of experience — this check is neutral for you; projects would only be extra support if you have them.'
          : 'Tidak ada bagian proyek/magang/organisasi terpisah, tetapi pengalaman kerja formalmu sudah tercantum sebagai bukti pengalaman utama — pemeriksaan ini netral untukmu; proyek hanya menjadi penguat tambahan bila ada.',
    }
  }
  return {
    score: 0,
    message:
      lang === 'en'
        ? 'No formal work experience or project/internship/organisation section was found. For fresh graduates, coursework or school projects, internships, work placements, committee work, or organisation activities with their content described are your main proof of experience — add a "Projects" or "Internship" section covering your tasks and results.'
        : 'Tidak ditemukan pengalaman kerja formal maupun bagian proyek/magang/organisasi. Bagi fresh graduate, proyek kuliah/sekolah, magang, PKL, kepanitiaan, atau kegiatan organisasi yang diuraikan isinya adalah bukti pengalaman utama — tambahkan bagian "Proyek" atau "Magang" berisi tugas dan hasilmu.',
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

// ---------- Daftar posisi banyak (maksimal 3) ----------

// Plafon posisi yang dilamar dalam satu analisis (keputusan pengguna
// 2026-11-28): cukup untuk posisi-posisi yang berdekatan, dan menjaga
// rincian per posisi tetap terbaca. Penegakannya satu tempat di sini —
// pemilih di UI dan mesin memakai normalisasi yang sama.
export const MAX_TARGET_ROLES = 3

// Normalisasi daftar posisi mentah (dari pemilih UI atau opsi analisis):
// potong spasi tepi, buang yang kosong, buang duplikat (perbandingan
// tidak peka huruf besar/kecil dan spasi ganda; ejaan PERTAMA yang
// menang dan disimpan apa adanya), lalu potong ke MAX_TARGET_ROLES.
// Urutan pengguna dipertahankan — posisi pertama adalah posisi utama.
export function normalizeTargetRoles(input: readonly string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of input) {
    const role = (raw ?? '').trim()
    if (!role) continue
    const key = role.replace(/\s+/g, ' ').toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(role)
    if (out.length >= MAX_TARGET_ROLES) break
  }
  return out
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
  const lang: Lang = options.lang ?? 'id'
  const ASPECT = {
    contact: lang === 'en' ? 'Contact' : 'Kontak',
    summary: lang === 'en' ? 'Summary' : 'Ringkasan',
    experience: lang === 'en' ? 'Experience' : 'Pengalaman',
    education: lang === 'en' ? 'Education' : 'Pendidikan',
    skills: lang === 'en' ? 'Skills' : 'Keahlian',
    format: 'Format & ATS',
    jobMatch: lang === 'en' ? 'Job Match' : 'Kecocokan dengan Lowongan',
  }
  const text = rawText ?? ''
  const lower = text.toLowerCase()
  const totalWords = countWords(text)

  const summarySection = getSummarySection(text)
  const experienceSection = getExperienceSection(text)
  // Daftar posisi efektif: targetRoles (bila diberikan) dinormalisasi;
  // tanpa itu, targetRole tunggal diperlakukan sebagai daftar berisi
  // satu posisi — jalur lama persis. `role` = posisi utama (pertama),
  // dipakai bagian-bagian yang memang menyebut satu posisi.
  const roles = normalizeTargetRoles(options.targetRoles ?? [options.targetRole ?? ''])
  const role = roles[0] ?? ''
  // Pasangan posisi → kata bermaknanya, hanya untuk posisi yang punya
  // kata bermakna (posisi tanpa kata tidak bisa dinilai relevansinya
  // dan tidak ikut menentukan ada/tidaknya pemeriksaan kondisional).
  const scoredRoles = roles
    .map((r) => ({ role: r, words: getRoleWords(r) }))
    .filter((s) => s.words.length > 0)

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
  const emailScore = emailMatch ? 6 : 0

  // Profesionalitas email (pengetatan 2026-11-24): email yang formatnya
  // valid tetap bisa merusak kesan pertama bila alamatnya berkesan
  // panggilan/alay atau penuh deretan angka. Pemeriksaannya konservatif
  // (daftar kata kecil, per token utuh) — nama orang sungguhan lulus.
  const emailProfessional = emailMatch ? assessEmailProfessional(emailMatch, lang) : null
  const emailProfessionalScore = emailProfessional?.ok ? 2 : 0

  const phone = findPhone(text)
  const phoneScore = phone ? 5 : 0

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
      'email', ASPECT.contact, lang === 'en' ? 'Valid email' : 'Email valid', emailScore, 6,
      emailMatch
        ? lang === 'en'
          ? `Email found: ${emailMatch}`
          : `Email terbaca: ${emailMatch}`
        : lang === 'en'
          ? 'No email address found, or the format is invalid. Include a professional email address that you actively use.'
          : 'Alamat email tidak ditemukan atau formatnya tidak valid. Cantumkan email profesional yang aktif.',
    ),
    makeCheck(
      'email-profesional', ASPECT.contact, lang === 'en' ? 'Email professionalism' : 'Profesionalitas email', emailProfessionalScore, 2,
      !emailMatch
        ? lang === 'en'
          ? 'There is no email address yet whose professionalism can be assessed. Use an email based on your real name (e.g. your.name@gmail.com) — that address is the first thing a recruiter sees.'
          : 'Belum ada alamat email yang bisa dinilai profesionalitasnya. Cantumkan email dari nama aslimu (mis. nama.kamu@gmail.com) — alamat itulah yang dilihat rekruter pertama kali.'
        : emailProfessional?.ok
          ? lang === 'en'
            ? `The email address "${emailMatch}" looks professional: it is based on a name, with no nickname or slang words and no long run of numbers.`
            : `Alamat email "${emailMatch}" terkesan profesional: berbasis nama, tanpa kata panggilan/alay atau deretan angka yang panjang.`
          : lang === 'en'
            ? `The email address "${emailMatch}" reads as less than professional for a job application — found ${emailProfessional?.reason}. Recruiters see your email address before they read your CV; create an application-only address from your real name, e.g. your.name@gmail.com (a few digits for your birth year are still reasonable).`
            : `Alamat email "${emailMatch}" terbaca kurang profesional untuk lamaran — ditemukan ${emailProfessional?.reason}. Rekruter melihat alamat email sebelum membaca isi CV; buat alamat khusus melamar dari nama aslimu, mis. nama.kamu@gmail.com (sedikit angka tahun lahir masih wajar).`,
    ),
    makeCheck(
      'hp', ASPECT.contact, lang === 'en' ? 'Indonesian mobile number' : 'Nomor HP Indonesia', phoneScore, 5,
      phone
        ? lang === 'en'
          ? `Mobile number found: ${phone}`
          : `Nomor HP terbaca: ${phone}`
        : lang === 'en'
          ? 'No Indonesian mobile number found. Include an active number, for example 08xx or +62 8xx.'
          : 'Nomor HP Indonesia tidak ditemukan. Cantumkan nomor aktif, misalnya 08xx atau +62 8xx.',
    ),
    makeCheck(
      'linkedin', ASPECT.contact, 'LinkedIn', linkedinScore, 4,
      linkedinScore
        ? lang === 'en'
          ? 'A LinkedIn link is included.'
          : 'Tautan LinkedIn tercantum.'
        : lang === 'en'
          ? 'No LinkedIn link found. Include your LinkedIn profile URL so recruiters can easily verify your profile.'
          : 'Tautan LinkedIn tidak ditemukan. Cantumkan URL profil LinkedIn agar rekruter mudah memverifikasi profilmu.',
    ),
    makeCheck(
      'portofolio', ASPECT.contact, lang === 'en' ? 'Portfolio link' : 'Link portofolio', portfolioScore, 2,
      portfolioUrl
        ? lang === 'en'
          ? `Portfolio found: ${portfolioUrl}`
          : `Portofolio terbaca: ${portfolioUrl}`
        : lang === 'en'
          ? 'No portfolio link found. Include a GitHub, Behance, Kaggle, or personal portfolio website address (the word "portfolio" alone, without an address, does not count).'
          : 'Link portofolio tidak ditemukan. Cantumkan alamat GitHub, Behance, Kaggle, atau website portofolio pribadi (kata "portofolio" saja tanpa alamat tidak dihitung).',
    ),
    makeCheck(
      'lokasi', ASPECT.contact, lang === 'en' ? 'Location / domicile' : 'Lokasi domisili', locationScore, 1,
      location
        ? lang === 'en'
          ? `Location found: ${location}. Recruiters do filter candidates by location, so this information helps.`
          : `Domisili terbaca: ${location}. Perekrut memang menyaring kandidat berdasarkan domisili, jadi keterangan ini membantu.`
        : lang === 'en'
          ? 'No city of residence was found in the contact area. Include the city where you currently live (e.g. "Jakarta" or "Based in: Bandung") — many recruiters filter candidates by location before reading the rest of the CV.'
          : 'Kota domisili tidak ditemukan di area kontak. Cantumkan kota tempat tinggalmu saat ini (mis. "Jakarta" atau "Domisili: Bandung") — banyak rekruter menyaring kandidat berdasarkan domisili sebelum membaca isi CV.',
    ),
  ]

  // ===== RINGKASAN (maks 10) =====
  // Bila posisi target diisi DAN punya kata bermakna, aspek ini dipecah:
  // ringkasan (maks 7) + relevansi ringkasan terhadap posisi target (maks 3).
  const summaryWords = summarySection ? countWords(summarySection) : 0
  const hasRole = scoredRoles.length > 0

  const summaryScoreFull =
    summaryWords >= 40 ? 10 : summaryWords >= 20 ? 7 : summaryWords >= 8 ? 4 : summaryWords >= 1 ? 2 : 0
  const summaryScoreSplit =
    summaryWords >= 40 ? 7 : summaryWords >= 20 ? 5 : summaryWords >= 8 ? 3 : summaryWords >= 1 ? 1 : 0
  const summaryMessage =
    summaryWords === 0
      ? lang === 'en'
        ? 'No summary/profile section was found. Add a summary of 40 words or more that explains your main skills and achievements.'
        : 'Bagian ringkasan/profil tidak ditemukan. Tambahkan ringkasan 40 kata atau lebih yang menjelaskan keahlian dan pencapaian utamamu.'
      : lang === 'en'
        ? `Your summary is ${summaryWords} words. ${summaryWords >= 40 ? 'Its length is already ideal.' : 'Ideally it should be 40 words or more, enough to explain what you offer.'}`
        : `Ringkasan berisi ${summaryWords} kata. ${summaryWords >= 40 ? 'Panjangnya sudah ideal.' : 'Idealnya 40 kata atau lebih agar cukup menjelaskan nilai jualmu.'}`

  const ringkasanChecks: CheckItem[] = [
    makeCheck(
      'ringkasan', ASPECT.summary, lang === 'en' ? 'Professional summary' : 'Ringkasan profesional',
      hasRole ? summaryScoreSplit : summaryScoreFull, hasRole ? 7 : 10,
      summaryMessage,
    ),
  ]

  // Penilaian relevansi ringkasan untuk SATU posisi — logika skor dan
  // teks pesannya persis jalur lama. Pemakaian banyak posisi menilai
  // tiap posisi dengan penilai ini lalu memakai hasil TERBAIKNYA
  // (seri dimenangkan posisi yang lebih dulu dipilih pengguna), dan
  // posisi pemenangnya dicatat sebagai peran penentu pemeriksaan ini.
  const evalSummaryRelevance = (
    r: string,
    words: string[],
  ): { score: number; message: string } => {
    const summaryLower = summarySection.toLowerCase()
    const headWord = words[0]
    const score = !summarySection
      ? 0
      : summaryLower.includes(headWord)
        ? 3
        : words.some((w) => summaryLower.includes(w))
          ? 2
          : 0
    const message = !summarySection
      ? lang === 'en'
        ? `The target role "${r}" cannot be assessed from your summary because there is no summary section yet. Write a summary that mentions the field/role you are aiming for.`
        : `Posisi target "${r}" belum bisa dinilai dari ringkasan karena bagian ringkasan belum ada. Tulis ringkasan yang menyebut bidang/posisi yang kamu tuju.`
      : score === 3
        ? lang === 'en'
          ? `Your summary mentions the field/role you are aiming for ("${headWord}"), matching the target role "${r}".`
          : `Ringkasan menyebut bidang/posisi yang dituju ("${headWord}") sesuai posisi target "${r}".`
        : score === 2
          ? lang === 'en'
            ? `Your summary mentions some words from the target role "${r}", but its main word ("${headWord}") has not appeared yet. Mention the role/field you are aiming for explicitly in your summary.`
            : `Ringkasan menyebut sebagian kata dari posisi target "${r}", tetapi kata utamanya ("${headWord}") belum muncul. Sebutkan posisi/bidang yang dituju secara eksplisit di ringkasan.`
          : lang === 'en'
            ? `Your summary does not mention the role/field "${r}" you are aiming for at all. Adjust the first sentence of your summary to the target role so recruiters see the relevance right away.`
            : `Ringkasan sama sekali tidak menyebut posisi/bidang "${r}" yang kamu tuju. Sesuaikan kalimat pertama ringkasan dengan posisi target agar rekruter langsung melihat relevansinya.`
    return { score, message }
  }

  let summaryWinner: { role: string; score: number; message: string } | null = null
  if (hasRole) {
    for (const s of scoredRoles) {
      const ev = evalSummaryRelevance(s.role, s.words)
      if (!summaryWinner || ev.score > summaryWinner.score) {
        summaryWinner = { role: s.role, score: ev.score, message: ev.message }
      }
    }
    if (summaryWinner) {
      ringkasanChecks.push(
        makeCheck(
          'relevansi-ringkasan', ASPECT.summary, lang === 'en' ? 'Summary relevance to the target role' : 'Relevansi ringkasan dengan posisi target',
          summaryWinner.score, 3,
          summaryWinner.message,
        ),
      )
    }
  }

  // ===== PENGALAMAN (maks 28) =====
  // Bobot di dalam aspek ini dibagi ulang (2026-11-21) untuk memberi
  // ruang bagi dimensi baru — linimasa, proyek/magang, dan (bila posisi
  // target diisi) relevansi pengalaman. Ambang/syarat pemeriksaan lama
  // TIDAK berubah; hanya nilai poinnya diskalakan ke maks barunya.
  // Dibagi ulang lagi 2026-11-24 untuk dua dimensi baru — kestabilan
  // karier (job hopping + tumpang tindih) dan konsistensi klaim lama
  // pengalaman: heading 5→4, hasil terukur 6/5→5/4, kedalaman 4→3,
  // frasa 3→2; ambang pemeriksaan lama tetap tidak berubah.
  // Tanpa peran: heading 4, kata kerja 5, hasil terukur 5, kedalaman 3,
  // frasa 2, linimasa 3, kestabilan 2, konsistensi klaim 2, proyek 2 = 28.
  // Dengan peran: kata kerja 4, hasil terukur 4, linimasa 2, dan
  // relevansi pengalaman 3 menggantikan selisihnya = tetap 28.
  const verbMax = hasRole ? 4 : 5
  const measurableMax = hasRole ? 4 : 5
  const linimasaMax = hasRole ? 2 : 3

  // Sumber tunggal keberadaan bagian pengalaman: ekstraktor bagian
  // terstruktur yang sama yang dipakai kedalaman entri, linimasa,
  // kestabilan, dan relevansi. Versi lama memakai regex kata longgar
  // atas seluruh teks, sehingga CV yang hanya MENYEBUT kata
  // "pengalaman" (mis. di ringkasan) tanpa bagian terstruktur tampil
  // sebagai "Bagian pengalaman kerja ditemukan" di Kekuatan sekaligus
  // "Bagian pengalaman tidak ditemukan" di Prioritas — dua pesan
  // bertentangan untuk fakta yang sama (ulasan eksternal 2026-11-28).
  const hasExperienceHeading = experienceSection.trim() !== ''
  const experienceHeadingScore = hasExperienceHeading ? 4 : 0

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
    depthScore = ratio >= 1 ? 3 : ratio >= 0.5 ? 2 : completeEntries >= 1 ? 1 : 0
  }
  const depthMessage = !experienceSection
    ? lang === 'en'
      ? 'No experience section was found, so entry depth cannot be assessed yet. Create an "Experience" section with one entry per job.'
      : 'Bagian pengalaman tidak ditemukan, jadi kedalaman entri belum bisa dinilai. Buat bagian "Pengalaman" dengan satu entri per pekerjaan.'
    : expBlocks.length === 0
      ? lang === 'en'
        ? 'No experience entries with a readable structure were found (a job title/company line that includes a period). Write each job as a heading line, for example "Cashier — Toko Berkah (2022–2024)", then describe it underneath.'
        : 'Tidak ditemukan entri pengalaman yang terbaca strukturnya (baris jabatan/perusahaan yang memuat periode). Tulis tiap pekerjaan sebagai baris judul, misalnya "Kasir — Toko Berkah (2022–2024)", lalu uraikan isinya di bawahnya.'
      : lang === 'en'
        ? `Found ${expBlocks.length} experience entries. ${completeEntries} complete entries (title + company + period + description)${shallowEntries > 0 ? `; ${shallowEntries} entries contain only a title/period with no description` : ''}. ${depthScore >= 5 ? 'The depth of the entries is already good.' : 'Each entry should ideally include a job title, company name, period, and a description of achievements — an entry with only a title looks empty to recruiters.'}`
        : `Ditemukan ${expBlocks.length} entri pengalaman. ${completeEntries} entri lengkap (jabatan + perusahaan + periode + uraian isi)${shallowEntries > 0 ? `; ${shallowEntries} entri hanya berisi judul/periode tanpa uraian isi` : ''}. ${depthScore >= 5 ? 'Kedalaman entrinya sudah baik.' : 'Setiap entri idealnya memuat jabatan, nama perusahaan, periode, dan uraian pencapaian — entri yang hanya berisi judul terlihat kosong bagi rekruter.'}`

  // Frasa lemah & klise: hanya dinilai bila ada isi ringkasan/pengalaman;
  // CV tanpa kedua bagian itu tidak mendapat poin dari ketiadaan frasa.
  const weakPhrases = findWeakPhrases(lower)
  const hasNarrative = summarySection.trim() !== '' || experienceSection.trim() !== ''
  const weakPhraseScore3 = !hasNarrative
    ? 0
    : weakPhrases.length === 0
      ? 3
      : weakPhrases.length === 1
        ? 2
        : weakPhrases.length === 2
          ? 1
          : 0
  // Ambang jumlah frasa tidak berubah; skor diskalakan ke maks baru 2
  // (2026-11-24) dengan pola penskalaan yang sama seperti linimasa.
  const weakPhraseScore = Math.round((weakPhraseScore3 * 2) / 3)
  const weakPhraseMessage = !hasNarrative
    ? lang === 'en'
      ? 'There is no summary/experience section yet whose phrasing can be assessed. Write both sections in concrete, evidence-based sentences.'
      : 'Belum ada bagian ringkasan/pengalaman yang bisa dinilai frasanya. Tulis kedua bagian itu dengan kalimat konkret berbasis bukti.'
    : weakPhrases.length === 0
      ? lang === 'en'
        ? 'No common cliché phrases (e.g. "hard worker", "responsible for") were found in the CV.'
        : 'Tidak ditemukan frasa klise yang umum (mis. "pekerja keras", "bertanggung jawab atas") di dalam CV.'
      : lang === 'en'
        ? `Found ${weakPhrases.length} generic phrases with no evidence behind them: ${weakPhrases.map((p) => `"${p}"`).join(', ')}. Phrases like these are claimed by almost every applicant, so they don't set you apart — replace them with concrete evidence (numbers, results, examples of work).`
        : `Ditemukan ${weakPhrases.length} frasa generik tanpa bukti: ${weakPhrases.map((p) => `"${p}"`).join(', ')}. Frasa seperti ini diklaim hampir semua pelamar sehingga tidak membedakanmu — ganti dengan bukti konkret (angka, hasil, contoh pekerjaan).`

  // Linimasa pengalaman: kesenjangan panjang antar-entri dan kebaruan
  // peran terakhir, dinilai dari periode yang terbaca per entri.
  const currentYear = new Date().getFullYear()
  const timeline = assessTimeline(expBlocks, currentYear, lang)
  const linimasaScore =
    linimasaMax === 3 ? timeline.score3 : Math.round((timeline.score3 * linimasaMax) / 3)

  // Kestabilan karier (2026-11-24): job hopping + tumpang tindih
  // periode dalam satu pemeriksaan, dari fakta linimasa yang sama.
  const stability = assessCareerStability(expBlocks, currentYear, lang)

  // Konsistensi klaim lama pengalaman (2026-11-24): klaim "X tahun
  // pengalaman" di teks dicocokkan dengan total durasi nyata linimasa.
  // Penjaga teks kosong (pola audit 2026-11-24 yang sama seperti
  // panjang & kerapian): teks 0 kata tidak menerima poin netral —
  // belum ada CV apa pun yang bisa dinilai netral.
  const claimConsistency = assessClaimConsistency(text, expBlocks, currentYear, lang)
  const claimScore = totalWords === 0 ? 0 : claimConsistency.score2

  // Proyek/magang/organisasi sebagai bukti pengalaman (fresh graduate).
  const projectAssessment = assessProjects(text, expBlocks.length, lang)

  const pengalamanChecks = [
    makeCheck(
      'pengalaman-heading', ASPECT.experience, lang === 'en' ? 'Work experience section' : 'Bagian pengalaman kerja', experienceHeadingScore, 4,
      hasExperienceHeading
        ? lang === 'en'
          ? 'A work experience section was found.'
          : 'Bagian pengalaman kerja ditemukan.'
        : lang === 'en'
          ? 'No work experience section was found. Create an "Experience" section containing your work history.'
          : 'Bagian pengalaman kerja tidak ditemukan. Buat bagian "Pengalaman" yang berisi riwayat pekerjaanmu.',
    ),
    makeCheck(
      'kata-kerja-aksi', ASPECT.experience, lang === 'en' ? 'Action verbs' : 'Kata kerja aksi', verbScore, verbMax,
      lang === 'en'
        ? `Found ${verbCount} different action verbs (e.g. increased, managed, built). ${verbCount >= 5 ? 'They are already varied.' : 'Use at least 5 different action verbs to show your active role.'}`
        : `Ditemukan ${verbCount} kata kerja aksi berbeda (mis. meningkatkan, mengelola, membangun). ${verbCount >= 5 ? 'Sudah bervariasi.' : 'Gunakan minimal 5 kata kerja aksi berbeda untuk menunjukkan peran aktifmu.'}`,
    ),
    makeCheck(
      'hasil-terukur', ASPECT.experience, lang === 'en' ? 'Measurable results (achievement numbers)' : 'Hasil terukur (angka pencapaian)', measurableScore, measurableMax,
      lang === 'en'
        ? `Found ${measurableCount} achievement numbers (percentages, counts, or amounts — years and phone numbers are not counted). ${measurableCount >= 3 ? 'Already convincing.' : 'Add measurable results, for example "increased sales by 30%" or "managed 15 people".'}`
        : `Ditemukan ${measurableCount} angka pencapaian (persen, jumlah, atau nominal — tahun dan nomor HP tidak dihitung). ${measurableCount >= 3 ? 'Sudah meyakinkan.' : 'Tambahkan hasil terukur, misalnya "meningkatkan penjualan 30%" atau "mengelola 15 orang".'}`,
    ),
    makeCheck(
      'kedalaman-entri', ASPECT.experience, lang === 'en' ? 'Experience entry depth' : 'Kedalaman entri pengalaman', depthScore, 3,
      depthMessage,
    ),
    makeCheck(
      'frasa-lemah', ASPECT.experience, lang === 'en' ? 'Weak phrases & clichés' : 'Frasa lemah & klise', weakPhraseScore, 2,
      weakPhraseMessage,
    ),
    makeCheck(
      'linimasa', ASPECT.experience, lang === 'en' ? 'Experience timeline' : 'Linimasa pengalaman', linimasaScore, linimasaMax,
      timeline.message,
    ),
    makeCheck(
      'kestabilan-karier', ASPECT.experience, lang === 'en' ? 'Career stability (job hopping & overlaps)' : 'Kestabilan karier (job hopping & tumpang tindih)',
      stability.score2, 2,
      stability.message,
    ),
    makeCheck(
      'konsistensi-klaim', ASPECT.experience, lang === 'en' ? 'Experience claim consistency' : 'Konsistensi klaim pengalaman',
      claimScore, 2,
      claimConsistency.message,
    ),
    makeCheck(
      'proyek', ASPECT.experience, lang === 'en' ? 'Projects / internships as proof of experience' : 'Proyek / magang sebagai bukti pengalaman', projectAssessment.score, 2,
      projectAssessment.message,
    ),
  ]

  // Relevansi pengalaman terhadap posisi target (kondisional): jabatan
  // dan isi pengalaman dinilai keterkaitannya dengan bidang posisi yang
  // dituju — bukan hanya ringkasannya.
  // Penilaian relevansi pengalaman untuk SATU posisi — logika skor
  // dan teks pesannya persis jalur lama; teks bagian & judul dihitung
  // sekali di luar penilai karena tidak bergantung posisi. Pemakaian
  // banyak posisi memakai hasil TERBAIK di antara posisi-posisi itu
  // (seri dimenangkan posisi yang lebih dulu dipilih), dan posisi
  // pemenangnya dicatat sebagai peran penentu pemeriksaan ini.
  const expLower = experienceSection.toLowerCase()
  const titleText = experienceSection
    .split('\n')
    .filter((l) => !BULLET_LINE.test(l))
    .join(' ')
    .toLowerCase()
  const evalExperienceRelevance = (
    r: string,
    words: string[],
  ): { score: number; message: string } => {
    const titleHits = words.filter((w) => titleText.includes(w))
    const sectionHits = words.filter((w) => expLower.includes(w))
    const missingWords = words.filter((w) => !expLower.includes(w))
    const score = !experienceSection
      ? 0
      : titleHits.length > 0
        ? 3
        : sectionHits.length === words.length && words.length > 0
          ? 2
          : sectionHits.length > 0
            ? 1
            : 0
    const message = !experienceSection
      ? lang === 'en'
        ? `The relevance of the target role "${r}" cannot be assessed because there is no experience section yet. Experience (including internships and projects) related to the field of the role you are aiming for is the strongest evidence for recruiters.`
        : `Posisi target "${r}" belum bisa dinilai relevansinya karena bagian pengalaman belum ada. Pengalaman (termasuk magang dan proyek) yang berkaitan dengan bidang posisi yang dituju adalah bukti terkuat bagi rekruter.`
      : score === 3
        ? lang === 'en'
          ? `Job titles in your experience mention keywords from the target role "${r}" (${titleHits.map((w) => `"${w}"`).join(', ')}) — the relevance is immediately visible to recruiters.`
          : `Jabatan di pengalamanmu menyebut kata kunci posisi target "${r}" (${titleHits.map((w) => `"${w}"`).join(', ')}) — relevansinya langsung terlihat oleh rekruter.`
        : score === 2
          ? lang === 'en'
            ? `The content of your experience mentions all the keywords from the target role "${r}" (${sectionHits.map((w) => `"${w}"`).join(', ')}), but they have not appeared in a job title yet. If it fits, mention that field in the title of your experience entry.`
            : `Isi pengalamanmu menyebut semua kata kunci posisi target "${r}" (${sectionHits.map((w) => `"${w}"`).join(', ')}), tetapi belum muncul di judul jabatan. Bila memang sesuai, sebutkan bidang itu di judul entri pengalamanmu.`
          : score === 1
            ? lang === 'en'
              ? `Your experience only mentions some keywords from the target role "${r}" (${sectionHits.map((w) => `"${w}"`).join(', ')}); not yet found: ${missingWords.map((w) => `"${w}"`).join(', ')}. Highlight the tasks and results most related to the field you are aiming for.`
              : `Pengalamanmu baru menyebut sebagian kata kunci posisi target "${r}" (${sectionHits.map((w) => `"${w}"`).join(', ')}); yang belum terbaca: ${missingWords.map((w) => `"${w}"`).join(', ')}. Tonjolkan tugas dan hasil yang paling berkaitan dengan bidang yang dituju.`
            : lang === 'en'
              ? `Your experience does not mention any keywords from the target role "${r}" (${words.map((w) => `"${w}"`).join(', ')}). If you have related tasks or projects, highlight them; if you are changing fields, explain the bridge in your summary (courses, personal projects, internships).`
              : `Pengalamanmu tidak menyebut satu pun kata kunci posisi target "${r}" (${words.map((w) => `"${w}"`).join(', ')}). Bila ada tugas/proyek yang berkaitan, tonjolkan; bila memang berpindah bidang, jelaskan jembatannya di ringkasan (kursus, proyek pribadi, magang).`
    return { score, message }
  }

  let experienceWinner: { role: string; score: number; message: string } | null = null
  if (hasRole) {
    for (const s of scoredRoles) {
      const ev = evalExperienceRelevance(s.role, s.words)
      if (!experienceWinner || ev.score > experienceWinner.score) {
        experienceWinner = { role: s.role, score: ev.score, message: ev.message }
      }
    }
    if (experienceWinner) {
      pengalamanChecks.push(
        makeCheck(
          'relevansi-pengalaman', ASPECT.experience, lang === 'en' ? 'Experience relevance to the target role' : 'Relevansi pengalaman dengan posisi target',
          experienceWinner.score, 3,
          experienceWinner.message,
        ),
      )
    }
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
      'pendidikan', ASPECT.education, lang === 'en' ? 'Education listed' : 'Pendidikan tercantum', educationScore, 6,
      hasEducation
        ? lang === 'en' ? 'Education information was found.' : 'Informasi pendidikan ditemukan.'
        : lang === 'en' ? 'No education information found. Include your highest level of education and the name of the institution.' : 'Informasi pendidikan tidak ditemukan. Cantumkan jenjang pendidikan terakhir dan nama institusinya.',
    ),
    makeCheck(
      'ipk', ASPECT.education, 'IPK / GPA', gpaScore, 3,
      hasGpa
        ? lang === 'en' ? 'Your GPA is included.' : 'IPK/GPA tercantum.'
        : lang === 'en' ? 'No GPA is included. If your GPA is good (e.g. above 3.00), include it to strengthen your profile.' : 'IPK/GPA tidak tercantum. Jika IPK-mu baik (mis. di atas 3,00), cantumkan untuk memperkuat profil.',
    ),
    makeCheck(
      'sertifikasi', ASPECT.education, lang === 'en' ? 'Certifications & training' : 'Sertifikasi & pelatihan', certScore, 3,
      certItems.length >= 1
        ? lang === 'en'
          ? `A certifications/training section was found with ${certItems.length} items. Relevant certifications strengthen your credibility beyond formal education.`
          : `Bagian sertifikasi/pelatihan ditemukan dengan ${certItems.length} item. Sertifikasi yang relevan memperkuat kredibilitas di luar pendidikan formal.`
        : certMentioned
          ? lang === 'en'
            ? 'Certificates/certifications are mentioned in the CV, but they are not a separate section yet. Create a "Certifications & Training" section so recruiters and ATS systems can find them easily.'
            : 'Ada sebutan sertifikat/sertifikasi di dalam CV, tetapi belum menjadi bagian tersendiri. Buat bagian "Sertifikasi & Pelatihan" agar mudah ditemukan rekruter dan ATS.'
          : lang === 'en'
            ? 'No certifications/training section was found. If you have relevant course certificates, training, or licences, list them in their own section — they add value beyond formal education.'
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
      'keahlian', ASPECT.skills, lang === 'en' ? 'Skills list' : 'Daftar keahlian / skill', skillScore, 8,
      skillCount === 0
        ? lang === 'en'
          ? 'No skills section was found. Create a "Skills" section and list at least 8 relevant skills, separated by commas.'
          : 'Bagian keahlian tidak ditemukan. Buat bagian "Keahlian" dan daftarkan minimal 8 skill yang relevan, pisahkan dengan koma.'
        : lang === 'en'
          ? `Found ${skillCount} skill items. ${skillCount >= 8 ? 'That is enough.' : 'Ideally list at least 8 skills relevant to the role you are applying for.'}`
          : `Ditemukan ${skillCount} item keahlian. ${skillCount >= 8 ? 'Jumlahnya sudah cukup.' : 'Idealnya cantumkan minimal 8 skill yang relevan dengan posisi yang dilamar.'}`,
    ),
    makeCheck(
      'bahasa', ASPECT.skills, lang === 'en' ? 'Foreign languages' : 'Bahasa asing', langScore, 2,
      langItems.length >= 1
        ? lang === 'en'
          ? `A languages section was found (${langItems.slice(0, 3).join(', ')}${langItems.length > 3 ? ', …' : ''}). Foreign language skills are a plus that companies often look for.`
          : `Bagian bahasa ditemukan (${langItems.slice(0, 3).join(', ')}${langItems.length > 3 ? ', …' : ''}). Kemampuan bahasa asing adalah nilai tambah yang sering dicari perusahaan.`
        : langMentioned
          ? lang === 'en'
            ? 'Foreign language skills are mentioned in the CV, but they are not a separate section or note yet. Put them in a "Languages" section with your proficiency level (e.g. English — fluent, TOEFL 550).'
            : 'Kemampuan bahasa asing disebut di dalam CV, tetapi belum menjadi bagian/keterangan tersendiri. Tulis di bagian "Bahasa" beserta tingkat kemahirannya (mis. Bahasa Inggris — aktif, TOEFL 550).'
          : lang === 'en'
            ? 'No foreign language skills are listed. If you speak a foreign language (e.g. English), include it with your proficiency level — many vacancies treat it as a plus or a requirement.'
            : 'Kemampuan bahasa asing tidak tercantum. Bila kamu menguasai bahasa asing (mis. Bahasa Inggris), cantumkan beserta tingkat kemahirannya — banyak lowongan menjadikannya nilai tambah atau syarat.',
    ),
  ]

  // ===== FORMAT & ATS (maks 20) =====
  // Penjaga CV naratif tanpa bagian — VERSI LUAS (keputusan pengguna
  // 2026-11-24; audit 2026-11-24 awalnya memasang versi sempit hanya
  // untuk teks kosong persis karena versi luas menggerakkan patokan,
  // dan pengguna kini menyetujui pergeseran itu: CV lemah 16 → 14).
  // Teks yang tidak memiliki SATU PUN bagian terstruktur tidak
  // memperoleh poin cuma-cuma dari panjang & kerapian: poin dasar
  // skala panjang mensyaratkan dokumen CV yang bisa dinilai
  // panjangnya, dan poin "saya wajar" pada kerapian mensyaratkan
  // bagian pengalaman sebagai bukti — keduanya tidak ada pada teks
  // naratif tanpa bagian (pola yang sama dengan penjaga frasa-lemah:
  // poin tidak diberikan dari ketiadaan bukti).
  const hasAnySection =
    summarySection.trim() !== '' ||
    experienceSection.trim() !== '' ||
    educationSection.trim() !== '' ||
    certSection.trim() !== '' ||
    getSection(text, SKILL_HEADINGS).trim() !== '' ||
    getSection(text, ['bahasa', 'language', 'languages']).trim() !== '' ||
    getProjectSection(text).trim() !== ''
  // Teks kosong (0 kata) atau tanpa satu pun bagian terstruktur tidak
  // mendapat poin panjang sama sekali — cabang akhir skala (1 poin)
  // hanya untuk CV terstruktur yang panjangnya di luar rentang berskor
  // (audit 2026-11-24: CV kosong sebelumnya tetap menerima 1 poin
  // panjang + 2 poin kerapian = total 3).
  const lengthScore8 =
    totalWords === 0 || !hasAnySection
      ? 0
      : totalWords >= 220 && totalWords <= 900
        ? 8
        : (totalWords >= 130 && totalWords <= 219) || (totalWords >= 901 && totalWords <= 1100)
          ? 5
          : totalWords >= 60 && totalWords <= 129
            ? 2
            : 1
  // Rentang kata ideal tidak berubah; skor diskalakan ke maks baru 7
  // (2026-11-24) untuk memberi ruang bagi pemeriksaan nama file.
  const lengthScore = Math.round((lengthScore8 * 7) / 8)
  const hasYears = /\b(19|20)\d{2}\b/.test(text)
  const yearsScore = hasYears ? 3 : 0

  // Nama file CV (2026-11-24): hanya dinilai bila pengguna mengunggah
  // berkas (options.fileName terisi); teks tempel → netral penuh.
  // Penjaga teks kosong yang sama seperti pemeriksaan netral lainnya:
  // teks 0 kata tidak menerima poin netral.
  const fileNameAssessment = assessFileName(options.fileName ?? '', lang)
  const fileNameScore = totalWords === 0 ? 0 : fileNameAssessment.score2
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
  const PERIOD_LABEL = lang === 'en' ? PERIOD_FAMILY_LABEL_EN : PERIOD_FAMILY_LABEL
  if (periodExprs.length === 0) {
    consistencyScore = 0
    consistencyMessage =
      lang === 'en'
        ? 'No period with a readable format (year range, month–year, or numeric) was found yet, so format consistency cannot be assessed. Write each entry\'s period in one consistent format.'
        : 'Belum ada periode yang terbaca formatnya (rentang tahun, bulan–tahun, atau angka), jadi konsistensi format belum bisa dinilai. Tulis periode tiap entri dengan satu format yang sama.'
  } else if (periodExprs.length === 1) {
    consistencyScore = 2
    consistencyMessage =
      lang === 'en'
        ? `Only one period was found ("${periodExprs[0].raw}"), so format consistency and chronological order cannot be fully assessed yet. Make sure all entries use the same period format and are ordered from the most recent.`
        : `Baru satu periode terbaca ("${periodExprs[0].raw}"), jadi konsistensi format dan urutan kronologis belum bisa dinilai penuh. Pastikan semua entri memakai format periode yang sama dan diurutkan dari yang terbaru.`
  } else {
    const familyScore = families.size === 1 ? 2 : 0
    const chronoScore = entryYears.length < 2 || isReverseChrono ? 1 : 0
    consistencyScore = familyScore + chronoScore
    const parts: string[] = []
    if (families.size === 1) {
      parts.push(
        lang === 'en'
          ? `The period format is consistent, using the ${PERIOD_LABEL[periodExprs[0].family]} style throughout the CV.`
          : `Format periode konsisten memakai gaya ${PERIOD_LABEL[periodExprs[0].family]} di seluruh CV.`,
      )
    } else {
      const examples = [...families]
        .map((f) => {
          const ex = periodExprs.find((e) => e.family === f)
          return `${PERIOD_LABEL[f]} ("${ex?.raw}")`
        })
        .join(lang === 'en' ? ' and ' : ' dan ')
      parts.push(
        lang === 'en'
          ? `Period formats are mixed: found the ${examples} styles. Pick ONE format for all entries so your CV looks tidy and professional.`
          : `Format penulisan periode campur aduk: ditemukan gaya ${examples}. Pilih SATU format untuk semua entri agar CV terlihat rapi dan profesional.`,
      )
    }
    if (entryYears.length >= 2) {
      parts.push(
        isReverseChrono
          ? lang === 'en'
            ? 'Experience entries are already ordered from the most recent.'
            : 'Urutan entri pengalaman sudah dari yang terbaru.'
          : lang === 'en'
            ? `Experience entries are not yet ordered from the most recent (start years found: ${entryYears.join(', ')}). Recruiters read from your latest experience — order entries by the newest start year first.`
            : `Urutan entri pengalaman belum dari yang terbaru (tahun mulai yang terbaca: ${entryYears.join(', ')}). Rekruter membaca dari pengalaman terakhir — urutkan entri dari tahun mulai paling baru.`,
      )
    }
    consistencyMessage = parts.join(' ')
  }

  // Kerapian bahasa: kata ganti orang pertama berlebihan ("saya", atau
  // "I" untuk CV dominan bahasa Inggris) di bagian pengalaman + kata
  // yang sering salah eja. Ini pemeriksaan dasar dari daftar kecil,
  // bukan pemeriksaan tata bahasa menyeluruh.
  const typos = findTypos(lower)
  // Jumlah kata "saya" diambil dari penemu kemunculan bersama di atas.
  const sayaCount = findSayaOccurrences(text).length
  const sayaOverused = sayaCount >= SAYA_OVERUSE_THRESHOLD
  // Padanan Inggrisnya: kata ganti "I" berlebihan, hanya untuk teks
  // dominan bahasa Inggris dan dengan penjaga anti-angka-Romawi pada
  // penemunya (lihat findFirstPersonIOccurrences). Ambang yang sama.
  const iCount = findFirstPersonIOccurrences(text).length
  const iOverused = iCount >= SAYA_OVERUSE_THRESHOLD
  const pronounOverused = sayaOverused || iOverused
  // Teks yang benar-benar kosong (0 kata) tidak bisa dinilai kerapiannya —
  // jangan beri nilai penuh yang lalu tampil sebagai "kekuatan" (audit
  // 2026-11-24: CV kosong sebelumnya menerima total 3 dari panjang +
  // kerapian). Penjaga versi luas (keputusan pengguna 2026-11-24): CV
  // tanpa satu pun bagian terstruktur juga tidak menerima poin
  // kerapian penuh — komponen "saya" (1 poin) dinilai dari bagian
  // pengalaman, dan tanpa bagian itu poinnya tidak bisa diperoleh dari
  // ketiadaan bukti; komponen salah eja (1 poin) tetap dinilai dari
  // seluruh teks karena buktinya memang ada di teks.
  const neatnessScore =
    totalWords === 0
      ? 0
      : !hasAnySection
        ? typos.length > 0
          ? 0
          : 1
        : Math.max(0, 2 - (typos.length > 0 ? 1 : 0) - (pronounOverused ? 1 : 0))
  const neatnessParts: string[] = []
  if (typos.length > 0) {
    neatnessParts.push(
      lang === 'en'
        ? `Found commonly misspelled words: ${typos
            .slice(0, 4)
            .map((t) => `"${t.wrong}" (correct: "${t.right}")`)
            .join(', ')}. Check your spelling again before sending your CV.`
        : `Ditemukan kata yang sering salah eja: ${typos
            .slice(0, 4)
            .map((t) => `"${t.wrong}" (baku: "${t.right}")`)
            .join(', ')}. Periksa kembali ejaan sebelum mengirim CV.`,
    )
  }
  if (sayaOverused) {
    neatnessParts.push(
      lang === 'en'
        ? `The word "saya" appears ${sayaCount} times in the experience section. Professional experience bullet points usually start directly with a verb, without a first-person pronoun.`
        : `Kata "saya" muncul ${sayaCount} kali di bagian pengalaman. Poin pengalaman yang profesional biasanya langsung diawali kata kerja tanpa kata ganti orang pertama.`,
    )
  }
  if (iOverused) {
    neatnessParts.push(
      lang === 'en'
        ? `The first-person pronoun "I" appears ${iCount} times in the experience section. Professional experience bullet points usually start directly with a verb, without a first-person pronoun.`
        : `Kata ganti orang pertama "I" muncul ${iCount} kali di bagian pengalaman. Poin pengalaman yang profesional biasanya langsung diawali kata kerja tanpa kata ganti orang pertama.`,
    )
  }
  const neatnessMessage =
    totalWords === 0
      ? lang === 'en'
        ? 'There is no text yet whose tidiness can be assessed. Write your CV content first — language tidiness is assessed from that text.'
        : 'Belum ada teks yang bisa dinilai kerapiannya. Tulis isi CV dulu — kerapian bahasa dinilai dari teks tersebut.'
      : !hasAnySection
        ? [
            lang === 'en'
              ? 'This CV has no structured sections at all, so the use of the pronoun "saya" in an experience section cannot be assessed and full tidiness points are not given for text without sections. Organise your CV into Summary, Experience, Education, and Skills sections so its tidiness can be fully assessed.'
              : 'CV ini tidak memiliki satu pun bagian terstruktur, sehingga pemakaian kata ganti "saya" di bagian pengalaman tidak bisa dinilai dan poin kerapian penuh tidak diberikan untuk teks tanpa bagian. Susun CV ke dalam bagian Ringkasan, Pengalaman, Pendidikan, dan Keahlian agar kerapiannya bisa dinilai sepenuhnya.',
            ...neatnessParts,
          ].join(' ')
        : neatnessParts.length > 0
          ? neatnessParts.join(' ')
          : lang === 'en'
            ? 'No commonly misspelled words from the basic checklist were found, and the use of the pronoun "saya" in the experience section is still reasonable. (This check only flags examples from a small list of commonly misspelled words — it is not a full grammar check.)'
            : 'Tidak ditemukan kata yang sering salah eja dari daftar periksa dasar, dan pemakaian kata ganti "saya" di bagian pengalaman masih wajar. (Pemeriksaan ini hanya menandai contoh dari daftar kecil kata yang sering salah eja — bukan pemeriksaan tata bahasa menyeluruh.)'

  const formatChecks = [
    makeCheck(
      'panjang', ASPECT.format, lang === 'en' ? 'CV length' : 'Panjang CV', lengthScore, 7,
      totalWords > 0 && !hasAnySection
        ? lang === 'en'
          ? `Your CV is ${totalWords} words, but it has no structured sections at all (Summary, Experience, Education, Skills), so its length is not yet assessed as a CV document. Organise your CV into those sections first — the ideal range for a structured CV is 220–900 words (about 1–2 pages).`
          : `CV berisi ${totalWords} kata, tetapi tidak memiliki satu pun bagian terstruktur (Ringkasan, Pengalaman, Pendidikan, Keahlian), sehingga panjangnya belum dinilai sebagai dokumen CV. Susun isi CV ke dalam bagian-bagian itu terlebih dahulu — rentang ideal CV terstruktur adalah 220–900 kata (sekitar 1–2 halaman).`
        : lang === 'en'
          ? `Your CV is ${totalWords} words. The ideal range is 220–900 words (about 1–2 pages).`
          : `CV berisi ${totalWords} kata. Rentang ideal 220–900 kata (sekitar 1–2 halaman).`,
    ),
    makeCheck(
      'periode', ASPECT.format, lang === 'en' ? 'Years / work periods' : 'Tahun / periode kerja', yearsScore, 3,
      hasYears
        ? lang === 'en' ? 'Years/periods are included in your history.' : 'Tahun/periode tercantum pada riwayatmu.'
        : lang === 'en' ? 'No years/periods are included. Write your work and education periods, for example 2021–2024.' : 'Tidak ada tahun/periode yang tercantum. Tulis periode kerja dan pendidikan, misalnya 2021–2024.',
    ),
    makeCheck(
      'nama-file', ASPECT.format, lang === 'en' ? 'CV file name' : 'Nama file CV', fileNameScore, 2,
      fileNameAssessment.message,
    ),
    makeCheck(
      'bullet', ASPECT.format, lang === 'en' ? 'Bullet structure' : 'Struktur bullet', bulletScore, 3,
      lang === 'en'
        ? `Found ${bulletCount} bullet lines. ${bulletCount >= 6 ? 'The bullet structure is already tidy.' : 'Bullets mean your tasks and achievements are written as separate points — one point per task/achievement, one point per line, starting with • or - — not merged into one long paragraph. Arrange your achievements in points like that so recruiters and ATS systems can scan them easily.'}`
        : `Ditemukan ${bulletCount} baris bullet. ${bulletCount >= 6 ? 'Struktur poin-poinnya sudah rapi.' : 'Bullet artinya uraian tugas dan pencapaian ditulis sebagai poin-poin terpisah — satu poin untuk satu tugas/pencapaian, satu poin per baris, diawali tanda • atau - — bukan ditulis menyatu dalam satu paragraf panjang. Susun pencapaianmu dalam poin-poin seperti itu agar mudah dipindai rekruter dan sistem ATS.'}`,
    ),
    makeCheck(
      'konsistensi-format', ASPECT.format, lang === 'en' ? 'Format consistency & ordering' : 'Konsistensi format & urutan', consistencyScore, 3,
      consistencyMessage,
    ),
    makeCheck(
      'kerapian-bahasa', ASPECT.format, lang === 'en' ? 'Language tidiness' : 'Kerapian bahasa', neatnessScore, 2,
      neatnessMessage,
    ),
  ]

  // ===== Agregasi =====
  const aspectDefs: { name: string; max: number; checks: CheckItem[] }[] = [
    { name: ASPECT.contact, max: 20, checks: kontakChecks },
    { name: ASPECT.summary, max: 10, checks: ringkasanChecks },
    { name: ASPECT.experience, max: 28, checks: pengalamanChecks },
    { name: ASPECT.education, max: 12, checks: pendidikanChecks },
    { name: ASPECT.skills, max: 10, checks: keahlianChecks },
    { name: ASPECT.format, max: 20, checks: formatChecks },
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
        name: ASPECT.jobMatch,
        max: 20,
        score: jobScore,
        checks: [
          makeCheck(
            'kecocokan-lowongan', ASPECT.jobMatch, lang === 'en' ? 'Job keyword match' : 'Kecocokan kata kunci lowongan',
            jobScore, 20,
            lang === 'en'
              ? `Found ${keywords.found.length} of the top ${keywords.total} job keywords in your CV (${keywords.percent}%). Your overall score now includes your match with this vacancy — this aspect is specific to the vacancy you pasted and changes if the vacancy changes.${
                  keywords.missing.length > 0
                    ? ` Important keywords not yet present: ${missingPreview}${keywords.missing.length > 5 ? ', …' : ''}. Only add keywords that genuinely match your experience.`
                    : ' All of the top job keywords are already in your CV.'
                }${
                  keywords.total <= 2
                    ? ` Warning: the vacancy text you pasted is very short — only ${keywords.total} keywords were found — so the match above is calculated only from what was found and may be far from the full picture. Paste a more complete job description for a more accurate match assessment.`
                    : ''
                }`
              : `Ditemukan ${keywords.found.length} dari ${keywords.total} kata kunci teratas lowongan di CV-mu (${keywords.percent}%). Skor keseluruhanmu kini mencakup kecocokan dengan lowongan ini — aspek ini khusus untuk lowongan yang kamu tempel dan berubah bila lowongannya berganti.${
                  keywords.missing.length > 0
                    ? ` Kata kunci penting yang belum ada: ${missingPreview}${keywords.missing.length > 5 ? ', …' : ''}. Tambahkan hanya kata kunci yang benar-benar sesuai pengalamanmu.`
                    : ' Semua kata kunci teratas lowongan sudah ada di CV-mu.'
                }${
                  // Peringatan informatif saja (keputusan pengguna
                  // 2026-11-24): skor kecocokan TIDAK diubah — ambang
                  // minimum kata kunci adalah aturan kuota yang ditolak
                  // pengguna. Teks lowongan yang sangat singkat hanya
                  // menghasilkan sedikit kata kunci, jadi persen
                  // kecocokannya mudah berayun jauh; pengguna berhak tahu
                  // bahwa angka ini dihitung dari yang terbaca saja.
                  keywords.total <= 2
                    ? ` Peringatan: teks lowongan yang kamu tempel sangat singkat — hanya ${keywords.total} kata kunci yang terbaca — sehingga kecocokan di atas dihitung hanya dari yang terbaca dan bisa jauh dari gambaran sebenarnya. Tempel deskripsi lowongan yang lebih lengkap agar penilaian kecocokannya lebih akurat.`
                    : ''
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
      ? lang === 'en' ? 'Ready to Apply' : 'Sangat Siap Dilamar'
      : total >= 70
        ? lang === 'en' ? 'Looking Good' : 'Sudah Bagus'
        : total >= 50
          ? lang === 'en' ? 'Needs Improvement' : 'Perlu Perbaikan'
          : lang === 'en' ? 'Needs a Major Rework' : 'Perlu Dirombak Dulu'

  const strengths = allChecks.filter((c) => c.status === 'baik')
  const priorities = selectPriorities(allChecks, aspects)

  // ===== Peringatan posisi (tidak mengubah skor) =====
  // Peringatan mengikuti peran PENENTU skor: pemenang relevansi
  // pengalaman lebih dulu, lalu pemenang relevansi ringkasan, lalu
  // posisi utama — pada pemakaian satu posisi ketiganya posisi yang
  // sama, jadi perilakunya persis seperti sebelumnya.
  const warningRole = experienceWinner?.role ?? summaryWinner?.role ?? role
  let roleWarning: string | null = null
  if (warningRole) {
    const firstWord = warningRole.toLowerCase().match(/[a-z]+/)?.[0] ?? ''
    if (firstWord && !lower.includes(firstWord)) {
      roleWarning =
        lang === 'en'
          ? `The target role "${warningRole}" is not mentioned in your CV. Mention this role or field in your summary or experience so your CV looks relevant.`
          : `Posisi target "${warningRole}" tidak disebut di dalam CV. Sebutkan posisi atau bidang ini di ringkasan atau pengalamanmu agar CV terlihat relevan.`
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
    relevanceWinners: {
      ringkasan: summaryWinner?.role ?? null,
      pengalaman: experienceWinner?.role ?? null,
    },
  }
}
