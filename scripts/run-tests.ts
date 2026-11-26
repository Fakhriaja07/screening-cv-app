// Uji logika penilaian: 3 CV (kuat/menengah/lemah) + deteksi HP.
// Jalankan: npx tsx scripts/run-tests.ts
import {
  analyzeCv,
  countWords,
  detectPhone,
  findFirstPersonIOccurrences,
  findPhone,
  findPortfolio,
  findTypos,
  getExperienceEntryDetails,
  getPeriodExprs,
  getRoleWords,
  getSummarySection,
  isDominantEnglish,
  priorityRanks,
  selectPriorities,
} from '../src/lib/analyze'
import {
  JOB_GLOSSARY,
  expandJobTitle,
  findJobAbbreviation,
} from '../src/lib/jobGlossary'
import {
  addHistoryEntry,
  aspectDeltas,
  clearHistory,
  compositionDiffers,
  entryFromResult,
  historyRoleLabel,
  historyRolesMatch,
  loadHistory,
  scoreDelta,
  HISTORY_MAX_ENTRIES,
  HISTORY_STORAGE_KEY,
  type ScoreHistoryEntry,
  type StorageLike,
} from '../src/lib/history'
import { SAMPLE_CV } from '../src/lib/sampleCv'
import { DEMO_WEAK_CV } from '../src/lib/demoCv'
import {
  ADMIN_CONTACT_URL,
  AI_CLAIMED_ORDERS_STORAGE_KEY,
  AI_CREDITS_STORAGE_KEY,
  AI_PENDING_CODE_STORAGE_KEY,
  AI_PRICE,
  REDEEMED_CODES_STORAGE_KEY,
  addCredit,
  adminContactHref,
  amountForCode,
  clearPendingCode,
  consumeCredit,
  formatRupiah,
  getCredits,
  getOrCreatePendingCode,
  isCodeRedeemed,
  isOrderClaimed,
  markOrderClaimed,
  normalizeTokenCode,
  redeemTokenCode,
} from '../src/lib/payment'
import { TOKEN_CODE_HASHES } from '../src/lib/tokenCodes'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  MIDTRANS_ENABLED_PAYMENTS,
  apiHostFor,
  buildOrderId,
  isValidOrderId,
  mapMidtransStatus,
  resolveMidtransMode,
  snapHostFor,
  snapJsUrlFor,
} from '../src/lib/midtrans'
import {
  basicAuthHeader,
  computeNotificationSignature,
  verifyNotificationSignature,
} from '../api/_midtrans.js'
import {
  ROLE_SKILLS,
  buildSummaryTemplate,
  checkSkills,
  getCheckExample,
  getRoleSkills,
} from '../src/lib/examples'
import { ROLE_OPTIONS, filterRoleOptions } from '../src/lib/roleOptions'
import {
  buildReportText,
  formatReportDate,
  reportFileName,
} from '../src/lib/report'
import { buildPersonalExamples } from '../src/lib/personalExamples'
import { buildReportPdf, buildReportPdfBytes, sanitizePdfText } from '../src/lib/pdf'
import {
  buildAiFixContext,
  buildAiRoleContext,
  validateAiAnalysis,
  type AiAnalysis,
} from '../src/lib/ai'
import { buildPrompt, parseAiJson, parseFailedChecks, parseRoleContext } from '../api/analyze-ai.js'
const MEDIUM_CV = `Budi Santoso
budi.santoso@gmail.com | 0812-9876-5432 | linkedin.com/in/budisantoso

Ringkasan
Saya lulusan baru yang tertarik di bidang administrasi dan data entry, terbiasa menggunakan komputer.

Pengalaman
Magang Administrasi — PT Sinar Abadi (2023)
- Membantu mengelola arsip dokumen perusahaan setiap hari.
- Membuat laporan sederhana untuk tim administrasi.
- Melayani pelanggan yang datang ke kantor.

Pendidikan
SMK Negeri 1 Jakarta — Jurusan Administrasi Perkantoran (2020 - 2023)

Keahlian
Microsoft Word, Microsoft Excel, Mengetik, Internet`

const WEAK_CV = `Andi Pratama
andi.pratama@gmail.com
Saya Andi. Saya pernah bekerja di toko pakaian selama dua tahun. Saya bisa mengoperasikan kasir dan melayani pembeli. Pendidikan terakhir SMA. Saya ingin segera bekerja dan dekat rumah.`

let failures = 0
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'LOLOS' : 'GAGAL'} — ${name}: ${detail}`)
  if (!ok) failures++
}

const strong = analyzeCv(SAMPLE_CV)
console.log('CV KUAT per aspek:', strong.aspects.map((a) => `${a.name} ${a.score}/${a.max}`).join(' | '))
check('CV kuat (contoh bawaan)', strong.total >= 90 && strong.total <= 98, `skor ${strong.total}/100 (${strong.label})`)

const medium = analyzeCv(MEDIUM_CV)
console.log('CV MENENGAH per aspek:', medium.aspects.map((a) => `${a.name} ${a.score}/${a.max}`).join(' | '))
check('CV menengah realistis', medium.total >= 50 && medium.total <= 65, `skor ${medium.total}/100 (${medium.label})`)

const weak = analyzeCv(WEAK_CV)
console.log('CV LEMAH per aspek:', weak.aspects.map((a) => `${a.name} ${a.score}/${a.max}`).join(' | '))
check('CV lemah', weak.total <= 20, `skor ${weak.total}/100 (${weak.label})`)

check('HP format kurung "(62 8 ) 95 - 6031 - 48022"', detectPhone('(62 8 ) 95 - 6031 - 48022') === true, 'harus true')
check('HP rentang tahun "2022 - 2024"', detectPhone('Bekerja tahun 2022 - 2024 di Jakarta') === false, 'harus false')
check('HP telepon kantor "021-5551234"', detectPhone('Telepon kantor 021-5551234') === false, 'harus false')
check('Portofolio github.com terdeteksi', findPortfolio('github.com/Fakhriaja07') !== null, String(findPortfolio('github.com/Fakhriaja07')))
check('Kata "portofolio" tanpa alamat', findPortfolio('Saya punya portofolio yang bagus') === null, 'harus null')

// ---------- Uji riwayat skor (Fase 1) ----------
class MockStorage implements StorageLike {
  private map = new Map<string, string>()
  getItem(k: string): string | null {
    return this.map.get(k) ?? null
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v)
  }
  removeItem(k: string): void {
    this.map.delete(k)
  }
}

const store = new MockStorage()
const entry1 = entryFromResult(strong, 'Data Analyst', new Date('2026-11-19T10:00:00.000Z'))
addHistoryEntry(entry1, store)
const loaded1 = loadHistory(store)
check(
  'Riwayat: simpan → baca kembali',
  loaded1.length === 1 &&
    loaded1[0].total === strong.total &&
    loaded1[0].label === strong.label &&
    loaded1[0].role === 'Data Analyst' &&
    loaded1[0].aspects.length === 6,
  `entri terbaca ${loaded1.length}, total ${loaded1[0]?.total}`,
)

const storedRaw = store.getItem(HISTORY_STORAGE_KEY) ?? ''
const storedKeys = storedRaw ? Object.keys(JSON.parse(storedRaw)[0]).sort() : []
check(
  'Riwayat: hanya data skor yang disimpan (tanpa teks CV)',
  JSON.stringify(storedKeys) === JSON.stringify(['aspects', 'at', 'label', 'role', 'total']) &&
    !storedRaw.includes('Budi') &&
    !storedRaw.toLowerCase().includes('cvtext'),
  `kunci tersimpan: ${storedKeys.join(', ')}`,
)

const store2 = new MockStorage()
for (let i = 1; i <= HISTORY_MAX_ENTRIES + 2; i++) {
  const e: ScoreHistoryEntry = {
    at: new Date(Date.UTC(2026, 10, 19, 0, i)).toISOString(),
    total: i,
    label: 'Uji',
    role: '',
    aspects: strong.aspects.map((a) => ({ name: a.name, score: a.score, max: a.max })),
  }
  addHistoryEntry(e, store2)
}
const loaded2 = loadHistory(store2)
check(
  `Riwayat: dibatasi ${HISTORY_MAX_ENTRIES} entri terbaru`,
  loaded2.length === HISTORY_MAX_ENTRIES && loaded2[0].total === HISTORY_MAX_ENTRIES + 2,
  `tersimpan ${loaded2.length} entri, teratas total ${loaded2[0]?.total}`,
)

const store3 = new MockStorage()
store3.setItem(HISTORY_STORAGE_KEY, 'bukan-json{{{')
let corruptOk = false
try {
  corruptOk = loadHistory(store3).length === 0
} catch {
  corruptOk = false
}
store3.setItem(HISTORY_STORAGE_KEY, '[123, null, {"at": 5}]')
try {
  corruptOk = corruptOk && loadHistory(store3).length === 0
} catch {
  corruptOk = false
}
check('Riwayat: data rusak diabaikan tanpa crash', corruptOk, 'loadHistory mengembalikan []')

const dUp = scoreDelta(57, 73)
const dDown = scoreDelta(73, 57)
const dSame = scoreDelta(60, 60)
check(
  'Selisih skor naik/turun/tetap',
  dUp.delta === 16 && dUp.direction === 'naik' && dUp.text === '+16' &&
    dDown.delta === -16 && dDown.direction === 'turun' && dDown.text === '-16' &&
    dSame.delta === 0 && dSame.direction === 'tetap' && dSame.text === '0',
  `57→73 ${dUp.text} (${dUp.word}), 73→57 ${dDown.text} (${dDown.word}), 60→60 ${dSame.text} (${dSame.word})`,
)

const prevEntry: ScoreHistoryEntry = {
  at: '2026-11-18T10:00:00.000Z',
  total: 57,
  label: 'Perlu Perbaikan',
  role: '',
  aspects: [
    { name: 'Kontak', score: 13, max: 20 },
    { name: 'Pengalaman', score: 18, max: 28 },
  ],
}
const currEntry: ScoreHistoryEntry = {
  at: '2026-11-19T10:00:00.000Z',
  total: 73,
  label: 'Sudah Bagus',
  role: '',
  aspects: [
    { name: 'Kontak', score: 13, max: 20 },
    { name: 'Pengalaman', score: 24, max: 28 },
  ],
}
const aDeltas = aspectDeltas(prevEntry, currEntry)
check(
  'Selisih per aspek',
  aDeltas.length === 2 &&
    aDeltas[0].delta === 0 && aDeltas[0].direction === 'tetap' &&
    aDeltas[1].delta === 6 && aDeltas[1].direction === 'naik' && aDeltas[1].previous === 18,
  aDeltas.map((a) => `${a.name} ${a.previous}→${a.score} (${a.delta})`).join(' | '),
)

clearHistory(store)
check('Riwayat: hapus mengosongkan storage', loadHistory(store).length === 0, 'setelah clearHistory terbaca 0 entri')

// ---------- Rombakan penilaian berbasis aspek (2026-11-19) ----------
// Pengetatan kuota angka (93/51/7) DIBATALKAN atas koreksi pengguna;
// keketatan kini dari aspek yang dinilai. Kuota dasar kembali ke v1
// (ambang label ≥85/≥70/≥50; kata kerja aksi ≥5; hasil terukur ≥3;
// skill ≥8; panjang ideal 220–900 kata).
check(
  'Standar aspek: skor patokan tanpa lowongan terkunci 96/63/19',
  strong.total === 96 && medium.total === 63 && weak.total === 19,
  `kuat ${strong.total}, menengah ${medium.total}, lemah ${weak.total} (harus 96/63/19; riwayat: 96/61/14 pada standar 2026-11-21 + keputusan audit 2026-11-24 — pergerakan 2026-11-24 malam dari pengetatan lima dimensi baru: kuat tetap 96 (lulus penuh semua pemeriksaan baru; bobot yang digeser saling meniadakan), menengah 61 → 63 (Pengalaman +1: kestabilan & klaim netral-penuh +4 dikurangi heading/kedalaman/frasa −3; Format +1: nama file netral +2 dikurangi periode −1), lemah 14 → 19 (Kontak +1: profesionalitas email lulus +2 dikurangi email −1; klaim netral +2; nama file netral +2 — ketiganya poin dari dimensi yang memang tidak dilanggar CV lemah, sesuai aturan netral yang disetujui))`,
)

check(
  'Rombakan aspek: label kembali ke ambang v1',
  strong.label === 'Sangat Siap Dilamar' &&
    medium.label === 'Perlu Perbaikan' &&
    weak.label === 'Perlu Dirombak Dulu',
  `kuat ${strong.total} (${strong.label}), menengah ${medium.total} (${medium.label}), lemah ${weak.total} (${weak.label})`,
)

const strongCheck = (id: string) => strong.aspects.flatMap((a) => a.checks).find((c) => c.id === id)
const mediumCheck = (id: string) => medium.aspects.flatMap((a) => a.checks).find((c) => c.id === id)
const weakCheck = (id: string) => weak.aspects.flatMap((a) => a.checks).find((c) => c.id === id)
const checkOf = (r: ReturnType<typeof analyzeCv>, id: string) =>
  r.aspects.flatMap((a) => a.checks).find((c) => c.id === id)

check(
  'Rombakan aspek: CV kuat kehilangan poin hanya dari aspek baru (sertifikasi & bahasa)',
  strong.total < 100 &&
    strongCheck('sertifikasi')?.score === 0 &&
    strongCheck('bahasa')?.score === 1 &&
    strongCheck('kedalaman-entri')?.score === 3 &&
    strongCheck('frasa-lemah')?.score === 2 &&
    strongCheck('konsistensi-format')?.score === 3 &&
    strongCheck('kerapian-bahasa')?.score === 2 &&
    strongCheck('hasil-terukur')?.score === 5 &&
    strongCheck('kata-kerja-aksi')?.score === 5 &&
    strongCheck('lokasi')?.score === 1 &&
    strongCheck('portofolio')?.score === 2 &&
    strongCheck('linimasa')?.score === 3 &&
    strongCheck('proyek')?.score === 2,
  `kuat: sertifikasi ${strongCheck('sertifikasi')?.score}/3, bahasa ${strongCheck('bahasa')?.score}/2, kedalaman ${strongCheck('kedalaman-entri')?.score}/3, frasa ${strongCheck('frasa-lemah')?.score}/2, konsistensi ${strongCheck('konsistensi-format')?.score}/3, kerapian ${strongCheck('kerapian-bahasa')?.score}/2, lokasi ${strongCheck('lokasi')?.score}/1, linimasa ${strongCheck('linimasa')?.score}/3, proyek ${strongCheck('proyek')?.score}/2`,
)

check(
  'Standar aspek: jumlah pemeriksaan 27 (29 bila posisi target diisi)',
  strong.aspects.flatMap((a) => a.checks).length === 27 &&
    analyzeCv(SAMPLE_CV, { targetRole: 'Data Analyst' }).aspects.flatMap((a) => a.checks).length === 29,
  `tanpa peran ${strong.aspects.flatMap((a) => a.checks).length}, dengan peran ${analyzeCv(SAMPLE_CV, { targetRole: 'Data Analyst' }).aspects.flatMap((a) => a.checks).length}`,
)

// --- Pemeriksaan baru: frasa lemah & klise ---
const CLICHE_CV = `Sari Wulandari
sari.wulandari@gmail.com | 0813-1111-2222

Ringkasan
Saya pekerja keras, mampu bekerja di bawah tekanan, dapat bekerja dalam tim maupun individu, dan bersedia ditempatkan di mana saja.

Pengalaman
Kasir — Toko Berkah (2022 - 2023)
- Bertanggung jawab atas kasir dan melayani pembeli setiap hari.`
const cliche = analyzeCv(CLICHE_CV)
check(
  'Aspek baru: frasa klise terdeteksi & dilaporkan (negatif)',
  checkOf(cliche, 'frasa-lemah')?.score === 0 &&
    (checkOf(cliche, 'frasa-lemah')?.message.includes('"pekerja keras"') ?? false) &&
    (checkOf(cliche, 'frasa-lemah')?.message.includes('"bertanggung jawab atas"') ?? false),
  `skor ${checkOf(cliche, 'frasa-lemah')?.score}/2; pesan: ${checkOf(cliche, 'frasa-lemah')?.message.slice(0, 110)}…`,
)
check(
  'Aspek baru: tanpa frasa klise → poin penuh (positif)',
  mediumCheck('frasa-lemah')?.score === 2 && weakCheck('frasa-lemah')?.score === 0,
  `menengah ${mediumCheck('frasa-lemah')?.score}/2 (tanpa klise), lemah ${weakCheck('frasa-lemah')?.score}/2 (tanpa bagian ringkasan/pengalaman → tidak diberi poin cuma-cuma)`,
)

// --- Pemeriksaan baru: kedalaman entri ---
const SHALLOW_CV = `Dedi Kurnia
dedi.kurnia@gmail.com

Pengalaman
Kasir — Toko Berkah (2022 - 2023)
Staf Gudang — PT Logistik Jaya (2021 - 2022)`
const shallow = analyzeCv(SHALLOW_CV)
check(
  'Aspek baru: entri hanya judul tanpa uraian → kedalaman 0 (negatif)',
  checkOf(shallow, 'kedalaman-entri')?.score === 0 &&
    (checkOf(shallow, 'kedalaman-entri')?.message.includes('tanpa uraian isi') ?? false),
  `skor ${checkOf(shallow, 'kedalaman-entri')?.score}/5; pesan: ${checkOf(shallow, 'kedalaman-entri')?.message.slice(0, 110)}…`,
)
const HALF_DEEP_CV = `Dedi Kurnia
dedi.kurnia@gmail.com

Pengalaman
Kasir — Toko Berkah (2022 - 2023)
- Melayani pembeli setiap hari.
Staf Gudang — PT Logistik Jaya (2021 - 2022)`
check(
  'Aspek baru: separuh entri lengkap → kedalaman sebagian (campuran)',
  checkOf(analyzeCv(HALF_DEEP_CV), 'kedalaman-entri')?.score === 2 &&
    mediumCheck('kedalaman-entri')?.score === 3,
  `campuran ${checkOf(analyzeCv(HALF_DEEP_CV), 'kedalaman-entri')?.score}/3, menengah (1 entri lengkap) ${mediumCheck('kedalaman-entri')?.score}/3`,
)

// --- Pemeriksaan baru: konsistensi format & urutan ---
const MIXED_FORMAT_CV = `Dedi Kurnia
dedi.kurnia@gmail.com

Pengalaman
Kasir — Toko Berkah (Jan 2021 - Des 2022)
- Melayani pembeli setiap hari.
Staf Gudang — PT Logistik Jaya (2023 - 2024)
- Mencatat stok barang masuk dan keluar.`
const mixedFmt = analyzeCv(MIXED_FORMAT_CV)
check(
  'Aspek baru: format periode campur + urutan lama-dulu → konsistensi 0 (negatif)',
  checkOf(mixedFmt, 'konsistensi-format')?.score === 0 &&
    (checkOf(mixedFmt, 'konsistensi-format')?.message.includes('campur aduk') ?? false) &&
    (checkOf(mixedFmt, 'konsistensi-format')?.message.includes('belum dari yang terbaru') ?? false),
  `skor ${checkOf(mixedFmt, 'konsistensi-format')?.score}/3; pesan: ${checkOf(mixedFmt, 'konsistensi-format')?.message.slice(0, 130)}…`,
)
check(
  'Aspek baru: format seragam & urutan terbaru-dulu → konsistensi penuh (positif)',
  strongCheck('konsistensi-format')?.score === 3,
  `kuat ${strongCheck('konsistensi-format')?.score}/3`,
)

// --- Pemeriksaan baru: kerapian bahasa ---
const MESSY_LANG_CV = `Dedi Kurnia
dedi.kurnia@gmail.com

Pengalaman
Kasir — Toko Berkah (2022 - 2023)
- Saya melayani pembeli dan saya mencatat uang masuk setiap hari.
- Saya melakukan aktifitas kasir dan praktek menghitung uang.
- Saya membantu mengangkat barang dan saya menata display toko.`
const messy = analyzeCv(MESSY_LANG_CV)
check(
  'Aspek baru: salah eja + "saya" berlebihan → kerapian 0 (negatif)',
  checkOf(messy, 'kerapian-bahasa')?.score === 0 &&
    (checkOf(messy, 'kerapian-bahasa')?.message.includes('"aktifitas"') ?? false) &&
    (checkOf(messy, 'kerapian-bahasa')?.message.includes('"praktek"') ?? false),
  `skor ${checkOf(messy, 'kerapian-bahasa')?.score}/2; pesan: ${checkOf(messy, 'kerapian-bahasa')?.message.slice(0, 130)}…`,
)

// --- Pemeriksaan baru: sertifikasi & bahasa ---
const CERT_LANG_CV = `Rina Amelia
rina.amelia@gmail.com | 0812-3333-4444

Pengalaman
Staf Administrasi — PT Maju Bersama (2022 - 2024)
- Mengelola arsip dan input data harian.

Sertifikasi & Pelatihan
- Sertifikat BNSP Data Entry (2024)
- Pelatihan Microsoft Excel Lanjutan — LPK Komputama (2023)

Bahasa
Bahasa Inggris — aktif, TOEFL 550
Bahasa Mandarin — dasar`
const certLang = analyzeCv(CERT_LANG_CV)
check(
  'Aspek baru: bagian sertifikasi & bahasa tersendiri → poin penuh (positif)',
  checkOf(certLang, 'sertifikasi')?.score === 3 && checkOf(certLang, 'bahasa')?.score === 2,
  `sertifikasi ${checkOf(certLang, 'sertifikasi')?.score}/3, bahasa ${checkOf(certLang, 'bahasa')?.score}/2`,
)
const CERT_MENTION_CV = `Rina Amelia
rina.amelia@gmail.com

Ringkasan
Saya memiliki sertifikat pelatihan komputer dari lembaga kursus lokal dan berpengalaman bekerja dua tahun di bidang administrasi perkantoran dan pengarsipan dokumen.`
check(
  'Aspek baru: sertifikasi hanya disebut (bukan bagian) → poin sebagian; tanpa bahasa → 0',
  checkOf(analyzeCv(CERT_MENTION_CV), 'sertifikasi')?.score === 1 &&
    mediumCheck('sertifikasi')?.score === 0 &&
    mediumCheck('bahasa')?.score === 0,
  `sebutan saja ${checkOf(analyzeCv(CERT_MENTION_CV), 'sertifikasi')?.score}/3, menengah sertifikasi ${mediumCheck('sertifikasi')?.score}/3 & bahasa ${mediumCheck('bahasa')?.score}/2`,
)

// --- Pemeriksaan baru: relevansi ringkasan terhadap posisi target ---
const strongRole = analyzeCv(SAMPLE_CV, { targetRole: 'Data Analyst' })
const mediumWrongRole = analyzeCv(MEDIUM_CV, { targetRole: 'Akuntansi' })
check(
  'Aspek baru: relevansi ringkasan — menyebut posisi target (positif) vs tidak sama sekali (negatif)',
  checkOf(strongRole, 'relevansi-ringkasan')?.score === 3 &&
    checkOf(strongRole, 'ringkasan')?.max === 7 &&
    checkOf(mediumWrongRole, 'relevansi-ringkasan')?.score === 0 &&
    strongCheck('relevansi-ringkasan') === undefined,
  `kuat+Data Analyst relevansi ${checkOf(strongRole, 'relevansi-ringkasan')?.score}/3 (ringkasan maks ${checkOf(strongRole, 'ringkasan')?.max}), menengah+Akuntansi ${checkOf(mediumWrongRole, 'relevansi-ringkasan')?.score}/3, tanpa peran: pemeriksaan tidak ada`,
)

// ---------- Uji Fase 2: contoh kalimat, template, daftar skill ----------

const weakTop3 = weak.priorities.slice(0, 3)
check(
  'Fase 2: prioritas utama CV lemah punya contoh',
  weakTop3.length === 3 && weakTop3.every((c) => getCheckExample(c.id) !== null),
  weakTop3.map((c) => `${c.id}: ${getCheckExample(c.id) ? 'ada' : 'TIDAK ADA'}`).join(' | '),
)

const allCovered = [...weak.priorities, ...medium.priorities].every((c) => getCheckExample(c.id) !== null)
check(
  'Fase 2: semua prioritas CV lemah & menengah punya contoh',
  allCovered,
  `prioritas lemah ${weak.priorities.length}, menengah ${medium.priorities.length}`,
)

const exMeasurable = getCheckExample('hasil-terukur')
check(
  'Fase 2: contoh hasil-terukur memakai placeholder angka',
  exMeasurable !== null && exMeasurable.sesudah.includes('[') && exMeasurable.catatan.includes('Jangan mengarang'),
  exMeasurable ? `sesudah: "${exMeasurable.sesudah.slice(0, 60)}…"` : 'contoh tidak ditemukan',
)

check(
  'Fase 2: id pemeriksaan tak dikenal → tanpa contoh',
  getCheckExample('id-ngawur') === null,
  'harus null',
)

const tplRole = buildSummaryTemplate('Data Analyst')
const tplEmpty = buildSummaryTemplate('   ')
check(
  'Fase 2: template ringkasan memakai posisi target',
  tplRole.includes('posisi Data Analyst') && tplRole.includes('[skill 1]'),
  `dengan peran: "…${tplRole.slice(tplRole.indexOf('posisi'), tplRole.indexOf('posisi') + 30)}…"`,
)
check(
  'Fase 2: template tanpa posisi → placeholder peran',
  tplEmpty.includes('[posisi yang dilamar]'),
  'placeholder [posisi yang dilamar] tampil',
)

// ---------- Uji contoh personal "Contoh dari CV-mu" (2026-11-24) ----------
// Kutipan harus berasal dari teks CV yang dianalisis sendiri (bukan
// contoh generik), versi perbaikan hanya boleh berisi kata-kata
// pengguna + placeholder kurung — tidak ada angka pencapaian karangan.

const demoResult = analyzeCv(DEMO_WEAK_CV)
const demoPersonal = buildPersonalExamples(demoResult, DEMO_WEAK_CV, '')

const pWeak = demoPersonal['frasa-lemah']
check(
  'Personal: frasa-lemah mengutip baris CV sendiri yang memuat frasa lemah',
  !!pWeak &&
    pWeak.kutipanAsli.includes('bertanggung jawab atas') &&
    DEMO_WEAK_CV.includes(pWeak.kutipanAsli) &&
    !pWeak.versiPerbaikan.toLowerCase().includes('bertanggung jawab atas') &&
    pWeak.versiPerbaikan.includes('[bukti konkretmu]'),
  pWeak ? `kutipan: "${pWeak.kutipanAsli.slice(0, 60)}…"` : 'contoh personal tidak ada',
)

const pMeasurable = demoPersonal['hasil-terukur']
const numbersIn = (s: string) => s.match(/\d+/g) ?? []
check(
  'Personal: hasil-terukur mengutip poin tanpa angka + placeholder, tanpa angka karangan',
  !!pMeasurable &&
    DEMO_WEAK_CV.includes(pMeasurable.kutipanAsli) &&
    pMeasurable.versiPerbaikan.includes('[tambahkan hasil terukurmu') &&
    numbersIn(pMeasurable.versiPerbaikan).every((n) => numbersIn(pMeasurable.kutipanAsli).includes(n)),
  pMeasurable
    ? `kutipan tanpa angka → sesudah memuat angka: [${numbersIn(pMeasurable.versiPerbaikan).join(', ')}]`
    : 'contoh personal tidak ada',
)

const pVerb = demoPersonal['kata-kerja-aksi']
check(
  'Personal: kata-kerja-aksi mengutip poin berawalan lemah dari CV sendiri',
  !!pVerb &&
    DEMO_WEAK_CV.includes(pVerb.kutipanAsli) &&
    pVerb.versiPerbaikan.startsWith('• [kata kerja aksi'),
  pVerb ? `sesudah: "${pVerb.versiPerbaikan.slice(0, 60)}…"` : 'contoh personal tidak ada',
)

const pTypo = demoPersonal['kerapian-bahasa']
check(
  'Personal: kerapian-bahasa menampilkan koreksi baku dari baris CV sendiri',
  !!pTypo &&
    pTypo.kutipanAsli.includes('aktifitas') &&
    pTypo.versiPerbaikan.includes('aktivitas') &&
    !/\baktifitas\b/.test(pTypo.versiPerbaikan) &&
    pTypo.catatan.includes('"aktivitas"'),
  pTypo ? `sesudah: "${pTypo.versiPerbaikan.slice(0, 60)}…"` : 'contoh personal tidak ada',
)

// "Saya" berlebihan tanpa salah eja → contoh personal membuang kata
// ganti dari kata-kata pengguna sendiri.
const SAYA_CV = `Rani Wijaya
rani.wijaya@gmail.com | 0813-2222-3333 | linkedin.com/in/raniwijaya

Ringkasan
Lulusan SMK yang terbiasa bekerja rapi dan tepat waktu dalam pelayanan pelanggan.

Pengalaman
Kasir — Toko Berkah (2023 - 2024)
- Saya melayani pembeli setiap hari.
- Saya mencatat stok barang di gudang.
- Saya membersihkan area kasir setiap pagi.
- Saya menyusun laporan penjualan harian.

Pendidikan
SMK Negeri 1 Bandung — Jurusan Akuntansi (2020 - 2023)

Keahlian
Microsoft Word, Microsoft Excel, Kasir, Pelayanan, Komunikasi, Kerja Tim, Ketelitian, Bahasa Inggris`
const sayaResult = analyzeCv(SAYA_CV)
const pSaya = buildPersonalExamples(sayaResult, SAYA_CV, '')['kerapian-bahasa']
check(
  'Personal: "saya" berlebihan → versi perbaikan membuang kata ganti, isi tetap kata pengguna',
  !!pSaya &&
    pSaya.kutipanAsli.includes('Saya melayani pembeli') &&
    pSaya.versiPerbaikan.includes('Melayani pembeli setiap hari.') &&
    !/^- Saya/m.test(pSaya.versiPerbaikan) &&
    pSaya.catatan.includes('kali di bagian pengalaman'),
  pSaya ? `sesudah: "${pSaya.versiPerbaikan.split('\n')[0]}"` : 'contoh personal tidak ada',
)

// Entri dangkal (tanpa perusahaan + tanpa uraian) → contoh kedalaman
// mengutip entri itu dan menandai komponen yang hilang sebagai placeholder.
const NO_COMPANY_CV = `Dedi Kurnia
dedi.kurnia@gmail.com | 0821-4444-5555 | linkedin.com/in/dedikurnia

Ringkasan
Lulusan SMK jurusan logistik yang terbiasa dengan pekerjaan gudang dan pencatatan stok barang.

Pengalaman
Kasir — Toko Berkah (2023 - 2024)
- Melayani 50 pembeli setiap hari dan mencatat kas.

Staf Gudang (2021 - 2022)

Pendidikan
SMK Negeri 3 Bandung — Jurusan Logistik (2018 - 2021)

Keahlian
Microsoft Word, Microsoft Excel, Stok Opname, Pengarsipan, Komunikasi, Kerja Tim, Ketelitian, Bahasa Inggris`
const shallowResult = analyzeCv(NO_COMPANY_CV)
const pDepth = buildPersonalExamples(shallowResult, NO_COMPANY_CV, '')['kedalaman-entri']
check(
  'Personal: kedalaman-entri mengutip entri dangkal + placeholder komponen hilang',
  !!pDepth &&
    pDepth.kutipanAsli.includes('Staf Gudang') &&
    pDepth.versiPerbaikan.includes('[nama perusahaan/tempat kerja]') &&
    pDepth.versiPerbaikan.includes('[uraian tugas dan hasilmu'),
  pDepth ? `sesudah: "${pDepth.versiPerbaikan.replace(/\n/g, ' / ').slice(0, 80)}…"` : 'contoh personal tidak ada',
)

// Ringkasan + relevansi ringkasan memakai ringkasan pengguna sendiri
// dan posisi target yang ia isi.
const demoRoleResult = analyzeCv(DEMO_WEAK_CV, { targetRole: 'Kasir' })
const demoRolePersonal = buildPersonalExamples(demoRoleResult, DEMO_WEAK_CV, 'Kasir')
const pSummary = demoRolePersonal['ringkasan']
const pRelevance = demoRolePersonal['relevansi-ringkasan']
check(
  'Personal: ringkasan & relevansi memakai teks ringkasan + posisi target pengguna',
  !!pSummary &&
    pSummary.kutipanAsli.startsWith('Saya adalah lulusan baru') &&
    pSummary.catatan.includes('34 kata') &&
    !!pRelevance &&
    pRelevance.versiPerbaikan.endsWith('Saat ini saya mencari posisi Kasir.'),
  `ringkasan: ${pSummary ? 'ada' : 'TIDAK ADA'}, relevansi: ${pRelevance ? 'ada' : 'TIDAK ADA'}`,
)

// Pemeriksaan ketiadaan (LinkedIn belum tercantum) TIDAK dipersonalisasi
// — contoh generik tetap dipakai untuknya.
check(
  'Personal: pemeriksaan ketiadaan (LinkedIn) tetap generik',
  demoPersonal['linkedin'] === undefined && getCheckExample('linkedin') !== null,
  `personal linkedin: ${demoPersonal['linkedin'] === undefined ? 'tidak ada (benar)' : 'ADA (salah)'}, generik: ${getCheckExample('linkedin') ? 'ada' : 'tidak ada'}`,
)

// CV kuat: pemeriksaan yang dipersonalisasi sudah "baik" semua →
// tidak ada contoh personal (tidak ada yang perlu dicontohkan).
const strongPersonal = buildPersonalExamples(strong, SAMPLE_CV, '')
check(
  'Personal: CV kuat tanpa contoh personal untuk pemeriksaan inti',
  strongPersonal['frasa-lemah'] === undefined &&
    strongPersonal['hasil-terukur'] === undefined &&
    strongPersonal['kerapian-bahasa'] === undefined &&
    strongPersonal['ringkasan'] === undefined,
  `kunci personal CV kuat: [${Object.keys(strongPersonal).join(', ')}]`,
)

// Linimasa CV lemah: periode entri tidak terbaca sama sekali →
// personalisasi tidak dipaksakan, contoh generik tetap dipakai.
// (Uji linimasa personal untuk CV berjeda ada di bawah, sesudah
// fixture GAP_CV didefinisikan.)
const weakPersonal = buildPersonalExamples(weak, WEAK_CV, '')
check(
  'Personal: linimasa tanpa periode terbaca tetap generik',
  weakPersonal['linimasa'] === undefined && getCheckExample('linimasa') !== null,
  `personal linimasa CV lemah: ${weakPersonal['linimasa'] === undefined ? 'tidak ada (benar)' : 'ADA (salah)'}`,
)

// Konsistensi format & urutan: format periode pengguna sendiri dikutip
// persis seperti tertulis; versi perbaikan = entri yang sama dengan
// SATU format rentang tahun (tahun dari CV sendiri) + urutan dibalik.
const pConsistency = buildPersonalExamples(mixedFmt, MIXED_FORMAT_CV, '')['konsistensi-format']
check(
  'Personal: konsistensi mengutip format periode persis seperti tertulis di CV sendiri',
  !!pConsistency &&
    pConsistency.kutipanAsli.includes('Kasir — Toko Berkah (Jan 2021 - Des 2022)') &&
    pConsistency.kutipanAsli.includes('Staf Gudang — PT Logistik Jaya (2023 - 2024)') &&
    pConsistency.catatan.includes('campur aduk') &&
    pConsistency.catatan.includes('"Jan 2021"'),
  pConsistency
    ? `kutipan: "${pConsistency.kutipanAsli.replace(/\n/g, ' / ')}"`
    : 'contoh personal konsistensi tidak ada',
)
check(
  'Personal: konsistensi versi perbaikan = entri sama, satu format rentang tahun, terbaru→terlama',
  !!pConsistency &&
    pConsistency.versiPerbaikan.indexOf('Staf Gudang') < pConsistency.versiPerbaikan.indexOf('Kasir') &&
    pConsistency.versiPerbaikan.includes('Staf Gudang — PT Logistik Jaya (2023–2024)') &&
    pConsistency.versiPerbaikan.includes('Kasir — Toko Berkah (2021–2022)') &&
    !pConsistency.versiPerbaikan.includes('Jan 2021') &&
    numbersIn(pConsistency.versiPerbaikan).every((n) => MIXED_FORMAT_CV.includes(n)),
  pConsistency
    ? `sesudah: "${pConsistency.versiPerbaikan.replace(/\n/g, ' / ')}"`
    : 'contoh personal konsistensi tidak ada',
)

// CV kuat: linimasa & konsistensi sudah "baik" → tanpa contoh personal.
check(
  'Personal: CV kuat tanpa contoh personal linimasa & konsistensi',
  strongPersonal['linimasa'] === undefined && strongPersonal['konsistensi-format'] === undefined,
  `kunci personal CV kuat: [${Object.keys(strongPersonal).join(', ')}]`,
)

// ---------- Uji perluasan contoh personal: bullet + audit sisa (2026-11-24) ----------
// Menyusul teguran pengguna bahwa contoh struktur bullet masih generik
// ("Tugas saya meliputi input data…") padahal uraian di CV pengguna
// sendiri bisa dikutip — dan ia bingung arti pemeriksaannya. Bullet
// kini dipersonalisasi + pesan pemeriksaannya memuat definisi gamblang;
// hasil audit sisa id (panjang, keahlian, bahasa, relevansi-pengalaman)
// ikut dipersonalisasi dengan aturan anti-karang yang sama.

const wordTokens = (s: string) => s.toLowerCase().match(/[a-zà-ÿ]+/g) ?? []

// --- Struktur bullet: uraian paragraf pengguna sendiri dipecah ---
const BULLET_CV = `Rudi Hartono
rudi.hartono@gmail.com | 0812-3333-4444 | linkedin.com/in/rudihartono

Ringkasan
Staf administrasi berpengalaman dua tahun di perusahaan distribusi, terbiasa mengelola dokumen dan data penjualan harian.

Pengalaman
Staf Administrasi — PT Distribusi Nusantara (2022 - 2024)
Tugas saya meliputi input data penjualan ke sistem setiap hari. Saya juga membuat laporan bulanan untuk manajer dan mengarsipkan dokumen transaksi.
Menjawab telepon dari pelanggan dan mencatat pesanan yang masuk.

Pendidikan
SMK Negeri 1 Jakarta — Jurusan Administrasi Perkantoran (2019 - 2022)

Keahlian
Microsoft Word, Microsoft Excel, Input Data, Pengarsipan, Komunikasi, Kerja Tim, Ketelitian, Bahasa Inggris`
const bulletResult = analyzeCv(BULLET_CV)
const pBullet = buildPersonalExamples(bulletResult, BULLET_CV, '')['bullet']
check(
  'Personal: pesan struktur bullet memuat definisi gamblang, skor & poin tidak berubah',
  checkOf(bulletResult, 'bullet')?.score === 0 &&
    checkOf(bulletResult, 'bullet')?.max === 3 &&
    (checkOf(bulletResult, 'bullet')?.message.includes('satu poin per baris') ?? false) &&
    (checkOf(bulletResult, 'bullet')?.message.includes('bukan ditulis menyatu dalam satu paragraf panjang') ?? false),
  `skor ${checkOf(bulletResult, 'bullet')?.score}/${checkOf(bulletResult, 'bullet')?.max}; pesan: "${checkOf(bulletResult, 'bullet')?.message.slice(0, 80)}…"`,
)
check(
  'Personal: bullet mengutip uraian pengalaman pengguna sendiri (bukan contoh generik)',
  !!pBullet &&
    pBullet.kutipanAsli.includes('Tugas saya meliputi input data penjualan') &&
    BULLET_CV.includes(pBullet.kutipanAsli.split('\n')[0]) &&
    !pBullet.kutipanAsli.includes('Microsoft Excel'),
  pBullet ? `kutipan: "${pBullet.kutipanAsli.split('\n')[0].slice(0, 60)}…"` : 'contoh personal bullet tidak ada',
)
check(
  'Personal: bullet versi perbaikan = baris bullet dari kata-kata yang sama persis (anti-karang)',
  !!pBullet &&
    pBullet.versiPerbaikan.split('\n').length === 3 &&
    pBullet.versiPerbaikan.split('\n').every((l) => l.startsWith('• ')) &&
    wordTokens(pBullet.versiPerbaikan).every((w) => wordTokens(pBullet.kutipanAsli).includes(w)) &&
    !pBullet.versiPerbaikan.includes('Excel') &&
    pBullet.versiPerbaikan.includes('• Menjawab telepon dari pelanggan'),
  pBullet
    ? `sesudah: "${pBullet.versiPerbaikan.replace(/\n/g, ' / ').slice(0, 90)}…"`
    : 'contoh personal bullet tidak ada',
)
// Uraian pengalaman demo sudah berbentuk bullet semua → tidak ada
// uraian paragraf yang bisa dikutip; contoh bullet tetap generik.
check(
  'Personal: bullet tetap generik bila tidak ada uraian paragraf yang bisa dikutip',
  demoPersonal['bullet'] === undefined && getCheckExample('bullet') !== null,
  `personal bullet demo: ${demoPersonal['bullet'] === undefined ? 'tidak ada (benar)' : 'ADA (salah)'}`,
)

// --- Panjang CV: jumlah kata aktual + paragraf terpanjang pengguna ---
const pPanjangWeak = buildPersonalExamples(weak, WEAK_CV, '')['panjang']
check(
  'Personal: panjang CV terlalu pendek menyebut jumlah kata aktual + placeholder perluasan',
  !!pPanjangWeak &&
    pPanjangWeak.catatan.includes(`${countWords(WEAK_CV)} kata`) &&
    pPanjangWeak.catatan.includes('di bawah rentang ideal') &&
    pPanjangWeak.kutipanAsli.includes('Saya pernah bekerja di toko pakaian') &&
    pPanjangWeak.versiPerbaikan.includes('[tambahkan uraian pencapaian aslimu'),
  pPanjangWeak ? `catatan: "${pPanjangWeak.catatan.slice(0, 70)}…"` : 'contoh personal panjang tidak ada',
)
const LONG_SENTENCE =
  'Mengelola arsip dokumen perusahaan dan mencatat setiap transaksi penjualan harian dengan rapi dan teliti untuk laporan manajemen.'
const LONG_CV = `Nama Panjang
nama.panjang@gmail.com | 0812-0000-1111

Ringkasan
${Array(60).fill(LONG_SENTENCE).join(' ')}`
const longResult = analyzeCv(LONG_CV)
const pPanjangLong = buildPersonalExamples(longResult, LONG_CV, '')['panjang']
check(
  'Personal: panjang CV terlalu panjang menyebut jumlah kata aktual + placeholder pemadatan',
  !!pPanjangLong &&
    countWords(LONG_CV) > 900 &&
    pPanjangLong.catatan.includes(`${countWords(LONG_CV)} kata`) &&
    pPanjangLong.catatan.includes('melebihi rentang ideal') &&
    pPanjangLong.kutipanAsli.includes('Mengelola arsip dokumen perusahaan') &&
    pPanjangLong.versiPerbaikan.includes('[padatkan paragraf ini'),
  `kata CV panjang: ${countWords(LONG_CV)}; personal: ${pPanjangLong ? 'ada' : 'TIDAK ADA'}`,
)

// --- Daftar skill: item pengguna sendiri + placeholder kamus peran ---
const SKILL_CV = `Tono Wijaya
tono.wijaya@gmail.com | 0812-7777-6666 | linkedin.com/in/tonowijaya

Ringkasan
Lulusan SMK yang terbiasa melayani pelanggan dan mengoperasikan mesin kasir di toko ritel selama dua tahun.

Pengalaman
Kasir — Toko Berkah (2022 - 2024)
- Melayani 80 pembeli setiap hari dan mencatat kas.

Pendidikan
SMK Negeri 1 Surabaya — Jurusan Akuntansi (2019 - 2022)

Keahlian
Microsoft Word, Komunikasi, Kerja Tim`
const skillResult = analyzeCv(SKILL_CV, { targetRole: 'Kasir' })
const pSkills = buildPersonalExamples(skillResult, SKILL_CV, 'Kasir')['keahlian']
check(
  'Personal: keahlian mengutip item pengguna sendiri + placeholder skill dari kamus peran',
  !!pSkills &&
    pSkills.kutipanAsli === 'Microsoft Word, Komunikasi, Kerja Tim' &&
    pSkills.versiPerbaikan.startsWith(pSkills.kutipanAsli) &&
    pSkills.versiPerbaikan.includes('[Mesin Kasir (POS)]') &&
    pSkills.catatan.includes('3 item') &&
    pSkills.catatan.includes('posisi Kasir'),
  pSkills ? `sesudah: "${pSkills.versiPerbaikan.slice(0, 90)}…"` : 'contoh personal keahlian tidak ada',
)
// Tanpa bagian keahlian sama sekali → ketiadaan murni, tetap generik.
check(
  'Personal: keahlian tanpa bagian skill sama sekali tetap generik',
  weakPersonal['keahlian'] === undefined && getCheckExample('keahlian') !== null,
  `personal keahlian CV lemah: ${weakPersonal['keahlian'] === undefined ? 'tidak ada (benar)' : 'ADA (salah)'}`,
)

// --- Bahasa asing: disebut tanpa bagian/level → kutip + placeholder ---
const BAHASA_CV = `Sari Utami
sari.utami@gmail.com | 0813-9999-8888 | linkedin.com/in/sariutami

Ringkasan
Staf administrasi berpengalaman tiga tahun yang terbiasa mengarsipkan dokumen dan mampu berbahasa Inggris secara lisan maupun tulisan untuk keperluan kantor.

Pengalaman
Staf Administrasi — PT Arsip Prima (2021 - 2024)
- Mengarsipkan 200 dokumen setiap bulan.

Pendidikan
SMK Negeri 4 Jakarta — Jurusan Administrasi Perkantoran (2018 - 2021)

Keahlian
Microsoft Word, Microsoft Excel, Pengarsipan, Input Data, Komunikasi, Kerja Tim, Ketelitian, Mengetik Cepat`
const bahasaResult = analyzeCv(BAHASA_CV)
const pBahasa = buildPersonalExamples(bahasaResult, BAHASA_CV, '')['bahasa']
check(
  'Personal: bahasa mengutip baris sebutan pengguna sendiri + placeholder tingkat kemahiran',
  !!pBahasa &&
    checkOf(bahasaResult, 'bahasa')?.score === 1 &&
    pBahasa.kutipanAsli.includes('berbahasa Inggris') &&
    pBahasa.versiPerbaikan.includes('Bahasa Inggris — [tingkat kemahiranmu') &&
    pBahasa.catatan.includes('tingkat kemahirannya'),
  pBahasa ? `sesudah: "${pBahasa.versiPerbaikan.replace(/\n/g, ' / ')}"` : 'contoh personal bahasa tidak ada',
)
// Tidak disebut sama sekali di CV → ketiadaan murni, tetap generik.
check(
  'Personal: bahasa yang tidak disebut sama sekali tetap generik',
  demoPersonal['bahasa'] === undefined && getCheckExample('bahasa') !== null,
  `personal bahasa demo: ${demoPersonal['bahasa'] === undefined ? 'tidak ada (benar)' : 'ADA (salah)'}`,
)

// --- Relevansi pengalaman: entri pengguna + kata kunci target hilang ---
const relExpResult = analyzeCv(DEMO_WEAK_CV, { targetRole: 'Data Analyst' })
const pRelExp = buildPersonalExamples(relExpResult, DEMO_WEAK_CV, 'Data Analyst')[
  'relevansi-pengalaman'
]
check(
  'Personal: relevansi-pengalaman mengutip entri pengguna + placeholder kata kunci target yang hilang',
  !!pRelExp &&
    checkOf(relExpResult, 'relevansi-pengalaman')?.score === 0 &&
    pRelExp.kutipanAsli.includes('Kasir — Toko Berkah') &&
    pRelExp.versiPerbaikan.includes('[tonjolkan tugas atau hasilmu') &&
    pRelExp.versiPerbaikan.includes('"data"') &&
    pRelExp.catatan.includes('Data Analyst'),
  pRelExp ? `kutipan: "${pRelExp.kutipanAsli.split('\n')[0]}"` : 'contoh personal relevansi-pengalaman tidak ada',
)

check(
  'Fase 2: pencocokan peran ke kamus skill',
  getRoleSkills('Data Analyst').id === 'data-analyst' &&
    getRoleSkills('Staff Administrasi').id === 'administrasi' &&
    getRoleSkills('Digital Marketing').id === 'marketing' &&
    getRoleSkills('Desainer Grafis').id === 'desain-grafis' &&
    getRoleSkills('').id === 'umum',
  `Data Analyst→${getRoleSkills('Data Analyst').id}, Administrasi→${getRoleSkills('Staff Administrasi').id}, kosong→${getRoleSkills('').id}`,
)

// Pencocokan peran diperkuat (2026-11-21): teks bebas posisi target
// dicocokkan per kata/frasa dengan sinonim; frasa spesifik terpanjang
// menang atas kata umum; peran-peran umum baru tersedia di kamus.
const roleCases: Array<[string, string]> = [
  ['ADMIN', 'administrasi'],
  ['admin kantor', 'administrasi'],
  ['Data Entry', 'administrasi'],
  ['Sales Executive', 'sales'],
  ['SPG', 'sales'],
  ['Pramuniaga Toko', 'sales'],
  ['Kasir', 'kasir'],
  ['Operator Produksi', 'operator-produksi'],
  ['Guru SD', 'guru'],
  ['Perawat', 'perawat'],
  ['Bidan', 'perawat'],
  ['Teknisi Mesin', 'teknisi'],
  ['Teknisi Komputer', 'it-support'],
  ['Mekanik Bengkel', 'teknisi'],
  ['Barista', 'barista-fnb'],
  ['Pelayan Kafe', 'barista-fnb'],
  ['Satpam', 'security'],
  ['Security Mall', 'security'],
  ['Sopir Pribadi', 'driver'],
  ['Kurir', 'driver'],
  ['Content Creator', 'content-creator'],
  ['Social Media Specialist', 'content-creator'],
  ['Programmer', 'developer'],
  ['Web Developer', 'developer'],
  ['Software Developer', 'developer'],
  ['Mobile Developer', 'mobile-developer'],
  ['Android Developer', 'mobile-developer'],
  ['Flutter Developer', 'mobile-developer'],
  ['Customer Service', 'customer-service'],
  ['Staff Accounting', 'akuntansi'],
]
const roleMisses = roleCases.filter(([input, expected]) => getRoleSkills(input).id !== expected)
check(
  'Peran: sinonim & peran baru tercocokkan dari teks bebas',
  roleMisses.length === 0,
  roleMisses.length === 0
    ? `${roleCases.length} contoh posisi semua cocok (termasuk 10 peran baru)`
    : `gagal: ${roleMisses.map(([i, e]) => `${i}→${getRoleSkills(i).id} (harusnya ${e})`).join('; ')}`,
)

check(
  'Peran: posisi terisi tapi tak dikenal → label memakai nama posisi pengguna',
  getRoleSkills('Petani').id === 'kustom' &&
    getRoleSkills('Petani').label === 'Petani' &&
    getRoleSkills('Petani').posisiKustom === true &&
    getRoleSkills('Petani').skills.length >= 8 &&
    getRoleSkills('  ').id === 'umum',
  `Petani→${getRoleSkills('Petani').id} "${getRoleSkills('Petani').label}", kosong→${getRoleSkills('  ').id}`,
)

check(
  'Peran: semua entri kamus berisi 8–12 skill',
  ROLE_SKILLS.every((r) => r.skills.length >= 8 && r.skills.length <= 12) &&
    ROLE_SKILLS.length >= 18,
  `${ROLE_SKILLS.length} peran di kamus, masing-masing 8–12 skill`,
)

// ---------- Glosarium singkatan pekerjaan (2026-11-24) ----------
// Posisi target yang diketik sebagai singkatan ("QC", "Staff QC",
// "HRD") harus dikenali sebagai pekerjaan lengkapnya: mendapat daftar
// skill peran terkait, judul kartu memakai nama lengkap, dan kata
// perannya bisa dicocokkan ke isi CV oleh pemeriksaan relevansi.

check(
  'Glosarium: minimal 70 entri, singkatan unik, nama lengkap terisi',
  JOB_GLOSSARY.length >= 70 &&
    new Set(JOB_GLOSSARY.map((e) => e.abbr.toUpperCase())).size === JOB_GLOSSARY.length &&
    JOB_GLOSSARY.every((e) => e.abbr.trim() !== '' && e.fullName.trim() !== ''),
  `${JOB_GLOSSARY.length} entri glosarium`,
)

check(
  'Glosarium: singkatan diperluas ke nama pekerjaan lengkap',
  expandJobTitle('QC') === 'Quality Control' &&
    expandJobTitle('qc') === 'Quality Control' &&
    expandJobTitle('Q.C.') === 'Quality Control' &&
    expandJobTitle('QC Inspector') === 'Quality Control Inspector' &&
    expandJobTitle('SPV Produksi') === 'Supervisor Produksi' &&
    expandJobTitle('QA/QC') === 'Quality Assurance / Quality Control' &&
    findJobAbbreviation('HRD')?.fullName === 'Human Resource Development',
  `QC→"${expandJobTitle('QC')}", Staff QC→"${expandJobTitle('Staff QC')}", SPV Produksi→"${expandJobTitle('SPV Produksi')}"`,
)

check(
  'Glosarium: singkatan ambigu terpetakan ke arti yang dipilih (PM = Product Manager)',
  expandJobTitle('PM') === 'Product Manager' &&
    expandJobTitle('AM') === 'Account Manager' &&
    expandJobTitle('BM') === 'Branch Manager',
  `PM→"${expandJobTitle('PM')}", AM→"${expandJobTitle('AM')}", BM→"${expandJobTitle('BM')}"`,
)

check(
  'Glosarium: potongan huruf di tengah kata lain TIDAK salah deteksi',
  findJobAbbreviation('Staff QCA') === null &&
    findJobAbbreviation('Petugas QCP') === null &&
    expandJobTitle('Backend Developer') === 'Backend Developer' &&
    expandJobTitle('Quality Control') === 'Quality Control' &&
    expandJobTitle('Petani') === 'Petani',
  'QCA/QCP/Backend/Quality Control/Petani semua utuh tanpa perluasan keliru',
)

check(
  'Glosarium: "QC" & "Staff QC" mendapat daftar skill peran Quality Control',
  getRoleSkills('QC').id === 'operator-produksi' &&
    getRoleSkills('QC').label === 'Quality Control' &&
    getRoleSkills('qc').id === 'operator-produksi' &&
    getRoleSkills('Staff QC').id === 'operator-produksi' &&
    getRoleSkills('Staff QC').skills.includes('Quality Control') &&
    getRoleSkills('Quality Control').id === 'operator-produksi',
  `QC→${getRoleSkills('QC').id} "${getRoleSkills('QC').label}", Staff QC→${getRoleSkills('Staff QC').id}`,
)

check(
  'Glosarium: "HRD" dikenali sebagai peran HR (nama lengkap, bukan singkatan mentah)',
  findJobAbbreviation('HRD')?.abbr === 'HRD' &&
    getRoleSkills('HRD').label === 'Human Resource Development' &&
    getRoleSkills('HRD').label !== 'HRD' &&
    getRoleSkills('SPV').label === 'Supervisor' &&
    getRoleSkills('ADM').id === 'administrasi' &&
    getRoleSkills('BE').id === 'developer',
  `HRD→"${getRoleSkills('HRD').label}", SPV→"${getRoleSkills('SPV').label}", ADM→${getRoleSkills('ADM').id}`,
)

check(
  'Glosarium: kata pengisi peran tidak menempel pada judul hasil perluasan (bug "IT Support staff")',
  expandJobTitle('qc staff') === 'Quality Control' &&
    expandJobTitle('staff qc') === 'Quality Control' &&
    expandJobTitle('Staff QC') === 'Quality Control' &&
    getRoleSkills('staff qc').label === 'Quality Control' &&
    getRoleSkills('qc staff').label === 'Quality Control',
  `qc staff→"${expandJobTitle('qc staff')}", staff qc→"${expandJobTitle('staff qc')}"`,
)

check(
  'Glosarium: "IT" TIDAK ditebak sebagai IT Support (keputusan pengguna 2026-11-24) — tampil apa adanya',
  JOB_GLOSSARY.length === 74 &&
    !JOB_GLOSSARY.some((e) => e.abbr.toUpperCase() === 'IT') &&
    findJobAbbreviation('IT') === null &&
    findJobAbbreviation('it') === null &&
    findJobAbbreviation('it staff') === null &&
    expandJobTitle('IT') === 'IT' &&
    expandJobTitle('it') === 'it' &&
    expandJobTitle('it staff') === 'it staff' &&
    expandJobTitle('staff it') === 'staff it' &&
    getRoleSkills('IT').id === 'kustom' &&
    getRoleSkills('IT').label === 'IT' &&
    getRoleSkills('it').id === 'kustom' &&
    getRoleSkills('it staff').id === 'kustom' &&
    getRoleSkills('it staff').label === 'it staff' &&
    getRoleSkills('it staff').posisiKustom === true &&
    getRoleSkills('it staff').skills === getRoleSkills('').skills &&
    getRoleSkills('staff it').id === 'kustom' &&
    getRoleSkills('staff it').label === 'staff it' &&
    getRoleSkills('IT Support').id === 'it-support' &&
    getRoleSkills('IT Support').label === 'IT Support' &&
    JSON.stringify(getRoleWords('IT')) === JSON.stringify([]) &&
    JSON.stringify(getRoleWords('it staff')) === JSON.stringify([]),
  `IT→${getRoleSkills('IT').id} "${getRoleSkills('IT').label}", it staff→${getRoleSkills('it staff').id} "${getRoleSkills('it staff').label}", IT Support→${getRoleSkills('IT Support').id}`,
)

check(
  'Glosarium: kata sisa bermuatan dipertahankan & di-title-case ("SPV Produksi", "QC Inspector")',
  expandJobTitle('SPV Produksi') === 'Supervisor Produksi' &&
    expandJobTitle('spv produksi') === 'Supervisor Produksi' &&
    expandJobTitle('QC Inspector') === 'Quality Control Inspector' &&
    expandJobTitle('qc inspector') === 'Quality Control Inspector' &&
    JSON.stringify(getRoleWords('karyawan QC')) ===
      JSON.stringify(['quality', 'control']),
  `spv produksi→"${expandJobTitle('spv produksi')}", qc inspector→"${expandJobTitle('qc inspector')}"`,
)

check(
  'Glosarium: kata peran dari singkatan bisa dicocokkan ke isi CV',
  JSON.stringify(getRoleWords('QC')) === JSON.stringify(['quality', 'control']) &&
    JSON.stringify(getRoleWords('HRD')) ===
      JSON.stringify(['human', 'resource', 'development']) &&
    JSON.stringify(getRoleWords('Data Analyst')) ===
      JSON.stringify(['data', 'analyst']) &&
    JSON.stringify(getRoleWords('Kasir')) === JSON.stringify(['kasir']),
  `QC→[${getRoleWords('QC').join(', ')}], HRD→[${getRoleWords('HRD').join(', ')}], Data Analyst→[${getRoleWords('Data Analyst').join(', ')}]`,
)

const presence = checkSkills('Saya bisa SQL dan Microsoft Excel, sedang belajar Python.', [
  'SQL', 'Python', 'Tableau', 'Microsoft Excel',
])
const presenceMap = Object.fromEntries(presence.map((p) => [p.skill, p.present]))
check(
  'Fase 2: pencocokan skill di teks CV',
  presenceMap['SQL'] === true &&
    presenceMap['Python'] === true &&
    presenceMap['Microsoft Excel'] === true &&
    presenceMap['Tableau'] === false,
  presence.map((p) => `${p.skill}=${p.present}`).join(', '),
)

const dataSkills = getRoleSkills('Data Analyst').skills
check(
  'Fase 2: kamus skill per peran berisi 8–12 skill',
  dataSkills.length >= 8 && dataSkills.length <= 12 &&
    getRoleSkills('').skills.length >= 8,
  `Data Analyst ${dataSkills.length} skill, fallback ${getRoleSkills('').skills.length} skill`,
)

// ---------- Peningkatan standar berbasis aspek (2026-11-21) ----------
// Dimensi baru yang dinilai: lokasi domisili, linimasa pengalaman,
// proyek/magang sebagai bukti pengalaman, relevansi pengalaman terhadap
// posisi target, dan kecocokan lowongan yang masuk skor (aspek
// kondisional). Kuota pemeriksaan lama tidak diubah.

const JOB_DATA = `Lowongan: Data Analyst
Kami mencari Data Analyst untuk tim bisnis. Tanggung jawab: menganalisis data penjualan, membuat dashboard dan visualisasi data, menulis query SQL, mengolah data dengan Python dan Excel, membuat laporan untuk manajemen, bekerja sama dengan tim produk dan bisnis, memahami statistik dan data warehouse, pengalaman dengan Power BI atau Tableau menjadi nilai tambah.`

const JOB_MARKETING = `Lowongan: Digital Marketing Specialist
Kami mencari Digital Marketing Specialist. Tanggung jawab: mengelola media sosial perusahaan, membuat konten kreatif, menjalankan iklan Meta Ads dan Google Ads, optimasi SEO website, copywriting untuk kampanye, email marketing, analisis performa kampanye digital, membangun brand awareness, bekerja sama dengan tim desain dan content creator.`

const JOB_ADMIN = `Lowongan: Staff Administrasi
Dibutuhkan Staff Administrasi perkantoran. Tanggung jawab: input data dan data entry ke sistem, mengarsipkan dokumen, membuat laporan administrasi, menggunakan Microsoft Excel dan Microsoft Word, mengelola surat dan jadwal, mengetik dokumen, membantu tim administrasi, teliti dan rapi dalam mengelola arsip data perusahaan.`

// --- Lokasi domisili ---
check(
  'Standar 2026-11-21: lokasi domisili di area kontak dinilai',
  strongCheck('lokasi')?.score === 1 &&
    mediumCheck('lokasi')?.score === 0 &&
    weakCheck('lokasi')?.score === 0 &&
    checkOf(analyzeCv('Rina\nrina@mail.com\nDomisili: Bandung'), 'lokasi')?.score === 1,
  `kuat ${strongCheck('lokasi')?.score}/1 (Jakarta di header), menengah ${mediumCheck('lokasi')?.score}/1, lemah ${weakCheck('lokasi')?.score}/1, label Domisili terbaca`,
)

// --- Linimasa pengalaman ---
const GAP_CV = `Dedi Kurnia
dedi.kurnia@gmail.com | 0812-5555-6666 | Jakarta

Pengalaman
Kasir — Toko Berkah (2015 - 2016)
- Melayani pembeli setiap hari.
Staf Gudang — PT Logistik Jaya (2021 - 2022)
- Mencatat stok barang masuk dan keluar.`
const gapResult = analyzeCv(GAP_CV)
check(
  'Standar 2026-11-21: linimasa — kesenjangan 5 tahun + peran terakhir basi → 0, tahun disebut di pesan',
  checkOf(gapResult, 'linimasa')?.score === 0 &&
    (checkOf(gapResult, 'linimasa')?.message.includes('kesenjangan sekitar 5 tahun') ?? false) &&
    (checkOf(gapResult, 'linimasa')?.message.includes('2022') ?? false) &&
    strongCheck('linimasa')?.score === 3 &&
    mediumCheck('linimasa')?.score === 3 &&
    weakCheck('linimasa')?.score === 0,
  `gap ${checkOf(gapResult, 'linimasa')?.score}/3, kuat ${strongCheck('linimasa')?.score}/3 (peran saat ini), menengah ${mediumCheck('linimasa')?.score}/3, lemah ${weakCheck('linimasa')?.score}/3 (periode tak terbaca)`,
)

// Contoh personal linimasa untuk CV berjeda yang sama (2026-11-24,
// menyusul teguran pengguna bahwa contoh "Lihat contoh" linimasa masih
// generik): kutipan = entri pengguna sendiri dalam urutan aslinya,
// catatan menyebut rentang jeda aktual dari tahun-tahunnya, versi
// perbaikan terurut terbaru→terlama dengan placeholder jeda & peran
// terkini — TANPA aktivitas pengisi karangan seperti contoh generik
// ("Mengelola toko online keluarga").
const pTimeline = buildPersonalExamples(gapResult, GAP_CV, '')['linimasa']
check(
  'Personal: linimasa mengutip entri CV sendiri (urutan asli) + jeda aktual dari tahun-tahunnya',
  !!pTimeline &&
    pTimeline.kutipanAsli.includes('Kasir — Toko Berkah (2015 - 2016)') &&
    pTimeline.kutipanAsli.includes('Staf Gudang — PT Logistik Jaya (2021 - 2022)') &&
    pTimeline.kutipanAsli.indexOf('Kasir') < pTimeline.kutipanAsli.indexOf('Staf Gudang') &&
    pTimeline.catatan.includes('antara 2016 dan 2021') &&
    pTimeline.catatan.includes('5 tahun') &&
    pTimeline.catatan.includes('berakhir 2022'),
  pTimeline
    ? `kutipan: "${pTimeline.kutipanAsli.replace(/\n/g, ' / ')}"`
    : 'contoh personal linimasa tidak ada',
)
check(
  'Personal: linimasa versi perbaikan terbaru→terlama + placeholder jeda & peran terkini, tanpa karangan',
  !!pTimeline &&
    pTimeline.versiPerbaikan.indexOf('Staf Gudang') < pTimeline.versiPerbaikan.indexOf('Kasir') &&
    pTimeline.versiPerbaikan.includes('2016–2021: [tulis aktivitasmu selama jeda ini') &&
    pTimeline.versiPerbaikan.includes('[peran terkinimu') &&
    !pTimeline.versiPerbaikan.toLowerCase().includes('toko online') &&
    !pTimeline.versiPerbaikan.includes('Mengelola') &&
    numbersIn(pTimeline.versiPerbaikan).every((n) => GAP_CV.includes(n)),
  pTimeline
    ? `sesudah: "${pTimeline.versiPerbaikan.replace(/\n/g, ' / ').slice(0, 110)}…"`
    : 'contoh personal linimasa tidak ada',
)

// --- Proyek/magang sebagai bukti pengalaman ---
const FRESH_CV = `Sinta Dewi
sinta.dewi@gmail.com | 0813-7777-8888 | Bandung

Ringkasan
Lulusan baru SMK yang aktif berorganisasi dan pernah mengerjakan beberapa proyek sekolah di bidang administrasi dan data.

Proyek
- Membuat sistem arsip digital untuk perpustakaan sekolah menggunakan Microsoft Excel dan Google Drive, dipakai oleh 300 siswa.
- Mengelola media sosial OSIS selama satu tahun dan meningkatkan pengikut sebesar 40%.

Pendidikan
SMK Negeri 2 Bandung — Jurusan Administrasi Perkantoran (2021 - 2024)

Keahlian
Microsoft Word, Microsoft Excel, Google Workspace, Canva, Input Data, Pengarsipan, Komunikasi, Kerja Tim`
const fresh = analyzeCv(FRESH_CV)
check(
  'Standar 2026-11-21: proyek beruraian = bukti pengalaman fresh graduate; tanpa formal & tanpa proyek = 0',
  checkOf(fresh, 'proyek')?.score === 2 &&
    weakCheck('proyek')?.score === 0 &&
    mediumCheck('proyek')?.score === 2 &&
    (fresh.aspects.find((a) => a.name === 'Pengalaman')?.score ?? 0) >= 8,
  `fresh (hanya proyek) proyek ${checkOf(fresh, 'proyek')?.score}/2 & Pengalaman total ${fresh.aspects.find((a) => a.name === 'Pengalaman')?.score}/28, lemah proyek ${weakCheck('proyek')?.score}/2, menengah (formal ada, tanpa bagian proyek → netral) ${mediumCheck('proyek')?.score}/2`,
)

// --- Regresi bug 2026-11-21: judul entri "Proyek Kuliah / Proyek Akhir /
// Proyek Pribadi" mengandung kata heading "proyek" sehingga ekstraksi
// bagian Proyek terpotong kosong dan nilai proyek 0/2 — padahal CV yang
// sama berjudul "Tugas Akhir" mendapat 2/2. Ekstraktor khusus
// getProjectSection mengabaikan baris entri (bullet/tahun) sebagai batas.
const PROYEK_KULIAH_CV = `Sinta Dewi
sinta.dewi@gmail.com | 0813-7777-8888 | Bandung

Ringkasan
Lulusan baru SMK yang aktif berorganisasi dan pernah mengerjakan proyek sekolah.

Proyek
Dashboard Harga Bahan Pokok — Proyek Kuliah (2025)
- Membangun dashboard harga bahan pokok Indonesia yang diperbarui setiap hari.
- Mengolah data survei harga dari 30 pasar tradisional.

Pendidikan
SMK Negeri 2 Bandung — Jurusan Administrasi Perkantoran (2021 - 2024)

Keahlian
Microsoft Word, Microsoft Excel, Google Workspace, Canva, Input Data, Pengarsipan, Komunikasi, Kerja Tim`
const proyekKuliah = analyzeCv(PROYEK_KULIAH_CV)
check(
  'Regresi 2026-11-21: entri "Proyek Kuliah (2025)" tidak memotong bagian Proyek → proyek 2/2',
  checkOf(proyekKuliah, 'proyek')?.score === 2 &&
    checkOf(analyzeCv(PROYEK_KULIAH_CV.replace('Proyek Kuliah', 'Proyek Akhir')), 'proyek')?.score === 2 &&
    checkOf(analyzeCv(PROYEK_KULIAH_CV.replace('Proyek Kuliah', 'Proyek Pribadi')), 'proyek')?.score === 2 &&
    checkOf(analyzeCv(PROYEK_KULIAH_CV.replace('Dashboard Harga Bahan Pokok — Proyek Kuliah (2025)', 'Tugas Akhir (2025)')), 'proyek')?.score === 2,
  `"Proyek Kuliah" ${checkOf(proyekKuliah, 'proyek')?.score}/2, "Proyek Akhir" ${checkOf(analyzeCv(PROYEK_KULIAH_CV.replace('Proyek Kuliah', 'Proyek Akhir')), 'proyek')?.score}/2, "Proyek Pribadi" ${checkOf(analyzeCv(PROYEK_KULIAH_CV.replace('Proyek Kuliah', 'Proyek Pribadi')), 'proyek')?.score}/2, "Tugas Akhir" ${checkOf(analyzeCv(PROYEK_KULIAH_CV.replace('Dashboard Harga Bahan Pokok — Proyek Kuliah (2025)', 'Tugas Akhir (2025)')), 'proyek')?.score}/2`,
)

// --- Relevansi pengalaman terhadap posisi target ---
check(
  'Standar 2026-11-21: relevansi pengalaman — jabatan menyebut bidang target (positif) vs tak berkaitan (negatif)',
  checkOf(strongRole, 'relevansi-pengalaman')?.score === 3 &&
    checkOf(mediumWrongRole, 'relevansi-pengalaman')?.score === 0 &&
    strongCheck('relevansi-pengalaman') === undefined,
  `kuat+Data Analyst ${checkOf(strongRole, 'relevansi-pengalaman')?.score}/3, menengah+Akuntansi ${checkOf(mediumWrongRole, 'relevansi-pengalaman')?.score}/3, tanpa peran: pemeriksaan tidak ada`,
)

// --- Kecocokan lowongan masuk skor ---
const strongJobMatch = analyzeCv(SAMPLE_CV, { jobDesc: JOB_DATA })
const strongJobMismatch = analyzeCv(SAMPLE_CV, { jobDesc: JOB_MARKETING })
const mediumJobMatch = analyzeCv(MEDIUM_CV, { jobDesc: JOB_ADMIN })
const mediumJobMismatch = analyzeCv(MEDIUM_CV, { jobDesc: JOB_MARKETING })
const jobAspectOf = (r: ReturnType<typeof analyzeCv>) =>
  r.aspects.find((a) => a.name === 'Kecocokan dengan Lowongan')
check(
  'Standar 2026-11-21: tanpa deskripsi lowongan → aspek kecocokan tidak muncul, jobMatchApplied=false',
  strong.jobMatchApplied === false && jobAspectOf(strong) === undefined && strong.aspects.length === 6,
  `jobMatchApplied ${strong.jobMatchApplied}, jumlah aspek ${strong.aspects.length}`,
)
check(
  'Standar 2026-11-21: mode lowongan — total maks tetap 100 (6 aspek diskalakan 80 + kecocokan 20)',
  strongJobMatch.jobMatchApplied === true &&
    strongJobMatch.aspects.reduce((s, a) => s + a.max, 0) === 100 &&
    jobAspectOf(strongJobMatch)?.max === 20 &&
    strongJobMatch.aspects.length === 7,
  `maks total ${strongJobMatch.aspects.reduce((s, a) => s + a.max, 0)}, aspek ${strongJobMatch.aspects.map((a) => `${a.name} ${a.score}/${a.max}`).join(' | ')}`,
)
check(
  'Standar 2026-11-21: CV kuat yang TIDAK cocok dengan lowongan turun, terjelaskan aspek lowongan',
  strongJobMatch.total === 89 &&
    strongJobMismatch.total === 79 &&
    (jobAspectOf(strongJobMatch)?.score ?? -1) === 12 &&
    (jobAspectOf(strongJobMismatch)?.score ?? -1) === 2 &&
    strongJobMismatch.total < strong.total - 10,
  `kuat+data ${strongJobMatch.total} (kecocokan ${jobAspectOf(strongJobMatch)?.score}/20, ${strongJobMatch.keywords?.percent}%), kuat+marketing ${strongJobMismatch.total} (kecocokan ${jobAspectOf(strongJobMismatch)?.score}/20, ${strongJobMismatch.keywords?.percent}%), tanpa lowongan ${strong.total}`,
)
check(
  'Standar 2026-11-21: CV menengah yang cocok dengan lowongan > yang tidak cocok',
  mediumJobMatch.total === 62 &&
    mediumJobMismatch.total === 50 &&
    (jobAspectOf(mediumJobMatch)?.score ?? 0) > (jobAspectOf(mediumJobMismatch)?.score ?? 0),
  `menengah+admin ${mediumJobMatch.total} (kecocokan ${jobAspectOf(mediumJobMatch)?.score}/20, ${mediumJobMatch.keywords?.percent}%), menengah+marketing ${mediumJobMismatch.total} (kecocokan ${jobAspectOf(mediumJobMismatch)?.score}/20, ${mediumJobMismatch.keywords?.percent}%)`,
)

// --- Riwayat: komposisi aspek berbeda ditangani anggun ---
const jobEntry = entryFromResult(strongJobMatch, '', new Date('2026-11-21T10:00:00.000Z'))
const baseEntry = entryFromResult(strong, '', new Date('2026-11-20T10:00:00.000Z'))
let historyMixOk = false
try {
  const deltas = aspectDeltas(baseEntry, jobEntry)
  const kecocokanDelta = deltas.find((a) => a.name === 'Kecocokan dengan Lowongan')
  historyMixOk =
    jobEntry.aspects.length === 7 &&
    kecocokanDelta !== undefined &&
    kecocokanDelta.previous === null &&
    kecocokanDelta.delta === null &&
    compositionDiffers(baseEntry, jobEntry) === true &&
    compositionDiffers(baseEntry, entryFromResult(strong, '')) === false
} catch {
  historyMixOk = false
}
check(
  'Standar 2026-11-21: riwayat lintas komposisi (dengan/tanpa aspek lowongan) tidak crash & terdeteksi berbeda',
  historyMixOk,
  `entri mode lowongan punya ${jobEntry.aspects.length} aspek; aspek baru berdelta null; compositionDiffers bekerja dua arah`,
)

// --- Contoh Fase 2 untuk pemeriksaan baru ---
check(
  'Standar 2026-11-21: contoh tersedia untuk kecocokan-lowongan, linimasa, relevansi-pengalaman, lokasi, proyek',
  ['kecocokan-lowongan', 'linimasa', 'relevansi-pengalaman', 'lokasi', 'proyek'].every(
    (id) => getCheckExample(id) !== null,
  ),
  ['kecocokan-lowongan', 'linimasa', 'relevansi-pengalaman', 'lokasi', 'proyek']
    .map((id) => `${id}: ${getCheckExample(id) ? 'ada' : 'TIDAK ADA'}`)
    .join(' | '),
)

// ---------- Uji pembayaran QRIS manual: kredit AI (2026-11-21) ----------
check('QRIS manual: harga satu Analisis AI', AI_PRICE === 5000, `AI_PRICE = ${AI_PRICE}`)
check(
  'QRIS manual: format Rupiah id-ID',
  formatRupiah(5000) === 'Rp5.000' && formatRupiah(5037) === 'Rp5.037' && formatRupiah(0) === 'Rp0',
  `${formatRupiah(5000)} | ${formatRupiah(5037)}`,
)

const payStore = new MockStorage()
check('QRIS manual: saldo awal 0', getCredits(payStore) === 0, `saldo ${getCredits(payStore)}`)
check(
  'QRIS manual: pakai kredit saat saldo 0 gagal & saldo tetap 0',
  consumeCredit(payStore) === false && getCredits(payStore) === 0,
  `saldo ${getCredits(payStore)}`,
)
check(
  'QRIS manual: tambah kredit 1 → saldo 1, tambah lagi → saldo 2',
  addCredit(payStore) === 1 && addCredit(payStore) === 2 && getCredits(payStore) === 2,
  `saldo ${getCredits(payStore)}`,
)
check(
  'QRIS manual: pakai kredit mengurangi tepat 1',
  consumeCredit(payStore) === true && getCredits(payStore) === 1,
  `saldo ${getCredits(payStore)}`,
)
check(
  'QRIS manual: kunci storage kredit sesuai kontrak',
  payStore.getItem(AI_CREDITS_STORAGE_KEY) === '1',
  `isi storage: ${payStore.getItem(AI_CREDITS_STORAGE_KEY)}`,
)

const corruptStore = new MockStorage()
corruptStore.setItem(AI_CREDITS_STORAGE_KEY, 'bukan-json{{{')
let payCorruptOk = false
try {
  payCorruptOk =
    getCredits(corruptStore) === 0 &&
    consumeCredit(corruptStore) === false &&
    addCredit(corruptStore) === 1
} catch {
  payCorruptOk = false
}
check('QRIS manual: data kredit rusak → 0, tidak crash, bisa pulih', payCorruptOk, 'parsing defensif bekerja')

const negativeStore = new MockStorage()
negativeStore.setItem(AI_CREDITS_STORAGE_KEY, '-5')
check(
  'QRIS manual: saldo negatif tersimpan diperlakukan 0',
  getCredits(negativeStore) === 0 && consumeCredit(negativeStore) === false,
  `saldo terbaca ${getCredits(negativeStore)}`,
)
check(
  'QRIS manual: storage null aman (0 & tidak crash)',
  getCredits(null) === 0 && consumeCredit(null) === false,
  'tanpa localStorage tetap aman',
)

const codeStore = new MockStorage()
const codeMin = getOrCreatePendingCode(codeStore, () => 0)
const codeMaxStore = new MockStorage()
const codeMax = getOrCreatePendingCode(codeMaxStore, () => 0.999999)
check(
  'QRIS manual: kode unik selalu dalam rentang 1–99',
  codeMin === 1 && codeMax === 99 && codeMin >= 1 && codeMax <= 99,
  `rng 0 → ${codeMin}, rng ~1 → ${codeMax}`,
)
check(
  'QRIS manual: kode unik stabil selama belum dikonfirmasi (tersimpan)',
  getOrCreatePendingCode(codeStore, () => 0.5) === codeMin &&
    codeStore.getItem(AI_PENDING_CODE_STORAGE_KEY) === String(codeMin),
  `kode tetap ${codeMin} walau rng berubah`,
)
check(
  'QRIS manual: nominal bayar = harga + kode unik',
  amountForCode(37) === 5037 && amountForCode(codeMin) === AI_PRICE + codeMin,
  `kode 37 → ${formatRupiah(amountForCode(37))}`,
)
clearPendingCode(codeStore)
const codeAfterClear = getOrCreatePendingCode(codeStore, () => 0.5)
check(
  'QRIS manual: setelah dibersihkan, kode baru dibuat dari rng',
  codeAfterClear === 1 + Math.floor(0.5 * 99),
  `kode baru ${codeAfterClear}`,
)

const corruptCodeStore = new MockStorage()
corruptCodeStore.setItem(AI_PENDING_CODE_STORAGE_KEY, 'rusak{{{')
const codeFromCorrupt = getOrCreatePendingCode(corruptCodeStore, () => 0)
check(
  'QRIS manual: kode unik rusak → dibuat ulang, tidak crash',
  codeFromCorrupt === 1,
  `kode ${codeFromCorrupt}`,
)

// ---------- Uji kode token sekali pakai (redeem, 2026-11-21) ----------
check(
  'Token: daftar hash batch 1 berisi 50 hash SHA-256 unik',
  TOKEN_CODE_HASHES.length === 50 &&
    new Set(TOKEN_CODE_HASHES).size === 50 &&
    TOKEN_CODE_HASHES.every((h) => /^[0-9a-f]{64}$/.test(h)),
  `${TOKEN_CODE_HASHES.length} hash`,
)
check(
  'Token: kontak admin berupa string (kosong = UI tanpa tautan)',
  typeof ADMIN_CONTACT_URL === 'string',
  `ADMIN_CONTACT_URL = "${ADMIN_CONTACT_URL}"`,
)
check(
  'Token: tautan WhatsApp admin = wa.me pemilik + teks awal berisi nominal tepat berkode unik',
  ADMIN_CONTACT_URL === 'https://wa.me/62895613048006' &&
    adminContactHref(37).startsWith(`${ADMIN_CONTACT_URL}?text=`) &&
    decodeURIComponent(adminContactHref(37).split('?text=')[1]).includes(
      `sebesar ${formatRupiah(amountForCode(37))}`,
    ) &&
    decodeURIComponent(adminContactHref(37).split('?text=')[1]).includes('kode token'),
  `href kode 37 → ${adminContactHref(37).slice(0, 80)}…`,
)
check(
  'Token: tautan WhatsApp tanpa kode unik → teks umum tanpa nominal',
  decodeURIComponent(adminContactHref().split('?text=')[1]).includes('kode token') &&
    !decodeURIComponent(adminContactHref().split('?text=')[1]).includes('sebesar'),
  'teks umum dipakai bila nominal belum tersedia',
)

// Kode asli batch #1 dibaca dari daftar pemilik di LUAR repo
// (~/workspace/token-ai-codes-batch1.txt) — tidak pernah masuk repo.
const batchFilePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../token-ai-codes-batch1.txt',
)
const batchText = readFileSync(batchFilePath, 'utf8')
const batchCode1 = batchText.match(/CVAI-[A-Z2-9]{6}/)?.[0] ?? ''
const batchCode1Hash = createHash('sha256').update(batchCode1, 'utf8').digest('hex')
check(
  'Token: kode batch #1 tervalidasi (hash SHA-256-nya ada di daftar situs)',
  batchCode1 !== '' && TOKEN_CODE_HASHES.includes(batchCode1Hash),
  `kode #1 ${batchCode1} → hash ${batchCode1Hash.slice(0, 12)}…`,
)
check(
  'Token: normalisasi input = trim + uppercase',
  normalizeTokenCode(`  ${batchCode1.toLowerCase()} `) === batchCode1 &&
    normalizeTokenCode('') === '',
  'huruf kecil & spasi tepi diterima',
)

const redeemStore = new MockStorage()
const redeem1 = await redeemTokenCode(` ${batchCode1.toLowerCase()} `, redeemStore)
check(
  'Token: redeem kode valid (huruf kecil + spasi) → token bertambah tepat 1',
  redeem1.ok === true && redeem1.balance === 1 && getCredits(redeemStore) === 1,
  `hasil ${JSON.stringify(redeem1)}`,
)
check(
  'Token: hash kode tercatat sebagai sudah ditukar di perangkat ini',
  isCodeRedeemed(batchCode1Hash, redeemStore) &&
    (redeemStore.getItem(REDEEMED_CODES_STORAGE_KEY) ?? '').includes(batchCode1Hash),
  `storage: ${redeemStore.getItem(REDEEMED_CODES_STORAGE_KEY)}`,
)
const redeem2 = await redeemTokenCode(batchCode1, redeemStore)
check(
  'Token: redeem kedua kode yang sama di perangkat ini ditolak, saldo tetap',
  redeem2.ok === false && getCredits(redeemStore) === 1,
  `saldo tetap ${getCredits(redeemStore)}`,
)
const redeemWrong = await redeemTokenCode('CVAI-ZZZZZZ', redeemStore)
const redeemGarbage = await redeemTokenCode('bukan-kode-sama-sekali', redeemStore)
check(
  'Token: kode salah / bukan kode ditolak, saldo tidak berubah',
  redeemWrong.ok === false && redeemGarbage.ok === false && getCredits(redeemStore) === 1,
  'semua bentuk kode tak dikenal ditolak',
)
// Batas jujur mekanisme: penanda terpakai tersimpan per perangkat, jadi
// kode yang sama masih bisa ditukar di perangkat LAIN. Uji ini mengunci
// perilaku itu agar tidak berubah diam-diam.
const otherDeviceStore = new MockStorage()
const redeemOtherDevice = await redeemTokenCode(batchCode1, otherDeviceStore)
check(
  'Token: penanda terpakai bersifat per perangkat (perangkat lain = catatan baru)',
  redeemOtherDevice.ok === true && getCredits(otherDeviceStore) === 1,
  'sesuai batas jujur yang dicatat di ROADMAP',
)

// ---------- Uji integrasi Midtrans: mode, order, status, signature (2026-11-21) ----------
check(
  'Midtrans: mode off bila kunci belum terpasang',
  resolveMidtransMode({}) === 'off' &&
    resolveMidtransMode({ serverKey: 'SB-Mid-server-x' }) === 'off' &&
    resolveMidtransMode({ clientKey: 'SB-Mid-client-x' }) === 'off' &&
    resolveMidtransMode({ serverKey: '  ', clientKey: 'SB-Mid-client-x' }) === 'off',
  'kedua kunci wajib ada',
)
check(
  'Midtrans: kunci terpasang tanpa production → sandbox',
  resolveMidtransMode({ serverKey: 'SB-Mid-server-x', clientKey: 'SB-Mid-client-x' }) === 'sandbox' &&
    resolveMidtransMode({ serverKey: 's', clientKey: 'c', isProduction: 'false' }) === 'sandbox' &&
    resolveMidtransMode({ serverKey: 's', clientKey: 'c', isProduction: 'TRUE' }) === 'sandbox',
  'hanya string persis "true" yang berarti production',
)
check(
  'Midtrans: MIDTRANS_IS_PRODUCTION=true → production',
  resolveMidtransMode({ serverKey: 'Mid-server-x', clientKey: 'Mid-client-x', isProduction: 'true' }) ===
    'production',
  'mode production',
)
check(
  'Midtrans: host Snap/API/SnapJS per mode sesuai dokumentasi resmi',
  snapHostFor('sandbox') === 'https://app.sandbox.midtrans.com' &&
    snapHostFor('production') === 'https://app.midtrans.com' &&
    apiHostFor('sandbox') === 'https://api.sandbox.midtrans.com' &&
    apiHostFor('production') === 'https://api.midtrans.com' &&
    snapJsUrlFor('sandbox') === 'https://app.sandbox.midtrans.com/snap/snap.js' &&
    snapJsUrlFor('production') === 'https://app.midtrans.com/snap/snap.js',
  'host sandbox & production',
)
check(
  'Midtrans: metode aktif hanya QRIS generik + e-wallet',
  JSON.stringify(MIDTRANS_ENABLED_PAYMENTS) === JSON.stringify(['other_qris', 'gopay', 'shopeepay']),
  MIDTRANS_ENABLED_PAYMENTS.join(', '),
)

const orderA = buildOrderId(1763560000000, () => 0)
const orderB = buildOrderId(1763560000000, () => 0.999999)
check(
  'Midtrans: order_id berawalan AICV-, format valid, unik per acak',
  orderA.startsWith('AICV-') &&
    isValidOrderId(orderA) &&
    isValidOrderId(orderB) &&
    orderA !== orderB &&
    orderA.endsWith('-aaaaaa'),
  `${orderA} vs ${orderB}`,
)
check(
  'Midtrans: order_id asing ditolak validator',
  !isValidOrderId('ORDER-123') && !isValidOrderId('AICV-') && !isValidOrderId('') && !isValidOrderId(42),
  'hanya pola AICV-<base36>-<6 acak>',
)

check(
  'Midtrans status: settlement → paid',
  mapMidtransStatus({ transaction_status: 'settlement', gross_amount: '5000.00' }, AI_PRICE).paid === true,
  'settlement lunas',
)
check(
  'Midtrans status: capture + fraud accept → paid; challenge → pending; deny → failed',
  mapMidtransStatus({ transaction_status: 'capture', fraud_status: 'accept', gross_amount: '5000.00' }, AI_PRICE)
    .paid === true &&
    mapMidtransStatus({ transaction_status: 'capture', fraud_status: 'challenge' }).state === 'pending' &&
    mapMidtransStatus({ transaction_status: 'capture', fraud_status: 'deny' }).state === 'failed',
  'aturan capture mengikuti fraud_status',
)
check(
  'Midtrans status: pending → pending; expire/cancel/deny → failed',
  mapMidtransStatus({ transaction_status: 'pending' }).state === 'pending' &&
    mapMidtransStatus({ transaction_status: 'expire' }).state === 'failed' &&
    mapMidtransStatus({ transaction_status: 'cancel' }).state === 'failed' &&
    mapMidtransStatus({ transaction_status: 'deny' }).state === 'failed',
  'status akhir tanpa pembayaran = failed',
)
check(
  'Midtrans status: body tidak dikenal → unknown, tidak pernah paid',
  mapMidtransStatus(null).state === 'unknown' &&
    mapMidtransStatus('settlement').state === 'unknown' &&
    mapMidtransStatus({ transaction_status: 'refund' }).state === 'unknown' &&
    mapMidtransStatus({}).paid === false,
  'bawaan aman: unknown',
)
check(
  'Midtrans status: nominal tidak cocok → tidak paid walau settlement',
  mapMidtransStatus({ transaction_status: 'settlement', gross_amount: '9000.00' }, AI_PRICE).paid === false &&
    mapMidtransStatus({ transaction_status: 'settlement', gross_amount: '5000.00' }, AI_PRICE).paid === true,
  'gross_amount wajib persis harga Analisis AI',
)

const DUMMY_SERVER_KEY = 'SB-Mid-server-DUMMYKEY'
const NOTIF_BODY = {
  order_id: 'AICV-m3test-abc123',
  status_code: '200',
  gross_amount: '5000.00',
  transaction_status: 'settlement',
  signature_key:
    'f9fedec2b588856e4e2441b360fa45c9b8a3ed4b17297551c050b6b6c2d8cb4905b24bc7829c625218fa7e6d7171fbe26b2129e58891438ab8ca4a0961577d44',
}
check(
  'Midtrans signature: vektor uji lokal cocok (SHA512 order+status+gross+key)',
  computeNotificationSignature('AICV-m3test-abc123', '200', '5000.00', DUMMY_SERVER_KEY) ===
    NOTIF_BODY.signature_key &&
    verifyNotificationSignature(NOTIF_BODY, DUMMY_SERVER_KEY) === true,
  'signature valid diterima',
)
check(
  'Midtrans signature: nominal/signature diubah → ditolak',
  verifyNotificationSignature({ ...NOTIF_BODY, gross_amount: '9000.00' }, DUMMY_SERVER_KEY) === false &&
    verifyNotificationSignature({ ...NOTIF_BODY, signature_key: 'a'.repeat(128) }, DUMMY_SERVER_KEY) === false &&
    verifyNotificationSignature({ ...NOTIF_BODY, signature_key: 'pendek' }, DUMMY_SERVER_KEY) === false &&
    verifyNotificationSignature(NOTIF_BODY, 'SB-Mid-server-KUNCI-LAIN') === false &&
    verifyNotificationSignature({ order_id: 'AICV-m3test-abc123' }, DUMMY_SERVER_KEY) === false &&
    verifyNotificationSignature(null, DUMMY_SERVER_KEY) === false,
  'semua bentuk pemalsuan ditolak',
)
check(
  'Midtrans auth: Basic Auth = base64(Server Key + ":")',
  basicAuthHeader('SB-Mid-server-x') === `Basic ${Buffer.from('SB-Mid-server-x:').toString('base64')}`,
  'username Server Key, password kosong',
)

const claimStore = new MockStorage()
check(
  'Midtrans klaim: order baru bisa diklaim tepat sekali',
  isOrderClaimed('AICV-uji-abc123', claimStore) === false &&
    markOrderClaimed('AICV-uji-abc123', claimStore) === true &&
    isOrderClaimed('AICV-uji-abc123', claimStore) === true &&
    markOrderClaimed('AICV-uji-abc123', claimStore) === false &&
    claimStore.getItem(AI_CLAIMED_ORDERS_STORAGE_KEY) === JSON.stringify(['AICV-uji-abc123']),
  'klaim kedua untuk order sama ditolak',
)
check(
  'Midtrans klaim: order berbeda tetap bisa diklaim; data rusak aman',
  markOrderClaimed('AICV-uji-def456', claimStore) === true &&
    isOrderClaimed('AICV-uji-abc123', claimStore) === true,
  'daftar klaim bertambah',
)
const corruptClaimStore = new MockStorage()
corruptClaimStore.setItem(AI_CLAIMED_ORDERS_STORAGE_KEY, 'rusak{{{')
check(
  'Midtrans klaim: data klaim rusak → dianggap kosong, tidak crash',
  isOrderClaimed('AICV-uji-abc123', corruptClaimStore) === false &&
    markOrderClaimed('AICV-uji-abc123', corruptClaimStore) === true,
  'parsing defensif bekerja',
)

// ---------- Uji laporan unduhan (PDF langsung, jsPDF) ----------
const REPORT_DATE = new Date(2026, 10, 21, 21, 47)
const reportBase = buildReportText(analyzeCv(SAMPLE_CV, { jobDesc: JOB_DATA }), {
  targetRole: 'Data Analyst',
  date: REPORT_DATE,
})
check(
  'Laporan: kepala memuat tanggal, posisi target, skor & label',
  reportBase.startsWith('HASIL SCREENING CV') &&
    reportBase.includes(`Tanggal analisis: ${formatReportDate(REPORT_DATE)}`) &&
    reportBase.includes('Posisi target: Data Analyst') &&
    reportBase.includes(`/100 — `) &&
    reportBase.includes('Total kata:'),
  'kepala laporan lengkap',
)
check(
  'Laporan: memuat skor per aspek, kekuatan & prioritas perbaikan',
  reportBase.includes('SKOR PER ASPEK:') &&
    reportBase.includes('- Kontak:') &&
    reportBase.includes('- Pengalaman:') &&
    reportBase.includes('KEKUATAN:') &&
    reportBase.includes('PRIORITAS PERBAIKAN:') &&
    reportBase.includes('KECOCOKAN KATA KUNCI LOWONGAN:'),
  'bagian inti laporan lengkap termasuk kata kunci lowongan',
)
check(
  'Laporan: tanpa hasil AI tidak ada bagian Analisis AI',
  !reportBase.includes('ANALISIS AI:'),
  'bagian AI hanya muncul bila hasil AI ada',
)
const FAKE_AI: AiAnalysis = {
  ringkasan: 'CV cukup kuat untuk posisi data analyst pemula.',
  penilaianPosisi:
    'Kecocokan kuat untuk Data Analyst: bukti SQL dan dashboard sudah ada; celah paling kritisnya sertifikasi yang belum dicantumkan.',
  saranPenulisanUlang: [
    {
      asli: 'Membuat laporan penjualan',
      saran: 'Menyusun laporan penjualan mingguan untuk 3 cabang dengan Excel',
      alasan: 'Tambahkan frekuensi dan alat yang dipakai.',
    },
  ],
  kekurangan: ['Belum ada sertifikasi pendukung.'],
  saranRingkasan: 'Data analyst pemula yang terbiasa mengolah data penjualan.',
  perbaikanLengkap: [
    {
      idPemeriksaan: 'hasil-terukur',
      judul: 'Hasil terukur',
      sebelum: 'Membuat laporan penjualan',
      sesudah: 'Menyusun laporan penjualan mingguan untuk [jumlah] cabang dengan Microsoft Excel',
      catatan: 'Isi [jumlah] dengan angka aslimu.',
    },
    {
      idPemeriksaan: 'linkedin',
      judul: 'LinkedIn',
      sebelum: '',
      sesudah: 'linkedin.com/in/[nama-kamu] — cantumkan di bawah nama, sejajar email & nomor HP',
      catatan: 'Buat/aktifkan profil LinkedIn lalu salin tautannya persis seperti format ini.',
    },
  ],
}
const reportAi = buildReportText(analyzeCv(SAMPLE_CV), { ai: FAKE_AI, date: REPORT_DATE })
check(
  'Laporan: bagian AI lengkap bila hasil AI ada',
  reportAi.includes('ANALISIS AI:') &&
    reportAi.includes('Ringkasan: CV cukup kuat untuk posisi data analyst pemula.') &&
    reportAi.includes('Asli: Membuat laporan penjualan') &&
    reportAi.includes('Saran: Menyusun laporan penjualan mingguan') &&
    reportAi.includes('- Belum ada sertifikasi pendukung.') &&
    reportAi.includes('Contoh Ringkasan Profil: Data analyst pemula'),
  'ringkasan, saran penulisan ulang, kekurangan & contoh ringkasan tercantum',
)
check(
  'Laporan: Penilaian Posisi tercantum bila terisi, absen bila kosong',
  reportAi.includes('Penilaian Posisi: Kecocokan kuat untuk Data Analyst') &&
    !buildReportText(analyzeCv(SAMPLE_CV), {
      ai: { ...FAKE_AI, penilaianPosisi: '' },
      date: REPORT_DATE,
    }).includes('Penilaian Posisi:'),
  'bidang opsional penilaianPosisi masuk laporan (dan PDF) hanya bila model mengisinya',
)
check(
  'Laporan: bagian Perbaikan Lengkap dari AI tercantum bila ada isinya',
  reportAi.includes('PERBAIKAN LENGKAP DARI AI:') &&
    reportAi.includes('1. Hasil terukur') &&
    reportAi.includes('Sebelum: Membuat laporan penjualan') &&
    reportAi.includes('Sesudah: Menyusun laporan penjualan mingguan untuk [jumlah] cabang') &&
    reportAi.includes('Catatan: Isi [jumlah] dengan angka aslimu.') &&
    reportAi.includes('2. LinkedIn') &&
    reportAi.includes('Sesudah: linkedin.com/in/[nama-kamu]'),
  'judul, sebelum, sesudah & catatan tiap item perbaikan masuk laporan (item ketiadaan tanpa baris Sebelum)',
)

// ---------- Uji Perbaikan Lengkap AI (2026-11-24) ----------
// Keputusan pengguna: TIDAK ada teaser AI gratis; sebagai gantinya AI
// berbayar wajib memperbaiki SEMUA pemeriksaan standar yang gagal.
// Frontend mengirim konteks pemeriksa yang gagal; backend memvalidasinya
// dan memasukkannya ke prompt; parser menerima bagian skema baru.
const parsedFullFix = parseAiJson(
  JSON.stringify({
    ringkasan: 'CV menengah dengan beberapa kekurangan struktural.',
    saranPenulisanUlang: [],
    kekurangan: ['Belum ada hasil terukur.'],
    saranRingkasan: 'Lulusan baru administrasi.',
    perbaikanLengkap: [
      {
        idPemeriksaan: 'hasil-terukur',
        judul: 'Hasil terukur',
        sebelum: 'Membantu mengelola arsip dokumen perusahaan setiap hari.',
        sesudah: 'Mengelola arsip [jumlah] dokumen perusahaan setiap hari dengan sistem pengindeksan rapi.',
        catatan: 'Isi [jumlah] dengan angka aslimu.',
      },
      {
        idPemeriksaan: 'linkedin',
        judul: 'LinkedIn',
        sebelum: '',
        sesudah: 'linkedin.com/in/[nama-kamu]',
        catatan: 'Aktifkan profil LinkedIn lalu cantumkan tautannya.',
      },
      { idPemeriksaan: 'tanpa-sesudah', judul: 'Item rusak', sebelum: 'x', sesudah: '  ', catatan: '' },
      'bukan objek',
    ],
  }),
)
check(
  'AI lengkap: parser menerima bagian perbaikanLengkap & membuang item tanpa sesudah',
  parsedFullFix !== null &&
    parsedFullFix.perbaikanLengkap.length === 2 &&
    parsedFullFix.perbaikanLengkap[0].idPemeriksaan === 'hasil-terukur' &&
    parsedFullFix.perbaikanLengkap[0].sesudah.includes('[jumlah] dokumen') &&
    parsedFullFix.perbaikanLengkap[1].sebelum === '',
  `terparse ${parsedFullFix?.perbaikanLengkap.length ?? 'null'} item valid dari 4 mentah`,
)
const parsedOldSchema = parseAiJson(
  JSON.stringify({
    ringkasan: 'Jawaban skema lama.',
    saranPenulisanUlang: [{ asli: 'a', saran: 'b', alasan: 'c' }],
    kekurangan: [],
    saranRingkasan: 'Ringkasan lama.',
  }),
)
check(
  'AI lengkap: skema lama tanpa perbaikanLengkap tetap terparse (array kosong)',
  parsedOldSchema !== null &&
    parsedOldSchema.perbaikanLengkap.length === 0 &&
    parsedOldSchema.saranPenulisanUlang.length === 1,
  'kompatibilitas mundur parser terjaga',
)
const sanitizedChecks = parseFailedChecks([
  { id: 'hasil-terukur', judul: 'Hasil terukur', pesan: 'Belum ada angka.', kutipan: 'Membantu arsip.' },
  { id: '', judul: 'Tanpa id' },
  { judul: 'Tanpa id juga' },
  'bukan objek',
  { id: 'linkedin', judul: 'LinkedIn' },
])
check(
  'AI lengkap: parseFailedChecks membuang item tak valid & menoleransi field hilang',
  sanitizedChecks.length === 2 &&
    sanitizedChecks[0].kutipan === 'Membantu arsip.' &&
    sanitizedChecks[1].id === 'linkedin' &&
    sanitizedChecks[1].pesan === '' &&
    parseFailedChecks('bukan array').length === 0 &&
    parseFailedChecks(undefined).length === 0,
  `${sanitizedChecks.length} item valid dari 5 mentah`,
)
const mediumPersonal = buildPersonalExamples(medium, MEDIUM_CV, '')
const fixContext = buildAiFixContext(medium, mediumPersonal)
const failedCheckIds = new Set<string>()
for (const aspect of medium.aspects) {
  for (const c of aspect.checks) if (c.status !== 'baik') failedCheckIds.add(c.id)
}
check(
  'AI lengkap: konteks frontend memuat SEMUA pemeriksaan gagal, prioritas lebih dulu',
  fixContext.length === failedCheckIds.size &&
    fixContext.every((c) => failedCheckIds.has(c.id)) &&
    medium.priorities.every((p, i) => fixContext[i]?.id === p.id) &&
    fixContext.every((c) => c.judul.length > 0 && c.pesan.length > 0),
  `${fixContext.length} konteks terkirim untuk ${failedCheckIds.size} pemeriksaan gagal; urutan awal = prioritas`,
)
check(
  'AI lengkap: kutipan konteks berasal dari contoh personal CV pengguna sendiri',
  fixContext.some((c) => c.kutipan.length > 0) &&
    fixContext
      .filter((c) => c.kutipan.length > 0)
      .every((c) => mediumPersonal[c.id]?.kutipanAsli === c.kutipan),
  'kutipan terisi hanya dari lapisan contoh personal, tidak dikarang di ai.ts',
)

check(
  'Laporan: nama berkas unduhan berpola laporan-cv-<tanggal>.pdf',
  reportFileName(REPORT_DATE) === 'laporan-cv-2026-11-21.pdf' &&
    reportFileName(new Date(2026, 0, 5)) === 'laporan-cv-2026-01-05.pdf',
  reportFileName(REPORT_DATE),
)
const pdfBytes = buildReportPdfBytes(analyzeCv(SAMPLE_CV, { jobDesc: JOB_DATA }), {
  ai: FAKE_AI,
  targetRole: 'Data Analyst',
  date: REPORT_DATE,
})
check(
  'Laporan PDF: berkas sungguhan berawalan %PDF dan berukuran wajar',
  new TextDecoder().decode(pdfBytes.slice(0, 4)) === '%PDF' &&
    pdfBytes.length > 2000 &&
    pdfBytes.length < 500_000,
  `${pdfBytes.length} byte`,
)
const pdfFile = buildReportPdf(analyzeCv(SAMPLE_CV), { date: REPORT_DATE })
check(
  'Laporan PDF: Blob bertipe application/pdf + nama berkas .pdf',
  pdfFile.blob.type === 'application/pdf' &&
    pdfFile.fileName === 'laporan-cv-2026-11-21.pdf',
  `${pdfFile.blob.type}, ${pdfFile.fileName}`,
)
const appCssText = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../src/App.css'),
  'utf8',
)
check(
  'Laporan: mode cetak sudah dihapus dari App.css (keputusan 2026-11-21)',
  !appCssText.includes('@media print') && !appCssText.includes('.print-report'),
  'tidak ada lagi stylesheet cetak / bagian laporan cetak',
)
const appTsxText = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../src/App.tsx'),
  'utf8',
)
check(
  'Laporan: baris tombol kartu hasil dihapus (Salin/.txt/print hilang)',
  !appTsxText.includes('Salin Laporan') &&
    !appTsxText.includes('Unduh .txt') &&
    !appTsxText.includes('window.print()') &&
    !appTsxText.includes('print-report') &&
    !appTsxText.includes('handlePrintReport'),
  'tidak ada lagi tombol salin, unduh .txt, atau handler cetak di App.tsx',
)
check(
  'Laporan: satu tombol Unduh Laporan (PDF) di kartu AI, unduh langsung',
  appTsxText.includes('Unduh Laporan (PDF)') &&
    appTsxText.includes('ai-report-actions') &&
    appTsxText.includes('onClick={handleDownloadPdf}') &&
    appTsxText.includes("await import('./lib/pdf')"),
  'tombol PDF di kartu AI memakai handler unduh PDF langsung (jsPDF)',
)
check(
  'Laporan: tombol unduh hanya muncul setelah Analisis AI selesai',
  appTsxText.includes('Tombol unduh laporan akan muncul setelah Analisis AI selesai.') &&
    /aiResult \? \([\s\S]{0,400}Unduh Laporan \(PDF\)/.test(appTsxText),
  'blok .ai-report-actions dirender kondisional pada aiResult; sebelum itu tampil petunjuk pengganti',
)
check(
  'AI lengkap: kartu AI menampilkan bagian Perbaikan Lengkap + janji token tidak hangus',
  appTsxText.includes('Perbaikan Lengkap dari AI') &&
    appTsxText.includes('aiResult.perbaikanLengkap') &&
    appTsxText.includes('buildAiFixContext') &&
    appTsxText.includes('tokenmu tidak hangus') &&
    appTsxText.includes('bukan langganan'),
  'bagian baru dirender dari aiResult.perbaikanLengkap; teks nilai jual + garansi token ada di kartu AI',
)
check(
  'AI lengkap: kegagalan streaming di tengah aliran pun dicoba cadangan non-streaming',
  !appTsxText.includes('if (!receivedEvent)') &&
    !appTsxText.includes('receivedEvent') &&
    appTsxText.includes('const data = await requestAiAnalysis(input)'),
  'gerbang receivedEvent dihapus; catch streaming selalu mencoba requestAiAnalysis sekali',
)
check(
  'Template: tombol Salin Template sudah dihapus (keputusan 2026-11-21)',
  !appTsxText.includes('Salin Template') &&
    !appTsxText.includes('handleCopyTemplate') &&
    !appTsxText.includes('copiedTemplate') &&
    appTsxText.includes('template-box'),
  'tidak ada lagi tombol/handler salin template; kotak teks template tetap tampil',
)

// ---------- Uji contoh hasil beranda + artikel SEO (2026-11-24) ----------
// Bagian "Lihat Contoh Hasil" WAJIB memakai mesin asli atas teks contoh
// yang sama yang dirender App.tsx — bukan angka yang diketik manual.
const demoBefore = analyzeCv(DEMO_WEAK_CV)
const demoAfter = analyzeCv(SAMPLE_CV)
check(
  'Contoh hasil: skor "Sebelum" < "Sesudah" dan "Sesudah" = patokan CV kuat',
  demoBefore.total < demoAfter.total && demoAfter.total === strong.total && demoAfter.total === 96,
  `sebelum ${demoBefore.total} (${demoBefore.label}), sesudah ${demoAfter.total} (${demoAfter.label})`,
)
check(
  'Contoh hasil: App.tsx menjalankan analyzeCv atas kedua teks contoh',
  appTsxText.includes('Lihat Contoh Hasil') &&
    appTsxText.includes('analyzeCv(DEMO_WEAK_CV)') &&
    appTsxText.includes('analyzeCv(SAMPLE_CV)') &&
    appTsxText.includes('Analisis CV-mu'),
  'bagian contoh memakai mesin asli, berlabel jujur "Contoh"',
)
const artikelPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../public/artikel/kesalahan-cv-fresh-graduate.html',
)
const artikelText = existsSync(artikelPath) ? readFileSync(artikelPath, 'utf8') : ''
check(
  'Artikel SEO: berkas ada, memuat judul + meta description + OG + tautan balik',
  artikelText.includes('7 Kesalahan CV Fresh Graduate yang Membuatmu Tidak Dipanggil Interview') &&
    artikelText.includes('name="description"') &&
    artikelText.includes('property="og:title"') &&
    artikelText.includes('href="/"'),
  'public/artikel/kesalahan-cv-fresh-graduate.html',
)
const sitemapText = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../public/sitemap.xml'),
  'utf8',
)
check(
  'Artikel SEO: URL artikel terdaftar di sitemap + tertaut dari footer beranda',
  sitemapText.includes(
    'https://screening-cv-app.vercel.app/artikel/kesalahan-cv-fresh-graduate.html',
  ) &&
    appTsxText.includes('/artikel/kesalahan-cv-fresh-graduate.html') &&
    appTsxText.includes('Artikel: Kesalahan CV Fresh Graduate'),
  'sitemap.xml memuat URL artikel; footer memuat tautannya',
)

// ---------- Uji penanda selaras prioritas perbaikan (2026-11-24) ----------
// Peringkat pada tanda berasal dari SATU sumber bersama: selectPriorities
// memilih daftarnya di dalam analyzeCv, priorityRanks menurunkan
// peringkatnya, dan daftar "Prioritas Perbaikan" + penanda sama-sama
// memakainya — tidak ada kriteria/urutan kedua di mana pun.
const srcText = (rel: string) =>
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), rel), 'utf8')
const analyzeTsText = srcText('../src/lib/analyze.ts')

// CV uji untuk dua pemeriksaan sumber prioritas bersama di bawah.
const MARKED_CV = `Rina Wijaya
rina.wijaya@gmail.com | 0812-3456-7890 | linkedin.com/in/rinawijaya | Jakarta

Ringkasan
Saya pekerja keras, mampu bekerja di bawah tekanan, dan bertanggung jawab atas kebersihan toko selama bekerja.

Pengalaman
Kasir — Toko Berkah (2023–2024)
- Saya melayani pembeli setiap hari di kasir.
- Saya merubah jadwal piket kasir setiap minggu.
- Saya melakukan aktifitas pencatatan stok barang.
- Saya mengecek uang kas setiap malam.

Staf Administrasi — PT Sinar Abadi (2024–Sekarang)
- Meningkatkan penjualan sebesar 30% dalam 6 bulan.
- Mengelola 15 orang anggota tim gudang.

Pendidikan
SMA Negeri 1 Jakarta (2019–2022)

Keahlian
Microsoft Word, Microsoft Excel, Kasir, Komunikasi`

const markedResult = analyzeCv(MARKED_CV)

const recomputedPriorities = selectPriorities(
  markedResult.aspects.flatMap((a) => a.checks),
  markedResult.aspects,
)
check(
  'Prioritas bersama: selectPriorities mereproduksi daftar prioritas hasil analisis persis',
  recomputedPriorities.map((c) => c.id).join(',') ===
    markedResult.priorities.map((c) => c.id).join(',') &&
    analyzeTsText.includes('export function selectPriorities') &&
    analyzeTsText.includes('selectPriorities(allChecks, aspects)'),
  `urutan: ${markedResult.priorities.map((c) => c.id).join(' > ')}`,
)
const priorityRankOf = (list: typeof markedResult.priorities, id: string) =>
  list.findIndex((c) => c.id === id) + 1
const markedRanks = priorityRanks(markedResult.priorities)
check(
  'Prioritas bersama: priorityRanks memberi peringkat sesuai urutan daftar (1 = teratas)',
  markedResult.priorities.every((c, i) => markedRanks.get(c.id) === i + 1) &&
    markedRanks.get('frasa-lemah') === priorityRankOf(markedResult.priorities, 'frasa-lemah') &&
    markedRanks.get('kerapian-bahasa') ===
      priorityRankOf(markedResult.priorities, 'kerapian-bahasa') &&
    !markedRanks.has('hasil-terukur'),
  `frasa-lemah #${markedRanks.get('frasa-lemah')}, kerapian-bahasa #${markedRanks.get('kerapian-bahasa')}; hasil-terukur tidak termasuk prioritas CV uji ini`,
)

// ---------- Uji penghapusan fitur penanda teks CV (2026-11-24) ----------
// Perintah pengguna: fitur "Teks CV dengan Tanda" dihapus total karena
// dinilai tidak efektif — panel, modul marks.ts, unduhan PDF bertanda,
// dan cuplikan bertanda di demo tidak boleh tersisa; fitur hasil lain
// (daftar Prioritas Perbaikan, unduh laporan PDF) tetap utuh.
check(
  'Penghapusan penanda: patokan skor tidak digerakkan penghapusan itu (patokan berjalan kini 96/63/19, fresh graduate 55 — pergerakan sejak penghapusan berasal dari keputusan penjaga naratif & pengetatan lima dimensi 2026-11-24, bukan dari penghapusan penanda)',
  strong.total === 96 && medium.total === 63 && weak.total === 19 && fresh.total === 55,
  `kuat ${strong.total}, menengah ${medium.total}, lemah ${weak.total}, fresh ${fresh.total}`,
)
check(
  'Penghapusan penanda: App.tsx bebas panel & unduhan bertanda',
  !appTsxText.includes('Teks CV dengan Tanda') &&
    !appTsxText.includes('Unduh Teks Bertanda') &&
    !appTsxText.includes("from './lib/marks'") &&
    !appTsxText.includes('handleDownloadMarkedPdf'),
  'tidak ada panel, tombol, impor marks, atau handler unduh bertanda',
)
check(
  'Penghapusan penanda: modul marks.ts sudah tidak ada & pdf/report bersih',
  !existsSync(resolve(dirname(fileURLToPath(import.meta.url)), '../src/lib/marks.ts')) &&
    !srcText('../src/lib/pdf.ts').includes('buildMarkedTextPdf') &&
    !srcText('../src/lib/report.ts').includes('markedTextFileName'),
  'marks.ts terhapus; builder PDF bertanda & helper nama berkasnya ikut hilang',
)
check(
  'Penghapusan penanda: App.css bebas gaya penanda',
  !appCssText.includes('.marked-text') &&
    !appCssText.includes('.mark-priority') &&
    !appCssText.includes('.mark-explain') &&
    !appCssText.includes('.marks-legend'),
  'kelas .marked-text/.mark-priority/.mark-explain/.marks-legend tidak ada lagi',
)
check(
  'Penghapusan penanda: fitur hasil lain tetap terpasang',
  appTsxText.includes('Prioritas Perbaikan') &&
    appTsxText.includes('Unduh Laporan (PDF)') &&
    appTsxText.includes('Lihat Contoh Hasil'),
  'daftar prioritas, unduh laporan PDF, dan bagian contoh hasil tetap ada',
)

// ---------- Uji penghapusan bagian "Bagaimana skor dihitung?" (2026-11-24) ----------
// Perintah pengguna: section penjelasan cara hitung skor dihapus dari
// halaman — hanya tampilannya; logika penilaian tidak berubah sama sekali.
check(
  'Penghapusan transparansi: App.tsx bebas bagian "Bagaimana skor dihitung?"',
  !appTsxText.includes('Bagaimana skor dihitung') &&
    !appTsxText.includes('rules-list') &&
    !appCssText.includes('.rules-list'),
  'tidak ada judul section, daftar aturan, atau gaya .rules-list',
)

// ---------- Uji penghapusan section penjelasan lepas (2026-11-24) ----------
// Perintah pengguna: section penjelasan yang tidak penting ikut dihapus —
// langkah "Cara kerja" (alur sudah jelas dari formulir) dan "Tips lolos
// ATS" (tips generik; saran personal sudah ada di hasil pemeriksaan).
// Yang fungsional/penopang kepercayaan (hero, contoh hasil, pembayaran
// token, persetujuan AI, janji privasi, isi hasil) TIDAK boleh ikut hilang.
check(
  'Penghapusan section lepas: tidak ada lagi langkah Cara Kerja & Tips ATS',
  !appTsxText.includes('CARA KERJA') &&
    !appTsxText.includes('step-card') &&
    !appTsxText.includes('Tips lolos ATS') &&
    !appTsxText.includes('ATS_TIPS') &&
    !appCssText.includes('.step-card') &&
    !appCssText.includes('.tips-list'),
  'tidak ada markup, konstanta, atau gaya untuk kedua section itu',
)
check(
  'Penghapusan section lepas: bagian penting tetap terpasang',
  appTsxText.includes('Penilaian CV Bahasa Indonesia') &&
    appTsxText.includes('berjalan 100% di browser') &&
    appTsxText.includes('Lihat Contoh Hasil') &&
    appTsxText.includes('Minta Kode Token via WhatsApp') &&
    appTsxText.includes('Saya setuju teks CV dikirim ke OpenRouter'),
  'hero + janji privasi, contoh hasil, instruksi token, dan persetujuan AI tetap ada',
)

// ---------- Regresi audit menyeluruh (2026-11-24) ----------
// Setiap uji di bawah mengunci satu bug yang dibuktikan probe audit
// sebelum diperbaiki. Perbaikan-perbaikan audit ini sendiri TIDAK
// menggerakkan patokan (terverifikasi oleh uji patokan di atas);
// patokan lemah 16 → 14 terjadi sesudahnya atas keputusan pengguna —
// lihat blok "Keputusan audit lanjutan" di akhir berkas.

// --- Audit 1: heading palsu dari kalimat naratif (BUG-1) ---
// Kalimat ringkasan "Saya profesional berpengalaman." sebelumnya
// diperlakukan sebagai heading "Pengalaman" karena pencocokan substring,
// sehingga bagian ringkasan terpotong dan bagian sesudahnya hilang.
const AUDIT_HEADING_CV = [
  'Budi', 'budi@example.com', '081234567890',
  'Ringkasan',
  'Saya profesional berpengalaman.',
  'Pengalaman',
  'Staff — PT Maju (2020-2022)',
  '- Mengelola stok barang setiap hari',
].join('\n')
check(
  'Audit: kalimat naratif bukan heading — ringkasan utuh & pengalaman terbaca',
  getSummarySection(AUDIT_HEADING_CV).includes('profesional berpengalaman') &&
    getExperienceEntryDetails(AUDIT_HEADING_CV).length === 1,
  `ringkasan: "${getSummarySection(AUDIT_HEADING_CV).slice(0, 50)}", entri: ${getExperienceEntryDetails(AUDIT_HEADING_CV).length}`,
)
// Bullet "- Led training…" tidak boleh menjadi heading sertifikasi palsu.
const AUDIT_BULLET_HEADING_CV = [
  'Budi', 'budi@example.com', '081234567890',
  'Pengalaman',
  'Staff — PT Maju (2020-2022)',
  '- Led training untuk 5 staf baru di gudang',
  '- Mengelola stok barang setiap hari',
  'Pendidikan',
  'SMA Negeri 1 (2015-2018)',
].join('\n')
check(
  'Audit: bullet "Led training" bukan heading sertifikasi (skor sertifikasi tetap 0)',
  checkOf(analyzeCv(AUDIT_BULLET_HEADING_CV), 'sertifikasi')?.score === 0,
  `sertifikasi ${checkOf(analyzeCv(AUDIT_BULLET_HEADING_CV), 'sertifikasi')?.score}/3`,
)

// --- Audit 2: HP sebaris sesudah periode (BUG-2) ---
check(
  'Audit: HP sesudah periode di baris yang sama terdeteksi',
  findPhone('Staff 2020 - 2022 081234567890') !== null &&
    findPhone('Periode 2015-2020 saja') === null,
  `0812… sesudah periode: ${findPhone('Staff 2020 - 2022 081234567890')}, rentang tahun murni: ${findPhone('Periode 2015-2020 saja')}`,
)

// --- Audit 3: "Jan 2020 - Present" satu keluarga periode (BUG-3) ---
const AUDIT_MONTH_CV = [
  'Budi', 'budi@example.com', '081234567890',
  'Pengalaman',
  'Staff — PT A (Jan 2023 - Present)',
  '- Mengelola stok',
  'Staff — PT B (Jan 2020 - Des 2022)',
  '- Mengelola stok',
].join('\n')
check(
  'Audit: periode bulan tidak terhitung ganda — konsistensi penuh',
  getPeriodExprs('Jan 2020 - Present').length === 1 &&
    checkOf(analyzeCv(AUDIT_MONTH_CV), 'konsistensi-format')?.score === 3,
  `ekspresi: ${getPeriodExprs('Jan 2020 - Present').length}, konsistensi ${checkOf(analyzeCv(AUDIT_MONTH_CV), 'konsistensi-format')?.score}/3`,
)

// --- Audit 4: dua bagian Pengalaman sama-sama dibaca (BUG-5) ---
const AUDIT_TWO_SECTION_CV = [
  'Budi', 'budi@example.com', '081234567890',
  'Pengalaman Kerja',
  'Staff — PT A (2020-2021)',
  '- Mengelola stok barang',
  'Pengalaman Organisasi',
  'Manager — PT B (2023-2024)',
  '- Memimpin tim acara kampus',
].join('\n')
check(
  'Audit: bagian Pengalaman kedua tidak diabaikan',
  getExperienceEntryDetails(AUDIT_TWO_SECTION_CV).length === 2,
  `entri terbaca: ${getExperienceEntryDetails(AUDIT_TWO_SECTION_CV).length} (harus 2)`,
)

// --- Audit 5: pengelompokan entri paragraf tidak bergeser ---
// Baris uraian paragraf entri pertama sebelumnya dicuri sebagai "judul"
// entri berikutnya, mengacaukan kutipan kedalaman/hasil-terukur.
const AUDIT_PARA_CV = [
  'Budi', 'budi@example.com', '081234567890',
  'Pengalaman',
  'Kasir — Toko Berkah (Jan 2021 - Des 2022)',
  'Saya melayani pembeli dan mencatat penjualan setiap hari.',
  'Membuat laporan penjualan bulanan untuk pemilik toko.',
  'Staf Gudang — PT Logistik Jaya (2023-2024)',
  'Mengelola stok masuk dan keluar gudang.',
].join('\n')
const auditParaEntries = getExperienceEntryDetails(AUDIT_PARA_CV)
check(
  'Audit: entri paragraf terkelompok benar (Kasir 3 baris, lalu Staf Gudang)',
  auditParaEntries.length === 2 &&
    auditParaEntries[0].lines.length === 3 &&
    auditParaEntries[0].lines[0].includes('Kasir') &&
    auditParaEntries[1].lines[0].includes('Staf Gudang'),
  `entri: ${auditParaEntries.map((e) => `${e.lines[0].slice(0, 20)} (${e.lines.length} baris)`).join(' | ')}`,
)

// --- Audit 6: email berstruktur rusak ditolak (DIDUGA-9) ---
const AUDIT_BAD_EMAIL_CV = [
  'Budi', 'budi@gmail..com', '081234567890',
  'Pengalaman',
  'Staff — PT A (2020-2021)',
  '- Mengelola stok barang setiap hari dengan teliti dan rapi',
].join('\n')
check(
  'Audit: email "gmail..com" tidak diterima sebagai email sah',
  checkOf(analyzeCv(AUDIT_BAD_EMAIL_CV), 'email')?.score === 0,
  `email ${checkOf(analyzeCv(AUDIT_BAD_EMAIL_CV), 'email')?.score}`,
)

// --- Audit 7: teks kosong total 0, tanpa poin gratis (DIDUGA-6) ---
check(
  'Audit: teks kosong/spasi saja → total 0 dan tidak NaN',
  analyzeCv('').total === 0 && analyzeCv('   \n  ').total === 0 &&
    Number.isFinite(analyzeCv('').total),
  `kosong ${analyzeCv('').total}, spasi ${analyzeCv('   \n  ').total}`,
)

// --- Audit 8: glosarium — duplikasi ekor & singkatan bertanda hubung ---
check(
  'Audit glosarium: tidak ada duplikasi kata ekor pada perluasan judul',
  expandJobTitle('DevOps Engineer') === 'DevOps Engineer' &&
    expandJobTitle('SMM Specialist') === 'Social Media Specialist' &&
    expandJobTitle('QC Control') === 'Quality Control' &&
    expandJobTitle('QA Assurance') === 'Quality Assurance' &&
    expandJobTitle('PM Manager') === 'Product Manager' &&
    expandJobTitle('WH Gudang') === 'Staf Gudang',
  `DevOps→"${expandJobTitle('DevOps Engineer')}", SMM→"${expandJobTitle('SMM Specialist')}", QC Control→"${expandJobTitle('QC Control')}"`,
)
check(
  'Audit glosarium: singkatan bertanda hubung ikut mengembang; IT tetap apa adanya',
  expandJobTitle('QC-Inspector') === 'Quality Control-Inspector' &&
    expandJobTitle('SPV-Produksi') === 'Supervisor-Produksi' &&
    expandJobTitle('QA/QC') === 'Quality Assurance / Quality Control' &&
    expandJobTitle('tim IT Support') === 'tim IT Support',
  `QC-Inspector→"${expandJobTitle('QC-Inspector')}", SPV-Produksi→"${expandJobTitle('SPV-Produksi')}"`,
)

// --- Audit 9: contoh personal kata-kerja-aksi untuk bullet kata kerja sah ---
// Bullet berawalan kata kerja me- yang sah (Melayani, Mencatat, …)
// sebelumnya TIDAK PERNAH menghasilkan contoh personal walau
// pemeriksaannya gagal — generator hanya mengenali awalan lemah.
const AUDIT_VERB_CV = [
  'Sari Dewi', 'sari@example.com', '081298765432',
  'Ringkasan',
  'Lulusan SMA yang teliti dan siap bekerja di bidang ritel maupun gudang untuk jangka panjang.',
  'Pengalaman',
  'Pramuniaga — Toko Sinar (2022-2024)',
  '• Melayani pelanggan yang datang ke toko setiap hari',
  '• Mencatat penjualan harian ke buku kas toko',
  '• Menjawab pertanyaan pelanggan tentang produk',
  '• Merapikan rak display agar terlihat menarik',
  '• Menghitung uang kas di akhir jam kerja',
  'Pendidikan',
  'SMA Negeri 2 (2019-2022)',
  'Keahlian',
  'Kasir, Komunikasi, Melayani pelanggan, Mencatat stok, Menghitung uang, Merapikan display, Menjawab telepon, Kerja tim',
].join('\n')
const auditVerbResult = analyzeCv(AUDIT_VERB_CV)
const auditVerbExample = buildPersonalExamples(auditVerbResult, AUDIT_VERB_CV, '')['kata-kerja-aksi']
check(
  'Audit personal: contoh kata-kerja-aksi muncul untuk bullet kata kerja sah',
  checkOf(auditVerbResult, 'kata-kerja-aksi')?.status !== 'baik' &&
    !!auditVerbExample &&
    AUDIT_VERB_CV.includes(auditVerbExample.kutipanAsli) &&
    auditVerbExample.versiPerbaikan.includes('['),
  auditVerbExample ? `kutipan: "${auditVerbExample.kutipanAsli.slice(0, 50)}…"` : 'contoh tidak ada',
)

// --- Audit 10: contoh kerapian memperbaiki SEMUA salah eja sebaris ---
const AUDIT_TYPO_CV = [
  'Rina', 'rina@example.com', '081298765433',
  'Pengalaman',
  'Kasir — Toko Berkah (2021-2023)',
  '• Melakukan aktifitas kasir dan merubah jadwal piket setiap minggu',
  'Pendidikan',
  'SMA Negeri 1 (2018-2021)',
].join('\n')
const auditTypoExample = buildPersonalExamples(analyzeCv(AUDIT_TYPO_CV), AUDIT_TYPO_CV, '')['kerapian-bahasa']
check(
  'Audit personal: dua salah eja dalam satu kutipan sama-sama diperbaiki',
  !!auditTypoExample &&
    auditTypoExample.versiPerbaikan.includes('aktivitas') &&
    auditTypoExample.versiPerbaikan.includes('mengubah') &&
    !/\baktifitas\b/.test(auditTypoExample.versiPerbaikan) &&
    !/\bmerubah\b/.test(auditTypoExample.versiPerbaikan),
  auditTypoExample ? `sesudah: "${auditTypoExample.versiPerbaikan.slice(0, 70)}…"` : 'contoh tidak ada',
)

// --- Audit 11: parser AI menolak hasil hampa & merekonsiliasi perbaikan ---
check(
  'Audit AI: hasil hampa (ringkasan kosong / semua bidang kosong) ditolak parser',
  parseAiJson('{"ringkasan":""}') === null &&
    parseAiJson('{"ringkasan":"","saranPenulisanUlang":[{}],"kekurangan":[],"saranRingkasan":"","perbaikanLengkap":[]}') === null &&
    parseAiJson('{"ringkasan":"Cukup baik."}') !== null,
  'jawaban kosong tidak boleh lolos sebagai sukses (token aman)',
)
const AUDIT_FIX_JSON = JSON.stringify({
  ringkasan: 'Ok.',
  perbaikanLengkap: [
    { idPemeriksaan: 'email', judul: 'Email', sebelum: '', sesudah: 'Tambahkan email', catatan: '' },
    { idPemeriksaan: 'karangan', judul: 'X', sebelum: '', sesudah: 'Ngawur', catatan: '' },
    { idPemeriksaan: 'email', judul: 'Email', sebelum: '', sesudah: 'Duplikat', catatan: '' },
  ],
})
const auditFixParsed = parseAiJson(AUDIT_FIX_JSON, ['email', 'linkedin'])
check(
  'Audit AI: perbaikanLengkap direkonsiliasi — id asing & duplikat dibuang, nol valid = gagal',
  auditFixParsed !== null &&
    auditFixParsed.perbaikanLengkap.length === 1 &&
    auditFixParsed.perbaikanLengkap[0].sesudah === 'Tambahkan email' &&
    parseAiJson(JSON.stringify({ ringkasan: 'Ok.', perbaikanLengkap: [{ idPemeriksaan: 'asing', sesudah: 'x' }] }), ['email']) === null,
  `tersisa: ${auditFixParsed?.perbaikanLengkap.map((f) => f.idPemeriksaan).join(', ')}`,
)
check(
  'Audit AI: parseFailedChecks membuang id duplikat',
  parseFailedChecks([
    { id: 'email', judul: 'Email' },
    { id: 'email', judul: 'Email lagi' },
    { id: 'hp', judul: 'HP' },
  ]).length === 2,
  'id yang sama hanya boleh masuk prompt satu kali',
)

// --- Audit 12: validasi hasil AI di sisi klien ---
let auditClientThrew = 0
for (const bad of [null, 'teks', [], { ringkasan: '' }, { ringkasan: '  ', saranPenulisanUlang: [{}] }]) {
  try {
    validateAiAnalysis(bad)
  } catch {
    auditClientThrew++
  }
}
let auditClientFixThrew = false
try {
  validateAiAnalysis({ ringkasan: 'Ok.' }, 3)
} catch {
  auditClientFixThrew = true
}
check(
  'Audit klien AI: hasil sampah/kosong ditolak; diminta perbaikan tapi kosong ditolak; hasil sah lolos',
  auditClientThrew === 5 &&
    auditClientFixThrew &&
    validateAiAnalysis({ ringkasan: 'Bagus.', perbaikanLengkap: [{ idPemeriksaan: 'email', sesudah: 'Tambahkan email' }] }, 1)
      .perbaikanLengkap.length === 1,
  `ditolak ${auditClientThrew}/5 bentuk sampah`,
)

// ---------- Uji penyesuaian posisi Analisis AI (2026-11-26) ----------
// Keputusan pengguna: pembahasan AI disesuaikan dengan posisi yang
// dilamar. Klien menurunkan konteks posisi dari kamus situs sendiri,
// server membersihkannya seperti konteks pemeriksaan, prompt menilai
// dari kacamata posisi itu, dan bidang baru "penilaianPosisi" bersifat
// opsional-toleran di semua validasi.
const roleCtx = buildAiRoleContext(SAMPLE_CV, 'Data Analyst')
const daftarSkillStatus = checkSkills(SAMPLE_CV, getRoleSkills('Data Analyst').skills)
check(
  'Posisi AI: konteks Data Analyst memilah skill ada/belum persis seperti kartu Daftar Skill',
  roleCtx !== null &&
    roleCtx.posisi === 'Data Analyst' &&
    roleCtx.skillDiharapkan.length === 10 &&
    roleCtx.skillAda.includes('SQL') &&
    roleCtx.skillAda.includes('Python') &&
    roleCtx.skillAda.includes('Power BI') &&
    roleCtx.skillBelum.includes('Statistik') &&
    roleCtx.skillBelum.includes('Visualisasi Data') &&
    roleCtx.skillBelum.includes('PivotTable') &&
    roleCtx.skillAda.every(
      (s) => daftarSkillStatus.find((d) => d.skill === s)?.present === true,
    ) &&
    roleCtx.skillBelum.every(
      (s) => daftarSkillStatus.find((d) => d.skill === s)?.present === false,
    ) &&
    roleCtx.skillAda.length + roleCtx.skillBelum.length === roleCtx.skillDiharapkan.length,
  `ada: ${roleCtx?.skillAda.join(', ')}; belum: ${roleCtx?.skillBelum.join(', ')}`,
)
check(
  'Posisi AI: posisi kosong → tanpa konteks; singkatan tampil sebagai nama lengkap glosarium',
  buildAiRoleContext(SAMPLE_CV, '') === null &&
    buildAiRoleContext(SAMPLE_CV, '   ') === null &&
    buildAiRoleContext(SAMPLE_CV, 'QC')?.posisi === 'Quality Control' &&
    buildAiRoleContext(SAMPLE_CV, 'fullstack')?.posisi === 'Full Stack Developer',
  'label konteks = label kartu Daftar Skill, termasuk perluasan glosarium & kamus peran',
)
const parsedRoleCtx = parseRoleContext({
  posisi: 'Data Analyst',
  skillDiharapkan: ['SQL', 'Python'],
  skillAda: ['SQL', 'sql', 42, ''],
  skillBelum: ['Python', 'SQL', 'Tableau'],
})
check(
  'Posisi AI: parseRoleContext membersihkan daftar (duplikat, non-string, tumpang tindih ada/belum)',
  parsedRoleCtx !== null &&
    parsedRoleCtx.posisi === 'Data Analyst' &&
    parsedRoleCtx.skillAda.length === 1 &&
    parsedRoleCtx.skillBelum.join(',') === 'Python,Tableau' &&
    parseRoleContext(null) === null &&
    parseRoleContext('Data Analyst') === null &&
    parseRoleContext({ posisi: '  ' }) === null &&
    parseRoleContext({ skillAda: ['SQL'] }) === null,
  'konteks tak sah → null (perilaku lama); skill yang terbukti ada dimenangkan atas daftar belum',
)
check(
  'Posisi AI: parseRoleContext membatasi jumlah & panjang item',
  (() => {
    const many = parseRoleContext({
      posisi: 'Data Analyst',
      skillDiharapkan: Array.from({ length: 20 }, (_, i) => `Skill ${i}`),
      skillAda: ['x'.repeat(120)],
      skillBelum: [],
    })
    return (
      many !== null &&
      many.skillDiharapkan.length === 15 &&
      many.skillAda[0].length === 60
    )
  })(),
  'maksimal 15 skill per daftar, tiap nama maks 60 karakter',
)
const parsedWithVerdict = parseAiJson(
  JSON.stringify({
    ringkasan: 'CV kuat.',
    penilaianPosisi: 'Sangat cocok untuk Data Analyst: SQL dan Power BI terbukti; celah kritisnya PivotTable belum muncul.',
  }),
)
const parsedNoVerdict = parseAiJson(JSON.stringify({ ringkasan: 'CV kuat.' }))
const parsedBadVerdict = parseAiJson(
  JSON.stringify({ ringkasan: 'CV kuat.', penilaianPosisi: { aneh: true } }),
)
check(
  'Posisi AI: parser server menoleransi penilaianPosisi (ada terbawa, absen/aneh jadi kosong, hasil tetap sah)',
  parsedWithVerdict !== null &&
    parsedWithVerdict.penilaianPosisi.includes('Sangat cocok untuk Data Analyst') &&
    parsedNoVerdict !== null &&
    parsedNoVerdict.penilaianPosisi === '' &&
    parsedBadVerdict !== null &&
    parsedBadVerdict.penilaianPosisi === '' &&
    parseAiJson(JSON.stringify({ penilaianPosisi: 'Hanya bidang ini.' })) === null,
  'bidang opsional tidak menggagalkan hasil, dan isinya sendirian tidak menyatakan hasil berhasil',
)
check(
  'Posisi AI: validasi klien menoleransi penilaianPosisi (ada terbawa, absen/aneh jadi kosong)',
  validateAiAnalysis({ ringkasan: 'Ok.', penilaianPosisi: 'Cocok untuk posisi itu.' })
    .penilaianPosisi === 'Cocok untuk posisi itu.' &&
    validateAiAnalysis({ ringkasan: 'Ok.' }).penilaianPosisi === '' &&
    validateAiAnalysis({ ringkasan: 'Ok.', penilaianPosisi: 42 }).penilaianPosisi === '',
  'variansi model pada bidang opsional tidak membakar token pengguna',
)
check(
  'Posisi AI: kartu AI menampilkan label posisi + blok penilaian posisi, konteks dibangun dari snapshot',
  appTsxText.includes('Disesuaikan untuk posisi:') &&
    appTsxText.includes('Penilaian untuk Posisi') &&
    appTsxText.includes('buildAiRoleContext(sourceText, sourceRole)') &&
    appTsxText.includes('aiResult.penilaianPosisi'),
  'label memakai label snapshot analisis (aiRoleLabel), bukan isi kolom posisi saat ini',
)
check(
  'Kartu AI: harga & "bukan langganan" hanya di kotak pembayaran; paragraf kepala tanpa harga',
  !appTsxText.includes('per analisis</strong> lewat') &&
    appTsxText.includes('sekali analisis, <strong>bukan langganan</strong>') &&
    appTsxText.includes('print + fotokopi CV') &&
    appTsxText.includes('tokenmu tidak hangus') &&
    appTsxText.includes('FAKHRI, DIGITAL &amp; KREATIF'),
  'pesan harga satu kali di pay-intro; janji token tidak hangus tetap di paragraf kepala',
)

// ---------- Standar kualitas ringkasan & kekurangan AI (2026-11-26) ----------
// Permintaan pengguna dari hasil analisis CV-nya sendiri (Data Analyst):
// saranRingkasan mengikuti alur 4 langkah (kualifikasi terkuat → skill
// disertai bukti/alat → pencapaian/proyek/publikasi teratas → posisi
// tujuan + nilai tawar) dan bebas frasa lemah; setiap butir kekurangan
// berpola spesifik + alasan + tindakan dan tidak mengulang persis isi
// perbaikanLengkap. Yang dikunci di sini adalah ATURAN di dalam prompt
// (buildPrompt) — kepatuhan modelnya diverifikasi lewat uji live.
const promptRoleStandar = buildPrompt(MEDIUM_CV, 'Data Analyst', '', [], roleCtx)
const promptPolosStandar = buildPrompt(MEDIUM_CV, '', '', [], null)
check(
  'Prompt AI: saranRingkasan dikunci ke alur 4 langkah + anti-klise + fakta CV saja',
  promptRoleStandar.includes('alur WAJIB') &&
    promptRoleStandar.includes('kualifikasi terkuat lebih dulu') &&
    promptRoleStandar.includes('pencapaian, proyek, atau publikasi paling menonjol') &&
    promptRoleStandar.includes('nilai konkret yang ditawarkan ke pemberi kerja') &&
    promptRoleStandar.includes('TANPA frasa lemah/klise') &&
    promptRoleStandar.includes('pekerja keras') &&
    promptPolosStandar.includes('alur WAJIB'),
  'struktur ringkasan wajib ada di prompt berposisi maupun tanpa posisi',
)
check(
  'Prompt AI: kekurangan berpola spesifik + alasan + tindakan, terpisah dari perbaikanLengkap',
  promptRoleStandar.includes('SPESIFIK') &&
    promptRoleStandar.includes('ALASAN') &&
    promptRoleStandar.includes('TINDAKAN') &&
    promptRoleStandar.includes('terutama untuk posisi target') &&
    promptRoleStandar.includes('JANGAN mengulang persis isi "perbaikanLengkap"') &&
    promptPolosStandar.includes('SPESIFIK') &&
    !promptPolosStandar.includes('terutama untuk posisi target'),
  'pola tiga unsur selalu ada; penekanan posisi target hanya bila konteks posisi ada',
)

// ---------- Uji label posisi Riwayat Skor (2026-11-26) ----------
// Data tersimpan tetap teks mentah pengguna; hanya TAMPILAN yang
// dinormalisasi lewat resolusi nama kartu Daftar Skill.
check(
  'Riwayat: label posisi tampilan diresolusi seperti judul kartu Daftar Skill',
  historyRoleLabel('fullstack') === 'Full Stack Developer' &&
    historyRoleLabel('data analyst') === 'Data Analyst' &&
    historyRoleLabel('Data Analyst') === 'Data Analyst' &&
    historyRoleLabel('QC') === 'Quality Control' &&
    historyRoleLabel('') === '',
  `"fullstack"→"${historyRoleLabel('fullstack')}", "data analyst"→"${historyRoleLabel('data analyst')}", "QC"→"${historyRoleLabel('QC')}"`,
)
check(
  'Riwayat: posisi tak dikenal tampil apa adanya; ketikan serba kecil dirapikan kapitalnya',
  historyRoleLabel('petugas parkir') === 'Petugas Parkir' &&
    historyRoleLabel('Staff Gudang') === 'Staff Gudang' &&
    historyRoleLabel('WH') === 'Staf Gudang' &&
    historyRoleLabel('SPV Produksi') === 'Operator Produksi',
  'teks kustom tidak diganti (WH→perluasan glosarium); "SPV Produksi" cocok langsung ke kamus lewat kata "produksi" — persis perilaku kartu Daftar Skill',
)
check(
  'Riwayat: kesamaan posisi untuk spanduk dihitung dari label resolusi',
  historyRolesMatch('data analyst', 'Data Analyst') === true &&
    historyRolesMatch('fullstack', 'Full Stack Developer') === true &&
    historyRolesMatch('fullstack', 'Data Analyst') === false &&
    historyRolesMatch('', '') === true &&
    historyRolesMatch('Data Analyst', '') === false,
  'beda ejaan posisi yang sama tetap cocok; beda posisi (atau satu kosong) tidak',
)
check(
  'Riwayat: spanduk perbandingan sadar-posisi (label resolusi + cabang Beda posisi)',
  appTsxText.includes('historyRolesMatch(prevEntry.role, analyzedRole)') &&
    appTsxText.includes('Beda posisi') &&
    appTsxText.includes('historyRoleLabel(e.role)') &&
    appTsxText.includes('Posisi targetnya berbeda dari cek terakhir'),
  'delta skor & per aspek hanya untuk posisi sama; baris riwayat memakai historyRoleLabel',
)

// --- Audit 13: sanitasi teks PDF (encoding WinAnsi jsPDF) ---
check(
  'Audit PDF: karakter di luar WinAnsi dipetakan aman, karakter sah utuh',
  sanitizePdfText('a → b') === 'a -> b' &&
    sanitizePdfText('✓ selesai') === 'v selesai' &&
    sanitizePdfText('★5') === '*5' &&
    sanitizePdfText('3×4') === '3x4' &&
    !sanitizePdfText('kerja 🚀 keras').includes('🚀') &&
    sanitizePdfText('Halo — dunia • “kutip” é') === 'Halo — dunia • “kutip” é',
  `"→"→"${sanitizePdfText('→')}", "✓"→"${sanitizePdfText('✓')}", emoji hilang`,
)

// --- Audit 14: readFile berbatas ukuran + pesan ramah (teks sumber) ---
// readFile.ts tidak bisa diimpor di lingkungan uji Node (impor worker
// "?url" khas Vite), jadi kuncinya berupa pemeriksaan teks sumber —
// perilaku runtime-nya terverifikasi lewat build Vite + probe manual.
const readFileTsText = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../src/lib/readFile.ts'),
  'utf8',
)
check(
  'Audit readFile: batas 10 MB + pesan error Bahasa Indonesia terpasang',
  readFileTsText.includes('MAX_FILE_BYTES = 10 * 1024 * 1024') &&
    readFileTsText.includes('File terlalu besar') &&
    readFileTsText.includes('File PDF tidak bisa dibaca') &&
    readFileTsText.includes('File DOCX tidak bisa dibaca'),
  'berkas raksasa ditolak sebelum diurai; error parser mentah tidak tampil ke pengguna',
)

// --- Audit 15: halaman privasi sesuai alur QRIS manual (bukan Midtrans) ---
const privacyHtmlText = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../public/privacy.html'),
  'utf8',
)
check(
  'Audit privasi: tidak lagi menyebut Midtrans; alur QRIS manual + kode sekali pakai dijelaskan',
  !privacyHtmlText.includes('Midtrans') &&
    privacyHtmlText.includes('QRIS merchant GoPay pemilik situs') &&
    privacyHtmlText.includes('kode sekali pakai') &&
    privacyHtmlText.includes('24 November 2026'),
  'halaman privasi publik harus cocok dengan alur pembayaran yang benar-benar berjalan',
)

// ---------- Keputusan audit lanjutan (2026-11-24) ----------
// Tiga temuan audit yang saat audit sengaja TIDAK diubah kini
// diterapkan atas persetujuan pengguna ("Ya, perbaiki ketiganya
// seperti rekomendasimu"): (1) periode terbalik & masa depan tidak
// lagi berpoin linimasa penuh, (2) peringatan lowongan terlalu
// singkat — skor kecocokan TIDAK berubah, (3) penjaga luas CV
// naratif tanpa bagian — patokan CV lemah 16 → 14; patokan lain
// wajib tetap persis (dikunci uji patokan di atas).

// --- Keputusan 1: periode terbalik & masa depan (linimasa) ---
const PERIOD_CV = (entries: string) => `Rudi Hartono
rudi.hartono@gmail.com | 0812-1111-2222

Pengalaman
${entries}

Pendidikan
SMA Negeri 1 Jakarta (2010 - 2013)`

const reversedPeriod = analyzeCv(
  PERIOD_CV('Kasir — Toko Berkah (2024–2020)\n- Melayani pembeli setiap hari.'),
)
check(
  'Keputusan audit 1: periode terbalik (2024–2020) kehilangan poin linimasa + pesan menyebut masalahnya',
  checkOf(reversedPeriod, 'linimasa')?.score === 0 &&
    (checkOf(reversedPeriod, 'linimasa')?.message.includes('2024') ?? false) &&
    (checkOf(reversedPeriod, 'linimasa')?.message.includes('terbalik') ?? false),
  `skor ${checkOf(reversedPeriod, 'linimasa')?.score}/3; pesan: ${checkOf(reversedPeriod, 'linimasa')?.message.slice(0, 110)}…`,
)
const futurePeriod = analyzeCv(
  PERIOD_CV('Staf Gudang — PT Logistik Jaya (2030–2032)\n- Mengelola stok barang.'),
)
check(
  'Keputusan audit 1: periode masa depan (2030–2032) kehilangan poin linimasa + pesan menyebut masalahnya',
  checkOf(futurePeriod, 'linimasa')?.score === 0 &&
    (checkOf(futurePeriod, 'linimasa')?.message.includes('2030') ?? false) &&
    (checkOf(futurePeriod, 'linimasa')?.message.includes('masa depan') ?? false),
  `skor ${checkOf(futurePeriod, 'linimasa')?.score}/3; pesan: ${checkOf(futurePeriod, 'linimasa')?.message.slice(0, 110)}…`,
)
const normalPeriod = analyzeCv(
  PERIOD_CV('Kasir — Toko Berkah (2022–2024)\n- Melayani pembeli setiap hari.'),
)
const currentPeriod = analyzeCv(
  PERIOD_CV('Kasir — Toko Berkah (2022–Sekarang)\n- Melayani pembeli setiap hari.'),
)
check(
  'Keputusan audit 1: periode normal & "Sekarang" tetap berpoin linimasa penuh (tidak berubah)',
  checkOf(normalPeriod, 'linimasa')?.score === 3 &&
    checkOf(currentPeriod, 'linimasa')?.score === 3,
  `normal ${checkOf(normalPeriod, 'linimasa')?.score}/3, sekarang ${checkOf(currentPeriod, 'linimasa')?.score}/3`,
)

// --- Keputusan 2: peringatan lowongan terlalu singkat (skor tetap) ---
const tinyJob = analyzeCv(
  PERIOD_CV('Kasir — Toko Berkah (2022–2024)\n- Melayani pembeli setiap hari.'),
  { jobDesc: 'Kasir.' },
)
check(
  'Keputusan audit 2: lowongan 1 kata kunci memunculkan peringatan, skor kecocokan tetap penuh (20/20)',
  tinyJob.keywords?.total === 1 &&
    jobAspectOf(tinyJob)?.score === 20 &&
    (checkOf(tinyJob, 'kecocokan-lowongan')?.message.includes('Peringatan: teks lowongan yang kamu tempel sangat singkat') ?? false),
  `kata kunci ${tinyJob.keywords?.total}, kecocokan ${jobAspectOf(tinyJob)?.score}/20 (${tinyJob.keywords?.percent}%), peringatan ${checkOf(tinyJob, 'kecocokan-lowongan')?.message.includes('Peringatan') ? 'ada' : 'TIDAK ADA'}`,
)
check(
  'Keputusan audit 2: lowongan normal tidak memunculkan peringatan',
  !(checkOf(mediumJobMatch, 'kecocokan-lowongan')?.message.includes('Peringatan: teks lowongan') ?? true),
  `kata kunci lowongan admin ${mediumJobMatch.keywords?.total} (> 2) → tanpa peringatan`,
)

// --- Keputusan 3: penjaga luas CV naratif tanpa bagian ---
check(
  'Keputusan audit 3: CV lemah tanpa bagian — panjang 0, kerapian 1, kerapian bukan lagi kekuatan (total kini 19 setelah pengetatan lima dimensi 2026-11-24)',
  weak.total === 19 &&
    weakCheck('panjang')?.score === 0 &&
    weakCheck('kerapian-bahasa')?.score === 1 &&
    !weak.strengths.some((c) => c.id === 'kerapian-bahasa'),
  `total ${weak.total} (14 dari keputusan ini; +5 dari poin netral/lulus dimensi baru 2026-11-24: profesionalitas email +1 neto, klaim +2, nama file +2), panjang ${weakCheck('panjang')?.score}/7, kerapian ${weakCheck('kerapian-bahasa')?.score}/2`,
)
const SECTIONLESS_TYPO_CV = `Andi Pratama
andi.pratama@gmail.com
Saya Andi. Saya pernah bekerja di toko pakaian. Aktifitas saya melayani pembeli setiap hari dan menjaga kasir toko.`
const sectionlessTypo = analyzeCv(SECTIONLESS_TYPO_CV)
check(
  'Keputusan audit 3: CV tanpa bagian yang mengandung salah eja — kerapian 0 (komponen eja tetap dinilai dari teks)',
  checkOf(sectionlessTypo, 'kerapian-bahasa')?.score === 0 &&
    checkOf(sectionlessTypo, 'panjang')?.score === 0,
  `kerapian ${checkOf(sectionlessTypo, 'kerapian-bahasa')?.score}/2, panjang ${checkOf(sectionlessTypo, 'panjang')?.score}/7`,
)
check(
  'Keputusan audit 3: CV terstruktur tetap mendapat poin panjang & kerapian seperti sebelumnya',
  (mediumCheck('panjang')?.score ?? 0) > 0 && mediumCheck('kerapian-bahasa')?.score === 2,
  `menengah panjang ${mediumCheck('panjang')?.score}/7, kerapian ${mediumCheck('kerapian-bahasa')?.score}/2`,
)

// ---------- Pengetatan lima dimensi baru (2026-11-24) ----------
// Persetujuan pengguna: "Ya, tambahkan pemeriksaan baru itu" — lima
// dimensi yang sebelumnya tidak dinilai (profesionalitas email,
// job hopping, tumpang tindih periode, konsistensi klaim pengalaman,
// nama file CV) kini diperiksa; keketatan dari keluasan aspek, bukan
// kuota pemeriksaan lama. Job hopping + tumpang tindih digabung dalam
// satu pemeriksaan "kestabilan-karier" karena keduanya membaca fakta
// linimasa yang sama. Bobot didanai dari dalam aspeknya (lihat tabel
// komposisi di ROADMAP.md); patokan terkunci kini 96/63/19.

// --- Komposisi baru: total tetap 100, maks per pemeriksaan sesuai tabel ---
check(
  'Pengetatan 2026-11-24: komposisi aspek tetap 100 dengan bobot baru',
  strong.aspects.reduce((s, a) => s + a.max, 0) === 100 &&
    strongCheck('email')?.max === 6 &&
    strongCheck('hp')?.max === 5 &&
    strongCheck('email-profesional')?.max === 2 &&
    strongCheck('pengalaman-heading')?.max === 4 &&
    strongCheck('hasil-terukur')?.max === 5 &&
    strongCheck('kedalaman-entri')?.max === 3 &&
    strongCheck('frasa-lemah')?.max === 2 &&
    strongCheck('kestabilan-karier')?.max === 2 &&
    strongCheck('konsistensi-klaim')?.max === 2 &&
    strongCheck('panjang')?.max === 7 &&
    strongCheck('periode')?.max === 3 &&
    strongCheck('nama-file')?.max === 2 &&
    (strong.aspects.find((a) => a.name === 'Kontak')?.max ?? 0) === 20 &&
    (strong.aspects.find((a) => a.name === 'Pengalaman')?.max ?? 0) === 28 &&
    (strong.aspects.find((a) => a.name === 'Format & ATS')?.max ?? 0) === 20,
  `maks: ${strong.aspects.map((a) => `${a.name} ${a.max}`).join(' | ')}`,
)
check(
  'Pengetatan 2026-11-24: CV kuat lulus PENUH semua pemeriksaan baru',
  strongCheck('email-profesional')?.score === 2 &&
    strongCheck('kestabilan-karier')?.score === 2 &&
    strongCheck('konsistensi-klaim')?.score === 2 &&
    strongCheck('nama-file')?.score === 2,
  `kuat: email-profesional ${strongCheck('email-profesional')?.score}/2, kestabilan ${strongCheck('kestabilan-karier')?.score}/2, klaim ${strongCheck('konsistensi-klaim')?.score}/2, nama-file ${strongCheck('nama-file')?.score}/2`,
)
check(
  'Pengetatan 2026-11-24: contoh generik tersedia untuk keempat id pemeriksaan baru',
  ['email-profesional', 'kestabilan-karier', 'konsistensi-klaim', 'nama-file'].every(
    (id) => getCheckExample(id) !== null,
  ),
  ['email-profesional', 'kestabilan-karier', 'konsistensi-klaim', 'nama-file']
    .map((id) => `${id}: ${getCheckExample(id) ? 'ada' : 'TIDAK ADA'}`)
    .join(' | '),
)

// --- 1. Profesionalitas email ---
const EMAIL_CV = (email: string) => `Uji Nama
${email} | 0812-3456-7890

Pengalaman
Kasir — Toko Berkah (2022–2024)
- Melayani pembeli setiap hari.`
check(
  'Email profesional: email pemilik situs (mfakhri338 — 3 digit) WAJIB lulus',
  checkOf(analyzeCv(EMAIL_CV('mfakhri338@gmail.com')), 'email-profesional')?.score === 2 &&
    strongCheck('email-profesional')?.score === 2,
  `mfakhri338 ${checkOf(analyzeCv(EMAIL_CV('mfakhri338@gmail.com')), 'email-profesional')?.score}/2`,
)
check(
  'Email profesional: nama + 2 digit tahun (budi.santoso95) lulus; nama asli "Cantika" tidak tertandai kata "cantik"',
  checkOf(analyzeCv(EMAIL_CV('budi.santoso95@gmail.com')), 'email-profesional')?.score === 2 &&
    checkOf(analyzeCv(EMAIL_CV('cantika.sari@gmail.com')), 'email-profesional')?.score === 2,
  `budi.santoso95 ${checkOf(analyzeCv(EMAIL_CV('budi.santoso95@gmail.com')), 'email-profesional')?.score}/2, cantika.sari ${checkOf(analyzeCv(EMAIL_CV('cantika.sari@gmail.com')), 'email-profesional')?.score}/2`,
)
check(
  'Email profesional: kata alay (budi.cakepz123) tertandai + pesan menyebut katanya',
  checkOf(analyzeCv(EMAIL_CV('budi.cakepz123@gmail.com')), 'email-profesional')?.score === 0 &&
    (checkOf(analyzeCv(EMAIL_CV('budi.cakepz123@gmail.com')), 'email-profesional')?.message.includes('cakep') ?? false),
  `skor ${checkOf(analyzeCv(EMAIL_CV('budi.cakepz123@gmail.com')), 'email-profesional')?.score}/2`,
)
check(
  'Email profesional: deretan ≥5 digit (andi12345) tertandai; tanpa email → 0',
  checkOf(analyzeCv(EMAIL_CV('andi12345@gmail.com')), 'email-profesional')?.score === 0 &&
    checkOf(analyzeCv('Tanpa email sama sekali.\n\nPengalaman\nKasir — Toko Berkah (2022–2024)\n- Melayani pembeli.'), 'email-profesional')?.score === 0,
  `andi12345 ${checkOf(analyzeCv(EMAIL_CV('andi12345@gmail.com')), 'email-profesional')?.score}/2`,
)

// --- 2+3. Kestabilan karier: job hopping & tumpang tindih ---
const HOPPING_CV = `Joko Pindah
joko.pindah@gmail.com | 0812-9999-8888

Pengalaman
Kasir — Toko A (2020)
- Melayani pembeli.
Staf Toko — Toko B (2021)
- Menata barang.
Admin — PT C (2022)
- Input data harian.
Operator — PT D (2023)
- Mengoperasikan mesin.`
check(
  'Kestabilan karier: 4 peran formal <12 bulan beruntun → job hopping tertandai, jumlah disebut',
  checkOf(analyzeCv(HOPPING_CV), 'kestabilan-karier')?.score === 1 &&
    (checkOf(analyzeCv(HOPPING_CV), 'kestabilan-karier')?.message.includes('4 dari 4 peran formalmu berdurasi singkat') ?? false),
  `skor ${checkOf(analyzeCv(HOPPING_CV), 'kestabilan-karier')?.score}/2`,
)
const OVERLAP_CV = `Rina Ganda
rina.ganda@gmail.com | 0812-9999-7777

Pengalaman
Staf Administrasi — PT Alpha (2020–2023)
- Mengelola arsip dokumen.
Supervisor Gudang — PT Beta (2022–Sekarang)
- Mengawasi tim gudang.`
check(
  'Kestabilan karier: dua peran formal tumpang tindih substansial → tertandai, pasangan disebut',
  checkOf(analyzeCv(OVERLAP_CV), 'kestabilan-karier')?.score === 1 &&
    (checkOf(analyzeCv(OVERLAP_CV), 'kestabilan-karier')?.message.includes('tumpang tindih') ?? false) &&
    (checkOf(analyzeCv(OVERLAP_CV), 'kestabilan-karier')?.message.includes('PT Alpha') ?? false) &&
    (checkOf(analyzeCv(OVERLAP_CV), 'kestabilan-karier')?.message.includes('PT Beta') ?? false),
  `skor ${checkOf(analyzeCv(OVERLAP_CV), 'kestabilan-karier')?.score}/2`,
)
const HOPPING_OVERLAP_CV = `Dedi Kacau
dedi.kacau@gmail.com | 0812-9999-6666

Pengalaman
Kasir — Toko A (2020)
- Melayani pembeli.
Staf — Toko B (2021)
- Menata barang.
Admin — PT C (2022)
- Input data.
Analis — PT D (2022–2024)
- Menganalisis data.
Analis Senior — PT E (2023–2025)
- Memimpin analisis.`
check(
  'Kestabilan karier: job hopping + tumpang tindih bersamaan → 0',
  checkOf(analyzeCv(HOPPING_OVERLAP_CV), 'kestabilan-karier')?.score === 0,
  `skor ${checkOf(analyzeCv(HOPPING_OVERLAP_CV), 'kestabilan-karier')?.score}/2`,
)
const MAGANG_HEAVY_CV = `Sari Magang
sari.magang@gmail.com | 0812-9999-5555

Pengalaman
Magang Administrasi — PT Alpha (2023)
- Membantu arsip dokumen.
Magang Data Entry — PT Beta (2023)
- Menginput data pelanggan.
Staf Administrasi — PT Gamma (2022–2024)
- Mengelola arsip dan laporan.`
check(
  'Kestabilan karier: magang singkat berulang TIDAK dihitung job hopping (penjaga positif-palsu)',
  checkOf(analyzeCv(MAGANG_HEAVY_CV), 'kestabilan-karier')?.score === 2,
  `skor ${checkOf(analyzeCv(MAGANG_HEAVY_CV), 'kestabilan-karier')?.score}/2`,
)
const FREELANCE_OVERLAP_CV = `Tono Lepas
tono.lepas@gmail.com | 0812-9999-4444

Pengalaman
Desainer Grafis — PT Kreatif (2021–2024)
- Membuat materi promosi.
Freelance Desainer (2022–2023)
- Mengerjakan proyek logo klien.`
check(
  'Kestabilan karier: freelance eksplisit yang tumpang tindih dengan pekerjaan utama TIDAK ditandai',
  checkOf(analyzeCv(FREELANCE_OVERLAP_CV), 'kestabilan-karier')?.score === 2,
  `skor ${checkOf(analyzeCv(FREELANCE_OVERLAP_CV), 'kestabilan-karier')?.score}/2`,
)
const PM_CV = `Rudi Manajer
rudi.manajer@gmail.com | 0812-9999-3333

Pengalaman
Project Manager — PT Alpha (2023)
- Memimpin proyek migrasi.
Project Manager — PT Beta (2023)
- Memimpin proyek aplikasi.
Project Manager — PT Gamma (2024)
- Memimpin proyek integrasi.`
check(
  'Kestabilan karier: jabatan "Project Manager" adalah peran formal (bukan entri proyek) — 3 peran singkatnya tetap tertandai',
  checkOf(analyzeCv(PM_CV), 'kestabilan-karier')?.score === 1,
  `skor ${checkOf(analyzeCv(PM_CV), 'kestabilan-karier')?.score}/2`,
)
check(
  'Kestabilan karier: kuat & menengah bersih (2/2); lemah tanpa entri bertanggal → 0',
  strongCheck('kestabilan-karier')?.score === 2 &&
    mediumCheck('kestabilan-karier')?.score === 2 &&
    weakCheck('kestabilan-karier')?.score === 0,
  `kuat ${strongCheck('kestabilan-karier')?.score}/2, menengah ${mediumCheck('kestabilan-karier')?.score}/2 (magangnya tidak dihitung), lemah ${weakCheck('kestabilan-karier')?.score}/2`,
)

// --- 4. Konsistensi klaim pengalaman ---
const CLAIM_CV = (ringkasan: string, entries: string) => `Klaim Nama
klaim.nama@gmail.com | 0812-8888-9999

Ringkasan
${ringkasan}

Pengalaman
${entries}

Pendidikan
SMA Negeri 1 Jakarta (2010 - 2013)`
const claimOver = analyzeCv(
  CLAIM_CV(
    'Staf administrasi dengan pengalaman 10 tahun di bidang perkantoran.',
    'Admin — PT C (2023–2024)\n- Mengelola arsip dokumen.',
  ),
)
check(
  'Konsistensi klaim: klaim 10 tahun vs linimasa ±1 tahun → 0, pesan menyebut klaim vs hitungan',
  checkOf(claimOver, 'konsistensi-klaim')?.score === 0 &&
    (checkOf(claimOver, 'konsistensi-klaim')?.message.includes('10 tahun') ?? false) &&
    (checkOf(claimOver, 'konsistensi-klaim')?.message.includes('sekitar 1 tahun') ?? false),
  `skor ${checkOf(claimOver, 'konsistensi-klaim')?.score}/2`,
)
check(
  'Konsistensi klaim: klaim sesuai linimasa lulus; klaim kata bilangan ("dua tahun") terbaca & lulus',
  checkOf(
    analyzeCv(CLAIM_CV('Staf administrasi dengan pengalaman 3 tahun.', 'Admin — PT C (2021–2024)\n- Mengelola arsip.')),
    'konsistensi-klaim',
  )?.score === 2 &&
    strongCheck('konsistensi-klaim')?.score === 2,
  `klaim 3 vs 3 tahun: ${checkOf(analyzeCv(CLAIM_CV('Staf administrasi dengan pengalaman 3 tahun.', 'Admin — PT C (2021–2024)\n- Mengelola arsip.')), 'konsistensi-klaim')?.score}/2; kuat (klaim "dua tahun" ≤ linimasa 4 tahun): ${strongCheck('konsistensi-klaim')?.score}/2`,
)
check(
  'Konsistensi klaim: tumpang tindih TIDAK dihitung ganda (klaim 7 vs gabungan 2020–2025 = 5 → tertandai)',
  checkOf(
    analyzeCv(
      CLAIM_CV(
        'Analis dengan pengalaman 7 tahun.',
        'Analis — PT A (2020–2023)\n- Menganalisis data.\nAnalis — PT B (2022–2025)\n- Menganalisis data.',
      ),
    ),
    'konsistensi-klaim',
  )?.score === 0,
  'durasi gabungan interval dipakai, bukan jumlah mentah per entri',
)
check(
  'Konsistensi klaim: klaim Inggris "5 years of experience" vs linimasa 0 tahun → 0; tanpa klaim → netral 2',
  checkOf(
    analyzeCv(CLAIM_CV('Data entry specialist with 5 years of experience.', 'Admin — PT C (2024)\n- Input data.')),
    'konsistensi-klaim',
  )?.score === 0 &&
    mediumCheck('konsistensi-klaim')?.score === 2,
  `klaim Inggris ${checkOf(analyzeCv(CLAIM_CV('Data entry specialist with 5 years of experience.', 'Admin — PT C (2024)\n- Input data.')), 'konsistensi-klaim')?.score}/2, menengah (tanpa klaim) ${mediumCheck('konsistensi-klaim')?.score}/2`,
)

// --- 5. Nama file CV ---
check(
  'Nama file: nama wajar lulus penuh (CV_Budi_Santoso.pdf & BudiSantoso_DataAnalyst.pdf)',
  checkOf(analyzeCv(SAMPLE_CV, { fileName: 'CV_Budi_Santoso.pdf' }), 'nama-file')?.score === 2 &&
    checkOf(analyzeCv(SAMPLE_CV, { fileName: 'BudiSantoso_DataAnalyst.pdf' }), 'nama-file')?.score === 2,
  `CV_Budi_Santoso ${checkOf(analyzeCv(SAMPLE_CV, { fileName: 'CV_Budi_Santoso.pdf' }), 'nama-file')?.score}/2, BudiSantoso_DataAnalyst ${checkOf(analyzeCv(SAMPLE_CV, { fileName: 'BudiSantoso_DataAnalyst.pdf' }), 'nama-file')?.score}/2`,
)
check(
  'Nama file: generik/asal unduh tertandai 0 (document(1), untitled, CV final bangettt, scan_2024, CV saja)',
  checkOf(analyzeCv(SAMPLE_CV, { fileName: 'document(1).pdf' }), 'nama-file')?.score === 0 &&
    checkOf(analyzeCv(SAMPLE_CV, { fileName: 'untitled.pdf' }), 'nama-file')?.score === 0 &&
    checkOf(analyzeCv(SAMPLE_CV, { fileName: 'CV final bangettt.pdf' }), 'nama-file')?.score === 0 &&
    checkOf(analyzeCv(SAMPLE_CV, { fileName: 'scan_2024.pdf' }), 'nama-file')?.score === 0 &&
    checkOf(analyzeCv(SAMPLE_CV, { fileName: 'CV.pdf' }), 'nama-file')?.score === 0,
  'semua pola nama generik tertandai',
)
check(
  'Nama file: ada nama tetapi sisa penanda draf (CV_Budi_final) → 1; teks tempel tanpa nama file → netral 2',
  checkOf(analyzeCv(SAMPLE_CV, { fileName: 'CV_Budi_final.pdf' }), 'nama-file')?.score === 1 &&
    strongCheck('nama-file')?.score === 2 &&
    (strongCheck('nama-file')?.message.includes('netral') ?? false),
  `CV_Budi_final ${checkOf(analyzeCv(SAMPLE_CV, { fileName: 'CV_Budi_final.pdf' }), 'nama-file')?.score}/2, tanpa file ${strongCheck('nama-file')?.score}/2`,
)

// ---------- Kamus bahasa Inggris (persetujuan pengguna 2026-11-25) ----------
// CV berbahasa Inggris dinilai dengan kamus yang setara: kata kerja
// aksi Inggris diperluas, klise Inggris masuk WEAK_PHRASES, salah eja
// Inggris masuk TYPO_WORDS, dan kata ganti "I" berlebihan dinilai
// dengan tiga penjaga anti-positif-palsu. Patokan Indonesia di atas
// sudah terkunci TIDAK bergerak oleh penambahan ini.

const EN_STRONG_CV = `Sarah Wijaya
sarah.wijaya@gmail.com | 0812-3456-7890 | linkedin.com/in/sarahwijaya | github.com/sarahwijaya
Jakarta, Indonesia

Summary
Data analyst with 4 years of experience turning raw operational data into dashboards and decisions for retail and logistics teams. Known for careful validation, clear documentation, and close collaboration with business users across Jakarta and Surabaya offices.

Experience
Data Analyst — PT Nusantara Retail (2022 - Present)
- Built automated sales dashboards in Power BI used by 40 store managers across the region.
- Increased reporting accuracy by 30% by redesigning the data validation pipeline in SQL.
- Delivered a customer churn model that reduced churn by 12% within two quarters.
- Coordinated with the finance team to streamline monthly closing reports, cutting preparation time by 25%.
- Trained 15 new analysts on the internal analytics toolkit and documentation standards.

Junior Data Analyst — PT Logistik Cepat (2020 - 2022)
- Implemented data cleaning scripts in Python that processed 50,000 records per day.
- Produced weekly performance reports for the operations team and presented findings to managers.
- Resolved data discrepancies between warehouse and finance systems through systematic audits.
- Optimized SQL queries that supported the main tracking dashboard, improving load time by 40%.

Education
Bachelor of Statistics — Universitas Indonesia (2016 - 2020)
GPA: 3.85/4.00

Skills
SQL, Python, Power BI, Tableau, Microsoft Excel, Data Modeling, Statistics

Languages
Indonesian (Native), English (Fluent)`

const enStrong = analyzeCv(EN_STRONG_CV)
check(
  'Inggris: CV kuat berbahasa Inggris memperoleh skor tinggi yang wajar',
  enStrong.total >= 85 && enStrong.total <= 98,
  `skor ${enStrong.total}/100 (${enStrong.label})`,
)
check(
  'Inggris: kata kerja aksi Inggris (termasuk delivered/coordinated/implemented/optimized) terhitung penuh',
  checkOf(enStrong, 'kata-kerja-aksi')?.score === 5 &&
    (checkOf(enStrong, 'kata-kerja-aksi')?.message.includes('12 kata kerja aksi berbeda') ?? false),
  `skor ${checkOf(enStrong, 'kata-kerja-aksi')?.score}/5; pesan: ${checkOf(enStrong, 'kata-kerja-aksi')?.message.slice(0, 60)}…`,
)
check(
  'Inggris: CV kuat bersih dari klise & salah eja Inggris (frasa 2/2, kerapian 2/2)',
  checkOf(enStrong, 'frasa-lemah')?.score === 2 && checkOf(enStrong, 'kerapian-bahasa')?.score === 2,
  `frasa ${checkOf(enStrong, 'frasa-lemah')?.score}/2, kerapian ${checkOf(enStrong, 'kerapian-bahasa')?.score}/2`,
)

const EN_CLICHE_CV = `John Doe
john.doe@gmail.com | 0813-1111-2222

Summary
I am a hard worker and a team player. I am a fast learner, self-motivated and detail-oriented. I can work under pressure and I am willing to be placed anywhere.

Experience
Administrative Staff — PT Maju Bersama (2021 - 2023)
- Responsible for data entry and filing documents.
- Responsible for preparing monthly reports for the manager.
- Handled incoming phone calls and emails from customers.

Education
Senior High School — SMA Negeri 2 Bandung (2018 - 2021)

Skills
Microsoft Word, Microsoft Excel, Typing`

const enCliche = analyzeCv(EN_CLICHE_CV)
check(
  'Inggris: CV sarat klise Inggris kehilangan poin frasa lemah (0/2, frasa disebut)',
  checkOf(enCliche, 'frasa-lemah')?.score === 0 &&
    (checkOf(enCliche, 'frasa-lemah')?.message.includes('"responsible for"') ?? false) &&
    (checkOf(enCliche, 'frasa-lemah')?.message.includes('"team player"') ?? false) &&
    (checkOf(enCliche, 'frasa-lemah')?.message.includes('"hard worker"') ?? false),
  `skor ${checkOf(enCliche, 'frasa-lemah')?.score}/2; pesan: ${checkOf(enCliche, 'frasa-lemah')?.message.slice(0, 130)}…`,
)

check(
  'Inggris: salah eja Inggris terdeteksi findTypos dengan koreksi yang benar',
  (() => {
    const found = findTypos('recieve managment experince seperate goverment')
    const byWrong = new Map(found.map((t) => [t.wrong, t.right]))
    return (
      byWrong.get('recieve') === 'receive' &&
      byWrong.get('managment') === 'management' &&
      byWrong.get('experince') === 'experience' &&
      byWrong.get('seperate') === 'separate' &&
      byWrong.get('goverment') === 'government'
    )
  })(),
  'recieve/managment/experince/seperate/goverment tertandai dengan baku yang benar',
)

const EN_TYPO_CV = `Jane Smith
jane.smith@gmail.com | 0813-2222-3333

Summary
Administrative staff with three years of office experience in Jakarta, supporting daily operations and document control for the management team and other departments in the company office environment.

Experience
Administrative Staff — PT Bina Karya (2021 - 2024)
- Recieve and record incoming documents from clients every day.
- Prepared reports for the managment team each week.
- Used my experince to train new staff members on office procedures.

Education
Diploma in Office Administration — Politeknik Negeri Jakarta (2018 - 2021)

Skills
Microsoft Word, Microsoft Excel, Filing, Data Entry`

check(
  'Inggris: salah eja Inggris mengurangi kerapian bahasa (1/2, kata disebut)',
  checkOf(analyzeCv(EN_TYPO_CV), 'kerapian-bahasa')?.score === 1 &&
    (checkOf(analyzeCv(EN_TYPO_CV), 'kerapian-bahasa')?.message.includes('"recieve"') ?? false) &&
    (checkOf(analyzeCv(EN_TYPO_CV), 'kerapian-bahasa')?.message.includes('"managment"') ?? false),
  `skor ${checkOf(analyzeCv(EN_TYPO_CV), 'kerapian-bahasa')?.score}/2; pesan: ${checkOf(analyzeCv(EN_TYPO_CV), 'kerapian-bahasa')?.message.slice(0, 120)}…`,
)

check(
  'Penjaga tabrakan: kata "teh" yang sah dalam kalimat Indonesia TIDAK tertandai salah eja',
  findTypos(
    'setiap pagi saya menyajikan teh manis dan kopi untuk tamu kantor, lalu mencatat kebutuhan dapur dan menyusun laporan harian',
  ).length === 0,
  'kalimat berisi "teh" sebagai minuman menghasilkan 0 temuan typo',
)

const ID_ROMAN_CV = `Rina Amelia
rina.amelia@gmail.com | 0812-7777-8888

Ringkasan
Staf administrasi berpengalaman dengan rekam jejak lomba dan pelatihan yang konsisten selama bekerja di kantor layanan publik daerah.

Pengalaman
Staf Administrasi — Dinas Pendidikan Kota Bandung (2019 - 2024)
- Meraih Juara I lomba administrasi perkantoran tingkat kota pada tahun pertama bekerja.
- Mengikuti pelatihan Tahap I dan Tahap II untuk peningkatan kompetensi staf.
- Menyelesaikan pendidikan Semester I program pelatihan dengan nilai terbaik di kelas.
- Mendapat Peringkat I pada seleksi staf teladan kantor tahun 2022.
- Mengelola arsip dokumen dan melayani tamu yang datang ke kantor setiap hari.

Pendidikan
SMA Negeri 5 Bandung (2016 - 2019)

Keahlian
Microsoft Word, Microsoft Excel, Arsip, Pelayanan`

check(
  'Penjaga "I": CV Indonesia dengan angka Romawi "I" berulang TIDAK dihukum (bukan teks dominan Inggris)',
  !isDominantEnglish(ID_ROMAN_CV) &&
    findFirstPersonIOccurrences(ID_ROMAN_CV).length === 0 &&
    checkOf(analyzeCv(ID_ROMAN_CV), 'kerapian-bahasa')?.score === 2,
  `dominan Inggris: ${isDominantEnglish(ID_ROMAN_CV)}, kemunculan "I" terhitung: ${findFirstPersonIOccurrences(ID_ROMAN_CV).length}, kerapian ${checkOf(analyzeCv(ID_ROMAN_CV), 'kerapian-bahasa')?.score}/2`,
)

const EN_ROMAN_CV = `Michael Chen
michael.chen@gmail.com | 0812-9999-0000

Summary
Training coordinator with experience designing multi-phase programs for the operations team at a logistics company, working with mentors and participants across the region.

Experience
Training Coordinator — PT Global Logistik (2020 - 2024)
- Coordinated Phase I orientation for new staff members in the Jakarta office.
- Designed Part I training modules for the warehouse team and the drivers.
- Delivered Level I certification sessions for supervisors across the company.
- Prepared Semester I coursework for the internal academy program in 2021.

Education
Bachelor of Education — Universitas Negeri Jakarta (2015 - 2019)

Skills
Training Design, Facilitation, Microsoft PowerPoint, Public Speaking`

check(
  'Penjaga "I": CV Inggris dengan angka Romawi "I" (Phase I, Part I, Level I, Semester I) TIDAK terhitung sebagai kata ganti',
  isDominantEnglish(EN_ROMAN_CV) &&
    findFirstPersonIOccurrences(EN_ROMAN_CV).length === 0 &&
    checkOf(analyzeCv(EN_ROMAN_CV), 'kerapian-bahasa')?.score === 2,
  `dominan Inggris: ${isDominantEnglish(EN_ROMAN_CV)}, kemunculan "I" terhitung: ${findFirstPersonIOccurrences(EN_ROMAN_CV).length}, kerapian ${checkOf(analyzeCv(EN_ROMAN_CV), 'kerapian-bahasa')?.score}/2`,
)

const EN_I_OVERUSE_CV = `David Lee
david.lee@gmail.com | 0813-4444-5555

Summary
Sales executive with five years of experience in retail distribution, covering modern trade accounts across Java with a focus on the beverage category and key account management for the company.

Experience
Sales Executive — PT Sumber Minuman (2019 - 2024)
- I managed a portfolio of 25 retail accounts in the Jakarta area.
- I increased sales by 20% in my second year with the company.
- I built strong relationships with store owners and distributors.
- I created monthly sales reports for the regional manager.
- I trained new sales representatives on the ordering system.

Education
Bachelor of Management — Universitas Bina Nusantara (2014 - 2018)

Skills
Sales, Negotiation, Microsoft Excel, Distribution`

check(
  'Inggris: kata ganti "I" berlebihan (5× "I + kata kerja") mengurangi kerapian (1/2, jumlah disebut)',
  isDominantEnglish(EN_I_OVERUSE_CV) &&
    findFirstPersonIOccurrences(EN_I_OVERUSE_CV).length === 5 &&
    checkOf(analyzeCv(EN_I_OVERUSE_CV), 'kerapian-bahasa')?.score === 1 &&
    (checkOf(analyzeCv(EN_I_OVERUSE_CV), 'kerapian-bahasa')?.message.includes('"I" muncul 5 kali') ?? false),
  `kemunculan terhitung: ${findFirstPersonIOccurrences(EN_I_OVERUSE_CV).length}, kerapian ${checkOf(analyzeCv(EN_I_OVERUSE_CV), 'kerapian-bahasa')?.score}/2`,
)
check(
  'Inggris: deteksi bahasa dominan tidak menyala untuk CV Indonesia (contoh bawaan & lemah)',
  !isDominantEnglish(SAMPLE_CV) && !isDominantEnglish(WEAK_CV) && isDominantEnglish(EN_STRONG_CV),
  `kuat ID: ${isDominantEnglish(SAMPLE_CV)}, lemah ID: ${isDominantEnglish(WEAK_CV)}, kuat EN: ${isDominantEnglish(EN_STRONG_CV)}`,
)

// ---------- Satuan & format Inggris pada hasil terukur (2026-11-25) ----------
// Penghitung hasil terukur kini juga mengenali satuan Inggris (users,
// records, downloads, ...), angka ribuan koma (50,000 / 1,200,000),
// nominal $/USD, notasi K (50K users, $10K), dan pengganda Nx — sejajar
// perlakuan satuan Indonesia & Rp yang sudah ada, TANPA mengubah ambang
// pemeriksaan (≥3 tetap penuh) dan tanpa mengubah hitungan teks
// Indonesia. Patokan Indonesia di atas sudah terkunci TIDAK bergerak.

const EN_MEASURABLE_CV = `David Chen
david.chen@gmail.com | 0813-4444-5555 | linkedin.com/in/davidchen
Jakarta, Indonesia

Summary
Operations specialist with broad experience in data processing, user support, and community program administration for growing companies in Indonesia.

Experience
Operations Specialist — PT Data Karya (2021 - Present)
- Processed 50,000 records per day for the operations team.
- Supported 15 users across two office branches.
- Managed an annual community budget of $20,000 with full accountability.
- Grew the help-center channel to 50K downloads in the first year.

Education
Bachelor of Information Systems — Universitas Gadjah Mada (2015 - 2019)

Skills
Data Entry, Microsoft Excel, SQL, Customer Support`

const enMeasurable = analyzeCv(EN_MEASURABLE_CV)
check(
  'Inggris: satuan & format Inggris terhitung sebagai hasil terukur (50,000 records; 15 users; $20,000; 50K downloads = 4)',
  checkOf(enMeasurable, 'hasil-terukur')?.score === 5 &&
    (checkOf(enMeasurable, 'hasil-terukur')?.message.includes('Ditemukan 4 angka pencapaian') ?? false),
  `skor ${checkOf(enMeasurable, 'hasil-terukur')?.score}/5; pesan: ${checkOf(enMeasurable, 'hasil-terukur')?.message.slice(0, 60)}…`,
)

const EN_MULTIPLIER_CV = `Tom Reed
tom.reed@gmail.com | 0813-7777-8888

Summary
Growth staff with experience in reseller partnerships and onboarding improvements for digital products in Indonesia.

Experience
Growth Staff — PT Tumbuh Bersama (2022 - Present)
- Grew revenue 3x year over year through reseller partnerships.
- Improved activation 2x within one quarter after onboarding changes.

Education
Bachelor of Business — Universitas Padjadjaran (2016 - 2020)

Skills
Marketing, Partnerships, Microsoft Excel`

check(
  'Inggris: pengganda Nx terhitung sebagai hasil terukur (3x & 2x = 2)',
  checkOf(analyzeCv(EN_MULTIPLIER_CV), 'hasil-terukur')?.score === 3 &&
    (checkOf(analyzeCv(EN_MULTIPLIER_CV), 'hasil-terukur')?.message.includes('Ditemukan 2 angka pencapaian') ?? false),
  `skor ${checkOf(analyzeCv(EN_MULTIPLIER_CV), 'hasil-terukur')?.score}/5; pesan: ${checkOf(analyzeCv(EN_MULTIPLIER_CV), 'hasil-terukur')?.message.slice(0, 60)}…`,
)

const EN_GUARD_CV = `Anna Cole
anna.cole@gmail.com | 0813-8888-9999

Summary
Administrative assistant with experience in document filing, front desk support, and archive work for offices in Jakarta.

Experience
Admin Assistant — PT Arsip (2019 - 2021)
- Filed documents for the class of 2020 students archive project.
- Used version 2.0 of the internal filing application every day.
- Prepared 3x4 ID photos for new employee files.
- Updated the 24x7 service desk documentation binder.

Education
Senior High School — SMA Negeri 5 Jakarta (2016 - 2019)

Skills
Filing, Microsoft Word, Microsoft Excel`

check(
  'Penjaga Inggris: tahun polos (2020 students), nomor versi (2.0), pas foto 3x4, dan 24x7 TIDAK terhitung hasil terukur',
  checkOf(analyzeCv(EN_GUARD_CV), 'hasil-terukur')?.score === 0 &&
    (checkOf(analyzeCv(EN_GUARD_CV), 'hasil-terukur')?.message.includes('Ditemukan 0 angka pencapaian') ?? false),
  `skor ${checkOf(analyzeCv(EN_GUARD_CV), 'hasil-terukur')?.score}/5; pesan: ${checkOf(analyzeCv(EN_GUARD_CV), 'hasil-terukur')?.message.slice(0, 60)}…`,
)

const ID_FORMAT_GUARD_CV = `Bambang Sutrisno
bambang.s@gmail.com | 0812-1212-3434

Ringkasan
Staf penjualan berpengalaman melayani pelanggan ritel dan mengelola anggaran promosi toko.

Pengalaman
Staf Penjualan — PT Ritel Jaya (2022 - 2024)
- Melayani 50,5 ribu pelanggan dan mengelola anggaran Rp 2.500.000 untuk 15 orang.

Pendidikan
SMA Negeri 3 Semarang (2016 - 2019)

Keahlian
Penjualan, Microsoft Excel, Kasir`

check(
  'Penjaga Indonesia: hitungan format khas Indonesia TIDAK berubah (50,5 ribu + 15 orang = 2; Rp titik-ribuan seperti perilaku lama)',
  checkOf(analyzeCv(ID_FORMAT_GUARD_CV), 'hasil-terukur')?.score === 3 &&
    (checkOf(analyzeCv(ID_FORMAT_GUARD_CV), 'hasil-terukur')?.message.includes('Ditemukan 2 angka pencapaian') ?? false),
  `skor ${checkOf(analyzeCv(ID_FORMAT_GUARD_CV), 'hasil-terukur')?.score}/5; pesan: ${checkOf(analyzeCv(ID_FORMAT_GUARD_CV), 'hasil-terukur')?.message.slice(0, 60)}…`,
)

const EN_PERSONAL_MEAS_CV = `Lisa Park
lisa.park@gmail.com | 0813-6666-7777

Summary
Data entry specialist with experience in high-volume document processing and archive management for logistics companies in Jakarta and Bekasi.

Experience
Data Entry Specialist — PT Arsip Data (2022 - Present)
- Processed 50,000 records per day for the logistics documentation team.
- Verified document completeness before forwarding files to the archive team.

Archive Assistant — PT Simpan Karya (2020 - 2022)
- Filed incoming documents into the company archive system.
- Helped coworkers locate archived files whenever they requested them.

Education
Bachelor of Library Science — Universitas Indonesia (2016 - 2020)

Skills
Data Entry, Microsoft Excel, Archive Management`

const enPersonalEntries = getExperienceEntryDetails(EN_PERSONAL_MEAS_CV)
const enPersonalMeas = buildPersonalExamples(
  analyzeCv(EN_PERSONAL_MEAS_CV),
  EN_PERSONAL_MEAS_CV,
  '',
)['hasil-terukur']
check(
  'Inggris: contoh personal hasil-terukur memakai penemu yang sama (entri berangka Inggris terhitung; contoh mengutip entri tanpa angka)',
  enPersonalEntries[0]?.measurableCount === 1 &&
    enPersonalEntries[1]?.measurableCount === 0 &&
    !!enPersonalMeas &&
    enPersonalMeas.kutipanAsli.includes('Filed incoming documents') &&
    !enPersonalMeas.kutipanAsli.includes('50,000'),
  `entri per entri: ${enPersonalEntries.map((e) => e.measurableCount).join(', ')}; kutipan: ${enPersonalMeas?.kutipanAsli ?? '(tidak ada)'}`,
)

// ---------- Combobox posisi: daftar pilihan turunan + pemfilteran ----------
// Pilihan berasal dari kamus skill (examples.ts) + glosarium
// (jobGlossary.ts); tidak boleh ada duplikat, harus terurut alfabetis,
// dan label fallback "Umum / Fresh Graduate" bukan posisi — tidak ikut.
{
  const keys = ROLE_OPTIONS.map((o) => o.value.toLowerCase())
  check(
    'Combobox: pilihan tanpa duplikat & terurut alfabetis',
    new Set(keys).size === keys.length &&
      keys.every((k, i) => i === 0 || keys[i - 1] < k),
    `${ROLE_OPTIONS.length} pilihan unik terurut`,
  )
  check(
    'Combobox: memuat peran kamus & nama lengkap glosarium, tanpa label fallback',
    ROLE_OPTIONS.some((o) => o.value === 'Data Analyst') &&
      ROLE_OPTIONS.some((o) => o.value === 'Quality Control') &&
      !ROLE_OPTIONS.some((o) => o.value.includes('Umum')),
    'Data Analyst & Quality Control ada; "Umum / Fresh Graduate" tidak ikut',
  )
  check(
    'Combobox: singkatan tergabung per nama (R&D + RND satu pilihan)',
    ROLE_OPTIONS.filter((o) => o.value === 'Research and Development').length === 1 &&
      ROLE_OPTIONS.find((o) => o.value === 'Research and Development')!.abbrs.length === 2,
    'satu entri "Research and Development" membawa dua singkatan',
  )
  check(
    'Combobox: ketik "qc" menemukan Quality Control lewat singkatan',
    filterRoleOptions('qc')[0]?.value === 'Quality Control',
    `hasil: ${filterRoleOptions('qc').map((o) => o.value).join(', ')}`,
  )
  check(
    'Combobox: ketik "spv" menemukan Supervisor lewat singkatan',
    filterRoleOptions('spv')[0]?.value === 'Supervisor',
    `hasil: ${filterRoleOptions('spv').map((o) => o.value).join(', ')}`,
  )
  check(
    'Combobox: ketik "rnd" menemukan Research and Development',
    filterRoleOptions('rnd')[0]?.value === 'Research and Development',
    `hasil: ${filterRoleOptions('rnd').map((o) => o.value).join(', ')}`,
  )
  check(
    'Combobox: ketik nama menemukan peran terkait, terurut',
    JSON.stringify(filterRoleOptions('quality').map((o) => o.value)) ===
      JSON.stringify(['Quality Assurance', 'Quality Control', 'Quality Engineer']),
    `hasil: ${filterRoleOptions('quality').map((o) => o.value).join(', ')}`,
  )
  check(
    'Combobox: "fullstack"/"full stack"/"full-stack" menemukan Full Stack Developer (regresi laporan 2026-11-25)',
    filterRoleOptions('fullstack')[0]?.value === 'Full Stack Developer' &&
      filterRoleOptions('full stack')[0]?.value === 'Full Stack Developer' &&
      filterRoleOptions('full-stack')[0]?.value === 'Full Stack Developer' &&
      filterRoleOptions('full')[0]?.value === 'Full Stack Developer' &&
      getRoleSkills('Full Stack Developer').id === 'full-stack' &&
      getRoleSkills('fullstack').id === 'full-stack',
    `fullstack: ${filterRoleOptions('fullstack').map((o) => o.value).join(', ')}`,
  )
  check(
    'Combobox: ketikan tanpa spasi menemukan peran multi-kata lain ("dataanalyst", "qualitycontrol")',
    filterRoleOptions('dataanalyst')[0]?.value === 'Data Analyst' &&
      filterRoleOptions('qualitycontrol')[0]?.value === 'Quality Control' &&
      filterRoleOptions('backenddeveloper')[0]?.value === 'Backend Developer',
    `dataanalyst: ${filterRoleOptions('dataanalyst').map((o) => o.value).join(', ')}`,
  )
  check(
    'Combobox: ketikan kosong mengembalikan semua pilihan; ketikan asing kosong',
    filterRoleOptions('').length === ROLE_OPTIONS.length &&
      filterRoleOptions('xyzqq-tidak-ada').length === 0,
    'kosong = daftar penuh (teks bebas tetap sah di luar daftar)',
  )
  check(
    'Peran Mobile Developer: variasi masukan terdeteksi ke peran mobile (persetujuan pengguna 2026-11-25)',
    getRoleSkills('Mobile Developer').id === 'mobile-developer' &&
      getRoleSkills('mobile').id === 'mobile-developer' &&
      getRoleSkills('Android').id === 'mobile-developer' &&
      getRoleSkills('iOS Developer').id === 'mobile-developer' &&
      getRoleSkills('React Native Developer').id === 'mobile-developer' &&
      getRoleSkills('Mobile Developer').label === 'Mobile Developer' &&
      getRoleSkills('Mobile Developer').skills.length === 10 &&
      getRoleSkills('Mobile Developer').skills.includes('Flutter & Dart') &&
      getRoleSkills('Mobile Developer').skills.includes('Kotlin'),
    `Mobile→${getRoleSkills('Mobile Developer').id}, Android→${getRoleSkills('Android Developer').id}, iOS→${getRoleSkills('iOS Developer').id}`,
  )
  check(
    'Combobox: "Mobile Developer" pilihan ke-100; "mobile"/"mobiledeveloper"/"android" menemukannya',
    ROLE_OPTIONS.length === 100 &&
      ROLE_OPTIONS.some((o) => o.value === 'Mobile Developer') &&
      filterRoleOptions('mobile')[0]?.value === 'Mobile Developer' &&
      filterRoleOptions('mobiledeveloper')[0]?.value === 'Mobile Developer' &&
      filterRoleOptions('android')[0]?.value === 'Mobile Developer',
    `jumlah: ${ROLE_OPTIONS.length}; android: ${filterRoleOptions('android').map((o) => o.value).join(', ')}`,
  )
}

if (failures > 0) {
  console.error(`\n${failures} uji GAGAL`)
  process.exit(1)
}
console.log('\nSemua uji lolos.')
