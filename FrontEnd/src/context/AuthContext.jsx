/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import api from '../services/api'

const AUTH_STORAGE_KEY  = 'collegeAdmissionAuth'
const TOKEN_STORAGE_KEY = 'collegeAdmissionToken'

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
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authState))
}

// Inject stored token as Authorization header on every request so it works
// cross-origin (LAN dev, different ports) where cookies may be blocked.
function applyStoredToken() {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY)
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  } else {
    delete api.defaults.headers.common['Authorization']
  }
}

// Run once on module load so any page refresh picks up the stored token.
applyStoredToken()

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(readStoredAuth)

  // Silently refresh the token on app load, then hourly.
  // NOTE: sessions have an ABSOLUTE daily deadline (see SESSION_EXPIRY_HOUR on the
  // backend). A refresh re-issues a token but can never extend it past that
  // deadline — so once it passes, refresh 401s and the user is logged out below.
  useEffect(() => {
    if (!authState.isAuthenticated) return
    const refresh = () => api.post('auth/refresh').then(res => {
      // If backend returns a new token, update it
      const newToken = res.data?.token
      if (newToken) {
        localStorage.setItem(TOKEN_STORAGE_KEY, newToken)
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
      }
    }).catch(() => {
      // If refresh fails (expired/invalid), clear local session — next API call
      // will get a 401 and redirect to login automatically.
      setAuthState(emptyAuthState)
      localStorage.removeItem(AUTH_STORAGE_KEY)
      localStorage.removeItem(TOKEN_STORAGE_KEY)
      delete api.defaults.headers.common['Authorization']
    })
    refresh()
    // Hourly (not 6-hourly) so an expired daily session is detected promptly.
    const interval = setInterval(refresh, 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [authState.isAuthenticated])

  const saveSession = ({ user, role, token }) => {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token)
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }
    const nextAuthState = { user, role, isAuthenticated: true }
    setAuthState(nextAuthState)
    persistAuth(nextAuthState)
  }

  const logout = async () => {
    try { await api.post('auth/logout') } catch { /* best-effort */ }
    setAuthState(emptyAuthState)
    localStorage.removeItem(AUTH_STORAGE_KEY)
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    delete api.defaults.headers.common['Authorization']
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
