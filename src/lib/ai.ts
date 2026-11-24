// Klien untuk backend Analisis AI (POST /api/analyze-ai → OpenRouter).
// Dipakai hanya bila pengguna mencentang persetujuan pengiriman teks CV.
import type { AnalysisResult } from './analyze'
import type { PersonalExample } from './personalExamples'

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
}

// Batas waktu sisi klien (audit 2026-11-24: sebelumnya fetch tanpa
// batas sama sekali — koneksi yang menggantung membuat status
// "menganalisis" berputar selamanya). Nilai di atas batas server
// (aliran 150 detik; non-streaming 75 detik × maks 3 percobaan) dengan
// margin, agar hanya koneksi yang benar-benar mati yang diputus di sini.
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
    throw new Error(message)
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
      throw new Error(message)
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
