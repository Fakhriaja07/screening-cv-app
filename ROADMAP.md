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

## Peningkatan standar berbasis aspek (2026-11-21)

Menjawab pertanyaan pengguna apakah standar penilaian terlalu rendah:
standar dinaikkan lagi — tetap lewat **aspek yang dinilai**, bukan
menaikkan kuota angka (prinsip koreksi pengguna 2026-11-19 dipertahankan;
ambang pemeriksaan lama tidak diubah, bobot di dalam aspek dibagi ulang).

Dimensi baru yang kini dinilai — hal-hal yang paling menentukan di mata
perekrut, yang sebelumnya tidak dinilai sama sekali:

- **Kecocokan dengan Lowongan (aspek kondisional, maks 20):** kata kunci
  lowongan yang semula hanya ditampilkan terpisah kini **masuk skor**,
  hanya bila pengguna menempel deskripsi lowongan. Aspek dasar diskalakan
  proporsional (×0,8) sehingga total tetap 100; tanpa deskripsi lowongan
  komposisi skor tidak berubah. UI menyatakan ini secara transparan.
- **Relevansi pengalaman terhadap posisi target (3, Pengalaman —
  kondisional):** jabatan dan isi pengalaman dinilai keterkaitannya
  dengan bidang posisi yang dituju (sebelumnya hanya ringkasan yang
  dinilai relevansinya). Kata kerja aksi 5→4, hasil terukur 6→5, dan
  linimasa 3→2 memberi ruangnya bila posisi target diisi.
- **Linimasa pengalaman (3, Pengalaman):** kesenjangan ≥3 tahun
  antar-entri tanpa penjelasan dan peran terakhir yang berakhir ≥4 tahun
  lalu tanpa peran saat ini menurunkan poin. Tahun yang terbaca disebut
  apa adanya di pesan hasil; periode yang tidak terbaca menghasilkan
  skor 0 dengan penjelasan jujur bahwa linimasa belum bisa dinilai —
  bukan penilaian membabi buta.
- **Lokasi domisili (1, Kontak):** kota domisili di area kontak dinilai
  sebagai kelengkapan kontak (perekrut menyaring berdasarkan domisili);
  1 poin diambil dari link portofolio (3→2), total Kontak tetap 20.
- **Proyek/magang sebagai bukti pengalaman (2, Pengalaman):** bagian
  Proyek/Magang/Organisasi/PKL yang diuraikan isinya memberi nilai
  pengalaman — keadilan bagi fresh graduate, pasar utama situs ini.
  Bila pengalaman formal sudah ada, ketiadaan proyek netral (tetap 2),
  tidak menghukum pekerja berpengalaman. Bobot Pengalaman dibagi ulang:
  heading 6→5, kata kerja 6→5, hasil terukur 8→6, kedalaman 5→4.

Total pemeriksaan kini 23 + 2 kondisional (relevansi ringkasan,
relevansi pengalaman) + 1 aspek kondisional (kecocokan lowongan).
Riwayat skor menangani perbedaan komposisi antar-entri dengan catatan
perkiraan (total tetap dibandingkan). Contoh sebelum→sesudah ditambah
untuk kelima pemeriksaan/aspek baru.

**Kalibrasi hasil peningkatan (terkunci di uji):** tanpa lowongan —
CV kuat tetap **96** (portofolio −1 tertutup lokasi +1; kehilangan poin
tetap hanya dari sertifikasi & bahasa), CV menengah 58 → **61** (linimasa
magangnya bersih 3/3 dan aturan netral proyek +2, dikurangi pembagian
ulang heading/kedalaman −2; kelemahan dasarnya — hasil terukur 0, skill
sedikit — tetap terlihat), CV lemah tetap **16**. Dengan lowongan —
CV kuat + lowongan data yang cocok (kecocokan 61%) = **89**, CV yang sama
+ lowongan marketing yang tidak cocok (11%) = **79**: penurunan murni
terjelaskan aspek kecocokan 2/20. CV menengah + lowongan administrasi
yang cocok = **60** vs + lowongan marketing = **48**. CV fresh graduate
yang hanya punya proyek beruraian kini mendapat Pengalaman 10/28
(bukan nyaris nol).

## Monetisasi: Analisis AI berbayar via QRIS manual (2026-11-21)

Keputusan pengguna (2026-11-21): Analisis AI menjadi berbayar lewat QRIS
GoPay Merchant milik pengguna — jalur **manual** dulu, bukan payment
gateway. Analisis standar (rule-based) tetap gratis sepenuhnya.

- Harga **Rp5.000 per Analisis AI** — konstanta tunggal `AI_PRICE` di
  `src/lib/payment.ts`, mudah diganti. Token (saldo) disimpan di
  localStorage perangkat pengguna (kunci `screening-cv:ai-credits:v1` —
  kunci lama dipertahankan agar saldo pengguna lama tidak hilang;
  istilahnya saja yang diganti dari "kredit" menjadi "token"); setiap
  analisis AI yang **berhasil** mengonsumsi 1 token, yang gagal/error
  tidak mengurangi token.
- Alur bayar: kartu Analisis AI menampilkan gambar QRIS
  (`public/QRIS.jpeg` — file biner, diunggah manual pengguna ke GitHub
  karena push connector hanya menerima teks), nominal persis yang harus
  dibayar = harga + **kode unik 2 digit** (Rp5.0xx; kode membantu admin
  mencocokkan pembayaran di riwayat merchant dan tidak dibulatkan),
  lalu langkah 1–2–3: bayar → hubungi admin dengan bukti bayar →
  masukkan **kode token** yang diberikan admin.
- **Mekanisme token sekali pakai (diubah 2026-11-21):** semula paywall
  ini memakai tombol konfirmasi kepercayaan "Saya Sudah Membayar" —
  tombol itu **dihapus** karena pemilik membuktikan sendiri siapa pun
  bisa mengklaim kredit tanpa membayar. Penggantinya: admin memeriksa
  pembayaran (nominal unik di riwayat merchant + bukti dari pengguna),
  lalu memberikan **1 kode token sekali pakai** (`CVAI-XXXXXX`, batch
  berisi 50 kode yang dibuat dengan CSPRNG). Situs hanya menyimpan
  **hash SHA-256** kode-kode itu (`src/lib/tokenCodes.ts`); daftar kode
  asli dipegang pemilik di luar repo. Pengguna menukarkan kode di kartu
  AI: input dinormalisasi dan di-hash, dicocokkan ke daftar hash, lalu
  token bertambah tepat 1. Setelah 5 percobaan gagal berturut-turut,
  kolom kode dikunci sampai halaman dimuat ulang.
- **Batas jujurnya, dicatat apa adanya:** QRIS statis tetap tidak
  mengirim notifikasi ke situs, jadi pemeriksaan pembayaran dilakukan
  admin secara manual. Penanda kode yang sudah ditukar tersimpan **per
  perangkat** (localStorage `screening-cv:redeemed-codes:v1`), sehingga
  kode yang sama secara teknis masih bisa ditukar di perangkat lain —
  perlindungan utamanya adalah kode hanya dibagikan admin setelah
  pembayaran diperiksa, dan setiap kode hanya diterbitkan untuk satu
  pembayaran. Backend `api/analyze-ai.ts` tidak diubah; paywall ini
  murni sisi klien.
- Langkah lanjutan bila volume transaksi naik: migrasi ke payment
  gateway (QRIS dinamis per transaksi + webhook) agar pembayaran
  terverifikasi otomatis sebelum kredit diberikan.

## Integrasi Midtrans — pembayaran otomatis (dibangun 2026-11-21, menunggu kunci pengguna)

Menjawab tindak lanjut dari bagian monetisasi di atas: pengguna
memutuskan naik ke payment gateway **Midtrans** agar pembayaran
Analisis AI **terverifikasi otomatis** sebelum kredit diberikan.
Pengguna sedang mendaftar Midtrans dan mengajukan aktivasi
Production (perorangan, Starter Pack QRIS cukup KTP; verifikasi
±1–3 hari kerja menurut panduan integrasi). Integrasi di bawah sudah
dibangun dan teruji unit; ia aktif begitu pengguna memasang kunci
env di Vercel. **Paywall QRIS manual di atas TETAP menjadi jalur
aktif** sampai Production benar-benar live.

### Arsitektur

- `api/payment-config.ts` (GET) — menjawab `{ mode }` dari env
  server: `off` (kunci belum terpasang), `sandbox`, atau
  `production`; Client Key (publik, untuk Snap JS) ikut dibagikan
  bila mode bukan `off`. Server Key tidak pernah keluar dari server.
- `api/create-transaction.ts` (POST) — membuat transaksi Snap
  (`POST {snapHost}/snap/v1/transactions`, Basic Auth Server Key)
  dengan `order_id` unik `AICV-<base36>-<acak 6>`, nominal persis
  `AI_PRICE` dari konstanta bersama `src/lib/payment.ts` (tidak
  diterima dari klien), dan `enabled_payments` hanya QRIS & e-wallet:
  `["other_qris", "gopay", "shopeepay"]` (nilai QRIS generik Snap
  menurut dokumentasi resmi adalah `other_qris`). Mode `off` → 503.
- `api/check-transaction.ts` (GET `?order_id=`) — **sumber kebenaran
  pembayaran (pull-based)**: menarik status resmi dari Core API
  Midtrans (`GET {apiHost}/v2/{order_id}/status`; host API
  `api.sandbox.midtrans.com` / `api.midtrans.com`, berbeda dari host
  Snap) lalu memetakannya: `settlement` atau `capture`+fraud
  `accept` → `paid` (dengan syarat `gross_amount` persis harga);
  `pending` → `pending`; `expire`/`cancel`/`deny` → `failed`;
  404 Midtrans → `unknown`.
- `api/midtrans-notification.ts` (POST) — URL notifikasi resmi:
  memverifikasi `signature_key` terhadap SHA512(`order_id` +
  `status_code` + `gross_amount` + Server Key); cocok → 200,
  tidak cocok → 403, body tidak valid → 400. Sengaja **stateless**:
  status resmi selalu ditarik lewat check-transaction, bukan dari
  body notifikasi.
- Frontend (`src/App.tsx`, `src/lib/midtrans.ts`,
  `src/lib/midtransClient.ts`, klaim order di `src/lib/payment.ts`):
  mode dibaca dari payment-config. Mode **production** → tombol
  "Bayar Otomatis via QRIS" menggantikan bagian manual. Mode
  **sandbox** → tombol otomatis hanya tampil dengan `?paytest=1`
  (pengujian pemilik); pengguna biasa tetap melihat manual. Mode
  **off** → manual seperti sekarang. Alur otomatis: buat transaksi →
  Snap JS sesuai mode → callback Snap hanya memicu **polling**
  check-transaction (±3 detik, maks ±2 menit); kredit ditambah
  **hanya** setelah server menjawab `paid: true`, lalu order_id
  dicatat sebagai claimed di localStorage agar tidak bisa diklaim
  ulang dari browser yang sama. Callback Snap semata tidak pernah
  menambah kredit.
- Logika murni (mode dari env, host per mode, order_id, pemetaan
  status, verifikasi signature, klaim order) diuji di
  `scripts/run-tests.ts` — termasuk vektor signature lokal dengan
  kunci dummy.
- Halaman `public/privacy.html` dan `public/terms.html` ditambahkan
  (Bahasa Indonesia) dan ditautkan dari footer — selain untuk
  transparansi pengguna, kelengkapan halaman ini juga ditinjau
  Midtrans saat aktivasi Production.

### Yang dibutuhkan dari pengguna (env di Vercel)

| Env var | Isi |
| --- | --- |
| `MIDTRANS_SERVER_KEY` | Server Key dari dashboard Midtrans (Settings → Access Keys) untuk environment yang dipakai |
| `MIDTRANS_CLIENT_KEY` | Client Key dari dashboard yang sama |
| `MIDTRANS_IS_PRODUCTION` | `true` hanya bila memakai kunci Production; selain itu Sandbox |

URL notifikasi yang didaftarkan di dashboard Midtrans
(Settings → Configuration → Payment Notification URL), untuk
Sandbox maupun Production:
`https://screening-cv-app.vercel.app/api/midtrans-notification`

### Status

- Kode selesai, build bersih, semua uji lolos, dan sudah ter-push.
- Live saat ini: `/api/payment-config` menjawab `{ "mode": "off" }`
  (kunci belum dipasang — perilaku yang benar), create-transaction
  menjawab 503 rapi, halaman privasi/S&K live.
- **Menunggu:** (1) pengguna memasang kunci **Sandbox** → uji
  end-to-end Sandbox (lewat `?paytest=1`); (2) aktivasi
  **Production** disetujui Midtrans → ganti ketiga env var ke kunci
  Production + `MIDTRANS_IS_PRODUCTION=true` → jalur otomatis menjadi
  jalur utama dan bagian manual tersembunyi otomatis.
- Potongan QRIS Midtrans 0,7% per transaksi (dari Rp5.000 diterima
  bersih ±Rp4.965).

## Rencana cadangan gateway (diteliti 2026-11-21)

Konteks: akun Midtrans pengguna terkendala error login *"Your role
is not allowed to login"* — akun sudah terdaftar dan terverifikasi
email, tetapi dugaan kuat tertaut identitas GoBiz/GoPay Merchant
karena email/HP berada dalam satu kolam identitas
Midtrans/GoBiz/GoFood, dan pengguna **tidak punya nomor HP kedua**
untuk pendaftaran ulang. Jalur utama tetap berjalan: support
Midtrans memperbaiki role akun. Atas permintaan pengguna, agen
meneliti gateway cadangan di luar ekosistem GoTo; hasilnya:

- **Xendit — DINILAI TIDAK LAYAK untuk kasus ini.** (1) Dokumentasi
  onboarding Xendit hanya mengizinkan pengajuan perorangan sebagai
  sub-akun xenPlatform — perorangan tidak bisa membuka akun mandiri
  tanpa badan usaha. (2) Biaya QRIS Xendit dilaporkan 0,7% + biaya
  pemrosesan tetap Rp4.000 per transaksi (berlaku mulai 2026-10-01,
  menurut analisis pihak ketiga atas dokumentasi biaya Xendit) —
  pada harga Rp5.000 biaya totalnya ±Rp4.035 sehingga sisa bersih
  hanya ±Rp965. Aktivasi QRIS-nya sendiri diperkirakan 3–5 hari
  kerja. Xendit baru masuk akal bila kelak berbadan usaha (mis. PT
  Perorangan) dan/atau harga produk jauh lebih besar.
- **Tripay — belum bisa dipakai sekarang.** Akun personalnya paling
  ringan (cukup KTP, tanpa NPWP/badan usaha) dan biaya QRIS-nya
  Rp750 + 0,7% (bersih ±Rp4.215 dari Rp5.000), TETAPI pendaftaran
  pengguna baru sedang **ditutup sementara** (pengumuman di situsnya
  sejak 2026-08-27 dan masih berlaku saat diteliti). Layak dicek
  ulang berkala.
- **iPaymu — CADANGAN YANG DITUNJUK bila support Midtrans gagal.**
  Merchant Personal menerima perorangan (dokumen: KTP, swafoto
  memegang KTP, halaman depan buku tabungan atas nama yang sama;
  NPWP kemungkinan diminta menurut FAQ terbaru — konfirmasi saat
  pendaftaran), tim meninjau dokumen maks 2×24 jam kerja, QRIS
  dinamis 0,5% untuk nominal sampai Rp100.000 dengan pencairan H+2
  (dari Rp5.000 bersih ±Rp4.975 — termurah di antara semua opsi),
  tanpa biaya aktivasi/bulanan, dan berada di luar ekosistem GoTo
  sehingga nomor HP pengguna yang sekarang tidak bermasalah. Model
  integrasinya redirect ke halaman pembayaran iPaymu + callback
  notifikasi; desain kredit & verifikasi server-side yang sudah
  dibangun untuk Midtrans dapat dibawa, endpoint-nya yang diganti.
- **Perbandingan bersih per Analisis AI Rp5.000:** Midtrans 0,7% →
  Rp4.965; iPaymu 0,5% (pencairan H+2) → Rp4.975; Tripay →
  Rp4.215; Xendit → ±Rp965.
- **Pemicu eksekusi cadangan:** support Midtrans tidak menyelesaikan
  masalah role dalam beberapa hari kerja, atau menyatakan tidak
  bisa. Urutan eksekusinya: daftar iPaymu → verifikasi → bangun
  endpoint iPaymu → uji sandbox → live. Midtrans tetap bisa menyusul
  kapan pun role-nya beres (integrasinya sudah jadi).

## Unduh laporan hasil analisis (2026-11-21)

Atas permintaan pengguna: hasil analisis kini bisa **diunduh agar bisa
disimpan dan dilihat terus** — sebelumnya hasil hanya tampil di halaman
(ditambah tombol salin teks) dan rinciannya hilang begitu tab ditutup.

- **Tombol "Unduh Laporan (PDF)"** di kartu hasil: memicu `window.print()`
  dengan stylesheet `@media print` khusus di `src/App.css` — seluruh UI
  aplikasi disembunyikan dan yang dicetak hanya bagian `.print-report`
  (anak langsung `.page`, `display:none` di layar): nama situs, tanggal
  analisis, posisi target (bila ada), skor total + label, skor per aspek,
  kekuatan, prioritas perbaikan dengan rincian tiap pemeriksaan, hasil
  cek kata kunci lowongan (bila ada), dan bagian Analisis AI bila hasil
  AI sudah dibuat. Pengguna memilih "Simpan sebagai PDF" di dialog cetak.
- **Tombol "Unduh .txt"**: mengunduh berkas `laporan-cv-<tanggal>.txt`
  (Blob + object URL). Isinya dibangun oleh pembangun bersama
  `buildReportText` di `src/lib/report.ts` — sumber logika yang sama
  dengan tombol "Salin Laporan" (yang kini juga memakai pembangun itu),
  termasuk bagian AI bila ada.
- **Privasi tidak berubah:** laporan hanya berisi hasil analisis (tanpa
  teks CV), dibuat di browser saat tombol ditekan, dan tidak disimpan ke
  localStorage/server — riwayat tetap hanya menyimpan skor.
- **Revisi di hari yang sama (keputusan pengguna, 2026-11-21):** baris
  tombol di kartu hasil (Salin Laporan, Unduh .txt, Unduh Laporan (PDF)
  versi cetak) **dihapus seluruhnya**, begitu pula bagian `.print-report`
  dan stylesheet `@media print` — mode cetak ditinggalkan. Satu-satunya
  tombol laporan kini adalah **"Unduh Laporan (PDF)" di kartu Analisis
  AI**, dan tombol itu kini mengunduh **berkas PDF sungguhan secara
  langsung** (dibuat di browser dengan jsPDF lewat modul
  `src/lib/pdf.ts` dari isi `buildReportText` yang sama, nama berkas
  `laporan-cv-<tanggal>.pdf`) — bukan lagi dialog cetak. Alasan pengguna:
  tombol unduh harus langsung menghasilkan berkas, dan letaknya cukup
  satu di dekat tombol Analisis AI tempat pengguna berbayar berada.

## Penyesuaian UI & kamus skill (2026-11-21)

Tiga perubahan atas perintah pengguna di hari yang sama:

- **Daftar Skill menyesuaikan posisi yang dilamar.** Pencocokan peran
  di `src/lib/examples.ts` diperkuat: teks bebas posisi target
  dinormalisasi lalu dicocokkan per kata/frasa utuh dengan sinonim
  (mis. "ADMIN"/"admin kantor" → Administrasi, "SPG"/"sales
  executive" → Sales, "barista"/"pelayan" → Barista/F&B), dan di
  antara kata kunci yang cocok, frasa terpanjang menang supaya frasa
  spesifik ("teknisi komputer", "content creator") tidak tertelan
  kata umum. Kamus diperluas dari 8 menjadi **18 peran**: ditambah
  Kasir, Operator Produksi, Guru/Pendidikan, Perawat/Tenaga
  Kesehatan, Teknisi/Mekanik, Barista/F&B Service, Security/Satpam,
  Driver/Sopir, Content Creator/Sosial Media, dan Software
  Developer/Programmer (masing-masing 10 skill, tetap ditandai saran
  umum). Bila posisi terisi tetapi tidak ada di kamus, judul kartu
  kini memakai **nama posisi pengguna sendiri** ("Daftar Skill —
  <Posisi>") dengan daftar skill umum dan catatan jujur bahwa belum
  ada kamus khusus untuk posisi itu — label "Umum / Fresh Graduate"
  hanya tampil bila posisi memang kosong.
- **Tombol "Salin Template" dihapus** dari kartu Template Ringkasan
  & Daftar Skill (beserta handler salinnya). Teks template ringkasan
  tetap tampil seperti sebelumnya.
- **Tombol "Unduh Laporan (PDF)" hanya muncul setelah Analisis AI
  selesai.** Sebelum hasil AI ada, di tempat yang sama tampil
  petunjuk "Tombol unduh laporan akan muncul setelah Analisis AI
  selesai." Alasan pengguna: laporan diunduh untuk menyimpan kalimat
  hasil AI, jadi unduhan hanya relevan setelah AI selesai.

## Penanda teks CV — "Teks CV dengan Tanda" (2026-11-21)

Fitur atas persetujuan pengguna: panel baru di bawah hasil analisis
standar yang menampilkan teks CV yang dikirim pengguna dengan tanda
langsung pada bagian yang perlu diperbaiki:

- **Frasa lemah & klise** disorot kuning.
- **Kata yang sering salah eja** dan **kata "saya" yang berlebihan**
  disorot merah muda. Kata "saya" hanya ditandai bila jumlahnya di
  bagian pengalaman mencapai ambang berlebihan yang dipakai
  pemeriksaan kerapian bahasa — pemakaian wajar tidak ditandai.
- **Entri pengalaman tanpa hasil terukur** diberi penanda ⚑ di awal
  barisnya (yang kurang adalah angka yang belum ditulis, jadi tidak
  ada teks yang bisa disorot).
- Setelah Analisis AI selesai, **kalimat "asli" dari saran penulisan
  ulang AI** ikut ditandai biru; mengkliknya menampilkan saran +
  alasan AI. Kutipan dicocokkan persis, lalu ternormalisasi (abaikan
  huruf besar/kecil & spasi/baris-baru); yang tetap tidak ditemukan
  dilewati diam-diam — tidak ada tanda yang dipaksakan.
- Mengklik tanda mana pun membuka kotak penjelasan: pesan pemeriksaan
  terkait + contoh perbaikan sebelum → sesudah dari `examples.ts`.

Prinsip kejujuran teknisnya: modul penanda (`src/lib/marks.ts`) tidak
punya kamus/logika penilaian kedua. Semua buktinya berasal dari
penemu bersama di `src/lib/analyze.ts` — kamus frasa lemah, kamus
salah eja, ambang & penghitung "saya", parser entri pengalaman, dan
penghitung hasil terukur yang sama persis dengan pemeriksaan —
sehingga tanda tidak mungkin berbeda dari skor. Tumpang tindih
sorotan diselesaikan deterministik (AI > salah eja > frasa lemah >
"saya"). Panel dirender murni dari state teks yang dianalisis; tidak
ada teks CV yang disimpan ke localStorage. Patokan skor tidak
berubah (96/61/16; mode lowongan 89/79 & 60/48; fresh graduate 53).

## Unduhan PDF teks bertanda (2026-11-21)

Permintaan pengguna: hasil panel "Teks CV dengan Tanda" bisa diunduh
sebagai PDF, seperti unduhan PDF laporan Analisis AI. Panel kini
punya tombol **"Unduh Teks Bertanda (PDF)"** di bawah legenda (selalu
tersedia selama panel tampil) yang membuat berkas
`teks-cv-bertanda-<tanggal>.pdf` sungguhan dengan jsPDF
(`buildMarkedTextPdf` di `src/lib/pdf.ts`), langsung terunduh sekali
klik:

- Kepala dokumen: judul "Teks CV dengan Tanda", tanggal analisis,
  posisi target bila ada, dan legenda warna yang sama dengan panel.
- Teks CV lengkap dari teks yang dianalisis, dengan sorotan warna
  yang sama (kuning frasa lemah, merah muda salah eja/"saya"
  berlebihan, biru saran AI) digambar sebagai persegi latar di balik
  rentang bertanda, mengalir kata per kata dengan pembungkusan baris
  dan halaman lanjut otomatis. Rentangnya memakai hasil
  `buildMarks`/`buildSegments` dari `marks.ts` — tidak ada logika
  tanda atau kamus baru. Penanda entri digambar sebagai token tebal
  merah "[!]" (glif aman WinAnsi) di awal baris entri, dijelaskan di
  legenda.
- Bagian **"Keterangan Tanda"** sesudah teks: semua tanda yang
  tergambar, terurut sesuai urutan dokumen — kutipan teks yang
  ditandai, jenis tandanya, dan penjelasannya (pesan pemeriksaan
  terkait; bentuk baku untuk salah eja; saran + alasan untuk tanda
  AI; entri berbendera dicantumkan dengan baris awal entrinya).
- Tanpa hasil AI pun PDF tetap bisa dibuat dari tanda standar saja.
  Logika skor, penanda, paywall, dan unduhan laporan AI tidak
  berubah. Berbeda dari laporan, dokumen ini memang memuat teks CV
  pengguna — dibuat hanya saat pengguna menekan tombol unduhnya dan
  tidak disimpan ke mana pun.

## Peningkatan daya tarik: contoh hasil, tampilan, artikel SEO (2026-11-24)

Atas kebebasan penuh dari pengguna ("buat apa saja yang menarik, jika
perlu buat tampilannya lebih menarik lagi"), tiga hal dibangun dalam satu
rangkaian:

1. **Bagian "Lihat Contoh Hasil" di beranda.** Pengunjung kini bisa
   melihat contoh keluaran nyata tanpa mengunggah: dua CV contoh
   dianalisis langsung oleh `analyzeCv` yang sama di browser — CV contoh
   lemah (`src/lib/demoCv.ts`, skor 55 "Perlu Perbaikan") sebagai
   "Sebelum" dan CV contoh kuat bawaan (skor 96 "Sangat Siap Dilamar")
   sebagai "Sesudah" — lengkap dengan selisih skor, 3 prioritas perbaikan
   teratas dari "Sebelum", dan cuplikan teks bertanda dari
   `buildMarks`/`buildSegments` yang sama dengan panel penanda. Bagian
   ini berlabel jujur "Contoh": bukan testimoni pengguna, bukan angka
   karangan, dan tidak ada penghitung "sudah X CV dianalisis".
2. **Penyegaran tampilan.** Hero lebih kuat (gradien berlapis, tipografi
   lebih besar, statistik kaca), kartu dan kartu langkah lebih rapi
   (radius 16px, bayangan lembut, efek hover), tombol utama bergradien,
   garis fokus yang jelas, dan footer berbingkai atas. Hanya gaya dan
   markup pembungkus — label fitur, logika skor, dan semua fitur lama
   tidak berubah.
3. **Artikel SEO pertama.** `public/artikel/kesalahan-cv-fresh-graduate.html`
   — "7 Kesalahan CV Fresh Graduate yang Membuatmu Tidak Dipanggil
   Interview", isinya diturunkan dari pemeriksaan nyata situs dengan
   contoh sebelum→sesudah sejalan `examples.ts`, tanpa klaim statistik
   karangan. Terdaftar di `sitemap.xml` dan tertaut dari footer beranda.

## Penanda selaras prioritas perbaikan (2026-11-24)

Atas persetujuan pengguna, panel "Teks CV dengan Tanda" kini diselaraskan
dengan daftar "Prioritas Perbaikan": bagian CV yang menjadi prioritas
perbaikan diberi tanda warna khusus.

- **Satu sumber prioritas bersama.** Kriteria & urutan prioritas kini
  didefinisikan di satu fungsi `selectPriorities` (analyze.ts) yang
  dipakai `analyzeCv`; daftar "Prioritas Perbaikan" tampil persis sama
  seperti sebelumnya. Peringkat per pemeriksaan diturunkan dari daftar
  yang sama lewat `priorityRanks`, dan penanda menempelkannya lewat
  `applyPriorityRanks` (marks.ts) — tidak ada urutan kedua.
- **Gaya prioritas oranye.** Tanda yang pemeriksaannya termasuk daftar
  prioritas dirender oranye tegas `#fdba74` dengan garis bawah `#ea580c`
  (kelas `.mark-priority`), menang atas warna jenis tanda; penanda entri
  pengalaman ikut oranye bila pemeriksaan hasil-terukur termasuk
  prioritas. Datanya tetap utuh: jenis tanda + checkId + peringkat
  tersimpan pada tanda. Tanda AI tidak pernah berperingkat — prioritas
  berasal dari analisis standar.
- **Panel & PDF selaras.** Legenda panel (dan cuplikan demo beranda)
  bertambah entri "Prioritas perbaikan"; kotak penjelasan tanda
  prioritas menampilkan label "Prioritas perbaikan #N". PDF teks
  bertanda memakai warna oranye yang sama, entri legenda "Oranye —
  prioritas perbaikan", dan awalan "Prioritas #N —" pada keterangan
  tanda prioritas. Prioritas tanpa lokasi teks (bagian/kontak yang
  hilang) memang tidak tertandai — tetap hanya tampil sebagai daftar.

## Fitur penanda teks CV DIHAPUS (2026-11-24)

Atas perintah pengguna pada 2026-11-24 ("hapus saja fiturnya, karena
tidak efektif bekerja fiturnya"), seluruh fitur penanda yang dibangun
pada 2026-11-21 s/d 2026-11-24 di atas **dihapus total** — pola yang
sama seperti penghapusan kartu "Bagikan Hasil" dulu:

- Panel "Teks CV dengan Tanda" di App.tsx (judul, legenda, teks
  bertanda, kotak penjelasan tanda) beserta seluruh state/handler-nya.
- Tombol "Unduh Teks Bertanda (PDF)" dan builder PDF bertanda di
  `src/lib/pdf.ts` + helper `markedTextFileName` di `src/lib/report.ts`.
- Modul `src/lib/marks.ts` dihapus dari repo.
- Cuplikan teks bertanda di bagian "Lihat Contoh Hasil" — bagian demo
  itu sendiri **tetap ada** dengan skor Sebelum/Sesudah + daftar
  prioritasnya.
- Gaya CSS khusus penanda di App.css dan uji-uji khusus penanda/PDF
  bertanda di `scripts/run-tests.ts`.
- Di `analyze.ts` hanya dibersihkan ekspor yang murni untuk penanda
  dan terbukti tidak dipakai pemeriksaan (`getExperienceEntrySpans`,
  `findTypoOccurrences`); perilaku skor identik — patokan tetap
  96/61/16, mode lowongan 89/79 & 60/48, fresh graduate 53, demo
  55→96. `selectPriorities`/`priorityRanks` dan daftar "Prioritas
  Perbaikan" di kartu hasil adalah fitur HASIL dan **tetap ada**.

**Jangan bangun ulang fitur penanda teks CV ini tanpa persetujuan baru
dari pengguna.** Unduhan PDF yang tersisa hanyalah "Unduh Laporan
(PDF)" di kartu Analisis AI — itu fitur berbeda dan tetap dipertahankan.

## Section penjelasan lepas DIHAPUS (2026-11-24)

Atas perintah pengguna pada 2026-11-24 — pertama bagian "Bagaimana skor
dihitung?" (dengan tangkapan layarnya), lalu perintah lanjutan "hapus
saja section penjelasan yang dianggap tidak penting menurut kamu" yang
menyerahkan penilaian ke agen — tiga section penjelasan murni dihapus
dari halaman utama:

- **"Bagaimana skor dihitung?"** — kartu transparansi berisi rincian
  bobot per aspek (Kontak 20, Ringkasan 10, Pengalaman 28, dst.) beserta
  gaya `.rules-list`-nya. Yang dihapus hanya section penjelasannya;
  logika penilaian tidak berubah sama sekali.
- **Langkah "Cara kerja" 1-2-3** ("Masukkan CV" → "Isi posisi &
  lowongan" → "Lihat hasil & perbaiki") beserta gaya `.steps`/`.step-*`
  — alur situs cukup jelas dari formulirnya sendiri.
- **"Tips lolos ATS"** — daftar tips generik lepas beserta konstanta
  `ATS_TIPS` dan gaya `.tips-list` — pengguna sudah mendapat saran
  personal dari hasil pemeriksaannya sendiri.

Yang sengaja **dipertahankan** (fungsional atau penopang kepercayaan,
bukan hiasan): hero + janji privasi "berjalan 100% di browser", bagian
"Lihat Contoh Hasil", formulir, seluruh isi hasil (Prioritas Perbaikan,
contoh sebelum→sesudah, Template Ringkasan, Daftar Skill, Riwayat
Skor), instruksi pembayaran token + persetujuan Analisis AI di kartu
AI, dan footer + tautan artikel/privacy/terms. Patokan skor identik:
96/61/16, mode lowongan 89/79 & 60/48, fresh graduate 53, demo 55→96.

## Contoh personal "Contoh dari CV-mu" di "Lihat contoh" (2026-11-24)

Atas persetujuan pengguna, isi tombol "Lihat contoh" pada daftar
Prioritas Perbaikan kini dipersonalisasi dari CV yang sedang dianalisis
— bukan lagi contoh generik yang sama untuk semua orang, bila buktinya
bisa dikutip secara andal. Ini BUKAN menghidupkan lagi fitur penanda
teks yang dihapus di atas; panel penanda tetap terhapus. Yang berubah
hanya isi contoh di dalam tombol yang sudah ada.

- Modul baru `src/lib/personalExamples.ts`: menerima hasil analisis +
  snapshot teks persis yang dianalisis (state `analyzedText` di App,
  hanya di memori halaman — teks CV tetap tidak disimpan ke
  localStorage) + posisi target, dan mengembalikan contoh per id
  pemeriksaan: kutipan asli, versi perbaikan, catatan.
- Pemeriksaan yang dipersonalisasi: **frasa-lemah** (kutip baris
  berfrasa lemah, frasanya diganti tempat bukti), **hasil-terukur**
  (kutip poin entri tanpa angka + placeholder hasil terukur),
  **kedalaman-entri** (kutip entri belum lengkap, komponen hilang
  ditandai placeholder), **kata-kerja-aksi** (kutip poin berawalan
  lemah — "Saya…", "Bagian…", "bertanggung jawab atas…"),
  **kerapian-bahasa** (salah eja → koreksi baku pada baris pengguna
  sendiri; "saya" berlebihan → poin yang sama tanpa kata ganti),
  **ringkasan** dan **relevansi-ringkasan** (ringkasan pengguna sendiri
  + posisi target yang ia isi).
- Bukti dikutip memakai kamus/logika yang SAMA dengan pemeriksaannya:
  analyze.ts mengekspor penemu bersama (`findWeakPhraseOccurrences`,
  `findTypos`, `findSayaOccurrences`) dan menambah
  `getExperienceEntryDetails` + `getSummarySection` dari parser yang
  sama — tidak ada kamus kedua. Perubahan analyze.ts murni aditif;
  logika dan patokan skor tidak berubah.
- Anti-karang wajib: versi perbaikan hanya memakai kata-kata pengguna,
  koreksi ejaan baku, atau placeholder [kurung siku]. Uji menegaskan
  versi perbaikan hasil-terukur tidak memuat angka apa pun yang tidak
  ada di kutipan aslinya.
- Pemeriksaan ketiadaan (LinkedIn, bagian hilang, dsb.) dan bukti yang
  ekstraksinya tidak andal tetap menampilkan contoh generik seperti
  sebelumnya. Blok personal berlabel "Contoh dari CV-mu" dengan aksen
  biru menggantikan blok generik untuk pemeriksaan itu.
- 9 uji baru; total 131 uji lolos. Patokan identik: 96/61/16, mode
  lowongan 89/79 & 60/48, fresh graduate 53, demo 55→96.

**Perluasan (2026-11-24, menyusul teguran pengguna bahwa contoh
linimasa masih generik — "Kasir — Toko Berkah / Staf Gudang — PT
Logistik Jaya" padahal bukan entri CV-nya):** dua pemeriksaan keluarga
linimasa & format kini ikut dipersonalisasi, sehingga total 9 id.

- **linimasa**: "Sebelum" mengutip judul entri pengalaman pengguna
  sendiri persis seperti tertulis (jabatan — perusahaan (periode))
  dalam urutan aslinya, dan catatannya menyebut jeda aktual yang
  dihitung dari tahun-tahunnya (mis. "ada jeda sekitar 5 tahun (antara
  2016 dan 2021)") serta tahun berakhirnya peran terakhir. "Sesudah"
  menampilkan entri yang sama diurutkan terbaru→terlama, disisipi
  baris placeholder jeda ("2016–2021: [tulis aktivitasmu selama jeda
  ini: …]") dan — bila peran terakhir sudah lama berakhir —
  placeholder "[peran terkinimu — tahun mulai–Sekarang, bila masih
  berjalan]". Angka jeda berasal dari `getTimelineFacts` di analyze.ts
  (perhitungan yang sama persis dengan pesan pemeriksaannya;
  `assessTimeline` di-refactor memakainya, pesan & skor identik).
  Anti-karang diperketat di sini: contoh generik lama mengarang
  aktivitas pengisi jeda ("Mengelola toko online keluarga…") — versi
  personal TIDAK memuat aktivitas, perusahaan, atau tahun apa pun di
  luar CV pengguna; uji menegaskan tidak ada kata "toko online" dan
  semua angka di versi perbaikan ada di CV aslinya. Bila periode entri
  tidak terbaca, tetap generik.
- **konsistensi-format**: "Sebelum" mengutip format periode persis
  seperti tertulis di bagian pengalaman pengguna (mis. "Jan 2021" gaya
  bulan–tahun bercampur "2023 - 2024" gaya rentang tahun, dari
  `getPeriodExprs` — penemu yang sama dengan pemeriksaannya).
  "Sesudah" menampilkan entri pengguna yang sama, diurutkan
  terbaru→terlama, dengan semua periode ditulis ulang dalam SATU gaya
  rentang tahun memakai tahun entri itu sendiri — tidak ada tahun
  baru. Cakupan kutipan dibatasi bagian pengalaman (bagian yang
  ditata contoh ini); campuran gaya yang sumbernya di bagian lain
  tetap memakai contoh generik.
- Perubahan analyze.ts tetap murni aditif di permukaan publik
  (`ExperienceEntryDetail` kini membawa `startYear`/`endYear`/
  `isCurrent` dari parser yang sama; ekspor `getTimelineFacts`,
  `getPeriodExprs`, `PERIOD_FAMILY_LABEL`). 6 uji baru; total 137 uji
  lolos. Patokan identik: 96/61/16, mode lowongan 89/79 & 60/48,
  fresh graduate 53, demo 55→96.

**Perluasan kedua (2026-11-24, menyusul teguran pengguna bahwa contoh
struktur bullet masih generik — "Tugas saya meliputi input data…"
padahal isinya tidak ada di CV-nya — dan ia bingung arti
pemeriksaannya):** pemeriksaan **bullet** dipersonalisasi, pesan
pemeriksaannya diperjelas, dan sisa pemeriksaan yang contohnya masih
generik diaudit satu per satu. Total kini 14 id personal.

- **bullet**: "Sebelum" mengutip uraian pengalaman pengguna sendiri
  yang belum berbentuk bullet — baris-baris uraian dari entri
  pengalaman (parser entri yang sama; judul entri dipisahkan dari isi
  lewat penanda jangkar yang sama). "Sesudah" adalah teks YANG SAMA
  diubah jadi bullet: transformasi deterministik dan konservatif —
  setiap baris uraian menjadi satu bullet, baris panjang berisi
  beberapa kalimat dipecah per kalimat, dan selain pemecahan +
  huruf kapital awal TIDAK ada kata yang diubah/ditambah. Contoh
  generik lama menambah "Microsoft Excel" dan "[200+]" — versi
  personal tidak boleh; uji menegaskan setiap kata di versi perbaikan
  ada di kutipan aslinya dan tidak ada "Excel" yang menyusup. Bila
  bagian pengalaman tidak memuat uraian yang bisa dikutip (hanya
  judul entri, atau uraiannya sudah berbentuk bullet semua), tetap
  generik.
- **Pesan pemeriksaan bullet diperjelas** (id & poin tidak berubah,
  skor tidak berubah): kini memuat satu kalimat definisi gamblang —
  bullet artinya uraian tugas/pencapaian ditulis sebagai poin-poin
  terpisah (satu poin untuk satu tugas/pencapaian, satu poin per
  baris, diawali • atau -), bukan menyatu dalam satu paragraf panjang.
- **Hasil audit sisa id** (aturan sama: kutipan = kata pengguna
  sendiri, tambahan hanya placeholder kurung):
  - **panjang — dipersonalisasi**: catatan menyebut jumlah kata
    aktual CV pengguna (penghitung `countWords` yang sama) dan
    "Sebelum" mengutip paragraf terpanjangnya. CV terlalu panjang →
    paragraf itu calon pemadatan + placeholder perintah memadatkan;
    CV terlalu pendek → placeholder perluasan dari pengalaman asli.
  - **keahlian — dipersonalisasi**: "Sebelum" mengutip item bagian
    skill pengguna sendiri (ekstraksi `getSkillItems` yang sama
    dengan pemeriksaannya); "Sesudah" = item yang sama + placeholder
    skill dari kamus Daftar Skill untuk posisi target yang belum
    terbaca di CV (maks 4, lewat `getRoleSkills` + `checkSkills` yang
    sama dengan kartu Daftar Skill). Tanpa bagian skill sama sekali
    → tetap generik (ketiadaan murni).
  - **bahasa — dipersonalisasi bersyarat**: bila bahasa disebut di
    dalam teks tanpa bagian/level tersendiri (skor 1), baris
    sebutannya dikutip dan "Sesudah" menampilkan bentuk bagian
    "Bahasa" dengan nama bahasa dari teks pengguna sendiri +
    placeholder tingkat kemahiran. Bila tidak disebut sama sekali →
    tetap generik. Ekstraksi memakai `getLanguageItems` +
    `LANGUAGE_MENTION` yang sama dengan pemeriksaannya.
  - **relevansi-pengalaman — dipersonalisasi**: entri pengalaman
    pertama pengguna dikutip; kata kunci posisi target yang belum
    terbaca di bagian pengalaman (dari `getRoleWords` yang sama
    dengan pemeriksaannya) disebut namanya di catatan, dan "Sesudah"
    menambah poin placeholder untuk menonjolkan tugas yang berkaitan
    — hanya yang benar-benar dikerjakan. Bila semua kata kunci sudah
    ada di isi tetapi belum di judul jabatan (skor 2), placeholdernya
    menunjuk judul entri yang dikutip itu.
  - **Tetap generik**: email, hp, linkedin, portofolio, lokasi,
    pengalaman-heading, pendidikan, ipk, sertifikasi, proyek,
    periode — ketiadaan murni (pemeriksaan hanya gagal saat sesuatu
    TIDAK ada di CV, jadi tidak ada bukti yang bisa dikutip) atau
    buktinya tidak bisa ditunjuk andal. kecocokan-lowongan juga tetap
    generik: contoh personal tidak menerima deskripsi lowongan.
- Perubahan analyze.ts: ekspor bersama baru `getSkillItems`,
  `getLanguageItems`, `LANGUAGE_MENTION`, `getRoleWords` —
  `analyzeCv` di-refactor memakainya dengan perilaku identik (satu
  sumber ekstraksi untuk penilaian & tampilan), plus teks pesan
  bullet di atas. 11 uji baru; total 148 uji lolos. Patokan identik:
  96/61/16, mode lowongan 89/79 & 60/48, fresh graduate 53, demo
  55→96.

## Glosarium singkatan nama pekerjaan (2026-11-24)

Permintaan pengguna: singkatan posisi seperti "QC" harus tetap dikenali
sebagai pekerjaan lengkapnya (Quality Control) saat diketik sebagai
posisi target. Sebelumnya singkatan jatuh ke fallback nama mentah.

- Modul data murni baru `src/lib/jobGlossary.ts`: **75 entri** singkatan
  → nama pekerjaan lengkap (manufaktur/kualitas, kantor/administrasi,
  penjualan/marketing, IT/digital, F&B/hospitality, kesehatan/
  pendidikan, teknik/konstruksi/logistik, keuangan, lainnya), satu
  entri per baris agar mudah ditambah, plus fungsi resolusinya
  (`expandJobTitle`, `findJobAbbreviation`). Resolusi case-insensitive,
  mengabaikan titik ("Q.C."), dan hanya cocok sebagai kata utuh
  (seluruh input atau token mandiri, termasuk gabungan "QA/QC") —
  potongan huruf di tengah kata lain tidak pernah diperluas.
- Singkatan terlalu ambigu sengaja TIDAK dimasukkan: SA (System
  Analyst / Sales Admin / Sales Assistant), BA (Business Analyst /
  Brand Ambassador), DC (Debt Collector / Distribution Center), SM,
  DM, RM. Yang ambigu tetapi lazim dipetakan ke arti paling umum di
  lowongan Indonesia: PM = Product Manager, AM = Account Manager,
  BM = Branch Manager, AP/AR = Accounts Payable/Receivable.
- Integrasi: (a) `getRoleSkills` (examples.ts) — pencocokan langsung ke
  kamus 18 peran tidak berubah; bila gagal, singkatan diperluas lalu
  dicocokkan ulang ("QC" → peran Operator Produksi dengan daftar
  skill-nya; "ADM" → Administrasi; "IT" → IT Support; "BE" →
  Developer). Judul kartu Daftar Skill memakai nama lengkap hasil
  perluasan ("Quality Control", bukan "QC"). Nama lengkap yang belum
  punya peran kamus (mis. "HRD" → "Human Resource Development")
  memakai fallback skill umum berlabel nama lengkap itu. (b)
  `getRoleWords` (analyze.ts) memperluas singkatan sebelum ekstraksi
  kata, jadi pemeriksaan relevansi ringkasan & pengalaman menerima
  kata "quality"/"control" yang bisa dicocokkan ke isi CV.
- Skor & patokan TIDAK berubah (pencocokan nama lengkap persis seperti
  sebelumnya): 96/61/16, mode lowongan 89/79 & 60/48, fresh graduate
  53, demo 55→96. 7 uji baru; total 155 uji lolos.
- Perbaikan judul hasil perluasan (2026-11-24, laporan pengguna):
  mengetik "it staff" sempat menghasilkan judul kartu hibrida
  "IT Support staff" karena kata sisa "staff" ditempel mentah ke nama
  lengkap hasil perluasan. Kini `expandJobTitle` membuang kata pengisi
  peran (staff, staf, karyawan, personil, pegawai, tim, bagian, divisi,
  departemen, dept) yang menyertai singkatan — "it staff"/"staff qc" →
  "IT Support"/"Quality Control" — sedangkan kata sisa bermuatan
  dipertahankan dan di-title-case ("SPV Produksi" → "Supervisor
  Produksi", "QC Inspector" → "Quality Control Inspector"). Peran &
  daftar skill yang dihasilkan tidak berubah; 2 uji baru, total 157
  uji lolos, patokan skor utuh.
- Pencabutan pemetaan "IT" (2026-11-24, keputusan pengguna): pengguna
  memilih singkatan "IT" TIDAK ditebak sebagai IT Support — harus
  tampil apa adanya. Entri `IT = IT Support` dicabut dari glosarium
  (75 → 74 entri) dan kata kunci 'staff it' dicabut dari peran
  IT Support di kamus skill. Akibatnya "it"/"IT"/"it staff"/"staff it"
  jatuh ke jalur posisi tak dikenal: judul kartu memakai teks posisi
  pengguna sendiri dengan catatan belum ada kamus khusus dan daftar
  skill umum — bukan daftar skill IT Support — dan pemeriksaan
  relevansi tidak lagi menerima kata "support" dari singkatan ini.
  Nama lengkap "IT Support" yang ditulis utuh tetap terdeteksi
  langsung ke kamus seperti sebelumnya. Entri glosarium lain tidak
  berubah; 1 blok uji baru, total 158 uji lolos, patokan skor utuh.

## Analisis AI: perbaikan lengkap untuk semua prioritas (2026-11-24)

Keputusan pengguna (2026-11-24): TIDAK ada contoh/teaser Analisis AI
gratis — contoh personal gratis di hasil standar sudah cukup sebagai
pratinjau, jadi hasil AI tetap hanya untuk pemegang token. Sebagai
gantinya, AI berbayar wajib memberikan perbaikan yang LENGKAP:

- Frontend kini mengirim konteks hasil analisis standar yang sedang
  tampil ke endpoint: daftar SEMUA pemeriksaan yang gagal (prioritas
  lebih dulu) berisi id + label + pesan pemeriksa + kutipan bukti dari
  lapisan contoh personal bila ada (`buildAiFixContext` di
  `src/lib/ai.ts`; divalidasi/disanitasi server oleh
  `parseFailedChecks`, maks 20 item).
- Skema jawaban AI bertambah `perbaikanLengkap`: satu item per
  pemeriksaan yang dikirim — {idPemeriksaan, judul, sebelum, sesudah,
  catatan}. "Sesudah" adalah versi perbaikan JADI siap salin dari teks
  pengguna sendiri; placeholder kurung hanya untuk fakta yang memang
  tidak ada di CV dan harus spesifik; masalah ketiadaan (LinkedIn,
  sertifikasi, bagian hilang) dijawab templat konkret + instruksi satu
  kalimat. Bidang lama (ringkasan, saranPenulisanUlang, kekurangan,
  saranRingkasan) dipertahankan.
- Batas disesuaikan agar JSON yang lebih besar selesai utuh:
  non-streaming 3000 → 6500 token & timeout 55 → 75 detik; streaming
  6000 → 9000 token, batas aliran 90 → 150 detik, effort penalaran
  streaming diturunkan medium → low DAN diberi cap 1.500 token
  penalaran (uji live: tanpa cap, model menghabiskan seluruh batas
  aliran hanya untuk berpikir dan JSON tidak selesai; jalur
  non-streaming pada uji yang sama membalas 200 dengan 12/12 item
  perbaikan). Frontend kini juga mencoba cadangan non-streaming bila
  streaming gagal di tengah aliran (sebelumnya hanya bila gagal
  sebelum event pertama) — token tetap hanya terpakai bila salah satu
  jalur berhasil.
- Kartu Analisis AI menampilkan daftar "Perbaikan Lengkap dari AI"
  (judul + sebelum → sesudah + catatan) dan laporan PDF memuat bagian
  "PERBAIKAN LENGKAP DARI AI" juga.
- Teks nilai jual di kartu AI kini menyatakan perbaikan lengkap untuk
  semua prioritas, janji eksplisit "token hanya terpakai bila analisis
  berhasil — kalau AI gagal, tokenmu tidak hangus", dan jangkar harga
  (Rp5.000 sekali analisis, bukan langganan; lebih murah dari sekali
  print + fotokopi CV). Tanpa teaser/buka-sebagian apa pun.
- 7 uji baru (parser skema baru + kompatibilitas skema lama, sanitasi
  konteks, konteks memuat semua pemeriksaan gagal dengan prioritas
  lebih dulu, laporan memuat bagian baru, teks kartu); total 165 uji
  lolos; patokan skor standar utuh: 96/61/16, mode lowongan 89/79 &
  60/48, fresh graduate 53, demo 55→96.

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
