import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useApplicationSubmit } from '../../features/student/hooks/useApplicationSubmit.js'

// Mock Razorpay
const mockOpenCheckout = vi.fn()
vi.mock('../../shared/hooks/useRazorpay.js', () => ({
  useRazorpay: () => ({ openCheckout: mockOpenCheckout, scriptError: null }),
}))

// Mock application service
vi.mock('../../services/applicationService.js', () => ({
  acceptDeclaration:   vi.fn(),
  resubmitApplication: vi.fn(),
}))

// Mock payment service
vi.mock('../../services/paymentService.js', () => ({
  createOrder:   vi.fn(),
  verifyPayment: vi.fn(),
}))

import { acceptDeclaration, resubmitApplication } from '../../services/applicationService.js'
import { createOrder, verifyPayment } from '../../services/paymentService.js'

describe('useApplicationSubmit', () => {
  beforeEach(() => vi.clearAllMocks())

  it('initial state: processing=false, no error, no regNum', () => {
    const { result } = renderHook(() => useApplicationSubmit(1))
    expect(result.current.processing).toBe(false)
    expect(result.current.submitError).toBe('')
    expect(result.current.registrationNumber).toBeNull()
    expect(result.current.resubmitted).toBe(false)
  })

  it('handleSubmit does nothing if accepted=false', async () => {
    const { result } = renderHook(() => useApplicationSubmit(1))
    await act(async () => { await result.current.handleSubmit(false) })
    expect(acceptDeclaration).not.toHaveBeenCalled()
  })

  it('handleSubmit calls acceptDeclaration, createOrder, and openCheckout', async () => {
    acceptDeclaration.mockResolvedValueOnce({ data: {} })
    createOrder.mockResolvedValueOnce({
      data: { data: { id: 'order_test', amount: 20000 } },
    })

    const { result } = renderHook(() => useApplicationSubmit(42))
    await act(async () => { await result.current.handleSubmit(true) })

    expect(acceptDeclaration).toHaveBeenCalledWith(42, { accepted: true })
    expect(createOrder).toHaveBeenCalledWith({
      application_id: 42,
      payment_type:   'application_fee',
    })
    expect(mockOpenCheckout).toHaveBeenCalled()
  })

  it('handleSubmit onSuccess calls verifyPayment and sets registrationNumber', async () => {
    acceptDeclaration.mockResolvedValueOnce({ data: {} })
    createOrder.mockResolvedValueOnce({ data: { data: { id: 'order_x' } } })
    verifyPayment.mockResolvedValueOnce({
      data: { data: { registration_number: 'REG2024001' } },
    })

    mockOpenCheckout.mockImplementation(({ onSuccess }) => {
      onSuccess({
        razorpay_order_id:   'order_x',
        razorpay_payment_id: 'pay_abc',
        razorpay_signature:  'sig_xyz',
      })
    })

    const { result } = renderHook(() => useApplicationSubmit(42))
    await act(async () => { await result.current.handleSubmit(true) })

    expect(verifyPayment).toHaveBeenCalledWith({
      application_id:      42,
      payment_type:        'application_fee',
      razorpay_order_id:   'order_x',
      razorpay_payment_id: 'pay_abc',
      razorpay_signature:  'sig_xyz',
    })
    expect(result.current.registrationNumber).toBe('REG2024001')
    expect(result.current.processing).toBe(false)
  })

  it('handleSubmit onSuccess sets submitError if verifyPayment fails', async () => {
    acceptDeclaration.mockResolvedValueOnce({ data: {} })
    createOrder.mockResolvedValueOnce({ data: { data: { id: 'order_x' } } })
    verifyPayment.mockRejectedValueOnce({
      response: { data: { message: 'Signature mismatch.' } },
    })

    mockOpenCheckout.mockImplementation(({ onSuccess }) => {
      onSuccess({ razorpay_order_id: 'o', razorpay_payment_id: 'p', razorpay_signature: 's' })
    })

    const { result } = renderHook(() => useApplicationSubmit(42))
    await act(async () => { await result.current.handleSubmit(true) })

    expect(result.current.submitError).toBe('Signature mismatch.')
  })

  it('handleSubmit onFailure sets submitError for non-cancel errors', async () => {
    acceptDeclaration.mockResolvedValueOnce({ data: {} })
    createOrder.mockResolvedValueOnce({ data: { data: { id: 'order_x' } } })

    mockOpenCheckout.mockImplementation(({ onFailure }) => {
      onFailure({ message: 'Payment gateway timeout.' })
    })

    const { result } = renderHook(() => useApplicationSubmit(42))
    await act(async () => { await result.current.handleSubmit(true) })

    expect(result.current.submitError).toBe('Payment gateway timeout.')
  })

  it('handleSubmit onFailure ignores cancel message', async () => {
    acceptDeclaration.mockResolvedValueOnce({ data: {} })
    createOrder.mockResolvedValueOnce({ data: { data: { id: 'order_x' } } })

    mockOpenCheckout.mockImplementation(({ onFailure }) => {
      onFailure({ message: 'Payment cancelled by user.' })
    })

    const { result } = renderHook(() => useApplicationSubmit(42))
    await act(async () => { await result.current.handleSubmit(true) })

    expect(result.current.submitError).toBe('')
  })

  it('handleSubmit sets submitError when acceptDeclaration fails', async () => {
    acceptDeclaration.mockRejectedValueOnce({
      response: { data: { message: 'Declaration required.' } },
    })

    const { result } = renderHook(() => useApplicationSubmit(42))
    await act(async () => { await result.current.handleSubmit(true) })

    expect(result.current.submitError).toBe('Declaration required.')
    expect(result.current.processing).toBe(false)
  })

  it('handleResubmit does nothing if accepted=false', async () => {
    const { result } = renderHook(() => useApplicationSubmit(1))
    await act(async () => { await result.current.handleResubmit(false) })
    expect(acceptDeclaration).not.toHaveBeenCalled()
  })

  it('handleResubmit calls acceptDeclaration and resubmitApplication', async () => {
    acceptDeclaration.mockResolvedValueOnce({ data: {} })
    resubmitApplication.mockResolvedValueOnce({ data: { message: 'Resubmitted.' } })

    const { result } = renderHook(() => useApplicationSubmit(42))
    await act(async () => { await result.current.handleResubmit(true) })

    expect(acceptDeclaration).toHaveBeenCalledWith(42, { accepted: true })
    expect(resubmitApplication).toHaveBeenCalledWith(42)
    expect(result.current.resubmitted).toBe(true)
    expect(result.current.processing).toBe(false)
  })

  it('handleResubmit sets submitError on failure', async () => {
    acceptDeclaration.mockResolvedValueOnce({ data: {} })
    resubmitApplication.mockRejectedValueOnce({
      response: { data: { message: 'Resubmit window closed.' } },
    })

    const { result } = renderHook(() => useApplicationSubmit(42))
    await act(async () => { await result.current.handleResubmit(true) })

    expect(result.current.submitError).toBe('Resubmit window closed.')
    expect(result.current.resubmitted).toBe(false)
  })
})
