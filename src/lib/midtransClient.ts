// Helper sisi browser untuk pembayaran otomatis Midtrans.
//
// Semua keputusan pembayaran tetap di server: modul ini hanya meminta
// konfigurasi mode, membuat transaksi, memuat Snap JS, dan menanyakan
// status resmi ke /api/check-transaction. Kredit TIDAK PERNAH ditambah
// berdasarkan callback Snap semata — Snap hanya memicu polling status
// ke server situs, dan serverlah yang memastikan ke Midtrans.

import { snapJsUrlFor, type MidtransMode, type PaymentCheckState } from './midtrans'

export interface PaymentConfig {
  mode: MidtransMode
  clientKey?: string
}

export interface CreatedTransaction {
  token: string
  redirectUrl: string
  orderId: string
}

export interface TransactionCheck {
  paid: boolean
  state: PaymentCheckState
}

// Ambil mode pembayaran dari server. Kegagalan jaringan → mode "off"
// (frontend jatuh ke paywall manual yang selalu tersedia).
export async function fetchPaymentConfig(): Promise<PaymentConfig> {
  try {
    const res = await fetch('/api/payment-config')
    if (!res.ok) return { mode: 'off' }
    const data: unknown = await res.json()
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>
      if (obj.mode === 'sandbox' || obj.mode === 'production') {
        return {
          mode: obj.mode,
          clientKey: typeof obj.clientKey === 'string' ? obj.clientKey : undefined,
        }
      }
    }
    return { mode: 'off' }
  } catch {
    return { mode: 'off' }
  }
}

export async function createSnapTransaction(): Promise<CreatedTransaction> {
  const res = await fetch('/api/create-transaction', { method: 'POST' })
  const data: unknown = await res.json().catch(() => null)
  const obj = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  if (!res.ok || typeof obj.token !== 'string' || typeof obj.orderId !== 'string') {
    throw new Error(
      typeof obj.error === 'string'
        ? obj.error
        : 'Gagal membuat transaksi pembayaran. Coba lagi nanti.',
    )
  }
  return {
    token: obj.token,
    redirectUrl: typeof obj.redirectUrl === 'string' ? obj.redirectUrl : '',
    orderId: obj.orderId,
  }
}

export async function checkSnapTransaction(orderId: string): Promise<TransactionCheck> {
  const res = await fetch(
    `/api/check-transaction?order_id=${encodeURIComponent(orderId)}`,
  )
  const data: unknown = await res.json().catch(() => null)
  const obj = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  if (!res.ok) {
    throw new Error(
      typeof obj.error === 'string' ? obj.error : 'Gagal memeriksa status pembayaran.',
    )
  }
  const state: PaymentCheckState =
    obj.state === 'paid' || obj.state === 'pending' || obj.state === 'failed' || obj.state === 'unknown'
      ? obj.state
      : 'unknown'
  return { paid: obj.paid === true, state }
}

// ---------- Snap JS ----------

export interface SnapCallbacks {
  onSuccess?: (result: unknown) => void
  onPending?: (result: unknown) => void
  onError?: (result: unknown) => void
  onClose?: () => void
}

interface SnapGlobal {
  pay: (token: string, callbacks: SnapCallbacks) => void
}

function snapGlobal(): SnapGlobal | null {
  const w = window as unknown as { snap?: SnapGlobal }
  return w.snap ?? null
}

let snapLoadPromise: Promise<void> | null = null
let snapLoadedFor: string | null = null

// Muat Snap JS sesuai mode (sandbox/production) — sekali saja per mode.
// Client Key ditaruh di atribut data-client-key sesuai dokumentasi Snap.
export function loadSnapJs(
  mode: Exclude<MidtransMode, 'off'>,
  clientKey: string,
): Promise<void> {
  const url = snapJsUrlFor(mode)
  if (snapGlobal() && snapLoadedFor === url) return Promise.resolve()
  if (snapLoadPromise && snapLoadedFor === url) return snapLoadPromise
  snapLoadedFor = url
  snapLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = url
    script.setAttribute('data-client-key', clientKey)
    script.onload = () => {
      if (snapGlobal()) resolve()
      else reject(new Error('Snap JS termuat tapi tidak tersedia.'))
    }
    script.onerror = () => {
      snapLoadPromise = null
      reject(new Error('Snap JS gagal dimuat. Periksa koneksimu lalu coba lagi.'))
    }
    document.head.appendChild(script)
  })
  return snapLoadPromise
}

export function payWithSnap(token: string, callbacks: SnapCallbacks): void {
  const snap = snapGlobal()
  if (!snap) throw new Error('Snap JS belum termuat.')
  snap.pay(token, callbacks)
}
