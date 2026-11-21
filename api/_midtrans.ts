// Helper server-side khusus endpoint Midtrans (api/payment-config.ts,
// api/create-transaction.ts, api/check-transaction.ts,
// api/midtrans-notification.ts). Awalan "_" membuat file ini BUKAN
// endpoint Vercel — hanya modul pendukung.
//
// Server Key hanya dibaca dari environment variable server dan tidak
// pernah dikirim ke frontend. Client Key memang publik (dipakai
// Snap JS di browser) sehingga boleh dibagikan lewat payment-config.

import { createHash, timingSafeEqual } from 'node:crypto'
import {
  apiHostFor,
  resolveMidtransMode,
  snapHostFor,
  type MidtransMode,
} from '../src/lib/midtrans.js'

export interface MidtransApiRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
  url?: string
  query?: Record<string, string | string[] | undefined>
  socket?: { remoteAddress?: string }
}

export interface MidtransApiResponse {
  status: (code: number) => MidtransApiResponse
  json: (data: unknown) => void
  setHeader: (name: string, value: string) => void
}

export interface MidtransServerConfig {
  mode: MidtransMode
  serverKey: string
  clientKey: string
  snapHost: string
  apiHost: string
}

// Konfigurasi dari env server. Host hanya bermakna bila mode != "off";
// saat off keduanya string kosong dan pemanggil wajib menolak operasi.
export function readMidtransConfig(): MidtransServerConfig {
  const serverKey = process.env.MIDTRANS_SERVER_KEY ?? ''
  const clientKey = process.env.MIDTRANS_CLIENT_KEY ?? ''
  const mode = resolveMidtransMode({
    serverKey,
    clientKey,
    isProduction: process.env.MIDTRANS_IS_PRODUCTION,
  })
  if (mode === 'off') {
    return { mode, serverKey: '', clientKey: '', snapHost: '', apiHost: '' }
  }
  return {
    mode,
    serverKey,
    clientKey,
    snapHost: snapHostFor(mode),
    apiHost: apiHostFor(mode),
  }
}

// Auth API Midtrans: Basic Auth dengan Server Key sebagai username dan
// password kosong (dokumentasi resmi Midtrans).
export function basicAuthHeader(serverKey: string): string {
  return `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`
}

// Signature notifikasi Midtrans:
// SHA512(order_id + status_code + gross_amount + Server Key), hex.
// gross_amount dipakai PERSIS seperti string di body notifikasi
// (mis. "5000.00") — jangan diformat ulang.
export function computeNotificationSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
): string {
  return createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest('hex')
}

// Verifikasi signature_key dari body notifikasi terhadap hitungan
// sendiri. Perbandingan konstan-waktu; input tidak valid → false.
export function verifyNotificationSignature(
  body: unknown,
  serverKey: string,
): boolean {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false
  const obj = body as Record<string, unknown>
  const orderId = obj.order_id
  const statusCode = obj.status_code
  const grossAmount = obj.gross_amount
  const signatureKey = obj.signature_key
  if (
    typeof orderId !== 'string' ||
    typeof statusCode !== 'string' ||
    typeof grossAmount !== 'string' ||
    typeof signatureKey !== 'string'
  ) {
    return false
  }
  const expected = computeNotificationSignature(orderId, statusCode, grossAmount, serverKey)
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(signatureKey, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// --- Rate limit sederhana in-memory per IP (pola sama seperti
// api/analyze-ai.ts): best-effort per instance fungsi serverless. ---
export function makeRateLimiter(max: number, windowMs: number): (ip: string) => boolean {
  const buckets = new Map<string, { count: number; windowStart: number }>()
  return (ip: string): boolean => {
    const now = Date.now()
    const bucket = buckets.get(ip)
    if (!bucket || now - bucket.windowStart > windowMs) {
      buckets.set(ip, { count: 1, windowStart: now })
      return false
    }
    bucket.count += 1
    return bucket.count > max
  }
}

export function clientIp(req: MidtransApiRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded
  if (first) return first.split(',')[0].trim()
  return req.socket?.remoteAddress ?? 'unknown'
}

// Ambil satu query parameter dari req.query (diisi Vercel) atau,
// sebagai cadangan, dari parsing req.url.
export function queryParam(req: MidtransApiRequest, name: string): string {
  const fromQuery = req.query?.[name]
  const first = Array.isArray(fromQuery) ? fromQuery[0] : fromQuery
  if (typeof first === 'string' && first) return first
  if (req.url) {
    try {
      return new URL(req.url, 'http://localhost').searchParams.get(name) ?? ''
    } catch {
      return ''
    }
  }
  return ''
}

// Body JSON permintaan: Vercel biasanya sudah mem-parse; bila masih
// string, parse manual. null bila tidak valid / bukan objek.
export function parseJsonBody(req: MidtransApiRequest): Record<string, unknown> | null {
  if (typeof req.body === 'string') {
    try {
      const parsed: unknown = JSON.parse(req.body)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null
    } catch {
      return null
    }
  }
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    return req.body as Record<string, unknown>
  }
  return null
}

// fetch dengan batas waktu; melempar Error bernama "AbortError" /
// pesan timeout yang konsisten bila melewati batas.
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}
