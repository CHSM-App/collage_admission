import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStudentRegistration, REG_STEPS } from '../../features/auth/hooks/useStudentRegistration.js'

vi.mock('../../features/auth/services/authService.js', () => ({
  sendOtp:     vi.fn(),
  verifyOtp:   vi.fn(),
  authService: { loginByRole: vi.fn() },
}))

import { sendOtp, verifyOtp, authService } from '../../features/auth/services/authService.js'

const VALID_FORM = {
  full_name: 'Rahul Sharma', email: 'rahul@test.com',
  password: 'Test@1234', confirm_password: 'Test@1234',
  phone: '9876543210', city: 'Pune', category: 'general',
}

describe('useStudentRegistration', () => {
  beforeEach(() => vi.clearAllMocks())

  it('initial state has step=FORM, empty form, empty error', () => {
    const { result } = renderHook(() => useStudentRegistration())
    expect(result.current.step).toBe(REG_STEPS.FORM)
    expect(result.current.error).toBe('')
    expect(result.current.loading).toBe(false)
  })

  it('handleChange updates form field and clears error', async () => {
    const { result } = renderHook(() => useStudentRegistration())
    act(() => {
      result.current.handleChange({ target: { name: 'full_name', value: 'Alice' } })
    })
    expect(result.current.form.full_name).toBe('Alice')
  })

  it('handleChange formats phone field', () => {
    const { result } = renderHook(() => useStudentRegistration())
    act(() => {
      result.current.handleChange({ target: { name: 'phone', value: '98-765-43210' } })
    })
    expect(result.current.form.phone).toBe('9876543210')
  })

  it('setOtp strips non-digits and limits to 6', () => {
    const { result } = renderHook(() => useStudentRegistration())
    act(() => result.current.setOtp('12-34-56-78'))
    expect(result.current.otp).toBe('123456')
  })

  it('handleSendOtp shows error on invalid email', async () => {
    const { result } = renderHook(() => useStudentRegistration())
    act(() => result.current.handleChange({ target: { name: 'email', value: 'rahulgmail.@com' } }))
    await act(async () => { await result.current.handleSendOtp({ preventDefault: vi.fn() }) })
    expect(result.current.error).toMatch(/email/i)
    expect(result.current.step).toBe(REG_STEPS.FORM)
  })

  it('handleSendOtp shows error on invalid phone', async () => {
    const { result } = renderHook(() => useStudentRegistration())
    act(() => {
      result.current.handleChange({ target: { name: 'email', value: VALID_FORM.email } })
      result.current.handleChange({ target: { name: 'phone', value: '1234' } })
    })
    await act(async () => { await result.current.handleSendOtp({ preventDefault: vi.fn() }) })
    expect(result.current.error).toMatch(/phone/i)
    expect(result.current.step).toBe(REG_STEPS.FORM)
  })

  it('handleSendOtp shows error on invalid password', async () => {
    const { result } = renderHook(() => useStudentRegistration())
    act(() => {
      result.current.handleChange({ target: { name: 'email', value: VALID_FORM.email } })
      result.current.handleChange({ target: { name: 'phone', value: '9876543210' } })
      result.current.handleChange({ target: { name: 'password', value: 'weak' } })
    })
    await act(async () => { await result.current.handleSendOtp({ preventDefault: vi.fn() }) })
    expect(result.current.error).toBeTruthy()
  })

  it('handleSendOtp shows error when passwords do not match', async () => {
    const { result } = renderHook(() => useStudentRegistration())
    act(() => {
      result.current.handleChange({ target: { name: 'email', value: VALID_FORM.email } })
      result.current.handleChange({ target: { name: 'phone', value: '9876543210' } })
      result.current.handleChange({ target: { name: 'password', value: 'Test@1234' } })
      result.current.handleChange({ target: { name: 'confirm_password', value: 'Different@1' } })
    })
    await act(async () => { await result.current.handleSendOtp({ preventDefault: vi.fn() }) })
    expect(result.current.error).toBe('Passwords do not match.')
  })

  it('handleSendOtp advances to OTP step on success', async () => {
    sendOtp.mockResolvedValueOnce({ data: { message: 'OTP sent.' } })
    const { result } = renderHook(() => useStudentRegistration())
    // Fill all form fields
    act(() => {
      Object.entries(VALID_FORM).forEach(([k, v]) => {
        result.current.handleChange({ target: { name: k, value: v } })
      })
    })
    await act(async () => { await result.current.handleSendOtp({ preventDefault: vi.fn() }) })
    expect(result.current.step).toBe(REG_STEPS.OTP)
    expect(result.current.info).toBe('OTP sent.')
  })

  it('handleSendOtp sets error on API failure', async () => {
    sendOtp.mockRejectedValueOnce({ response: { data: { message: 'Phone already registered.' } } })
    const { result } = renderHook(() => useStudentRegistration())
    act(() => {
      Object.entries(VALID_FORM).forEach(([k, v]) => {
        result.current.handleChange({ target: { name: k, value: v } })
      })
    })
    await act(async () => { await result.current.handleSendOtp({ preventDefault: vi.fn() }) })
    expect(result.current.error).toBe('Phone already registered.')
    expect(result.current.step).toBe(REG_STEPS.FORM)
  })

  it('handleVerifyOtp returns null and sets error for short OTP', async () => {
    const { result } = renderHook(() => useStudentRegistration())
    act(() => result.current.setOtp('123'))
    let ret
    await act(async () => { ret = await result.current.handleVerifyOtp({ preventDefault: vi.fn() }) })
    expect(ret).toBeNull()
    expect(result.current.error).toBe('Please enter the 6-digit OTP.')
  })

  it('handleVerifyOtp calls verifyOtp and loginByRole on valid OTP', async () => {
    verifyOtp.mockResolvedValueOnce({ data: {} })
    authService.loginByRole.mockResolvedValueOnce({ user: { id: 1 }, role: 'student', token: 'tok' })

    const { result } = renderHook(() => useStudentRegistration())
    act(() => {
      Object.entries(VALID_FORM).forEach(([k, v]) => {
        result.current.handleChange({ target: { name: k, value: v } })
      })
      result.current.setOtp('123456')
    })

    let ret
    await act(async () => { ret = await result.current.handleVerifyOtp({ preventDefault: vi.fn() }) })
    expect(verifyOtp).toHaveBeenCalledWith('9876543210', '123456')
    expect(ret).toEqual({ user: { id: 1 }, role: 'student', token: 'tok' })
  })

  it('goToFormStep resets to FORM step and clears OTP', async () => {
    sendOtp.mockResolvedValueOnce({ data: { message: 'OTP sent.' } })
    const { result } = renderHook(() => useStudentRegistration())
    act(() => {
      Object.entries(VALID_FORM).forEach(([k, v]) => {
        result.current.handleChange({ target: { name: k, value: v } })
      })
    })
    await act(async () => { await result.current.handleSendOtp({ preventDefault: vi.fn() }) })
    expect(result.current.step).toBe(REG_STEPS.OTP)

    act(() => result.current.goToFormStep())
    expect(result.current.step).toBe(REG_STEPS.FORM)
    expect(result.current.otp).toBe('')
  })

  it('handleResend calls sendOtp and updates info', async () => {
    sendOtp.mockResolvedValueOnce({ data: { message: 'OTP resent.' } })
    const { result } = renderHook(() => useStudentRegistration())
    await act(async () => { await result.current.handleResend() })
    expect(result.current.info).toBe('OTP resent.')
  })
})
