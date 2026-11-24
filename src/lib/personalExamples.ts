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
  LANGUAGE_MENTION,
  PERIOD_FAMILY_LABEL,
  SAYA_OVERUSE_THRESHOLD,
  countWords,
  findSayaOccurrences,
  findTypos,
  findWeakPhraseOccurrences,
  getExperienceEntryDetails,
  getExperienceSectionRange,
  getLanguageItems,
  getPeriodExprs,
  getRoleWords,
  getSkillItems,
  getSummarySection,
  getTimelineFacts,
  type AnalysisResult,
  type CheckItem,
  type ExperienceEntryDetail,
} from './analyze'
import { checkSkills, getRoleSkills } from './examples'

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

// ---------- Linimasa & konsistensi: judul entri pengguna sendiri ----------

// Baris judul entri: baris-baris awal entri sebelum poin isi pertama —
// biasanya satu baris "Jabatan — Perusahaan (periode)", kadang judul
// dan periode pada dua baris terpisah. Dikutip persis seperti tertulis.
function entryHeaderLines(entry: ExperienceEntryDetail): string[] {
  const header: string[] = []
  for (const line of entry.lines) {
    if (BULLET_LINE.test(line)) break
    header.push(line)
  }
  return header.length > 0 ? header : entry.lines.slice(0, 1)
}

// ---------- Linimasa pengalaman ----------

function personalTimeline(result: AnalysisResult, cvText: string): PersonalExample | null {
  if (!needsFix(result, 'linimasa')) return null
  // Fakta jeda & kebaruan dari perhitungan yang sama dengan
  // pemeriksaannya — tahun-tahun di contoh ini selalu tahun yang sama
  // dengan yang disebut pesan pemeriksaan.
  const facts = getTimelineFacts(cvText)
  if (!facts) return null
  if (facts.gaps.length === 0 && !facts.stale) return null
  const entries = getExperienceEntryDetails(cvText).filter((e) => e.startYear !== null)
  if (entries.length === 0) return null

  const quote = entries.map((e) => entryHeaderLines(e).join('\n')).join('\n')

  // Versi perbaikan: entri-entri YANG SAMA diurutkan terbaru→terlama.
  // Susun dulu sebagai unit menaik (entri, lalu placeholder jeda yang
  // mengikutinya), lalu balik urutan unitnya — placeholder jeda tetap
  // berada di antara dua entri yang mengapitnya.
  const asc = [...entries].sort((a, b) => (a.startYear ?? 0) - (b.startYear ?? 0))
  const units: string[] = []
  asc.forEach((entry, i) => {
    units.push(entryHeaderLines(entry).join('\n'))
    const next = asc[i + 1]
    if (next) {
      const gap = facts.gaps.find(
        (g) =>
          g.toYear === next.startYear &&
          g.fromYear === (entry.endYear ?? entry.startYear),
      )
      if (gap) {
        units.push(
          `${gap.fromYear}–${gap.toYear}: [tulis aktivitasmu selama jeda ini: kuliah / kerja / kursus / wirausaha — isi yang sebenarnya]`,
        )
      }
    }
  })
  const fixedLines = units.reverse()
  if (facts.stale) {
    fixedLines.unshift('[peran terkinimu — tahun mulai–Sekarang, bila masih berjalan]')
  }

  const notes: string[] = []
  for (const g of facts.gaps) {
    notes.push(
      `ada jeda sekitar ${g.years} tahun (antara ${g.fromYear} dan ${g.toYear}) yang belum dijelaskan`,
    )
  }
  if (facts.stale) {
    notes.push(
      `peran terakhir yang terbaca berakhir ${facts.latestEnd} (${facts.yearsSinceEnd} tahun lalu) dan tidak ada peran saat ini yang tercantum`,
    )
  }
  return {
    kutipanAsli: truncate(quote, 480),
    versiPerbaikan: truncate(fixedLines.join('\n'), 700),
    catatan:
      `Dari entri pengalamanmu sendiri: ${notes.join('; ')}. Kesenjangan bukan otomatis buruk — ` +
      `yang membuat rekruter ragu adalah kesenjangan TANPA penjelasan; satu baris aktivitas pengisi menutup pertanyaan itu. ${ANTI_KARANG}`,
  }
}

// ---------- Konsistensi format & urutan ----------

// Tulis ulang rentang periode pada judul entri menjadi gaya rentang
// tahun memakai tahun entri itu sendiri yang terbaca dari CV pengguna
// — tidak ada tahun baru yang dikarang, hanya gaya penulisannya yang
// diseragamkan.
function normalizeHeaderPeriod(header: string, entry: ExperienceEntryDetail): string {
  const exprs = getPeriodExprs(header)
  if (exprs.length === 0 || entry.startYear === null) return header
  const endLabel = entry.isCurrent ? 'Sekarang' : String(entry.endYear ?? entry.startYear)
  const span = `${entry.startYear}–${endLabel}`
  const from = exprs[0].index
  const last = exprs[exprs.length - 1]
  const to = last.index + last.raw.length
  return `${header.slice(0, from)}${span}${header.slice(to)}`
}

function personalConsistency(result: AnalysisResult, cvText: string): PersonalExample | null {
  if (!needsFix(result, 'konsistensi-format')) return null
  const range = getExperienceSectionRange(cvText)
  if (!range) return null
  // Bukti dibatasi pada bagian pengalaman: contoh ini menata entri
  // pengalaman, jadi hanya gaya & urutan di bagian itu yang dikutip.
  // Campuran gaya yang sumbernya di bagian lain tidak dipaksakan ke
  // contoh ini — pemeriksaan itu tetap memakai contoh generik.
  const exprs = getPeriodExprs(cvText.slice(range.start, range.end))
  const families = [...new Set(exprs.map((e) => e.family))]
  const entries = getExperienceEntryDetails(cvText).filter((e) => e.startYear !== null)
  if (entries.length < 2) return null
  const yearsInOrder = entries.map((e) => e.startYear as number)
  const isReverse = yearsInOrder.every((y, i) => i === 0 || y <= yearsInOrder[i - 1])
  const mixedFormat = families.length > 1
  if (!mixedFormat && isReverse) return null

  const quote = entries.map((e) => entryHeaderLines(e).join('\n')).join('\n')
  const sorted = [...entries].sort((a, b) => (b.startYear ?? 0) - (a.startYear ?? 0))
  const fixedLines = sorted.map((entry) => {
    const header = entryHeaderLines(entry).join('\n')
    return mixedFormat ? normalizeHeaderPeriod(header, entry) : header
  })

  const notes: string[] = []
  if (mixedFormat) {
    const familyDesc = families
      .map((f) => {
        const ex = exprs.find((e) => e.family === f)
        const label = PERIOD_FAMILY_LABEL[f].replace(/\s*\(mis\..*$/, '')
        return `"${ex?.raw}" (gaya ${label})`
      })
      .join(' dan ')
    notes.push(
      `format penulisan periode campur aduk: ditemukan ${familyDesc}. Di versi perbaikan, semua entrimu ditulis ulang dengan SATU gaya yang sama (rentang tahun) — tahun-tahunnya tetap persis dari CV-mu, hanya gaya penulisannya yang diseragamkan`,
    )
  }
  if (!isReverse) {
    notes.push(
      `urutan entri aslimu (tahun mulai: ${yearsInOrder.join(', ')}) belum dari yang terbaru, jadi versi perbaikan mengurutkannya dari tahun mulai paling baru`,
    )
  }
  return {
    kutipanAsli: truncate(quote, 480),
    versiPerbaikan: truncate(fixedLines.join('\n'), 700),
    catatan: `Dari bagian pengalaman CV-mu sendiri: ${notes.join('; ')}.`,
  }
}

// ---------- Struktur bullet ----------

// Penanda baris jangkar entri — aturan penanda yang sama dengan parser
// entri di analyze.ts (baris memuat tahun/periode atau kata penanda
// peran berjalan). Dipakai untuk memisahkan judul entri dari baris
// uraian isinya di dalam baris-baris entri.
const ENTRY_ANCHOR_MARK = /\b(19|20)\d{2}\b|\b(sekarang|saat ini|present)\b/i

// Pecah satu baris uraian menjadi kalimat-kalimatnya. Pemecahan
// konservatif: hanya pada tanda titik/tanya/seru yang diikuti spasi —
// kata-kata di dalam kalimat tidak disentuh sama sekali.
function splitSentences(line: string): string[] {
  return line
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function personalBullet(result: AnalysisResult, cvText: string): PersonalExample | null {
  if (!needsFix(result, 'bullet')) return null
  const entries = getExperienceEntryDetails(cvText)
  for (const entry of entries) {
    if (!entry.hasContent) continue
    const anchorIdx = entry.lines.findIndex((l) => ENTRY_ANCHOR_MARK.test(l))
    if (anchorIdx === -1) continue
    // Baris uraian isi entri yang belum berbentuk bullet: baris sesudah
    // judul/jangkar, bukan bullet, dan cukup panjang untuk disebut
    // uraian (bukan sisa judul atau baris pendek lain).
    const narrative = entry.lines
      .slice(anchorIdx + 1)
      .map((l) => l.trim())
      .filter((l) => l !== '' && !BULLET_LINE.test(l) && countWords(l) >= 4)
    if (narrative.length === 0) continue
    const picked = narrative.slice(0, 3)
    const bullets: string[] = []
    for (const line of picked) {
      for (const sentence of splitSentences(line)) {
        bullets.push(`• ${capitalize(sentence)}`)
      }
    }
    if (bullets.length === 0) continue
    return {
      kutipanAsli: truncate(picked.join('\n'), 340),
      versiPerbaikan: truncate(bullets.join('\n'), 560),
      catatan:
        'Uraian di atas dikutip dari entri pengalamanmu sendiri. Versi perbaikannya TIDAK menambah atau mengubah satu kata pun — ' +
        'uraian yang sama hanya dipecah menjadi poin-poin terpisah (satu poin per baris, diawali •), dan baris berisi beberapa kalimat dipecah per kalimat. ' +
        'Terapkan pola yang sama ke seluruh uraian pengalamanmu.',
    }
  }
  return null
}

// ---------- Panjang CV ----------

function personalLength(result: AnalysisResult, cvText: string): PersonalExample | null {
  if (!needsFix(result, 'panjang')) return null
  const words = countWords(cvText)
  // Paragraf = blok teks yang dipisahkan baris kosong. Paragraf
  // terpanjang (berdasarkan jumlah kata) adalah calon kutipan: pada CV
  // terlalu panjang ia calon pertama yang dipadatkan; pada CV terlalu
  // pendek ia contoh isi yang perlu diperluas dari pengalaman asli.
  const blocks = cvText
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b !== '')
  let longest: string | null = null
  let longestWords = 0
  for (const b of blocks) {
    const w = countWords(b)
    if (w > longestWords) {
      longestWords = w
      longest = b
    }
  }
  if (!longest || longestWords < 10) return null
  const quote = truncate(flatten(longest), 340)
  if (words > 900) {
    return {
      kutipanAsli: quote,
      versiPerbaikan:
        `${quote}\n` +
        '[padatkan paragraf ini: hapus kalimat yang tidak relevan dengan posisi yang kamu lamar — pertahankan hanya tugas dan hasil terpentingmu]',
      catatan:
        `CV-mu saat ini berisi ${words} kata — melebihi rentang ideal 220–900 kata (sekitar 1–2 halaman). ` +
        `Paragraf terpanjangmu (${longestWords} kata) dikutip di atas sebagai calon pertama untuk dipadatkan. ${ANTI_KARANG}`,
    }
  }
  return {
    kutipanAsli: quote,
    versiPerbaikan:
      `${quote}\n` +
      '[tambahkan uraian pencapaian aslimu dari pengalaman, magang, proyek, atau organisasi — satu poin untuk satu pencapaian]',
    catatan:
      `CV-mu saat ini berisi ${words} kata — di bawah rentang ideal 220–900 kata (sekitar 1–2 halaman), jadi terlihat kosong bagi rekruter. ` +
      `Paragraf terpanjangmu dikutip di atas; perluas isi CV dari pengalaman yang benar-benar kamu jalani. ${ANTI_KARANG}`,
  }
}

// ---------- Daftar keahlian / skill ----------

function personalSkills(
  result: AnalysisResult,
  cvText: string,
  targetRole: string,
): PersonalExample | null {
  if (!needsFix(result, 'keahlian')) return null
  // Item dikutip dari ekstraksi yang sama dengan pemeriksaannya — CV
  // tanpa bagian keahlian sama sekali adalah ketiadaan murni dan tetap
  // memakai contoh generik.
  const items = getSkillItems(cvText)
  if (items.length === 0) return null
  const quote = items.join(', ')
  // Tambahan hanya berupa placeholder: skill dari kamus Daftar Skill
  // untuk posisi target yang BELUM terbaca di CV pengguna.
  const dict = getRoleSkills(targetRole)
  const missing = checkSkills(cvText, dict.skills)
    .filter((s) => !s.present)
    .map((s) => s.skill)
    .slice(0, 4)
  const additions =
    missing.length > 0
      ? missing.map((s) => `[${s}]`).join(', ')
      : '[tambahkan skill lain yang benar-benar kamu kuasai]'
  const roleNote = !targetRole.trim()
    ? 'daftar saran umum untuk fresh graduate'
    : dict.posisiKustom
      ? `daftar saran umum (kamus belum punya daftar khusus untuk posisi "${dict.label}")`
      : `daftar saran untuk posisi ${dict.label}`
  return {
    kutipanAsli: truncate(quote, 300),
    versiPerbaikan: truncate(`${quote}, ${additions}`, 460),
    catatan:
      `Bagian keahlianmu saat ini memuat ${items.length} item; idealnya minimal 8 skill yang spesifik. ` +
      `Skill dalam [kurung siku] berasal dari ${roleNote} — cantumkan hanya yang benar-benar kamu kuasai (hapus kurungnya), dan hapus yang tidak kamu kuasai. ${ANTI_KARANG}`,
  }
}

// ---------- Bahasa asing ----------

const LANG_LABELS: Record<string, string> = {
  inggris: 'Bahasa Inggris',
  mandarin: 'Bahasa Mandarin',
  jepang: 'Bahasa Jepang',
  korea: 'Bahasa Korea',
  arab: 'Bahasa Arab',
  jerman: 'Bahasa Jerman',
  prancis: 'Bahasa Prancis',
  belanda: 'Bahasa Belanda',
  spanyol: 'Bahasa Spanyol',
}

function personalLanguage(result: AnalysisResult, cvText: string): PersonalExample | null {
  if (!needsFix(result, 'bahasa')) return null
  // Sudah ada bagian bahasa berisi item → pemeriksaan ini lolos; tidak
  // ada yang perlu dicontohkan.
  if (getLanguageItems(cvText).length > 0) return null
  // Kasus yang bisa dikutip: bahasa disebut di dalam teks (barisnya
  // bisa ditunjuk), tetapi belum menjadi bagian tersendiri. Bila tidak
  // disebut sama sekali → ketiadaan murni, tetap generik.
  const line = cvText
    .split('\n')
    .map((l) => l.trim())
    .find((l) => LANGUAGE_MENTION.test(l))
  if (!line) return null
  const m = line.match(LANGUAGE_MENTION)
  if (!m) return null
  let label: string
  if (m[2]) {
    label = LANG_LABELS[m[2].toLowerCase()] ?? `Bahasa ${capitalize(m[2].toLowerCase())}`
  } else if (/jlpt/i.test(m[0])) {
    label = 'Bahasa Jepang'
  } else if (/hsk/i.test(m[0])) {
    label = 'Bahasa Mandarin'
  } else {
    label = 'Bahasa Inggris' // toefl / ielts
  }
  return {
    kutipanAsli: truncate(line, 240),
    versiPerbaikan:
      `Bahasa\n• ${label} — [tingkat kemahiranmu: dasar / menengah / aktif — atau skor tes resminya bila ada]`,
    catatan:
      `Kemampuan ${label.toLowerCase()} sudah kamu sebut di dalam CV-mu (baris di atas), tetapi belum menjadi bagian tersendiri beserta tingkat kemahirannya. ` +
      `Pindahkan ke bagian "Bahasa" seperti versi perbaikan dan isi tingkatnya dengan jujur. ${ANTI_KARANG}`,
  }
}

// ---------- Relevansi pengalaman dengan posisi target ----------

function personalExperienceRelevance(
  result: AnalysisResult,
  cvText: string,
  targetRole: string,
): PersonalExample | null {
  if (!needsFix(result, 'relevansi-pengalaman')) return null
  const role = targetRole.trim()
  if (!role) return null
  const roleWords = getRoleWords(role)
  if (roleWords.length === 0) return null
  const range = getExperienceSectionRange(cvText)
  if (!range) return null
  // Kata kunci yang belum terbaca di bagian pengalaman — dihitung dari
  // bagian dan kata yang sama dengan pemeriksaannya.
  const sectionLower = cvText.slice(range.start, range.end).toLowerCase()
  const missing = roleWords.filter((w) => !sectionLower.includes(w))
  const entries = getExperienceEntryDetails(cvText).filter((e) => e.hasContent)
  if (entries.length === 0) return null
  const entry = entries[0]
  const quote = entry.lines.slice(0, 4).join('\n')
  if (missing.length > 0) {
    return {
      kutipanAsli: truncate(quote, 340),
      versiPerbaikan:
        `${truncate(quote, 340)}\n` +
        `• [tonjolkan tugas atau hasilmu yang berkaitan dengan "${missing.join('" / "')}" — hanya yang benar-benar kamu kerjakan]`,
      catatan:
        `Isi pengalamanmu belum menyebut kata kunci posisi target "${role}" (${missing
          .map((w) => `"${w}"`)
          .join(', ')}), jadi rekruter dan sistem ATS tidak melihat kaitannya dengan bidang yang kamu tuju. ` +
        `Entri pertamamu dikutip di atas — tambahkan poin seperti pada versi perbaikan dari tugas yang benar-benar kamu jalani. ${ANTI_KARANG}`,
    }
  }
  // Semua kata kunci sudah ada di isi, tetapi belum di judul jabatan
  // (skor 2 pada pemeriksaan) — judul entri pengguna yang dikutip.
  return {
    kutipanAsli: truncate(quote, 340),
    versiPerbaikan:
      `${truncate(quote, 340)}\n` +
      `[sebutkan bidang "${role}" pada judul entri di atas bila memang sesuai dengan pekerjaanmu, agar relevansinya terbaca sejak judul]`,
    catatan:
      `Kata kunci posisi target "${role}" sudah muncul di isi pengalamanmu, tetapi belum terbaca di judul jabatan — ` +
      'padahal judul adalah yang pertama dipindai rekruter. Kutipan di atas adalah entri pertamamu sendiri.',
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
  put('linimasa', personalTimeline(result, cvText))
  put('konsistensi-format', personalConsistency(result, cvText))
  put('bullet', personalBullet(result, cvText))
  put('panjang', personalLength(result, cvText))
  put('keahlian', personalSkills(result, cvText, targetRole))
  put('bahasa', personalLanguage(result, cvText))
  put('relevansi-pengalaman', personalExperienceRelevance(result, cvText, targetRole))
  return out
}
