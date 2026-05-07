import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getDashboardPath, LOGIN_PATHS, REGISTER_PATHS } from '../../../app/routePaths.js'
import AuthLayout from '../../../layouts/AuthLayout.jsx'
import Button from '../../../shared/components/Button.jsx'
import Input from '../../../shared/components/Input.jsx'
import { useAuth } from '../hooks/useAuth.js'

const roleContent = {
  student: {
    title: 'Student Login',
    subtitle: 'Access applications, documents, and admission updates.',
    submitLabel: 'Sign in as student',
    emailPlaceholder: 'student@example.com',
  },
  college: {
    title: 'College Login',
    subtitle: 'Review applications, seat intake, and applicant records.',
    submitLabel: 'Sign in as college',
    emailPlaceholder: 'admissions@college.edu',
  },
  admin: {
    title: 'Admin Login',
    subtitle: 'Manage platform access, institutions, and system controls.',
    submitLabel: 'Sign in as admin',
    emailPlaceholder: 'admin@collageadmission.com',
  },
}

const roleLinks = [
  { label: 'Student', role: 'student', to: LOGIN_PATHS.student },
  { label: 'College', role: 'college', to: LOGIN_PATHS.college },
  { label: 'Admin', role: 'admin', to: LOGIN_PATHS.admin },
]

export default function RoleLoginForm({ role }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, role: activeRole, login, loading, error, clearError } = useAuth()
  const isStudent = role === 'student'
  const [formData, setFormData] = useState({ email: '', phone: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const content = roleContent[role]

  useEffect(() => {
    if (isAuthenticated) {
      navigate(getDashboardPath(activeRole), { replace: true })
    }
  }, [activeRole, isAuthenticated, navigate])

  // Auto-dismiss the error banner after a generous timeout so it doesn't
  // linger forever, but is on screen long enough to read comfortably.
  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => clearError(), 10000)
    return () => clearTimeout(timer)
  }, [error, clearError])

  const handleChange = (event) => {
    // Clearing on input dismisses the banner the moment the user starts
    // correcting what they typed — they've seen the error, they're fixing it.
    if (error) clearError()
    let value = event.target.value
    if (event.target.name === 'phone') value = value.replace(/\D/g, '').slice(0, 10)
    setFormData((currentFormData) => ({
      ...currentFormData,
      [event.target.name]: value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    await login(role, formData)
  }

  return (
    <AuthLayout title={content.title} subtitle={content.subtitle}>
      <div className="mb-6 grid grid-cols-3 gap-2 rounded-lg bg-slate-100 p-1">
        {roleLinks.map((item) => (
          <Link
            key={item.role}
            to={item.to}
            className={`rounded-md px-3 py-2 text-center text-sm font-semibold transition ${
              location.pathname === item.to
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        {isStudent ? (
          <Input
            id="student-phone"
            label="Phone number"
            name="phone"
            type="tel"
            placeholder="e.g. 9876543210"
            value={formData.phone}
            onChange={handleChange}
            autoComplete="tel"
            disabled={loading}
            maxLength={10}
            inputMode="numeric"
            pattern="[0-9]{10}"
            required
          />
        ) : (
          <Input
            id={`${role}-email`}
            label="Email address"
            name="email"
            type="email"
            placeholder={content.emailPlaceholder}
            value={formData.email}
            onChange={handleChange}
            autoComplete="email"
            disabled={loading}
            required
          />
        )}

        <div>
          <label htmlFor={`${role}-password`} className="block text-sm font-semibold text-slate-800">
            Password
          </label>
          <div className="relative mt-2">
            <input
              id={`${role}-password`}
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleChange}
              autoComplete="current-password"
              disabled={loading}
              required
              className="block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 pr-9 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-700"
              tabIndex={-1}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7s4-7 9-7a9.97 9.97 0 015.39 1.56M15 12a3 3 0 11-4.5-2.6M3 3l18 18" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {error ? (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-3 rounded-lg border-2 border-red-300 bg-red-50 px-4 py-3 shadow-sm"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <p className="flex-1 text-sm font-semibold leading-relaxed text-red-800">
              {error}
            </p>
            <button
              type="button"
              onClick={clearError}
              aria-label="Dismiss error"
              className="flex-shrink-0 rounded text-red-400 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : null}

        <Button type="submit" className="w-full" disabled={loading} loading={loading}>
          {loading ? 'Signing in...' : content.submitLabel}
        </Button>

        {role === 'student' && (
          <p className="text-center text-sm text-slate-500">
            New student?{' '}
            <Link to={REGISTER_PATHS.student} className="font-semibold text-slate-950 hover:underline">
              Create an account
            </Link>
          </p>
        )}
      </form>
    </AuthLayout>
  )
}
