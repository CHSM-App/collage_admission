import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useForgotPassword, STEPS } from '../../features/auth/hooks/useForgotPassword.js'

vi.mock('../../features/auth/services/authService.js', () => ({
  forgotPasswordSendOtp: vi.fn(),
  forgotPasswordReset:   vi.fn(),
}))

import { forgotPasswordSendOtp, forgotPasswordReset } from '../../features/auth/services/authService.js'

describe('useForgotPassword', () => {
  beforeEach(() => vi.clearAllMocks())

  it('initial state: step=PHONE, empty fields, no error', () => {
    const { result } = renderHook(() => useForgotPassword())
    expect(result.current.step).toBe(STEPS.PHONE)
    expect(result.current.phone).toBe('')
    expect(result.current.error).toBe('')
    expect(result.current.loading).toBe(false)
  })

  it('setPhone formats phone value (strips non-digits, max 10)', () => {
    const { result } = renderHook(() => useForgotPassword())
    act(() => result.current.setPhone('98-765-43210extra'))
    expect(result.current.phone).toBe('9876543210')
  })

  it('setOtp strips non-digits and limits to 6', () => {
    const { result } = renderHook(() => useForgotPassword())
    act(() => result.current.setOtp('12-ab-3456'))
    expect(result.current.otp).toBe('123456')
  })

  it('handleSendOtp shows error for invalid phone', async () => {
    const { result } = renderHook(() => useForgotPassword())
    act(() => result.current.setPhone('1234'))
    await act(async () => { await result.current.handleSendOtp({ preventDefault: vi.fn() }) })
    expect(result.current.error).toMatch(/phone/i)
    expect(result.current.step).toBe(STEPS.PHONE)
  })

  it('handleSendOtp advances to OTP step on success', async () => {
    forgotPasswordSendOtp.mockResolvedValueOnce({ data: { message: 'OTP sent to your phone.' } })
    const { result } = renderHook(() => useForgotPassword())
    act(() => result.current.setPhone('9876543210'))
    await act(async () => { await result.current.handleSendOtp({ preventDefault: vi.fn() }) })
    expect(forgotPasswordSendOtp).toHaveBeenCalledWith('9876543210')
    expect(result.current.step).toBe(STEPS.OTP)
    expect(result.current.info).toBe('OTP sent to your phone.')
  })

  it('handleSendOtp sets error on API failure', async () => {
    forgotPasswordSendOtp.mockRejectedValueOnce({ response: { data: { message: 'Phone not found.' } } })
    const { result } = renderHook(() => useForgotPassword())
    act(() => result.current.setPhone('9876543210'))
    await act(async () => { await result.current.handleSendOtp({ preventDefault: vi.fn() }) })
    expect(result.current.error).toBe('Phone not found.')
  })

  it('handleVerifyOtp shows error if OTP is not 6 digits', () => {
    const { result } = renderHook(() => useForgotPassword())
    act(() => result.current.setOtp('123'))
    act(() => result.current.handleVerifyOtp({ preventDefault: vi.fn() }))
    expect(result.current.error).toBe('Please enter the 6-digit OTP.')
    expect(result.current.step).toBe(STEPS.PHONE)
  })

  it('handleVerifyOtp advances to PASSWORD step for valid OTP', async () => {
    forgotPasswordSendOtp.mockResolvedValueOnce({ data: { message: 'OTP sent.' } })
    const { result } = renderHook(() => useForgotPassword())
    act(() => result.current.setPhone('9876543210'))
    await act(async () => { await result.current.handleSendOtp({ preventDefault: vi.fn() }) })

    act(() => result.current.setOtp('654321'))
    act(() => result.current.handleVerifyOtp({ preventDefault: vi.fn() }))
    expect(result.current.step).toBe(STEPS.PASSWORD)
  })

  it('handleReset shows error for invalid password', async () => {
    const { result } = renderHook(() => useForgotPassword())
    act(() => { result.current.setNewPassword = vi.fn() }) // use internal state

    // Force through OTP step first
    forgotPasswordSendOtp.mockResolvedValueOnce({ data: { message: 'OTP sent.' } })
    act(() => result.current.setPhone('9876543210'))
    await act(async () => { await result.current.handleSendOtp({ preventDefault: vi.fn() }) })
    act(() => result.current.setOtp('654321'))
    act(() => result.current.handleVerifyOtp({ preventDefault: vi.fn() }))

    // Now try reset with weak password
    act(() => {
      result.current.setNewPassword('weak')
      result.current.setConfirmPassword('weak')
    })
    await act(async () => { await result.current.handleReset({ preventDefault: vi.fn() }) })
    expect(result.current.error).toBeTruthy()
  })

  it('handleReset shows error when passwords do not match', async () => {
    forgotPasswordSendOtp.mockResolvedValueOnce({ data: { message: 'OTP sent.' } })
    const { result } = renderHook(() => useForgotPassword())
    act(() => result.current.setPhone('9876543210'))
    await act(async () => { await result.current.handleSendOtp({ preventDefault: vi.fn() }) })
    act(() => result.current.setOtp('654321'))
    act(() => result.current.handleVerifyOtp({ preventDefault: vi.fn() }))

    act(() => {
      result.current.setNewPassword('Test@1234')
      result.current.setConfirmPassword('Different@5')
    })
    await act(async () => { await result.current.handleReset({ preventDefault: vi.fn() }) })
    expect(result.current.error).toBe('Passwords do not match.')
  })

  it('handleReset advances to DONE on success', async () => {
    forgotPasswordSendOtp.mockResolvedValueOnce({ data: { message: 'OTP sent.' } })
    forgotPasswordReset.mockResolvedValueOnce({ data: { message: 'Password reset successful.' } })

    const { result } = renderHook(() => useForgotPassword())
    act(() => result.current.setPhone('9876543210'))
    await act(async () => { await result.current.handleSendOtp({ preventDefault: vi.fn() }) })
    act(() => result.current.setOtp('654321'))
    act(() => result.current.handleVerifyOtp({ preventDefault: vi.fn() }))

    act(() => {
      result.current.setNewPassword('Test@1234')
      result.current.setConfirmPassword('Test@1234')
    })
    await act(async () => { await result.current.handleReset({ preventDefault: vi.fn() }) })

    expect(forgotPasswordReset).toHaveBeenCalledWith({
      phone: '9876543210', otp: '654321', new_password: 'Test@1234',
    })
    expect(result.current.step).toBe(STEPS.DONE)
    expect(result.current.info).toBe('Password reset successful.')
  })

  it('handleReset goes back to OTP step when error mentions otp/expired', async () => {
    forgotPasswordSendOtp.mockResolvedValueOnce({ data: { message: 'OTP sent.' } })
    forgotPasswordReset.mockRejectedValueOnce({
      response: { data: { message: 'OTP expired. Please request a new one.' } },
    })

    const { result } = renderHook(() => useForgotPassword())
    act(() => result.current.setPhone('9876543210'))
    await act(async () => { await result.current.handleSendOtp({ preventDefault: vi.fn() }) })
    act(() => result.current.setOtp('654321'))
    act(() => result.current.handleVerifyOtp({ preventDefault: vi.fn() }))
    act(() => {
      result.current.setNewPassword('Test@1234')
      result.current.setConfirmPassword('Test@1234')
    })
    await act(async () => { await result.current.handleReset({ preventDefault: vi.fn() }) })

    expect(result.current.step).toBe(STEPS.OTP)
    expect(result.current.otp).toBe('')
  })

  it('goToPhoneStep resets to PHONE step and clears OTP', async () => {
    forgotPasswordSendOtp.mockResolvedValueOnce({ data: { message: 'OTP sent.' } })
    const { result } = renderHook(() => useForgotPassword())
    act(() => result.current.setPhone('9876543210'))
    await act(async () => { await result.current.handleSendOtp({ preventDefault: vi.fn() }) })

    act(() => result.current.goToPhoneStep())
    expect(result.current.step).toBe(STEPS.PHONE)
    expect(result.current.otp).toBe('')
  })

  it('handleResend calls sendOtp and updates info', async () => {
    forgotPasswordSendOtp.mockResolvedValueOnce({ data: { message: 'OTP resent.' } })
    const { result } = renderHook(() => useForgotPassword())
    act(() => result.current.setPhone('9876543210'))
    await act(async () => { await result.current.handleResend() })
    expect(result.current.info).toBe('OTP resent.')
    expect(result.current.otp).toBe('')
  })
})
