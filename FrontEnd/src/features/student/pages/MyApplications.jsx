import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../services/api.js'
import { useAuthContext } from '../../../context/AuthContext.jsx'
import SubjectSelection from './SubjectSelection.jsx'
import CollegeFeePayment from './CollegeFeePayment.jsx'
import PaymentReceipts from './PaymentReceipts.jsx'

const YEAR_LABEL  = { 1: 'FY', 2: 'SY', 3: 'TY' }
const STATUS_META = {
  draft:                    { label: 'Draft',                      color: 'bg-slate-100 text-slate-600' },
  payment_pending:          { label: 'Payment Pending',            color: 'bg-yellow-100 text-yellow-700' },
  submitted:                { label: 'Submitted',                  color: 'bg-blue-100 text-blue-700' },
  under_review:             { label: 'Under Review',               color: 'bg-blue-100 text-blue-700' },
  scrutiny_accepted:        { label: 'Scrutiny Accepted',          color: 'bg-teal-100 text-teal-700' },
  doc_verification_pending: { label: 'Doc Verification Pending',   color: 'bg-orange-100 text-orange-700' },
  confirmed:                { label: 'Confirmed',                  color: 'bg-emerald-100 text-emerald-700' },
  fees_paid:                { label: 'Fees Paid',                  color: 'bg-emerald-100 text-emerald-700' },
  roll_assigned:            { label: 'Roll Assigned',              color: 'bg-violet-100 text-violet-700' },
  enrolled:                 { label: 'Enrolled',                   color: 'bg-green-100 text-green-800' },
  rejected:                 { label: 'Rejected',                   color: 'bg-red-100 text-red-700' },
  cancelled:                { label: 'Cancelled',                  color: 'bg-slate-100 text-slate-500' },
}

const SECTIONS = [
  { key: 'all',       label: 'All' },
  { key: 'scrutiny',  label: 'Under Scrutiny',     statuses: ['draft','submitted','under_review'] },
  { key: 'accepted',  label: 'Accepted',            statuses: ['scrutiny_accepted','doc_verification_pending'] },
  { key: 'merit',     label: 'In Merit',            statuses: ['confirmed'] },
  { key: 'confirmed', label: 'Confirmed Admission', statuses: ['fees_paid','roll_assigned','enrolled'] },
]

export default function MyApplications() {
  const { user }    = useAuthContext()
  const navigate    = useNavigate()
  const [apps, setApps]               = useState([])
  const [loading, setLoading]         = useState(true)
  const [activeSection, setActiveSection] = useState('all')
  const [feePayApp, setFeePayApp]     = useState(null)
  const [receiptsAppId, setReceiptsAppId] = useState(null)
  const [selectSubjectsApp, setSelectSubjectsApp] = useState(null)

  function fetchApps() {
    api.get(`applications?student_id=${user.id}`)
      .then(r => setApps(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchApps() }, [user.id])

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
        <CollegeFeePayment
          application={feePayApp}
          onDone={() => { setFeePayApp(null); fetchApps() }}
          onCancel={() => setFeePayApp(null)}
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
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">Student portal</p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-slate-950">My Applications</h1>
          <p className="mt-1 text-slate-600">All your college applications across all years.</p>
        </div>
        <button
          onClick={() => navigate('/student/dashboard?section=browse')}
          className="self-start sm:shrink-0 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          + New Application
        </button>
      </div>

      {/* Section tabs */}
      {!loading && apps.length > 0 && (
        <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
          {SECTIONS.map(sec => (
            <button
              key={sec.key}
              onClick={() => setActiveSection(sec.key)}
              className={`whitespace-nowrap px-4 py-2 text-sm font-semibold border-b-2 transition ${
                activeSection === sec.key
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {sec.label}
              {sec.key !== 'all' && (
                <span className="ml-1.5 text-xs text-slate-400">
                  ({apps.filter(a => sec.statuses.includes(a.status)).length})
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="text-slate-500">Loading…</p>}

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

      <div className="space-y-4">
        {apps
          .filter(app => {
            if (activeSection === 'all') return true
            const sec = SECTIONS.find(s => s.key === activeSection)
            return sec?.statuses.includes(app.status)
          })
          .map(app => {
          const meta = STATUS_META[app.status] || { label: app.status, color: 'bg-slate-100 text-slate-600' }

          return (
            <article key={app.id} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">{app.college_name}</p>
                  <p className="text-sm text-slate-500">
                    {app.course_name} · {YEAR_LABEL[app.year_of_study]} · {app.academic_year}
                  </p>
                  {app.registration_number && (
                    <p className="mt-1 font-mono text-xs text-slate-400">Reg: {app.registration_number}</p>
                  )}
                  {app.roll_number && (
                    <p className="mt-0.5 text-xs font-semibold text-violet-700">Roll No: {app.roll_number}</p>
                  )}
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.color}`}>
                  {meta.label}
                </span>
              </div>

              {/* Status-specific actions and messages */}
              {app.status === 'submitted' && (
                <div className="mt-3 rounded-md bg-blue-50 border border-blue-100 px-3 py-2">
                  <p className="text-sm text-blue-800">
                    Your application has been submitted. The college will review and perform scrutiny. Please wait for the result.
                  </p>
                </div>
              )}

              {app.status === 'under_review' && (
                <div className="mt-3 rounded-md bg-blue-50 border border-blue-100 px-3 py-2">
                  <p className="text-sm text-blue-800">
                    Your application is under review by the college.
                  </p>
                </div>
              )}

              {app.status === 'scrutiny_accepted' && (
                <div className="mt-3 rounded-md bg-teal-50 border border-teal-100 px-3 py-2">
                  <p className="text-sm text-teal-800 font-medium">
                    Your application has passed scrutiny and has been accepted by the college.
                    Please wait — the college will call you for physical document verification.
                  </p>
                </div>
              )}

              {app.status === 'doc_verification_pending' && (
                <div className="mt-3 rounded-md bg-orange-50 border border-orange-100 px-3 py-2">
                  <p className="text-sm text-orange-800 font-medium">
                    The college has called you for physical document verification.
                    Please visit the college with all original documents. Once your documents are verified in person, your admission will be confirmed.
                  </p>
                </div>
              )}

              {app.status === 'confirmed' && (
                <div className="mt-3 rounded-md bg-emerald-50 border border-emerald-100 px-3 py-2 space-y-2">
                  <p className="text-sm text-emerald-800 font-medium">
                    Admission confirmed! Your documents have been verified. Pay the college fee to secure your seat.
                  </p>
                  <button
                    onClick={() => setFeePayApp(app)}
                    className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    Pay College Fee
                  </button>
                </div>
              )}

              {app.status === 'roll_assigned' && (
                <div className="mt-3 rounded-md bg-violet-50 border border-violet-100 px-3 py-2">
                  <p className="text-sm text-violet-800 font-medium">
                    Roll number assigned! Select your subjects to complete enrollment.
                  </p>
                  <button
                    onClick={() => setSelectSubjectsApp(app)}
                    className="mt-2 rounded-md bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-700"
                  >
                    Select Subjects
                  </button>
                </div>
              )}

              {app.status === 'enrolled' && (
                <div className="mt-3 rounded-md bg-green-50 border border-green-100 px-3 py-2 text-sm text-green-800">
                  Enrollment complete. Welcome to {app.college_name}!
                </div>
              )}

              {app.status === 'rejected' && app.rejection_reason && (
                <div className="mt-3 rounded-md bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
                  <strong>Rejection reason:</strong> {app.rejection_reason}
                </div>
              )}

              {app.status === 'cancelled' && app.cancellation_reason && (
                <div className="mt-3 rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-600">
                  <strong>Cancelled:</strong> {app.cancellation_reason}
                </div>
              )}

              {app.status === 'draft' && (
                <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
                  <p className="text-sm text-amber-800 font-medium">Application not yet submitted.</p>
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      onClick={() => navigate(`/apply/${app.id}`)}
                      className="rounded-md bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-600"
                    >
                      Continue →
                    </button>
                    <DeleteDraftButton appId={app.id} onDeleted={fetchApps} />
                  </div>
                </div>
              )}

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span className="text-xs text-slate-400">
                  Submitted: {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString('en-IN') : '—'}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {app.status !== 'draft' && app.registration_number && (
                    <button
                      onClick={() => navigate(`/apply/${app.id}`)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-md px-2.5 py-1 hover:bg-slate-50 transition"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                      </svg>
                      View / Print
                    </button>
                  )}
                  {app.application_fee_paid && (
                    <button
                      onClick={() => setReceiptsAppId(app.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-md px-2.5 py-1 hover:bg-slate-50 transition"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                      </svg>
                      Receipts
                    </button>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function DeleteDraftButton({ appId, onDeleted }) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm('Delete this draft application? This cannot be undone.')) return
    setDeleting(true)
    try {
      await api.delete(`applications/${appId}`)
      onDeleted()
    } catch (err) {
      alert(err?.response?.data?.message || 'Delete failed.')
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
