import { useEffect, useRef, useState } from 'react'
import './App.css'
import { analyzeCv, countWords, type AnalysisResult, type CheckItem } from './lib/analyze'
import {
  addHistoryEntry,
  aspectDeltas,
  clearHistory,
  compositionDiffers,
  entryFromResult,
  formatHistoryDate,
  loadHistory,
  scoreDelta,
  type ScoreHistoryEntry,
} from './lib/history'
import { requestAiAnalysis, requestAiAnalysisStreaming, type AiAnalysis } from './lib/ai'
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
} from './lib/examples'
import { SAMPLE_CV } from './lib/sampleCv'
import { extractTextFromFile } from './lib/readFile'


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

function CheckRow({ check }: { check: CheckItem }) {
  return (
    <li className={`check-row status-${check.status}`}>
      <span className="check-icon">
        {check.status === 'baik' ? <Icon d={I.check} size={15} /> : <Icon d={I.alert} size={15} />}
      </span>
      <div className="check-body">
        <div className="check-head">
          <strong>{check.title}</strong>
          <span className="check-meta">{check.aspect} • {check.score}/{check.max} poin</span>
        </div>
        <p>{check.message}</p>
      </div>
    </li>
  )
}

// Baris prioritas perbaikan + contoh kalimat "sebelum → sesudah" (Fase 2).
// Contoh bersifat generik-ilustratif dari modul examples.ts — hanya tampil
// untuk pemeriksaan yang memang punya contoh yang cocok.
function PriorityRow({ check }: { check: CheckItem }) {
  const [open, setOpen] = useState(false)
  const example = getCheckExample(check.id)
  return (
    <li className={`check-row status-${check.status}`}>
      <span className="check-icon">
        {check.status === 'baik' ? <Icon d={I.check} size={15} /> : <Icon d={I.alert} size={15} />}
      </span>
      <div className="check-body">
        <div className="check-head">
          <strong>{check.title}</strong>
          <span className="check-meta">{check.aspect} • {check.score}/{check.max} poin</span>
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
              {open ? 'Sembunyikan contoh' : 'Lihat contoh'}
            </button>
            {open && (
              <div className="example-box">
                <span className="example-label">Contoh:</span>
                <p className="example-before">
                  <span className="example-tag">Sebelum:</span> {example.sebelum}
                </p>
                <p className="example-after">
                  <span className="example-tag">Sesudah:</span> {example.sesudah}
                </p>
                <p className="example-note">{example.catatan}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

const ATS_TIPS = [
  'Gunakan heading standar yang mudah dikenali sistem ATS: Ringkasan, Pengalaman, Pendidikan, Keahlian.',
  'Tulis pencapaian dengan angka: persen, jumlah orang/proyek, atau nominal — bukan hanya daftar tugas.',
  'Mulai setiap poin pengalaman dengan kata kerja aksi, misalnya meningkatkan, mengelola, membangun.',
  'Samakan kata kunci penting dari deskripsi lowongan dengan isi CV-mu secara jujur.',
  'Jaga panjang CV di kisaran 220–900 kata (1–2 halaman) dan susun dengan bullet yang rapi.',
  'Cantumkan kontak lengkap: email, nomor HP, LinkedIn, dan link portofolio.',
]

export default function App() {
  const [cvText, setCvText] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [jobDesc, setJobDesc] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  // Tanggal analisis terakhir — dipakai di kepala laporan PDF unduhan.
  const [analysisDate, setAnalysisDate] = useState<Date | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [loadingFile, setLoadingFile] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [copiedTemplate, setCopiedTemplate] = useState(false)
  const [aiConsent, setAiConsent] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<AiAnalysis | null>(null)
  const [aiError, setAiError] = useState('')
  const [aiThinking, setAiThinking] = useState('')
  const [aiThinkingOpen, setAiThinkingOpen] = useState(false)
  const [aiElapsed, setAiElapsed] = useState(0)
  const [aiDuration, setAiDuration] = useState<number | null>(null)
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
  const thinkingBodyRef = useRef<HTMLDivElement>(null)

  // Penghitung detik berjalan selama analisis AI berlangsung.
  useEffect(() => {
    if (!aiLoading) return
    const id = window.setInterval(() => {
      setAiElapsed(Math.floor((Date.now() - aiStartRef.current) / 1000))
    }, 500)
    return () => window.clearInterval(id)
  }, [aiLoading])

  // Panel proses berpikir selalu bergulir mengikuti teks terbaru.
  useEffect(() => {
    const el = thinkingBodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [aiThinking, aiThinkingOpen])

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
      const text = await extractTextFromFile(file)
      if (!text.trim()) {
        setError('Teks dari file kosong. Jika PDF hasil scan/gambar, tempel teks CV secara manual.')
      } else {
        setCvText(text)
        setFileName(file.name)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal membaca file.')
    } finally {
      setLoadingFile(false)
    }
  }

  function handleAnalyze() {
    setError('')
    if (cvText.trim().length < 20) {
      setError('Teks CV masih terlalu pendek. Upload file CV atau tempel teks CV terlebih dahulu.')
      return
    }
    const res = analyzeCv(cvText, { targetRole, jobDesc })
    setResult(res)
    setAnalysisDate(new Date())
    // Fase 1: simpan skor ke riwayat perangkat (hanya skor — teks CV tidak
    // disimpan) dan ingat entri sebelumnya untuk perbandingan sebelum → sesudah.
    setPrevEntry(loadHistory()[0] ?? null)
    setHistory(addHistoryEntry(entryFromResult(res, targetRole)))
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
    setError('')
  }

  function handleReset() {
    setCvText('')
    setTargetRole('')
    setJobDesc('')
    setResult(null)
    setAnalysisDate(null)
    setFileName('')
    setError('')
    setCopiedTemplate(false)
    setAiConsent(false)
    setAiResult(null)
    setAiError('')
    setAiThinking('')
    setAiThinkingOpen(false)
    setAiElapsed(0)
    setAiDuration(null)
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
          text: `Kode diterima — token AI kamu bertambah 1 (total sekarang ${res.balance}). Centang persetujuan di bawah, lalu jalankan Analisis AI.`,
        })
        clearPendingCode()
        setPendingCode(getOrCreatePendingCode())
        setPayOpen(false)
      } else {
        setRedeemFails((f) => f + 1)
        setRedeemMsg({ ok: false, text: 'Kode tidak valid atau sudah dipakai di perangkat ini.' })
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
              'Pembayaran order ini sudah pernah diklaim di browser ini, jadi token tidak ditambah dua kali.',
            )
          } else if (markOrderClaimed(orderId)) {
            setAiCredits(addCredit())
            setPayOpen(false)
            setAutoMsg(
              'Pembayaran terkonfirmasi oleh Midtrans — token AI kamu bertambah 1. Centang persetujuan di bawah, lalu jalankan Analisis AI.',
            )
          } else {
            setAutoMsg(
              'Pembayaran terkonfirmasi oleh Midtrans, tetapi pencatatan klaim gagal di browser ini. Hubungi admin agar tokenmu ditambah manual.',
            )
          }
          return
        }
        if (check.state === 'failed') {
          setAutoMsg(
            'Pembayaran berakhir tanpa penyelesaian (kedaluwarsa, dibatalkan, atau ditolak). Tidak ada token yang ditambah — silakan coba bayar lagi.',
          )
          return
        }
      }
      setAutoMsg(
        `Pembayaran belum terkonfirmasi dalam 2 menit. Bila kamu sudah membayar, tunggu beberapa saat — atau hubungi admin dan sebutkan kode order ${orderId}.`,
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
    setAutoMsg('Menyiapkan transaksi pembayaran…')
    try {
      const tx = await createSnapTransaction()
      await loadSnapJs(mode, clientKey)
      setAutoMsg('Jendela pembayaran Midtrans dibuka — selesaikan pembayaranmu di sana.')
      payWithSnap(tx.token, {
        onSuccess: () => {
          void pollAutoPayment(tx.orderId)
        },
        onPending: () => {
          setAutoMsg('Menunggu pembayaranmu selesai — status diperiksa otomatis ke Midtrans…')
          void pollAutoPayment(tx.orderId)
        },
        onError: () => {
          setAutoMsg(
            'Pembayaran gagal diproses Midtrans. Tidak ada token yang ditambah — silakan coba lagi.',
          )
          setAutoBusy(false)
        },
        onClose: () => {
          if (!autoPollRef.current) {
            setAutoMsg(
              'Jendela pembayaran ditutup sebelum pembayaran selesai. Token hanya bertambah setelah pembayaran terkonfirmasi oleh Midtrans.',
            )
            setAutoBusy(false)
          }
        },
      })
    } catch (e) {
      setAutoMsg(
        e instanceof Error ? e.message : 'Pembayaran otomatis gagal dimulai. Coba lagi nanti.',
      )
      setAutoBusy(false)
    }
  }

  async function handleAiAnalyze() {
    if (!aiConsent || aiLoading) return
    if (getCredits() <= 0) {
      setAiError('Token AI kamu habis. Bayar lewat QRIS di atas untuk menambah token.')
      return
    }
    if (cvText.trim().length < 50) {
      setAiError('Teks CV terlalu pendek untuk dianalisis AI. Lengkapi dulu teks CV-nya.')
      return
    }
    setAiLoading(true)
    setAiError('')
    setAiThinking('')
    setAiThinkingOpen(false)
    setAiDuration(null)
    setAiElapsed(0)
    aiStartRef.current = Date.now()
    const input = { cvText, targetRole, jobDesc }
    let receivedEvent = false
    let succeeded = false
    try {
      const data = await requestAiAnalysisStreaming(input, {
        onActivity: () => {
          receivedEvent = true
        },
        onReasoning: (text) => {
          setAiThinking((prev) => {
            if (prev.length >= 8000) return prev
            const next = prev + text
            return next.length > 8000 ? `${next.slice(0, 8000)}…` : next
          })
        },
      })
      setAiResult(data)
      succeeded = true
    } catch (streamErr) {
      if (!receivedEvent) {
        // Streaming gagal sebelum event pertama (jaringan/HTTP error):
        // coba sekali mode non-streaming sebagai cadangan.
        try {
          const data = await requestAiAnalysis(input)
          setAiResult(data)
          succeeded = true
        } catch (fallbackErr) {
          setAiError(
            fallbackErr instanceof Error ? fallbackErr.message : 'Analisis AI gagal. Coba lagi nanti.',
          )
        }
      } else {
        setAiError(streamErr instanceof Error ? streamErr.message : 'Analisis AI gagal. Coba lagi nanti.')
      }
    } finally {
      // Token hanya terpotong bila hasil berhasil diterima — tepat satu
      // kali per analisis, termasuk bila jalur streaming sempat gagal dan
      // cadangan non-streaming yang berhasil (atau sebaliknya).
      if (succeeded && consumeCredit()) {
        setAiCredits(getCredits())
      }
      setAiDuration(Math.max(1, Math.round((Date.now() - aiStartRef.current) / 1000)))
      setAiLoading(false)
    }
  }

  // "Unduh Laporan (PDF)": berkas PDF sungguhan dibuat di browser oleh
  // lib/pdf.ts (jsPDF, dimuat dinamis agar bundel awal tetap ringan) lalu
  // langsung terunduh — tanpa dialog cetak. Isinya laporan gabungan:
  // skor standar + bagian Analisis AI bila hasil AI sudah dibuat.
  async function handleDownloadPdf() {
    if (!result) return
    const { buildReportPdf } = await import('./lib/pdf')
    const { blob, fileName } = buildReportPdf(result, {
      ai: aiResult,
      targetRole,
      date: analysisDate ?? new Date(),
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function handleCopyTemplate() {
    const text = buildSummaryTemplate(targetRole)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopiedTemplate(true)
    window.setTimeout(() => setCopiedTemplate(false), 2000)
  }

  // Bagian pembayaran QRIS manual + kode token: tampil saat token habis,
  // atau saat pengguna memilih "Beli token lagi". Nominal selalu harga +
  // kode unik yang sedang berlaku untuk pengguna ini. Token didapat dari
  // kode yang diberikan admin setelah pembayaran diperiksa — tidak ada
  // lagi tombol konfirmasi kepercayaan.
  const redeemLocked = redeemFails >= 5
  const paymentSection = (
    <div className="pay-box">
      <p className="pay-intro">
        Analisis AI berbayar <strong>{formatRupiah(AI_PRICE)} per analisis</strong> —
        analisis standar (skor dan saran perbaikan di atas) tetap gratis.
        Bayar dengan memindai QRIS berikut dari aplikasi pembayaran apa pun
        (GoPay, OVO, DANA, m-banking, dan lainnya). Pastikan nama merchant yang
        muncul adalah <strong>FAKHRI, DIGITAL &amp; KREATIF</strong>.
      </p>
      {qrisError ? (
        <p className="qris-fallback">
          Gambar QRIS belum tersedia. Coba muat ulang halaman ini beberapa saat lagi.
        </p>
      ) : (
        <img
          className="qris-img"
          src="/QRIS.jpeg"
          alt="Kode QRIS GoPay Merchant FAKHRI, DIGITAL & KREATIF untuk pembayaran Analisis AI"
          onError={() => setQrisError(true)}
        />
      )}
      <p className="pay-amount">
        Bayar tepat <strong>{formatRupiah(amountForCode(pendingCode))}</strong>
        <span>
          Nominal sudah termasuk kode unik <strong>{pendingCode}</strong> di dua
          digit terakhir — kode unik membantu admin mencocokkan pembayaranmu di
          riwayat merchant, jadi jangan dibulatkan.
        </span>
      </p>
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
          aria-label="Kode token dari admin"
        />
        <button
          className="btn btn-primary"
          type="button"
          onClick={handleRedeemCode}
          disabled={redeemLocked || redeemBusy || !redeemInput.trim()}
        >
          {redeemBusy ? 'Memeriksa…' : 'Tukarkan Kode'}
        </button>
      </div>
      {redeemMsg && (
        <p className={redeemMsg.ok ? 'pay-note redeem-ok' : 'pay-note redeem-err'} role="status">
          {redeemMsg.text}
        </p>
      )}
      {redeemLocked && (
        <p className="pay-note">
          Terlalu banyak percobaan kode yang gagal. Muat ulang halaman ini untuk
          mencoba lagi.
        </p>
      )}
      <p className="pay-note">
        Token diterbitkan oleh admin setelah pembayaranmu terverifikasi dari
        bukti yang kamu kirim — situs tidak dapat memeriksa pembayaran QRIS
        secara otomatis. Satu kode berlaku untuk 1 token (1 kali Analisis AI).
      </p>
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
      <p className="pay-intro">
        Analisis AI berbayar <strong>{formatRupiah(AI_PRICE)} per analisis</strong> —
        analisis standar (skor dan saran perbaikan di atas) tetap gratis.
        Bayar otomatis lewat <strong>QRIS</strong> (semua e-wallet &amp; m-banking),
        GoPay, atau ShopeePay melalui <strong>Midtrans</strong>. Token bertambah
        hanya setelah pembayaranmu <strong>terverifikasi otomatis oleh
        Midtrans</strong> — tidak perlu konfirmasi manual.
      </p>
      {autoMode === 'sandbox' && (
        <p className="pay-note">
          Mode uji Midtrans (Sandbox): transaksi ini simulasi dan tidak
          memakai uang sungguhan.
        </p>
      )}
      <div className="pay-actions">
        <button
          className="btn btn-primary"
          type="button"
          onClick={handleAutoPay}
          disabled={autoBusy}
        >
          {autoBusy ? 'Memproses…' : 'Bayar Otomatis via QRIS'}
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

  return (
    <div className="page">
      {/* ===== HERO ===== */}
      <header className="hero">
        <div className="hero-inner">
          <span className="badge"><Icon d={I.zap} size={14} /> Penilaian CV Bahasa Indonesia</span>
          <h1>Screening CV</h1>
          <p className="hero-sub">
            Masukkan CV-mu, dapatkan skor 0–100 dari 6 aspek dan 23 pemeriksaan,
            lengkap dengan bagian mana saja yang harus diperbaiki. Bila kamu
            menempel deskripsi lowongan, kecocokan CV-mu dengan lowongan itu
            ikut menjadi aspek penilaian tersendiri. Analisis standar
            berjalan 100% di browser — file CV tidak diunggah ke server mana pun.
            Ada juga Analisis AI opsional (berbayar) untuk saran penulisan ulang.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#analisis"><Icon d={I.chart} size={18} /> Mulai Analisis</a>
            <button className="btn btn-ghost" type="button" onClick={handleSample}>
              <Icon d={I.file} size={18} /> Coba CV Contoh
            </button>
          </div>
          <div className="hero-stats">
            <div><strong>100</strong><span>total poin</span></div>
            <div><strong>6+1</strong><span>aspek dinilai</span></div>
            <div><strong>23</strong><span>pemeriksaan</span></div>
          </div>
        </div>
      </header>

      {/* ===== CARA KERJA ===== */}
      <section className="steps">
        <div className="step-card">
          <span className="step-num">1</span>
          <Icon d={I.upload} size={22} />
          <h3>Masukkan CV</h3>
          <p>Upload PDF, DOCX, atau TXT — atau tempel teks CV langsung di form.</p>
        </div>
        <div className="step-card">
          <span className="step-num">2</span>
          <Icon d={I.target} size={22} />
          <h3>Isi posisi &amp; lowongan</h3>
          <p>Opsional: posisi target dan deskripsi lowongan — relevansi dan kecocokannya kini ikut dinilai dalam skor.</p>
        </div>
        <div className="step-card">
          <span className="step-num">3</span>
          <Icon d={I.list} size={22} />
          <h3>Lihat hasil &amp; perbaiki</h3>
          <p>Skor per aspek, kekuatan, dan prioritas perbaikan yang terurut.</p>
        </div>
      </section>

      {/* ===== LAYOUT UTAMA ===== */}
      <main className="layout" id="analisis">
        {/* ----- FORM ----- */}
        <section className="card form-card">
          <h2><Icon d={I.file} size={20} /> Data CV</h2>

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
            <p><strong>Tarik &amp; letakkan file CV di sini</strong><br />atau klik untuk memilih file (PDF, DOCX, TXT)</p>
            {fileName && <span className="file-name">{fileName}</span>}
            {loadingFile && <span className="file-name">Membaca file…</span>}
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
            <span>Teks CV</span>
            <textarea
              value={cvText}
              onChange={(e) => setCvText(e.target.value)}
              placeholder={'Tempel teks CV di sini, atau upload file di atas.\n\nContoh format kontak yang terbaca:\nemail@contoh.com | +62 812-3456-7890 | linkedin.com/in/namamu | github.com/namamu'}
              rows={12}
            />
            <small className="counter">{cvText.length} karakter • {countWords(cvText)} kata</small>
          </label>

          <label className="field">
            <span>Posisi yang dilamar (opsional)</span>
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="Mis. Data Analyst"
            />
          </label>

          <label className="field">
            <span>Deskripsi lowongan (opsional)</span>
            <textarea
              value={jobDesc}
              onChange={(e) => setJobDesc(e.target.value)}
              placeholder="Tempel deskripsi lowongan untuk mengecek kecocokan kata kunci dengan CV-mu."
              rows={5}
            />
          </label>

          {error && <div className="alert alert-error"><Icon d={I.alert} size={16} /> {error}</div>}

          <div className="form-actions">
            <button className="btn btn-primary" type="button" onClick={handleAnalyze}>
              <Icon d={I.search} size={18} /> Analisis CV
            </button>
            <button className="btn btn-secondary" type="button" onClick={handleSample}>
              Coba CV Contoh
            </button>
            <button className="btn btn-plain" type="button" onClick={handleReset}>
              <Icon d={I.refresh} size={16} /> Reset
            </button>
          </div>
        </section>

        {/* ----- HASIL ----- */}
        <section className="result-col" ref={resultRef}>
          {!result ? (
            <div className="card empty-card">
              <span className="badge badge-soft">Contoh hasil — ilustrasi</span>
              <div className="empty-flex">
                <ScoreRing score={78} size={130} />
                <div>
                  <h3>Seperti ini tampilan hasilmu nanti</h3>
                  <p>
                    Skor keseluruhan, label kesiapan, rincian per aspek, daftar kekuatan,
                    prioritas perbaikan, dan cek kata kunci lowongan. Isi form di samping
                    lalu klik <strong>Analisis CV</strong>.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="card result-card">
                <div className="result-top">
                  <ScoreRing score={result.total} />
                  <div className="result-summary">
                    <span className="badge badge-soft">Hasil analisis</span>
                    <h2>{result.label}</h2>
                    <p>
                      CV berisi {result.wordCount} kata. Skor dihitung dari bukti isi yang
                      benar-benar ada — bagian yang kosong poinnya 0.
                    </p>
                  </div>
                </div>

                <div className="bars">
                  {result.aspects.map((a) => (
                    <div className="bar-row" key={a.name}>
                      <span className="bar-label">{a.name}</span>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{ width: `${Math.round((a.score / a.max) * 100)}%` }}
                        />
                      </div>
                      <span className="bar-score">{a.score}/{a.max}</span>
                    </div>
                  ))}
                </div>

                {result.roleWarning && (
                  <div className="alert alert-warn"><Icon d={I.alert} size={16} /> {result.roleWarning}</div>
                )}
              </div>

              {history.length > 0 && (
                <div className="card history-card">
                  <h3><Icon d={I.clock} size={18} /> Riwayat Skor</h3>

                  {prevEntry && (() => {
                    const d = scoreDelta(prevEntry.total, result.total)
                    const currEntry = entryFromResult(result, targetRole)
                    const changed = aspectDeltas(prevEntry, currEntry)
                      .filter((a) => a.delta !== null && a.delta !== 0)
                    const compositionChanged = compositionDiffers(prevEntry, currEntry)
                    return (
                      <div className="compare-box">
                        <p className="compare-main">
                          <span className={`delta-badge delta-${d.direction}`}>
                            <Icon
                              d={d.direction === 'naik' ? I.trendUp : d.direction === 'turun' ? I.trendDown : I.minus}
                              size={15}
                            />
                            {d.word}
                          </span>
                          <span>
                            Cek terakhir ({formatHistoryDate(prevEntry.at)}):{' '}
                            <strong>{prevEntry.total}</strong> → Sekarang:{' '}
                            <strong>{result.total}</strong> ({d.text})
                          </span>
                        </p>
                        {changed.length > 0 ? (
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
                          <p className="aspect-deltas-note">Semua aspek sama seperti cek terakhir.</p>
                        )}
                        {compositionChanged && (
                          <p className="aspect-deltas-note">
                            Catatan: komposisi aspek berbeda dari cek terakhir (misalnya
                            dengan/tanpa aspek Kecocokan dengan Lowongan atau posisi target),
                            jadi selisih per aspek di atas hanya perkiraan — perbandingan
                            total skor tetap berlaku.
                          </p>
                        )}
                      </div>
                    )
                  })()}

                  <ul className="history-list">
                    {history.slice(0, 5).map((e, i) => (
                      <li className="history-row" key={`${e.at}-${i}`}>
                        <span className="history-date">{formatHistoryDate(e.at)}</span>
                        <span className="history-score">{e.total}/100</span>
                        <span className="history-label">{e.label}</span>
                        {e.role && <span className="history-role">{e.role}</span>}
                      </li>
                    ))}
                  </ul>

                  <p className="history-note">
                    Riwayat hanya menyimpan skor dan tanggal — tanpa teks CV — di
                    perangkat ini saja (localStorage), tidak dikirim ke server.
                  </p>
                  <button className="btn btn-plain history-clear" type="button" onClick={handleClearHistory}>
                    <Icon d={I.trash} size={15} /> Hapus riwayat
                  </button>
                </div>
              )}

              {result.strengths.length > 0 && (
                <div className="card">
                  <h3><Icon d={I.check} size={18} /> Kekuatan</h3>
                  <ul className="check-list">
                    {result.strengths.map((c) => <CheckRow key={c.id} check={c} />)}
                  </ul>
                </div>
              )}

              <div className="card">
                <h3><Icon d={I.alert} size={18} /> Prioritas Perbaikan</h3>
                {result.priorities.length === 0 ? (
                  <p>Semua pemeriksaan lolos dengan poin penuh. CV-mu sudah kuat — tinggal sesuaikan kata kunci untuk tiap lowongan.</p>
                ) : (
                  <ul className="check-list">
                    {result.priorities.map((c) => <PriorityRow key={c.id} check={c} />)}
                  </ul>
                )}
              </div>

              {/* ----- TEMPLATE RINGKASAN & DAFTAR SKILL (Fase 2) ----- */}
              <div className="card">
                <h3><Icon d={I.book} size={18} /> Template Ringkasan &amp; Daftar Skill</h3>

                <h4 className="subhead">Template Ringkasan</h4>
                <p>
                  Salin template ini, lalu ganti semua bagian dalam [kurung siku]
                  dengan datamu sendiri.
                </p>
                <div className="template-box">{buildSummaryTemplate(targetRole)}</div>
                <button className="btn btn-secondary" type="button" onClick={handleCopyTemplate}>
                  <Icon d={I.copy} size={16} /> {copiedTemplate ? 'Template tersalin!' : 'Salin Template'}
                </button>

                {(() => {
                  const roleSkills = getRoleSkills(targetRole)
                  const skillStatus = checkSkills(cvText, roleSkills.skills)
                  const presentCount = skillStatus.filter((s) => s.present).length
                  return (
                    <>
                      <h4 className="subhead">Daftar Skill — {roleSkills.label}</h4>
                      <p>
                        {presentCount} dari {skillStatus.length} skill yang umum dicari untuk
                        peran ini sudah terbaca di CV-mu. Ini saran umum — hanya centang yang
                        benar-benar kamu kuasai; jangan mencantumkan skill yang tidak kamu miliki.
                      </p>
                      <ul className="skill-list">
                        {skillStatus.map((s) => (
                          <li key={s.skill} className={s.present ? 'skill-present' : 'skill-missing'}>
                            <span className="skill-icon">
                              {s.present ? <Icon d={I.check} size={13} /> : <Icon d={I.minus} size={13} />}
                            </span>
                            <span className="skill-name">{s.skill}</span>
                            <span className="skill-state">{s.present ? 'Sudah ada di CV' : 'Belum ada'}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="ai-note">
                        Pencocokan dilakukan sederhana dari teks CV — skill yang kamu tulis
                        dengan nama lain bisa saja tidak tertangkap di daftar ini.
                      </p>
                    </>
                  )
                })()}
              </div>

              {result.keywords && (
                <div className="card">
                  <h3><Icon d={I.target} size={18} /> Kecocokan Kata Kunci Lowongan</h3>
                  {result.jobMatchApplied ? (
                    <p>
                      <strong>{result.keywords.percent}%</strong> dari {result.keywords.total} kata kunci
                      teratas lowongan ditemukan di CV-mu. Karena kamu mengisi deskripsi lowongan,
                      kecocokan ini <strong>masuk skor utama</strong> sebagai aspek
                      “Kecocokan dengan Lowongan” (20 poin) — aspek lain diskalakan proporsional
                      agar total tetap 100. Skor ini khusus untuk lowongan ini dan akan berubah
                      bila lowongannya berganti.
                    </p>
                  ) : (
                    <p>
                      Deskripsi lowongan yang kamu tempel tidak menghasilkan kata kunci yang
                      bisa dicek, jadi kecocokan lowongan <strong>tidak memengaruhi skor</strong> kali ini.
                      Tempel deskripsi lowongan yang lengkap agar aspek Kecocokan dengan Lowongan bisa dinilai.
                    </p>
                  )}
                  <div className="chips-group">
                    <span className="chips-title">Sudah ada:</span>
                    <div className="chips">
                      {result.keywords.found.length
                        ? result.keywords.found.map((k) => <span key={k} className="chip chip-ok">{k}</span>)
                        : <span className="chip">—</span>}
                    </div>
                  </div>
                  <div className="chips-group">
                    <span className="chips-title">Belum ada:</span>
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
                <h3><Icon d={I.spark} size={18} /> Analisis AI (OpenRouter)</h3>
                <p>
                  Mau saran yang lebih dalam dari skor di atas? AI lewat OpenRouter bisa membaca
                  CV-mu secara kualitatif: menulis ulang poin pengalamanmu, menunjukkan
                  kekurangan terhadap lowongan, dan memberi contoh ringkasan profil.
                  Bagian ini terpisah dan <strong>tidak mengubah skor utama</strong>.
                  Analisis AI berbayar <strong>{formatRupiah(AI_PRICE)} per analisis</strong> lewat
                  QRIS — analisis standar di atas tetap gratis.
                </p>

                {aiCredits > 0 ? (
                  <>
                    <div className="credit-row">
                      <span className="credit-badge">Token AI: {aiCredits} analisis</span>
                      <button
                        className="btn btn-plain credit-buy"
                        type="button"
                        onClick={() => setPayOpen((o) => !o)}
                      >
                        {payOpen ? 'Tutup pembelian' : 'Beli token lagi'}
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
                        Saya setuju teks CV dikirim ke OpenRouter untuk dianalisis.
                        Teks tidak disimpan oleh Screening CV.
                      </span>
                    </label>

                    <div className="ai-actions">
                      <button
                        className="btn btn-primary"
                        type="button"
                        onClick={handleAiAnalyze}
                        disabled={!aiConsent || aiLoading || cvText.trim().length < 50}
                      >
                        <Icon d={I.spark} size={16} />
                        {aiLoading ? 'Menganalisis dengan AI…' : aiResult ? 'Analisis Ulang dengan AI' : 'Analisis dengan AI'}
                      </button>
                      {cvText.trim().length < 50 && (
                        <span className="ai-hint">Teks CV minimal 50 karakter untuk analisis AI.</span>
                      )}
                    </div>
                  </>
                ) : (
                  activePaySection
                )}

                {/* Unduh laporan dari kartu AI — satu-satunya tombol
                    laporan (keputusan pengguna 2026-11-21): berkas PDF
                    sungguhan langsung terunduh, bukan dialog cetak.
                    Laporan mencakup bagian Analisis AI bila sudah ada. */}
                <div className="report-actions ai-report-actions">
                  <button className="btn btn-secondary" type="button" onClick={handleDownloadPdf}>
                    <Icon d={I.download} size={16} /> Unduh Laporan (PDF)
                  </button>
                  <span className="ai-hint">
                    Laporan langsung terunduh sebagai berkas PDF — mencakup skor standar
                    dan, bila sudah dijalankan, hasil Analisis AI.
                  </span>
                </div>

                {(aiLoading || aiThinking) && (
                  <div className="thinking-panel">
                    {aiLoading ? (
                      <>
                        <div className="thinking-head">
                          <span>Proses berpikir AI</span>
                          <span className="thinking-time">{aiElapsed} detik</span>
                        </div>
                        <div className="thinking-body" ref={thinkingBodyRef}>
                          {aiThinking || 'Menghubungi model AI…'}
                        </div>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="thinking-summary"
                          onClick={() => setAiThinkingOpen((o) => !o)}
                        >
                          {aiError
                            ? `Proses berpikir terhenti (±${aiDuration ?? aiElapsed} detik) — klik untuk ${aiThinkingOpen ? 'menutup' : 'melihat'}`
                            : `Proses berpikir selesai (±${aiDuration ?? aiElapsed} detik) — klik untuk ${aiThinkingOpen ? 'menutup' : 'melihat'}`}
                        </button>
                        {aiThinkingOpen && (
                          <div className="thinking-body thinking-body-bordered" ref={thinkingBodyRef}>
                            {aiThinking}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {aiError && <div className="alert alert-error"><Icon d={I.alert} size={16} /> {aiError}</div>}

                {aiResult && (
                  <div className="ai-result">
                    {aiResult.ringkasan && (
                      <div className="ai-block">
                        <h4>Ringkasan Penilaian AI</h4>
                        <p>{aiResult.ringkasan}</p>
                      </div>
                    )}

                    {aiResult.saranPenulisanUlang.length > 0 && (
                      <div className="ai-block">
                        <h4>Saran Penulisan Ulang</h4>
                        <ul className="rewrite-list">
                          {aiResult.saranPenulisanUlang.map((r, i) => (
                            <li className="rewrite-item" key={i}>
                              <span className="rewrite-label">Asli</span>
                              <p className="rewrite-asli">{r.asli}</p>
                              <span className="rewrite-label">Saran</span>
                              <p className="rewrite-saran">{r.saran}</p>
                              {r.alasan && <p className="rewrite-alasan">{r.alasan}</p>}
                            </li>
                          ))}
                        </ul>
                        <p className="ai-note">
                          Saran di atas adalah contoh — sesuaikan angka dan fakta dengan
                          pengalaman aslimu. Jangan memakai angka yang tidak benar.
                        </p>
                      </div>
                    )}

                    {aiResult.kekurangan.length > 0 && (
                      <div className="ai-block">
                        <h4>Kekurangan Menurut AI</h4>
                        <ul className="ai-list">
                          {aiResult.kekurangan.map((k, i) => <li key={i}>{k}</li>)}
                        </ul>
                      </div>
                    )}

                    {aiResult.saranRingkasan && (
                      <div className="ai-block">
                        <h4>Contoh Ringkasan Profil</h4>
                        <p className="ai-summary">{aiResult.saranRingkasan}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ----- TRANSPARANSI ----- */}
          <div className="card">
            <h3><Icon d={I.book} size={18} /> Bagaimana skor dihitung?</h3>
            <p>
              Penilaian berbasis aturan (rule-based) dengan total <strong>100 poin</strong> dari
              <strong> 6 aspek</strong> dan <strong>23 pemeriksaan</strong>, ditambah pemeriksaan
              kondisional bila kamu mengisi posisi target, dan satu aspek kondisional bila kamu
              menempel deskripsi lowongan. Poin hanya diberikan
              untuk bukti isi yang benar-benar ada di CV:
            </p>
            <ul className="rules-list">
              <li><strong>Kontak — 20 poin:</strong> email valid (7), nomor HP Indonesia (6), LinkedIn (4), link portofolio (2), dan lokasi domisili (1) — perekrut menyaring kandidat berdasarkan domisili, jadi kota yang tertera di area kontak ikut dinilai. Format HP 08xx, +62, maupun bertanda kurung dengan spasi/strip/titik tetap terbaca.</li>
              <li><strong>Ringkasan — 10 poin:</strong> dinilai dari panjang isi ringkasan; 40 kata atau lebih = poin penuh. Bila kamu mengisi posisi target, sebagian poin (3) dialihkan untuk menilai relevansi ringkasan: apakah ringkasanmu menyebut posisi/bidang yang dituju.</li>
              <li><strong>Pengalaman — 28 poin:</strong> bagian pengalaman (5), variasi kata kerja aksi (5), angka pencapaian seperti persen/jumlah/nominal (6) — tahun dan nomor HP tidak dihitung sebagai pencapaian — kedalaman entri (4: setiap entri dinilai kelengkapannya: jabatan + perusahaan + periode + uraian isi), frasa lemah &amp; klise (3: frasa generik tanpa bukti seperti "pekerja keras" atau "bertanggung jawab atas" menurunkan poin), linimasa pengalaman (3: kesenjangan panjang antar-entri tanpa penjelasan dan peran terakhir yang sudah lama berakhir menurunkan poin), dan proyek/magang/organisasi sebagai bukti pengalaman (2: proyek yang diuraikan isinya dihitung sebagai pengalaman — terutama penting bagi fresh graduate; bila pengalaman formal sudah ada, pemeriksaan ini netral). Bila posisi target diisi, 3 poin dialihkan untuk relevansi pengalaman: apakah jabatan dan isi pengalamanmu berkaitan dengan bidang yang dituju.</li>
              <li><strong>Pendidikan — 12 poin:</strong> pendidikan tercantum (6), IPK/GPA (3), dan sertifikasi &amp; pelatihan sebagai bagian tersendiri (3).</li>
              <li><strong>Keahlian — 10 poin:</strong> daftar skill (8; 8 item atau lebih = poin penuh) dan bahasa asing beserta tingkat kemahirannya (2).</li>
              <li><strong>Format &amp; ATS — 20 poin:</strong> panjang ideal 220–900 kata (8), tahun/periode tercantum (4), struktur bullet (3), konsistensi format &amp; urutan (3: satu format periode untuk semua entri, entri pengalaman diurutkan dari yang terbaru), dan kerapian bahasa (2: kata ganti "saya" yang berlebihan di poin pengalaman dan kata yang sering salah eja dari daftar periksa dasar).</li>
              <li><strong>Kecocokan dengan Lowongan — 20 poin (kondisional):</strong> hanya muncul bila kamu menempel deskripsi lowongan. Dinilai dari berapa banyak kata kunci teratas lowongan yang ditemukan di CV-mu. Bila aspek ini aktif, keenam aspek di atas diskalakan proporsional (×0,8) sehingga total tetap 100 — dan skormu berarti "kualitas CV + kecocokannya dengan lowongan ini". Tanpa deskripsi lowongan, komposisi skor persis seperti daftar di atas.</li>
            </ul>
            <p>
              Label skor: 85+ Sangat Siap Dilamar • 70–84 Sudah Bagus • 50–69 Perlu Perbaikan •
              di bawah 50 Perlu Dirombak Dulu. Standar penilaian dinaikkan lewat
              aspek yang dinilai, bukan lewat menaikkan kuota angka: 2026-11-19 ditambah
              kedalaman entri, frasa klise, sertifikasi, bahasa asing, konsistensi format,
              kerapian bahasa, dan relevansi ringkasan; 2026-11-21 ditambah lokasi domisili,
              linimasa pengalaman, proyek/magang sebagai bukti pengalaman, relevansi
              pengalaman terhadap posisi target, dan kecocokan kata kunci lowongan yang
              kini masuk skor.
            </p>
          </div>

          {/* ----- TIPS ATS ----- */}
          <div className="card">
            <h3><Icon d={I.list} size={18} /> Tips lolos ATS</h3>
            <ol className="tips-list">
              {ATS_TIPS.map((tip) => <li key={tip}>{tip}</li>)}
            </ol>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>
          Penilaian standar berbasis aturan (rule-based) dan berjalan sepenuhnya di
          browser kamu — bukan keputusan rekruter, dan tidak ada data yang diunggah
          atau disimpan. Satu-satunya pengecualian: fitur Analisis AI (opsional,
          berbayar) mengirim teks CV ke OpenRouter hanya bila kamu mencentang
          persetujuan, dan teks itu tidak disimpan oleh Screening CV.
        </p>
        <p className="footer-links">
          <a href="/privacy.html">Kebijakan Privasi</a>
          <span aria-hidden="true"> • </span>
          <a href="/terms.html">Syarat &amp; Ketentuan</a>
        </p>
      </footer>
    </div>
  )
}
