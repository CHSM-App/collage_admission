import { useEffect, useState } from 'react'
import api from '../../../services/api.js'
import Button from '../../../shared/components/Button.jsx'
import { usePermissions } from '../hooks/usePermissions.js'
import { SkeletonTable } from '../../../shared/components/Skeleton.jsx'

const YEAR_LABEL = { 1: 'FY', 2: 'SY', 3: 'TY', 4: '4Y', 5: '5Y' }
const YEAR_LONG  = {
  1: 'FY (First Year)', 2: 'SY (Second Year)', 3: 'TY (Third Year)',
  4: '4Y (Fourth Year)', 5: '5Y (Fifth Year)',
}

export default function AdmissionPeriods({ collegeId }) {
  const { canWrite } = usePermissions()
  const rw = canWrite('masters')
  const [periods, setPeriods]       = useState([])
  const [courses, setCourses]       = useState([])
  const [collegeFee, setCollegeFee] = useState(null)
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [form, setForm]             = useState({
    course_id: '', year_of_study: '1', academic_year: '2026-27',
    start_date: '', end_date: '', total_seats: '',
  })

  // Edit state (end_date only)
  const [editingId, setEditingId]     = useState(null)
  const [editEndDate, setEditEndDate] = useState('')
  const [editSaving, setEditSaving]   = useState(false)
  const [editError, setEditError]     = useState('')

  function fetchData() {
    Promise.all([
      api.get(`college-admin/${collegeId}/admission-periods`),
      api.get(`masters/${collegeId}/faculty`),
    ])
      .then(([pRes, cRes]) => {
        setPeriods(pRes.data.data || [])
        setCourses((cRes.data.data || []).filter(f => f.is_active))
      })
      .catch(() => setError('Failed to load data.'))
      .finally(() => setLoading(false))

    // College fee fetch is optional — failure should not block the page
    api.get(`admin/colleges`)
      .then(res => {
        const col = (res.data.data || []).find(c => String(c.id) === String(collegeId))
        setCollegeFee(col?.application_fee ?? null)
      })
      .catch(() => {})
  }

  useEffect(() => { fetchData() }, [collegeId])

  // Year-of-study options come from the selected course's duration_years
  // (matches FacultyMaster's semSlotsFor / DivisionMaster's yearLevelsFor).
  // Default to 3 (TY) when no course is picked yet so the dropdown isn't empty.
  const selectedCourse = courses.find(c => String(c.code_no) === String(form.course_id))
  const maxYear = Math.max(1, Math.min(5, parseInt(selectedCourse?.duration_years) || 3))
  const yearOptions = Array.from({ length: maxYear }, (_, i) => i + 1)

  // If the user changes the course to one with a shorter duration, the
  // currently selected year_of_study may be out of range — snap to FY.
  useEffect(() => {
    if (selectedCourse && parseInt(form.year_of_study) > maxYear) {
      setForm(f => ({ ...f, year_of_study: '1' }))
    }
  }, [selectedCourse, maxYear, form.year_of_study])

  // Active open periods first, then closed (but reopenable), then disabled at bottom
  const sortedPeriods = [
    ...periods.filter(p => p.is_active && !p.is_disabled),
    ...periods.filter(p => !p.is_active && !p.is_disabled),
    ...periods.filter(p => p.is_disabled),
  ]

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    const today = new Date().toISOString().slice(0, 10)
    if (form.start_date && form.start_date < today) {
      setError('Start date cannot be in the past.')
      return
    }
    if (form.end_date && form.end_date < today) {
      setError('End date cannot be in the past.')
      return
    }
    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      setError('End date must be on or after the start date.')
      return
    }
    // Only one active open period per course+year
    const conflict = periods.find(
      p => p.is_active && !p.is_disabled &&
           String(p.course_id) === String(form.course_id) &&
           String(p.year_of_study) === String(form.year_of_study)
    )
    if (conflict) {
      setError(`An open admission period already exists for ${conflict.course_name} — ${YEAR_LABEL[form.year_of_study]}. Close it before creating a new one.`)
      return
    }
    setSaving(true)
    try {
      await api.post(`college-admin/${collegeId}/admission-periods`, form)
      setShowForm(false)
      setForm({ course_id: '', year_of_study: '1', academic_year: '2026-27', start_date: '', end_date: '', total_seats: '' })
      fetchData()
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to create period.')
    } finally {
      setSaving(false)
    }
  }

  // Close / Reopen (is_active toggle — reversible)
  async function toggleClose(period) {
    if (period.is_disabled) return
    if (period.is_active) {
      // Closing
      try {
        await api.put(`college-admin/${collegeId}/admission-periods/${period.id}`, { is_active: false })
        fetchData()
      } catch { alert('Failed to update.') }
    } else {
      // Reopening — check conflict
      const conflict = periods.find(
        p => p.is_active && !p.is_disabled &&
             p.course_id === period.course_id &&
             p.year_of_study === period.year_of_study &&
             p.id !== period.id
      )
      if (conflict) {
        alert(`Cannot reopen: an active period for ${period.course_name} — ${YEAR_LABEL[period.year_of_study]} already exists. Close it first.`)
        return
      }
      try {
        await api.put(`college-admin/${collegeId}/admission-periods/${period.id}`, { is_active: true })
        fetchData()
      } catch { alert('Failed to update.') }
    }
  }

  // Disable (permanent read-only, admission closed — no reopen)
  async function disablePeriod(period) {
    if (!confirm(`Disable "${period.course_name} — ${YEAR_LABEL[period.year_of_study]} · ${period.academic_year}"?\nThis will permanently close admissions for this period. It cannot be reopened.`)) return
    try {
      await api.put(`college-admin/${collegeId}/admission-periods/${period.id}`, { is_active: false, is_disabled: true })
      fetchData()
    } catch { alert('Failed to disable.') }
  }

  function startEdit(period) {
    setEditingId(period.id)
    setEditEndDate(period.end_date ? period.end_date.slice(0, 10) : '')
    setEditError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditEndDate('')
    setEditError('')
  }

  async function saveEdit(period) {
    setEditError('')
    const today = new Date().toISOString().slice(0, 10)
    if (!editEndDate) { setEditError('End date is required.'); return }
    if (editEndDate < today) {
      setEditError('End date cannot be in the past.')
      return
    }
    if (editEndDate < period.start_date.slice(0, 10)) {
      setEditError('End date cannot be before start date.')
      return
    }
    setEditSaving(true)
    try {
      await api.put(`college-admin/${collegeId}/admission-periods/${period.id}`, { end_date: editEndDate })
      setEditingId(null)
      fetchData()
    } catch (err) {
      setEditError(err?.response?.data?.message || 'Failed to save.')
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">College portal</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Admission Periods</h1>
          <p className="mt-1 text-slate-600">Control when students can apply for each course and year.</p>
          {collegeFee !== null && (
            <p className="mt-1 text-sm text-slate-500">
              Application fee: <span className="font-semibold text-slate-800">₹{Number(collegeFee).toLocaleString('en-IN')}</span>
              <span className="text-xs text-slate-400 ml-1">(set by admin — applied to all periods)</span>
            </p>
          )}
        </div>
        {rw && <Button onClick={() => { setShowForm(v => !v); setError('') }}>
          {showForm ? 'Cancel' : '+ New Period'}
        </Button>}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-lg border border-blue-200 bg-blue-50 p-5 space-y-4 max-w-2xl">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-slate-950">Create Admission Period</p>
            <button type="button" onClick={() => { setShowForm(false); setError('') }} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Course</label>
              <select required value={form.course_id} onChange={e => setForm(f => ({ ...f, course_id: e.target.value }))}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm">
                <option value="">Select course…</option>
                {courses.map(c => <option key={c.code_no} value={c.code_no}>{c.degree_course_code} — {c.degree_course_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Year of Study</label>
              <select value={form.year_of_study} onChange={e => setForm(f => ({ ...f, year_of_study: e.target.value }))}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm">
                {yearOptions.map(y => (
                  <option key={y} value={y}>{YEAR_LONG[y]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Academic Year</label>
              <input required value={form.academic_year} onChange={e => setForm(f => ({ ...f, academic_year: e.target.value }))}
                placeholder="2026-27" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Total Seats</label>
              <input required type="number" min="1" value={form.total_seats} onChange={e => setForm(f => ({ ...f, total_seats: e.target.value }))}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Start Date</label>
              <input required type="date" value={form.start_date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">End Date</label>
              <input required type="date" value={form.end_date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" loading={saving}>Create Period</Button>
        </form>
      )}

      {loading && <SkeletonTable rows={4} cols={5} />}
      {!loading && periods.length === 0 && (
        <p className="text-slate-500">No admission periods configured yet.</p>
      )}

      <div className="space-y-4">
        {sortedPeriods.map(p => {
          const isDisabled = !!p.is_disabled
          const isOpen     = p.is_active && !isDisabled
          const isClosed   = !p.is_active && !isDisabled
          const isEditing  = editingId === p.id

          return (
            <div
              key={p.id}
              className={`rounded-xl border overflow-hidden transition-opacity ${
                isDisabled ? 'border-slate-100 bg-slate-50 opacity-50' : 'border-slate-200 bg-white'
              }`}
            >
              {/* Header row */}
              <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className={`font-semibold ${isDisabled ? 'text-slate-400' : 'text-slate-950'}`}>
                    {p.course_name} — {YEAR_LABEL[p.year_of_study]} · {p.academic_year}
                  </p>
                  <p className="text-sm text-slate-400">
                    {new Date(p.start_date).toLocaleDateString('en-IN')} →{' '}
                    {new Date(p.end_date).toLocaleDateString('en-IN')} ·
                    Seats: {p.filled_seats}/{p.total_seats}
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {/* Status badge */}
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    isDisabled ? 'bg-red-50 text-red-400' :
                    isOpen     ? 'bg-emerald-100 text-emerald-700' :
                                 'bg-slate-100 text-slate-500'
                  }`}>
                    {isDisabled ? 'Disabled' : isOpen ? 'Open' : 'Closed'}
                  </span>

                  {/* Edit — only active non-disabled periods */}
                  {rw && isOpen && !isEditing && (
                    <button onClick={() => startEdit(p)} className="text-xs font-semibold text-blue-600 hover:underline">
                      Edit
                    </button>
                  )}

                  {/* Close / Reopen — not shown for disabled */}
                  {rw && !isDisabled && (
                    <button
                      onClick={() => toggleClose(p)}
                      className="text-xs font-semibold text-slate-500 hover:underline"
                    >
                      {isOpen ? 'Close' : 'Reopen'}
                    </button>
                  )}

                  {/* Disable — only for non-disabled periods */}
                  {rw && !isDisabled && (
                    <button
                      onClick={() => disablePeriod(p)}
                      className="text-xs font-semibold text-red-500 hover:underline"
                    >
                      Disable
                    </button>
                  )}
                </div>
              </div>

              {/* Inline edit — end_date only */}
              {isEditing && (
                <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Edit Period</p>
                  <div className="flex flex-wrap items-end gap-4">
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Course</p>
                      <p className="text-sm font-medium text-slate-600">{p.course_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Year</p>
                      <p className="text-sm font-medium text-slate-600">{YEAR_LABEL[p.year_of_study]}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Academic Year</p>
                      <p className="text-sm font-medium text-slate-600">{p.academic_year}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Start Date</p>
                      <p className="text-sm font-medium text-slate-600">{new Date(p.start_date).toLocaleDateString('en-IN')}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">End Date</label>
                      <input
                        type="date"
                        value={editEndDate}
                        min={new Date().toISOString().slice(0, 10)}
                        onChange={e => { setEditEndDate(e.target.value); setEditError('') }}
                        className="rounded-md border border-blue-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  {editError && <p className="mt-2 text-sm text-red-600">{editError}</p>}
                  <div className="flex gap-3 mt-4">
                    <Button onClick={() => saveEdit(p)} loading={editSaving}>Save</Button>
                    <button onClick={cancelEdit} className="text-sm text-slate-500 hover:text-slate-700 font-medium">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
