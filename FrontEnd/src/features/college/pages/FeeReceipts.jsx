import { useEffect, useState, useCallback } from 'react'
import api from '../../../services/api.js'
import PaymentReceipts from '../../student/pages/PaymentReceipts.jsx'
import { useRazorpay } from '../../../shared/hooks/useRazorpay.js'
import Pagination from '../../../shared/components/Pagination.jsx'

const YEAR_LABEL = { 1: 'FY', 2: 'SY', 3: 'TY' }

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

const LIMIT = 20

export default function FeeReceipts({ collegeId }) {
  const [rows, setRows]               = useState([])
  const [courses, setCourses]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [selected, setSelected]       = useState(null)   // row opened in modal
  const [pagination, setPagination]   = useState({ page: 1, totalPages: 1, total: 0 })
  const [page, setPage]               = useState(1)

  // Filters
  const [status, setStatus]           = useState('')
  const [courseId, setCourseId]       = useState('')
  const [yearFilter, setYear]         = useState('')
  const [search, setSearch]           = useState('')
  const [searchInput, setSearchInput] = useState('')

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [status, courseId, yearFilter, search])

  useEffect(() => {
    api.get(`masters/${collegeId}/faculty`)
      .then(r => setCourses((r.data.data || []).filter(f => f.is_active)))
      .catch(() => {})
  }, [collegeId])

  const fetchReceipts = useCallback(() => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ page, limit: LIMIT })
    if (status)     params.set('status', status)
    if (courseId)   params.set('course_id', courseId)
    if (yearFilter) params.set('year_of_study', yearFilter)
    if (search)     params.set('q', search)
    api.get(`college-admin/${collegeId}/fee-receipts?${params}`)
      .then(r => {
        setRows(r.data.data || [])
        setPagination(r.data.pagination || { page: 1, totalPages: 1, total: 0 })
      })
      .catch(() => setError('Failed to load fee receipts.'))
      .finally(() => setLoading(false))
  }, [collegeId, page, status, courseId, yearFilter, search])

  useEffect(() => { fetchReceipts() }, [fetchReceipts])

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const paid    = rows.filter(r => Number(r.fee_total_amount) > 0 && Number(r.amount_paid) >= Number(r.fee_total_amount) - 0.01)
  const pending = rows.filter(r => !(Number(r.fee_total_amount) > 0 && Number(r.amount_paid) >= Number(r.fee_total_amount) - 0.01))
  const summary = rows

  function handleRowClick(row) {
    setSelected(row)
  }

  function handlePanelClose() {
    setSelected(null)
    fetchReceipts()   // refresh totals after possible payment
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">College portal</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Fee Receipts</h1>
        <p className="mt-1 text-slate-600">College fee payment status for confirmed students.</p>
      </div>

      {/* Summary counters */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total"   value={pagination.total} color="slate" />
        <StatCard label="Paid"    value={paid.length}      color="emerald" />
        <StatCard label="Pending" value={pending.length}   color="amber" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search name, phone, reg. no…"
          className="flex-1 min-w-48 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="">All Statuses</option>
          <option value="paid">Paid</option>
          <option value="partial">Partially</option>
          <option value="pending">Pending</option>
        </select>
        <select value={courseId} onChange={e => setCourseId(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="">All Courses</option>
          {courses.map(c => (
            <option key={c.code_no} value={c.code_no}>
              {c.degree_course_code} — {c.degree_course_name}
            </option>
          ))}
        </select>
        <select value={yearFilter} onChange={e => setYear(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="">All Years</option>
          <option value="1">FY</option>
          <option value="2">SY</option>
          <option value="3">TY</option>
        </select>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : summary.length === 0 ? (
        <p className="text-slate-500 text-sm">No records found.</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border-2 border-slate-400">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-xs font-bold text-slate-600 uppercase tracking-wide border-b-2 border-slate-400">
                <tr>
                  <th className="px-4 py-2.5 text-left">Student</th>
                  <th className="px-4 py-2.5 text-left">Course / Year</th>
                  <th className="px-4 py-2.5 text-left">Reg. No.</th>
                  <th className="px-4 py-2.5 text-right">Total Fee</th>
                  <th className="px-4 py-2.5 text-right">Paid</th>
                  <th className="px-4 py-2.5 text-right">Remaining</th>
                  <th className="px-4 py-2.5 text-center">Status</th>
                  <th className="px-4 py-2.5 text-left">Last Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-300">
                {summary.map(r => {
                  const total     = r.fee_total_amount != null ? Number(r.fee_total_amount) : null
                  const paidAmt   = Number(r.amount_paid) || 0
                  const remaining = total != null ? Math.max(0, total - paidAmt) : null
                  return (
                    <tr
                      key={r.application_id}
                      onClick={() => handleRowClick(r)}
                      className="hover:bg-blue-50 cursor-pointer transition border-b-2 border-slate-300 last:border-b-0"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{r.student_name}</p>
                        <p className="text-xs text-slate-400">{r.student_phone || '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {r.course_name}
                        <span className="ml-1 text-xs text-slate-400">· {YEAR_LABEL[r.year_of_study]}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500 text-xs">{r.registration_number || '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {total != null ? `₹${total.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                        {paidAmt > 0 ? `₹${paidAmt.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-700">
                        {remaining != null && remaining > 0 ? `₹${remaining.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge remaining={remaining} total={total} paidAmt={paidAmt} />
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {r.completed_at ? fmtDate(r.completed_at) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {summary.map(r => {
              const total     = r.fee_total_amount != null ? Number(r.fee_total_amount) : null
              const paidAmt   = Number(r.amount_paid) || 0
              const remaining = total != null ? Math.max(0, total - paidAmt) : null
              return (
                <div
                  key={r.application_id}
                  onClick={() => handleRowClick(r)}
                  className="rounded-xl border border-slate-100 bg-white p-4 space-y-2 cursor-pointer hover:border-blue-200 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-800">{r.student_name}</p>
                      <p className="text-xs text-slate-400">{r.student_phone || '—'}</p>
                    </div>
                    <StatusBadge remaining={remaining} total={total} paidAmt={paidAmt} />
                  </div>
                  <p className="text-sm text-slate-600">{r.course_name} · {YEAR_LABEL[r.year_of_study]}</p>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-mono">{r.registration_number || '—'}</span>
                    <div className="text-right space-y-0.5">
                      {total != null && <p className="text-slate-500">Total: <span className="font-semibold text-slate-700">₹{total.toLocaleString('en-IN')}</span></p>}
                      {paidAmt > 0 && <p className="text-emerald-700 font-semibold">Paid: ₹{paidAmt.toLocaleString('en-IN')}</p>}
                      {remaining != null && remaining > 0 && <p className="text-amber-700 font-semibold">Due: ₹{remaining.toLocaleString('en-IN')}</p>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        onPageChange={setPage}
      />

      {/* Student Fee Modal */}
      {selected && (
        <CollegeFeeModal
          row={selected}
          collegeId={collegeId}
          onClose={handlePanelClose}
        />
      )}
    </section>
  )
}

// ── Modal wrapper ─────────────────────────────────────────────
function CollegeFeeModal({ row, collegeId, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-xl max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl">
        <CollegeFeePanel row={row} collegeId={collegeId} onClose={onClose} />
      </div>
    </div>
  )
}

// ── Fee panel (fee status + cash/online payment + receipts) ──
function CollegeFeePanel({ row, collegeId, onClose }) {
  const { openCheckout, scriptError } = useRazorpay()

  const [feeStatus, setFeeStatus]       = useState(null)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState('')
  const [payMode, setPayMode]           = useState(null)   // null | 'cash' | 'online'
  const [amount, setAmount]             = useState('')
  const [note, setNote]                 = useState('')
  const [saving, setSaving]             = useState(false)
  const [saveMsg, setSaveMsg]           = useState('')
  const [saveErr, setSaveErr]           = useState('')
  const [showReceipts, setShowReceipts] = useState(false)

  function fetchStatus() {
    setLoading(true)
    api.get(`payments/college-fee-status/${row.application_id}`)
      .then(r => setFeeStatus(r.data.data))
      .catch(() => setError('Failed to load fee details.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchStatus() }, [row.application_id])

  // ── Cash payment ─────────────────────────────────────────
  async function handleCash(e) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { setSaveErr('Enter a valid amount.'); return }
    setSaveErr(''); setSaveMsg(''); setSaving(true)
    try {
      const res = await api.post(
        `college-admin/${collegeId}/applications/${row.application_id}/record-cash-payment`,
        { amount: amt, note: note.trim() || undefined }
      )
      setSaveMsg(res.data.message)
      setAmount(''); setNote('')
      setPayMode(null)
      setShowReceipts(true)
      fetchStatus()
    } catch (err) {
      setSaveErr(err?.response?.data?.message || 'Failed to record payment.')
    } finally { setSaving(false) }
  }

  // ── Online payment (Razorpay) ─────────────────────────────
  async function handleOnline(e) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { setSaveErr('Enter a valid amount.'); return }
    setSaveErr(''); setSaveMsg(''); setSaving(true)
    try {
      const orderRes = await api.post('payments/create-order', {
        application_id: row.application_id,
        payment_type:   'college_fee',
        amount:         amt,
      })
      const orderData = orderRes.data.data
      setSaving(false)

      openCheckout({
        orderData,
        onSuccess: async (rzpResponse) => {
          setSaving(true)
          try {
            const verifyRes = await api.post('payments/verify', {
              application_id:      row.application_id,
              payment_type:        'college_fee',
              razorpay_order_id:   rzpResponse.razorpay_order_id,
              razorpay_payment_id: rzpResponse.razorpay_payment_id,
              razorpay_signature:  rzpResponse.razorpay_signature,
            })
            setSaveMsg(verifyRes.data.message)
            setPayMode(null)
            setShowReceipts(true)
            fetchStatus()
          } catch (err) {
            setSaveErr(err?.response?.data?.message || 'Payment verification failed.')
          } finally { setSaving(false) }
        },
        onFailure: (err) => {
          setSaving(false)
          if (err.message !== 'Payment cancelled by user.') setSaveErr(err.message)
        },
      })
    } catch (err) {
      setSaveErr(err?.response?.data?.message || 'Could not initiate payment.')
      setSaving(false)
    }
  }

  const fs      = feeStatus
  const allPaid = fs && fs.total_fee > 0 && fs.remaining <= 0
  const amtDue  = fs ? (fs.total_paid > 0 ? fs.remaining : (fs.fee_pay_now_amount || fs.remaining)) : 0

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-slate-100">
        <div>
          <p className="font-bold text-slate-950 text-base">{row.student_name}</p>
          <p className="text-sm text-slate-500 mt-0.5">{row.course_name} · {YEAR_LABEL[row.year_of_study]}</p>
          {row.registration_number && (
            <p className="text-xs font-mono text-slate-400 mt-0.5">{row.registration_number}</p>
          )}
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none mt-0.5">✕</button>
      </div>

      <div className="px-5 py-4 space-y-5">
        {loading && <p className="text-slate-400 text-sm">Loading…</p>}
        {error   && <p className="text-red-500 text-sm">{error}</p>}

        {fs && (
          <>
            {/* Fee summary cards */}
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-center">
                <p className="text-xs text-slate-400">Total Fee</p>
                <p className="font-bold text-slate-950 mt-0.5">
                  {fs.total_fee > 0 ? `₹${Number(fs.total_fee).toLocaleString('en-IN')}` : '—'}
                </p>
              </div>
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-center">
                <p className="text-xs text-slate-400">Paid</p>
                <p className="font-bold text-emerald-700 mt-0.5">
                  ₹{Number(fs.total_paid).toLocaleString('en-IN')}
                </p>
              </div>
              <div className={`rounded-lg border p-3 text-center ${fs.remaining > 0 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                <p className="text-xs text-slate-400">Remaining</p>
                <p className={`font-bold mt-0.5 ${fs.remaining > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                  ₹{Number(fs.remaining).toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {saveMsg && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 font-medium">
                {saveMsg}
              </div>
            )}
            {saveErr && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{saveErr}</div>
            )}

            {/* Already paid */}
            {allPaid && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 font-medium">
                All fees have been paid in full.
              </div>
            )}

            {/* No fee set */}
            {!allPaid && fs.total_fee === 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                Fee amount not set yet. Set fees from the application detail page first.
              </div>
            )}

            {/* Payment mode chooser */}
            {!allPaid && fs.total_fee > 0 && !payMode && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Collect Payment</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setPayMode('cash'); setSaveErr(''); setSaveMsg(''); setAmount(String(amtDue)) }}
                    className="flex flex-col items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 py-4 hover:border-slate-400 hover:bg-slate-50 transition"
                  >
                    <span className="text-2xl">💵</span>
                    <span className="text-sm font-semibold text-slate-800">Cash / Offline</span>
                    <span className="text-xs text-slate-400 text-center">Record a cash or offline payment received at the counter</span>
                  </button>
                  <button
                    onClick={() => { setPayMode('online'); setSaveErr(''); setSaveMsg(''); setAmount(String(amtDue)) }}
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

            {/* Cash form */}
            {!allPaid && payMode === 'cash' && (
              <form onSubmit={handleCash} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">Record Cash / Offline Payment</p>
                  <button type="button" onClick={() => { setPayMode(null); setSaveErr('') }}
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
                      placeholder={`Max ₹${Number(fs.remaining).toLocaleString('en-IN')}`}
                      className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                        fs.total_paid <= 0 ? 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed' : 'border-slate-200'
                      }`}
                      required
                    />
                  </div>
                  <button
                    type="submit" disabled={saving}
                    className="shrink-0 rounded-lg bg-slate-900 text-white text-sm font-semibold px-4 py-2 hover:bg-slate-700 disabled:opacity-50 transition"
                  >
                    {saving ? 'Saving…' : 'Record'}
                  </button>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Note (optional)</label>
                  <input
                    type="text"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="e.g. Cash received at counter"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              </form>
            )}

            {/* Online payment */}
            {!allPaid && payMode === 'online' && (
              <form onSubmit={handleOnline} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-blue-800">Online Payment via Razorpay</p>
                  <button type="button" onClick={() => { setPayMode(null); setSaveErr(''); setAmount('') }}
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
                      placeholder={`Max ₹${Number(fs.remaining).toLocaleString('en-IN')}`}
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

            {/* Transactions list */}
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
                          <p className="text-xs text-slate-400">
                            {fmtDate(p.completed_at)} {fmtTime(p.completed_at)}
                          </p>
                        </div>
                      </div>
                      <span className="font-bold text-emerald-700">₹{Number(p.amount).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Receipts toggle */}
            <div className="border-t border-slate-100 pt-3">
              <button
                onClick={() => setShowReceipts(v => !v)}
                className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                {showReceipts ? 'Hide Receipts' : 'View Printable Receipts'}
              </button>
              {showReceipts && (
                <div className="mt-3">
                  <PaymentReceipts applicationId={row.application_id} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
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

function StatusBadge({ remaining, total, paidAmt }) {
  const fullyPaid = total > 0 && remaining <= 0
  const partial   = paidAmt > 0 && remaining > 0
  if (fullyPaid) return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Paid</span>
  if (partial)   return <span className="rounded-full bg-blue-100   px-2.5 py-0.5 text-xs font-semibold text-blue-700">Partial</span>
  return               <span className="rounded-full bg-red-100    px-2.5 py-0.5 text-xs font-semibold text-red-600">Pending</span>
}
