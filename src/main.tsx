import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Pemulihan tab basi: setelah situs diperbarui (deploy baru), tab yang
// masih terbuka sejak versi lama memegang nama berkas versi lama. Saat
// pengguna memicu muatan malas (mis. modul pembaca berkas CV) dan berkas
// lamanya sudah tidak ada di server, Vite memancarkan 'vite:preloadError'.
// Tangkap event itu dan muat ulang halaman agar tab mengambil versi
// terbaru. Penjaga cap waktu di sessionStorage mencegah lingkaran muat
// ulang bila kegagalannya ternyata bukan soal versi (mis. koneksi putus).
const CHUNK_RELOAD_KEY = 'screening-cv:chunk-reload:v1'
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  const now = Date.now()
  try {
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0)
    if (Number.isFinite(last) && now - last < 60_000) return
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now))
  } catch {
    // sessionStorage tidak tersedia: tetap muat ulang sekali ini.
  }
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
