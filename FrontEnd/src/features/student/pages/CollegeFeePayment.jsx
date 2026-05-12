/**
 * CollegeFeePayment — shown when a student's application is approved / document_verification / confirmed.
 * Student can pay any amount up to the remaining balance (partial payments allowed).
 * Shows total fee, amount due now (set by college), and paid/remaining amounts.
 */
import { useState } from 'react'
import { useCollegePayment } from '../../../shared/hooks/useCollegePayment.js'
import Button from '../../../shared/components/Button.jsx'
import PaymentReceipts from './PaymentReceipts.jsx'

export default function CollegeFeePayment({ application, onDone, onCancel }) {
  const [showReceipts, setShowReceipts] = useState(false)

  const {
    feeStatus,
    loading,
    paying,
    payError,
    paidMsg,
    scriptError,
    payOnline,
  } = useCollegePayment(application.id)

  async function payCustomAmount() {
    const fs  = feeStatus
    const amt = parseFloat(fs?.total_paid > 0 ? fs?.remaining : (fs?.fee_pay_now_amount || fs?.remaining))
    await payOnline(amt, {
      onSuccess: (_msg, data) => {
        setShowReceipts(true)
        if (data?.all_paid) setTimeout(onDone, 1500)
      },
    })
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

  const fs         = feeStatus
  // Admission confirmed = first instalment paid (college_fee_paid=1) OR remaining=0
  const admitted   = fs.college_fee_paid || fs.remaining <= 0
  // Fully paid = nothing remaining
  const fullyPaid  = fs.remaining <= 0

  return (
    <div className="rounded-xl border border-emerald-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div>
          <p className="font-bold text-emerald-900">College Fee Payment</p>
          <p className="text-sm text-emerald-700 mt-0.5">{application.college_name} · {application.course_name}</p>
        </div>
        {fullyPaid
          ? <span className="rounded-full bg-emerald-600 text-white text-xs font-bold px-3 py-1">Fully Paid</span>
          : admitted
          ? <span className="rounded-full bg-teal-100 text-teal-700 text-xs font-bold px-3 py-1">Admission Confirmed</span>
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
            <div className={`grid gap-2 sm:gap-3 text-sm ${fs.remaining > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
              <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-center">
                <p className="text-xs text-slate-400">Total Fee</p>
                <p className="font-bold text-slate-950 mt-0.5">₹{Number(fs.total_fee).toLocaleString('en-IN')}</p>
              </div>
              {fs.remaining > 0 && (
                <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-center">
                  <p className="text-xs text-slate-400">Remaining</p>
                  <p className="font-bold text-amber-700 mt-0.5">₹{Number(fs.remaining).toLocaleString('en-IN')}</p>
                </div>
              )}
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-center">
                <p className="text-xs text-slate-400">Paid</p>
                <p className="font-bold text-emerald-700 mt-0.5">₹{Number(fs.total_paid).toLocaleString('en-IN')}</p>
              </div>
              <div className={`rounded-lg border p-3 text-center ${admitted ? 'bg-teal-50 border-teal-100' : 'bg-slate-50 border-slate-100'}`}>
                <p className="text-xs text-slate-400">Admission</p>
                <p className={`font-bold mt-0.5 text-sm ${admitted ? 'text-teal-700' : 'text-slate-400'}`}>
                  {admitted ? 'Confirmed' : 'Pending'}
                </p>
              </div>
            </div>
            {fs.fee_pay_now_amount && fs.fee_pay_now_amount < fs.total_fee - 0.01 && fs.total_paid <= 0 && (
              <p className="text-xs text-slate-500">
                Your total fee is ₹{Number(fs.total_fee).toLocaleString('en-IN')}. Pay ₹{Number(fs.fee_pay_now_amount).toLocaleString('en-IN')} now to confirm admission; the remaining ₹{Number(fs.total_fee - fs.fee_pay_now_amount).toLocaleString('en-IN')} can be paid later.
              </p>
            )}
            {admitted && fs.remaining > 0 && (
              <div className="rounded-lg bg-teal-50 border border-teal-200 px-4 py-2.5 text-sm text-teal-800">
                Your admission is confirmed. ₹{Number(fs.remaining).toLocaleString('en-IN')} remaining balance can be paid below.
              </div>
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

        {/* ── Payment ── */}
        {!fullyPaid && fs.total_fee > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-xs text-slate-500">{admitted ? 'Remaining balance' : 'Amount due now'}</p>
              <p className="text-xl font-bold text-slate-950">
                ₹{Number(fs.total_paid > 0 ? fs.remaining : (fs.fee_pay_now_amount || fs.remaining)).toLocaleString('en-IN')}
              </p>
            </div>
            <Button
              onClick={payCustomAmount}
              loading={paying}
              disabled={paying || scriptError}
            >
              {admitted ? 'Pay Remaining' : 'Pay Now'}
            </Button>
          </div>
        )}

        {/* Fully paid */}
        {fullyPaid && (
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
