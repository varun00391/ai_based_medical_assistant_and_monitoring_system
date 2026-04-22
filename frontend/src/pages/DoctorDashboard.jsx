import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function DoctorDashboard() {
  const { logout, user } = useAuth()
  const [appointments, setAppointments] = useState([])
  const [patientId, setPatientId] = useState('')
  const [summary, setSummary] = useState(null)
  const [note, setNote] = useState('')
  const [slots, setSlots] = useState({ start: '', end: '' })

  async function loadAppts() {
    const { data } = await api.get('/doctor/appointments')
    setAppointments(data)
  }

  useEffect(() => {
    loadAppts()
  }, [])

  async function loadPatient(e) {
    e.preventDefault()
    if (!patientId) return
    const { data } = await api.get(`/doctor/patients/${patientId}/summary`)
    setSummary(data)
  }

  async function addNote(e) {
    e.preventDefault()
    if (!patientId || !note.trim()) return
    await api.post(`/doctor/patients/${patientId}/notes`, { content: note })
    setNote('')
    const { data } = await api.get(`/doctor/patients/${patientId}/summary`)
    setSummary(data)
  }

  async function createSlot(e) {
    e.preventDefault()
    await api.post('/appointments/doctor/slots', {
      start_time: new Date(slots.start).toISOString(),
      end_time: new Date(slots.end).toISOString(),
    })
    setSlots({ start: '', end: '' })
    alert('Slot created')
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-sky-400">Doctor</h1>
          <p className="text-sm text-slate-400">{user?.full_name}</p>
        </div>
        <button type="button" onClick={logout} className="rounded border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800">
          Log out
        </button>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium text-slate-300">Your appointments</h2>
        <ul className="space-y-2 text-sm">
          {appointments.map((a) => (
            <li key={a.id} className="rounded border border-slate-800 px-3 py-2">
              <strong>{a.patient?.full_name}</strong> — {a.status}
              <div className="text-xs text-slate-500">
                {a.slot?.start_time} → {a.slot?.end_time}
              </div>
              {a.patient_notes && <p className="mt-1 text-xs text-slate-400">Note: {a.patient_notes}</p>}
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-10 rounded-lg border border-slate-800 p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-300">Add availability slot</h2>
        <form onSubmit={createSlot} className="flex flex-wrap gap-2 text-sm">
          <input
            type="datetime-local"
            required
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1"
            value={slots.start}
            onChange={(e) => setSlots({ ...slots, start: e.target.value })}
          />
          <input
            type="datetime-local"
            required
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1"
            value={slots.end}
            onChange={(e) => setSlots({ ...slots, end: e.target.value })}
          />
          <button type="submit" className="rounded bg-sky-600 px-3 py-1">
            Create slot
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-500">Datetimes are sent as ISO strings (browser local).</p>
      </section>

      <section className="rounded-lg border border-slate-800 p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-300">Patient lookup</h2>
        <form onSubmit={loadPatient} className="mb-4 flex gap-2">
          <input
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            placeholder="Patient user ID"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          />
          <button type="submit" className="rounded bg-sky-600 px-4 py-2 text-sm">
            Load summary
          </button>
        </form>
        {summary && (
          <div className="space-y-4 text-sm">
            <p>
              <span className="text-slate-500">Patient:</span> {summary.patient?.full_name} ({summary.patient?.email})
            </p>
            <div>
              <h3 className="text-xs uppercase text-slate-500">Reports</h3>
              <ul className="list-inside list-disc text-xs">
                {summary.reports?.map((r) => (
                  <li key={r.id}>
                    {r.title} — {r.created_at}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs uppercase text-slate-500">Vitals (recent)</h3>
              <ul className="text-xs">
                {summary.vitals?.map((v, i) => (
                  <li key={i}>
                    {v.at}: pulse {v.pulse}, SpO₂ {v.spo2}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs uppercase text-slate-500">Doctor notes</h3>
              <ul className="space-y-1 text-xs">
                {summary.notes?.map((n) => (
                  <li key={n.id} className="rounded bg-slate-900/80 px-2 py-1">
                    {n.content}
                  </li>
                ))}
              </ul>
            </div>
            <form onSubmit={addNote} className="flex gap-2">
              <input
                className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                placeholder="Add clinical note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button type="submit" className="rounded bg-sky-700 px-3 py-1 text-sm">
                Save note
              </button>
            </form>
          </div>
        )}
      </section>
    </div>
  )
}
