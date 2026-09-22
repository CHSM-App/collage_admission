import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLoginPath, getPostLoginPath, STUDENT_PATHS } from '../../../app/routePaths.js'
import { useAuthContext } from '../../../context/AuthContext.jsx'
import { useCollege } from '../../../context/CollegeContext.jsx'
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
  // null outside a /c/:collegeCode route (college & admin login) — that is fine,
  // getPostLoginPath falls back to the role's own dashboard.
  const college = useCollege()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const login = async (role, credentials) => {
    setLoading(true)
    setError('')

    try {
      const session = await authService.loginByRole(role, credentials)
      authContext.saveSession(session)
      navigate(getPostLoginPath(session.role, college?.code), { replace: true })
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
    // A student logs back out onto their college's own portal, never a
    // platform-wide login screen.
    const loginPath = authContext.role === 'student' && college?.code
      ? STUDENT_PATHS.login(college.code)
      : getLoginPath(authContext.role)
    authContext.logout()
    navigate(loginPath, { replace: true })
  }

  const clearError = useCallback(() => setError(''), [])

  return {
    ...authContext,
    loading,
    error,
    login,
    logout,
    clearError,
  }
}
