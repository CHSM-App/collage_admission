import { useEffect, useState } from 'react'
import api from '../../../services/api.js'
import Button from '../../../shared/components/Button.jsx'

const YEAR_LABEL = { 1: 'FY', 2: 'SY', 3: 'TY' }

export default function SubjectSelection({ application, onDone, onCancel }) {
  const [data, setData]         = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    api.get(`applications/${application.id}/subjects`)
      .then(r => {
        setData(r.data.data)
        setSelected(new Set(r.data.data.selected_ids || []))
      })
      .catch(() => setError('Failed to load subjects.'))
      .finally(() => setLoading(false))
  }, [application.id])

  function toggleSubject(id, type) {
    const next = new Set(selected)
    if (next.has(id)) {
      if (type === 'core') return   // can't deselect core
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelected(next)
  }

  async function handleSubmit() {
    setSaving(true)
    setError('')
    try {
      await api.post(`applications/${application.id}/subjects`, {
        subject_ids: Array.from(selected),
      })
      onDone()
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-slate-500 p-6">Loading subjects…</p>
  if (!data)   return <p className="text-red-500 p-6">{error || 'Could not load subjects.'}</p>

  const coreSubjects     = data.subjects.filter(s => s.subject_type === 'core')
  const electiveGroups   = [...new Set(data.subjects.filter(s => s.subject_type === 'elective').map(s => s.elective_group))]

  return (
    <section className="space-y-6 max-w-2xl">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-violet-600">Subject Selection</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">
          {application.course_name} — {YEAR_LABEL[application.year_of_study]}
        </h1>
        <p className="mt-1 text-slate-500">
          Select your subjects to complete enrollment. Core subjects are compulsory.
        </p>
      </div>

      {/* Core subjects */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Core subjects (compulsory)</p>
        <div className="space-y-2">
          {coreSubjects.map(sub => (
            <label key={sub.id} className="flex items-center gap-3 rounded-md bg-slate-50 px-4 py-3 cursor-default">
              <input type="checkbox" checked readOnly className="accent-slate-700" />
              <span className="text-sm font-medium text-slate-800">{sub.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Elective groups */}
      {electiveGroups.map(group => {
        const groupSubs = data.subjects.filter(s => s.subject_type === 'elective' && s.elective_group === group)
        return (
          <div key={group} className="rounded-lg border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
              Elective Group {group}
            </p>
            <p className="text-xs text-slate-400 mb-3">Choose 1 subject from this group.</p>
            <div className="space-y-2">
              {groupSubs.map(sub => (
                <label key={sub.id} className="flex items-center gap-3 rounded-md bg-slate-50 px-4 py-3 cursor-pointer hover:bg-slate-100">
                  <input
                    type="radio"
                    name={`group-${group}`}
                    checked={selected.has(sub.id)}
                    onChange={() => {
                      const next = new Set(selected)
                      // Remove other subjects in same group
                      groupSubs.forEach(s => next.delete(s.id))
                      next.add(sub.id)
                      setSelected(next)
                    }}
                    className="accent-violet-600"
                  />
                  <span className="text-sm font-medium text-slate-800">{sub.name}</span>
                </label>
              ))}
            </div>
          </div>
        )
      })}

      {error && (
        <p className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <div className="flex gap-3">
        <Button onClick={handleSubmit} loading={saving}>
          Confirm & Enroll
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </section>
  )
}
