import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const { register } = useAuth()
  const nav = useNavigate()
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
  })
  const [err, setErr] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setErr('')
    try {
      await register(form)
      nav('/', { replace: true })
    } catch (ex) {
      setErr(ex.response?.data?.detail || 'Registration failed')
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="mb-6 text-xl font-semibold">Patient registration</h1>
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/80 p-6">
        {err && <p className="text-sm text-red-400">{typeof err === 'string' ? err : JSON.stringify(err)}</p>}
        <Field label="Full name" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
        <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <Field label="Password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
        <Field label="Phone (optional)" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} optional />
        <button type="submit" className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-medium hover:bg-emerald-500">
          Create account
        </button>
        <p className="text-center text-xs text-slate-500">
          <Link className="text-emerald-400 hover:underline" to="/login">
            Back to login
          </Link>
        </p>
      </form>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', optional }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-slate-400">{label}</label>
      <input
        type={type}
        className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={!optional}
      />
    </div>
  )
}
