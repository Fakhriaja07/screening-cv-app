// Ekstraksi teks dari file CV (PDF/DOCX/TXT) — semua berjalan lokal di browser.
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import mammoth from 'mammoth'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

async function extractPdf(file: File): Promise<string> {
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
  const buffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })
  return result.value
}

export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) return extractPdf(file)
  if (name.endsWith('.docx')) return extractDocx(file)
  if (name.endsWith('.txt') || file.type.startsWith('text/')) return file.text()
  throw new Error('Format file tidak didukung. Gunakan PDF, DOCX, atau TXT.')
}
