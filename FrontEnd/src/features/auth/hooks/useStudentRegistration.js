/**
 * useStudentRegistration — encapsulates the 2-step student registration flow:
 *   FORM → OTP → (auto-login on success)
 */
import { useState } from 'react'
import { authService, sendOtp, verifyOtp } from '../services/authService.js'
import { validatePassword, validatePhone, formatPhone } from '../../../shared/hooks/usePasswordValidation.js'
import { getErrorMessage } from '../../../shared/hooks/useNetworkError.js'

export const REG_STEPS = { FORM: 'form', OTP: 'otp' }

const EMPTY_FORM = {
  full_name: '', email: '', password: '', confirm_password: '',
  phone: '', city: '', category: 'general',
}

export function useStudentRegistration() {
  const [step, setStep]     = useState(REG_STEPS.FORM)
  const [form, setForm]     = useState(EMPTY_FORM)
  const [otp, setOtpRaw]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [info, setInfo]     = useState('')

  function handleChange(e) {
    setError('')
    let value = e.target.value
    if (e.target.name === 'phone') value = formatPhone(value)
    setForm(f => ({ ...f, [e.target.name]: value }))
  }

  function setOtp(value) {
    setError('')
    setOtpRaw(value.replace(/\D/g, '').slice(0, 6))
  }

  // Step 1 — validate form and send OTP
  async function handleSendOtp(e) {
    e?.preventDefault()
    setError('')
    const phoneErr = validatePhone(form.phone)
    if (phoneErr) { setError(phoneErr); return }
    const pwdErr = validatePassword(form.password)
    if (pwdErr) { setError(pwdErr); return }
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const { data } = await sendOtp(form)
      setInfo(data.message)
      setStep(REG_STEPS.OTP)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to send OTP. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  // Step 2 — verify OTP and complete registration; returns session for caller to save
  async function handleVerifyOtp(e) {
    e?.preventDefault()
    setError('')
    if (otp.trim().length !== 6) {
      setError('Please enter the 6-digit OTP.')
      return null
    }
    setLoading(true)
    try {
      await verifyOtp(form.phone, otp.trim())
      const session = await authService.loginByRole('student', { phone: form.phone, password: form.password })
      return session
    } catch (err) {
      setError(getErrorMessage(err, 'Verification failed. Please try again.'))
      return null
    } finally {
      setLoading(false)
    }
  }

  // Resend OTP
  async function handleResend() {
    setError('')
    setOtpRaw('')
    setLoading(true)
    try {
      const { data } = await sendOtp(form)
      setInfo(data.message)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to resend OTP.'))
    } finally {
      setLoading(false)
    }
  }

  function goToFormStep() { setStep(REG_STEPS.FORM); setError(''); setOtpRaw('') }

  return {
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
  }
}
