import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useApplicationSubmit } from '../../features/student/hooks/useApplicationSubmit.js'

// Mock PayU hook
const mockRedirectToPayU = vi.fn()
vi.mock('../../shared/hooks/usePayU.js', () => ({
  usePayU: () => ({ redirectToPayU: mockRedirectToPayU }),
}))

// Mock application service
vi.mock('../../services/applicationService.js', () => ({
  acceptDeclaration:   vi.fn(),
  resubmitApplication: vi.fn(),
}))

// Mock payment service
vi.mock('../../services/paymentService.js', () => ({
  initiatePayment: vi.fn(),
}))

import { acceptDeclaration, resubmitApplication } from '../../services/applicationService.js'
import { initiatePayment } from '../../services/paymentService.js'

describe('useApplicationSubmit', () => {
  beforeEach(() => vi.clearAllMocks())

  it('initial state: processing=false, no error', () => {
    const { result } = renderHook(() => useApplicationSubmit(1))
    expect(result.current.processing).toBe(false)
    expect(result.current.submitError).toBe('')
    expect(result.current.resubmitted).toBe(false)
  })

  it('handleSubmit does nothing if accepted=false', async () => {
    const { result } = renderHook(() => useApplicationSubmit(1))
    await act(async () => { await result.current.handleSubmit(false) })
    expect(acceptDeclaration).not.toHaveBeenCalled()
  })

  it('handleSubmit calls acceptDeclaration, initiatePayment, and redirectToPayU', async () => {
    acceptDeclaration.mockResolvedValueOnce({ data: {} })
    initiatePayment.mockResolvedValueOnce({
      data: { data: { endpoint: 'https://test.payu.in/_payment', fields: { txnid: 'TXN-42' } } },
    })

    const { result } = renderHook(() => useApplicationSubmit(42))
    await act(async () => { await result.current.handleSubmit(true) })

    expect(acceptDeclaration).toHaveBeenCalledWith(42, { accepted: true })
    expect(initiatePayment).toHaveBeenCalledWith({
      application_id: 42,
      payment_type:   'application_fee',
    })
    expect(mockRedirectToPayU).toHaveBeenCalledWith({
      endpoint: 'https://test.payu.in/_payment',
      fields:   { txnid: 'TXN-42' },
    })
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

  it('handleSubmit sets submitError when initiatePayment fails', async () => {
    acceptDeclaration.mockResolvedValueOnce({ data: {} })
    initiatePayment.mockRejectedValueOnce({
      response: { data: { message: 'Payment initiation failed.' } },
    })

    const { result } = renderHook(() => useApplicationSubmit(42))
    await act(async () => { await result.current.handleSubmit(true) })

    expect(result.current.submitError).toBe('Payment initiation failed.')
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
