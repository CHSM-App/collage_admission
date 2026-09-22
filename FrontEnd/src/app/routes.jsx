import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import DashboardLayout  from '../layouts/DashboardLayout.jsx'
import ProtectedRoute   from '../shared/components/ProtectedRoute.jsx'
import ErrorBoundary    from '../shared/components/ErrorBoundary.jsx'
import CollegeScope     from '../context/CollegeContext.jsx'
import { getDashboardPath, getLastCollegeCode, LOGIN_PATHS, STUDENT_PATHS } from './routePaths.js'
import { useAuthContext } from '../context/AuthContext.jsx'

// ── Lazy-loaded page components ───────────────────────────────
// Each entry becomes its own JS chunk — only loaded when the route is visited.
const PaymentResult       = lazy(() => import('../features/student/pages/PaymentResult.jsx'))
const PayViaLink          = lazy(() => import('../features/student/pages/PayViaLink.jsx'))
const AdminLogin          = lazy(() => import('../features/auth/pages/AdminLogin.jsx'))
const CollegeLogin        = lazy(() => import('../features/auth/pages/CollegeLogin.jsx'))
const StudentLogin        = lazy(() => import('../features/auth/pages/StudentLogin.jsx'))
const StudentRegister     = lazy(() => import('../features/auth/pages/StudentRegister.jsx'))
const ForgotPassword      = lazy(() => import('../features/auth/pages/ForgotPassword.jsx'))
const CollegeForgotPassword = lazy(() => import('../features/auth/pages/CollegeForgotPassword.jsx'))
const AdminDashboard      = lazy(() => import('../features/admin/pages/AdminDashboard.jsx'))
const CollegeDashboard    = lazy(() => import('../features/college/pages/CollegeDashboard.jsx'))
const StudentDashboard    = lazy(() => import('../features/student/pages/StudentDashboard.jsx'))
const CollegeLanding      = lazy(() => import('../features/student/pages/CollegeLanding.jsx'))
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

// Shown when a student URL carries no college and none can be recovered. There
// is deliberately no way to browse for one — a student reaches their college
// only through the link that college gave them.
function NoCollegeLink() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-bold text-slate-950">Admission link needed</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Please open the admission link your college shared with you to continue.
        </p>
      </div>
    </main>
  )
}

/**
 * Legacy student URLs (/login/student, /student/dashboard, old bookmarks) have
 * no college segment. Recover the last portal this browser used; if there is
 * none, there is nothing to show.
 */
function LegacyStudentRedirect({ to }) {
  const location = useLocation()
  const code = getLastCollegeCode()
  if (!code) return <NoCollegeLink />
  return <Navigate to={`${to(code)}${location.search}`} replace />
}

function RootRedirect() {
  const { isAuthenticated, role } = useAuthContext()
  if (isAuthenticated && role !== 'student') {
    return <Navigate to={getDashboardPath(role)} replace />
  }
  return <LegacyStudentRedirect to={isAuthenticated ? STUDENT_PATHS.dashboard : STUDENT_PATHS.landing} />
}

// /apply/:applicationId → /c/<code>/apply/:applicationId
function LegacyApplyRedirect() {
  const { applicationId } = useParams()
  return <LegacyStudentRedirect to={(code) => STUDENT_PATHS.apply(code, applicationId)} />
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<RootRedirect />} />

        {/* ── Per-college student portal ──────────────────────
            Every student-facing screen lives under the college's own code so
            the college is in the URL on every page and survives a refresh. */}
        <Route path="/c/:collegeCode" element={<CollegeScope />}>
          <Route index                  element={<CollegeLanding />} />
          <Route path="login"           element={<StudentLogin />} />
          <Route path="register"        element={<StudentRegister />} />
          <Route path="forgot-password" element={<ForgotPassword />} />

          <Route element={<ProtectedRoute allowedRoles={['student']} />}>
            {/* Multi-step application wizard — full-screen, no sidebar */}
            <Route path="apply/:applicationId" element={
              <ErrorBoundary>
                <ApplyWizard />
              </ErrorBoundary>
            } />

            <Route element={<DashboardLayout />}>
              <Route path="dashboard" element={<StudentDashboard />} />
            </Route>
          </Route>
        </Route>

        {/* ── Staff auth (not white-labelled) ─────────────────── */}
        <Route path={LOGIN_PATHS.college}  element={<CollegeLogin />} />
        <Route path={LOGIN_PATHS.admin}    element={<AdminLogin />} />
        <Route path="/college/forgot-password" element={<CollegeForgotPassword />} />

        {/* Payment gateway callbacks — reached from outside the app, so they
            cannot carry a college segment. */}
        <Route path="/payment-result"      element={<PaymentResult />} />
        <Route path="/pay/:token"          element={<PayViaLink />} />

        {/* College-side application wizard — full-screen, no sidebar */}
        <Route element={<ProtectedRoute allowedRoles={['college']} />}>
          <Route path="/college/apply/:applicationId" element={
            <ErrorBoundary>
              <CollegeApplyWizard />
            </ErrorBoundary>
          } />
        </Route>

        {/* ── Staff dashboards ────────────────────────────────── */}
        <Route element={<DashboardLayout />}>
          <Route element={<ProtectedRoute allowedRoles={['college']} />}>
            <Route path="/college/dashboard" element={<CollegeDashboard />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin/dashboard"   element={<AdminDashboard />} />
          </Route>
        </Route>

        {/* ── Legacy unscoped student URLs ────────────────────── */}
        <Route path={LOGIN_PATHS.student}  element={<LegacyStudentRedirect to={STUDENT_PATHS.login} />} />
        <Route path="/register/student"    element={<LegacyStudentRedirect to={STUDENT_PATHS.register} />} />
        <Route path="/forgot-password"     element={<LegacyStudentRedirect to={STUDENT_PATHS.forgot} />} />
        <Route path="/student/dashboard"   element={<LegacyStudentRedirect to={STUDENT_PATHS.dashboard} />} />
        <Route path="/apply/:applicationId" element={<LegacyApplyRedirect />} />

        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </Suspense>
  )
}
