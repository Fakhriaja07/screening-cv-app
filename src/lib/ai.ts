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
  return out.slice(0, 20)
}

export async function requestAiAnalysis(input: AiRequestInput): Promise<AiAnalysis> {
  let response: Response
  try {
    response = await fetch('/api/analyze-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  } catch {
    throw new Error('Tidak bisa menghubungi server Analisis AI. Periksa koneksimu lalu coba lagi.')
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

  return data as AiAnalysis
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
  let response: Response
  try {
    response = await fetch('/api/analyze-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, stream: true }),
    })
  } catch {
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
  let result: AiAnalysis | null = null
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
      result = event.data as AiAnalysis
    } else if (event.type === 'error') {
      streamError = new Error(
        typeof event.error === 'string' ? event.error : 'Analisis AI gagal. Coba lagi nanti.',
      )
    }
  }

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
  if (buffer.trim()) handleLine(buffer)

  if (streamError) throw streamError
  if (!result) {
    throw new Error('Aliran analisis AI terputus sebelum hasil diterima. Coba lagi.')
  }
  return result
}
