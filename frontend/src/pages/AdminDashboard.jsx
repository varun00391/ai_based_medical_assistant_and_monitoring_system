import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'

function Icon({ children, className = 'h-5 w-5' }) {
  return (
    <span className={`inline-flex shrink-0 text-current ${className}`} aria-hidden>
      {children}
    </span>
  )
}

function IconUsers() {
  return (
    <Icon>
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
        />
      </svg>
    </Icon>
  )
}

function IconStethoscope() {
  return (
    <Icon>
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.106c.251.023.501.05.75.082M19.8 15.3l-1.57.393a9.065 9.065 0 01-1.982.217m0 0a9.078 9.078 0 01-3.973-.352M19.8 15.3V17m0 0v1.104m0 0v1.104m0 0v1.104"
        />
      </svg>
    </Icon>
  )
}

function IconCalendar() {
  return (
    <Icon>
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5a2.25 2.25 0 012.25 2.25v7.5"
        />
      </svg>
    </Icon>
  )
}

function IconChat() {
  return (
    <Icon>
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091a.75.75 0 01-.75.75h-5.063a.75.75 0 01-.75-.75v-3.092c-.343-.02-.684-.046-1.023-.072A2.233 2.233 0 013 14.894v-4.286c0-.969.616-1.813 1.5-2.097V6.75A2.25 2.25 0 015.25 4.5h13.5A2.25 2.25 0 0120.25 6.75v1.761z"
        />
      </svg>
    </Icon>
  )
}

function IconLab() {
  return (
    <Icon>
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
        />
      </svg>
    </Icon>
  )
}

function IconHeart() {
  return (
    <Icon>
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
        />
      </svg>
    </Icon>
  )
}

function IconSparkles() {
  return (
    <Icon>
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
        />
      </svg>
    </Icon>
  )
}

function IconShield() {
  return (
    <Icon>
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
        />
      </svg>
    </Icon>
  )
}

function IconChart() {
  return (
    <Icon>
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    </Icon>
  )
}

const METRIC_GROUPS = [
  {
    title: 'At a glance',
    subtitle: 'Headline platform usage',
    emphasis: true,
    items: [
      { key: 'patients', label: 'Patients', icon: IconUsers, ring: 'ring-cyan-400/30' },
      { key: 'doctors', label: 'Doctors', icon: IconStethoscope, ring: 'ring-emerald-400/30' },
      { key: 'appointments', label: 'Appointments', icon: IconCalendar, ring: 'ring-violet-400/30' },
      { key: 'chat_sessions', label: 'AI chat sessions', icon: IconChat, ring: 'ring-fuchsia-400/30' },
    ],
  },
  {
    title: 'Accounts & growth',
    subtitle: 'Roles, activation, sign-ups',
    items: [
      { key: 'users', label: 'Total accounts', icon: IconUsers },
      { key: 'active_users', label: 'Active users', icon: IconSparkles },
      { key: 'admins', label: 'Administrators', icon: IconShield },
      { key: 'users_joined_last_7_days', label: 'New users (7d)', icon: IconChart },
      { key: 'doctor_profiles', label: 'Doctor profiles', icon: IconStethoscope },
    ],
  },
  {
    title: 'Scheduling',
    subtitle: 'Calendar load and booking funnel',
    items: [
      { key: 'appointment_slots', label: 'Slots created', icon: IconCalendar },
      { key: 'appointment_slots_open', label: 'Open slots', icon: IconCalendar },
      { key: 'appointments_pending', label: 'Pending', icon: IconCalendar },
      { key: 'appointments_confirmed', label: 'Confirmed', icon: IconCalendar },
      { key: 'appointments_completed', label: 'Completed', icon: IconCalendar },
    ],
  },
  {
    title: 'Clinical & AI',
    subtitle: 'Touchpoints across care and automation',
    items: [
      { key: 'lab_uploads', label: 'Lab uploads', icon: IconLab },
      { key: 'chat_messages', label: 'Chat messages', icon: IconChat },
      { key: 'medical_reports', label: 'Medical reports', icon: IconHeart },
      { key: 'vital_readings', label: 'Vital readings', icon: IconHeart },
      { key: 'patient_notes', label: 'Patient notes', icon: IconStethoscope },
    ],
  },
]

function StatCard({ label, value, icon: IconCmp, emphasis, ringClass }) {
  const IconEl = IconCmp || IconSparkles
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-transparent p-5 shadow-lg shadow-black/20 backdrop-blur-md transition hover:border-white/20 hover:from-white/[0.09] ${emphasis ? 'md:p-6' : ''}`}
    >
      <div
        className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-cyan-500/20 to-violet-500/10 blur-2xl transition group-hover:from-cyan-400/30`}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
          <p className={`mt-2 font-semibold tracking-tight text-white ${emphasis ? 'text-3xl md:text-4xl' : 'text-2xl'}`}>
            {value ?? '—'}
          </p>
        </div>
        <div
          className={`rounded-xl bg-white/5 p-2.5 text-cyan-300/90 ring-1 ring-inset ${ringClass || 'ring-white/10'}`}
        >
          <IconEl />
        </div>
      </div>
    </div>
  )
}

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(onDismiss, 4200)
    return () => clearTimeout(t)
  }, [toast, onDismiss])

  if (!toast) return null
  const ok = toast.type === 'success'
  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2">
      <div
        className={`flex items-center gap-3 rounded-2xl border px-5 py-3 shadow-2xl backdrop-blur-xl ${
          ok
            ? 'border-emerald-400/30 bg-emerald-950/90 text-emerald-100'
            : 'border-rose-400/30 bg-rose-950/90 text-rose-100'
        }`}
      >
        <span className="text-sm font-medium">{toast.msg}</span>
        <button type="button" onClick={onDismiss} className="text-xs opacity-80 hover:opacity-100">
          Dismiss
        </button>
      </div>
    </div>
  )
}

function roleBadge(role) {
  const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset'
  if (role === 'admin') return `${base} bg-amber-500/15 text-amber-200 ring-amber-400/25`
  if (role === 'doctor') return `${base} bg-emerald-500/15 text-emerald-200 ring-emerald-400/25`
  return `${base} bg-sky-500/15 text-sky-200 ring-sky-400/25`
}

export default function AdminDashboard() {
  const { logout, user } = useAuth()
  const [overview, setOverview] = useState(null)
  const [users, setUsers] = useState([])
  const [doctors, setDoctors] = useState([])
  const [toast, setToast] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    specialty: '',
    bio: '',
    consultation_fee: '',
  })

  const load = useCallback(async () => {
    const [ov, us, doc] = await Promise.all([
      api.get('/admin/overview'),
      api.get('/admin/users'),
      api.get('/admin/doctors'),
    ])
    setOverview(ov.data)
    setUsers(us.data)
    setDoctors(doc.data)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        await load()
      } catch {
        if (!cancelled) setToast({ type: 'error', msg: 'Could not load dashboard data.' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [load])

  async function registerDoctor(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/admin/doctors', {
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        specialty: form.specialty,
        bio: form.bio || null,
        consultation_fee: form.consultation_fee ? Number(form.consultation_fee) : null,
      })
      setForm({ email: '', password: '', full_name: '', specialty: '', bio: '', consultation_fee: '' })
      await load()
      setToast({ type: 'success', msg: 'Doctor account created. They can sign in with the email and password you set.' })
    } catch (err) {
      const d = err.response?.data?.detail
      let msg = 'Could not register doctor.'
      if (typeof d === 'string') msg = d
      else if (Array.isArray(d))
        msg = d.map((x) => x.msg || x.message).filter(Boolean).join(' ') || msg
      setToast({ type: 'error', msg })
    } finally {
      setSaving(false)
    }
  }

  const dismissToast = useCallback(() => setToast(null), [])

  const unknownMetrics = useMemo(() => {
    if (!overview) return []
    const known = new Set(METRIC_GROUPS.flatMap((g) => g.items.map((i) => i.key)))
    return Object.keys(overview).filter((k) => !known.has(k))
  }, [overview])

  return (
    <div className="relative min-h-screen pb-16">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.18),transparent)]" />

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <header className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80">Operations</p>
            <h1 className="mt-2 bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent md:text-4xl">
              Admin console
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-400">
              Monitor adoption, onboard clinicians, and keep an eye on scheduling and AI-assisted workflows—all in one
              place.
            </p>
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-slate-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]" />
              Signed in as <span className="font-medium text-white">{user?.full_name}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => load().then(() => setToast({ type: 'success', msg: 'Dashboard refreshed.' }))}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 backdrop-blur-sm transition hover:bg-white/10"
            >
              Refresh data
            </button>
            <button
              type="button"
              onClick={logout}
              className="rounded-xl bg-gradient-to-r from-rose-600 to-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-900/30 transition hover:brightness-110"
            >
              Log out
            </button>
          </div>
        </header>

        {!overview && (
          <div className="mb-10 grid animate-pulse gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-white/5" />
            ))}
          </div>
        )}

        {overview &&
          METRIC_GROUPS.map((group) => (
            <section key={group.title} className="mb-12">
              <div className="mb-5 flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-white">{group.title}</h2>
                <p className="text-sm text-slate-500">{group.subtitle}</p>
              </div>
              <div
                className={`grid gap-4 ${group.emphasis ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'}`}
              >
                {group.items.map((item) => (
                  <StatCard
                    key={item.key}
                    label={item.label}
                    value={overview[item.key]}
                    icon={item.icon}
                    emphasis={group.emphasis}
                    ringClass={item.ring}
                  />
                ))}
              </div>
            </section>
          ))}

        {overview && unknownMetrics.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-5 text-lg font-semibold text-white">Other metrics</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {unknownMetrics.map((key) => (
                <StatCard key={key} label={key.replace(/_/g, ' ')} value={overview[key]} icon={IconChart} />
              ))}
            </div>
          </section>
        )}

        <section className="mb-14 grid gap-8 lg:grid-cols-5 lg:gap-10">
          <div className="lg:col-span-2">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-transparent p-1 shadow-2xl shadow-black/40">
              <div className="rounded-[1.35rem] bg-slate-950/80 p-6 backdrop-blur-xl sm:p-8">
                <div className="mb-8 flex items-start gap-4">
                  <div className="rounded-2xl bg-gradient-to-br from-cyan-500/30 to-violet-600/20 p-3 ring-1 ring-white/10">
                    <IconStethoscope />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">Register a doctor</h2>
                    <p className="mt-1 text-sm leading-relaxed text-slate-400">
                      Create a clinician account with a temporary password. They should change it after first login.
                    </p>
                  </div>
                </div>

                <form onSubmit={registerDoctor} className="space-y-8">
                  <div>
                    <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Account access</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-slate-400">Work email</span>
                        <input
                          className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none ring-cyan-500/0 transition placeholder:text-slate-600 focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/20"
                          placeholder="doctor@clinic.com"
                          required
                          autoComplete="off"
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-slate-400">Temporary password</span>
                        <input
                          className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/20"
                          placeholder="Min. 8 characters"
                          required
                          type="password"
                          value={form.password}
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                        />
                      </label>
                    </div>
                  </div>

                  <div>
                    <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Professional profile</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block sm:col-span-2">
                        <span className="mb-1.5 block text-xs font-medium text-slate-400">Full name</span>
                        <input
                          className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/20"
                          placeholder="As shown to patients"
                          required
                          value={form.full_name}
                          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-slate-400">Specialty</span>
                        <input
                          className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/20"
                          placeholder="e.g. Cardiology"
                          required
                          value={form.specialty}
                          onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-slate-400">Consultation fee (optional)</span>
                        <input
                          className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/20"
                          placeholder="0.00"
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.consultation_fee}
                          onChange={(e) => setForm({ ...form, consultation_fee: e.target.value })}
                        />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="mb-1.5 block text-xs font-medium text-slate-400">Bio (optional)</span>
                        <textarea
                          className="min-h-[88px] w-full resize-y rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/20"
                          placeholder="Short introduction for the patient-facing directory"
                          rows={3}
                          value={form.bio}
                          onChange={(e) => setForm({ ...form, bio: e.target.value })}
                        />
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-cyan-600 via-violet-600 to-fuchsia-600 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-violet-900/40 transition hover:brightness-110 disabled:opacity-60"
                  >
                    <span className="relative z-10">{saving ? 'Creating…' : 'Create doctor account'}</span>
                    <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 opacity-0 transition hover:opacity-100" />
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Clinical staff</h2>
                <p className="text-sm text-slate-500">{doctors.length} registered profiles</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {doctors.map((d) => (
                <article
                  key={d.id}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-lg transition hover:border-emerald-400/20 hover:bg-white/[0.06]"
                >
                  <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 blur-2xl" />
                  <div className="relative">
                    <p className="text-xs font-medium uppercase tracking-wide text-emerald-400/90">{d.specialty}</p>
                    <p className="mt-2 text-lg font-semibold text-white">{d.full_name}</p>
                    <p className="mt-1 truncate text-sm text-slate-400">{d.email}</p>
                    {d.consultation_fee != null && (
                      <p className="mt-3 inline-flex rounded-lg bg-white/5 px-2.5 py-1 text-xs text-slate-300 ring-1 ring-white/10">
                        Fee{' '}
                        {Number(d.consultation_fee).toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    )}
                  </div>
                </article>
              ))}
              {doctors.length === 0 && (
                <p className="col-span-full rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-12 text-center text-sm text-slate-500">
                  No doctors yet — use the form to add your first clinician.
                </p>
              )}
            </div>
          </div>
        </section>

        <section>
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">All accounts</h2>
              <p className="text-sm text-slate-500">{users.length} users in the system</p>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40 shadow-xl backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03]">
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">User</th>
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Role</th>
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map((u) => (
                    <tr key={u.id} className="transition hover:bg-white/[0.03]">
                      <td className="px-5 py-4">
                        <div className="font-medium text-white">{u.full_name}</div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={roleBadge(u.role)}>{u.role}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs ${u.is_active ? 'text-emerald-400' : 'text-slate-500'}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${u.is_active ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-slate-600'}`}
                          />
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-400">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
