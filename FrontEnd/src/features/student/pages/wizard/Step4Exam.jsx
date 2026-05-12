import { useState, useMemo } from 'react'
import { StepHeader, StepFooter } from './Step1Context.jsx'

// Exam rows shown per year of study
const EXAM_ROWS = {
  1: ['SSC', 'HSC'],
  2: ['SSC', 'HSC', 'FY_SEM1', 'FY_SEM2'],
  3: ['SSC', 'HSC', 'FY_SEM1', 'FY_SEM2', 'SY_SEM1', 'SY_SEM2'],
}

const ROW_LABEL = {
  SSC:     'SSC',
  HSC:     'HSC',
  FY_SEM1: 'F.Y. Sem I',
  FY_SEM2: 'F.Y. Sem II',
  SY_SEM1: 'S.Y. Sem I',
  SY_SEM2: 'S.Y. Sem II',
}

const MANDATORY = {
  1: ['SSC', 'HSC'],
  2: ['SSC', 'HSC', 'FY_SEM1', 'FY_SEM2'],
  3: ['SSC', 'HSC', 'FY_SEM1', 'FY_SEM2', 'SY_SEM1', 'SY_SEM2'],
}

function emptyRow() {
  return { institute: '', board: '', month_year: '', seat_no: '', marks_obtained: '', marks_max: '', percentage: '', class_grade: '', remark: '' }
}

function computePct(obtained, max) {
  const o = parseFloat(obtained), m = parseFloat(max)
  if (!o || !m || m === 0) return ''
  return ((o / m) * 100).toFixed(2)
}

export default function Step4Exam({ data, errors, globalError, saving, setField, onBack, onNext, extraFooter, readOnly }) {
  const yearOfStudy = data.year_of_study || 1
  const rows = EXAM_ROWS[yearOfStudy] || EXAM_ROWS[1]
  const mandatory = MANDATORY[yearOfStudy] || MANDATORY[1]
  const [localError, setLocalError] = useState('')

  const exams = data.exams || {}

  // Compute which rows were prefilled from DB at mount time only.
  // Any row with institute + marks data is considered prefilled and locked (read-only).
  // Using empty deps so this never re-evaluates from live form state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const prefilledTypes = useMemo(() => {
    const initial = data.exams || {}
    return new Set(
      Object.entries(initial)
        .filter(([, row]) => !!(row.institute && row.marks_obtained && row.marks_max))
        .map(([t]) => t)
    )
  }, []) // intentionally empty — snapshot at mount

  function getRow(type) {
    return exams[type] || emptyRow()
  }

  function setRowField(type, field, value) {
    const updated = { ...exams, [type]: { ...getRow(type), [field]: value } }
    // Auto-compute percentage when marks change
    if (field === 'marks_obtained' || field === 'marks_max') {
      const row = updated[type]
      updated[type].percentage = computePct(row.marks_obtained, row.marks_max)
    }
    setField('exams', updated)
  }

  const REQUIRED_FIELDS = ['institute', 'board', 'month_year', 'seat_no', 'marks_obtained', 'marks_max', 'percentage', 'class_grade']
  const FIELD_LABEL = {
    institute: 'Name of Institute', board: 'Board/University', month_year: 'Month & Year of Passing',
    seat_no: 'Seat No.', marks_obtained: 'Marks Obtained', marks_max: 'Out of',
    percentage: '%', class_grade: 'Class/Grade',
  }

  function handleNext() {
    for (const type of mandatory) {
      const row = getRow(type)
      for (const field of REQUIRED_FIELDS) {
        if (!String(row[field] || '').trim()) {
          setLocalError(`${ROW_LABEL[type]}: ${FIELD_LABEL[field]} is required.`)
          return
        }
      }
    }
    setLocalError('')
    onNext({ exams })
  }

  const COLS = [
    { key: 'institute',      label: 'Name of Institute with Place *', width: 'min-w-[160px]' },
    { key: 'board',          label: 'Board / University *',           width: 'min-w-[120px]' },
    { key: 'month_year',     label: 'Month & Year of Passing *',      width: 'min-w-[110px]' },
    { key: 'seat_no',        label: 'Seat No. *',                     width: 'min-w-[90px]' },
    { key: 'marks_obtained', label: 'Marks Obtained *',               width: 'min-w-[80px]' },
    { key: 'marks_max',      label: 'Out of *',                       width: 'min-w-[70px]' },
    { key: 'percentage',     label: '% *',                            width: 'min-w-[60px]', readOnly: true },
    { key: 'class_grade',    label: 'Class / Grade *',                width: 'min-w-[80px]' },
    { key: 'remark',         label: 'Remark',                         width: 'min-w-[80px]' },
  ]

  return (
    <div>
      <StepHeader
        step={4}
        title="Previous Exam Details"
        desc={`Enter your academic exam details. ${mandatory.map(t => ROW_LABEL[t]).join(', ')} ${mandatory.length > 1 ? 'are' : 'is'} mandatory.`}
      />

      <div className="px-4 sm:px-5 py-5">

        {/* Scrollable table */}
        <div className="overflow-x-auto rounded-lg border-2 border-slate-400">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-100 border-b-2 border-slate-400">
              <tr>
                <th className="border border-slate-200 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap min-w-[70px]">
                  Exam
                </th>
                {COLS.map(col => (
                  <th key={col.key} className={`border border-slate-200 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap ${col.width}`}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(type => {
                const row = getRow(type)
                const isMandatory = mandatory.includes(type)
                // SSC/HSC on SY/TY: lock only when the row had DB-prefilled data at mount time
                const hasPrefill = yearOfStudy > 1 && prefilledTypes.has(type)
                const isLocked = readOnly || hasPrefill
                return (
                  <tr key={type} className={`hover:bg-blue-50 transition ${isMandatory ? 'bg-white' : 'bg-slate-50/50'}`}>
                    <td className="border border-slate-200 px-3 py-2 font-semibold text-slate-700 whitespace-nowrap text-xs">
                      {ROW_LABEL[type]}
                      {isMandatory && <span className="text-red-500 ml-0.5">*</span>}
                    </td>
                    {COLS.map(col => (
                      <td key={col.key} className="border border-slate-200 p-1">
                        <input
                          type={['marks_obtained', 'marks_max', 'percentage'].includes(col.key) ? 'number' : 'text'}
                          value={row[col.key] || ''}
                          onChange={e => setRowField(type, col.key, e.target.value)}
                          readOnly={col.readOnly || isLocked}
                          placeholder=""
                          className={`w-full px-2 py-1.5 text-sm rounded border-0 outline-none focus:ring-2 focus:ring-blue-200 focus:bg-blue-50 transition ${
                            col.readOnly || isLocked
                              ? 'bg-slate-100 text-slate-500 cursor-default'
                              : 'bg-white hover:bg-slate-50'
                          }`}
                        />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {yearOfStudy > 1 && (
          <p className="mt-2 text-xs text-slate-400">
            Rows pre-filled from your previous application are locked and cannot be edited.
          </p>
        )}

        {(localError || globalError) && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {localError || globalError}
          </p>
        )}

        <div className="mt-5">
          <StepFooter onBack={onBack} onNext={handleNext} saving={saving} extraFooter={extraFooter} readOnly={readOnly} />
        </div>
      </div>
    </div>
  )
}
