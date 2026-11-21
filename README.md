# Screening CV — Versi Vite + React + TypeScript

Aplikasi web satu halaman untuk menilai CV berbahasa Indonesia: pengguna memasukkan
CV, lalu menerima skor 0–100 beserta bagian mana saja yang perlu diperbaiki.
Ini adalah versi project (Vite + React + TypeScript) dari website Screening CV.

## Cara Menjalankan

```bash
npm install     # pasang dependency (sekali saja)
npm run dev     # jalankan server pengembangan (http://localhost:5173)
npm run build   # build produksi ke folder dist/ (termasuk cek TypeScript)
npm run preview # pratinjau hasil build
```

Uji logika penilaian (opsional):

```bash
npx tsx scripts/run-tests.ts
```

Menjalankan frontend + backend AI bersamaan (untuk fitur Analisis AI):

```bash
npx vercel dev   # butuh Vercel CLI; membaca .env.local untuk OPENROUTER_API_KEY
```

## Fitur

- Upload CV **PDF** (pdfjs-dist, worker dari paket itu sendiri), **DOCX** (mammoth),
  atau **TXT** — bisa drag & drop — atau tempel teks CV langsung.
- Input posisi target dan deskripsi lowongan (opsional).
- Hasil: ring skor beranimasi, bar per aspek, daftar kekuatan, prioritas perbaikan
  terurut dengan detail per pemeriksaan, cek kata kunci lowongan, tombol salin
  laporan, tombol reset, dan tombol "Coba CV Contoh".
- Penghitung karakter/kata langsung pada textarea CV.
- **Analisis AI (OpenRouter)** — opsional, atas persetujuan pengguna: saran
  penulisan ulang, kekurangan kualitatif, dan contoh ringkasan profil dari
  backend `api/analyze-ai.ts` (lihat bagian Backend AI).

## Struktur Folder

```
api/
  analyze-ai.ts      Backend Analisis AI (Vercel Serverless Function → OpenRouter)
src/
  App.tsx            Komponen utama (hero, cara kerja, form, hasil, transparansi, tips)
  App.css            Seluruh gaya aplikasi
  index.css          Gaya dasar (reset & font)
  lib/
    analyze.ts       Logika penilaian (murni TypeScript, tanpa DOM)
    ai.ts            Klien frontend untuk POST /api/analyze-ai
    sampleCv.ts      Teks CV contoh bawaan
    readFile.ts      Ekstraksi teks dari file PDF/DOCX/TXT
scripts/
  run-tests.ts       Uji logika penilaian dengan 3 CV + uji deteksi HP
```

## Aturan Penilaian (total 100 poin, 6 aspek, 23 pemeriksaan + 2 kondisional + 1 aspek kondisional)

Poin hanya diberikan untuk bukti isi yang benar-benar ada; bagian kosong = 0.
Penilaian **diperluas pada 2026-11-19 lewat aspek yang dinilai** (bukan
lewat menaikkan kuota angka — pendekatan kuota sempat dicoba dan dibatalkan
atas koreksi pengguna): kini dinilai juga kedalaman entri pengalaman,
frasa lemah/klise, sertifikasi & pelatihan, bahasa asing, konsistensi
format periode & urutan kronologis, kerapian bahasa, dan — bila posisi
target diisi — relevansi ringkasan terhadap posisi target. Ambang
pemeriksaan dasar tetap seperti v1.

**Standar dinaikkan lagi pada 2026-11-21, tetap berbasis aspek:** lokasi
domisili (Kontak), linimasa pengalaman (kesenjangan panjang antar-entri
tanpa penjelasan + kebaruan peran terakhir), proyek/magang/organisasi
sebagai bukti pengalaman (keadilan bagi fresh graduate), relevansi
pengalaman terhadap posisi target (kondisional), dan **kecocokan kata
kunci lowongan yang kini masuk skor** sebagai aspek tersendiri
"Kecocokan dengan Lowongan" (kondisional — hanya bila deskripsi lowongan
diisi; aspek dasar diskalakan proporsional ×0,8 agar total tetap 100).
Kalibrasi patokan (`scripts/run-tests.ts`): tanpa lowongan — CV kuat 96,
CV menengah 61, CV lemah 16. Dengan lowongan — CV kuat + lowongan data
yang cocok 89 (kecocokan 61%), CV yang sama + lowongan marketing yang
tidak cocok 79 (kecocokan 11%); CV menengah + lowongan administrasi 60,
+ lowongan marketing 48.

| Aspek | Maks | Pemeriksaan |
| --- | --- | --- |
| Kontak | 20 | Email valid (7), nomor HP Indonesia (6), LinkedIn (4), link portofolio (2), lokasi domisili (1) |
| Ringkasan | 10 | Panjang isi ringkasan: ≥40 kata = 10, 20–39 = 7, 8–19 = 4, 1–7 = 2. Bila posisi target diisi: ringkasan maks 7 (tingkat yang sama, diskalakan) + relevansi ringkasan terhadap posisi target (3) |
| Pengalaman | 28 | Bagian pengalaman (5), kata kerja aksi berbeda ≥5 = 5, angka pencapaian ≥3 = 6, kedalaman entri (4: jabatan + perusahaan + periode + uraian isi per entri), frasa lemah & klise (3), linimasa pengalaman (3), proyek/magang sebagai bukti pengalaman (2). Bila posisi target diisi: kata kerja 4, hasil terukur 5, linimasa 2, + relevansi pengalaman terhadap posisi target (3) |
| Pendidikan | 12 | Pendidikan tercantum (6), IPK/GPA (3), sertifikasi & pelatihan sebagai bagian tersendiri (3) |
| Keahlian | 10 | Jumlah item skill: ≥8 = 8, 5–7 = 5, 3–4 = 3, 1–2 = 1; bahasa asing (2: bagian tersendiri = 2, hanya disebut = 1) |
| Format & ATS | 20 | Panjang 220–900 kata = 8 (bertingkat di luarnya), tahun/periode tercantum (4), bullet ≥6 = 3, konsistensi format & urutan kronologis (3), kerapian bahasa (2) |
| Kecocokan dengan Lowongan | 20 (kondisional) | Hanya muncul bila deskripsi lowongan diisi & menghasilkan kata kunci: skor = persen kata kunci teratas lowongan yang ditemukan di CV × 20. Aspek lain diskalakan ×0,8; total tetap 100 |

- **Nomor HP**: rangkaian digit yang boleh berisi spasi, strip, titik, kurung, dan
  awalan `+` dibersihkan dulu, lalu divalidasi sebagai satu nomor utuh
  (`08…` total 10–14 digit, atau `628…` total 11–15 digit). Tahun, nomor kantor
  021, dan IPK tidak terdeteksi sebagai HP.
- **Portofolio**: URL di domain GitHub, GitLab, Behance, Dribbble, Kaggle,
  Bitbucket, CodePen, ArtStation, Notion, `*.vercel.app`, `*.netlify.app`,
  `*.github.io`, atau URL apa pun pada baris berlabel "Portofolio". Kata
  "portofolio" tanpa alamat tidak dihitung.
- **Hasil terukur**: angka dengan `%`/satuan (juta, ribu, orang, klien, proyek,
  jam, hari, bulan, tahun) atau nominal `Rp`, dengan tahun kalender dan fragmen
  nomor HP dikecualikan.
- **Frasa lemah & klise**: frasa generik tanpa bukti ("bertanggung jawab
  atas", "pekerja keras", "bekerja di bawah tekanan", "dapat bekerja dalam
  tim maupun individu", "bersedia ditempatkan di mana saja") dilaporkan apa
  adanya dan menurunkan poin; hanya dinilai bila ada bagian ringkasan/
  pengalaman.
- **Kerapian bahasa**: kata ganti "saya" ≥4 kali di bagian pengalaman dan
  kata dari daftar kecil yang sering salah eja (mis. aktifitas, praktek,
  ijin, resiko) — pemeriksaan dasar, bukan tata bahasa menyeluruh.
- **Label**: ≥85 "Sangat Siap Dilamar", ≥70 "Sudah Bagus", ≥50 "Perlu Perbaikan",
  <50 "Perlu Dirombak Dulu".
- **Kata kunci lowongan**: 18 kata paling sering dari deskripsi lowongan
  (stopword dibuang) dicek keberadaannya di CV. Sejak 2026-11-21 hasilnya
  **masuk skor** sebagai aspek "Kecocokan dengan Lowongan" (lihat tabel);
  tanpa deskripsi lowongan, aspek itu tidak muncul dan komposisi skor
  tidak berubah.
- **Lokasi domisili**: kota dari daftar kota Indonesia dicari pada baris
  berlabel domisili/alamat atau blok header (area kontak); kota yang hanya
  muncul di riwayat sekolah/kantor lama tidak dihitung.
- **Linimasa pengalaman**: dari periode tiap entri yang terbaca — kesenjangan
  ≥3 tahun antar-entri tanpa penjelasan menurunkan poin, begitu pula peran
  terakhir yang berakhir ≥4 tahun lalu tanpa peran saat ini. Tahun yang
  terbaca disebut apa adanya di pesan hasil; bila periode tidak terbaca,
  skor 0 dengan penjelasan bahwa linimasa belum bisa dinilai.
- **Proyek/magang**: bagian Proyek/Magang/Organisasi/PKL yang punya uraian
  isi memberi poin pengalaman (2); bila pengalaman formal sudah ada,
  ketiadaannya netral (tetap 2) agar tidak menghukum pekerja berpengalaman;
  tanpa keduanya = 0.
- **Relevansi pengalaman** (kondisional, posisi target diisi): kata kunci
  posisi target dicari di judul jabatan (poin penuh) dan isi bagian
  pengalaman.

## Backend AI (OpenRouter) — fitur "Analisis AI"

Selain penilaian rule-based, ada fitur opsional **Analisis AI** yang memakai
AI lewat **OpenRouter** (model default **NVIDIA Nemotron 3 Ultra 550B
(free)**, `nvidia/nemotron-3-ultra-550b-a55b:free`) untuk saran kualitatif: penulisan ulang poin
pengalaman, daftar kekurangan (terhadap lowongan bila diisi), dan contoh
ringkasan profil. Fitur ini **tidak mengubah skor utama**.

### Arsitektur

```
Browser ──POST /api/analyze-ai──▶ Vercel Serverless Function ──▶ OpenRouter
         {cvText, targetRole,      (api/analyze-ai.ts,            (Chat Completions,
          jobDesc}                   API key di env server)         JSON terstruktur)
```

- Endpoint hanya menerima `POST` JSON: `cvText` (wajib, 50–12.000 karakter),
  `targetRole` (opsional), `jobDesc` (opsional, maks 6.000 karakter).
- Ada rate limit sederhana in-memory: maks 5 permintaan per 10 menit per IP
  (best-effort per instance fungsi).
- Frontend hanya memanggil endpoint setelah pengguna mencentang persetujuan
  pengiriman teks CV. Bila OpenRouter membalas rate limit (429), endpoint
  meneruskannya sebagai 429 dan analisis standar tetap bisa dipakai.
- Error OpenRouter lain dipetakan rapi: 401/403 (key ditolak) dan 402 (kredit
  tidak cukup) menjadi 502 dengan penjelasan + field `detail` berisi status
  dan pesan resmi OpenRouter (tanpa key dan tanpa isi CV).
- Pengaman untuk model reasoning & model gratis yang lambat: permintaan
  dikirim dengan parameter `reasoning: {effort: "low"}` agar model tidak
  menghabiskan jatah token hanya untuk berpikir, dan dibatasi **timeout
  55 detik** (AbortController) — lewat dari itu endpoint membalas 502
  "terlalu lama merespons". Bila model menolak parameter opsional
  (`reasoning`/`response_format`) dengan error 400, endpoint mengulang
  permintaan dengan membuang parameter yang ditolak (maksimal 2 kali).

### Mode streaming (panel proses berpikir)

Frontend memanggil endpoint dengan `"stream": true` agar proses berpikir
model terlihat langsung di panel "Proses berpikir AI". Dalam mode ini
respons bukan lagi satu JSON, melainkan aliran **NDJSON**
(`Content-Type: application/x-ndjson`, satu event JSON per baris):

- `{"type":"reasoning","text":"..."}` — potongan penalaran model, diambil
  dari `delta.reasoning` / `delta.reasoning_details`; penalaran yang
  tercampur ke `delta.content` dalam blok `<think>...</think>` dipisahkan
  ke event ini juga.
- `{"type":"result","data":{...}}` — satu kali di akhir, hasil analisis
  dengan skema yang sama seperti mode non-streaming.
- `{"type":"error","error":"...","detail":"..."}` — kegagalan di tengah
  aliran (error upstream, timeout, atau jawaban tidak terparse), dengan
  pesan dan detail diagnostik yang sama seperti mode non-streaming.

Error **sebelum** aliran dimulai (validasi, rate limit, key belum
terpasang, upstream menolak di awal) tetap dibalas sebagai JSON biasa
dengan status HTTP seperti mode non-streaming. Parameter khusus jalur
streaming: `reasoning: {effort: "medium"}`, `max_tokens` 6000, dan batas
waktu keseluruhan aliran **90 detik**. Mode non-streaming tidak berubah
(effort low, `max_tokens` 3000, timeout 55 detik). Di sisi frontend, panel
menampilkan teks penalaran secara langsung (dibatasi ±8.000 karakter)
beserta penghitung detik; setelah selesai panel terlipat menjadi ringkasan
yang bisa dibuka lagi. Bila permintaan streaming gagal sebelum event
pertama tiba, frontend otomatis mencoba sekali mode non-streaming sebagai
cadangan.

### Memasang API key

1. Buat API key di **OpenRouter**: [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys).
2. Di **Vercel**: Project `screening-cv-app` → Settings → Environment Variables →
   tambahkan `OPENROUTER_API_KEY` (dan opsional `OPENROUTER_MODEL`, default
   `nvidia/nemotron-3-ultra-550b-a55b:free`).
3. **Redeploy** project (Deployments → ⋯ → Redeploy) agar variabel terbaca.
4. Untuk uji lokal: salin `.env.example` menjadi `.env.local`, isi key-nya,
   lalu jalankan `npx vercel dev`.

Tanpa key, endpoint membalas `500` dengan pesan "OPENROUTER_API_KEY belum
terpasang" dan bagian Analisis AI menampilkan pesan itu — situs dan analisis
standar tidak terganggu.

### Catatan biaya & privasi

- Model default adalah varian **gratis** (`:free`) di OpenRouter, jadi tidak
  butuh kredit — tetapi kapasitas provider gratis terbatas: endpoint bisa
  membalas **429** (rate limit/kuota gratis penuh) atau timeout saat model
  sedang lambat. Bila `OPENROUTER_MODEL` diganti ke model berbayar, model itu
  dipungut biaya per token dan butuh kredit OpenRouter: error **402**
  artinya **kredit OpenRouter tidak cukup** — isi kredit atau periksa batas
  pemakaian akun.
- Pantau pemakaian dan biaya di dashboard OpenRouter.
- Aplikasi sendiri **tidak menyimpan** teks CV: fungsi backend hanya
  meneruskannya ke OpenRouter dan tidak mencatat isinya ke log.

## Catatan

- **Analisis standar 100% client-side**: penilaian rule-based tidak memakai
  backend, database, atau pengiriman data ke server — file dan teks CV hanya
  diproses di browser pengguna. Satu-satunya pengecualian adalah fitur
  Analisis AI di atas, yang hanya berjalan atas persetujuan pengguna.
- Penilaian standar bersifat **rule-based** (berbasis aturan) — bukan
  keputusan rekruter.
