// Backend Analisis AI — Vercel Serverless Function.
//
// Alur: browser → POST /api/analyze-ai → fungsi ini → OpenRouter → JSON kembali ke browser.
// API key hanya dibaca dari environment variable server (OPENROUTER_API_KEY) dan
// tidak pernah dikirim ke frontend. Isi CV hanya diteruskan ke OpenRouter untuk
// dianalisis — tidak dicatat ke log dan tidak disimpan di mana pun.

interface AiRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
  socket?: { remoteAddress?: string }
}

interface AiResponse {
  status: (code: number) => AiResponse
  json: (data: unknown) => void
  setHeader: (name: string, value: string) => void
  // Hanya dipakai mode streaming (respons Node asli Vercel memilikinya):
  // menulis potongan aliran NDJSON dan menutup respons.
  write?: (chunk: string) => boolean
  end?: (chunk?: string) => void
}

interface RewriteItem {
  asli: string
  saran: string
  alasan: string
}

// Satu item perbaikan menyeluruh untuk satu pemeriksaan standar yang
// gagal: versi perbaikan JADI (siap salin) atas temuan pemeriksa situs,
// bukan lagi sekadar contoh umum.
interface FixItem {
  idPemeriksaan: string
  judul: string
  sebelum: string
  sesudah: string
  catatan: string
}

interface AiResult {
  ringkasan: string
  saranPenulisanUlang: RewriteItem[]
  kekurangan: string[]
  saranRingkasan: string
  perbaikanLengkap: FixItem[]
  // Penilaian kecocokan CV dengan posisi target (2–4 kalimat). Diisi
  // model hanya bila konteks posisi diberikan; string kosong bila
  // tidak. OPSIONAL di seluruh jalur validasi: ketiadaannya tidak
  // menggagalkan hasil dan tidak dihitung sebagai isi substantif.
  penilaianPosisi: string
}

// Konteks posisi terstruktur dari frontend, diturunkan dari kamus
// skill situs sendiri: nama posisi tampilan + skill yang diharapkan
// peran itu, dipilah mana yang sudah terbukti di CV dan mana yang
// belum muncul. Inilah satu-satunya rujukan skill posisi bagi model.
export interface RoleContext {
  posisi: string
  skillDiharapkan: string[]
  skillAda: string[]
  skillBelum: string[]
}

// Konteks satu pemeriksaan standar yang gagal, dikirim frontend dari
// hasil analyzeCv yang sedang tampil (id + label + pesan + kutipan bukti
// dari lapisan contoh personal bila ada). AI memperbaiki temuan ini —
// bukan menebak ulang dari nol.
export interface FailedCheckContext {
  id: string
  judul: string
  pesan: string
  kutipan: string
}

const MAX_CV_CHARS = 12_000
const MIN_CV_CHARS = 50
const MAX_JOBDESC_CHARS = 6_000
const MAX_ROLE_CHARS = 200

// Konteks pemeriksaan yang gagal dari frontend: dibatasi jumlah dan
// panjang tiap field-nya agar prompt tidak membengkak tanpa kendali.
// Batas 30 di atas jumlah seluruh pemeriksaan yang ada (27 + 2
// kondisional = 29): janji produknya adalah AI memperbaiki SEMUA yang
// gagal, jadi batas tidak boleh memotong daftar secara diam-diam
// (audit 2026-11-24; batas dinaikkan dari 25 pada 2026-11-24).
const MAX_FIX_CHECKS = 30
const MAX_FIX_ITEMS = 30

// Konteks posisi dari frontend: kamus peran memuat paling banyak 10
// skill per peran; batas 15 memberi ruang tanpa membuka prompt ke
// daftar karangan pemanggil. Tiap nama skill dipotong 60 karakter.
const MAX_ROLE_SKILL_ITEMS = 15
const MAX_ROLE_SKILL_CHARS = 60
// penilaianPosisi dibatasi 2–4 kalimat oleh prompt; 1500 karakter
// adalah plafon keras normalisasi agar bidang ini tidak membengkak.
const MAX_ROLE_VERDICT_CHARS = 1500

// Batas waktu menunggu respons OpenRouter per permintaan. Model gratis bisa
// sangat lambat; tanpa batas ini fungsi serverless menggantung sampai
// diputus platform dan pengguna tidak mendapat pesan yang jelas. Jawaban
// kini memuat perbaikan untuk SEMUA pemeriksaan yang gagal (JSON jauh
// lebih besar), jadi batas waktu dan jatah token dinaikkan dari nilai
// lama (55 detik / 3000 token).
const UPSTREAM_TIMEOUT_MS = 75_000
const NONSTREAM_MAX_TOKENS = 6500

// Mode streaming: batas waktu keseluruhan aliran lebih longgar karena proses
// berpikir model ditampilkan langsung ke pengguna, dan jatah token keluaran
// lebih besar agar penalaran + JSON jawaban sama-sama muat. Batas aliran
// dinaikkan (90 → 150 detik) dan effort penalaran diturunkan ke "low"
// setelah uji live 2026-11-24: dengan JSON perbaikan lengkap, model
// menghabiskan 90 detik hanya untuk berpikir (effort medium) dan jawaban
// tidak sempat selesai.
const STREAM_TIMEOUT_MS = 150_000
const STREAM_MAX_TOKENS = 9000

class UpstreamTimeoutError extends Error {
  constructor() {
    super('OpenRouter tidak merespons dalam batas waktu')
    this.name = 'UpstreamTimeoutError'
  }
}

// --- Rate limit sederhana in-memory per IP ---
// Best-effort per instance: state ini hidup di memori satu instance fungsi
// serverless, jadi bukan batas global. Cukup untuk menahan penyalahgunaan
// kasual; untuk batas yang tegas gunakan penyimpanan bersama
// (mis. Vercel KV / Upstash) di lapisan berikutnya.
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const rateBuckets = new Map<string, { count: number; windowStart: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  // Pangkas bucket kedaluwarsa sesekali agar Map tidak tumbuh tanpa
  // batas oleh IP-IP unik (termasuk yang dipalsukan) seumur instance.
  if (rateBuckets.size > 1000) {
    for (const [key, bucket] of rateBuckets) {
      if (now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) rateBuckets.delete(key)
    }
  }
  const bucket = rateBuckets.get(ip)
  if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(ip, { count: 1, windowStart: now })
    return false
  }
  bucket.count += 1
  return bucket.count > RATE_LIMIT_MAX
}

function clientIp(req: AiRequest): string {
  // Audit 2026-11-24: versi lama mempercayai entri PERTAMA
  // x-forwarded-for — entri yang paling mudah dipalsukan pemanggil
  // (header itu daftar "klien, proxy1, proxy2, …"; platform menambahkan
  // IP asli di bagian AKHIR). Utamakan x-real-ip (diisi platform dari
  // koneksi sebenarnya), lalu entri TERAKHIR x-forwarded-for, lalu
  // alamat socket.
  const realIp = req.headers['x-real-ip']
  const real = Array.isArray(realIp) ? realIp[0] : realIp
  if (real && real.trim()) return real.trim()
  const forwarded = req.headers['x-forwarded-for']
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded
  if (first) {
    const parts = first.split(',').map((p) => p.trim()).filter(Boolean)
    if (parts.length > 0) return parts[parts.length - 1]
  }
  return req.socket?.remoteAddress ?? 'unknown'
}

const SYSTEM_PROMPT =
  'Kamu adalah konsultan karier berbahasa Indonesia. Balas HANYA dengan JSON valid sesuai skema yang diminta — tanpa markdown, tanpa pagar kode, tanpa teks pembuka/penutup. Jangan mengarang pengalaman, perusahaan, atau angka yang tidak ada di CV.'

// Validasi + sanitasi daftar pemeriksaan gagal dari body permintaan.
// Item tanpa id/judul dibuang; tiap field dipotong ke batasnya; jumlah
// dibatasi. Body yang tidak memuat daftar valid menghasilkan array
// kosong (perilaku lama: AI menilai tanpa konteks pemeriksa).
export function parseFailedChecks(value: unknown): FailedCheckContext[] {
  if (!Array.isArray(value)) return []
  const out: FailedCheckContext[] = []
  const seenIds = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const obj = item as Record<string, unknown>
    const id = asString(obj.id).trim().slice(0, 60)
    const judul = asString(obj.judul).trim().slice(0, 120)
    if (!id || !judul) continue
    // Id duplikat dibuang (yang pertama menang): prompt tidak boleh
    // memuat pemeriksaan yang sama dua kali (audit 2026-11-24).
    if (seenIds.has(id)) continue
    seenIds.add(id)
    out.push({
      id,
      judul,
      pesan: asString(obj.pesan).trim().slice(0, 500),
      kutipan: asString(obj.kutipan).trim().slice(0, 600),
    })
    if (out.length >= MAX_FIX_CHECKS) break
  }
  return out
}

// Validasi + sanitasi konteks posisi dari body permintaan, dengan pola
// yang sama seperti parseFailedChecks: tipe tak sah dibuang, tiap field
// dipotong ke batasnya, duplikat dibuang. Konteks tanpa nama posisi
// dianggap tidak ada (null) — perilaku lama berlaku persis. Skill yang
// tercantum sekaligus di "ada" dan "belum" dimenangkan daftar "ada"
// (bukti di CV lebih kuat daripada ketiadaan hasil pencocokan klien).
export function parseRoleContext(value: unknown): RoleContext | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const obj = value as Record<string, unknown>
  const posisi = asString(obj.posisi).trim().slice(0, MAX_ROLE_CHARS)
  if (!posisi) return null
  const cleanList = (v: unknown): string[] => {
    if (!Array.isArray(v)) return []
    const out: string[] = []
    const seen = new Set<string>()
    for (const item of v) {
      // Nama skill hanya sah sebagai string — angka/boolean/objek dari
      // pemanggil dibuang, tidak diubah paksa menjadi "skill".
      if (typeof item !== 'string') continue
      const s = item.trim().slice(0, MAX_ROLE_SKILL_CHARS)
      if (!s) continue
      const key = s.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(s)
      if (out.length >= MAX_ROLE_SKILL_ITEMS) break
    }
    return out
  }
  const skillAda = cleanList(obj.skillAda)
  const adaKeys = new Set(skillAda.map((s) => s.toLowerCase()))
  return {
    posisi,
    skillDiharapkan: cleanList(obj.skillDiharapkan),
    skillAda,
    skillBelum: cleanList(obj.skillBelum).filter((s) => !adaKeys.has(s.toLowerCase())),
  }
}

function buildPrompt(
  cvText: string,
  targetRole: string,
  jobDesc: string,
  checks: FailedCheckContext[],
  roleCtx: RoleContext | null,
): string {
  const rolePart = targetRole
    ? `\nPOSISI YANG DILAMAR: ${targetRole}\n`
    : ''
  const jobPart = jobDesc
    ? `\nDESKRIPSI LOWONGAN:\n${jobDesc}\n`
    : '\n(Tidak ada deskripsi lowongan — nilai kekurangan umum CV saja.)\n'
  const checksPart = checks.length
    ? [
        '',
        'PEMERIKSAAN STANDAR YANG GAGAL (hasil mesin penilaian situs atas CV ini — perbaiki SEMUANYA di "perbaikanLengkap"):',
        ...checks.map((c, i) => {
          const lines = [`${i + 1}. [id: ${c.id}] ${c.judul}`]
          if (c.pesan) lines.push(`   Temuan pemeriksa: ${c.pesan}`)
          if (c.kutipan) lines.push(`   Kutipan dari CV pengguna: "${c.kutipan}"`)
          return lines.join('\n')
        }),
        '',
      ].join('\n')
    : '\n(Tidak ada daftar pemeriksaan yang dikirim — "perbaikanLengkap" boleh berupa array kosong.)\n'
  // Blok konteks posisi: rujukan skill posisi SATU-SATUNYA bagi model,
  // diturunkan dari kamus situs — bukan pengetahuan umum model.
  const roleCtxPart = roleCtx
    ? [
        '',
        `KONTEKS POSISI "${roleCtx.posisi}" (dari kamus skill situs — satu-satunya rujukan skill untuk posisi ini):`,
        ...(roleCtx.skillDiharapkan.length
          ? [`- Skill yang diharapkan posisi ini: ${roleCtx.skillDiharapkan.join(', ')}`]
          : []),
        ...(roleCtx.skillAda.length
          ? [`- Skill posisi yang SUDAH terbukti ada di CV: ${roleCtx.skillAda.join(', ')}`]
          : []),
        ...(roleCtx.skillBelum.length
          ? [`- Skill posisi yang BELUM muncul di CV: ${roleCtx.skillBelum.join(', ')}`]
          : []),
        '',
      ].join('\n')
    : ''
  // Aturan tambahan penilaian berbasis posisi (hanya bila konteks ada).
  const roleRules: string[] = roleCtx
    ? [
        `- PENILAIAN POSISI: nilai CV ini dari kacamata posisi "${roleCtx.posisi}". "ringkasan" dan "kekurangan" WAJIB menyebut secara spesifik bukti di CV yang relevan dengan posisi itu serta skill kunci posisi yang belum muncul di CV. Skill posisi yang boleh kamu sebut HANYA yang tercantum pada KONTEKS POSISI di bawah — jangan menyebut skill posisi lain di luar daftar itu dan jangan mengarang pengalaman atau angka di luar teks CV.`,
        `- "penilaianPosisi" WAJIB diisi (2–4 kalimat): bukti terkuat yang sudah ada di CV untuk posisi "${roleCtx.posisi}" dan celah paling kritisnya untuk posisi itu.`,
        `- saranPenulisanUlang: gunakan kosakata dan jenis bukti yang dicari posisi "${roleCtx.posisi}" (alat/metode dari daftar skill posisinya), tetap hanya menulis ulang isi CV yang benar-benar ada.`,
        ...(jobDesc
          ? ['- Deskripsi lowongan dan konteks posisi sama-sama tersedia: tuntutan deskripsi lowongan DIDAHULUKAN daripada gambaran peran umum.']
          : []),
      ]
    : ['- "penilaianPosisi" kosongkan ("") — pengguna tidak mengisi posisi target.']
  return [
    'Kamu adalah konsultan karier berbahasa Indonesia yang membantu pencari kerja dan fresh graduate memperbaiki CV.',
    'Analisis CV berikut dan balas HANYA dengan JSON valid (tanpa markdown, tanpa teks lain) dengan skema persis ini:',
    '{',
    '  "ringkasan": "penilaian kualitatif CV dalam 2-3 kalimat",',
    '  "saranPenulisanUlang": [ { "asli": "kalimat/poin asli dari CV", "saran": "versi penulisan ulang", "alasan": "kenapa versi baru lebih baik" } ],',
    '  "kekurangan": [ "kekurangan CV, maksimal 6 butir" ],',
    '  "saranRingkasan": "contoh ringkasan profil 2-3 kalimat berdasarkan isi CV",',
    roleCtx
      ? '  "penilaianPosisi": "penilaian kecocokan CV dengan posisi target dalam 2-4 kalimat: bukti terkuat yang sudah ada + celah paling kritis untuk posisi itu",'
      : '  "penilaianPosisi": "",',
    '  "perbaikanLengkap": [ { "idPemeriksaan": "id pemeriksaan persis seperti pada daftar di bawah", "judul": "nama pemeriksaan", "sebelum": "kutipan asli dari CV yang diperbaiki — kosongkan bila masalahnya sesuatu yang belum ada di CV", "sesudah": "versi perbaikan JADI yang siap disalin pengguna", "catatan": "penjelasan singkat 1 kalimat" } ]',
    '}',
    '',
    'Aturan ketat:',
    '- saranPenulisanUlang: ambil maksimal 5 poin dari bagian pengalaman CV. Tulis ulang dengan kata kerja aksi yang kuat dan struktur pencapaian.',
    '- perbaikanLengkap: buat SATU item untuk SETIAP pemeriksaan pada daftar "PEMERIKSAAN STANDAR YANG GAGAL" di bawah — tidak boleh ada yang terlewat dan jangan menambah pemeriksaan di luar daftar itu. Urutannya sama seperti daftar.',
    '- "sesudah" pada perbaikanLengkap harus teks FINAL yang utuh dan siap disalin ke CV, ditulis dari teks pengguna sendiri — bukan contoh umum dan bukan placeholder umum. Placeholder kurung siku HANYA untuk fakta yang memang tidak ada di CV (angka pencapaian, nama, tanggal) dan harus spesifik, mis. [jumlah dokumen yang diproses per bulan], bukan [angka].',
    '- Bila masalahnya sesuatu yang BELUM ADA di CV (mis. belum ada tautan LinkedIn, sertifikasi, atau bagian yang hilang): "sebelum" dikosongkan dan "sesudah" berisi templat konkret yang siap diisi pengguna (format persisnya) + di "catatan" satu kalimat cara mengisinya.',
    '- "sebelum" pada perbaikanLengkap: pakai kutipan yang tercantum pada daftar pemeriksaan bila ada; bila tidak ada, ambil kalimat/bagian CV yang persis diperbaiki; kosongkan hanya untuk masalah ketiadaan.',
    '- Jaga setiap item perbaikanLengkap ringkas: "sesudah" maksimal sekitar 3 baris/kalimat, "catatan" 1 kalimat. Jawaban memuat banyak item, jadi jangan bertele-tele.',
    '- JANGAN mengarang pengalaman, perusahaan, atau angka baru. Bila angka pencapaian tidak ada di CV, pakai placeholder seperti [X%], [jumlah], atau [angka] di dalam saran, dan jelaskan di alasan bahwa pengguna harus mengisi angka aslinya sendiri.',
    jobDesc
      ? '- kekurangan: nilai kesenjangan (gap) CV terhadap deskripsi lowongan secara MAKNA — skill/pengalaman yang dituntut lowongan tapi belum tampak di CV, bukan sekadar daftar kata kunci yang hilang.'
      : '- kekurangan: nilai kekurangan umum CV (struktur, kejelasan, bukti pencapaian, kelengkapan bagian).',
    '- saranRingkasan: tulis berdasarkan fakta di CV saja, jangan menambah klaim baru.',
    ...roleRules,
    '- Seluruh jawaban dalam Bahasa Indonesia yang jelas dan suportif.',
    rolePart,
    roleCtxPart,
    jobPart,
    checksPart,
    'TEKS CV:',
    cvText,
  ].join('\n')
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

// Field array yang dikirim model tidak selalu rapi: string tunggal dibungkus
// menjadi array satu elemen, elemen non-string primitif diubah ke string,
// elemen objek/kosong dilewati.
function asStringList(value: unknown, max: number): string[] {
  if (value === null || value === undefined) return []
  const items = Array.isArray(value) ? value : [value]
  const out: string[] = []
  for (const item of items) {
    const s = asString(item).trim()
    if (s) out.push(s)
    if (out.length >= max) break
  }
  return out
}

function normalizeRewrite(item: unknown): RewriteItem | null {
  if (typeof item === 'string') {
    const s = item.trim()
    return s ? { asli: '', saran: s, alasan: '' } : null
  }
  if (item && typeof item === 'object') {
    const it = item as Record<string, unknown>
    const saran = asString(it.saran).trim()
    // Item tanpa saran penulisan ulang tidak berguna (termasuk objek
    // kosong {} yang sebelumnya lolos apa adanya) — dibuang.
    if (!saran) return null
    return {
      asli: asString(it.asli),
      saran,
      alasan: asString(it.alasan),
    }
  }
  return null
}

// Item perbaikan lengkap tanpa "sesudah" tidak berguna bagi pengguna —
// dibuang. Field lain ditoleransi kosong (judul jatuh ke id bila kosong).
function normalizeFix(item: unknown): FixItem | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null
  const it = item as Record<string, unknown>
  const sesudah = asString(it.sesudah).trim()
  if (!sesudah) return null
  const idPemeriksaan = asString(it.idPemeriksaan).trim()
  return {
    idPemeriksaan,
    judul: asString(it.judul).trim() || idPemeriksaan,
    sebelum: asString(it.sebelum),
    sesudah,
    catatan: asString(it.catatan),
  }
}

function normalizeResult(raw: unknown, requestedFixIds: string[] = []): AiResult | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>
  // Objek JSON yang sama sekali tidak memuat field skema dianggap bukan
  // jawaban analisis (mis. JSON lain yang kebetulan valid) → gagal parse.
  const hasKnownField = [
    'ringkasan',
    'saranPenulisanUlang',
    'kekurangan',
    'saranRingkasan',
    'perbaikanLengkap',
    'penilaianPosisi',
  ].some((key) => obj[key] !== undefined && obj[key] !== null)
  if (!hasKnownField) return null

  const rewriteSource =
    obj.saranPenulisanUlang === null || obj.saranPenulisanUlang === undefined
      ? []
      : Array.isArray(obj.saranPenulisanUlang)
        ? obj.saranPenulisanUlang
        : [obj.saranPenulisanUlang]
  const rewrites: RewriteItem[] = []
  for (const item of rewriteSource) {
    const normalized = normalizeRewrite(item)
    if (normalized) rewrites.push(normalized)
    if (rewrites.length >= 5) break
  }

  const fixSource =
    obj.perbaikanLengkap === null || obj.perbaikanLengkap === undefined
      ? []
      : Array.isArray(obj.perbaikanLengkap)
        ? obj.perbaikanLengkap
        : [obj.perbaikanLengkap]
  const fixes: FixItem[] = []
  const requestedSet = new Set(requestedFixIds)
  const seenFixIds = new Set<string>()
  for (const item of fixSource) {
    const normalized = normalizeFix(item)
    if (!normalized) continue
    // Rekonsiliasi dengan daftar yang DIMINTA (audit 2026-11-24): item
    // ber-id asing yang tidak diminta dan item duplikat dibuang — model
    // tidak boleh mengarang pemeriksaan sendiri atau menggandakan satu
    // perbaikan untuk menutupi yang hilang.
    if (requestedSet.size > 0) {
      if (!requestedSet.has(normalized.idPemeriksaan)) continue
      if (seenFixIds.has(normalized.idPemeriksaan)) continue
      seenFixIds.add(normalized.idPemeriksaan)
    }
    fixes.push(normalized)
    if (fixes.length >= MAX_FIX_ITEMS) break
  }

  const result: AiResult = {
    ringkasan: asString(obj.ringkasan),
    saranPenulisanUlang: rewrites,
    kekurangan: asStringList(obj.kekurangan, 6),
    saranRingkasan: asString(obj.saranRingkasan),
    perbaikanLengkap: fixes,
    // penilaianPosisi sengaja TIDAK ikut menentukan isi substantif di
    // bawah: bidang ini opsional (model lama/variansi model boleh tidak
    // mengisinya), dan sebaliknya isinya sendirian tidak cukup untuk
    // menyatakan hasil berhasil — token pengguna tetap terlindungi
    // oleh aturan substantif yang sama seperti sebelumnya.
    penilaianPosisi: asString(obj.penilaianPosisi).trim().slice(0, MAX_ROLE_VERDICT_CHARS),
  }

  // Hasil "hampa" BUKAN sukses (audit 2026-11-24): jawaban seperti
  // {"ringkasan":""} sebelumnya lolos sebagai HTTP 200 dan token pengguna
  // terpotong untuk kartu AI kosong. Hasil hanya sah bila memuat isi
  // substantif di sedikitnya satu bidang — dan bila daftar pemeriksaan
  // gagal dikirim, perbaikanLengkap tidak boleh kosong sama sekali
  // (itulah inti yang dibayar pengguna; kekurangan sebagian masih
  // ditoleransi, ketiadaan total tidak).
  const hasSubstance =
    result.ringkasan.trim() !== '' ||
    result.saranPenulisanUlang.length > 0 ||
    result.kekurangan.length > 0 ||
    result.saranRingkasan.trim() !== '' ||
    result.perbaikanLengkap.length > 0
  if (!hasSubstance) return null
  if (requestedSet.size > 0 && result.perbaikanLengkap.length === 0) return null
  return result
}

// Model reasoning sering membungkus proses berpikirnya dalam tag <think>
// atau <thinking>; blok itu dibuang sebelum parsing JSON.
function stripThinkBlocks(text: string): string {
  return text
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, ' ')
    .replace(/<\/?think(?:ing)?>/gi, ' ')
}

function tryParseJson(text: string, requestedFixIds: string[] = []): AiResult | null {
  try {
    return normalizeResult(JSON.parse(text), requestedFixIds)
  } catch {
    return null
  }
}

export function parseAiJson(text: string, requestedFixIds: string[] = []): AiResult | null {
  // Urutan percobaan dari yang paling bersih ke yang paling toleran:
  // parse langsung → buang pagar kode → ekstrak { ... } terluar.
  const cleaned = stripThinkBlocks(text).trim()
  if (!cleaned) return null
  const direct = tryParseJson(cleaned, requestedFixIds)
  if (direct) return direct
  const defenced = cleaned.replace(/```(?:json)?/gi, '').trim()
  if (defenced !== cleaned) {
    const fromDefenced = tryParseJson(defenced, requestedFixIds)
    if (fromDefenced) return fromDefenced
  }
  const start = defenced.indexOf('{')
  const end = defenced.lastIndexOf('}')
  if (start >= 0 && end > start) {
    return tryParseJson(defenced.slice(start, end + 1), requestedFixIds)
  }
  return null
}

// Isi message.content kadang berupa array of parts, bukan string tunggal.
function extractMessageText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(extractMessageText).join('')
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (typeof obj.text === 'string') return obj.text
    if (typeof obj.content === 'string') return obj.content
  }
  return ''
}

export interface AiParseOutcome {
  result: AiResult | null
  finishReason: string
  rawText: string
}

// Ekstrak hasil analisis dari respons Chat Completions mentah. Sumber teks
// utama adalah message.content; bila kosong atau tidak terparse, coba
// message.reasoning (beberapa model reasoning menaruh jawaban di sana).
export function parseAiResponse(data: unknown, requestedFixIds: string[] = []): AiParseOutcome {
  const root = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  const choices = Array.isArray(root.choices) ? root.choices : []
  const first =
    choices[0] && typeof choices[0] === 'object' ? (choices[0] as Record<string, unknown>) : {}
  const message =
    first.message && typeof first.message === 'object'
      ? (first.message as Record<string, unknown>)
      : {}
  const finishReason = typeof first.finish_reason === 'string' ? first.finish_reason : ''
  const contentText = extractMessageText(message.content)
  const reasoningText = extractMessageText(message.reasoning)

  let result = contentText ? parseAiJson(contentText, requestedFixIds) : null
  if (!result && reasoningText) result = parseAiJson(reasoningText, requestedFixIds)
  return { result, finishReason, rawText: contentText || reasoningText }
}

// --- Mode streaming -------------------------------------------------------
// Sebagian provider menaruh penalaran di delta.reasoning_details sebagai
// array bagian ({type:"reasoning.text", text:"..."} / {summary:"..."}).
// Bagian terenkripsi (tanpa teks) dilewati.
function extractReasoningDetailsText(value: unknown): string {
  if (!Array.isArray(value)) return ''
  let out = ''
  for (const item of value) {
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>
      if (typeof obj.text === 'string') out += obj.text
      else if (typeof obj.summary === 'string') out += obj.summary
    }
  }
  return out
}

const THINK_OPEN_TAGS = ['<thinking>', '<think>']
const THINK_CLOSE_TAGS = ['</thinking>', '</think>']

// Memisahkan teks content yang masuk bertahap menjadi penalaran (teks di
// dalam blok <think>...</think>) dan konten jawaban. Aman terhadap tag yang
// terpotong tepat di batas potongan aliran: ekor buffer yang mungkin awalan
// tag ditahan sampai potongan berikutnya tiba.
class ThinkSplitter {
  private buffer = ''
  private inThink = false

  push(chunk: string): { reasoning: string; content: string } {
    this.buffer += chunk
    return this.drain(false)
  }

  flush(): { reasoning: string; content: string } {
    return this.drain(true)
  }

  private drain(final: boolean): { reasoning: string; content: string } {
    let reasoning = ''
    let content = ''
    for (;;) {
      const tags = this.inThink ? THINK_CLOSE_TAGS : THINK_OPEN_TAGS
      const lower = this.buffer.toLowerCase()
      let tagStart = -1
      let tagLength = 0
      for (const tag of tags) {
        const idx = lower.indexOf(tag)
        if (idx >= 0 && (tagStart < 0 || idx < tagStart)) {
          tagStart = idx
          tagLength = tag.length
        }
      }
      if (tagStart >= 0) {
        const before = this.buffer.slice(0, tagStart)
        if (this.inThink) reasoning += before
        else content += before
        this.buffer = this.buffer.slice(tagStart + tagLength)
        this.inThink = !this.inThink
        continue
      }
      if (final) {
        if (this.inThink) reasoning += this.buffer
        else content += this.buffer
        this.buffer = ''
      } else {
        const hold = this.partialTagSuffixLength(tags)
        const cut = this.buffer.length - hold
        if (this.inThink) reasoning += this.buffer.slice(0, cut)
        else content += this.buffer.slice(0, cut)
        this.buffer = this.buffer.slice(cut)
      }
      break
    }
    return { reasoning, content }
  }

  // Panjang sufiks buffer yang merupakan awalan (belum utuh) salah satu tag.
  private partialTagSuffixLength(tags: string[]): number {
    const lower = this.buffer.toLowerCase()
    let max = 0
    for (const tag of tags) {
      for (let len = 1; len < tag.length && len <= lower.length; len++) {
        if (lower.endsWith(tag.slice(0, len))) max = Math.max(max, len)
      }
    }
    return max
  }
}

interface StreamOptions {
  apiKey: string
  model: string
  cvText: string
  targetRole: string
  jobDesc: string
  checks: FailedCheckContext[]
  roleCtx: RoleContext | null
}

// Menjalankan analisis dalam mode streaming: meneruskan penalaran model
// sebagai event NDJSON begitu tiba, lalu satu event hasil di akhir.
// Semua error SEBELUM aliran dimulai (key, upstream HTTP, timeout awal)
// sudah ditangani pemanggil / fase fetch di sini dengan respons JSON biasa;
// fungsi ini hanya dipanggil setelah validasi lolos dan aliran adalah
// satu-satunya keluaran yang tersisa untuk kegagalan di tengah proses.
async function streamAnalysis(res: AiResponse, opts: StreamOptions): Promise<void> {
  const { apiKey, model, cvText, targetRole, jobDesc, checks, roleCtx } = opts
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS)

  const sendRequest = async (options: {
    withResponseFormat: boolean
    withReasoning: boolean
  }): Promise<Response> => {
    try {
      return await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'X-Title': 'Screening CV',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildPrompt(cvText, targetRole, jobDesc, checks, roleCtx) },
          ],
          stream: true,
          ...(options.withResponseFormat ? { response_format: { type: 'json_object' } } : {}),
          // Effort "low" + CAP token penalaran di jalur streaming:
          // penalaran tetap tampil di panel berpikir, tetapi dibatasi
          // ±1.500 token agar model berhenti berpikir dan menulis JSON
          // jawabannya. Tanpa cap ini, uji live 2026-11-24 menunjukkan
          // model menghabiskan seluruh batas aliran (150 detik, 1.400+
          // potongan reasoning) hanya untuk berpikir dan JSON perbaikan
          // lengkap tidak pernah selesai. Provider yang menolak
          // parameter ini memicu jalur retry yang membuangnya.
          ...(options.withReasoning
            ? { reasoning: { effort: 'low', max_tokens: 1500 } }
            : {}),
          temperature: 0.4,
          max_tokens: STREAM_MAX_TOKENS,
        }),
      })
    } catch (err) {
      if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
        throw new UpstreamTimeoutError()
      }
      throw err
    }
  }

  const readErrMessage = async (response: Response): Promise<string> => {
    try {
      const errData = (await response.json()) as {
        error?: { code?: number | string; message?: string }
      }
      return (errData.error?.message ?? '').slice(0, 300)
    } catch {
      return ''
    }
  }

  // --- Fase fetch: aliran belum dimulai, error dibalas JSON biasa ---
  let aiResponse: Response
  let upstreamMessage: string | null = null
  let includeResponseFormat = true
  let includeReasoning = true
  try {
    aiResponse = await sendRequest({
      withResponseFormat: includeResponseFormat,
      withReasoning: includeReasoning,
    })
    // Penolakan parameter opsional (400) ditangani sama seperti mode biasa:
    // buang parameter yang ditolak, ulangi maksimal 2 kali.
    for (let retry = 0; retry < 2 && !aiResponse.ok && aiResponse.status === 400; retry++) {
      const message400 = await readErrMessage(aiResponse)
      const lower = message400.toLowerCase()
      let dropped = false
      if (includeReasoning && lower.includes('reasoning')) {
        includeReasoning = false
        dropped = true
      } else if (includeResponseFormat && /response_format|\bjson\b/.test(lower)) {
        includeResponseFormat = false
        dropped = true
      } else if (/unsupported|not supported|unknown|invalid parameter/.test(lower)) {
        if (includeReasoning) {
          includeReasoning = false
          dropped = true
        } else if (includeResponseFormat) {
          includeResponseFormat = false
          dropped = true
        }
      }
      if (!dropped) {
        upstreamMessage = message400
        break
      }
      aiResponse = await sendRequest({
        withResponseFormat: includeResponseFormat,
        withReasoning: includeReasoning,
      })
    }
  } catch (err) {
    clearTimeout(timer)
    if (err instanceof UpstreamTimeoutError) {
      console.error(`[analyze-ai] (stream) Timeout ${STREAM_TIMEOUT_MS / 1000} detik menunggu OpenRouter`)
      res.status(502).json({
        error: 'Layanan AI terlalu lama merespons. Coba lagi — hasil analisis standar tetap bisa dipakai.',
      })
      return
    }
    res.status(502).json({
      error: 'Layanan AI sedang tidak bisa dihubungi. Coba lagi nanti — hasil analisis standar tetap bisa dipakai.',
    })
    return
  }

  if (!aiResponse.ok) {
    clearTimeout(timer)
    const message = upstreamMessage ?? (await readErrMessage(aiResponse))
    const detail = `OpenRouter HTTP ${aiResponse.status}${message ? `: ${message}` : ''}`
    console.error(`[analyze-ai] (stream) ${detail}`)
    if (aiResponse.status === 429) {
      res.status(429).json({
        error: 'Layanan AI sedang dibatasi (rate limit) atau kuota gratis sedang penuh, coba lagi nanti — hasil analisis standar tetap bisa dipakai.',
      })
      return
    }
    if (aiResponse.status === 401 || aiResponse.status === 403) {
      res.status(502).json({
        error: 'API key OpenRouter ditolak. Periksa konfigurasi OPENROUTER_API_KEY di server — hasil analisis standar tetap bisa dipakai.',
      })
      return
    }
    if (aiResponse.status === 402) {
      res.status(502).json({
        error: 'Kredit OpenRouter tidak cukup untuk menjalankan analisis AI. Isi kredit atau periksa batas pemakaian akun OpenRouter — hasil analisis standar tetap bisa dipakai.',
      })
      return
    }
    res.status(502).json({
      error: 'Layanan AI mengembalikan kesalahan. Coba lagi nanti — hasil analisis standar tetap bisa dipakai.',
    })
    return
  }

  const reader = aiResponse.body?.getReader()
  if (!reader) {
    clearTimeout(timer)
    console.error('[analyze-ai] (stream) OpenRouter tidak mengirim aliran data (stream kosong)')
    res.status(502).json({
      error: 'Layanan AI mengembalikan kesalahan. Coba lagi nanti — hasil analisis standar tetap bisa dipakai.',
    })
    return
  }

  // --- Fase aliran: keluaran menjadi NDJSON, satu event per baris ---
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('X-Accel-Buffering', 'no')
  res.status(200)
  const send = (event: Record<string, unknown>) => {
    try {
      res.write?.(`${JSON.stringify(event)}\n`)
    } catch {
      // Klien terputus; abaikan — pembacaan upstream dihentikan di catch.
    }
  }

  const splitter = new ThinkSplitter()
  let reasoningAll = ''
  let contentAll = ''
  let finishReason = ''
  let streamError: { error: string; detail: string } | null = null

  const emitReasoning = (text: string) => {
    if (!text) return
    reasoningAll += text
    send({ type: 'reasoning', text })
  }
  const emitContent = (chunk: string) => {
    const split = splitter.push(chunk)
    emitReasoning(split.reasoning)
    contentAll += split.content
  }

  try {
    const decoder = new TextDecoder()
    let buffer = ''
    let upstreamDone = false
    while (!upstreamDone) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl = buffer.indexOf('\n')
      while (nl >= 0) {
        const line = buffer.slice(0, nl).trim()
        buffer = buffer.slice(nl + 1)
        nl = buffer.indexOf('\n')
        if (!line.startsWith('data:')) continue
        const dataStr = line.slice('data:'.length).trim()
        if (!dataStr) continue
        if (dataStr === '[DONE]') {
          upstreamDone = true
          break
        }
        let chunkJson: Record<string, unknown>
        try {
          chunkJson = JSON.parse(dataStr) as Record<string, unknown>
        } catch {
          continue
        }
        if (chunkJson.error && typeof chunkJson.error === 'object') {
          const errObj = chunkJson.error as Record<string, unknown>
          const msg = asString(errObj.message).slice(0, 300)
          streamError = {
            error: 'Layanan AI mengembalikan kesalahan. Coba lagi nanti — hasil analisis standar tetap bisa dipakai.',
            detail: `OpenRouter${msg ? `: ${msg}` : ''}`,
          }
          upstreamDone = true
          break
        }
        const choices = Array.isArray(chunkJson.choices) ? chunkJson.choices : []
        const choice =
          choices[0] && typeof choices[0] === 'object'
            ? (choices[0] as Record<string, unknown>)
            : null
        if (!choice) continue
        if (typeof choice.finish_reason === 'string' && choice.finish_reason) {
          finishReason = choice.finish_reason
        }
        const delta =
          choice.delta && typeof choice.delta === 'object'
            ? (choice.delta as Record<string, unknown>)
            : {}
        // Sebagian provider (mis. Nemotron via OpenRouter) mengirim teks
        // penalaran yang SAMA di delta.reasoning dan delta.reasoning_details
        // sekaligus — menggabungkan keduanya membuat panel berpikir berisi
        // teks dobel. Utamakan delta.reasoning; reasoning_details hanya
        // dipakai bila field reasoning kosong.
        const reasoningText =
          extractMessageText(delta.reasoning) || extractReasoningDetailsText(delta.reasoning_details)
        emitReasoning(reasoningText)
        const contentChunk = extractMessageText(delta.content)
        if (contentChunk) emitContent(contentChunk)
      }
    }
  } catch (err) {
    if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
      streamError = {
        error: 'Layanan AI terlalu lama merespons. Coba lagi — hasil analisis standar tetap bisa dipakai.',
        detail: `Timeout ${STREAM_TIMEOUT_MS / 1000} detik menunggu OpenRouter (streaming)`,
      }
    } else if (!streamError) {
      streamError = {
        error: 'Layanan AI sedang tidak bisa dihubungi. Coba lagi nanti — hasil analisis standar tetap bisa dipakai.',
        detail: 'Aliran data dari OpenRouter terputus di tengah proses.',
      }
    }
  } finally {
    clearTimeout(timer)
  }

  // Sisa splitter (tag tidak ditutup / potongan terakhir) tetap diproses.
  const rest = splitter.flush()
  if (!streamError) emitReasoning(rest.reasoning)
  else reasoningAll += rest.reasoning
  contentAll += rest.content

  if (streamError) {
    console.error(`[analyze-ai] (stream) ${streamError.detail}`)
    send({ type: 'error', error: streamError.error })
    res.end?.()
    return
  }

  const requestedFixIds = checks.map((c) => c.id)
  let result = contentAll ? parseAiJson(contentAll, requestedFixIds) : null
  if (!result && reasoningAll) result = parseAiJson(reasoningAll, requestedFixIds)
  if (result) {
    send({ type: 'result', data: result })
  } else {
    const rawText = contentAll || reasoningAll
    const snippet = rawText.slice(0, 200)
    // Diagnostik parse hanya untuk log server — TIDAK dikirim ke klien
    // (audit 2026-11-24: frontend tidak pernah membacanya, dan cuplikan
    // jawaban diturunkan dari CV pemanggil sehingga tidak perlu keluar
    // lewat jalur error).
    console.error(
      `[analyze-ai] (stream) Jawaban model tidak terparse ` +
        `(finish_reason=${finishReason || 'tidak tersedia'}; panjang=${rawText.length}; ` +
        `cuplikan: ${snippet ? `"${snippet}"` : '(kosong)'})`,
    )
    send({
      type: 'error',
      error: 'Jawaban AI tidak bisa dibaca. Coba lagi — hasil analisis standar tetap bisa dipakai.',
    })
  }
  res.end?.()
}

export default async function handler(req: AiRequest, res: AiResponse): Promise<void> {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Metode tidak diizinkan. Gunakan POST.' })
    return
  }

  // Body: Vercel biasanya sudah mem-parse JSON; bila masih string, parse manual.
  let payload: Record<string, unknown> = {}
  if (typeof req.body === 'string') {
    try {
      payload = JSON.parse(req.body) as Record<string, unknown>
    } catch {
      res.status(400).json({ error: 'Format data tidak valid (bukan JSON).' })
      return
    }
  } else if (req.body && typeof req.body === 'object') {
    payload = req.body as Record<string, unknown>
  } else {
    res.status(400).json({ error: 'Data permintaan kosong atau tidak valid.' })
    return
  }

  const cvText = asString(payload.cvText).trim()
  const targetRole = asString(payload.targetRole).trim().slice(0, MAX_ROLE_CHARS)
  const jobDesc = asString(payload.jobDesc).trim()
  // Konteks pemeriksaan standar yang gagal (opsional): AI memperbaiki
  // temuan pemeriksa yang sedang tampil di layar pengguna.
  const failedChecks = parseFailedChecks(payload.perbaikan)
  // Konteks posisi terstruktur (opsional): hanya ada bila pengguna
  // mengisi posisi target; AI menilai dari kacamata posisi itu dengan
  // rujukan skill dari kamus situs, bukan pengetahuan umumnya.
  const roleContext = parseRoleContext(payload.konteksPosisi)

  if (cvText.length < MIN_CV_CHARS) {
    res.status(400).json({
      error: `Teks CV terlalu pendek (minimal ${MIN_CV_CHARS} karakter). Upload atau tempel CV yang lengkap dulu.`,
    })
    return
  }
  if (cvText.length > MAX_CV_CHARS) {
    res.status(400).json({
      error: `Teks CV terlalu panjang (maksimal ${MAX_CV_CHARS.toLocaleString('id-ID')} karakter). Persingkat dulu, misalnya hanya bagian utama CV.`,
    })
    return
  }
  if (jobDesc.length > MAX_JOBDESC_CHARS) {
    res.status(400).json({
      error: `Deskripsi lowongan terlalu panjang (maksimal ${MAX_JOBDESC_CHARS.toLocaleString('id-ID')} karakter). Persingkat dulu.`,
    })
    return
  }

  // Rate limit dicek SETELAH validasi body (audit 2026-11-24): sebelumnya
  // permintaan tidak valid ikut membakar kuota IP, sehingga pengguna sah
  // di IP bersama (NAT kantor/kampus) bisa kehabisan jatah oleh
  // permintaan sampah. Hanya permintaan yang lolos validasi dan akan
  // benar-benar memanggil upstream yang dihitung.
  if (isRateLimited(clientIp(req))) {
    res.status(429).json({
      error: 'Terlalu banyak permintaan analisis AI dari koneksimu. Tunggu beberapa menit lalu coba lagi.',
    })
    return
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    res.status(500).json({
      error: 'Fitur Analisis AI belum aktif: OPENROUTER_API_KEY belum terpasang di server.',
    })
    return
  }
  const model = process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free'

  // Mode streaming (body memuat "stream": true): proses berpikir model
  // diteruskan langsung ke browser sebagai event NDJSON. Semua validasi,
  // rate limit, dan pemeriksaan key di atas sudah berjalan sama seperti
  // mode biasa — error sebelum aliran dimulai dibalas JSON biasa.
  if (payload.stream === true) {
    await streamAnalysis(res, { apiKey, model, cvText, targetRole, jobDesc, checks: failedChecks, roleCtx: roleContext })
    return
  }

  const sendRequest = async (options: {
    withResponseFormat: boolean
    withReasoning: boolean
  }): Promise<Response> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
    try {
      return await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'X-Title': 'Screening CV',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildPrompt(cvText, targetRole, jobDesc, failedChecks, roleContext) },
          ],
          ...(options.withResponseFormat ? { response_format: { type: 'json_object' } } : {}),
          // Model reasoning bisa menghabiskan seluruh jatah token hanya
          // untuk berpikir (kejadian sebelumnya: penalaran 12 ribu karakter
          // memenuhi content dan JSON tidak pernah selesai). Batasi
          // effort-nya agar jawaban JSON sempat ditulis — dan beri CAP
          // token penalaran yang sama seperti jalur streaming (audit
          // 2026-11-24: jalur ini sebelumnya hanya effort low tanpa cap).
          ...(options.withReasoning
            ? { reasoning: { effort: 'low', max_tokens: 1500 } }
            : {}),
          temperature: 0.4,
          // Jatah token besar agar JSON jawaban — kini termasuk perbaikan
          // untuk semua pemeriksaan yang gagal — tidak terpotong.
          max_tokens: NONSTREAM_MAX_TOKENS,
        }),
      })
    } catch (err) {
      if (
        controller.signal.aborted ||
        (err instanceof Error && err.name === 'AbortError')
      ) {
        throw new UpstreamTimeoutError()
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  const readUpstreamMessage = async (response: Response): Promise<string> => {
    try {
      const errData = (await response.json()) as {
        error?: { code?: number | string; message?: string }
      }
      return (errData.error?.message ?? '').slice(0, 300)
    } catch {
      return ''
    }
  }

  let aiResponse: Response
  let upstreamMessage: string | null = null
  let includeResponseFormat = true
  let includeReasoning = true
  try {
    aiResponse = await sendRequest({
      withResponseFormat: includeResponseFormat,
      withReasoning: includeReasoning,
    })
    // Sebagian model menolak parameter opsional (reasoning / response_format).
    // Bila error 400 menyebut parameter yang tidak didukung, buang parameter
    // yang ditolak lalu ulangi — maksimal 2 kali pengulangan, satu jenis
    // parameter dibuang tiap kali. Error 400 lain tidak diulang dan tetap
    // dipetakan seperti biasa.
    for (let retry = 0; retry < 2 && !aiResponse.ok && aiResponse.status === 400; retry++) {
      const message400 = await readUpstreamMessage(aiResponse)
      const lower = message400.toLowerCase()
      let dropped = false
      if (includeReasoning && lower.includes('reasoning')) {
        includeReasoning = false
        dropped = true
      } else if (includeResponseFormat && /response_format|\bjson\b/.test(lower)) {
        includeResponseFormat = false
        dropped = true
      } else if (/unsupported|not supported|unknown|invalid parameter/.test(lower)) {
        // Parameter ditolak tanpa disebut namanya: buang reasoning dulu,
        // lalu response_format pada pengulangan berikutnya.
        if (includeReasoning) {
          includeReasoning = false
          dropped = true
        } else if (includeResponseFormat) {
          includeResponseFormat = false
          dropped = true
        }
      }
      if (!dropped) {
        upstreamMessage = message400
        break
      }
      aiResponse = await sendRequest({
        withResponseFormat: includeResponseFormat,
        withReasoning: includeReasoning,
      })
    }
  } catch (err) {
    if (err instanceof UpstreamTimeoutError) {
      console.error(`[analyze-ai] Timeout ${UPSTREAM_TIMEOUT_MS / 1000} detik menunggu OpenRouter`)
      res.status(502).json({
        error: 'Layanan AI terlalu lama merespons. Coba lagi — hasil analisis standar tetap bisa dipakai.',
      })
      return
    }
    res.status(502).json({
      error: 'Layanan AI sedang tidak bisa dihubungi. Coba lagi nanti — hasil analisis standar tetap bisa dipakai.',
    })
    return
  }

  if (!aiResponse.ok) {
    // Diagnosis hanya di log server (audit 2026-11-24: field "detail"
    // tidak lagi dikirim ke klien — frontend tidak pernah membacanya).
    // Yang dicatat hanya status dan pesan OpenRouter — TIDAK termasuk
    // API key, header, atau isi CV/permintaan.
    const message = upstreamMessage ?? (await readUpstreamMessage(aiResponse))
    console.error(`[analyze-ai] OpenRouter HTTP ${aiResponse.status}${message ? `: ${message}` : ''}`)

    if (aiResponse.status === 429) {
      res.status(429).json({
        error: 'Layanan AI sedang dibatasi (rate limit) atau kuota gratis sedang penuh, coba lagi nanti — hasil analisis standar tetap bisa dipakai.',
      })
      return
    }
    if (aiResponse.status === 401 || aiResponse.status === 403) {
      res.status(502).json({
        error: 'API key OpenRouter ditolak. Periksa konfigurasi OPENROUTER_API_KEY di server — hasil analisis standar tetap bisa dipakai.',
      })
      return
    }
    if (aiResponse.status === 402) {
      res.status(502).json({
        error: 'Kredit OpenRouter tidak cukup untuk menjalankan analisis AI. Isi kredit atau periksa batas pemakaian akun OpenRouter — hasil analisis standar tetap bisa dipakai.',
      })
      return
    }
    res.status(502).json({
      error: 'Layanan AI mengembalikan kesalahan. Coba lagi nanti — hasil analisis standar tetap bisa dipakai.',
    })
    return
  }

  // Pembacaan body juga dibatasi waktu (audit 2026-11-24): timer fetch
  // berhenti begitu header tiba, jadi tanpa balapan ini respons yang
  // body-nya mengalir selamanya bisa menggantung fungsi serverless.
  let data: unknown = null
  try {
    data = await Promise.race([
      aiResponse.json(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new UpstreamTimeoutError()), UPSTREAM_TIMEOUT_MS)
      }),
    ])
  } catch (err) {
    if (err instanceof UpstreamTimeoutError) {
      console.error(`[analyze-ai] Timeout ${UPSTREAM_TIMEOUT_MS / 1000} detik membaca body OpenRouter`)
      res.status(502).json({
        error: 'Layanan AI terlalu lama merespons. Coba lagi — hasil analisis standar tetap bisa dipakai.',
      })
      return
    }
    data = null
  }

  const parsed = parseAiResponse(data, failedChecks.map((c) => c.id))
  if (!parsed.result) {
    // Diagnostik parse hanya di log server: finish_reason, panjang teks
    // mentah, dan cuplikan awal JAWABAN model (bukan input CV mentah).
    const snippet = parsed.rawText.slice(0, 200)
    console.error(
      `[analyze-ai] Jawaban model tidak terparse ` +
        `(finish_reason=${parsed.finishReason || 'tidak tersedia'}; panjang=${parsed.rawText.length}; ` +
        `cuplikan: ${snippet ? `"${snippet}"` : '(kosong)'})`,
    )
    res.status(502).json({
      error: 'Jawaban AI tidak bisa dibaca. Coba lagi — hasil analisis standar tetap bisa dipakai.',
    })
    return
  }

  res.status(200).json(parsed.result)
}
