import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'
import { useCollegePayment } from '../../shared/hooks/useCollegePayment.js'

// Mock Razorpay
const mockOpenCheckout = vi.fn()
vi.mock('../../shared/hooks/useRazorpay.js', () => ({
  useRazorpay: () => ({ openCheckout: mockOpenCheckout, scriptError: null }),
}))

// Mock Toast
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()
vi.mock('../../context/ToastContext.jsx', () => ({
  useToast: () => ({ success: mockToastSuccess, error: mockToastError }),
}))

// Mock payment service
vi.mock('../../services/paymentService.js', () => ({
  getCollegeFeeStatus: vi.fn(),
  createOrder:         vi.fn(),
  verifyPayment:       vi.fn(),
}))

// Mock college admin service
vi.mock('../../services/collegeAdminService.js', () => ({
  recordCashPayment: vi.fn(),
}))

import { getCollegeFeeStatus, createOrder, verifyPayment } from '../../services/paymentService.js'
import { recordCashPayment } from '../../services/collegeAdminService.js'

const mockFeeStatus = {
  application_id: 1,
  college_fee_amount: 5000,
  college_fee_paid: false,
  payment_status: 'pending',
}

describe('useCollegePayment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCollegeFeeStatus.mockResolvedValue({ data: { data: mockFeeStatus } })
  })

  it('initial state: loading=true, feeStatus=null', () => {
    getCollegeFeeStatus.mockReturnValue(new Promise(() => {})) // pending
    const { result } = renderHook(() => useCollegePayment(1))
    expect(result.current.loading).toBe(true)
    expect(result.current.feeStatus).toBeNull()
  })

  it('fetches fee status on mount', async () => {
    const { result } = renderHook(() => useCollegePayment(1))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.feeStatus).toEqual(mockFeeStatus)
    expect(result.current.payError).toBe('')
  })

  it('sets payError if fetchStatus fails', async () => {
    getCollegeFeeStatus.mockRejectedValueOnce(new Error('Network error'))
    const { result } = renderHook(() => useCollegePayment(1))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.payError).toBe('Failed to load fee details.')
  })

  it('payOnline sets error if amount is invalid', async () => {
    const { result } = renderHook(() => useCollegePayment(1))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.payOnline(0) })
    expect(result.current.payError).toBe('Invalid payment amount.')
  })

  it('payOnline creates order and opens checkout', async () => {
    createOrder.mockResolvedValueOnce({
      data: { data: { id: 'order_123', amount: 50000, currency: 'INR' } },
    })

    const { result } = renderHook(() => useCollegePayment(1))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.payOnline(500) })

    expect(createOrder).toHaveBeenCalledWith({
      application_id: 1,
      payment_type:   'college_fee',
      amount:         500,
    })
    expect(mockOpenCheckout).toHaveBeenCalled()
  })

  it('payOnline onSuccess calls verifyPayment and sets paidMsg', async () => {
    createOrder.mockResolvedValueOnce({
      data: { data: { id: 'order_123', amount: 50000 } },
    })
    verifyPayment.mockResolvedValueOnce({
      data: { message: 'Payment verified.', data: {} },
    })
    // Re-fetch after success
    getCollegeFeeStatus.mockResolvedValue({ data: { data: { ...mockFeeStatus, college_fee_paid: true } } })

    mockOpenCheckout.mockImplementation(({ onSuccess }) => {
      onSuccess({
        razorpay_order_id:   'order_123',
        razorpay_payment_id: 'pay_abc',
        razorpay_signature:  'sig_xyz',
      })
    })

    const { result } = renderHook(() => useCollegePayment(1))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.payOnline(500) })

    expect(verifyPayment).toHaveBeenCalled()
    expect(mockToastSuccess).toHaveBeenCalledWith('Payment verified.')
    expect(result.current.paidMsg).toBe('Payment verified.')
  })

  it('payOnline onFailure sets payError (non-cancel)', async () => {
    createOrder.mockResolvedValueOnce({ data: { data: { id: 'order_123' } } })

    mockOpenCheckout.mockImplementation(({ onFailure }) => {
      onFailure({ message: 'Payment failed due to network.' })
    })

    const { result } = renderHook(() => useCollegePayment(1))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.payOnline(500) })

    expect(result.current.payError).toBe('Payment failed due to network.')
    expect(mockToastError).toHaveBeenCalled()
  })

  it('payOnline onFailure ignores cancel message', async () => {
    createOrder.mockResolvedValueOnce({ data: { data: { id: 'order_123' } } })

    mockOpenCheckout.mockImplementation(({ onFailure }) => {
      onFailure({ message: 'Payment cancelled by user.' })
    })

    const { result } = renderHook(() => useCollegePayment(1))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.payOnline(500) })

    expect(result.current.payError).toBe('')
  })

  it('payOnline sets error when createOrder fails', async () => {
    createOrder.mockRejectedValueOnce({
      response: { data: { message: 'Order creation failed.' } },
    })

    const { result } = renderHook(() => useCollegePayment(1))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.payOnline(500) })

    expect(result.current.payError).toBe('Order creation failed.')
    expect(mockToastError).toHaveBeenCalledWith('Order creation failed.')
  })

  it('payCash returns false and sets error for invalid amount', async () => {
    const { result } = renderHook(() => useCollegePayment(1, 10))
    await waitFor(() => expect(result.current.loading).toBe(false))

    let ret
    await act(async () => { ret = await result.current.payCash({ amount: 0 }) })
    expect(ret).toBe(false)
    expect(result.current.payError).toBe('Enter a valid amount.')
  })

  it('payCash records payment and sets paidMsg on success', async () => {
    recordCashPayment.mockResolvedValueOnce({ data: { message: 'Cash payment recorded.' } })

    const { result } = renderHook(() => useCollegePayment(1, 10))
    await waitFor(() => expect(result.current.loading).toBe(false))

    let ret
    await act(async () => {
      ret = await result.current.payCash({ amount: 1000, note: 'DD payment' })
    })

    expect(recordCashPayment).toHaveBeenCalledWith(10, 1, { amount: 1000, note: 'DD payment' })
    expect(ret).toBe(true)
    expect(result.current.paidMsg).toBe('Cash payment recorded.')
    expect(mockToastSuccess).toHaveBeenCalledWith('Cash payment recorded.')
  })

  it('payCash returns false and sets payError on API failure', async () => {
    recordCashPayment.mockRejectedValueOnce({
      response: { data: { message: 'Insufficient records.' } },
    })

    const { result } = renderHook(() => useCollegePayment(1, 10))
    await waitFor(() => expect(result.current.loading).toBe(false))

    let ret
    await act(async () => { ret = await result.current.payCash({ amount: 500 }) })
    expect(ret).toBe(false)
    expect(result.current.payError).toBe('Insufficient records.')
  })

  it('payCash calls onPaid callback on success', async () => {
    recordCashPayment.mockResolvedValueOnce({ data: { message: 'Recorded.' } })
    const onPaid = vi.fn()

    const { result } = renderHook(() => useCollegePayment(1, 10, { onPaid }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.payCash({ amount: 500 }) })
    expect(onPaid).toHaveBeenCalled()
  })
})
