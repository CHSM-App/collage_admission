import { Navigate, Outlet } from 'react-router-dom'
import { getDashboardPath, LOGIN_PATHS } from '../../app/routePaths.js'
import { useAuthContext } from '../../context/AuthContext.jsx'

export default function ProtectedRoute({ allowedRoles = [] }) {
  const { isAuthenticated, role } = useAuthContext()

  if (!isAuthenticated) {
    return <Navigate to={LOGIN_PATHS.student} replace />
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return <Navigate to={getDashboardPath(role)} replace />
  }

  return <Outlet />
}
