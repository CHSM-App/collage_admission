import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LOGIN_PATHS } from '../../../app/routePaths.js'
import AuthLayout from '../../../layouts/AuthLayout.jsx'
import Button from '../../../shared/components/Button.jsx'
import Input from '../../../shared/components/Input.jsx'
import api from '../../../services/api.js'

const STEPS = { PHONE: 'phone', OTP: 'otp', PASSWORD: 'password', DONE: 'done' }

function validatePassword(pwd) {
  if (!pwd || pwd.length < 8)        return 'Password must be at least 8 characters.'
  if (!/[A-Z]/.test(pwd))            return 'Password must contain at least one uppercase letter.'
  if (!/[a-z]/.test(pwd))            return 'Password must contain at least one lowercase letter.'
  if (!/[0-9]/.test(pwd))            return 'Password must contain at least one number.'
  if (!/[^A-Za-z0-9]/.test(pwd))     return 'Password must contain at least one special character.'
  return null
}

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [step, setStep]     = useState(STEPS.PHONE)
  const [phone, setPhone]   = useState('')
  const [otp, setOtp]       = useState('')
  const [newPassword, setNewPassword]       = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [info, setInfo]         = useState('')

  // Step 1 — send OTP
  async function handleSendOtp(e) {
    e.preventDefault()
    setError('')
    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      setError('Phone number must be 10 digits starting with 6–9.')
      return
    }
    setLoading(true)
    try {
      const { data } = await api.post('auth/forgot-password/send-otp', { phone: phone.trim() })
      setInfo(data.message)
      setStep(STEPS.OTP)
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to send OTP. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Step 2 — verify OTP
  async function handleVerifyOtp(e) {
    e.preventDefault()
    setError('')
    if (otp.trim().length !== 6) {
      setError('Please enter the 6-digit OTP.')
      return
    }
    // We just move to the password step — actual verification happens on reset
    setStep(STEPS.PASSWORD)
    setInfo('')
  }

  // Resend OTP
  async function handleResend() {
    setError('')
    setOtp('')
    setLoading(true)
    try {
      const { data } = await api.post('auth/forgot-password/send-otp', { phone: phone.trim() })
      setInfo(data.message)
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to resend OTP.')
    } finally {
      setLoading(false)
    }
  }

  // Step 3 — reset password (sends OTP + new password together)
  async function handleReset(e) {
    e.preventDefault()
    setError('')
    const pwdErr = validatePassword(newPassword)
    if (pwdErr) { setError(pwdErr); return }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const { data } = await api.post('auth/forgot-password/reset', {
        phone:        phone.trim(),
        otp:          otp.trim(),
        new_password: newPassword,
      })
      setInfo(data.message)
      setStep(STEPS.DONE)
    } catch (err) {
      // If OTP is wrong, go back to OTP step
      const msg = err?.response?.data?.message || 'Reset failed. Please try again.'
      if (msg.toLowerCase().includes('otp') || msg.toLowerCase().includes('expired')) {
        setStep(STEPS.OTP)
        setOtp('')
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // ── Step: Phone ──────────────────────────────────────────────
  if (step === STEPS.PHONE) {
    return (
      <AuthLayout title="Forgot password" subtitle="Enter your registered phone number to receive an OTP.">
        <form className="space-y-4" onSubmit={handleSendOtp}>
          <Input
            id="phone" label="Registered phone number" name="phone" type="tel"
            placeholder="9876543210" maxLength={10} inputMode="numeric"
            value={phone}
            onChange={e => { setError(''); setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)) }}
            disabled={loading} required autoFocus
          />

          {error && <ErrorBanner message={error} />}

          <Button type="submit" className="w-full" loading={loading}>
            Send OTP
          </Button>

          <p className="text-center text-sm text-slate-500">
            Remembered it?{' '}
            <Link to={LOGIN_PATHS.student} className="font-semibold text-slate-950 hover:underline">
              Back to login
            </Link>
          </p>
        </form>
      </AuthLayout>
    )
  }

  // ── Step: OTP ────────────────────────────────────────────────
  if (step === STEPS.OTP) {
    return (
      <AuthLayout title="Enter OTP" subtitle={`A 6-digit code was sent to +91 ${phone}`}>
        <form className="space-y-4" onSubmit={handleVerifyOtp}>
          {info && <InfoBanner message={info} />}

          <Input
            id="otp" label="One-time password" name="otp" type="text"
            placeholder="6-digit OTP" inputMode="numeric" maxLength={6}
            value={otp}
            onChange={e => { setError(''); setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)) }}
            disabled={loading} required autoFocus
          />

          {error && <ErrorBanner message={error} />}

          <Button type="submit" className="w-full" loading={loading}>
            Verify OTP
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
              onClick={() => { setStep(STEPS.PHONE); setError(''); setOtp('') }}
            >
              Change number
            </button>
          </div>
        </form>
      </AuthLayout>
    )
  }

  // ── Step: New password ───────────────────────────────────────
  if (step === STEPS.PASSWORD) {
    return (
      <AuthLayout title="Set new password" subtitle="Choose a strong password for your account.">
        <form className="space-y-4" onSubmit={handleReset}>
          <div className="relative">
            <Input
              id="new_password" label="New password" name="new_password"
              type={showPwd ? 'text' : 'password'}
              placeholder="Min 8 chars, upper, lower, number, symbol"
              value={newPassword}
              onChange={e => { setError(''); setNewPassword(e.target.value) }}
              disabled={loading} required autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPwd(v => !v)}
              className="absolute right-3 top-8 text-slate-400 hover:text-slate-700"
              tabIndex={-1}
            >
              {showPwd ? (
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

          <Input
            id="confirm_password" label="Confirm new password" name="confirm_password"
            type={showPwd ? 'text' : 'password'}
            placeholder="Repeat password"
            value={confirmPassword}
            onChange={e => { setError(''); setConfirmPassword(e.target.value) }}
            disabled={loading} required
          />

          {error && <ErrorBanner message={error} />}

          <Button type="submit" className="w-full" loading={loading}>
            Reset password
          </Button>
        </form>
      </AuthLayout>
    )
  }

  // ── Step: Done ───────────────────────────────────────────────
  return (
    <AuthLayout title="Password reset!" subtitle="Your password has been updated successfully.">
      <div className="space-y-4">
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {info || 'You can now log in with your new password.'}
        </div>
        <Button className="w-full" onClick={() => navigate(LOGIN_PATHS.student, { replace: true })}>
          Go to login
        </Button>
      </div>
    </AuthLayout>
  )
}

function ErrorBanner({ message }) {
  return (
    <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
      {message}
    </p>
  )
}

function InfoBanner({ message }) {
  return (
    <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
      {message}
    </p>
  )
}
