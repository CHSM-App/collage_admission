import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LOGIN_PATHS } from '../../../app/routePaths.js'
import AuthLayout from '../../../layouts/AuthLayout.jsx'
import Button from '../../../shared/components/Button.jsx'
import Input from '../../../shared/components/Input.jsx'
import { collegeForgotPasswordSendOtp, collegeForgotPasswordReset } from '../services/authService.js'
import { getErrorMessage } from '../../../shared/hooks/useNetworkError.js'

const STEPS = { EMAIL: 'email', OTP: 'otp', PASSWORD: 'password', DONE: 'done' }

/**
 * College (admin + staff) forgot-password. The user enters their login email;
 * an OTP is sent to the phone on file (college phone for admins, staff phone
 * for staff). They verify the OTP and set a new password.
 */
export default function CollegeForgotPassword() {
  const navigate = useNavigate()
  const [step, setStep]       = useState(STEPS.EMAIL)
  const [email, setEmail]     = useState('')
  const [otp, setOtp]         = useState('')
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [info, setInfo]       = useState('')

  async function handleSendOtp(e) {
    e.preventDefault()
    setError(''); setInfo('')
    if (!email.trim()) { setError('Please enter your email.'); return }
    setLoading(true)
    try {
      const res = await collegeForgotPasswordSendOtp(email.trim())
      setInfo(res.data?.message || 'OTP sent to the registered WhatsApp number.')
      setStep(STEPS.OTP)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to send OTP. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  function handleVerifyOtp(e) {
    e.preventDefault()
    setError('')
    if (!/^\d{6}$/.test(otp)) { setError('Enter the 6-digit OTP.'); return }
    // OTP is verified together with the password on reset — advance to the password step.
    setStep(STEPS.PASSWORD)
  }

  async function handleResend() {
    setError(''); setInfo('')
    setLoading(true)
    try {
      const res = await collegeForgotPasswordSendOtp(email.trim())
      setInfo(res.data?.message || 'A new OTP has been sent.')
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to resend OTP.'))
    } finally {
      setLoading(false)
    }
  }

  async function handleReset(e) {
    e.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      const res = await collegeForgotPasswordReset({ email: email.trim(), otp, new_password: newPassword })
      setInfo(res.data?.message || 'Password reset successful.')
      setStep(STEPS.DONE)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to reset password.'))
      // If the OTP was wrong/expired, send the user back to the OTP step.
      const msg = err?.response?.data?.message || ''
      if (/otp/i.test(msg)) setStep(STEPS.OTP)
    } finally {
      setLoading(false)
    }
  }

  // ── Step: Email ──
  if (step === STEPS.EMAIL) {
    return (
      <AuthLayout title="Forgot password" subtitle="Enter your login email. We'll send an OTP to the phone on file.">
        <form className="space-y-4" onSubmit={handleSendOtp}>
          <Input
            id="email" label="Login email" name="email" type="email"
            placeholder="admin@college.edu.in"
            value={email} onChange={e => setEmail(e.target.value)}
            disabled={loading} required autoFocus
          />
          {error && <ErrorBanner message={error} />}
          <Button type="submit" className="w-full" loading={loading}>Send OTP</Button>
          <p className="text-center text-sm text-slate-500">
            Remembered it?{' '}
            <Link to={LOGIN_PATHS.college} className="font-semibold text-slate-950 hover:underline">Back to login</Link>
          </p>
        </form>
      </AuthLayout>
    )
  }

  // ── Step: OTP ──
  if (step === STEPS.OTP) {
    return (
      <AuthLayout title="Enter OTP" subtitle="A 6-digit code was sent to the phone on file.">
        <form className="space-y-4" onSubmit={handleVerifyOtp}>
          {info && <InfoBanner message={info} />}
          <Input
            id="otp" label="One-time password" name="otp" type="text"
            placeholder="6-digit OTP" inputMode="numeric" maxLength={6}
            value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            disabled={loading} required autoFocus
          />
          {error && <ErrorBanner message={error} />}
          <Button type="submit" className="w-full" loading={loading}>Continue</Button>
          <div className="flex items-center justify-between text-sm text-slate-500">
            <button type="button" className="font-semibold text-slate-950 hover:underline disabled:opacity-50"
              onClick={handleResend} disabled={loading}>Resend OTP</button>
            <button type="button" className="hover:underline" onClick={() => { setStep(STEPS.EMAIL); setOtp('') }}>Change email</button>
          </div>
        </form>
      </AuthLayout>
    )
  }

  // ── Step: New password ──
  if (step === STEPS.PASSWORD) {
    return (
      <AuthLayout title="Set new password" subtitle="Choose a strong password for your account.">
        <form className="space-y-4" onSubmit={handleReset}>
          <div className="relative">
            <Input
              id="new_password" label="New password" name="new_password"
              type={showPwd ? 'text' : 'password'}
              placeholder="Min 8 chars, upper, lower, number, symbol"
              value={newPassword} onChange={e => setNewPassword(e.target.value)}
              disabled={loading} required autoFocus
            />
            <button type="button" onClick={() => setShowPwd(v => !v)}
              className="absolute right-3 top-8 text-slate-400 hover:text-slate-700" tabIndex={-1}>
              {showPwd ? '🙈' : '👁'}
            </button>
          </div>
          <Input
            id="confirm_password" label="Confirm new password" name="confirm_password"
            type={showPwd ? 'text' : 'password'} placeholder="Repeat password"
            value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
            disabled={loading} required
          />
          {error && <ErrorBanner message={error} />}
          <Button type="submit" className="w-full" loading={loading}>Reset password</Button>
        </form>
      </AuthLayout>
    )
  }

  // ── Step: Done ──
  return (
    <AuthLayout title="Password reset!" subtitle="Your password has been updated successfully.">
      <div className="space-y-4">
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {info || 'You can now log in with your new password.'}
        </div>
        <Button className="w-full" onClick={() => navigate(LOGIN_PATHS.college, { replace: true })}>Go to login</Button>
      </div>
    </AuthLayout>
  )
}

function ErrorBanner({ message }) {
  return <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{message}</p>
}
function InfoBanner({ message }) {
  return <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>
}
