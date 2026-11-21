// Pembangun teks laporan hasil analisis — sumber isi tunggal untuk
// berkas PDF yang dibuat src/lib/pdf.ts (tombol "Unduh Laporan (PDF)"
// di kartu Analisis AI). Baris-baris teksnya ditata ulang menjadi
// dokumen PDF A4 oleh modul itu.
//
// Laporan hanya berisi HASIL analisis (skor, aspek, kekuatan, prioritas
// perbaikan, kata kunci, dan hasil AI bila ada) — tidak pernah memuat
// teks CV pengguna, dan tidak disimpan ke localStorage/server mana pun.
import type { AnalysisResult } from './analyze'
import type { AiAnalysis } from './ai'

export interface ReportOptions {
  // Hasil Analisis AI — disertakan sebagai bagian terakhir bila ada.
  ai?: AiAnalysis | null
  // Posisi target yang diisi pengguna saat analisis (opsional).
  targetRole?: string
  // Tanggal analisis. Bila diberikan, dicantumkan di kepala laporan.
  date?: Date
}

// Format tanggal gaya riwayat skor: "21 Nov 2026, 21.47".
export function formatReportDate(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

// Nama berkas unduhan PDF: laporan-cv-2026-11-21.pdf (tanggal lokal).
export function reportFileName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `laporan-cv-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.pdf`
}

export function buildReportText(result: AnalysisResult, opts: ReportOptions = {}): string {
  const lines: string[] = ['HASIL SCREENING CV']
  if (opts.date) lines.push(`Tanggal analisis: ${formatReportDate(opts.date)}`)
  const role = opts.targetRole?.trim()
  if (role) lines.push(`Posisi target: ${role}`)
  lines.push(
    `Skor: ${result.total}/100 — ${result.label}`,
    `Total kata: ${result.wordCount}`,
    '',
    'SKOR PER ASPEK:',
    ...result.aspects.map((a) => `- ${a.name}: ${a.score}/${a.max}`),
    '',
    'KEKUATAN:',
    ...(result.strengths.length
      ? result.strengths.map((c) => `- ${c.title}: ${c.message}`)
      : ['- (belum ada)']),
    '',
    'PRIORITAS PERBAIKAN:',
    ...(result.priorities.length
      ? result.priorities.map((c) => `- ${c.title} (${c.score}/${c.max}): ${c.message}`)
      : ['- Tidak ada, semua pemeriksaan lolos.']),
  )
  if (result.keywords) {
    lines.push('', `KECOCOKAN KATA KUNCI LOWONGAN: ${result.keywords.percent}%`)
    lines.push(`Ketemu: ${result.keywords.found.join(', ') || '-'}`)
    lines.push(`Belum ada: ${result.keywords.missing.join(', ') || '-'}`)
    if (result.jobMatchApplied) {
      lines.push('Catatan: skor total di atas sudah mencakup aspek Kecocokan dengan Lowongan (20 poin), karena deskripsi lowongan diisi.')
    }
  }
  if (result.roleWarning) lines.push('', `CATATAN POSISI: ${result.roleWarning}`)

  const ai = opts.ai
  if (ai) {
    lines.push('', 'ANALISIS AI:')
    if (ai.ringkasan) lines.push('', `Ringkasan: ${ai.ringkasan}`)
    if (ai.saranPenulisanUlang.length > 0) {
      lines.push('', 'Saran Penulisan Ulang:')
      ai.saranPenulisanUlang.forEach((r, i) => {
        lines.push(`${i + 1}. Asli: ${r.asli}`)
        lines.push(`   Saran: ${r.saran}`)
        if (r.alasan) lines.push(`   Alasan: ${r.alasan}`)
      })
    }
    if (ai.kekurangan.length > 0) {
      lines.push('', 'Kekurangan:')
      ai.kekurangan.forEach((k) => lines.push(`- ${k}`))
    }
    if (ai.saranRingkasan) lines.push('', `Contoh Ringkasan Profil: ${ai.saranRingkasan}`)
  }
  return lines.join('\n')
}
