import { useState } from 'react'
import api from '../../../../services/api.js'
import { StepHeader } from './Step1Context.jsx'
import Button from '../../../../shared/components/Button.jsx'
import { useRazorpay } from '../../../../shared/hooks/useRazorpay.js'

const YEAR_LABEL = { 1: 'FY — First Year', 2: 'SY — Second Year', 3: 'TY — Third Year', 4: '4Y — Fourth Year', 5: '5Y — Fifth Year' }
const EXAM_ROWS  = {
  1: ['SSC', 'HSC'],
  2: ['SSC', 'HSC', 'FY_SEM1', 'FY_SEM2'],
  3: ['SSC', 'HSC', 'FY_SEM1', 'FY_SEM2', 'SY_SEM1', 'SY_SEM2'],
  4: ['SSC', 'HSC', 'FY_SEM1', 'FY_SEM2', 'SY_SEM1', 'SY_SEM2', 'TY_SEM1', 'TY_SEM2'],
  5: ['SSC', 'HSC', 'FY_SEM1', 'FY_SEM2', 'SY_SEM1', 'SY_SEM2', 'TY_SEM1', 'TY_SEM2', '4Y_SEM1', '4Y_SEM2'],
}

export default function Step6Review({ data, errors, globalError, saving, appId, applicationFeePaid, onBack, onEditStep, onDone }) {
  const [accepted, setAccepted]         = useState(!!data.declaration_accepted)
  const [processing, setProcessing]     = useState(false)
  const [submitError, setSubmitError]   = useState('')
  const [registrationNumber, setRegNum] = useState(null)
  const [resubmitted, setResubmitted]   = useState(false)

  const { openCheckout, scriptError } = useRazorpay()

  // ── Resubmit (correction flow — fee already paid) ────────
  async function handleResubmit() {
    if (!accepted) return
    setProcessing(true)
    setSubmitError('')
    try {
      await api.post(`api/applications/${appId}/declaration`, { accepted: true })
      await api.post(`api/applications/${appId}/resubmit`)
      setResubmitted(true)
    } catch (err) {
      setSubmitError(err?.response?.data?.message || 'Resubmit failed. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  // ── New application submit (pay first) ───────────────────
  async function handleSubmit() {
    if (!accepted) return
    setProcessing(true)
    setSubmitError('')

    try {
      // 1. Accept declaration (validates mandatory docs)
      await api.post(`api/applications/${appId}/declaration`, { accepted: true })

      // 2. Create Razorpay order
      const orderRes = await api.post('payments/create-order', {
        application_id: appId,
        payment_type:   'application_fee',
      })
      const orderData = orderRes.data.data

      setProcessing(false)   // stop spinner while Razorpay modal is open

      // 3. Open Razorpay checkout
      openCheckout({
        orderData,
        onSuccess: async (rzpResponse) => {
          setProcessing(true)
          try {
            // 4. Verify signature + submit application on backend
            const verifyRes = await api.post('payments/verify', {
              application_id:       appId,
              payment_type:         'application_fee',
              razorpay_order_id:    rzpResponse.razorpay_order_id,
              razorpay_payment_id:  rzpResponse.razorpay_payment_id,
              razorpay_signature:   rzpResponse.razorpay_signature,
            })
            setRegNum(verifyRes.data.data?.registration_number || '')
          } catch (err) {
            setSubmitError(err?.response?.data?.message || 'Payment verification failed.')
          } finally {
            setProcessing(false)
          }
        },
        onFailure: (err) => {
          if (err.message !== 'Payment cancelled by user.') {
            setSubmitError(err.message || 'Payment failed.')
          }
        },
      })
    } catch (err) {
      const resp = err?.response?.data
      setSubmitError(resp?.message || 'Submission failed. Please try again.')
      setProcessing(false)
    }
  }

  // ── Resubmit success screen ───────────────────────────────
  if (resubmitted) {
    return (
      <div className="px-5 py-10 text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-950">Application Updated!</h2>
        <p className="text-slate-500 max-w-sm mx-auto text-sm">
          Your application has been updated and submitted. The college will review it.
        </p>
        <Button onClick={onDone} className="mx-auto">Go to My Applications →</Button>
      </div>
    )
  }

  // ── Original submit success screen ────────────────────────
  if (registrationNumber !== null) {
    return (
      <div className="px-5 py-10 text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-950">Application Submitted!</h2>
        {registrationNumber && (
          <p className="text-slate-600">
            Registration number:{' '}
            <span className="font-mono font-bold text-slate-950">{registrationNumber}</span>
          </p>
        )}
        <p className="text-slate-500 max-w-sm mx-auto text-sm">
          Application fee paid. Your application is now under review.
          The college will contact you for document verification.
        </p>
        <Button onClick={onDone} className="mx-auto">Go to My Applications →</Button>
      </div>
    )
  }

  return (
    <div>
      <StepHeader
        step={6}
        title="Review & Declaration"
        desc="Review all your details. Click 'Edit' on any section to go back and make changes."
      />

      <div className="px-4 sm:px-5 py-5 space-y-5">

        <ReviewSection title="Application Context" onEdit={() => onEditStep(1)}>
          <Row label="College"       value={data.college_name} />
          <Row label="Course"        value={data.course_name} />
          <Row label="Year"          value={YEAR_LABEL[data.year_of_study]} />
          <Row label="Academic Year" value={data.academic_year} />
        </ReviewSection>

        <ReviewSection title="Personal Details" onEdit={() => onEditStep(2)}>
          <Row label="Full Name"     value={[data.surname, data.first_name, data.middle_name].filter(Boolean).join(' ')} />
          <Row label="Mother's First Name" value={data.mother_name} />
          <Row label="Gender"         value={data.sex} />
          <Row label="Mobile"        value={data.mobile} />
          <Row label="Email"         value={data.email} />
          <Row label="Address"       value={[data.address, data.taluka, data.district, data.state].filter(Boolean).join(', ')} />
          <Row label="Category"      value={data.category || '—'} />
          <Row label="Fees Category" value={data.fees_category} />
        </ReviewSection>

        <ReviewSection title="Other Details" onEdit={() => onEditStep(3)}>
          <Row label="Date of Birth"       value={fmtDate(data.birth_date)} />
          <Row label="Birth Place"         value={[data.birth_place, data.birth_state].filter(Boolean).join(', ')} />
          <Row label="Nationality"         value={data.nationality} />
          <Row label="Marital Status"      value={data.marital_status} />
          <Row label="Aadhaar"             value={maskAadhaar(data.aadhaar)} />
          <Row label="ABC ID"              value={data.abc_id} />
          {data.prn && <Row label="PRN"    value={data.prn} />}
          <Row label="Father's Name"       value={data.father_full_name} />
          <Row label="Father's Occupation" value={data.father_occupation} />
          <Row label="Annual Income"       value={data.annual_income ? `₹${Number(data.annual_income).toLocaleString('en-IN')}` : '—'} />
          {data.bank_account && <Row label="Bank Account" value={`****${data.bank_account.slice(-4)}`} />}
        </ReviewSection>

        <ReviewSection title="Previous Exam Details" onEdit={() => onEditStep(4)}>
          {Object.keys(data.exams || {}).length === 0 ? (
            <p className="col-span-2 text-sm text-slate-400">No exam details filled.</p>
          ) : (
            <div className="col-span-2 overflow-x-auto">
              <div className="rounded-lg border-2 border-slate-400 overflow-hidden">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-slate-100 border-b-2 border-slate-400">
                  <tr>
                    {['Exam','Institute','Board/Univ.','Month & Year','Seat No.','Marks','Out of','%','Class/Grade','Remark'].map(h => (
                      <th key={h} className="border border-slate-200 px-2 py-1 text-left text-xs font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(EXAM_ROWS[data.year_of_study] || EXAM_ROWS[1]).filter(type => data.exams[type]).map(type => { const row = data.exams[type]; return (
                    <tr key={type} className="even:bg-slate-50 hover:bg-blue-50 transition">
                      <td className="border border-slate-200 px-2 py-1 font-semibold text-slate-700 whitespace-nowrap">
                        {{'SSC':'SSC','HSC':'HSC','FY_SEM1':'F.Y. Sem I','FY_SEM2':'F.Y. Sem II','SY_SEM1':'S.Y. Sem I','SY_SEM2':'S.Y. Sem II','TY_SEM1':'T.Y. Sem I','TY_SEM2':'T.Y. Sem II','4Y_SEM1':'4Y Sem I','4Y_SEM2':'4Y Sem II'}[type] || type}
                      </td>
                      <td className="border border-slate-200 px-2 py-1">{row.institute || '—'}</td>
                      <td className="border border-slate-200 px-2 py-1">{row.board || '—'}</td>
                      <td className="border border-slate-200 px-2 py-1 whitespace-nowrap">{row.month_year || '—'}</td>
                      <td className="border border-slate-200 px-2 py-1">{row.seat_no || '—'}</td>
                      <td className="border border-slate-200 px-2 py-1">{row.marks_obtained || '—'}</td>
                      <td className="border border-slate-200 px-2 py-1">{row.marks_max || '—'}</td>
                      <td className="border border-slate-200 px-2 py-1">{row.percentage ? `${row.percentage}%` : '—'}</td>
                      <td className="border border-slate-200 px-2 py-1">{row.class_grade || '—'}</td>
                      <td className="border border-slate-200 px-2 py-1">{row.remark || '—'}</td>
                    </tr>
                  )})}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </ReviewSection>

        <ReviewSection title="Documents" onEdit={() => onEditStep(5)}>
          {(data.linked_documents || []).length === 0
            ? <p className="text-sm text-slate-500 col-span-2">No documents linked.</p>
            : (data.linked_documents || []).map(d => (
                <Row key={d.document_type_id} label={d.document_name} value={`📄 ${d.file_name}`} />
              ))
          }
        </ReviewSection>

        {/* Declaration */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Declaration</p>
          <p className="text-sm text-slate-700 leading-relaxed">
            I declare that the information provided is true to the best of my knowledge. I understand
            that any false information may lead to cancellation of admission. I have read and accept
            the college's rules and the application fee non-refundability policy.
          </p>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={e => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded accent-slate-950 cursor-pointer"
            />
            <span className={`text-sm font-semibold transition ${accepted ? 'text-slate-950' : 'text-slate-500'}`}>
              I accept the above declaration *
            </span>
          </label>
        </div>

        {/* Fee summary / resubmit notice */}
        {applicationFeePaid ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
            <p className="font-semibold text-emerald-800">Application fee already paid</p>
            <p className="text-emerald-700 text-xs mt-0.5">
              No additional payment required. Click "Resubmit Application" to send your corrected form.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
            <p className="font-semibold text-blue-900">
              Application fee: ₹{Number(data.application_fee || 0).toLocaleString('en-IN')}
            </p>
            <p className="text-blue-700 text-xs mt-0.5">
              Clicking "Pay & Submit" will open the Razorpay payment window. Non-refundable.
            </p>
          </div>
        )}

        {!applicationFeePaid && scriptError && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Payment gateway could not be loaded. Please check your internet connection and try again.
          </p>
        )}

        {(submitError || globalError) && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError || globalError}
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <Button variant="secondary" onClick={onBack} disabled={processing} className="w-full sm:w-auto">
            ← Back
          </Button>
          {applicationFeePaid ? (
            <Button
              onClick={handleResubmit}
              loading={processing}
              disabled={!accepted || processing}
              className={`w-full sm:w-auto sm:ml-auto ${!accepted ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Resubmit Application →
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              loading={processing}
              disabled={!accepted || scriptError}
              className={`w-full sm:w-auto sm:ml-auto ${(!accepted || scriptError) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Pay ₹{Number(data.application_fee || 0).toLocaleString('en-IN')} &amp; Submit →
            </Button>
          )}
        </div>
        {!accepted && (
          <p className="text-xs text-center text-slate-400">
            Accept the declaration above to {applicationFeePaid ? 'resubmit' : 'enable payment'}.
          </p>
        )}
      </div>
    </div>
  )
}

function ReviewSection({ title, onEdit, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
        <button onClick={onEdit} className="text-xs font-semibold text-blue-600 hover:underline">Edit</button>
      </div>
      <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
        {children}
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex gap-2 text-sm min-w-0">
      <span className="shrink-0 text-slate-400 w-28">{label}:</span>
      <span className="text-slate-800 font-medium break-words min-w-0">{value || '—'}</span>
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
