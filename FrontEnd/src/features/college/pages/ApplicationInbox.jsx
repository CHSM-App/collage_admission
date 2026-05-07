import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../services/api.js'
import Pagination from '../../../shared/components/Pagination.jsx'

const YEAR_LABEL = { 1: 'FY', 2: 'SY', 3: 'TY' }

const STATUS_META = {
  submitted:                { label: 'Review Pending',           color: 'bg-blue-100 text-blue-700' },
  under_review:             { label: 'Review Pending',           color: 'bg-blue-100 text-blue-700' },
  correction_requested:     { label: 'Correction Pending',       color: 'bg-orange-100 text-orange-700' },
  correction_done:          { label: 'Correction Review',        color: 'bg-sky-100 text-sky-700' },
  doc_verified:             { label: 'Student Awaited',          color: 'bg-teal-100 text-teal-700' },
  confirmed:                { label: 'Fees Pending',             color: 'bg-amber-100 text-amber-700' },
  fees_paid:                { label: 'Admission Confirmed',      color: 'bg-emerald-100 text-emerald-700' },
  roll_assigned:            { label: 'Roll Assigned',            color: 'bg-violet-100 text-violet-700' },
  enrolled:                 { label: 'Enrolled',                 color: 'bg-green-100 text-green-800' },
  rejected:                 { label: 'Rejected',                 color: 'bg-red-100 text-red-700' },
  cancelled:                { label: 'Cancelled',                color: 'bg-slate-100 text-slate-500' },
}

const ALL_STATUSES = Object.entries(STATUS_META).map(([key, { label }]) => ({ key, label }))

function useStatusCounts(apps) {
  return useMemo(() => {
    const counts = {}
    apps.forEach(a => { counts[a.status] = (counts[a.status] || 0) + 1 })
    return counts
  }, [apps])
}

export default function ApplicationInbox({ collegeId }) {
  const navigate = useNavigate()

  const [apps, setApps]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [page, setPage]         = useState(1)
  const LIMIT = 20

  // Filters
  const [search, setSearch]             = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCourse, setFilterCourse] = useState('')
  const [filterYear, setFilterYear]     = useState('')

  const fetchApps = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page, limit: LIMIT })
    if (filterStatus) params.set('status', filterStatus)
    if (filterCourse) params.set('course_id', filterCourse)
    if (filterYear)   params.set('year_of_study', filterYear)
    api.get(`college-admin/${collegeId}/applications?${params}`)
      .then(r => {
        setApps(r.data.data || [])
        setPagination(r.data.pagination || { page: 1, totalPages: 1, total: 0 })
      })
      .catch(() => setApps([]))
      .finally(() => setLoading(false))
  }, [collegeId, page, filterStatus, filterCourse, filterYear])

  useEffect(() => { fetchApps() }, [fetchApps])

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1) }, [filterStatus, filterCourse, filterYear])

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

  // Client-side search filter (only on the current page)
  const filtered = useMemo(() => {
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

  const hasFilters = search || filterStatus || filterCourse || filterYear

  function clearFilters() {
    setSearch(''); setFilterStatus(''); setFilterCourse(''); setFilterYear(''); setPage(1)
  }

  function openApp(appId) {
    navigate(`/college/dashboard?section=app&app_id=${appId}`)
  }

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">College portal</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Application Inbox</h1>
        <p className="mt-1 text-slate-600">Review and manage student applications.</p>
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
          {ALL_STATUSES.map(s => (
            <option key={s.key} value={s.key}>{s.label} ({statusCounts[s.key] || 0})</option>
          ))}
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

      {loading && <p className="text-slate-500">Loading…</p>}

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
            <span>Student</span>
            <span>Course / Year</span>
            <span>Reg No.</span>
            <span>Status</span>
            <span className="text-right">Date</span>
          </div>

          {filtered.map((app, i) => {

            const meta = STATUS_META[app.status] || { label: app.status, color: 'bg-slate-100 text-slate-600' }
            return (
              <button
                key={app.id}
                onClick={() => openApp(app.id)}
                className={`w-full text-left grid sm:grid-cols-[1fr_1fr_10rem_12rem_6rem] px-4 py-2.5 hover:bg-blue-50 transition items-center ${
                  i !== 0 ? 'border-t-2 border-slate-300' : ''
                }`}
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
                <span className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${meta.color}`}>
                  {meta.label}
                </span>
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
