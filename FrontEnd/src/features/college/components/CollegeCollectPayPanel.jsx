/**
 * CollegeCollectPayPanel — shared college-side fee collection panel.
 *
 * Used in:
 *  - ApplicationDetail (inline card, no close button, no receipts toggle)
 *  - FeeReceipts modal (modal body, has close button + receipts toggle)
 *
 * Props:
 *   appId      {number}           — application ID
 *   collegeId  {number}           — college ID (needed for cash payments)
 *   onPaid     {() => void}       — called after any successful payment
 *   header     {ReactNode}        — optional custom header (for modal variant)
 *   onClose    {() => void}       — if provided, renders a ✕ button in the header
 *   showReceipts {boolean}        — whether to show PaymentReceipts toggle (modal variant)
 */
import { useState } from 'react'
import { useCollegePayment } from '../../../shared/hooks/useCollegePayment.js'
import PaymentReceipts from '../../student/pages/PaymentReceipts.jsx'
import { SkeletonCards } from '../../../shared/components/Skeleton.jsx'

function fmtINR(n) { return `₹${Number(n).toLocaleString('en-IN')}` }

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

export default function CollegeCollectPayPanel({ appId, collegeId, onPaid, header, onClose, showReceipts: enableReceipts = false }) {
  const [payMode, setPayMode]           = useState(null)   // null | 'cash' | 'online'
  const [amount, setAmount]             = useState('')
  const [note, setNote]                 = useState('')
  const [receiptsOpen, setReceiptsOpen] = useState(false)

  const {
    feeStatus,
    loading,
    paying: saving,
    payError: err,
    paidMsg: msg,
    scriptError,
    payOnline,
    payCash,
    setPayError: setErr,
    setPaidMsg: setMsg,
  } = useCollegePayment(appId, collegeId, { onPaid })

  const fs      = feeStatus
  const allPaid = fs && fs.total_fee > 0 && fs.remaining <= 0
  const amtDue  = fs ? (fs.total_paid > 0 ? fs.remaining : (fs.fee_pay_now_amount || fs.remaining)) : 0

  async function handleCash(e) {
    e.preventDefault()
    await payCash({ amount: parseFloat(amount), note }, {
      onSuccess: () => { setAmount(''); setNote(''); setPayMode(null); setReceiptsOpen(true) },
    })
  }

  async function handleOnline(e) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { setErr('Enter a valid amount.'); return }
    await payOnline(amt, {
      onSuccess: () => { setPayMode(null); setReceiptsOpen(true) },
    })
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* ── Header ─────────────────────────────────────────── */}
      {header ? (
        // Custom header slot (modal variant)
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <div className="flex-1 min-w-0">{header}</div>
          {onClose && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none mt-0.5 ml-3 shrink-0">✕</button>
          )}
        </div>
      ) : (
        // Default inline header
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Collect Fee Payment</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {fs ? (allPaid ? 'All fees have been collected.' : `${fmtINR(fs.remaining)} remaining`) : ''}
            </p>
          </div>
          {fs && (
            allPaid
              ? <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Fully Paid</span>
              : <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Pending</span>
          )}
        </div>
      )}

      <div className="px-4 py-4 space-y-4">
        {loading && <SkeletonCards count={2} />}

        {fs && (
          <>
            {/* ── Fee summary ────────────────────────────── */}
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-center">
                <p className="text-xs text-slate-400">Total Fee</p>
                <p className="font-bold text-slate-950 mt-0.5">
                  {fs.total_fee > 0 ? fmtINR(fs.total_fee) : '—'}
                </p>
              </div>
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-center">
                <p className="text-xs text-slate-400">Paid</p>
                <p className="font-bold text-emerald-700 mt-0.5">{fmtINR(fs.total_paid)}</p>
              </div>
              <div className={`rounded-lg border p-3 text-center ${fs.remaining > 0 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                <p className="text-xs text-slate-400">Remaining</p>
                <p className={`font-bold mt-0.5 ${fs.remaining > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                  {fmtINR(fs.remaining)}
                </p>
              </div>
            </div>

            {/* ── Status messages ────────────────────────── */}
            {msg && <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 font-medium">{msg}</div>}
            {err && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{err}</div>}

            {allPaid && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 font-medium">
                All fees have been paid in full.
              </div>
            )}

            {!allPaid && fs.total_fee === 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                Fee amount not set yet. Set fees from the application detail page first.
              </div>
            )}

            {/* ── Mode chooser ───────────────────────────── */}
            {!allPaid && fs.total_fee > 0 && !payMode && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Collect Payment</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setPayMode('cash'); setErr(''); setMsg(''); setAmount(String(amtDue)) }}
                    className="flex flex-col items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 py-4 hover:border-slate-400 hover:bg-slate-50 transition"
                  >
                    <span className="text-2xl">💵</span>
                    <span className="text-sm font-semibold text-slate-800">Cash / Offline</span>
                    <span className="text-xs text-slate-400 text-center">Record a cash or offline payment received at the counter</span>
                  </button>
                  <button
                    onClick={() => { setPayMode('online'); setErr(''); setMsg(''); setAmount(String(amtDue)) }}
                    disabled={!!scriptError}
                    className="flex flex-col items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 py-4 hover:border-blue-400 hover:bg-blue-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="text-2xl">💳</span>
                    <span className="text-sm font-semibold text-slate-800">Online (Razorpay)</span>
                    <span className="text-xs text-slate-400 text-center">Student pays via UPI, card, or netbanking now</span>
                  </button>
                </div>
                {scriptError && (
                  <p className="text-xs text-amber-600">Payment gateway could not be loaded. Online payments unavailable.</p>
                )}
              </div>
            )}

            {/* ── Cash form ──────────────────────────────── */}
            {!allPaid && payMode === 'cash' && (
              <form onSubmit={handleCash} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">Record Cash / Offline Payment</p>
                  <button type="button" onClick={() => { setPayMode(null); setErr('') }}
                    className="text-xs text-slate-400 hover:text-slate-600">← Back</button>
                </div>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 mb-1 block">
                      Amount (₹)
                      {fs.total_paid <= 0 && <span className="ml-1 text-slate-400">(first instalment — fixed)</span>}
                    </label>
                    <input
                      type="text" inputMode="numeric"
                      value={amount}
                      onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                      readOnly={fs.total_paid <= 0}
                      placeholder={`Max ${fmtINR(fs.remaining)}`}
                      className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                        fs.total_paid <= 0 ? 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed' : 'border-slate-200'
                      }`}
                      required
                    />
                  </div>
                  <button type="submit" disabled={saving}
                    className="shrink-0 rounded-lg bg-slate-900 text-white text-sm font-semibold px-4 py-2 hover:bg-slate-700 disabled:opacity-50 transition">
                    {saving ? 'Saving…' : 'Record'}
                  </button>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Note (optional)</label>
                  <input type="text" value={note} onChange={e => setNote(e.target.value)}
                    placeholder="e.g. Cash received at counter"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              </form>
            )}

            {/* ── Online payment form ─────────────────────── */}
            {!allPaid && payMode === 'online' && (
              <form onSubmit={handleOnline} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-blue-800">Online Payment via Razorpay</p>
                  <button type="button" onClick={() => { setPayMode(null); setErr(''); setAmount('') }}
                    className="text-xs text-slate-400 hover:text-slate-600">← Back</button>
                </div>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-blue-700 mb-1 block">
                      Amount (₹)
                      {fs.total_paid <= 0 && <span className="ml-1 text-blue-400">(first instalment — fixed)</span>}
                    </label>
                    <input
                      type="text" inputMode="numeric"
                      value={amount}
                      onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                      readOnly={fs.total_paid <= 0}
                      placeholder={`Max ${fmtINR(fs.remaining)}`}
                      className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                        fs.total_paid <= 0 ? 'bg-blue-100 border-blue-200 text-blue-700 cursor-not-allowed' : 'border-blue-200 bg-white'
                      }`}
                      required
                    />
                  </div>
                  <button type="submit" disabled={saving}
                    className="shrink-0 rounded-lg bg-blue-600 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-700 disabled:opacity-50 transition">
                    {saving ? 'Processing…' : 'Open Razorpay'}
                  </button>
                </div>
                <p className="text-xs text-blue-600">Razorpay checkout will open for UPI, card, or netbanking payment.</p>
              </form>
            )}

            {/* ── Transactions list ───────────────────────── */}
            {fs.paid_records?.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Transactions</p>
                <div className="space-y-1.5">
                  {fs.paid_records.map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2.5 text-sm">
                      <div className="flex items-center gap-2.5">
                        <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700 shrink-0">
                          {i + 1}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">
                            {p.razorpay_payment_id?.startsWith('CASH-') ? 'Cash / Offline' : 'Online (Razorpay)'}
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

            {/* ── Receipts toggle (modal variant only) ───── */}
            {enableReceipts && (
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
                    <PaymentReceipts applicationId={appId} hideTypes={['application_fee']} />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}