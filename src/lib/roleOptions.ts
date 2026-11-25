// Daftar pilihan pekerjaan untuk combobox "Posisi yang dilamar"
// (permintaan pengguna 2026-11-25: dropdown yang bisa dicari dengan
// diketik). Modul ini DATA TURUNAN MURNI — isinya dibangun dari dua
// sumber yang sudah ada, tanpa mengubah keduanya:
//
//   (a) label peran pada kamus Daftar Skill (ROLE_SKILLS di
//       examples.ts) — label majemuk seperti "Administrasi / Admin
//       Kantor" dipecah menjadi pilihan tersendiri ("Administrasi",
//       "Admin Kantor") karena tiap bagiannya adalah judul posisi yang
//       berdiri sendiri dan tetap tercocokkan kamus saat dianalisis;
//   (b) nama pekerjaan lengkap dari glosarium singkatan
//       (JOB_GLOSSARY di jobGlossary.ts), beserta singkatannya —
//       singkatan ikut dicocokkan saat pengguna mengetik ("qc" menemukan
//       "Quality Control"), tetapi nilai yang masuk ke kolom selalu
//       NAMA LENGKAPNYA.
//
// Pilihan digabung, dideduplikasi per nama (huruf besar/kecil diabaikan;
// singkatan dari entri yang namanya sama digabung, mis. "Research and
// Development" membawa R&D dan RND), lalu diurutkan alfabetis.
//
// Daftar ini HANYA saran: teks bebas di luar daftar tetap sah dan dipakai
// apa adanya oleh analisis (jalur posisi kustom di getRoleSkills).

import { ROLE_SKILLS } from './examples'
import { JOB_GLOSSARY } from './jobGlossary'

export interface RoleOption {
  /** Nama pekerjaan lengkap — persis string yang masuk ke kolom posisi. */
  value: string
  /** Singkatan glosarium untuk nama ini (boleh kosong). */
  abbrs: string[]
}

// Kunci deduplikasi & pencocokan nama: huruf kecil, spasi dirapikan.
function normalizeName(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

// Kunci pencocokan singkatan: huruf besar, titik dibuang — sejajar
// normalizeAbbrKey di jobGlossary.ts, jadi "qc", "QC", dan "Q.C."
// menunjuk singkatan yang sama.
function normalizeAbbr(text: string): string {
  return text.toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ').trim()
}

const byKey = new Map<string, RoleOption>()

function addOption(value: string, abbr?: string) {
  const v = value.replace(/\s+/g, ' ').trim()
  if (!v) return
  const key = normalizeName(v)
  const existing = byKey.get(key)
  if (existing) {
    if (abbr && !existing.abbrs.includes(abbr)) existing.abbrs.push(abbr)
  } else {
    byKey.set(key, { value: v, abbrs: abbr ? [abbr] : [] })
  }
}

for (const role of ROLE_SKILLS) {
  for (const part of role.label.split('/')) addOption(part)
}
for (const entry of JOB_GLOSSARY) {
  addOption(entry.fullName, entry.abbr)
}

/** Semua pilihan pekerjaan, terurut alfabetis per nama lengkap. */
export const ROLE_OPTIONS: RoleOption[] = [...byKey.values()].sort((a, b) =>
  a.value.localeCompare(b.value, 'id'),
)

/**
 * Saring pilihan mengikuti ketikan pengguna. Ketikan kosong mengembalikan
 * semua pilihan (daftar penuh saat kolom difokuskan). Kecocokan diberi
 * peringkat, dari yang paling spesifik:
 *   0 — singkatan persis sama ("qc" → Quality Control, "spv" → Supervisor)
 *   1 — nama diawali ketikan ("data" → Data Analyst)
 *   2 — singkatan diawali ketikan (minimal 2 huruf)
 *   3 — nama memuat ketikan sebagai potongan
 *   4 — setiap kata ketikan muncul di nama (urutan bebas)
 * Di dalam satu peringkat, urutan tetap alfabetis mengikuti ROLE_OPTIONS.
 * Tidak ada hasil bukan kesalahan: teks bebas tetap boleh dipakai.
 */
export function filterRoleOptions(query: string): RoleOption[] {
  const q = normalizeName(query)
  if (!q) return ROLE_OPTIONS
  const qAbbr = normalizeAbbr(query)
  const tiers: RoleOption[][] = [[], [], [], [], []]
  for (const opt of ROLE_OPTIONS) {
    const name = normalizeName(opt.value)
    let tier = -1
    if (opt.abbrs.some((a) => normalizeAbbr(a) === qAbbr)) tier = 0
    else if (name.startsWith(q)) tier = 1
    else if (
      qAbbr.length >= 2 &&
      opt.abbrs.some((a) => normalizeAbbr(a).startsWith(qAbbr))
    )
      tier = 2
    else if (name.includes(q)) tier = 3
    else if (q.split(' ').every((w) => name.includes(w))) tier = 4
    if (tier >= 0) tiers[tier].push(opt)
  }
  return tiers.flat()
}
