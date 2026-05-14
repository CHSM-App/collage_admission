import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LOGIN_PATHS, getDashboardPath } from '../../../app/routePaths.js'
import AuthLayout from '../../../layouts/AuthLayout.jsx'
import Button from '../../../shared/components/Button.jsx'
import Input from '../../../shared/components/Input.jsx'
import { useAuthContext } from '../../../context/AuthContext.jsx'
import { useStudentRegistration, REG_STEPS } from '../hooks/useStudentRegistration.js'

function PasswordInput({ id, label, name, placeholder, value, onChange, disabled }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-700 mb-1">{label}</label>
      <div className="relative">
        <input
          id={id} name={name}
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          value={value} onChange={onChange}
          disabled={disabled} required
          className="w-full rounded-md border border-slate-200 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow(v => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

export default function StudentRegister() {
  const navigate = useNavigate()
  const { saveSession } = useAuthContext()

  const {
    step,
    form,
    otp, setOtp,
    loading,
    error,
    info,
    handleChange,
    handleSendOtp,
    handleVerifyOtp,
    handleResend,
    goToFormStep,
  } = useStudentRegistration()

  async function onVerifyOtp(e) {
    const session = await handleVerifyOtp(e)
    if (session) {
      saveSession(session)
      navigate(getDashboardPath('student'), { replace: true })
    }
  }

  if (step === REG_STEPS.OTP) {
    return (
      <AuthLayout title="Verify your number" subtitle={`Enter the 6-digit OTP sent to +91 ${form.phone}`}>
        <form className="space-y-4" onSubmit={onVerifyOtp}>
          {info && (
            <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {info}
            </p>
          )}

          <Input
            id="otp" label="One-time password" name="otp" type="text"
            placeholder="6-digit OTP" inputMode="numeric" maxLength={6}
            value={otp} onChange={e => setOtp(e.target.value)}
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
              onClick={goToFormStep}
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
          <PasswordInput
            id="password" label="Password" name="password"
            placeholder="Min 8 chars, upper, lower, number, symbol"
            value={form.password} onChange={handleChange}
            disabled={loading}
          />
          <PasswordInput
            id="confirm_password" label="Confirm password" name="confirm_password"
            placeholder="Repeat password"
            value={form.confirm_password} onChange={handleChange}
            disabled={loading}
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
