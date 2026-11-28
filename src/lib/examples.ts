// Contoh kalimat perbaikan per pemeriksaan + template ringkasan + kamus
// skill per peran — Fase 2 roadmap.
//
// Semua contoh bersifat GENERIK-ILUSTRATIF: bukan klaim pengalaman pengguna.
// Angka pada contoh memakai placeholder [kurung siku] yang harus diganti
// pengguna dengan angka aslinya — aturan anti-karang yang sama seperti
// fitur Analisis AI. Modul ini hanya MEMBACA hasil analyze.ts; logika dan
// angka skor tidak diubah sama sekali.

// ---------- Contoh sebelum → sesudah per id pemeriksaan ----------

import type { Lang } from './lang'

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
  'email-profesional': {
    sebelum: 'Email: budi.cakepz123@gmail.com',
    sesudah: 'Email: budi.santoso@gmail.com',
    catatan:
      'Alamat email adalah kesan pertama sebelum CV dibuka. Buat alamat khusus melamar dari nama aslimu (nama.kamu@…, namakamu@…); sedikit angka seperti tahun lahir masih wajar, tetapi hindari kata panggilan/alay dan deretan angka panjang. Jangan lupa alamat baru ini yang kamu cantumkan di semua lamaran.',
  },
  'kestabilan-karier': {
    sebelum:
      'Pengalaman\nKasir — Toko A (2023)\nStaf Toko — Toko B (2023)\nAdmin — PT C (2024)\n(3 peran formal selesai di tahun yang sama dengan tahun mulainya, tanpa penjelasan)',
    sesudah:
      'Pengalaman\nKasir — Toko A (kontrak, Jan–Jun 2023)\nStaf Toko — Toko B (freelance, 2023)\nAdmin — PT C (2024–Sekarang)\n(peran singkat diberi label jenisnya secara eksplisit — tanggal tidak diubah)',
    catatan:
      'Jangan pernah memalsukan atau memperpanjang tanggal demi terlihat stabil — itu terbongkar saat verifikasi. Bila peran singkatmu memang kontrak/proyek/freelance, tulis jenisnya eksplisit di judul entri; bila dua peran berjalan bersamaan dan salah satunya paruh waktu, tulis "paruh waktu". Yang dinilai rekruter adalah kejujuran pola riwayatmu.',
  },
  'konsistensi-klaim': {
    sebelum:
      'Ringkasan: "Staf administrasi dengan pengalaman 8 tahun di bidang perkantoran." (linimasa pengalaman yang tertulis: Admin — PT C (2022–2024) saja, total sekitar 2 tahun)',
    sesudah:
      'Ringkasan: "Staf administrasi dengan pengalaman [2 tahun] di bidang perkantoran." — ATAU lengkapi entri pengalaman lama yang belum tertulis beserta periodenya sampai linimasamu benar-benar menjumlah ke angka yang kamu klaim.',
    catatan:
      'Rekruter menjumlahkan tanggal-tanggalmu. Klaim "X tahun pengalaman" harus bisa diverifikasi dari periode entri pengalamanmu sendiri: sesuaikan klaimnya dengan total durasi nyata, atau tambahkan pekerjaan lama yang memang belum tertulis (dengan periode yang benar). Angka di [kurung siku] diganti angka hasil hitungan linimasamu yang sebenarnya.',
  },
  'nama-file': {
    sebelum: 'Nama file yang dikirim: document(1).pdf — atau: CV final bangettt.pdf',
    sesudah: 'Nama file yang dikirim: CV_Budi_Santoso.pdf — atau: BudiSantoso_DataAnalyst.pdf',
    catatan:
      'Rekruter dan sistem ATS melihat nama file sebelum membuka CV-mu, dan puluhan file bernama "document(1)" mudah tertukar. Pola aman: CV_Nama_Posisi.pdf — tanpa kata draf seperti "final/revisi/fix", tanpa nama hasil unduhan atau scan.',
  },
}

// Terjemahan bahasa Inggris PENUH dari CHECK_EXAMPLES: fakta, angka, dan
// placeholder [kurung siku] dipertahankan persis; nama contoh (Andi, Budi,
// Toko Berkah, PT Logistik Jaya, SMK Negeri 1 Jakarta) tidak diubah.
export const CHECK_EXAMPLES_EN: Record<string, CheckExample> = {
  'hasil-terukur': {
    sebelum: 'Responsible for sales at the store and serving customers every day.',
    sesudah:
      'Increased store sales by [30%] in [6 months] by rearranging product displays and serving [50+] customers per day.',
    catatan:
      'The numbers in [square brackets] are just example patterns — replace them with your real numbers, or remove them if you do not have the data. Never invent numbers.',
  },
  'kata-kerja-aksi': {
    sebelum: 'In charge of data entry and preparing reports for the team.',
    sesudah: 'Managed daily data entry and prepared weekly reports for a team of [10] people.',
    catatan:
      'Start every bullet with an action verb: increased, managed, built, analyzed, led, designed, automated, achieved, reduced.',
  },
  bullet: {
    sebelum:
      'My duties included data entry, preparing monthly reports, archiving documents, and answering phone calls from customers.',
    sesudah:
      '• Entered daily transaction data into Microsoft Excel\n• Prepared monthly reports for the manager\n• Archived [200+] documents per month\n• Answered phone calls and customer questions',
    catatan:
      'One bullet = one task/achievement. A bullet structure makes your CV easy for recruiters to scan and keeps it readable for ATS systems.',
  },
  ringkasan: {
    sebelum:
      'I am a hardworking, honest person who can work under pressure. I am looking for new experience.',
    sesudah:
      'Administrative Staff member with [2 years] of experience in office administration. Skilled in using Microsoft Excel and Google Workspace for data entry and report preparation. Currently seeking an Administration position at a well-structured company.',
    catatan:
      'A strong summary states: profession + years of experience + 2–3 main skills + the position you are seeking. Clichés without evidence ("hardworking, honest") add no value.',
  },
  email: {
    sebelum: 'Contact: andi.ganteng99 (email address to follow)',
    sesudah: 'Email: andi.pratama@gmail.com',
    catatan:
      'Use a professional, active email address — ideally based on your real name — because recruiter replies will go to this address.',
  },
  hp: {
    sebelum: 'Phone: (021) 555-1234 (office phone)',
    sesudah: 'Mobile/WhatsApp: +62 812-3456-7890',
    catatan:
      'List a personal mobile number that is active and reachable via WhatsApp, not an office number. Both the 08xx and +62 formats are readable.',
  },
  linkedin: {
    sebelum: '(no LinkedIn link on the CV yet)',
    sesudah: 'LinkedIn: linkedin.com/in/andi-pratama',
    catatan:
      'Keep your LinkedIn content consistent with your CV (job title, company, period) so recruiters can easily verify your profile.',
  },
  portofolio: {
    sebelum: 'Portfolio: available, can be asked about during the interview.',
    sesudah:
      'Portfolio: github.com/andipratama (for design: behance.net/andipratama; for data: kaggle.com/andipratama)',
    catatan:
      'The word "portfolio" alone is not read as a link — write the full address. For non-technical roles, a link containing samples of your work also helps.',
  },
  keahlian: {
    sebelum: 'Skills: computers, internet.',
    sesudah:
      'Skills: Microsoft Excel (PivotTable, VLOOKUP), Microsoft Word, Google Workspace, Canva, Data Entry, Digital Filing, Communication, Teamwork',
    catatan:
      'List at least 8 specific skills and separate them with commas. Tool names are far stronger than general words like "computers".',
  },
  panjang: {
    sebelum: 'The CV only contains a name, one introductory sentence, and school history (under 60 words).',
    sesudah:
      'A 1–2 page CV (220–900 words): a 3–4 sentence summary, experience written as achievement bullets, education, and a skills list.',
    catatan:
      'Too short looks empty; too long is tiring. If yours is still short, add content from internships, organizations, projects, or certifications.',
  },
  'kedalaman-entri': {
    sebelum:
      'Experience\nCashier — Toko Berkah (2022–2023)\nWarehouse Staff — PT Logistik Jaya (2021–2022)',
    sesudah:
      'Experience\nCashier — Toko Berkah (2022–2023)\n• Served [100+] transactions per day (cash and QRIS)\n• Recorded daily cash discrepancies with zero discrepancy for [6 months]\nWarehouse Staff — PT Logistik Jaya (2021–2022)\n• Recorded [500+] stock items moving in and out per week\n• Rearranged warehouse shelving so item retrieval time dropped by [20%]',
    catatan:
      'Every experience entry must be complete: job title + company + period + a description of the work. An entry that only contains a title looks like an empty history — recruiters cannot judge what you actually did.',
  },
  'frasa-lemah': {
    sebelum:
      'I am a hard worker, able to work under pressure, able to work in a team or individually, and responsible for the cleanliness of the store.',
    sesudah:
      'Kept the store area clean and tidy every day, passing the branch cleanliness audit with a score of [95]. Trained [2] new cashiers until they could work independently within [2 weeks].',
    catatan:
      'Cliché phrases ("hard worker", "responsible for", "willing to be placed anywhere") are claimed by almost every applicant, so they do not set you apart. Replace them with evidence: work results, numbers, or real examples.',
  },
  sertifikasi: {
    sebelum: '(no certifications/training section on the CV)',
    sesudah:
      'Certifications & Training\n• Certificate in [certification name] — [issuing institution] ([year])\n• Training in [training topic] — [organizer] ([year])',
    catatan:
      'Only list certificates you genuinely hold and that are relevant to the position you are applying for. A dedicated section makes certifications easy for recruiters and ATS systems to find.',
  },
  bahasa: {
    sebelum: '(foreign language skills are not mentioned at all on the CV)',
    sesudah:
      'Languages\n• English — fluent (spoken and written)\n• Mandarin — basic (everyday conversation)',
    catatan:
      'Write the languages you speak together with your proficiency level, honestly. If you have an official test score (e.g. TOEFL/IELTS), include it — that is verifiable evidence.',
  },
  'konsistensi-format': {
    sebelum:
      'Experience\nCashier — Toko Berkah (Jan 2021 - Dec 2022)\nWarehouse Staff — PT Logistik (2023–2024)',
    sesudah:
      'Experience\nWarehouse Staff — PT Logistik (2023–2024)\nCashier — Toko Berkah (2021–2022)',
    catatan:
      'Two things are checked: (1) a consistent period format — pick ONE style (e.g. always "2021–2024" or always "Jan 2021 – Dec 2022"), do not mix them; (2) entries ordered from the most recent, because recruiters read from your latest experience.',
  },
  'kerapian-bahasa': {
    sebelum:
      'I performed cashier activities every day. I changed the duty schedule and I checked stock in the warehouse.',
    sesudah:
      'Performed cashier duties every day, updated the duty schedule, and checked warehouse stock.',
    catatan:
      'Two habits are assessed: avoid starting experience bullets with "I …" over and over (go straight to the verb), and use correct spelling — aktifitas → aktivitas, merubah → mengubah, praktek → praktik, ijin → izin.',
  },
  'relevansi-ringkasan': {
    sebelum:
      'A fresh graduate who is looking for a job and wants to develop themselves at a good company.',
    sesudah:
      'Graduate of SMK Office Administration with internship experience in data entry and filing. Skilled in Microsoft Excel and Google Workspace. Seeking a Staff Administration position to contribute to the tidiness of company data and documents.',
    catatan:
      'Explicitly state the position/field you are aiming for in your summary (matching the target position you entered). A generic summary forces recruiters to guess what you are applying as.',
  },
  periode: {
    sebelum: 'Experience: Cashier at Toko Berkah (no years given).',
    sesudah: 'Cashier — Toko Berkah, Jakarta (Jan 2022 – Dec 2023)',
    catatan:
      'Write the start and end month/year for every job and education entry so the order of your journey is clear to recruiters.',
  },
  lokasi: {
    sebelum: 'Contact: andi.pratama@gmail.com | 0812-3456-7890 (no city of residence)',
    sesudah: 'Contact: andi.pratama@gmail.com | 0812-3456-7890 | Based in: Bandung',
    catatan:
      'Many recruiters filter candidates by place of residence before reading the CV content. Just write your current city in the contact line — there is no need for a full address.',
  },
  linimasa: {
    sebelum:
      'Experience\nCashier — Toko Berkah (2015–2016)\nWarehouse Staff — PT Logistik Jaya (2021–2022)\n(there is an unexplained gap in 2017–2020, and no role after 2022)',
    sesudah:
      'Experience\nWarehouse Staff — PT Logistik Jaya (2021–2022)\nCashier — Toko Berkah (2015–2016)\n2017–2020: Ran the family online store and took computer training',
    catatan:
      'A gap is not automatically bad — what makes recruiters hesitate is a gap WITHOUT an explanation. One line describing what filled it (study, a business, family, courses) closes that question. Also include your current role if it is still ongoing ("2023–Present").',
  },
  proyek: {
    sebelum: '(no projects/internships section — the fresh graduate CV only contains education and skills)',
    sesudah:
      'Projects & Internships\n• Data entry internship at [place name] ([year]): entered [500+] customer records into Excel\n• School project: built a digital library archive system with Google Drive, used by [300] students',
    catatan:
      'For fresh graduates, projects, internships, work placements, and organizational experience described with tasks + results are your main evidence of experience. Write them like work experience entries: place, period, tasks, and results.',
  },
  'relevansi-pengalaman': {
    sebelum:
      'Experience (for applying to a Data Analyst position)\nCashier — Toko Berkah (2022–2023)\n• Handled payments and recorded daily cash',
    sesudah:
      'Experience (for applying to a Data Analyst position)\nCashier — Toko Berkah (2022–2023)\n• Compiled daily sales data into Excel and created weekly trend reports for the store owner\n• Analyzed best-selling products from transaction data to determine stock',
    catatan:
      'Recruiters assess whether your experience relates to the field you are targeting. Highlight tasks that use the target field\'s keywords (in this example: data, reports, analysis) — only ones you actually did.',
  },
  'kecocokan-lowongan': {
    sebelum:
      'Skills: Microsoft Excel, communication, teamwork. (The vacancy asks for: SQL, Python, dashboards, data visualization — none of them appear on the CV)',
    sesudah:
      'Skills: Microsoft Excel (PivotTable, VLOOKUP), basic SQL, Python for data processing, Power BI for dashboards and data visualization.',
    catatan:
      'Read the job description, find its main skill/task keywords, then mirror the SAME words in your CV — only for things you genuinely master. ATS systems and recruiters both look for those exact keywords; including keywords you do not master will be exposed during the interview.',
  },
  'pengalaman-heading': {
    sebelum: '(work history written merged into a single paragraph without section headings)',
    sesudah: 'Experience\nCashier — Toko Berkah (2022–2023)\n• Handled cash and QRIS payments…',
    catatan:
      'Standard section headings ("Experience", "Education", "Skills") help recruiters and ATS systems find the content of your CV.',
  },
  pendidikan: {
    sebelum: '(education section empty / not written)',
    sesudah: 'Education\nSMK Negeri 1 Jakarta — Office Administration major (2020–2023)',
    catatan:
      'State your highest level of education and the name of the institution, even if it is only high school/vocational school — recruiters still assess this section.',
  },
  ipk: {
    sebelum: 'Education: Bachelor\'s in Management — Example University',
    sesudah: 'Education: Bachelor\'s in Management — Example University (GPA 3.45/4.00)',
    catatan:
      'Include your GPA if it is 3.00 or above. If it is below that, skip it and highlight your experience and skills instead.',
  },
  'email-profesional': {
    sebelum: 'Email: budi.cakepz123@gmail.com',
    sesudah: 'Email: budi.santoso@gmail.com',
    catatan:
      'Your email address is the first impression before your CV is even opened. Create a dedicated job-application address from your real name (your.name@…, yourname@…); a few numbers such as a birth year are still reasonable, but avoid nicknames/slang and long strings of numbers. Do not forget to use this new address on all your applications.',
  },
  'kestabilan-karier': {
    sebelum:
      'Experience\nCashier — Store A (2023)\nStore Staff — Store B (2023)\nAdmin — PT C (2024)\n(3 formal roles ended in the same year they started, with no explanation)',
    sesudah:
      'Experience\nCashier — Store A (contract, Jan–Jun 2023)\nStore Staff — Store B (freelance, 2023)\nAdmin — PT C (2024–Present)\n(short roles are explicitly labeled by type — the dates are not changed)',
    catatan:
      'Never falsify or extend dates to look stable — that is exposed during verification. If your short role really was a contract/project/freelance role, state its type explicitly in the entry title; if two roles ran at the same time and one of them was part-time, write "part-time". What recruiters assess is the honesty of your history pattern.',
  },
  'konsistensi-klaim': {
    sebelum:
      'Summary: "Administrative staff with 8 years of experience in office work." (the written experience timeline: Admin — PT C (2022–2024) only, totaling about 2 years)',
    sesudah:
      'Summary: "Administrative staff with [2 years] of experience in office work." — OR add the older experience entries that are not yet written, with their periods, until your timeline truly adds up to the number you claim.',
    catatan:
      'Recruiters add up your dates. An "X years of experience" claim must be verifiable from the periods of your own experience entries: adjust the claim to the real total duration, or add older jobs that simply have not been written yet (with the correct periods). Replace the number in [square brackets] with the number from actually adding up your timeline.',
  },
  'nama-file': {
    sebelum: 'File name sent: document(1).pdf — or: CV final bangettt.pdf',
    sesudah: 'File name sent: CV_Budi_Santoso.pdf — or: BudiSantoso_DataAnalyst.pdf',
    catatan:
      'Recruiters and ATS systems see the file name before opening your CV, and dozens of files named "document(1)" are easily mixed up. A safe pattern: CV_Name_Position.pdf — without draft words like "final/revision/fix", and without downloaded or scanned file names.',
  },
}

export function getCheckExample(checkId: string, lang: Lang = 'id'): CheckExample | null {
  if (lang === 'en') return CHECK_EXAMPLES_EN[checkId] ?? null
  return CHECK_EXAMPLES[checkId] ?? null
}

// ---------- Template ringkasan profil ----------

// Template isi-titik-titik. Posisi target pengguna disisipkan otomatis bila
// diisi; semua bagian lain tetap placeholder [kurung siku] untuk diganti
// dengan data asli pengguna.
export function buildSummaryTemplate(targetRole: string, lang: Lang = 'id'): string {
  const role = targetRole.trim()
  if (lang === 'en') {
    const roleText = role ? role : '[the position you are applying for]'
    return (
      `[Your profession or field of study] with [X years] of experience in [your main field]. ` +
      `Skilled in [skill 1], [skill 2], and [skill 3], with a track record that includes [your strongest achievement — use numbers where you can]. ` +
      `Currently seeking a ${roleText} position where I can contribute to [the kind of company or team you want to join].`
    )
  }
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
    // Sengaja SEBELUM entri 'developer': pencocokan kamus memakai frasa
    // terpanjang dan seri dimenangkan entri pertama, jadi kata kunci
    // 'full stack'/'fullstack' jatuh ke peran yang lebih spesifik ini.
    id: 'full-stack',
    label: 'Full Stack Developer',
    keywords: ['full stack developer', 'fullstack developer', 'full-stack developer', 'full stack', 'fullstack', 'full-stack'],
    skills: [
      'JavaScript', 'TypeScript', 'React', 'Node.js & Express', 'REST API',
      'SQL', 'MongoDB', 'Git & GitHub', 'HTML & CSS', 'Bahasa Inggris',
    ],
  },
  {
    // Sengaja SEBELUM entri 'developer': kata kunci spesifik mobile
    // ('mobile developer', 'android developer', dst.) hanya ada di
    // sini — entri developer umum di bawah tidak memuatnya — jadi
    // masukan mobile selalu jatuh ke peran ini, sementara masukan
    // developer umum ('programmer', 'software developer',
    // 'web developer') tetap ke entri developer.
    id: 'mobile-developer',
    label: 'Mobile Developer',
    keywords: ['mobile developer', 'android developer', 'ios developer', 'flutter developer', 'react native developer', 'mobile', 'android'],
    skills: [
      'Flutter & Dart', 'Kotlin', 'Swift', 'React Native', 'Android Studio',
      'REST API', 'Firebase', 'Git & GitHub', 'UI/UX Mobile', 'Bahasa Inggris',
    ],
  },
  {
    id: 'developer',
    label: 'Software Developer / Programmer',
    // Kata kunci 'full stack'/'fullstack' dan frasa mobile
    // ('mobile developer' dst.) sengaja TIDAK di sini — sudah
    // ditangani entri 'full-stack' dan 'mobile-developer' yang lebih
    // spesifik di atas, dengan hasil pencocokan yang sama.
    keywords: ['programmer', 'programer', 'software developer', 'developer', 'software engineer', 'web developer', 'frontend', 'backend'],
    skills: [
      'JavaScript', 'TypeScript', 'React', 'Node.js', 'Git & GitHub',
      'REST API', 'SQL', 'HTML & CSS', 'Testing & Debugging', 'Bahasa Inggris',
    ],
  },
]

// Label peran dalam bahasa Inggris, per id peran di ROLE_SKILLS
// (ditambah 'umum' untuk FALLBACK_ROLE_SKILLS). Hanya dipakai untuk
// label tampilan saat mode 'en' — data pencocokan tidak berubah.
export const ROLE_LABEL_EN: Record<string, string> = {
  'data-analyst': 'Data Analyst',
  'administrasi': 'Administration / Office Admin',
  'marketing': 'Marketing / Digital Marketing',
  'customer-service': 'Customer Service',
  'akuntansi': 'Accounting / Finance',
  'it-support': 'IT Support',
  'sales': 'Sales',
  'desain-grafis': 'Graphic Design',
  'kasir': 'Cashier',
  'operator-produksi': 'Production Operator',
  'guru': 'Teacher / Educator',
  'perawat': 'Nurse / Healthcare Worker',
  'teknisi': 'Technician / Mechanic',
  'barista-fnb': 'Barista / F&B Service',
  'security': 'Security Guard',
  'driver': 'Driver',
  'content-creator': 'Content Creator / Social Media',
  'full-stack': 'Full Stack Developer',
  'mobile-developer': 'Mobile Developer',
  'developer': 'Software Developer / Programmer',
  'umum': 'General / Fresh Graduate',
}

// Padanan bahasa Inggris untuk SETIAP string skill yang muncul di
// ROLE_SKILLS dan FALLBACK_ROLE_SKILLS. Nama alat/proper noun yang
// sudah berbahasa Inggris (SQL, Canva, Figma, dst.) dipetakan ke
// dirinya sendiri agar kamusnya exhaustif. Ini HANYA nama tampilan:
// checkSkills tetap mencocokkan string skill aslinya ke teks CV.
export const SKILL_DISPLAY_EN: Record<string, string> = {
  '5S': '5S',
  'Accurate': 'Accurate',
  'Administrasi Perkantoran': 'Office Administration',
  'Adobe Illustrator': 'Adobe Illustrator',
  'Adobe Photoshop': 'Adobe Photoshop',
  'Analisis Data': 'Data Analysis',
  'Analisis Insight': 'Insight Analysis',
  'Android Studio': 'Android Studio',
  'Asuhan Keperawatan': 'Nursing Care',
  'Backup Data': 'Data Backup',
  'Bahasa Inggris': 'English',
  'Bela Diri Dasar': 'Basic Self-Defense',
  'Branding': 'Branding',
  'CRM': 'CRM',
  'Canva': 'Canva',
  'Content Planning': 'Content Planning',
  'Copywriting': 'Copywriting',
  'CorelDRAW': 'CorelDRAW',
  'Defensive Driving': 'Defensive Driving',
  'Dokumen Pengiriman': 'Shipping Documents',
  'Editing Video': 'Video Editing',
  'Email Marketing': 'Email Marketing',
  'Empati & Kesabaran': 'Empathy & Patience',
  'Faktur': 'Invoicing',
  'Figma': 'Figma',
  'Firebase': 'Firebase',
  'Flutter & Dart': 'Flutter & Dart',
  'Follow-up': 'Follow-up',
  'Food Safety & Hygiene': 'Food Safety & Hygiene',
  'Fotografi': 'Photography',
  'Git & GitHub': 'Git & GitHub',
  'Google Ads': 'Google Ads',
  'Google Classroom': 'Google Classroom',
  'Google Maps & Navigasi': 'Google Maps & Navigation',
  'Google Sheets': 'Google Sheets',
  'Google Workspace': 'Google Workspace',
  'HTML & CSS': 'HTML & CSS',
  'Hardware PC': 'Hardware PC',
  'Helpdesk': 'Helpdesk',
  'Input Data': 'Data Entry',
  'Instagram Reels': 'Instagram Reels',
  'Instalasi Windows': 'Windows Installation',
  'Internet': 'Internet',
  'Jaringan LAN': 'LAN Networking',
  'JavaScript': 'JavaScript',
  'Jurnal Umum': 'General Journal',
  'K3 (Keselamatan Kerja)': 'Occupational Health & Safety',
  'Kas Kecil': 'Petty Cash',
  'Kedisiplinan': 'Discipline',
  'Kelistrikan': 'Electrical Systems',
  'Kerja Shift': 'Shift Work',
  'Kerja Tim': 'Teamwork',
  'Keselamatan Berkendara': 'Safe Driving',
  'Ketelitian': 'Attention to Detail',
  'Ketepatan Waktu': 'Punctuality',
  'Komunikasi': 'Communication',
  'Komunikasi Tertulis': 'Written Communication',
  'Komunikasi Verbal': 'Verbal Communication',
  'Komunikasi dengan Orang Tua': 'Communication with Parents',
  'Kondisi Fisik Prima': 'Excellent Physical Condition',
  'Korespondensi': 'Business Correspondence',
  'Kotlin': 'Kotlin',
  'Kurikulum Merdeka': 'Merdeka Curriculum',
  'Laporan Kejadian': 'Incident Reports',
  'Laporan Keuangan': 'Financial Reporting',
  'Laporan Penjualan Harian': 'Daily Sales Reports',
  'Laporan Perawatan': 'Maintenance Reports',
  'Latte Art': 'Latte Art',
  'Layout': 'Layout',
  'Linux': 'Linux',
  'Live Chat': 'Live Chat',
  'Looker Studio': 'Looker Studio',
  'MYOB': 'MYOB',
  'Manajemen Jadwal': 'Schedule Management',
  'Manajemen Kelas': 'Classroom Management',
  'Manajemen Waktu': 'Time Management',
  'Media Pembelajaran Digital': 'Digital Learning Media',
  'Media Sosial': 'Social Media',
  'Membaca Gambar Teknik': 'Reading Technical Drawings',
  'Membaca Instruksi Kerja': 'Reading Work Instructions',
  'Mengetik Cepat': 'Fast Typing',
  'Meracik Kopi (Espresso)': 'Coffee Brewing (Espresso)',
  'Mesin Kasir (POS)': 'POS Cash Register',
  'Meta Ads': 'Meta Ads',
  'Microsoft Excel': 'Microsoft Excel',
  'Microsoft Office': 'Microsoft Office',
  'Microsoft PowerPoint': 'Microsoft PowerPoint',
  'Microsoft Word': 'Microsoft Word',
  'MongoDB': 'MongoDB',
  'Negosiasi': 'Negosiasi',
  'Node.js': 'Node.js',
  'Node.js & Express': 'Node.js & Express',
  'Patroli Keamanan': 'Security Patrols',
  'Pelayanan Pelanggan': 'Customer Service',
  'Pemberian Obat': 'Medication Administration',
  'Pembukuan': 'Bookkeeping',
  'Penanganan Gawat Darurat': 'Emergency Care',
  'Penanganan Keadaan Darurat': 'Emergency Response',
  'Penanganan Komplain': 'Complaint Handling',
  'Pencarian Prospek': 'Prospecting',
  'Pengamanan Area': 'Area Security',
  'Pengarsipan': 'Filing & Archiving',
  'Pengawasan CCTV': 'CCTV Monitoring',
  'Pengelasan Dasar': 'Basic Welding',
  'Pengetahuan Produk': 'Product Knowledge',
  'Penggunaan Alat Ukur': 'Use of Measuring Instruments',
  'Pengoperasian Mesin Produksi': 'Production Machine Operation',
  'Pengukuran Tanda Vital': 'Vital Signs Measurement',
  'Penilaian & Evaluasi Siswa': 'Student Assessment & Evaluation',
  'Perawatan Kendaraan Dasar': 'Basic Vehicle Maintenance',
  'Perawatan Mesin & Kendaraan': 'Machine & Vehicle Maintenance',
  'Perhitungan Uang Tunai': 'Cash Counting',
  'Perpajakan': 'Taxation',
  'PivotTable': 'PivotTable',
  'Power BI': 'Power BI',
  'Presentasi': 'Presentation Skills',
  'Preventive Maintenance': 'Preventive Maintenance',
  'Public Speaking': 'Public Speaking',
  'Python': 'Python',
  'QRIS & E-Wallet': 'QRIS & E-Wallet',
  'Quality Control': 'Quality Control',
  'REST API': 'REST API',
  'React': 'React',
  'React Native': 'React Native',
  'Rekam Medis': 'Medical Records',
  'Rekonsiliasi Bank': 'Bank Reconciliation',
  'Remote Desktop': 'Remote Desktop',
  'Rencana Pembelajaran (RPP)': 'Lesson Planning (RPP)',
  'SEO': 'SEO',
  'SEO Media Sosial': 'Social Media SEO',
  'SIM A': 'SIM A',
  'SIM B': 'SIM B',
  'SQL': 'SQL',
  'Statistik': 'Statistics',
  'Stok Bahan': 'Ingredient Inventory',
  'Stok Opname': 'Stock Taking',
  'Swift': 'Swift',
  'Tableau': 'Tableau',
  'Target Penjualan': 'Sales Targets',
  'Target Produksi': 'Production Targets',
  'Telepon': 'Phone Communication',
  'Teori Warna': 'Color Theory',
  'Testing & Debugging': 'Testing & Debugging',
  'TikTok': 'TikTok',
  'Tipografi': 'Typography',
  'Troubleshooting': 'Troubleshooting',
  'TypeScript': 'TypeScript',
  'UI/UX Mobile': 'UI/UX Mobile',
  'Upselling': 'Upselling',
  'Videografi': 'Videography',
  'Visualisasi Data': 'Data Visualization',
  'WhatsApp Business': 'WhatsApp Business',
}

export function skillDisplayName(skill: string, lang: Lang): string {
  return lang === 'en' ? (SKILL_DISPLAY_EN[skill] ?? skill) : skill
}

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
export function getRoleSkills(targetRole: string, lang: Lang = 'id'): RoleSkills {
  const raw = targetRole.trim()
  if (!raw) {
    return lang === 'en'
      ? { ...FALLBACK_ROLE_SKILLS, label: ROLE_LABEL_EN[FALLBACK_ROLE_SKILLS.id] ?? FALLBACK_ROLE_SKILLS.label }
      : FALLBACK_ROLE_SKILLS
  }
  const direct = matchRoleDictionary(raw)
  if (direct) {
    return lang === 'en'
      ? { ...direct, label: ROLE_LABEL_EN[direct.id] ?? direct.label }
      : direct
  }
  // Pencocokan ulang SELALU memakai perluasan bahasa Indonesia (data
  // pencocokan tidak berubah); yang berbeda saat mode 'en' hanyalah
  // label tampilannya, dari perluasan glosarium bahasa Inggris.
  const expanded = expandJobTitle(raw)
  const expandedLabel = lang === 'en' ? expandJobTitle(raw, 'en') : expanded
  if (expanded.toLowerCase() !== raw.toLowerCase()) {
    const viaGlossary = matchRoleDictionary(expanded)
    if (viaGlossary) return { ...viaGlossary, label: expandedLabel }
    return {
      id: 'kustom',
      label: expandedLabel,
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
