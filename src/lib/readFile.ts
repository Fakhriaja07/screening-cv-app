// Ekstraksi teks dari file CV (PDF/DOCX/TXT) — semua berjalan lokal di browser.
// pdf.js dan mammoth TIDAK diimpor statis: modul ini sendiri dimuat
// dinamis oleh App.tsx hanya saat pengguna mengunggah berkas, dan tiap
// parser dimuat dinamis di dalam fungsinya — bundle awal tidak lagi
// memikul ±0,9 MB parser yang hanya dibutuhkan pengunggah (ulasan
// eksternal 2026-11-28).

// Batas ukuran berkas (audit 2026-11-24: sebelumnya TANPA batas — PDF
// raksasa/rusak bisa membuat tab membeku kehabisan memori saat diurai
// pdf.js/mammoth, tanpa pesan apa pun). 10 MB jauh di atas CV wajar
// mana pun (CV PDF umumnya < 1 MB).
export const MAX_FILE_BYTES = 10 * 1024 * 1024

async function extractPdf(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const lines: string[] = []
    let current = ''
    for (const item of content.items) {
      const str = (item as { str?: string }).str ?? ''
      const hasEol = (item as { hasEOL?: boolean }).hasEOL ?? false
      current += str
      if (hasEol) {
        lines.push(current)
        current = ''
      } else {
        current += ' '
      }
    }
    if (current.trim()) lines.push(current)
    pages.push(lines.join('\n'))
  }
  return pages.join('\n')
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = (await import('mammoth')).default
  const buffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })
  return result.value
}

export async function extractTextFromFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(
      `File terlalu besar (${(file.size / (1024 * 1024)).toFixed(1)} MB). Batas maksimal 10 MB — kompres dulu atau tempel teks CV secara manual.`,
    )
  }
  if (file.size === 0) {
    throw new Error('File kosong (0 byte). Pilih file CV yang berisi teks.')
  }
  const name = file.name.toLowerCase()
  // Error mentah dari pdf.js/mammoth (bahasa Inggris, istilah teknis)
  // tidak ditampilkan ke pengguna — dibungkus pesan yang bisa ditindak.
  if (name.endsWith('.pdf')) {
    try {
      return await extractPdf(file)
    } catch {
      throw new Error(
        'File PDF tidak bisa dibaca — file mungkin rusak atau terproteksi kata sandi. Coba file lain, atau tempel teks CV secara manual.',
      )
    }
  }
  if (name.endsWith('.docx')) {
    try {
      return await extractDocx(file)
    } catch {
      throw new Error(
        'File DOCX tidak bisa dibaca — file mungkin rusak atau bukan dokumen Word yang sah. Coba file lain, atau tempel teks CV secara manual.',
      )
    }
  }
  if (name.endsWith('.txt') || file.type.startsWith('text/')) return file.text()
  throw new Error('Format file tidak didukung. Gunakan PDF, DOCX, atau TXT.')
}
