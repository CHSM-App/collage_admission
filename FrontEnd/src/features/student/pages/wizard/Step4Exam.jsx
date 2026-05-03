import { useCallback, useState } from 'react'
import FormField from '../../../../shared/components/FormField.jsx'
import { StepHeader, StepFooter } from './Step1Context.jsx'
import Button from '../../../../shared/components/Button.jsx'

const RESULT_OPTIONS = [
  { value: 'pass', label: 'Pass' },
  { value: 'atkt', label: 'ATKT' },
  { value: 'fail', label: 'Fail' },
]

export default function Step4Exam({ data, errors, globalError, saving, onChange, setField, onBack, onNext, extraFooter }) {
  const isFY = data.year_of_study === 1
  const e    = errors
  const [localError, setLocalError] = useState('')

  // Computed percentage
  const pct = computePct(data.total_marks_obtained, data.total_marks_max)

  // Subjects helpers
  const subjects = data.subjects || [{ subject_name: '', marks_obtained: '', marks_max: '' }]

  function setSubject(idx, field, value) {
    const updated = subjects.map((s, i) => i === idx ? { ...s, [field]: value } : s)
    setField('subjects', updated)
  }
  function addSubject() {
    setField('subjects', [...subjects, { subject_name: '', marks_obtained: '', marks_max: '' }])
  }
  function removeSubject(idx) {
    if (subjects.length <= 1) return
    setField('subjects', subjects.filter((_, i) => i !== idx))
  }

  function handleNext() {
    const yr = parseInt(data.year_of_passing)
    if (data.year_of_passing && (isNaN(yr) || yr > new Date().getFullYear())) {
      setLocalError('Year of passing cannot be in the future.'); return
    }
    setLocalError('')
    onNext({
      board_or_college_name:     data.board_or_college_name,
      school_or_college_address: data.school_or_college_address,
      seat_number:               isFY ? data.seat_number : undefined,
      prn_or_seat:               !isFY ? data.prn_or_seat : undefined,
      year_of_passing:           data.year_of_passing,
      total_marks_obtained:      data.total_marks_obtained,
      total_marks_max:           data.total_marks_max,
      result:                    !isFY ? data.result : undefined,
      subjects,
    })
  }

  return (
    <div>
      <StepHeader
        step={4}
        title={isFY ? 'Previous Exam Details — 12th Board' : `Previous Exam Details — ${data.year_of_study === 2 ? 'FY' : 'SY'} Results`}
        desc={
          isFY
            ? 'Enter your 12th standard board examination details.'
            : `Enter your ${data.year_of_study === 2 ? 'First Year' : 'Second Year'} college exam results.`
        }
      />

      <div className="px-4 sm:px-5 py-5 space-y-5">

        {/* Board / College */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            label={isFY ? 'Board Name' : 'College Name'}
            name="board_or_college_name"
            value={isFY ? data.board_or_college_name : (data.college_name || data.board_or_college_name)}
            onChange={onChange}
            error={e.board_or_college_name}
            required
            readOnly={!isFY}
            placeholder={isFY ? 'Maharashtra State Board' : ''}
            hint={!isFY ? 'Auto-filled — same college' : ''}
          />
          <FormField
            label={isFY ? 'School Name' : 'College Address'}
            name="school_or_college_address"
            value={data.school_or_college_address}
            onChange={onChange}
            placeholder={isFY ? 'St. Xavier High School, Vengurla' : ''}
          />
        </div>

        {/* Seat / PRN */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {isFY ? (
            <FormField label="Seat Number" name="seat_number" value={data.seat_number}
              onChange={onChange} error={e.seat_number} required placeholder="AB12345" />
          ) : (
            <FormField label="FY Seat No / PRN" name="prn_or_seat" value={data.prn_or_seat}
              onChange={onChange} error={e.prn_or_seat} required placeholder="Your FY PRN or seat number" />
          )}

          <FormField label="Year of Passing" name="year_of_passing" type="number"
            value={data.year_of_passing} onChange={onChange} error={e.year_of_passing}
            required placeholder={new Date().getFullYear()} max={new Date().getFullYear()} />

          {!isFY && (
            <FormField label="Result" name="result" type="select" value={data.result}
              onChange={onChange} error={e.result} required options={RESULT_OPTIONS} />
          )}
        </div>

        {/* Marks summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Total Marks Obtained" name="total_marks_obtained" type="number"
            value={data.total_marks_obtained} onChange={onChange} error={e.total_marks_obtained}
            required placeholder="450" />
          <FormField label="Total Marks (Out of)" name="total_marks_max" type="number"
            value={data.total_marks_max} onChange={onChange} error={e.total_marks_max}
            required placeholder="600" />
          <FormField label="Percentage" value={pct} readOnly hint="Auto-calculated" />
        </div>

        {/* Subject-wise marks */}
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400 border-b border-slate-100 pb-1.5">
            Subject-wise Marks *
          </p>
          {e.subjects && <p className="mb-2 text-xs text-red-600">{e.subjects}</p>}

          <div className="space-y-2">
            {/* Header row — hidden on mobile */}
            <div className="hidden sm:grid grid-cols-[1fr_120px_120px_36px] gap-2 px-1">
              <p className="text-xs font-semibold text-slate-400">Subject Name</p>
              <p className="text-xs font-semibold text-slate-400">Marks Obtained</p>
              <p className="text-xs font-semibold text-slate-400">Out of</p>
              <span />
            </div>

            {subjects.map((sub, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_120px_120px_36px] gap-2 items-start p-3 sm:p-0 rounded-lg sm:rounded-none bg-slate-50 sm:bg-transparent border sm:border-0 border-slate-100">
                {/* Mobile label */}
                <p className="sm:hidden text-xs font-semibold text-slate-400 mb-1">Subject {idx + 1}</p>

                <input
                  type="text"
                  value={sub.subject_name}
                  onChange={e => setSubject(idx, 'subject_name', e.target.value)}
                  placeholder={`Subject ${idx + 1}`}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
                />
                <input
                  type="number"
                  value={sub.marks_obtained}
                  onChange={e => setSubject(idx, 'marks_obtained', e.target.value)}
                  placeholder="Marks"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
                />
                <input
                  type="number"
                  value={sub.marks_max}
                  onChange={e => setSubject(idx, 'marks_max', e.target.value)}
                  placeholder="Max"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
                />
                <button
                  type="button"
                  onClick={() => removeSubject(idx)}
                  disabled={subjects.length <= 1}
                  className="flex h-10 w-10 sm:h-10 sm:w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30 transition"
                  aria-label="Remove subject"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addSubject}
            className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
          >
            <span className="text-lg leading-none">+</span> Add subject
          </button>

          {/* Marks mismatch warning */}
          {marksMismatch(subjects, data.total_marks_obtained) && (
            <p className="mt-2 text-xs text-amber-600 font-medium">
              ⚠ Sum of subject marks ({sumSubjectMarks(subjects)}) doesn't match total marks obtained ({data.total_marks_obtained}). You may continue, but please verify.
            </p>
          )}
        </div>

        {(localError || globalError) && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{localError || globalError}</p>
        )}

        <StepFooter onBack={onBack} onNext={handleNext} saving={saving} extraFooter={extraFooter} />
      </div>
    </div>
  )
}

function computePct(obtained, max) {
  const o = parseFloat(obtained)
  const m = parseFloat(max)
  if (!o || !m || m === 0) return ''
  return `${((o / m) * 100).toFixed(2)}%`
}

function sumSubjectMarks(subjects) {
  return subjects.reduce((sum, s) => sum + (parseFloat(s.marks_obtained) || 0), 0)
}

function marksMismatch(subjects, total) {
  const sum = sumSubjectMarks(subjects)
  const tot = parseFloat(total)
  return sum > 0 && tot > 0 && Math.abs(sum - tot) > 0.01
}
