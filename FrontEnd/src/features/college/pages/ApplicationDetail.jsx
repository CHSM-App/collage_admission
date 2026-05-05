import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../services/api.js'
import Button from '../../../shared/components/Button.jsx'
import { usePermissions } from '../hooks/usePermissions.js'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/').replace(/\/$/, '')

const YEAR_LABEL = { 1: 'FY — First Year', 2: 'SY — Second Year', 3: 'TY — Third Year' }

const STATUS_FLOW = {
  submitted:                { label: 'Review Pending — awaiting college review' },
  under_review:             { label: 'Review Pending — awaiting college review' },
  correction_requested:     { label: 'Correction Pending — waiting for student to resubmit' },
  correction_done:          { label: 'Correction Review — student has resubmitted' },
  doc_verified:             { label: 'Student Awaited — student must visit college for doc check' },
  confirmed:                { label: 'Fees Pending — student must pay college fee' },
  fees_paid:                { label: 'Confirmed — admission complete' },
  roll_assigned:            { label: 'Roll assigned — subject selection pending' },
  enrolled:                 { label: 'Enrolled' },
  rejected:                 { label: 'Rejected' },
  cancelled:                { label: 'Cancelled' },
}

export default function ApplicationDetail({ collegeId, appId }) {
  const navigate = useNavigate()
  const { canWrite } = usePermissions()
  const canReview   = canWrite('review_application')
  const canUpload   = canWrite('upload_documents')
  const canReviewD  = canWrite('review_documents')
  const canFees     = canWrite('collect_fees')
  const canEditApp  = canWrite('edit_application')
  const [app, setApp]         = useState(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing]   = useState(false)
  const [reason, setReason]   = useState('')
  const [showReject, setShowReject]         = useState(false)
  const [showCancel, setShowCancel]         = useState(false)
  const [showCorrection, setShowCorrection] = useState(false)
  const [showConfirm, setShowConfirm]       = useState(false)
  const [correctionNote, setCorrectionNote] = useState('')
  const [feeTotal,  setFeeTotal]   = useState('')
  const [feePayNow, setFeePayNow]  = useState('')
  const [feeError,  setFeeError]   = useState('')
  const [error, setError]     = useState('')

  function fetchApp() {
    api.get(`college-admin/${collegeId}/applications/${appId}`)
      .then(r => setApp(r.data.data))
      .catch(() => setError('Failed to load application.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchApp() }, [appId, collegeId])

  async function doAction(endpoint, body = {}) {
    setActing(true)
    setError('')
    try {
      await api.post(`college-admin/${collegeId}/applications/${appId}/${endpoint}`, body)
      navigate('/college/dashboard?section=inbox')
    } catch (err) {
      setError(err?.response?.data?.message || 'Action failed.')
    } finally {
      setActing(false)
    }
  }

  async function doConfirm() {
    setFeeError('')
    const total  = parseFloat(feeTotal)
    const payNow = parseFloat(feePayNow)
    if (!total  || total  <= 0) { setFeeError('Enter the total payable amount.'); return }
    if (!payNow || payNow <= 0) { setFeeError('Enter the amount to pay now.'); return }
    if (payNow > total + 0.01)  { setFeeError('Amount to pay now cannot exceed the total.'); return }
    setActing(true)
    setError('')
    try {
      await api.post(`college-admin/${collegeId}/applications/${appId}/confirm`, {
        fee_total_amount:   total,
        fee_pay_now_amount: payNow,
        document_ids_verified: app?.documents?.map(d => d.id) || [],
      })
      navigate('/college/dashboard?section=inbox')
    } catch (err) {
      setError(err?.response?.data?.message || 'Action failed.')
      setActing(false)
    }
  }

  if (loading) return <p className="text-slate-500 p-6">Loading…</p>
  if (!app)    return <p className="text-red-500 p-6">{error || 'Application not found.'}</p>

  const flowInfo = STATUS_FLOW[app.status] || { label: app.status }
  const docIds   = app.documents?.map(d => d.id) || []
  const d        = app   // alias for brevity

  return (
    <section className="space-y-5 max-w-3xl">
      <button
        onClick={() => navigate('/college/dashboard?section=inbox')}
        className="text-sm text-blue-600 hover:underline"
      >
        ← Back to inbox
      </button>

      {/* Header */}
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Application Review</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">
          {[d.app_surname, d.app_first_name, d.app_middle_name].filter(Boolean).join(' ') || d.full_name}
        </h1>
        <p className="mt-1 text-slate-500">
          {d.course_name} — {YEAR_LABEL[d.year_of_study]} · {d.academic_year}
        </p>
        {d.registration_number && (
          <p className="font-mono text-sm text-slate-400 mt-1">Reg: {d.registration_number}</p>
        )}
      </div>

      {/* Status bar */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-5 py-3 flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-slate-700">{flowInfo.label}</p>
        <div className="flex items-center gap-3">
          {canEditApp && ['submitted', 'under_review', 'correction_requested', 'correction_done'].includes(d.status) && (
            <button
              onClick={() => navigate(`/college/apply/${appId}`)}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition"
            >
              Edit Application
            </button>
          )}
          <StatusBadge status={d.status} />
        </div>
      </div>

      {/* ── Activity Timeline ── */}
      <ActivityTimeline app={d} />

      {/* ── Application Context ── */}
      <Section title="Application Context">
        <Row label="College"       value={d.college_name} />
        <Row label="Course"        value={d.course_name} />
        <Row label="Year"          value={YEAR_LABEL[d.year_of_study]} />
        <Row label="Academic Year" value={d.academic_year} />
        <Row label="Fees Category" value={d.fees_category} />
      </Section>

      {/* ── Personal Details ── */}
      <Section title="Personal Details">
        <Row label="Full Name"     value={[d.app_surname, d.app_first_name, d.app_middle_name].filter(Boolean).join(' ')} />
        <Row label="Mother's Name" value={d.app_mother_name} />
        <Row label="Gender"        value={d.app_sex} />
        <Row label="Mobile"        value={d.app_mobile} />
        <Row label="Email"         value={d.app_email} />
        <Row label="Category"      value={d.app_category} />
        <Row
          label="Address"
          value={[d.app_address, d.app_taluka, d.app_district, d.app_state].filter(Boolean).join(', ')}
          wide
        />
      </Section>

      {/* ── Other Details ── */}
      <Section title="Other Details">
        <Row label="Date of Birth"       value={fmtDate(d.app_birth_date)} />
        <Row label="Birth Place"         value={[d.app_birth_place, d.app_birth_state].filter(Boolean).join(', ')} />
        <Row label="Nationality"         value={d.app_nationality} />
        <Row label="Marital Status"      value={d.app_marital_status} />
        <Row label="Religion"            value={d.app_religion} />
        <Row label="Caste"               value={d.app_caste} />
        <Row label="Mother Tongue"       value={d.app_mother_tongue} />
        <Row label="Blood Group"         value={d.app_blood_group} />
        {d.app_height_cm  && <Row label="Height (cm)" value={d.app_height_cm} />}
        {d.app_weight_kg  && <Row label="Weight (kg)" value={d.app_weight_kg} />}
        <Row label="Aadhaar"             value={maskAadhaar(d.app_aadhaar)} />
        <Row label="ABC ID"              value={d.app_abc_id} />
        {d.app_prn        && <Row label="PRN"          value={d.app_prn} />}
        <Row label="Father's Name"       value={d.app_father_full_name} />
        <Row label="Father's Occupation" value={d.app_father_occupation} />
        <Row label="Annual Income"       value={d.app_annual_income ? `₹${Number(d.app_annual_income).toLocaleString('en-IN')}` : '—'} />
        {d.app_bank_account && (
          <>
            <Row label="Bank Account" value={`****${d.app_bank_account.slice(-4)}`} />
            <Row label="Bank IFSC"    value={d.app_bank_ifsc} />
            <Row label="Bank Name"    value={d.app_bank_name} />
            <Row label="Bank Branch"  value={d.app_bank_branch} />
          </>
        )}
      </Section>

      {/* ── Previous Exam Details ── */}
      <Section title="Previous Exam Details">
        {d.exam ? (
          <>
            <Row label="Board / College"  value={d.exam.board_or_college_name} />
            <Row label="Year of Passing"  value={d.exam.year_of_passing} />
            <Row label="Seat / PRN"       value={d.exam.seat_number || d.exam.prn_or_seat} />
            <Row
              label="Total Marks"
              value={d.exam.total_marks_obtained && d.exam.total_marks_max
                ? `${d.exam.total_marks_obtained} / ${d.exam.total_marks_max}`
                : '—'}
            />
            {d.exam.result && <Row label="Result" value={d.exam.result.toUpperCase()} />}
            {d.exam.subjects?.filter(s => s.subject_name).length > 0 && (
              <div className="col-span-2 mt-1">
                <p className="text-xs text-slate-400 mb-1">Subjects</p>
                <div className="space-y-0.5">
                  {d.exam.subjects.filter(s => s.subject_name).map((s, i) => (
                    <p key={i} className="text-sm text-slate-700">
                      {s.subject_name}: {s.marks_obtained} / {s.marks_max}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-500 col-span-2">No exam details filled.</p>
        )}
      </Section>

      {/* ── Documents ── */}
      <Section title="Documents Uploaded">
        {app.documents?.length === 0 && (
          <p className="text-sm text-slate-500 col-span-2">No documents uploaded yet.</p>
        )}
        {app.documents?.map(doc => {
          const isImage = doc.file_name?.match(/\.(jpg|jpeg|png|webp)$/i)
          const fileUrl = `${API_BASE}${doc.file_path}`
          return (
            <div key={doc.id} className="col-span-2 flex items-center gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm">
              {/* Thumbnail */}
              {isImage ? (
                <a href={fileUrl} target="_blank" rel="noreferrer" className="shrink-0">
                  <img src={fileUrl} alt={doc.document_name} className="h-12 w-9 object-cover rounded border border-slate-200 hover:opacity-80 transition" />
                </a>
              ) : (
                <a href={fileUrl} target="_blank" rel="noreferrer" className="shrink-0 flex h-12 w-9 items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-100 transition">
                  <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z"/>
                  </svg>
                </a>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800">{doc.document_name}</p>
                <p className="text-xs text-slate-400 truncate">{doc.file_name}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  View
                </a>
                {doc.is_verified
                  ? <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">Verified</span>
                  : <span className="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">Pending</span>
                }
              </div>
            </div>
          )
        })}
      </Section>

      {error && (
        <p className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {/* ── Fee Amounts (shown after confirmation — editable until student pays) ── */}
      {['confirmed', 'fees_paid'].includes(d.status) && canFees && (
        <FeeAmountPanel
          collegeId={collegeId}
          appId={appId}
          initialTotal={d.fee_total_amount}
          initialPayNow={d.fee_pay_now_amount}
          readonly={d.status === 'fees_paid'}
          onSaved={fetchApp}
        />
      )}

      {/* ── Actions ── */}

      {/* Correction note — only shown while correction is still pending */}
      {d.status === 'correction_requested' && d.correction_note && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 space-y-1">
          <p className="text-xs font-bold uppercase tracking-wide text-orange-700">Correction Note sent to student</p>
          <p className="text-sm text-orange-900">{d.correction_note}</p>
        </div>
      )}

      {/* Step 1: Review — Accept, Request Correction, or Reject */}
      {canReview && ['submitted', 'under_review', 'correction_requested', 'correction_done'].includes(d.status) && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Review the application and either accept it (student will be notified to visit the college), request corrections, or reject.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button loading={acting} onClick={() => doAction('approve')}>
              Accept Application
            </Button>
            <Button variant="secondary" onClick={() => { setShowCorrection(v => !v); setShowReject(false) }}>
              Request Correction
            </Button>
            <Button variant="secondary" onClick={() => { setShowReject(v => !v); setShowCorrection(false) }}>
              Reject
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Student visited — verify docs, set fees, confirm */}
      {canReview && d.status === 'doc_verified' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Student has been notified to visit the college. Once the student visits and documents are verified in person, set the fee and confirm admission.
          </p>
          {!showConfirm ? (
            <div className="flex flex-wrap gap-3">
              <Button loading={acting} onClick={() => { setShowConfirm(true); setFeeError('') }}>
                Student Visited — Set Fee &amp; Confirm
              </Button>
              <Button variant="secondary" onClick={() => setShowCancel(v => !v)}>Cancel</Button>
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-4">
              <p className="text-sm font-semibold text-emerald-800">Verify Documents &amp; Set Fee Amounts</p>
              <p className="text-xs text-emerald-700">Enter the fee details to confirm admission. The student will be notified to pay.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Total Payable Amount <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center rounded-lg border border-slate-300 overflow-hidden bg-white focus-within:ring-2 focus-within:ring-emerald-500">
                    <span className="px-3 py-2 bg-slate-50 border-r border-slate-200 text-slate-500 text-sm font-semibold">₹</span>
                    <input
                      type="text" inputMode="numeric"
                      value={feeTotal}
                      onChange={e => { setFeeTotal(e.target.value.replace(/[^0-9.]/g, '')); setFeeError('') }}
                      placeholder="e.g. 14000"
                      className="flex-1 px-3 py-2 text-sm outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount to Pay Now <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center rounded-lg border border-slate-300 overflow-hidden bg-white focus-within:ring-2 focus-within:ring-emerald-500">
                    <span className="px-3 py-2 bg-slate-50 border-r border-slate-200 text-slate-500 text-sm font-semibold">₹</span>
                    <input
                      type="text" inputMode="numeric"
                      value={feePayNow}
                      onChange={e => { setFeePayNow(e.target.value.replace(/[^0-9.]/g, '')); setFeeError('') }}
                      placeholder="e.g. 14000"
                      className="flex-1 px-3 py-2 text-sm outline-none"
                    />
                  </div>
                  {parseFloat(feeTotal) > 0 && (
                    <button type="button" onClick={() => { setFeePayNow(feeTotal); setFeeError('') }}
                      className="mt-1 text-xs text-emerald-600 hover:underline font-semibold">
                      Same as total
                    </button>
                  )}
                </div>
              </div>
              {feeError && <p className="text-sm text-red-600">{feeError}</p>}
              <div className="flex gap-3">
                <Button loading={acting} onClick={doConfirm}>Proceed</Button>
                <button type="button" onClick={() => { setShowConfirm(false); setFeeError('') }}
                  className="text-sm text-slate-500 hover:text-slate-700 font-medium">
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {canReview && showCorrection && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-orange-800">Correction note (sent to student)</p>
          <p className="text-xs text-orange-600">Describe clearly what needs to be corrected. The student will see this and can edit and resubmit their application.</p>
          <textarea
            rows={4}
            value={correctionNote}
            onChange={e => setCorrectionNote(e.target.value)}
            placeholder="e.g. Please correct your Aadhaar number — the one entered appears to be invalid. Also update your father's occupation field."
            className="w-full rounded-md border border-orange-200 bg-white px-3 py-2 text-sm"
          />
          <Button loading={acting} disabled={!correctionNote.trim()} onClick={() => doAction('request-correction', { note: correctionNote })}>
            Send Correction Request
          </Button>
        </div>
      )}

      {canReview && showReject && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-red-800">Rejection reason (shown to student)</p>
          <textarea
            rows={3}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Enter reason for rejection…"
            className="w-full rounded-md border border-red-200 px-3 py-2 text-sm"
          />
          <Button loading={acting} onClick={() => doAction('reject', { reason })}>
            Confirm Rejection
          </Button>
        </div>
      )}

      {canReview && showCancel && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-orange-800">Cancellation reason</p>
          <textarea
            rows={3}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Enter reason…"
            className="w-full rounded-md border border-orange-200 px-3 py-2 text-sm"
          />
          <Button loading={acting} onClick={() => doAction('cancel', { reason })}>
            Confirm Cancellation
          </Button>
        </div>
      )}
    </section>
  )
}

const ACTION_META = {
  submitted:              { label: 'Application Submitted',           color: 'bg-blue-500',    actor: 'Student' },
  correction_requested:   { label: 'Correction Requested',            color: 'bg-orange-500',  actor: 'College' },
  correction_resubmitted: { label: 'Correction Resubmitted',          color: 'bg-sky-500',     actor: 'Student' },
  accepted:               { label: 'Application Accepted',            color: 'bg-teal-500',    actor: 'College' },
  rejected:               { label: 'Application Rejected',            color: 'bg-red-500',     actor: 'College' },
  confirmed:              { label: 'Documents Verified — Fees Set',   color: 'bg-amber-500',   actor: 'College' },
  fee_instalment_paid:    { label: 'Fee Instalment Paid',             color: 'bg-emerald-400', actor: 'Student' },
  fees_paid:              { label: 'College Fee Fully Paid',          color: 'bg-emerald-600', actor: 'Student' },
  roll_assigned:          { label: 'Roll Number Assigned',            color: 'bg-violet-500',  actor: 'College' },
  enrolled:               { label: 'Enrolled',                        color: 'bg-green-600',   actor: 'Student' },
  cancelled:              { label: 'Application Cancelled',           color: 'bg-slate-500',   actor: 'College' },
}

function ActivityTimeline({ app }) {
  const [open, setOpen] = useState(false)
  const activity = app.activity || []

  const entries = activity.map(a => {
    const meta = ACTION_META[a.action] || { label: a.action, color: 'bg-slate-400', actor: a.actor_role }
    return { label: meta.label, color: meta.color, actor: meta.actor, date: a.created_at, note: a.note }
  })

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition"
      >
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Activity Timeline</p>
          <span className="text-xs text-slate-400">({activity.length} event{activity.length !== 1 ? 's' : ''})</span>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-5 py-4">
          {entries.length === 0 ? (
            <p className="text-xs text-slate-400">No activity recorded yet.</p>
          ) : (
            <ol className="relative border-l-2 border-slate-100 space-y-5 ml-1.5">
              {entries.map((e, i) => (
                <li key={i} className="ml-5">
                  <span className={`absolute -left-[9px] flex h-4 w-4 rounded-full ring-2 ring-white ${e.color}`} />
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="text-sm font-semibold text-slate-800">{e.label}</p>
                    <span className="text-xs text-slate-400">by {e.actor}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {e.date
                      ? new Date(e.date.endsWith('Z') ? e.date : e.date + 'Z').toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </p>
                  {e.note && (
                    <p className="mt-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-3 py-2 whitespace-pre-wrap">{e.note}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
      </div>
      <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        {children}
      </div>
    </div>
  )
}

function Row({ label, value, wide }) {
  return (
    <div className={`flex gap-2 text-sm min-w-0 ${wide ? 'col-span-2' : ''}`}>
      <span className="shrink-0 text-slate-400 w-36">{label}:</span>
      <span className="text-slate-800 font-medium break-words min-w-0">{value || '—'}</span>
    </div>
  )
}

function StatusBadge({ status }) {
  const colors = {
    submitted:            'bg-blue-100 text-blue-700',
    under_review:         'bg-blue-100 text-blue-700',
    correction_requested: 'bg-orange-100 text-orange-700',
    correction_done:      'bg-sky-100 text-sky-700',
    doc_verified:         'bg-teal-100 text-teal-700',
    confirmed:            'bg-amber-100 text-amber-700',
    fees_paid:            'bg-emerald-100 text-emerald-700',
    roll_assigned:        'bg-violet-100 text-violet-700',
    enrolled:             'bg-green-100 text-green-800',
    rejected:             'bg-red-100 text-red-700',
    cancelled:            'bg-slate-100 text-slate-500',
  }
  const labels = {
    submitted:            'Review Pending',
    under_review:         'Review Pending',
    correction_requested: 'Correction Pending',
    correction_done:      'Correction Review',
    doc_verified:         'Student Awaited',
    confirmed:            'Fees Pending',
    fees_paid:            'Confirmed',
    roll_assigned:        'Roll Assigned',
    enrolled:             'Enrolled',
    rejected:             'Rejected',
    cancelled:            'Cancelled',
  }
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${colors[status] || 'bg-slate-100 text-slate-600'}`}>
      {labels[status] || status}
    </span>
  )
}

function FeeAmountPanel({ collegeId, appId, initialTotal, initialPayNow, readonly, onSaved }) {
  // Lock editing once fees have already been set (initialTotal present) or status is fees_paid
  const locked = readonly || (initialTotal && parseFloat(initialTotal) > 0)
  const [total,  setTotal]   = useState(initialTotal  ? String(initialTotal)  : '')
  const [payNow, setPayNow]  = useState(initialPayNow ? String(initialPayNow) : '')
  const [saving, setSaving]  = useState(false)
  const [error,  setError]   = useState('')
  const [success, setSuccess] = useState('')

  const totalNum  = parseFloat(total)  || 0
  const payNowNum = parseFloat(payNow) || 0
  const isPartial = totalNum > 0 && payNowNum > 0 && payNowNum < totalNum - 0.01

  async function handleSave() {
    setError(''); setSuccess('')
    if (!totalNum || totalNum <= 0) { setError('Enter the total payable amount.'); return }
    if (!payNowNum || payNowNum <= 0) { setError('Enter the amount to pay now.'); return }
    if (payNowNum > totalNum + 0.01) { setError('Amount to pay now cannot exceed the total.'); return }
    setSaving(true)
    try {
      await api.post(`college-admin/${collegeId}/applications/${appId}/set-fee`, {
        fee_total_amount: totalNum,
        fee_pay_now_amount: payNowNum,
      })
      setSuccess('Fee amounts saved. Student will see these amounts when paying.')
      onSaved?.()
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save.')
    } finally { setSaving(false) }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Fee Details</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {locked
            ? 'Fee amounts are locked after being set.'
            : 'Enter the total fee and how much the student must pay now. Student will see both amounts.'}
        </p>
      </div>
      <div className="px-4 py-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Total Payable Amount {!locked && <span className="text-red-500">*</span>}
            </label>
            <div className="flex items-center rounded-lg border border-slate-300 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500">
              <span className="px-3 py-2 bg-slate-50 border-r border-slate-200 text-slate-500 text-sm font-semibold">₹</span>
              <input
                type="text" inputMode="numeric"
                value={total}
                onChange={e => { setTotal(e.target.value.replace(/[^0-9.]/g, '')); setError(''); setSuccess('') }}
                disabled={locked}
                placeholder="e.g. 14000"
                className="flex-1 px-3 py-2 text-sm outline-none bg-transparent disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>
            <p className="mt-1 text-xs text-slate-400">Full fee the student owes</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Amount to Pay Now {!locked && <span className="text-red-500">*</span>}
            </label>
            <div className="flex items-center rounded-lg border border-slate-300 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500">
              <span className="px-3 py-2 bg-slate-50 border-r border-slate-200 text-slate-500 text-sm font-semibold">₹</span>
              <input
                type="text" inputMode="numeric"
                value={payNow}
                onChange={e => { setPayNow(e.target.value.replace(/[^0-9.]/g, '')); setError(''); setSuccess('') }}
                disabled={locked}
                placeholder="e.g. 14000"
                className="flex-1 px-3 py-2 text-sm outline-none bg-transparent disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {!locked && totalNum > 0 && (
                <button
                  type="button"
                  onClick={() => { setPayNow(total); setError(''); setSuccess('') }}
                  className="text-emerald-600 hover:underline font-semibold"
                >
                  Same as total
                </button>
              )}
              {!locked && totalNum > 0 && ' · '}
              Can be less if college allows partial payment
            </p>
          </div>
        </div>

        {isPartial && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            Student pays <strong>₹{payNowNum.toLocaleString('en-IN')}</strong> now.
            Remaining <strong>₹{(totalNum - payNowNum).toLocaleString('en-IN')}</strong> can be paid later.
          </div>
        )}
        {totalNum > 0 && payNowNum > 0 && !isPartial && payNowNum <= totalNum + 0.01 && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800">
            Student pays the full fee of <strong>₹{totalNum.toLocaleString('en-IN')}</strong> at once.
          </div>
        )}

        {error   && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-emerald-600">{success}</p>}

        {!locked && (
          <Button onClick={handleSave} loading={saving}>Save Fee Amounts</Button>
        )}
      </div>
    </div>
  )
}

function fmtDate(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-IN') } catch { return d }
}

function maskAadhaar(a) {
  if (!a || a.length < 4) return a || '—'
  return `XXXX XXXX ${a.slice(-4)}`
}
