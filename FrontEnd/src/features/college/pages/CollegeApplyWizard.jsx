/**
 * CollegeApplyWizard — College admin fills application on behalf of a student.
 * Route: /college/apply/:applicationId  (applicationId may be 'new')
 *
 * Query params on /college/apply/new:
 *   ?student_id=&course_id=&period_id=&academic_year=&year_of_study=
 *
 * Steps (5 total — no Context step, college is pre-determined):
 *   1 — Personal details      (MANDATORY)
 *   2 — Other details         (optional — can skip)
 *   3 — Exam details          (optional — can skip)
 *   4 — Documents             (optional — can skip)
 *   5 — Review & submit
 */
import { useEffect, useReducer, useCallback, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuthContext } from '../../../context/AuthContext.jsx'
import api from '../../../services/api.js'
import StepIndicator from '../../../shared/components/StepIndicator.jsx'
import Button from '../../../shared/components/Button.jsx'
import { SkeletonForm } from '../../../shared/components/Skeleton.jsx'

import Step2Personal  from '../../student/pages/wizard/Step2Personal.jsx'
import Step3Other     from '../../student/pages/wizard/Step3Other.jsx'
import Step4Exam      from '../../student/pages/wizard/Step4Exam.jsx'
import Step5Documents from '../../student/pages/wizard/Step5Documents.jsx'

const STEPS = ['Personal', 'Other Details', 'Exam Details', 'Documents', 'Review']

// Wizard step index → actual application step number for saving (offset by 1 vs student wizard)
// Student wizard: step1=Context, step2=Personal, ...
// College wizard: step1=Personal (maps to API step 2), step2=Other (step 3), etc.

const initialState = {
  applicationId:  null,
  studentId:      null,
  currentStep:    1,
  maxStep:        1,
  loading:        true,
  saving:         false,
  errors:         {},
  globalError:    '',
  data: {
    college_id: null, college_name: '', course_id: null, course_name: '',
    year_of_study: null, academic_year: '', application_fee: 0,
    // Step 1 (personal)
    surname:'', first_name:'', middle_name:'', mother_name:'',
    sex:'', mobile:'', email:'',
    address:'', taluka:'', district:'', state:'',
    category:'', fees_category:'',
    // Step 2 (other)
    birth_date:'', birth_place:'', birth_taluka:'', birth_district:'', birth_state:'',
    nationality:'Indian', marital_status:'', religion:'', caste:'', mother_tongue:'',
    height_cm:'', weight_kg:'', blood_group:'',
    father_full_name:'', son_daughter_number:'', father_occupation:'', annual_income:'',
    aadhaar:'', prn:'', abc_id:'', university_app_no:'',
    bank_account:'', bank_ifsc:'', bank_name:'', bank_branch:'',
    // Step 3 (exam)
    exams: {},
    // Step 4 (documents)
    linked_documents: [],
    required_documents: [],
    student_documents: [],
    // Step 5
    declaration_accepted: false,
  },
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':    return { ...state, loading: action.value }
    case 'SET_SAVING':     return { ...state, saving: action.value }
    case 'SET_ERRORS':     return { ...state, errors: action.errors }
    case 'CLEAR_ERRORS':   return { ...state, errors: {}, globalError: '' }
    case 'SET_GLOBAL_ERR': return { ...state, globalError: action.message }
    case 'SET_STEP':       return { ...state, currentStep: action.step, errors: {}, globalError: '' }
    case 'INIT_APP':
      return { ...state, applicationId: action.applicationId, studentId: action.studentId,
               appStatus: action.appStatus,
               currentStep: action.currentStep, maxStep: action.currentStep, loading: false }
    case 'SET_DATA':       return { ...state, data: { ...state.data, ...action.patch } }
    case 'SET_MAX_STEP':   return { ...state, maxStep: Math.max(state.maxStep, action.step) }
    default:               return state
  }
}

export default function CollegeApplyWizard() {
  const { applicationId: paramId } = useParams()
  const [searchParams]  = useSearchParams()
  const navigate        = useNavigate()
  const { user }        = useAuthContext()   // college admin
  const [state, dispatch] = useReducer(reducer, initialState)
  const [registrationNumber, setRegistrationNumber] = useState(null)
  const [submitError, setSubmitError]               = useState('')

  // ── Init ─────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      dispatch({ type: 'SET_LOADING', value: true })
      try {
        let appId     = paramId !== 'new' ? parseInt(paramId) : null
        let studentId = searchParams.get('student_id') ? parseInt(searchParams.get('student_id')) : null

        if (!appId) {
          const course_id     = parseInt(searchParams.get('course_id'))
          const period_id     = parseInt(searchParams.get('period_id'))
          const academic_year = searchParams.get('academic_year')
          const year_of_study = searchParams.get('year_of_study') || undefined

          const initRes = await api.post('api/applications/init-by-college', {
            student_id:          studentId,
            college_id:          user.id,
            course_id,
            admission_period_id: period_id,
            academic_year,
            year_of_study,
          })

          appId = initRes.data.data.application_id
          navigate(`/college/apply/${appId}`, { replace: true })
        }

        // Fetch form data
        const formRes = await api.get(`api/applications/${appId}/form`)
        const { application: app, previous_exam, previous_exams, documents } = formRes.data.data

        if (!studentId) studentId = app.student_id

        // Autofill from student profile
        const fillRes = await api.get(`api/student-profile/autofill?student_id=${studentId}`)
        const { profile, last_application } = fillRes.data.data
        const merged = buildAutofill(app, last_application || {}, profile || {})

        // Student's existing documents
        const sdRes = await api.get(`student-documents?student_id=${studentId}`)
        const studentDocs = sdRes.data.data || []

        // Required documents
        const rdRes = await api.get(
          `api/required-documents?college_id=${app.college_id}&course_id=${app.course_id}&year=${app.year_of_study}`
        )
        const requiredDocs = rdRes.data.data || []

        const examsData = {}
        if (previous_exams) {
          for (const [type, row] of Object.entries(previous_exams)) {
            const v = (x) => (x != null && x !== '') ? String(x) : ''
            examsData[type] = {
              institute:      v(row.institute),
              board:          v(row.board),
              month_year:     v(row.month_year),
              seat_no:        v(row.seat_no),
              marks_obtained: v(row.marks_obtained),
              marks_max:      v(row.marks_max),
              percentage:     v(row.percentage),
              class_grade:    v(row.class_grade),
              remark:         v(row.remark),
            }
          }
        }
        const examData = { exams: examsData }

        dispatch({
          type: 'SET_DATA',
          patch: {
            ...merged,
            ...examData,
            linked_documents:   documents,
            required_documents: requiredDocs,
            student_documents:  studentDocs,
          },
        })

        // Map DB current_step (1=Context,2=Personal,...) to college wizard step (1=Personal,...)
        const dbStep    = app.current_step || 2
        const wizStep   = Math.max(1, dbStep - 1)  // offset: college wizard has no Context step
        dispatch({ type: 'INIT_APP', applicationId: appId, studentId, currentStep: wizStep, appStatus: app.status })
      } catch (err) {
        dispatch({ type: 'SET_GLOBAL_ERR', message: err?.response?.data?.message || 'Failed to load application.' })
        dispatch({ type: 'SET_LOADING', value: false })
      }
    }
    init()
  }, [paramId])

  const setField = useCallback((name, value) => {
    dispatch({ type: 'SET_DATA', patch: { [name]: value } })
    dispatch({ type: 'CLEAR_ERRORS' })
  }, [])

  const handleChange = useCallback((e) => {
    setField(e.target.name, e.target.value)
  }, [setField])

  // Scroll to top on every step change
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }, [state.currentStep])

  function goStep(n) {
    dispatch({ type: 'SET_STEP', step: n })
  }

  async function saveAndNext(endpoint, body, nextStep) {
    dispatch({ type: 'SET_SAVING', value: true })
    dispatch({ type: 'CLEAR_ERRORS' })
    try {
      if (endpoint) {
        await api.patch(`api/applications/${state.applicationId}/${endpoint}`, body)
      }
      dispatch({ type: 'SET_MAX_STEP', step: nextStep })
      dispatch({ type: 'SET_STEP', step: nextStep })
    } catch (err) {
      const resp = err?.response?.data
      if (resp?.errors) dispatch({ type: 'SET_ERRORS', errors: resp.errors })
      else dispatch({ type: 'SET_GLOBAL_ERR', message: resp?.message || 'Save failed.' })
    } finally {
      dispatch({ type: 'SET_SAVING', value: false })
    }
  }

  // Skip: advance without saving (only for optional steps)
  function skip(nextStep) {
    dispatch({ type: 'SET_MAX_STEP', step: nextStep })
    dispatch({ type: 'SET_STEP', step: nextStep })
  }

  async function handleFinalSubmit() {
    setSubmitError('')
    dispatch({ type: 'SET_SAVING', value: true })
    try {
      await api.post(`api/applications/${state.applicationId}/declaration`, { accepted: true })
      const submitRes = await api.post(`applications/${state.applicationId}/submit`)
      setRegistrationNumber(submitRes.data.data?.registration_number || '')
    } catch (err) {
      const resp = err?.response?.data
      setSubmitError(resp?.message || 'Submission failed. Please try again.')
    } finally {
      dispatch({ type: 'SET_SAVING', value: false })
    }
  }

  const { data, currentStep, loading, saving, errors, globalError, applicationId, studentId, appStatus } = state
  // Edit mode: app already submitted — save changes and return, no re-submit
  const isEditMode = !!appStatus && appStatus !== 'draft'

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-2xl"><SkeletonForm fields={8} /></div>
      </div>
    )
  }

  if (globalError && !applicationId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="rounded-xl border border-red-200 bg-white p-6 text-center max-w-sm">
          <p className="font-semibold text-red-700">{globalError}</p>
          <button onClick={() => navigate(-1)} className="mt-4 text-sm text-blue-600 hover:underline">← Go back</button>
        </div>
      </div>
    )
  }

  // Success screen
  if (registrationNumber !== null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center max-w-sm space-y-4 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-950">Application Submitted!</h2>
          {registrationNumber && (
            <p className="text-slate-600">
              Registration number:{' '}
              <span className="font-mono font-bold text-slate-950">{registrationNumber}</span>
            </p>
          )}
          <p className="text-sm text-slate-500">The application has been submitted and is now under review.</p>
          <Button onClick={() => navigate('/college/dashboard?section=inbox')}>
            Go to Inbox →
          </Button>
        </div>
      </div>
    )
  }

  const stepProps = { data, errors, globalError, saving, onChange: handleChange, setField }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-3xl flex items-center gap-3">
          <button
            onClick={() => navigate('/college/dashboard?section=inbox')}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">
              {data.college_name} — {isEditMode ? 'Edit Application' : 'Add Application'}
            </p>
            <p className="text-xs text-slate-400">
              {data.course_name} · {YEAR_LABEL[data.year_of_study]} · {data.academic_year}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
            College Entry
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        <StepIndicator steps={STEPS} current={currentStep} />

        {globalError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {globalError}
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">

          {/* Step 1 — Personal (mandatory) */}
          {currentStep === 1 && (
            <Step2Personal
              {...stepProps}
              appId={applicationId}
              onBack={() => navigate('/college/dashboard?section=inbox')}
              onNext={(body) => saveAndNext('personal-details', body, 2)}
            />
          )}

          {/* Step 2 — Other details (optional) */}
          {currentStep === 2 && (
            <Step3Other
              {...stepProps}
              onBack={() => goStep(1)}
              onNext={(body) => saveAndNext('other-details', body, 3)}
              extraFooter={<SkipButton onClick={() => skip(3)} saving={saving} />}
            />
          )}

          {/* Step 3 — Exam details (optional) */}
          {currentStep === 3 && (
            <Step4Exam
              {...stepProps}
              onBack={() => goStep(2)}
              onNext={(body) => saveAndNext('previous-exam', body, 4)}
              extraFooter={<SkipButton onClick={() => skip(4)} saving={saving} />}
            />
          )}

          {/* Step 4 — Documents */}
          {currentStep === 4 && (
            <Step5Documents
              {...stepProps}
              appId={applicationId}
              studentId={studentId}
              onBack={() => goStep(3)}
              onNext={() => skip(5)}
              onDocumentsChange={(linked, studentDocs) => dispatch({ type: 'SET_DATA', patch: { linked_documents: linked, ...(studentDocs && { student_documents: studentDocs }) } })}
            />
          )}

          {/* Step 5 — Review & submit / save */}
          {currentStep === 5 && (
            <CollegeReviewStep
              data={data}
              saving={saving}
              submitError={submitError}
              isEditMode={isEditMode}
              onBack={() => goStep(4)}
              onEditStep={goStep}
              onSubmit={handleFinalSubmit}
              onSaveAndReturn={() => navigate(`/college/dashboard?section=app&app_id=${applicationId}`)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Skip button rendered alongside the step's own footer ─────
function SkipButton({ onClick, saving }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      className="text-sm text-slate-400 hover:text-slate-600 underline underline-offset-2 disabled:opacity-50"
    >
      Skip for now →
    </button>
  )
}

// ── Review step (college-specific — shows fee info, checks required docs) ──
function CollegeReviewStep({ data, saving, submitError, isEditMode, onBack, onEditStep, onSubmit, onSaveAndReturn }) {
  const d = data

  const linkedMap = Object.fromEntries((d.linked_documents || []).map(doc => [doc.document_type_id, doc]))
  const missingMandatory = (d.required_documents || [])
    .filter(rd => rd.is_mandatory && !linkedMap[rd.document_type_id])
    .map(rd => rd.document_name)

  const canSubmit = missingMandatory.length === 0

  return (
    <div>
      <div className="border-b border-slate-100 px-5 py-5">
        <h2 className="text-base font-bold text-slate-950">{isEditMode ? 'Review Changes' : 'Review & Submit'}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {isEditMode ? 'Review the changes made to the application.' : 'Check all details before submitting.'}
        </p>
      </div>

      <div className="px-5 py-5 space-y-4">

        {/* Personal */}
        <ReviewSection
          title="Personal Details"
          onEdit={() => onEditStep(1)}
          rows={[
            ['Name', [d.surname, d.first_name, d.middle_name].filter(Boolean).join(' ')],
            ["Mother's First Name", d.mother_name],
            ['Gender', d.sex],
            ['Mobile', d.mobile],
            ['Email', d.email],
            ['Category', d.app_category || d.category],
            ['Address', [d.address, d.taluka, d.district, d.state].filter(Boolean).join(', ')],
          ]}
        />

        {/* Other */}
        <ReviewSection
          title="Other Details"
          optional
          onEdit={() => onEditStep(2)}
          rows={[
            ['DOB', d.birth_date],
            ['Aadhaar', d.aadhaar],
            ['Father', d.father_full_name],
            ['Religion', d.religion],
            ['Blood Group', d.blood_group],
          ]}
        />

        {/* Exam */}
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 border-b border-slate-100">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Exam Details</p>
            <button onClick={() => onEditStep(3)} className="text-xs text-blue-600 hover:underline">Edit</button>
          </div>
          <div className="px-4 py-3 overflow-x-auto">
            {Object.keys(d.exams || {}).length === 0 ? (
              <p className="text-sm text-slate-400 italic">—</p>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    {['Exam','Institute','Board/Univ.','Month & Year','Seat No.','Marks','Out of','%','Class/Grade'].map(h => (
                      <th key={h} className="border border-slate-200 px-2 py-1 text-left font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(d.exams).map(([type, r]) => (
                    <tr key={type} className="even:bg-slate-50">
                      <td className="border border-slate-200 px-2 py-1 font-semibold text-slate-700 whitespace-nowrap">
                        {{'SSC':'SSC','HSC':'HSC','FY_SEM1':'F.Y. Sem I','FY_SEM2':'F.Y. Sem II','SY_SEM1':'S.Y. Sem I','SY_SEM2':'S.Y. Sem II'}[type] || type}
                      </td>
                      <td className="border border-slate-200 px-2 py-1">{r.institute || '—'}</td>
                      <td className="border border-slate-200 px-2 py-1">{r.board || '—'}</td>
                      <td className="border border-slate-200 px-2 py-1 whitespace-nowrap">{r.month_year || '—'}</td>
                      <td className="border border-slate-200 px-2 py-1">{r.seat_no || '—'}</td>
                      <td className="border border-slate-200 px-2 py-1">{r.marks_obtained || '—'}</td>
                      <td className="border border-slate-200 px-2 py-1">{r.marks_max || '—'}</td>
                      <td className="border border-slate-200 px-2 py-1">{r.percentage ? `${r.percentage}%` : '—'}</td>
                      <td className="border border-slate-200 px-2 py-1">{r.class_grade || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Documents */}
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 border-b border-slate-100">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Documents</p>
            <button onClick={() => onEditStep(4)} className="text-xs text-blue-600 hover:underline">Edit</button>
          </div>
          <div className="px-4 py-3 space-y-1.5">
            {(d.required_documents || []).length === 0 && (
              <p className="text-sm text-slate-400 italic">No documents required.</p>
            )}
            {(d.required_documents || []).map(rd => {
              const uploaded = linkedMap[rd.document_type_id]
              return (
                <div key={rd.document_type_id} className="flex items-center gap-2 text-sm">
                  {uploaded
                    ? <span className="text-emerald-600 font-bold shrink-0">✓</span>
                    : <span className={`shrink-0 font-bold ${rd.is_mandatory ? 'text-red-500' : 'text-slate-300'}`}>
                        {rd.is_mandatory ? '!' : '○'}
                      </span>
                  }
                  <span className={uploaded ? 'text-slate-700' : rd.is_mandatory ? 'text-red-700 font-medium' : 'text-slate-400'}>
                    {rd.document_name}
                    {rd.is_mandatory && !uploaded && <span className="ml-1 text-xs">(required)</span>}
                  </span>
                  {uploaded && <span className="text-xs text-slate-400 truncate">— {uploaded.file_name}</span>}
                </div>
              )
            })}
            {(d.linked_documents || [])
              .filter(doc => !(d.required_documents || []).find(rd => rd.document_type_id === doc.document_type_id))
              .map(doc => (
                <div key={doc.document_type_id} className="flex items-center gap-2 text-sm">
                  <span className="text-emerald-600 font-bold shrink-0">✓</span>
                  <span className="text-slate-700">{doc.document_name || doc.document_type_id}</span>
                  <span className="text-xs text-slate-400 truncate">— {doc.file_name}</span>
                </div>
              ))
            }
          </div>
        </div>

        {/* Missing mandatory docs warning */}
        {missingMandatory.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p className="font-semibold mb-1">Required documents missing:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {missingMandatory.map(name => <li key={name}>{name}</li>)}
            </ul>
            <button onClick={() => onEditStep(4)} className="mt-2 text-xs font-semibold text-red-700 underline underline-offset-2">
              Go to Documents step →
            </button>
          </div>
        )}

        {/* Application fee info — only for new submissions */}
        {!isEditMode && d.application_fee > 0 && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-sm font-semibold text-blue-900">
              Application Fee: ₹{Number(d.application_fee).toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-blue-600 mt-0.5">
              This fee will be recorded as collected on behalf of the student.
            </p>
          </div>
        )}

        {submitError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
          <Button variant="secondary" onClick={onBack} disabled={saving}>← Back</Button>
          {isEditMode ? (
            <Button onClick={onSaveAndReturn} className="sm:ml-auto">
              Save &amp; Return to Application →
            </Button>
          ) : (
            <Button
              onClick={onSubmit}
              loading={saving}
              disabled={!canSubmit || saving}
              className={`sm:ml-auto ${!canSubmit ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Submit Application →
            </Button>
          )}
        </div>
        {!isEditMode && !canSubmit && (
          <p className="text-xs text-center text-red-500">
            Upload all required documents before submitting.
          </p>
        )}
      </div>
    </div>
  )
}

function ReviewSection({ title, optional, onEdit, rows }) {
  const hasData = rows.some(([, v]) => v)
  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">{title}</p>
          {optional && !hasData && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">skipped</span>
          )}
        </div>
        <button onClick={onEdit} className="text-xs text-blue-600 hover:underline">Edit</button>
      </div>
      <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
        {rows.map(([label, value], i) => (
          value ? (
            <div key={i} className="flex gap-2 text-sm min-w-0">
              {label && <span className="shrink-0 text-slate-400 w-28">{label}:</span>}
              <span className="text-slate-800 font-medium break-words min-w-0">{value}</span>
            </div>
          ) : null
        ))}
        {!hasData && (
          <p className="text-sm text-slate-400 italic col-span-2">—</p>
        )}
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────
function buildAutofill(app, lastApp, profile) {
  const ap = (k) => app[`app_${k}`] ?? lastApp[`app_${k}`] ?? ''
  return {
    college_id:    app.college_id,
    college_name:  app.college_name,
    course_id:     app.course_id,
    course_name:   app.course_name,
    year_of_study: app.year_of_study,
    academic_year: app.academic_year,
    application_fee: app.application_fee,

    surname:      ap('surname')     || profile.surname    || '',
    first_name:   ap('first_name')  || profile.first_name || '',
    middle_name:  ap('middle_name') || profile.middle_name|| '',
    mother_name:  ap('mother_name') || profile.mother_name|| '',
    sex:          ap('sex')         || profile.sex        || '',
    mobile:       ap('mobile')      || profile.phone      || '',
    email:        app.student_email || '',
    address:      ap('address')     || profile.address    || '',
    taluka:       ap('taluka')      || '',
    district:     ap('district')    || '',
    state:        ap('state')       || '',
    category:     ap('category')    || profile.category   || '',
    fees_category:ap('fees_category')|| '',

    birth_date:         formatDate(ap('birth_date')) || formatDate(profile.birth_date) || '',
    birth_place:        ap('birth_place')      || profile.birth_place    || '',
    birth_taluka:       ap('birth_taluka')     || '',
    birth_district:     ap('birth_district')   || '',
    birth_state:        ap('birth_state')      || '',
    nationality:        ap('nationality')      || 'Indian',
    marital_status:     ap('marital_status')   || '',
    religion:           ap('religion')         || profile.religion       || '',
    caste:              ap('caste')            || profile.caste          || '',
    mother_tongue:      ap('mother_tongue')    || '',
    height_cm:          ap('height_cm')        || '',
    weight_kg:          ap('weight_kg')        || '',
    blood_group:        ap('blood_group')      || profile.blood_group    || '',
    father_full_name:   ap('father_full_name') || profile.father_full_name   || '',
    son_daughter_number:ap('son_daughter_no')  || '',
    father_occupation:  ap('father_occupation')|| profile.father_occupation || '',
    annual_income:      ap('annual_income')    || '',
    aadhaar:            ap('aadhaar')          || profile.aadhaar        || '',
    prn:                ap('prn')              || profile.prn || '',
    abc_id:             ap('abc_id')           || '',
    university_app_no:  ap('university_app_no') || '',
    bank_account:       ap('bank_account')     || '',
    bank_ifsc:          ap('bank_ifsc')        || '',
    bank_name:          ap('bank_name')        || '',
    bank_branch:        ap('bank_branch')      || '',
  }
}

function formatDate(d) {
  if (!d) return ''
  const date = new Date(d)
  return isNaN(date) ? '' : date.toISOString().slice(0, 10)
}

const YEAR_LABEL = { 1: 'FY', 2: 'SY', 3: 'TY' }
