import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardLayout  from '../layouts/DashboardLayout.jsx'
import ProtectedRoute   from '../shared/components/ProtectedRoute.jsx'
import ErrorBoundary    from '../shared/components/ErrorBoundary.jsx'
import { getDashboardPath, LOGIN_PATHS } from './routePaths.js'
import { useAuthContext } from '../context/AuthContext.jsx'

// ── Lazy-loaded page components ───────────────────────────────
// Each entry becomes its own JS chunk — only loaded when the route is visited.
const PaymentResult       = lazy(() => import('../features/student/pages/PaymentResult.jsx'))
const AdminLogin          = lazy(() => import('../features/auth/pages/AdminLogin.jsx'))
const CollegeLogin        = lazy(() => import('../features/auth/pages/CollegeLogin.jsx'))
const StudentLogin        = lazy(() => import('../features/auth/pages/StudentLogin.jsx'))
const StudentRegister     = lazy(() => import('../features/auth/pages/StudentRegister.jsx'))
const ForgotPassword      = lazy(() => import('../features/auth/pages/ForgotPassword.jsx'))
const AdminDashboard      = lazy(() => import('../features/admin/pages/AdminDashboard.jsx'))
const CollegeDashboard    = lazy(() => import('../features/college/pages/CollegeDashboard.jsx'))
const StudentDashboard    = lazy(() => import('../features/student/pages/StudentDashboard.jsx'))
const ApplyWizard         = lazy(() => import('../features/student/pages/ApplyWizard.jsx'))
const CollegeApplyWizard  = lazy(() => import('../features/college/pages/CollegeApplyWizard.jsx'))

// ── Fallback shown while a chunk is loading ───────────────────
function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
    </div>
  )
}

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
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<RootRedirect />} />

        {/* Auth */}
        <Route path={LOGIN_PATHS.student}  element={<StudentLogin />} />
        <Route path={LOGIN_PATHS.college}  element={<CollegeLogin />} />
        <Route path={LOGIN_PATHS.admin}    element={<AdminLogin />} />
        <Route path="/register/student"    element={<StudentRegister />} />
        <Route path="/forgot-password"     element={<ForgotPassword />} />
        <Route path="/payment-result"      element={<PaymentResult />} />

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
    </Suspense>
  )
}
