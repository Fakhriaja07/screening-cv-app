// Logika penilaian CV berbasis aturan (rule-based), 100% berjalan di browser.
// Total 100 poin, 6 aspek, 14 pemeriksaan.

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
]

function isHeadingLine(line: string, words: string[]): boolean {
  const trimmed = line.trim().toLowerCase()
  if (trimmed.length === 0 || trimmed.length > 60) return false
  return words.some((w) => trimmed.includes(w))
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

// ---------- Kata kerja aksi & hasil terukur ----------

const ACTION_VERBS = [
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

// ---------- Fungsi analisis utama ----------

export function analyzeCv(rawText: string, options: AnalyzeOptions = {}): AnalysisResult {
  const text = rawText ?? ''
  const lower = text.toLowerCase()
  const totalWords = countWords(text)

  // ===== KONTAK (maks 20) =====
  const emailMatch = lower.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/)
  const emailScore = emailMatch ? 7 : 0

  const phone = findPhone(text)
  const phoneScore = phone ? 6 : 0

  const linkedinScore = lower.includes('linkedin.com') ? 4 : 0

  const portfolioUrl = findPortfolio(text)
  const portfolioScore = portfolioUrl ? 3 : 0

  const kontakChecks = [
    makeCheck(
      'email', 'Kontak', 'Email valid', emailScore, 7,
      emailMatch
        ? `Email terbaca: ${emailMatch[0]}`
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
      'portofolio', 'Kontak', 'Link portofolio', portfolioScore, 3,
      portfolioUrl
        ? `Portofolio terbaca: ${portfolioUrl}`
        : 'Link portofolio tidak ditemukan. Cantumkan alamat GitHub, Behance, Kaggle, atau website portofolio pribadi (kata "portofolio" saja tanpa alamat tidak dihitung).',
    ),
  ]

  // ===== RINGKASAN (maks 10) =====
  const summarySection = getSection(text, [
    'ringkasan', 'tentang saya', 'profil', 'summary', 'profile', 'objective', 'tentang',
  ])
  const summaryWords = summarySection ? countWords(summarySection) : 0
  const summaryScore =
    summaryWords >= 40 ? 10 : summaryWords >= 20 ? 7 : summaryWords >= 8 ? 4 : summaryWords >= 1 ? 2 : 0
  const ringkasanChecks = [
    makeCheck(
      'ringkasan', 'Ringkasan', 'Ringkasan profesional', summaryScore, 10,
      summaryWords === 0
        ? 'Bagian ringkasan/profil tidak ditemukan. Tambahkan ringkasan 40 kata atau lebih yang menjelaskan keahlian dan pencapaian utamamu.'
        : `Ringkasan berisi ${summaryWords} kata. ${summaryWords >= 40 ? 'Panjangnya sudah ideal.' : 'Idealnya 40 kata atau lebih agar cukup menjelaskan nilai jualmu.'}`,
    ),
  ]

  // ===== PENGALAMAN (maks 28) =====
  const hasExperienceHeading =
    /(pengalaman|experience|pekerjaan|work history|riwayat kerja)/i.test(lower)
  const experienceHeadingScore = hasExperienceHeading ? 10 : 0

  const verbCount = countActionVerbs(lower)
  const verbScore = verbCount >= 5 ? 8 : verbCount >= 3 ? 6 : verbCount >= 1 ? 3 : 0

  const measurableCount = countMeasurableResults(text)
  const measurableScore =
    measurableCount >= 3 ? 10 : measurableCount === 2 ? 7 : measurableCount === 1 ? 4 : 0

  const pengalamanChecks = [
    makeCheck(
      'pengalaman-heading', 'Pengalaman', 'Bagian pengalaman kerja', experienceHeadingScore, 10,
      hasExperienceHeading
        ? 'Bagian pengalaman kerja ditemukan.'
        : 'Bagian pengalaman kerja tidak ditemukan. Buat bagian "Pengalaman" yang berisi riwayat pekerjaanmu.',
    ),
    makeCheck(
      'kata-kerja-aksi', 'Pengalaman', 'Kata kerja aksi', verbScore, 8,
      `Ditemukan ${verbCount} kata kerja aksi berbeda (mis. meningkatkan, mengelola, membangun). ${verbCount >= 5 ? 'Sudah bervariasi.' : 'Gunakan minimal 5 kata kerja aksi berbeda untuk menunjukkan peran aktifmu.'}`,
    ),
    makeCheck(
      'hasil-terukur', 'Pengalaman', 'Hasil terukur (angka pencapaian)', measurableScore, 10,
      `Ditemukan ${measurableCount} angka pencapaian (persen, jumlah, atau nominal — tahun dan nomor HP tidak dihitung). ${measurableCount >= 3 ? 'Sudah meyakinkan.' : 'Tambahkan hasil terukur, misalnya "meningkatkan penjualan 30%" atau "mengelola 15 orang".'}`,
    ),
  ]

  // ===== PENDIDIKAN (maks 12) =====
  const hasEducation =
    /(pendidikan|education|universitas|sekolah|sma|smk|diploma|sarjana|s1|s2|d3|d4)\b/i.test(lower)
  const educationScore = hasEducation ? 8 : 0

  const educationSection = getSection(text, ['pendidikan', 'education'])
  const hasGpa =
    /(ipk|gpa)\s*[:\-]?\s*[0-4]([.,]\d{1,2})?/i.test(text) ||
    /\b3[.,]\d{2}\b/.test(educationSection)
  const gpaScore = hasGpa ? 4 : 0

  const pendidikanChecks = [
    makeCheck(
      'pendidikan', 'Pendidikan', 'Pendidikan tercantum', educationScore, 8,
      hasEducation
        ? 'Informasi pendidikan ditemukan.'
        : 'Informasi pendidikan tidak ditemukan. Cantumkan jenjang pendidikan terakhir dan nama institusinya.',
    ),
    makeCheck(
      'ipk', 'Pendidikan', 'IPK / GPA', gpaScore, 4,
      hasGpa
        ? 'IPK/GPA tercantum.'
        : 'IPK/GPA tidak tercantum. Jika IPK-mu baik (mis. di atas 3,00), cantumkan untuk memperkuat profil.',
    ),
  ]

  // ===== KEAHLIAN (maks 10) =====
  const skillsSection = getSection(text, [
    'keahlian', 'skill', 'kemampuan', 'kompetensi', 'tools', 'teknologi',
  ])
  const skillItems = skillsSection
    ? skillsSection
        .split(/[\n,;•·|]+/)
        .map((s) => s.replace(/^\s*[-*]\s*/, '').trim())
        .filter((s) => s.length >= 2)
    : []
  const skillCount = skillItems.length
  const skillScore =
    skillCount >= 8 ? 10 : skillCount >= 5 ? 7 : skillCount >= 3 ? 4 : skillCount >= 1 ? 2 : 0
  const keahlianChecks = [
    makeCheck(
      'keahlian', 'Keahlian', 'Daftar keahlian / skill', skillScore, 10,
      skillCount === 0
        ? 'Bagian keahlian tidak ditemukan. Buat bagian "Keahlian" dan daftarkan minimal 8 skill yang relevan, pisahkan dengan koma.'
        : `Ditemukan ${skillCount} item keahlian. ${skillCount >= 8 ? 'Jumlahnya sudah cukup.' : 'Idealnya cantumkan minimal 8 skill yang relevan dengan posisi yang dilamar.'}`,
    ),
  ]

  // ===== FORMAT & ATS (maks 20) =====
  const lengthScore =
    totalWords >= 220 && totalWords <= 900
      ? 10
      : (totalWords >= 130 && totalWords <= 219) || (totalWords >= 901 && totalWords <= 1100)
        ? 6
        : totalWords >= 60 && totalWords <= 129
          ? 3
          : 1
  const hasYears = /\b(19|20)\d{2}\b/.test(text)
  const yearsScore = hasYears ? 5 : 0
  const bulletCount = text
    .split('\n')
    .filter((line) => /^\s*([\-•*]|\d+[.)])\s+/.test(line)).length
  const bulletScore = bulletCount >= 6 ? 5 : bulletCount >= 3 ? 3 : bulletCount >= 1 ? 1 : 0

  const formatChecks = [
    makeCheck(
      'panjang', 'Format & ATS', 'Panjang CV', lengthScore, 10,
      `CV berisi ${totalWords} kata. Rentang ideal 220–900 kata (sekitar 1–2 halaman).`,
    ),
    makeCheck(
      'periode', 'Format & ATS', 'Tahun / periode kerja', yearsScore, 5,
      hasYears
        ? 'Tahun/periode tercantum pada riwayatmu.'
        : 'Tidak ada tahun/periode yang tercantum. Tulis periode kerja dan pendidikan, misalnya 2021–2024.',
    ),
    makeCheck(
      'bullet', 'Format & ATS', 'Struktur bullet', bulletScore, 5,
      `Ditemukan ${bulletCount} baris bullet. ${bulletCount >= 6 ? 'Struktur poin-poinnya sudah rapi.' : 'Susun pencapaianmu dalam poin-poin (bullet) agar mudah dipindai rekruter dan sistem ATS.'}`,
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

  const aspects: AspectResult[] = aspectDefs.map((a) => ({
    name: a.name,
    max: a.max,
    score: a.checks.reduce((sum, c) => sum + c.score, 0),
    checks: a.checks,
  }))

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

  const aspectMaxByName = new Map(aspects.map((a) => [a.name, a.max]))
  const strengths = allChecks.filter((c) => c.status === 'baik')
  const priorities = allChecks
    .filter((c) => c.status !== 'baik')
    .sort(
      (a, b) =>
        b.max - b.score - (a.max - a.score) ||
        (aspectMaxByName.get(b.aspect) ?? 0) - (aspectMaxByName.get(a.aspect) ?? 0),
    )

  // ===== Kata kunci lowongan & peringatan posisi (tidak mengubah skor) =====
  const jobDesc = options.jobDesc?.trim() ?? ''
  const keywords = jobDesc ? extractJobKeywords(jobDesc, lower) : null

  let roleWarning: string | null = null
  const role = options.targetRole?.trim() ?? ''
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
    roleWarning,
    portfolioUrl,
    wordCount: totalWords,
  }
}
