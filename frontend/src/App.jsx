import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AdminDashboard from './pages/AdminDashboard'
import DoctorDashboard from './pages/DoctorDashboard'
import Login from './pages/Login'
import PatientDashboard from './pages/PatientDashboard'
import Register from './pages/Register'

function Home() {
  const { user, loading } = useAuth()
  if (loading) return <p className="p-8 text-center text-slate-400">Loading…</p>
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'admin') return <AdminDashboard />
  if (user.role === 'doctor') return <DoctorDashboard />
  return <PatientDashboard />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
