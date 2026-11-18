// Klien untuk backend Analisis AI (POST /api/analyze-ai → OpenRouter).
// Dipakai hanya bila pengguna mencentang persetujuan pengiriman teks CV.

export interface AiRewrite {
  asli: string
  saran: string
  alasan: string
}

export interface AiAnalysis {
  ringkasan: string
  saranPenulisanUlang: AiRewrite[]
  kekurangan: string[]
  saranRingkasan: string
}

export interface AiRequestInput {
  cvText: string
  targetRole?: string
  jobDesc?: string
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
