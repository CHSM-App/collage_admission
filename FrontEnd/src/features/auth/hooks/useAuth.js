import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDashboardPath, getLoginPath } from '../../../app/routePaths.js'
import { useAuthContext } from '../../../context/AuthContext.jsx'
import { authService } from '../services/authService.js'

function getErrorMessage(error) {
  const responseData = error?.response?.data

  if (typeof responseData === 'string') {
    return responseData
  }

  return (
    responseData?.message ||
    responseData?.error ||
    responseData?.detail ||
    error?.message ||
    'Login failed. Please check your credentials.'
  )
}

export function useAuth() {
  const navigate = useNavigate()
  const authContext = useAuthContext()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const login = async (role, credentials) => {
    setLoading(true)
    setError('')

    try {
      const session = await authService.loginByRole(role, credentials)
      authContext.saveSession(session)
      navigate(getDashboardPath(session.role), { replace: true })
      return session
    } catch (loginError) {
      const message = getErrorMessage(loginError)
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    const loginPath = getLoginPath(authContext.role)
    authContext.logout()
    navigate(loginPath, { replace: true })
  }

  return {
    ...authContext,
    loading,
    error,
    login,
    logout,
    clearError: () => setError(''),
  }
}
