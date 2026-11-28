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
import type { Lang } from './lang'

export interface ReportOptions {
  // Hasil Analisis AI — disertakan sebagai bagian terakhir bila ada.
  ai?: AiAnalysis | null
  // Posisi target yang diisi pengguna saat analisis (opsional).
  targetRole?: string
  // Tanggal analisis. Bila diberikan, dicantumkan di kepala laporan.
  date?: Date
  // Bahasa label/heading laporan. Isi hasil analisis sendiri sudah
  // terlokalisasi dari mesin analisis/AI; di sini hanya label tetap.
  lang?: Lang
}

// Format tanggal gaya riwayat skor: "21 Nov 2026, 21.47".
export function formatReportDate(date: Date, lang: Lang = 'id'): string {
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'id-ID', {
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
  const en = opts.lang === 'en'
  const lines: string[] = [en ? 'CV SCREENING RESULTS' : 'HASIL SCREENING CV']
  if (opts.date) lines.push(`${en ? 'Analysis date' : 'Tanggal analisis'}: ${formatReportDate(opts.date, opts.lang)}`)
  const role = opts.targetRole?.trim()
  if (role) lines.push(`${en ? 'Target position' : 'Posisi target'}: ${role}`)
  lines.push(
    `${en ? 'Score' : 'Skor'}: ${result.total}/100 — ${result.label}`,
    `${en ? 'Total words' : 'Total kata'}: ${result.wordCount}`,
    '',
    en ? 'SCORES BY ASPECT:' : 'SKOR PER ASPEK:',
    ...result.aspects.map((a) => `- ${a.name}: ${a.score}/${a.max}`),
    '',
    en ? 'STRENGTHS:' : 'KEKUATAN:',
    ...(result.strengths.length
      ? result.strengths.map((c) => `- ${c.title}: ${c.message}`)
      : [en ? '- (none yet)' : '- (belum ada)']),
    '',
    en ? 'TOP FIXES TO MAKE:' : 'PRIORITAS PERBAIKAN:',
    ...(result.priorities.length
      ? result.priorities.map((c) => `- ${c.title} (${c.score}/${c.max}): ${c.message}`)
      : [en ? '- None — every check passed.' : '- Tidak ada, semua pemeriksaan lolos.']),
  )
  if (result.keywords) {
    lines.push('', `${en ? 'JOB KEYWORD MATCH' : 'KECOCOKAN KATA KUNCI LOWONGAN'}: ${result.keywords.percent}%`)
    lines.push(`${en ? 'Found' : 'Ketemu'}: ${result.keywords.found.join(', ') || '-'}`)
    lines.push(`${en ? 'Missing' : 'Belum ada'}: ${result.keywords.missing.join(', ') || '-'}`)
    if (result.jobMatchApplied) {
      lines.push(
        en
          ? 'Note: the total score above already includes the Job Match aspect (20 points), because a job description was provided.'
          : 'Catatan: skor total di atas sudah mencakup aspek Kecocokan dengan Lowongan (20 poin), karena deskripsi lowongan diisi.',
      )
    }
  }
  if (result.roleWarning) lines.push('', `${en ? 'POSITION NOTE' : 'CATATAN POSISI'}: ${result.roleWarning}`)

  const ai = opts.ai
  if (ai) {
    lines.push('', 'ANALISIS AI:')
    if (ai.ringkasan) lines.push('', `${en ? 'Summary' : 'Ringkasan'}: ${ai.ringkasan}`)
    if (ai.penilaianPosisi) lines.push('', `${en ? 'Position Assessment' : 'Penilaian Posisi'}: ${ai.penilaianPosisi}`)
    if (ai.saranPenulisanUlang.length > 0) {
      lines.push('', en ? 'Rewrite Suggestions:' : 'Saran Penulisan Ulang:')
      ai.saranPenulisanUlang.forEach((r, i) => {
        lines.push(`${i + 1}. ${en ? 'Original' : 'Asli'}: ${r.asli}`)
        lines.push(`   ${en ? 'Suggestion' : 'Saran'}: ${r.saran}`)
        if (r.alasan) lines.push(`   ${en ? 'Why' : 'Alasan'}: ${r.alasan}`)
      })
    }
    if (ai.kekurangan.length > 0) {
      lines.push('', en ? 'Shortcomings:' : 'Kekurangan:')
      ai.kekurangan.forEach((k) => lines.push(`- ${k}`))
    }
    if (ai.saranRingkasan) lines.push('', `${en ? 'Sample Profile Summary' : 'Contoh Ringkasan Profil'}: ${ai.saranRingkasan}`)
    if (ai.perbaikanLengkap && ai.perbaikanLengkap.length > 0) {
      lines.push('', en ? 'FULL FIXES FROM THE AI:' : 'PERBAIKAN LENGKAP DARI AI:')
      ai.perbaikanLengkap.forEach((f, i) => {
        lines.push(`${i + 1}. ${f.judul}`)
        if (f.sebelum) lines.push(`   ${en ? 'Before' : 'Sebelum'}: ${f.sebelum}`)
        lines.push(`   ${en ? 'After' : 'Sesudah'}: ${f.sesudah}`)
        if (f.catatan) lines.push(`   ${en ? 'Note' : 'Catatan'}: ${f.catatan}`)
      })
    }
  }
  return lines.join('\n')
}
