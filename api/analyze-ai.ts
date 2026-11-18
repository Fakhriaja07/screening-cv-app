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
// kasual; untuk batas yang tegas gunakan penyimpanan bersama
// (mis. Vercel KV / Upstash) di lapisan berikutnya.
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

const SYSTEM_PROMPT =
  'Kamu adalah konsultan karier berbahasa Indonesia. Balas HANYA dengan JSON valid sesuai skema yang diminta — tanpa markdown, tanpa pagar kode, tanpa teks pembuka/penutup. Jangan mengarang pengalaman, perusahaan, atau angka yang tidak ada di CV.'

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
    return {
      asli: asString(it.asli),
      saran: asString(it.saran),
      alasan: asString(it.alasan),
    }
  }
  return null
}

function normalizeResult(raw: unknown): AiResult | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>
  // Objek JSON yang sama sekali tidak memuat field skema dianggap bukan
  // jawaban analisis (mis. JSON lain yang kebetulan valid) → gagal parse.
  const hasKnownField = ['ringkasan', 'saranPenulisanUlang', 'kekurangan', 'saranRingkasan'].some(
    (key) => obj[key] !== undefined && obj[key] !== null,
  )
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

  return {
    ringkasan: asString(obj.ringkasan),
    saranPenulisanUlang: rewrites,
    kekurangan: asStringList(obj.kekurangan, 6),
    saranRingkasan: asString(obj.saranRingkasan),
  }
}

// Model reasoning sering membungkus proses berpikirnya dalam tag <think>
// atau <thinking>; blok itu dibuang sebelum parsing JSON.
function stripThinkBlocks(text: string): string {
  return text
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, ' ')
    .replace(/<\/?think(?:ing)?>/gi, ' ')
}

function tryParseJson(text: string): AiResult | null {
  try {
    return normalizeResult(JSON.parse(text))
  } catch {
    return null
  }
}

export function parseAiJson(text: string): AiResult | null {
  // Urutan percobaan dari yang paling bersih ke yang paling toleran:
  // parse langsung → buang pagar kode → ekstrak { ... } terluar.
  const cleaned = stripThinkBlocks(text).trim()
  if (!cleaned) return null
  const direct = tryParseJson(cleaned)
  if (direct) return direct
  const defenced = cleaned.replace(/```(?:json)?/gi, '').trim()
  if (defenced !== cleaned) {
    const fromDefenced = tryParseJson(defenced)
    if (fromDefenced) return fromDefenced
  }
  const start = defenced.indexOf('{')
  const end = defenced.lastIndexOf('}')
  if (start >= 0 && end > start) {
    return tryParseJson(defenced.slice(start, end + 1))
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
export function parseAiResponse(data: unknown): AiParseOutcome {
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

  let result = contentText ? parseAiJson(contentText) : null
  if (!result && reasoningText) result = parseAiJson(reasoningText)
  return { result, finishReason, rawText: contentText || reasoningText }
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

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    res.status(500).json({
      error: 'Fitur Analisis AI belum aktif: OPENROUTER_API_KEY belum terpasang di server.',
    })
    return
  }
  const model = process.env.OPENROUTER_MODEL || 'google/gemma-4-31b-it'

  const sendRequest = (withResponseFormat: boolean): Promise<Response> =>
    fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-Title': 'Screening CV',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildPrompt(cvText, targetRole, jobDesc) },
        ],
        ...(withResponseFormat ? { response_format: { type: 'json_object' } } : {}),
        temperature: 0.4,
        // 3000 token agar JSON jawaban tidak terpotong batas default provider.
        max_tokens: 3000,
      }),
    })

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
  try {
    aiResponse = await sendRequest(true)
    if (!aiResponse.ok && aiResponse.status === 400) {
      // Sebagian model menolak parameter response_format. Bila pesan error
      // 400 memang menyebut parameter itu, ulangi sekali tanpa response_format;
      // error 400 lain tetap dipetakan seperti biasa.
      const firstMessage = await readUpstreamMessage(aiResponse)
      if (/response_format|json|unsupported/i.test(firstMessage)) {
        aiResponse = await sendRequest(false)
      } else {
        upstreamMessage = firstMessage
      }
    }
  } catch {
    res.status(502).json({
      error: 'Layanan AI sedang tidak bisa dihubungi. Coba lagi nanti — hasil analisis standar tetap bisa dipakai.',
    })
    return
  }

  if (!aiResponse.ok) {
    // Diagnosis: sertakan status HTTP + pesan error resmi OpenRouter pada
    // field "detail" dan log server, agar penyebab 502 terlihat. Yang
    // disertakan hanya status dan pesan OpenRouter — TIDAK termasuk API key,
    // header, atau isi CV/permintaan.
    const message = upstreamMessage ?? (await readUpstreamMessage(aiResponse))
    const detail = `OpenRouter HTTP ${aiResponse.status}${message ? `: ${message}` : ''}`
    console.error(`[analyze-ai] ${detail}`)

    if (aiResponse.status === 429) {
      res.status(429).json({
        error: 'Layanan AI sedang dibatasi (rate limit) atau kuota gratis sedang penuh, coba lagi nanti — hasil analisis standar tetap bisa dipakai.',
        detail,
      })
      return
    }
    if (aiResponse.status === 401 || aiResponse.status === 403) {
      res.status(502).json({
        error: 'API key OpenRouter ditolak. Periksa konfigurasi OPENROUTER_API_KEY di server — hasil analisis standar tetap bisa dipakai.',
        detail,
      })
      return
    }
    if (aiResponse.status === 402) {
      res.status(502).json({
        error: 'Kredit OpenRouter tidak cukup untuk menjalankan analisis AI. Isi kredit atau periksa batas pemakaian akun OpenRouter — hasil analisis standar tetap bisa dipakai.',
        detail,
      })
      return
    }
    res.status(502).json({
      error: 'Layanan AI mengembalikan kesalahan. Coba lagi nanti — hasil analisis standar tetap bisa dipakai.',
      detail,
    })
    return
  }

  let data: unknown = null
  try {
    data = await aiResponse.json()
  } catch {
    data = null
  }

  const parsed = parseAiResponse(data)
  if (!parsed.result) {
    // Diagnostik parse: sertakan finish_reason, panjang teks mentah, dan
    // cuplikan awal jawaban model pada field "detail" agar kegagalan bisa
    // didiagnosis. Cuplikan berasal dari JAWABAN model atas CV pemanggil
    // sendiri (bukan input CV mentah) dan hanya muncul pada mode gagal
    // parse; isi CV tetap tidak dicatat ke log.
    const snippet = parsed.rawText.slice(0, 200)
    const detail =
      `finish_reason: ${parsed.finishReason || 'tidak tersedia'}; ` +
      `panjang teks mentah: ${parsed.rawText.length} karakter; ` +
      `cuplikan awal jawaban model: ${snippet ? `"${snippet}"` : '(kosong)'}`
    console.error(
      `[analyze-ai] Jawaban model tidak terparse (finish_reason=${parsed.finishReason || '-'}, panjang=${parsed.rawText.length})`,
    )
    res.status(502).json({
      error: 'Jawaban AI tidak bisa dibaca. Coba lagi — hasil analisis standar tetap bisa dipakai.',
      detail,
    })
    return
  }

  res.status(200).json(parsed.result)
}
