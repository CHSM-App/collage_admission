/**
 * ApplyWizard — multi-step application form.
 * Route: /apply/:applicationId   (applicationId may be 'new' on first entry)
 *
 * Query params on /apply/new:
 *   ?college_id=&course_id=&period_id=&academic_year=&year_of_study=
 *
 * Steps:
 *   1 — Application context (read-only)
 *   2 — Personal details
 *   3 — Other details
 *   4 — Previous exam details
 *   5 — Document upload
 *   6 — Review & declaration
 */

import { useEffect, useReducer, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuthContext } from '../../../context/AuthContext.jsx'
import api from '../../../services/api.js'
import StepIndicator from '../../../shared/components/StepIndicator.jsx'
import Button from '../../../shared/components/Button.jsx'
import { SkeletonForm } from '../../../shared/components/Skeleton.jsx'

import Step1Context      from './wizard/Step1Context.jsx'
import Step2Personal     from './wizard/Step2Personal.jsx'
import Step3Other        from './wizard/Step3Other.jsx'
import Step4Exam         from './wizard/Step4Exam.jsx'
import Step5Documents    from './wizard/Step5Documents.jsx'
import Step6Review       from './wizard/Step6Review.jsx'

const STEPS = ['Context', 'Personal', 'Other Details', 'Exam Details', 'Documents', 'Review']

// ── Reducer ──────────────────────────────────────────────────
const initialState = {
  applicationId: null,
  currentStep:   1,
  maxStep:       1,
  loading:       true,
  saving:        false,
  errors:        {},
  globalError:   '',
  data: {
    // Step 1 context (system)
    college_id: null, college_name: '', college_city: '',
    course_id:  null, course_name:  '',
    year_of_study: null, academic_year: '', application_fee: 0,
    // Step 2
    surname:'', first_name:'', middle_name:'', mother_name:'',
    sex:'', mobile:'', email:'',
    address:'', taluka:'', district:'', state:'',
    category:'', special_status:'', fees_category:'',
    fees_category_override: false, fees_category_override_remark: '',
    division: '', degree_course_code: '',
    // Step 3
    birth_date:'', birth_place:'', birth_taluka:'', birth_district:'', birth_state:'',
    nationality:'Indian', marital_status:'', religion:'', caste:'', mother_tongue:'',
    height_cm:'', weight_kg:'', blood_group:'',
    father_full_name:'', son_daughter_number:'', father_occupation:'', annual_income:'',
    aadhaar:'', prn:'', abc_id:'', university_app_no:'',
    bank_account:'', bank_ifsc:'', bank_name:'', bank_branch:'',
    // Step 4 — keyed by exam_type: SSC, HSC, FY_SEM1, FY_SEM2, SY_SEM1, SY_SEM2
    exams: {},
    // Step 5
    linked_documents: [],   // [{ document_type_id, document_name, file_name, file_path, is_mandatory }]
    required_documents: [], // from API
    student_documents: [],  // existing uploads from student_documents
    // Step 6
    declaration_accepted: false,
  },
}

// Students can only edit when draft (pre-submission) or when college explicitly requested correction
const EDITABLE_STATUSES = ['draft', 'correction_requested']

function reducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':    return { ...state, loading: action.value }
    case 'SET_SAVING':     return { ...state, saving: action.value }
    case 'SET_ERRORS':     return { ...state, errors: action.errors }
    case 'CLEAR_ERRORS':   return { ...state, errors: {}, globalError: '' }
    case 'SET_GLOBAL_ERR': return { ...state, globalError: action.message }
    case 'SET_STEP':       return { ...state, currentStep: action.step, errors: {}, globalError: '' }
    case 'INIT_APP':
      return {
        ...state,
        applicationId:       action.applicationId,
        currentStep:         action.currentStep,
        maxStep:             action.currentStep,
        appStatus:           action.appStatus,
        applicationFeePaid:  action.applicationFeePaid,
        correctionNote:      action.correctionNote || null,
        loading:             false,
      }
    case 'SET_DATA':
      return { ...state, data: { ...state.data, ...action.patch } }
    case 'SET_MAX_STEP':
      return { ...state, maxStep: Math.max(state.maxStep, action.step) }
    default: return state
  }
}

export default function ApplyWizard() {
  const { applicationId: paramId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()
  const { user }       = useAuthContext()
  const [state, dispatch] = useReducer(reducer, initialState)

  // ── Init: create or resume application ─────────────────────
  useEffect(() => {
    async function init() {
      dispatch({ type: 'SET_LOADING', value: true })

      try {
        let appId = paramId !== 'new' ? parseInt(paramId) : null

        if (!appId) {
          // Create draft from query params
          const college_id       = searchParams.get('college_id')
          const course_id        = searchParams.get('course_id')
          const period_id        = searchParams.get('period_id')
          const academic_year    = searchParams.get('academic_year')
          const year_of_study    = searchParams.get('year_of_study') || undefined

          const initRes = await api.post('api/applications/init', {
            student_id:         user.id,
            college_id:         parseInt(college_id),
            course_id:          parseInt(course_id),
            admission_period_id: parseInt(period_id),
            academic_year,
            year_of_study,
          })

          appId = initRes.data.data.application_id

          // Replace URL so refresh doesn't re-create
          navigate(`/apply/${appId}`, { replace: true })
        }

        // Fetch full form data
        const formRes = await api.get(`api/applications/${appId}/form`)
        const { application: app, previous_exam, documents } = formRes.data.data

        // Fetch autofill
        const fillRes = await api.get(`api/student-profile/autofill?student_id=${user.id}`)
        const { profile, last_application } = fillRes.data.data

        // Merge: app fields > last_application > profile
        const merged = buildAutofill(app, last_application || {}, profile || {}, user)

        // Fetch student's existing documents
        const sdRes = await api.get(`student-documents?student_id=${user.id}`)
        const studentDocs = sdRes.data.data || []

        // Fetch required documents
        const rdRes = await api.get(
          `api/required-documents?college_id=${app.college_id}&course_id=${app.course_id}&year=${app.year_of_study}`
        )
        const requiredDocs = rdRes.data.data || []

        // Build exams map from previous_exams keyed by exam_type
        const { previous_exams } = formRes.data.data
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

        dispatch({
          type: 'SET_DATA',
          patch: {
            ...merged,
            exams: examsData,
            linked_documents: documents,
            required_documents: requiredDocs,
            student_documents: studentDocs,
          },
        })

        const resumeStep = app.current_step || 1
        dispatch({ type: 'INIT_APP', applicationId: appId, currentStep: resumeStep, appStatus: app.status, applicationFeePaid: !!app.application_fee_paid, correctionNote: app.correction_note || null })
      } catch (err) {
        dispatch({ type: 'SET_GLOBAL_ERR', message: err?.response?.data?.message || 'Failed to load application.' })
        dispatch({ type: 'SET_LOADING', value: false })
      }
    }

    init()
  }, [paramId])

  // ── Field change handler ────────────────────────────────────
  const setField = useCallback((name, value) => {
    dispatch({ type: 'SET_DATA', patch: { [name]: value } })
    dispatch({ type: 'CLEAR_ERRORS' })
  }, [])

  const handleChange = useCallback((e) => {
    setField(e.target.name, e.target.value)
  }, [setField])

  // Scroll to top on every step change
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }, [state.currentStep])

  // ── Navigate steps ──────────────────────────────────────────
  function goStep(n) {
    dispatch({ type: 'SET_STEP', step: n })
  }

  // ── Save step and advance ───────────────────────────────────
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
      if (resp?.errors) {
        dispatch({ type: 'SET_ERRORS', errors: resp.errors })
      } else {
        dispatch({ type: 'SET_GLOBAL_ERR', message: resp?.message || 'Save failed. Please try again.' })
      }
    } finally {
      dispatch({ type: 'SET_SAVING', value: false })
    }
  }

  const { data, currentStep, loading, saving, errors, globalError, applicationId, appStatus, applicationFeePaid, correctionNote } = state
  const readOnly = !!appStatus && !EDITABLE_STATUSES.includes(appStatus)

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
          <button onClick={() => navigate(-1)} className="mt-4 text-sm text-blue-600 hover:underline">
            ← Go back
          </button>
        </div>
      </div>
    )
  }

  const stepProps = { data, errors, globalError, saving, onChange: handleChange, setField, readOnly }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-3xl flex items-center gap-3">
          <button
            onClick={() => navigate('/student/dashboard?section=applications')}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            aria-label="Back"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/>
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">{data.college_name || 'Apply for Admission'}</p>
            <p className="text-xs text-slate-400">{data.course_name} · {YEAR_LABEL[data.year_of_study]} · {data.academic_year}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        {/* Step indicator */}
        <StepIndicator steps={STEPS} current={currentStep} />

        {/* Read-only banner */}
        {readOnly && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 font-medium">
            Your application has been accepted by the college and can no longer be edited.
          </div>
        )}

        {/* Correction requested banner */}
        {appStatus === 'correction_requested' && !readOnly && (
          <div className="rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-800">
            <p className="font-semibold">The college has requested corrections to your application.</p>
            {correctionNote && (
              <p className="mt-2 text-orange-900 whitespace-pre-wrap">{correctionNote}</p>
            )}
            <p className="mt-1.5">Please make the required changes and resubmit.</p>
          </div>
        )}

        {/* Global error */}
        {globalError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {globalError}
          </div>
        )}

        {/* Step panels */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {currentStep === 1 && (
            <Step1Context
              {...stepProps}
              onNext={() => saveAndNext(null, null, 2)}
            />
          )}
          {currentStep === 2 && (
            <Step2Personal
              {...stepProps}
              appId={applicationId}
              onBack={() => goStep(1)}
              onNext={(body) => saveAndNext('personal-details', body, 3)}
            />
          )}
          {currentStep === 3 && (
            <Step3Other
              {...stepProps}
              onBack={() => goStep(2)}
              onNext={(body) => saveAndNext('other-details', body, 4)}
            />
          )}
          {currentStep === 4 && (
            <Step4Exam
              {...stepProps}
              onBack={() => goStep(3)}
              onNext={(body) => saveAndNext('previous-exam', body, 5)}
            />
          )}
          {currentStep === 5 && (
            <Step5Documents
              {...stepProps}
              appId={applicationId}
              studentId={user.id}
              onBack={() => goStep(4)}
              onNext={() => {
                dispatch({ type: 'SET_MAX_STEP', step: 6 })
                dispatch({ type: 'SET_STEP', step: 6 })
              }}
              onDocumentsChange={(linked, studentDocs) => dispatch({ type: 'SET_DATA', patch: { linked_documents: linked, ...(studentDocs && { student_documents: studentDocs }) } })}
            />
          )}
          {currentStep === 6 && (
            <Step6Review
              {...stepProps}
              appId={applicationId}
              applicationFeePaid={applicationFeePaid}
              onBack={() => goStep(5)}
              onEditStep={goStep}
              onDone={() => navigate(`/student/dashboard?section=applications`)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Autofill merger ──────────────────────────────────────────
function buildAutofill(app, lastApp, profile, user) {
  function pick(sources, key) {
    for (const src of sources) {
      if (src[key] !== null && src[key] !== undefined && src[key] !== '') return src[key]
    }
    return ''
  }

  // app_ prefixed fields from applications table
  const appPrefix = (k) => app[`app_${k}`] ?? lastApp[`app_${k}`] ?? ''

  return {
    // Context (from application record)
    college_id:    app.college_id,
    college_name:  app.college_name,
    college_city:  app.college_city,
    course_id:     app.course_id,
    course_name:   app.course_name,
    year_of_study: app.year_of_study,
    academic_year: app.academic_year,
    application_fee: app.application_fee,

    // Step 2 personal
    surname:      appPrefix('surname')    || pick([profile], 'surname')    || '',
    first_name:   appPrefix('first_name') || pick([profile], 'first_name') || '',
    middle_name:  appPrefix('middle_name')|| pick([profile], 'middle_name')|| '',
    mother_name:  appPrefix('mother_name')|| pick([profile], 'mother_name')|| '',
    sex:          appPrefix('sex')        || pick([profile], 'sex')        || '',
    mobile:       appPrefix('mobile')     || profile.phone || '',
    email:        user.email,
    address:      appPrefix('address')    || profile.address || '',
    taluka:       appPrefix('taluka')     || '',
    district:     appPrefix('district')   || '',
    state:        appPrefix('state')      || '',
    category:        appPrefix('category')       || profile.category || '',
    special_status:  appPrefix('special_status') || '',
    fees_category:   app.fees_category           || '',
    fees_category_override:        app.fees_category_override        || false,
    fees_category_override_remark: app.fees_category_override_remark || '',
    division:            app.app_division            || '',
    degree_course_code:  app.app_degree_course_code  || '',

    // Step 3 other
    birth_date:         formatDate(appPrefix('birth_date')) || formatDate(profile.birth_date) || '',
    birth_place:        appPrefix('birth_place')     || profile.birth_place    || '',
    birth_taluka:       appPrefix('birth_taluka')    || profile.birth_taluka   || '',
    birth_district:     appPrefix('birth_district')  || profile.birth_district || '',
    birth_state:        appPrefix('birth_state')     || profile.birth_state    || '',
    nationality:        appPrefix('nationality')     || profile.nationality    || 'Indian',
    marital_status:     appPrefix('marital_status')  || profile.marital_status || '',
    religion:           appPrefix('religion')        || profile.religion       || '',
    caste:              appPrefix('caste')           || profile.caste          || '',
    mother_tongue:      appPrefix('mother_tongue')   || profile.mother_tongue  || '',
    height_cm:          appPrefix('height_cm')       || profile.height_cm      || '',
    weight_kg:          appPrefix('weight_kg')       || profile.weight_kg      || '',
    blood_group:        appPrefix('blood_group')     || profile.blood_group    || '',
    father_full_name:   appPrefix('father_full_name')|| profile.father_full_name   || '',
    son_daughter_number:appPrefix('son_daughter_no') || profile.son_daughter_number|| '',
    father_occupation:  appPrefix('father_occupation')|| profile.father_occupation || '',
    annual_income:      appPrefix('annual_income')   || profile.annual_income  || '',
    aadhaar:            appPrefix('aadhaar')         || profile.aadhaar        || '',
    prn:                appPrefix('prn')             || profile.prn            || '',
    abc_id:             appPrefix('abc_id')          || profile.abc_id         || '',
    university_app_no:  appPrefix('university_app_no') || '',
    bank_account:       appPrefix('bank_account')    || profile.bank_account   || '',
    bank_ifsc:          appPrefix('bank_ifsc')       || profile.bank_ifsc      || '',
    bank_name:          appPrefix('bank_name')       || profile.bank_name      || '',
    bank_branch:        appPrefix('bank_branch')     || profile.bank_branch    || '',
  }
}

function formatDate(d) {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date)) return ''
  return date.toISOString().slice(0, 10)
}

const YEAR_LABEL = { 1: 'FY', 2: 'SY', 3: 'TY', 4: '4Y', 5: '5Y' }
