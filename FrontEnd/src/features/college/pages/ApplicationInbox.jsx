import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../../services/api.js'

const YEAR_LABEL = { 1: 'FY', 2: 'SY', 3: 'TY' }

const STATUS_META = {
  submitted:             { label: 'Submitted',          color: 'bg-blue-100 text-blue-700' },
  under_review:          { label: 'Under Review',       color: 'bg-blue-100 text-blue-700' },
  approved:              { label: 'Approved',           color: 'bg-teal-100 text-teal-700' },
  document_verification: { label: 'Doc Verification',  color: 'bg-orange-100 text-orange-700' },
  confirmed:             { label: 'Confirmed',          color: 'bg-emerald-100 text-emerald-700' },
  fees_paid:             { label: 'Fees Paid',          color: 'bg-emerald-100 text-emerald-700' },
  roll_assigned:         { label: 'Roll Assigned',      color: 'bg-violet-100 text-violet-700' },
  enrolled:              { label: 'Enrolled',           color: 'bg-green-100 text-green-800' },
  rejected:              { label: 'Rejected',           color: 'bg-red-100 text-red-700' },
  cancelled:             { label: 'Cancelled',          color: 'bg-slate-100 text-slate-500' },
}

// key is what gets sent as ?status= to the API (comma-separated = multi-status query)
const TABS = [
  { key: 'submitted,under_review',                       label: 'Pending' },
  { key: 'approved,document_verification,confirmed',     label: 'Approved' },
  { key: 'fees_paid',                                    label: 'Fees Paid' },
  { key: 'roll_assigned',                                label: 'Roll Assigned' },
  { key: 'enrolled',                                     label: 'Enrolled' },
  { key: 'rejected,cancelled',                           label: 'Rejected / Cancelled' },
]

export default function ApplicationInbox({ collegeId }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialStatus = searchParams.get('status') || 'submitted,under_review'

  const [activeTab, setActiveTab] = useState(initialStatus)
  const [apps, setApps]           = useState([])
  const [loading, setLoading]     = useState(true)

  function fetchApps(status) {
    setLoading(true)
    api.get(`college-admin/${collegeId}/applications?status=${encodeURIComponent(status)}`)
      .then(r => setApps(r.data.data || []))
      .catch(() => setApps([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchApps(activeTab) }, [activeTab, collegeId])

  function openApp(appId) {
    navigate(`/college/dashboard?section=app&app_id=${appId}`)
  }

  return (
    <section className="space-y-6">
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

      {loading && <p className="text-slate-500">Loading…</p>}

      {!loading && apps.length === 0 && (
        <p className="text-slate-500">No applications in this category.</p>
      )}

      <div className="space-y-3">
        {apps.map(app => {
          const meta = STATUS_META[app.status] || { label: app.status, color: 'bg-slate-100 text-slate-600' }
          return (
            <button
              key={app.id}
              onClick={() => openApp(app.id)}
              className="w-full text-left rounded-lg border border-slate-200 bg-white px-5 py-4 hover:border-blue-200 hover:bg-blue-50 transition"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-950">{app.student_name}</p>
                  <p className="text-sm text-slate-500">{app.student_email} · {app.phone}</p>
                  <p className="text-sm text-slate-600 mt-0.5">
                    {app.course_name} — {YEAR_LABEL[app.year_of_study]} · {app.academic_year}
                  </p>
                  {app.registration_number && (
                    <p className="font-mono text-xs text-slate-400 mt-0.5">Reg: {app.registration_number}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.color}`}>
                    {meta.label}
                  </span>
                  <span className="text-xs text-slate-400">
                    {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString('en-IN') : '—'}
                  </span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
