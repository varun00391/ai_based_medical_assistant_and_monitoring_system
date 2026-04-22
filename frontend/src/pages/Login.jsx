import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setErr('')
    try {
      await login(email, password)
      nav('/', { replace: true })
    } catch (ex) {
      setErr(ex.response?.data?.detail || 'Login failed')
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="mb-6 text-2xl font-semibold text-emerald-400">Medical Assist</h1>
      <p className="mb-6 text-sm text-slate-400">
        Educational demo — not for real clinical decisions.
      </p>
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/80 p-6">
        {err && <p className="text-sm text-red-400">{err}</p>}
        <div>
          <label className="mb-1 block text-xs text-slate-400">Email</label>
          <input
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Password</label>
          <input
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          Sign in
        </button>
        <p className="text-center text-xs text-slate-500">
          No account?{' '}
          <Link className="text-emerald-400 hover:underline" to="/register">
            Register as patient
          </Link>
        </p>
      </form>
    </div>
  )
}
