import { useEffect, useState } from 'react'
import api from '../../../services/api.js'
import Button from '../../../shared/components/Button.jsx'

const YEAR_LABEL = { 1: 'FY — First Year', 2: 'SY — Second Year', 3: 'TY — Third Year' }

export default function SubjectSelection({ application, onDone, onCancel }) {
  const [info, setInfo]           = useState(null)
  const [list1, setList1]         = useState([])   // available subjects sem 1
  const [list2, setList2]         = useState([])   // available subjects sem 2
  const [selected1, setSelected1] = useState(new Set())
  const [selected2, setSelected2] = useState(new Set())
  const [loading, setLoading]     = useState(true)
  const [saving1, setSaving1]     = useState(false)
  const [saving2, setSaving2]     = useState(false)
  const [saved1, setSaved1]       = useState(false)
  const [saved2, setSaved2]       = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    async function load() {
      try {
        const selRes = await api.get(`api/applications/${application.id}/subject-selections`)
        const d = selRes.data.data
        setInfo(d)

        // Pre-mark already saved selections
        const pre1 = new Set(d.semester1.map(s => s.code))
        const pre2 = new Set(d.semester2.map(s => s.code))
        if (pre1.size) { setSelected1(pre1); setSaved1(true) }
        if (pre2.size) { setSelected2(pre2); setSaved2(true) }

        // Fetch available subject lists for both semesters in parallel
        const [r1, r2] = await Promise.all([
          api.get('api/subjects-list', { params: { college_id: d.college_id, course_id: d.course_id, semester: 1 } }),
          api.get('api/subjects-list', { params: { college_id: d.college_id, course_id: d.course_id, semester: 2 } }),
        ])
        setList1(r1.data.data || [])
        setList2(r2.data.data || [])
      } catch {
        setError('Failed to load subjects.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [application.id])

  function toggle(semester, code) {
    const setter = semester === 1 ? setSelected1 : setSelected2
    setter(prev => {
      const next = new Set(prev)
      next.has(code) ? next.delete(code) : next.add(code)
      return next
    })
  }

  async function saveSemester(semester) {
    const list      = semester === 1 ? list1      : list2
    const selected  = semester === 1 ? selected1  : selected2
    const setSaving = semester === 1 ? setSaving1 : setSaving2
    const setSaved  = semester === 1 ? setSaved1  : setSaved2

    const subjects = list
      .filter(s => selected.has(s.course_code))
      .map(s => ({ code: s.course_code, title: s.course_title }))

    setSaving(true)
    setError('')
    try {
      await api.post(`api/applications/${application.id}/subject-selections`, { semester, subjects })
      setSaved(true)
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-slate-500 p-6 text-sm">Loading subjects…</p>
  if (!info)   return <p className="text-red-500 p-6 text-sm">{error || 'Could not load subject data.'}</p>

  const readOnly = !info.can_select

  return (
    <section className="space-y-6 max-w-3xl">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-violet-600">Subject Selection</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">
          {application.course_name} — {YEAR_LABEL[application.year_of_study] || `Year ${application.year_of_study}`}
        </h1>
        <p className="mt-1 text-slate-500 text-sm">
          Select your subjects for each semester. Save each semester separately.
        </p>
      </div>

      {readOnly && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Subject selection is view-only. Editing is available after admission is confirmed.
        </div>
      )}

      <SemesterPanel
        semester={1}
        subjects={list1}
        selected={selected1}
        saving={saving1}
        saved={saved1}
        readOnly={readOnly}
        onToggle={code => toggle(1, code)}
        onSave={() => saveSemester(1)}
      />

      <SemesterPanel
        semester={2}
        subjects={list2}
        selected={selected2}
        saving={saving2}
        saved={saved2}
        readOnly={readOnly}
        onToggle={code => toggle(2, code)}
        onSave={() => saveSemester(2)}
      />

      {error && (
        <p className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <div className="flex gap-3 pt-2">
        <Button onClick={onDone} variant="secondary">Done</Button>
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
      </div>
    </section>
  )
}

function SemesterPanel({ semester, subjects, selected, saving, saved, readOnly, onToggle, onSave }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <p className="font-semibold text-slate-800">Semester {semester}</p>
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Saved
            </span>
          )}
        </div>
        {!readOnly && subjects.length > 0 && (
          <span className="text-xs text-slate-400">{selected.size} of {subjects.length} selected</span>
        )}
      </div>

      {/* Subject list */}
      {subjects.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-400">No subjects available for this semester.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {subjects.map(s => (
            <label
              key={s.course_code}
              className={`flex items-center gap-4 px-5 py-3 ${readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50'} transition`}
            >
              <input
                type="checkbox"
                checked={selected.has(s.course_code)}
                onChange={() => !readOnly && onToggle(s.course_code)}
                disabled={readOnly}
                className="h-4 w-4 rounded accent-violet-600 cursor-pointer shrink-0"
              />
              <span className="font-mono text-xs text-slate-500 w-28 shrink-0">{s.course_code}</span>
              <span className="text-sm text-slate-800 font-medium flex-1">{s.course_title}</span>
              {s.subject_type && (
                <span className="text-xs text-slate-400 shrink-0">{s.subject_type}</span>
              )}
            </label>
          ))}
        </div>
      )}

      {/* Save button */}
      {!readOnly && subjects.length > 0 && (
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
          <Button onClick={onSave} loading={saving} className="text-sm">
            Save Semester {semester}
          </Button>
          <span className="text-xs text-slate-400">Each semester is saved independently.</span>
        </div>
      )}
    </div>
  )
}
