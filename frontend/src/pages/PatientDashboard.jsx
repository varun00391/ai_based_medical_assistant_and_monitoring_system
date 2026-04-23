import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import MarkdownContent from '../components/MarkdownContent'
import VoiceAssistantDeepgram from '../components/VoiceAssistantDeepgram'
import { useAuth } from '../context/AuthContext'

export default function PatientDashboard() {
  const { logout, user } = useAuth()
  const [tab, setTab] = useState('dashboard')
  /** Doctor whose slots are shown in the booking modal */
  const [slotModalDoctor, setSlotModalDoctor] = useState(null)
  /** Remount Book visit panel after a booking so “Your bookings” refreshes */
  const [appointmentsPanelKey, setAppointmentsPanelKey] = useState(0)

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-violet-950 via-fuchsia-900 to-cyan-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(168,85,247,0.35),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(34,211,238,0.22),transparent_50%)]" />

      <div className="relative mx-auto grid w-full max-w-7xl gap-6 p-4 pb-16 md:grid-cols-[270px_1fr] md:p-8">
        <aside className="h-fit rounded-3xl border border-white/15 bg-white/10 p-5 shadow-xl shadow-violet-950/40 backdrop-blur-xl">
          <div className="mb-6 border-b border-white/10 pb-5">
            <p className="text-[10px] uppercase tracking-[0.35em] text-cyan-300">Care hub</p>
            <h1 className="mt-2 bg-gradient-to-r from-white to-violet-200 bg-clip-text text-xl font-bold text-transparent">
              Hello, {user?.full_name?.split(' ')[0] || 'there'}
            </h1>
            <p className="mt-1 truncate text-xs text-white/65">{user?.email}</p>
          </div>
          <nav className="space-y-1.5">
            {[
              ['dashboard', 'Overview'],
              ['chat', 'AI chat'],
              ['voice-assistant', 'Voice assistant'],
              ['vitals', 'Vitals & devices'],
              ['reports', 'Reports & uploads'],
              ['appointments', 'Book visit'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                  tab === id
                    ? 'bg-gradient-to-r from-violet-500/45 to-fuchsia-500/35 text-white shadow-lg shadow-violet-900/30 ring-1 ring-white/25'
                    : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
          <button
            type="button"
            onClick={logout}
            className="mt-8 w-full rounded-2xl border border-white/20 bg-white/5 py-3 text-sm font-medium text-white/85 transition hover:bg-white/15"
          >
            Sign out
          </button>
        </aside>

        <main className="min-h-[calc(100vh-4rem)] rounded-3xl border border-white/15 bg-white/[0.07] p-5 shadow-2xl shadow-black/25 backdrop-blur-xl md:p-8">
          <header className="mb-8">
            <h2 className="bg-gradient-to-r from-white via-violet-100 to-cyan-100 bg-clip-text text-3xl font-bold capitalize tracking-tight text-transparent">
              {tab.replace('-', ' ')}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/65">
              {tab === 'dashboard' && 'Stay on top of appointments, vitals, and documents in one vivid snapshot.'}
              {tab === 'chat' && 'Explain how you feel — responses support you without replacing your clinician.'}
              {tab === 'voice-assistant' &&
                'Deepgram Voice Agent: talk through your concern, get self-care and test ideas before you see a doctor.'}
              {tab === 'vitals' && 'Connect health apps and devices, then monitor the latest heart rate and oxygen trends.'}
              {tab === 'reports' && 'Upload lab or imaging text exports for structured markdown analysis and PDF export.'}
              {tab === 'appointments' && 'Filter by specialty, tap a doctor to see available slots.'}
            </p>
          </header>

          {tab === 'dashboard' && <DashboardPanel />}
          {tab === 'chat' && <ChatPanel />}
          {tab === 'voice-assistant' && <VoiceAssistantDeepgram />}
          {tab === 'vitals' && <VitalsPanel />}
          {tab === 'reports' && <ReportsPanel />}
          {tab === 'appointments' && (
            <AppointmentsPanel
              key={appointmentsPanelKey}
              tab={tab}
              onPickDoctor={(d) => setSlotModalDoctor(d)}
            />
          )}
        </main>
      </div>

      {slotModalDoctor && (
        <DoctorSlotsModal
          doctor={slotModalDoctor}
          onClose={() => setSlotModalDoctor(null)}
          onBooked={() => {
            setSlotModalDoctor(null)
            setAppointmentsPanelKey((k) => k + 1)
          }}
        />
      )}
    </div>
  )
}

function downloadBlob(url, token, filename) {
  return fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
    .then((res) => {
      if (!res.ok) throw new Error('Download failed')
      return res.blob()
    })
    .then((blob) => {
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      a.download = filename
      a.click()
      URL.revokeObjectURL(href)
    })
}

function DashboardPanel() {
  const [latestVitals, setLatestVitals] = useState([])
  const [appointments, setAppointments] = useState([])
  const [reports, setReports] = useState([])

  useEffect(() => {
    async function load() {
      const [vitalsRes, appsRes, reportsRes] = await Promise.allSettled([
        api.get('/vitals/latest'),
        api.get('/appointments/mine'),
        api.get('/reports/'),
      ])
      if (vitalsRes.status === 'fulfilled') setLatestVitals(vitalsRes.value.data || [])
      if (appsRes.status === 'fulfilled') setAppointments(appsRes.value.data || [])
      if (reportsRes.status === 'fulfilled') setReports(reportsRes.value.data || [])
    }
    load()
  }, [])

  const currentVital = latestVitals[0]

  function statusBadge(status) {
    const s = (status || '').toLowerCase()
    const cls =
      s === 'confirmed'
        ? 'bg-emerald-400/25 text-emerald-100 ring-emerald-400/35'
        : s === 'pending'
          ? 'bg-amber-400/20 text-amber-50 ring-amber-300/30'
          : s === 'cancelled'
            ? 'bg-rose-500/20 text-rose-50 ring-rose-400/35'
            : 'bg-white/15 text-white ring-white/25'
    return (
      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ${cls}`}>
        {status || 'scheduled'}
      </span>
    )
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Heart rate" value={currentVital?.pulse_bpm ? `${Math.round(currentVital.pulse_bpm)} bpm` : '—'} accent="from-rose-400 to-orange-400" />
        <MetricCard label="SpO₂" value={currentVital?.spo2_percent ? `${currentVital.spo2_percent}%` : '—'} accent="from-cyan-400 to-blue-500" />
        <MetricCard label="Tracked vitals" value={`${latestVitals.length}`} accent="from-violet-400 to-fuchsia-500" />
      </div>

      <section className="rounded-2xl border border-white/15 bg-gradient-to-br from-violet-500/15 via-fuchsia-500/10 to-cyan-500/15 p-4 shadow-inner shadow-black/20">
        <div className="mb-3.5 flex flex-wrap items-end justify-between gap-2.5">
          <div>
            <h3 className="text-base font-bold text-white">Your appointments</h3>
            <p className="text-xs text-white/60">Doctor, specialty, timing, and notes.</p>
          </div>
          <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-white ring-1 ring-white/25">
            {appointments.length} booked
          </span>
        </div>
        {appointments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/25 bg-white/5 px-4 py-7 text-center">
            <p className="text-white/65">No appointments yet.</p>
            <p className="mt-1 text-xs text-white/45">Book under “Book visit” when you&apos;re ready.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {appointments.map((a) => (
              <article
                key={a.id}
                className="rounded-xl border border-white/15 bg-white/[0.08] p-3.5 shadow-lg transition hover:border-cyan-400/35 hover:shadow-cyan-900/20"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{a.doctor?.full_name || 'Doctor'}</p>
                    <p className="mt-0.5 text-xs text-violet-200">{a.doctor?.specialty}</p>
                  </div>
                  {statusBadge(a.status)}
                </div>
                <div className="mt-2.5 rounded-lg bg-black/25 px-3 py-2 text-xs text-white/85">
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    <span>
                      <span className="text-[10px] uppercase tracking-wider text-white/45">Starts</span>
                      <br />
                      {a.slot?.start_time ? new Date(a.slot.start_time).toLocaleString() : '—'}
                    </span>
                    <span>
                      <span className="text-[10px] uppercase tracking-wider text-white/45">Ends</span>
                      <br />
                      {a.slot?.end_time ? new Date(a.slot.end_time).toLocaleString() : '—'}
                    </span>
                  </div>
                  {a.patient_notes ? (
                    <p className="mt-2 border-t border-white/10 pt-2 text-[11px] italic text-white/65">
                      Your note: {a.patient_notes}
                    </p>
                  ) : null}
                  {a.doctor?.consultation_fee != null && (
                    <p className="mt-1.5 text-[11px] text-cyan-200/90">Estimated fee · {a.doctor.consultation_fee}</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlowCard title="Recent vitals">
          <ul className="space-y-2">
            {latestVitals.slice(0, 5).map((v) => (
              <li key={v.id} className="rounded-lg bg-black/25 px-3 py-2 text-xs text-white/85">
                <span className="text-[11px] text-white/45">{new Date(v.recorded_at).toLocaleString()}</span>
                <span className="mt-1 block">
                  Pulse <strong className="text-white">{v.pulse_bpm ?? '—'}</strong> · SpO₂{' '}
                  <strong className="text-white">{v.spo2_percent ?? '—'}%</strong>
                  {v.source ? <span className="text-white/45"> ({v.source})</span> : null}
                </span>
              </li>
            ))}
            {!latestVitals.length && <li className="rounded-lg px-3 py-5 text-center text-xs text-white/45">No readings yet.</li>}
          </ul>
        </GlowCard>
        <GlowCard title="Generated intake reports">
          <ul className="space-y-2">
            {reports.slice(0, 5).map((r) => (
              <li key={r.id} className="rounded-lg bg-black/25 px-3 py-2 text-xs text-white/85">
                #{r.id} · {r.title}
              </li>
            ))}
            {!reports.length && (
              <li className="rounded-lg px-3 py-5 text-center text-xs text-white/45">Use chat flows to generate structured summaries.</li>
            )}
          </ul>
        </GlowCard>
      </div>
    </div>
  )
}

function GlowCard({ title, children }) {
  return (
    <section className="rounded-2xl border border-white/15 bg-white/[0.06] p-4 shadow-inner">
      <h3 className="mb-3 text-sm font-semibold text-white">{title}</h3>
      {children}
    </section>
  )
}

function MetricCard({ label, value, accent }) {
  return (
    <article className="rounded-2xl border border-white/15 bg-white/[0.06] p-3.5 shadow-lg">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">{label}</p>
      <p className={`mt-2 bg-gradient-to-r bg-clip-text text-2xl font-bold text-transparent ${accent}`}>{value}</p>
    </article>
  )
}

function ChatPanel() {
  const [sessions, setSessions] = useState([])
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [reportBusy, setReportBusy] = useState(false)
  const [openSessionMenuId, setOpenSessionMenuId] = useState(null)

  async function refreshSessions() {
    const { data } = await api.get('/chat/sessions')
    setSessions(data)
    if (!sessionId && data[0]) setSessionId(data[0].id)
  }

  async function loadMessages(sid) {
    const { data } = await api.get(`/chat/sessions/${sid}/messages`)
    setMessages(data)
  }

  useEffect(() => {
    refreshSessions()
  }, [])

  useEffect(() => {
    if (sessionId) loadMessages(sessionId)
  }, [sessionId])

  async function newSession() {
    const { data } = await api.post('/chat/sessions')
    await refreshSessions()
    setSessionId(data.id)
  }

  async function deleteSession(targetSessionId) {
    if (!targetSessionId) return
    await api.delete(`/chat/sessions/${targetSessionId}`)
    const nextSessions = sessions.filter((s) => s.id !== targetSessionId)
    setSessions(nextSessions)
    if (sessionId === targetSessionId) {
      setMessages([])
      setSessionId(nextSessions[0]?.id || null)
    }
  }

  async function downloadChatReport() {
    if (!sessionId) return
    setReportBusy(true)
    try {
      const { data } = await api.post('/reports/generate', { session_id: sessionId })
      const reportId = data?.id
      if (!reportId) throw new Error('Report id missing')
      const base = import.meta.env.VITE_API_URL || '/api'
      const token = localStorage.getItem('token')
      await downloadBlob(`${base}/reports/${reportId}/pdf`, token, `chat_report_${sessionId}.pdf`)
    } finally {
      setReportBusy(false)
    }
  }

  async function send() {
    if (!input.trim()) return
    setLoading(true)
    try {
      const { data } = await api.post('/chat/message', { content: input, session_id: sessionId })
      setMessages(data.messages)
      setSessionId(data.session_id)
      await refreshSessions()
      setInput('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[260px_1fr]">
      <div className="space-y-4">
        <div className="rounded-3xl border border-white/15 bg-white/[0.06] p-4">
          <button
            type="button"
            onClick={newSession}
            className="mb-3 w-full rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/40"
          >
            New conversation
          </button>
          <ul className="max-h-[320px] space-y-1 overflow-y-auto text-xs">
            {sessions.map((s) => (
              <li key={s.id} className="relative">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSessionId(s.id)}
                    className={`flex-1 truncate rounded-xl px-3 py-2.5 text-left transition ${
                      sessionId === s.id ? 'bg-white/15 text-white ring-1 ring-white/25' : 'text-white/65 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    #{s.id} · {s.title || 'Untitled'}
                  </button>
                  <button
                    type="button"
                    aria-label="Conversation actions"
                    onClick={() => setOpenSessionMenuId((prev) => (prev === s.id ? null : s.id))}
                    className="rounded-lg px-2 py-2 text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    ⋯
                  </button>
                </div>
                {openSessionMenuId === s.id && (
                  <div className="absolute right-0 z-10 mt-1 w-28 rounded-lg border border-white/15 bg-slate-900/95 p-1 shadow-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenSessionMenuId(null)
                        deleteSession(s.id)
                      }}
                      className="w-full rounded-md px-2 py-1.5 text-left text-[11px] font-semibold text-rose-200 hover:bg-rose-500/20"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-end">
          <button
            type="button"
            disabled={!sessionId || reportBusy}
            onClick={downloadChatReport}
            className="rounded-xl border border-cyan-300/35 bg-cyan-500/20 px-4 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-50"
          >
            {reportBusy ? 'Preparing report…' : 'Download chat report'}
          </button>
        </div>
        <div className="flex min-h-[560px] flex-col rounded-3xl border border-white/15 bg-black/20 shadow-inner">
        <div className="max-h-[520px] flex-1 space-y-4 overflow-y-auto p-5">
          {messages.map((m) => (
            <div key={m.id} className={m.role === 'user' ? 'text-right' : 'text-left'}>
              <div
                className={`inline-block max-w-[92%] rounded-3xl px-5 py-3 text-sm shadow-lg ${
                  m.role === 'user'
                    ? 'border border-white/15 bg-gradient-to-br from-violet-500/40 to-fuchsia-600/35 text-white'
                    : 'border border-white/10 bg-white/[0.08] text-white/95'
                }`}
              >
                {m.role === 'assistant' ? <MarkdownContent>{m.content}</MarkdownContent> : <p className="whitespace-pre-wrap">{m.content}</p>}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3 border-t border-white/10 p-4">
          <input
            className="flex-1 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            placeholder="Describe symptoms or ask anything…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
          />
          <button
            type="button"
            disabled={loading}
            onClick={send}
            className="rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 disabled:opacity-45"
          >
            Send
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}

function VoiceAgentCard({ onVoiceQuery }) {
  const [status, setStatus] = useState('Idle')
  const [assistantOn, setAssistantOn] = useState(false)
  const [lastTranscript, setLastTranscript] = useState('')
  const [lastReply, setLastReply] = useState('')
  const [lastAudioUrl, setLastAudioUrl] = useState('')
  const recognitionRef = useRef(null)
  const activeRef = useRef(false)
  const transcriptRef = useRef('')
  const audioRef = useRef(null)

  function splitForTts(text, maxLen = 320) {
    const compact = (text || '').replace(/\s+/g, ' ').trim()
    if (!compact) return []
    const parts = compact.split(/(?<=[.!?])\s+/)
    const out = []
    let buf = ''
    for (const p of parts) {
      if (!buf) {
        buf = p
      } else if ((buf + ' ' + p).length <= maxLen) {
        buf += ` ${p}`
      } else {
        out.push(buf)
        buf = p
      }
    }
    if (buf) out.push(buf)
    return out
  }

  function toSpeechFriendlyText(text) {
    const raw = (text || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_#>-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!raw) return ''
    const sentences = raw.split(/(?<=[.!?])\s+/).filter(Boolean)
    return sentences.slice(0, 2).join(' ')
  }

  function getRecognitionCtor() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null
  }

  function stopAssistant() {
    activeRef.current = false
    setAssistantOn(false)
    setStatus('Stopped')
    try {
      recognitionRef.current?.abort()
    } catch (e) {
      setStatus((prev) => prev || e?.message || 'Stopped')
    }
    try {
      audioRef.current?.pause()
    } catch (e) {
      setStatus((prev) => prev || e?.message || 'Stopped')
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel()
  }

  useEffect(() => {
    return () => {
      if (lastAudioUrl) URL.revokeObjectURL(lastAudioUrl)
    }
  }, [lastAudioUrl])

  async function speakText(text) {
    const spoken = toSpeechFriendlyText(text)
    if (!spoken) return
    const chunks = splitForTts(spoken)
    if (!chunks.length) return

    if (audioRef.current) {
      try {
        audioRef.current.pause()
      } catch (e) {
        setStatus((prev) => prev || e?.message || 'Audio pause failed')
      }
    }

    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i]
      let played = false
      const attempts = [chunk, chunk.slice(0, Math.min(chunk.length, 220))]
      for (const attempt of attempts) {
        if (!attempt.trim()) continue
        try {
          const res = await api.post('/voice/tts', { text: attempt }, { responseType: 'arraybuffer' })
          const audioBlob = new Blob([res.data], { type: 'audio/mpeg' })
          const audioUrl = URL.createObjectURL(audioBlob)
          if (lastAudioUrl) URL.revokeObjectURL(lastAudioUrl)
          setLastAudioUrl(audioUrl)
          const player = new Audio(audioUrl)
          player.volume = 1
          player.muted = false
          audioRef.current = player
          await new Promise((resolve) => {
            player.onended = () => {
              resolve()
            }
            player.onerror = () => {
              resolve()
            }
            player.play().catch(() => {
              resolve()
            })
          })
          if (player.paused) throw new Error('Autoplay blocked. Tap Test voice once.')
          played = true
          break
        } catch (e) {
          setStatus(e?.message || 'TTS playback issue, retrying…')
          // Retry with shorter text.
        }
      }
      if (!played) {
        // Last-resort fallback so user always hears a reply.
        if (window.speechSynthesis) {
          setStatus('Deepgram unavailable, using fallback device voice.')
          await new Promise((resolve) => {
            window.speechSynthesis.cancel()
            const utter = new SpeechSynthesisUtterance(chunk)
            utter.rate = 1.02
            utter.pitch = 1
            utter.volume = 1
            utter.onend = () => resolve()
            utter.onerror = () => resolve()
            window.speechSynthesis.speak(utter)
          })
          played = true
        }
        if (!played) {
          setStatus('Audio playback failed. Please check browser sound/mic permissions.')
          return
        }
      }
      if (!activeRef.current) return
      if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, 80))
    }
  }

  function listenOnce() {
    const SpeechCtor = getRecognitionCtor()
    if (!SpeechCtor) {
      setStatus('Speech recognition unsupported in this browser.')
      stopAssistant()
      return
    }
    const rec = new SpeechCtor()
    recognitionRef.current = rec
    transcriptRef.current = ''
    rec.lang = 'en-US'
    rec.continuous = false
    rec.interimResults = true

    rec.onstart = () => {
      if (activeRef.current) setStatus('Listening…')
    }
    rec.onresult = (event) => {
      let partial = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const res = event.results[i]
        const text = res[0]?.transcript || ''
        if (res.isFinal) transcriptRef.current += `${text} `
        else partial += text
      }
      const preview = (transcriptRef.current + partial).trim()
      if (preview) {
        setLastTranscript(preview)
        setStatus('Heard: processing...')
      }
    }
    rec.onerror = () => {
      if (activeRef.current) setStatus('Mic issue. Retrying...')
    }
    rec.onend = async () => {
      if (!activeRef.current) return
      const transcript = transcriptRef.current.trim()
      if (!transcript) {
        setStatus('Did not catch that. Listening again...')
        setTimeout(() => {
          if (activeRef.current) listenOnce()
        }, 250)
        return
      }
      try {
        setStatus('Thinking…')
        const reply = (await onVoiceQuery?.(transcript)) || ''
        setLastReply(reply)
        setStatus('Speaking…')
        await speakText(reply)
      } catch (e) {
        setStatus(e.response?.data?.detail || e.message || 'Voice turn failed.')
      }
      if (activeRef.current) {
        setStatus('Listening…')
        setTimeout(() => {
          if (activeRef.current) listenOnce()
        }, 180)
      }
    }
    rec.start()
  }

  function startAssistant() {
    activeRef.current = true
    setAssistantOn(true)
    setStatus('Starting…')
    listenOnce()
  }

  function testVoice() {
    speakText('Voice check. If you hear this, assistant audio is working.')
  }

  return (
    <div className="rounded-3xl border border-white/15 bg-gradient-to-br from-cyan-500/15 to-violet-600/20 p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-cyan-200">Realtime voice assistant</p>
      <div className="flex flex-wrap gap-2">
        {!assistantOn ? (
          <button
            type="button"
            onClick={startAssistant}
            className="rounded-xl bg-cyan-500/35 px-4 py-2 text-xs font-semibold text-white ring-1 ring-white/25"
          >
            Start assistant
          </button>
        ) : (
          <button
            type="button"
            onClick={stopAssistant}
            className="rounded-xl bg-white/15 px-4 py-2 text-xs font-semibold text-white ring-1 ring-white/25"
          >
            Stop assistant
          </button>
        )}
        <button
          type="button"
          onClick={testVoice}
          className="rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold text-white"
        >
          Test voice
        </button>
      </div>
      {lastTranscript ? <p className="mt-3 text-xs text-white/70">You: {lastTranscript}</p> : null}
      {lastReply ? <p className="mt-1 line-clamp-3 text-xs text-cyan-100/90">Assistant: {lastReply}</p> : null}
      {lastAudioUrl ? (
        <audio
          controls
          src={lastAudioUrl}
          className="mt-3 w-full"
          onPlay={() => setStatus('Playing reply…')}
          onError={() => setStatus('Could not play audio in browser.')}
        />
      ) : null}
      <p className="mt-3 text-xs text-amber-100/90">{status}</p>
    </div>
  )
}

function VitalsPanel() {
  const [latestVitals, setLatestVitals] = useState([])
  const [source, setSource] = useState('manual')

  const providerOptions = [
    { id: 'google_fit', label: 'Google Fit', description: 'Sync heart rate and oxygen from connected Android wearables.' },
    { id: 'apple_health', label: 'Apple Health', description: 'Pull Apple Watch metrics via HealthKit integration.' },
    { id: 'fitbit', label: 'Fitbit', description: 'Import Fitbit resting heart rate and SpO₂ trends.' },
    { id: 'samsung_health', label: 'Samsung Health', description: 'Connect Galaxy health records and measurements.' },
    { id: 'garmin', label: 'Garmin Connect', description: 'Bring advanced pulse and training vital summaries.' },
    { id: 'manual', label: 'Manual entry', description: 'Record from any pulse oximeter when app sync is unavailable.' },
  ]

  useEffect(() => {
    let cancelled = false
    async function loadVitals() {
      const { data } = await api.get('/vitals/latest')
      if (!cancelled) setLatestVitals(data || [])
    }
    loadVitals().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/15 bg-gradient-to-br from-cyan-500/15 via-violet-600/12 to-fuchsia-500/20 p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white">Connect a vitals source</h3>
            <p className="mt-1 text-sm text-white/65">Choose your device ecosystem to sync pulse and oxygen metrics.</p>
          </div>
          <span className="rounded-full border border-cyan-300/40 bg-cyan-400/15 px-4 py-1.5 text-xs font-semibold text-cyan-100">
            Beta integrations
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {providerOptions.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSource(p.id)}
              className={`rounded-2xl border p-4 text-left transition ${
                source === p.id
                  ? 'border-cyan-300/50 bg-cyan-400/15 ring-1 ring-cyan-300/35'
                  : 'border-white/15 bg-white/[0.06] hover:border-white/30 hover:bg-white/[0.1]'
              }`}
            >
              <p className="font-semibold text-white">{p.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/60">{p.description}</p>
            </button>
          ))}
        </div>
        <div className="mt-5 rounded-2xl border border-white/15 bg-black/25 px-4 py-3 text-sm text-white/75">
          Selected source: <span className="font-semibold text-cyan-200">{providerOptions.find((p) => p.id === source)?.label}</span>
          <span className="text-white/50"> — device OAuth pairing hook can be connected here.</span>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Heart rate" value={latestVitals[0]?.pulse_bpm ? `${Math.round(latestVitals[0].pulse_bpm)} bpm` : '—'} accent="from-rose-400 to-orange-400" />
        <MetricCard label="SpO₂" value={latestVitals[0]?.spo2_percent ? `${latestVitals[0].spo2_percent}%` : '—'} accent="from-cyan-400 to-blue-500" />
        <MetricCard label="Tracked vitals" value={`${latestVitals.length}`} accent="from-violet-400 to-fuchsia-500" />
      </div>

      <GlowCard title="Recent synchronized vitals">
        <ul className="space-y-2">
          {latestVitals.slice(0, 8).map((v) => (
            <li key={v.id} className="rounded-xl bg-black/25 px-4 py-3 text-sm text-white/85">
              <span className="text-xs text-white/45">{new Date(v.recorded_at).toLocaleString()}</span>
              <span className="mt-1 block">
                Pulse <strong className="text-white">{v.pulse_bpm ?? '—'}</strong> · SpO₂{' '}
                <strong className="text-white">{v.spo2_percent ?? '—'}%</strong>
                {v.source ? <span className="text-white/45"> ({v.source})</span> : null}
              </span>
            </li>
          ))}
          {!latestVitals.length && <li className="rounded-xl px-4 py-6 text-center text-sm text-white/45">No vitals available yet. Connect a provider above.</li>}
        </ul>
      </GlowCard>
    </div>
  )
}

function ReportsPanel() {
  const [uploading, setUploading] = useState(false)
  const [analysisMd, setAnalysisMd] = useState('')
  const [labResultId, setLabResultId] = useState(null)
  const [filename, setFilename] = useState('')
  const [history, setHistory] = useState([])

  async function loadHistory() {
    const { data } = await api.get('/labs/results')
    setHistory(data || [])
  }

  useEffect(() => {
    loadHistory()
  }, [])

  async function uploadAndAnalyze(file) {
    if (!file) return
    setUploading(true)
    setAnalysisMd('')
    setLabResultId(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await api.post('/reports/analyze-upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setAnalysisMd(data.analysis_markdown || '')
      setLabResultId(data.lab_result_id)
      setFilename(data.original_filename || file.name)
      await loadHistory()
    } finally {
      setUploading(false)
    }
  }

  function downloadAnalysisPdf(id) {
    const base = import.meta.env.VITE_API_URL || '/api'
    const token = localStorage.getItem('token')
    return downloadBlob(`${base}/labs/${id}/pdf`, token, `analysis_${id}.pdf`)
  }

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-dashed border-cyan-400/35 bg-gradient-to-br from-cyan-500/10 via-transparent to-violet-600/15 p-8">
        <h3 className="text-lg font-bold text-white">Analyze a report file</h3>
        <p className="mt-2 max-w-2xl text-sm text-white/65">
          Upload <strong className="text-white">PDF</strong> (selectable text),{' '}
          <strong className="text-white">.txt</strong>, or similar exports. Long reports are read in full: text is extracted
          from every page (PDF), then analyzed section-by-section and merged into one coherent summary — plus a downloadable PDF.
        </p>
        <label className="mt-6 inline-flex cursor-pointer items-center gap-3 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-600 px-8 py-4 text-sm font-semibold text-white shadow-xl shadow-violet-900/40 transition hover:brightness-110">
          {uploading ? 'Analyzing with AI…' : 'Choose file'}
          <input
            type="file"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              uploadAndAnalyze(file)
              e.target.value = ''
            }}
          />
        </label>
      </section>

      {analysisMd ? (
        <section className="rounded-3xl border border-white/15 bg-black/25 p-8 shadow-inner">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-white/45">Latest analysis</p>
              <p className="font-medium text-white">{filename}</p>
            </div>
            {labResultId ? (
              <button
                type="button"
                onClick={() => downloadAnalysisPdf(labResultId)}
                className="rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg"
              >
                Download PDF
              </button>
            ) : null}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <MarkdownContent>{analysisMd}</MarkdownContent>
          </div>
        </section>
      ) : null}

      <section>
        <h3 className="mb-4 text-lg font-bold text-white">Past uploads</h3>
        <div className="space-y-4">
          {history.map((row) => (
            <article key={row.id} className="rounded-2xl border border-white/15 bg-white/[0.06] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-white">{row.original_filename}</p>
                  <p className="text-xs text-white/45">{new Date(row.uploaded_at).toLocaleString()}</p>
                </div>
                {row.has_pdf ? (
                  <button
                    type="button"
                    onClick={() => downloadAnalysisPdf(row.id)}
                    className="rounded-xl border border-amber-300/40 bg-amber-400/15 px-4 py-2 text-xs font-semibold text-amber-100"
                  >
                    PDF
                  </button>
                ) : (
                  <span className="text-xs text-white/40">No PDF (older upload)</span>
                )}
              </div>
              {row.analysis_text ? (
                <details className="mt-4 group">
                  <summary className="cursor-pointer text-sm font-medium text-violet-200 hover:text-white">Show analysis</summary>
                  <div className="mt-4 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-4">
                    <MarkdownContent className="!text-sm">{row.analysis_text}</MarkdownContent>
                  </div>
                </details>
              ) : null}
            </article>
          ))}
          {!history.length && <p className="rounded-2xl border border-white/10 bg-white/[0.04] py-12 text-center text-sm text-white/45">No uploads yet.</p>}
        </div>
      </section>
    </div>
  )
}

function AppointmentsPanel({ tab, onPickDoctor }) {
  const [specialties, setSpecialties] = useState([])
  const [specialtyFilter, setSpecialtyFilter] = useState('')
  const [doctors, setDoctors] = useState([])
  const [mine, setMine] = useState([])

  async function loadSpecialties() {
    const { data } = await api.get('/appointments/specialties')
    setSpecialties(data || [])
  }

  async function loadDoctors(spec) {
    const config = {}
    if (spec) config.params = { specialty: spec }
    const { data } = await api.get('/appointments/doctors', config)
    setDoctors(data || [])
  }

  async function loadMine() {
    const { data } = await api.get('/appointments/mine')
    setMine(data || [])
  }

  useEffect(() => {
    if (tab !== 'appointments') return
    loadSpecialties()
    loadMine()
  }, [tab])

  useEffect(() => {
    if (tab !== 'appointments') return
    loadDoctors(specialtyFilter || undefined)
  }, [tab, specialtyFilter])

  return (
    <div className="grid gap-10 xl:grid-cols-2">
      <div>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/55">Choose a specialist</h2>
          <div className="flex flex-col gap-1">
            <label htmlFor="spec" className="text-[10px] uppercase tracking-wider text-white/45">
              Specialty
            </label>
            <select
              id="spec"
              value={specialtyFilter}
              onChange={(e) => setSpecialtyFilter(e.target.value)}
              className="min-w-[220px] rounded-xl border border-white/20 bg-black/40 px-4 py-2.5 text-sm text-white focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            >
              <option value="">All specialties</option>
              {specialties.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <ul className="space-y-3">
          {doctors.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => onPickDoctor?.(d)}
                className="w-full rounded-xl border border-white/15 bg-white/[0.06] p-3.5 text-left transition hover:border-violet-400/50 hover:bg-white/[0.1]"
              >
                <p className="text-sm font-semibold text-white">{d.full_name}</p>
                <p className="text-xs text-violet-200">{d.specialty}</p>
                <p className="mt-1.5 line-clamp-2 text-[11px] text-white/55">{d.bio || '—'}</p>
                <p className="mt-1.5 text-[11px] font-medium text-cyan-200">Fee · {d.consultation_fee ?? 'N/A'}</p>
                <span className="mt-2 inline-block text-[11px] font-semibold text-fuchsia-200">Open slots →</span>
              </button>
            </li>
          ))}
          {!doctors.length && (
            <li className="rounded-2xl border border-white/10 bg-white/[0.04] py-10 text-center text-sm text-white/45">
              No doctors match this specialty.
            </li>
          )}
        </ul>
      </div>
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-white/55">Your bookings</h2>
        <ul className="space-y-3">
          {mine.map((a) => (
            <li key={a.id} className="rounded-xl border border-white/15 bg-white/[0.06] p-3">
              <p className="text-sm font-semibold text-white">{a.doctor?.full_name}</p>
              <p className="text-[11px] text-violet-200">{a.doctor?.specialty}</p>
              <p className="mt-1.5 text-xs text-white/75">
                {a.slot?.start_time ? new Date(a.slot.start_time).toLocaleString() : '—'} →{' '}
                {a.slot?.end_time ? new Date(a.slot.end_time).toLocaleTimeString() : '—'}
              </p>
              <p className="mt-1 text-[11px] capitalize text-white/55">{a.status}</p>
              <AppointmentDoctorTabs appointment={a} />
            </li>
          ))}
          {!mine.length && <li className="text-sm text-white/45">Nothing scheduled.</li>}
        </ul>
      </div>
    </div>
  )
}

function AppointmentDoctorTabs({ appointment }) {
  const [active, setActive] = useState('doctor')

  const tabs = [
    ['doctor', 'Doctor'],
    ['schedule', 'Schedule'],
    ['notes', 'Notes'],
  ]

  return (
    <div className="mt-2.5 rounded-xl border border-white/10 bg-black/25 p-2.5">
      <div className="mb-2 flex flex-wrap gap-1">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActive(id)}
            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition ${
              active === id ? 'bg-violet-400/35 text-white ring-1 ring-white/20' : 'bg-white/8 text-white/65 hover:bg-white/15 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {active === 'doctor' && (
        <div className="text-[11px] text-white/75">
          <p>Specialty: <span className="text-violet-200">{appointment.doctor?.specialty || '—'}</span></p>
          <p className="mt-1">Fee: <span className="text-cyan-200">{appointment.doctor?.consultation_fee ?? 'N/A'}</span></p>
        </div>
      )}
      {active === 'schedule' && (
        <div className="text-[11px] text-white/75">
          <p>Start: {appointment.slot?.start_time ? new Date(appointment.slot.start_time).toLocaleString() : '—'}</p>
          <p className="mt-1">End: {appointment.slot?.end_time ? new Date(appointment.slot.end_time).toLocaleString() : '—'}</p>
          <p className="mt-1 capitalize">Status: {appointment.status || 'scheduled'}</p>
        </div>
      )}
      {active === 'notes' && (
        <p className="text-[11px] text-white/75">
          {appointment.patient_notes ? `Your note: ${appointment.patient_notes}` : 'No patient note added for this booking.'}
        </p>
      )}
    </div>
  )
}

function DoctorSlotsModal({ doctor, onClose, onBooked }) {
  const [slots, setSlots] = useState([])
  const [booking, setBooking] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data } = await api.get(`/appointments/doctors/${doctor.id}/slots`)
        if (!cancelled) setSlots(data || [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [doctor.id])

  async function book(slotId) {
    setBooking(true)
    try {
      await api.post('/appointments/book', { slot_id: slotId })
      const { data } = await api.get(`/appointments/doctors/${doctor.id}/slots`)
      setSlots(data || [])
      onBooked?.()
    } finally {
      setBooking(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="slot-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-md"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-[101] max-h-[85vh] w-full max-w-lg overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-b from-violet-950/95 to-slate-950/98 shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-6 py-4">
          <div>
            <h3 id="slot-modal-title" className="text-lg font-bold text-white">
              {doctor.full_name}
            </h3>
            <p className="text-sm text-violet-300">{doctor.specialty}</p>
            <p className="mt-2 text-xs text-white/55 line-clamp-3">{doctor.bio || ''}</p>
            <p className="mt-2 text-xs font-medium text-cyan-200">Fee · {doctor.consultation_fee ?? 'N/A'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl border border-white/20 px-3 py-1.5 text-sm text-white/85 hover:bg-white/10"
          >
            Close
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5" style={{ maxHeight: 'min(60vh, 420px)' }}>
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-white/45">Available slots</p>
          {loading ? (
            <p className="py-8 text-center text-sm text-white/55">Loading slots…</p>
          ) : (
            <ul className="space-y-3">
              {slots.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/35 px-4 py-3"
                >
                  <span className="text-sm text-white">
                    {new Date(s.start_time).toLocaleString()} → {new Date(s.end_time).toLocaleTimeString()}
                  </span>
                  <button
                    type="button"
                    disabled={booking}
                    onClick={() => book(s.id)}
                    className="rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-4 py-2 text-xs font-semibold text-slate-900 shadow-lg disabled:opacity-45"
                  >
                    Reserve
                  </button>
                </li>
              ))}
              {!slots.length && <li className="py-6 text-center text-sm text-white/45">No open slots right now.</li>}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
