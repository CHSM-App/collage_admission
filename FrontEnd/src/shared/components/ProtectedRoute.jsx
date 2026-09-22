import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { getDashboardPath, getLastCollegeCode, LOGIN_PATHS, STUDENT_PATHS } from '../../app/routePaths.js'
import { useAuthContext } from '../../context/AuthContext.jsx'

export default function ProtectedRoute({ allowedRoles = [] }) {
  const { isAuthenticated, role } = useAuthContext()
  const location = useLocation()
  const { collegeCode } = useParams()

  if (!isAuthenticated) {
    // Carry the attempted URL through login so a deep link (or a refresh on a
    // college page) comes back where it started instead of a generic dashboard.
    const next = encodeURIComponent(`${location.pathname}${location.search}`)
    const code = collegeCode || getLastCollegeCode()
    const loginPath = code ? STUDENT_PATHS.login(code) : LOGIN_PATHS.student
    return <Navigate to={`${loginPath}?next=${next}`} replace />
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    if (role === 'student' && collegeCode) {
      return <Navigate to={STUDENT_PATHS.dashboard(collegeCode)} replace />
    }
    return <Navigate to={getDashboardPath(role)} replace />
  }

  return <Outlet />
}
