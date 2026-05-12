import { useEffect, useState, useCallback } from 'react'
import { getFeeReceipts } from '../../../services/collegeAdminService.js'
import { getFaculty } from '../../../services/masterService.js'
import { useSortableTable } from '../../../shared/hooks/useSortableTable.js'
import CollegeCollectPayPanel from '../components/CollegeCollectPayPanel.jsx'
import Pagination from '../../../shared/components/Pagination.jsx'
import { SkeletonTable } from '../../../shared/components/Skeleton.jsx'

const YEAR_LABEL = { 1: 'FY', 2: 'SY', 3: 'TY', 4: '4Y', 5: '5Y' }

function parseLocalDate(str) {
  if (!str) return null
  try { return new Date(str.toString().replace(' ', 'T').split('.')[0]) } catch { return null }
}
function fmtDate(str) {
  const d = parseLocalDate(str)
  return d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
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
    getFaculty(collegeId)
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
    getFeeReceipts(collegeId, params)
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

  const { sorted: summary, sortCol, sortDir, toggleSort } = useSortableTable(rows, 'student_name')

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
        <SkeletonTable rows={5} cols={4} />
      ) : summary.length === 0 ? (
        <p className="text-slate-500 text-sm">No records found.</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border-2 border-slate-400">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-xs font-bold text-slate-600 uppercase tracking-wide border-b-2 border-slate-400">
                <tr>
                  <SortTh col="student_name"        label="Student"      align="left"   sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <SortTh col="course_name"         label="Course / Year" align="left"  sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <SortTh col="registration_number" label="Reg. No."     align="left"   sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <SortTh col="fee_total_amount"    label="Total Fee"    align="right"  sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <SortTh col="amount_paid"         label="Paid"         align="right"  sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <th className="px-4 py-2.5 text-right">Remaining</th>
                  <th className="px-4 py-2.5 text-center">Status</th>
                  <SortTh col="completed_at"        label="Last Paid"    align="left"   sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
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
  const header = (
    <div>
      <p className="font-bold text-slate-950 text-base">{row.student_name}</p>
      <p className="text-sm text-slate-500 mt-0.5">{row.course_name} · {YEAR_LABEL[row.year_of_study]}</p>
      {row.registration_number && (
        <p className="text-xs font-mono text-slate-400 mt-0.5">{row.registration_number}</p>
      )}
    </div>
  )
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-xl max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl">
        <CollegeCollectPayPanel
          appId={row.application_id}
          collegeId={collegeId}
          onPaid={() => {}}
          header={header}
          onClose={onClose}
          showReceipts
        />
      </div>
    </div>
  )
}

function SortTh({ col, label, align, sortCol, sortDir, onSort }) {
  const active = sortCol === col
  return (
    <th className={`px-4 py-2.5 text-${align} cursor-pointer select-none hover:text-slate-900 transition`} onClick={() => onSort(col)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="text-slate-300">{active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
      </span>
    </th>
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
