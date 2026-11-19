// Contoh kalimat perbaikan per pemeriksaan + template ringkasan + kamus
// skill per peran — Fase 2 roadmap.
//
// Semua contoh bersifat GENERIK-ILUSTRATIF: bukan klaim pengalaman pengguna.
// Angka pada contoh memakai placeholder [kurung siku] yang harus diganti
// pengguna dengan angka aslinya — aturan anti-karang yang sama seperti
// fitur Analisis AI. Modul ini hanya MEMBACA hasil analyze.ts; logika dan
// angka skor tidak diubah sama sekali.

// ---------- Contoh sebelum → sesudah per id pemeriksaan ----------

export interface CheckExample {
  sebelum: string
  sesudah: string
  catatan: string
}

export const CHECK_EXAMPLES: Record<string, CheckExample> = {
  'hasil-terukur': {
    sebelum: 'Bertanggung jawab atas penjualan di toko dan melayani pembeli setiap hari.',
    sesudah:
      'Meningkatkan penjualan toko sebesar [30%] dalam [6 bulan] dengan menata ulang display produk dan melayani [50+] pembeli per hari.',
    catatan:
      'Angka dalam [kurung siku] hanya pola contoh — ganti dengan angka aslimu, atau hapus bila memang tidak ada datanya. Jangan mengarang angka.',
  },
  'kata-kerja-aksi': {
    sebelum: 'Bagian input data dan pembuatan laporan untuk tim.',
    sesudah: 'Mengelola input data harian dan menyusun laporan mingguan untuk tim berisi [10] orang.',
    catatan:
      'Awali setiap poin dengan kata kerja aksi: meningkatkan, mengelola, membangun, menganalisis, memimpin, merancang, mengotomatisasi, mencapai, menurunkan.',
  },
  bullet: {
    sebelum:
      'Tugas saya meliputi input data, membuat laporan bulanan, mengarsipkan dokumen, dan menjawab telepon dari pelanggan.',
    sesudah:
      '• Menginput data transaksi harian ke Microsoft Excel\n• Menyusun laporan bulanan untuk manajer\n• Mengarsipkan [200+] dokumen per bulan\n• Menjawab telepon dan pertanyaan pelanggan',
    catatan:
      'Satu poin = satu tugas/pencapaian. Struktur bullet membuat CV mudah dipindai rekruter dan terbaca rapi oleh sistem ATS.',
  },
  ringkasan: {
    sebelum:
      'Saya adalah orang yang rajin, jujur, dan bisa bekerja di bawah tekanan. Saya ingin mencari pengalaman baru.',
    sesudah:
      'Staf Administrasi dengan pengalaman [2 tahun] di bidang administrasi perkantoran. Terampil menggunakan Microsoft Excel dan Google Workspace untuk input data dan penyusunan laporan. Sedang mencari posisi Administrasi di perusahaan yang terstruktur.',
    catatan:
      'Ringkasan yang kuat menyebut: profesi + lama pengalaman + 2–3 skill utama + posisi yang dicari. Klise tanpa bukti ("rajin, jujur") tidak menambah nilai.',
  },
  email: {
    sebelum: 'Kontak: andi.ganteng99 (alamat email menyusul)',
    sesudah: 'Email: andi.pratama@gmail.com',
    catatan:
      'Gunakan email profesional yang aktif — idealnya dari nama aslimu — karena balasan rekruter masuk ke alamat ini.',
  },
  hp: {
    sebelum: 'Telepon: (021) 555-1234 (telepon kantor)',
    sesudah: 'HP/WhatsApp: +62 812-3456-7890',
    catatan:
      'Cantumkan nomor HP pribadi yang aktif dan bisa dihubungi lewat WhatsApp, bukan nomor kantor. Format 08xx atau +62 sama-sama terbaca.',
  },
  linkedin: {
    sebelum: '(belum ada tautan LinkedIn di CV)',
    sesudah: 'LinkedIn: linkedin.com/in/andi-pratama',
    catatan:
      'Samakan isi LinkedIn dengan CV (jabatan, perusahaan, periode) agar rekruter mudah memverifikasi profilmu.',
  },
  portofolio: {
    sebelum: 'Portofolio: ada, bisa ditanyakan saat wawancara.',
    sesudah:
      'Portofolio: github.com/andipratama (untuk desain: behance.net/andipratama; untuk data: kaggle.com/andipratama)',
    catatan:
      'Kata "portofolio" saja tidak terbaca sebagai link — tulis alamat lengkapnya. Untuk peran non-teknis, tautan berisi contoh karya juga membantu.',
  },
  keahlian: {
    sebelum: 'Keahlian: komputer, internet.',
    sesudah:
      'Keahlian: Microsoft Excel (PivotTable, VLOOKUP), Microsoft Word, Google Workspace, Canva, Input Data, Pengarsipan Digital, Komunikasi, Kerja Tim',
    catatan:
      'Daftarkan minimal 8 skill spesifik dan pisahkan dengan koma. Nama tools jauh lebih kuat daripada kata umum seperti "komputer".',
  },
  panjang: {
    sebelum: 'CV hanya berisi nama, satu kalimat perkenalan, dan riwayat sekolah (di bawah 60 kata).',
    sesudah:
      'CV 1–2 halaman (220–900 kata): ringkasan 3–4 kalimat, pengalaman dalam poin-poin pencapaian, pendidikan, dan daftar keahlian.',
    catatan:
      'Terlalu pendek terlihat kosong; terlalu panjang melelahkan. Bila masih singkat, tambahkan isi dari magang, organisasi, proyek, atau sertifikasi.',
  },
  'kedalaman-entri': {
    sebelum:
      'Pengalaman\nKasir — Toko Berkah (2022–2023)\nStaf Gudang — PT Logistik Jaya (2021–2022)',
    sesudah:
      'Pengalaman\nKasir — Toko Berkah (2022–2023)\n• Melayani [100+] transaksi per hari (tunai dan QRIS)\n• Mencatat selisih kas harian dengan selisih nol selama [6 bulan]\nStaf Gudang — PT Logistik Jaya (2021–2022)\n• Mencatat keluar-masuk [500+] item stok per minggu\n• Menata ulang rak gudang sehingga waktu pencarian barang turun [20%]',
    catatan:
      'Setiap entri pengalaman harus lengkap: jabatan + perusahaan + periode + uraian isi. Entri yang hanya berisi judul terlihat seperti riwayat kosong — rekruter tidak bisa menilai apa yang kamu kerjakan.',
  },
  'frasa-lemah': {
    sebelum:
      'Saya pekerja keras, mampu bekerja di bawah tekanan, dapat bekerja dalam tim maupun individu, dan bertanggung jawab atas kebersihan toko.',
    sesudah:
      'Menjaga kebersihan dan kerapian area toko setiap hari hingga lolos audit kebersihan cabang dengan nilai [95]. Melatih [2] kasir baru sampai bisa bertugas mandiri dalam [2 minggu].',
    catatan:
      'Frasa klise ("pekerja keras", "bertanggung jawab atas", "bersedia ditempatkan di mana saja") diklaim hampir semua pelamar, jadi tidak membedakanmu. Ganti dengan bukti: hasil kerja, angka, atau contoh nyata.',
  },
  sertifikasi: {
    sebelum: '(tidak ada bagian sertifikasi/pelatihan di CV)',
    sesudah:
      'Sertifikasi & Pelatihan\n• Sertifikat [nama sertifikasi] — [lembaga penerbit] ([tahun])\n• Pelatihan [topik pelatihan] — [penyelenggara] ([tahun])',
    catatan:
      'Cantumkan hanya sertifikat yang benar-benar kamu miliki dan relevan dengan posisi yang dilamar. Bagian tersendiri membuat sertifikasi mudah ditemukan rekruter dan sistem ATS.',
  },
  bahasa: {
    sebelum: '(kemampuan bahasa asing tidak disebut sama sekali di CV)',
    sesudah:
      'Bahasa\n• Bahasa Inggris — aktif (percakapan dan tertulis)\n• Bahasa Mandarin — dasar (percakapan sehari-hari)',
    catatan:
      'Tulis bahasa yang kamu kuasai beserta tingkat kemahirannya secara jujur. Bila ada skor tes resmi (mis. TOEFL/IELTS), cantumkan — itu bukti yang bisa diverifikasi.',
  },
  'konsistensi-format': {
    sebelum:
      'Pengalaman\nKasir — Toko Berkah (Jan 2021 - Des 2022)\nStaf Gudang — PT Logistik (2023–2024)',
    sesudah:
      'Pengalaman\nStaf Gudang — PT Logistik (2023–2024)\nKasir — Toko Berkah (2021–2022)',
    catatan:
      'Dua hal diperiksa: (1) format periode seragam — pilih SATU gaya (mis. selalu "2021–2024" atau selalu "Jan 2021 – Des 2022"), jangan campur; (2) urutan entri dari yang terbaru, karena rekruter membaca dari pengalaman terakhir.',
  },
  'kerapian-bahasa': {
    sebelum:
      'Saya melakukan aktifitas kasir setiap hari. Saya merubah jadwal piket dan saya mengecek stok di gudang.',
    sesudah:
      'Melakukan aktivitas kasir setiap hari, mengubah jadwal piket, dan mengecek stok gudang.',
    catatan:
      'Dua kebiasaan yang dinilai: hindari mengawali poin pengalaman dengan "Saya …" berulang-ulang (langsung ke kata kerjanya), dan pakai ejaan baku — aktifitas → aktivitas, merubah → mengubah, praktek → praktik, ijin → izin.',
  },
  'relevansi-ringkasan': {
    sebelum:
      'Lulusan baru yang sedang mencari pekerjaan dan ingin mengembangkan diri di perusahaan yang baik.',
    sesudah:
      'Lulusan SMK Administrasi Perkantoran dengan pengalaman magang input data dan pengarsipan. Terampil Microsoft Excel dan Google Workspace. Mencari posisi Staf Administrasi untuk berkontribusi pada kerapian data dan dokumen perusahaan.',
    catatan:
      'Sebutkan posisi/bidang yang kamu tuju secara eksplisit di ringkasan (sesuaikan dengan posisi target yang kamu isi). Ringkasan yang generik membuat rekruter menebak kamu melamar sebagai apa.',
  },
  periode: {
    sebelum: 'Pengalaman: Kasir di Toko Berkah (tanpa tahun).',
    sesudah: 'Kasir — Toko Berkah, Jakarta (Jan 2022 – Des 2023)',
    catatan:
      'Tulis bulan/tahun mulai dan selesai untuk tiap pekerjaan dan pendidikan agar urutan perjalananmu jelas bagi rekruter.',
  },
  'pengalaman-heading': {
    sebelum: '(riwayat kerja ditulis menyatu dalam satu paragraf tanpa judul bagian)',
    sesudah: 'Pengalaman\nKasir — Toko Berkah (2022–2023)\n• Melayani pembayaran tunai dan QRIS…',
    catatan:
      'Judul bagian yang standar ("Pengalaman", "Pendidikan", "Keahlian") membantu rekruter dan sistem ATS menemukan isi CV-mu.',
  },
  pendidikan: {
    sebelum: '(bagian pendidikan kosong / tidak ditulis)',
    sesudah: 'Pendidikan\nSMK Negeri 1 Jakarta — Jurusan Administrasi Perkantoran (2020–2023)',
    catatan:
      'Cantumkan jenjang terakhir dan nama institusinya, walaupun hanya SMA/SMK — bagian ini tetap dinilai rekruter.',
  },
  ipk: {
    sebelum: 'Pendidikan: S1 Manajemen — Universitas Contoh',
    sesudah: 'Pendidikan: S1 Manajemen — Universitas Contoh (IPK 3,45/4,00)',
    catatan:
      'Cantumkan IPK bila 3,00 ke atas. Bila di bawah itu, lewati saja dan tonjolkan pengalaman serta skill-mu.',
  },
}

export function getCheckExample(checkId: string): CheckExample | null {
  return CHECK_EXAMPLES[checkId] ?? null
}

// ---------- Template ringkasan profil ----------

// Template isi-titik-titik. Posisi target pengguna disisipkan otomatis bila
// diisi; semua bagian lain tetap placeholder [kurung siku] untuk diganti
// dengan data asli pengguna.
export function buildSummaryTemplate(targetRole: string): string {
  const role = targetRole.trim()
  const roleText = role ? role : '[posisi yang dilamar]'
  return (
    `[Profesi atau jurusanmu] dengan pengalaman [X tahun] di bidang [bidang utama]. ` +
    `Terampil dalam [skill 1], [skill 2], dan [skill 3], dengan pencapaian [pencapaian terbaikmu — pakai angka bila ada]. ` +
    `Saat ini mencari posisi ${roleText} untuk berkontribusi di [jenis perusahaan atau tim].`
  )
}

// ---------- Kamus skill per peran ----------

export interface RoleSkills {
  id: string
  label: string
  keywords: string[]
  skills: string[]
}

export const ROLE_SKILLS: RoleSkills[] = [
  {
    id: 'data-analyst',
    label: 'Data Analyst',
    keywords: ['data analyst', 'analis data', 'data scientist', 'data science', 'business intelligence'],
    skills: [
      'SQL', 'Python', 'Microsoft Excel', 'Tableau', 'Power BI',
      'Google Sheets', 'Statistik', 'Visualisasi Data', 'PivotTable', 'Looker Studio',
    ],
  },
  {
    id: 'administrasi',
    label: 'Administrasi / Admin Kantor',
    keywords: ['administrasi', 'admin', 'data entry', 'sekretaris', 'sekretariat', 'back office', 'staff kantor'],
    skills: [
      'Microsoft Word', 'Microsoft Excel', 'Google Workspace', 'Input Data', 'Pengarsipan',
      'Korespondensi', 'Mengetik Cepat', 'Manajemen Jadwal', 'Administrasi Perkantoran', 'Komunikasi',
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing / Digital Marketing',
    keywords: ['marketing', 'digital marketing', 'social media', 'sosial media', 'content', 'seo', 'brand'],
    skills: [
      'Media Sosial', 'Copywriting', 'SEO', 'Google Ads', 'Meta Ads',
      'Canva', 'Content Planning', 'Email Marketing', 'Analisis Data', 'TikTok',
    ],
  },
  {
    id: 'customer-service',
    label: 'Customer Service',
    keywords: ['customer service', 'customer support', 'layanan pelanggan', 'call center', 'helpdesk pelanggan'],
    skills: [
      'Komunikasi Verbal', 'Komunikasi Tertulis', 'Penanganan Komplain', 'WhatsApp Business', 'CRM',
      'Microsoft Office', 'Bahasa Inggris', 'Pengetahuan Produk', 'Live Chat', 'Telepon',
    ],
  },
  {
    id: 'akuntansi',
    label: 'Akuntansi / Finance',
    keywords: ['akuntansi', 'accounting', 'finance', 'keuangan', 'accountant', 'staff keuangan', 'treasury'],
    skills: [
      'Microsoft Excel', 'Jurnal Umum', 'Pembukuan', 'Rekonsiliasi Bank', 'Accurate',
      'MYOB', 'Perpajakan', 'Laporan Keuangan', 'Faktur', 'Kas Kecil',
    ],
  },
  {
    id: 'it-support',
    label: 'IT Support',
    keywords: ['it support', 'teknisi komputer', 'helpdesk', 'technical support', 'network', 'jaringan'],
    skills: [
      'Troubleshooting', 'Instalasi Windows', 'Jaringan LAN', 'Hardware PC', 'Microsoft Office',
      'Remote Desktop', 'Helpdesk', 'Linux', 'Backup Data', 'Komunikasi',
    ],
  },
  {
    id: 'sales',
    label: 'Sales',
    keywords: ['sales', 'penjualan', 'account executive', 'marketing executive', 'business development'],
    skills: [
      'Negosiasi', 'Komunikasi', 'Presentasi', 'Pencarian Prospek', 'CRM',
      'Pengetahuan Produk', 'Target Penjualan', 'Follow-up', 'Microsoft Excel', 'Bahasa Inggris',
    ],
  },
  {
    id: 'desain-grafis',
    label: 'Desain Grafis',
    keywords: ['desain', 'designer', 'grafis', 'graphic', 'ui/ux', 'ui ux'],
    skills: [
      'Adobe Photoshop', 'Adobe Illustrator', 'Canva', 'Figma', 'CorelDRAW',
      'Tipografi', 'Teori Warna', 'Layout', 'Branding', 'Media Sosial',
    ],
  },
]

export const FALLBACK_ROLE_SKILLS: RoleSkills = {
  id: 'umum',
  label: 'Umum / Fresh Graduate',
  keywords: [],
  skills: [
    'Microsoft Word', 'Microsoft Excel', 'Microsoft PowerPoint', 'Google Workspace', 'Internet',
    'Komunikasi', 'Kerja Tim', 'Manajemen Waktu', 'Bahasa Inggris', 'Presentasi',
  ],
}

// Cocokkan posisi target ke kamus peran (frasa spesifik, case-insensitive).
// Peran tidak dikenal / posisi kosong → fallback Umum / Fresh Graduate.
export function getRoleSkills(targetRole: string): RoleSkills {
  const role = targetRole.trim().toLowerCase()
  if (!role) return FALLBACK_ROLE_SKILLS
  for (const entry of ROLE_SKILLS) {
    if (entry.keywords.some((k) => role.includes(k))) return entry
  }
  return FALLBACK_ROLE_SKILLS
}

export interface SkillPresence {
  skill: string
  present: boolean
}

// Pencocokan sederhana & jujur: frasa skill dicari apa adanya di teks CV
// (case-insensitive, toleran perbedaan spasi/strip). Ini perkiraan tampilan
// — skill yang ditulis dengan nama lain bisa saja tidak tertangkap.
export function checkSkills(cvText: string, skills: string[]): SkillPresence[] {
  const lower = cvText.toLowerCase()
  return skills.map((skill) => {
    const needle = skill.toLowerCase()
    const variants = [needle, needle.replace(/-/g, ' '), needle.replace(/\s+/g, '-')]
    return { skill, present: variants.some((v) => lower.includes(v)) }
  })
}
