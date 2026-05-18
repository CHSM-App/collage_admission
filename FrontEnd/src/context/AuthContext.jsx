/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import api from '../services/api'

const AUTH_STORAGE_KEY = 'collegeAdmissionAuth'

const emptyAuthState = {
  user: null,
  role: null,
  isAuthenticated: false,
}

const AuthContext = createContext(null)

function readStoredAuth() {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY)
    return stored ? JSON.parse(stored) : emptyAuthState
  } catch {
    return emptyAuthState
  }
}

function persistAuth(authState) {
  // Only persist non-sensitive session data (no token)
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authState))
}

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(readStoredAuth)

  // Silently refresh the cookie on app load if the user has an active session,
  // and then every 6 hours so the token never expires while the user is active.
  useEffect(() => {
    if (!authState.isAuthenticated) return
    const refresh = () => api.post('auth/refresh').catch(() => {
      // If refresh fails (expired/invalid), clear local session — next API call
      // will get a 401 and redirect to login automatically.
      setAuthState(emptyAuthState)
      localStorage.removeItem(AUTH_STORAGE_KEY)
    })
    refresh()
    const interval = setInterval(refresh, 6 * 60 * 60 * 1000) // every 6 hours
    return () => clearInterval(interval)
  }, [authState.isAuthenticated])

  const saveSession = ({ user, role }) => {
    const nextAuthState = {
      user,
      role,
      isAuthenticated: true,
    }
    setAuthState(nextAuthState)
    persistAuth(nextAuthState)
  }

  const logout = async () => {
    try { await api.post('auth/logout') } catch { /* best-effort */ }
    setAuthState(emptyAuthState)
    localStorage.removeItem(AUTH_STORAGE_KEY)
  }

  const value = useMemo(
    () => ({
      ...authState,
      saveSession,
      logout,
    }),
    [authState],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }

  return context
}
