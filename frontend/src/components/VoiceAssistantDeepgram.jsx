import { useCallback, useRef, useState } from 'react'
import MarkdownContent from './MarkdownContent'
import { api } from '../api/client'

function buildVoiceAgentWsUrl() {
  const token = localStorage.getItem('token')
  if (!token) return null
  const v = import.meta.env.VITE_API_URL
  if (v && /^https?:\/\//i.test(v)) {
    const base = v.endsWith('/') ? v : `${v}/`
    const path = /\/api\/?$/i.test(base) ? 'voice-agent/ws' : 'api/voice-agent/ws'
    const u = new URL(path, base)
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
    u.search = `?token=${encodeURIComponent(token)}`
    u.hash = ''
    return u.toString()
  }
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}/api/voice-agent/ws?token=${encodeURIComponent(token)}`
}

function floatTo16BitPCM(float32) {
  const out = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i += 1) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

/** Downsample 48k -> 24k by taking every other sample */
function downsampleTo24k(input) {
  const n = Math.floor(input.length / 2)
  const o = new Float32Array(n)
  for (let i = 0; i < n; i += 1) o[i] = input[i * 2]
  return o
}

function playWavOrPcm(merged) {
  const u8 = merged instanceof Uint8Array ? merged : new Uint8Array(merged)
  if (u8.length < 44) return
  const isRiff = u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46
  const blob = new Blob([u8], { type: isRiff ? 'audio/wav' : 'audio/pcm' })
  return URL.createObjectURL(blob)
}

export default function VoiceAssistantDeepgram() {
  const [status, setStatus] = useState('disconnected')
  const [transcript, setTranscript] = useState([])
  const [err, setErr] = useState(null)
  const [reportStatus, setReportStatus] = useState('')
  const [isReportBusy, setIsReportBusy] = useState(false)
  const wsRef = useRef(null)
  const audioRef = useRef({ ctx: null, proc: null, stream: null, sent: 0 })
  const pcmBufferRef = useRef([])
  const flushTimerRef = useRef(null)
  const playbackQueueRef = useRef([])
  const playbackAudioRef = useRef(null)
  const playbackBusyRef = useRef(false)

  const appendLine = useCallback((role, text) => {
    if (!text?.trim()) return
    setTranscript((prev) => [...prev, { id: `t-${Date.now()}-${Math.random()}`, role, text: text.trim() }])
  }, [])

  const stopAudioCapture = useCallback(() => {
    const a = audioRef.current
    if (a.proc) {
      a.proc.disconnect()
      a.proc.onaudioprocess = null
    }
    if (a.stream) a.stream.getTracks().forEach((t) => t.stop())
    if (a.ctx) a.ctx.close().catch(() => {})
    audioRef.current = { ctx: null, proc: null, stream: null, sent: 0 }
  }, [])

  const stop = useCallback(() => {
    stopAudioCapture()
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }
    if (wsRef.current) {
      try {
        wsRef.current.close()
      } catch {
        // ignore
      }
      wsRef.current = null
    }
    if (playbackAudioRef.current) {
      try {
        playbackAudioRef.current.pause()
      } catch {
        // ignore
      }
      playbackAudioRef.current = null
    }
    playbackQueueRef.current = []
    playbackBusyRef.current = false
    pcmBufferRef.current = []
    setStatus('disconnected')
  }, [stopAudioCapture])

  const generateVoiceReportAndDownload = useCallback(async () => {
    const lines = transcript
      .map((t) => `${t.role === 'user' ? 'Patient' : 'Assistant'}: ${t.text}`)
      .join('\n')
      .trim()
    if (!lines) return
    setIsReportBusy(true)
    setReportStatus('Generating analysis report…')
    try {
      const { data } = await api.post('/reports/generate', {
        conversation_summary: lines,
      })
      const reportId = data?.id
      if (!reportId) {
        setReportStatus('Report generated but download id missing.')
        return
      }
      const pdfRes = await api.get(`/reports/${reportId}/pdf`, { responseType: 'blob' })
      const href = URL.createObjectURL(pdfRes.data)
      const a = document.createElement('a')
      a.href = href
      a.download = `voice_analysis_${reportId}.pdf`
      a.click()
      URL.revokeObjectURL(href)
      setReportStatus(`Analysis downloaded (report #${reportId}).`)
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Could not generate report.'
      setReportStatus(msg)
    } finally {
      setIsReportBusy(false)
    }
  }, [transcript])

  const drainPlaybackQueue = useCallback(() => {
    if (playbackBusyRef.current) return
    const nextUrl = playbackQueueRef.current.shift()
    if (!nextUrl) return
    playbackBusyRef.current = true

    const a = new Audio()
    playbackAudioRef.current = a
    a.src = nextUrl

    const cleanupAndContinue = () => {
      URL.revokeObjectURL(nextUrl)
      if (playbackAudioRef.current === a) playbackAudioRef.current = null
      playbackBusyRef.current = false
      drainPlaybackQueue()
    }

    a.addEventListener('ended', cleanupAndContinue, { once: true })
    a.addEventListener('error', cleanupAndContinue, { once: true })
    a.play().catch(cleanupAndContinue)
  }, [])

  const enqueueAudio = useCallback(
    (merged) => {
      const url = playWavOrPcm(merged)
      if (!url) return
      playbackQueueRef.current.push(url)
      drainPlaybackQueue()
    },
    [drainPlaybackQueue]
  )

  const flushAudioBuffer = useCallback(() => {
    const parts = pcmBufferRef.current
    if (!parts.length) return
    const total = parts.reduce((s, p) => s + p.length, 0)
    const merged = new Uint8Array(total)
    let o = 0
    for (const p of parts) {
      merged.set(p, o)
      o += p.length
    }
    pcmBufferRef.current = []
    enqueueAudio(merged)
  }, [enqueueAudio])

  const start = useCallback(async () => {
    setErr(null)
    setReportStatus('')
    setTranscript([])
    const url = buildVoiceAgentWsUrl()
    if (!url) {
      setErr('Sign in required.')
      return
    }
    const token = localStorage.getItem('token')
    if (!token) {
      setErr('Sign in required.')
      return
    }

    let ws
    try {
      ws = new WebSocket(url)
    } catch (e) {
      setErr(e.message || 'WebSocket failed')
      return
    }
    wsRef.current = ws
    ws.binaryType = 'arraybuffer'
    setStatus('connecting')

    ws.onopen = async () => {
      setStatus('live')
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 })
        const source = ctx.createMediaStreamSource(stream)
        const proc = ctx.createScriptProcessor(4096, 1, 1)
        let sent = 0
        proc.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return
          const ch = e.inputBuffer.getChannelData(0)
          const d24 = downsampleTo24k(ch)
          const pcm = floatTo16BitPCM(d24)
          ws.send(pcm.buffer)
          sent += 1
        }
        const mute = ctx.createGain()
        mute.gain.value = 0
        source.connect(proc)
        proc.connect(mute)
        mute.connect(ctx.destination)
        audioRef.current = { ctx, proc, stream, sent: 0 }
      } catch (e) {
        setErr(e.message || 'Microphone denied')
        stop()
      }
    }

    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        try {
          const data = JSON.parse(ev.data)
          if (data.type === 'Error' && data.code === 'missing_key') {
            setErr(data.description)
            return
          }
          if (data.type === 'ConversationText' && data.content) {
            const role = data.role === 'user' ? 'user' : 'assistant'
            appendLine(role, data.content)
            return
          }
          if (data.type === 'AgentStartedSpeaking') {
            if (playbackAudioRef.current) {
              try {
                playbackAudioRef.current.pause()
              } catch {
                // ignore
              }
              playbackAudioRef.current = null
            }
            playbackQueueRef.current = []
            playbackBusyRef.current = false
            pcmBufferRef.current = []
            return
          }
          if (data.type === 'AgentAudioDone') {
            flushAudioBuffer()
            return
          }
        } catch {
          // ignore
        }
        return
      }
      const u8 = new Uint8Array(ev.data)
      pcmBufferRef.current.push(u8)
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
      // Fallback: play buffered audio shortly after the stream goes idle.
      flushTimerRef.current = setTimeout(() => {
        flushAudioBuffer()
        flushTimerRef.current = null
      }, 500)
    }

    ws.onerror = () => {
      setErr((prev) => prev || 'Voice assistant connection failed.')
    }

    ws.onclose = (ev) => {
      if (wsRef.current === ws) wsRef.current = null
      stopAudioCapture()
      setStatus('disconnected')
      if (ev.code === 4401) {
        setErr('Session expired. Please sign in again.')
      } else if (ev.code === 4403) {
        setErr('Voice assistant is available for patient accounts only.')
      } else if (ev.code === 1006) {
        setErr((prev) => prev || 'Unable to reach voice assistant service. Check backend/proxy URL.')
      }
    }
  }, [appendLine, flushAudioBuffer, stop, stopAudioCapture])

  return (
    <div className="max-w-3xl space-y-5">
      <p className="text-sm leading-relaxed text-white/80">
        Powered by the{' '}
        <a
          className="text-cyan-300 hover:underline"
          href="https://developers.deepgram.com/docs/voice-agent"
          target="_blank"
          rel="noreferrer"
        >
          Deepgram Voice Agent API
        </a>
        : the agent listens, understands your concern, then suggests self-care, types of tests a
        doctor might consider, and when to seek care — before an in-person visit. This does not
        replace a clinician.
      </p>
      {err && <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">{err}</p>}
      <div className="flex flex-wrap gap-2">
        {status === 'disconnected' ? (
          <button
            type="button"
            onClick={start}
            className="rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg"
          >
            Start voice session
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            className="rounded-2xl border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-medium text-white"
          >
            Stop
          </button>
        )}
        <span className="self-center text-xs text-white/55">
        {status === 'connecting' && 'Connecting…'}
        {status === 'live' && 'Microphone on — speak naturally.'}
        </span>
      </div>
      {status === 'disconnected' && transcript.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={isReportBusy}
            onClick={generateVoiceReportAndDownload}
            className="rounded-2xl border border-cyan-300/40 bg-cyan-500/20 px-4 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-50"
          >
            {isReportBusy ? 'Preparing report…' : 'Download analysis report'}
          </button>
          {reportStatus ? <p className="text-xs text-cyan-200/90">{reportStatus}</p> : null}
        </div>
      )}
      <div className="min-h-[220px] space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
        {transcript.length === 0 && <p className="text-white/50">Transcript and guidance appear here as you talk.</p>}
        {transcript.map((t) => (
          <div
            key={t.id}
            className={`rounded-xl px-3 py-2 ${t.role === 'user' ? 'ml-8 border border-cyan-500/20 bg-cyan-500/10' : 'mr-8 border border-violet-500/20 bg-violet-500/10'}`}
          >
            <p className="text-[10px] uppercase text-white/45">{t.role === 'user' ? 'You' : 'Assistant'}</p>
            <div className="prose prose-invert prose-sm mt-1 max-w-none text-white/90">
              <MarkdownContent>{t.text}</MarkdownContent>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
