// Klien untuk backend Analisis AI (POST /api/analyze-ai → OpenRouter).
// Dipakai hanya bila pengguna mencentang persetujuan pengiriman teks CV.
import type { AnalysisResult } from './analyze'
import type { PersonalExample } from './personalExamples'
import { checkSkills, getRoleSkills } from './examples'

export interface AiRewrite {
  asli: string
  saran: string
  alasan: string
}

// Satu item "Perbaikan Lengkap dari AI": versi perbaikan JADI untuk satu
// pemeriksaan standar yang gagal — siap disalin pengguna ke CV-nya.
export interface AiFix {
  idPemeriksaan: string
  judul: string
  sebelum: string
  sesudah: string
  catatan: string
}

export interface AiAnalysis {
  ringkasan: string
  saranPenulisanUlang: AiRewrite[]
  kekurangan: string[]
  saranRingkasan: string
  perbaikanLengkap: AiFix[]
  // Penilaian kecocokan CV dengan posisi target (2–4 kalimat). Diisi
  // model hanya bila konteks posisi dikirim; string kosong bila tidak
  // ada posisi atau model tidak mengisinya — bidang ini OPSIONAL dan
  // ketiadaannya tidak menggagalkan hasil (lihat validateAiAnalysis).
  penilaianPosisi: string
}

// Konteks posisi terstruktur, diturunkan dari kamus situs sendiri agar
// AI menilai dari kacamata posisi yang dilamar — bukan menebak skill
// posisi dari pengetahuan umumnya. "posisi" adalah label tampilan yang
// sama persis dengan judul kartu Daftar Skill (termasuk perluasan
// glosarium, mis. "QC" → "Quality Control"); pemilahan skill ada/belum
// memakai checkSkills yang sama dengan kartu itu, jadi konsisten.
export interface AiRoleContext {
  posisi: string
  skillDiharapkan: string[]
  skillAda: string[]
  skillBelum: string[]
}

// Susun konteks posisi dari posisi target + teks CV yang dianalisis.
// Posisi kosong → null (tidak ada konteks; perilaku lama persis).
export function buildAiRoleContext(cvText: string, targetRole: string): AiRoleContext | null {
  if (!targetRole.trim()) return null
  const roleSkills = getRoleSkills(targetRole)
  const status = checkSkills(cvText, roleSkills.skills)
  return {
    posisi: roleSkills.label,
    skillDiharapkan: roleSkills.skills,
    skillAda: status.filter((s) => s.present).map((s) => s.skill),
    skillBelum: status.filter((s) => !s.present).map((s) => s.skill),
  }
}

// Konteks satu pemeriksaan standar yang gagal, dikirim ke backend agar
// AI memperbaiki temuan pemeriksa yang sedang tampil — bukan menebak
// ulang. Kutipan diisi dari contoh personal (CV pengguna sendiri) bila ada.
export interface AiCheckContext {
  id: string
  judul: string
  pesan: string
  kutipan: string
}

export interface AiRequestInput {
  cvText: string
  targetRole?: string
  jobDesc?: string
  perbaikan?: AiCheckContext[]
  konteksPosisi?: AiRoleContext
  // Mode panggilan (2026-11-26): server mendukung pemecahan analisis
  // menjadi panggilan "core" (bidang inti saja) dan "fixes"
  // (perbaikanLengkap per batch). Tanpa mode, server menjalankan
  // perilaku lama "full" (satu panggilan gabungan).
  mode?: 'full' | 'core' | 'fixes'
}

// Error permintaan AI dengan status HTTP asal (bila ada), agar
// orkestrasi bisa membedakan kegagalan sisi model yang layak diulang
// (jaringan/timeout/5xx/jawaban tak terbaca) dari penolakan permintaan
// yang mengulanginya pun percuma (4xx selain timeout).
export interface AiHttpError extends Error {
  status?: number
}

function aiHttpError(message: string, status: number): AiHttpError {
  const err = new Error(message) as AiHttpError
  err.status = status
  return err
}

// Apakah kegagalan ini layak dicoba sekali lagi? Kegagalan sisi model
// (tanpa status: jaringan putus, batas waktu klien, validasi jawaban)
// dan 5xx dari server layak diulang; 4xx (permintaan tidak sah, API
// key ditolak, kredit habis, rate limit server) tidak — pengulangan
// langsung hanya membakar kuota dan waktu pengguna.
export function isRetryableAiError(err: unknown): boolean {
  const status = (err as AiHttpError | null)?.status
  if (typeof status !== 'number') return true
  return status >= 500
}

// Batas waktu sisi klien (audit 2026-11-24: sebelumnya fetch tanpa
// batas sama sekali — koneksi yang menggantung membuat status
// "menganalisis" berputar selamanya). Nilai di atas batas server
// (aliran 150 detik; non-streaming 75 detik untuk mode "full" dan
// 110 detik untuk panggilan terpecah core/fixes — kasus terburuk
// header + baca body 220 detik) dengan margin, agar hanya koneksi
// yang benar-benar mati yang diputus di sini.
const NONSTREAM_CLIENT_TIMEOUT_MS = 240_000
const STREAM_CLIENT_TIMEOUT_MS = 200_000

const INVALID_RESULT_MESSAGE =
  'Jawaban AI tidak lengkap atau kosong. Coba lagi — tokenmu tidak terpakai bila analisis gagal.'

// Validasi bentuk hasil AI di sisi klien (audit 2026-11-24: sebelumnya
// respons 200 langsung dipercaya lewat cast `as AiAnalysis`, sehingga
// JSON sampah/null/kosong pun dianggap sukses dan token terpotong).
// Aturannya meniru server: hasil harus memuat isi substantif, item
// penulisan ulang/perbaikan yang kosong dibuang, dan bila daftar
// pemeriksaan gagal dikirim maka perbaikanLengkap tidak boleh kosong.
export function validateAiAnalysis(data: unknown, requestedFixCount = 0): AiAnalysis {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(INVALID_RESULT_MESSAGE)
  }
  const obj = data as Record<string, unknown>
  const asStr = (v: unknown): string => (typeof v === 'string' ? v : '')

  const rewrites: AiRewrite[] = []
  if (Array.isArray(obj.saranPenulisanUlang)) {
    for (const item of obj.saranPenulisanUlang) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const it = item as Record<string, unknown>
      const saran = asStr(it.saran).trim()
      if (!saran) continue
      rewrites.push({ asli: asStr(it.asli), saran, alasan: asStr(it.alasan) })
    }
  }
  const kekurangan: string[] = []
  if (Array.isArray(obj.kekurangan)) {
    for (const item of obj.kekurangan) {
      const s = asStr(item).trim()
      if (s) kekurangan.push(s)
    }
  }
  const fixes: AiFix[] = []
  if (Array.isArray(obj.perbaikanLengkap)) {
    for (const item of obj.perbaikanLengkap) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const it = item as Record<string, unknown>
      const sesudah = asStr(it.sesudah).trim()
      if (!sesudah) continue
      const idPemeriksaan = asStr(it.idPemeriksaan).trim()
      fixes.push({
        idPemeriksaan,
        judul: asStr(it.judul).trim() || idPemeriksaan,
        sebelum: asStr(it.sebelum),
        sesudah,
        catatan: asStr(it.catatan),
      })
    }
  }

  const result: AiAnalysis = {
    ringkasan: asStr(obj.ringkasan),
    saranPenulisanUlang: rewrites,
    kekurangan,
    saranRingkasan: asStr(obj.saranRingkasan),
    perbaikanLengkap: fixes,
    // penilaianPosisi OPSIONAL dan toleran: tipe bukan string → kosong;
    // ketiadaannya TIDAK menggagalkan hasil dan tidak ikut menentukan
    // isi substantif (meniru server) — variansi model tidak boleh
    // membakar token pengguna.
    penilaianPosisi: asStr(obj.penilaianPosisi).trim().slice(0, 1500),
  }
  const hasSubstance =
    result.ringkasan.trim() !== '' ||
    result.saranPenulisanUlang.length > 0 ||
    result.kekurangan.length > 0 ||
    result.saranRingkasan.trim() !== '' ||
    result.perbaikanLengkap.length > 0
  if (!hasSubstance) throw new Error(INVALID_RESULT_MESSAGE)
  if (requestedFixCount > 0 && result.perbaikanLengkap.length === 0) {
    throw new Error(INVALID_RESULT_MESSAGE)
  }
  return result
}

// Susun daftar pemeriksaan yang gagal dari hasil analisis standar yang
// sedang tampil: prioritas perbaikan lebih dulu (sesuai urutan tampil),
// lalu sisa pemeriksaan yang belum "baik", tanpa duplikat id. Inilah
// daftar yang wajib diperbaiki AI satu per satu di perbaikanLengkap.
export function buildAiFixContext(
  result: AnalysisResult,
  personalExamples: Partial<Record<string, PersonalExample>> = {},
): AiCheckContext[] {
  const seen = new Set<string>()
  const out: AiCheckContext[] = []
  const push = (check: AnalysisResult['priorities'][number]) => {
    if (check.status === 'baik' || seen.has(check.id)) return
    seen.add(check.id)
    out.push({
      id: check.id,
      judul: check.title,
      pesan: check.message,
      kutipan: personalExamples[check.id]?.kutipanAsli ?? '',
    })
  }
  for (const check of result.priorities) push(check)
  for (const aspect of result.aspects) {
    for (const check of aspect.checks) push(check)
  }
  // Batas 30 di atas jumlah seluruh pemeriksaan (27 + 2 kondisional
  // = 29): daftar tidak boleh terpotong diam-diam (audit 2026-11-24;
  // batas dinaikkan dari 25 saat pemeriksaan baru ditambahkan).
  return out.slice(0, 30)
}

export async function requestAiAnalysis(input: AiRequestInput): Promise<AiAnalysis> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), NONSTREAM_CLIENT_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch('/api/analyze-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    })
  } catch {
    if (controller.signal.aborted) {
      throw new Error(
        'Analisis AI terlalu lama tanpa jawaban. Coba lagi — tokenmu tidak terpakai bila analisis gagal.',
      )
    }
    throw new Error('Tidak bisa menghubungi server Analisis AI. Periksa koneksimu lalu coba lagi.')
  } finally {
    clearTimeout(timer)
  }

  let data: unknown = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : 'Analisis AI gagal. Coba lagi nanti.'
    throw aiHttpError(message, response.status)
  }

  return validateAiAnalysis(data, input.perbaikan?.length ?? 0)
}

export interface AiStreamHandlers {
  // Dipanggil untuk setiap potongan penalaran model yang tiba.
  onReasoning: (text: string) => void
  // Dipanggil untuk setiap event aliran yang diterima (reasoning/result/
  // error) — penanda bahwa aliran benar-benar sudah berjalan.
  onActivity?: () => void
}

// Mode streaming: server meneruskan proses berpikir model sebagai event
// NDJSON (satu JSON per baris): {"type":"reasoning"}, {"type":"result"},
// {"type":"error"}. Error sebelum aliran dimulai dibalas server sebagai
// JSON biasa dengan status HTTP non-200, sama seperti mode non-streaming.
export async function requestAiAnalysisStreaming(
  input: AiRequestInput,
  handlers: AiStreamHandlers,
): Promise<AiAnalysis> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STREAM_CLIENT_TIMEOUT_MS)
  try {
    let response: Response
    try {
      response = await fetch('/api/analyze-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, stream: true }),
        signal: controller.signal,
      })
    } catch {
      if (controller.signal.aborted) {
        throw new Error(
          'Analisis AI terlalu lama tanpa jawaban. Coba lagi — tokenmu tidak terpakai bila analisis gagal.',
        )
      }
      throw new Error('Tidak bisa menghubungi server Analisis AI. Periksa koneksimu lalu coba lagi.')
    }

    if (!response.ok) {
      let data: unknown = null
      try {
        data = await response.json()
      } catch {
        data = null
      }
      const message =
        data && typeof data === 'object' && 'error' in data
          ? String((data as { error: unknown }).error)
          : 'Analisis AI gagal. Coba lagi nanti.'
      throw aiHttpError(message, response.status)
    }

    if (!response.body) {
      throw new Error('Browser tidak mendukung penerimaan aliran data. Coba browser lain.')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let resultData: unknown = null
    let hasResult = false
    let streamError: Error | null = null

    const handleLine = (line: string) => {
      const trimmed = line.trim()
      if (!trimmed) return
      let event: Record<string, unknown>
      try {
        event = JSON.parse(trimmed) as Record<string, unknown>
      } catch {
        return
      }
      handlers.onActivity?.()
      if (event.type === 'reasoning' && typeof event.text === 'string') {
        handlers.onReasoning(event.text)
      } else if (event.type === 'result') {
        resultData = event.data
        hasResult = true
      } else if (event.type === 'error') {
        streamError = new Error(
          typeof event.error === 'string' ? event.error : 'Analisis AI gagal. Coba lagi nanti.',
        )
      }
    }

    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let nl = buffer.indexOf('\n')
        while (nl >= 0) {
          handleLine(buffer.slice(0, nl))
          buffer = buffer.slice(nl + 1)
          nl = buffer.indexOf('\n')
        }
      }
    } catch {
      if (controller.signal.aborted) {
        throw new Error(
          'Analisis AI terlalu lama tanpa jawaban. Coba lagi — tokenmu tidak terpakai bila analisis gagal.',
        )
      }
      throw new Error('Aliran analisis AI terputus di tengah jalan. Coba lagi.')
    }
    if (buffer.trim()) handleLine(buffer)

    if (streamError) throw streamError
    if (!hasResult) {
      throw new Error('Aliran analisis AI terputus sebelum hasil diterima. Coba lagi.')
    }
    // Hasil aliran tetap divalidasi bentuknya sebelum dianggap sukses —
    // event "result" berisi sampah/kosong tidak boleh memotong token.
    return validateAiAnalysis(resultData, input.perbaikan?.length ?? 0)
  } finally {
    clearTimeout(timer)
  }
}

// --- Orkestrasi multi-panggilan (2026-11-26; paralel 2026-11-27) ----------
// Satu panggilan gabungan (bidang inti + perbaikan untuk SEMUA
// pemeriksaan yang gagal, hingga ±29 item) berulang melewati batas
// waktu model gratis dan pengguna hanya menerima pesan timeout.
// Analisis kini dipecah: satu panggilan inti yang ringan + panggilan
// perbaikan per batch kecil. Setiap panggilan mendapat satu percobaan
// ulang pada kegagalan sisi model; run hanya berhasil bila inti DAN
// semua batch lolos — di titik itulah pemanggil memotong token, jadi
// kegagalan di tengah jalan tidak pernah membakar token dan hasil
// parsial tidak pernah tampil sebagai hasil final.
// Batch perbaikan berjalan PARALEL dengan konkurensi terbatas (pilihan
// pengguna 2026-11-27 setelah mengeluh loading lama): model gratis
// butuh ±90 detik per panggilan berapa pun muatannya, jadi menjalankan
// batch berurutan membuat tahap perbaikan sepanjang jumlah batch-nya.
// Maksimal 3 batch berjalan bersamaan (jendela geser); urutan hasil
// akhir tetap urutan prioritas, bukan urutan selesai.

// Ukuran batch perbaikan: maksimal 6 id pemeriksaan per panggilan
// (plafon yang sama ditegakkan server lewat mode "fixes").
export const FIX_BATCH_SIZE = 6

// Konkurensi batch perbaikan: maksimal 3 batch berjalan bersamaan.
// Jumlah permintaan per analisis tidak berubah (hanya tumpang tindih
// waktunya), jadi hitungan rate limit endpoint tetap sama.
export const FIX_BATCH_CONCURRENCY = 3

export function splitFixBatches(
  checks: AiCheckContext[],
  size: number = FIX_BATCH_SIZE,
): AiCheckContext[][] {
  const out: AiCheckContext[][] = []
  for (let i = 0; i < checks.length; i += size) out.push(checks.slice(i, i + size))
  return out
}

// Gabung item perbaikan dari semua batch menjadi satu daftar utuh:
// urutan mengikuti daftar pemeriksaan yang diminta (urutan prioritas),
// id asing dibuang, duplikat dimenangkan yang pertama.
export function mergeAiFixes(requested: AiCheckContext[], collected: AiFix[]): AiFix[] {
  const byId = new Map<string, AiFix>()
  for (const fix of collected) {
    if (fix.idPemeriksaan && !byId.has(fix.idPemeriksaan)) {
      byId.set(fix.idPemeriksaan, fix)
    }
  }
  const out: AiFix[] = []
  for (const check of requested) {
    const fix = byId.get(check.id)
    if (fix) out.push(fix)
  }
  return out
}

export interface AiProgress {
  phase: 'core' | 'fixes'
  // Saat phase 'fixes': batchIndex = jumlah batch yang SUDAH SELESAI
  // ditambah 1 (dibatasi batchTotal) — karena batch berjalan paralel,
  // angka ini berarti "bagian ke-X yang sedang dikerjakan", bukan
  // nomor urut satu batch tunggal. 0 saat phase 'core'.
  // batchTotal = jumlah seluruh batch perbaikan.
  batchIndex: number
  batchTotal: number
}

export interface AiRunHandlers {
  // Event aliran pertama panggilan inti sudah tiba (pemicu tahapan).
  onActivity?: () => void
  onProgress?: (progress: AiProgress) => void
}

// Lapisan transport agar orkestrasi bisa diuji tanpa jaringan: produksi
// memakai panggilan HTTP sungguhan di bawah, uji menyuntikkan tiruan.
export interface AiTransport {
  coreStreaming: (input: AiRequestInput, handlers: AiStreamHandlers) => Promise<AiAnalysis>
  corePlain: (input: AiRequestInput) => Promise<AiAnalysis>
  fixBatch: (input: AiRequestInput, batch: AiCheckContext[]) => Promise<AiFix[]>
}

function coreInputOf(input: AiRequestInput): AiRequestInput {
  // Panggilan inti tidak membawa daftar perbaikan sama sekali — daftar
  // itu hanya untuk panggilan batch.
  return { ...input, mode: 'core', perbaikan: undefined }
}

export const defaultAiTransport: AiTransport = {
  coreStreaming: (input, handlers) => requestAiAnalysisStreaming(coreInputOf(input), handlers),
  corePlain: (input) => requestAiAnalysis(coreInputOf(input)),
  fixBatch: async (input, batch) => {
    const data = await requestAiAnalysis({ ...input, mode: 'fixes', perbaikan: batch })
    return data.perbaikanLengkap
  },
}

const INCOMPLETE_BATCH_MESSAGE =
  'Jawaban AI tidak lengkap atau kosong. Coba lagi — tokenmu tidak terpakai bila analisis gagal.'

// Jalankan satu Analisis AI penuh: inti (streaming, cadangan
// non-streaming) lalu batch perbaikan paralel (konkurensi terbatas)
// sampai semua pemeriksaan gagal terliput. Melempar Error berpesan
// ramah yang sama seperti jalur lama pada kegagalan apa pun yang
// tidak terpulihkan.
export async function runAiAnalysis(
  input: AiRequestInput,
  handlers: AiRunHandlers = {},
  transport: AiTransport = defaultAiTransport,
): Promise<AiAnalysis> {
  const checks = input.perbaikan ?? []
  const batches = splitFixBatches(checks)
  handlers.onProgress?.({ phase: 'core', batchIndex: 0, batchTotal: batches.length })

  // Panggilan inti: streaming lebih dulu (aliran berjalan di latar;
  // penalaran mentah tidak disimpan/ditampilkan), dan kegagalannya —
  // sebelum event pertama maupun di tengah aliran — dicoba sekali
  // lewat cadangan non-streaming, persis pola sebelumnya. Itulah
  // percobaan ulang jalur inti; token tetap hanya terpotong pada
  // keberhasilan akhir keseluruhan run.
  let core: AiAnalysis
  try {
    core = await transport.coreStreaming(input, {
      onReasoning: () => {},
      onActivity: () => handlers.onActivity?.(),
    })
  } catch {
    core = await transport.corePlain(input)
  }

  // Panggilan batch perbaikan, PARALEL dengan jendela geser: maksimal
  // FIX_BATCH_CONCURRENCY batch berjalan bersamaan; batch berikutnya
  // mulai begitu satu selesai. Tiap batch: satu percobaan + satu
  // pengulangan pada kegagalan sisi model. Batch yang menjawab tapi
  // TIDAK meliput semua id-nya diperlakukan sebagai kegagalan yang
  // sama — janji "AI memperbaiki SEMUA prioritas" tidak boleh
  // dikurangi diam-diam oleh jawaban parsial. Satu batch gagal tuntas
  // (atau menolak 4xx) menggagalkan seluruh run: batch baru tidak
  // dimulai lagi, batch yang telanjur berjalan dibiarkan selesai
  // tetapi hasilnya dibuang bersama hasil parsial lainnya.
  const perBatch: (AiFix[] | null)[] = batches.map(() => null)
  let completedBatches = 0
  let nextBatchIndex = 0
  let runFailure: unknown = null
  if (batches.length > 0) {
    handlers.onProgress?.({ phase: 'fixes', batchIndex: 1, batchTotal: batches.length })
  }
  const runBatch = async (index: number): Promise<void> => {
    const batch = batches[index]
    let batchFixes: AiFix[] | null = null
    let lastError: unknown = null
    for (let attempt = 0; attempt < 2 && batchFixes === null; attempt++) {
      try {
        const fixes = await transport.fixBatch(input, batch)
        const covered = new Set(fixes.map((f) => f.idPemeriksaan))
        if (batch.every((c) => covered.has(c.id))) {
          batchFixes = fixes
        } else {
          lastError = new Error(INCOMPLETE_BATCH_MESSAGE)
        }
      } catch (err) {
        if (!isRetryableAiError(err)) throw err
        lastError = err
      }
    }
    if (batchFixes === null) {
      throw lastError instanceof Error ? lastError : new Error(INCOMPLETE_BATCH_MESSAGE)
    }
    perBatch[index] = batchFixes
    completedBatches += 1
    // Kemajuan dilaporkan per penyelesaian batch: X = batch selesai
    // + 1 selama masih ada yang berjalan (label "bagian X dari Y").
    if (completedBatches < batches.length) {
      handlers.onProgress?.({
        phase: 'fixes',
        batchIndex: Math.min(completedBatches + 1, batches.length),
        batchTotal: batches.length,
      })
    }
  }
  const batchWorker = async (): Promise<void> => {
    while (runFailure === null) {
      const index = nextBatchIndex
      nextBatchIndex += 1
      if (index >= batches.length) return
      try {
        await runBatch(index)
      } catch (err) {
        if (runFailure === null) runFailure = err
        return
      }
    }
  }
  const workerCount = Math.min(FIX_BATCH_CONCURRENCY, batches.length)
  await Promise.all(Array.from({ length: workerCount }, () => batchWorker()))
  if (runFailure !== null) throw runFailure
  // Hasil digabung mengikuti indeks batch (urutan prioritas asli),
  // tidak peduli batch mana yang selesai lebih dulu.
  const collected: AiFix[] = []
  for (const fixes of perBatch) {
    if (fixes) collected.push(...fixes)
  }

  const merged = mergeAiFixes(checks, collected)
  // Gerbang terakhir: gabungan akhir tetap divalidasi bentuknya secara
  // penuh sebelum dinyatakan sukses — hasil parsial tidak lolos.
  return validateAiAnalysis({ ...core, perbaikanLengkap: merged }, checks.length)
}
