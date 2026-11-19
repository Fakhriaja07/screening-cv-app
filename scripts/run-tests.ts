// Uji logika penilaian: 3 CV (kuat/menengah/lemah) + deteksi HP.
// Jalankan: npx tsx scripts/run-tests.ts
import { analyzeCv, detectPhone, findPortfolio } from '../src/lib/analyze'
import {
  addHistoryEntry,
  aspectDeltas,
  clearHistory,
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
  buildSummaryTemplate,
  checkSkills,
  getCheckExample,
  getRoleSkills,
} from '../src/lib/examples'
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
  'Rombakan aspek: skor patokan terkunci 96/58/16',
  strong.total === 96 && medium.total === 58 && weak.total === 16,
  `kuat ${strong.total}, menengah ${medium.total}, lemah ${weak.total} (harus 96/58/16)`,
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
    strongCheck('kedalaman-entri')?.score === 5 &&
    strongCheck('frasa-lemah')?.score === 3 &&
    strongCheck('konsistensi-format')?.score === 3 &&
    strongCheck('kerapian-bahasa')?.score === 2 &&
    strongCheck('hasil-terukur')?.score === 8 &&
    strongCheck('kata-kerja-aksi')?.score === 6,
  `kuat: sertifikasi ${strongCheck('sertifikasi')?.score}/3, bahasa ${strongCheck('bahasa')?.score}/2, kedalaman ${strongCheck('kedalaman-entri')?.score}/5, frasa ${strongCheck('frasa-lemah')?.score}/3, konsistensi ${strongCheck('konsistensi-format')?.score}/3, kerapian ${strongCheck('kerapian-bahasa')?.score}/2`,
)

check(
  'Rombakan aspek: jumlah pemeriksaan 20 (21 bila posisi target diisi)',
  strong.aspects.flatMap((a) => a.checks).length === 20 &&
    analyzeCv(SAMPLE_CV, { targetRole: 'Data Analyst' }).aspects.flatMap((a) => a.checks).length === 21,
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
  checkOf(analyzeCv(HALF_DEEP_CV), 'kedalaman-entri')?.score === 3 &&
    mediumCheck('kedalaman-entri')?.score === 5,
  `campuran ${checkOf(analyzeCv(HALF_DEEP_CV), 'kedalaman-entri')?.score}/5, menengah (1 entri lengkap) ${mediumCheck('kedalaman-entri')?.score}/5`,
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
    getRoleSkills('').id === 'umum' &&
    getRoleSkills('Petani').id === 'umum',
  `Data Analyst→${getRoleSkills('Data Analyst').id}, Administrasi→${getRoleSkills('Staff Administrasi').id}, tak dikenal→${getRoleSkills('Petani').id}`,
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

if (failures > 0) {
  console.error(`\n${failures} uji GAGAL`)
  process.exit(1)
}
console.log('\nSemua uji lolos.')
