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
import scrollToField from '../../../shared/scrollToField.js'
import { useEffect, useReducer, useCallback, useState, cloneElement } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuthContext } from '../../../context/AuthContext.jsx'
import {
  initApplicationByCollege, getApplicationForm, updateApplicationStep,
  acceptDeclaration, submitApplication, getRequiredDocuments, getStudentAutofill,
} from '../../../services/applicationService.js'
import { getStudentDocuments } from '../../../services/documentService.js'
import {
  recordApplicationFee, sendPaymentLink,
  confirmApplication, getComputedFee, postApplicationAction, setApplicationFee,
} from '../../../services/collegeAdminService.js'
import { getDivisions } from '../../../services/masterService.js'
import { initiatePayment } from '../../../services/paymentService.js'
import StepIndicator from '../../../shared/components/StepIndicator.jsx'
import Button from '../../../shared/components/Button.jsx'
import { SkeletonForm, SkeletonCards } from '../../../shared/components/Skeleton.jsx'
import { useCollegePayment } from '../../../shared/hooks/useCollegePayment.js'
import CollegeCollectPayPanel from '../components/CollegeCollectPayPanel.jsx'

import Step2Personal  from '../../student/pages/wizard/Step2Personal.jsx'
import Step3Other     from '../../student/pages/wizard/Step3Other.jsx'
import Step4Exam      from '../../student/pages/wizard/Step4Exam.jsx'
import Step5Documents from '../../student/pages/wizard/Step5Documents.jsx'
import Step6Groups    from '../../student/pages/wizard/Step6Groups.jsx'
import GroupSelectionReview from '../../student/pages/wizard/GroupSelectionReview.jsx'

const ALL_STEPS     = ['Personal', 'Other Details', 'Exam Details', 'Documents', 'Subject Group', 'Review & Confirm', 'Fee Collection']
// Exam Details is step 3 here (the college side has no Context step).
const EXAM_STEP     = 3
const STEPS_NO_FEE  = ['Personal', 'Other Details', 'Exam Details', 'Documents', 'Subject Group', 'Review & Confirm']

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
               appStatus: action.appStatus, features: action.features || null,
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
  // Returning from a college-initiated online application-fee payment (PaymentResult adds ?paid=online)
  const paidOnline = searchParams.get('paid') === 'online'
  const [registrationNumber, setRegistrationNumber] = useState(() => paidOnline ? (searchParams.get('reg') || '') : null)
  const [feeUiOpen, setFeeUiOpen] = useState(false)   // reveal fee-collection UI without submitting yet
  const [submitError, setSubmitError]               = useState('')
  const [feeCollected, setFeeCollected]             = useState(false)
  const [admissionConfirmed, setAdmissionConfirmed] = useState(false)
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
        const { application: app, features, previous_exam, previous_exams, documents } = formRes.data.data

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
        // unless college_fee feature is off — in that case stay at step 5 (review)
        const collegeFeeOff = features?.payment?.college_fee === false
        const startStep = (paidOnline || (app.status === 'submitted' && !collegeFeeOff)) ? 6 : wizStep
        dispatch({ type: 'INIT_APP', applicationId: appId, studentId, currentStep: startStep, appStatus: app.status, features })
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
      if (resp?.errors) { dispatch({ type: 'SET_ERRORS', errors: resp.errors }); scrollToField(Object.keys(resp.errors)[0]) }
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

      // When an application fee is owed, DO NOT submit/confirm yet — the app must
      // stay a draft until the fee is actually collected (recordApplicationFee
      // performs the submission). This prevents the app being confirmed while the
      // fee is still unpaid. We just reveal the fee-collection UI here.
      const platformFeeOwed = state.features?.payment?.platform_fee !== false && appFee > 0
      if (platformFeeOwed) {
        setFeeUiOpen(true)   // reveal the fee-collection UI; submission happens on fee collection
        return
      }

      // No application fee → submit directly.
      const submitRes = await submitApplication(state.applicationId)
      setRegistrationNumber(submitRes.data.data?.registration_number || '')
    } catch (err) {
      const resp = err?.response?.data
      setSubmitError(resp?.message || 'Submission failed. Please try again.')
    } finally {
      dispatch({ type: 'SET_SAVING', value: false })
    }
  }

  // Called from CollegeReviewStep once application is submitted (app fee done or zero)
  function handleProceedToFees() {
    if (state.features?.payment?.college_fee === false) {
      navigate(`/college/dashboard?section=app&app_id=${state.applicationId}`)
      return
    }
    dispatch({ type: 'SET_MAX_STEP', step: 7 })
    dispatch({ type: 'SET_STEP', step: 7 })
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

  const { data, currentStep, loading, saving, errors, globalError, applicationId, studentId, appStatus, features } = state
  // Edit mode: app already submitted — save changes and return, no re-submit
  // Just paid online → continue the add-application flow (confirm, fees), not edit mode
  const isEditMode = !paidOnline && !!appStatus && appStatus !== 'draft'

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

  const stepProps = { data, errors, globalError, saving, onChange: handleChange, setField, features }

  // The exam step's table is 10 columns with min-widths totalling ~1160px, so it
  // scrolled sideways at the old max-w-3xl. Every other step is a short form
  // that reads worse stretched, so the shell widens only where it has to.
  const shellWidth = currentStep === EXAM_STEP ? 'max-w-7xl' : 'max-w-5xl'

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3">
        <div className={`mx-auto ${shellWidth} flex items-center gap-3`}>
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

      <div className={`mx-auto ${shellWidth} px-4 py-6 space-y-6`}>
        <StepIndicator steps={features?.payment?.college_fee === false ? STEPS_NO_FEE : ALL_STEPS} current={currentStep} />


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
              isCollege
              appId={applicationId}
              onBack={() => navigate('/college/dashboard?section=inbox')}
              onNext={(body) => saveAndNext('personal-details', body, 2)}
              // Only Personal is mandatory for college entry — the rest can be filled later
              onSkipToReview={(body) => saveAndNext('personal-details', body, 6)}
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

          {/* Step 5 — Subject group. Optional here: staff entering an
              application may not know the student's choice yet. */}
          {currentStep === 5 && (
            <Step6Groups
              {...stepProps}
              step={5}
              appId={applicationId}
              skippable
              onBack={() => goStep(4)}
              onNext={() => skip(6)}
            />
          )}

          {/* Step 6 — Review & submit */}
          {currentStep === 6 && (
            <CollegeReviewStep
              data={data}
              appId={applicationId}
              saving={saving}
              submitError={submitError}
              isEditMode={isEditMode}
              onBack={() => goStep(5)}
              onEditStep={goStep}
              onSubmit={handleFinalSubmit}
              onSaveAndReturn={() => navigate(`/college/dashboard?section=app&app_id=${applicationId}`)}
              onProceedToFees={handleProceedToFees}
              onAddNew={() => navigate('/college/dashboard?section=add-application')}
              admissionConfirmed={admissionConfirmed || ['confirmed', 'fees_paid', 'roll_assigned', 'enrolled'].includes(appStatus)}
              feeConfirm={state.features?.payment?.college_fee === false ? null : (
                <CollegeFeeConfirmStep
                  applicationId={applicationId}
                  collegeId={collegeId}
                  courseId={data.course_id}
                  yearOfStudy={data.year_of_study}
                  appDivision={data.app_division}
                  onConfirmed={(addNew) => {
                    setAdmissionConfirmed(true)
                    if (addNew) navigate('/college/dashboard?section=add-application')
                    else handleProceedToFees()
                  }}
                />
              )}
              submitted={registrationNumber !== null || feeUiOpen}
              registrationNumber={registrationNumber}
              features={state.features}
              appFee={appFee}
              feeCollected={feeCollected || paidOnline}
              feePaidOnline={paidOnline}
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

          {/* Step 7 — Fee collection only (admission was confirmed on Review) */}
          {currentStep === 7 && (
            <div className="px-5 py-5 space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
                <p className="font-bold text-emerald-800">Admission Confirmed</p>
                <p className="text-emerald-700 mt-0.5">Collect the college fee now, or later from the application.</p>
              </div>
              <CollegeFeePaySection
                applicationId={applicationId}
                collegeId={collegeId}
                onGoToInbox={() => navigate('/college/dashboard?section=inbox')}
                onGoToDetail={() => navigate(`/college/dashboard?section=app&app_id=${applicationId}`)}
                onAddNew={() => navigate('/college/dashboard?section=add-application')}
              />
              <Button variant="secondary" onClick={() => goStep(6)}>← Back</Button>
            </div>
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
  data, appId, saving, submitError, isEditMode, onBack, onEditStep, onSubmit, onSaveAndReturn, onProceedToFees, feePaidOnline,
  feeConfirm, admissionConfirmed,
  submitted, registrationNumber, features, appFee,
  feeCollected, linkSent, feeMode, setFeeMode, feeError, setFeeError,
  feeCollecting, onlinePaying, linkSending, linkPhone, setLinkPhone,
  onCollectCash, onPayOnline, onSendLink, onAddNew,
}) {
  const d = data
  const linkedMap = Object.fromEntries((d.linked_documents || []).map(doc => [doc.document_type_id, doc]))

  // After submission: determine if the app fee (platform_fee) has been handled.
  // platform_fee controls whether the college must collect the application fee before proceeding.
  // college_fee controls the admission fee collection step (Step 6) — separate concept.
  const platformFeeRequired = features?.payment?.platform_fee !== false && appFee > 0
  const appFeeHandled = !platformFeeRequired || feeCollected || linkSent

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
        {(() => {
          const af = features?.admission_form || {}
          const feesEnabled = features?.payment?.college_fee !== false
          return (
            <ReviewSection
              title="Personal Details"
              onEdit={() => onEditStep(1)}
              rows={[
                af.semester === true          && ['Semester', d.semester ? `Semester ${d.semester}` : ''],
                af.date_of_admission === true && ['Date of Admission', d.date_of_admission],
                af.diploma_direct_sy === true && ['Diploma (Direct SY)', d.is_diploma_direct_sy ? 'Yes' : 'No'],
                ['Name', [d.surname, d.first_name, d.middle_name].filter(Boolean).join(' ')],
                af.name_as_on_aadhaar === true && ['Name as on Aadhaar', d.name_as_on_aadhaar],
                af.son_of === true            && ['S/o', d.son_of],
                ["Mother's First Name", d.mother_name],
                ['Gender', d.sex],
                ['Mobile', d.mobile],
                ['Parent\'s Mobile', d.parent_mobile],
                ['Land Line', d.land_line],
                ['Email', d.email],
                ['Guardian\'s Relation', d.guardian_relation],
                ['Category', d.app_category || d.category],
                af.admitted_category === true && ['Admitted Category', d.admitted_category],
                af.other_category === true    && ['Other Category', d.other_category],
                af.admission_quota === true   && ['Admission Quota', d.admission_quota],
                ['Special Status', d.special_status],
                feesEnabled                   && ['Fees Category', d.fees_category],
                ['Address', [d.address, d.taluka, d.district, d.state].filter(Boolean).join(', ')],
                ['Native Address', [d.native_address, d.native_taluka, d.native_district, d.native_state].filter(Boolean).join(', ')],
              ].filter(Boolean)}
            />
          )
        })()}

        {/* Other */}
        <ReviewSection
          title="Other Details"
          optional
          onEdit={() => onEditStep(2)}
          rows={[
            ['DOB', d.birth_date],
            ['Birth Place', [d.birth_place, d.birth_taluka, d.birth_district, d.birth_state].filter(Boolean).join(', ')],
            ['Nationality', d.nationality],
            ['Marital Status', d.marital_status],
            ['Religion', d.religion],
            ['Caste', d.caste],
            ['Mother Tongue', d.mother_tongue],
            ['Blood Group', d.blood_group],
            ['Height', d.height_cm ? `${d.height_cm} cm` : ''],
            ['Weight', d.weight_kg ? `${d.weight_kg} kg` : ''],
            ["Father's Name", d.father_full_name],
            ['Son/Daughter No.', d.son_daughter_number],
            ["Father's Occupation", d.father_occupation],
            ['Annual Income', d.annual_income ? `₹${Number(d.annual_income).toLocaleString('en-IN')}` : ''],
            ['Aadhaar', d.aadhaar],
            ['ABC ID', d.abc_id],
            ['PRN/ERN', d.prn],
            ['University App No.', d.university_app_no],
            ['Bank', [d.bank_name, d.bank_account, d.bank_ifsc].filter(Boolean).join(' · ')],
          ]}
        />

        {/* Exam */}
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Exam Details</p>
              {Object.keys(d.exams || {}).length === 0 && (
                <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-700">Not filled</span>
              )}
            </div>
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

        {/* Subject Group — renders nothing when the course defines no groups */}
        <GroupSelectionReview appId={appId} onEdit={() => onEditStep(5)} />

        {/* Fee breakdown — a normal review section until admission is confirmed */}
        {feeConfirm && !admissionConfirmed && cloneElement(feeConfirm, { part: 'breakdown' })}

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
                    {feeCollected && appFee > 0 && <p className="text-emerald-700 mt-0.5">Application fee of ₹{appFee.toLocaleString('en-IN')} {feePaidOnline ? 'paid online' : 'collected (cash)'}.</p>}
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

            {/* App fee collection options — shown when platform_fee is enabled and fee not yet collected */}
            {platformFeeRequired && !feeCollected && !linkSent && (
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

            {/* Proceed to Step 6 (or go to application if college_fee is off) — shown once app fee is handled */}

            {appFeeHandled && (!feeConfirm || admissionConfirmed) && (
              <div className="flex flex-col-reverse sm:flex-row gap-2">
                <Button variant="secondary" onClick={onAddNew} className="sm:ml-auto">
                  + Add New Application
                </Button>
                <Button onClick={onProceedToFees}>
                  {features?.payment?.college_fee === false
                    ? 'Go to Application →'
                    : 'Fees Collection →'
                  }
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Confirm buttons — after the application-fee status. Need a submitted application with its fee handled. */}
        {feeConfirm && !admissionConfirmed && cloneElement(feeConfirm, { part: 'actions', canConfirm: submitted && appFeeHandled })}

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

// ── Fee breakdown, optional installment plan & admission confirmation ──
// Rendered inside the Review step once the application is submitted.
// onConfirmed(addNew) — admission confirmed; parent decides where to go next.
// canConfirm — false until the application fee is handled (confirm needs a submitted application).
// part — 'breakdown': the fee card; 'actions': just the confirm buttons (placed below the
// application-fee status). Two instances, so each part can sit where it reads best.
function CollegeFeeConfirmStep({ applicationId, collegeId, courseId, yearOfStudy, appDivision, onConfirmed, canConfirm = true, part = 'breakdown' }) {
  const YEAR_MAP = { 1: 'FY', 2: 'SY', 3: 'TY', 4: '4Y', 5: '5Y' }

  const [divisions,      setDivisions]      = useState([])
  const [division,       setDivision]       = useState(appDivision || '')
  const [feeTotal,       setFeeTotal]       = useState(null)
  const [feeBreakdown,   setFeeBreakdown]   = useState([])
  const [feeStudentType, setFeeStudentType] = useState(null)
  const [feeLoading,     setFeeLoading]     = useState(false)
  const [confirming,   setConfirming]   = useState(false)
  const [confirmError, setConfirmError] = useState('')

  // Load divisions once
  useEffect(() => {
    if (!collegeId || !courseId || !yearOfStudy) return
    const yearLevel = YEAR_MAP[yearOfStudy] || 'FY'
    getDivisions(collegeId, courseId, yearLevel)
      .then(r => setDivisions((r.data.data || []).filter(d => d.is_active)))
      .catch(() => {})
  }, [collegeId, courseId, yearOfStudy])

  // Sync division from prop whenever it arrives (appDivision loads async with form data)
  useEffect(() => {
    if (appDivision && !division) setDivision(appDivision)
  }, [appDivision])

  // Recompute fee whenever division changes
  useEffect(() => {
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

  async function handleConfirm({ addNew = false } = {}) {
    setConfirmError('')
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
        installments:          [],   // plan is set (optionally) on the Fee Collection step
        division:              division || null,
        document_ids_verified: [],
      })
      onConfirmed(addNew)
    } catch (err) {
      setConfirmError(err?.response?.data?.message || 'Failed to confirm admission.')
    } finally {
      setConfirming(false)
    }
  }

  if (part === 'actions') {
    if (!canConfirm) return null
    return (
      <div className="space-y-3">
        {confirmError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{confirmError}</div>
        )}
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <Button variant="secondary" onClick={() => handleConfirm({ addNew: true })} loading={confirming} disabled={feeLoading || feeTotal == null}>
            Confirm &amp; Add New Application
          </Button>
          <Button onClick={() => handleConfirm({ addNew: false })} loading={confirming} disabled={feeLoading || feeTotal == null}>
            Confirm &amp; Collect Fee →
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-100">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Fee &amp; Admission Confirmation</p>
        <p className="mt-0.5 text-xs text-slate-500">Review the fees, then confirm admission once the application fee is paid. Installments and fee collection come next.</p>
      </div>

      <div className="px-4 py-4 space-y-6">
          <>
            {/* ── Fee breakdown ─────────────────────────────────── */}
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


            </>
          </>
      </div>
    </div>
  )
}

// ── College fee payment section (after admission confirmed) ──────────────────
// Optional installment plan, set after admission is confirmed. Empty = free payment.
function InstallmentPlanEditor({ applicationId, collegeId, feeTotal, existing, onSaved }) {
  const blank = { amount: '', due_date: '' }
  const [rows, setRows]     = useState(() => {
    const filled = (existing || []).map(i => ({ amount: String(i.amount), due_date: i.due_date ? String(i.due_date).slice(0, 10) : '' }))
    return [...filled, ...Array(Math.max(0, 4 - filled.length)).fill(blank)]
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [saved, setSaved]   = useState(false)

  async function save() {
    setError(''); setSaved(false)
    const valid = rows.filter(i => i.amount !== '' && parseFloat(i.amount) > 0)
    const total = valid.reduce((s, i) => s + parseFloat(i.amount), 0)
    if (total > feeTotal + 0.01) {
      setError(`Installment total (₹${total.toLocaleString('en-IN')}) cannot exceed fee total (₹${feeTotal.toLocaleString('en-IN')}).`)
      return
    }
    setSaving(true)
    try {
      await setApplicationFee(collegeId, applicationId, {
        installments: valid.map((i, idx) => ({ installment_no: idx + 1, amount: parseFloat(i.amount), due_date: i.due_date || null })),
      })
      setSaved(true)
      onSaved()
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not save the installment plan.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <CollegeInstallmentInput installments={rows} onChange={r => { setRows(r); setSaved(false) }} feeTotal={feeTotal} onError={setError} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm text-emerald-700">✓ Plan saved</span>}
        <Button variant="secondary" onClick={save} loading={saving}>Save Plan</Button>
      </div>
    </div>
  )
}

// Step 7 payment area: optional installment plan + the same collect-payment panel
// the application page uses, so both screens always behave identically.
function CollegeFeePaySection({ applicationId, collegeId, onGoToInbox, onGoToDetail, onAddNew }) {
  // Bumped on plan save or payment, so the plan editor and the panel re-read the fee status
  const [feeVersion, setFeeVersion] = useState(0)
  const { feeStatus: fs, loading } = useCollegePayment(applicationId, collegeId, { refreshKey: feeVersion })
  const bump = () => setFeeVersion(v => v + 1)

  if (loading && !fs) return <SkeletonCards count={2} />

  return (
    <div className="space-y-4">
      {/* Plan can be changed until something has been paid */}
      {fs && fs.total_fee > 0 && !(fs.total_paid > 0) && (
        <InstallmentPlanEditor
          key={JSON.stringify(fs.installments || [])}
          applicationId={applicationId}
          collegeId={collegeId}
          feeTotal={fs.total_fee}
          existing={fs.installments}
          onSaved={bump}
        />
      )}

      <CollegeCollectPayPanel appId={applicationId} collegeId={collegeId} refreshKey={feeVersion} onPaid={bump} />

      <div className="flex flex-wrap gap-2">
        <Button onClick={onGoToDetail} variant="secondary">View Application Detail</Button>
        <Button onClick={onAddNew} variant="secondary">+ Add New Application</Button>
        <Button onClick={onGoToInbox} className="ml-auto">Go to Inbox →</Button>
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
        <p className="text-sm font-semibold text-slate-700 mb-0.5">Installment Plan <span className="text-xs font-normal text-slate-400">(Optional)</span></p>
        <p className="text-xs text-slate-500">
          Leave all rows empty to let the student pay the full amount freely. Fill installments to enforce a payment schedule.
        </p>
      </div>
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-600 w-28">Installment</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">Due Date</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600 w-32">Amount (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {installments.map((inst, idx) => {
              const isFixed = filled[idx] && idx < fixedCount
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
            <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-700">Not filled</span>
          )}
        </div>
        <button onClick={onEdit} className="text-xs text-blue-600 hover:underline">Edit</button>
      </div>
      <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
        {rows.map(([label, value], i) => (
          <div key={i} className="flex gap-2 text-sm min-w-0">
            {label && <span className="shrink-0 text-slate-400 w-28">{label}:</span>}
            <span className={`break-words min-w-0 ${value ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
              {value || '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────
function buildAutofill(app, lastApp, profile) {
  const ap = (k) => app[`app_${k}`] ?? lastApp[`app_${k}`] ?? ''
  // Checkbox (BIT) fields must resolve to a real boolean, not ''.
  const apBool = (k) => !!(app[`app_${k}`] ?? lastApp[`app_${k}`])
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
    admitted_category: ap('admitted_category') || '',
    other_category:    ap('other_category')    || '',
    admission_quota:   ap('admission_quota')   || '',
    date_of_admission:    formatDate(ap('date_of_admission')) || '',
    is_diploma_direct_sy: !!(app.app_is_diploma_direct_sy ?? lastApp.app_is_diploma_direct_sy),
    name_as_on_aadhaar:   ap('name_as_on_aadhaar') || '',
    son_of:               ap('son_of')             || '',
    native_address:       ap('native_address')     || '',
    native_taluka:        ap('native_taluka')      || '',
    native_district:      ap('native_district')    || '',
    native_state:         ap('native_state')       || '',
    parent_mobile:        ap('parent_mobile')      || '',
    land_line:            ap('land_line')          || '',
    guardian_relation:    ap('guardian_relation')  || '',
    semester:             (app.app_semester ?? lastApp.app_semester) != null ? String(app.app_semester ?? lastApp.app_semester) : '',
    father_surname:     ap('father_surname')     || '',
    father_first_name:  ap('father_first_name')  || '',
    father_middle_name: ap('father_middle_name') || '',
    mother_surname:     ap('mother_surname')     || '',
    mother_first_name:  ap('mother_first_name')  || '',
    mother_middle_name: ap('mother_middle_name') || '',
    hsc_maths:          apBool('hsc_maths'),
    hsc_biology:        apBool('hsc_biology'),
    hostel_facility:    apBool('hostel_facility'),
    app_division:                 app.app_division                 || '',
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
