import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../../services/api.js'

const YEAR_LABEL = { 1: 'FY', 2: 'SY', 3: 'TY' }

const STATUS_META = {
  submitted:                { label: 'Submitted',               color: 'bg-blue-100 text-blue-700' },
  under_review:             { label: 'Under Review',            color: 'bg-blue-100 text-blue-700' },
  correction_requested:     { label: 'Correction Pending',      color: 'bg-orange-100 text-orange-700' },
  correction_done:          { label: 'Correction Done',         color: 'bg-sky-100 text-sky-700' },
  scrutiny_accepted:        { label: 'Scrutiny Accepted',       color: 'bg-teal-100 text-teal-700' },
  doc_verification_pending: { label: 'Doc Verification Pending',color: 'bg-orange-100 text-orange-700' },
  confirmed:                { label: 'Confirmed',               color: 'bg-emerald-100 text-emerald-700' },
  fees_paid:                { label: 'Fees Paid',               color: 'bg-emerald-100 text-emerald-700' },
  roll_assigned:            { label: 'Roll Assigned',           color: 'bg-violet-100 text-violet-700' },
  enrolled:                 { label: 'Enrolled',                color: 'bg-green-100 text-green-800' },
  rejected:                 { label: 'Rejected',                color: 'bg-red-100 text-red-700' },
  cancelled:                { label: 'Cancelled',               color: 'bg-slate-100 text-slate-500' },
}

const TABS = [
  { key: 'submitted,under_review',  label: 'Pending Scrutiny' },
  { key: 'correction_requested,correction_done', label: 'Awaiting Correction' },
  { key: 'scrutiny_accepted',       label: 'Scrutiny Accepted' },
  { key: 'doc_verification_pending',label: 'Doc Verification' },
  { key: 'confirmed',               label: 'Confirmed' },
  { key: 'fees_paid',               label: 'Fees Paid' },
  { key: 'rejected,cancelled',      label: 'Rejected / Cancelled' },
]

export default function ApplicationInbox({ collegeId }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialStatus = searchParams.get('status') || 'submitted,under_review'

  const [activeTab, setActiveTab]   = useState(initialStatus)
  const [apps, setApps]             = useState([])
  const [loading, setLoading]       = useState(true)

  // Filter state
  const [search, setSearch]         = useState('')
  const [filterCourse, setFilterCourse] = useState('')
  const [filterYear, setFilterYear]     = useState('')

  function fetchApps(status) {
    setLoading(true)
    api.get(`college-admin/${collegeId}/applications?status=${encodeURIComponent(status)}`)
      .then(r => setApps(r.data.data || []))
      .catch(() => setApps([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchApps(activeTab)
    // Reset filters on tab change
    setSearch('')
    setFilterCourse('')
    setFilterYear('')
  }, [activeTab, collegeId])

  // Derive unique course options from fetched apps
  const courseOptions = useMemo(() => {
    const map = new Map()
    apps.forEach(a => { if (a.course_id) map.set(a.course_id, a.course_name) })
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [apps])

  // Derive unique year options from fetched apps
  const yearOptions = useMemo(() => {
    const set = new Set(apps.map(a => a.year_of_study).filter(Boolean))
    return [...set].sort()
  }, [apps])

  // Client-side filtering
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return apps.filter(a => {
      if (filterCourse && String(a.course_id) !== String(filterCourse)) return false
      if (filterYear   && String(a.year_of_study) !== String(filterYear)) return false
      if (q) {
        const haystack = [
          a.student_name, a.student_email, a.phone,
          a.registration_number, a.course_name, a.academic_year,
        ].join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [apps, search, filterCourse, filterYear])

  const hasFilters = search || filterCourse || filterYear

  function openApp(appId) {
    navigate(`/college/dashboard?section=app&app_id=${appId}`)
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">College portal</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Application Inbox</h1>
          <p className="mt-1 text-slate-600">Review and manage student applications.</p>
        </div>
        <a
          href="/college/dashboard?section=add-application"
          className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition mt-2"
        >
          + Add Application
        </a>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`whitespace-nowrap px-4 py-2 text-sm font-semibold border-b-2 transition ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
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

        {/* Course filter */}
        <select
          value={filterCourse}
          onChange={e => setFilterCourse(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0 sm:w-56"
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

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setFilterCourse(''); setFilterYear('') }}
            className="text-sm text-slate-400 hover:text-slate-700 font-medium whitespace-nowrap self-center"
          >
            Clear
          </button>
        )}
      </div>

      {/* Result count */}
      {!loading && (
        <p className="text-xs text-slate-400">
          {hasFilters
            ? `${filtered.length} of ${apps.length} application${apps.length !== 1 ? 's' : ''}`
            : `${apps.length} application${apps.length !== 1 ? 's' : ''}`
          }
        </p>
      )}

      {loading && <p className="text-slate-500">Loading…</p>}

      {!loading && filtered.length === 0 && (
        <p className="text-slate-500">
          {hasFilters ? 'No applications match your filters.' : 'No applications in this category.'}
        </p>
      )}

      <div className="rounded-lg border border-slate-200 overflow-hidden">
        {/* Table header */}
        <div className="hidden sm:grid grid-cols-[1fr_1fr_9rem_auto_6rem] bg-slate-50 border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
              className={`w-full text-left grid sm:grid-cols-[1fr_1fr_9rem_auto_6rem] px-4 py-2.5 hover:bg-blue-50 transition items-center ${
                i !== 0 ? 'border-t border-slate-100' : ''
              }`}
            >
              {/* Student name + contact */}
              <div className="min-w-0 pr-3">
                <p className="font-medium text-sm text-slate-900 truncate">{app.student_name}</p>
                <p className="text-xs text-slate-400 truncate">{app.student_email} · {app.phone}</p>
              </div>

              {/* Course */}
              <div className="min-w-0 pr-3">
                <p className="text-sm text-slate-700 truncate">{app.course_name}</p>
                <p className="text-xs text-slate-400">{YEAR_LABEL[app.year_of_study]} · {app.academic_year}</p>
              </div>

              {/* Reg no */}
              <span className="font-mono text-xs text-slate-400 truncate pr-3">
                {app.registration_number || '—'}
              </span>

              {/* Status badge */}
              <span className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${meta.color}`}>
                {meta.label}
              </span>

              {/* Date */}
              <span className="text-xs text-slate-400 whitespace-nowrap text-right">
                {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString('en-IN') : '—'}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
