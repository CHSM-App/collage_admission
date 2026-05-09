/**
 * Shared form parts for the three certificate pages
 * (Bonafide / Character / NOC).
 *
 * These exist to guarantee visual alignment consistency across all three:
 * - Same input-shaped wrapper for radio + checkbox so they align with FormField inputs
 * - Same Reg-No-lookup row layout so the Search button lines up with the input
 * - Same right-justified action bar with uniform-width buttons
 *
 * If a tweak is needed, change it here once and all three forms inherit it.
 */
import Button from '../../../../shared/components/Button.jsx'
import FormField from '../../../../shared/components/FormField.jsx'

const GENDER_OPTS = [
  { value: 'Male',   label: 'Male' },
  { value: 'Female', label: 'Female' },
]

// Same height/border as a FormField input so the radio block sits on the
// same baseline as adjacent text inputs in a grid row.
export function GenderRadio({ value, onChange, disabled, error, required }) {
  const wrapper =
    'flex items-center gap-5 min-h-[42px] rounded-lg border px-3 py-2 text-sm transition ' +
    (error
      ? 'border-red-300 bg-red-50'
      : 'border-slate-200 bg-white') +
    (disabled ? ' cursor-not-allowed bg-slate-50 opacity-70' : '')
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-600">
        Gender{required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <div className={wrapper}>
        {GENDER_OPTS.map(g => (
          <label key={g.value} className={`flex items-center gap-1.5 text-sm text-slate-700 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
            <input
              type="radio"
              name="gender"
              value={g.value}
              checked={value === g.value}
              onChange={onChange}
              disabled={disabled}
              className="accent-slate-700"
            />
            {g.label}
          </label>
        ))}
      </div>
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  )
}

// Same FormField-shaped wrapper so the Ex-Student box doesn't visually break
// the row when placed alongside other fields in a grid.
export function ExStudentCheckbox({ checked, onChange, disabled }) {
  const wrapper =
    'flex items-center min-h-[42px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm ' +
    (disabled ? 'cursor-not-allowed bg-slate-50 opacity-70' : '')
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-600">Ex-Student</label>
      <div className={wrapper}>
        <label className={`flex items-center gap-2 text-sm text-slate-700 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
          <input
            type="checkbox"
            name="is_ex_student"
            checked={!!checked}
            onChange={onChange}
            disabled={disabled}
            className="h-4 w-4 accent-slate-700"
          />
          Previously enrolled
        </label>
      </div>
    </div>
  )
}

// Reg-no field + Search button on one line. The hint is rendered as a
// sibling caption *below* the row so it doesn't push the FormField taller
// than the button (which would knock the button out of vertical alignment).
export function RegNoLookupRow({ value, onChange, onSearch, disabled, lookingUp }) {
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
        <FormField
          label="Registration No."
          name="reg_no"
          value={value}
          onChange={onChange}
          placeholder="Student registration number"
          readOnly={disabled}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={onSearch}
          disabled={disabled || lookingUp || !value?.trim()}
          className="min-w-[96px]"
        >
          {lookingUp ? 'Searching…' : 'Search'}
        </Button>
      </div>
      <p className="text-xs text-slate-400">Click Search to auto-fill student details from the registration number.</p>
    </div>
  )
}

// Right-aligned action bar. All buttons share min-w-[88px] so the row is
// uniform regardless of label length.
export function CertActionBar({
  onSave, onEdit, onCancel, onPrint, onExit,
  saving, canSave, canEdit, canPrint,
}) {
  const btnW = 'min-w-[88px]'
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t border-slate-100">
      <Button onClick={onSave}   disabled={!canSave || saving} className={btnW}>
        {saving ? 'Saving…' : 'Save'}
      </Button>
      <Button onClick={onEdit}   disabled={!canEdit}           className={btnW} variant="secondary">Edit</Button>
      <Button onClick={onCancel}                               className={btnW} variant="secondary">Cancel</Button>
      <Button onClick={onPrint}  disabled={!canPrint}          className={btnW} variant="secondary">Print</Button>
      <Button onClick={onExit}                                 className={btnW} variant="secondary">Exit</Button>
    </div>
  )
}

// Form panel shell — same chrome on all three pages so headers and content
// padding are identical.
export function CertFormShell({ mode, certNo, children }) {
  const title = mode === 'new'
    ? 'New Certificate'
    : mode === 'edit' ? 'Edit Certificate' : 'Certificate Details'
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        {mode !== 'new' && certNo && (
          <span className="text-xs font-mono text-slate-500">{certNo}</span>
        )}
      </div>
      <div className="px-5 py-5 space-y-5">
        {children}
      </div>
    </div>
  )
}
