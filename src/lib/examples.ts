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
  lokasi: {
    sebelum: 'Kontak: andi.pratama@gmail.com | 0812-3456-7890 (tanpa kota domisili)',
    sesudah: 'Kontak: andi.pratama@gmail.com | 0812-3456-7890 | Domisili: Bandung',
    catatan:
      'Banyak rekruter menyaring kandidat berdasarkan domisili sebelum membaca isi CV. Cukup tulis kota tempat tinggalmu saat ini di baris kontak — tidak perlu alamat lengkap.',
  },
  linimasa: {
    sebelum:
      'Pengalaman\nKasir — Toko Berkah (2015–2016)\nStaf Gudang — PT Logistik Jaya (2021–2022)\n(ada jeda 2017–2020 yang tidak dijelaskan, dan tidak ada peran setelah 2022)',
    sesudah:
      'Pengalaman\nStaf Gudang — PT Logistik Jaya (2021–2022)\nKasir — Toko Berkah (2015–2016)\n2017–2020: Mengelola toko online keluarga dan mengikuti pelatihan komputer',
    catatan:
      'Kesenjangan bukan otomatis buruk — yang membuat rekruter ragu adalah kesenjangan TANPA penjelasan. Satu baris aktivitas pengisi (kuliah, wirausaha, keluarga, kursus) menutup pertanyaan itu. Cantumkan juga peran terkinimu bila masih berjalan ("2023–Sekarang").',
  },
  proyek: {
    sebelum: '(tidak ada bagian proyek/magang — CV fresh graduate hanya berisi pendidikan dan skill)',
    sesudah:
      'Proyek & Magang\n• Magang input data di [nama tempat] ([tahun]): menginput [500+] data pelanggan ke Excel\n• Proyek sekolah: membuat sistem arsip digital perpustakaan dengan Google Drive, dipakai [300] siswa',
    catatan:
      'Bagi fresh graduate, proyek, magang, PKL, dan pengalaman organisasi yang diuraikan tugas + hasilnya adalah bukti pengalaman utama. Tulis seperti entri pengalaman kerja: tempat, periode, tugas, dan hasil.',
  },
  'relevansi-pengalaman': {
    sebelum:
      'Pengalaman (untuk melamar posisi Data Analyst)\nKasir — Toko Berkah (2022–2023)\n• Melayani pembayaran dan mencatat kas harian',
    sesudah:
      'Pengalaman (untuk melamar posisi Data Analyst)\nKasir — Toko Berkah (2022–2023)\n• Merekap data penjualan harian ke Excel dan membuat laporan tren mingguan untuk pemilik toko\n• Menganalisis produk terlaris dari data transaksi untuk menentukan stok',
    catatan:
      'Rekruter menilai apakah pengalamanmu berkaitan dengan bidang yang dituju. Tonjolkan tugas yang memakai kata kunci bidang target (di contoh ini: data, laporan, analisis) — hanya yang benar-benar kamu kerjakan.',
  },
  'kecocokan-lowongan': {
    sebelum:
      'Keahlian: Microsoft Excel, komunikasi, kerja tim. (Lowongan meminta: SQL, Python, dashboard, visualisasi data — tidak satu pun tercantum di CV)',
    sesudah:
      'Keahlian: Microsoft Excel (PivotTable, VLOOKUP), SQL dasar, Python untuk olah data, Power BI untuk dashboard dan visualisasi data.',
    catatan:
      'Baca deskripsi lowongan, temukan kata kunci skill/tugas utamanya, lalu cerminkan kata yang SAMA di CV — hanya untuk hal yang benar-benar kamu kuasai. Sistem ATS dan rekruter sama-sama mencari kata kunci persis itu; memasukkan kata kunci yang tidak kamu kuasai akan terbongkar saat wawancara.',
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

import { expandJobTitle } from './jobGlossary'

// ---------- Kamus skill per peran ----------

export interface RoleSkills {
  id: string
  label: string
  keywords: string[]
  skills: string[]
  /** true bila label berasal dari posisi target pengguna yang tidak ada
   *  di kamus — daftar skill-nya memakai daftar umum, dan UI harus
   *  menyatakannya sebagai saran umum untuk posisi itu. */
  posisiKustom?: boolean
}

export const ROLE_SKILLS: RoleSkills[] = [
  {
    id: 'data-analyst',
    label: 'Data Analyst',
    keywords: ['data analyst', 'analis data', 'data scientist', 'data science', 'business intelligence', 'analyst', 'analis', 'data'],
    skills: [
      'SQL', 'Python', 'Microsoft Excel', 'Tableau', 'Power BI',
      'Google Sheets', 'Statistik', 'Visualisasi Data', 'PivotTable', 'Looker Studio',
    ],
  },
  {
    id: 'administrasi',
    label: 'Administrasi / Admin Kantor',
    keywords: ['administrasi', 'admin', 'data entry', 'sekretaris', 'sekretariat', 'back office', 'staff kantor', 'staf administrasi', 'staf admin', 'admin kantor', 'admin operasional', 'administrasi perkantoran', 'clerk'],
    skills: [
      'Microsoft Word', 'Microsoft Excel', 'Google Workspace', 'Input Data', 'Pengarsipan',
      'Korespondensi', 'Mengetik Cepat', 'Manajemen Jadwal', 'Administrasi Perkantoran', 'Komunikasi',
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing / Digital Marketing',
    keywords: ['marketing', 'digital marketing', 'digital marketer', 'marketing communication', 'marcom', 'social media', 'sosial media', 'content', 'seo', 'brand'],
    skills: [
      'Media Sosial', 'Copywriting', 'SEO', 'Google Ads', 'Meta Ads',
      'Canva', 'Content Planning', 'Email Marketing', 'Analisis Data', 'TikTok',
    ],
  },
  {
    id: 'customer-service',
    label: 'Customer Service',
    keywords: ['customer service', 'customer support', 'customer care', 'layanan pelanggan', 'call center', 'helpdesk pelanggan', 'cs'],
    skills: [
      'Komunikasi Verbal', 'Komunikasi Tertulis', 'Penanganan Komplain', 'WhatsApp Business', 'CRM',
      'Microsoft Office', 'Bahasa Inggris', 'Pengetahuan Produk', 'Live Chat', 'Telepon',
    ],
  },
  {
    id: 'akuntansi',
    label: 'Akuntansi / Finance',
    keywords: ['akuntansi', 'accounting', 'finance', 'keuangan', 'accountant', 'staff keuangan', 'staff pajak', 'bendahara', 'treasury'],
    skills: [
      'Microsoft Excel', 'Jurnal Umum', 'Pembukuan', 'Rekonsiliasi Bank', 'Accurate',
      'MYOB', 'Perpajakan', 'Laporan Keuangan', 'Faktur', 'Kas Kecil',
    ],
  },
  {
    id: 'it-support',
    label: 'IT Support',
    // Kata kunci 'staff it' sengaja TIDAK ada (keputusan pengguna
    // 2026-11-24): singkatan "IT" tidak ditebak sebagai IT Support,
    // jadi "staff it"/"it staff" jatuh ke jalur posisi tak dikenal.
    // Nama lengkap "it support" yang ditulis utuh tetap cocok di sini.
    keywords: ['it support', 'teknisi komputer', 'teknisi jaringan', 'helpdesk', 'technical support', 'network', 'jaringan'],
    skills: [
      'Troubleshooting', 'Instalasi Windows', 'Jaringan LAN', 'Hardware PC', 'Microsoft Office',
      'Remote Desktop', 'Helpdesk', 'Linux', 'Backup Data', 'Komunikasi',
    ],
  },
  {
    id: 'sales',
    label: 'Sales',
    keywords: ['sales', 'penjualan', 'account executive', 'marketing executive', 'business development', 'spg', 'spb', 'pramuniaga', 'merchandiser', 'sales representative', 'sales assistant', 'tenaga penjualan'],
    skills: [
      'Negosiasi', 'Komunikasi', 'Presentasi', 'Pencarian Prospek', 'CRM',
      'Pengetahuan Produk', 'Target Penjualan', 'Follow-up', 'Microsoft Excel', 'Bahasa Inggris',
    ],
  },
  {
    id: 'desain-grafis',
    label: 'Desain Grafis',
    keywords: ['desain', 'designer', 'desainer', 'grafis', 'graphic', 'ui/ux', 'ui ux'],
    skills: [
      'Adobe Photoshop', 'Adobe Illustrator', 'Canva', 'Figma', 'CorelDRAW',
      'Tipografi', 'Teori Warna', 'Layout', 'Branding', 'Media Sosial',
    ],
  },
  {
    id: 'kasir',
    label: 'Kasir',
    keywords: ['kasir', 'cashier'],
    skills: [
      'Mesin Kasir (POS)', 'QRIS & E-Wallet', 'Perhitungan Uang Tunai', 'Microsoft Excel', 'Ketelitian',
      'Komunikasi', 'Penanganan Komplain', 'Laporan Penjualan Harian', 'Stok Opname', 'Bahasa Inggris',
    ],
  },
  {
    id: 'operator-produksi',
    label: 'Operator Produksi',
    keywords: ['operator produksi', 'operator mesin', 'produksi', 'pabrik', 'quality control', 'qc inspector'],
    skills: [
      'Pengoperasian Mesin Produksi', 'K3 (Keselamatan Kerja)', 'Quality Control', 'Kerja Shift', '5S',
      'Membaca Instruksi Kerja', 'Ketelitian', 'Kerja Tim', 'Target Produksi', 'Microsoft Excel',
    ],
  },
  {
    id: 'guru',
    label: 'Guru / Pendidikan',
    keywords: ['guru', 'pengajar', 'pendidik', 'teacher', 'tutor', 'dosen', 'instruktur'],
    skills: [
      'Rencana Pembelajaran (RPP)', 'Manajemen Kelas', 'Kurikulum Merdeka', 'Google Classroom', 'Microsoft Office',
      'Penilaian & Evaluasi Siswa', 'Komunikasi dengan Orang Tua', 'Media Pembelajaran Digital', 'Bahasa Inggris', 'Public Speaking',
    ],
  },
  {
    id: 'perawat',
    label: 'Perawat / Tenaga Kesehatan',
    keywords: ['perawat', 'nurse', 'kesehatan', 'medis', 'bidan', 'apoteker', 'farmasi', 'analis kesehatan', 'radiografer', 'fisioterapi', 'tenaga kesehatan', 'nakes'],
    skills: [
      'Asuhan Keperawatan', 'Pengukuran Tanda Vital', 'Pemberian Obat', 'Rekam Medis', 'Penanganan Gawat Darurat',
      'Komunikasi', 'Kerja Tim', 'Microsoft Office', 'Bahasa Inggris', 'Empati & Kesabaran',
    ],
  },
  {
    id: 'teknisi',
    label: 'Teknisi / Mekanik',
    keywords: ['teknisi', 'mekanik', 'mechanic', 'technician', 'maintenance', 'elektrik', 'listrik', 'otomotif', 'bengkel'],
    skills: [
      'Troubleshooting', 'Preventive Maintenance', 'Membaca Gambar Teknik', 'Kelistrikan', 'Pengelasan Dasar',
      'K3 (Keselamatan Kerja)', 'Penggunaan Alat Ukur', 'Perawatan Mesin & Kendaraan', 'Kerja Tim', 'Laporan Perawatan',
    ],
  },
  {
    id: 'barista-fnb',
    label: 'Barista / F&B Service',
    keywords: ['barista', 'bartender', 'f&b', 'food and beverage', 'pelayan', 'waiter', 'waitress', 'pramusaji', 'koki', 'cook', 'chef', 'kitchen', 'restoran'],
    skills: [
      'Meracik Kopi (Espresso)', 'Latte Art', 'Mesin Kasir (POS)', 'Food Safety & Hygiene', 'Komunikasi',
      'Bahasa Inggris', 'Upselling', 'Kerja Tim', 'Stok Bahan', 'Pelayanan Pelanggan',
    ],
  },
  {
    id: 'security',
    label: 'Security / Satpam',
    keywords: ['security', 'satpam', 'pengamanan', 'guard'],
    skills: [
      'Pengamanan Area', 'Patroli Keamanan', 'Pengawasan CCTV', 'K3 (Keselamatan Kerja)', 'Komunikasi',
      'Penanganan Keadaan Darurat', 'Laporan Kejadian', 'Kedisiplinan', 'Kondisi Fisik Prima', 'Bela Diri Dasar',
    ],
  },
  {
    id: 'driver',
    label: 'Driver / Sopir',
    keywords: ['driver', 'sopir', 'supir', 'kurir', 'pengemudi'],
    skills: [
      'SIM A', 'SIM B', 'Google Maps & Navigasi', 'Defensive Driving', 'Perawatan Kendaraan Dasar',
      'Ketepatan Waktu', 'Komunikasi', 'Dokumen Pengiriman', 'Keselamatan Berkendara', 'Bahasa Inggris',
    ],
  },
  {
    id: 'content-creator',
    label: 'Content Creator / Sosial Media',
    keywords: ['content creator', 'kreator konten', 'social media specialist', 'sosial media', 'influencer', 'videografer', 'video editor', 'editor video'],
    skills: [
      'Videografi', 'Editing Video', 'Copywriting', 'Fotografi', 'TikTok',
      'Instagram Reels', 'Content Planning', 'Canva', 'Analisis Insight', 'SEO Media Sosial',
    ],
  },
  {
    id: 'developer',
    label: 'Software Developer / Programmer',
    keywords: ['programmer', 'programer', 'software developer', 'developer', 'software engineer', 'web developer', 'full stack', 'fullstack', 'frontend', 'backend', 'mobile developer'],
    skills: [
      'JavaScript', 'TypeScript', 'React', 'Node.js', 'Git & GitHub',
      'REST API', 'SQL', 'HTML & CSS', 'Testing & Debugging', 'Bahasa Inggris',
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

// Normalisasi teks posisi/kata kunci: huruf kecil, tanda baca menjadi
// spasi, spasi berlebih dirapikan — supaya "ADMIN", "Admin Kantor", dan
// "admin-kantor" tercocokkan dengan cara yang sama.
function normalizeRoleText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Kata kunci cocok bila muncul sebagai kata/frasa utuh (dibatasi spasi
// atau awal/akhir teks), bukan sekadar potongan di tengah kata lain.
function keywordMatches(roleNorm: string, keyword: string): boolean {
  const k = normalizeRoleText(keyword)
  if (!k) return false
  const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|\\s)${escaped}(?=\\s|$)`).test(roleNorm)
}

// Pencocokan inti ke kamus peran: di antara semua kata kunci yang
// cocok, yang TERPANJANG menang — frasa spesifik seperti "teknisi
// komputer" atau "content creator" mengalahkan kata umum seperti
// "teknisi" atau "content".
function matchRoleDictionary(roleText: string): RoleSkills | null {
  const role = normalizeRoleText(roleText)
  let best: RoleSkills | null = null
  let bestLen = 0
  for (const entry of ROLE_SKILLS) {
    for (const keyword of entry.keywords) {
      const len = normalizeRoleText(keyword).length
      if (len > bestLen && keywordMatches(role, keyword)) {
        best = entry
        bestLen = len
      }
    }
  }
  return best
}

// Cocokkan posisi target (teks bebas) ke kamus peran.
// - Posisi kosong → fallback "Umum / Fresh Graduate".
// - Posisi cocok langsung ke kamus → peran itu (perilaku asli, tidak
//   berubah untuk nama lengkap).
// - Posisi tidak cocok tetapi memuat singkatan pekerjaan yang dikenal
//   glosarium (jobGlossary.ts) → singkatannya diperluas dulu, lalu
//   dicocokkan ulang: "QC" menjadi "Quality Control" dan mendapat
//   daftar skill peran terkait; judul kartu memakai nama lengkap hasil
//   perluasan, bukan singkatan mentah. Bila nama lengkapnya pun belum
//   ada di kamus, fallback kustom memakai nama lengkap itu (lebih
//   informatif daripada singkatan mentah).
// - Posisi terisi tapi tidak ada di kamus → entri kustom berlabel nama
//   posisi pengguna sendiri, dengan daftar skill umum (posisiKustom).
export function getRoleSkills(targetRole: string): RoleSkills {
  const raw = targetRole.trim()
  if (!raw) return FALLBACK_ROLE_SKILLS
  const direct = matchRoleDictionary(raw)
  if (direct) return direct
  const expanded = expandJobTitle(raw)
  if (expanded.toLowerCase() !== raw.toLowerCase()) {
    const viaGlossary = matchRoleDictionary(expanded)
    if (viaGlossary) return { ...viaGlossary, label: expanded }
    return {
      id: 'kustom',
      label: expanded,
      keywords: [],
      skills: FALLBACK_ROLE_SKILLS.skills,
      posisiKustom: true,
    }
  }
  return {
    id: 'kustom',
    label: raw,
    keywords: [],
    skills: FALLBACK_ROLE_SKILLS.skills,
    posisiKustom: true,
  }
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
