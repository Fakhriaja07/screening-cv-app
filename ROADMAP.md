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
