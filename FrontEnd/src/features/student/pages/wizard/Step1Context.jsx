import { useEffect, useState } from 'react'
import Button from '../../../../shared/components/Button.jsx'
import { getRequiredDocuments } from '../../../../services/applicationService.js'

const YEAR_LABEL = { 1: 'FY — First Year', 2: 'SY — Second Year', 3: 'TY — Third Year', 4: '4Y — Fourth Year', 5: '5Y — Fifth Year' }

export default function Step1Context({ data, saving, onNext }) {
  const [reqDocs, setReqDocs]     = useState([])
  const [docsLoading, setDocsLoading] = useState(false)

  useEffect(() => {
    if (!data.college_id || !data.course_id || !data.year_of_study) return
    setDocsLoading(true)
    getRequiredDocuments(data.college_id, data.course_id, data.year_of_study)
      .then(r => setReqDocs(r.data.data || []))
      .catch(() => setReqDocs([]))
      .finally(() => setDocsLoading(false))
  }, [data.college_id, data.course_id, data.year_of_study])

  const mandatory = reqDocs.filter(d => d.is_mandatory)
  const optional  = reqDocs.filter(d => !d.is_mandatory)

  return (
    <div>
      <StepHeader
        step={1}
        title="Application Context"
        desc="Confirm the details below. These are system-determined and cannot be changed here."
      />

      <div className="px-5 pb-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ReadField label="College"        value={data.college_name} />
          <ReadField label="City"           value={data.college_city} />
          <ReadField label="Course"         value={data.course_name} />
          <ReadField label="Year of Study"  value={YEAR_LABEL[data.year_of_study] || '—'} />
          <ReadField label="Academic Year"  value={data.academic_year} />
          <ReadField label="Application Fee"value={`₹${Number(data.application_fee || 0).toLocaleString('en-IN')}`} />
        </div>

        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <strong>Year auto-determined:</strong> Based on your admission history, you are applying for{' '}
          <strong>{YEAR_LABEL[data.year_of_study] || '—'}</strong>. If this is incorrect, go back and
          select the right admission period.
        </div>

        {/* Required Documents */}
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <p className="text-sm font-semibold text-slate-700">Documents Required for This Application</p>
          </div>

          {docsLoading ? (
            <div className="px-4 py-5 space-y-2">
              {[1,2,3].map(i => (
                <div key={i} className="h-4 bg-slate-200 animate-pulse rounded w-3/4" style={{ width: `${60 + i * 10}%` }} />
              ))}
            </div>
          ) : reqDocs.length === 0 ? (
            <p className="px-4 py-4 text-sm text-slate-400">No specific documents configured for this program and year.</p>
          ) : (
            <div className="px-4 py-4 space-y-4">
              {mandatory.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-red-600 mb-2">Mandatory Documents</p>
                  <ul className="space-y-1.5">
                    {mandatory.map(d => (
                      <li key={d.id} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold">✱</span>
                        <span>{d.document_name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {optional.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Optional Documents</p>
                  <ul className="space-y-1.5">
                    {optional.map(d => (
                      <li key={d.id} className="flex items-start gap-2 text-sm text-slate-500">
                        <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xs">○</span>
                        <span>{d.document_name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-slate-400 pt-1">
                You will upload these documents in Step 5. Keep them ready before proceeding.
              </p>
            </div>
          )}
        </div>

        <StepFooter
          onNext={onNext}
          saving={saving}
          nextLabel="Looks correct — Continue"
          hideBack
        />
      </div>
    </div>
  )
}

function ReadField({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 border border-slate-100 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value || '—'}</p>
    </div>
  )
}

export function StepHeader({ step, title, desc }) {
  return (
    <div className="border-b border-slate-100 px-5 py-5">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">
          {step}
        </span>
        <h2 className="text-base font-bold text-slate-950">{title}</h2>
      </div>
      {desc && <p className="mt-1 text-sm text-slate-500 pl-8">{desc}</p>}
    </div>
  )
}

export function StepFooter({ onBack, onNext, saving, nextLabel = 'Save & Continue', hideBack, extraFooter, readOnly, disabled }) {
  return (
    <div className="space-y-2 pt-2">
      <div className="flex flex-col-reverse sm:flex-row gap-3">
        {!hideBack && (
          <Button variant="secondary" onClick={onBack} disabled={saving} className="w-full sm:w-auto">
            ← Back
          </Button>
        )}
        {!readOnly && (
          <Button onClick={onNext} loading={saving} disabled={disabled} className={`w-full sm:w-auto sm:ml-auto ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {nextLabel} →
          </Button>
        )}
      </div>
      {extraFooter && <div className="flex justify-end">{extraFooter}</div>}
    </div>
  )
}
