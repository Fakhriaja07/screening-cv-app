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
