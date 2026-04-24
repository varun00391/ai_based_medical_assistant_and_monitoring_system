import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, setAuthToken } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const t = localStorage.getItem('token')
    if (!t) {
      setUser(null)
      setLoading(false)
      return
    }
    api.defaults.headers.common.Authorization = `Bearer ${t}`
    try {
      const { data } = await api.get('/auth/me')
      setUser(data)
    } catch {
      setUser(null)
      localStorage.removeItem('token')
      delete api.defaults.headers.common.Authorization
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    Promise.resolve().then(() => {
      refresh()
    })
  }, [refresh])

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    setAuthToken(data.access_token)
    const { data: me } = await api.get('/auth/me')
    setUser(me)
  }, [])

  const register = useCallback(async (payload) => {
    await api.post('/auth/register', payload)
    await login(payload.email, payload.password)
  }, [login])

  const logout = useCallback(() => {
    setAuthToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh }),
    [user, loading, login, register, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside provider')
  return ctx
}
