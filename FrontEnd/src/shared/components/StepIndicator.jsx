/**
 * StepIndicator — horizontal step progress bar for multi-step forms.
 * Mobile: shows current step label only. Desktop: all step labels.
 */
export default function StepIndicator({ steps, current }) {
  return (
    <div className="w-full">
      {/* Mobile: compact */}
      <div className="flex items-center justify-between sm:hidden mb-1">
        <span className="text-xs font-semibold text-slate-500">
          Step {current} of {steps.length}
        </span>
        <span className="text-xs font-semibold text-slate-800">{steps[current - 1]}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 sm:hidden">
        <div
          className="h-1.5 rounded-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${(current / steps.length) * 100}%` }}
        />
      </div>

      {/* Desktop: full stepper */}
      <div className="hidden sm:flex items-start gap-0">
        {steps.map((label, i) => {
          const step   = i + 1
          const done   = step < current
          const active = step === current
          const last   = i === steps.length - 1

          return (
            <div key={step} className="flex-1 flex flex-col items-center relative">
              {/* Connector line */}
              {!last && (
                <div className={`absolute top-4 left-1/2 h-0.5 w-full transition-colors duration-300 ${done ? 'bg-emerald-500' : 'bg-slate-200'}`} />
              )}

              {/* Circle */}
              <div className={`
                relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-200
                ${done   ? 'bg-emerald-500 text-white'           : ''}
                ${active ? 'bg-slate-950 text-white ring-2 ring-offset-2 ring-slate-950' : ''}
                ${!done && !active ? 'bg-slate-100 text-slate-400 border border-slate-200' : ''}
              `}>
                {done ? <CheckIcon /> : step}
              </div>

              {/* Label */}
              <p className={`mt-1.5 text-center text-xs leading-tight px-1 ${
                active ? 'font-semibold text-slate-950' :
                done   ? 'font-medium text-emerald-600' :
                'text-slate-400'
              }`}>
                {label}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
      <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
