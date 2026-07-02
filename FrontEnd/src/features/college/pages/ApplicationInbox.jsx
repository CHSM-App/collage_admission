import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApplicationsList } from '../hooks/useApplicationsList.js'
import { useSortableTable } from '../../../shared/hooks/useSortableTable.js'
import Pagination from '../../../shared/components/Pagination.jsx'
import { SkeletonTable } from '../../../shared/components/Skeleton.jsx'
import ExportDialog from '../components/ExportDialog.jsx'

const YEAR_LABEL = { 1: 'FY', 2: 'SY', 3: 'TY', 4: '4Y', 5: '5Y' }

const STATUS_META = {
  submitted:                { label: 'Review Pending',           color: 'bg-blue-100 text-blue-700' },
  under_review:             { label: 'Review Pending',           color: 'bg-blue-100 text-blue-700' },
  correction_requested:     { label: 'Correction Pending',       color: 'bg-orange-100 text-orange-700' },
  correction_done:          { label: 'Correction Review',        color: 'bg-sky-100 text-sky-700' },
  doc_verified:             { label: 'Student Awaited',          color: 'bg-teal-100 text-teal-700' },
  confirmed:                { label: 'Fees Pending',             color: 'bg-amber-100 text-amber-700' },
  fees_paid:                { label: 'Admission Confirmed',      color: 'bg-emerald-100 text-emerald-700' },
  roll_assigned:            { label: 'Roll Assigned',            color: 'bg-violet-100 text-violet-700' },
  rejected:                 { label: 'Rejected',                 color: 'bg-red-100 text-red-700' },
}

// Group statuses by label so labels that map to multiple workflow keys
// (e.g. "Review Pending" covers both `submitted` and `under_review`)
// appear as a single dropdown entry. The value is the comma-joined keys —
// the backend already splits on ',' and filters with IN (...).
const ALL_STATUSES = (() => {
  const byLabel = new Map()
  for (const [key, { label }] of Object.entries(STATUS_META)) {
    const entry = byLabel.get(label)
    if (entry) entry.keys.push(key)
    else byLabel.set(label, { label, keys: [key] })
  }
  return [...byLabel.values()].map(({ label, keys }) => ({
    value: keys.join(','),
    keys,
    label,
  }))
})()

function useStatusCounts(apps) {
  return useMemo(() => {
    const counts = {}
    apps.forEach(a => { counts[a.status] = (counts[a.status] || 0) + 1 })
    return counts
  }, [apps])
}

export default function ApplicationInbox({ collegeId, collegeName = '' }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Filters persisted in URL so they survive navigation to app detail and back
  const page           = parseInt(searchParams.get('ib_page')     || '1', 10)
  const search         = searchParams.get('ib_q')       || ''
  const filterStatus   = searchParams.get('ib_status')  || ''
  const filterCourse   = searchParams.get('ib_course')  || ''
  const filterYear     = searchParams.get('ib_year')    || ''
  const filterDivision = searchParams.get('ib_div')     || ''
  const pendingLink    = searchParams.get('ib_plink')   === '1'

  const [showExport, setShowExport] = useState(false)

  function setParam(key, value) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value); else next.delete(key)
      return next
    }, { replace: true })
  }

  const setPage           = v => setParam('ib_page',   v === 1 ? '' : String(v))
  const setSearch         = v => setParam('ib_q',      v)
  const setFilterStatus   = v => setParam('ib_status', v)
  const setFilterCourse   = v => setParam('ib_course', v)
  const setFilterYear     = v => setParam('ib_year',   v)
  const setFilterDivision = v => setParam('ib_div',    v)
  const setPendingLink    = v => setParam('ib_plink',  v ? '1' : '')

  const { apps, loading, pagination, fetchApps } = useApplicationsList(collegeId, {
    page, filterStatus, filterCourse, filterYear, filterDivision, pendingLink,
  })

  const statusCounts = useStatusCounts(apps)

  const courseOptions = useMemo(() => {
    const map = new Map()
    apps.forEach(a => { if (a.course_id) map.set(a.course_id, a.course_name) })
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [apps])

  const yearOptions = useMemo(() => {
    const set = new Set(apps.map(a => a.year_of_study).filter(Boolean))
    return [...set].sort()
  }, [apps])

  const [seenDivisions, setSeenDivisions] = useState([])
  useEffect(() => {
    const fresh = apps.map(a => a.app_division).filter(Boolean)
    if (fresh.length > 0)
      setSeenDivisions(prev => [...new Set([...prev, ...fresh])].sort())
  }, [apps])

  // Client-side search filter (haystack join) then sort via shared hook
  const searched = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return apps
    return apps.filter(a => {
      const haystack = [
        a.student_name, a.student_email, a.phone,
        a.registration_number, a.course_name, a.academic_year,
      ].join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [apps, search])

  const { sorted: filtered, sortCol, sortDir, toggleSort } = useSortableTable(
    searched, 'submitted_at', 'desc', { numericCols: ['year_of_study'] }
  )

  const hasFilters = search || filterStatus || filterCourse || filterYear || filterDivision || pendingLink

  function clearFilters() {
    setSearchParams({ section: 'inbox' }, { replace: true })
  }

  function openApp(appId) {
    // Preserve inbox filter params in the URL so they're restored on back navigation
    const next = new URLSearchParams(searchParams)
    next.set('section', 'app')
    next.set('app_id', appId)
    navigate(`/college/dashboard?${next.toString()}`)
  }

  return (
    <section className="space-y-5">
      {showExport && (
        <ExportDialog
          collegeId={collegeId}
          collegeName={collegeName}
          courseOptions={courseOptions}
          yearOptions={yearOptions}
          onClose={() => setShowExport(false)}
        />
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">College portal</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Application Inbox</h1>
          <p className="mt-1 text-slate-600">Review and manage student applications.</p>
        </div>
        <button
          onClick={() => setShowExport(true)}
          className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition shrink-0 mt-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M8 12l4 4 4-4M12 4v12"/>
          </svg>
          Export
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, reg. no…"
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">✕</button>
          )}
        </div>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-56"
        >
          <option value="">All Statuses ({pagination.total})</option>
          {ALL_STATUSES.map(s => {
            const count = s.keys.reduce((sum, k) => sum + (statusCounts[k] || 0), 0)
            return (
              <option key={s.value} value={s.value}>{s.label} ({count})</option>
            )
          })}
        </select>

        {/* Course filter */}
        <select
          value={filterCourse}
          onChange={e => setFilterCourse(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-52"
        >
          <option value="">All Courses</option>
          {courseOptions.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>

        {/* Year filter */}
        <select
          value={filterYear}
          onChange={e => setFilterYear(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-36"
        >
          <option value="">All Years</option>
          {yearOptions.map(y => (
            <option key={y} value={y}>{YEAR_LABEL[y]} — Year {y}</option>
          ))}
        </select>

        {/* Division filter */}
        {seenDivisions.length > 0 && (
          <div className="relative inline-flex items-center">
            <select
              value={filterDivision}
              onChange={e => setFilterDivision(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-36 pr-7"
            >
              <option value="">All Divisions</option>
              {seenDivisions.map(d => (
                <option key={d} value={d}>Division {d}</option>
              ))}
            </select>
            {filterDivision && (
              <button
                onClick={() => setFilterDivision('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs"
              >✕</button>
            )}
          </div>
        )}

        {/* Payment link pending toggle */}
        {/* <button
          onClick={() => setPendingLink(v => !v)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold whitespace-nowrap transition ${
            pendingLink
              ? 'border-green-400 bg-green-50 text-green-700'
              : 'border-slate-200 bg-white text-slate-500 hover:border-green-300 hover:text-green-700'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${pendingLink ? 'bg-green-500' : 'bg-slate-300'}`} />
          Link Pending
        </button> */}

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-slate-400 hover:text-slate-700 font-medium whitespace-nowrap self-center"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Result count */}
      {!loading && (
        <p className="text-xs text-slate-400">
          {search
            ? `${filtered.length} match${filtered.length !== 1 ? 'es' : ''} on this page`
            : `${pagination.total} application${pagination.total !== 1 ? 's' : ''} total`
          }
        </p>
      )}

      {loading && <SkeletonTable rows={6} cols={5} />}

      {!loading && filtered.length === 0 && (
        <p className="text-slate-500">
          {hasFilters ? 'No applications match your filters.' : 'No applications found.'}
        </p>
      )}

      {!loading && filtered.length === 0 && apps.length > 0 && (
        <p className="text-slate-500">No applications match your search on this page.</p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="rounded-lg border-2 border-slate-400 overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_1fr_10rem_12rem_6rem] bg-slate-100 border-b-2 border-slate-400 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600">
            <InboxTh col="student_name"       label="Student"       sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
            <InboxTh col="course_name"        label="Course / Year" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
            <InboxTh col="registration_number" label="Reg No."      sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
            <InboxTh col="status"             label="Status"        sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
            <InboxTh col="submitted_at"       label="Date"          sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} align="right" />
          </div>

          {filtered.map((app, i) => {
            const meta = STATUS_META[app.status] || { label: app.status, color: 'bg-slate-100 text-slate-600' }
            const hasPendingLink = !!app.has_pending_link
            return (
              <button
                key={app.id}
                onClick={() => openApp(app.id)}
                className={`w-full text-left grid sm:grid-cols-[1fr_1fr_10rem_12rem_6rem] px-4 py-2.5 hover:bg-blue-50 transition items-center ${
                  i !== 0 ? 'border-t-2 border-slate-300' : ''
                } ${hasPendingLink ? 'bg-green-50' : ''}`}
              >
                <div className="min-w-0 pr-3">
                  <p className="font-medium text-sm text-slate-900 truncate">{app.student_name}</p>
                  <p className="text-xs text-slate-400 truncate">{app.student_email} · {app.phone}</p>
                </div>
                <div className="min-w-0 pr-3">
                  <p className="text-sm text-slate-700 truncate">{app.course_name}</p>
                  <p className="text-xs text-slate-400">{YEAR_LABEL[app.year_of_study]} · {app.academic_year}</p>
                </div>
                <span className="font-mono text-xs text-slate-400 truncate pr-3">
                  {app.registration_number || '—'}
                </span>
                <div className="flex flex-col gap-1">
                  <span className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${meta.color}`}>
                    {meta.label}
                  </span>
                  {hasPendingLink && (
                    <span className="inline-flex w-fit items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700 whitespace-nowrap">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      Link Pending
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap text-right">
                  {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString('en-IN') : '—'}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        onPageChange={setPage}
      />
    </section>
  )
}

function InboxTh({ col, label, sortCol, sortDir, onSort, align = 'left' }) {
  const active = sortCol === col
  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      className={`flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-slate-600 hover:text-slate-900 transition select-none ${align === 'right' ? 'ml-auto' : ''}`}
    >
      {label}
      <span className="text-slate-300">{active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
    </button>
  )
}
