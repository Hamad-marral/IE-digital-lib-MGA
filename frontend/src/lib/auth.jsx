import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken } from './api'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!getToken()) { setReady(true); return }
    api.get('/api/auth/me').then(setUser).catch(() => setToken(null)).finally(() => setReady(true))
  }, [])

  useEffect(() => {
    const onLogout = () => setUser(null)
    window.addEventListener('ie:logout', onLogout)
    return () => window.removeEventListener('ie:logout', onLogout)
  }, [])

  const login = useCallback(async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password })
    setToken(res.token)
    setUser(res.user)
  }, [])

  const logout = useCallback(async () => {
    try { await api.post('/api/auth/logout') } catch { /* already gone */ }
    setToken(null)
    setUser(null)
  }, [])

  const canEdit = user?.role === 'admin' || user?.role === 'ie_team'
  const isAdmin = user?.role === 'admin'

  return <AuthCtx.Provider value={{ user, setUser, ready, login, logout, canEdit, isAdmin }}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)
