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
 *   6 — Subject group (skipped when the course defines none)
 *   7 — Review & declaration
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApplicationForm } from '../hooks/useApplicationForm.js'
import { useCollege } from '../../../context/CollegeContext.jsx'
import { STUDENT_PATHS } from '../../../app/routePaths.js'
import StepIndicator from '../../../shared/components/StepIndicator.jsx'
import Button from '../../../shared/components/Button.jsx'
import { SkeletonForm } from '../../../shared/components/Skeleton.jsx'

import Step1Context      from './wizard/Step1Context.jsx'
import Step2Personal     from './wizard/Step2Personal.jsx'
import Step3Other        from './wizard/Step3Other.jsx'
import Step4Exam         from './wizard/Step4Exam.jsx'
import Step5Documents    from './wizard/Step5Documents.jsx'
import Step6Groups       from './wizard/Step6Groups.jsx'
import Step6Review       from './wizard/Step6Review.jsx'

// Review is always the last step; the group step sits before it and only
// exists when the course actually defines groups (see hasGroups).
const BASE_STEPS  = ['Context', 'Personal', 'Other Details', 'Exam Details', 'Documents']
const REVIEW_STEP = 7
const GROUP_STEP  = 6

const YEAR_LABEL = { 1: 'FY', 2: 'SY', 3: 'TY', 4: '4Y', 5: '5Y' }

export default function ApplyWizard() {
  const navigate = useNavigate()
  const college  = useCollege()
  const applicationsPath = `${STUDENT_PATHS.dashboard(college?.code)}?section=applications`

  const {
    data,
    currentStep,
    loading,
    saving,
    errors,
    globalError,
    applicationId,
    studentId,
    appStatus,
    applicationFeePaid,
    correctionNote,
    features,
    hasGroups,
    readOnly,
    handleChange,
    setField,
    goStep,
    saveAndNext,
    setDocuments,
    advanceToStep,
  } = useApplicationForm()

  // Scroll to top on every step change
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }, [currentStep])

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

  const stepProps = { data, errors, globalError, saving, onChange: handleChange, setField, readOnly, features }

  // A draft saved before the group step existed resumes at 6, which is now the
  // group step — correct when the course has groups, but it would strand a
  // course that has none, so send those straight to Review.
  const steps       = hasGroups ? [...BASE_STEPS, 'Subject Group', 'Review'] : [...BASE_STEPS, 'Review']
  const afterDocs   = hasGroups ? GROUP_STEP : REVIEW_STEP
  const displayStep = !hasGroups && currentStep >= GROUP_STEP ? steps.length : currentStep

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-3xl flex items-center gap-3">
          <button
            onClick={() => navigate(applicationsPath)}
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
        <StepIndicator steps={steps} current={displayStep} />

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
              onNext={() => saveAndNext('confirm-context', {}, 2)}
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
              studentId={studentId}
              onBack={() => goStep(4)}
              onNext={() => advanceToStep(afterDocs)}
              onDocumentsChange={setDocuments}
            />
          )}
          {currentStep === GROUP_STEP && hasGroups && (
            <Step6Groups
              {...stepProps}
              step={GROUP_STEP}
              appId={applicationId}
              onBack={() => goStep(5)}
              onNext={() => advanceToStep(REVIEW_STEP)}
            />
          )}
          {(currentStep === REVIEW_STEP || (currentStep === GROUP_STEP && !hasGroups)) && (
            <Step6Review
              {...stepProps}
              appId={applicationId}
              applicationFeePaid={applicationFeePaid}
              features={features}
              onBack={() => goStep(hasGroups ? GROUP_STEP : 5)}
              onEditStep={goStep}
              onDone={() => navigate(applicationsPath)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
