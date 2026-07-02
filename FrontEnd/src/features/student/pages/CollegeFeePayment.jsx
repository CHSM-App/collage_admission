/**
 * CollegeFeePayment — shown when a student's application is confirmed.
 * - If an installment plan is set: shows current instalment amount (fixed, no input).
 * - If no installment plan: shows remaining balance with a free-entry amount input.
 */
import { useState, useEffect } from 'react'
import { useCollegePayment } from '../../../shared/hooks/useCollegePayment.js'
import Button from '../../../shared/components/Button.jsx'
import PaymentReceipts from './PaymentReceipts.jsx'
import { getMiscFeeStatus, initiateMiscFeePayment } from '../../../services/paymentService.js'

export default function CollegeFeePayment({ application, onDone, onCancel }) {
  const [showReceipts, setShowReceipts] = useState(false)
  const [customAmt, setCustomAmt]       = useState('')

  const {
    feeStatus,
    loading,
    paying,
    payError,
    paidMsg,
    payOnline,
    setPayError,
  } = useCollegePayment(application.id)

  // Misc / Exam fee state
  const [miscStatus, setMiscStatus]     = useState(null)
  const [miscLoading, setMiscLoading]   = useState(true)
  const [miscPaying, setMiscPaying]     = useState(null) // payment_id being paid
  const [miscPayErr, setMiscPayErr]     = useState('')
  const [showMiscPaid, setShowMiscPaid] = useState(false)

  useEffect(() => {
    getMiscFeeStatus(application.id)
      .then(r => setMiscStatus(r.data.data))
      .catch(() => setMiscStatus(null))
      .finally(() => setMiscLoading(false))
  }, [application.id])

  async function handleMiscPay(paymentId) {
    setMiscPayErr('')
    setMiscPaying(paymentId)
    try {
      const r = await initiateMiscFeePayment({ application_id: application.id, payment_id: paymentId })
      const { endpoint, fields } = r.data.data
      // Build and submit form to PayU
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = endpoint
      Object.entries(fields).forEach(([k, v]) => {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = k
        input.value = v
        form.appendChild(input)
      })
      document.body.appendChild(form)
      form.submit()
    } catch (e) {
      const msg = e?.response?.data?.message || 'Failed to initiate payment.'
      setMiscPayErr(msg)
      setMiscPaying(null)
    }
  }

  const fs = feeStatus

  // current_due: from installment plan logic (backend)
  // If installments configured → fixed amount student must pay next
  // If no installments → remaining (student chooses how much)
  const hasInstallments = fs?.installments?.length > 0
  const currentDue      = fs ? (fs.current_due ?? fs.remaining) : 0
  const amtIsFixed      = hasInstallments && currentDue < (fs?.remaining ?? 0) - 0.01

  async function handlePay() {
    setPayError('')
    let amt
    if (amtIsFixed) {
      amt = currentDue
    } else {
      amt = parseFloat(customAmt)
      if (!amt || amt <= 0) { setPayError('Enter a valid amount.'); return }
      if (fs && amt > fs.remaining + 0.01) { setPayError(`Amount cannot exceed remaining balance ₹${fs.remaining.toLocaleString('en-IN')}.`); return }
    }
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

  if (!fs) return null

  const admitted  = fs.college_fee_paid || fs.remaining <= 0
  const fullyPaid = fs.remaining <= 0

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
        {fs.total_fee === 0 ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            The college has not yet entered the fee details. Please contact the college.
          </div>
        ) : (
          <>
            {/* Fee summary cards */}
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

            {/* Fee head breakdown */}
            {fs.breakdown?.filter(h => (h.fees_type || '').toLowerCase() !== 'platform').length > 0 && (
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Fee Heads</p>
                </div>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-100">
                    {fs.breakdown.filter(h => (h.fees_type || '').toLowerCase() !== 'platform').map(h => (
                      <tr key={h.fees_code} className={h.status === 'paid' ? 'bg-emerald-50/40' : ''}>
                        <td className="px-3 py-2 text-slate-700 font-medium">{h.fees_head}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-800 font-semibold">
                          ₹{Number(h.amount).toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-2 text-right w-20">
                          {h.status === 'paid'
                            ? <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">Paid</span>
                            : h.status === 'partial'
                            ? <span className="text-xs font-semibold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">Partial</span>
                            : <span className="text-xs font-semibold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">Pending</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Installment plan summary */}
            {hasInstallments && !fullyPaid && (
              <InstallmentSummary installments={fs.installments} totalPaid={fs.total_paid} />
            )}

            {admitted && fs.remaining > 0 && (
              <div className="rounded-lg bg-teal-50 border border-teal-200 px-4 py-2.5 text-sm text-teal-800">
                Your admission is confirmed. Pay the remaining balance below.
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

        {/* ── Payment section ── */}
        {!fullyPaid && fs.total_fee > 0 && (
          amtIsFixed ? (
            // Fixed instalment — no input, just show the locked amount
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-xs text-slate-500">
                  {admitted ? 'Next instalment' : 'Amount due now'} <span className="text-slate-400">(fixed)</span>
                </p>
                <p className="text-xl font-bold text-slate-950">₹{Number(currentDue).toLocaleString('en-IN')}</p>
              </div>
              <Button onClick={handlePay} loading={paying} disabled={paying}>
                {admitted ? 'Pay Instalment' : 'Pay Now'}
              </Button>
            </div>
          ) : (
            // Free payment — student enters any amount up to remaining
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 space-y-3">
              <div>
                <p className="text-xs text-slate-500 mb-1">
                  {admitted ? 'Enter amount to pay' : 'Amount due now'}
                </p>
                <div className="flex gap-3 items-center">
                  <div className="flex items-center rounded-lg border border-slate-300 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500 bg-white flex-1 max-w-xs">
                    <span className="px-3 py-2 bg-slate-50 border-r border-slate-200 text-slate-500 text-sm font-semibold">₹</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={customAmt}
                      onChange={e => { setCustomAmt(e.target.value.replace(/[^0-9.]/g, '')); setPayError('') }}
                      placeholder={`Max ${Number(fs.remaining).toLocaleString('en-IN')}`}
                      className="flex-1 px-3 py-2 text-sm outline-none bg-transparent"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => { setCustomAmt(String(fs.remaining)); setPayError('') }}
                    className="text-xs text-emerald-600 hover:underline font-semibold whitespace-nowrap"
                  >
                    Pay full
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">You can pay any amount up to ₹{Number(fs.remaining).toLocaleString('en-IN')}.</p>
              </div>
              <Button onClick={handlePay} loading={paying} disabled={paying || !customAmt}>
                {admitted ? 'Pay Now' : 'Pay Now'}
              </Button>
            </div>
          )
        )}

        {/* Fully paid */}
        {fullyPaid && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
            All fees have been paid. Your application will be processed for roll number assignment.
          </div>
        )}

        {/* Misc / Exam Fees section */}
        {!miscLoading && miscStatus && (miscStatus.pending?.length > 0 || miscStatus.paid?.length > 0) && (
          <div className="border-t border-slate-100 pt-3 space-y-3">
            {miscStatus.pending?.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-bold text-slate-700">Misc / Exam Fees Due</p>
                {miscPayErr && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{miscPayErr}</p>
                )}
                {miscStatus.pending.map(fee => (
                  <div key={fee.id} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                          {fee.payment_type === 'misc_fee' ? 'Misc Fee' : 'Exam Fee'}
                        </p>
                        {fee.fee_heads?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {fee.fee_heads.map(h => (
                              <span key={h.fees_code} className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">{h.fees_head}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="font-bold text-amber-900 whitespace-nowrap">₹{Number(fee.amount).toLocaleString('en-IN')}</p>
                    </div>
                    <button
                      onClick={() => handleMiscPay(fee.id)}
                      disabled={!!miscPaying}
                      className="w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition disabled:opacity-50"
                    >
                      {miscPaying === fee.id ? 'Redirecting…' : 'Pay Now'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {miscStatus.paid?.length > 0 && (
              <div className="space-y-2">
                <button
                  onClick={() => setShowMiscPaid(v => !v)}
                  className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition"
                >
                  <span>{showMiscPaid ? '▼' : '▶'}</span>
                  Misc / Exam Receipts ({miscStatus.paid.length})
                </button>
                {showMiscPaid && (
                  <div className="space-y-2">
                    {miscStatus.paid.map(fee => (
                      <div key={fee.id} className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">
                              {fee.payment_type === 'misc_fee' ? 'Misc Fee' : 'Exam Fee'}
                              <span className="ml-2 rounded-full bg-emerald-200 text-emerald-700 px-2 py-0.5 text-xs font-bold">Paid</span>
                            </p>
                            {fee.fee_heads?.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {fee.fee_heads.map(h => (
                                  <span key={h.fees_code} className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700">{h.fees_head}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          <p className="font-bold text-emerald-700 whitespace-nowrap">₹{Number(fee.amount).toLocaleString('en-IN')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
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
            <PaymentReceipts applicationId={application.id} onClose={() => setShowReceipts(false)} />
          )}
        </div>

        <div className="flex justify-end">
          <button onClick={onCancel} className="text-sm text-slate-400 hover:text-slate-600">Close</button>
        </div>
      </div>
    </div>
  )
}

// Shows the installment plan with which ones are done / current / upcoming
function InstallmentSummary({ installments, totalPaid }) {
  let cumulative = 0
  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Installment Plan</p>
      </div>
      <table className="w-full text-xs">
        <tbody className="divide-y divide-slate-100">
          {installments.map((inst, idx) => {
            const prevCumulative = cumulative
            cumulative += inst.amount
            const done    = totalPaid >= cumulative - 0.01
            const current = !done && totalPaid >= prevCumulative - 0.01
            return (
              <tr key={idx} className={done ? 'bg-emerald-50/50' : current ? 'bg-amber-50/50' : ''}>
                <td className="px-3 py-2 font-medium text-slate-700">Instalment {inst.installment_no}</td>
                <td className="px-3 py-2 text-slate-500">
                  {inst.due_date ? new Date(inst.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                </td>
                <td className="px-3 py-2 font-mono font-semibold text-slate-800 text-right">
                  ₹{Number(inst.amount).toLocaleString('en-IN')}
                </td>
                <td className="px-3 py-2 text-right">
                  {done
                    ? <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">Paid</span>
                    : current
                    ? <span className="text-xs font-semibold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">Due Now</span>
                    : <span className="text-xs font-semibold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">Upcoming</span>
                  }
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
