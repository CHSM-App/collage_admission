import { useEffect, useState, useCallback, useRef } from 'react'
import {
  getFeeReceipts,
  getMiscExamHeads,
  recordMiscPayment,
  getMiscExamReceipts,
  createMiscFee,
} from '../../../services/collegeAdminService.js'
import { getFaculty } from '../../../services/masterService.js'
import { useSortableTable } from '../../../shared/hooks/useSortableTable.js'
import CollegeCollectPayPanel from '../components/CollegeCollectPayPanel.jsx'
import PaymentReceipts from '../../student/pages/PaymentReceipts.jsx'
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
function fmtDateTime(str) {
  const d = parseLocalDate(str)
  return d
    ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
        ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : '—'
}

const LIMIT = 20
const TABS = ['Regular', 'Misc', 'Exam Fees']

export default function FeeReceipts({ collegeId }) {
  const [activeTab, setActiveTab] = useState('Regular')

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">College portal</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Fee Receipts</h1>
        <p className="mt-1 text-slate-600">Manage college fee payments for confirmed students.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b-2 border-slate-200">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 text-sm font-semibold rounded-t-lg transition -mb-0.5 ${
              activeTab === tab
                ? 'bg-white border-2 border-b-white border-slate-200 text-blue-700'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Regular'   && <RegularTab  collegeId={collegeId} />}
      {activeTab === 'Misc'      && <MiscExamTab  collegeId={collegeId} paymentType="misc_fee" feeType="Misc"     label="Misc" />}
      {activeTab === 'Exam Fees' && <MiscExamTab  collegeId={collegeId} paymentType="exam_fee" feeType="ExamFees" label="Exam Fees" />}
    </section>
  )
}

// ─────────────────────────────────────────────────────────────
// REGULAR TAB — existing fee-receipts flow
// ─────────────────────────────────────────────────────────────
function RegularTab({ collegeId }) {
  const [rows, setRows]               = useState([])
  const [courses, setCourses]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [selected, setSelected]       = useState(null)
  const [pagination, setPagination]   = useState({ page: 1, totalPages: 1, total: 0 })
  const [page, setPage]               = useState(1)

  const [status, setStatus]           = useState('')
  const [courseId, setCourseId]       = useState('')
  const [yearFilter, setYear]         = useState('')
  const [search, setSearch]           = useState('')
  const [searchInput, setSearchInput] = useState('')

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

  return (
    <div className="space-y-5">
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
          <option value="4">4Y</option>
          <option value="5">5Y</option>
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
                  <SortTh col="student_name"        label="Student"       align="left"  sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <SortTh col="course_name"         label="Course / Year" align="left"  sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <SortTh col="registration_number" label="Reg. No."      align="left"  sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <SortTh col="fee_total_amount"    label="Total Fee"     align="right" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <SortTh col="amount_paid"         label="Paid"          align="right" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <th className="px-4 py-2.5 text-right">Remaining</th>
                  <th className="px-4 py-2.5 text-center">Status</th>
                  <SortTh col="completed_at"        label="Last Paid"     align="left"  sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
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
                      onClick={() => setSelected(r)}
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
                  onClick={() => setSelected(r)}
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

      {selected && (
        <CollegeFeeModal
          row={selected}
          collegeId={collegeId}
          onClose={() => { setSelected(null); fetchReceipts() }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MISC / EXAM FEES TAB
// ─────────────────────────────────────────────────────────────
function MiscExamTab({ collegeId, paymentType, feeType, label }) {
  const [receipts, setReceipts]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [pagination, setPagination]   = useState({ page: 1, totalPages: 1, total: 0 })
  const [page, setPage]               = useState(1)
  const [search, setSearch]           = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showModal, setShowModal]         = useState(false)
  const [showOnlineModal, setShowOnlineModal] = useState(false)
  const [selectedReceipt, setSelectedReceipt] = useState(null)

  useEffect(() => { setPage(1) }, [search])

  const fetchReceipts = useCallback(() => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ type: paymentType, page, limit: LIMIT })
    if (search) params.set('q', search)
    getMiscExamReceipts(collegeId, params)
      .then(r => {
        setReceipts(r.data.data || [])
        setPagination(r.data.pagination || { page: 1, totalPages: 1, total: 0 })
      })
      .catch(() => setError('Failed to load receipts.'))
      .finally(() => setLoading(false))
  }, [collegeId, paymentType, page, search])

  useEffect(() => { fetchReceipts() }, [fetchReceipts])

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search name, phone, reg. no…"
          className="flex-1 min-w-48 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
        >
          + New Receipt
        </button>
        <button
          onClick={() => setShowOnlineModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
        >
          + Create Fee (Online)
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total" value={pagination.total} color="slate" />
        <StatCard label="Paid" value={receipts.filter(r => r.status === 'success').length} color="emerald" />
        <StatCard
          label="Collected"
          value={`₹${receipts.filter(r => r.status === 'success').reduce((s, r) => s + (Number(r.amount) || 0), 0).toLocaleString('en-IN')}`}
          color="emerald"
        />
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <SkeletonTable rows={5} cols={4} />
      ) : receipts.length === 0 ? (
        <p className="text-slate-500 text-sm">No {label} payment receipts found.</p>
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
                  <th className="px-4 py-2.5 text-right">Amount</th>
                  <th className="px-4 py-2.5 text-center">Status</th>
                  <th className="px-4 py-2.5 text-left">Fee Heads</th>
                  <th className="px-4 py-2.5 text-left">Date &amp; Time</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-300">
                {receipts.map((r, i) => (
                  <tr key={i} onClick={() => r.status === 'success' && setSelectedReceipt(r)} className={`border-b-2 border-slate-300 last:border-b-0 transition ${r.status === 'success' ? 'hover:bg-blue-50 cursor-pointer' : 'cursor-default'}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{r.student_name}</p>
                      <p className="text-xs text-slate-400">{r.student_phone || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.course_name}
                      <span className="ml-1 text-xs text-slate-400">· {YEAR_LABEL[r.year_of_study]}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500 text-xs">{r.registration_number || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                      ₹{Number(r.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.status === 'success'
                        ? <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Paid</span>
                        : <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Pending</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      {r.fee_heads?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {r.fee_heads.map(h => (
                            <span key={h.fees_code} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{h.fees_head}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{r.status === 'success' ? fmtDateTime(r.completed_at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {receipts.map((r, i) => (
              <div key={i} onClick={() => r.status === 'success' && setSelectedReceipt(r)} className={`rounded-xl border bg-white p-4 space-y-2 transition ${r.status === 'success' ? 'border-slate-100 cursor-pointer hover:border-blue-200' : 'border-amber-100 cursor-default'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-800">{r.student_name}</p>
                    <p className="text-xs text-slate-400">{r.student_phone || '—'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="font-bold text-emerald-700 text-sm">₹{Number(r.amount).toLocaleString('en-IN')}</p>
                    {r.status === 'success'
                      ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Paid</span>
                      : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Pending</span>
                    }
                  </div>
                </div>
                <p className="text-sm text-slate-600">{r.course_name} · {YEAR_LABEL[r.year_of_study]}</p>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-mono">{r.registration_number || '—'}</span>
                  <span>{r.status === 'success' ? fmtDateTime(r.completed_at) : 'Awaiting payment'}</span>
                </div>
                {r.fee_heads?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {r.fee_heads.map(h => (
                      <span key={h.fees_code} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{h.fees_head}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        onPageChange={setPage}
      />

      {showModal && (
        <MiscExamPayModal
          collegeId={collegeId}
          paymentType={paymentType}
          feeType={feeType}
          label={label}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchReceipts() }}
        />
      )}

      {showOnlineModal && (
        <MiscExamCreateOnlineModal
          collegeId={collegeId}
          paymentType={paymentType}
          feeType={feeType}
          label={label}
          onClose={() => setShowOnlineModal(false)}
          onSuccess={() => { setShowOnlineModal(false); fetchReceipts() }}
        />
      )}

      {selectedReceipt && (
        <MiscExamReceiptModal
          row={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MISC / EXAM RECEIPT VIEW MODAL
// ─────────────────────────────────────────────────────────────
function MiscExamReceiptModal({ row, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-xl max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="font-bold text-slate-950 text-base">{row.student_name}</p>
            <p className="text-sm text-slate-500 mt-0.5">{row.course_name} · {YEAR_LABEL[row.year_of_study]}</p>
            {row.registration_number && (
              <p className="text-xs font-mono text-slate-400 mt-0.5">{row.registration_number}</p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none px-1">&times;</button>
        </div>
        <div className="px-5 py-4">
          <PaymentReceipts
            applicationId={row.application_id}
            hideTypes={['application_fee', 'college_fee', 'college_fee_installment']}
          />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// CREATE FEE (ONLINE) MODAL FOR MISC / EXAM FEES
// ─────────────────────────────────────────────────────────────
function MiscExamCreateOnlineModal({ collegeId, paymentType, feeType, label, onClose, onSuccess }) {
  const [step, setStep]               = useState(1)
  const [studentSearch, setStudentSearch] = useState('')
  const [searching, setSearching]     = useState(false)
  const [students, setStudents]       = useState([])
  const [searchErr, setSearchErr]     = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)

  const [feeHeads, setFeeHeads]       = useState([])
  const [headsLoading, setHeadsLoading] = useState(false)
  const [selectedCodes, setSelectedCodes] = useState([])
  const [amount, setAmount]           = useState('')
  const [note, setNote]               = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [submitErr, setSubmitErr]     = useState('')
  const [submitOk, setSubmitOk]       = useState('')

  const searchTimerRef = useRef(null)

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    const q = studentSearch.trim()
    if (!q) { setStudents([]); return }
    searchTimerRef.current = setTimeout(() => {
      setSearching(true)
      setSearchErr('')
      const params = new URLSearchParams({ q, limit: 10, page: 1 })
      getFeeReceipts(collegeId, params)
        .then(r => setStudents(r.data.data || []))
        .catch(() => setSearchErr('Search failed.'))
        .finally(() => setSearching(false))
    }, 350)
  }, [studentSearch, collegeId])

  useEffect(() => {
    if (!selectedStudent) return
    setHeadsLoading(true)
    getMiscExamHeads(collegeId, feeType)
      .then(r => setFeeHeads(r.data.data || []))
      .catch(() => setFeeHeads([]))
      .finally(() => setHeadsLoading(false))
  }, [selectedStudent, collegeId, feeType])

  useEffect(() => {
    const sum = feeHeads
      .filter(h => selectedCodes.includes(h.fees_code))
      .reduce((s, h) => s + (parseFloat(h.amount) || 0), 0)
    setAmount(selectedCodes.length === 0 ? '' : String(sum))
  }, [selectedCodes, feeHeads])

  function toggleCode(code) {
    setSelectedCodes(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    )
  }

  function handleSelectStudent(row) {
    setSelectedStudent(row)
    setStep(2)
    setSelectedCodes([])
    setAmount('')
    setNote('')
    setSubmitErr('')
    setSubmitOk('')
  }

  async function handleSubmit() {
    if (selectedCodes.length === 0) { setSubmitErr('Select at least one fee head.'); return }
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { setSubmitErr('Enter a valid amount.'); return }
    setSubmitting(true)
    setSubmitErr('')
    setSubmitOk('')
    try {
      await createMiscFee(collegeId, selectedStudent.application_id, {
        payment_type: paymentType,
        fee_codes: selectedCodes,
        amount: amt,
        note: note.trim() || undefined,
      })
      setSubmitOk('Fee created. Student can now pay online.')
      setTimeout(() => onSuccess(), 1500)
    } catch (e) {
      const msg = e?.response?.data?.message || 'Failed to create fee.'
      setSubmitErr(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="font-bold text-slate-950 text-base">Create {label} Fee (Online)</p>
            {selectedStudent && step === 2 && (
              <p className="text-xs text-slate-500 mt-0.5">{selectedStudent.student_name} · {selectedStudent.course_name}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step === 2 && (
              <button
                onClick={() => { setStep(1); setSelectedStudent(null) }}
                className="text-xs text-blue-600 hover:underline px-2 py-1"
              >
                ← Change student
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none px-1">&times;</button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* STEP 1: Search student */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700">Search Student</p>
              <input
                type="text"
                autoFocus
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                placeholder="Type name, phone, or reg. no…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
              {searching && <p className="text-xs text-slate-400">Searching…</p>}
              {searchErr && <p className="text-xs text-red-600">{searchErr}</p>}
              {!searching && students.length === 0 && studentSearch.trim() && (
                <p className="text-xs text-slate-400">No students found.</p>
              )}
              {students.length > 0 && (
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden">
                  {students.map(s => (
                    <button
                      key={s.application_id}
                      onClick={() => handleSelectStudent(s)}
                      className="w-full text-left px-4 py-3 hover:bg-emerald-50 transition"
                    >
                      <p className="font-medium text-slate-800 text-sm">{s.student_name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {s.course_name} · {YEAR_LABEL[s.year_of_study]}
                        {s.registration_number && <span className="ml-2 font-mono">{s.registration_number}</span>}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Fee heads selection */}
          {step === 2 && selectedStudent && (
            <div className="space-y-4">
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">
                This will create a pending online payment. The student can pay via their portal.
              </div>

              {headsLoading ? (
                <p className="text-xs text-slate-400">Loading fee heads…</p>
              ) : feeHeads.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-700">{label} Fee Heads</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {feeHeads.map(h => (
                      <label key={h.fees_code} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition">
                        <input
                          type="checkbox"
                          checked={selectedCodes.includes(h.fees_code)}
                          onChange={() => toggleCode(h.fees_code)}
                          className="accent-emerald-600 w-4 h-4 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-800">{h.fees_head}</p>
                          {h.short_name && h.short_name !== h.fees_head && (
                            <p className="text-xs text-slate-400">{h.short_name}</p>
                          )}
                        </div>
                        {h.amount > 0 && (
                          <span className="text-xs font-semibold text-slate-600">₹{Number(h.amount).toLocaleString('en-IN')}</span>
                        )}
                      </label>
                    ))}
                  </div>
                  {selectedCodes.length > 0 && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Amount (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                        placeholder="0.00"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No {label} fee heads configured.</p>
              )}

              {/* Note */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Note <span className="font-normal text-slate-400">(optional)</span></label>
                <input
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="e.g. Practical exam fee"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
              </div>

              {submitErr && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{submitErr}</p>
              )}
              {submitOk && (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">{submitOk}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting || !!submitOk || selectedCodes.length === 0}
                className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {submitting ? 'Creating…' : `Create Online Fee${amount ? ` — ₹${Number(amount).toLocaleString('en-IN')}` : ''}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// NEW RECEIPT MODAL FOR MISC / EXAM FEES
// ─────────────────────────────────────────────────────────────
function MiscExamPayModal({ collegeId, paymentType, feeType, label, onClose, onSuccess }) {
  // Step 1: search student, Step 2: select fee heads + amount
  const [step, setStep]               = useState(1)
  const [studentSearch, setStudentSearch] = useState('')
  const [searching, setSearching]     = useState(false)
  const [students, setStudents]       = useState([])
  const [searchErr, setSearchErr]     = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)

  const [feeHeads, setFeeHeads]       = useState([])
  const [headsLoading, setHeadsLoading] = useState(false)
  const [selectedCodes, setSelectedCodes] = useState([])
  const [amount, setAmount]           = useState('')
  const [note, setNote]               = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [submitErr, setSubmitErr]     = useState('')
  const [submitOk, setSubmitOk]       = useState('')

  const searchTimerRef = useRef(null)

  // Auto-search students as user types
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    const q = studentSearch.trim()
    if (!q) { setStudents([]); return }
    searchTimerRef.current = setTimeout(() => {
      setSearching(true)
      setSearchErr('')
      const params = new URLSearchParams({ q, limit: 10, page: 1 })
      getFeeReceipts(collegeId, params)
        .then(r => setStudents(r.data.data || []))
        .catch(() => setSearchErr('Search failed.'))
        .finally(() => setSearching(false))
    }, 350)
  }, [studentSearch, collegeId])

  // Load fee heads when student selected
  useEffect(() => {
    if (!selectedStudent) return
    setHeadsLoading(true)
    getMiscExamHeads(collegeId, feeType)
      .then(r => setFeeHeads(r.data.data || []))
      .catch(() => setFeeHeads([]))
      .finally(() => setHeadsLoading(false))
  }, [selectedStudent, collegeId, feeType])

  // Auto-sum selected heads
  useEffect(() => {
    const sum = feeHeads
      .filter(h => selectedCodes.includes(h.fees_code))
      .reduce((s, h) => s + (parseFloat(h.amount) || 0), 0)
    setAmount(selectedCodes.length === 0 ? '' : String(sum))
  }, [selectedCodes, feeHeads])

  function toggleCode(code) {
    setSelectedCodes(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    )
  }

  function handleSelectStudent(row) {
    setSelectedStudent(row)
    setStep(2)
    setSelectedCodes([])
    setAmount('')
    setNote('')
    setSubmitErr('')
    setSubmitOk('')
  }

  async function handleSubmit() {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { setSubmitErr('Enter a valid amount.'); return }
    setSubmitting(true)
    setSubmitErr('')
    setSubmitOk('')
    try {
      await recordMiscPayment(collegeId, selectedStudent.application_id, {
        payment_type: paymentType,
        amount: amt,
        fee_codes: selectedCodes,
        note: note.trim() || undefined,
      })
      setSubmitOk(`₹${amt.toLocaleString('en-IN')} collected successfully.`)
      setTimeout(() => onSuccess(), 1200)
    } catch (e) {
      const msg = e?.response?.data?.message || 'Failed to record payment.'
      setSubmitErr(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="font-bold text-slate-950 text-base">New {label} Receipt</p>
            {selectedStudent && step === 2 && (
              <p className="text-xs text-slate-500 mt-0.5">{selectedStudent.student_name} · {selectedStudent.course_name}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step === 2 && (
              <button
                onClick={() => { setStep(1); setSelectedStudent(null) }}
                className="text-xs text-blue-600 hover:underline px-2 py-1"
              >
                ← Change student
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none px-1">&times;</button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* STEP 1: Search student */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700">Search Student</p>
              <input
                type="text"
                autoFocus
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                placeholder="Type name, phone, or reg. no…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              {searching && <p className="text-xs text-slate-400">Searching…</p>}
              {searchErr && <p className="text-xs text-red-600">{searchErr}</p>}
              {!searching && students.length === 0 && studentSearch.trim() && (
                <p className="text-xs text-slate-400">No students found.</p>
              )}
              {students.length > 0 && (
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden">
                  {students.map(s => (
                    <button
                      key={s.application_id}
                      onClick={() => handleSelectStudent(s)}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 transition"
                    >
                      <p className="font-medium text-slate-800 text-sm">{s.student_name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {s.course_name} · {YEAR_LABEL[s.year_of_study]}
                        {s.registration_number && <span className="ml-2 font-mono">{s.registration_number}</span>}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Fee heads + amount */}
          {step === 2 && selectedStudent && (
            <div className="space-y-4">
              {/* Fee heads */}
              {headsLoading ? (
                <p className="text-xs text-slate-400">Loading fee heads…</p>
              ) : feeHeads.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-700">{label} Fee Heads</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {feeHeads.map(h => (
                      <label key={h.fees_code} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition">
                        <input
                          type="checkbox"
                          checked={selectedCodes.includes(h.fees_code)}
                          onChange={() => toggleCode(h.fees_code)}
                          className="accent-blue-600 w-4 h-4 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-800">{h.fees_head}</p>
                          {h.short_name && h.short_name !== h.fees_head && (
                            <p className="text-xs text-slate-400">{h.short_name}</p>
                          )}
                        </div>
                        {h.amount > 0 && (
                          <span className="text-xs font-semibold text-slate-600">₹{Number(h.amount).toLocaleString('en-IN')}</span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">No {label} fee heads configured.</p>
              )}

              {/* Amount */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Amount (₹) <span className="font-normal text-slate-400">— cash payment</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              {/* Note */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Note <span className="font-normal text-slate-400">(optional)</span></label>
                <input
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="e.g. Paid for practical exam"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              {submitErr && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{submitErr}</p>
              )}
              {submitOk && (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">{submitOk}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting || !!submitOk}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
              >
                {submitting ? 'Recording…' : `Collect Cash — ${amount ? `₹${Number(amount).toLocaleString('en-IN')}` : 'Enter amount'}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// REGULAR TAB — Modal wrapper
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// Shared small components
// ─────────────────────────────────────────────────────────────
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
