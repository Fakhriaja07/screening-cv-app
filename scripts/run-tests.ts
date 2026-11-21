// Uji logika penilaian: 3 CV (kuat/menengah/lemah) + deteksi HP.
// Jalankan: npx tsx scripts/run-tests.ts
import {
  SAYA_OVERUSE_THRESHOLD,
  TYPO_WORDS,
  WEAK_PHRASES,
  analyzeCv,
  detectPhone,
  findPortfolio,
  findSayaOccurrences,
  findTypoOccurrences,
  findWeakPhraseOccurrences,
  getExperienceEntrySpans,
} from '../src/lib/analyze'
import {
  buildAiMarks,
  buildMarks,
  buildSegments,
  buildStandardMarks,
  findAiQuoteRange,
} from '../src/lib/marks'
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
import { readFileSync } from 'node:fs'
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
import {
  buildReportPdf,
  buildReportPdfBytes,
} from '../src/lib/pdf'
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

// ---------- Uji penanda teks CV (2026-11-21) ----------
// Prinsip yang diuji: tanda berasal dari bukti yang SAMA dengan penilaian
// (kamus/parser/ambang bersama di analyze.ts), offset-nya persis, dan
// patokan skor tidak berubah oleh penambahan fitur ini.
check(
  'Penanda: patokan skor persis tidak berubah (96/61/16, fresh graduate 53)',
  strong.total === 96 && medium.total === 61 && weak.total === 16 && fresh.total === 53,
  `kuat ${strong.total}, menengah ${medium.total}, lemah ${weak.total}, fresh ${fresh.total}`,
)

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
const markedCheck = (id: string) =>
  markedResult.aspects.flatMap((a) => a.checks).find((c) => c.id === id)
const stdMarks = buildStandardMarks(MARKED_CV)

// Frasa lemah: offset persis menunjuk frasa inti kamus bersama, dan
// jumlahnya sama dengan bukti pemeriksaan frasa-lemah (skor 0/3).
const weakMarks = stdMarks.filter((m) => m.kind === 'frasa-lemah')
const weakOccurrences = findWeakPhraseOccurrences(MARKED_CV)
check(
  'Penanda: frasa lemah ditemukan dengan offset yang benar',
  weakMarks.length === 3 &&
    weakOccurrences.length === 3 &&
    weakMarks.every((m) =>
      WEAK_PHRASES.some((p) => p.core === MARKED_CV.slice(m.start, m.end).toLowerCase()),
    ) &&
    markedCheck('frasa-lemah')?.score === 0,
  `${weakMarks.length} tanda frasa; teks pada rentang: ${weakMarks
    .map((m) => `"${MARKED_CV.slice(m.start, m.end)}"`)
    .join(', ')}; skor frasa-lemah ${markedCheck('frasa-lemah')?.score}/3`,
)

// Salah eja: offset persis menunjuk kata tidak baku kamus bersama,
// lengkap dengan bentuk bakunya.
const typoMarks = stdMarks.filter((m) => m.kind === 'salah-eja')
check(
  'Penanda: salah eja ditemukan dengan offset yang benar + bentuk baku',
  typoMarks.length === 2 &&
    findTypoOccurrences(MARKED_CV).length === 2 &&
    typoMarks.every((m) =>
      TYPO_WORDS.some(
        (t) =>
          t.wrong === MARKED_CV.slice(m.start, m.end).toLowerCase() &&
          t.right === m.correction,
      ),
    ) &&
    typoMarks.some((m) => m.correction === 'aktivitas') &&
    typoMarks.some((m) => m.correction === 'mengubah'),
  `${typoMarks.length} tanda salah eja: ${typoMarks
    .map((m) => `"${MARKED_CV.slice(m.start, m.end)}"→"${m.correction}"`)
    .join(', ')}`,
)

// Kata "saya": hanya kemunculan di bagian pengalaman yang dihitung
// (kata "Saya" di ringkasan tidak ikut), dan ditandai hanya karena
// jumlahnya mencapai ambang berlebihan yang sama dengan pemeriksaan.
const sayaMarks = stdMarks.filter((m) => m.kind === 'saya')
check(
  'Penanda: kata "saya" ditandai hanya saat berlebihan (ambang bersama)',
  findSayaOccurrences(MARKED_CV).length === 4 &&
    findSayaOccurrences(MARKED_CV).length >= SAYA_OVERUSE_THRESHOLD &&
    sayaMarks.length === 4 &&
    sayaMarks.every((m) => MARKED_CV.slice(m.start, m.end).toLowerCase() === 'saya') &&
    markedCheck('kerapian-bahasa')?.score === 0,
  `${sayaMarks.length} tanda "saya" dari ${findSayaOccurrences(MARKED_CV).length} kemunculan di bagian pengalaman; skor kerapian ${markedCheck('kerapian-bahasa')?.score}/2`,
)
const FEW_SAYA_CV = `Pengalaman
Kasir — Toko Berkah (2023–2024)
- Saya melayani pembeli setiap hari.
- Saya menutup kasir setiap malam.`
check(
  'Penanda: kata "saya" wajar (di bawah ambang) tidak ditandai',
  findSayaOccurrences(FEW_SAYA_CV).length === 2 &&
    buildStandardMarks(FEW_SAYA_CV).filter((m) => m.kind === 'saya').length === 0,
  `2 kemunculan < ambang ${SAYA_OVERUSE_THRESHOLD} → 0 tanda`,
)

// Penanda baris entri: entri tanpa angka hasil ditandai di awal baris
// judulnya; entri berangka (30%, 15 orang) tidak ditandai. Entri yang
// sama yang diurai parser penilaian (getExperienceEntrySpans).
const entrySpans = getExperienceEntrySpans(MARKED_CV)
const entryMarks = stdMarks.filter((m) => m.kind === 'entri')
check(
  'Penanda: entri pengalaman tanpa hasil terukur ditandai di awal barisnya',
  entrySpans.length === 2 &&
    entrySpans[0].hasMeasurableResult === false &&
    entrySpans[1].hasMeasurableResult === true &&
    entryMarks.length === 1 &&
    entryMarks[0].start === entrySpans[0].start &&
    entryMarks[0].start === entryMarks[0].end &&
    MARKED_CV.startsWith('Kasir — Toko Berkah', entryMarks[0].start) &&
    MARKED_CV[entryMarks[0].start - 1] === '\n',
  `penanda di offset ${entryMarks[0]?.start} (awal baris "${entrySpans[0]?.text.split('\n')[0]}"); entri berangka tidak ditandai`,
)

// Tanda AI: kutipan persis ketemu, kutipan beda huruf/spasi ketemu lewat
// pencocokan ternormalisasi, kutipan yang tidak ada dilewati diam-diam.
const MARKED_AI: AiAnalysis = {
  ringkasan: 'Ringkasan uji.',
  saranPenulisanUlang: [
    {
      asli: 'Saya melayani pembeli setiap hari di kasir.',
      saran: 'Melayani [50+] pembeli per hari di kasir.',
      alasan: 'Awali dengan kata kerja dan tambahkan angka.',
    },
    {
      asli: 'saya   MENGECEK uang kas setiap malam',
      saran: 'Mengecek dan mencocokkan uang kas setiap malam.',
      alasan: 'Lebih spesifik.',
    },
    {
      asli: 'Kalimat ini tidak ada di CV sama sekali.',
      saran: 'Tidak dipakai.',
      alasan: 'Tidak dipakai.',
    },
  ],
  kekurangan: [],
  saranRingkasan: '',
}
const aiMarks = buildAiMarks(MARKED_CV, MARKED_AI)
check(
  'Penanda AI: persis + ternormalisasi ketemu, tidak ditemukan dilewati',
  aiMarks.length === 2 &&
    aiMarks[0].aiIndex === 0 &&
    MARKED_CV.slice(aiMarks[0].start, aiMarks[0].end) ===
      'Saya melayani pembeli setiap hari di kasir.' &&
    aiMarks[1].aiIndex === 1 &&
    MARKED_CV.slice(aiMarks[1].start, aiMarks[1].end) ===
      'Saya mengecek uang kas setiap malam' &&
    findAiQuoteRange(MARKED_CV, 'Kalimat ini tidak ada di CV sama sekali.') === null &&
    findAiQuoteRange(MARKED_CV, '   ') === null,
  `${aiMarks.length} dari 3 kutipan tertandai (1 memang tidak ada di CV)`,
)

// Resolusi tumpang tindih: sorotan AI menang atas tanda "saya" di
// dalamnya; tidak ada dua sorotan rentang yang tumpang tindih.
const allMarks = buildMarks(MARKED_CV, MARKED_AI)
const rangeMarks = allMarks
  .filter((m) => m.end > m.start)
  .sort((a, b) => a.start - b.start)
check(
  'Penanda: tumpang tindih terselesaikan deterministik (AI > eja > frasa > saya)',
  allMarks.filter((m) => m.kind === 'ai').length === 2 &&
    allMarks.filter((m) => m.kind === 'saya').length === 2 &&
    rangeMarks.every(
      (m, i) => i === 0 || m.start >= rangeMarks[i - 1].end,
    ),
  `total ${allMarks.length} tanda; "saya" tersisa ${allMarks.filter((m) => m.kind === 'saya').length} (2 tertutup sorotan AI)`,
)

// Segmen render: gabungan teks segmen persis teks asli, teks segmen
// bertanda persis potongan pada rentang tandanya.
const segments = buildSegments(MARKED_CV, buildMarks(MARKED_CV, null))
check(
  'Penanda: segmen render menyusun ulang teks asli persis',
  segments.map((s) => (s.type === 'point' ? '' : s.text)).join('') === MARKED_CV &&
    segments
      .filter((s) => s.type === 'mark')
      .every(
        (s) =>
          s.type === 'mark' &&
          s.text === MARKED_CV.slice(s.mark.start, s.mark.end),
      ) &&
    segments.filter((s) => s.type === 'point').length === 1,
  `${segments.length} segmen, ${segments.filter((s) => s.type === 'point').length} penanda titik`,
)

// Pengawatan UI: panel ada di App.tsx dan memakai modul marks.
check(
  'Penanda: panel "Teks CV dengan Tanda" terpasang di App.tsx',
  appTsxText.includes('Teks CV dengan Tanda') &&
    appTsxText.includes("from './lib/marks'") &&
    appTsxText.includes('buildMarks') &&
    appTsxText.includes('markSegments') &&
    appTsxText.includes('analyzedText'),
  'panel dirender dari analyzedText + buildMarks/buildSegments',
)
check(
  'Penanda: gaya sorotan ada di App.css',
  appCssText.includes('.marked-text') &&
    appCssText.includes('.mark-weak') &&
    appCssText.includes('.mark-typo') &&
    appCssText.includes('.mark-ai') &&
    appCssText.includes('.entry-flag'),
  'kelas .marked-text/.mark-weak/.mark-typo/.mark-ai/.entry-flag tersedia',
)

if (failures > 0) {
  console.error(`\n${failures} uji GAGAL`)
  process.exit(1)
}
console.log('\nSemua uji lolos.')
