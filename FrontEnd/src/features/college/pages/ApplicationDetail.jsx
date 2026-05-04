import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../services/api.js'
import Button from '../../../shared/components/Button.jsx'
import { usePermissions } from '../hooks/usePermissions.js'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/').replace(/\/$/, '')

const YEAR_LABEL = { 1: 'FY — First Year', 2: 'SY — Second Year', 3: 'TY — Third Year' }

const STATUS_FLOW = {
  submitted:                { label: 'Submitted — awaiting scrutiny' },
  under_review:             { label: 'Under Review' },
  correction_requested:     { label: 'Correction Pending — waiting for student to resubmit' },
  correction_done:          { label: 'Correction Done — student has resubmitted' },
  scrutiny_accepted:        { label: 'Scrutiny Accepted — awaiting doc verification call' },
  doc_verification_pending: { label: 'Called for Physical Document Verification' },
  confirmed:                { label: 'Confirmed — waiting for fee payment' },
  fees_paid:                { label: 'Fees paid — ready for roll number' },
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
  const [app, setApp]         = useState(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing]   = useState(false)
  const [reason, setReason]   = useState('')
  const [showReject, setShowReject]         = useState(false)
  const [showCancel, setShowCancel]         = useState(false)
  const [showCorrection, setShowCorrection] = useState(false)
  const [correctionNote, setCorrectionNote] = useState('')
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
      fetchApp()
      setShowReject(false)
      setShowCancel(false)
      setShowCorrection(false)
      setReason('')
      setCorrectionNote('')
    } catch (err) {
      setError(err?.response?.data?.message || 'Action failed.')
    } finally {
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
        <StatusBadge status={d.status} />
      </div>

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

      {/* ── Fee Installment Plan (shown once confirmed) ── */}
      {['confirmed','fees_paid'].includes(d.status) && (
        <FeeInstallmentPanel
          collegeId={collegeId}
          appId={appId}
          admissionPeriodId={d.admission_period_id}
          readonly={d.status === 'fees_paid' || !canFees}
        />
      )}

      {/* ── Actions ── */}

      {/* Correction note — shown when correction was requested */}
      {d.correction_note && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 space-y-1">
          <p className="text-xs font-bold uppercase tracking-wide text-orange-700">Correction Note sent to student</p>
          <p className="text-sm text-orange-900">{d.correction_note}</p>
        </div>
      )}

      {/* Step 1: Scrutiny — accept, request correction, or reject */}
      {canReview && ['submitted', 'under_review', 'correction_requested', 'correction_done'].includes(d.status) && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Review the application form and accept, request corrections, or reject.</p>
          <div className="flex flex-wrap gap-3">
            <Button loading={acting} onClick={() => doAction('approve')}>
              Accept (Scrutiny Passed)
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

      {/* Step 2: Call student for physical doc verification */}
      {canReviewD && d.status === 'scrutiny_accepted' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Select this student for physical document verification. The student will be notified to visit the college with original documents.
            You can call the student multiple times if needed.
          </p>
          <div className="flex gap-3">
            <Button loading={acting} onClick={() => doAction('call-for-doc-verification')}>
              Call for Doc Verification
            </Button>
            {canReview && (
              <Button variant="secondary" onClick={() => setShowCancel(v => !v)}>Cancel</Button>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Student visited — confirm after physical doc check */}
      {canReview && d.status === 'doc_verification_pending' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Student has been called for physical document verification. Once all original documents are verified in person, confirm the admission.
            If the student did not arrive, you can call again.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button loading={acting} onClick={() => doAction('confirm', { document_ids_verified: docIds })}>
              Confirm Admission (Docs Verified)
            </Button>
            <Button variant="secondary" loading={acting} onClick={() => doAction('call-for-doc-verification')}>
              Call Again
            </Button>
            <Button variant="secondary" onClick={() => setShowCancel(v => !v)}>Cancel</Button>
          </div>
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
    submitted:                'bg-blue-100 text-blue-700',
    under_review:             'bg-blue-100 text-blue-700',
    correction_requested:     'bg-orange-100 text-orange-700',
    correction_done:          'bg-sky-100 text-sky-700',
    scrutiny_accepted:        'bg-teal-100 text-teal-700',
    doc_verification_pending: 'bg-orange-100 text-orange-700',
    confirmed:                'bg-emerald-100 text-emerald-700',
    fees_paid:                'bg-emerald-100 text-emerald-700',
    roll_assigned:            'bg-violet-100 text-violet-700',
    enrolled:                 'bg-green-100 text-green-800',
    rejected:                 'bg-red-100 text-red-700',
    cancelled:                'bg-slate-100 text-slate-500',
  }
  const labels = {
    submitted: 'Submitted', under_review: 'Under Review',
    correction_requested: 'Correction Pending',
    correction_done:      'Correction Done',
    scrutiny_accepted: 'Scrutiny Accepted',
    doc_verification_pending: 'Doc Verification Pending',
    confirmed: 'Confirmed', fees_paid: 'Fees Paid',
    roll_assigned: 'Roll Assigned', enrolled: 'Enrolled',
    rejected: 'Rejected', cancelled: 'Cancelled',
  }
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${colors[status] || 'bg-slate-100 text-slate-600'}`}>
      {labels[status] || status}
    </span>
  )
}

function FeeInstallmentPanel({ collegeId, appId, admissionPeriodId, readonly }) {
  const [rows, setRows]       = useState([])
  const [totalFee, setTotalFee] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!admissionPeriodId) { setLoading(false); return }
    Promise.all([
      api.get(`college-admin/${collegeId}/admission-periods/${admissionPeriodId}/installments`),
      api.get(`payments/college-fee-status/${appId}`),
    ])
      .then(([insRes, feeRes]) => {
        const data = insRes.data.data || []
        setRows(data.length > 0 ? data : [{ label: 'First Installment', amount: '', due_date: '' }])
        const fee = feeRes.data.data
        setTotalFee(fee?.student_payable ?? fee?.total_fee ?? 0)
      })
      .catch(() => setRows([{ label: 'First Installment', amount: '', due_date: '' }]))
      .finally(() => setLoading(false))
  }, [admissionPeriodId, collegeId, appId])

  function addRow() {
    const labels = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth']
    setRows(r => [...r, { label: `${labels[r.length] || (r.length + 1) + 'th'} Installment`, amount: '', due_date: '' }])
  }

  function removeRow(i) { setRows(r => r.filter((_, idx) => idx !== i)) }

  function updateRow(i, field, value) {
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: value } : row))
  }

  const enteredTotal = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  const remainder    = totalFee > 0 ? Math.round((totalFee - enteredTotal) * 100) / 100 : 0
  const hasGap       = remainder > 0.01

  async function handleSave() {
    setError(''); setSuccess('')
    for (const row of rows) {
      if (!row.label.trim() || !row.amount || parseFloat(row.amount) <= 0) {
        setError('Each installment needs a label and a positive amount.')
        return
      }
    }
    if (enteredTotal > totalFee + 0.01 && totalFee > 0) {
      setError(`Total installments (₹${enteredTotal.toLocaleString('en-IN')}) exceed the total fee (₹${totalFee.toLocaleString('en-IN')}).`)
      return
    }

    // Auto-append remainder as final installment if there's a gap
    const finalRows = [...rows.map(r => ({ label: r.label.trim(), amount: parseFloat(r.amount), due_date: r.due_date || null }))]
    if (hasGap) {
      const labels = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth']
      finalRows.push({ label: `${labels[finalRows.length] || 'Final'} Installment`, amount: remainder, due_date: null })
    }

    setSaving(true)
    try {
      await api.post(`college-admin/${collegeId}/admission-periods/${admissionPeriodId}/installments`, {
        installments: finalRows,
      })
      // Refresh rows from server so auto-added installment shows up
      const r = await api.get(`college-admin/${collegeId}/admission-periods/${admissionPeriodId}/installments`)
      setRows(r.data.data || finalRows)
      setSuccess(hasGap
        ? `Plan saved. Remaining ₹${remainder.toLocaleString('en-IN')} auto-added as final installment.`
        : 'Installment plan saved.')
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save.')
    } finally { setSaving(false) }
  }

  async function handleClear() {
    if (!confirm('Remove installment plan? Students will pay the full fee in one payment.')) return
    setSaving(true)
    try {
      await api.post(`college-admin/${collegeId}/admission-periods/${admissionPeriodId}/installments`, { installments: [] })
      setRows([{ label: 'First Installment', amount: '', due_date: '' }])
      setSuccess('Installment plan cleared.')
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to clear.')
    } finally { setSaving(false) }
  }

  if (!admissionPeriodId) return null

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Fee Installment Plan</p>
        <p className="text-xs text-slate-400">
          {readonly ? 'Fees fully paid — plan locked.' : 'If no plan is set, student pays the full fee at once.'}
        </p>
      </div>
      <div className="px-4 py-4 space-y-3">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <>
            {totalFee > 0 && (
              <p className="text-xs text-slate-500">
                Total fee: <span className="font-semibold text-slate-700">₹{totalFee.toLocaleString('en-IN')}</span>
              </p>
            )}

            <div className="space-y-2">
              {rows.map((row, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400 w-4">{i + 1}.</span>
                  <input
                    value={row.label}
                    onChange={e => updateRow(i, 'label', e.target.value)}
                    disabled={readonly || row.is_paid}
                    placeholder="Label"
                    className="flex-1 min-w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 text-sm">₹</span>
                    <input
                      type="number" min="1"
                      value={row.amount}
                      onChange={e => updateRow(i, 'amount', e.target.value)}
                      disabled={readonly || row.is_paid}
                      placeholder="Amount"
                      className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </div>
                  <input
                    type="date"
                    value={row.due_date ? row.due_date.slice(0, 10) : ''}
                    onChange={e => updateRow(i, 'due_date', e.target.value)}
                    disabled={readonly || row.is_paid}
                    className="rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50"
                    title="Due date (optional)"
                  />
                  {row.is_paid && (
                    <span className="text-xs font-semibold text-emerald-600">✓ Paid</span>
                  )}
                  {!readonly && !row.is_paid && rows.length > 1 && (
                    <button onClick={() => removeRow(i)} className="text-red-400 hover:text-red-600 text-sm font-bold px-1">✕</button>
                  )}
                </div>
              ))}
            </div>

            {!readonly && (
              <div className="flex items-center gap-3 flex-wrap">
                {rows.length < 6 && (
                  <button onClick={addRow} className="text-sm text-indigo-600 hover:underline font-semibold">
                    + Add installment
                  </button>
                )}
                {enteredTotal > 0 && (
                  <span className="text-xs text-slate-500">Entered: ₹{enteredTotal.toLocaleString('en-IN')}</span>
                )}
                {hasGap && (
                  <span className="text-xs font-semibold text-amber-600">
                    Remaining ₹{remainder.toLocaleString('en-IN')} will be auto-added as final installment
                  </span>
                )}
                {!hasGap && totalFee > 0 && enteredTotal > 0 && (
                  <span className="text-xs font-semibold text-emerald-600">✓ Covers full fee</span>
                )}
              </div>
            )}

            {error   && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-emerald-600">{success}</p>}

            {!readonly && (
              <div className="flex gap-3">
                <Button onClick={handleSave} loading={saving}>Save Plan</Button>
                <Button variant="secondary" onClick={handleClear} disabled={saving}>Clear Plan</Button>
              </div>
            )}
          </>
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
