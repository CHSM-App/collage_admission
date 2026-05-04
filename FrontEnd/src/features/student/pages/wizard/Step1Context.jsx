import Button from '../../../../shared/components/Button.jsx'

const YEAR_LABEL = { 1: 'FY — First Year', 2: 'SY — Second Year', 3: 'TY — Third Year' }

export default function Step1Context({ data, saving, onNext }) {
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

export function StepFooter({ onBack, onNext, saving, nextLabel = 'Save & Continue', hideBack, extraFooter, readOnly }) {
  return (
    <div className="space-y-2 pt-2">
      <div className="flex flex-col-reverse sm:flex-row gap-3">
        {!hideBack && (
          <Button variant="secondary" onClick={onBack} disabled={saving} className="w-full sm:w-auto">
            ← Back
          </Button>
        )}
        {!readOnly && (
          <Button onClick={onNext} loading={saving} className="w-full sm:w-auto sm:ml-auto">
            {nextLabel} →
          </Button>
        )}
      </div>
      {extraFooter && <div className="flex justify-end">{extraFooter}</div>}
    </div>
  )
}
