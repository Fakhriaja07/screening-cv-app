import { useEffect, useRef, useState } from 'react'
import './App.css'
import { analyzeCv, countWords, type AnalysisResult, type CheckItem } from './lib/analyze'
import { requestAiAnalysis, requestAiAnalysisStreaming, type AiAnalysis } from './lib/ai'
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
  refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  target: 'M12 12h.01M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zM12 6a6 6 0 1 0 6 6 6 6 0 0 0-6-6z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  spark: 'M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z',
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
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [loadingFile, setLoadingFile] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [copied, setCopied] = useState(false)
  const [aiConsent, setAiConsent] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<AiAnalysis | null>(null)
  const [aiError, setAiError] = useState('')
  const [aiThinking, setAiThinking] = useState('')
  const [aiThinkingOpen, setAiThinkingOpen] = useState(false)
  const [aiElapsed, setAiElapsed] = useState(0)
  const [aiDuration, setAiDuration] = useState<number | null>(null)
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
    setResult(analyzeCv(cvText, { targetRole, jobDesc }))
    requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
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
    setFileName('')
    setError('')
    setCopied(false)
    setAiConsent(false)
    setAiResult(null)
    setAiError('')
    setAiThinking('')
    setAiThinkingOpen(false)
    setAiElapsed(0)
    setAiDuration(null)
  }

  async function handleAiAnalyze() {
    if (!aiConsent || aiLoading) return
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
    } catch (streamErr) {
      if (!receivedEvent) {
        // Streaming gagal sebelum event pertama (jaringan/HTTP error):
        // coba sekali mode non-streaming sebagai cadangan.
        try {
          const data = await requestAiAnalysis(input)
          setAiResult(data)
        } catch (fallbackErr) {
          setAiError(
            fallbackErr instanceof Error ? fallbackErr.message : 'Analisis AI gagal. Coba lagi nanti.',
          )
        }
      } else {
        setAiError(streamErr instanceof Error ? streamErr.message : 'Analisis AI gagal. Coba lagi nanti.')
      }
    } finally {
      setAiDuration(Math.max(1, Math.round((Date.now() - aiStartRef.current) / 1000)))
      setAiLoading(false)
    }
  }

  async function handleCopyReport() {
    if (!result) return
    const lines: string[] = [
      `HASIL SCREENING CV`,
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
    ]
    if (result.keywords) {
      lines.push('', `KECOCOKAN KATA KUNCI LOWONGAN: ${result.keywords.percent}%`)
      lines.push(`Ketemu: ${result.keywords.found.join(', ') || '-'}`)
      lines.push(`Belum ada: ${result.keywords.missing.join(', ') || '-'}`)
    }
    if (result.roleWarning) lines.push('', `CATATAN POSISI: ${result.roleWarning}`)
    const text = lines.join('\n')
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
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="page">
      {/* ===== HERO ===== */}
      <header className="hero">
        <div className="hero-inner">
          <span className="badge"><Icon d={I.zap} size={14} /> Penilaian CV Bahasa Indonesia</span>
          <h1>Screening CV</h1>
          <p className="hero-sub">
            Masukkan CV-mu, dapatkan skor 0–100 dari 6 aspek dan 14 pemeriksaan,
            lengkap dengan bagian mana saja yang harus diperbaiki. Analisis standar
            berjalan 100% di browser — file CV tidak diunggah ke server mana pun.
            Ada juga Analisis AI opsional untuk saran penulisan ulang.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#analisis"><Icon d={I.chart} size={18} /> Mulai Analisis</a>
            <button className="btn btn-ghost" type="button" onClick={handleSample}>
              <Icon d={I.file} size={18} /> Coba CV Contoh
            </button>
          </div>
          <div className="hero-stats">
            <div><strong>100</strong><span>total poin</span></div>
            <div><strong>6</strong><span>aspek dinilai</span></div>
            <div><strong>14</strong><span>pemeriksaan</span></div>
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
          <p>Opsional: posisi target dan deskripsi lowongan untuk cek kata kunci.</p>
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
                    <button className="btn btn-secondary" type="button" onClick={handleCopyReport}>
                      <Icon d={I.copy} size={16} /> {copied ? 'Laporan tersalin!' : 'Salin Laporan'}
                    </button>
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
                    {result.priorities.map((c) => <CheckRow key={c.id} check={c} />)}
                  </ul>
                )}
              </div>

              {result.keywords && (
                <div className="card">
                  <h3><Icon d={I.target} size={18} /> Kecocokan Kata Kunci Lowongan</h3>
                  <p>
                    <strong>{result.keywords.percent}%</strong> dari {result.keywords.total} kata kunci
                    teratas lowongan ditemukan di CV-mu. Bagian ini ditampilkan terpisah dan
                    <strong> tidak mengubah skor utama</strong>.
                  </p>
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
                </p>

                <label className="consent-row">
                  <input
                    type="checkbox"
                    checked={aiConsent}
                    onChange={(e) => setAiConsent(e.target.checked)}
                  />
                  <span>
                    Saya setuju teks CV dikirim ke OpenRouter (model Gemma 4 31B) untuk dianalisis.
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
              <strong> 6 aspek</strong> dan <strong>14 pemeriksaan</strong>. Poin hanya diberikan
              untuk bukti isi yang benar-benar ada di CV:
            </p>
            <ul className="rules-list">
              <li><strong>Kontak — 20 poin:</strong> email valid (7), nomor HP Indonesia (6), LinkedIn (4), link portofolio (3). Format HP 08xx, +62, maupun bertanda kurung dengan spasi/strip/titik tetap terbaca.</li>
              <li><strong>Ringkasan — 10 poin:</strong> dinilai dari panjang isi ringkasan; 40 kata atau lebih = poin penuh.</li>
              <li><strong>Pengalaman — 28 poin:</strong> bagian pengalaman (10), variasi kata kerja aksi (8), dan angka pencapaian seperti persen/jumlah/nominal (10) — tahun dan nomor HP tidak dihitung sebagai pencapaian.</li>
              <li><strong>Pendidikan — 12 poin:</strong> pendidikan tercantum (8) dan IPK/GPA (4).</li>
              <li><strong>Keahlian — 10 poin:</strong> dihitung dari jumlah item skill yang tercantum; 8 item atau lebih = poin penuh.</li>
              <li><strong>Format &amp; ATS — 20 poin:</strong> panjang ideal 220–900 kata (10), tahun/periode tercantum (5), struktur bullet (5).</li>
            </ul>
            <p>
              Label skor: 85+ Sangat Siap Dilamar • 70–84 Sudah Bagus • 50–69 Perlu Perbaikan •
              di bawah 50 Perlu Dirombak Dulu. Cek kata kunci lowongan ditampilkan terpisah dan
              tidak mengubah skor utama.
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
          atau disimpan. Satu-satunya pengecualian: fitur Analisis AI (opsional)
          mengirim teks CV ke OpenRouter hanya bila kamu mencentang persetujuan,
          dan teks itu tidak disimpan oleh Screening CV.
        </p>
      </footer>
    </div>
  )
}
