import { Navigate, Route, Routes } from 'react-router-dom'
import AdminLogin from '../features/auth/pages/AdminLogin.jsx'
import CollegeLogin from '../features/auth/pages/CollegeLogin.jsx'
import StudentLogin from '../features/auth/pages/StudentLogin.jsx'
import AdminDashboard from '../features/admin/pages/AdminDashboard.jsx'
import CollegeDashboard from '../features/college/pages/CollegeDashboard.jsx'
import StudentDashboard from '../features/student/pages/StudentDashboard.jsx'
import DashboardLayout from '../layouts/DashboardLayout.jsx'
import ProtectedRoute from '../shared/components/ProtectedRoute.jsx'
import { getDashboardPath, LOGIN_PATHS } from './routePaths.js'
import { useAuthContext } from '../context/AuthContext.jsx'

function RootRedirect() {
  const { isAuthenticated, role } = useAuthContext()

  return (
    <Navigate
      to={isAuthenticated ? getDashboardPath(role) : LOGIN_PATHS.student}
      replace
    />
  )
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />

      <Route path={LOGIN_PATHS.student} element={<StudentLogin />} />
      <Route path={LOGIN_PATHS.college} element={<CollegeLogin />} />
      <Route path={LOGIN_PATHS.admin} element={<AdminLogin />} />

      <Route element={<DashboardLayout />}>
        <Route element={<ProtectedRoute allowedRoles={['student']} />}>
          <Route path="/student/dashboard" element={<StudentDashboard />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['college']} />}>
          <Route path="/college/dashboard" element={<CollegeDashboard />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
        </Route>
      </Route>

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  )
}
