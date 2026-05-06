import { Navigate, Route, Routes } from 'react-router-dom'
import AdminLogin       from '../features/auth/pages/AdminLogin.jsx'
import CollegeLogin     from '../features/auth/pages/CollegeLogin.jsx'
import StudentLogin     from '../features/auth/pages/StudentLogin.jsx'
import StudentRegister  from '../features/auth/pages/StudentRegister.jsx'
import AdminDashboard   from '../features/admin/pages/AdminDashboard.jsx'
import CollegeDashboard from '../features/college/pages/CollegeDashboard.jsx'
import StudentDashboard from '../features/student/pages/StudentDashboard.jsx'
import ApplyWizard          from '../features/student/pages/ApplyWizard.jsx'
import CollegeApplyWizard   from '../features/college/pages/CollegeApplyWizard.jsx'
import DashboardLayout  from '../layouts/DashboardLayout.jsx'
import ProtectedRoute   from '../shared/components/ProtectedRoute.jsx'
import ErrorBoundary    from '../shared/components/ErrorBoundary.jsx'
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

      {/* Auth */}
      <Route path={LOGIN_PATHS.student}  element={<StudentLogin />} />
      <Route path={LOGIN_PATHS.college}  element={<CollegeLogin />} />
      <Route path={LOGIN_PATHS.admin}    element={<AdminLogin />} />
      <Route path="/register/student"    element={<StudentRegister />} />

      {/* Multi-step application wizard — full-screen, no sidebar */}
      <Route element={<ProtectedRoute allowedRoles={['student']} />}>
        <Route path="/apply/:applicationId" element={
          <ErrorBoundary>
            <ApplyWizard />
          </ErrorBoundary>
        } />
      </Route>

      {/* College-side application wizard — full-screen, no sidebar */}
      <Route element={<ProtectedRoute allowedRoles={['college']} />}>
        <Route path="/college/apply/:applicationId" element={
          <ErrorBoundary>
            <CollegeApplyWizard />
          </ErrorBoundary>
        } />
      </Route>

      {/* Dashboards */}
      <Route element={<DashboardLayout />}>
        <Route element={<ProtectedRoute allowedRoles={['student']} />}>
          <Route path="/student/dashboard" element={<StudentDashboard />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['college']} />}>
          <Route path="/college/dashboard" element={<CollegeDashboard />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="/admin/dashboard"   element={<AdminDashboard />} />
        </Route>
      </Route>

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  )
}
