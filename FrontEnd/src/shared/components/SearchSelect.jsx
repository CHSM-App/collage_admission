import { useId, useRef, useState } from 'react'

/**
 * Searchable dropdown: type to filter, tap/click or Enter to pick.
 *
 * Replaces <input list> + <datalist>, which mobile browsers barely support
 * (iOS shows at most a few guesses above the keyboard, many Android browsers
 * nothing), so the choices were invisible on phones.
 *
 * value / onChange are the plain text in the box — a typed value that matches
 * no option is kept, like the datalist it replaces.
 */
export default function SearchSelect({ name, value, onChange, options, placeholder, readOnly, className = '' }) {
  const listId = useId()
  const [open, setOpen]       = useState(false)
  const [active, setActive]   = useState(0)
  const inputRef              = useRef(null)

  const text  = String(value ?? '')
  const q     = text.trim().toLowerCase()
  // Exact match (e.g. just picked, or reopened) → show everything so it can be changed
  const exact = options.some(o => o.toLowerCase() === q)
  const shown = (q && !exact ? options.filter(o => o.toLowerCase().includes(q)) : options).slice(0, 100)

  function pick(opt) {
    onChange(opt)
    setOpen(false)
  }

  function onKeyDown(e) {
    if (readOnly) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(i => Math.min(i + 1, shown.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && open && shown[active]) { e.preventDefault(); pick(shown[active]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        name={name}
        value={text}
        placeholder={placeholder}
        readOnly={readOnly}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && !readOnly}
        aria-controls={listId}
        aria-autocomplete="list"
        className={className}
        onFocus={() => { if (!readOnly) { setOpen(true); setActive(0) } }}
        onClick={() => { if (!readOnly) setOpen(true) }}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        onChange={e => { onChange(e.target.value); setOpen(true); setActive(0) }}
      />
      {open && !readOnly && shown.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {shown.map((opt, i) => (
            <li
              key={opt}
              role="option"
              aria-selected={i === active}
              // preventDefault keeps focus in the input so blur doesn't close the list before the pick
              onPointerDown={e => { e.preventDefault(); pick(opt) }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-2.5 text-sm ${i === active ? 'bg-slate-100 text-slate-950' : 'text-slate-700'} ${opt.toLowerCase() === q ? 'font-semibold' : ''}`}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
