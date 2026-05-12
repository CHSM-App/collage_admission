import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../../../context/AuthContext.jsx'
import { getCollege, getAdmissionPeriods, getAdmissionPeriodFee } from '../../../services/collegeService.js'
import { createApplication, submitApplication } from '../../../services/applicationService.js'
import Button from '../../../shared/components/Button.jsx'
import { SkeletonForm } from '../../../shared/components/Skeleton.jsx'
import { useToast } from '../../../context/ToastContext.jsx'

const YEAR_LABEL = { 1: 'FY (First Year)', 2: 'SY (Second Year)', 3: 'TY (Third Year)', 4: '4Y (Fourth Year)', 5: '5Y (Fifth Year)' }

export default function ApplyForm({ periodId, collegeId }) {
  const { user } = useAuthContext()
  const navigate = useNavigate()
  const toast    = useToast()

  const [period, setPeriod]   = useState(null)
  const [college, setCollege] = useState(null)
  const [fee, setFee]         = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    Promise.all([
      getCollege(collegeId),
      getAdmissionPeriods(collegeId),
      getAdmissionPeriodFee(collegeId, periodId),
    ])
      .then(([colRes, periodsRes, feeRes]) => {
        setCollege(colRes.data.data)
        const found = (periodsRes.data.data || []).find(p => String(p.id) === String(periodId))
        setPeriod(found || null)
        setFee(feeRes.data.data)
      })
      .catch(() => setError('Failed to load admission details.'))
      .finally(() => setLoading(false))
  }, [collegeId, periodId])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!period) return
    setSubmitting(true)
    setError('')

    try {
      // 1. Create draft application
      const createRes = await createApplication({
        student_id:         user.id,
        college_id:         parseInt(collegeId),
        course_id:          period.course_id,
        year_of_study:      period.year_of_study,
        academic_year:      period.academic_year,
        admission_period_id: period.id,
      })

      const appId = createRes.data.data.id

      // 2. Simulate payment → submit
      const submitRes = await submitApplication(appId)

      toast.success('Application submitted successfully!')
      setSuccess({
        registration_number: submitRes.data.data.registration_number,
        appId,
      })
    } catch (err) {
      const msg = err?.response?.data?.message || 'Submission failed. Please try again.'
      setError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <PageShell>
        <SkeletonForm fields={6} />
      </PageShell>
    )
  }

  if (!period) {
    return (
      <PageShell>
        <p className="text-red-500">Admission period not found or closed.</p>
        <button onClick={() => navigate('/student/dashboard?section=browse')}
          className="mt-4 text-sm text-blue-600 hover:underline">
          ← Back to browse
        </button>
      </PageShell>
    )
  }

  if (success) {
    return (
      <PageShell>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 space-y-3">
          <p className="text-lg font-bold text-emerald-800">Application submitted!</p>
          <p className="text-sm text-emerald-700">
            Registration number: <span className="font-mono font-bold">{success.registration_number}</span>
          </p>
          <p className="text-sm text-slate-600">
            Your application is now under review. The college will contact you for document verification.
          </p>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => navigate('/student/dashboard?section=applications')}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              View my applications
            </button>
            <button
              onClick={() => navigate('/student/dashboard?section=browse')}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Browse more colleges
            </button>
          </div>
        </div>
      </PageShell>
    )
  }

  const totalFee = fee ? (Number(fee.tuition_fee) + Number(fee.exam_fee) + Number(fee.other_fee)) : null

  return (
    <PageShell>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        {/* College & course summary */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Applying to</p>
          <p className="text-lg font-bold text-slate-950">{college?.name}</p>
          <p className="text-slate-600">
            {period.course_name} · {YEAR_LABEL[period.year_of_study]} · {period.academic_year}
          </p>
          <p className="text-sm text-slate-500">
            {period.total_seats - period.filled_seats} seats remaining ·
            Last date: {new Date(period.end_date).toLocaleDateString('en-IN')}
          </p>
        </div>

        {/* Student info (read-only) */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Your details</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Field label="Name"  value={user?.name} />
            <Field label="Email" value={user?.email} />
            <Field label="Phone" value={user?.phone || '—'} />
            <Field label="City"  value={user?.city  || '—'} />
          </div>
          <p className="text-xs text-slate-400">
            To update these details, edit your profile.
          </p>
        </div>

        {/* Fee summary */}
        {fee && (
          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Payment</p>
            <div className="text-sm space-y-1">
              <Row label="Application fee" value={`₹${Number(period.application_fee).toLocaleString('en-IN')}`} />
            </div>
            <div className="border-t border-slate-100 pt-2 space-y-1 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                College fee (payable after confirmation)
              </p>
              <Row label="Tuition fee"    value={`₹${Number(fee.tuition_fee).toLocaleString('en-IN')}`} />
              <Row label="Exam fee"       value={`₹${Number(fee.exam_fee).toLocaleString('en-IN')}`} />
              <Row label="Other charges"  value={`₹${Number(fee.other_fee).toLocaleString('en-IN')}`} />
              <Row label="Total college fee" value={`₹${totalFee.toLocaleString('en-IN')}`} bold />
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        <div className="flex gap-3">
          <Button type="submit" loading={submitting}>
            Submit & Pay ₹{Number(period.application_fee).toLocaleString('en-IN')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/student/dashboard?section=browse')}
          >
            Cancel
          </Button>
        </div>

        <p className="text-xs text-slate-400">
          Payment is simulated — no real gateway integration in this version.
          Your application will move directly to "Submitted" status.
        </p>
      </form>
    </PageShell>
  )
}

function PageShell({ children }) {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">Student portal</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Apply for Admission</h1>
      </div>
      {children}
    </section>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-slate-400">{label}</p>
      <p className="font-medium text-slate-800">{value}</p>
    </div>
  )
}

function Row({ label, value, bold }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-semibold text-slate-950' : 'text-slate-600'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
