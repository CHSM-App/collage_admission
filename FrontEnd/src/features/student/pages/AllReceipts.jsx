/**
 * AllReceipts — student Fee Receipts page.
 *
 * One table, rows = college × fee-type (Regular | Misc | Exam).
 * Clicking a row opens a modal identical in structure to CollegeCollectPayPanel:
 *   fee summary → fee head breakdown → payment form (online only) → transactions → receipts
 */
import { useCallback, useEffect, useState } from 'react'
import { useAuthContext } from '../../../context/AuthContext.jsx'
import { getApplications } from '../../../services/applicationService.js'
import {
  getCollegeFeeStatus,
  getMiscFeeStatus,
  initiateMiscFeePayment,
} from '../../../services/paymentService.js'
import { useCollegePayment } from '../../../shared/hooks/useCollegePayment.js'
import PaymentReceipts from './PaymentReceipts.jsx'
import { SkeletonCards, SkeletonTable } from '../../../shared/components/Skeleton.jsx'

const YEAR_LABEL = { 1: 'FY', 2: 'SY', 3: 'TY', 4: '4Y', 5: '5Y' }

function parseLocalDate(str) {
  if (!str) return null
  try { return new Date(str.toString().replace(' ', 'T').split('.')[0]) } catch { return null }
}
function fmtDate(str) {
  const d = parseLocalDate(str)
  return d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}
function fmtTime(str) {
  const d = parseLocalDate(str)
  return d ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''
}
function fmtINR(n) { return `₹${Number(n || 0).toLocaleString('en-IN')}` }

// ─────────────────────────────────────────────────────────────
// Page shell
// ─────────────────────────────────────────────────────────────
export default function AllReceipts() {
  const { user }              = useAuthContext()
  const [apps, setApps]       = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getApplications(user.id)
      .then(r => setApps(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user.id])

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Student portal</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Fee Receipts</h1>
        <p className="mt-1 text-slate-600">Manage fee payments for your admissions.</p>
      </div>

      {loading ? (
        <SkeletonCards count={3} />
      ) : apps.length === 0 ? (
        <p className="text-slate-500 text-sm">No applications found.</p>
      ) : (
        <FeesTable apps={apps} />
      )}
    </section>
  )
}

// ─────────────────────────────────────────────────────────────
// Main table — one row per (app × fee-type)
// ─────────────────────────────────────────────────────────────
function FeesTable({ apps }) {
  const [rows, setRows]               = useState([])
  const [loading, setLoading]         = useState(true)
  const [selectedRow, setSelectedRow] = useState(null)

  const fetchAll = useCallback(() => {
    setLoading(true)
    Promise.all(apps.map(async app => {
      const result = []

      // ── Regular college fee ──────────────────────────────
      // Only show when fee is configured (total_fee > 0) OR student has already paid something.
      // This prevents showing a pending row immediately after scrutiny approval before
      // division and installment are set by the college.
      const fsRes = await getCollegeFeeStatus(app.id).catch(() => null)
      const fs    = fsRes?.data?.data || null
      const regTotal     = Number(fs?.total_fee)  || 0
      const regPaid      = Number(fs?.total_paid) || 0
      const regRemaining = Math.max(0, regTotal - regPaid)
      const regStatus    = regTotal > 0 && regRemaining <= 0.01 ? 'paid'
                         : regPaid > 0                          ? 'partial'
                                                                : 'pending'
      if (regTotal > 0 || regPaid > 0) {
        result.push({
          kind:      'regular',
          app,
          feeStatus: fs,
          total:     regTotal,
          paid:      regPaid,
          remaining: regRemaining,
          status:    regStatus,
          lastPaid:  fs?.paid_records?.length
            ? fs.paid_records[fs.paid_records.length - 1].completed_at : null,
        })
      }

      // ── Misc & Exam fees ─────────────────────────────────
      const msRes  = await getMiscFeeStatus(app.id).catch(() => null)
      const msData = msRes?.data?.data || { pending: [], paid: [] }

      // Group by payment_type → misc_fee, exam_fee
      for (const type of ['misc_fee', 'exam_fee']) {
        const pendingRows = (msData.pending || []).filter(f => f.payment_type === type)
        const paidRows    = (msData.paid    || []).filter(f => f.payment_type === type)

        if (pendingRows.length === 0 && paidRows.length === 0) continue

        const totalAmt = [...pendingRows, ...paidRows].reduce((s, f) => s + Number(f.amount), 0)
        const paidAmt  = paidRows.reduce((s, f) => s + Number(f.amount), 0)
        const remAmt   = Math.max(0, totalAmt - paidAmt)
        const st       = remAmt <= 0.01 ? 'paid' : paidAmt > 0 ? 'partial' : 'pending'
        const lastPaid = paidRows.length
          ? paidRows[paidRows.length - 1].completed_at : null

        result.push({
          kind:        type === 'exam_fee' ? 'exam' : 'misc',
          app,
          feeStatus:   null,
          miscPending: pendingRows,
          miscPaid:    paidRows,
          total:       totalAmt,
          paid:        paidAmt,
          remaining:   remAmt,
          status:      st,
          lastPaid,
        })
      }

      return result
    }))
      .then(all => setRows(all.flat()))
      .finally(() => setLoading(false))
  }, [apps])

  useEffect(() => { fetchAll() }, [fetchAll])

  if (loading) return <SkeletonTable rows={5} cols={5} />

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
        <p className="text-slate-500 font-medium">No fee records found.</p>
        <p className="mt-1 text-sm text-slate-400">Fee details appear once your application is confirmed.</p>
      </div>
    )
  }

  const paidCount   = rows.filter(r => r.status === 'paid').length
  const pendingCount = rows.filter(r => r.status !== 'paid').length

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total"   value={rows.length}   color="slate" />
        <StatCard label="Paid"    value={paidCount}     color="emerald" />
        <StatCard label="Pending" value={pendingCount}  color="amber" />
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto rounded-lg border-2 border-slate-400">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-xs font-bold text-slate-600 uppercase tracking-wide border-b-2 border-slate-400">
            <tr>
              <th className="px-4 py-2.5 text-left">College / Course</th>
              <th className="px-4 py-2.5 text-left">Fee Type</th>
              <th className="px-4 py-2.5 text-right">Total Fee</th>
              <th className="px-4 py-2.5 text-right">Paid</th>
              <th className="px-4 py-2.5 text-right">Remaining</th>
              <th className="px-4 py-2.5 text-center">Status</th>
              <th className="px-4 py-2.5 text-left">Last Paid</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-slate-300">
            {rows.map((r, i) => (
              <tr
                key={i}
                onClick={() => setSelectedRow(r)}
                className="hover:bg-blue-50 cursor-pointer transition border-b-2 border-slate-300 last:border-b-0"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{r.app.college_name}</p>
                  <p className="text-xs text-slate-400">
                    {r.app.course_name} · {YEAR_LABEL[r.app.year_of_study]} · {r.app.academic_year}
                  </p>
                </td>
                <td className="px-4 py-3"><FeeTypeBadge kind={r.kind} /></td>
                <td className="px-4 py-3 text-right text-slate-700">{r.total > 0 ? fmtINR(r.total) : '—'}</td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-700">{r.paid > 0 ? fmtINR(r.paid) : '—'}</td>
                <td className="px-4 py-3 text-right font-semibold text-amber-700">{r.remaining > 0 ? fmtINR(r.remaining) : '—'}</td>
                <td className="px-4 py-3 text-center"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3 text-slate-500 text-xs">{r.lastPaid ? fmtDate(r.lastPaid) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {rows.map((r, i) => (
          <div
            key={i}
            onClick={() => setSelectedRow(r)}
            className="rounded-xl border border-slate-100 bg-white p-4 space-y-2 cursor-pointer hover:border-blue-200 transition"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-800">{r.app.college_name}</p>
                <p className="text-xs text-slate-400">{r.app.course_name} · {YEAR_LABEL[r.app.year_of_study]}</p>
              </div>
              <StatusBadge status={r.status} />
            </div>
            <div className="flex items-center justify-between text-xs">
              <FeeTypeBadge kind={r.kind} />
              <div className="text-right space-y-0.5">
                {r.total > 0 && <p className="text-slate-500">Total: <span className="font-semibold text-slate-700">{fmtINR(r.total)}</span></p>}
                {r.paid > 0 && <p className="text-emerald-700 font-semibold">Paid: {fmtINR(r.paid)}</p>}
                {r.remaining > 0 && <p className="text-amber-700 font-semibold">Due: {fmtINR(r.remaining)}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedRow && (
        <RowModal
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
          onPaid={() => { setSelectedRow(null); fetchAll() }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Modal — mirrors CollegeCollectPayPanel, online-only for student
// ─────────────────────────────────────────────────────────────
function RowModal({ row, onClose, onPaid }) {
  const isRegular    = row.kind === 'regular'
  const isMiscOrExam = row.kind === 'misc' || row.kind === 'exam'
  const allPaid      = row.status === 'paid'

  const [receiptsOpen, setReceiptsOpen] = useState(false)
  const [amount, setAmount]             = useState('')
  const [amtErr, setAmtErr]             = useState('')
  const [miscPaying, setMiscPaying]     = useState(null) // payment id being paid
  const [miscErr, setMiscErr]           = useState('')

  const {
    feeStatus,
    paying,
    payError,
    paidMsg,
    payOnline,
    setPayError,
    setPaidMsg,
  } = useCollegePayment(row.app.id)

  const fs         = isRegular ? (feeStatus || row.feeStatus) : null
  const remaining  = fs?.remaining ?? row.remaining
  const amtDue     = fs ? (fs.current_due ?? remaining) : remaining
  const amtIsFixed = fs && fs.installments?.length > 0 && amtDue < remaining - 0.01

  useEffect(() => {
    if (amtDue > 0) setAmount(String(amtDue))
  }, [amtDue])

  async function handleOnlinePay(e) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { setAmtErr('Enter a valid amount.'); return }
    if (amt > remaining + 0.01) { setAmtErr(`Cannot exceed ${fmtINR(remaining)}.`); return }
    setAmtErr(''); setPayError(''); setPaidMsg('')
    await payOnline(amt)
  }

  async function handleMiscPay(paymentId, amount) {
    setMiscErr(''); setMiscPaying(paymentId)
    try {
      const r = await initiateMiscFeePayment({ application_id: row.app.id, payment_id: paymentId })
      const { endpoint, fields } = r.data.data
      const form = document.createElement('form')
      form.method = 'POST'; form.action = endpoint
      Object.entries(fields).forEach(([k, v]) => {
        const inp = document.createElement('input')
        inp.type = 'hidden'; inp.name = k; inp.value = v
        form.appendChild(inp)
      })
      document.body.appendChild(form); form.submit()
    } catch (e) {
      setMiscErr(e?.response?.data?.message || 'Failed to initiate payment.')
      setMiscPaying(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <div>
            <p className="font-bold text-slate-950 text-base">{row.app.college_name}</p>
            <p className="text-sm text-slate-500 mt-0.5">
              {row.app.course_name} · {YEAR_LABEL[row.app.year_of_study]} · {row.app.academic_year}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <FeeTypeBadge kind={row.kind} />
              <StatusBadge status={row.status} />
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none mt-0.5 ml-3 shrink-0">✕</button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* ── Fee summary cards ── */}
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-center">
              <p className="text-xs text-slate-400">Total Fee</p>
              <p className="font-bold text-slate-950 mt-0.5">{row.total > 0 ? fmtINR(row.total) : '—'}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-center">
              <p className="text-xs text-slate-400">Paid</p>
              <p className="font-bold text-emerald-700 mt-0.5">{fmtINR(row.paid)}</p>
            </div>
            <div className={`rounded-lg border p-3 text-center ${row.remaining > 0 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
              <p className="text-xs text-slate-400">Remaining</p>
              <p className={`font-bold mt-0.5 ${row.remaining > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{fmtINR(row.remaining)}</p>
            </div>
          </div>

          {/* ── Fee head breakdown (regular) ── */}
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
                      <td className="px-3 py-1.5 text-right font-mono text-slate-600">{Number(h.amount).toLocaleString('en-IN')}</td>
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

          {/* ── Misc/Exam fee heads breakdown ── */}
          {isMiscOrExam && (
            <div className="space-y-2">
              {/* Pending payments */}
              {(row.miscPending || []).map(f => (
                <div key={f.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                  {f.fee_heads?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {f.fee_heads.map(h => (
                        <span key={h.fees_code} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{h.fees_head}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-semibold">Pending — {fmtINR(f.amount)}</span>
                    <button
                      onClick={() => handleMiscPay(f.id, f.amount)}
                      disabled={miscPaying === f.id}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition"
                    >
                      {miscPaying === f.id ? 'Redirecting…' : `Pay Now — ${fmtINR(f.amount)}`}
                    </button>
                  </div>
                </div>
              ))}
              {(row.miscPaid || []).map(f => (
                <div key={f.id} className="rounded-lg border border-slate-200 bg-white p-3">
                  {f.fee_heads?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {f.fee_heads.map(h => (
                        <span key={h.fees_code} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{h.fees_head}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-emerald-700 font-semibold">Paid — {fmtINR(f.amount)}</span>
                    <span className="text-xs text-slate-400">{fmtDate(f.completed_at)} {fmtTime(f.completed_at)}</span>
                  </div>
                </div>
              ))}
              {miscErr && <p className="text-xs text-red-600">{miscErr}</p>}
            </div>
          )}

          {/* ── Messages ── */}
          {(paidMsg || payError || amtErr) && (
            <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${paidMsg ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {paidMsg || payError || amtErr}
            </div>
          )}

          {/* ── Online payment form (regular, not fully paid) ── */}
          {isRegular && !allPaid && (fs?.total_fee > 0 || row.total > 0) && (
            <form onSubmit={handleOnlinePay} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 space-y-3">
              <p className="text-sm font-semibold text-blue-800">Pay Online</p>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-xs text-blue-700 mb-1 block">
                    Amount (₹){amtIsFixed && <span className="ml-1 text-blue-400">(fixed instalment)</span>}
                  </label>
                  <input
                    type="text" inputMode="numeric"
                    value={amount}
                    onChange={e => { setAmount(e.target.value.replace(/[^0-9.]/g, '')); setAmtErr('') }}
                    readOnly={amtIsFixed}
                    placeholder={`Max ${fmtINR(remaining)}`}
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${amtIsFixed ? 'bg-blue-100 border-blue-200 text-blue-700 cursor-not-allowed' : 'border-blue-200 bg-white'}`}
                    required
                  />
                </div>
                <button type="submit" disabled={paying}
                  className="shrink-0 rounded-lg bg-blue-600 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-700 disabled:opacity-50 transition">
                  {paying ? 'Redirecting…' : 'Pay via PayU'}
                </button>
              </div>
              <p className="text-xs text-blue-600">You will be redirected to PayU for UPI, card, or netbanking payment.</p>
            </form>
          )}

          {isRegular && allPaid && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 font-medium">
              All fees have been paid in full.
            </div>
          )}

          {/* ── Transactions (regular fee) ── */}
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
                          {p.gateway === 'cash' ? 'Cash / Offline' : p.via_payment_link ? 'WhatsApp Link (PayU)' : 'Online (PayU)'}
                        </p>
                        <p className="text-xs text-slate-400">{fmtDate(p.completed_at)} {fmtTime(p.completed_at)}</p>
                      </div>
                    </div>
                    <span className="font-bold text-emerald-700">{fmtINR(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Receipts toggle ── */}
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
                <PaymentReceipts applicationId={row.app.id} hideTypes={['application_fee']} showOrderId />
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Shared components
// ─────────────────────────────────────────────────────────────
function FeeTypeBadge({ kind }) {
  if (kind === 'regular') return <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600">Regular</span>
  if (kind === 'misc')    return <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600">Misc Fees</span>
  if (kind === 'exam')    return <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600">Exam Fees</span>
  return null
}

// Exact same colors as college FeeReceipts StatusBadge
function StatusBadge({ status }) {
  if (status === 'paid')    return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Paid</span>
  if (status === 'partial') return <span className="rounded-full bg-blue-100   px-2.5 py-0.5 text-xs font-semibold text-blue-700">Partial</span>
                            return <span className="rounded-full bg-red-100    px-2.5 py-0.5 text-xs font-semibold text-red-600">Pending</span>
}

function StatCard({ label, value, color }) {
  const colors = {
    slate:   'bg-slate-50  border-slate-100  text-slate-800',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-800',
    amber:   'bg-amber-50  border-amber-100  text-amber-800',
  }
  return (
    <div className={`rounded-xl border px-4 py-3 ${colors[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-semibold uppercase tracking-wide mt-0.5 opacity-70">{label}</p>
    </div>
  )
}
