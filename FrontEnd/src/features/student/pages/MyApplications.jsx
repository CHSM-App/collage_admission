import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../../../context/AuthContext.jsx'
import { useToast } from '../../../context/ToastContext.jsx'
import { deleteApplication } from '../../../services/applicationService.js'
import { useMyApplications } from '../hooks/useMyApplications.js'
import { useSortableTable } from '../../../shared/hooks/useSortableTable.js'
import SubjectSelection from './SubjectSelection.jsx'
import StudentFeesMaster from './StudentFeesMaster.jsx'
import PaymentReceipts from './PaymentReceipts.jsx'
import ApplicationPrintView from './ApplicationPrintView.jsx'
import { SkeletonTable } from '../../../shared/components/Skeleton.jsx'

const YEAR_LABEL  = { 1: 'FY', 2: 'SY', 3: 'TY', 4: '4Y', 5: '5Y' }
const STATUS_META = {
  draft:                { label: 'Draft',               color: 'bg-slate-100 text-slate-600' },
  payment_pending:      { label: 'Payment Pending',     color: 'bg-yellow-100 text-yellow-700' },
  submitted:            { label: 'Under Review',        color: 'bg-blue-100 text-blue-700' },
  under_review:         { label: 'Under Review',        color: 'bg-blue-100 text-blue-700' },
  correction_requested: { label: 'Correction Required', color: 'bg-orange-100 text-orange-700' },
  correction_done:      { label: 'Under Review',        color: 'bg-blue-100 text-blue-700' },
  doc_verified:         { label: 'App. Approved',       color: 'bg-teal-100 text-teal-700' },
  confirmed:            { label: 'Fees Pending',        color: 'bg-amber-100 text-amber-700' },
  fees_paid:            { label: 'Adm. Confirmed',      color: 'bg-emerald-100 text-emerald-700' },
  roll_assigned:        { label: 'Roll Assigned',       color: 'bg-violet-100 text-violet-700' },
  enrolled:             { label: 'Enrolled',            color: 'bg-green-100 text-green-800' },
  rejected:             { label: 'Rejected',            color: 'bg-red-100 text-red-700' },
  cancelled:            { label: 'Cancelled',           color: 'bg-slate-100 text-slate-500' },
}

export default function MyApplications() {
  const { user }    = useAuthContext()
  const navigate    = useNavigate()
  const toast       = useToast()
  const [filterStatus, setFilterStatus]     = useState('')
  const [feePayApp, setFeePayApp]           = useState(null)
  const [receiptsAppId, setReceiptsAppId]   = useState(null)
  const [selectSubjectsApp, setSelectSubjectsApp] = useState(null)
  const [expandedId, setExpandedId]         = useState(null)

  const { apps, loading, fetchApps } = useMyApplications(user.id)

  const statusFiltered = useMemo(() => {
    if (!filterStatus) return apps
    return apps.filter(app => app.status === filterStatus)
  }, [apps, filterStatus])

  const { sorted: filtered, query: search, setQuery: setSearch, sortCol, sortDir, toggleSort } = useSortableTable(
    statusFiltered, 'submitted_at', 'desc', {
      searchFields: ['college_name', 'course_name', 'registration_number'],
    }
  )

  if (selectSubjectsApp) {
    return (
      <SubjectSelection
        application={selectSubjectsApp}
        onDone={() => { setSelectSubjectsApp(null); fetchApps() }}
        onCancel={() => setSelectSubjectsApp(null)}
      />
    )
  }

  if (feePayApp) {
    return (
      <section className="space-y-4">
        <button onClick={() => setFeePayApp(null)} className="text-sm text-blue-600 hover:underline">
          ← Back to My Applications
        </button>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">Student portal</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Fee Details</h1>
          <p className="text-sm text-slate-500 mt-0.5">{feePayApp.college_name} · {feePayApp.course_name} · {feePayApp.academic_year}</p>
        </div>
        <StudentFeesMaster
          application={feePayApp}
          onDone={() => { setFeePayApp(null); fetchApps() }}
        />
      </section>
    )
  }

  if (receiptsAppId) {
    return (
      <section className="space-y-4">
        <button onClick={() => setReceiptsAppId(null)} className="text-sm text-blue-600 hover:underline">
          ← Back to My Applications
        </button>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <PaymentReceipts
            applicationId={receiptsAppId}
            onClose={() => setReceiptsAppId(null)}
          />
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">Student portal</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">My Applications</h1>
          <p className="mt-1 text-sm text-slate-500">All your college applications across all years.</p>
        </div>
        <button
          onClick={() => navigate('/student/dashboard?section=browse')}
          className="self-start sm:shrink-0 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          + New Application
        </button>
      </div>

      {/* Search + filter */}
      {!loading && apps.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search college, course or reg. no…"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Statuses</option>
            {(() => {
              const seen = new Set()
              return Object.entries(STATUS_META)
                .filter(([key, { label }]) => {
                  if (['enrolled', 'cancelled'].includes(key)) return false
                  if (seen.has(label)) return false
                  seen.add(label)
                  return true
                })
                .map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))
            })()}
          </select>
        </div>
      )}

      {loading && <SkeletonTable rows={4} cols={5} />}

      {!loading && apps.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-slate-500 font-medium">No applications yet.</p>
          <p className="mt-1 text-sm text-slate-400">Browse colleges and apply to get started.</p>
          <button
            onClick={() => navigate('/student/dashboard?section=browse')}
            className="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Browse colleges
          </button>
        </div>
      )}

      {/* ── Mobile: cards ── */}
      {!loading && filtered.length > 0 && (
        <>
          <div className="flex flex-col gap-3 md:hidden">
            {filtered.map(app => (
              <MobileCard
                key={app.id}
                app={app}
                expandedId={expandedId}
                setExpandedId={setExpandedId}
                navigate={navigate}
                setFeePayApp={setFeePayApp}
                setReceiptsAppId={setReceiptsAppId}
                setSelectSubjectsApp={setSelectSubjectsApp}
                fetchApps={fetchApps}
              />
            ))}
          </div>

          {/* ── Desktop: table ── */}
          <div className="hidden md:block rounded-lg border-2 border-slate-400 overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-100 text-xs font-bold text-slate-600 uppercase tracking-wide border-b-2 border-slate-400">
                <tr>
                  <Th col="college_name"        label="College / Course" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <Th col="year_of_study"       label="Year"             sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <Th col="registration_number" label="Reg. No."         sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <Th col="submitted_at"        label="Submitted"        sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <Th col="status"              label="Status"           sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <th className="px-4 py-2.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-300">
                {filtered.map(app => {
                  const meta = STATUS_META[app.status] || { label: app.status, color: 'bg-slate-100 text-slate-600' }
                  const isExpanded = expandedId === app.id

                  return (
                    <React.Fragment key={app.id}>
                      <tr
                        className="hover:bg-blue-50 transition cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : app.id)}
                      >
                        <td className="px-4 py-2.5">
                          <p className="font-semibold text-slate-900">{app.college_name}</p>
                          <p className="text-xs text-slate-500">{app.course_name}</p>
                          {app.roll_number && (
                            <p className="text-xs font-bold text-violet-700 mt-0.5">Roll No: {app.roll_number}</p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">{YEAR_LABEL[app.year_of_study]} · {app.academic_year}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-500">
                          {app.registration_number || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">
                          {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString('en-IN') : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.color}`}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {app.status !== 'draft' && app.registration_number && (
                              <button
                                onClick={e => { e.stopPropagation(); setExpandedId(expandedId === `print-${app.id}` ? null : `print-${app.id}`) }}
                                className="text-xs font-semibold text-slate-500 hover:text-slate-800 border border-slate-200 rounded px-2 py-1 hover:bg-slate-50 transition"
                              >
                                Print
                              </button>
                            )}
                            {app.application_fee_paid && (
                              <button
                                onClick={e => { e.stopPropagation(); setReceiptsAppId(app.id) }}
                                className="text-xs font-semibold text-slate-500 hover:text-slate-800 border border-slate-200 rounded px-2 py-1 hover:bg-slate-50 transition"
                              >
                                Receipts
                              </button>
                            )}
                            <span className="text-slate-300 text-xs">{isExpanded ? '▲' : '▼'}</span>
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr key={`detail-${app.id}`} className="bg-slate-50">
                          <td colSpan={6} className="px-4 py-3">
                            <AppDetail
                              app={app}
                              navigate={navigate}
                              setFeePayApp={setFeePayApp}
                              setReceiptsAppId={setReceiptsAppId}
                              setSelectSubjectsApp={setSelectSubjectsApp}
                              fetchApps={fetchApps}
                            />
                          </td>
                        </tr>
                      )}

                      {expandedId === `print-${app.id}` && (
                        <tr key={`print-${app.id}`}>
                          <td colSpan={6}>
                            <ApplicationPrintView
                              appId={app.id}
                              regNumber={app.registration_number}
                              onClose={() => setExpandedId(null)}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

// ── Mobile card ───────────────────────────────────────────────
function MobileCard({ app, expandedId, setExpandedId, navigate, setFeePayApp, setReceiptsAppId, setSelectSubjectsApp, fetchApps }) {
  const meta       = STATUS_META[app.status] || { label: app.status, color: 'bg-slate-100 text-slate-600' }
  const isExpanded = expandedId === app.id
  const isPrint    = expandedId === `print-${app.id}`

  return (
    <div className="rounded-xl border-2 border-slate-300 bg-white overflow-hidden">
      {/* Card header — tap to expand */}
      <button
        className="w-full text-left px-4 py-3 hover:bg-slate-50 transition"
        onClick={() => setExpandedId(isExpanded ? null : app.id)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 truncate">{app.college_name}</p>
            <p className="text-xs text-slate-500 truncate">{app.course_name}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.color}`}>
            {meta.label}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>{YEAR_LABEL[app.year_of_study]} · {app.academic_year}</span>
          {app.registration_number && (
            <span className="font-mono">{app.registration_number}</span>
          )}
          {app.roll_number && (
            <span className="text-violet-700 font-semibold">Roll: {app.roll_number}</span>
          )}
          {app.submitted_at && (
            <span>{new Date(app.submitted_at).toLocaleDateString('en-IN')}</span>
          )}
        </div>

        <div className="mt-1.5 flex items-center justify-end">
          <span className="text-slate-400 text-xs">{isExpanded ? '▲ Less' : '▼ Details'}</span>
        </div>
      </button>

      {/* Quick action buttons */}
      {(app.status !== 'draft' && app.registration_number) || app.application_fee_paid ? (
        <div className="flex border-t border-slate-100 divide-x divide-slate-100">
          {app.status !== 'draft' && app.registration_number && (
            <button
              onClick={() => setExpandedId(isPrint ? null : `print-${app.id}`)}
              className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              🖨 Print
            </button>
          )}
          {app.application_fee_paid && (
            <button
              onClick={() => setReceiptsAppId(app.id)}
              className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              🧾 Receipts
            </button>
          )}
        </div>
      ) : null}

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-slate-200 px-4 py-3 bg-slate-50">
          <AppDetail
            app={app}
            navigate={navigate}
            setFeePayApp={setFeePayApp}
            setReceiptsAppId={setReceiptsAppId}
            setSelectSubjectsApp={setSelectSubjectsApp}
            fetchApps={fetchApps}
          />
        </div>
      )}

      {/* Print view */}
      {isPrint && (
        <div className="border-t border-slate-200">
          <ApplicationPrintView
            appId={app.id}
            regNumber={app.registration_number}
            onClose={() => setExpandedId(null)}
          />
        </div>
      )}
    </div>
  )
}

const btn = 'rounded-md border border-slate-300 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition'
const btnPrimary = 'rounded-md bg-slate-800 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 transition'

function AppDetail({ app, navigate, setFeePayApp, setReceiptsAppId, setSelectSubjectsApp, fetchApps }) {
  return (
    <div className="space-y-2">
      {app.status === 'correction_requested' && (
        <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-3 space-y-2">
          <p className="text-sm font-semibold text-slate-800">The college has requested corrections to your application.</p>
          {app.correction_note && <p className="text-sm text-slate-600 whitespace-pre-wrap">{app.correction_note}</p>}
          <button onClick={() => navigate(`/apply/${app.id}`)} className={btnPrimary}>
            Edit &amp; Resubmit Application
          </button>
        </div>
      )}

      {(app.status === 'submitted' || app.status === 'under_review' || app.status === 'correction_done') && (
        <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2">
          <p className="text-sm text-slate-600">Your application is under review by the college.</p>
        </div>
      )}

      {app.status === 'doc_verified' && (
        <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-3">
          <p className="text-sm font-semibold text-slate-800">Your application has been approved!</p>
          <p className="text-sm text-slate-600 mt-1">Please visit the college with all original documents for verification.</p>
        </div>
      )}

      {app.status === 'confirmed' && (
        <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-3 space-y-2">
          <p className="text-sm font-semibold text-slate-800">Documents verified! Please pay the college fee to confirm your admission.</p>
          <button onClick={() => setFeePayApp(app)} className={btnPrimary}>View Fee &amp; Pay</button>
        </div>
      )}

      {app.status === 'fees_paid' && (() => {
        const total     = parseFloat(app.fee_total_amount)   || 0
        const payNow    = parseFloat(app.fee_pay_now_amount) || total
        const paid      = parseFloat(app.amount_paid)        || 0
        const remaining = total > 0 ? Math.max(0, total - paid) : 0
        const hasMore   = total > 0 && (total > payNow + 0.01 || remaining > 0.01)
        return (
          <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-3 space-y-2">
            <p className="text-sm font-semibold text-slate-800">
              Admission Confirmed!
              {hasMore && remaining > 0.01 && (
                <span className="ml-2 text-xs font-normal text-slate-500">₹{remaining.toLocaleString('en-IN')} balance due</span>
              )}
            </p>
            {hasMore && <p className="text-xs text-slate-500">Paid ₹{paid.toLocaleString('en-IN')} of ₹{total.toLocaleString('en-IN')} total.</p>}
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setFeePayApp(app)} className={btnPrimary}>
                {hasMore && remaining > 0.01 ? 'View Fee & Pay' : 'View Fee & Receipts'}
              </button>
              <button onClick={() => setSelectSubjectsApp(app)} className={btn}>Select Subjects</button>
            </div>
          </div>
        )
      })()}

      {app.status === 'roll_assigned' && (() => {
        const total     = parseFloat(app.fee_total_amount)   || 0
        const paid      = parseFloat(app.amount_paid)        || 0
        const remaining = total > 0 ? Math.max(0, total - paid) : 0
        return (
          <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-800">Roll Number Assigned!</p>
              {remaining > 0.01 && (
                <span className="text-xs text-slate-500">₹{remaining.toLocaleString('en-IN')} balance due</span>
              )}
            </div>
            {app.roll_number && (
              <p className="text-xl font-bold text-slate-900">Roll No: {app.roll_number}</p>
            )}
            {remaining > 0.01 && (
              <p className="text-xs text-slate-500">Paid ₹{paid.toLocaleString('en-IN')} of ₹{total.toLocaleString('en-IN')} total.</p>
            )}
            <div className="flex gap-2 flex-wrap">
              {remaining > 0.01 && (
                <button onClick={() => setFeePayApp(app)} className={btnPrimary}>View Fee &amp; Pay</button>
              )}
              <button onClick={() => setSelectSubjectsApp(app)} className={remaining > 0.01 ? btn : btnPrimary}>Select Subjects</button>
            </div>
          </div>
        )
      })()}

      {app.status === 'enrolled' && (
        <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-3 space-y-2 text-sm text-slate-700">
          <p className="font-semibold">Enrollment complete. Welcome to {app.college_name}!</p>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setFeePayApp(app)} className={btn}>Fee Details</button>
            <button onClick={() => setSelectSubjectsApp(app)} className={btn}>View / Update Subjects</button>
          </div>
        </div>
      )}

      {app.status === 'rejected' && app.rejection_reason && (
        <div className="rounded-md bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
          <strong>Rejection reason:</strong> {app.rejection_reason}
        </div>
      )}

      {app.status === 'cancelled' && app.cancellation_reason && (
        <div className="rounded-md bg-slate-100 border border-slate-200 px-3 py-2 text-sm text-slate-600">
          <strong>Cancelled:</strong> {app.cancellation_reason}
        </div>
      )}

      {app.status === 'draft' && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
          <p className="text-sm text-amber-800 font-medium">Application not yet submitted.</p>
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <button onClick={() => navigate(`/apply/${app.id}`)} className="rounded-md bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-600">Continue →</button>
            <DeleteDraftButton appId={app.id} onDeleted={fetchApps} />
          </div>
        </div>
      )}
    </div>
  )
}

function DeleteDraftButton({ appId, onDeleted }) {
  const toast = useToast()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm('Delete this draft application? This cannot be undone.')) return
    setDeleting(true)
    try {
      await deleteApplication(appId)
      onDeleted()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Delete failed.')
      setDeleting(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition disabled:opacity-50"
    >
      {deleting ? 'Deleting…' : 'Delete Draft'}
    </button>
  )
}

function Th({ col, label, sortCol, sortDir, onSort }) {
  const active = sortCol === col
  return (
    <th
      className="px-4 py-2.5 text-left cursor-pointer select-none hover:text-slate-900 transition"
      onClick={() => onSort(col)}
    >
      <span className="flex items-center gap-1">
        {label}
        <span className="text-slate-300">{active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
      </span>
    </th>
  )
}
