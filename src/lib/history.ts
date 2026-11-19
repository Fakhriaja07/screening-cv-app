// Riwayat skor analisis standar (rule-based) — Fase 1 roadmap.
// Yang disimpan HANYA data skor: waktu, skor total, skor per aspek, label
// verdict, dan posisi target. Teks CV, nama file, dan hasil AI TIDAK PERNAH
// disimpan di sini, agar janji privasi situs ("CV tidak disimpan") tetap
// benar. Data hidup di localStorage perangkat pengguna sendiri, bukan server.

import type { AnalysisResult } from './analyze'

export interface AspectScore {
  name: string
  score: number
  max: number
}

export interface ScoreHistoryEntry {
  at: string // waktu analisis, format ISO 8601
  total: number
  label: string
  role: string // posisi target; '' bila tidak diisi
  aspects: AspectScore[]
}

export const HISTORY_STORAGE_KEY = 'screening-cv:history:v1'
export const HISTORY_MAX_ENTRIES = 10

// Bentuk minimal Web Storage agar modul bisa diuji dengan mock di Node.
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function defaultStorage(): StorageLike | null {
  try {
    const ls = (globalThis as { localStorage?: StorageLike }).localStorage
    return ls ?? null
  } catch {
    return null
  }
}

// ---------- Validasi defensif: data rusak diabaikan, tidak pernah crash ----------

function isValidAspect(v: unknown): v is AspectScore {
  if (!v || typeof v !== 'object') return false
  const a = v as Record<string, unknown>
  return (
    typeof a.name === 'string' &&
    typeof a.score === 'number' &&
    Number.isFinite(a.score) &&
    typeof a.max === 'number' &&
    Number.isFinite(a.max)
  )
}

function isValidEntry(v: unknown): v is ScoreHistoryEntry {
  if (!v || typeof v !== 'object') return false
  const e = v as Record<string, unknown>
  return (
    typeof e.at === 'string' &&
    !Number.isNaN(Date.parse(e.at)) &&
    typeof e.total === 'number' &&
    Number.isFinite(e.total) &&
    typeof e.label === 'string' &&
    (e.role === undefined || typeof e.role === 'string') &&
    Array.isArray(e.aspects) &&
    e.aspects.every(isValidAspect)
  )
}

function normalizeEntry(e: ScoreHistoryEntry): ScoreHistoryEntry {
  return {
    at: e.at,
    total: e.total,
    label: e.label,
    role: typeof e.role === 'string' ? e.role : '',
    aspects: e.aspects.map((a) => ({ name: a.name, score: a.score, max: a.max })),
  }
}

// ---------- Baca / tulis ----------

export function loadHistory(
  storage: StorageLike | null = defaultStorage(),
): ScoreHistoryEntry[] {
  if (!storage) return []
  try {
    const raw = storage.getItem(HISTORY_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidEntry).map(normalizeEntry).slice(0, HISTORY_MAX_ENTRIES)
  } catch {
    return []
  }
}

export function saveHistory(
  entries: ScoreHistoryEntry[],
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return
  try {
    storage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify(entries.slice(0, HISTORY_MAX_ENTRIES)),
    )
  } catch {
    // Kuota penuh / penyimpanan tidak tersedia: riwayat hanya fitur tambahan,
    // kegagalan menyimpan tidak boleh mengganggu analisis.
  }
}

export function entryFromResult(
  result: AnalysisResult,
  role: string,
  at: Date = new Date(),
): ScoreHistoryEntry {
  return {
    at: at.toISOString(),
    total: result.total,
    label: result.label,
    role: role.trim(),
    aspects: result.aspects.map((a) => ({ name: a.name, score: a.score, max: a.max })),
  }
}

// Tambahkan entri baru (terbaru di depan), batasi HISTORY_MAX_ENTRIES,
// simpan, lalu kembalikan daftar terbaru.
export function addHistoryEntry(
  entry: ScoreHistoryEntry,
  storage: StorageLike | null = defaultStorage(),
): ScoreHistoryEntry[] {
  const next = [entry, ...loadHistory(storage)].slice(0, HISTORY_MAX_ENTRIES)
  saveHistory(next, storage)
  return next
}

export function clearHistory(storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return
  try {
    storage.removeItem(HISTORY_STORAGE_KEY)
  } catch {
    // Abaikan: tidak ada yang perlu dilakukan bila storage tidak tersedia.
  }
}

// ---------- Perbandingan sebelum → sesudah ----------

export type DeltaDirection = 'naik' | 'turun' | 'tetap'

export interface DeltaInfo {
  delta: number
  direction: DeltaDirection
  text: string // "+16" | "-8" | "0"
  word: string // "Naik" | "Turun" | "Tetap"
}

export function scoreDelta(previousTotal: number, currentTotal: number): DeltaInfo {
  const delta = currentTotal - previousTotal
  const direction: DeltaDirection = delta > 0 ? 'naik' : delta < 0 ? 'turun' : 'tetap'
  return {
    delta,
    direction,
    text: delta > 0 ? `+${delta}` : `${delta}`,
    word: direction === 'naik' ? 'Naik' : direction === 'turun' ? 'Turun' : 'Tetap',
  }
}

export interface AspectDelta extends AspectScore {
  previous: number | null
  delta: number | null
  direction: DeltaDirection | null
}

export function aspectDeltas(
  previous: ScoreHistoryEntry,
  current: ScoreHistoryEntry,
): AspectDelta[] {
  const prevByName = new Map(previous.aspects.map((a) => [a.name, a.score]))
  return current.aspects.map((a) => {
    const prev = prevByName.get(a.name)
    if (prev === undefined) {
      return { ...a, previous: null, delta: null, direction: null }
    }
    const delta = a.score - prev
    return {
      ...a,
      previous: prev,
      delta,
      direction: (delta > 0 ? 'naik' : delta < 0 ? 'turun' : 'tetap') as DeltaDirection,
    }
  })
}

export function formatHistoryDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}
