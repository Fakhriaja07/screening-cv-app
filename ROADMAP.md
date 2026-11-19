# Roadmap Publik — Screening CV

Disusun 2026-11-18 (malam) dari kondisi situs yang sudah live di
https://screening-cv-app.vercel.app/ dan repo
https://github.com/Fakhriaja07/screening-cv-app.
Terakhir diperbarui 2026-11-19: Fase 0, Fase 1, dan Fase 2 selesai;
Fase 3 (Mode HRD) dibatalkan atas keputusan pengguna; kartu bagikan
Fase 4 sempat selesai lalu **DICABUT** atas keputusan pengguna
(2026-11-19), testimoni & distribusi berjalan terus. Pada hari yang
sama penilaian sempat diperketat lewat kuota angka, lalu **dirombak
menjadi pengetatan berbasis aspek** atas koreksi pengguna — lihat
bagian "Pengetatan penilaian".

## Nilai jual yang sudah dimiliki (terverifikasi di kode)

- **Privasi:** analisis 100% di browser, CV tidak diunggah ke server
  (`src/lib/analyze.ts`, `src/lib/readFile.ts` — rule-based, tanpa backend).
- **Gratis, tanpa daftar, hasil seketika:** tanpa akun/paywall di tengah hasil.
- **Untuk Indonesia:** Bahasa Indonesia penuh; deteksi nomor HP 08 / +62 /
  format kurung; deteksi link portofolio (GitHub, Vercel, Notion, dll).
- **Skor jujur & transparan:** 100 poin, 6 aspek, 20 pemeriksaan
  (+1 kondisional: relevansi ringkasan bila posisi target diisi);
  CV kuat 96, CV menengah 58, CV lemah 16 (uji di
  `scripts/run-tests.ts`, setelah rombakan berbasis aspek 2026-11-19;
  riwayat: 100/57/16 di v1, lalu 93/51/7 pada pengetatan kuota angka
  yang dibatalkan — lihat "Pengetatan penilaian").
  Bobot dan cara hitung dibuka di halaman "Bagaimana skor dihitung?".
- **Bisa langsung ditindaklanjuti:** prioritas perbaikan terurut + cek kata
  kunci terhadap deskripsi lowongan + tombol salin laporan.

## Yang masih kurang (terverifikasi di kode, 2026-11-18)

- ~~`index.html` hanya punya `<title>` — tanpa meta description,
  tanpa Open Graph/Twitter card, tanpa sitemap/robots.~~
  **Selesai di Fase 0 (2026-11-19).**
- ~~Tidak ada riwayat skor: tidak ada `localStorage`, tidak ada
  perbandingan sebelum vs sesudah revisi.~~
  **Selesai di Fase 1 (2026-11-19)** — lihat catatan Fase 1 di bawah.
- ~~Hasil hanya bilang *apa* yang kurang, belum memberi **contoh kalimat
  perbaikan** ("tulis seperti ini").~~
  **Selesai di Fase 2 (2026-11-19)** — lihat catatan Fase 2 di bawah.
- Tidak ada mode HRD / unggah banyak CV sekaligus dan ranking.
  **Mode HRD dibatalkan** atas keputusan pengguna (2026-11-19) — target
  pasar hanya pencari kerja, bukan rekruter. Lihat Fase 3.
- ~~Tidak ada tombol bagikan hasil.~~
  **Sempat selesai di Fase 4 (2026-11-19), lalu DICABUT pada hari yang
  sama atas keputusan pengguna** — lihat catatan Fase 4 di bawah.
  Bukti sosial (testimoni nyata) memang belum ada — menunggu pengguna
  nyata; tidak dibuat-buat.

## Urutan yang disarankan

### Fase 0 — Ditemukan orang (kecil, dulu)
- Tambah meta description + Open Graph/Twitter di `index.html`,
  sitemap + robots, dan tegaskan privasi di hero.
- Sasaran kata kunci: "cek CV ATS gratis", "penilaian CV bahasa Indonesia".
- Effort: kecil. Dampak: orang bisa menemukan dan membagikan situsnya.

### Fase 1 — Alasan untuk kembali (sedang) — SELESAI 2026-11-19
- Simpan skor terakhir di `localStorage`; saat CV dianalisis ulang,
  tampilkan "sebelum → sesudah" dan selisih skornya.
- Effort: sedang. Dampak: pengguna punya alasan revisi lalu kembali.
- Implementasi: modul `src/lib/history.ts` (kunci
  `screening-cv:history:v1`, maks 10 entri) menyimpan HANYA skor —
  waktu, skor total, skor per aspek, label, posisi target — tanpa teks
  CV, jadi janji privasi tetap utuh. Kartu "Riwayat Skor" di hasil
  menampilkan perbandingan cek terakhir → sekarang (total + per aspek,
  dengan kata Naik/Turun/Tetap), daftar 5 riwayat terakhir, catatan
  privasi, dan tombol "Hapus riwayat". Uji unit di
  `scripts/run-tests.ts`.

### Fase 2 — Contoh kalimat perbaikan (sedang) — SELESAI 2026-11-19
- Untuk tiap prioritas perbaikan, beri 1 contoh "sebelum → sesudah",
  mis. pengalaman tanpa angka → "Meningkatkan penjualan 30% dalam
  6 bulan dengan …", plus template ringkasan dan daftar skill.
- Effort: sedang. Dampak: ini yang membedakan dari sekadar "skor".
- Implementasi: modul `src/lib/examples.ts` memetakan id pemeriksaan
  (ke-14-nya) ke contoh {sebelum, sesudah, catatan} generik-ilustratif —
  angka memakai placeholder [kurung siku] agar tidak mengarang
  pengalaman pengguna. Item prioritas di hasil menampilkan toggle
  "Lihat contoh". Kartu "Template Ringkasan & Daftar Skill" berisi
  template ringkasan isi-titik-titik (posisi target terisi otomatis,
  ada tombol salin) dan daftar skill saran untuk 8 peran umum +
  fallback Umum/Fresh Graduate, dicocokkan sederhana terhadap teks CV
  (sudah ada / belum) dengan label jujur bahwa ini saran umum. Logika
  skor di `analyze.ts` tidak berubah oleh Fase 2 (skor uji saat itu
  100/57/16; skor diperketat belakangan pada 2026-11-19 menjadi
  93/51/7 — lihat "Pengetatan penilaian"). Uji di `scripts/run-tests.ts`.

### Fase 3 — Mode HRD — **DIBATALKAN** (keputusan pengguna, 2026-11-19)
- **DIBATALKAN, tidak dikerjakan.** Target pasar Screening CV hanya
  pencari kerja dan fresh graduate, bukan rekruter/HRD, jadi mode ini
  tidak lagi relevan. Bagian di bawah dipertahankan sebagai catatan
  keputusan, bukan rencana aktif.
- ~~Unggah banyak CV sekaligus, ranking terhadap satu lowongan,
  ekspor CSV hasil. Tetap client-side sebisa mungkin.~~
- ~~Effort: besar. Dampak: segmen kedua (rekruter/HRD), peluang monetisasi.~~
- ~~Jangan dikerjakan sebelum Fase 0–2, karena mode HRD butuh
  kepercayaan dari pengguna individu dulu.~~

### Fase 4 — Bukti sosial & distribusi (berjalan terus)
- Kartu hasil yang bisa dibagikan (skor + 1 perbaikan utama),
  testimoni, contoh CV sebelum/sesudah.
- Bagikan ke komunitas pencari kerja, kampus, grup Telegram/WhatsApp.
- Catatan: penghitung "CV sudah dianalisis" butuh server — jangan
  dibuat angka palsu; kalau mau, pakai testimoni nyata saja dulu.
- **Kartu bagikan: SELESAI 2026-11-19, lalu DICABUT pada hari yang
  sama atas keputusan pengguna (2026-11-19).** Sempat diimplementasikan
  sebagai modul `src/lib/share.ts` — teks bagikan (skor, verdict,
  posisi target, 1 perbaikan utama, URL situs; tanpa isi CV/data
  pribadi), tombol WhatsApp/Telegram/X/Salin Teks, dan unduhan kartu
  gambar PNG 1200×630 client-side. Pengguna memutuskan fitur ini tidak
  diperlukan, jadi kartu "Bagikan Hasil", modul, gaya, dan ujinya
  dihapus total dari kode dan dari situs live — dicatat di sini agar
  riwayat keputusannya jelas, bukan dihapus diam-diam.
- Testimoni & distribusi ke komunitas: **berjalan terus** (aktivitas
  pengguna, bukan kode) dan sengaja TANPA testimoni palsu maupun
  penghitung palsu — ditunggu dari pengguna nyata.

### Pengetatan penilaian — 2026-11-19 (pendekatan kuota DIGANTIKAN rombakan berbasis aspek di bawah)

Atas masukan pengguna bahwa skor terlalu mudah tinggi (CV contoh kuat
mencapai 100/100 sehingga penilaian terlihat tidak profesional),
`src/lib/analyze.ts` diperketat. Total tetap 100 poin, 6 aspek, dan
14 pemeriksaan dengan id yang sama (pemetaan contoh Fase 2 utuh);
yang berubah adalah syarat poin penuh — kini hanya untuk kualitas
yang benar-benar kuat, bukan sekadar "ada":

- **Hasil terukur:** penuh hanya bila ≥3 angka pencapaian *berbeda*
  di bagian pengalaman (sebelumnya menghitung kemunculan di seluruh CV).
- **Kata kerja aksi:** penuh hanya bila ≥70% bullet pengalaman diawali
  kata kerja aksi kuat, dikombinasikan dengan variasi kata kerja.
- **Struktur pengalaman:** penuh mensyaratkan entri lengkap (jabatan +
  perusahaan + periode) dalam bullet konsisten; paragraf dibatasi.
- **Ringkasan:** penuh mensyaratkan 30–80 kata + bidang/posisi atau
  lama pengalaman + minimal satu kekuatan/skill.
- **Keahlian:** penuh hanya bila ≥10 skill (sebelumnya 8).
- **Pendidikan:** penuh mensyaratkan institusi + jurusan + tahun lulus
  terbaca (sebelumnya cukup "tercantum").
- **Panjang CV:** jendela ideal 350–1.000 kata (sebelumnya 220–900),
  bertingkat di luarnya dan lebih berat untuk CV sangat pendek.
- **Ambang verdict naik:** ≥90 Sangat Siap Dilamar, ≥75 Sudah Bagus,
  ≥55 Perlu Perbaikan, <55 Perlu Dirombak Dulu.
- **Kalibrasi baru (terkunci di uji):** CV kuat 100 → **93**, CV
  menengah 57 → **51**, CV lemah 16 → **7**.

### Rombakan pengetatan: berbasis aspek, bukan kuota angka — 2026-11-19

Pengguna mengoreksi pendekatan di atas dengan kata-katanya:
*"jangan perketatnya melalui angka2 itu, tapi dari aspek yg dinilai"*.
Pengetatan berbasis kuota (≥3 angka berbeda, ≥70% + ≥6 kata kerja,
≥10 skill, jendela 350–1.000 kata, ambang label ≥90/≥75/≥55)
**dibatalkan dan dikembalikan ke aturan v1** (ambang label ≥85/≥70/≥50;
kata kerja aksi penuh pada ≥5 kata berbeda; hasil terukur ≥3; skill
penuh ≥8; panjang ideal 220–900 kata). Kekuatan penilaian kini datang
dari **keluasan dan kedalaman aspek yang dinilai** — dimensi kualitas
yang sebelumnya tidak dinilai sama sekali kini diperiksa. Bobot
didistribusikan ulang di dalam aspek yang sama; total tetap 100 poin
dan 6 aspek. Pemeriksaan baru (id pemeriksaan lama tidak berubah,
pemetaan contoh Fase 2 utuh dan diperluas):

- **Kedalaman entri pengalaman (5, Pengalaman):** tiap entri dinilai
  kelengkapannya — jabatan + perusahaan + periode + uraian isi. Entri
  yang hanya berisi judul/periode tanpa uraian dinilai kurang dan
  dilaporkan jumlahnya.
- **Frasa lemah & klise (3, Pengalaman):** frasa generik tanpa bukti
  ("bertanggung jawab atas", "pekerja keras", "mampu bekerja di bawah
  tekanan", "dapat bekerja dalam tim maupun individu", "bersedia
  ditempatkan di mana saja") dideteksi dan dilaporkan apa adanya.
  Hanya dinilai bila ada bagian ringkasan/pengalaman, agar CV kosong
  tidak mendapat poin dari ketiadaan frasa.
- **Sertifikasi & pelatihan (3, Pendidikan):** bagian pendukung
  profesional tersendiri; hanya disebut tanpa bagian = poin sebagian.
- **Bahasa asing (2, Keahlian):** bagian bahasa tersendiri beserta
  tingkat kemahiran; hanya disebut (mis. sebagai item skill) = sebagian.
- **Konsistensi format & urutan (3, Format & ATS):** gaya penulisan
  periode harus seragam di seluruh CV (rentang tahun vs bulan–tahun vs
  angka tidak dicampur) dan entri pengalaman diurutkan dari yang
  terbaru (kronologis terbalik); pelanggaran dilaporkan dengan contoh
  gaya yang ditemukan.
- **Kerapian bahasa (2, Format & ATS):** kata ganti "saya" berlebihan
  (≥4 kali) di bagian pengalaman, dan kata dari daftar kecil yang
  sering salah eja (aktifitas, praktek, ijin, resiko, dst. — bentuk
  baku KBBI dilaporkan). Dinyatakan jujur sebagai pemeriksaan dasar
  dari daftar kecil, bukan tata bahasa menyeluruh.
- **Relevansi ringkasan (3, Ringkasan — kondisional):** hanya muncul
  bila posisi target diisi; sebagian poin ringkasan (maks ringkasan
  menjadi 7 + relevansi 3) menilai apakah ringkasan menyebut
  posisi/bidang yang dituju.

Bobot pemeriksaan lama di dalam aspeknya diskalakan untuk memberi
ruang (mis. Pengalaman: heading 10→6, kata kerja aksi 8→6, hasil
terukur 10→8; Format: panjang 10→8, periode 5→4, bullet 5→3) —
ambang/syaratnya tetap v1, hanya nilai poinnya yang dibagi ulang.

**Kalibrasi hasil rombakan (terkunci di uji):** CV kuat 100 (v1) →
**96** — kehilangan poin murni dari aspek baru: belum ada bagian
sertifikasi/pelatihan (−3) dan bahasa asing hanya disebut sebagai
skill tanpa bagian/tingkat kemahiran (−1). CV menengah 57 → **58**:
lolos beberapa aspek kualitas baru secara sah (entri magangnya lengkap
dengan uraian 5/5, tanpa frasa klise 3/3, bahasa rapi 2/2) tetapi tetap
gagal di dasar yang besar (hasil terukur 0, skill sedikit, tanpa
sertifikasi/bahasa/IPK/portofolio). CV lemah tetap **16**: aspek baru
tidak memberinya poin cuma-cuma. Angka tidak direkayasa mengejar
target — keketatan terjelaskan oleh aspek baru yang gagal dipenuhi.

## Parameter yang menentukan orang mau pakai (tolok ukurnya)

- Akurasi yang terasa benar: hasil cocok dengan intuisi pengguna.
- Cepat & enak di HP: buka → hasil < 1 menit.
- Manfaat sebelum/sesudah yang terlihat dan bisa dibagikan.
- Bukti sosial dan mudah ditemukan lewat pencarian.

## Keputusan yang masih di tangan Ehsan

1. ~~Mulai dari Fase 0 + 1, atau langsung loncat ke Fase 3 (Mode HRD)?~~
   **Sudah diputuskan (2026-11-19):** urutan Fase 0 → 1 → 2 dikerjakan,
   dan Mode HRD (Fase 3) dibatalkan — target pasar hanya pencari kerja.
2. ~~Kalau Mode HRD: tetap gratis dulu untuk mengumpulkan pengguna,
   atau langsung berbayar per batch?~~
   **Tidak berlaku lagi** — Fase 3 dibatalkan.
