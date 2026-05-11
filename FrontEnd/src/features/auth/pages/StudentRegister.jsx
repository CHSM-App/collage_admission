import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LOGIN_PATHS } from '../../../app/routePaths.js'
import AuthLayout from '../../../layouts/AuthLayout.jsx'
import Button from '../../../shared/components/Button.jsx'
import Input from '../../../shared/components/Input.jsx'
import { useAuthContext } from '../../../context/AuthContext.jsx'
import { authService } from '../services/authService.js'
import { getDashboardPath } from '../../../app/routePaths.js'
import api from '../../../services/api.js'

const STEPS = { FORM: 'form', OTP: 'otp' }

export default function StudentRegister() {
  const navigate = useNavigate()
  const { saveSession } = useAuthContext()

  const [step, setStep]     = useState(STEPS.FORM)
  const [form, setForm]     = useState({
    full_name: '', email: '', password: '', confirm_password: '',
    phone: '', city: '', category: 'general',
  })
  const [otp, setOtp]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [info, setInfo]     = useState('')

  function handleChange(e) {
    setError('')
    let value = e.target.value
    if (e.target.name === 'phone') value = value.replace(/\D/g, '').slice(0, 10)
    setForm(f => ({ ...f, [e.target.name]: value }))
  }

  // Step 1 — validate form and send OTP
  async function handleSendOtp(e) {
    e.preventDefault()
    setError('')
    if (!/^[6-9]\d{9}$/.test(form.phone.trim())) {
      setError('Phone number must be 10 digits starting with 6–9.')
      return
    }
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const { data } = await api.post('auth/otp/send', form)
      setInfo(data.message)
      setStep(STEPS.OTP)
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to send OTP. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Step 2 — verify OTP and complete registration
  async function handleVerifyOtp(e) {
    e.preventDefault()
    setError('')
    if (otp.trim().length !== 6) {
      setError('Please enter the 6-digit OTP.')
      return
    }
    setLoading(true)
    try {
      const { data } = await api.post('auth/otp/verify', { phone: form.phone, otp: otp.trim() })
      // Auto-login after registration
      const session = await authService.loginByRole('student', { phone: form.phone, password: form.password })
      saveSession(session)
      navigate(getDashboardPath('student'), { replace: true })
    } catch (err) {
      setError(err?.response?.data?.message || 'Verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Resend OTP
  async function handleResend() {
    setError('')
    setOtp('')
    setLoading(true)
    try {
      const { data } = await api.post('auth/otp/send', form)
      setInfo(data.message)
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to resend OTP.')
    } finally {
      setLoading(false)
    }
  }

  if (step === STEPS.OTP) {
    return (
      <AuthLayout title="Verify your number" subtitle={`Enter the 6-digit OTP sent to +91 ${form.phone}`}>
        <form className="space-y-4" onSubmit={handleVerifyOtp}>
          {info && (
            <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {info}
            </p>
          )}

          <Input
            id="otp" label="One-time password" name="otp" type="text"
            placeholder="6-digit OTP" inputMode="numeric" maxLength={6}
            value={otp} onChange={e => { setError(''); setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)) }}
            disabled={loading} required autoFocus
          />

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" loading={loading}>
            Verify &amp; Create account
          </Button>

          <div className="flex items-center justify-between text-sm text-slate-500">
            <button
              type="button"
              className="font-semibold text-slate-950 hover:underline disabled:opacity-50"
              onClick={handleResend}
              disabled={loading}
            >
              Resend OTP
            </button>
            <button
              type="button"
              className="hover:underline"
              onClick={() => { setStep(STEPS.FORM); setError(''); setOtp('') }}
            >
              Edit details
            </button>
          </div>
        </form>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Create student account" subtitle="Register to start applying to colleges.">
      <form className="space-y-4" onSubmit={handleSendOtp}>
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
            id="phone" label={<span>Phone <span className="text-red-500">*</span></span>}
            name="phone" type="tel"
            placeholder="9876543210" maxLength={10} inputMode="numeric" pattern="[0-9]{10}"
            value={form.phone} onChange={handleChange}
            disabled={loading} required
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
          Send OTP to verify phone
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
