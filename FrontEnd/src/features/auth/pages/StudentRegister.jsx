import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LOGIN_PATHS } from '../../../app/routePaths.js'
import AuthLayout from '../../../layouts/AuthLayout.jsx'
import Button from '../../../shared/components/Button.jsx'
import Input from '../../../shared/components/Input.jsx'
import { useAuthContext } from '../../../context/AuthContext.jsx'
import { authService } from '../services/authService.js'
import { getDashboardPath } from '../../../app/routePaths.js'

export default function StudentRegister() {
  const navigate = useNavigate()
  const { saveSession } = useAuthContext()

  const [form, setForm] = useState({
    full_name: '', email: '', password: '', confirm_password: '',
    phone: '', city: '', category: 'general',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  function handleChange(e) {
    setError('')
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const session = await authService.registerStudent({
        full_name: form.full_name,
        email:     form.email,
        password:  form.password,
        phone:     form.phone,
        city:      form.city,
        category:  form.category,
      })
      saveSession(session)
      navigate(getDashboardPath('student'), { replace: true })
    } catch (err) {
      setError(err?.response?.data?.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Create student account" subtitle="Register to start applying to colleges.">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input
          id="full_name" label="Full name" name="full_name" type="text"
          placeholder="Aarav Shetty"
          value={form.full_name} onChange={handleChange}
          disabled={loading} required
        />
        <Input
          id="email" label="Email address" name="email" type="email"
          placeholder="you@example.com"
          value={form.email} onChange={handleChange}
          disabled={loading} required
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="password" label="Password" name="password" type="password"
            placeholder="Min 6 characters"
            value={form.password} onChange={handleChange}
            disabled={loading} required
          />
          <Input
            id="confirm_password" label="Confirm password" name="confirm_password" type="password"
            placeholder="Repeat password"
            value={form.confirm_password} onChange={handleChange}
            disabled={loading} required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="phone" label="Phone" name="phone" type="tel"
            placeholder="9876543210"
            value={form.phone} onChange={handleChange}
            disabled={loading}
          />
          <Input
            id="city" label="City" name="city" type="text"
            placeholder="Vengurla"
            value={form.city} onChange={handleChange}
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Category</label>
          <select
            name="category" value={form.category} onChange={handleChange}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="general">General</option>
            <option value="obc">OBC</option>
            <option value="sc">SC</option>
            <option value="st">ST</option>
          </select>
        </div>

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" loading={loading}>
          Create account
        </Button>

        <p className="text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to={LOGIN_PATHS.student} className="font-semibold text-slate-950 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
