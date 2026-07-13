/**
 * useApplicationSubmit — handles application submission (new) and resubmission (correction flow).
 *
 * New submit: acceptDeclaration → initiatePayment → redirectToPayU (browser redirect)
 * Resubmit:   acceptDeclaration → resubmitApplication → setResubmitted(true)
 *
 * After PayU redirect, the browser returns to /payment-result which shows success/failure.
 */
import { useState } from 'react'
import { usePayU } from '../../../shared/hooks/usePayU.js'
import { acceptDeclaration, resubmitApplication, submitDirectApplication } from '../../../services/applicationService.js'
import { initiatePayment } from '../../../services/paymentService.js'

export function useApplicationSubmit(appId) {
  const { redirectToPayU } = usePayU()

  const [processing, setProcessing]     = useState(false)
  const [submitError, setSubmitError]   = useState('')
  const [resubmitted, setResubmitted]   = useState(false)

  // ── New application submit (pay first) ───────────────────
  async function handleSubmit(accepted) {
    if (!accepted) return
    setProcessing(true)
    setSubmitError('')

    try {
      await acceptDeclaration(appId, { accepted: true })

      const res = await initiatePayment({
        application_id: appId,
        payment_type:   'application_fee',
      })
      const { endpoint, fields } = res.data.data

      // Redirects the browser to PayU — no return from here.
      redirectToPayU({ endpoint, fields })
    } catch (err) {
      setSubmitError(err?.response?.data?.message || 'Submission failed. Please try again.')
      setProcessing(false)
    }
  }

  // ── Direct submit (no payment — platform_fee disabled) ───
  async function handleDirectSubmit(accepted) {
    if (!accepted) return
    setProcessing(true)
    setSubmitError('')
    try {
      await submitDirectApplication(appId, { accepted: true })
      setResubmitted(true)
    } catch (err) {
      setSubmitError(err?.response?.data?.message || 'Submission failed. Please try again.')
    } finally {
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
    resubmitted,
    handleSubmit,
    handleDirectSubmit,
    handleResubmit,
  }
}
