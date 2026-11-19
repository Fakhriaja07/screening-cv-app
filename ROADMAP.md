# Roadmap Publik — Screening CV

Disusun 2026-11-18 (malam) dari kondisi situs yang sudah live di
https://screening-cv-app.vercel.app/ dan repo
https://github.com/Fakhriaja07/screening-cv-app.
Terakhir diperbarui 2026-11-19: Fase 0, Fase 1, dan Fase 2 selesai;
Fase 3 (Mode HRD) dibatalkan atas keputusan pengguna.

## Nilai jual yang sudah dimiliki (terverifikasi di kode)

- **Privasi:** analisis 100% di browser, CV tidak diunggah ke server
  (`src/lib/analyze.ts`, `src/lib/readFile.ts` — rule-based, tanpa backend).
- **Gratis, tanpa daftar, hasil seketika:** tanpa akun/paywall di tengah hasil.
- **Untuk Indonesia:** Bahasa Indonesia penuh; deteksi nomor HP 08 / +62 /
  format kurung; deteksi link portofolio (GitHub, Vercel, Notion, dll).
- **Skor jujur & transparan:** 100 poin, 6 aspek, 14 pemeriksaan; CV kuat
  100, CV menengah 57, CV lemah 16 (uji di `scripts/run-tests.ts`).
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
- Tidak ada tombol bagikan hasil dan tidak ada bukti sosial
  (testimoni / jumlah CV dianalisis).

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
  skor di `analyze.ts` tidak berubah (skor uji tetap 100/57/16).
  Uji di `scripts/run-tests.ts`.

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
