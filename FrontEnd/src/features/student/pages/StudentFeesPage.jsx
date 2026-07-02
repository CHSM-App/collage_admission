/**
 * StudentFeesPage — student fee details page.
 *
 * Shows a single table with ALL fee types for the student's application:
 *   - Regular fee heads (tuition etc.) with amount, paid, status
 *   - Misc / Exam fees (pending and paid) as separate rows
 *
 * Clicking any row opens a modal identical in layout to the college-side
 * CollegeCollectPayPanel, but student-only: only online payment (no cash / WhatsApp link).
 */
import { useEffect, useState } from 'react'
import { useAuthContext } from '../../../context/AuthContext.jsx'
import { getApplications } from '../../../services/applicationService.js'
import { useCollegePayment } from '../../../shared/hooks/useCollegePayment.js'
import { getMiscFeeStatus, initiateMiscFeePayment } from '../../../services/paymentService.js'
import PaymentReceipts from './PaymentReceipts.jsx'
import { SkeletonTable, SkeletonCards } from '../../../shared/components/Skeleton.jsx'

const FEE_STATUSES = ['confirmed', 'fees_paid', 'roll_assigned', 'enrolled']
const YEAR_LABEL   = { 1: 'FY', 2: 'SY', 3: 'TY', 4: '4Y', 5: '5Y' }

function fmtINR(n) { return `₹${Number(n || 0).toLocaleString('en-IN')}` }

function StatusBadge({ status }) {
  if (status === 'paid')    return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Paid</span>
  if (status === 'partial') return <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">Partial</span>
  return                           <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Pending</span>
}

// ─────────────────────────────────────────────────────────────
// Main page — lists confirmed applications, shows fee table
// ─────────────────────────────────────────────────────────────
export default function StudentFeesPage() {
  const { user }                    = useAuthContext()
  const [apps, setApps]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [selectedApp, setSelectedApp] = useState(null)

  useEffect(() => {
    getApplications(user.id)
      .then(r => {
        const all = r.data.data || []
        const eligible = all.filter(a => FEE_STATUSES.includes(a.status))
        setApps(eligible)
        // Auto-select if only one
        if (eligible.length === 1) setSelectedApp(eligible[0])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user.id])

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">Student portal</p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-slate-950">Fee Details</h1>
        <p className="mt-1 text-slate-600">All your fees — regular, misc and exam — with payment status.</p>
      </div>

      {loading && <SkeletonCards count={2} />}

      {!loading && apps.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-slate-500 font-medium">No confirmed admissions yet.</p>
          <p className="mt-1 text-sm text-slate-400">Fee details appear once your application is confirmed by the college.</p>
        </div>
      )}

      {/* Application selector (only if more than one) */}
      {!loading && apps.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {apps.map(app => (
            <button
              key={app.id}
              onClick={() => setSelectedApp(app)}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                selectedApp?.id === app.id
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-white text-slate-700 border-slate-300 hover:border-emerald-400'
              }`}
            >
              {app.college_name} · {YEAR_LABEL[app.year_of_study]} · {app.academic_year}
            </button>
          ))}
        </div>
      )}

      {selectedApp && <FeeTable application={selectedApp} />}
    </section>
  )
}

// ─────────────────────────────────────────────────────────────
// Fee table for one application
// ─────────────────────────────────────────────────────────────
function FeeTable({ application }) {
  const [modalRow, setModalRow] = useState(null)

  const { feeStatus, loading: feeLoading, fetchStatus } = useCollegePayment(application.id)
  const [miscStatus, setMiscStatus]   = useState(null)
  const [miscLoading, setMiscLoading] = useState(true)

  function reloadMisc() {
    getMiscFeeStatus(application.id)
      .then(r => setMiscStatus(r.data.data))
      .catch(() => setMiscStatus(null))
      .finally(() => setMiscLoading(false))
  }

  useEffect(() => { reloadMisc() }, [application.id])

  if (feeLoading || miscLoading) return <SkeletonTable rows={5} cols={4} />

  const regularHeads = (feeStatus?.breakdown || []).filter(
    h => (h.fees_type || '').toLowerCase() !== 'platform'
  )
  const miscPending = miscStatus?.pending || []
  const miscPaid    = miscStatus?.paid    || []

  const totalFee  = feeStatus?.total_fee  || 0
  const totalPaid = feeStatus?.total_paid || 0
  const remaining = feeStatus?.remaining  || 0
  const miscDue   = miscPending.reduce((s, f) => s + (Number(f.amount) || 0), 0)

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Total Fee"      value={fmtINR(totalFee)}  color="slate" />
        <SummaryCard label="Paid"           value={fmtINR(totalPaid)} color="emerald" />
        <SummaryCard label="Remaining"      value={fmtINR(remaining)} color={remaining > 0 ? 'amber' : 'emerald'} />
        <SummaryCard label="Misc/Exam Due"  value={fmtINR(miscDue)}   color={miscDue > 0 ? 'amber' : 'slate'} />
      </div>

      {regularHeads.length === 0 && miscPending.length === 0 && miscPaid.length === 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          The college has not yet configured fee details. Please contact the college office.
        </div>
      )}

      {/* Desktop table */}
      {(regularHeads.length > 0 || miscPending.length > 0 || miscPaid.length > 0) && (
        <>
          <div className="hidden sm:block overflow-x-auto rounded-xl border-2 border-slate-300">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-xs font-bold text-slate-600 uppercase tracking-wide border-b-2 border-slate-300">
                <tr>
                  <th className="px-4 py-3 text-left">Fee Head</th>
                  <th className="px-4 py-3 text-center w-24">Type</th>
                  <th className="px-4 py-3 text-right w-32">Amount (₹)</th>
                  <th className="px-4 py-3 text-right w-32">Paid (₹)</th>
                  <th className="px-4 py-3 text-center w-24">Status</th>
                  <th className="px-4 py-3 w-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">

                {/* Regular fee heads */}
                {regularHeads.map(h => (
                  <tr
                    key={`r-${h.fees_code}`}
                    onClick={() => setModalRow({ kind: 'regular' })}
                    className={`cursor-pointer transition hover:bg-blue-50 ${h.status === 'paid' ? 'bg-emerald-50/30' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{h.fees_head}</p>
                      {h.short_name && h.short_name !== h.fees_head && (
                        <p className="text-xs text-slate-400">{h.short_name}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">Regular</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      {Number(h.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-700">
                      {h.paid_amount > 0 ? Number(h.paid_amount).toLocaleString('en-IN') : '—'}
                    </td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={h.status} /></td>
                    <td className="px-4 py-3 text-slate-300 text-xs">›</td>
                  </tr>
                ))}

                {/* Misc / Exam pending */}
                {miscPending.map(f => (
                  <tr
                    key={`mp-${f.id}`}
                    onClick={() => setModalRow({ kind: 'misc', data: f })}
                    className="cursor-pointer transition hover:bg-blue-50"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">
                        {f.fee_heads?.length > 0
                          ? f.fee_heads.map(h => h.fees_head).join(', ')
                          : f.payment_type === 'misc_fee' ? 'Misc Fee' : 'Exam Fee'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${f.payment_type === 'misc_fee' ? 'bg-violet-100 text-violet-700' : 'bg-indigo-100 text-indigo-700'}`}>
                        {f.payment_type === 'misc_fee' ? 'Misc' : 'Exam'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      {Number(f.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">—</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status="pending" /></td>
                    <td className="px-4 py-3 text-slate-300 text-xs">›</td>
                  </tr>
                ))}

                {/* Misc / Exam paid */}
                {miscPaid.map(f => (
                  <tr
                    key={`mpd-${f.id}`}
                    onClick={() => setModalRow({ kind: 'misc-paid' })}
                    className="cursor-pointer transition hover:bg-blue-50 bg-emerald-50/30"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">
                        {f.fee_heads?.length > 0
                          ? f.fee_heads.map(h => h.fees_head).join(', ')
                          : f.payment_type === 'misc_fee' ? 'Misc Fee' : 'Exam Fee'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${f.payment_type === 'misc_fee' ? 'bg-violet-100 text-violet-700' : 'bg-indigo-100 text-indigo-700'}`}>
                        {f.payment_type === 'misc_fee' ? 'Misc' : 'Exam'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      {Number(f.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-700">
                      {Number(f.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-center"><StatusBadge status="paid" /></td>
                    <td className="px-4 py-3 text-slate-300 text-xs">›</td>
                  </tr>
                ))}
              </tbody>

              {/* Footer totals */}
              <tfoot className="border-t-2 border-slate-300 bg-slate-50 text-xs font-bold text-slate-600">
                <tr>
                  <td className="px-4 py-2.5 uppercase tracking-wide">Total</td>
                  <td />
                  <td className="px-4 py-2.5 text-right font-mono text-slate-800">{Number(totalFee).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-emerald-700">{Number(totalPaid).toLocaleString('en-IN')}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {regularHeads.map(h => (
              <div
                key={`rm-${h.fees_code}`}
                onClick={() => setModalRow({ kind: 'regular' })}
                className="rounded-xl border border-slate-200 bg-white p-4 cursor-pointer hover:border-blue-200 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">{h.fees_head}</p>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 mt-0.5 inline-block">Regular</span>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p className="font-bold font-mono text-slate-800">{fmtINR(h.amount)}</p>
                    <StatusBadge status={h.status} />
                  </div>
                </div>
              </div>
            ))}
            {[...miscPending.map(f => ({ ...f, rowStatus: 'pending' })), ...miscPaid.map(f => ({ ...f, rowStatus: 'paid' }))].map((f, i) => (
              <div
                key={`mm-${f.id}-${i}`}
                onClick={() => setModalRow(f.rowStatus === 'pending' ? { kind: 'misc', data: f } : { kind: 'misc-paid' })}
                className="rounded-xl border border-slate-200 bg-white p-4 cursor-pointer hover:border-blue-200 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">
                      {f.fee_heads?.length > 0 ? f.fee_heads.map(h => h.fees_head).join(', ') : f.payment_type === 'misc_fee' ? 'Misc Fee' : 'Exam Fee'}
                    </p>
                    <span className={`text-xs px-1.5 py-0.5 rounded mt-0.5 inline-block ${f.payment_type === 'misc_fee' ? 'bg-violet-100 text-violet-700' : 'bg-indigo-100 text-indigo-700'}`}>
                      {f.payment_type === 'misc_fee' ? 'Misc' : 'Exam'}
                    </span>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p className="font-bold font-mono text-slate-800">{fmtINR(f.amount)}</p>
                    <StatusBadge status={f.rowStatus} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Row modal */}
      {modalRow && (
        <FeeModal
          application={application}
          kind={modalRow.kind}
          miscRow={modalRow.data}
          feeStatus={feeStatus}
          onClose={() => setModalRow(null)}
          onPaid={() => { setModalRow(null); fetchStatus(); reloadMisc() }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Modal — same layout as college view, student-only (online only)
// ─────────────────────────────────────────────────────────────
function FeeModal({ application, kind, miscRow, feeStatus, onClose, onPaid }) {
  const fs          = feeStatus
  const remaining   = fs?.remaining || 0
  const amtDue      = fs?.current_due ?? remaining
  const amtIsFixed  = fs?.installments?.length > 0 && amtDue < remaining - 0.01
  const allPaid     = fs && fs.total_fee > 0 && remaining <= 0

  const [amount, setAmount]         = useState(String(amtDue || ''))
  const [payErr, setPayErr]         = useState('')
  const [miscPaying, setMiscPaying] = useState(false)
  const [receiptsOpen, setReceiptsOpen] = useState(false)

  const { payOnline, paying, payError, paidMsg } = useCollegePayment(application.id)

  async function handleOnlinePay(e) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { setPayErr('Enter a valid amount.'); return }
    if (amt > remaining + 0.01) { setPayErr(`Cannot exceed ${fmtINR(remaining)}.`); return }
    setPayErr('')
    await payOnline(amt)
  }

  async function handleMiscPay() {
    setPayErr('')
    setMiscPaying(true)
    try {
      const r = await initiateMiscFeePayment({ application_id: application.id, payment_id: miscRow.id })
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
      setMiscPaying(false)
    }
  }

  const isMiscPending = kind === 'misc'
  const isMiscPaid    = kind === 'misc-paid'
  const isRegular     = kind === 'regular'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <div>
            <p className="font-bold text-slate-950 text-base">{application.college_name}</p>
            <p className="text-sm text-slate-500 mt-0.5">
              {application.course_name} · {YEAR_LABEL[application.year_of_study]} · {application.academic_year}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none mt-0.5 ml-3 shrink-0">✕</button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-center">
              <p className="text-xs text-slate-400">Total Fee</p>
              <p className="font-bold text-slate-950 mt-0.5">{fs?.total_fee > 0 ? fmtINR(fs.total_fee) : '—'}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-center">
              <p className="text-xs text-slate-400">Paid</p>
              <p className="font-bold text-emerald-700 mt-0.5">{fmtINR(fs?.total_paid)}</p>
            </div>
            <div className={`rounded-lg border p-3 text-center ${remaining > 0 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
              <p className="text-xs text-slate-400">Remaining</p>
              <p className={`font-bold mt-0.5 ${remaining > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{fmtINR(remaining)}</p>
            </div>
          </div>

          {/* Fee head breakdown table */}
          {isRegular && fs?.breakdown?.filter(h => (h.fees_type || '').toLowerCase() !== 'platform').length > 0 && (
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Fee Head</th>
                    <th className="px-3 py-2 text-right font-semibold w-24">Amount (₹)</th>
                    <th className="px-3 py-2 text-right font-semibold w-24">Paid (₹)</th>
                    <th className="px-3 py-2 text-center font-semibold w-20">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {fs.breakdown.filter(h => (h.fees_type || '').toLowerCase() !== 'platform').map(h => (
                    <tr key={h.fees_code} className={h.status === 'paid' ? 'bg-emerald-50/40' : ''}>
                      <td className="px-3 py-1.5 text-slate-700">
                        {h.fees_head}
                        {h.short_name && <span className="ml-1.5 text-slate-400">{h.short_name}</span>}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-600">
                        {Number(h.amount).toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-800">
                        {h.paid_amount > 0 ? Number(h.paid_amount).toLocaleString('en-IN') : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {h.status === 'paid'
                          ? <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">Cleared</span>
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

          {/* Misc / Exam fee head detail */}
          {(isMiscPending || isMiscPaid) && miscRow?.fee_heads?.length > 0 && (
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Fee Head</th>
                    <th className="px-3 py-2 text-center font-semibold w-20">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {miscRow.fee_heads.map(h => (
                    <tr key={h.fees_code}>
                      <td className="px-3 py-1.5 text-slate-700">{h.fees_head}</td>
                      <td className="px-3 py-1.5 text-center">
                        <StatusBadge status={isMiscPaid ? 'paid' : 'pending'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Messages */}
          {(paidMsg || payError || payErr) && (
            <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${paidMsg ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {paidMsg || payError || payErr}
            </div>
          )}

          {/* Online payment — regular fees */}
          {isRegular && !allPaid && fs?.total_fee > 0 && (
            <form onSubmit={handleOnlinePay} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 space-y-3">
              <p className="text-sm font-semibold text-blue-800">Pay Online</p>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-xs text-blue-700 mb-1 block">
                    Amount (₹)
                    {amtIsFixed && <span className="ml-1 text-blue-400">(fixed instalment)</span>}
                  </label>
                  <input
                    type="text" inputMode="numeric"
                    value={amount}
                    onChange={e => { setAmount(e.target.value.replace(/[^0-9.]/g, '')); setPayErr('') }}
                    readOnly={amtIsFixed}
                    placeholder={`Max ${fmtINR(remaining)}`}
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                      amtIsFixed ? 'bg-blue-100 border-blue-200 text-blue-700 cursor-not-allowed' : 'border-blue-200 bg-white'
                    }`}
                    required
                  />
                </div>
                <button
                  type="submit" disabled={paying}
                  className="shrink-0 rounded-lg bg-blue-600 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {paying ? 'Redirecting…' : 'Pay via PayU'}
                </button>
              </div>
              <p className="text-xs text-blue-600">You will be redirected to PayU for UPI, card, or netbanking payment.</p>
            </form>
          )}

          {isRegular && allPaid && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 font-medium">
              All college fees have been paid in full.
            </div>
          )}

          {isRegular && fs?.total_fee === 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              Fee amount not set by the college yet. Please contact the college office.
            </div>
          )}

          {/* Misc / Exam pending — Pay button */}
          {isMiscPending && miscRow && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-amber-800">
                  {miscRow.payment_type === 'misc_fee' ? 'Misc Fee' : 'Exam Fee'} — Pending Payment
                </p>
                <p className="font-bold text-amber-900">{fmtINR(miscRow.amount)}</p>
              </div>
              <button
                onClick={handleMiscPay}
                disabled={miscPaying}
                className="w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition disabled:opacity-50"
              >
                {miscPaying ? 'Redirecting…' : `Pay Now — ${fmtINR(miscRow.amount)}`}
              </button>
            </div>
          )}

          {isMiscPaid && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 font-medium">
              This fee has been paid successfully.
            </div>
          )}

          {/* Transactions */}
          {isRegular && fs?.paid_records?.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Transactions</p>
              <div className="space-y-1.5">
                {fs.paid_records.map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2.5 text-sm">
                    <div className="flex items-center gap-2.5">
                      <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700 shrink-0">{i + 1}</div>
                      <div>
                        <p className="font-medium text-slate-800">
                          {p.gateway === 'cash' ? 'Cash / Offline' : p.via_payment_link ? 'Payment Link (PayU)' : 'Online (PayU)'}
                        </p>
                        <p className="text-xs text-slate-400">
                          {p.completed_at ? new Date(p.completed_at.toString().replace(' ', 'T').split('.')[0]).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </p>
                      </div>
                    </div>
                    <span className="font-bold text-emerald-700">{fmtINR(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Receipts */}
          <div className="border-t border-slate-100 pt-3">
            <button
              onClick={() => setReceiptsOpen(v => !v)}
              className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              {receiptsOpen ? 'Hide Receipts' : 'View Printable Receipts'}
            </button>
            {receiptsOpen && (
              <div className="mt-3">
                <PaymentReceipts
                  applicationId={application.id}
                  hideTypes={['application_fee']}
                  showOrderId
                />
              </div>
            )}
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
