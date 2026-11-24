// Glosarium singkatan nama pekerjaan (2026-11-24, permintaan pengguna).
//
// Pengguna sering mengetik posisi target sebagai singkatan — "QC", "HRD",
// "SPV Produksi" — yang tidak dikenali kamus skill (examples.ts) maupun
// ekstraksi kata peran (analyze.ts), sehingga kartu Daftar Skill jatuh ke
// fallback nama mentah dan pemeriksaan relevansi tidak berjalan. Modul ini
// data MURNI: daftar singkatan → nama pekerjaan lengkap sebagaimana lazim
// di lowongan Indonesia, plus fungsi resolusinya. Tambah entri cukup
// dengan menambah satu baris di JOB_GLOSSARY.
//
// Aturan resolusi (expandJobTitle / findJobAbbreviation):
// - case-insensitive; titik diabaikan ("Q.C." = "QC");
// - singkatan harus berdiri sebagai kata utuh (seluruh input, atau token
//   yang dibatasi spasi/tanda baca, termasuk gabungan garis miring seperti
//   "QA/QC") — potongan di tengah kata lain TIDAK pernah diperluas, jadi
//   "Backend" tidak berubah walau "BE" adalah singkatan;
// - singkatan yang terlalu ambigu untuk dipetakan aman (mis. "SA" bisa
//   System Analyst / Sales Admin / Sales Assistant) sengaja TIDAK
//   dimasukkan. Untuk yang tetap dimasukkan, dipilih arti paling lazim di
//   lowongan Indonesia (mis. "PM" = Product Manager di konteks digital).

export interface JobGlossaryEntry {
  abbr: string
  fullName: string
}

export const JOB_GLOSSARY: JobGlossaryEntry[] = [
  // -- Manufaktur & kualitas --
  { abbr: 'QC', fullName: 'Quality Control' },
  { abbr: 'QA', fullName: 'Quality Assurance' },
  { abbr: 'QE', fullName: 'Quality Engineer' },
  { abbr: 'PPIC', fullName: 'Production Planning and Inventory Control' },
  { abbr: 'R&D', fullName: 'Research and Development' },
  { abbr: 'RND', fullName: 'Research and Development' },
  { abbr: 'HSE', fullName: 'Health Safety Environment' },
  { abbr: 'K3', fullName: 'Keselamatan dan Kesehatan Kerja' },
  { abbr: 'K3LH', fullName: 'K3 dan Lingkungan Hidup' },
  { abbr: 'SPV', fullName: 'Supervisor' },
  { abbr: 'WH', fullName: 'Staf Gudang' },
  { abbr: 'IE', fullName: 'Industrial Engineer' },
  // -- Kantor & administrasi --
  { abbr: 'HRD', fullName: 'Human Resource Development' },
  { abbr: 'HR', fullName: 'Human Resources' },
  { abbr: 'GA', fullName: 'General Affair' },
  { abbr: 'ADM', fullName: 'Administrasi' },
  { abbr: 'BO', fullName: 'Back Office' },
  { abbr: 'OB', fullName: 'Office Boy' },
  { abbr: 'OG', fullName: 'Office Girl' },
  { abbr: 'CS', fullName: 'Customer Service' },
  { abbr: 'PA', fullName: 'Personal Assistant' },
  { abbr: 'TU', fullName: 'Tata Usaha' },
  // -- Penjualan & marketing --
  { abbr: 'SPG', fullName: 'Sales Promotion Girl' },
  { abbr: 'SPB', fullName: 'Sales Promotion Boy' },
  { abbr: 'AE', fullName: 'Account Executive' },
  { abbr: 'AM', fullName: 'Account Manager' },
  { abbr: 'AO', fullName: 'Account Officer' },
  { abbr: 'BD', fullName: 'Business Development' },
  { abbr: 'BDE', fullName: 'Business Development Executive' },
  { abbr: 'MD', fullName: 'Merchandiser' },
  { abbr: 'TL', fullName: 'Team Leader' },
  { abbr: 'BM', fullName: 'Branch Manager' },
  { abbr: 'ASM', fullName: 'Area Sales Manager' },
  { abbr: 'RSM', fullName: 'Regional Sales Manager' },
  { abbr: 'KAM', fullName: 'Key Account Manager' },
  { abbr: 'GM', fullName: 'General Manager' },
  { abbr: 'SEO', fullName: 'SEO Specialist' },
  { abbr: 'SEM', fullName: 'Search Engine Marketing Specialist' },
  { abbr: 'SMM', fullName: 'Social Media Specialist' },
  { abbr: 'KOL', fullName: 'KOL Specialist' },
  { abbr: 'PR', fullName: 'Public Relations' },
  { abbr: 'CRM', fullName: 'CRM Specialist' },
  // -- IT & digital --
  { abbr: 'IT', fullName: 'IT Support' },
  { abbr: 'BE', fullName: 'Backend Developer' },
  { abbr: 'FE', fullName: 'Frontend Developer' },
  { abbr: 'DevOps', fullName: 'DevOps Engineer' },
  { abbr: 'UI/UX', fullName: 'UI/UX Designer' },
  { abbr: 'UI', fullName: 'UI Designer' },
  { abbr: 'UX', fullName: 'UX Designer' },
  { abbr: 'PM', fullName: 'Product Manager' },
  { abbr: 'DBA', fullName: 'Database Administrator' },
  { abbr: 'NOC', fullName: 'Network Operations Center' },
  { abbr: 'MIS', fullName: 'Management Information System' },
  // -- F&B & hospitality --
  { abbr: 'F&B', fullName: 'Food and Beverage Service' },
  { abbr: 'FNB', fullName: 'Food and Beverage Service' },
  { abbr: 'FO', fullName: 'Front Office' },
  { abbr: 'HK', fullName: 'Housekeeping' },
  { abbr: 'GRO', fullName: 'Guest Relation Officer' },
  { abbr: 'CDP', fullName: 'Chef de Partie' },
  { abbr: 'DW', fullName: 'Daily Worker' },
  // -- Kesehatan & pendidikan --
  { abbr: 'ATLM', fullName: 'Analis Kesehatan' },
  { abbr: 'NAKES', fullName: 'Tenaga Kesehatan' },
  { abbr: 'AA', fullName: 'Asisten Apoteker' },
  { abbr: 'TTK', fullName: 'Tenaga Teknis Kefarmasian' },
  { abbr: 'BK', fullName: 'Guru Bimbingan Konseling' },
  // -- Teknik, konstruksi & logistik --
  { abbr: 'ME', fullName: 'Teknisi Mechanical Electrical' },
  { abbr: 'MEP', fullName: 'Mechanical Electrical Plumbing' },
  { abbr: 'HVAC', fullName: 'Teknisi HVAC' },
  { abbr: 'QS', fullName: 'Quantity Surveyor' },
  { abbr: 'SCM', fullName: 'Supply Chain' },
  { abbr: 'EXIM', fullName: 'Export Import' },
  // -- Keuangan --
  { abbr: 'FA', fullName: 'Finance and Accounting' },
  { abbr: 'AR', fullName: 'Accounts Receivable' },
  { abbr: 'AP', fullName: 'Accounts Payable' },
  // -- Lainnya --
  { abbr: 'MT', fullName: 'Management Trainee' },
]

// Kunci lookup: huruf besar, titik dibuang, spasi dirapikan — supaya
// "qc", "QC", dan "Q.C." semuanya menunjuk entri yang sama.
function normalizeAbbrKey(text: string): string {
  return text.toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ').trim()
}

const GLOSSARY_BY_KEY = new Map<string, JobGlossaryEntry>()
for (const entry of JOB_GLOSSARY) {
  const key = normalizeAbbrKey(entry.abbr)
  if (!GLOSSARY_BY_KEY.has(key)) GLOSSARY_BY_KEY.set(key, entry)
}

// Token = rangkaian yang diawali huruf dan boleh memuat angka, &, /, .,
// atau - (mis. "QC", "Q.C.", "R&D", "UI/UX", "QA/QC"). Tanda baca lain
// (koma, kurung) menjadi batas token, jadi singkatan di dalamnya tetap
// dikenali sebagai kata utuh.
const TOKEN_PATTERN = /[A-Za-z][A-Za-z0-9&./-]*/g

function expandToken(token: string): string {
  const direct = GLOSSARY_BY_KEY.get(normalizeAbbrKey(token))
  if (direct) return direct.fullName
  // Gabungan garis miring yang bukan satu entri utuh (mis. "QA/QC"):
  // perluas tiap sisinya secara terpisah.
  if (token.includes('/')) {
    let changed = false
    const parts = token.split('/').map((part) => {
      const hit = GLOSSARY_BY_KEY.get(normalizeAbbrKey(part))
      if (hit) {
        changed = true
        return hit.fullName
      }
      return part
    })
    if (changed) return parts.join(' / ')
  }
  return token
}

/**
 * Perluas singkatan pekerjaan di dalam teks posisi target menjadi nama
 * lengkapnya: "QC" → "Quality Control", "Staff QC" → "Staff Quality
 * Control", "SPV Produksi" → "Supervisor Produksi". Teks tanpa singkatan
 * yang dikenal dikembalikan apa adanya.
 */
export function expandJobTitle(input: string): string {
  const raw = input.trim()
  if (!raw) return input
  const whole = GLOSSARY_BY_KEY.get(normalizeAbbrKey(raw))
  if (whole) return whole.fullName
  return raw.replace(TOKEN_PATTERN, (token) => expandToken(token))
}

export interface JobAbbreviationMatch {
  /** Singkatan persis seperti tertulis di glosarium, mis. "QC". */
  abbr: string
  /** Nama pekerjaan lengkapnya, mis. "Quality Control". */
  fullName: string
  /** Seluruh input dengan singkatannya sudah diperluas. */
  expanded: string
}

/**
 * Temukan singkatan pekerjaan pertama yang dikenal di dalam input, atau
 * null bila tidak ada. Kecocokan selalu per kata utuh — potongan huruf di
 * tengah kata lain (mis. "QCA", "Backend") tidak pernah dianggap
 * singkatan.
 */
export function findJobAbbreviation(input: string): JobAbbreviationMatch | null {
  const raw = input.trim()
  if (!raw) return null
  const whole = GLOSSARY_BY_KEY.get(normalizeAbbrKey(raw))
  if (whole) return { abbr: whole.abbr, fullName: whole.fullName, expanded: whole.fullName }
  const tokens = raw.match(TOKEN_PATTERN) ?? []
  for (const token of tokens) {
    const direct = GLOSSARY_BY_KEY.get(normalizeAbbrKey(token))
    if (direct) {
      return { abbr: direct.abbr, fullName: direct.fullName, expanded: expandJobTitle(raw) }
    }
    if (token.includes('/')) {
      for (const part of token.split('/')) {
        const hit = GLOSSARY_BY_KEY.get(normalizeAbbrKey(part))
        if (hit) {
          return { abbr: hit.abbr, fullName: hit.fullName, expanded: expandJobTitle(raw) }
        }
      }
    }
  }
  return null
}
