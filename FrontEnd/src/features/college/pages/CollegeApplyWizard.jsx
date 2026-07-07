/**
 * CollegeApplyWizard — College admin fills application on behalf of a student.
 * Route: /college/apply/:applicationId  (applicationId may be 'new')
 *
 * Query params on /college/apply/new:
 *   ?student_id=&course_id=&period_id=&academic_year=&year_of_study=
 *
 * Steps (6 total — no Context step, college is pre-determined):
 *   1 — Personal details      (MANDATORY)
 *   2 — Other details         (optional — can skip)
 *   3 — Exam details          (optional — can skip)
 *   4 — Documents             (optional — ALL docs skippable for college entry)
 *   5 — Review & submit
 *   6 — Division & Fee & Payment (confirm admission + collect college fee)
 */
import { useEffect, useReducer, useCallback, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuthContext } from '../../../context/AuthContext.jsx'
import {
  initApplicationByCollege, getApplicationForm, updateApplicationStep,
  acceptDeclaration, submitApplication, getRequiredDocuments, getStudentAutofill,
} from '../../../services/applicationService.js'
import { getStudentDocuments } from '../../../services/documentService.js'
import {
  recordApplicationFee, sendPaymentLink,
  confirmApplication, getComputedFee, postApplicationAction,
} from '../../../services/collegeAdminService.js'
import { getDivisions } from '../../../services/masterService.js'
import { initiatePayment } from '../../../services/paymentService.js'
import StepIndicator from '../../../shared/components/StepIndicator.jsx'
import Button from '../../../shared/components/Button.jsx'
import { SkeletonForm, SkeletonCards } from '../../../shared/components/Skeleton.jsx'
import { useCollegePayment } from '../../../shared/hooks/useCollegePayment.js'

import Step2Personal  from '../../student/pages/wizard/Step2Personal.jsx'
import Step3Other     from '../../student/pages/wizard/Step3Other.jsx'
import Step4Exam      from '../../student/pages/wizard/Step4Exam.jsx'
import Step5Documents from '../../student/pages/wizard/Step5Documents.jsx'

const STEPS = ['Personal', 'Other Details', 'Exam Details', 'Documents', 'Review', 'Division & Fees']

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
    category:'', special_status:'', fees_category:'', fees_category_override: false, fees_category_override_remark:'',
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

  // ── Application fee state ───────────────────────────────────
  const [registrationNumber, setRegistrationNumber] = useState(null)
  const [submitError, setSubmitError]               = useState('')
  const [feeCollected, setFeeCollected]             = useState(false)
  const [feeCollecting, setFeeCollecting]           = useState(false)
  const [feeError, setFeeError]                     = useState('')
  const [feeMode, setFeeMode]                       = useState('')      // 'cash'|'online'|'link'
  const [onlinePaying, setOnlinePaying]             = useState(false)
  const [linkPhone, setLinkPhone]                   = useState('')
  const [linkSent, setLinkSent]                     = useState(false)
  const [linkSending, setLinkSending]               = useState(false)

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

          const initRes = await initApplicationByCollege({
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
        const formRes = await getApplicationForm(appId)
        const { application: app, previous_exam, previous_exams, documents } = formRes.data.data

        if (!studentId) studentId = app.student_id

        // Autofill from student profile
        const fillRes = await getStudentAutofill(studentId)
        const { profile, last_application } = fillRes.data.data
        const merged = buildAutofill(app, last_application || {}, profile || {})

        // Student's existing documents
        const sdRes = await getStudentDocuments(studentId)
        const studentDocs = sdRes.data.data || []

        // Required documents
        const rdRes = await getRequiredDocuments(app.college_id, app.course_id, app.year_of_study)
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
        // After application fee is paid (status=submitted), jump straight to the Fees step (6)
        const startStep = app.status === 'submitted' ? 6 : wizStep
        dispatch({ type: 'INIT_APP', applicationId: appId, studentId, currentStep: startStep, appStatus: app.status })
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
        await updateApplicationStep(state.applicationId, endpoint, body)
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

  // ── Step 5: Submit application (declaration + app fee) ──────
  async function handleFinalSubmit() {
    setSubmitError('')
    dispatch({ type: 'SET_SAVING', value: true })
    try {
      await acceptDeclaration(state.applicationId, { accepted: true })
      const appFee = parseFloat(state.data.application_fee) || 0
      if (appFee > 0) {
        // Show fee collection panel first; actual submit happens after fee paid
        setRegistrationNumber('')
      } else {
        // No application fee — submit immediately
        const submitRes = await submitApplication(state.applicationId)
        setRegistrationNumber(submitRes.data.data?.registration_number || '')
      }
    } catch (err) {
      const resp = err?.response?.data
      setSubmitError(resp?.message || 'Submission failed. Please try again.')
    } finally {
      dispatch({ type: 'SET_SAVING', value: false })
    }
  }

  // Called from CollegeReviewStep once application is submitted (app fee done or zero)
  function handleProceedToFees() {
    dispatch({ type: 'SET_MAX_STEP', step: 6 })
    dispatch({ type: 'SET_STEP', step: 6 })
  }

  // ── App fee handlers ────────────────────────────────────────
  const appFee    = parseFloat(state.data.application_fee) || 0
  const collegeId = user?.id

  async function handleCollectCash() {
    setFeeError('')
    setFeeCollecting(true)
    try {
      const res = await recordApplicationFee(collegeId, state.applicationId)
      setFeeCollected(true)
      if (res.data?.registration_number) setRegistrationNumber(res.data.registration_number)
    } catch (err) {
      setFeeError(err?.response?.data?.message || 'Failed to collect fee.')
    } finally {
      setFeeCollecting(false)
    }
  }

  async function handleSendLink() {
    setFeeError('')
    const phone = linkPhone.trim().replace(/\D/g, '')
    if (phone.length < 10) { setFeeError('Enter a valid 10-digit mobile number.'); return }
    setLinkSending(true)
    try {
      await sendPaymentLink({ application_id: state.applicationId, payment_type: 'application_fee', phone })
      setLinkSent(true)
    } catch (err) {
      setFeeError(err?.response?.data?.message || 'Failed to send link.')
    } finally {
      setLinkSending(false)
    }
  }

  async function handlePayOnline() {
    setFeeError('')
    setOnlinePaying(true)
    try {
      const res = await initiatePayment({ application_id: state.applicationId, payment_type: 'application_fee' })
      const { endpoint, fields } = res.data.data
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = endpoint
      Object.entries(fields).forEach(([k, v]) => {
        const inp = document.createElement('input')
        inp.type = 'hidden'; inp.name = k; inp.value = v
        form.appendChild(inp)
      })
      document.body.appendChild(form)
      form.submit()
    } catch (err) {
      setFeeError(err?.response?.data?.message || 'Failed to initiate online payment.')
      setOnlinePaying(false)
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

          {/* Step 4 — Documents (all skippable for college entry) */}
          {currentStep === 4 && (
            <Step5Documents
              {...stepProps}
              appId={applicationId}
              studentId={studentId}
              onBack={() => goStep(3)}
              onNext={() => skip(5)}
              onDocumentsChange={(linked, studentDocs) => dispatch({ type: 'SET_DATA', patch: { linked_documents: linked, ...(studentDocs && { student_documents: studentDocs }) } })}
              skipMandatoryCheck   // college entry: all docs are optional
            />
          )}

          {/* Step 5 — Review & submit */}
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
              onProceedToFees={handleProceedToFees}
              onAddNew={() => navigate('/college/dashboard?section=add-application')}
              submitted={registrationNumber !== null}
              registrationNumber={registrationNumber}
              appFee={appFee}
              feeCollected={feeCollected}
              linkSent={linkSent}
              feeMode={feeMode}
              setFeeMode={setFeeMode}
              feeError={feeError}
              setFeeError={setFeeError}
              feeCollecting={feeCollecting}
              onlinePaying={onlinePaying}
              linkSending={linkSending}
              linkPhone={linkPhone}
              setLinkPhone={setLinkPhone}
              onCollectCash={handleCollectCash}
              onPayOnline={handlePayOnline}
              onSendLink={handleSendLink}
            />
          )}

          {/* Step 6 — Division, Fee & Payment */}
          {currentStep === 6 && (
            <CollegeFeeConfirmStep
              applicationId={applicationId}
              collegeId={collegeId}
              courseId={data.course_id}
              yearOfStudy={data.year_of_study}
              onBack={() => goStep(5)}
              onGoToInbox={() => navigate('/college/dashboard?section=inbox')}
              onGoToDetail={() => navigate(`/college/dashboard?section=app&app_id=${applicationId}`)}
              onAddNew={() => navigate('/college/dashboard?section=add-application')}
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

// ── Review step (college-specific — shows fee info, all docs skippable) ──────
function CollegeReviewStep({
  data, saving, submitError, isEditMode, onBack, onEditStep, onSubmit, onSaveAndReturn, onProceedToFees,
  submitted, registrationNumber, appFee,
  feeCollected, linkSent, feeMode, setFeeMode, feeError, setFeeError,
  feeCollecting, onlinePaying, linkSending, linkPhone, setLinkPhone,
  onCollectCash, onPayOnline, onSendLink, onAddNew,
}) {
  const d = data
  const linkedMap = Object.fromEntries((d.linked_documents || []).map(doc => [doc.document_type_id, doc]))

  // After submission: determine if we can proceed to Step 6
  const appFeeHandled = feeCollected || !appFee || linkSent

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

        {/* Documents — all optional for college entry */}
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Documents</p>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-500">College entry — all optional</span>
            </div>
            <button onClick={() => onEditStep(4)} className="text-xs text-blue-600 hover:underline">Edit</button>
          </div>
          <div className="px-4 py-3 space-y-1.5">
            {(d.required_documents || []).length === 0 && (
              <p className="text-sm text-slate-400 italic">No documents configured.</p>
            )}
            {(d.required_documents || []).map(rd => {
              const uploaded = linkedMap[rd.document_type_id]
              return (
                <div key={rd.document_type_id} className="flex items-center gap-2 text-sm">
                  {uploaded
                    ? <span className="text-emerald-600 font-bold shrink-0">✓</span>
                    : <span className="shrink-0 font-bold text-slate-300">○</span>
                  }
                  <span className={uploaded ? 'text-slate-700' : 'text-slate-400'}>
                    {rd.document_name}
                    {!uploaded && <span className="ml-1 text-xs text-slate-400">(not uploaded — can add later)</span>}
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

        {submitError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        )}

        {/* ── After submission: application fee collection ── */}
        {submitted && (
          <div className="space-y-3 pt-1">
            {/* Status banner */}
            <div className={`rounded-lg border px-4 py-3 ${appFeeHandled ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
              <div className="text-sm">
                {appFeeHandled ? (
                  <>
                    <p className="font-bold text-emerald-800">Application Submitted</p>
                    {registrationNumber && <p className="text-emerald-700 mt-0.5">Reg. No: <span className="font-mono font-bold">{registrationNumber}</span></p>}
                    {feeCollected && appFee > 0 && <p className="text-emerald-700 mt-0.5">Application fee of ₹{appFee.toLocaleString('en-IN')} collected (cash).</p>}
                    {linkSent && <p className="text-blue-700 mt-0.5">Payment link sent to {linkPhone}.</p>}
                  </>
                ) : (
                  <>
                    <p className="font-bold text-amber-800">Application Fee Pending</p>
                    <p className="text-amber-700 mt-0.5">Collect the application fee of ₹{appFee.toLocaleString('en-IN')} to complete submission.</p>
                  </>
                )}
              </div>
            </div>

            {/* App fee collection options */}
            {appFee > 0 && !feeCollected && !linkSent && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 overflow-hidden">
                <style>{`
                  @keyframes fee-slide-in  { from { opacity:0; transform:translateX(32px) } to { opacity:1; transform:translateX(0) } }
                  @keyframes fee-slide-out { from { opacity:0; transform:translateX(-32px) } to { opacity:1; transform:translateX(0) } }
                  .fee-slide-in  { animation: fee-slide-in  200ms ease both }
                  .fee-slide-out { animation: fee-slide-out 200ms ease both }
                `}</style>

                {!feeMode && (
                  <div key="picker" className="fee-slide-out flex flex-col gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Collect Application Fee</p>
                    <button onClick={() => setFeeMode('cash')}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 text-left">
                      Collect Cash Now
                    </button>
                    <button onClick={() => setFeeMode('online')}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 text-left">
                      Pay Online (PayU)
                    </button>
                    <button onClick={() => setFeeMode('link')}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 text-left">
                      Send Payment Link on WhatsApp
                    </button>
                  </div>
                )}

                {feeMode === 'cash' && (
                  <div key="cash" className="fee-slide-in space-y-2">
                    {feeError && <p className="text-xs text-red-600">{feeError}</p>}
                    <div className="flex gap-2">
                      <Button onClick={onCollectCash} loading={feeCollecting}>✓ Mark as Collected</Button>
                      <button onClick={() => { setFeeMode(''); setFeeError('') }} className="text-xs text-slate-400 hover:text-slate-600">← Back</button>
                    </div>
                  </div>
                )}

                {feeMode === 'online' && (
                  <div key="online" className="fee-slide-in space-y-2">
                    <p className="text-xs text-slate-600">Pay ₹{appFee.toLocaleString('en-IN')} now via PayU payment gateway.</p>
                    {feeError && <p className="text-xs text-red-600">{feeError}</p>}
                    <div className="flex gap-2">
                      <Button onClick={onPayOnline} loading={onlinePaying}>Proceed to Payment</Button>
                      <button onClick={() => { setFeeMode(''); setFeeError('') }} className="text-xs text-slate-400 hover:text-slate-600">← Back</button>
                    </div>
                  </div>
                )}

                {feeMode === 'link' && (
                  <div key="link" className="fee-slide-in space-y-2">
                    <label className="block text-xs font-semibold text-slate-600">Mobile Number</label>
                    <input
                      type="tel" maxLength={10} inputMode="numeric"
                      value={linkPhone}
                      onChange={e => setLinkPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="10-digit mobile"
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    {feeError && <p className="text-xs text-red-600">{feeError}</p>}
                    <div className="flex gap-2">
                      <Button onClick={onSendLink} loading={linkSending}>Send via WhatsApp</Button>
                      <button onClick={() => { setFeeMode(''); setFeeError('') }} className="text-xs text-slate-400 hover:text-slate-600">← Back</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Proceed to Step 6 — shown once app fee is handled */}
            {appFeeHandled && (
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={onAddNew} variant="secondary">+ Add New Application</Button>
                <Button onClick={onProceedToFees} className="sm:ml-auto">
                  Proceed to Division &amp; Fee Collection →
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Submit / back buttons — hidden once submitted */}
        {!submitted && (
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
                disabled={saving}
                className="sm:ml-auto"
              >
                Submit Application →
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Step 6: Division, Fee Computation, Installment Plan & College Fee Collection ──
function CollegeFeeConfirmStep({ applicationId, collegeId, courseId, yearOfStudy, onBack, onGoToInbox, onGoToDetail, onAddNew }) {
  const YEAR_MAP = { 1: 'FY', 2: 'SY', 3: 'TY', 4: '4Y', 5: '5Y' }

  const [divisions,      setDivisions]      = useState([])
  const [division,       setDivision]       = useState('')
  const [feeTotal,       setFeeTotal]       = useState(null)
  const [feeBreakdown,   setFeeBreakdown]   = useState([])
  const [feeStudentType, setFeeStudentType] = useState(null)
  const [feeLoading,     setFeeLoading]     = useState(false)
  const [installments,   setInstallments]   = useState([
    { amount: '', due_date: '' },
    { amount: '', due_date: '' },
    { amount: '', due_date: '' },
    { amount: '', due_date: '' },
  ])
  const [confirming,   setConfirming]   = useState(false)
  const [confirmError, setConfirmError] = useState('')
  const [confirmed,    setConfirmed]    = useState(false)

  // Load divisions once
  useEffect(() => {
    if (!collegeId || !courseId || !yearOfStudy) return
    const yearLevel = YEAR_MAP[yearOfStudy] || 'FY'
    getDivisions(collegeId, courseId, yearLevel)
      .then(r => setDivisions((r.data.data || []).filter(d => d.is_active)))
      .catch(() => {})
  }, [collegeId, courseId, yearOfStudy])

  // Recompute fee whenever division changes
  useEffect(() => {
    if (divisions.length > 0 && !division) {
      setFeeTotal(null); setFeeBreakdown([]); return
    }
    setFeeLoading(true)
    getComputedFee(collegeId, applicationId, division || undefined)
      .then(r => {
        const d = r.data.data
        setFeeTotal(d?.totalFee ?? null)
        setFeeBreakdown(d?.breakdown || [])
        setFeeStudentType(d?.studentType || null)
      })
      .catch(() => { setFeeTotal(null); setFeeBreakdown([]) })
      .finally(() => setFeeLoading(false))
  }, [collegeId, applicationId, division, divisions.length])

  async function handleConfirm() {
    setConfirmError('')
    const validInst = installments.filter(i => i.amount !== '' && parseFloat(i.amount) > 0)
    if (validInst.length === 0) { setConfirmError('Enter at least one installment amount.'); return }
    const instTotal = validInst.reduce((s, i) => s + parseFloat(i.amount), 0)
    if (feeTotal != null && instTotal > feeTotal + 0.01) {
      setConfirmError(`Installment total (₹${instTotal.toLocaleString('en-IN')}) cannot exceed fee total (₹${feeTotal.toLocaleString('en-IN')}).`)
      return
    }
    setConfirming(true)
    try {
      // College-created applications are in 'submitted' status after Step 5.
      // The confirm endpoint requires doc_verified/scrutiny_accepted status, so
      // auto-approve first (college is creating on behalf of student — no manual review needed).
      const appRes = await postApplicationAction(collegeId, applicationId, 'approve')
      // If approve returned an error (e.g. already approved), ignore and proceed
    } catch (approveErr) {
      // If already in a confirmable status the approve call may fail — that's fine, continue.
    }
    try {
      await confirmApplication(collegeId, applicationId, {
        installments:          validInst.map((i, idx) => ({ installment_no: idx + 1, amount: parseFloat(i.amount), due_date: i.due_date || null })),
        division:              division || null,
        document_ids_verified: [],
      })
      setConfirmed(true)
    } catch (err) {
      setConfirmError(err?.response?.data?.message || 'Failed to confirm admission.')
    } finally {
      setConfirming(false)
    }
  }

  // ── Collect payment section (shown after confirm) ────────────
  const CollegePaySection = confirmed ? (
    <CollegeFeePaySection
      applicationId={applicationId}
      collegeId={collegeId}
      onGoToInbox={onGoToInbox}
      onGoToDetail={onGoToDetail}
      onAddNew={onAddNew}
    />
  ) : null

  return (
    <div>
      <div className="border-b border-slate-100 px-5 py-5">
        <h2 className="text-base font-bold text-slate-950">Division &amp; Fee Collection</h2>
        <p className="mt-1 text-sm text-slate-500">
          Student has been notified to visit the college. Once the student visits and documents are verified in person, set the fee and confirm admission.
        </p>
      </div>

      <div className="px-5 py-5 space-y-6">

        {!confirmed && (
          <>
            {/* ── Division picker ───────────────────────────────── */}
            {divisions.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Division</p>
                <div className="flex flex-wrap gap-2 items-center">
                  {divisions.map(div => (
                    <button
                      key={div.division_letter}
                      type="button"
                      onClick={() => setDivision(div.division_letter)}
                      className={`rounded-lg border-2 px-4 py-2 text-sm font-semibold transition ${
                        division === div.division_letter
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                      }`}
                    >
                      <span className="block">Div {div.division_letter}</span>
                      {div.grant_type && (
                        <span className={`block text-xs font-normal mt-0.5 ${division === div.division_letter ? 'text-slate-300' : 'text-slate-400'}`}>
                          {div.grant_type}
                        </span>
                      )}
                    </button>
                  ))}
                  {division && (
                    <button
                      type="button"
                      onClick={() => setDivision('')}
                      className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                    >
                      <span>✕</span> clear
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── Fee breakdown ─────────────────────────────────── */}
            {(divisions.length === 0 || division) && (
              <>
                {feeLoading ? (
                  <div className="py-4 text-center text-sm text-slate-400">Computing fees…</div>
                ) : feeTotal != null ? (
                  <div>
                    {(feeStudentType || division) && (
                      <p className="text-xs text-slate-500 mb-2">
                        Showing fees for <span className="font-semibold text-slate-700">{feeStudentType}</span> student type
                        {division && <> — <span className="font-semibold text-slate-700">Div {division}</span></>}
                      </p>
                    )}
                    <div className="rounded-lg border border-emerald-200 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-emerald-50 border-b border-emerald-100">
                          <tr>
                            <th className="px-4 py-2.5 text-left font-semibold text-slate-700">Fee Head</th>
                            <th className="px-4 py-2.5 text-right font-semibold text-slate-700">Amount (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {feeBreakdown.filter(h => (h.fees_type || '').toLowerCase() !== 'platform').map(h => (
                            <tr key={h.fees_code} className="hover:bg-slate-50">
                              <td className="px-4 py-2 text-slate-700">
                                {h.fees_head}
                                {h.short_name && <span className="ml-1.5 text-xs text-slate-400">{h.short_name}</span>}
                              </td>
                              <td className="px-4 py-2 text-right font-mono text-slate-800">
                                {parseFloat(h.amount).toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                          <tr>
                            <td className="px-4 py-2.5 font-bold text-slate-900">Total</td>
                            <td className="px-4 py-2.5 text-right font-bold font-mono text-slate-900">
                              {parseFloat(feeTotal).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    No fee configuration found for this course/year/division. Please configure fees in the Fees Master.
                  </div>
                )}

                {/* ── Installment plan ─────────────────────────── */}
                {feeTotal != null && !feeLoading && (
                  <CollegeInstallmentInput
                    installments={installments}
                    onChange={setInstallments}
                    feeTotal={feeTotal}
                    onError={setConfirmError}
                  />
                )}

                {/* ── Confirm error ─────────────────────────────── */}
                {confirmError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    {confirmError}
                  </div>
                )}

                {/* ── Action buttons ────────────────────────────── */}
                <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">
                  <Button variant="secondary" onClick={onBack}>← Back</Button>
                  {feeTotal != null && (
                    <Button
                      onClick={handleConfirm}
                      loading={confirming}
                      className="sm:ml-auto"
                    >
                      Proceed →
                    </Button>
                  )}
                </div>
              </>
            )}

            {/* If divisions exist but none selected, show prompt */}
            {divisions.length > 0 && !division && (
              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">
                <Button variant="secondary" onClick={onBack}>← Back</Button>
              </div>
            )}
          </>
        )}

        {/* ── Post-confirm: collect college fee ───────────────── */}
        {confirmed && (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
              <p className="font-bold text-emerald-800">Admission Confirmed</p>
              <p className="text-emerald-700 mt-0.5">Student will be notified to pay the college fee.</p>
            </div>
            {CollegePaySection}
          </div>
        )}
      </div>
    </div>
  )
}

// ── College fee payment section (after admission confirmed) ──────────────────
function CollegeFeePaySection({ applicationId, collegeId, onGoToInbox, onGoToDetail, onAddNew }) {
  const [payMode,     setPayMode]     = useState(null)
  const [amount,      setAmount]      = useState('')
  const [note,        setNote]        = useState('')
  const [linkPhone,   setLinkPhone]   = useState('')
  const [linkSending, setLinkSending] = useState(false)
  const [linkSent,    setLinkSent]    = useState(false)
  const [linkErr,     setLinkErr]     = useState('')

  const {
    feeStatus: fs,
    loading,
    paying: saving,
    payError: err,
    paidMsg: msg,
    payOnline,
    payCash,
    setPayError: setErr,
    setPaidMsg: setMsg,
  } = useCollegePayment(applicationId, collegeId, {})

  const allPaid  = fs && fs.total_fee > 0 && fs.remaining <= 0
  const amtDue   = fs ? (fs.current_due ?? fs.remaining) : 0
  const amtIsFixed = fs && fs.installments?.length > 0 && amtDue < fs.remaining - 0.01

  function fmtINR(n) { return `₹${Number(n).toLocaleString('en-IN')}` }

  async function handleCash(e) {
    e.preventDefault()
    await payCash({ amount: parseFloat(amount), note }, {
      onSuccess: () => { setAmount(''); setNote(''); setPayMode(null) },
    })
  }

  async function handleOnline(e) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { setErr('Enter a valid amount.'); return }
    await payOnline(amt, { onSuccess: () => setPayMode(null) })
  }

  async function handleSendLink(e) {
    e.preventDefault()
    const phone = linkPhone.trim().replace(/\D/g, '')
    if (phone.length < 10) { setLinkErr('Enter a valid 10-digit mobile number.'); return }
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { setLinkErr('Enter a valid amount.'); return }
    setLinkSending(true); setLinkErr('')
    try {
      await sendPaymentLink({ application_id: applicationId, payment_type: 'college_fee', phone, amount: amt })
      setLinkSent(true)
    } catch (err) {
      setLinkErr(err?.response?.data?.message || 'Failed to send link.')
    } finally {
      setLinkSending(false)
    }
  }

  if (loading) return <SkeletonCards count={2} />

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Collect Fee Payment</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {fs ? (allPaid ? 'All fees have been collected.' : `${fmtINR(fs.remaining)} remaining`) : ''}
          </p>
        </div>
        {fs && (
          allPaid
            ? <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Fully Paid</span>
            : <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Pending</span>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">
        {fs && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-center">
                <p className="text-xs text-slate-400">Total Fee</p>
                <p className="font-bold text-slate-950 mt-0.5">{fs.total_fee > 0 ? fmtINR(fs.total_fee) : '—'}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-center">
                <p className="text-xs text-slate-400">Paid</p>
                <p className="font-bold text-emerald-700 mt-0.5">{fmtINR(fs.total_paid)}</p>
              </div>
              <div className={`rounded-lg border p-3 text-center ${fs.remaining > 0 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                <p className="text-xs text-slate-400">Remaining</p>
                <p className={`font-bold mt-0.5 ${fs.remaining > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{fmtINR(fs.remaining)}</p>
              </div>
            </div>

            {/* Fee head breakdown */}
            {fs.breakdown?.filter(h => (h.fees_type || '').toLowerCase() !== 'platform').length > 0 && (
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Fee Head</th>
                      <th className="px-3 py-2 text-right font-semibold w-24">Amount (₹)</th>
                      <th className="px-3 py-2 text-right font-semibold w-24">Paid (₹)</th>
                      <th className="px-3 py-2 text-center font-semibold w-20">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {fs.breakdown.filter(h => (h.fees_type || '').toLowerCase() !== 'platform').map(h => (
                      <tr key={h.fees_code} className={h.status === 'paid' ? 'bg-emerald-50/40' : ''}>
                        <td className="px-3 py-1.5 text-slate-700">
                          {h.fees_head}
                          {h.short_name && <span className="ml-1.5 text-slate-400">{h.short_name}</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-600">{parseFloat(h.amount).toLocaleString('en-IN')}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-800">{h.paid_amount > 0 ? parseFloat(h.paid_amount).toLocaleString('en-IN') : '—'}</td>
                        <td className="px-3 py-1.5 text-center">
                          {h.status === 'paid'
                            ? <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">Cleared</span>
                            : h.status === 'partial'
                            ? <span className="text-xs font-semibold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">Partial</span>
                            : <span className="text-xs font-semibold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">Pending</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {msg && <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 font-medium">{msg}</div>}
            {err && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{err}</div>}

            {allPaid && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 font-medium">
                All fees have been paid in full.
              </div>
            )}

            {/* Collect Payment mode chooser */}
            {!allPaid && fs.total_fee > 0 && !payMode && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Collect Payment</p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => { setPayMode('cash'); setErr(''); setMsg(''); setAmount(String(amtDue)) }}
                    className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-slate-200 bg-white px-3 py-4 hover:border-slate-400 hover:bg-slate-50 transition"
                  >
                    <span className="text-xl">💵</span>
                    <span className="text-xs font-semibold text-slate-800">Cash / Offline</span>
                    <span className="text-xs text-slate-400 text-center leading-tight">Record cash received at counter</span>
                  </button>
                  <button
                    onClick={() => { setPayMode('online'); setErr(''); setMsg(''); setAmount(String(amtDue)) }}
                    className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-slate-200 bg-white px-3 py-4 hover:border-blue-400 hover:bg-blue-50 transition"
                  >
                    <span className="text-xl">💳</span>
                    <span className="text-xs font-semibold text-slate-800">Online (PayU)</span>
                    <span className="text-xs text-slate-400 text-center leading-tight">Pay via UPI, card or netbanking</span>
                  </button>
                  <button
                    onClick={() => { setPayMode('link'); setLinkErr(''); setLinkSent(false); setLinkPhone(''); setAmount(String(amtDue)) }}
                    className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-slate-200 bg-white px-3 py-4 hover:border-emerald-400 hover:bg-emerald-50 transition"
                  >
                    <span className="text-xl">📲</span>
                    <span className="text-xs font-semibold text-slate-800">WhatsApp Link</span>
                    <span className="text-xs text-slate-400 text-center leading-tight">Send payment link to student</span>
                  </button>
                </div>
              </div>
            )}

            {/* Cash form */}
            {!allPaid && payMode === 'cash' && (
              <form onSubmit={handleCash} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">Record Cash / Offline Payment</p>
                  <button type="button" onClick={() => { setPayMode(null); setErr('') }} className="text-xs text-slate-400 hover:text-slate-600">← Back</button>
                </div>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 mb-1 block">
                      Amount (₹){amtIsFixed && <span className="ml-1 text-slate-400">(fixed instalment)</span>}
                    </label>
                    <input type="text" inputMode="numeric" value={amount}
                      onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                      readOnly={amtIsFixed} placeholder={`Max ${fmtINR(fs.remaining)}`}
                      className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${amtIsFixed ? 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed' : 'border-slate-200'}`}
                      required />
                  </div>
                  <button type="submit" disabled={saving}
                    className="shrink-0 rounded-lg bg-slate-900 text-white text-sm font-semibold px-4 py-2 hover:bg-slate-700 disabled:opacity-50 transition">
                    {saving ? 'Saving…' : 'Collect Payment'}
                  </button>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Note (optional)</label>
                  <input type="text" value={note} onChange={e => setNote(e.target.value)}
                    placeholder="e.g. Cash received at counter"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              </form>
            )}

            {/* Online form */}
            {!allPaid && payMode === 'online' && (
              <form onSubmit={handleOnline} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-blue-800">Online Payment via PayU</p>
                  <button type="button" onClick={() => { setPayMode(null); setErr(''); setAmount('') }} className="text-xs text-slate-400 hover:text-slate-600">← Back</button>
                </div>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-blue-700 mb-1 block">
                      Amount (₹){amtIsFixed && <span className="ml-1 text-blue-400">(fixed instalment)</span>}
                    </label>
                    <input type="text" inputMode="numeric" value={amount}
                      onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                      readOnly={amtIsFixed} placeholder={`Max ${fmtINR(fs.remaining)}`}
                      className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${amtIsFixed ? 'bg-blue-100 border-blue-200 text-blue-700 cursor-not-allowed' : 'border-blue-200 bg-white'}`}
                      required />
                  </div>
                  <button type="submit" disabled={saving}
                    className="shrink-0 rounded-lg bg-blue-600 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-700 disabled:opacity-50 transition">
                    {saving ? 'Redirecting…' : 'Pay via PayU'}
                  </button>
                </div>
                <p className="text-xs text-blue-600">You will be redirected to PayU for UPI, card, or netbanking payment.</p>
              </form>
            )}

            {/* WhatsApp link form */}
            {!allPaid && payMode === 'link' && (
              <form onSubmit={handleSendLink} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-emerald-800">Send Payment Link via WhatsApp</p>
                  <button type="button" onClick={() => { setPayMode(null); setLinkErr(''); setLinkSent(false) }} className="text-xs text-slate-400 hover:text-slate-600">← Back</button>
                </div>
                {linkSent ? (
                  <div className="rounded-lg bg-white border border-emerald-200 px-4 py-3 text-sm text-emerald-700 font-medium">
                    ✓ Payment link sent to {linkPhone}. The student can pay via the link.
                  </div>
                ) : (
                  <>
                    <div className="flex gap-3 items-end">
                      <div className="flex-1">
                        <label className="text-xs text-emerald-700 mb-1 block">
                          Amount (₹){amtIsFixed && <span className="ml-1 text-emerald-500">(fixed instalment)</span>}
                        </label>
                        <input type="text" inputMode="numeric" value={amount}
                          onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                          readOnly={amtIsFixed} placeholder={`Max ${fmtINR(fs.remaining)}`}
                          className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 ${amtIsFixed ? 'bg-emerald-100 border-emerald-200 text-emerald-700 cursor-not-allowed' : 'border-emerald-200 bg-white'}`}
                          required />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-emerald-700 mb-1 block">Student Mobile Number</label>
                        <input type="tel" inputMode="numeric" maxLength={10} value={linkPhone}
                          onChange={e => setLinkPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          placeholder="10-digit mobile"
                          className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          required />
                      </div>
                    </div>
                    {linkErr && <p className="text-xs text-red-600">{linkErr}</p>}
                    <button type="submit" disabled={linkSending}
                      className="w-full rounded-lg bg-emerald-600 text-white text-sm font-semibold px-4 py-2 hover:bg-emerald-700 disabled:opacity-50 transition">
                      {linkSending ? 'Sending…' : 'Send via WhatsApp'}
                    </button>
                  </>
                )}
              </form>
            )}
          </>
        )}

        {/* Navigation */}
        <div className="flex gap-2 pt-2">
          <Button onClick={onGoToDetail} variant="secondary">View Application Detail</Button>
          <Button onClick={onAddNew} variant="secondary">+ Add New Application</Button>
          <Button onClick={onGoToInbox} className="ml-auto">Go to Inbox →</Button>
        </div>
      </div>
    </div>
  )
}

// ── Installment plan input for Step 6 ────────────────────────────────────────
function CollegeInstallmentInput({ installments, onChange, feeTotal, onError }) {
  const filled = installments.map(i => i.amount !== '' && parseFloat(i.amount) > 0)

  let fixedCount = 0
  for (let i = 0; i < 4; i++) {
    if (filled[i]) fixedCount = i + 1
    else break
  }

  const instTotal = installments.reduce((s, inst) => {
    const v = parseFloat(inst.amount)
    return s + (isNaN(v) ? 0 : v)
  }, 0)

  function handleChange(idx, field, val) {
    const next = installments.map((inst, i) => i === idx ? { ...inst, [field]: val } : inst)
    onChange(next)
    onError('')
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-700 mb-0.5">Installment Plan</p>
        <p className="text-xs text-slate-500">
          Fill installments the student <em>must</em> pay in order. Leave trailing rows empty for free payment.
        </p>
      </div>
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-600 w-28">Installment</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">Due Date</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600 w-32">Amount (₹)</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600 w-20">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {installments.map((inst, idx) => {
              const isFixed = filled[idx] && idx < fixedCount
              const isFree  = filled[idx] && idx === fixedCount - 1 && !filled[idx + 1]
                              && fixedCount > 0 && instTotal < (feeTotal || 0) - 0.01
              return (
                <tr key={idx} className={isFixed ? 'bg-slate-50/70' : ''}>
                  <td className="px-3 py-1.5 font-medium text-slate-600">Installment {idx + 1}</td>
                  <td className="px-3 py-1.5">
                    <input
                      type="date"
                      value={inst.due_date}
                      onChange={e => handleChange(idx, 'due_date', e.target.value)}
                      className="rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <input
                      type="text" inputMode="numeric"
                      value={inst.amount}
                      onChange={e => handleChange(idx, 'amount', e.target.value.replace(/[^0-9.]/g, ''))}
                      placeholder="0"
                      className="w-24 rounded border border-slate-200 px-2 py-1 text-right text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-slate-400 text-xs">
                    {isFixed && !isFree ? 'Fixed' : isFree ? 'Free' : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {instTotal > 0 && feeTotal != null && (
        <div className={`rounded-lg px-3 py-2 text-xs ${instTotal > feeTotal + 0.01 ? 'bg-red-50 border border-red-200 text-red-700' : instTotal < feeTotal - 0.01 ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'}`}>
          {instTotal > feeTotal + 0.01
            ? <>Installment total <strong>₹{instTotal.toLocaleString('en-IN')}</strong> exceeds the fee total <strong>₹{feeTotal.toLocaleString('en-IN')}</strong>.</>
            : instTotal < feeTotal - 0.01
            ? <>Student pays <strong>₹{instTotal.toLocaleString('en-IN')}</strong> in fixed installments, then pays the remaining <strong>₹{(feeTotal - instTotal).toLocaleString('en-IN')}</strong> freely.</>
            : <>Student pays exactly <strong>₹{feeTotal.toLocaleString('en-IN')}</strong> in {installments.filter((i, idx) => filled[idx]).length} installment{installments.filter((i, idx) => filled[idx]).length !== 1 ? 's' : ''}.</>
          }
        </div>
      )}
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
    category:       ap('category')       || '',
    special_status: ap('special_status') || '',
    fees_category:                app.fees_category                || '',
    fees_category_override:       !!app.fees_category_override,
    fees_category_override_remark:app.fees_category_override_remark || '',

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

const YEAR_LABEL = { 1: 'FY', 2: 'SY', 3: 'TY', 4: '4Y', 5: '5Y' }
