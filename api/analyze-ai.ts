// Backend Analisis AI — Vercel Serverless Function.
//
// Alur: browser → POST /api/analyze-ai → fungsi ini → OpenRouter → JSON kembali ke browser.
// API key hanya dibaca dari environment variable server (OPENROUTER_API_KEY) dan
// tidak pernah dikirim ke frontend. Isi CV hanya diteruskan ke OpenRouter untuk
// dianalisis — tidak dicatat ke log dan tidak disimpan di mana pun.

import { isDominantEnglish } from '../src/lib/analyze.js'

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

// Ukuran batch mode "fixes": satu panggilan hanya memperbaiki paling
// banyak 6 pemeriksaan. Permintaan raksasa (semua bidang + perbaikan
// untuk ±29 pemeriksaan sekaligus) berulang melewati batas waktu model
// gratis, jadi klien memecah perbaikan menjadi batch-batch kecil yang
// masing-masing jauh di bawah batas waktu (perbaikan 2026-11-26).
// Server menegakkan plafon yang sama agar pemanggil tidak bisa
// memaksa prompt raksasa lewat mode ini.
export const FIX_BATCH_SIZE = 6

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
// Batas upstream khusus panggilan terpecah (mode "core" cadangan &
// "fixes") pada jalur non-streaming: 110 detik. Bukti live 2026-11-26
// malam: model gratis aktif membutuhkan ±90–95 detik per panggilan
// berapa pun ukuran payload-nya, sehingga plafon 75 detik jalur
// non-streaming membunuh SETIAP panggilan batch (502 berulang pada
// dua run uji), sementara panggilan streaming berbatas 150 detik
// berhasil pada ±90 detik. 110 detik memberi ruang di atas kebutuhan
// teramati itu, dan kasus terburuknya (header 110 + baca body 110 =
// 220 detik) tetap di bawah batas klien 240 detik.
export const SPLIT_CALL_TIMEOUT_MS = 110_000
const NONSTREAM_MAX_TOKENS = 6500
// Jatah token per mode pada jalur non-streaming: keluaran mode "core"
// (tanpa perbaikanLengkap) dan mode "fixes" (≤6 item) jauh lebih kecil
// daripada jawaban gabungan mode "full", jadi plafonnya lebih rendah —
// model berhenti lebih cepat dan tidak menghabiskan waktu menulis
// melebihi kebutuhan panggilan itu.
const CORE_MAX_TOKENS = 5000
const FIXES_MAX_TOKENS = 5000

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
//
// Anggaran batas diselaraskan dengan pola multi-panggilan klien
// (2026-11-26): satu Analisis AI penuh kini terdiri dari 1 panggilan
// inti + batch perbaikan (@6 id; terburuk 29 pemeriksaan → 5 batch) =
// 6 permintaan, dan tiap panggilan boleh diulang sekali oleh klien →
// terburuk 12 permintaan per analisis. Batas 36 per 10 menit menampung
// ±3 analisis penuh terburuk (atau belasan analisis bersih tanpa
// pengulangan) dari satu IP — jauh di atas pemakaian manusia wajar
// (satu analisis saja memakan 1–4 menit waktu nyata) — sambil tetap
// menjadi plafon keras terhadap pembakaran kuota upstream.
export const RATE_LIMIT_MAX = 36
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

const SYSTEM_PROMPT_EN =
  'You are a career consultant. Reply ONLY with valid JSON matching the requested schema — no markdown, no code fences, no preamble or closing text. Do not invent experience, companies, or numbers that are not in the CV. Write every string value in English.'

// ---------- Bahasa keluaran mengikuti bahasa CV (2026-11-28) ----------
// Permintaan pengguna: hasil Analisis AI mengikuti bahasa yang dipakai
// CV — CV dominan bahasa Inggris dibahas seluruhnya dalam bahasa
// Inggris, selain itu tetap bahasa Indonesia seperti sebelumnya.
// Deteksi tinggal di SERVER (di sini, dari cvText yang diterima
// endpoint) agar menjadi sumber kebenaran tunggal: berlaku untuk
// semua mode (full/core/fixes) dan kedua jalur (streaming/
// non-streaming) karena prompt disusun sekali di handler, dan tab
// basi yang tidak mengirim bidang bahasa apa pun tetap terlayani —
// kontrak permintaan tidak berubah sama sekali.
// Heuristiknya BUKAN detektor baru: dipakai ulang isDominantEnglish
// dari mesin penilaian (kata fungsi; Inggris harus ≥10 kata fungsi
// DAN >2× kata fungsi Indonesia). Ambangnya konservatif — CV campuran
// atau ambigu jatuh ke 'id', perilaku lama yang aman.
export type CvLanguage = 'id' | 'en'

export function detectCvLanguage(cvText: string): CvLanguage {
  return isDominantEnglish(cvText) ? 'en' : 'id'
}

export function systemPromptFor(lang: CvLanguage): string {
  return lang === 'en' ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT
}

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

// Plafon konteks posisi pada pemakaian banyak peran — sejajar plafon
// posisi di klien/mesin penilaian (maksimal 3 posisi yang dilamar).
const MAX_ROLE_CONTEXTS = 3

// Validasi + sanitasi konteks posisi BANYAK peran (2026-11-28): klien
// baru mengirim DAFTAR konteks (satu per posisi yang dilamar), klien
// lama mengirim OBJEK TUNGGAL. Keduanya diterima — objek tunggal
// dibungkus menjadi daftar berisi satu konteks — agar tab basi yang
// belum memuat ulang tidak rusak. Tiap item dibersihkan dengan
// parseRoleContext yang sama; item tak sah dibuang satu per satu dan
// daftar dipotong ke MAX_ROLE_CONTEXTS. Hasil kosong = tanpa konteks
// (perilaku lama persis).
export function parseRoleContexts(value: unknown): RoleContext[] {
  if (Array.isArray(value)) {
    const out: RoleContext[] = []
    for (const item of value) {
      const parsed = parseRoleContext(item)
      if (parsed) out.push(parsed)
      if (out.length >= MAX_ROLE_CONTEXTS) break
    }
    return out
  }
  const single = parseRoleContext(value)
  return single ? [single] : []
}

// Normalisasi argumen konteks posisi para pembangun prompt: bentuk
// tunggal lama dan daftar baru sama-sama menjadi daftar. Satu konteks
// menghasilkan prompt yang persis sama seperti sebelum fitur banyak
// posisi ada.
function asRoleList(roleCtx: RoleContext | RoleContext[] | null): RoleContext[] {
  if (!roleCtx) return []
  return Array.isArray(roleCtx) ? roleCtx : [roleCtx]
}

// Mode panggilan Analisis AI (2026-11-26): klien memecah satu analisis
// menjadi panggilan "core" (bidang inti saja) + panggilan "fixes"
// (perbaikanLengkap per batch ≤6 id). Mode "full" adalah perilaku lama
// (satu panggilan gabungan) dan tetap menjadi bawaan agar pemanggil
// lama — termasuk tab pengguna yang belum memuat ulang — tidak rusak.
export type AiCallMode = 'full' | 'core' | 'fixes'

// Diekspor agar standar kualitas prompt (struktur saranRingkasan &
// pola kekurangan) bisa dikunci oleh uji di scripts/run-tests.ts.
export function buildPrompt(
  cvText: string,
  targetRole: string,
  jobDesc: string,
  checks: FailedCheckContext[],
  roleCtx: RoleContext | RoleContext[] | null,
  variant: 'full' | 'core' = 'full',
  lang: CvLanguage = 'id',
): string {
  // CV dominan bahasa Inggris → prompt Inggris penuh (buildPromptEn);
  // selain itu jalur Indonesia di bawah ini — perilakunya tidak berubah
  // satu kata pun dari sebelum fitur bahasa ini ada.
  if (lang === 'en') {
    return buildPromptEn(cvText, targetRole, jobDesc, checks, roleCtx, variant)
  }
  const rolePart = targetRole
    ? `\nPOSISI YANG DILAMAR: ${targetRole}\n`
    : ''
  const jobPart = jobDesc
    ? `\nDESKRIPSI LOWONGAN:\n${jobDesc}\n`
    : '\n(Tidak ada deskripsi lowongan — nilai kekurangan umum CV saja.)\n'
  const checksPart =
    variant === 'core'
      ? '\n(Perbaikan per pemeriksaan diminta pada panggilan terpisah — pada panggilan ini "perbaikanLengkap" WAJIB berupa array kosong.)\n'
      : checks.length
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
  // diturunkan dari kamus situs — bukan pengetahuan umum model. Pada
  // banyak posisi, blok yang sama dicetak sekali per posisi.
  const roleCtxs = asRoleList(roleCtx)
  const roleCtxBlock = (ctx: RoleContext): string =>
    [
      '',
      `KONTEKS POSISI "${ctx.posisi}" (dari kamus skill situs — satu-satunya rujukan skill untuk posisi ini):`,
      ...(ctx.skillDiharapkan.length
        ? [`- Skill yang diharapkan posisi ini: ${ctx.skillDiharapkan.join(', ')}`]
        : []),
      ...(ctx.skillAda.length
        ? [`- Skill posisi yang SUDAH terbukti ada di CV: ${ctx.skillAda.join(', ')}`]
        : []),
      ...(ctx.skillBelum.length
        ? [`- Skill posisi yang BELUM muncul di CV: ${ctx.skillBelum.join(', ')}`]
        : []),
      '',
    ].join('\n')
  const roleCtxPart = roleCtxs.map(roleCtxBlock).join('\n')
  // Aturan tambahan penilaian berbasis posisi (hanya bila konteks ada).
  // Satu konteks memakai rumusan lama persis; banyak konteks mewajibkan
  // penilaianPosisi berisi satu paragraf singkat PER POSISI.
  const roleNames = roleCtxs.map((c) => `"${c.posisi}"`).join(', ')
  const roleRules: string[] =
    roleCtxs.length === 0
      ? ['- "penilaianPosisi" kosongkan ("") — pengguna tidak mengisi posisi target.']
      : roleCtxs.length === 1
        ? [
            `- PENILAIAN POSISI: nilai CV ini dari kacamata posisi "${roleCtxs[0].posisi}". "ringkasan" dan "kekurangan" WAJIB menyebut secara spesifik bukti di CV yang relevan dengan posisi itu serta skill kunci posisi yang belum muncul di CV. Skill posisi yang boleh kamu sebut HANYA yang tercantum pada KONTEKS POSISI di bawah — jangan menyebut skill posisi lain di luar daftar itu dan jangan mengarang pengalaman atau angka di luar teks CV.`,
            `- "penilaianPosisi" WAJIB diisi (2–4 kalimat): bukti terkuat yang sudah ada di CV untuk posisi "${roleCtxs[0].posisi}" dan celah paling kritisnya untuk posisi itu.`,
            `- saranPenulisanUlang: gunakan kosakata dan jenis bukti yang dicari posisi "${roleCtxs[0].posisi}" (alat/metode dari daftar skill posisinya), tetap hanya menulis ulang isi CV yang benar-benar ada.`,
            ...(jobDesc
              ? ['- Deskripsi lowongan dan konteks posisi sama-sama tersedia: tuntutan deskripsi lowongan DIDAHULUKAN daripada gambaran peran umum.']
              : []),
          ]
        : [
            `- PENILAIAN POSISI: nilai CV ini dari kacamata SETIAP posisi yang dilamar: ${roleNames}. "ringkasan" dan "kekurangan" WAJIB menyebut secara spesifik bukti di CV yang relevan dengan posisi-posisi itu serta skill kunci tiap posisi yang belum muncul di CV. Skill posisi yang boleh kamu sebut HANYA yang tercantum pada KONTEKS POSISI di bawah — jangan menyebut skill posisi lain di luar daftar itu dan jangan mengarang pengalaman atau angka di luar teks CV.`,
            `- "penilaianPosisi" WAJIB diisi dengan SATU paragraf singkat (2–3 kalimat) untuk SETIAP posisi: ${roleNames} — awali tiap paragraf dengan nama posisinya dan pisahkan antarparagraf dengan baris baru. Tiap paragraf memuat bukti terkuat yang sudah ada di CV untuk posisi itu dan celah paling kritisnya untuk posisi itu.`,
            `- saranPenulisanUlang: gunakan kosakata dan jenis bukti yang dicari posisi-posisi itu (alat/metode dari daftar skill posisinya), tetap hanya menulis ulang isi CV yang benar-benar ada.`,
            ...(jobDesc
              ? ['- Deskripsi lowongan dan konteks posisi sama-sama tersedia: tuntutan deskripsi lowongan DIDAHULUKAN daripada gambaran peran umum.']
              : []),
          ]
  return [
    'Kamu adalah konsultan karier berbahasa Indonesia yang membantu pencari kerja dan fresh graduate memperbaiki CV.',
    'Analisis CV berikut dan balas HANYA dengan JSON valid (tanpa markdown, tanpa teks lain) dengan skema persis ini:',
    '{',
    '  "ringkasan": "penilaian kualitatif CV dalam 2-3 kalimat",',
    '  "saranPenulisanUlang": [ { "asli": "kalimat/poin asli dari CV", "saran": "versi penulisan ulang", "alasan": "kenapa versi baru lebih baik" } ],',
    '  "kekurangan": [ "kekurangan CV: bukti konkret di CV + mengapa merugikan + tindakan perbaikan, maksimal 6 butir" ],',
    '  "saranRingkasan": "contoh ringkasan profil JADI 3-4 kalimat siap tempel, mengikuti struktur ringkasan wajib di bawah",',
    roleCtxs.length === 1
      ? '  "penilaianPosisi": "penilaian kecocokan CV dengan posisi target dalam 2-4 kalimat: bukti terkuat yang sudah ada + celah paling kritis untuk posisi itu",'
      : roleCtxs.length > 1
        ? '  "penilaianPosisi": "penilaian kecocokan CV untuk SETIAP posisi target, satu paragraf singkat per posisi yang diawali nama posisinya: bukti terkuat yang sudah ada + celah paling kritis untuk posisi itu",'
        : '  "penilaianPosisi": "",',
    variant === 'core'
      ? '  "perbaikanLengkap": []'
      : '  "perbaikanLengkap": [ { "idPemeriksaan": "id pemeriksaan persis seperti pada daftar di bawah", "judul": "nama pemeriksaan", "sebelum": "kutipan asli dari CV yang diperbaiki — kosongkan bila masalahnya sesuatu yang belum ada di CV", "sesudah": "versi perbaikan JADI yang siap disalin pengguna", "catatan": "penjelasan singkat 1 kalimat" } ]',
    '}',
    '',
    'Aturan ketat:',
    '- saranPenulisanUlang: ambil maksimal 5 poin dari bagian pengalaman CV. Tulis ulang dengan kata kerja aksi yang kuat dan struktur pencapaian.',
    ...(variant === 'core'
      ? []
      : [
          '- perbaikanLengkap: buat SATU item untuk SETIAP pemeriksaan pada daftar "PEMERIKSAAN STANDAR YANG GAGAL" di bawah — tidak boleh ada yang terlewat dan jangan menambah pemeriksaan di luar daftar itu. Urutannya sama seperti daftar.',
          '- "sesudah" pada perbaikanLengkap harus teks FINAL yang utuh dan siap disalin ke CV, ditulis dari teks pengguna sendiri — bukan contoh umum dan bukan placeholder umum. Placeholder kurung siku HANYA untuk fakta yang memang tidak ada di CV (angka pencapaian, nama, tanggal) dan harus spesifik, mis. [jumlah dokumen yang diproses per bulan], bukan [angka].',
          '- Bila masalahnya sesuatu yang BELUM ADA di CV (mis. belum ada tautan LinkedIn, sertifikasi, atau bagian yang hilang): "sebelum" dikosongkan dan "sesudah" berisi templat konkret yang siap diisi pengguna (format persisnya) + di "catatan" satu kalimat cara mengisinya.',
          '- "sebelum" pada perbaikanLengkap: pakai kutipan yang tercantum pada daftar pemeriksaan bila ada; bila tidak ada, ambil kalimat/bagian CV yang persis diperbaiki; kosongkan hanya untuk masalah ketiadaan.',
          '- Jaga setiap item perbaikanLengkap ringkas: "sesudah" maksimal sekitar 3 baris/kalimat, "catatan" 1 kalimat. Jawaban memuat banyak item, jadi jangan bertele-tele.',
        ]),
    '- JANGAN mengarang pengalaman, perusahaan, atau angka baru. Bila angka pencapaian tidak ada di CV, pakai placeholder seperti [X%], [jumlah], atau [angka] di dalam saran, dan jelaskan di alasan bahwa pengguna harus mengisi angka aslinya sendiri.',
    '- kekurangan: SETIAP butir wajib berpola tiga unsur: (1) SPESIFIK — tunjuk bagian/bukti konkret pada CV yang dimaksud (nama bagian, entri pengalaman, atau periode tertentu), bukan kalimat umum yang bisa menempel ke CV mana pun; (2) ALASAN — jelaskan mengapa hal itu merugikan di mata perekrut' +
      (roleCtxs.length ? ', terutama untuk posisi target' : '') +
      '; (3) TINDAKAN — akhiri dengan arahan perbaikan konkret yang bisa langsung dilakukan pengguna.',
    jobDesc
      ? '- kekurangan menilai kesenjangan (gap) CV terhadap deskripsi lowongan secara MAKNA — skill/pengalaman yang dituntut lowongan tapi belum tampak di CV, bukan sekadar daftar kata kunci yang hilang.'
      : '- kekurangan menilai celah kualitatif CV (struktur, kejelasan, bukti pencapaian, kelengkapan bagian).',
    '- kekurangan adalah celah kualitatif — JANGAN mengulang persis isi "perbaikanLengkap": bila topiknya sama, kekurangan membahas bukti dan dampaknya saja, karena versi perbaikan jadinya sudah ditulis di perbaikanLengkap.',
    '- saranRingkasan: tulis ringkasan profil JADI yang siap ditempel pengguna ke CV, 3–4 kalimat, dengan alur WAJIB: (1) kualifikasi terkuat lebih dulu — pendidikan terakhir dan/atau pengalaman utama, sertakan IPK atau lama pengalaman bila ada di CV; (2) keterampilan inti yang disertai bukti/alat konkret dari CV (nama perangkat lunak, metode, atau teknologi yang benar-benar tertulis); (3) pencapaian, proyek, atau publikasi paling menonjol dari CV; (4) posisi yang dituju (posisi target bila diisi, selain itu bidang pekerjaan dari isi CV) + nilai konkret yang ditawarkan ke pemberi kerja, dirumuskan dari keterampilan yang terbukti di CV.',
    '- saranRingkasan hanya memakai fakta dari teks CV — jangan menambah klaim, pengalaman, atau angka baru; fakta penting yang memang tidak ada di CV ditulis sebagai placeholder kurung siku yang spesifik (mis. [IPK], [nama sertifikasi]).',
    '- saranRingkasan TANPA frasa lemah/klise: dilarang klaim sifat tanpa bukti seperti "pekerja keras", "mampu bekerja di bawah tekanan", "dapat bekerja dalam tim", "bersedia ditempatkan di mana saja", "bertanggung jawab atas", atau "semangat belajar tinggi" — ganti dengan bukti konkret dari CV.',
    '- Gaya saranRingkasan: profesional dengan subjek tersirat (tanpa kata ganti "saya" yang berulang di tiap kalimat), dan kosakata disesuaikan dengan posisi target bila konteks posisi tersedia.',
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

// Padanan bahasa Inggris buildPrompt (2026-11-28): standar kualitasnya
// SAMA PERSIS dengan versi Indonesia — alur 4 langkah saranRingkasan,
// pola tiga unsur kekurangan (spesifik + alasan + tindakan), anti-klise
// (daftar frasa lemah Inggris), anti-karang, dan placeholder spesifik
// untuk fakta absen — hanya bahasanya yang berbeda. Nama kunci JSON
// dan skemanya identik. Konteks yang dikirim situs (nama pemeriksaan,
// temuan pemeriksa, label konteks posisi) berbahasa Indonesia karena
// itu bahasa antarmuka; prompt menegaskan konteks itu hanya bahan
// bacaan dan SELURUH keluaran wajib bahasa Inggris.
function buildPromptEn(
  cvText: string,
  targetRole: string,
  jobDesc: string,
  checks: FailedCheckContext[],
  roleCtx: RoleContext | RoleContext[] | null,
  variant: 'full' | 'core' = 'full',
): string {
  const rolePart = targetRole
    ? `\nTARGET POSITION APPLIED FOR: ${targetRole}\n`
    : ''
  const jobPart = jobDesc
    ? `\nJOB DESCRIPTION:\n${jobDesc}\n`
    : '\n(No job description provided — assess general CV shortcomings only.)\n'
  const checksPart =
    variant === 'core'
      ? '\n(Per-check fixes are requested in a separate call — in this call "perbaikanLengkap" MUST be an empty array.)\n'
      : checks.length
        ? [
            '',
            'FAILED STANDARD CHECKS (findings of the site scoring engine on this CV — fix ALL of them in "perbaikanLengkap"). The check names and findings below are written in Indonesian (the site interface language): understand them, but write your output in English:',
            ...checks.map((c, i) => {
              const lines = [`${i + 1}. [id: ${c.id}] ${c.judul}`]
              if (c.pesan) lines.push(`   Checker finding: ${c.pesan}`)
              if (c.kutipan) lines.push(`   Quote from the user's CV: "${c.kutipan}"`)
              return lines.join('\n')
            }),
            '',
          ].join('\n')
        : '\n(No list of failed checks was provided — "perbaikanLengkap" may be an empty array.)\n'
  // Role context block: the model's ONLY skill reference for the role,
  // derived from the site's dictionary — not the model's general knowledge.
  // With several roles, the same block is printed once per role.
  const roleCtxs = asRoleList(roleCtx)
  const roleCtxBlock = (ctx: RoleContext): string =>
    [
      '',
      `ROLE CONTEXT "${ctx.posisi}" (from the site's skill dictionary — the only skill reference for this role):`,
      ...(ctx.skillDiharapkan.length
        ? [`- Skills expected for this role: ${ctx.skillDiharapkan.join(', ')}`]
        : []),
      ...(ctx.skillAda.length
        ? [`- Role skills ALREADY evidenced in the CV: ${ctx.skillAda.join(', ')}`]
        : []),
      ...(ctx.skillBelum.length
        ? [`- Role skills NOT yet appearing in the CV: ${ctx.skillBelum.join(', ')}`]
        : []),
      '',
    ].join('\n')
  const roleCtxPart = roleCtxs.map(roleCtxBlock).join('\n')
  // Extra role-based assessment rules (only when role context exists).
  // One context keeps the exact previous wording; several contexts
  // require penilaianPosisi to hold one short paragraph PER ROLE.
  const roleNames = roleCtxs.map((c) => `"${c.posisi}"`).join(', ')
  const roleRules: string[] =
    roleCtxs.length === 0
      ? ['- Leave "penilaianPosisi" empty ("") — the user did not provide a target position.']
      : roleCtxs.length === 1
        ? [
            `- ROLE ASSESSMENT: judge this CV through the lens of the "${roleCtxs[0].posisi}" role. "ringkasan" and "kekurangan" MUST specifically name the CV evidence relevant to that role and the key role skills not yet appearing in the CV. The ONLY role skills you may name are those listed in the ROLE CONTEXT below — never name role skills outside that list and never invent experience or numbers beyond the CV text.`,
            `- "penilaianPosisi" MUST be filled (2–4 sentences): the strongest evidence already in the CV for the "${roleCtxs[0].posisi}" role and its most critical gap for that role.`,
            `- saranPenulisanUlang: use the vocabulary and the kinds of evidence the "${roleCtxs[0].posisi}" role looks for (tools/methods from its skill list), while only rewriting content that truly exists in the CV.`,
            ...(jobDesc
              ? ['- Both a job description and role context are available: the demands of the job description take PRECEDENCE over the general role picture.']
              : []),
          ]
        : [
            `- ROLE ASSESSMENT: judge this CV through the lens of EACH role applied for: ${roleNames}. "ringkasan" and "kekurangan" MUST specifically name the CV evidence relevant to those roles and the key skills of each role not yet appearing in the CV. The ONLY role skills you may name are those listed in the ROLE CONTEXT below — never name role skills outside that list and never invent experience or numbers beyond the CV text.`,
            `- "penilaianPosisi" MUST be filled with ONE short paragraph (2–3 sentences) for EACH role: ${roleNames} — start each paragraph with the role's name and separate the paragraphs with a new line. Each paragraph gives the strongest evidence already in the CV for that role and its most critical gap for that role.`,
            `- saranPenulisanUlang: use the vocabulary and the kinds of evidence those roles look for (tools/methods from their skill lists), while only rewriting content that truly exists in the CV.`,
            ...(jobDesc
              ? ['- Both a job description and role context are available: the demands of the job description take PRECEDENCE over the general role picture.']
              : []),
          ]
  return [
    'You are a career consultant who helps job seekers and fresh graduates improve their CVs.',
    'Analyze the following CV and reply ONLY with valid JSON (no markdown, no other text) with exactly this schema:',
    '{',
    '  "ringkasan": "a qualitative assessment of the CV in 2-3 sentences",',
    '  "saranPenulisanUlang": [ { "asli": "the original sentence/bullet from the CV", "saran": "the rewritten version", "alasan": "why the new version is better" } ],',
    '  "kekurangan": [ "a CV shortcoming: concrete evidence in the CV + why it hurts + a fix action, maximum 6 items" ],',
    '  "saranRingkasan": "a FINISHED sample profile summary of 3-4 sentences, ready to paste, following the mandatory summary structure below",',
    roleCtxs.length === 1
      ? '  "penilaianPosisi": "an assessment of how the CV fits the target role in 2-4 sentences: the strongest evidence already present + the most critical gap for that role",'
      : roleCtxs.length > 1
        ? '  "penilaianPosisi": "an assessment of how the CV fits EACH target role, one short paragraph per role starting with the role name: the strongest evidence already present + the most critical gap for that role",'
        : '  "penilaianPosisi": "",',
    variant === 'core'
      ? '  "perbaikanLengkap": []'
      : '  "perbaikanLengkap": [ { "idPemeriksaan": "the exact check id from the list below", "judul": "the check name, written in English", "sebelum": "the original quote from the CV being fixed — leave empty when the problem is something missing from the CV", "sesudah": "the FINISHED fixed version, ready for the user to copy into their CV", "catatan": "a brief note of 1 sentence" } ]',
    '}',
    '',
    'Strict rules:',
    '- saranPenulisanUlang: take at most 5 bullets from the CV experience section. Rewrite them with strong action verbs and an achievement structure.',
    ...(variant === 'core'
      ? []
      : [
          '- perbaikanLengkap: create ONE item for EVERY check in the "FAILED STANDARD CHECKS" list below — none may be skipped and do not add checks outside that list. Keep the same order as the list.',
          '- "sesudah" in perbaikanLengkap must be the complete FINAL text, ready to copy into the CV, written from the user\'s own text — not a generic example and not a generic placeholder. Bracketed placeholders are ONLY for facts genuinely absent from the CV (achievement figures, names, dates) and must be specific, e.g. [number of documents processed per month], not [number].',
          '- When the problem is something NOT YET in the CV (e.g. no LinkedIn link, no certification, or a missing section): leave "sebelum" empty and make "sesudah" a concrete fill-in template (its exact format) + use "catatan" for one sentence on how to fill it in.',
          '- "sebelum" in perbaikanLengkap: use the quote given in the check list when there is one; otherwise take the exact CV sentence/part being fixed; leave it empty only for absence problems.',
          '- Keep every perbaikanLengkap item concise: "sesudah" at most about 3 lines/sentences, "catatan" 1 sentence. The answer contains many items, so do not ramble.',
        ]),
    '- NEVER invent experience, companies, or new numbers. When an achievement figure is not in the CV, use a placeholder such as [X%], [number], or [figure] inside the suggestion, and explain in "alasan" that the user must fill in their own real number.',
    '- kekurangan: EVERY item must follow a three-part pattern: (1) SPECIFIC — point to the concrete part/evidence in the CV in question (a section name, an experience entry, or a specific period), not a generic sentence that could stick to any CV; (2) REASON — explain why it hurts in recruiters\' eyes' +
      (roleCtxs.length ? ', especially for the target role' : '') +
      '; (3) ACTION — end with a concrete fix the user can carry out right away.',
    jobDesc
      ? '- kekurangan assesses the gap between the CV and the job description by MEANING — skills/experience the job demands but the CV does not yet show, not merely a list of missing keywords.'
      : '- kekurangan assesses qualitative CV gaps (structure, clarity, achievement evidence, section completeness).',
    '- kekurangan covers qualitative gaps — do NOT repeat the exact content of "perbaikanLengkap": when the topic is the same, kekurangan discusses only the evidence and its impact, because the finished fix is already written in perbaikanLengkap.',
    '- saranRingkasan: write a FINISHED profile summary the user can paste straight into their CV, 3–4 sentences, with this MANDATORY flow: (1) the strongest qualification first — latest education and/or main experience, including GPA or years of experience when present in the CV; (2) core skills backed by concrete evidence/tools from the CV (software, methods, or technologies actually written there); (3) the most standout achievement, project, or publication from the CV; (4) the position sought (the target role when provided, otherwise the field of work from the CV content) + the concrete value offered to the employer, phrased from skills proven in the CV.',
    '- saranRingkasan uses ONLY facts from the CV text — add no new claims, experience, or numbers; important facts that are genuinely absent from the CV are written as specific bracketed placeholders (e.g. [GPA], [certification name]).',
    '- saranRingkasan with NO weak phrases/clichés: unevidenced trait claims are forbidden, such as "hard worker", "able to work under pressure", "team player", "willing to be placed anywhere", "responsible for", or "fast learner" — replace them with concrete evidence from the CV.',
    '- saranRingkasan style: professional with an implied subject (without repeating the pronoun "I" in every sentence), and vocabulary tailored to the target role when role context is available.',
    ...roleRules,
    '- Write the ENTIRE response in clear, supportive English — every string value without exception, including "judul" and "catatan". Because the CV is in English, every rewritten and fixed version ("saran", "sesudah", "saranRingkasan") must be in English too, ready to paste. The context labels above may be in Indonesian; never answer in Indonesian and never mix languages.',
    rolePart,
    roleCtxPart,
    jobPart,
    checksPart,
    'CV TEXT:',
    cvText,
  ].join('\n')
}

// Prompt khusus mode "fixes": SATU panggilan hanya menulis
// perbaikanLengkap untuk satu batch kecil pemeriksaan (≤ FIX_BATCH_SIZE
// id). Tanpa bidang inti sama sekali — keluaran kecil inilah yang
// membuat panggilan ini jauh lebih ringan daripada prompt gabungan
// dan selesai jauh di bawah batas waktu model. Aturan kualitas itemnya
// sama persis dengan aturan perbaikanLengkap pada prompt gabungan.
export function buildFixPrompt(
  cvText: string,
  targetRole: string,
  checks: FailedCheckContext[],
  roleCtx: RoleContext | RoleContext[] | null,
  lang: CvLanguage = 'id',
): string {
  // CV dominan bahasa Inggris → prompt batch Inggris (buildFixPromptEn);
  // selain itu jalur Indonesia di bawah ini, tidak berubah sama sekali.
  if (lang === 'en') {
    return buildFixPromptEn(cvText, targetRole, checks, roleCtx)
  }
  const rolePart = targetRole
    ? `\nPOSISI YANG DILAMAR: ${targetRole}\n`
    : ''
  const checksPart = [
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
  // Konteks posisi ikut serta agar kosakata perbaikan mengikuti posisi
  // yang dilamar — rujukan skillnya tetap HANYA daftar dari kamus ini.
  // Pada banyak posisi, blok yang sama dicetak sekali per posisi.
  const roleCtxs = asRoleList(roleCtx)
  const roleCtxBlock = (ctx: RoleContext): string =>
    [
      '',
      `KONTEKS POSISI "${ctx.posisi}" (dari kamus skill situs — satu-satunya rujukan skill untuk posisi ini):`,
      ...(ctx.skillDiharapkan.length
        ? [`- Skill yang diharapkan posisi ini: ${ctx.skillDiharapkan.join(', ')}`]
        : []),
      ...(ctx.skillAda.length
        ? [`- Skill posisi yang SUDAH terbukti ada di CV: ${ctx.skillAda.join(', ')}`]
        : []),
      ...(ctx.skillBelum.length
        ? [`- Skill posisi yang BELUM muncul di CV: ${ctx.skillBelum.join(', ')}`]
        : []),
      '',
    ].join('\n')
  const roleCtxPart = roleCtxs.map(roleCtxBlock).join('\n')
  const roleNames = roleCtxs.map((c) => `"${c.posisi}"`).join(', ')
  return [
    'Kamu adalah konsultan karier berbahasa Indonesia yang membantu pencari kerja dan fresh graduate memperbaiki CV.',
    'Tulis HANYA versi perbaikan jadi untuk daftar pemeriksaan di bawah, dan balas HANYA dengan JSON valid (tanpa markdown, tanpa teks lain) dengan skema persis ini:',
    '{',
    '  "perbaikanLengkap": [ { "idPemeriksaan": "id pemeriksaan persis seperti pada daftar di bawah", "judul": "nama pemeriksaan", "sebelum": "kutipan asli dari CV yang diperbaiki — kosongkan bila masalahnya sesuatu yang belum ada di CV", "sesudah": "versi perbaikan JADI yang siap disalin pengguna", "catatan": "penjelasan singkat 1 kalimat" } ]',
    '}',
    '',
    'Aturan ketat:',
    '- perbaikanLengkap: buat SATU item untuk SETIAP pemeriksaan pada daftar "PEMERIKSAAN STANDAR YANG GAGAL" di bawah — tidak boleh ada yang terlewat dan jangan menambah pemeriksaan di luar daftar itu. Urutannya sama seperti daftar.',
    '- "sesudah" pada perbaikanLengkap harus teks FINAL yang utuh dan siap disalin ke CV, ditulis dari teks pengguna sendiri — bukan contoh umum dan bukan placeholder umum. Placeholder kurung siku HANYA untuk fakta yang memang tidak ada di CV (angka pencapaian, nama, tanggal) dan harus spesifik, mis. [jumlah dokumen yang diproses per bulan], bukan [angka].',
    '- Bila masalahnya sesuatu yang BELUM ADA di CV (mis. belum ada tautan LinkedIn, sertifikasi, atau bagian yang hilang): "sebelum" dikosongkan dan "sesudah" berisi templat konkret yang siap diisi pengguna (format persisnya) + di "catatan" satu kalimat cara mengisinya.',
    '- "sebelum" pada perbaikanLengkap: pakai kutipan yang tercantum pada daftar pemeriksaan bila ada; bila tidak ada, ambil kalimat/bagian CV yang persis diperbaiki; kosongkan hanya untuk masalah ketiadaan.',
    '- Jaga setiap item perbaikanLengkap ringkas: "sesudah" maksimal sekitar 3 baris/kalimat, "catatan" 1 kalimat.',
    '- JANGAN mengarang pengalaman, perusahaan, atau angka baru. Bila angka pencapaian tidak ada di CV, pakai placeholder seperti [X%], [jumlah], atau [angka] di dalam "sesudah".',
    ...(roleCtxs.length === 1
      ? [
          `- Kosakata dan jenis bukti pada perbaikan mengikuti posisi "${roleCtxs[0].posisi}"; skill posisi yang boleh kamu sebut HANYA yang tercantum pada KONTEKS POSISI di bawah.`,
        ]
      : roleCtxs.length > 1
        ? [
            `- Kosakata dan jenis bukti pada perbaikan mengikuti posisi-posisi yang dilamar (${roleNames}); skill posisi yang boleh kamu sebut HANYA yang tercantum pada KONTEKS POSISI di bawah.`,
          ]
        : []),
    '- Seluruh jawaban dalam Bahasa Indonesia yang jelas dan suportif.',
    rolePart,
    roleCtxPart,
    checksPart,
    'TEKS CV:',
    cvText,
  ].join('\n')
}

// Padanan bahasa Inggris buildFixPrompt (2026-11-28): aturan kualitas
// itemnya sama persis dengan versi Indonesia; konteks pemeriksaan dari
// situs tetap berbahasa Indonesia (bahasa antarmuka) sebagai bahan
// bacaan, keluaran wajib seluruhnya bahasa Inggris.
function buildFixPromptEn(
  cvText: string,
  targetRole: string,
  checks: FailedCheckContext[],
  roleCtx: RoleContext | RoleContext[] | null,
): string {
  const rolePart = targetRole
    ? `\nTARGET POSITION APPLIED FOR: ${targetRole}\n`
    : ''
  const checksPart = [
    '',
    'FAILED STANDARD CHECKS (findings of the site scoring engine on this CV — fix ALL of them in "perbaikanLengkap"). The check names and findings below are written in Indonesian (the site interface language): understand them, but write your output in English:',
    ...checks.map((c, i) => {
      const lines = [`${i + 1}. [id: ${c.id}] ${c.judul}`]
      if (c.pesan) lines.push(`   Checker finding: ${c.pesan}`)
      if (c.kutipan) lines.push(`   Quote from the user's CV: "${c.kutipan}"`)
      return lines.join('\n')
    }),
    '',
  ].join('\n')
  // Role context joins in so the fixes' vocabulary follows the applied
  // role — its skill reference remains ONLY this dictionary list.
  // With several roles, the same block is printed once per role.
  const roleCtxs = asRoleList(roleCtx)
  const roleCtxBlock = (ctx: RoleContext): string =>
    [
      '',
      `ROLE CONTEXT "${ctx.posisi}" (from the site's skill dictionary — the only skill reference for this role):`,
      ...(ctx.skillDiharapkan.length
        ? [`- Skills expected for this role: ${ctx.skillDiharapkan.join(', ')}`]
        : []),
      ...(ctx.skillAda.length
        ? [`- Role skills ALREADY evidenced in the CV: ${ctx.skillAda.join(', ')}`]
        : []),
      ...(ctx.skillBelum.length
        ? [`- Role skills NOT yet appearing in the CV: ${ctx.skillBelum.join(', ')}`]
        : []),
      '',
    ].join('\n')
  const roleCtxPart = roleCtxs.map(roleCtxBlock).join('\n')
  const roleNames = roleCtxs.map((c) => `"${c.posisi}"`).join(', ')
  return [
    'You are a career consultant who helps job seekers and fresh graduates improve their CVs.',
    'Write ONLY the finished fix versions for the checks below, and reply ONLY with valid JSON (no markdown, no other text) with exactly this schema:',
    '{',
    '  "perbaikanLengkap": [ { "idPemeriksaan": "the exact check id from the list below", "judul": "the check name, written in English", "sebelum": "the original quote from the CV being fixed — leave empty when the problem is something missing from the CV", "sesudah": "the FINISHED fixed version, ready for the user to copy into their CV", "catatan": "a brief note of 1 sentence" } ]',
    '}',
    '',
    'Strict rules:',
    '- perbaikanLengkap: create ONE item for EVERY check in the "FAILED STANDARD CHECKS" list below — none may be skipped and do not add checks outside that list. Keep the same order as the list.',
    '- "sesudah" in perbaikanLengkap must be the complete FINAL text, ready to copy into the CV, written from the user\'s own text — not a generic example and not a generic placeholder. Bracketed placeholders are ONLY for facts genuinely absent from the CV (achievement figures, names, dates) and must be specific, e.g. [number of documents processed per month], not [number].',
    '- When the problem is something NOT YET in the CV (e.g. no LinkedIn link, no certification, or a missing section): leave "sebelum" empty and make "sesudah" a concrete fill-in template (its exact format) + use "catatan" for one sentence on how to fill it in.',
    '- "sebelum" in perbaikanLengkap: use the quote given in the check list when there is one; otherwise take the exact CV sentence/part being fixed; leave it empty only for absence problems.',
    '- Keep every perbaikanLengkap item concise: "sesudah" at most about 3 lines/sentences, "catatan" 1 sentence.',
    '- NEVER invent experience, companies, or new numbers. When an achievement figure is not in the CV, use a placeholder such as [X%], [number], or [figure] inside "sesudah".',
    ...(roleCtxs.length === 1
      ? [
          `- The vocabulary and kinds of evidence in the fixes follow the "${roleCtxs[0].posisi}" role; the ONLY role skills you may name are those listed in the ROLE CONTEXT below.`,
        ]
      : roleCtxs.length > 1
        ? [
            `- The vocabulary and kinds of evidence in the fixes follow the roles applied for (${roleNames}); the ONLY role skills you may name are those listed in the ROLE CONTEXT below.`,
          ]
        : []),
    '- Write the ENTIRE response in clear, supportive English — every string value without exception, including "judul" and "catatan". Because the CV is in English, every fixed version ("sesudah") must be in English too, ready to paste. The context labels above may be in Indonesian; never answer in Indonesian and never mix languages.',
    rolePart,
    roleCtxPart,
    checksPart,
    'CV TEXT:',
    cvText,
  ].join('\n')
}

// Membentuk hasil akhir sesuai mode panggilan: mode "core" tidak boleh
// membawa perbaikan (klien memintanya terpisah), dan mode "fixes" hanya
// membawa perbaikanLengkap — bidang lain dikosongkan agar klien tidak
// mencampur keluaran dua panggilan.
export function shapeResultForMode(result: AiResult, mode: AiCallMode): AiResult {
  if (mode === 'core') return { ...result, perbaikanLengkap: [] }
  if (mode === 'fixes') {
    return {
      ringkasan: '',
      saranPenulisanUlang: [],
      kekurangan: [],
      saranRingkasan: '',
      perbaikanLengkap: result.perbaikanLengkap,
      penilaianPosisi: '',
    }
  }
  return result
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
  // Prompt sudah disusun pemanggil sesuai mode panggilan (core/fixes/
  // full) — jalur aliran hanya meneruskannya ke upstream.
  promptText: string
  // System prompt mengikuti bahasa CV (systemPromptFor di handler).
  systemPrompt: string
  // Id pemeriksaan yang diminta pada panggilan ini (untuk rekonsiliasi
  // perbaikanLengkap); kosong pada mode "core".
  requestedFixIds: string[]
  mode: AiCallMode
}

// Menjalankan analisis dalam mode streaming: meneruskan penalaran model
// sebagai event NDJSON begitu tiba, lalu satu event hasil di akhir.
// Semua error SEBELUM aliran dimulai (key, upstream HTTP, timeout awal)
// sudah ditangani pemanggil / fase fetch di sini dengan respons JSON biasa;
// fungsi ini hanya dipanggil setelah validasi lolos dan aliran adalah
// satu-satunya keluaran yang tersisa untuk kegagalan di tengah proses.
async function streamAnalysis(res: AiResponse, opts: StreamOptions): Promise<void> {
  const { apiKey, model, promptText, systemPrompt, requestedFixIds, mode } = opts
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
            { role: 'system', content: systemPrompt },
            { role: 'user', content: promptText },
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

  let result = contentAll ? parseAiJson(contentAll, requestedFixIds) : null
  if (!result && reasoningAll) result = parseAiJson(reasoningAll, requestedFixIds)
  if (result) {
    send({ type: 'result', data: shapeResultForMode(result, mode) })
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
  // rujukan skill dari kamus situs, bukan pengetahuan umumnya. Kini
  // berupa daftar (satu konteks per posisi yang dilamar); bentuk objek
  // tunggal dari klien lama tetap diterima (lihat parseRoleContexts).
  const roleContexts = parseRoleContexts(payload.konteksPosisi)

  // Mode panggilan (2026-11-26): klien memecah analisis menjadi
  // panggilan "core" (bidang inti, tanpa perbaikanLengkap) dan
  // panggilan "fixes" (perbaikanLengkap untuk satu batch ≤6 id),
  // karena satu panggilan gabungan raksasa berulang melewati batas
  // waktu model gratis. Nilai lain/tidak ada → "full" (perilaku lama).
  const mode: AiCallMode =
    payload.mode === 'core' || payload.mode === 'fixes' ? payload.mode : 'full'
  // Pemeriksaan efektif per mode: core tidak membawa daftar sama
  // sekali; fixes ditegakkan ke satu batch (plafon FIX_BATCH_SIZE)
  // walau pemanggil mengirim lebih.
  const effectiveChecks =
    mode === 'core' ? [] : mode === 'fixes' ? failedChecks.slice(0, FIX_BATCH_SIZE) : failedChecks
  if (mode === 'fixes' && effectiveChecks.length === 0) {
    res.status(400).json({
      error: 'Mode perbaikan memerlukan daftar pemeriksaan yang gagal (bidang "perbaikan").',
    })
    return
  }
  const requestedFixIds = effectiveChecks.map((c) => c.id)
  // Bahasa keluaran mengikuti bahasa CV (2026-11-28): dideteksi di
  // server dari cvText (lihat detectCvLanguage) dan menggerakkan
  // prompt + system prompt untuk SEMUA mode dan kedua jalur — klien
  // tidak mengirim bidang bahasa apa pun.
  const lang = detectCvLanguage(cvText)
  const systemPrompt = systemPromptFor(lang)
  const promptText =
    mode === 'fixes'
      ? buildFixPrompt(cvText, targetRole, effectiveChecks, roleContexts, lang)
      : buildPrompt(cvText, targetRole, jobDesc, effectiveChecks, roleContexts, mode === 'core' ? 'core' : 'full', lang)
  const maxTokens =
    mode === 'core' ? CORE_MAX_TOKENS : mode === 'fixes' ? FIXES_MAX_TOKENS : NONSTREAM_MAX_TOKENS
  // Panggilan terpecah memakai batas upstream yang lebih longgar
  // (lihat SPLIT_CALL_TIMEOUT_MS); mode "full" mempertahankan 75 detik.
  const upstreamTimeoutMs = mode === 'full' ? UPSTREAM_TIMEOUT_MS : SPLIT_CALL_TIMEOUT_MS

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
    await streamAnalysis(res, { apiKey, model, promptText, systemPrompt, requestedFixIds, mode })
    return
  }

  const sendRequest = async (options: {
    withResponseFormat: boolean
    withReasoning: boolean
  }): Promise<Response> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), upstreamTimeoutMs)
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
            { role: 'system', content: systemPrompt },
            { role: 'user', content: promptText },
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
          // Jatah token mengikuti mode: jawaban gabungan mode "full"
          // (termasuk perbaikan untuk semua pemeriksaan yang gagal)
          // paling besar; keluaran core/fixes jauh lebih kecil.
          max_tokens: maxTokens,
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
      console.error(`[analyze-ai] Timeout ${upstreamTimeoutMs / 1000} detik menunggu OpenRouter`)
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
        setTimeout(() => reject(new UpstreamTimeoutError()), upstreamTimeoutMs)
      }),
    ])
  } catch (err) {
    if (err instanceof UpstreamTimeoutError) {
      console.error(`[analyze-ai] Timeout ${upstreamTimeoutMs / 1000} detik membaca body OpenRouter`)
      res.status(502).json({
        error: 'Layanan AI terlalu lama merespons. Coba lagi — hasil analisis standar tetap bisa dipakai.',
      })
      return
    }
    data = null
  }

  const parsed = parseAiResponse(data, requestedFixIds)
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

  res.status(200).json(shapeResultForMode(parsed.result, mode))
}
