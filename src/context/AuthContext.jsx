/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState } from 'react'

const AUTH_STORAGE_KEY = 'collegeAdmissionAuth'

const emptyAuthState = {
  user: null,
  role: null,
  token: null,
  isAuthenticated: false,
}

const AuthContext = createContext(null)

function readStoredAuth() {
  try {
    const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY)
    return storedAuth ? JSON.parse(storedAuth) : emptyAuthState
  } catch {
    return emptyAuthState
  }
}

function persistAuth(authState) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authState))

  // JWT persistence is disabled for now.
  // if (authState.token) {
  //   localStorage.setItem('authToken', authState.token)
  // } else {
  //   localStorage.removeItem('authToken')
  // }
}

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(readStoredAuth)

  const saveSession = ({ user, role, token }) => {
    const nextAuthState = {
      user,
      role,
      token,
      isAuthenticated: true,
    }

    setAuthState(nextAuthState)
    persistAuth(nextAuthState)
  }

  const logout = () => {
    setAuthState(emptyAuthState)
    localStorage.removeItem(AUTH_STORAGE_KEY)
    // localStorage.removeItem('authToken')
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
