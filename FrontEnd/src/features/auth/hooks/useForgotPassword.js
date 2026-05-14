/**
 * useForgotPassword — encapsulates the 3-step forgot-password flow:
 *   PHONE → OTP → PASSWORD → DONE
 */
import { useState } from 'react'
import { forgotPasswordSendOtp, forgotPasswordReset } from '../services/authService.js'
import { validatePassword, validatePhone, formatPhone } from '../../../shared/hooks/usePasswordValidation.js'
import { getErrorMessage } from '../../../shared/hooks/useNetworkError.js'

export const STEPS = { PHONE: 'phone', OTP: 'otp', PASSWORD: 'password', DONE: 'done' }

export function useForgotPassword() {
  const [step, setStep]           = useState(STEPS.PHONE)
  const [phone, setPhoneRaw]      = useState('')
  const [otp, setOtpRaw]          = useState('')
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [info, setInfo]           = useState('')

  function setPhone(value)  { setError(''); setPhoneRaw(formatPhone(value)) }
  function setOtp(value)    { setError(''); setOtpRaw(value.replace(/\D/g, '').slice(0, 6)) }

  // Step 1 — send OTP
  async function handleSendOtp(e) {
    e?.preventDefault()
    setError('')
    const phoneErr = validatePhone(phone)
    if (phoneErr) { setError(phoneErr); return }
    setLoading(true)
    try {
      const { data } = await forgotPasswordSendOtp(phone.trim())
      setInfo(data.message)
      setStep(STEPS.OTP)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to send OTP. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  // Step 2 — verify OTP (client-side only; real check on reset)
  function handleVerifyOtp(e) {
    e?.preventDefault()
    setError('')
    if (otp.trim().length !== 6) {
      setError('Please enter the 6-digit OTP.')
      return
    }
    setStep(STEPS.PASSWORD)
    setInfo('')
  }

  // Resend OTP
  async function handleResend() {
    setError('')
    setOtpRaw('')
    setLoading(true)
    try {
      const { data } = await forgotPasswordSendOtp(phone.trim())
      setInfo(data.message)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to resend OTP.'))
    } finally {
      setLoading(false)
    }
  }

  // Step 3 — reset password
  async function handleReset(e) {
    e?.preventDefault()
    setError('')
    const pwdErr = validatePassword(newPassword)
    if (pwdErr) { setError(pwdErr); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      const { data } = await forgotPasswordReset({
        phone:        phone.trim(),
        otp:          otp.trim(),
        new_password: newPassword,
      })
      setInfo(data.message)
      setStep(STEPS.DONE)
    } catch (err) {
      const msg = err?.response?.data?.message || 'Reset failed. Please try again.'
      if (msg.toLowerCase().includes('otp') || msg.toLowerCase().includes('expired')) {
        setStep(STEPS.OTP)
        setOtpRaw('')
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  function goToPhoneStep() { setStep(STEPS.PHONE); setError(''); setOtpRaw('') }

  return {
    step,
    phone, setPhone,
    otp, setOtp,
    newPassword, setNewPassword,
    confirmPassword, setConfirmPassword,
    loading,
    error,
    info,
    handleSendOtp,
    handleVerifyOtp,
    handleResend,
    handleReset,
    goToPhoneStep,
  }
}
