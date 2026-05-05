/**
 * CollegeFeePayment — shown when a student's application is approved / document_verification / confirmed.
 * Student can pay any amount up to the remaining balance (partial payments allowed).
 * Shows total fee, amount due now (set by college), and paid/remaining amounts.
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
  const [payError, setPayError]     = useState('')
  const [paidMsg, setPaidMsg]       = useState('')
  const [inputAmount, setInputAmount] = useState('')
  const [showReceipts, setShowReceipts] = useState(false)

  function fetchStatus() {
    api.get(`payments/college-fee-status/${application.id}`)
      .then(r => {
        const data = r.data.data
        setFeeStatus(data)
        // Pre-fill input: if college set a "pay now" amount and nothing paid yet, use it;
        // otherwise pre-fill with remaining balance.
        if (data) {
          const prefill = data.total_paid <= 0 && data.fee_pay_now_amount
            ? data.fee_pay_now_amount
            : data.remaining
          if (prefill > 0) setInputAmount(String(prefill))
        }
      })
      .catch(() => setPayError('Failed to load fee details.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchStatus() }, [application.id])

  // ── Pay an amount (partial or full) ─────────────────────
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
      <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
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
        {fs.total_fee === 0 ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            The college has not yet entered the fee details. Please contact the college.
          </div>
        ) : (
          <>
            <div className={`grid gap-2 sm:gap-3 text-sm ${fs.fee_pay_now_amount && fs.fee_pay_now_amount < fs.total_fee - 0.01 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
              <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-center">
                <p className="text-xs text-slate-400">Total Fee</p>
                <p className="font-bold text-slate-950 mt-0.5">₹{Number(fs.total_fee).toLocaleString('en-IN')}</p>
              </div>
              {fs.fee_pay_now_amount && fs.fee_pay_now_amount < fs.total_fee - 0.01 && (
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-center">
                  <p className="text-xs text-slate-400">Due Now</p>
                  <p className="font-bold text-blue-700 mt-0.5">₹{Number(fs.fee_pay_now_amount).toLocaleString('en-IN')}</p>
                </div>
              )}
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-center">
                <p className="text-xs text-slate-400">Paid</p>
                <p className="font-bold text-emerald-700 mt-0.5">₹{Number(fs.total_paid).toLocaleString('en-IN')}</p>
              </div>
              <div className={`rounded-lg border p-3 text-center ${fs.remaining > 0 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                <p className="text-xs text-slate-400">Remaining</p>
                <p className={`font-bold mt-0.5 ${fs.remaining > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                  ₹{Number(fs.remaining).toLocaleString('en-IN')}
                </p>
              </div>
            </div>
            {fs.fee_pay_now_amount && fs.fee_pay_now_amount < fs.total_fee - 0.01 && fs.total_paid <= 0 && (
              <p className="text-xs text-slate-500">
                Your total fee is ₹{Number(fs.total_fee).toLocaleString('en-IN')}. The college requires you to pay ₹{Number(fs.fee_pay_now_amount).toLocaleString('en-IN')} now; the remaining ₹{Number(fs.total_fee - fs.fee_pay_now_amount).toLocaleString('en-IN')} can be paid later.
              </p>
            )}
          </>
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

        {/* ── Payment input ── */}
        {!allPaid && fs.total_fee > 0 && (
          <div className="space-y-3">
            {true && (
              <>
                <p className="text-sm text-slate-600">
                  Enter the amount to pay now.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
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
                    disabled={!inputAmount || parseFloat(inputAmount) <= 0 || paying || scriptError}
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
