// Contoh perbaikan PERSONAL untuk tombol "Lihat contoh" di daftar
// Prioritas Perbaikan: kutipan diambil dari teks CV yang benar-benar
// dianalisis, bukan contoh generik yang sama untuk semua orang.
//
// Prinsip anti-karang (sama seperti examples.ts dan fitur Analisis AI):
// modul ini TIDAK PERNAH mengarang angka, nama perusahaan, tanggal,
// atau pencapaian. Versi perbaikan hanya:
//   (a) memakai kata-kata pengguna sendiri apa adanya,
//   (b) mengganti kata yang salah eja dengan bentuk bakunya dari kamus
//       yang sama, atau
//   (c) menyisipkan placeholder [kurung siku] yang wajib diisi pengguna
//       dengan fakta aslinya sendiri.
//
// Bukti dikutip memakai kamus/logika yang SAMA dengan pemeriksaannya di
// analyze.ts (penemu frasa lemah, parser entri pengalaman, penghitung
// hasil terukur, daftar salah eja, penemu kata "saya") — tidak ada
// kamus atau parser kedua di sini. Pemeriksaan yang buktinya tidak bisa
// dikutip secara andal, atau yang sifatnya ketiadaan (mis. LinkedIn
// belum tercantum), TIDAK dipersonalisasi — UI menampilkan contoh
// generik dari examples.ts seperti sebelumnya.

import {
  ACTION_VERBS,
  BULLET_LINE,
  SAYA_OVERUSE_THRESHOLD,
  countWords,
  findSayaOccurrences,
  findTypos,
  findWeakPhraseOccurrences,
  getExperienceEntryDetails,
  getExperienceSectionRange,
  getSummarySection,
  type AnalysisResult,
  type CheckItem,
  type ExperienceEntryDetail,
} from './analyze'

export interface PersonalExample {
  kutipanAsli: string
  versiPerbaikan: string
  catatan: string
}

const ANTI_KARANG =
  'Bagian dalam [kurung siku] adalah tempat kosong yang harus kamu isi dengan fakta aslimu sendiri — jangan mengarang angka atau pencapaian.'

function findCheck(result: AnalysisResult, id: string): CheckItem | null {
  for (const aspect of result.aspects) {
    const found = aspect.checks.find((c) => c.id === id)
    if (found) return found
  }
  return null
}

// Hanya pemeriksaan yang belum "baik" yang dipersonalisasi — yang sudah
// lolos penuh tidak butuh contoh perbaikan dari CV pengguna.
function needsFix(result: AnalysisResult, id: string): CheckItem | null {
  const check = findCheck(result, id)
  return check && check.status !== 'baik' ? check : null
}

function truncate(text: string, max: number): string {
  const t = text.trim()
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`
}

function capitalize(word: string): string {
  return word ? word[0].toUpperCase() + word.slice(1) : word
}

// Rentang baris (di teks asli) yang memuat karakter pada offset tertentu.
function lineRangeAtOffset(text: string, offset: number): { start: number; end: number } {
  const start = text.lastIndexOf('\n', offset - 1) + 1
  const nl = text.indexOf('\n', offset)
  return { start, end: nl === -1 ? text.length : nl }
}

// ---------- Frasa lemah & klise ----------

function personalWeakPhrase(result: AnalysisResult, cvText: string): PersonalExample | null {
  if (!needsFix(result, 'frasa-lemah')) return null
  const occurrences = findWeakPhraseOccurrences(cvText)
  if (occurrences.length === 0) return null
  const first = occurrences[0]
  const { start, end } = lineRangeAtOffset(cvText, first.start)
  const rawLine = cvText.slice(start, end)
  if (!rawLine.trim()) return null
  // Ganti SEMUA frasa lemah pada baris kutipan dengan tempat bukti,
  // memakai rentang kemunculan dari penemu yang sama (dari belakang
  // agar offset sebelumnya tidak bergeser).
  const inLine = occurrences
    .filter((o) => o.start >= start && o.end <= end)
    .sort((a, b) => b.start - a.start)
  let fixed = rawLine
  for (const o of inLine) {
    fixed = `${fixed.slice(0, o.start - start)}[bukti konkretmu]${fixed.slice(o.end - start)}`
  }
  return {
    kutipanAsli: truncate(rawLine, 240),
    versiPerbaikan: truncate(fixed, 300),
    catatan:
      `Frasa "${first.display}" adalah klaim generik tanpa bukti — hampir semua pelamar menulisnya. ` +
      `Di versi perbaikan, frasa itu diganti tempat bukti: tuliskan hasil nyata yang kamu capai (angka, jumlah, atau contoh kejadian). ${ANTI_KARANG}`,
  }
}

// ---------- Hasil terukur ----------

function personalMeasurable(result: AnalysisResult, cvText: string): PersonalExample | null {
  if (!needsFix(result, 'hasil-terukur')) return null
  const entries = getExperienceEntryDetails(cvText)
  const target = entries.find((e) => e.hasContent && e.measurableCount === 0)
  if (!target) return null
  const bullet = target.lines.find((l) => BULLET_LINE.test(l))
  const quote = bullet ?? target.lines[1] ?? target.lines[0]
  if (!quote) return null
  const base = quote.replace(/\.\s*$/, '')
  return {
    kutipanAsli: truncate(quote, 240),
    versiPerbaikan:
      `${base} [tambahkan hasil terukurmu di sini: persen, jumlah, atau nominal hasil aslimu]`,
    catatan:
      `Poin dari CV-mu ini belum memuat satu pun angka pencapaian, jadi rekruter tidak bisa menilai dampak kerjamu. ${ANTI_KARANG}`,
  }
}

// ---------- Kedalaman entri ----------

function personalDepth(result: AnalysisResult, cvText: string): PersonalExample | null {
  if (!needsFix(result, 'kedalaman-entri')) return null
  const entries = getExperienceEntryDetails(cvText)
  const target: ExperienceEntryDetail | undefined = entries.find((e) => !e.complete)
  if (!target || target.lines.length === 0) return null
  const lines = [...target.lines]
  const additions: string[] = []
  if (!target.hasCompany) additions.push('— [nama perusahaan/tempat kerja]')
  if (!target.hasPeriod) additions.push('([periode: tahun mulai – tahun selesai])')
  if (additions.length > 0) lines[0] = `${lines[0]} ${additions.join(' ')}`
  if (!target.hasContent) {
    lines.push('• [uraian tugas dan hasilmu — apa yang kamu kerjakan dan apa hasilnya]')
  }
  const missingParts = [
    !target.hasCompany ? 'nama perusahaan' : null,
    !target.hasPeriod ? 'periode' : null,
    !target.hasContent ? 'uraian isi' : null,
  ].filter(Boolean)
  return {
    kutipanAsli: truncate(target.text, 260),
    versiPerbaikan: truncate(lines.join('\n'), 340),
    catatan:
      `Entri pengalamanmu ini belum lengkap (${missingParts.join(', ')} belum terbaca). ` +
      `Entri yang dinilai lengkap memuat jabatan + perusahaan + periode + uraian isi. ${ANTI_KARANG}`,
  }
}

// ---------- Kata kerja aksi ----------

// Awalan poin yang jelas-jelas bukan kata kerja aksi kuat: kata ganti
// orang pertama, kata benda pengisi, frasa "bertanggung jawab", dan
// kata depan. Poin yang diawali kata kerja lain (mis. "Melayani",
// "Mencatat") dianggap sudah berbentuk kata kerja dan tidak dipaksakan
// menjadi contoh — pemeriksaan ini menilai variasi kata kerja kuat,
// bukan menghukum kata kerja yang sah.
const FILLER_STARTERS = new Set(['bagian', 'tugas', 'pekerjaan', 'jobdesk', 'deskripsi', 'di'])

function personalActionVerb(result: AnalysisResult, cvText: string): PersonalExample | null {
  if (!needsFix(result, 'kata-kerja-aksi')) return null
  const range = getExperienceSectionRange(cvText)
  if (!range) return null
  const section = cvText.slice(range.start, range.end)
  const bullets = section
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => BULLET_LINE.test(l))
  for (const bullet of bullets) {
    const body = bullet.replace(BULLET_LINE, '').trim()
    if (!body) continue
    const firstMatch = body.match(/^[A-Za-zÀ-ÿ]+/)
    if (!firstMatch) continue
    const firstWord = firstMatch[0].toLowerCase()
    if (ACTION_VERBS.includes(firstWord)) continue
    if (/^me/i.test(firstWord) || /^ber(?!tanggung)/i.test(firstWord)) continue // sudah kata kerja
    const isCandidate =
      firstWord === 'saya' ||
      FILLER_STARTERS.has(firstWord) ||
      /^bertanggung\s+jawab/i.test(body)
    if (!isCandidate) continue

    let fixed: string
    if (firstWord === 'saya') {
      const rest = body.slice(firstMatch[0].length).trim()
      if (/^bertanggung\s+jawab\s+atas\b/i.test(rest)) {
        const after = rest.replace(/^bertanggung\s+jawab\s+atas\s*/i, '')
        fixed = `• [kata kerja aksi — mis. Mengelola / Melayani / Memimpin] ${after}`
      } else {
        const nextMatch = rest.match(/^[A-Za-zÀ-ÿ]+/)
        const next = nextMatch?.[0] ?? ''
        if (
          next &&
          (/^me/i.test(next) || /^ber/i.test(next) || ACTION_VERBS.includes(next.toLowerCase()))
        ) {
          // Aman secara tata bahasa: buang "Saya", kata kerja berikutnya
          // menjadi awal kalimat.
          fixed = `• ${capitalize(next)}${rest.slice(next.length)}`
        } else {
          fixed = `• [kata kerja aksi — mis. Mengelola / Meningkatkan / Membangun] ${rest}`
        }
      }
    } else if (/^bertanggung\s+jawab/i.test(body)) {
      const after = body.replace(/^bertanggung\s+jawab\s+atas\s*/i, '')
      fixed = `• [kata kerja aksi — mis. Mengelola / Melayani / Memimpin] ${after}`
    } else {
      const rest = body.slice(firstMatch[0].length).trim()
      fixed = `• [kata kerja aksi — mis. Mengelola / Meningkatkan / Membangun] ${rest}`
    }
    return {
      kutipanAsli: truncate(bullet, 240),
      versiPerbaikan: truncate(fixed, 300),
      catatan:
        'Poin pengalaman sebaiknya langsung diawali kata kerja aksi yang menunjukkan peran aktifmu, bukan kata ganti atau kata benda pengisi. ' +
        'Bila kata kerja masih dalam [kurung siku], pilih satu yang benar-benar sesuai tugasmu lalu hapus kurungnya.',
    }
  }
  return null
}

// ---------- Kerapian bahasa ----------

function personalNeatness(result: AnalysisResult, cvText: string): PersonalExample | null {
  if (!needsFix(result, 'kerapian-bahasa')) return null

  // 1) Salah eja: koreksi bakunya pasti, jadi ini contoh paling konkret.
  const typos = findTypos(cvText.toLowerCase())
  if (typos.length > 0) {
    const typo = typos[0]
    const re = new RegExp(`\\b${typo.wrong}\\b`, 'i')
    const line = cvText
      .split('\n')
      .map((l) => l.trim())
      .find((l) => re.test(l))
    if (line) {
      const fixed = line.replace(re, (m) =>
        m[0] === m[0].toUpperCase() ? capitalize(typo.right) : typo.right,
      )
      return {
        kutipanAsli: truncate(line, 240),
        versiPerbaikan: truncate(fixed, 260),
        catatan:
          `"${typo.wrong}" bukan ejaan baku — bentuk bakunya "${typo.right}".` +
          (typos.length > 1
            ? ` Total ada ${typos.length} kata dari daftar salah eja yang ditemukan di CV-mu; periksa dan betulkan semuanya.`
            : ' Periksa kembali seluruh CV sebelum mengirim — ejaan yang rapi menandakan ketelitian.'),
      }
    }
  }

  // 2) "Saya" berlebihan: kutip poin pengalaman yang diawali "Saya"
  // dan tunjukkan versi tanpa kata ganti, dari kata-kata pengguna
  // sendiri (kata berikutnya menjadi awal kalimat).
  const occurrences = findSayaOccurrences(cvText)
  if (occurrences.length >= SAYA_OVERUSE_THRESHOLD) {
    const range = getExperienceSectionRange(cvText)
    if (range) {
      const sectionLines = cvText
        .slice(range.start, range.end)
        .split('\n')
        .map((l) => l.trim())
      const sayaBullets = sectionLines.filter((l) => {
        if (!BULLET_LINE.test(l)) return false
        return /^saya\b/i.test(l.replace(BULLET_LINE, '').trim())
      })
      if (sayaBullets.length > 0) {
        const picked = sayaBullets.slice(0, 2)
        const fixedLines = picked.map((l) => {
          const body = l.replace(BULLET_LINE, '').trim()
          const rest = body.replace(/^saya\s+/i, '')
          return `• ${capitalize(rest)}`
        })
        return {
          kutipanAsli: truncate(picked.join('\n'), 260),
          versiPerbaikan: truncate(fixedLines.join('\n'), 260),
          catatan:
            `Kata "saya" muncul ${occurrences.length} kali di bagian pengalamanmu. Poin yang profesional langsung diawali kata kerja — ` +
            'seperti versi perbaikan di atas, isinya tetap kata-katamu sendiri, hanya kata gantinya yang dibuang.',
        }
      }
    }
  }
  return null
}

// ---------- Ringkasan ----------

function flatten(text: string): string {
  return text.replace(/\s*\n\s*/g, ' ').trim()
}

function personalSummary(
  result: AnalysisResult,
  cvText: string,
  targetRole: string,
): PersonalExample | null {
  if (!needsFix(result, 'ringkasan')) return null
  const summary = getSummarySection(cvText)
  if (!summary) return null
  const words = countWords(summary)
  const role = targetRole.trim()
  const closing = role
    ? `[tutup dengan posisi yang kamu cari — posisi target yang kamu isi adalah "${role}", sebutkan bidang itu secara eksplisit]`
    : '[tutup dengan satu kalimat: posisi yang kamu cari dan kontribusi yang ingin kamu berikan]'
  return {
    kutipanAsli: truncate(flatten(summary), 280),
    versiPerbaikan: `${truncate(flatten(summary), 280)} ${closing}`,
    catatan:
      `Ringkasanmu saat ini ${words} kata; idealnya 40 kata atau lebih yang memuat profesi/jurusan, pengalaman, 2–3 skill utama, dan posisi yang dicari. ` +
      `Perluas hanya dengan pengalaman dan skill yang benar-benar kamu miliki. ${ANTI_KARANG}`,
  }
}

function personalSummaryRelevance(
  result: AnalysisResult,
  cvText: string,
  targetRole: string,
): PersonalExample | null {
  if (!needsFix(result, 'relevansi-ringkasan')) return null
  const summary = getSummarySection(cvText)
  if (!summary) return null
  const role = targetRole.trim()
  if (!role) return null
  const flat = flatten(summary)
  const withPeriod = /[.!?]$/.test(flat) ? flat : `${flat}.`
  return {
    kutipanAsli: truncate(flat, 280),
    versiPerbaikan: `${truncate(withPeriod, 280)} Saat ini saya mencari posisi ${role}.`,
    catatan:
      `Ringkasanmu belum menyebut posisi/bidang "${role}" yang kamu tuju. Kalimat penutup pada versi perbaikan memakai posisi target yang kamu isi sendiri — ` +
      'sesuaikan redaksinya dengan gayamu, yang penting bidang yang dituju terbaca eksplisit oleh rekruter.',
  }
}

// ---------- Pembangun utama ----------

// Peta id pemeriksaan → contoh personal, hanya untuk pemeriksaan yang
// (a) belum "baik", dan (b) buktinya bisa dikutip secara andal dari
// teks CV. Id yang tidak ada di peta ini ditampilkan UI dengan contoh
// generik seperti sebelumnya.
export function buildPersonalExamples(
  result: AnalysisResult,
  cvText: string,
  targetRole: string,
): Partial<Record<string, PersonalExample>> {
  const out: Partial<Record<string, PersonalExample>> = {}
  const put = (id: string, ex: PersonalExample | null) => {
    if (ex) out[id] = ex
  }
  if (!cvText.trim()) return out
  put('frasa-lemah', personalWeakPhrase(result, cvText))
  put('hasil-terukur', personalMeasurable(result, cvText))
  put('kedalaman-entri', personalDepth(result, cvText))
  put('kata-kerja-aksi', personalActionVerb(result, cvText))
  put('kerapian-bahasa', personalNeatness(result, cvText))
  put('ringkasan', personalSummary(result, cvText, targetRole))
  put('relevansi-ringkasan', personalSummaryRelevance(result, cvText, targetRole))
  return out
}
