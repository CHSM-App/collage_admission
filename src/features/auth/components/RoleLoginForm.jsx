import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getDashboardPath, LOGIN_PATHS } from '../../../app/routePaths.js'
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
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const content = roleContent[role]

  useEffect(() => {
    if (isAuthenticated) {
      navigate(getDashboardPath(activeRole), { replace: true })
    }
  }, [activeRole, isAuthenticated, navigate])

  const handleChange = (event) => {
    clearError()
    setFormData((currentFormData) => ({
      ...currentFormData,
      [event.target.name]: event.target.value,
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

        <Input
          id={`${role}-password`}
          label="Password"
          name="password"
          type="password"
          placeholder="Enter your password"
          value={formData.password}
          onChange={handleChange}
          autoComplete="current-password"
          disabled={loading}
          required
        />

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={loading} loading={loading}>
          {loading ? 'Signing in...' : content.submitLabel}
        </Button>
      </form>
    </AuthLayout>
  )
}
