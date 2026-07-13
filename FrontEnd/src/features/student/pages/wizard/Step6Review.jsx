import { useState } from 'react'
import { StepHeader } from './Step1Context.jsx'
import Button from '../../../../shared/components/Button.jsx'
import { useApplicationSubmit } from '../../hooks/useApplicationSubmit.js'

const YEAR_LABEL = { 1: 'FY — First Year', 2: 'SY — Second Year', 3: 'TY — Third Year', 4: '4Y — Fourth Year', 5: '5Y — Fifth Year' }
const EXAM_ROWS  = {
  1: ['SSC', 'HSC'],
  2: ['SSC', 'HSC', 'FY_SEM1', 'FY_SEM2'],
  3: ['SSC', 'HSC', 'FY_SEM1', 'FY_SEM2', 'SY_SEM1', 'SY_SEM2'],
  4: ['SSC', 'HSC', 'FY_SEM1', 'FY_SEM2', 'SY_SEM1', 'SY_SEM2', 'TY_SEM1', 'TY_SEM2'],
  5: ['SSC', 'HSC', 'FY_SEM1', 'FY_SEM2', 'SY_SEM1', 'SY_SEM2', 'TY_SEM1', 'TY_SEM2', '4Y_SEM1', '4Y_SEM2'],
}

export default function Step6Review({ data, errors, globalError, saving, appId, applicationFeePaid, onBack, onEditStep, onDone, features }) {
  const [accepted, setAccepted] = useState(!!data.declaration_accepted)

  const {
    processing,
    submitError,
    resubmitted,
    handleSubmit: submitApplication,
    handleDirectSubmit: submitDirect,
    handleResubmit: resubmitApp,
  } = useApplicationSubmit(appId)

  function handleSubmit()       { submitApplication(accepted) }
  function handleDirectSubmit() { submitDirect(accepted) }
  function handleResubmit()     { resubmitApp(accepted) }

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
          {features?.admission_form?.name_as_on_aadhaar === true && (
            <Row label="Name as on Aadhaar" value={data.name_as_on_aadhaar} />
          )}
          {features?.admission_form?.son_of === true && (
            <Row label="S/o" value={data.son_of} />
          )}
          <Row label="Mother's First Name" value={data.mother_name} />
          {features?.admission_form?.semester === true && (
            <Row label="Semester" value={data.semester ? `Semester ${data.semester}` : ''} />
          )}
          {features?.admission_form?.date_of_admission === true && (
            <Row label="Date of Admission" value={fmtDate(data.date_of_admission)} />
          )}
          {features?.admission_form?.diploma_direct_sy === true && (
            <Row label="Diploma (Direct SY)" value={data.is_diploma_direct_sy ? 'Yes' : 'No'} />
          )}
          <Row label="Gender"         value={data.sex} />
          <Row label="Mobile"        value={data.mobile} />
          {data.parent_mobile && <Row label="Parent's Mobile" value={data.parent_mobile} />}
          {data.land_line && <Row label="Land Line" value={data.land_line} />}
          <Row label="Email"         value={data.email} />
          <Row label="Address"       value={[data.address, data.taluka, data.district, data.state].filter(Boolean).join(', ')} />
          {[data.native_address, data.native_taluka, data.native_district].some(Boolean) && (
            <Row label="Native Address" value={[data.native_address, data.native_taluka, data.native_district].filter(Boolean).join(', ')} />
          )}
          {data.guardian_relation && <Row label="Guardian's Relation" value={data.guardian_relation} />}
          <Row label="Category"      value={data.category} />
          {features?.admission_form?.admitted_category === true && (
            <Row label="Admitted Category" value={data.admitted_category} />
          )}
          {features?.admission_form?.admission_quota === true && (
            <Row label="Admission Quota" value={data.admission_quota} />
          )}
          <Row label="Special Status" value={data.special_status} />
          {features?.payment?.college_fee !== false && (
            <Row label="Fees Category" value={data.fees_category} />
          )}
        </ReviewSection>

        <ReviewSection title="Other Details" onEdit={() => onEditStep(3)}>
          <Row label="Date of Birth"       value={fmtDate(data.birth_date)} />
          <Row label="Birth Place"         value={[data.birth_place, data.birth_taluka, data.birth_district, data.birth_state].filter(Boolean).join(', ')} />
          <Row label="Nationality"         value={data.nationality} />
          <Row label="Marital Status"      value={data.marital_status} />
          <Row label="Religion"            value={data.religion} />
          <Row label="Caste"               value={data.caste} />
          <Row label="Mother Tongue"       value={data.mother_tongue} />
          <Row label="Blood Group"         value={data.blood_group} />
          <Row label="Height"              value={data.height_cm ? `${data.height_cm} cm` : ''} />
          <Row label="Weight"              value={data.weight_kg ? `${data.weight_kg} kg` : ''} />
          <Row label="Father's Name"       value={data.father_full_name} />
          <Row label="Son/Daughter No."    value={data.son_daughter_number} />
          <Row label="Father's Occupation" value={data.father_occupation} />
          <Row label="Annual Income"       value={data.annual_income ? `₹${Number(data.annual_income).toLocaleString('en-IN')}` : ''} />
          <Row label="Aadhaar"             value={maskAadhaar(data.aadhaar)} />
          <Row label="ABC ID"              value={data.abc_id} />
          <Row label="PRN"                 value={data.prn} />
          <Row label="University App No."  value={data.university_app_no} />
          <Row label="Bank Account"        value={data.bank_account ? `****${data.bank_account.slice(-4)}` : ''} />
          <Row label="IFSC Code"           value={data.bank_ifsc} />
          <Row label="Bank Name"           value={data.bank_name} />
          <Row label="Bank Branch"         value={data.bank_branch} />
        </ReviewSection>

        <ReviewSection title="Previous Exam Details" onEdit={() => onEditStep(4)}>
          {Object.keys(data.exams || {}).length === 0 ? (
            <p className="col-span-2 text-sm text-slate-400">No exam details filled.</p>
          ) : (
            <div className="col-span-2 overflow-x-auto rounded-lg border-2 border-slate-400">
              <table className="min-w-[950px] text-xs border-collapse">
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
                      <td className="border border-slate-200 px-2 py-1 whitespace-nowrap">{row.seat_no || '—'}</td>
                      <td className="border border-slate-200 px-2 py-1 whitespace-nowrap">{row.marks_obtained || '—'}</td>
                      <td className="border border-slate-200 px-2 py-1 whitespace-nowrap">{row.marks_max || '—'}</td>
                      <td className="border border-slate-200 px-2 py-1 whitespace-nowrap">{row.percentage ? `${row.percentage}%` : '—'}</td>
                      <td className="border border-slate-200 px-2 py-1 whitespace-nowrap">{row.class_grade || '—'}</td>
                      <td className="border border-slate-200 px-2 py-1">{row.remark || '—'}</td>
                    </tr>
                  )})}
                </tbody>
              </table>
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
        {(() => {
          const hasPlatformFee = features?.payment?.platform_fee !== false
          if (applicationFeePaid) {
            return (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
                <p className="font-semibold text-emerald-800">Application fee already paid</p>
                <p className="text-emerald-700 text-xs mt-0.5">
                  No additional payment required. Click "Resubmit Application" to send your corrected form.
                </p>
              </div>
            )
          }
          if (hasPlatformFee) {
            return (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
                <p className="font-semibold text-blue-900">
                  Platform fee: ₹{Number(data.application_fee || 0).toLocaleString('en-IN')}
                </p>
                <p className="text-blue-700 text-xs mt-0.5">
                  Clicking "Pay & Submit" will redirect you to the PayU payment page. Non-refundable.
                </p>
              </div>
            )
          }
          return null
        })()}

        {(submitError || globalError) && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError || globalError}
          </p>
        )}

        {/* Actions */}
        {(() => {
          const hasPlatformFee = features?.payment?.platform_fee !== false
          return (
            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <Button variant="secondary" onClick={onBack} disabled={processing} className="w-full sm:w-auto">
                ← Back
              </Button>
              {(applicationFeePaid || !hasPlatformFee) ? (
                <Button
                  onClick={applicationFeePaid ? handleResubmit : handleDirectSubmit}
                  loading={processing}
                  disabled={!accepted || processing}
                  className={`w-full sm:w-auto sm:ml-auto ${!accepted ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {applicationFeePaid ? 'Resubmit Application →' : 'Submit Application →'}
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  loading={processing}
                  disabled={!accepted || processing}
                  className={`w-full sm:w-auto sm:ml-auto ${(!accepted || processing) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Pay ₹{Number(data.application_fee || 0).toLocaleString('en-IN')} &amp; Submit →
                </Button>
              )}
            </div>
          )
        })()}
        {!accepted && (
          <p className="text-xs text-center text-slate-400">
            Accept the declaration above to {applicationFeePaid ? 'resubmit' : features?.payment?.platform_fee !== false ? 'enable payment' : 'submit'}.
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
