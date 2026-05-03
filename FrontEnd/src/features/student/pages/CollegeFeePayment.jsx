/**
 * CollegeFeePayment — shown when a student's application is approved / document_verification / confirmed.
 * Student can pay any amount up to the remaining balance (partial payments allowed).
 * If college has set up an installment plan, shows the plan instead of free-form input.
 */
import { useEffect, useState } from 'react'
import api from '../../../services/api.js'
import { useRazorpay } from '../../../shared/hooks/useRazorpay.js'
import Button from '../../../shared/components/Button.jsx'
import PaymentReceipts from './PaymentReceipts.jsx'

export default function CollegeFeePayment({ application, onDone, onCancel }) {
  const { openCheckout, scriptError } = useRazorpay()

  const [feeStatus, setFeeStatus] = useState(null)
  const [loading, setLoading]       = useState(true)
  const [paying, setPaying]         = useState(false)
  const [payingId, setPayingId]     = useState(null)
  const [payError, setPayError]     = useState('')
  const [paidMsg, setPaidMsg]       = useState('')
  const [inputAmount, setInputAmount] = useState('')
  const [showReceipts, setShowReceipts] = useState(false)

  function fetchStatus() {
    api.get(`payments/college-fee-status/${application.id}`)
      .then(r => {
        const data = r.data.data
        setFeeStatus(data)
        // Pre-fill input with remaining amount
        if (data && !data.has_installment_plan && data.remaining > 0) {
          setInputAmount(String(data.remaining))
        }
      })
      .catch(() => setPayError('Failed to load fee details.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchStatus() }, [application.id])

  // ── Pay a fixed installment ──────────────────────────────
  async function payInstallment(installmentPlanId) {
    setPayError('')
    setPaidMsg('')
    setPayingId(installmentPlanId)

    try {
      const orderRes = await api.post('payments/create-order', {
        application_id:      application.id,
        payment_type:        'college_fee_installment',
        installment_plan_id: installmentPlanId,
      })
      const orderData = orderRes.data.data
      setPayingId(null)

      openCheckout({
        orderData,
        onSuccess: async (rzpResponse) => {
          setPayingId(installmentPlanId)
          try {
            const verifyRes = await api.post('payments/verify', {
              application_id:       application.id,
              payment_type:         'college_fee_installment',
              installment_plan_id:  installmentPlanId,
              razorpay_order_id:    rzpResponse.razorpay_order_id,
              razorpay_payment_id:  rzpResponse.razorpay_payment_id,
              razorpay_signature:   rzpResponse.razorpay_signature,
            })
            setPaidMsg(verifyRes.data.message)
            setShowReceipts(true)
            fetchStatus()
            if (verifyRes.data.data?.all_paid) setTimeout(onDone, 2000)
          } catch (err) {
            setPayError(err?.response?.data?.message || 'Payment verification failed.')
          } finally { setPayingId(null) }
        },
        onFailure: (err) => {
          setPayingId(null)
          if (err.message !== 'Payment cancelled by user.') setPayError(err.message)
        },
      })
    } catch (err) {
      setPayError(err?.response?.data?.message || 'Could not initiate payment.')
      setPayingId(null)
    }
  }

  // ── Pay a custom amount (partial or full) ────────────────
  async function payCustomAmount() {
    const amt = parseFloat(inputAmount)
    if (!amt || amt <= 0) {
      setPayError('Enter a valid amount.')
      return
    }
    if (feeStatus && amt > feeStatus.remaining + 0.01) {
      setPayError(`Amount cannot exceed remaining balance of ₹${Number(feeStatus.remaining).toLocaleString('en-IN')}.`)
      return
    }

    setPayError('')
    setPaidMsg('')
    setPaying(true)

    try {
      const orderRes = await api.post('payments/create-order', {
        application_id: application.id,
        payment_type:   'college_fee',
        amount:         amt,
      })
      const orderData = orderRes.data.data
      setPaying(false)

      openCheckout({
        orderData,
        onSuccess: async (rzpResponse) => {
          setPaying(true)
          try {
            const verifyRes = await api.post('payments/verify', {
              application_id:      application.id,
              payment_type:        'college_fee',
              razorpay_order_id:   rzpResponse.razorpay_order_id,
              razorpay_payment_id: rzpResponse.razorpay_payment_id,
              razorpay_signature:  rzpResponse.razorpay_signature,
            })
            setPaidMsg(verifyRes.data.message)
            setShowReceipts(true)
            fetchStatus()
            if (verifyRes.data.data?.all_paid) setTimeout(onDone, 2000)
          } catch (err) {
            setPayError(err?.response?.data?.message || 'Payment verification failed.')
          } finally { setPaying(false) }
        },
        onFailure: (err) => {
          setPaying(false)
          if (err.message !== 'Payment cancelled by user.') setPayError(err.message)
        },
      })
    } catch (err) {
      setPayError(err?.response?.data?.message || 'Could not initiate payment.')
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
        <div className="h-4 w-40 bg-slate-100 rounded animate-pulse" />
        <div className="h-4 w-64 bg-slate-100 rounded animate-pulse" />
      </div>
    )
  }

  if (!feeStatus) return null

  const fs     = feeStatus
  const allPaid = fs.college_fee_paid || fs.remaining <= 0

  return (
    <div className="rounded-xl border border-emerald-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="bg-emerald-50 border-b border-emerald-100 px-5 py-4 flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-emerald-900">College Fee Payment</p>
          <p className="text-sm text-emerald-700 mt-0.5">{application.college_name} · {application.course_name}</p>
        </div>
        {allPaid
          ? <span className="rounded-full bg-emerald-600 text-white text-xs font-bold px-3 py-1">Fully Paid</span>
          : <span className="rounded-full bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1">Payment Pending</span>
        }
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Fee summary */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-center">
            <p className="text-xs text-slate-400">Total Fee</p>
            <p className="font-bold text-slate-950 mt-0.5">
              {fs.total_fee > 0 ? `₹${Number(fs.total_fee).toLocaleString('en-IN')}` : '—'}
            </p>
          </div>
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-center">
            <p className="text-xs text-slate-400">Paid</p>
            <p className="font-bold text-emerald-700 mt-0.5">₹{Number(fs.total_paid).toLocaleString('en-IN')}</p>
          </div>
          <div className={`rounded-lg border p-3 text-center ${fs.remaining > 0 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
            <p className="text-xs text-slate-400">Remaining</p>
            <p className={`font-bold mt-0.5 ${fs.remaining > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
              {fs.total_fee > 0 ? `₹${Number(fs.remaining).toLocaleString('en-IN')}` : '—'}
            </p>
          </div>
        </div>

        {/* Fee breakdown */}
        {fs.fee_breakdown && fs.total_fee > 0 && (
          <div className="text-xs text-slate-500 flex gap-4 flex-wrap">
            <span>Tuition: ₹{Number(fs.fee_breakdown.tuition_fee).toLocaleString('en-IN')}</span>
            <span>Exam: ₹{Number(fs.fee_breakdown.exam_fee).toLocaleString('en-IN')}</span>
            <span>Other: ₹{Number(fs.fee_breakdown.other_fee).toLocaleString('en-IN')}</span>
          </div>
        )}

        {paidMsg && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 font-medium">
            {paidMsg}
          </div>
        )}
        {payError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{payError}</div>
        )}
        {scriptError && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
            Payment gateway could not be loaded. Check your internet connection.
          </div>
        )}

        {/* ── Installment plan (college-defined) ── */}
        {fs.has_installment_plan && !allPaid && (
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Pay by Installment</p>
            <div className="space-y-2">
              {fs.installments.map(ins => (
                <div
                  key={ins.id}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                    ins.is_paid ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'
                  }`}
                >
                  <div>
                    <p className={`text-sm font-semibold ${ins.is_paid ? 'text-emerald-700' : 'text-slate-900'}`}>
                      {ins.installment_no}. {ins.label}
                    </p>
                    <div className="flex gap-3 text-xs text-slate-400 mt-0.5">
                      <span>₹{Number(ins.amount).toLocaleString('en-IN')}</span>
                      {ins.due_date && <span>Due: {new Date(ins.due_date).toLocaleDateString('en-IN')}</span>}
                      {ins.is_paid && ins.paid_at && (
                        <span className="text-emerald-600">Paid on {new Date(ins.paid_at).toLocaleDateString('en-IN')}</span>
                      )}
                    </div>
                  </div>
                  {ins.is_paid ? (
                    <span className="text-emerald-600 text-sm font-bold">✓ Paid</span>
                  ) : (
                    <Button
                      onClick={() => payInstallment(ins.id)}
                      loading={payingId === ins.id}
                      disabled={!!payingId || !!paying || scriptError}
                    >
                      Pay ₹{Number(ins.amount).toLocaleString('en-IN')}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Free-form partial payment (no installment plan) ── */}
        {!fs.has_installment_plan && !allPaid && (
          <div className="space-y-3">
            {fs.total_fee === 0 ? (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                Fee amount not configured by the college. Please contact them directly.
              </p>
            ) : (
              <>
                <p className="text-sm text-slate-600">
                  Enter any amount to pay now. You can pay in multiple partial payments.
                </p>
                <div className="flex gap-3 items-start">
                  <div className="flex-1">
                    <div className="flex items-center rounded-lg border border-slate-300 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500">
                      <span className="px-3 text-slate-500 font-semibold text-sm border-r border-slate-200 bg-slate-50 py-2.5">₹</span>
                      <input
                        type="number"
                        min="1"
                        max={fs.remaining}
                        step="1"
                        value={inputAmount}
                        onChange={e => { setInputAmount(e.target.value); setPayError('') }}
                        placeholder={`Max ₹${Number(fs.remaining).toLocaleString('en-IN')}`}
                        className="flex-1 px-3 py-2.5 text-sm outline-none bg-transparent"
                      />
                    </div>
                    <div className="flex gap-2 mt-1.5">
                      {[25, 50, 100].map(pct => {
                        const amt = Math.round(fs.remaining * pct / 100)
                        return amt > 0 ? (
                          <button
                            key={pct}
                            onClick={() => setInputAmount(String(amt))}
                            className="text-xs text-emerald-600 hover:underline font-semibold"
                          >
                            {pct}% (₹{amt.toLocaleString('en-IN')})
                          </button>
                        ) : null
                      })}
                      <button
                        onClick={() => setInputAmount(String(fs.remaining))}
                        className="text-xs text-emerald-600 hover:underline font-semibold"
                      >
                        Pay full
                      </button>
                    </div>
                  </div>
                  <Button
                    onClick={payCustomAmount}
                    loading={paying}
                    disabled={!inputAmount || parseFloat(inputAmount) <= 0 || paying || !!payingId || scriptError}
                    className="shrink-0"
                  >
                    Pay Now
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Already fully paid */}
        {allPaid && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
            All fees have been paid. Your application will be processed for roll number assignment.
          </div>
        )}

        {/* Receipts toggle */}
        <div className="border-t border-slate-100 pt-3 space-y-3">
          <button
            onClick={() => setShowReceipts(v => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            {showReceipts ? 'Hide Receipts' : 'View Payment Receipts'}
          </button>

          {showReceipts && (
            <PaymentReceipts
              applicationId={application.id}
              onClose={() => setShowReceipts(false)}
            />
          )}
        </div>

        <div className="flex justify-end">
          <button onClick={onCancel} className="text-sm text-slate-400 hover:text-slate-600">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
