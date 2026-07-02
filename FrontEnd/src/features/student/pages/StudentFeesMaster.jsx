/**
 * StudentFeesMaster — payment page for students.
 * Shows a fee-master-style table for the student's application:
 *   - Regular fee heads (from FeeDetermination breakdown) with amounts & paid status
 *   - Misc / Exam fee heads (pending online + paid) as separate rows
 * Clicking any row opens a modal with payment action + receipts.
 */
import { useEffect, useState } from 'react'
import { useCollegePayment } from '../../../shared/hooks/useCollegePayment.js'
import { getMiscFeeStatus, initiateMiscFeePayment } from '../../../services/paymentService.js'
import PaymentReceipts from './PaymentReceipts.jsx'
import { SkeletonTable } from '../../../shared/components/Skeleton.jsx'

const TYPE_LABEL = {
  Student:   'Tuition',
  student:   'Tuition',
  Misc:      'Misc',
  misc:      'Misc',
  ExamFees:  'Exam',
  examfees:  'Exam',
  platform:  'Platform',
  Platform:  'Platform',
}

function fmtAmt(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`
}

function StatusBadge({ status }) {
  if (status === 'paid')    return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Paid</span>
  if (status === 'partial') return <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">Partial</span>
  if (status === 'pending') return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Pending</span>
  return                           <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">—</span>
}

export default function StudentFeesMaster({ application }) {
  const [selectedRow, setSelectedRow] = useState(null)

  const { feeStatus, loading } = useCollegePayment(application.id)
  const [miscStatus, setMiscStatus]   = useState(null)
  const [miscLoading, setMiscLoading] = useState(true)

  function reloadMisc() {
    getMiscFeeStatus(application.id)
      .then(r => setMiscStatus(r.data.data))
      .catch(() => setMiscStatus(null))
      .finally(() => setMiscLoading(false))
  }

  useEffect(() => { reloadMisc() }, [application.id])

  if (loading || miscLoading) return <SkeletonTable rows={5} cols={4} />
  if (!feeStatus) return <p className="text-sm text-slate-400">Could not load fee details.</p>

  // Regular fee heads (exclude platform)
  const regularHeads = (feeStatus.breakdown || []).filter(
    h => (h.fees_type || '').toLowerCase() !== 'platform'
  )

  // Misc / Exam rows — pending (online payment due) + paid
  const miscPending = miscStatus?.pending || []
  const miscPaid    = miscStatus?.paid    || []
  const miscRows    = [
    ...miscPending.map(f => ({ ...f, rowStatus: 'pending' })),
    ...miscPaid.map(f =>    ({ ...f, rowStatus: 'paid'    })),
  ]

  const hasAnyFee = regularHeads.length > 0 || miscRows.length > 0

  if (!hasAnyFee) {
    return (
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
        The college has not yet configured fee details. Please contact the college office.
      </div>
    )
  }

  // Summary totals
  const totalFee   = feeStatus.total_fee    || 0
  const totalPaid  = feeStatus.total_paid   || 0
  const remaining  = feeStatus.remaining    || 0
  const miscTotal  = miscPaid.reduce((s, f) => s + (Number(f.amount) || 0), 0)
  const miscDue    = miscPending.reduce((s, f) => s + (Number(f.amount) || 0), 0)

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Total Fee"  value={fmtAmt(totalFee)}  color="slate" />
        <SummaryCard label="Paid"       value={fmtAmt(totalPaid)} color="emerald" />
        <SummaryCard label="Remaining"  value={fmtAmt(remaining)} color={remaining > 0 ? 'amber' : 'emerald'} />
        <SummaryCard label="Misc / Exam Due" value={fmtAmt(miscDue)} color={miscDue > 0 ? 'amber' : 'slate'} />
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto rounded-lg border-2 border-slate-300">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-xs font-bold text-slate-600 uppercase tracking-wide border-b-2 border-slate-300">
            <tr>
              <th className="px-4 py-2.5 text-left">Fee Head</th>
              <th className="px-4 py-2.5 text-center w-24">Type</th>
              <th className="px-4 py-2.5 text-right w-32">Amount</th>
              <th className="px-4 py-2.5 text-center w-24">Status</th>
              <th className="px-4 py-2.5 w-6" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {/* Regular heads */}
            {regularHeads.map(h => (
              <tr
                key={`reg-${h.fees_code}`}
                onClick={() => setSelectedRow({ kind: 'regular', data: h })}
                className="hover:bg-blue-50 cursor-pointer transition"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{h.fees_head}</p>
                  {h.short_name && h.short_name !== h.fees_head && (
                    <p className="text-xs text-slate-400">{h.short_name}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                    {TYPE_LABEL[h.fees_type] || h.fees_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">
                  {fmtAmt(h.amount)}
                </td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge status={h.status} />
                </td>
                <td className="px-4 py-3 text-slate-300 text-xs">›</td>
              </tr>
            ))}

            {/* Misc / Exam rows */}
            {miscRows.map((f, i) => {
              const typeLabel = f.payment_type === 'misc_fee' ? 'Misc' : 'Exam'
              const headNames = f.fee_heads?.map(h => h.fees_head).join(', ') || typeLabel
              return (
                <tr
                  key={`misc-${f.id}-${i}`}
                  onClick={() => f.rowStatus === 'pending'
                    ? setSelectedRow({ kind: 'misc-pending', data: f })
                    : setSelectedRow({ kind: 'misc-paid', data: f })
                  }
                  className="hover:bg-blue-50 cursor-pointer transition"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{headNames}</p>
                    {f.fee_heads?.length > 1 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {f.fee_heads.map(h => (
                          <span key={h.fees_code} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{h.fees_head}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${f.payment_type === 'misc_fee' ? 'bg-violet-100 text-violet-700' : 'bg-indigo-100 text-indigo-700'}`}>
                      {typeLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">
                    {fmtAmt(f.amount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={f.rowStatus} />
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-xs">›</td>
                </tr>
              )
            })}
          </tbody>

          {/* Totals footer */}
          <tfoot className="border-t-2 border-slate-300 bg-slate-50">
            <tr>
              <td colSpan={2} className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wide">
                Total (college fees)
              </td>
              <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-800">{fmtAmt(totalFee)}</td>
              <td colSpan={2} />
            </tr>
            {miscTotal > 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Total Misc / Exam (paid)
                </td>
                <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-700">{fmtAmt(miscTotal)}</td>
                <td colSpan={2} />
              </tr>
            )}
          </tfoot>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {regularHeads.map(h => (
          <div
            key={`reg-m-${h.fees_code}`}
            onClick={() => setSelectedRow({ kind: 'regular', data: h })}
            className="rounded-xl border border-slate-200 bg-white p-4 cursor-pointer hover:border-blue-200 transition"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-slate-800">{h.fees_head}</p>
                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 mt-0.5 inline-block">
                  {TYPE_LABEL[h.fees_type] || h.fees_type}
                </span>
              </div>
              <div className="text-right shrink-0 space-y-1">
                <p className="font-bold text-slate-800 font-mono">{fmtAmt(h.amount)}</p>
                <StatusBadge status={h.status} />
              </div>
            </div>
          </div>
        ))}
        {miscRows.map((f, i) => {
          const typeLabel = f.payment_type === 'misc_fee' ? 'Misc' : 'Exam'
          const headNames = f.fee_heads?.map(h => h.fees_head).join(', ') || typeLabel
          return (
            <div
              key={`misc-m-${f.id}-${i}`}
              onClick={() => f.rowStatus === 'pending'
                ? setSelectedRow({ kind: 'misc-pending', data: f })
                : setSelectedRow({ kind: 'misc-paid', data: f })
              }
              className="rounded-xl border border-slate-200 bg-white p-4 cursor-pointer hover:border-blue-200 transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800">{headNames}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded mt-0.5 inline-block ${f.payment_type === 'misc_fee' ? 'bg-violet-100 text-violet-700' : 'bg-indigo-100 text-indigo-700'}`}>
                    {typeLabel}
                  </span>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="font-bold text-slate-800 font-mono">{fmtAmt(f.amount)}</p>
                  <StatusBadge status={f.rowStatus} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Row detail modal */}
      {selectedRow && (
        <RowModal
          application={application}
          row={selectedRow}
          feeStatus={feeStatus}
          onClose={() => setSelectedRow(null)}
          onMiscPaid={() => { setSelectedRow(null); reloadMisc() }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Modal that opens on row click
// ─────────────────────────────────────────────────────────────
function RowModal({ application, row, feeStatus, onClose, onMiscPaid }) {
  const { kind, data } = row
  const [paying, setPaying]   = useState(false)
  const [payErr, setPayErr]   = useState('')
  const [customAmt, setCustomAmt] = useState('')
  const { payOnline, paying: collegePaying, payError: collegePayErr } = useCollegePayment(application.id)

  // For regular heads — show college fee payment section
  const isRegular    = kind === 'regular'
  const isMiscPend   = kind === 'misc-pending'
  const isMiscPaid   = kind === 'misc-paid'

  const hasInstallments = feeStatus?.installments?.length > 0
  const remaining       = feeStatus?.remaining || 0
  const currentDue      = feeStatus?.current_due ?? remaining
  const amtIsFixed      = hasInstallments && currentDue < remaining - 0.01
  const fullyPaid       = remaining <= 0

  async function handleCollegePay() {
    let amt
    if (amtIsFixed) {
      amt = currentDue
    } else {
      amt = parseFloat(customAmt)
      if (!amt || amt <= 0) { setPayErr('Enter a valid amount.'); return }
      if (amt > remaining + 0.01) { setPayErr(`Cannot exceed ₹${remaining.toLocaleString('en-IN')}`); return }
    }
    setPayErr('')
    await payOnline(amt)
  }

  async function handleMiscPay() {
    setPayErr('')
    setPaying(true)
    try {
      const r = await initiateMiscFeePayment({ application_id: application.id, payment_id: data.id })
      const { endpoint, fields } = r.data.data
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = endpoint
      Object.entries(fields).forEach(([k, v]) => {
        const inp = document.createElement('input')
        inp.type = 'hidden'; inp.name = k; inp.value = v
        form.appendChild(inp)
      })
      document.body.appendChild(form)
      form.submit()
    } catch (e) {
      setPayErr(e?.response?.data?.message || 'Failed to initiate payment.')
      setPaying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
          <div>
            {isRegular && (
              <>
                <p className="font-bold text-slate-950 text-base">{data.fees_head}</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  {TYPE_LABEL[data.fees_type] || data.fees_type}
                  {data.short_name && data.short_name !== data.fees_head && ` · ${data.short_name}`}
                </p>
              </>
            )}
            {(isMiscPend || isMiscPaid) && (
              <>
                <p className="font-bold text-slate-950 text-base">
                  {data.payment_type === 'misc_fee' ? 'Misc Fee' : 'Exam Fee'}
                </p>
                {data.fee_heads?.length > 0 && (
                  <p className="text-sm text-slate-500 mt-0.5">
                    {data.fee_heads.map(h => h.fees_head).join(', ')}
                  </p>
                )}
              </>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none px-1 ml-3 shrink-0">&times;</button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Amount row */}
          <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
            <span className="text-sm text-slate-500">Amount</span>
            <span className="text-lg font-bold text-slate-950">{fmtAmt(data.amount)}</span>
          </div>

          {/* ── REGULAR FEE HEAD ── */}
          {isRegular && (
            <>
              {/* Head-level status */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">This head</span>
                <StatusBadge status={data.status} />
              </div>

              {/* Overall payment section */}
              {!fullyPaid && feeStatus?.total_fee > 0 && (
                <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-emerald-800 font-semibold">College Fee Balance</span>
                    <span className="font-bold text-emerald-900">{fmtAmt(remaining)} remaining</span>
                  </div>

                  {(collegePayErr || payErr) && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                      {collegePayErr || payErr}
                    </p>
                  )}

                  {amtIsFixed ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-emerald-700">Next instalment</p>
                        <p className="font-bold text-emerald-900 text-lg">{fmtAmt(currentDue)}</p>
                      </div>
                      <button
                        onClick={handleCollegePay}
                        disabled={collegePaying}
                        className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-50"
                      >
                        {collegePaying ? 'Redirecting…' : 'Pay Now'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center rounded-lg border border-emerald-300 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-400 bg-white flex-1">
                          <span className="px-3 py-2 bg-emerald-50 border-r border-emerald-200 text-emerald-700 text-sm font-semibold">₹</span>
                          <input
                            type="text" inputMode="numeric"
                            value={customAmt}
                            onChange={e => { setCustomAmt(e.target.value.replace(/[^0-9.]/g, '')); setPayErr('') }}
                            placeholder={`Max ${Number(remaining).toLocaleString('en-IN')}`}
                            className="flex-1 px-3 py-2 text-sm outline-none bg-transparent"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => { setCustomAmt(String(remaining)); setPayErr('') }}
                          className="text-xs text-emerald-700 hover:underline font-semibold whitespace-nowrap"
                        >
                          Full
                        </button>
                      </div>
                      <button
                        onClick={handleCollegePay}
                        disabled={collegePaying || !customAmt}
                        className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-50"
                      >
                        {collegePaying ? 'Redirecting…' : 'Pay Online'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {fullyPaid && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 font-medium">
                  All college fees have been paid.
                </div>
              )}
            </>
          )}

          {/* ── MISC / EXAM — PENDING ── */}
          {isMiscPend && (
            <>
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                This fee is pending online payment.
              </div>
              {payErr && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{payErr}</p>
              )}
              <button
                onClick={handleMiscPay}
                disabled={paying}
                className="w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition disabled:opacity-50"
              >
                {paying ? 'Redirecting…' : `Pay Now — ${fmtAmt(data.amount)}`}
              </button>
            </>
          )}

          {/* ── MISC / EXAM — PAID ── */}
          {isMiscPaid && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 font-medium">
              Paid successfully.
            </div>
          )}

          {/* Receipts section — always show */}
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Payment Receipts</p>
            <PaymentReceipts
              applicationId={application.id}
              hideTypes={
                isMiscPend || isMiscPaid
                  ? ['application_fee', 'college_fee', 'college_fee_installment']
                  : ['application_fee', 'misc_fee', 'exam_fee']
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, color }) {
  const colors = {
    slate:   'bg-slate-50 border-slate-200 text-slate-800',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    amber:   'bg-amber-50 border-amber-200 text-amber-800',
  }
  return (
    <div className={`rounded-xl border px-4 py-3 ${colors[color] || colors.slate}`}>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs font-semibold uppercase tracking-wide mt-0.5 opacity-60">{label}</p>
    </div>
  )
}
