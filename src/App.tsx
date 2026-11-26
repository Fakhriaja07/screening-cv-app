import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { analyzeCv, countWords, type AnalysisResult, type CheckItem } from './lib/analyze'
import {
  addHistoryEntry,
  aspectDeltas,
  clearHistory,
  compositionDiffers,
  entryFromResult,
  formatHistoryDate,
  historyRoleLabel,
  historyRolesMatch,
  loadHistory,
  scoreDelta,
  type ScoreHistoryEntry,
} from './lib/history'
import {
  buildAiFixContext,
  buildAiRoleContext,
  requestAiAnalysis,
  requestAiAnalysisStreaming,
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
} from './lib/examples'
import {
  buildPersonalExamples,
  type PersonalExample,
} from './lib/personalExamples'
import { filterRoleOptions, type RoleOption } from './lib/roleOptions'
import { SAMPLE_CV } from './lib/sampleCv'
import { DEMO_WEAK_CV } from './lib/demoCv'
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
// Bila contoh PERSONAL tersedia untuk pemeriksaan ini (kutipan dari CV
// pengguna sendiri, dari modul personalExamples.ts), contoh generik
// digantikan blok "Contoh dari CV-mu". Bila tidak, contoh generik dari
// examples.ts tampil seperti sebelumnya.
function PriorityRow({
  check,
  personal,
  index,
}: {
  check: CheckItem
  personal?: PersonalExample | null
  index?: number
}) {
  const [open, setOpen] = useState(false)
  const generic = getCheckExample(check.id)
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
            {open &&
              (personal ? (
                <div className="example-box example-box-personal">
                  <span className="example-label">Contoh dari CV-mu:</span>
                  <p className="example-before">
                    <span className="example-tag">Sebelum:</span> {personal.kutipanAsli}
                  </p>
                  <p className="example-after">
                    <span className="example-tag">Sesudah:</span> {personal.versiPerbaikan}
                  </p>
                  <p className="example-note">{personal.catatan}</p>
                </div>
              ) : generic ? (
                <div className="example-box">
                  <span className="example-label">Contoh:</span>
                  <p className="example-before">
                    <span className="example-tag">Sebelum:</span> {generic.sebelum}
                  </p>
                  <p className="example-after">
                    <span className="example-tag">Sesudah:</span> {generic.sesudah}
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

function DemoSection() {
  const delta = DEMO_AFTER.total - DEMO_BEFORE.total
  return (
    <section className="demo-section" id="contoh" aria-label="Contoh hasil analisis">
      <div className="demo-head">
        <span className="badge badge-soft"><Icon d={I.chart} size={14} /> Contoh hasil analisis</span>
        <h2>Lihat Contoh Hasil</h2>
        <p>
          Ini dua CV contoh yang dinilai mesin yang sama persis dengan yang
          akan menilai CV-mu.
        </p>
      </div>
      <div className="demo-grid">
        <div className="card demo-card">
          <div className="demo-card-head">
            <span className="demo-tag demo-tag-before">Sebelum</span>
            <span className="demo-cv-name">CV contoh — seadanya</span>
          </div>
          <div className="demo-score-row">
            <ScoreRing score={DEMO_BEFORE.total} size={108} />
            <div className="demo-score-side">
              <p className="demo-verdict">{DEMO_BEFORE.label}</p>
              <p className="demo-note">3 prioritas perbaikan teratas dari CV ini:</p>
              <ol className="demo-priorities">
                {DEMO_BEFORE.priorities.slice(0, 3).map((c) => (
                  <li key={c.id}>
                    <strong>{c.title}</strong> — {c.score}/{c.max} poin
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
        <div className="demo-arrow" aria-hidden="true">→</div>
        <div className="card demo-card demo-card-after">
          <div className="demo-card-head">
            <span className="demo-tag demo-tag-after">Sesudah</span>
            <span className="demo-cv-name">CV contoh — dengan bukti hasil</span>
          </div>
          <div className="demo-score-row">
            <ScoreRing score={DEMO_AFTER.total} size={108} />
            <div className="demo-score-side">
              <p className="demo-verdict">{DEMO_AFTER.label}</p>
              <p className="demo-delta">
                <Icon d={I.trendUp} size={16} /> Naik {delta} poin dari contoh “Sebelum”
              </p>
              <p className="demo-note">Pemeriksaan yang sama pada CV ini:</p>
              <ol className="demo-priorities demo-priorities-after">
                {DEMO_BEFORE.priorities.slice(0, 3).map((c) => {
                  const a = DEMO_AFTER_BY_ID.get(c.id)
                  return (
                    <li key={c.id}>
                      <strong>{c.title}</strong> — {a ? `${a.score}/${a.max}` : '–'} poin
                    </li>
                  )
                })}
              </ol>
            </div>
          </div>
        </div>
      </div>
      <div className="demo-caption">
        <p>
          Selisihnya datang dari hal yang bisa kamu perbaiki juga: angka hasil
          kerja, kata kerja aksi, skill yang spesifik, dan kontak yang lengkap.
        </p>
        <p className="demo-disclaimer">
          Contoh bawaan situs, skornya dihitung langsung oleh mesin penilaian
          — bukan testimoni pengguna.
        </p>
      </div>
      <div className="demo-cta">
        <a className="btn btn-primary" href="#analisis">
          <Icon d={I.chart} size={18} /> Analisis CV-mu
        </a>
        <span className="ai-hint">Analisis standar gratis — tanpa daftar, dan CV tidak diunggah ke server.</span>
      </div>
    </section>
  )
}

// ---------- Combobox posisi yang dilamar ----------
// Kolom teks bebas dengan dropdown pilihan pekerjaan yang terfilter
// mengikuti ketikan (permintaan pengguna 2026-11-25). Pilihan berasal
// dari lib/roleOptions (turunan kamus skill + glosarium). Memilih
// pilihan memasukkan NAMA LENGKAP pekerjaannya ke kolom; mengetik
// posisi di luar daftar tetap sah dan diteruskan apa adanya — dropdown
// tidak pernah memaksa pilihan. Nilai yang diteruskan ke analisis
// selalu persis string di kolom ini.
function RoleCombobox({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const optionRefs = useRef<(HTMLLIElement | null)[]>([])
  const options = useMemo(() => filterRoleOptions(value), [value])
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

  function choose(opt: RoleOption) {
    onChange(opt.value)
    setOpen(false)
    setHighlight(-1)
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
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        setOpen(false)
        setHighlight(-1)
      }
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
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label="Posisi yang dilamar"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={
          open && highlight >= 0 ? `${listId}-${highlight}` : undefined
        }
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setHighlight(-1)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Ketik atau pilih posisi, mis. Data Analyst"
      />
      <button
        type="button"
        className={`combo-toggle${open ? ' open' : ''}`}
        aria-label="Tampilkan atau sembunyikan pilihan pekerjaan"
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
          aria-label="Pilihan pekerjaan"
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
            <li className="combo-empty">
              Tidak ada pilihan yang cocok — posisi yang kamu ketik tetap
              bisa dipakai apa adanya.
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

export default function App() {
  const [cvText, setCvText] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [jobDesc, setJobDesc] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  // Snapshot teks CV + posisi target PERSIS saat analisis dijalankan —
  // contoh personal di "Lihat contoh" dikutip dari snapshot ini, jadi
  // tetap cocok dengan hasil walau kotak teks diedit sesudahnya. Hanya
  // di memori halaman (state), tidak pernah disimpan ke localStorage.
  const [analyzedText, setAnalyzedText] = useState('')
  const [analyzedRole, setAnalyzedRole] = useState('')
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
  // diedit sesudahnya. Kosong bila analisis dijalankan tanpa posisi.
  const [aiRoleLabel, setAiRoleLabel] = useState('')
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
  // Penanda generasi analisis AI yang sedang berjalan: handleReset
  // menaikkannya, sehingga hasil AI yang tiba SETELAH pengguna menekan
  // reset dibuang (tidak tampil, token tidak terpotong) — audit 2026-11-24.
  const aiRunRef = useRef(0)
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
        setFileText(text)
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
    const res = analyzeCv(cvText, {
      targetRole,
      jobDesc,
      fileName: fileText !== '' && cvText === fileText ? fileName : undefined,
    })
    setResult(res)
    setAnalyzedText(cvText)
    setAnalyzedRole(targetRole)
    setAnalyzedJobDesc(jobDesc)
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
    setFileText('')
    setError('')
  }

  function handleReset() {
    // Batalkan secara logis analisis AI yang mungkin masih berjalan:
    // hasilnya akan dibuang saat tiba (lihat handleAiAnalyze).
    aiRunRef.current += 1
    setCvText('')
    setTargetRole('')
    setJobDesc('')
    setResult(null)
    setAnalyzedText('')
    setAnalyzedRole('')
    setAnalyzedJobDesc('')
    setAnalysisDate(null)
    setFileName('')
    setFileText('')
    setError('')
    setAiConsent(false)
    setAiResult(null)
    setAiRoleLabel('')
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
    // Audit 2026-11-24: bila hasil standar sedang tampil, AI menganalisis
    // SNAPSHOT yang menghasilkan hasil itu (analyzedText/analyzedRole/
    // analyzedJobDesc) — bukan isi kotak teks saat ini yang mungkin sudah
    // diedit pengguna sesudahnya. Tanpa ini, konteks perbaikan (dari hasil
    // tampil) bisa tidak cocok dengan teks yang dikirim ke AI.
    const sourceText = result ? analyzedText : cvText
    const sourceRole = result ? analyzedRole : targetRole
    const sourceJobDesc = result ? analyzedJobDesc : jobDesc
    if (sourceText.trim().length < 50) {
      setAiError('Teks CV terlalu pendek untuk dianalisis AI. Lengkapi dulu teks CV-nya.')
      return
    }
    const runId = ++aiRunRef.current
    const isStale = () => aiRunRef.current !== runId
    setAiLoading(true)
    setAiError('')
    setAiThinking('')
    setAiThinkingOpen(false)
    setAiDuration(null)
    setAiElapsed(0)
    aiStartRef.current = Date.now()
    // Konteks pemeriksaan yang gagal dari hasil standar yang sedang
    // tampil: AI wajib memperbaiki semuanya satu per satu (bagian
    // "Perbaikan Lengkap dari AI"), bukan menebak ulang dari nol.
    const perbaikan = result
      ? buildAiFixContext(result, buildPersonalExamples(result, analyzedText, analyzedRole))
      : []
    // Konteks posisi terstruktur dari snapshot yang sama (teks + posisi
    // saat analisis standar dijalankan): AI menilai dari kacamata
    // posisi itu dengan rujukan skill kamus situs. Null bila posisi
    // kosong — permintaan lama terkirim persis seperti sebelumnya.
    const konteksPosisi = buildAiRoleContext(sourceText, sourceRole)
    const input = {
      cvText: sourceText,
      targetRole: sourceRole,
      jobDesc: sourceJobDesc,
      ...(perbaikan.length ? { perbaikan } : {}),
      ...(konteksPosisi ? { konteksPosisi } : {}),
    }
    let succeeded = false
    try {
      const data = await requestAiAnalysisStreaming(input, {
        onReasoning: (text) => {
          setAiThinking((prev) => {
            if (prev.length >= 8000) return prev
            const next = prev + text
            return next.length > 8000 ? `${next.slice(0, 8000)}…` : next
          })
        },
      })
      // Pengguna menekan reset selagi analisis berjalan → hasil dibuang.
      if (!isStale()) {
        setAiResult(data)
        setAiRoleLabel(konteksPosisi?.posisi ?? '')
        succeeded = true
      }
    } catch (streamErr) {
      // Streaming gagal — sebelum event pertama (jaringan/HTTP error)
      // ATAU di tengah aliran (model kehabisan batas waktu hanya untuk
      // berpikir sebelum JSON selesai): coba sekali mode non-streaming
      // sebagai cadangan. Token tetap hanya terpotong bila salah satu
      // jalur berhasil, jadi cadangan ini tidak merugikan pengguna.
      // Bila pengguna sudah menekan reset, cadangan tidak perlu dijalankan.
      if (!isStale()) {
        try {
          const data = await requestAiAnalysis(input)
          if (!isStale()) {
            setAiResult(data)
            setAiRoleLabel(konteksPosisi?.posisi ?? '')
            succeeded = true
          }
        } catch (fallbackErr) {
          if (!isStale()) {
            setAiError(
              fallbackErr instanceof Error ? fallbackErr.message : 'Analisis AI gagal. Coba lagi nanti.',
            )
          }
        }
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

  // "Unduh Laporan (PDF)": berkas PDF sungguhan dibuat di browser oleh
  // lib/pdf.ts (jsPDF, dimuat dinamis agar bundel awal tetap ringan) lalu
  // langsung terunduh — tanpa dialog cetak. Isinya laporan gabungan:
  // skor standar + bagian Analisis AI bila hasil AI sudah dibuat.
  async function handleDownloadPdf() {
    if (!result) return
    const { buildReportPdf } = await import('./lib/pdf')
    const { blob, fileName } = buildReportPdf(result, {
      ai: aiResult,
      // Posisi pada laporan = posisi saat analisis dijalankan (snapshot),
      // bukan isi kolom posisi yang mungkin sudah diedit sesudahnya.
      targetRole: analyzedRole,
      date: analysisDate ?? new Date(),
    })
    downloadBlob(blob, fileName)
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
        sekali analisis, <strong>bukan langganan</strong>, lebih murah dari sekali
        print + fotokopi CV. Analisis standar (skor dan saran perbaikan di atas)
        tetap gratis. Bayar dengan memindai QRIS berikut dari aplikasi pembayaran
        apa pun (GoPay, OVO, DANA, m-banking, dan lainnya). Pastikan nama merchant
        yang muncul adalah <strong>FAKHRI, DIGITAL &amp; KREATIF</strong>.
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

  // Contoh personal untuk "Lihat contoh": dikutip dari snapshot teks
  // yang dianalisis (analyzedText), bukan dari kotak teks yang mungkin
  // sudah diedit sesudahnya.
  const personalExamples = useMemo(
    () => (result ? buildPersonalExamples(result, analyzedText, analyzedRole) : {}),
    [result, analyzedText, analyzedRole],
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
            <a className="topbar-link" href="#contoh">Contoh Hasil</a>
            <a className="btn btn-primary btn-sm" href="#analisis">Analisis CV</a>
          </nav>
        </div>
      </header>

      {/* ===== HERO ===== */}
      <header className="hero">
        <div className="hero-inner">
          <span className="badge"><Icon d={I.zap} size={14} /> Screening CV · Penilaian CV Bahasa Indonesia</span>
          <h1>CV-mu sudah siap <span className="hero-accent">dikirim?</span></h1>
          <p className="hero-sub">
            Unggah atau tempel CV-mu di sini, lalu lihat skornya: 0–100 dari
            6 aspek lewat 27 pemeriksaan. Kamu juga dapat daftar bagian yang
            perlu diperbaiki, jadi tahu harus mulai dari mana. Ada deskripsi
            lowongannya? Tempel sekalian, kecocokan CV-mu dengan lowongan
            itu ikut dinilai.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#analisis"><Icon d={I.chart} size={18} /> Mulai Analisis</a>
            <button className="btn btn-ghost" type="button" onClick={handleSample}>
              <Icon d={I.file} size={18} /> Coba CV Contoh
            </button>
          </div>
          <p className="hero-note">
            <Icon d={I.check} size={15} />
            <span>
              CV-mu tetap di sini: analisis standar berjalan 100% di browser,
              file-mu tidak diunggah ke server mana pun. Mau dibantu menulis
              ulang? Ada Analisis AI berbayar untuk itu.
            </span>
          </p>
          <div className="hero-stats">
            <div><strong>100</strong><span>total poin</span></div>
            <div><strong>6+1</strong><span>aspek dinilai</span></div>
            <div><strong>27</strong><span>pemeriksaan</span></div>
          </div>
        </div>
      </header>

      {/* ===== CONTOH HASIL ===== */}
      <DemoSection />

      {/* ===== LAYOUT UTAMA ===== */}
      <main className="layout" id="analisis">
        {/* ----- FORM ----- */}
        <section className="card form-card">
          <h2><Icon d={I.file} size={20} /> Data CV</h2>

          <div className="step">
            <div className="step-head">
              <span className="step-num" aria-hidden="true">1</span>
              <h3 className="step-title">Isi CV kamu</h3>
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
            <small className="counter" aria-live="polite">{countWords(cvText)} kata terdeteksi • {cvText.length} karakter</small>
          </label>
          </div>

          <div className="step">
            <div className="step-head">
              <span className="step-num" aria-hidden="true">2</span>
              <h3 className="step-title">Posisi &amp; lowongan</h3>
              <span className="step-chip">Opsional</span>
            </div>

          <div className="field">
            <span>Posisi yang dilamar</span>
            <RoleCombobox value={targetRole} onChange={setTargetRole} />
          </div>

          <label className="field">
            <span>Deskripsi lowongan</span>
            <textarea
              value={jobDesc}
              onChange={(e) => setJobDesc(e.target.value)}
              placeholder="Tempel deskripsi lowongan untuk mengecek kecocokan kata kunci dengan CV-mu."
              rows={5}
            />
          </label>
          </div>

          {error && <div className="alert alert-error"><Icon d={I.alert} size={16} /> {error}</div>}

          <div className="step">
            <div className="step-head">
              <span className="step-num" aria-hidden="true">3</span>
              <h3 className="step-title">Lihat hasil</h3>
            </div>

          <div className="form-actions">
            <button className="btn btn-primary btn-lg" type="button" onClick={handleAnalyze}>
              <Icon d={I.search} size={18} /> Analisis CV
            </button>
            <button className="btn btn-secondary" type="button" onClick={handleSample}>
              Coba CV Contoh
            </button>
            <button className="btn btn-plain" type="button" onClick={handleReset}>
              <Icon d={I.refresh} size={16} /> Reset
            </button>
          </div>
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
                    <h2 className={`verdict-text ${result.total >= 85 ? 't-green' : result.total >= 70 ? 't-sky' : result.total >= 50 ? 't-amber' : 't-red'}`}>{result.label}</h2>
                    <p>
                      CV berisi {result.wordCount} kata. Skor dihitung dari bukti isi yang
                      benar-benar ada — bagian yang kosong poinnya 0.
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
              </div>

              {history.length > 0 && (
                <div className="card history-card">
                  <h3><Icon d={I.clock} size={18} /> Riwayat Skor</h3>

                  {prevEntry && (() => {
                    const d = scoreDelta(prevEntry.total, result.total)
                    const currEntry = entryFromResult(result, analyzedRole)
                    // Spanduk sadar-posisi: selisih skor & delta per aspek
                    // hanya bermakna bila posisi targetnya sama (sesudah
                    // resolusi label). Bila berbeda, kedua posisi disebut
                    // eksplisit agar "turun" antar-posisi tidak terbaca
                    // sebagai CV yang memburuk.
                    const sameRole = historyRolesMatch(prevEntry.role, analyzedRole)
                    const prevRoleLabel = historyRoleLabel(prevEntry.role)
                    const currRoleLabel = historyRoleLabel(analyzedRole)
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
                                Cek terakhir ({formatHistoryDate(prevEntry.at)}):{' '}
                                <strong>{prevEntry.total}</strong> → Sekarang:{' '}
                                <strong>{result.total}</strong> ({d.text})
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="delta-badge delta-tetap">
                                <Icon d={I.minus} size={15} />
                                Beda posisi
                              </span>
                              <span>
                                Cek terakhir ({formatHistoryDate(prevEntry.at)})
                                {prevRoleLabel ? (
                                  <> untuk <strong>{prevRoleLabel}</strong></>
                                ) : (
                                  ' tanpa posisi target'
                                )}
                                : <strong>{prevEntry.total}</strong> → Sekarang
                                {currRoleLabel ? (
                                  <> untuk <strong>{currRoleLabel}</strong></>
                                ) : (
                                  ' tanpa posisi target'
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
                            <p className="aspect-deltas-note">Semua aspek sama seperti cek terakhir.</p>
                          )
                        ) : (
                          <p className="aspect-deltas-note">
                            Posisi targetnya berbeda dari cek terakhir, jadi selisih skor
                            dan perbandingan per aspek tidak ditampilkan — kedua skor
                            dihitung untuk posisi yang berbeda.
                          </p>
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
                        {e.role && <span className="history-role">{historyRoleLabel(e.role)}</span>}
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
                  <>
                    <p className="card-hint">Diurutkan dari yang paling berdampak ke skormu — kerjakan dari nomor 1.</p>
                    <ul className="check-list">
                      {result.priorities.map((c, i) => (
                        <PriorityRow
                          key={c.id}
                          check={c}
                          personal={personalExamples[c.id] ?? null}
                          index={i}
                        />
                      ))}
                    </ul>
                  </>
                )}
              </div>

              {/* ----- TEMPLATE RINGKASAN & DAFTAR SKILL (Fase 2) ----- */}
              <div className="card">
                <h3><Icon d={I.book} size={18} /> Template Ringkasan &amp; Daftar Skill</h3>

                <h4 className="subhead">Template Ringkasan</h4>
                <p>
                  Pakai template ini, lalu ganti semua bagian dalam [kurung siku]
                  dengan datamu sendiri.
                </p>
                <div className="template-box">{buildSummaryTemplate(targetRole)}</div>

                {(() => {
                  const roleSkills = getRoleSkills(targetRole)
                  const skillStatus = checkSkills(cvText, roleSkills.skills)
                  const presentCount = skillStatus.filter((s) => s.present).length
                  return (
                    <>
                      <h4 className="subhead">Daftar Skill — {roleSkills.label}</h4>
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
                <h3><Icon d={I.spark} size={18} /> Analisis AI (OpenRouter) <span className="paid-chip">Berbayar</span></h3>
                <p>
                  Mau saran yang lebih dalam dari skor di atas? AI membaca CV-mu secara
                  kualitatif: menulis ulang poin pengalamanmu, menunjukkan kekurangan
                  terhadap lowongan, dan memberi contoh ringkasan profil. Bila posisi
                  target terisi, pembahasannya disesuaikan untuk posisi itu. Yang
                  terpenting, AI <strong>menuliskan versi perbaikan lengkap untuk semua
                  prioritas perbaikanmu</strong> — dalam bentuk jadi yang siap disalin
                  ke CV, bukan sekadar contoh umum. Bagian ini terpisah dan{' '}
                  <strong>tidak mengubah skor utama</strong>. Dan <strong>token hanya terpakai
                  bila analisis berhasil — kalau AI gagal, tokenmu tidak hangus.</strong>
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
                        className="btn btn-primary btn-lg"
                        type="button"
                        onClick={handleAiAnalyze}
                        disabled={!aiConsent || aiLoading || (result ? analyzedText : cvText).trim().length < 50}
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
                    Tombolnya hanya muncul SETELAH Analisis AI selesai
                    (keputusan pengguna 2026-11-21) karena laporan diunduh
                    untuk menyimpan kalimat hasil AI; sebelum itu tampil
                    petunjuk pengganti di tempat yang sama. */}
                {aiResult ? (
                  <div className="report-actions ai-report-actions">
                    <button className="btn btn-secondary" type="button" onClick={handleDownloadPdf}>
                      <Icon d={I.download} size={16} /> Unduh Laporan (PDF)
                    </button>
                    <span className="ai-hint">
                      Laporan langsung terunduh sebagai berkas PDF — mencakup skor standar
                      dan hasil Analisis AI.
                    </span>
                  </div>
                ) : (
                  <div className="report-actions ai-report-actions">
                    <span className="ai-hint">
                      Tombol unduh laporan akan muncul setelah Analisis AI selesai.
                    </span>
                  </div>
                )}

                {(aiLoading || aiThinking) && (
                  <div className={aiLoading ? 'thinking-panel' : 'thinking-panel thinking-done'}>
                    {aiLoading ? (
                      <>
                        <div className="thinking-head">
                          <span className="thinking-title">
                            <Icon d={I.spark} size={15} />
                            <span>Proses Berpikir AI</span>
                            <span className="thinking-live">
                              <span className="thinking-dot" aria-hidden="true" />
                              Sedang berpikir
                            </span>
                          </span>
                          <span className="thinking-time">{aiElapsed} detik</span>
                        </div>
                        <div className="thinking-body" ref={thinkingBodyRef}>
                          {aiThinking ? (
                            aiThinking
                          ) : (
                            <span className="thinking-wait">Menghubungi model AI…</span>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="thinking-summary"
                          onClick={() => setAiThinkingOpen((o) => !o)}
                          aria-expanded={aiThinkingOpen}
                        >
                          <Icon d={I.spark} size={15} />
                          <span>
                            {aiError
                              ? `Proses berpikir terhenti (±${aiDuration ?? aiElapsed} detik) — klik untuk ${aiThinkingOpen ? 'menutup' : 'melihat'}`
                              : `Proses berpikir selesai (±${aiDuration ?? aiElapsed} detik) — klik untuk ${aiThinkingOpen ? 'menutup' : 'melihat'}`}
                          </span>
                          <span className={aiThinkingOpen ? 'thinking-chev open' : 'thinking-chev'} aria-hidden="true">
                            <Icon d={I.chev} size={16} />
                          </span>
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
                    {aiRoleLabel && (
                      <p className="ai-role-label">
                        Disesuaikan untuk posisi: <strong>{aiRoleLabel}</strong>
                      </p>
                    )}
                    {aiResult.ringkasan && (
                      <div className="ai-block">
                        <h4>Ringkasan Penilaian AI</h4>
                        <p>{aiResult.ringkasan}</p>
                      </div>
                    )}

                    {aiResult.penilaianPosisi && (
                      <div className="ai-block">
                        <h4>Penilaian untuk Posisi{aiRoleLabel ? ` ${aiRoleLabel}` : ''}</h4>
                        <p>{aiResult.penilaianPosisi}</p>
                      </div>
                    )}

                    {aiResult.perbaikanLengkap && aiResult.perbaikanLengkap.length > 0 && (
                      <div className="ai-block">
                        <h4>Perbaikan Lengkap dari AI</h4>
                        <p className="ai-note">
                          Satu versi perbaikan jadi untuk setiap prioritas perbaikanmu —
                          salin ke CV, lalu isi bagian dalam [kurung siku] dengan fakta aslimu.
                        </p>
                        <ul className="rewrite-list">
                          {aiResult.perbaikanLengkap.map((f, i) => (
                            <li className="rewrite-item" key={f.idPemeriksaan || i}>
                              <span className="rewrite-label">{f.judul}</span>
                              {f.sebelum && (
                                <>
                                  <span className="rewrite-label">Sebelum</span>
                                  <p className="rewrite-asli">{f.sebelum}</p>
                                </>
                              )}
                              <span className="rewrite-label">Sesudah</span>
                              <p className="rewrite-saran">{f.sesudah}</p>
                              {f.catatan && <p className="rewrite-alasan">{f.catatan}</p>}
                            </li>
                          ))}
                        </ul>
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
        <p className="footer-links">
          <a href="/artikel/kesalahan-cv-fresh-graduate.html">Artikel: Kesalahan CV Fresh Graduate</a>
        </p>
      </footer>
    </div>
  )
}
