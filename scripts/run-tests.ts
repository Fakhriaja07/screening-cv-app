// Uji logika penilaian: 3 CV (kuat/menengah/lemah) + deteksi HP.
// Jalankan: npx tsx scripts/run-tests.ts
import {
  analyzeCv,
  countWords,
  detectPhone,
  findPortfolio,
  getRoleWords,
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
import {
  buildReportText,
  formatReportDate,
  reportFileName,
} from '../src/lib/report'
import { buildPersonalExamples } from '../src/lib/personalExamples'
import { buildReportPdf, buildReportPdfBytes } from '../src/lib/pdf'
import type { AiAnalysis } from '../src/lib/ai'
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
  'Standar aspek 2026-11-21: skor patokan tanpa lowongan terkunci 96/61/16',
  strong.total === 96 && medium.total === 61 && weak.total === 16,
  `kuat ${strong.total}, menengah ${medium.total}, lemah ${weak.total} (harus 96/61/16; menengah naik dari 58 karena linimasa magangnya bersih 3/3 dan aturan netral proyek +2, dikurangi heading 6→5 dan kedalaman 5→4)`,
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
    strongCheck('kedalaman-entri')?.score === 4 &&
    strongCheck('frasa-lemah')?.score === 3 &&
    strongCheck('konsistensi-format')?.score === 3 &&
    strongCheck('kerapian-bahasa')?.score === 2 &&
    strongCheck('hasil-terukur')?.score === 6 &&
    strongCheck('kata-kerja-aksi')?.score === 5 &&
    strongCheck('lokasi')?.score === 1 &&
    strongCheck('portofolio')?.score === 2 &&
    strongCheck('linimasa')?.score === 3 &&
    strongCheck('proyek')?.score === 2,
  `kuat: sertifikasi ${strongCheck('sertifikasi')?.score}/3, bahasa ${strongCheck('bahasa')?.score}/2, kedalaman ${strongCheck('kedalaman-entri')?.score}/4, frasa ${strongCheck('frasa-lemah')?.score}/3, konsistensi ${strongCheck('konsistensi-format')?.score}/3, kerapian ${strongCheck('kerapian-bahasa')?.score}/2, lokasi ${strongCheck('lokasi')?.score}/1, linimasa ${strongCheck('linimasa')?.score}/3, proyek ${strongCheck('proyek')?.score}/2`,
)

check(
  'Standar aspek: jumlah pemeriksaan 23 (25 bila posisi target diisi)',
  strong.aspects.flatMap((a) => a.checks).length === 23 &&
    analyzeCv(SAMPLE_CV, { targetRole: 'Data Analyst' }).aspects.flatMap((a) => a.checks).length === 25,
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
  `skor ${checkOf(cliche, 'frasa-lemah')?.score}/3; pesan: ${checkOf(cliche, 'frasa-lemah')?.message.slice(0, 110)}…`,
)
check(
  'Aspek baru: tanpa frasa klise → poin penuh (positif)',
  mediumCheck('frasa-lemah')?.score === 3 && weakCheck('frasa-lemah')?.score === 0,
  `menengah ${mediumCheck('frasa-lemah')?.score}/3 (tanpa klise), lemah ${weakCheck('frasa-lemah')?.score}/3 (tanpa bagian ringkasan/pengalaman → tidak diberi poin cuma-cuma)`,
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
    mediumCheck('kedalaman-entri')?.score === 4,
  `campuran ${checkOf(analyzeCv(HALF_DEEP_CV), 'kedalaman-entri')?.score}/4, menengah (1 entri lengkap) ${mediumCheck('kedalaman-entri')?.score}/4`,
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
    getRoleSkills('IT').id === 'it-support' &&
    getRoleSkills('ADM').id === 'administrasi' &&
    getRoleSkills('BE').id === 'developer',
  `HRD→"${getRoleSkills('HRD').label}", SPV→"${getRoleSkills('SPV').label}", IT→${getRoleSkills('IT').id}, ADM→${getRoleSkills('ADM').id}`,
)

check(
  'Glosarium: kata pengisi peran tidak menempel pada judul hasil perluasan (bug "IT Support staff")',
  expandJobTitle('it staff') === 'IT Support' &&
    expandJobTitle('staff it') === 'IT Support' &&
    expandJobTitle('staf IT') === 'IT Support' &&
    expandJobTitle('IT Staff') === 'IT Support' &&
    expandJobTitle('qc staff') === 'Quality Control' &&
    expandJobTitle('staff qc') === 'Quality Control' &&
    expandJobTitle('Staff QC') === 'Quality Control' &&
    getRoleSkills('it staff').label === 'IT Support' &&
    getRoleSkills('it staff').id === 'it-support' &&
    getRoleSkills('it staff').skills === getRoleSkills('IT').skills &&
    getRoleSkills('staff qc').label === 'Quality Control' &&
    getRoleSkills('qc staff').label === 'Quality Control',
  `it staff→"${expandJobTitle('it staff')}", staff qc→"${expandJobTitle('staff qc')}", label kartu it staff→"${getRoleSkills('it staff').label}"`,
)

check(
  'Glosarium: kata sisa bermuatan dipertahankan & di-title-case ("SPV Produksi", "QC Inspector")',
  expandJobTitle('SPV Produksi') === 'Supervisor Produksi' &&
    expandJobTitle('spv produksi') === 'Supervisor Produksi' &&
    expandJobTitle('QC Inspector') === 'Quality Control Inspector' &&
    expandJobTitle('qc inspector') === 'Quality Control Inspector' &&
    JSON.stringify(getRoleWords('it staff')) === JSON.stringify(['support']) &&
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
  mediumJobMatch.total === 60 &&
    mediumJobMismatch.total === 48 &&
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
  saranPenulisanUlang: [
    {
      asli: 'Membuat laporan penjualan',
      saran: 'Menyusun laporan penjualan mingguan untuk 3 cabang dengan Excel',
      alasan: 'Tambahkan frekuensi dan alat yang dipakai.',
    },
  ],
  kekurangan: ['Belum ada sertifikasi pendukung.'],
  saranRingkasan: 'Data analyst pemula yang terbiasa mengolah data penjualan.',
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
  'Penghapusan penanda: patokan skor persis tidak berubah (96/61/16, fresh graduate 53)',
  strong.total === 96 && medium.total === 61 && weak.total === 16 && fresh.total === 53,
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

if (failures > 0) {
  console.error(`\n${failures} uji GAGAL`)
  process.exit(1)
}
console.log('\nSemua uji lolos.')
