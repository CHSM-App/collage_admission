import { useEffect, useState, useCallback } from 'react'
import api from '../../../services/api.js'

const YEAR_LABEL = { 1: 'FY', 2: 'SY', 3: 'TY' }

export default function FeeReceipts({ collegeId }) {
  const [rows, setRows]         = useState([])
  const [courses, setCourses]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  // Filters
  const [status, setStatus]       = useState('')       // '' | 'paid' | 'pending'
  const [courseId, setCourseId]   = useState('')
  const [yearFilter, setYear]     = useState('')
  const [search, setSearch]       = useState('')
  const [searchInput, setSearchInput] = useState('')

  // Load courses for filter dropdown
  useEffect(() => {
    api.get(`masters/${collegeId}/faculty`)
      .then(r => setCourses((r.data.data || []).filter(f => f.is_active)))
      .catch(() => {})
  }, [collegeId])

  const fetchReceipts = useCallback(() => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams()
    if (status)   params.set('status', status)
    if (courseId) params.set('course_id', courseId)
    if (yearFilter) params.set('year_of_study', yearFilter)
    if (search)   params.set('q', search)
    api.get(`college-admin/${collegeId}/fee-receipts?${params}`)
      .then(r => setRows(r.data.data || []))
      .catch(() => setError('Failed to load fee receipts.'))
      .finally(() => setLoading(false))
  }, [collegeId, status, courseId, yearFilter, search])

  useEffect(() => { fetchReceipts() }, [fetchReceipts])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const paid    = rows.filter(r => r.college_fee_paid)
  const pending = rows.filter(r => !r.college_fee_paid)

  const summary = status === 'paid'    ? paid
                : status === 'pending' ? pending
                : rows

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">College portal</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Fee Receipts</h1>
        <p className="mt-1 text-slate-600">College fee payment status for confirmed students.</p>
      </div>

      {/* Summary counters */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total"   value={rows.length}    color="slate" />
        <StatCard label="Paid"    value={paid.length}    color="emerald" />
        <StatCard label="Pending" value={pending.length} color="amber" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search name, phone, reg. no…"
          className="flex-1 min-w-48 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />

        {/* Status filter */}
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">All Statuses</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
        </select>

        {/* Course filter */}
        <select
          value={courseId}
          onChange={e => setCourseId(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">All Courses</option>
          {courses.map(c => (
            <option key={c.code_no} value={c.code_no}>
              {c.degree_course_code} — {c.degree_course_name}
            </option>
          ))}
        </select>

        {/* Year filter */}
        <select
          value={yearFilter}
          onChange={e => setYear(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
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
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Student</th>
                  <th className="px-4 py-3 text-left">Course / Year</th>
                  <th className="px-4 py-3 text-left">Reg. No.</th>
                  <th className="px-4 py-3 text-right">Total Fee</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Remaining</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-left">Paid On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {summary.map(r => {
                  const total     = r.fee_total_amount != null ? Number(r.fee_total_amount) : null
                  const paid      = Number(r.amount_paid) || 0
                  const remaining = total != null ? Math.max(0, total - paid) : null
                  return (
                  <tr key={r.application_id} className="hover:bg-slate-50">
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
                      {paid > 0 ? `₹${paid.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-amber-700 font-semibold">
                      {remaining != null && remaining > 0 ? `₹${remaining.toLocaleString('en-IN')}` : remaining === 0 ? '—' : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge paid={!!r.college_fee_paid} />
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {r.completed_at ? new Date(r.completed_at).toLocaleDateString('en-IN') : '—'}
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
              const paid      = Number(r.amount_paid) || 0
              const remaining = total != null ? Math.max(0, total - paid) : null
              return (
              <div key={r.application_id} className="rounded-xl border border-slate-100 bg-white p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-800">{r.student_name}</p>
                    <p className="text-xs text-slate-400">{r.student_phone || '—'}</p>
                  </div>
                  <StatusBadge paid={!!r.college_fee_paid} />
                </div>
                <p className="text-sm text-slate-600">{r.course_name} · {YEAR_LABEL[r.year_of_study]}</p>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-mono">{r.registration_number || '—'}</span>
                  <div className="text-right space-y-0.5">
                    {total != null && <p className="text-slate-500">Total: <span className="font-semibold text-slate-700">₹{total.toLocaleString('en-IN')}</span></p>}
                    {paid > 0 && <p className="text-emerald-700 font-semibold">Paid: ₹{paid.toLocaleString('en-IN')}</p>}
                    {remaining != null && remaining > 0 && <p className="text-amber-700 font-semibold">Due: ₹{remaining.toLocaleString('en-IN')}</p>}
                  </div>
                </div>
                {r.completed_at && (
                  <p className="text-xs text-slate-400">Last paid: {new Date(r.completed_at).toLocaleDateString('en-IN')}</p>
                )}
              </div>
              )
            })}
          </div>
        </>
      )}
    </section>
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

function StatusBadge({ paid }) {
  return paid
    ? <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Paid</span>
    : <span className="rounded-full bg-amber-100  px-2.5 py-0.5 text-xs font-semibold text-amber-700">Pending</span>
}
