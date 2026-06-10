/**
 * Reports — Fees Collection report for college admin.
 * Filters: date range (daily default), course, year of study, payment type.
 * Shows: summary cards, day-wise table, course-wise table, transaction list.
 */
import { useEffect, useState, useCallback } from 'react'
import { getFeesCollectionReport } from '../../../services/collegeAdminService.js'
import { getFaculty } from '../../../services/masterService.js'
import { SkeletonTable } from '../../../shared/components/Skeleton.jsx'

const YEAR_LABEL = { 1: 'FY — First Year', 2: 'SY — Second Year', 3: 'TY — Third Year', 4: '4Y — Fourth Year', 5: '5Y — Fifth Year' }
const YEAR_SHORT = { 1: 'FY', 2: 'SY', 3: 'TY', 4: '4Y', 5: '5Y' }

function today() { return new Date().toISOString().slice(0, 10) }
function fmtINR(n) { return `₹${Number(n || 0).toLocaleString('en-IN')}` }
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
function fmtDisplayDate(isoDate) {
  if (!isoDate) return '—'
  const d = new Date(isoDate + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Quick-select presets
function getPreset(key) {
  const t = new Date()
  const iso = d => d.toISOString().slice(0, 10)
  if (key === 'today')      return { from: iso(t), to: iso(t) }
  if (key === 'yesterday')  { const d = new Date(t); d.setDate(d.getDate() - 1); return { from: iso(d), to: iso(d) } }
  if (key === 'this_week')  { const d = new Date(t); d.setDate(d.getDate() - d.getDay()); return { from: iso(d), to: iso(t) } }
  if (key === 'this_month') { return { from: iso(new Date(t.getFullYear(), t.getMonth(), 1)), to: iso(t) } }
  if (key === 'last_month') {
    const s = new Date(t.getFullYear(), t.getMonth() - 1, 1)
    const e = new Date(t.getFullYear(), t.getMonth(), 0)
    return { from: iso(s), to: iso(e) }
  }
  return null
}

const PRESETS = [
  { key: 'today',      label: 'Today' },
  { key: 'yesterday',  label: 'Yesterday' },
  { key: 'this_week',  label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'custom',     label: 'Custom' },
]

export default function Reports({ collegeId }) {
  const [courses, setCourses]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [data, setData]         = useState(null)
  const [error, setError]       = useState('')

  // Filters
  const [preset, setPreset]         = useState('today')
  const [dateFrom, setDateFrom]     = useState(today())
  const [dateTo, setDateTo]         = useState(today())
  const [courseId, setCourseId]     = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [paymentType, setPaymentType] = useState('college_fee')

  // UI state
  const [txnOpen, setTxnOpen] = useState(false)

  useEffect(() => {
    getFaculty(collegeId)
      .then(r => setCourses((r.data.data || []).filter(f => f.is_active)))
      .catch(() => {})
  }, [collegeId])

  function applyPreset(key) {
    setPreset(key)
    if (key !== 'custom') {
      const p = getPreset(key)
      setDateFrom(p.from)
      setDateTo(p.to)
    }
  }

  const fetchReport = useCallback(() => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({
      date_from:    dateFrom,
      date_to:      dateTo,
      payment_type: paymentType,
    })
    if (courseId)   params.set('course_id', courseId)
    if (yearFilter) params.set('year_of_study', yearFilter)
    getFeesCollectionReport(collegeId, params)
      .then(r => setData(r.data.data))
      .catch(() => setError('Failed to load report.'))
      .finally(() => setLoading(false))
  }, [collegeId, dateFrom, dateTo, courseId, yearFilter, paymentType])

  // Auto-fetch on mount and whenever filters change
  useEffect(() => { fetchReport() }, [fetchReport])

  const s = data?.summary
  const isSingleDay = dateFrom === dateTo

  function handlePrint() {
    if (!data) return
    const courseName = courseId ? (courses.find(c => String(c.code_no) === String(courseId))?.degree_course_name || '') : 'All Classes'
    const yearName   = yearFilter ? (YEAR_LABEL[yearFilter] || yearFilter) : 'All Years'
    const ptLabel    = paymentType === 'college_fee' ? 'College Fee' : paymentType === 'application_fee' ? 'Application Fee' : 'All Types'
    const dateLabel  = isSingleDay ? fmtDisplayDate(dateFrom) : `${fmtDisplayDate(dateFrom)} – ${fmtDisplayDate(dateTo)}`
    const printDate  = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

    const summaryRows = [
      ['Total Collected',  `&#8377;${Number(s.total_collected).toLocaleString('en-IN')}`],
      ['Transactions',     s.txn_count],
      ['Students',         s.student_count],
      ['Cash / Offline',   `&#8377;${Number(s.cash_amount).toLocaleString('en-IN')}`],
      ['Online (PayU)',    `&#8377;${Number(s.online_amount).toLocaleString('en-IN')}`],
    ].map(([l, v]) => `
      <tr>
        <td style="padding:7px 14px;font-size:12px;color:#64748b;font-weight:500;width:200px;border-bottom:1px solid #f1f5f9;">${l}</td>
        <td style="padding:7px 14px;font-size:13px;color:#0f172a;font-weight:700;border-bottom:1px solid #f1f5f9;">${v}</td>
      </tr>`).join('')

    const daySection = (!isSingleDay && data.by_day.length > 0) ? `
      <div style="margin-top:28px;">
        <div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#94a3b8;border-bottom:2px solid #0f172a;padding-bottom:4px;margin-bottom:10px;">Day-wise Breakdown</div>
        <table style="width:100%;border-collapse:collapse;font-size:11.5px;">
          <thead><tr style="background:#f8fafc;">
            <th style="padding:7px 10px;text-align:left;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Date</th>
            <th style="padding:7px 10px;text-align:right;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Transactions</th>
            <th style="padding:7px 10px;text-align:right;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Cash (&#8377;)</th>
            <th style="padding:7px 10px;text-align:right;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Online (&#8377;)</th>
            <th style="padding:7px 10px;text-align:right;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Total (&#8377;)</th>
          </tr></thead>
          <tbody>
            ${data.by_day.map(r => `<tr>
              <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;">${fmtDisplayDate(r.date)}</td>
              <td style="padding:6px 10px;text-align:right;border-bottom:1px solid #f1f5f9;">${r.txn_count}</td>
              <td style="padding:6px 10px;text-align:right;font-family:monospace;border-bottom:1px solid #f1f5f9;">${Number(r.cash).toLocaleString('en-IN')}</td>
              <td style="padding:6px 10px;text-align:right;font-family:monospace;border-bottom:1px solid #f1f5f9;">${Number(r.online).toLocaleString('en-IN')}</td>
              <td style="padding:6px 10px;text-align:right;font-family:monospace;font-weight:700;border-bottom:1px solid #f1f5f9;">${Number(r.total).toLocaleString('en-IN')}</td>
            </tr>`).join('')}
          </tbody>
          <tfoot><tr style="background:#f8fafc;border-top:2px solid #e2e8f0;font-weight:700;">
            <td style="padding:7px 10px;">Total</td>
            <td style="padding:7px 10px;text-align:right;">${s.txn_count}</td>
            <td style="padding:7px 10px;text-align:right;font-family:monospace;">${Number(s.cash_amount).toLocaleString('en-IN')}</td>
            <td style="padding:7px 10px;text-align:right;font-family:monospace;">${Number(s.online_amount).toLocaleString('en-IN')}</td>
            <td style="padding:7px 10px;text-align:right;font-family:monospace;color:#16a34a;">${Number(s.total_collected).toLocaleString('en-IN')}</td>
          </tr></tfoot>
        </table>
      </div>` : ''

    const courseSection = data.by_course.length > 0 ? `
      <div style="margin-top:28px;">
        <div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#94a3b8;border-bottom:2px solid #0f172a;padding-bottom:4px;margin-bottom:10px;">Course-wise Breakdown</div>
        <table style="width:100%;border-collapse:collapse;font-size:11.5px;">
          <thead><tr style="background:#f8fafc;">
            <th style="padding:7px 10px;text-align:left;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Course</th>
            <th style="padding:7px 10px;text-align:left;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Year</th>
            <th style="padding:7px 10px;text-align:right;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Transactions</th>
            <th style="padding:7px 10px;text-align:right;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Total (&#8377;)</th>
          </tr></thead>
          <tbody>
            ${data.by_course.map(r => `<tr>
              <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;">${r.course_name}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;">${YEAR_SHORT[r.year_of_study] || r.year_of_study}</td>
              <td style="padding:6px 10px;text-align:right;border-bottom:1px solid #f1f5f9;">${r.txn_count}</td>
              <td style="padding:6px 10px;text-align:right;font-family:monospace;font-weight:700;border-bottom:1px solid #f1f5f9;">${Number(r.total).toLocaleString('en-IN')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''

    const txnSection = data.transactions.length > 0 ? `
      <div style="margin-top:28px;">
        <div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#94a3b8;border-bottom:2px solid #0f172a;padding-bottom:4px;margin-bottom:10px;">Transactions (${data.transactions.length}${data.transactions.length === 200 ? '+' : ''})</div>
        <table style="width:100%;border-collapse:collapse;font-size:10.5px;">
          <thead><tr style="background:#f8fafc;">
            <th style="padding:6px 8px;text-align:left;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">#</th>
            <th style="padding:6px 8px;text-align:left;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Student</th>
            <th style="padding:6px 8px;text-align:left;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Course / Year</th>
            <th style="padding:6px 8px;text-align:left;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Reg. No.</th>
            <th style="padding:6px 8px;text-align:left;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Mode</th>
            <th style="padding:6px 8px;text-align:left;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Date &amp; Time</th>
            <th style="padding:6px 8px;text-align:right;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Amount (&#8377;)</th>
          </tr></thead>
          <tbody>
            ${data.transactions.map((t, i) => {
              const isCash = t.gateway === 'cash' || (t.gateway_txnid || '').startsWith('CASH-')
              return `<tr style="${i % 2 === 0 ? '' : 'background:#f8fafc;'}">
                <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;color:#94a3b8;">${i + 1}</td>
                <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;">${t.student_name || '—'}</td>
                <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;">${t.course_name} · ${YEAR_SHORT[t.year_of_study] || ''}${t.app_division ? ` Div ${t.app_division}` : ''}</td>
                <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;font-family:monospace;font-size:10px;">${t.registration_number || '—'}</td>
                <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;">${isCash ? 'Cash' : 'Online'}</td>
                <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;white-space:nowrap;">${fmtDate(t.completed_at)} ${fmtTime(t.completed_at)}</td>
                <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;text-align:right;font-family:monospace;font-weight:700;">${Number(t.amount).toLocaleString('en-IN')}</td>
              </tr>`
            }).join('')}
          </tbody>
        </table>
      </div>` : ''

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Fees Collection Report — ${dateLabel}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#f1f5f9;color:#1e293b;padding:32px 24px}
    @media print{
      body{background:#fff;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .no-print{display:none}
      @page{size:A4 landscape;margin:12mm 14mm}
    }
  </style>
</head>
<body>
<div style="max-width:960px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
  <div style="height:5px;background:linear-gradient(90deg,#0f172a 0%,#059669 50%,#34d399 100%);"></div>
  <div style="padding:24px 28px 20px;display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #e2e8f0;">
    <div>
      <div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#64748b;margin-bottom:4px;">Fees Collection Report</div>
      <div style="font-size:20px;font-weight:800;color:#0f172a;">Fee Collection Statement</div>
      <div style="font-size:12px;color:#64748b;margin-top:4px;">Period: ${dateLabel}</div>
    </div>
    <div style="text-align:right;flex-shrink:0;margin-left:20px;">
      <div style="font-size:10px;color:#94a3b8;">Printed: ${printDate}</div>
      <div style="font-size:11px;color:#64748b;margin-top:6px;">Class: <strong>${courseName}</strong></div>
      <div style="font-size:11px;color:#64748b;margin-top:2px;">Year: <strong>${yearName}</strong></div>
      <div style="font-size:11px;color:#64748b;margin-top:2px;">Type: <strong>${ptLabel}</strong></div>
    </div>
  </div>
  <div style="background:#0f172a;padding:18px 28px;display:flex;gap:32px;flex-wrap:wrap;">
    <div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#64748b;margin-bottom:2px;">Total Collected</div>
      <div style="font-size:28px;font-weight:900;color:#4ade80;">&#8377;${Number(s.total_collected).toLocaleString('en-IN')}</div></div>
    <div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap;">
      ${[
        ['Transactions', s.txn_count],
        ['Students', s.student_count],
        ['Cash', `&#8377;${Number(s.cash_amount).toLocaleString('en-IN')}`],
        ['Online', `&#8377;${Number(s.online_amount).toLocaleString('en-IN')}`],
      ].map(([l, v]) => `<div style="text-align:center;">
        <div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748b;margin-bottom:2px;">${l}</div>
        <div style="font-size:16px;font-weight:800;color:#e2e8f0;">${v}</div>
      </div>`).join('')}
    </div>
  </div>
  <div style="padding:0 28px 28px;">
    ${daySection}
    ${courseSection}
    ${txnSection}
  </div>
  <div style="height:3px;background:linear-gradient(90deg,#0f172a 0%,#059669 50%,#34d399 100%);"></div>
  <div style="background:#f8fafc;padding:10px 28px;display:flex;justify-content:space-between;">
    <span style="font-size:9.5px;color:#94a3b8;">College Admission Portal — Fees Collection Report</span>
    <span style="font-size:9.5px;color:#94a3b8;">${dateLabel}</span>
  </div>
</div>
</body></html>`

    const win = window.open('', '_blank', 'width=1100,height=900')
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 600)
  }

  return (
    <section className="space-y-5 max-w-5xl">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">College Reports</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Fees Collection</h1>
        </div>
        {data && !loading && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-lg bg-slate-900 text-white text-sm font-semibold px-4 py-2 hover:bg-slate-700 transition shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
            </svg>
            Print / Save PDF
          </button>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 space-y-4">

        {/* Date preset pills */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Date Range</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <button
                key={p.key}
                onClick={() => applyPreset(p.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  preset === p.key
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom date inputs — always visible so user can see current range */}
          <div className="mt-3 flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-slate-500 mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPreset('custom') }}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                onChange={e => { setDateTo(e.target.value); setPreset('custom') }}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Other filters */}
        <div className="flex flex-wrap gap-3 items-end pt-1 border-t border-slate-100">
          {/* Course */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Class / Course</label>
            <select
              value={courseId}
              onChange={e => setCourseId(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="">All Classes</option>
              {courses.map(c => (
                <option key={c.code_no} value={c.code_no}>{c.degree_course_name}</option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Year</label>
            <select
              value={yearFilter}
              onChange={e => setYearFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="">All Years</option>
              {[1,2,3,4,5].map(y => (
                <option key={y} value={y}>{YEAR_LABEL[y]}</option>
              ))}
            </select>
          </div>

          {/* Payment type */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Payment Type</label>
            <select
              value={paymentType}
              onChange={e => setPaymentType(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="college_fee">College Fee</option>
              <option value="application_fee">Application Fee</option>
              <option value="all">All Types</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {loading && (
        <div className="rounded-xl border border-slate-200 bg-white p-4"><SkeletonTable rows={5} cols={4} /></div>
      )}

      {!loading && data && (
        <>
          {/* ── Summary cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <SummaryCard
              label="Total Collected"
              value={fmtINR(s.total_collected)}
              accent="emerald"
              wide
            />
            <SummaryCard label="Transactions"   value={s.txn_count}     accent="slate" />
            <SummaryCard label="Students"        value={s.student_count} accent="slate" />
            <SummaryCard label="Cash / Offline"  value={fmtINR(s.cash_amount)}   accent="amber" />
            <SummaryCard label="Online (PayU)"   value={fmtINR(s.online_amount)} accent="blue" />
          </div>

          {/* ── Day-wise breakdown (only if range > 1 day) ── */}
          {!isSingleDay && data.by_day.length > 0 && (
            <TableCard title="Day-wise Breakdown">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <Th>Date</Th>
                  <Th right>Transactions</Th>
                  <Th right>Cash (₹)</Th>
                  <Th right>Online (₹)</Th>
                  <Th right>Total (₹)</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.by_day.map(row => (
                  <tr key={row.date} className="hover:bg-slate-50">
                    <Td>{fmtDisplayDate(row.date)}</Td>
                    <Td right>{row.txn_count}</Td>
                    <Td right mono>{Number(row.cash).toLocaleString('en-IN')}</Td>
                    <Td right mono>{Number(row.online).toLocaleString('en-IN')}</Td>
                    <Td right mono bold>{Number(row.total).toLocaleString('en-IN')}</Td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200 text-sm font-bold">
                <tr>
                  <td className="px-3 py-2 text-slate-700">Total</td>
                  <td className="px-3 py-2 text-right text-slate-700">{s.txn_count}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-800">{Number(s.cash_amount).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-800">{Number(s.online_amount).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2 text-right font-mono text-emerald-700">{Number(s.total_collected).toLocaleString('en-IN')}</td>
                </tr>
              </tfoot>
            </TableCard>
          )}

          {/* ── Course-wise breakdown ── */}
          {data.by_course.length > 0 && (
            <TableCard title="Course-wise Breakdown">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <Th>Course</Th>
                  <Th>Year</Th>
                  <Th right>Transactions</Th>
                  <Th right>Total (₹)</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.by_course.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <Td>{row.course_name}</Td>
                    <Td>{YEAR_SHORT[row.year_of_study] || row.year_of_study}</Td>
                    <Td right>{row.txn_count}</Td>
                    <Td right mono bold>{Number(row.total).toLocaleString('en-IN')}</Td>
                  </tr>
                ))}
              </tbody>
            </TableCard>
          )}

          {/* ── Transactions ── */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <button
              onClick={() => setTxnOpen(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition border-b border-slate-200"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Transactions
                <span className="ml-2 font-normal text-slate-400">({data.transactions.length}{data.transactions.length === 200 ? '+' : ''})</span>
              </p>
              <svg className={`w-4 h-4 text-slate-400 transition-transform ${txnOpen ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {txnOpen && (
              data.transactions.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-400 text-center">No transactions in this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                      <tr>
                        <Th>Student</Th>
                        <Th>Course / Year</Th>
                        <Th>Reg. No.</Th>
                        <Th>Type</Th>
                        <Th>Mode</Th>
                        <Th>Date &amp; Time</Th>
                        <Th right>Amount (₹)</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {data.transactions.map(t => {
                        const isCash = t.gateway === 'cash' || t.gateway_txnid?.startsWith('CASH-')
                        return (
                          <tr key={t.id} className="hover:bg-slate-50">
                            <Td>{t.student_name}</Td>
                            <Td>{t.course_name} · {YEAR_SHORT[t.year_of_study]}{t.app_division ? ` Div ${t.app_division}` : ''}</Td>
                            <Td mono>{t.registration_number || '—'}</Td>
                            <Td>
                              <span className={`rounded-full px-2 py-0.5 font-semibold ${
                                t.payment_type === 'college_fee' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                              }`}>
                                {t.payment_type === 'college_fee' ? 'College' : 'Application'}
                              </span>
                            </Td>
                            <Td>
                              <span className={`rounded-full px-2 py-0.5 font-semibold ${isCash ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'}`}>
                                {isCash ? 'Cash' : 'Online'}
                              </span>
                            </Td>
                            <Td>{fmtDate(t.completed_at)} {fmtTime(t.completed_at)}</Td>
                            <Td right mono bold>{Number(t.amount).toLocaleString('en-IN')}</Td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>

          {/* No data state */}
          {s.total_collected === 0 && s.txn_count === 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-10 text-center">
              <p className="text-slate-400 text-sm">No fee collections found for the selected filters.</p>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function SummaryCard({ label, value, accent, wide }) {
  const colors = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber:   'bg-amber-50  border-amber-200  text-amber-700',
    blue:    'bg-blue-50   border-blue-200   text-blue-700',
    slate:   'bg-white     border-slate-200  text-slate-800',
  }
  return (
    <div className={`rounded-xl border p-4 text-center ${colors[accent]} ${wide ? 'col-span-2 sm:col-span-1' : ''}`}>
      <p className="text-xs text-slate-400 font-medium mb-1">{label}</p>
      <p className={`text-xl font-black ${accent === 'emerald' ? 'text-emerald-700' : accent === 'amber' ? 'text-amber-700' : accent === 'blue' ? 'text-blue-700' : 'text-slate-950'}`}>
        {value}
      </p>
    </div>
  )
}

function TableCard({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">{children}</table>
      </div>
    </div>
  )
}

function Th({ children, right }) {
  return <th className={`px-3 py-2 font-semibold whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>{children}</th>
}
function Td({ children, right, mono, bold }) {
  return (
    <td className={`px-3 py-2 ${right ? 'text-right' : ''} ${mono ? 'font-mono' : ''} ${bold ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
      {children}
    </td>
  )
}
