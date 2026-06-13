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
import { sendPaymentLink } from '../../../services/collegeAdminService.js'

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
  const [payMode, setPayMode]           = useState(null)   // null | 'cash' | 'online' | 'link'
  const [amount, setAmount]             = useState('')
  const [note, setNote]                 = useState('')
  const [receiptsOpen, setReceiptsOpen] = useState(false)
  const [linkPhone, setLinkPhone]       = useState('')
  const [linkSending, setLinkSending]   = useState(false)
  const [linkSent, setLinkSent]         = useState(false)
  const [linkErr, setLinkErr]           = useState('')

  const {
    feeStatus,
    loading,
    paying: saving,
    payError: err,
    paidMsg: msg,
    payOnline,
    payCash,
    setPayError: setErr,
    setPaidMsg: setMsg,
  } = useCollegePayment(appId, collegeId, { onPaid })

  const fs      = feeStatus
  const allPaid = fs && fs.total_fee > 0 && fs.remaining <= 0
  // current_due: computed from installment plan — the exact amount due for this payment step.
  // If installments are configured, it's the cumulative threshold minus amount paid so far.
  // Falls back to remaining if no installment plan is set.
  const amtDue      = fs ? (fs.current_due ?? fs.remaining) : 0
  // Amount is fixed (read-only) when there are installments and current_due < remaining
  // (meaning the student is still in a fixed-installment phase, not free payment phase)
  const amtIsFixed  = fs && fs.installments?.length > 0 && amtDue < fs.remaining - 0.01

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

  async function handleSendLink(e) {
    e.preventDefault()
    const phone = linkPhone.trim().replace(/\D/g, '')
    if (phone.length < 10) { setLinkErr('Enter a valid 10-digit mobile number.'); return }
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { setLinkErr('Enter a valid amount.'); return }
    if (amt > fs.remaining + 0.01) { setLinkErr(`Amount cannot exceed remaining balance ${fmtINR(fs.remaining)}.`); return }
    setLinkSending(true)
    setLinkErr('')
    try {
      await sendPaymentLink({ application_id: appId, payment_type: 'college_fee', phone, amount: amt })
      setLinkSent(true)
    } catch (err) {
      setLinkErr(err?.response?.data?.message || 'Failed to send link.')
    } finally {
      setLinkSending(false)
    }
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

            {/* ── Fee head breakdown with payment status ─ */}
            {fs.breakdown?.filter(h => (h.fees_type || '').toLowerCase() !== 'platform').length > 0 && (
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
                          {parseFloat(h.amount).toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-800">
                          {h.paid_amount > 0 ? parseFloat(h.paid_amount).toLocaleString('en-IN') : '—'}
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
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => { setPayMode('cash'); setErr(''); setMsg(''); setAmount(String(amtDue)) }}
                    className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-slate-200 bg-white px-3 py-4 hover:border-slate-400 hover:bg-slate-50 transition"
                  >
                    <span className="text-xl">💵</span>
                    <span className="text-xs font-semibold text-slate-800">Cash / Offline</span>
                    <span className="text-xs text-slate-400 text-center leading-tight">Record cash received at counter</span>
                  </button>
                  <button
                    onClick={() => { setPayMode('online'); setErr(''); setMsg(''); setAmount(String(amtDue)) }}
                    className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-slate-200 bg-white px-3 py-4 hover:border-blue-400 hover:bg-blue-50 transition"
                  >
                    <span className="text-xl">💳</span>
                    <span className="text-xs font-semibold text-slate-800">Online (PayU)</span>
                    <span className="text-xs text-slate-400 text-center leading-tight">Pay via UPI, card or netbanking</span>
                  </button>
                  <button
                    onClick={() => { setPayMode('link'); setLinkErr(''); setLinkSent(false); setLinkPhone(''); setAmount(String(amtDue)) }}
                    className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-slate-200 bg-white px-3 py-4 hover:border-emerald-400 hover:bg-emerald-50 transition"
                  >
                    <span className="text-xl">📲</span>
                    <span className="text-xs font-semibold text-slate-800">WhatsApp Link</span>
                    <span className="text-xs text-slate-400 text-center leading-tight">Send payment link to student</span>
                  </button>
                </div>
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
                      {amtIsFixed && <span className="ml-1 text-slate-400">(fixed instalment)</span>}
                    </label>
                    <input
                      type="text" inputMode="numeric"
                      value={amount}
                      onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                      readOnly={amtIsFixed}
                      placeholder={`Max ${fmtINR(fs.remaining)}`}
                      className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                        amtIsFixed ? 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed' : 'border-slate-200'
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
                  <p className="text-sm font-semibold text-blue-800">Online Payment via PayU</p>
                  <button type="button" onClick={() => { setPayMode(null); setErr(''); setAmount('') }}
                    className="text-xs text-slate-400 hover:text-slate-600">← Back</button>
                </div>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-blue-700 mb-1 block">
                      Amount (₹)
                      {amtIsFixed && <span className="ml-1 text-blue-400">(fixed instalment)</span>}
                    </label>
                    <input
                      type="text" inputMode="numeric"
                      value={amount}
                      onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                      readOnly={amtIsFixed}
                      placeholder={`Max ${fmtINR(fs.remaining)}`}
                      className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                        amtIsFixed ? 'bg-blue-100 border-blue-200 text-blue-700 cursor-not-allowed' : 'border-blue-200 bg-white'
                      }`}
                      required
                    />
                  </div>
                  <button type="submit" disabled={saving}
                    className="shrink-0 rounded-lg bg-blue-600 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-700 disabled:opacity-50 transition">
                    {saving ? 'Redirecting…' : 'Pay via PayU'}
                  </button>
                </div>
                <p className="text-xs text-blue-600">You will be redirected to PayU for UPI, card, or netbanking payment.</p>
              </form>
            )}

            {/* ── WhatsApp payment link form ──────────────── */}
            {!allPaid && payMode === 'link' && (
              <form onSubmit={handleSendLink} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-emerald-800">Send Payment Link via WhatsApp</p>
                  <button type="button" onClick={() => { setPayMode(null); setLinkErr(''); setLinkSent(false) }}
                    className="text-xs text-slate-400 hover:text-slate-600">← Back</button>
                </div>
                {linkSent ? (
                  <div className="rounded-lg bg-white border border-emerald-200 px-4 py-3 text-sm text-emerald-700 font-medium">
                    ✓ Payment link sent to {linkPhone}. The student can pay via the link.
                  </div>
                ) : (
                  <>
                    <div className="flex gap-3 items-end">
                      <div className="flex-1">
                        <label className="text-xs text-emerald-700 mb-1 block">
                          Amount (₹)
                          {amtIsFixed && <span className="ml-1 text-emerald-500">(fixed instalment)</span>}
                        </label>
                        <input
                          type="text" inputMode="numeric"
                          value={amount}
                          onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                          readOnly={amtIsFixed}
                          placeholder={`Max ${fmtINR(fs.remaining)}`}
                          className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                            amtIsFixed ? 'bg-emerald-100 border-emerald-200 text-emerald-700 cursor-not-allowed' : 'border-emerald-200 bg-white'
                          }`}
                          required
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-emerald-700 mb-1 block">Student Mobile Number</label>
                        <input
                          type="tel" inputMode="numeric" maxLength={10}
                          value={linkPhone}
                          onChange={e => setLinkPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          placeholder="10-digit mobile"
                          className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          required
                        />
                      </div>
                    </div>
                    {linkErr && <p className="text-xs text-red-600">{linkErr}</p>}
                    <button type="submit" disabled={linkSending}
                      className="w-full rounded-lg bg-emerald-600 text-white text-sm font-semibold px-4 py-2 hover:bg-emerald-700 disabled:opacity-50 transition">
                      {linkSending ? 'Sending…' : 'Send via WhatsApp'}
                    </button>
                  </>
                )}
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
                            {p.gateway === 'cash' || p.razorpay_payment_id?.startsWith('CASH-')
                              ? 'Cash / Offline'
                              : p.via_payment_link
                              ? 'WhatsApp Link (PayU)'
                              : `Online (${p.gateway === 'payu' ? 'PayU' : 'Online'})`}
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
                    <PaymentReceipts applicationId={appId} hideTypes={['application_fee']} showOrderId />
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