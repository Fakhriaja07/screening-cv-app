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
npx vercel dev   # butuh Vercel CLI; membaca .env.local untuk GEMINI_API_KEY
```

## Fitur

- Upload CV **PDF** (pdfjs-dist, worker dari paket itu sendiri), **DOCX** (mammoth),
  atau **TXT** — bisa drag & drop — atau tempel teks CV langsung.
- Input posisi target dan deskripsi lowongan (opsional).
- Hasil: ring skor beranimasi, bar per aspek, daftar kekuatan, prioritas perbaikan
  terurut dengan detail per pemeriksaan, cek kata kunci lowongan, tombol salin
  laporan, tombol reset, dan tombol "Coba CV Contoh".
- Penghitung karakter/kata langsung pada textarea CV.
- **Analisis AI (Gemini)** — opsional, atas persetujuan pengguna: saran
  penulisan ulang, kekurangan kualitatif, dan contoh ringkasan profil dari
  backend `api/analyze-ai.ts` (lihat bagian Backend AI).

## Struktur Folder

```
api/
  analyze-ai.ts      Backend Analisis AI (Vercel Serverless Function → Gemini)
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

## Aturan Penilaian (total 100 poin, 6 aspek, 14 pemeriksaan)

Poin hanya diberikan untuk bukti isi yang benar-benar ada; bagian kosong = 0.

| Aspek | Maks | Pemeriksaan |
| --- | --- | --- |
| Kontak | 20 | Email valid (7), nomor HP Indonesia (6), LinkedIn (4), link portofolio (3) |
| Ringkasan | 10 | Panjang isi ringkasan: ≥40 kata = 10, 20–39 = 7, 8–19 = 4, 1–7 = 2 |
| Pengalaman | 28 | Bagian pengalaman (10), kata kerja aksi berbeda ≥5 = 8, angka pencapaian ≥3 = 10 |
| Pendidikan | 12 | Pendidikan tercantum (8), IPK/GPA (4) |
| Keahlian | 10 | Jumlah item skill: ≥8 = 10, 5–7 = 7, 3–4 = 4, 1–2 = 2 |
| Format & ATS | 20 | Panjang 220–900 kata = 10, tahun/periode tercantum (5), bullet ≥6 = 5 |

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
- **Label**: ≥85 "Sangat Siap Dilamar", ≥70 "Sudah Bagus", ≥50 "Perlu Perbaikan",
  <50 "Perlu Dirombak Dulu".
- **Kata kunci lowongan** (terpisah, tidak mengubah skor): 18 kata paling sering
  dari deskripsi lowongan (stopword dibuang) dicek keberadaannya di CV.

## Backend AI (Gemini) — fitur "Analisis AI"

Selain penilaian rule-based, ada fitur opsional **Analisis AI** yang memakai
Google Gemini untuk saran kualitatif: penulisan ulang poin pengalaman, daftar
kekurangan (terhadap lowongan bila diisi), dan contoh ringkasan profil.
Fitur ini **tidak mengubah skor utama**.

### Arsitektur

```
Browser ──POST /api/analyze-ai──▶ Vercel Serverless Function ──▶ Google Gemini
         {cvText, targetRole,      (api/analyze-ai.ts,            (generateContent,
          jobDesc}                   API key di env server)         JSON terstruktur)
```

- Endpoint hanya menerima `POST` JSON: `cvText` (wajib, 50–12.000 karakter),
  `targetRole` (opsional), `jobDesc` (opsional, maks 6.000 karakter).
- Ada rate limit sederhana in-memory: maks 5 permintaan per 10 menit per IP
  (best-effort per instance fungsi).
- Frontend hanya memanggil endpoint setelah pengguna mencentang persetujuan
  pengiriman teks CV. Bila kuota Gemini habis, endpoint membalas 429 dan
  analisis standar tetap bisa dipakai.

### Memasang API key

1. Buat API key gratis di **Google AI Studio** (aistudio.google.com → Get API key).
2. Di **Vercel**: Project `screening-cv-app` → Settings → Environment Variables →
   tambahkan `GEMINI_API_KEY` (dan opsional `GEMINI_MODEL`, default
   `gemini-3.8-flash`).
3. **Redeploy** project (Deployments → ⋯ → Redeploy) agar variabel terbaca.
4. Untuk uji lokal: salin `.env.example` menjadi `.env.local`, isi key-nya,
   lalu jalankan `npx vercel dev`.

Tanpa key, endpoint membalas `500` dengan pesan "GEMINI_API_KEY belum
terpasang" dan bagian Analisis AI menampilkan pesan itu — situs dan analisis
standar tidak terganggu.

### Catatan free tier & privasi

- Tier gratis Gemini punya **kuota terbatas** (per menit/hari) — cukup untuk
  uji coba dan pengguna awal; pantau pemakaian di Google AI Studio.
- Menurut ketentuan Google, data yang dikirim lewat **tier gratis dapat
  dipakai Google untuk meningkatkan produknya**; tier berbayar tidak begitu.
  Pertimbangkan naik tier sebelum peluncuran komersial.
- Aplikasi sendiri **tidak menyimpan** teks CV: fungsi backend hanya
  meneruskannya ke Gemini dan tidak mencatat isinya ke log.

## Catatan

- **Analisis standar 100% client-side**: penilaian rule-based tidak memakai
  backend, database, atau pengiriman data ke server — file dan teks CV hanya
  diproses di browser pengguna. Satu-satunya pengecualian adalah fitur
  Analisis AI di atas, yang hanya berjalan atas persetujuan pengguna.
- Penilaian standar bersifat **rule-based** (berbasis aturan) — bukan
  keputusan rekruter.
