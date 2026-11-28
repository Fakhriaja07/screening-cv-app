// Riwayat skor analisis standar (rule-based) — Fase 1 roadmap.
// Yang disimpan HANYA data skor: waktu, skor total, skor per aspek, label
// verdict, dan posisi target. Teks CV, nama file, dan hasil AI TIDAK PERNAH
// disimpan di sini, agar janji privasi situs ("CV tidak disimpan") tetap
// benar. Data hidup di localStorage perangkat pengguna sendiri, bukan server.

import type { AnalysisResult } from './analyze'
import { getRoleSkills } from './examples'
import type { Lang } from './lang'

export interface AspectScore {
  name: string
  score: number
  max: number
}

export interface ScoreHistoryEntry {
  at: string // waktu analisis, format ISO 8601
  total: number
  label: string
  role: string // posisi target utama (pertama); '' bila tidak diisi
  // Seluruh daftar posisi yang dilamar pada analisis itu (maksimal 3,
  // urutan pilihan pengguna). Opsional pada tipenya karena entri lama
  // yang dibuat sebelum fitur banyak posisi tidak memiliki bidang ini;
  // entryFromResult selalu mengisinya dan loadHistory menormalkannya —
  // pembaca memakai entryRoles() agar selalu mendapat daftar efektif.
  roles?: string[]
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
    (e.roles === undefined ||
      (Array.isArray(e.roles) && e.roles.every((r) => typeof r === 'string'))) &&
    Array.isArray(e.aspects) &&
    e.aspects.every(isValidAspect)
  )
}

// Daftar posisi bersih dari data tersimpan: string saja, spasi tepi
// dipotong, kosong dibuang, duplikat persis dibuang. Entri tanpa daftar
// (dibuat sebelum fitur banyak posisi) diturunkan dari posisi tunggal.
function cleanRoles(e: ScoreHistoryEntry): string[] {
  const fromList = Array.isArray(e.roles)
    ? e.roles.map((r) => (typeof r === 'string' ? r.trim() : '')).filter(Boolean)
    : []
  const deduped = [...new Set(fromList)]
  if (deduped.length > 0) return deduped
  const single = typeof e.role === 'string' ? e.role.trim() : ''
  return single ? [single] : []
}

function normalizeEntry(e: ScoreHistoryEntry): ScoreHistoryEntry {
  const roles = cleanRoles(e)
  return {
    at: e.at,
    total: e.total,
    label: e.label,
    role: typeof e.role === 'string' && e.role ? e.role : (roles[0] ?? ''),
    roles,
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
  roles?: readonly string[],
): ScoreHistoryEntry {
  // Daftar posisi penuh disimpan apa adanya (sudah dinormalisasi
  // pemanggil lewat normalizeTargetRoles); tanpa daftar, diturunkan
  // dari posisi tunggal — perilaku lama persis.
  const list = roles
    ? roles.map((r) => r.trim()).filter(Boolean)
    : role.trim()
      ? [role.trim()]
      : []
  return {
    at: at.toISOString(),
    total: result.total,
    label: result.label,
    role: role.trim(),
    roles: list,
    aspects: result.aspects.map((a) => ({ name: a.name, score: a.score, max: a.max })),
  }
}

// Daftar posisi efektif sebuah entri: bidang roles bila ada, selain
// itu diturunkan dari posisi tunggal (entri lama / literal buatan).
export function entryRoles(e: ScoreHistoryEntry): string[] {
  return cleanRoles(e)
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

export function scoreDelta(previousTotal: number, currentTotal: number, lang: Lang = 'id'): DeltaInfo {
  const delta = currentTotal - previousTotal
  const direction: DeltaDirection = delta > 0 ? 'naik' : delta < 0 ? 'turun' : 'tetap'
  const word =
    lang === 'en'
      ? direction === 'naik'
        ? 'Up'
        : direction === 'turun'
          ? 'Down'
          : 'Unchanged'
      : direction === 'naik'
        ? 'Naik'
        : direction === 'turun'
          ? 'Turun'
          : 'Tetap'
  return {
    delta,
    direction,
    text: delta > 0 ? `+${delta}` : `${delta}`,
    word,
  }
}

export interface AspectDelta extends AspectScore {
  previous: number | null
  delta: number | null
  direction: DeltaDirection | null
}

// Nama aspek kanonik dwibahasa: entri riwayat menyimpan nama aspek dalam
// bahasa yang aktif saat analisis dibuat, jadi entri mode 'id' dan mode
// 'en' harus disamakan lewat nama kanonik yang sama agar tetap bisa
// dibandingkan. Pasangan id↔en: Kontak↔Contact, Ringkasan↔Summary,
// Pengalaman↔Experience, Pendidikan↔Education, Keahlian↔Skills,
// 'Format & ATS' sama di kedua bahasa, Kecocokan dengan Lowongan↔Job Match.
// Nama di luar peta ini dipakai apa adanya (perilaku lama).
const ASPECT_CANONICAL_NAME: Record<string, string> = {
  Kontak: 'Kontak',
  Contact: 'Kontak',
  Ringkasan: 'Ringkasan',
  Summary: 'Ringkasan',
  Pengalaman: 'Pengalaman',
  Experience: 'Pengalaman',
  Pendidikan: 'Pendidikan',
  Education: 'Pendidikan',
  Keahlian: 'Keahlian',
  Skills: 'Keahlian',
  'Format & ATS': 'Format & ATS',
  'Kecocokan dengan Lowongan': 'Kecocokan dengan Lowongan',
  'Job Match': 'Kecocokan dengan Lowongan',
}

function canonicalAspectName(name: string): string {
  return ASPECT_CANONICAL_NAME[name] ?? name
}

export function aspectDeltas(
  previous: ScoreHistoryEntry,
  current: ScoreHistoryEntry,
): AspectDelta[] {
  const prevByName = new Map(previous.aspects.map((a) => [canonicalAspectName(a.name), a.score]))
  return current.aspects.map((a) => {
    const prev = prevByName.get(canonicalAspectName(a.name))
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

// Komposisi aspek bisa berbeda antar-entri: sejak 2026-11-21 ada aspek
// kondisional "Kecocokan dengan Lowongan" (maks total aspek dasar pun
// berubah karena penskalaan), dan posisi target mengubah maks beberapa
// aspek. Fungsi ini mendeteksi perbedaan itu agar UI bisa memberi catatan
// bahwa selisih per aspek hanya perkiraan — total tetap dibandingkan.
export function compositionDiffers(
  a: ScoreHistoryEntry,
  b: ScoreHistoryEntry,
): boolean {
  const ma = new Map(a.aspects.map((x) => [canonicalAspectName(x.name), x.max]))
  const mb = new Map(b.aspects.map((x) => [canonicalAspectName(x.name), x.max]))
  if (ma.size !== mb.size) return true
  for (const [name, max] of ma) {
    if (mb.get(name) !== max) return true
  }
  return false
}

// ---------- Label posisi untuk tampilan riwayat ----------
// Data tersimpan TIDAK diubah: entri menyimpan teks posisi persis seperti
// diketik pengguna ("fullstack", "data analyst"). Saat DITAMPILKAN,
// labelnya dirender lewat resolusi nama yang sama seperti judul kartu
// Daftar Skill (kamus peran + perluasan glosarium), agar entri lama dan
// baru tampil konsisten: "fullstack" → "Full Stack Developer",
// "data analyst" → "Data Analyst", "QC" → "Quality Control".
export function historyRoleLabel(rawRole: string, lang: Lang = 'id'): string {
  const raw = rawRole.trim()
  if (!raw) return ''
  const resolved = getRoleSkills(raw, lang)
  if (!resolved.posisiKustom) return resolved.label
  // Posisi tak dikenal: label resolusi adalah teks pengguna sendiri
  // (atau perluasan glosariumnya) — tampilkan apa adanya. Satu-satunya
  // penyesuaian: ketikan yang seluruhnya huruf kecil dirapikan
  // kapitalisasi awal katanya agar sejajar entri lain; kapitalisasi
  // campuran atau huruf besar dibiarkan persis seperti diketik.
  const label = resolved.label
  if (label === label.toLowerCase()) {
    return label.replace(/(^|\s)(\S)/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase())
  }
  return label
}

// Dua posisi dianggap SAMA bila label tampilannya sama (sesudah
// resolusi di atas): "data analyst" dan "Data Analyst" adalah posisi
// yang sama; dua-duanya kosong juga sama. Dipakai spanduk perbandingan
// riwayat agar selisih skor hanya ditampilkan untuk posisi yang sama.
export function historyRolesMatch(roleA: string, roleB: string): boolean {
  return historyRoleLabel(roleA).toLowerCase() === historyRoleLabel(roleB).toLowerCase()
}

// Dua HIMPUAN posisi dianggap sama bila label tampilannya sama sebagai
// himpunan (urutan tidak penting, duplikat diabaikan): {Data Analyst,
// Akuntansi} sama dengan {Akuntansi, data analyst}, tetapi berbeda
// dari {Data Analyst} saja. Dipakai spanduk perbandingan riwayat pada
// pemakaian banyak posisi — beda himpunan berarti "Beda posisi" dan
// selisih skor tidak ditampilkan, sama seperti logika satu posisi.
// Dua himpunan kosong dianggap sama (sama-sama tanpa posisi target).
export function historyRoleSetsMatch(
  rolesA: readonly string[],
  rolesB: readonly string[],
  lang: Lang = 'id',
): boolean {
  const setOf = (roles: readonly string[]) =>
    new Set(
      roles
        .map((r) => historyRoleLabel(r, lang).toLowerCase())
        .filter(Boolean),
    )
  const a = setOf(rolesA)
  const b = setOf(rolesB)
  if (a.size !== b.size) return false
  for (const x of a) if (!b.has(x)) return false
  return true
}

export function formatHistoryDate(iso: string, lang: Lang = 'id'): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}
