/**
 * FormField — label + input/select/textarea with inline error display.
 * Designed for the multi-step application form.
 */
export default function FormField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error,
  required,
  disabled,
  placeholder,
  hint,
  options,       // for type='select': [{ value, label }]
  rows,          // for type='textarea'
  readOnly,
  min,
  max,
  maxLength,
  className = '',
  inputClassName = '',
  children,      // slot for custom content instead of standard input
}) {
  const base =
    'w-full rounded-lg border px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2 ' +
    'disabled:cursor-not-allowed disabled:opacity-50 ' +
    (error
      ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100'
      : 'border-slate-200 bg-white focus:border-slate-400 focus:ring-slate-100')

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="text-xs font-semibold text-slate-600">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}

      {children ? (
        children
      ) : type === 'select' ? (
        <select
          name={name}
          value={value ?? ''}
          onChange={onChange}
          disabled={disabled || readOnly}
          required={required}
          className={`${base} ${inputClassName}`}
        >
          <option value="">{placeholder || 'Select…'}</option>
          {options?.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          name={name}
          value={value ?? ''}
          onChange={onChange}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          placeholder={placeholder}
          rows={rows || 3}
          className={`${base} resize-y ${inputClassName}`}
        />
      ) : (
        <input
          type={type}
          name={name}
          value={value ?? ''}
          onChange={onChange}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          placeholder={placeholder}
          min={min}
          max={max}
          maxLength={maxLength}
          className={`${base} ${readOnly ? 'cursor-default bg-slate-50' : ''} ${inputClassName}`}
        />
      )}

      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  )
}
