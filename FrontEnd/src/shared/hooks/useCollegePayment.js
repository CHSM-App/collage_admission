/**
 * useCollegePayment — orchestrates college-fee payment (online via PayU or cash).
 *
 * Usage (online-only callers like CollegeFeePayment):
 *   const { feeStatus, loading, paying, payError, paidMsg, fetchStatus, payOnline } = useCollegePayment(appId)
 *
 * Usage (cash + online callers like CollegePayPanel / CollegeFeePanel):
 *   const { feeStatus, loading, paying, payError, paidMsg, fetchStatus, payOnline, payCash } = useCollegePayment(appId, collegeId, { onPaid })
 *
 * PayU uses a redirect flow — payOnline() redirects the browser to PayU.
 * The browser returns to /payment-result after success/failure.
 */
import { useEffect, useState } from 'react'
import { usePayU } from './usePayU.js'
import { useToast } from '../../context/ToastContext.jsx'
import { getCollegeFeeStatus, initiatePayment } from '../../services/paymentService.js'
import { recordCashPayment } from '../../services/collegeAdminService.js'

/**
 * @param {string|number} appId  - application ID
 * @param {string|number} [collegeId] - required only for cash payments (recordCashPayment)
 * @param {{ onPaid?: () => void }} [options]
 */
export function useCollegePayment(appId, collegeId, options = {}) {
  const { onPaid } = options
  const { redirectToPayU } = usePayU()
  const toast = useToast()

  const [feeStatus, setFeeStatus] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [paying, setPaying]       = useState(false)
  const [payError, setPayError]   = useState('')
  const [paidMsg, setPaidMsg]     = useState('')

  function fetchStatus() {
    setLoading(true)
    getCollegeFeeStatus(appId)
      .then(r => setFeeStatus(r.data.data))
      .catch(() => setPayError('Failed to load fee details.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchStatus() }, [appId])

  /**
   * Pay online via PayU (browser redirect).
   * @param {number} amt - amount in rupees
   */
  async function payOnline(amt) {
    if (!amt || amt <= 0) { setPayError('Invalid payment amount.'); return }
    setPayError(''); setPaidMsg(''); setPaying(true)

    try {
      const res = await initiatePayment({
        application_id: appId,
        payment_type:   'college_fee',
        amount:         amt,
      })
      const { endpoint, fields } = res.data.data

      // Redirects the browser to PayU — no return from here.
      redirectToPayU({ endpoint, fields })
    } catch (err) {
      const msg = err?.response?.data?.message || 'Could not initiate payment.'
      setPayError(msg); toast.error(msg)
      setPaying(false)
    }
  }

  /**
   * Record a cash/offline payment (requires collegeId).
   * @param {{ amount: number, note?: string }} data
   * @param {{ onSuccess?: (msg: string) => void }} [opts]
   */
  async function payCash(data, opts = {}) {
    const { amount: amt, note } = data
    if (!amt || amt <= 0) { setPayError('Enter a valid amount.'); return false }
    setPayError(''); setPaidMsg(''); setPaying(true)
    try {
      const res = await recordCashPayment(collegeId, appId, { amount: amt, note: note?.trim() || undefined })
      const msg = res.data.message
      toast.success(msg)
      setPaidMsg(msg)
      fetchStatus()
      onPaid?.()
      opts.onSuccess?.(msg)
      return true
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to record payment.'
      setPayError(msg); toast.error(msg)
      return false
    } finally { setPaying(false) }
  }

  return {
    feeStatus,
    loading,
    paying,
    payError,
    paidMsg,
    fetchStatus,
    payOnline,
    payCash,
    setPayError,
    setPaidMsg,
  }
}
