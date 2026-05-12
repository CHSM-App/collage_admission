/**
 * useApplicationSubmit — handles application submission (new) and resubmission (correction flow).
 *
 * New submit: acceptDeclaration → createOrder → openCheckout → verifyPayment → setRegNum
 * Resubmit:   acceptDeclaration → resubmitApplication → setResubmitted(true)
 */
import { useState } from 'react'
import { useRazorpay } from '../../../shared/hooks/useRazorpay.js'
import { acceptDeclaration, resubmitApplication } from '../../../services/applicationService.js'
import { createOrder, verifyPayment } from '../../../services/paymentService.js'

export function useApplicationSubmit(appId) {
  const { openCheckout, scriptError } = useRazorpay()

  const [processing, setProcessing]     = useState(false)
  const [submitError, setSubmitError]   = useState('')
  const [registrationNumber, setRegNum] = useState(null)
  const [resubmitted, setResubmitted]   = useState(false)

  // ── New application submit (pay first) ───────────────────
  async function handleSubmit(accepted) {
    if (!accepted) return
    setProcessing(true)
    setSubmitError('')

    try {
      await acceptDeclaration(appId, { accepted: true })

      const orderRes = await createOrder({
        application_id: appId,
        payment_type:   'application_fee',
      })
      const orderData = orderRes.data.data

      setProcessing(false)

      openCheckout({
        orderData,
        onSuccess: async (rzpResponse) => {
          setProcessing(true)
          try {
            const verifyRes = await verifyPayment({
              application_id:       appId,
              payment_type:         'application_fee',
              razorpay_order_id:    rzpResponse.razorpay_order_id,
              razorpay_payment_id:  rzpResponse.razorpay_payment_id,
              razorpay_signature:   rzpResponse.razorpay_signature,
            })
            setRegNum(verifyRes.data.data?.registration_number || '')
          } catch (err) {
            setSubmitError(err?.response?.data?.message || 'Payment verification failed.')
          } finally {
            setProcessing(false)
          }
        },
        onFailure: (err) => {
          if (err.message !== 'Payment cancelled by user.') {
            setSubmitError(err.message || 'Payment failed.')
          }
        },
      })
    } catch (err) {
      setSubmitError(err?.response?.data?.message || 'Submission failed. Please try again.')
      setProcessing(false)
    }
  }

  // ── Resubmit (correction flow — fee already paid) ────────
  async function handleResubmit(accepted) {
    if (!accepted) return
    setProcessing(true)
    setSubmitError('')
    try {
      await acceptDeclaration(appId, { accepted: true })
      await resubmitApplication(appId)
      setResubmitted(true)
    } catch (err) {
      setSubmitError(err?.response?.data?.message || 'Resubmit failed. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  return {
    processing,
    submitError,
    registrationNumber,
    resubmitted,
    scriptError,
    handleSubmit,
    handleResubmit,
  }
}
