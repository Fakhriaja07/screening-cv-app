import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import {
  analyzeCv,
  countWords,
  normalizeTargetRoles,
  type AnalysisResult,
  type CheckItem,
} from './lib/analyze'
import {
  addHistoryEntry,
  aspectDeltas,
  clearHistory,
  compositionDiffers,
  entryFromResult,
  entryRoles,
  formatHistoryDate,
  historyRoleLabel,
  historyRoleSetsMatch,
  loadHistory,
  scoreDelta,
  type ScoreHistoryEntry,
} from './lib/history'
import {
  buildAiFixContext,
  buildAiRoleContexts,
  runAiAnalysis,
  type AiAnalysis,
} from './lib/ai'
import {
  ADMIN_CONTACT_URL,
  AI_PRICE,
  addCredit,
  adminContactHref,
  amountForCode,
  clearPendingCode,
  consumeCredit,
  formatRupiah,
  getCredits,
  getOrCreatePendingCode,
  isOrderClaimed,
  markOrderClaimed,
  redeemTokenCode,
} from './lib/payment'
import {
  checkSnapTransaction,
  createSnapTransaction,
  fetchPaymentConfig,
  loadSnapJs,
  payWithSnap,
  type PaymentConfig,
  type TransactionCheck,
} from './lib/midtransClient'
import {
  buildSummaryTemplate,
  checkSkills,
  getCheckExample,
  getRoleSkills,
  skillDisplayName,
} from './lib/examples'
import {
  buildPersonalExamples,
  type PersonalExample,
} from './lib/personalExamples'
import { filterRoleOptions, type RoleOption } from './lib/roleOptions'
import { SAMPLE_CV } from './lib/sampleCv'
import type { Lang } from './lib/lang'
import { DEMO_WEAK_CV } from './lib/demoCv'


// ---------- Kamus teks antarmuka (saklar bahasa ID/EN) ----------
// String polos UI tinggal di sini; blok JSX kaya (pengantar kartu AI,
// pay-intro QRIS, catatan hero, footer, langkah bayar) dirender
// kondisional lang === 'id' ? … : … di tempatnya masing-masing agar
// teks Indonesia lama tetap persis seperti sebelumnya.
const UI_TEXT = {
  id: {
    navSample: 'Contoh Hasil',
    navAnalyze: 'Analisis CV',
    heroTitleA: 'CV-mu sudah siap',
    heroTitleAccent: 'dikirim?',
    heroSub:
      'Unggah atau tempel CV-mu di sini, lalu lihat skornya: 0–100 dari 6 aspek lewat 27 pemeriksaan. Kamu juga dapat daftar bagian yang perlu diperbaiki, jadi tahu harus mulai dari mana. Ada deskripsi lowongannya? Tempel sekalian, kecocokan CV-mu dengan lowongan itu ikut dinilai.',
    heroStart: 'Mulai Analisis',
    heroSample: 'Coba CV Contoh',
    statPoints: 'total poin',
    statAspects: 'aspek dinilai',
    statChecks: 'pemeriksaan',
    demoBadge: 'Contoh hasil analisis',
    demoTitle: 'Lihat Contoh Hasil',
    demoIntro:
      'Ini dua CV contoh yang dinilai mesin yang sama persis dengan yang akan menilai CV-mu.',
    demoBefore: 'Sebelum',
    demoAfter: 'Sesudah',
    demoNameBefore: 'CV contoh — seadanya',
    demoNameAfter: 'CV contoh — dengan bukti hasil',
    demoTop3: '3 prioritas perbaikan teratas dari CV ini:',
    demoSameChecks: 'Pemeriksaan yang sama pada CV ini:',
    points: 'poin',
    demoCaption:
      'Selisihnya datang dari hal yang bisa kamu perbaiki juga: angka hasil kerja, kata kerja aksi, skill yang spesifik, dan kontak yang lengkap.',
    demoDisclaimer:
      'Contoh bawaan situs, skornya dihitung langsung oleh mesin penilaian — bukan testimoni pengguna.',
    demoCta: 'Analisis CV-mu',
    demoHint: 'Analisis standar gratis — tanpa daftar, dan CV tidak diunggah ke server.',
    formTitle: 'Data CV',
    step1: 'Isi CV kamu',
    dropzoneStrong: 'Tarik & letakkan file CV di sini',
    dropzoneRest: 'atau klik untuk memilih file (PDF, DOCX, TXT, maks 10 MB)',
    readingFile: 'Membaca file…',
    cvTextLabel: 'Teks CV',
    cvPlaceholder:
      'Tempel teks CV di sini, atau upload file di atas.\n\nContoh format kontak yang terbaca:\nemail@contoh.com | +62 812-3456-7890 | linkedin.com/in/namamu | github.com/namamu',
    step2: 'Posisi & lowongan',
    optional: 'Opsional',
    roleLabel: 'Posisi yang dilamar',
    rolePlaceholder: 'Ketik atau pilih posisi, mis. Data Analyst',
    roleComboLabel: 'Posisi yang dilamar',
    roleToggleLabel: 'Tampilkan atau sembunyikan pilihan pekerjaan',
    roleListLabel: 'Pilihan pekerjaan',
    roleEmpty:
      'Tidak ada pilihan yang cocok — posisi yang kamu ketik tetap bisa dipakai apa adanya.',
    roleMultiHint:
      'Bisa sampai 3 posisi. Skor relevansi mengikuti posisi yang paling cocok; posisi lain tetap dirinci di bawah.',
    roleAddPlaceholder: 'Tambah posisi lain…',
    roleLimitMsg: 'Maksimal 3 posisi — hapus salah satu posisi di atas untuk menggantinya.',
    roleDupMsg: 'Posisi itu sudah ada di pilihanmu.',
    winnerNote: (role: string) =>
      `Skor relevansi mengikuti posisi: ${role} — posisi lain tetap dirinci di bawah.`,
    winnerNoteTwo: (summaryRole: string, experienceRole: string) =>
      `Skor relevansi ringkasan mengikuti posisi: ${summaryRole}; relevansi pengalaman mengikuti posisi: ${experienceRole} — posisi lain tetap dirinci di bawah.`,
    jobDescLabel: 'Deskripsi lowongan',
    jobDescPlaceholder:
      'Tempel deskripsi lowongan untuk mengecek kecocokan kata kunci dengan CV-mu.',
    step3: 'Lihat hasil',
    analyzeBtn: 'Analisis CV',
    sampleBtn: 'Coba CV Contoh',
    resetBtn: 'Reset',
    emptyTitle: 'Hasil analisismu akan muncul di sini',
    emptyItems: [
      'Skor keseluruhan & label kesiapan',
      'Rincian skor per aspek',
      'Kekuatan CV-mu',
      'Prioritas perbaikan, dari yang paling berdampak',
      'Cek kata kunci lowongan (bila deskripsi lowongan diisi)',
      'Hasil Analisis AI (bila kamu memakainya)',
    ],
    resultBadge: 'Hasil analisis',
    top3Title: '3 Hal Terpenting',
    top3Hint:
      'Kalau waktumu terbatas, mulai dari tiga ini — dampaknya paling besar ke skormu. Rincian lengkapnya ada di bagian Prioritas Perbaikan di bawah.',
    historyTitle: 'Riwayat Skor',
    lastCheck: 'Cek terakhir',
    now: 'Sekarang',
    diffRole: 'Beda posisi',
    noRole: 'tanpa posisi target',
    forRole: 'untuk',
    aspectsSame: 'Semua aspek sama seperti cek terakhir.',
    historyNote:
      'Riwayat hanya menyimpan skor dan tanggal — tanpa teks CV — di perangkat ini saja (localStorage), tidak dikirim ke server.',
    clearHistory: 'Hapus riwayat',
    strengthsTitle: 'Kekuatan',
    prioritiesTitle: 'Prioritas Perbaikan',
    prioritiesEmpty:
      'Semua pemeriksaan lolos dengan poin penuh. CV-mu sudah kuat — tinggal sesuaikan kata kunci untuk tiap lowongan.',
    prioritiesHint: 'Diurutkan dari yang paling berdampak ke skormu — kerjakan dari nomor 1.',
    hideExample: 'Sembunyikan contoh',
    viewExample: 'Lihat contoh',
    personalLabel: 'Contoh dari CV-mu:',
    genericLabel: 'Contoh:',
    beforeTag: 'Sebelum:',
    afterTag: 'Sesudah:',
    templateCardTitle: 'Template Ringkasan & Daftar Skill',
    templateSub: 'Template Ringkasan',
    templateIntro:
      'Pakai template ini, lalu ganti semua bagian dalam [kurung siku] dengan datamu sendiri.',
    skillNote:
      'Pencocokan dilakukan sederhana dari teks CV — skill yang kamu tulis dengan nama lain bisa saja tidak tertangkap di daftar ini.',
    skillPresent: 'Sudah ada di CV',
    skillMissing: 'Belum ada',
    keywordsTitle: 'Kecocokan Kata Kunci Lowongan',
    foundTitle: 'Sudah ada:',
    missingTitle: 'Belum ada:',
    aiTitle: 'Analisis AI (OpenRouter)',
    paidChip: 'Berbayar',
    buyClose: 'Tutup pembelian',
    buyMore: 'Beli token lagi',
    aiRunning: 'Menganalisis dengan AI…',
    aiRerun: 'Analisis Ulang dengan AI',
    aiRun: 'Analisis dengan AI',
    aiMinHint: 'Teks CV minimal 50 karakter untuk analisis AI.',
    reportHint:
      'Laporan langsung terunduh sebagai berkas PDF — mencakup skor standar dan hasil Analisis AI.',
    thinkingTitle: 'Proses Berpikir AI',
    thinkingStatus: 'AI sedang memproses · Mohon tunggu',
    doneLabel: 'Analisis selesai',
    aiSummaryTitle: 'Ringkasan Penilaian AI',
    aiFixesTitle: 'Perbaikan Lengkap dari AI',
    aiFixesNote:
      'Satu versi perbaikan jadi untuk setiap prioritas perbaikanmu — salin ke CV, lalu isi bagian dalam [kurung siku] dengan fakta aslimu.',
    beforeLabel: 'Sebelum',
    afterLabel: 'Sesudah',
    rewriteTitle: 'Saran Penulisan Ulang',
    originalLabel: 'Asli',
    suggestionLabel: 'Saran',
    rewriteNote:
      'Saran di atas adalah contoh — sesuaikan angka dan fakta dengan pengalaman aslimu. Jangan memakai angka yang tidak benar.',
    shortcomingsTitle: 'Kekurangan Menurut AI',
    sampleSummaryTitle: 'Contoh Ringkasan Profil',
    qrisFallback: 'Gambar QRIS belum tersedia. Coba muat ulang halaman ini beberapa saat lagi.',
    qrisAlt: 'Kode QRIS GoPay Merchant FAKHRI, DIGITAL & KREATIF untuk pembayaran Analisis AI',
    redeemLabel: 'Kode token dari admin',
    redeemChecking: 'Memeriksa…',
    redeemBtn: 'Tukarkan Kode',
    processing: 'Memproses…',
    autoPayBtn: 'Bayar Otomatis via QRIS',
    privacyLink: 'Kebijakan Privasi',
    termsLink: 'Syarat & Ketentuan',
    articleLink: 'Artikel: Kesalahan CV Fresh Graduate',
  },
  en: {
    navSample: 'Sample Results',
    navAnalyze: 'Analyze CV',
    heroTitleA: 'Is your CV ready to',
    heroTitleAccent: 'send?',
    heroSub:
      "Upload or paste your CV here and see its score: 0–100 across 6 aspects and 27 checks. You'll also get a list of what to fix, so you know exactly where to start. Got the job posting? Paste it too — how well your CV matches it gets scored as well.",
    heroStart: 'Start Analysis',
    heroSample: 'Try a Sample CV',
    statPoints: 'total points',
    statAspects: 'aspects assessed',
    statChecks: 'checks',
    demoBadge: 'Sample analysis results',
    demoTitle: 'See Sample Results',
    demoIntro:
      'These are two sample CVs scored by the exact same engine that will score yours.',
    demoBefore: 'Before',
    demoAfter: 'After',
    demoNameBefore: 'Sample CV — as-is',
    demoNameAfter: 'Sample CV — with evidence of results',
    demoTop3: 'The top 3 fixes for this CV:',
    demoSameChecks: 'The same checks on this CV:',
    points: 'points',
    demoCaption:
      'The difference comes from things you can fix too: numbers that show results, action verbs, specific skills, and complete contact details.',
    demoDisclaimer:
      "Built-in samples — their scores are calculated live by the scoring engine, not user testimonials.",
    demoCta: 'Analyze Your CV',
    demoHint: 'The standard analysis is free — no sign-up, and your CV is never uploaded to a server.',
    formTitle: 'CV Details',
    step1: 'Add your CV',
    dropzoneStrong: 'Drag & drop your CV file here',
    dropzoneRest: 'or click to choose a file (PDF, DOCX, TXT, max 10 MB)',
    readingFile: 'Reading file…',
    cvTextLabel: 'CV Text',
    cvPlaceholder:
      'Paste your CV text here, or upload a file above.\n\nContact formats that get detected:\nyou@example.com | +62 812-3456-7890 | linkedin.com/in/yourname | github.com/yourname',
    step2: 'Position & job posting',
    optional: 'Optional',
    roleLabel: "Position you're applying for",
    rolePlaceholder: 'Type or pick a position, e.g. Data Analyst',
    roleComboLabel: "Position you're applying for",
    roleToggleLabel: 'Show or hide job options',
    roleListLabel: 'Job options',
    roleEmpty:
      "No matching options — the position you typed can still be used exactly as written.",
    roleMultiHint:
      'You can pick up to 3 positions. The relevance score follows the best-matching one; the others are still broken down below.',
    roleAddPlaceholder: 'Add another position…',
    roleLimitMsg: 'Maximum of 3 positions — remove one above to replace it.',
    roleDupMsg: 'That position is already in your selection.',
    winnerNote: (role: string) =>
      `The relevance score follows the position: ${role} — the other positions are still broken down below.`,
    winnerNoteTwo: (summaryRole: string, experienceRole: string) =>
      `Summary relevance follows the position: ${summaryRole}; experience relevance follows the position: ${experienceRole} — the other positions are still broken down below.`,
    jobDescLabel: 'Job description',
    jobDescPlaceholder:
      "Paste the job description to check how well its keywords match your CV.",
    step3: 'See your results',
    analyzeBtn: 'Analyze CV',
    sampleBtn: 'Try a Sample CV',
    resetBtn: 'Reset',
    emptyTitle: 'Your analysis results will appear here',
    emptyItems: [
      'Overall score & readiness label',
      'Score breakdown by aspect',
      "Your CV's strengths",
      'Fix priorities, biggest impact first',
      'Job keyword check (when you add a job description)',
      'AI Analysis results (if you use it)',
    ],
    resultBadge: 'Analysis results',
    top3Title: 'Top 3 Things That Matter Most',
    top3Hint:
      'Short on time? Start with these three — they move your score the most. The full details are in the Top Fixes section below.',
    historyTitle: 'Score History',
    lastCheck: 'Last check',
    now: 'Now',
    diffRole: 'Different position',
    noRole: 'with no target position',
    forRole: 'for',
    aspectsSame: 'Every aspect is the same as your last check.',
    historyNote:
      'History only stores scores and dates — never your CV text — on this device only (localStorage). Nothing is sent to a server.',
    clearHistory: 'Clear history',
    strengthsTitle: 'Strengths',
    prioritiesTitle: 'Top Fixes',
    prioritiesEmpty:
      'Every check passed with full points. Your CV is already strong — just tailor the keywords for each job you apply to.',
    prioritiesHint: 'Sorted by impact on your score — start at number 1.',
    hideExample: 'Hide example',
    viewExample: 'View example',
    personalLabel: 'Example from your CV:',
    genericLabel: 'Example:',
    beforeTag: 'Before:',
    afterTag: 'After:',
    templateCardTitle: 'Summary Template & Skill Checklist',
    templateSub: 'Summary Template',
    templateIntro:
      'Use this template, then replace everything in [square brackets] with your own details.',
    skillNote:
      'Matching is done simply from your CV text — a skill you wrote under a different name may not show up in this list.',
    skillPresent: 'Already in your CV',
    skillMissing: 'Not yet',
    keywordsTitle: 'Job Keyword Match',
    foundTitle: 'Found:',
    missingTitle: 'Missing:',
    aiTitle: 'AI Analysis (OpenRouter)',
    paidChip: 'Paid',
    buyClose: 'Close',
    buyMore: 'Buy more tokens',
    aiRunning: 'Analyzing with AI…',
    aiRerun: 'Run AI Analysis Again',
    aiRun: 'Analyze with AI',
    aiMinHint: 'Your CV text needs at least 50 characters for AI analysis.',
    reportHint:
      'The report downloads straight away as a PDF file — it covers the standard score and the AI Analysis results.',
    thinkingTitle: 'AI Thinking Process',
    thinkingStatus: 'AI is working · Please wait',
    doneLabel: 'Analysis complete',
    aiSummaryTitle: 'AI Assessment Summary',
    aiFixesTitle: 'Full Fixes from the AI',
    aiFixesNote:
      'One finished rewrite for each of your fix priorities — copy it into your CV, then fill in the parts in [square brackets] with your real facts.',
    beforeLabel: 'Before',
    afterLabel: 'After',
    rewriteTitle: 'Rewrite Suggestions',
    originalLabel: 'Original',
    suggestionLabel: 'Suggestion',
    rewriteNote:
      'The suggestions above are examples — adjust the numbers and facts to your real experience. Never use numbers that are not true.',
    shortcomingsTitle: 'Shortcomings According to the AI',
    sampleSummaryTitle: 'Sample Profile Summary',
    qrisFallback: 'The QRIS image is not available yet. Try reloading this page in a moment.',
    qrisAlt: 'GoPay Merchant QRIS code of FAKHRI, DIGITAL & KREATIF for AI Analysis payment',
    redeemLabel: 'Token code from the admin',
    redeemChecking: 'Checking…',
    redeemBtn: 'Redeem Code',
    processing: 'Processing…',
    autoPayBtn: 'Pay Automatically via QRIS',
    privacyLink: 'Privacy Policy',
    termsLink: 'Terms & Conditions',
    articleLink: 'Article: Common Fresh Graduate CV Mistakes',
  },
} as const

// ---------- Ikon SVG inline ----------
function Icon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}
const I = {
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  chart: 'M3 3v18h18M18 17V9M13 17V5M8 17v-3',
  check: 'M20 6L9 17l-5-5',
  alert: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  copy: 'M8 8h14v14H8zM4 4h14v14H4z',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  target: 'M12 12h.01M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zM12 6a6 6 0 1 0 6 6 6 6 0 0 0-6-6z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  chev: 'M6 9l6 6 6-6',
  spark: 'M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z',
  trendUp: 'M23 6L13.5 15.5L8.5 10.5L1 18M17 6h6v6',
  trendDown: 'M23 18L13.5 8.5L8.5 13.5L1 6M17 18h6v-6',
  minus: 'M5 12h14',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  trash: 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6',
}

// ---------- Ring skor beranimasi ----------
function ScoreRing({ score, size = 150 }: { score: number; size?: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const duration = 900
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      setDisplay(Math.round(score * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [score])
  const r = 52
  const c = 2 * Math.PI * r
  const color = score >= 85 ? '#16a34a' : score >= 70 ? '#0ea5e9' : score >= 50 ? '#f59e0b' : '#dc2626'
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="11" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="11"
          strokeLinecap="round" strokeDasharray={c}
          strokeDashoffset={c - (display / 100) * c}
          transform="rotate(-90 60 60)" />
      </svg>
      <div className="ring-center">
        <span className="ring-num">{display}</span>
        <span className="ring-max">/ 100</span>
      </div>
    </div>
  )
}

function CheckRow({ check, lang = 'id' }: { check: CheckItem; lang?: Lang }) {
  return (
    <li className={`check-row status-${check.status}`}>
      <span className="check-icon">
        {check.status === 'baik' ? <Icon d={I.check} size={15} /> : <Icon d={I.alert} size={15} />}
      </span>
      <div className="check-body">
        <div className="check-head">
          <strong>{check.title}</strong>
          <span className="check-meta">{check.aspect} • {check.score}/{check.max} {lang === 'en' ? 'points' : 'poin'}</span>
        </div>
        <p>{check.message}</p>
      </div>
    </li>
  )
}

// Baris prioritas perbaikan + contoh kalimat "sebelum → sesudah" (Fase 2).
// Bila contoh PERSONAL tersedia untuk pemeriksaan ini (kutipan dari CV
// pengguna sendiri, dari modul personalExamples.ts), contoh generik
// digantikan blok "Contoh dari CV-mu". Bila tidak, contoh generik dari
// examples.ts tampil seperti sebelumnya.
function PriorityRow({
  check,
  personal,
  index,
  lang = 'id',
}: {
  check: CheckItem
  personal?: PersonalExample | null
  index?: number
  lang?: Lang
}) {
  const [open, setOpen] = useState(false)
  const t = UI_TEXT[lang]
  const generic = getCheckExample(check.id, lang)
  const example = personal ?? generic
  return (
    <li className={`check-row status-${check.status}`}>
      {typeof index === 'number' ? (
        <span className="priority-num" aria-hidden="true">{index + 1}</span>
      ) : (
        <span className="check-icon">
          {check.status === 'baik' ? <Icon d={I.check} size={15} /> : <Icon d={I.alert} size={15} />}
        </span>
      )}
      <div className="check-body">
        <div className="check-head">
          <strong>{check.title}</strong>
          <span className="check-meta">{check.aspect} • {check.score}/{check.max} {t.points}</span>
        </div>
        <p>{check.message}</p>
        {example && (
          <div className="example-wrap">
            <button
              type="button"
              className="example-toggle"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
            >
              {open ? t.hideExample : t.viewExample}
            </button>
            {open &&
              (personal ? (
                <div className="example-box example-box-personal">
                  <span className="example-label">{t.personalLabel}</span>
                  <p className="example-before">
                    <span className="example-tag">{t.beforeTag}</span> {personal.kutipanAsli}
                  </p>
                  <p className="example-after">
                    <span className="example-tag">{t.afterTag}</span> {personal.versiPerbaikan}
                  </p>
                  <p className="example-note">{personal.catatan}</p>
                </div>
              ) : generic ? (
                <div className="example-box">
                  <span className="example-label">{t.genericLabel}</span>
                  <p className="example-before">
                    <span className="example-tag">{t.beforeTag}</span> {generic.sebelum}
                  </p>
                  <p className="example-after">
                    <span className="example-tag">{t.afterTag}</span> {generic.sesudah}
                  </p>
                  <p className="example-note">{generic.catatan}</p>
                </div>
              ) : null)}
          </div>
        )}
      </div>
    </li>
  )
}

// ---------- Contoh hasil analisis (beranda) ----------
// Dua CV contoh dianalisis langsung oleh mesin penilaian yang sama
// (analyzeCv) saat modul dimuat — skor dan prioritasnya adalah keluaran
// asli mesin atas teks contoh, bukan angka karangan dan bukan testimoni
// pengguna. Fungsinya agar pengunjung bisa melihat contoh hasil sebelum
// mengunggah CV-nya sendiri.
const DEMO_BEFORE = analyzeCv(DEMO_WEAK_CV)
const DEMO_AFTER = analyzeCv(SAMPLE_CV)
// Peta pemeriksaan hasil "Sesudah" berdasarkan id, agar kartu Sesudah
// bisa menampilkan baris pemeriksaan yang sama persis dengan tiga
// prioritas teratas kartu Sebelum — dengan poin dari hasil sesudah
// yang sebenarnya, bukan angka yang diketik manual.
const DEMO_AFTER_BY_ID = new Map(
  DEMO_AFTER.aspects.flatMap((a) => a.checks).map((c) => [c.id, c]),
)

function DemoSection({ lang = 'id' }: { lang?: Lang }) {
  const t = UI_TEXT[lang]
  // Versi Inggris dihitung dengan mesin yang sama (lang 'en') dan hanya
  // dipakai saat saklar bahasa Inggris aktif; konstanta modul mode id
  // di atas tetap menjadi sumber tampilan bawaan.
  const demoBeforeEn = useMemo(() => analyzeCv(DEMO_WEAK_CV, { lang: 'en' }), [])
  const demoAfterEn = useMemo(() => analyzeCv(SAMPLE_CV, { lang: 'en' }), [])
  const before = lang === 'en' ? demoBeforeEn : DEMO_BEFORE
  const after = lang === 'en' ? demoAfterEn : DEMO_AFTER
  const afterById =
    lang === 'en'
      ? new Map(after.aspects.flatMap((a) => a.checks).map((c) => [c.id, c]))
      : DEMO_AFTER_BY_ID
  const delta = after.total - before.total
  return (
    <section className="demo-section" id="contoh" aria-label={t.demoBadge}>
      <div className="demo-inner">
        <div className="demo-head">
          <span className="badge badge-soft"><Icon d={I.chart} size={14} /> {t.demoBadge}</span>
          <h2>{t.demoTitle}</h2>
          <p>{t.demoIntro}</p>
        </div>
        <div className="demo-grid">
          <div className="card demo-card">
            <div className="demo-card-head">
              <span className="demo-tag demo-tag-before">{t.demoBefore}</span>
              <span className="demo-cv-name">{t.demoNameBefore}</span>
            </div>
            <div className="demo-score-row">
              <ScoreRing score={before.total} size={108} />
              <div className="demo-score-side">
                <p className="demo-verdict">{before.label}</p>
                <p className="demo-note">{t.demoTop3}</p>
                <ol className="demo-priorities">
                  {before.priorities.slice(0, 3).map((c) => (
                    <li key={c.id}>
                      <strong>{c.title}</strong> — {c.score}/{c.max} {t.points}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
          <div className="demo-arrow" aria-hidden="true">→</div>
          <div className="card demo-card demo-card-after">
            <div className="demo-card-head">
              <span className="demo-tag demo-tag-after">{t.demoAfter}</span>
              <span className="demo-cv-name">{t.demoNameAfter}</span>
            </div>
            <div className="demo-score-row">
              <ScoreRing score={after.total} size={108} />
              <div className="demo-score-side">
                <p className="demo-verdict">{after.label}</p>
                <p className="demo-delta">
                  <Icon d={I.trendUp} size={16} />{' '}
                  {lang === 'en'
                    ? `Up ${delta} points from the “Before” sample`
                    : `Naik ${delta} poin dari contoh “Sebelum”`}
                </p>
                <p className="demo-note">{t.demoSameChecks}</p>
                <ol className="demo-priorities demo-priorities-after">
                  {before.priorities.slice(0, 3).map((c) => {
                    const a = afterById.get(c.id)
                    return (
                      <li key={c.id}>
                        <strong>{c.title}</strong> — {a ? `${a.score}/${a.max}` : '–'} {t.points}
                      </li>
                    )
                  })}
                </ol>
              </div>
            </div>
          </div>
        </div>
        <div className="demo-caption">
          <p>{t.demoCaption}</p>
          <p className="demo-disclaimer">{t.demoDisclaimer}</p>
        </div>
        <div className="demo-cta">
          <a className="btn btn-primary" href="#analisis">
            <Icon d={I.chart} size={18} /> {t.demoCta}
          </a>
          <span className="ai-hint">{t.demoHint}</span>
        </div>
      </div>
    </section>
  )
}

// ---------- Pemilih banyak posisi yang dilamar ----------
// Perkembangan combobox posisi (2026-11-25) menjadi pemilih BANYAK
// (keputusan pengguna 2026-11-28: posisi bisa dipilih lebih dari satu,
// maksimal 3, skor mengikuti posisi yang paling cocok). Posisi terpilih
// tampil sebagai chip yang bisa dihapus; kolom ketik di sebelahnya
// tetap teks bebas dengan dropdown terfilter dari lib/roleOptions —
// memilih pilihan ATAU menekan Enter/koma memasukkan teks kolom
// sebagai chip baru. Duplikat ditolak dan batas 3 ditegakkan lewat
// normalizeTargetRoles (lib/analyze), dengan pesan kecil di bawah
// kolom. Satu posisi tetap cara pakai utama: tanpa chip, tampilannya
// sama seperti combobox lama.
function RoleMultiCombobox({
  values,
  draft,
  onValuesChange,
  onDraftChange,
  lang = 'id',
}: {
  values: string[]
  draft: string
  onValuesChange: (v: string[]) => void
  onDraftChange: (v: string) => void
  lang?: Lang
}) {
  const t = UI_TEXT[lang]
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const [notice, setNotice] = useState<'limit' | 'dup' | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const optionRefs = useRef<(HTMLLIElement | null)[]>([])
  const options = useMemo(() => filterRoleOptions(draft), [draft])
  const listId = 'role-combo-list'

  // Baris tersorot selalu terlihat: gulir daftar internal mengikuti
  // navigasi keyboard, tanpa menggeser halaman.
  useEffect(() => {
    if (!open || highlight < 0) return
    const el = optionRefs.current[highlight]
    const list = listRef.current
    if (!el || !list) return
    if (el.offsetTop < list.scrollTop) {
      list.scrollTop = el.offsetTop
    } else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight
    }
  }, [highlight, open])

  // Masukkan satu posisi sebagai chip. Mengembalikan true bila chip
  // benar-benar bertambah; duplikat/batas penuh ditolak dengan pesan.
  function tryAdd(raw: string): boolean {
    const role = raw.trim()
    if (!role) return false
    const next = normalizeTargetRoles([...values, role])
    if (next.length === values.length) {
      const isDup = values.some(
        (v) => v.replace(/\s+/g, ' ').toLowerCase() === role.replace(/\s+/g, ' ').toLowerCase(),
      )
      setNotice(isDup ? 'dup' : 'limit')
      return false
    }
    setNotice(null)
    onValuesChange(next)
    return true
  }

  function choose(opt: RoleOption) {
    if (tryAdd(opt.value)) {
      onDraftChange('')
      setHighlight(-1)
    }
    inputRef.current?.focus()
  }

  function commitDraft() {
    if (tryAdd(draft)) onDraftChange('')
  }

  function removeRole(role: string) {
    setNotice(null)
    onValuesChange(values.filter((v) => v !== role))
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      else setHighlight((h) => (h < 0 ? 0 : Math.min(h + 1, options.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) setOpen(true)
      else
        setHighlight((h) =>
          h < 0 ? options.length - 1 : Math.max(h - 1, 0),
        )
    } else if (e.key === 'Enter') {
      if (open && highlight >= 0 && options[highlight]) {
        e.preventDefault()
        choose(options[highlight])
      } else if (draft.trim()) {
        // Enter tanpa sorotan: teks bebas di kolom menjadi chip.
        e.preventDefault()
        commitDraft()
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        setOpen(false)
        setHighlight(-1)
      }
    } else if (e.key === 'Backspace' && draft === '' && values.length > 0) {
      // Backspace pada kolom kosong menghapus chip terakhir.
      removeRole(values[values.length - 1])
    }
  }

  return (
    <div
      className="combo"
      onBlur={(e) => {
        // Tutup bila fokus benar-benar meninggalkan combobox; klik pada
        // pilihan ditangani onMouseDown (mencegah blur) sebelum ini.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setOpen(false)
          setHighlight(-1)
        }
      }}
    >
      <div className="role-box">
        {values.map((role) => (
          <span className="role-chip" key={role}>
            <span className="role-chip-name">{role}</span>
            <button
              type="button"
              className="role-chip-x"
              aria-label={`${lang === 'en' ? 'Remove position' : 'Hapus posisi'}: ${role}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => removeRole(role)}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={t.roleComboLabel}
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={
            open && highlight >= 0 ? `${listId}-${highlight}` : undefined
          }
          aria-autocomplete="list"
          autoComplete="off"
          value={draft}
          onChange={(e) => {
            const v = e.target.value
            if (v.includes(',')) {
              // Koma menyelesaikan chip dari teks sebelum koma pertama.
              const part = v.split(',')[0]
              if (tryAdd(part)) onDraftChange('')
              else onDraftChange(part)
              return
            }
            onDraftChange(v)
            setNotice(null)
            setOpen(true)
            setHighlight(-1)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={values.length ? t.roleAddPlaceholder : t.rolePlaceholder}
        />
        <button
          type="button"
          className={`combo-toggle${open ? ' open' : ''}`}
          aria-label={t.roleToggleLabel}
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setOpen((o) => !o)
            inputRef.current?.focus()
          }}
        >
          <Icon d={I.chev} size={18} />
        </button>
        {open && (
          <ul
            className="combo-list"
            role="listbox"
            id={listId}
            ref={listRef}
            aria-label={t.roleListLabel}
          >
            {options.map((opt, i) => (
              <li
                key={opt.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === highlight}
                ref={(el) => {
                  optionRefs.current[i] = el
                }}
                className={`combo-option${i === highlight ? ' active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(opt)
                }}
                onMouseEnter={() => setHighlight(i)}
              >
                <span className="combo-name">{opt.value}</span>
                {opt.abbrs.length > 0 && (
                  <span className="combo-abbr">{opt.abbrs.join(' · ')}</span>
                )}
              </li>
            ))}
            {options.length === 0 && (
              <li className="combo-empty">{t.roleEmpty}</li>
            )}
          </ul>
        )}
      </div>
      {notice === 'limit' && <p className="role-notice">{t.roleLimitMsg}</p>}
      {notice === 'dup' && <p className="role-notice">{t.roleDupMsg}</p>}
    </div>
  )
}

export default function App() {
  // Saklar bahasa antarmuka: bawaan 'id'; pilihan tersimpan di
  // localStorage perangkat ini saja. Hanya 'en' yang valid selain 'id'.
  const [lang, setLang] = useState<Lang>(() => {
    try {
      return window.localStorage.getItem('screening-cv:ui-lang:v1') === 'en' ? 'en' : 'id'
    } catch {
      return 'id'
    }
  })
  const t = UI_TEXT[lang]
  useEffect(() => {
    try {
      window.localStorage.setItem('screening-cv:ui-lang:v1', lang)
    } catch {
      // Penyimpanan tidak tersedia: saklar tetap bekerja untuk sesi ini.
    }
  }, [lang])
  useEffect(() => {
    document.title =
      lang === 'en'
        ? 'Screening CV — Honest Scores, Clear Improvement Advice'
        : 'Screening CV — Skor Jujur, Saran Perbaikan Jelas'
    document.documentElement.lang = lang
  }, [lang])
  const [cvText, setCvText] = useState('')
  // Posisi yang dilamar kini bisa LEBIH DARI SATU (maks 3, keputusan
  // pengguna 2026-11-28): chip terpilih di targetRoles, teks yang
  // sedang diketik (belum menjadi chip) di roleDraft. Posisi efektif
  // untuk analisis = gabungan keduanya lewat normalizeTargetRoles —
  // teks bebas yang belum ter-chip tidak pernah hilang.
  const [targetRoles, setTargetRoles] = useState<string[]>([])
  const [roleDraft, setRoleDraft] = useState('')
  const [jobDesc, setJobDesc] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  // Snapshot teks CV + posisi target PERSIS saat analisis dijalankan —
  // contoh personal di "Lihat contoh" dikutip dari snapshot ini, jadi
  // tetap cocok dengan hasil walau kotak teks diedit sesudahnya. Hanya
  // di memori halaman (state), tidak pernah disimpan ke localStorage.
  const [analyzedText, setAnalyzedText] = useState('')
  // Seluruh daftar posisi snapshot analisis (urutan pilihan pengguna);
  // posisi utama = elemen pertama (analyzedRole di bawah).
  const [analyzedRoles, setAnalyzedRoles] = useState<string[]>([])
  const [analyzedJobDesc, setAnalyzedJobDesc] = useState('')
  // Tanggal analisis terakhir — dipakai di kepala laporan PDF unduhan.
  const [analysisDate, setAnalysisDate] = useState<Date | null>(null)
  const [fileName, setFileName] = useState('')
  // Teks persis seperti yang dibaca dari berkas terakhir — nama berkas
  // hanya diteruskan ke analyzeCv (untuk pemeriksaan nama file) bila
  // teks yang dianalisis masih teks dari berkas itu; teks yang diketik/
  // diedit manual tidak dinilai nama filenya.
  const [fileText, setFileText] = useState('')
  const [error, setError] = useState('')
  const [loadingFile, setLoadingFile] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [aiConsent, setAiConsent] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<AiAnalysis | null>(null)
  // Label posisi tampilan (perluasan glosarium, sama seperti judul
  // kartu Daftar Skill) yang dipakai analisis AI yang sedang tampil —
  // disimpan sebagai snapshot saat analisis berhasil, agar label
  // "Disesuaikan untuk posisi: …" tidak berubah bila kolom posisi
  // diedit sesudahnya. Satu label per posisi yang dikirim ke AI;
  // kosong bila analisis dijalankan tanpa posisi.
  const [aiRoleLabels, setAiRoleLabels] = useState<string[]>([])
  // Daftar posisi efektif dari formulir saat ini (chip + draf teks
  // bebas), dinormalkan (maks 3, tanpa duplikat) — dipakai kartu
  // Daftar Skill dan jalur AI tanpa hasil.
  const effectiveRoles = useMemo(
    () => normalizeTargetRoles([...targetRoles, roleDraft]),
    [targetRoles, roleDraft],
  )
  // Posisi utama dari snapshot analisis (elemen pertama daftar) —
  // konsumen lama yang memang tunggal (template ringkasan, kepala
  // laporan) memakai ini; daftar penuhnya di analyzedRoles.
  const analyzedRole = analyzedRoles[0] ?? ''
  const [aiError, setAiError] = useState('')
  const [downloadError, setDownloadError] = useState('')
  // Sinyal aliran streaming: event pertama sudah tiba (pemicu tahapan
  // loading panel AI). Teks penalaran mentah model TIDAK disimpan dan
  // TIDAK ditampilkan lagi (keputusan pengguna 2026-11-26) — panel
  // menampilkan tahapan loading, bukan penalaran mentah.
  const [aiConnected, setAiConnected] = useState(false)
  // Kemajuan tahap perbaikan pada orkestrasi multi-panggilan
  // ({ current, total }) — menggerakkan label tahap terakhir panel
  // ("… (bagian 2 dari 3)"). Batch berjalan paralel, jadi current =
  // jumlah batch yang sudah selesai + 1 selama masih ada yang
  // berjalan (bagian yang sedang dikerjakan), bukan nomor urut satu
  // batch tunggal. Null selama panggilan inti.
  const [aiFixBatch, setAiFixBatch] = useState<{ current: number; total: number } | null>(null)
  const [aiStageRole, setAiStageRole] = useState('')
  const [aiRunDone, setAiRunDone] = useState(false)
  const [aiElapsed, setAiElapsed] = useState(0)
  const [aiCredits, setAiCredits] = useState<number>(() => getCredits())
  const [pendingCode, setPendingCode] = useState<number>(() => getOrCreatePendingCode())
  const [payOpen, setPayOpen] = useState(false)
  const [qrisError, setQrisError] = useState(false)
  // Penukaran kode token: input pengguna, pesan hasil, dan penghitung
  // kegagalan berturut-turut dalam sesi ini (kolom dikunci setelah 5×
  // gagal sampai halaman dimuat ulang).
  const [redeemInput, setRedeemInput] = useState('')
  const [redeemMsg, setRedeemMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [redeemFails, setRedeemFails] = useState(0)
  const [redeemBusy, setRedeemBusy] = useState(false)
  // Pembayaran otomatis Midtrans: mode dibaca dari /api/payment-config.
  // null = belum selesai dimuat → perlakukan sebagai "off" (manual).
  const [payConfig, setPayConfig] = useState<PaymentConfig | null>(null)
  // Mode sandbox hanya boleh diuji pemilik lewat ?paytest=1; pengguna
  // biasa tetap melihat jalur manual sampai mode production aktif.
  const [paytest] = useState<boolean>(() => {
    try {
      return new URLSearchParams(window.location.search).get('paytest') === '1'
    } catch {
      return false
    }
  })
  const [autoBusy, setAutoBusy] = useState(false)
  const [autoMsg, setAutoMsg] = useState('')
  const autoPollRef = useRef(false)
  const [history, setHistory] = useState<ScoreHistoryEntry[]>(() => loadHistory())
  const [prevEntry, setPrevEntry] = useState<ScoreHistoryEntry | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const aiStartRef = useRef(0)
  // Penanda generasi analisis AI yang sedang berjalan: handleReset
  // menaikkannya, sehingga hasil AI yang tiba SETELAH pengguna menekan
  // reset dibuang (tidak tampil, token tidak terpotong) — audit 2026-11-24.
  const aiRunRef = useRef(0)
  // Modul PDF (jsPDF) yang sudah berhasil dimuat, disimpan agar klik
  // unduh tidak perlu mengambil chunk-nya lagi (lihat loadPdfLib).
  const pdfLibRef = useRef<typeof import('./lib/pdf') | null>(null)

  // Penghitung detik berjalan selama analisis AI berlangsung.
  useEffect(() => {
    if (!aiLoading) return
    const id = window.setInterval(() => {
      setAiElapsed(Math.floor((Date.now() - aiStartRef.current) / 1000))
    }, 500)
    return () => window.clearInterval(id)
  }, [aiLoading])

  // Pra-muat modul PDF begitu hasil AI tampil: chunk-nya diambil selagi
  // deployment yang memuat tab ini masih aktif. Tanpa ini, deploy baru
  // di tengah sesi membuat chunk lama berstatus 404 dan klik unduh
  // gagal total tanpa pesan apa pun (bug yang dilaporkan 2026-11-26).
  // Kegagalan pra-muat diabaikan di sini — klik unduh akan mencoba lagi
  // dan menampilkan galat secara terlihat bila tetap gagal.
  useEffect(() => {
    if (!aiResult) return
    setDownloadError('')
    loadPdfLib().catch(() => {})
  }, [aiResult])

  // Mode pembayaran otomatis dibaca sekali dari server saat halaman
  // dimuat. Gagal memuat → payConfig tetap null → jalur manual.
  useEffect(() => {
    let cancelled = false
    fetchPaymentConfig().then((cfg) => {
      if (!cancelled) setPayConfig(cfg)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleFile(file: File) {
    setError('')
    setLoadingFile(true)
    try {
      // Modul baca-berkas (pdf.js/mammoth, ±0,9 MB) dimuat dinamis HANYA
      // saat pengguna benar-benar mengunggah berkas — pola yang sama
      // seperti chunk jsPDF — agar bundle awal tetap ringan untuk HP
      // kelas bawah (ulasan eksternal 2026-11-28).
      const { extractTextFromFile } = await import('./lib/readFile')
      const text = await extractTextFromFile(file)
      if (!text.trim()) {
        setError(
          lang === 'en'
            ? 'The file contained no text. If it is a scanned/image PDF, please paste your CV text manually.'
            : 'Teks dari file kosong. Jika PDF hasil scan/gambar, tempel teks CV secara manual.',
        )
      } else {
        setCvText(text)
        setFileName(file.name)
        setFileText(text)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : lang === 'en' ? 'Could not read the file.' : 'Gagal membaca file.')
    } finally {
      setLoadingFile(false)
    }
  }

  function handleAnalyze() {
    setError('')
    if (cvText.trim().length < 20) {
      setError(
        lang === 'en'
          ? 'Your CV text is still too short. Upload your CV file or paste the CV text first.'
          : 'Teks CV masih terlalu pendek. Upload file CV atau tempel teks CV terlebih dahulu.',
      )
      return
    }
    // Posisi efektif: chip terpilih + draf teks bebas yang belum
    // sempat menjadi chip — keduanya dinormalkan (maks 3, tanpa
    // duplikat). Formulir lalu diselaraskan ke daftar ini agar yang
    // tampil persis yang dianalisis.
    const roles = normalizeTargetRoles([...targetRoles, roleDraft])
    setTargetRoles(roles)
    setRoleDraft('')
    const res = analyzeCv(cvText, {
      targetRoles: roles,
      jobDesc,
      fileName: fileText !== '' && cvText === fileText ? fileName : undefined,
      lang,
    })
    setResult(res)
    setAnalyzedText(cvText)
    setAnalyzedRoles(roles)
    setAnalyzedJobDesc(jobDesc)
    setAnalysisDate(new Date())
    // Fase 1: simpan skor ke riwayat perangkat (hanya skor — teks CV tidak
    // disimpan) dan ingat entri sebelumnya untuk perbandingan sebelum → sesudah.
    // Entri kini menyimpan SELURUH daftar posisi (roles), bukan hanya utama.
    setPrevEntry(loadHistory()[0] ?? null)
    setHistory(addHistoryEntry(entryFromResult(res, roles[0] ?? '', new Date(), roles)))
    requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function handleClearHistory() {
    clearHistory()
    setHistory([])
    setPrevEntry(null)
  }

  function handleSample() {
    setCvText(SAMPLE_CV)
    setFileName('')
    setFileText('')
    setError('')
  }

  function handleReset() {
    // Batalkan secara logis analisis AI yang mungkin masih berjalan:
    // hasilnya akan dibuang saat tiba (lihat handleAiAnalyze).
    aiRunRef.current += 1
    setCvText('')
    setTargetRoles([])
    setRoleDraft('')
    setJobDesc('')
    setResult(null)
    setAnalyzedText('')
    setAnalyzedRoles([])
    setAnalyzedJobDesc('')
    setAnalysisDate(null)
    setFileName('')
    setFileText('')
    setError('')
    setAiConsent(false)
    setAiResult(null)
    setAiRoleLabels([])
    setAiError('')
    setAiConnected(false)
    setAiStageRole('')
    setAiRunDone(false)
    setAiElapsed(0)
    setPrevEntry(null)
  }

  // QRIS manual + kode token: pengguna membayar, menghubungi admin dengan
  // bukti bayar, menerima 1 kode token dari admin, lalu menukarkannya di
  // sini. Kode divalidasi terhadap hash yang sah; sukses menambah tepat
  // 1 token dan kode unik nominal dibersihkan agar pembelian berikutnya
  // mendapat kode baru. (Tombol konfirmasi kepercayaan lama dihapus
  // 2026-11-21 karena bisa diklaim tanpa membayar.)
  async function handleRedeemCode() {
    if (redeemBusy || redeemFails >= 5) return
    setRedeemBusy(true)
    try {
      const res = await redeemTokenCode(redeemInput)
      if (res.ok) {
        setAiCredits(res.balance)
        setRedeemInput('')
        setRedeemFails(0)
        setRedeemMsg({
          ok: true,
          text:
            lang === 'en'
              ? `Code accepted — you now have 1 more AI token (${res.balance} in total). Tick the consent box below, then run the AI Analysis.`
              : `Kode diterima — token AI kamu bertambah 1 (total sekarang ${res.balance}). Centang persetujuan di bawah, lalu jalankan Analisis AI.`,
        })
        clearPendingCode()
        setPendingCode(getOrCreatePendingCode())
        setPayOpen(false)
      } else {
        setRedeemFails((f) => f + 1)
        setRedeemMsg({
          ok: false,
          text:
            lang === 'en'
              ? 'That code is not valid, or it has already been used on this device.'
              : 'Kode tidak valid atau sudah dipakai di perangkat ini.',
        })
      }
    } finally {
      setRedeemBusy(false)
    }
  }

  // Polling status resmi ke server situs (yang menarik status langsung
  // ke Midtrans) setelah Snap melaporkan selesai/menunggu. Token hanya
  // bertambah bila server menjawab paid — callback Snap semata TIDAK
  // pernah menambah token.
  async function pollAutoPayment(orderId: string) {
    if (autoPollRef.current) return
    autoPollRef.current = true
    const deadline = Date.now() + 120_000
    try {
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 3000))
        let check: TransactionCheck
        try {
          check = await checkSnapTransaction(orderId)
        } catch {
          continue // Gangguan sesaat: lanjutkan polling sampai batas waktu.
        }
        if (check.paid) {
          if (isOrderClaimed(orderId)) {
            setAutoMsg(
              lang === 'en'
                ? 'This order has already been claimed in this browser, so no second token was added.'
                : 'Pembayaran order ini sudah pernah diklaim di browser ini, jadi token tidak ditambah dua kali.',
            )
          } else if (markOrderClaimed(orderId)) {
            setAiCredits(addCredit())
            setPayOpen(false)
            setAutoMsg(
              lang === 'en'
                ? 'Payment confirmed by Midtrans — you now have 1 more AI token. Tick the consent box below, then run the AI Analysis.'
                : 'Pembayaran terkonfirmasi oleh Midtrans — token AI kamu bertambah 1. Centang persetujuan di bawah, lalu jalankan Analisis AI.',
            )
          } else {
            setAutoMsg(
              lang === 'en'
                ? 'Midtrans confirmed your payment, but recording the claim failed in this browser. Please contact the admin so your token can be added manually.'
                : 'Pembayaran terkonfirmasi oleh Midtrans, tetapi pencatatan klaim gagal di browser ini. Hubungi admin agar tokenmu ditambah manual.',
            )
          }
          return
        }
        if (check.state === 'failed') {
          setAutoMsg(
            lang === 'en'
              ? 'The payment ended without being completed (expired, cancelled, or declined). No token was added — please try paying again.'
              : 'Pembayaran berakhir tanpa penyelesaian (kedaluwarsa, dibatalkan, atau ditolak). Tidak ada token yang ditambah — silakan coba bayar lagi.',
          )
          return
        }
      }
      setAutoMsg(
        lang === 'en'
          ? `Your payment was not confirmed within 2 minutes. If you have paid, please wait a little — or contact the admin and mention order code ${orderId}.`
          : `Pembayaran belum terkonfirmasi dalam 2 menit. Bila kamu sudah membayar, tunggu beberapa saat — atau hubungi admin dan sebutkan kode order ${orderId}.`,
      )
    } finally {
      autoPollRef.current = false
      setAutoBusy(false)
    }
  }

  // Alur bayar otomatis: buat transaksi di server → buka Snap → setelah
  // Snap selesai, verifikasi lewat polling status resmi (di atas).
  async function handleAutoPay() {
    if (autoBusy || !payConfig || payConfig.mode === 'off' || !payConfig.clientKey) return
    const mode = payConfig.mode
    const clientKey = payConfig.clientKey
    setAutoBusy(true)
    setAutoMsg(lang === 'en' ? 'Preparing your payment transaction…' : 'Menyiapkan transaksi pembayaran…')
    try {
      const tx = await createSnapTransaction()
      await loadSnapJs(mode, clientKey)
      setAutoMsg(
        lang === 'en'
          ? 'The Midtrans payment window is open — complete your payment there.'
          : 'Jendela pembayaran Midtrans dibuka — selesaikan pembayaranmu di sana.',
      )
      payWithSnap(tx.token, {
        onSuccess: () => {
          void pollAutoPayment(tx.orderId)
        },
        onPending: () => {
          setAutoMsg(
            lang === 'en'
              ? 'Waiting for your payment to complete — the status is checked with Midtrans automatically…'
              : 'Menunggu pembayaranmu selesai — status diperiksa otomatis ke Midtrans…',
          )
          void pollAutoPayment(tx.orderId)
        },
        onError: () => {
          setAutoMsg(
            lang === 'en'
              ? 'Midtrans could not process the payment. No token was added — please try again.'
              : 'Pembayaran gagal diproses Midtrans. Tidak ada token yang ditambah — silakan coba lagi.',
          )
          setAutoBusy(false)
        },
        onClose: () => {
          if (!autoPollRef.current) {
            setAutoMsg(
              lang === 'en'
                ? 'The payment window was closed before the payment finished. Tokens are only added after Midtrans confirms the payment.'
                : 'Jendela pembayaran ditutup sebelum pembayaran selesai. Token hanya bertambah setelah pembayaran terkonfirmasi oleh Midtrans.',
            )
            setAutoBusy(false)
          }
        },
      })
    } catch (e) {
      setAutoMsg(
        e instanceof Error
          ? e.message
          : lang === 'en'
            ? 'Automatic payment could not be started. Please try again later.'
            : 'Pembayaran otomatis gagal dimulai. Coba lagi nanti.',
      )
      setAutoBusy(false)
    }
  }

  async function handleAiAnalyze() {
    if (!aiConsent || aiLoading) return
    if (getCredits() <= 0) {
      setAiError(
        lang === 'en'
          ? 'You are out of AI tokens. Pay via the QRIS above to top up.'
          : 'Token AI kamu habis. Bayar lewat QRIS di atas untuk menambah token.',
      )
      return
    }
    // Audit 2026-11-24: bila hasil standar sedang tampil, AI menganalisis
    // SNAPSHOT yang menghasilkan hasil itu (analyzedText/analyzedRole/
    // analyzedJobDesc) — bukan isi kotak teks saat ini yang mungkin sudah
    // diedit pengguna sesudahnya. Tanpa ini, konteks perbaikan (dari hasil
    // tampil) bisa tidak cocok dengan teks yang dikirim ke AI.
    const sourceText = result ? analyzedText : cvText
    // Daftar posisi dari snapshot yang sama (seluruhnya, bukan hanya
    // posisi utama) — konteks AI kini banyak peran.
    const sourceRoles = result ? analyzedRoles : effectiveRoles
    const sourceRole = sourceRoles.join(', ')
    const sourceJobDesc = result ? analyzedJobDesc : jobDesc
    if (sourceText.trim().length < 50) {
      setAiError(
        lang === 'en'
          ? 'Your CV text is too short for AI analysis. Please complete the CV text first.'
          : 'Teks CV terlalu pendek untuk dianalisis AI. Lengkapi dulu teks CV-nya.',
      )
      return
    }
    const runId = ++aiRunRef.current
    const isStale = () => aiRunRef.current !== runId
    setAiLoading(true)
    setAiError('')
    setAiConnected(false)
    setAiFixBatch(null)
    setAiStageRole('')
    setAiRunDone(false)
    setAiElapsed(0)
    aiStartRef.current = Date.now()
    // Konteks pemeriksaan yang gagal dari hasil standar yang sedang
    // tampil: AI wajib memperbaiki semuanya satu per satu (bagian
    // "Perbaikan Lengkap dari AI"), bukan menebak ulang dari nol.
    // Contoh personal untuk konteks perbaikan: teks yang menyebut satu
    // posisi memakai POSISI PENENTU skor pemeriksaan terkait (dari
    // result.relevanceWinners), bukan selalu posisi utama.
    const winners = result?.relevanceWinners
    const roleByCheck = winners
      ? {
          ringkasan: winners.ringkasan ?? undefined,
          relevansiRingkasan: winners.ringkasan ?? undefined,
          relevansiPengalaman: winners.pengalaman ?? undefined,
        }
      : undefined
    const perbaikan = result
      ? buildAiFixContext(
          result,
          buildPersonalExamples(result, analyzedText, analyzedRole, undefined, roleByCheck),
        )
      : []
    // Konteks posisi terstruktur dari snapshot yang sama (teks + posisi
    // saat analisis standar dijalankan): AI menilai dari kacamata
    // SETIAP posisi itu dengan rujukan skill kamus situs. Daftar kosong
    // bila posisi kosong — permintaan terkirim tanpa konteks, persis
    // seperti sebelumnya.
    const konteksPosisi = buildAiRoleContexts(sourceText, sourceRoles)
    const roleLabels = konteksPosisi.map((c) => c.posisi)
    setAiStageRole(roleLabels.join(', '))
    const input = {
      cvText: sourceText,
      targetRole: sourceRole,
      jobDesc: sourceJobDesc,
      ...(perbaikan.length ? { perbaikan } : {}),
      ...(konteksPosisi.length ? { konteksPosisi } : {}),
    }
    let succeeded = false
    try {
      // Orkestrasi multi-panggilan (2026-11-26): panggilan inti ringan
      // (streaming; cadangan non-streaming) lalu panggilan perbaikan
      // per batch ≤6 pemeriksaan — paralel maks 3 batch bersamaan
      // (2026-11-27) — sampai semua prioritas terliput —
      // menggantikan satu panggilan raksasa yang berulang timeout.
      // Run hanya berhasil bila inti + SEMUA batch lolos; kegagalan di
      // titik mana pun melempar ke catch di bawah dan token aman.
      const data = await runAiAnalysis(input, {
        onActivity: () => {
          if (!isStale()) setAiConnected(true)
        },
        onProgress: (progress) => {
          if (isStale()) return
          if (progress.phase === 'fixes') {
            setAiFixBatch({ current: progress.batchIndex, total: progress.batchTotal })
          }
        },
      })
      // Pengguna menekan reset selagi analisis berjalan → hasil dibuang.
      if (!isStale()) {
        setAiResult(data)
        setAiRoleLabels(roleLabels)
        setAiRunDone(true)
        succeeded = true
      }
    } catch (err) {
      if (!isStale()) {
        setAiError(
          err instanceof Error
            ? err.message
            : lang === 'en'
              ? 'AI analysis failed. Please try again later.'
              : 'Analisis AI gagal. Coba lagi nanti.',
        )
      }
    } finally {
      // Token hanya terpotong bila hasil berhasil diterima — tepat satu
      // kali per analisis penuh, hanya setelah inti + semua batch
      // perbaikan lolos validasi di dalam runAiAnalysis.
      if (succeeded && consumeCredit()) {
        setAiCredits(getCredits())
      }
      setAiFixBatch(null)
      setAiLoading(false)
    }
  }

  // Pola unduh berkas yang sama untuk semua tombol unduh: Blob +
  // object URL + klik jangkar sementara.
  function downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // Muat modul PDF (chunk jsPDF) sekali lalu simpan di pdfLibRef.
  // Memakai impor dinamis agar bundel awal tetap ringan.
  async function loadPdfLib(): Promise<typeof import('./lib/pdf')> {
    if (!pdfLibRef.current) {
      pdfLibRef.current = await import('./lib/pdf')
    }
    return pdfLibRef.current
  }

  // "Unduh Laporan (PDF)": berkas PDF sungguhan dibuat di browser oleh
  // lib/pdf.ts (jsPDF, dimuat dinamis agar bundel awal tetap ringan) lalu
  // langsung terunduh — tanpa dialog cetak. Isinya laporan gabungan:
  // skor standar + bagian Analisis AI bila hasil AI sudah dibuat.
  // Seluruh jalur dibungkus try/catch dengan pesan galat TERLIHAT:
  // versi tanpa pengaman (sampai 2026-11-26) gagal diam-diam total —
  // misalnya saat chunk PDF versi lama sudah 404 karena situs
  // diperbarui di tengah sesi pengguna — dan tombol terasa mati.
  async function handleDownloadPdf() {
    if (!result) return
    setDownloadError('')
    try {
      let pdfLib: typeof import('./lib/pdf')
      try {
        pdfLib = await loadPdfLib()
      } catch {
        // Satu kali percobaan ulang dari nol untuk kegagalan sesaat.
        pdfLibRef.current = null
        pdfLib = await loadPdfLib()
      }
      const { blob, fileName } = pdfLib.buildReportPdf(result, {
        ai: aiResult,
        // Posisi pada laporan = posisi saat analisis dijalankan (snapshot),
        // bukan isi kolom posisi yang mungkin sudah diedit sesudahnya.
        // Banyak posisi ditulis berurutan dipisah koma.
        targetRole: analyzedRoles.join(', '),
        date: analysisDate ?? new Date(),
        lang,
      })
      downloadBlob(blob, fileName)
    } catch {
      setDownloadError(
        lang === 'en'
          ? 'The PDF file could not be created. Try clicking once more; if it still fails, reload this page — the site may have just been updated (the AI results on this page will be lost after a reload).'
          : 'Berkas PDF gagal dibuat. Coba klik sekali lagi; bila tetap gagal, muat ulang halaman ini — situs mungkin baru saja diperbarui (hasil AI di halaman ini akan hilang setelah muat ulang).',
      )
    }
  }

  // Bagian pembayaran QRIS manual + kode token: tampil saat token habis,
  // atau saat pengguna memilih "Beli token lagi". Nominal selalu harga +
  // kode unik yang sedang berlaku untuk pengguna ini. Token didapat dari
  // kode yang diberikan admin setelah pembayaran diperiksa — tidak ada
  // lagi tombol konfirmasi kepercayaan.
  // Tahapan loading panel AI (keputusan pengguna 2026-11-26): digerakkan
  // sinyal event pertama (aiConnected) + waktu berlalu (aiElapsed hanya
  // pemicu internal — TIDAK ditampilkan sebagai angka di panel). Tahap
  // terakhir tetap aktif sampai hasil tiba; tidak ada persen karangan.
  // Selama tahap perbaikan berjalan, tahap terakhir dipaksa aktif dan
  // labelnya menyebut bagian ke berapa dari berapa yang sedang
  // dikerjakan (bukan persen).
  const aiStages =
    lang === 'en'
      ? [
          'Contacting the AI model',
          'The AI is reading your CV',
          aiStageRole
            ? `Assessing your CV for the ${aiStageRole} position`
            : "Assessing your CV's strengths & shortcomings",
          'Rewriting your experience points',
          'Preparing complete fixes for all your priorities',
        ]
      : [
          'Menghubungi model AI',
          'AI membaca CV-mu',
          aiStageRole
            ? `Menilai CV-mu berdasarkan posisi ${aiStageRole}`
            : 'Menilai kekuatan & kekurangan CV-mu',
          'Menulis ulang poin pengalamanmu',
          'Menyusun perbaikan lengkap untuk semua prioritasmu',
        ]
  const aiStage = aiFixBatch
    ? 4
    : !aiConnected
      ? 0
      : aiElapsed < 8
        ? 1
        : aiElapsed < 28
          ? 2
          : aiElapsed < 58
            ? 3
            : 4

  const redeemLocked = redeemFails >= 5
  const paymentSection = (
    <div className="pay-box">
      {lang === 'en' ? (
        <p className="pay-intro">
          AI Analysis costs <strong>{formatRupiah(AI_PRICE)} per analysis</strong> — a
          single analysis, <strong>not a subscription</strong>, cheaper than printing
          and photocopying your CV once. The standard analysis (the score and fix
          suggestions above) stays free. Pay by scanning this QRIS code with any
          payment app (GoPay, OVO, DANA, mobile banking, and others). Make sure the
          merchant name shown is <strong>FAKHRI, DIGITAL &amp; KREATIF</strong>.
        </p>
      ) : (
        <p className="pay-intro">
          Analisis AI berbayar <strong>{formatRupiah(AI_PRICE)} per analisis</strong> —
          sekali analisis, <strong>bukan langganan</strong>, lebih murah dari sekali
          print + fotokopi CV. Analisis standar (skor dan saran perbaikan di atas)
          tetap gratis. Bayar dengan memindai QRIS berikut dari aplikasi pembayaran
          apa pun (GoPay, OVO, DANA, m-banking, dan lainnya). Pastikan nama merchant
          yang muncul adalah <strong>FAKHRI, DIGITAL &amp; KREATIF</strong>.
        </p>
      )}
      {qrisError ? (
        <p className="qris-fallback">{t.qrisFallback}</p>
      ) : (
        <img
          className="qris-img"
          src="/QRIS.jpeg"
          alt={t.qrisAlt}
          onError={() => setQrisError(true)}
        />
      )}
      {lang === 'en' ? (
        <p className="pay-amount">
          Pay exactly <strong>{formatRupiah(amountForCode(pendingCode))}</strong>
          <span>
            The amount already includes the unique code <strong>{pendingCode}</strong>{' '}
            in the last two digits — it helps the admin match your payment in the
            merchant history, so please do not round it.
          </span>
        </p>
      ) : (
        <p className="pay-amount">
          Bayar tepat <strong>{formatRupiah(amountForCode(pendingCode))}</strong>
          <span>
            Nominal sudah termasuk kode unik <strong>{pendingCode}</strong> di dua
            digit terakhir — kode unik membantu admin mencocokkan pembayaranmu di
            riwayat merchant, jadi jangan dibulatkan.
          </span>
        </p>
      )}
      {lang === 'en' ? (
        <ol className="pay-steps">
          <li>
            Scan the QRIS code above and pay the exact amount of{' '}
            {formatRupiah(amountForCode(pendingCode))}.
          </li>
          <li>
            Contact the admin and send your payment proof — once it is verified, the
            admin will give you <strong>1 token code</strong>.
            {ADMIN_CONTACT_URL ? (
              <>
                {' '}
                <a
                  href={adminContactHref(pendingCode, lang)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Request a Token Code via WhatsApp
                </a>
                .
              </>
            ) : null}
          </li>
          <li>Enter the token code from the admin in the field below, then redeem it.</li>
        </ol>
      ) : (
        <ol className="pay-steps">
          <li>
            Pindai kode QRIS di atas dan bayar nominal tepat{' '}
            {formatRupiah(amountForCode(pendingCode))}.
          </li>
          <li>
            Hubungi admin dan kirim bukti pembayaranmu — setelah terverifikasi,
            admin akan memberikan <strong>1 kode token</strong> untukmu.
            {ADMIN_CONTACT_URL ? (
              <>
                {' '}
                <a
                  href={adminContactHref(pendingCode)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Minta Kode Token via WhatsApp
                </a>
                .
              </>
            ) : null}
          </li>
          <li>Masukkan kode token dari admin pada kolom di bawah ini, lalu tukarkan.</li>
        </ol>
      )}
      <div className="redeem-row">
        <input
          className="redeem-input"
          type="text"
          placeholder="CVAI-XXXXXX"
          value={redeemInput}
          onChange={(e) => setRedeemInput(e.target.value)}
          disabled={redeemLocked || redeemBusy}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-label={t.redeemLabel}
        />
        <button
          className="btn btn-primary"
          type="button"
          onClick={handleRedeemCode}
          disabled={redeemLocked || redeemBusy || !redeemInput.trim()}
        >
          {redeemBusy ? t.redeemChecking : t.redeemBtn}
        </button>
      </div>
      {redeemMsg && (
        <p className={redeemMsg.ok ? 'pay-note redeem-ok' : 'pay-note redeem-err'} role="status">
          {redeemMsg.text}
        </p>
      )}
      {redeemLocked && (
        <p className="pay-note">
          {lang === 'en'
            ? 'Too many failed code attempts. Reload this page to try again.'
            : 'Terlalu banyak percobaan kode yang gagal. Muat ulang halaman ini untuk mencoba lagi.'}
        </p>
      )}
      {lang === 'en' ? (
        <>
          <p className="pay-note">
            Tokens are issued by the admin after your payment is verified from the
            proof you send — this site cannot check QRIS payments automatically. One
            code is worth 1 token (1 AI Analysis).
          </p>
          <p className="pay-note">
            About your data: AI Analysis sends your CV text to OpenRouter to be
            processed by the model provider behind it, and that text is not stored by
            Screening CV. Please read the{' '}
            <a href="/privacy.html">Privacy Policy</a> before redeeming a token.
          </p>
        </>
      ) : (
        <>
          <p className="pay-note">
            Token diterbitkan oleh admin setelah pembayaranmu terverifikasi dari
            bukti yang kamu kirim — situs tidak dapat memeriksa pembayaran QRIS
            secara otomatis. Satu kode berlaku untuk 1 token (1 kali Analisis AI).
          </p>
          <p className="pay-note">
            Soal datamu: Analisis AI mengirim teks CV-mu ke OpenRouter untuk
            diproses oleh penyedia model di belakangnya, dan teks itu tidak
            disimpan oleh Screening CV. Baca{' '}
            <a href="/privacy.html">Kebijakan Privasi</a> sebelum menukar token.
          </p>
        </>
      )}
    </div>
  )

  // Bagian pembayaran otomatis Midtrans. Tampil menggantikan bagian
  // manual hanya bila: mode production aktif, ATAU mode sandbox DAN
  // URL memuat ?paytest=1 (pengujian pemilik). Selain itu pengguna
  // tetap melihat jalur manual yang sudah berjalan.
  const autoMode =
    payConfig && payConfig.mode !== 'off' && payConfig.clientKey ? payConfig.mode : null
  const autoAvailable = autoMode !== null && (autoMode === 'production' || paytest)
  const autoPaySection = (
    <div className="pay-box">
      {lang === 'en' ? (
        <p className="pay-intro">
          AI Analysis costs <strong>{formatRupiah(AI_PRICE)} per analysis</strong> —
          the standard analysis (the score and fix suggestions above) stays free. Pay
          automatically via <strong>QRIS</strong> (all e-wallets &amp; mobile banking),
          GoPay, or ShopeePay through <strong>Midtrans</strong>. Your token is only
          added after your payment is <strong>automatically verified by
          Midtrans</strong> — no manual confirmation needed.
        </p>
      ) : (
        <p className="pay-intro">
          Analisis AI berbayar <strong>{formatRupiah(AI_PRICE)} per analisis</strong> —
          analisis standar (skor dan saran perbaikan di atas) tetap gratis.
          Bayar otomatis lewat <strong>QRIS</strong> (semua e-wallet &amp; m-banking),
          GoPay, atau ShopeePay melalui <strong>Midtrans</strong>. Token bertambah
          hanya setelah pembayaranmu <strong>terverifikasi otomatis oleh
          Midtrans</strong> — tidak perlu konfirmasi manual.
        </p>
      )}
      {autoMode === 'sandbox' && (
        <p className="pay-note">
          {lang === 'en'
            ? 'Midtrans test mode (Sandbox): this transaction is a simulation and uses no real money.'
            : 'Mode uji Midtrans (Sandbox): transaksi ini simulasi dan tidak memakai uang sungguhan.'}
        </p>
      )}
      <div className="pay-actions">
        <button
          className="btn btn-primary"
          type="button"
          onClick={handleAutoPay}
          disabled={autoBusy}
        >
          {autoBusy ? t.processing : t.autoPayBtn}
        </button>
      </div>
      {autoMsg && (
        <p className="pay-note" role="status">
          {autoMsg}
        </p>
      )}
    </div>
  )
  const activePaySection = autoAvailable ? autoPaySection : paymentSection

  // Contoh personal untuk "Lihat contoh": dikutip dari snapshot teks
  // yang dianalisis (analyzedText), bukan dari kotak teks yang mungkin
  // sudah diedit sesudahnya.
  const personalExamples = useMemo(
    () =>
      result
        ? buildPersonalExamples(result, analyzedText, analyzedRole, lang, {
            // Teks contoh yang menyebut satu posisi memakai posisi
            // PENENTU skor pemeriksaan terkait (best-match), bukan
            // selalu posisi utama.
            ringkasan: result.relevanceWinners.ringkasan ?? undefined,
            relevansiRingkasan: result.relevanceWinners.ringkasan ?? undefined,
            relevansiPengalaman: result.relevanceWinners.pengalaman ?? undefined,
          })
        : {},
    [result, analyzedText, analyzedRole, lang],
  )

  return (
    <div className="page" id="atas">
      {/* ===== TOPBAR MELEKAT ===== */}
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#atas" aria-label="Screening CV — kembali ke atas">
            <span className="brand-mark"><Icon d={I.zap} size={16} /></span>
            Screening CV
          </a>
          <nav className="topbar-links" aria-label="Navigasi utama">
            <a className="topbar-link" href="#contoh">{t.navSample}</a>
            <a className="btn btn-primary btn-sm" href="#analisis">{t.navAnalyze}</a>
          </nav>
          <div className="lang-switch" role="group" aria-label="Bahasa / Language">
            <button
              type="button"
              className={lang === 'id' ? 'active' : undefined}
              aria-pressed={lang === 'id'}
              onClick={() => setLang('id')}
            >
              ID
            </button>
            <button
              type="button"
              className={lang === 'en' ? 'active' : undefined}
              aria-pressed={lang === 'en'}
              onClick={() => setLang('en')}
            >
              EN
            </button>
          </div>
        </div>
      </header>

      {/* ===== HERO ===== */}
      <header className="hero">
        <div className="hero-inner">
          <span className="badge"><Icon d={I.zap} size={14} />{' '}
            {lang === 'en'
              ? 'Screening CV · Honest Scores, Clear Improvement Advice'
              : 'Screening CV · Skor Jujur, Saran Perbaikan Jelas'}
          </span>
          <h1>{t.heroTitleA} <span className="hero-accent">{t.heroTitleAccent}</span></h1>
          <p className="hero-sub">{t.heroSub}</p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#analisis"><Icon d={I.chart} size={18} /> {t.heroStart}</a>
            <button className="btn btn-ghost" type="button" onClick={handleSample}>
              <Icon d={I.file} size={18} /> {t.heroSample}
            </button>
          </div>
          <p className="hero-note">
            <Icon d={I.check} size={15} />
            {lang === 'en' ? (
              <span>
                Your CV stays here: the standard analysis runs 100% in your browser,
                and your file is never uploaded to any server. Want help rewriting it?
                There is a paid AI Analysis for that.
              </span>
            ) : (
              <span>
                CV-mu tetap di sini: analisis standar berjalan 100% di browser,
                file-mu tidak diunggah ke server mana pun. Mau dibantu menulis
                ulang? Ada Analisis AI berbayar untuk itu.
              </span>
            )}
          </p>
          <div className="hero-stats">
            <div><strong>100</strong><span>{t.statPoints}</span></div>
            <div><strong>6+1</strong><span>{t.statAspects}</span></div>
            <div><strong>27</strong><span>{t.statChecks}</span></div>
          </div>
        </div>
      </header>

      {/* ===== CONTOH HASIL ===== */}
      <DemoSection lang={lang} />

      {/* ===== LAYOUT UTAMA ===== */}
      <main className="layout" id="analisis">
        {/* ----- FORM ----- */}
        <section className="card form-card">
          <h2><Icon d={I.file} size={20} /> {t.formTitle}</h2>

          <div className="step">
            <div className="step-head">
              <span className="step-num" aria-hidden="true">1</span>
              <h3 className="step-title">{t.step1}</h3>
            </div>

          <div
            className={`dropzone${dragging ? ' dragging' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              const f = e.dataTransfer.files?.[0]
              if (f) void handleFile(f)
            }}
            role="button"
            tabIndex={0}
          >
            <Icon d={I.upload} size={26} />
            <p><strong>{t.dropzoneStrong}</strong><br />{t.dropzoneRest}</p>
            {fileName && <span className="file-name">{fileName}</span>}
            {loadingFile && <span className="file-name">{t.readingFile}</span>}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleFile(f)
              e.target.value = ''
            }}
          />

          <label className="field">
            <span>{t.cvTextLabel}</span>
            <textarea
              value={cvText}
              onChange={(e) => setCvText(e.target.value)}
              placeholder={t.cvPlaceholder}
              rows={12}
            />
            <small className="counter" aria-live="polite">
              {lang === 'en'
                ? `${countWords(cvText)} words detected • ${cvText.length} characters`
                : `${countWords(cvText)} kata terdeteksi • ${cvText.length} karakter`}
            </small>
          </label>
          </div>

          <div className="step">
            <div className="step-head">
              <span className="step-num" aria-hidden="true">2</span>
              <h3 className="step-title">{t.step2}</h3>
              <span className="step-chip">{t.optional}</span>
            </div>

          <div className="field">
            <span>{t.roleLabel}</span>
            <RoleMultiCombobox
              values={targetRoles}
              draft={roleDraft}
              onValuesChange={setTargetRoles}
              onDraftChange={setRoleDraft}
              lang={lang}
            />
            <small className="role-hint">{t.roleMultiHint}</small>
          </div>

          <label className="field">
            <span>{t.jobDescLabel}</span>
            <textarea
              value={jobDesc}
              onChange={(e) => setJobDesc(e.target.value)}
              placeholder={t.jobDescPlaceholder}
              rows={5}
            />
          </label>
          </div>

          {error && <div className="alert alert-error"><Icon d={I.alert} size={16} /> {error}</div>}

          <div className="step">
            <div className="step-head">
              <span className="step-num" aria-hidden="true">3</span>
              <h3 className="step-title">{t.step3}</h3>
            </div>

          <div className="form-actions">
            <button className="btn btn-primary btn-lg" type="button" onClick={handleAnalyze}>
              <Icon d={I.search} size={18} /> {t.analyzeBtn}
            </button>
            <button className="btn btn-secondary" type="button" onClick={handleSample}>
              {t.sampleBtn}
            </button>
            <button className="btn btn-plain" type="button" onClick={handleReset}>
              <Icon d={I.refresh} size={16} /> {t.resetBtn}
            </button>
          </div>
          </div>
        </section>

        {/* ----- HASIL ----- */}
        <section className="result-col" ref={resultRef}>
          {!result ? (
            <div className="card empty-card">
              <h3>{t.emptyTitle}</h3>
              <ul className="empty-list">
                {t.emptyItems.map((item) => (
                  <li key={item}><Icon d={I.check} size={15} /> {item}</li>
                ))}
              </ul>
              <p className="empty-hint">
                {lang === 'en' ? (
                  <>Fill in the form, then click <strong>Analyze CV</strong>.</>
                ) : (
                  <>Isi form di samping lalu klik <strong>Analisis CV</strong>.</>
                )}
              </p>
            </div>
          ) : (
            <>
              <div className="card result-card">
                <div className="result-top">
                  <ScoreRing score={result.total} />
                  <div className="result-summary">
                    <span className="badge badge-soft">{t.resultBadge}</span>
                    <h2 className={`verdict-text ${result.total >= 85 ? 't-green' : result.total >= 70 ? 't-sky' : result.total >= 50 ? 't-amber' : 't-red'}`}>{result.label}</h2>
                    <p>
                      {lang === 'en'
                        ? `Your CV has ${result.wordCount} words. The score is calculated from evidence that is actually in the CV — empty sections score 0.`
                        : `CV berisi ${result.wordCount} kata. Skor dihitung dari bukti isi yang benar-benar ada — bagian yang kosong poinnya 0.`}
                    </p>
                  </div>
                </div>

                <div className="bars">
                  {result.aspects.map((a) => {
                    const ratio = a.max > 0 ? a.score / a.max : 0
                    const tier = ratio >= 0.85 ? 'fill-green' : ratio >= 0.7 ? 'fill-sky' : ratio >= 0.5 ? 'fill-amber' : 'fill-red'
                    return (
                      <div className="bar-row" key={a.name}>
                        <span className="bar-label">{a.name}</span>
                        <div className="bar-track">
                          <div
                            className={`bar-fill ${tier}`}
                            style={{ width: `${Math.round(ratio * 100)}%` }}
                          />
                        </div>
                        <span className="bar-score">{a.score}/{a.max}</span>
                      </div>
                    )
                  })}
                </div>

                {result.roleWarning && (
                  <div className="alert alert-warn"><Icon d={I.alert} size={16} /> {result.roleWarning}</div>
                )}

                {/* Kejujuran best-match: bila >1 posisi dilamar, sebut
                    posisi penentu skor relevansinya (per pemeriksaan
                    bila pemenangnya berbeda). */}
                {analyzedRoles.length > 1 &&
                  (result.relevanceWinners.ringkasan || result.relevanceWinners.pengalaman) && (
                    <p className="winner-note">
                      {result.relevanceWinners.ringkasan &&
                      result.relevanceWinners.pengalaman &&
                      result.relevanceWinners.ringkasan !== result.relevanceWinners.pengalaman
                        ? t.winnerNoteTwo(
                            historyRoleLabel(result.relevanceWinners.ringkasan, lang),
                            historyRoleLabel(result.relevanceWinners.pengalaman, lang),
                          )
                        : t.winnerNote(
                            historyRoleLabel(
                              (result.relevanceWinners.ringkasan ??
                                result.relevanceWinners.pengalaman) as string,
                              lang,
                            ),
                          )}
                    </p>
                  )}
              </div>

              {result.priorities.length > 0 && (
                <div className="card top3-card">
                  <h3><Icon d={I.trendUp} size={18} /> {t.top3Title}</h3>
                  <p className="card-hint">{t.top3Hint}</p>
                  <ol className="top3-list">
                    {result.priorities.slice(0, 3).map((c) => (
                      <li key={c.id}>
                        <strong>{c.title}</strong> — {c.score}/{c.max} {t.points}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {history.length > 0 && (
                <div className="card history-card">
                  <h3><Icon d={I.clock} size={18} /> {t.historyTitle}</h3>

                  {prevEntry && (() => {
                    const d = scoreDelta(prevEntry.total, result.total, lang)
                    const currEntry = entryFromResult(result, analyzedRole, new Date(), analyzedRoles)
                    // Spanduk sadar-posisi: selisih skor & delta per aspek
                    // hanya bermakna bila HIMPUNAN posisi targetnya sama
                    // (sesudah resolusi label; urutan tidak penting). Bila
                    // berbeda, kedua himpunan posisi disebut eksplisit
                    // agar "turun" antar-posisi tidak terbaca sebagai CV
                    // yang memburuk.
                    const sameRole = historyRoleSetsMatch(
                      entryRoles(prevEntry),
                      analyzedRoles,
                      lang,
                    )
                    const prevRoleLabel = entryRoles(prevEntry)
                      .map((r) => (lang === 'id' ? historyRoleLabel(r) : historyRoleLabel(r, lang)))
                      .join(', ')
                    const currRoleLabel = analyzedRoles
                      .map((r) => (lang === 'id' ? historyRoleLabel(r) : historyRoleLabel(r, lang)))
                      .join(', ')
                    const changed = sameRole
                      ? aspectDeltas(prevEntry, currEntry)
                          .filter((a) => a.delta !== null && a.delta !== 0)
                      : []
                    const compositionChanged = sameRole && compositionDiffers(prevEntry, currEntry)
                    return (
                      <div className="compare-box">
                        <p className="compare-main">
                          {sameRole ? (
                            <>
                              <span className={`delta-badge delta-${d.direction}`}>
                                <Icon
                                  d={d.direction === 'naik' ? I.trendUp : d.direction === 'turun' ? I.trendDown : I.minus}
                                  size={15}
                                />
                                {d.word}
                              </span>
                              <span>
                                {t.lastCheck} ({formatHistoryDate(prevEntry.at, lang)}):{' '}
                                <strong>{prevEntry.total}</strong> → {t.now}:{' '}
                                <strong>{result.total}</strong> ({d.text})
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="delta-badge delta-tetap">
                                <Icon d={I.minus} size={15} />
                                {t.diffRole}
                              </span>
                              <span>
                                {t.lastCheck} ({formatHistoryDate(prevEntry.at, lang)})
                                {prevRoleLabel ? (
                                  <> {t.forRole} <strong>{prevRoleLabel}</strong></>
                                ) : (
                                  <> {t.noRole}</>
                                )}
                                : <strong>{prevEntry.total}</strong> → {t.now}
                                {currRoleLabel ? (
                                  <> {t.forRole} <strong>{currRoleLabel}</strong></>
                                ) : (
                                  <> {t.noRole}</>
                                )}
                                : <strong>{result.total}</strong>
                              </span>
                            </>
                          )}
                        </p>
                        {sameRole ? (
                          changed.length > 0 ? (
                            <ul className="aspect-deltas">
                              {changed.map((a) => (
                                <li key={a.name}>
                                  <span className="ad-name">{a.name}:</span> {a.previous} → {a.score}{' '}
                                  <span className={`ad-delta ad-${a.direction}`}>
                                    ({a.delta !== null && a.delta > 0 ? `+${a.delta}` : a.delta})
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="aspect-deltas-note">{t.aspectsSame}</p>
                          )
                        ) : (
                          <p className="aspect-deltas-note">
                            {lang === 'en'
                              ? 'The target position differs from your last check, so the score difference and per-aspect comparison are not shown — the two scores were calculated for different positions.'
                              : 'Posisi targetnya berbeda dari cek terakhir, jadi selisih skor dan perbandingan per aspek tidak ditampilkan — kedua skor dihitung untuk posisi yang berbeda.'}
                          </p>
                        )}
                        {compositionChanged && (
                          <p className="aspect-deltas-note">
                            {lang === 'en'
                              ? 'Note: the aspect mix differs from your last check (for example with/without the Job Match aspect or a target position), so the per-aspect differences above are only approximate — the total score comparison still holds.'
                              : 'Catatan: komposisi aspek berbeda dari cek terakhir (misalnya dengan/tanpa aspek Kecocokan dengan Lowongan atau posisi target), jadi selisih per aspek di atas hanya perkiraan — perbandingan total skor tetap berlaku.'}
                          </p>
                        )}
                      </div>
                    )
                  })()}

                  <ul className="history-list">
                    {history.slice(0, 5).map((e, i) => (
                      <li className="history-row" key={`${e.at}-${i}`}>
                        <span className="history-date">{formatHistoryDate(e.at, lang)}</span>
                        <span className="history-score">{e.total}/100</span>
                        <span className="history-label">{e.label}</span>
                        {e.role && (
                          <span className="history-role">
                            {lang === 'id' ? historyRoleLabel(e.role) : historyRoleLabel(e.role, lang)}
                            {entryRoles(e).length > 1 ? ` +${entryRoles(e).length - 1}` : ''}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>

                  <p className="history-note">{t.historyNote}</p>
                  <button className="btn btn-plain history-clear" type="button" onClick={handleClearHistory}>
                    <Icon d={I.trash} size={15} /> {t.clearHistory}
                  </button>
                </div>
              )}

              {result.strengths.length > 0 && (
                <div className="card">
                  <h3><Icon d={I.check} size={18} /> {t.strengthsTitle}</h3>
                  <ul className="check-list">
                    {result.strengths.map((c) => <CheckRow key={c.id} check={c} lang={lang} />)}
                  </ul>
                </div>
              )}

              <div className="card">
                <h3><Icon d={I.alert} size={18} /> {t.prioritiesTitle}</h3>
                {result.priorities.length === 0 ? (
                  <p>{t.prioritiesEmpty}</p>
                ) : (
                  <>
                    <p className="card-hint">{t.prioritiesHint}</p>
                    <ul className="check-list">
                      {result.priorities.map((c, i) => (
                        <PriorityRow
                          key={c.id}
                          check={c}
                          personal={personalExamples[c.id] ?? null}
                          index={i}
                          lang={lang}
                        />
                      ))}
                    </ul>
                  </>
                )}
              </div>

              {/* ----- TEMPLATE RINGKASAN & DAFTAR SKILL (Fase 2) ----- */}
              <div className="card">
                <h3><Icon d={I.book} size={18} /> {t.templateCardTitle}</h3>

                <h4 className="subhead">{t.templateSub}</h4>
                <p>{t.templateIntro}</p>
                <div className="template-box">{buildSummaryTemplate(effectiveRoles[0] ?? '', lang)}</div>

                {/* Daftar skill dirinci PER POSISI: satu blok untuk tiap
                    posisi efektif (chip + draf). Tanpa posisi, satu blok
                    fallback persis seperti sebelumnya. */}
                {(effectiveRoles.length ? effectiveRoles : ['']).map((skillRole) => {
                  const roleSkills = getRoleSkills(skillRole, lang)
                  const skillStatus = checkSkills(cvText, roleSkills.skills)
                  const presentCount = skillStatus.filter((s) => s.present).length
                  return (
                    <div key={skillRole || '__umum'}>
                      <h4 className="subhead">
                        {lang === 'en' ? 'Skill Checklist' : 'Daftar Skill'} — {roleSkills.label}
                      </h4>
                      {lang === 'en' ? (
                        <p>
                          {presentCount} of the {skillStatus.length} skills commonly sought
                          for{' '}
                          {roleSkills.posisiKustom ? `the ${roleSkills.label} position` : 'this role'}{' '}
                          were found in your CV. This is general guidance
                          {roleSkills.posisiKustom
                            ? ' — there is no dedicated skill dictionary for this position yet, so the list uses relevant general skills'
                            : ''}{' '}
                          — only tick skills you genuinely have; never list a skill you do
                          not actually have.
                        </p>
                      ) : (
                        <p>
                          {presentCount} dari {skillStatus.length} skill yang umum dicari untuk{' '}
                          {roleSkills.posisiKustom ? `posisi ${roleSkills.label}` : 'peran ini'} sudah
                          terbaca di CV-mu. Ini saran umum
                          {roleSkills.posisiKustom
                            ? ' — belum ada kamus skill khusus untuk posisi ini, jadi daftarnya memakai skill umum yang relevan'
                            : ''}{' '}
                          — hanya centang yang benar-benar kamu kuasai; jangan mencantumkan skill
                          yang tidak kamu miliki.
                        </p>
                      )}
                      <ul className="skill-list">
                        {skillStatus.map((s) => (
                          <li key={s.skill} className={s.present ? 'skill-present' : 'skill-missing'}>
                            <span className="skill-icon">
                              {s.present ? <Icon d={I.check} size={13} /> : <Icon d={I.minus} size={13} />}
                            </span>
                            <span className="skill-name">{skillDisplayName(s.skill, lang)}</span>
                            <span className="skill-state">{s.present ? t.skillPresent : t.skillMissing}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
                <p className="ai-note">{t.skillNote}</p>
              </div>

              {result.keywords && (
                <div className="card">
                  <h3><Icon d={I.target} size={18} /> {t.keywordsTitle}</h3>
                  {result.jobMatchApplied ? (
                    lang === 'en' ? (
                      <p>
                        <strong>{result.keywords.percent}%</strong> of the job posting's top{' '}
                        {result.keywords.total} keywords were found in your CV. Because you
                        provided a job description, this match <strong>counts toward your
                        main score</strong> as the “Job Match” aspect (20 points) — the other
                        aspects are scaled proportionally so the total stays 100. This score
                        is specific to this posting and will change if the posting changes.
                      </p>
                    ) : (
                      <p>
                        <strong>{result.keywords.percent}%</strong> dari {result.keywords.total} kata kunci
                        teratas lowongan ditemukan di CV-mu. Karena kamu mengisi deskripsi lowongan,
                        kecocokan ini <strong>masuk skor utama</strong> sebagai aspek
                        “Kecocokan dengan Lowongan” (20 poin) — aspek lain diskalakan proporsional
                        agar total tetap 100. Skor ini khusus untuk lowongan ini dan akan berubah
                        bila lowongannya berganti.
                      </p>
                    )
                  ) : lang === 'en' ? (
                    <p>
                      The job description you pasted produced no keywords that could be
                      checked, so the job match <strong>does not affect your score</strong>{' '}
                      this time. Paste a complete job description so the Job Match aspect can
                      be assessed.
                    </p>
                  ) : (
                    <p>
                      Deskripsi lowongan yang kamu tempel tidak menghasilkan kata kunci yang
                      bisa dicek, jadi kecocokan lowongan <strong>tidak memengaruhi skor</strong> kali ini.
                      Tempel deskripsi lowongan yang lengkap agar aspek Kecocokan dengan Lowongan bisa dinilai.
                    </p>
                  )}
                  <div className="chips-group">
                    <span className="chips-title">{t.foundTitle}</span>
                    <div className="chips">
                      {result.keywords.found.length
                        ? result.keywords.found.map((k) => <span key={k} className="chip chip-ok">{k}</span>)
                        : <span className="chip">—</span>}
                    </div>
                  </div>
                  <div className="chips-group">
                    <span className="chips-title">{t.missingTitle}</span>
                    <div className="chips">
                      {result.keywords.missing.length
                        ? result.keywords.missing.map((k) => <span key={k} className="chip chip-miss">{k}</span>)
                        : <span className="chip">—</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* ----- ANALISIS AI ----- */}
              <div className="card ai-card">
                <h3><Icon d={I.spark} size={18} /> {t.aiTitle} <span className="paid-chip">{t.paidChip}</span></h3>
                {lang === 'en' ? (
                  <p>
                    Want deeper advice than the score above? The AI reads your CV
                    qualitatively: it rewrites your experience points, shows how you fall
                    short against the job posting, and gives a sample profile summary. If
                    you filled in a target position, the discussion is tailored to that
                    position. Most importantly, the AI <strong>writes a complete fixed
                    version for every one of your fix priorities</strong> — finished text
                    you can copy straight into your CV, not just generic examples. This
                    section is separate and <strong>does not change your main
                    score</strong>. And <strong>your token is only used when the analysis
                    succeeds — if the AI fails, your token is not lost.</strong> The
                    analysis results follow the language of your CV: an English CV is
                    discussed in English, an Indonesian CV in Indonesian.
                  </p>
                ) : (
                  <p>
                    Mau saran yang lebih dalam dari skor di atas? AI membaca CV-mu secara
                    kualitatif: menulis ulang poin pengalamanmu, menunjukkan kekurangan
                    terhadap lowongan, dan memberi contoh ringkasan profil. Bila posisi
                    target terisi, pembahasannya disesuaikan untuk posisi itu. Yang
                    terpenting, AI <strong>menuliskan versi perbaikan lengkap untuk semua
                    prioritas perbaikanmu</strong> — dalam bentuk jadi yang siap disalin
                    ke CV, bukan sekadar contoh umum. Bagian ini terpisah dan{' '}
                    <strong>tidak mengubah skor utama</strong>. Dan <strong>token hanya terpakai
                    bila analisis berhasil — kalau AI gagal, tokenmu tidak hangus.</strong>{' '}
                    Bahasa hasil analisis mengikuti bahasa CV-mu: CV berbahasa Inggris
                    dibahas dalam bahasa Inggris, CV berbahasa Indonesia dalam bahasa
                    Indonesia.
                  </p>
                )}

                {aiCredits > 0 ? (
                  <>
                    <div className="credit-row">
                      <span className="credit-badge">
                        {lang === 'en'
                          ? `AI tokens: ${aiCredits}`
                          : `Token AI: ${aiCredits} analisis`}
                      </span>
                      <button
                        className="btn btn-plain credit-buy"
                        type="button"
                        onClick={() => setPayOpen((o) => !o)}
                      >
                        {payOpen ? t.buyClose : t.buyMore}
                      </button>
                    </div>
                    {payOpen && activePaySection}

                    <label className="consent-row">
                      <input
                        type="checkbox"
                        checked={aiConsent}
                        onChange={(e) => setAiConsent(e.target.checked)}
                      />
                      <span>
                        {lang === 'en'
                          ? 'I agree that my CV text is sent to OpenRouter for analysis. The text is not stored by Screening CV.'
                          : 'Saya setuju teks CV dikirim ke OpenRouter untuk dianalisis. Teks tidak disimpan oleh Screening CV.'}
                      </span>
                    </label>

                    <div className="ai-actions">
                      <button
                        className="btn btn-primary btn-lg"
                        type="button"
                        onClick={handleAiAnalyze}
                        disabled={!aiConsent || aiLoading || (result ? analyzedText : cvText).trim().length < 50}
                      >
                        <Icon d={I.spark} size={16} />
                        {aiLoading ? t.aiRunning : aiResult ? t.aiRerun : t.aiRun}
                      </button>
                      {cvText.trim().length < 50 && (
                        <span className="ai-hint">{t.aiMinHint}</span>
                      )}
                    </div>
                  </>
                ) : (
                  activePaySection
                )}

                {/* Unduh laporan dari kartu AI — satu-satunya tombol
                    laporan (keputusan pengguna 2026-11-21): berkas PDF
                    sungguhan langsung terunduh, bukan dialog cetak.
                    Tombolnya hanya muncul SETELAH Analisis AI selesai
                    (keputusan pengguna 2026-11-21) karena laporan diunduh
                    untuk menyimpan kalimat hasil AI; sebelum itu tampil
                    petunjuk pengganti di tempat yang sama. */}
                {aiResult ? (
                  <div className="report-actions ai-report-actions">
                    <button className="btn btn-secondary" type="button" onClick={handleDownloadPdf}>
                      <Icon d={I.download} size={16} /> Unduh Laporan (PDF)
                    </button>
                    <span className="ai-hint">{t.reportHint}</span>
                    {downloadError && (
                      <div className="alert alert-error">
                        <Icon d={I.alert} size={16} /> {downloadError}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="report-actions ai-report-actions">
                    <span className="ai-hint">
                      {lang === 'en'
                        ? 'The report download button will appear once the AI Analysis is complete.'
                        : 'Tombol unduh laporan akan muncul setelah Analisis AI selesai.'}
                    </span>
                  </div>
                )}

                {aiLoading ? (
                  <div className="thinking-panel">
                    <div className="thinking-head">
                      <span className="thinking-title">
                        <Icon d={I.spark} size={15} />
                        <span>{t.thinkingTitle}</span>
                      </span>
                      <span className="thinking-status">
                        <span className="thinking-dot" aria-hidden="true" />
                        {t.thinkingStatus}
                      </span>
                    </div>
                    <ol className="thinking-stages">
                      {aiStages.map((label, i) => (
                        <li
                          key={label}
                          className={i < aiStage ? 'stage-done' : i === aiStage ? 'stage-active' : 'stage-todo'}
                        >
                          <span className="stage-mark" aria-hidden="true">
                            {i < aiStage ? <Icon d={I.check} size={13} /> : <span className="stage-dot" />}
                          </span>
                          <span>
                            {i === aiStages.length - 1 && aiFixBatch && aiFixBatch.total > 1
                              ? lang === 'en'
                                ? `${label} (part ${aiFixBatch.current} of ${aiFixBatch.total})`
                                : `${label} (bagian ${aiFixBatch.current} dari ${aiFixBatch.total})`
                              : label}
                          </span>
                        </li>
                      ))}
                    </ol>
                    <p className="thinking-note">
                      {lang === 'en'
                        ? 'A thorough analysis usually takes 1–2 minutes. When the AI service is busy, it can take longer — the stages above show how far along it is. Your token is only used if the analysis succeeds.'
                        : 'Analisis mendalam biasanya butuh 1–2 menit. Saat layanan AI sedang sibuk, prosesnya bisa lebih lama — tahapan di atas menunjukkan prosesnya sudah sampai mana. Tokenmu hanya terpakai bila analisis berhasil.'}
                    </p>
                  </div>
                ) : aiRunDone ? (
                  <div className="thinking-panel thinking-done">
                    <span className="thinking-done-label">
                      <Icon d={I.check} size={15} /> {t.doneLabel}
                    </span>
                  </div>
                ) : null}

                {aiError && <div className="alert alert-error"><Icon d={I.alert} size={16} /> {aiError}</div>}

                {aiResult && (
                  <div className="ai-result">
                    {aiRoleLabels.length > 0 && (
                      <p className="ai-role-label">
                        {lang === 'en'
                          ? aiRoleLabels.length > 1
                            ? 'Tailored to the positions:'
                            : 'Tailored to the position:'
                          : 'Disesuaikan untuk posisi:'}{' '}
                        <strong>{aiRoleLabels.join(', ')}</strong>
                      </p>
                    )}
                    {aiResult.ringkasan && (
                      <div className="ai-block">
                        <h4>{t.aiSummaryTitle}</h4>
                        <p>{aiResult.ringkasan}</p>
                      </div>
                    )}

                    {aiResult.penilaianPosisi && (
                      <div className="ai-block">
                        <h4>
                          {lang === 'en'
                            ? aiRoleLabels.length > 1
                              ? 'Assessment by Position'
                              : aiRoleLabels[0]
                                ? `Assessment for the ${aiRoleLabels[0]} Position`
                                : 'Position Assessment'
                            : aiRoleLabels.length > 1
                              ? 'Penilaian per Posisi'
                              : `Penilaian untuk Posisi${aiRoleLabels[0] ? ` ${aiRoleLabels[0]}` : ''}`}
                        </h4>
                        <p>{aiResult.penilaianPosisi}</p>
                      </div>
                    )}

                    {aiResult.perbaikanLengkap && aiResult.perbaikanLengkap.length > 0 && (
                      <div className="ai-block">
                        <h4>{t.aiFixesTitle}</h4>
                        <p className="ai-note">{t.aiFixesNote}</p>
                        <ul className="rewrite-list">
                          {aiResult.perbaikanLengkap.map((f, i) => (
                            <li className="rewrite-item" key={f.idPemeriksaan || i}>
                              <span className="rewrite-label">{f.judul}</span>
                              {f.sebelum && (
                                <>
                                  <span className="rewrite-label">{t.beforeLabel}</span>
                                  <p className="rewrite-asli">{f.sebelum}</p>
                                </>
                              )}
                              <span className="rewrite-label">{t.afterLabel}</span>
                              <p className="rewrite-saran">{f.sesudah}</p>
                              {f.catatan && <p className="rewrite-alasan">{f.catatan}</p>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {aiResult.saranPenulisanUlang.length > 0 && (
                      <div className="ai-block">
                        <h4>{t.rewriteTitle}</h4>
                        <ul className="rewrite-list">
                          {aiResult.saranPenulisanUlang.map((r, i) => (
                            <li className="rewrite-item" key={i}>
                              <span className="rewrite-label">{t.originalLabel}</span>
                              <p className="rewrite-asli">{r.asli}</p>
                              <span className="rewrite-label">{t.suggestionLabel}</span>
                              <p className="rewrite-saran">{r.saran}</p>
                              {r.alasan && <p className="rewrite-alasan">{r.alasan}</p>}
                            </li>
                          ))}
                        </ul>
                        <p className="ai-note">{t.rewriteNote}</p>
                      </div>
                    )}

                    {aiResult.kekurangan.length > 0 && (
                      <div className="ai-block">
                        <h4>{t.shortcomingsTitle}</h4>
                        <ul className="ai-list">
                          {aiResult.kekurangan.map((k, i) => <li key={i}>{k}</li>)}
                        </ul>
                      </div>
                    )}

                    {aiResult.saranRingkasan && (
                      <div className="ai-block">
                        <h4>{t.sampleSummaryTitle}</h4>
                        <p className="ai-summary">{aiResult.saranRingkasan}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

        </section>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          {lang === 'en' ? (
            <p>
              The standard assessment is rule-based and runs entirely in your browser —
              it is not a recruiter's decision, and no data is uploaded or stored. The
              only exception: the AI Analysis feature (optional, paid) sends your CV
              text to OpenRouter only when you tick the consent box, and that text is
              not stored by Screening CV.
            </p>
          ) : (
            <p>
              Penilaian standar berbasis aturan (rule-based) dan berjalan sepenuhnya di
              browser kamu — bukan keputusan rekruter, dan tidak ada data yang diunggah
              atau disimpan. Satu-satunya pengecualian: fitur Analisis AI (opsional,
              berbayar) mengirim teks CV ke OpenRouter hanya bila kamu mencentang
              persetujuan, dan teks itu tidak disimpan oleh Screening CV.
            </p>
          )}
          <p className="footer-links">
            <a href="/privacy.html">{t.privacyLink}</a>
            <span aria-hidden="true"> • </span>
            <a href="/terms.html">{t.termsLink}</a>
          </p>
          <p className="footer-links">
            <a href="/artikel/kesalahan-cv-fresh-graduate.html">{t.articleLink}</a>
          </p>
        </div>
      </footer>
    </div>
  )
}
