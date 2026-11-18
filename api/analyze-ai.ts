// Backend Analisis AI — Vercel Serverless Function.
//
// Alur: browser → POST /api/analyze-ai → fungsi ini → Google Gemini → JSON kembali ke browser.
// API key hanya dibaca dari environment variable server (GEMINI_API_KEY) dan
// tidak pernah dikirim ke frontend. Isi CV hanya diteruskan ke Gemini untuk
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
}

interface RewriteItem {
  asli: string
  saran: string
  alasan: string
}

interface AiResult {
  ringkasan: string
  saranPenulisanUlang: RewriteItem[]
  kekurangan: string[]
  saranRingkasan: string
}

const MAX_CV_CHARS = 12_000
const MIN_CV_CHARS = 50
const MAX_JOBDESC_CHARS = 6_000
const MAX_ROLE_CHARS = 200

// --- Rate limit sederhana in-memory per IP ---
// Best-effort per instance: state ini hidup di memori satu instance fungsi
// serverless, jadi bukan batas global. Cukup untuk menahan penyalahgunaan
// kasual terhadap kuota gratis; untuk batas yang tegas gunakan penyimpanan
// bersama (mis. Vercel KV / Upstash) di lapisan berikutnya.
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const rateBuckets = new Map<string, { count: number; windowStart: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const bucket = rateBuckets.get(ip)
  if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(ip, { count: 1, windowStart: now })
    return false
  }
  bucket.count += 1
  return bucket.count > RATE_LIMIT_MAX
}

function clientIp(req: AiRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded
  if (first) return first.split(',')[0].trim()
  return req.socket?.remoteAddress ?? 'unknown'
}

function buildPrompt(cvText: string, targetRole: string, jobDesc: string): string {
  const rolePart = targetRole
    ? `\nPOSISI YANG DILAMAR: ${targetRole}\n`
    : ''
  const jobPart = jobDesc
    ? `\nDESKRIPSI LOWONGAN:\n${jobDesc}\n`
    : '\n(Tidak ada deskripsi lowongan — nilai kekurangan umum CV saja.)\n'
  return [
    'Kamu adalah konsultan karier berbahasa Indonesia yang membantu pencari kerja dan fresh graduate memperbaiki CV.',
    'Analisis CV berikut dan balas HANYA dengan JSON valid (tanpa markdown, tanpa teks lain) dengan skema persis ini:',
    '{',
    '  "ringkasan": "penilaian kualitatif CV dalam 2-3 kalimat",',
    '  "saranPenulisanUlang": [ { "asli": "kalimat/poin asli dari CV", "saran": "versi penulisan ulang", "alasan": "kenapa versi baru lebih baik" } ],',
    '  "kekurangan": [ "kekurangan CV, maksimal 6 butir" ],',
    '  "saranRingkasan": "contoh ringkasan profil 2-3 kalimat berdasarkan isi CV"',
    '}',
    '',
    'Aturan ketat:',
    '- saranPenulisanUlang: ambil maksimal 5 poin dari bagian pengalaman CV. Tulis ulang dengan kata kerja aksi yang kuat dan struktur pencapaian.',
    '- JANGAN mengarang pengalaman, perusahaan, atau angka baru. Bila angka pencapaian tidak ada di CV, pakai placeholder seperti [X%], [jumlah], atau [angka] di dalam saran, dan jelaskan di alasan bahwa pengguna harus mengisi angka aslinya sendiri.',
    jobDesc
      ? '- kekurangan: nilai kesenjangan (gap) CV terhadap deskripsi lowongan secara MAKNA — skill/pengalaman yang dituntut lowongan tapi belum tampak di CV, bukan sekadar daftar kata kunci yang hilang.'
      : '- kekurangan: nilai kekurangan umum CV (struktur, kejelasan, bukti pencapaian, kelengkapan bagian).',
    '- saranRingkasan: tulis berdasarkan fakta di CV saja, jangan menambah klaim baru.',
    '- Seluruh jawaban dalam Bahasa Indonesia yang jelas dan suportif.',
    rolePart,
    jobPart,
    'TEKS CV:',
    cvText,
  ].join('\n')
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function normalizeResult(raw: unknown): AiResult | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const rewrites: RewriteItem[] = []
  if (Array.isArray(obj.saranPenulisanUlang)) {
    for (const item of obj.saranPenulisanUlang.slice(0, 5)) {
      if (item && typeof item === 'object') {
        const it = item as Record<string, unknown>
        rewrites.push({
          asli: asString(it.asli),
          saran: asString(it.saran),
          alasan: asString(it.alasan),
        })
      }
    }
  }
  const kekurangan: string[] = []
  if (Array.isArray(obj.kekurangan)) {
    for (const k of obj.kekurangan.slice(0, 6)) {
      if (typeof k === 'string' && k.trim()) kekurangan.push(k)
    }
  }
  return {
    ringkasan: asString(obj.ringkasan),
    saranPenulisanUlang: rewrites,
    kekurangan,
    saranRingkasan: asString(obj.saranRingkasan),
  }
}

function parseGeminiJson(text: string): AiResult | null {
  // Respons Gemini kadang dibungkus pagar markdown atau teks tambahan;
  // coba parse langsung, lalu fallback ke potongan { ... } terluar.
  try {
    return normalizeResult(JSON.parse(text))
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return normalizeResult(JSON.parse(text.slice(start, end + 1)))
      } catch {
        return null
      }
    }
    return null
  }
}

export default async function handler(req: AiRequest, res: AiResponse): Promise<void> {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Metode tidak diizinkan. Gunakan POST.' })
    return
  }

  if (isRateLimited(clientIp(req))) {
    res.status(429).json({
      error: 'Terlalu banyak permintaan analisis AI dari koneksimu. Tunggu beberapa menit lalu coba lagi.',
    })
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

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    res.status(500).json({
      error: 'Fitur Analisis AI belum aktif: GEMINI_API_KEY belum terpasang di server.',
    })
    return
  }
  const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash'

  let geminiResponse: Response
  try {
    geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(cvText, targetRole, jobDesc) }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.4,
            maxOutputTokens: 2048,
          },
        }),
      },
    )
  } catch {
    res.status(502).json({
      error: 'Layanan AI sedang tidak bisa dihubungi. Coba lagi nanti — hasil analisis standar tetap bisa dipakai.',
    })
    return
  }

  if (geminiResponse.status === 429) {
    res.status(429).json({
      error: 'Kuota AI gratis hari ini habis/sedang penuh, coba lagi nanti — hasil analisis standar tetap bisa dipakai.',
    })
    return
  }
  if (!geminiResponse.ok) {
    // Diagnosis: sertakan status HTTP + pesan error resmi Google pada field
    // "detail" dan log server, agar penyebab 502 terlihat. Yang disertakan
    // hanya status dan pesan Google — TIDAK termasuk API key, header, atau
    // isi CV/permintaan.
    let upstreamMessage = ''
    try {
      const errData = (await geminiResponse.json()) as {
        error?: { message?: string }
      }
      upstreamMessage = (errData.error?.message ?? '').slice(0, 300)
    } catch {
      upstreamMessage = ''
    }
    const detail = `Gemini HTTP ${geminiResponse.status}${upstreamMessage ? `: ${upstreamMessage}` : ''}`
    console.error(`[analyze-ai] ${detail}`)
    res.status(502).json({
      error: 'Layanan AI mengembalikan kesalahan. Coba lagi nanti — hasil analisis standar tetap bisa dipakai.',
      detail,
    })
    return
  }

  let text = ''
  try {
    const data = (await geminiResponse.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const parts = data.candidates?.[0]?.content?.parts ?? []
    text = parts.map((p) => p.text ?? '').join('')
  } catch {
    text = ''
  }

  const result = text ? parseGeminiJson(text) : null
  if (!result) {
    res.status(502).json({
      error: 'Jawaban AI tidak bisa dibaca. Coba lagi — hasil analisis standar tetap bisa dipakai.',
    })
    return
  }

  res.status(200).json(result)
}
