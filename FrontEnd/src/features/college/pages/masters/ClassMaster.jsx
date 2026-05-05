import { useEffect, useState, useCallback } from 'react'
import api from '../../../../services/api.js'
import { usePermissions } from '../../hooks/usePermissions.js'

const YEAR_OPTIONS = [
  { value: 1, label: 'FY — First Year' },
  { value: 2, label: 'SY — Second Year' },
  { value: 3, label: 'TY — Third Year' },
]

const YEAR_SHORT = { 1: 'FY', 2: 'SY', 3: 'TY' }

const EMPTY_FORM = { faculty_master_id: '', year_of_study: 1, label: '', is_active: true }

export default function ClassMaster({ collegeId }) {
  const { canWrite } = usePermissions()
  const rw = canWrite('masters')

  const [programs, setPrograms] = useState([])
  const [rows, setRows]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  // Inline "new" form
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [saving, setSaving]     = useState(false)
  const [formError, setFormError] = useState('')

  // Inline edit state: { id, label, is_active }
  const [editId, setEditId]     = useState(null)
  const [editLabel, setEditLabel] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    api.get(`masters/${collegeId}/faculty`)
      .then(r => {
        const active = (r.data.data || []).filter(f => f.is_active)
        setPrograms(active)
        if (active.length) setForm(f => ({ ...f, faculty_master_id: active[0].code_no }))
      })
      .catch(() => setError('Failed to load programs.'))
  }, [collegeId])

  const load = useCallback(() => {
    setLoading(true)
    api.get(`masters/${collegeId}/class`)
      .then(r => setRows(r.data.data || []))
      .catch(() => setError('Failed to load classes.'))
      .finally(() => setLoading(false))
  }, [collegeId])

  useEffect(() => { load() }, [load])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.faculty_master_id) return setFormError('Select a program.')
    setSaving(true); setFormError('')
    try {
      await api.post(`masters/${collegeId}/class`, {
        faculty_master_id: form.faculty_master_id,
        year_of_study:     form.year_of_study,
        label:             form.label || null,
        is_active:         form.is_active,
      })
      setShowForm(false)
      setForm({ ...EMPTY_FORM, faculty_master_id: programs[0]?.code_no || '' })
      load()
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Save failed.')
    } finally { setSaving(false) }
  }

  function startEdit(row) {
    setEditId(row.id)
    setEditLabel(row.label || '')
    setEditActive(!!row.is_active)
  }

  function cancelEdit() { setEditId(null) }

  async function saveEdit(row) {
    setEditSaving(true)
    try {
      await api.put(`masters/${collegeId}/class/${row.id}`, {
        label:     editLabel || null,
        is_active: editActive,
      })
      setEditId(null)
      load()
    } catch (err) {
      alert(err?.response?.data?.message || 'Save failed.')
    } finally { setEditSaving(false) }
  }

  async function handleDelete(row) {
    if (!confirm(`Delete class "${row.degree_course_code} — ${YEAR_SHORT[row.year_of_study]}"? This cannot be undone.`)) return
    try {
      await api.delete(`masters/${collegeId}/class/${row.id}`)
      load()
    } catch (err) {
      alert(err?.response?.data?.message || 'Delete failed.')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="text-lg font-semibold text-slate-800">
          Class Master <span className="text-sm font-normal text-slate-400">(Program + Year)</span>
        </h2>
        {rw && !showForm && (
          <button
            onClick={() => { setShowForm(true); setFormError('') }}
            className="shrink-0 px-3 py-1.5 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700"
          >
            + New Class
          </button>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      {/* Inline create form */}
      {showForm && rw && (
        <form
          onSubmit={handleCreate}
          className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3 max-w-lg"
        >
          <p className="text-sm font-semibold text-slate-800">New Class</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600">Program *</label>
              <select
                required
                value={form.faculty_master_id}
                onChange={e => set('faculty_master_id', e.target.value)}
                className={inp}
              >
                <option value="">Select program…</option>
                {programs.map(p => (
                  <option key={p.code_no} value={p.code_no}>
                    {p.degree_course_code} — {p.degree_course_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600">Year of Study *</label>
              <select
                value={form.year_of_study}
                onChange={e => set('year_of_study', parseInt(e.target.value))}
                className={inp}
              >
                {YEAR_OPTIONS.map(y => (
                  <option key={y.value} value={y.value}>{y.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600">Label <span className="font-normal text-slate-400">(optional, e.g. "FY B.Com")</span></label>
            <input
              value={form.label}
              onChange={e => set('label', e.target.value)}
              className={inp}
              placeholder="FY B.Com"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => set('is_active', e.target.checked)}
              className="accent-slate-700"
            />
            Active
          </label>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-1.5 text-sm text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Program</th>
                  <th className="px-4 py-3 text-center">Year</th>
                  <th className="px-4 py-3 text-left">Label</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      No classes configured yet.
                    </td>
                  </tr>
                )}
                {rows.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-800">
                      <span className="font-mono font-semibold text-slate-700">{row.degree_course_code}</span>
                      <span className="text-slate-400 ml-1 text-xs">— {row.degree_course_name}</span>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-700">
                      {YEAR_SHORT[row.year_of_study]}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {editId === row.id ? (
                        <input
                          value={editLabel}
                          onChange={e => setEditLabel(e.target.value)}
                          className={inp}
                          placeholder="Optional label"
                        />
                      ) : (
                        row.label || <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {editId === row.id ? (
                        <label className="flex items-center justify-center gap-1 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={editActive}
                            onChange={e => setEditActive(e.target.checked)}
                            className="accent-slate-700"
                          />
                          Active
                        </label>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${row.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                          {row.is_active ? 'Active' : 'Inactive'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {rw && editId === row.id ? (
                        <>
                          <button
                            onClick={() => saveEdit(row)}
                            disabled={editSaving}
                            className="text-xs text-slate-700 hover:text-slate-900 underline disabled:opacity-50"
                          >
                            {editSaving ? 'Saving…' : 'Save'}
                          </button>
                          <button onClick={cancelEdit} className="text-xs text-slate-400 hover:text-slate-600 underline">
                            Cancel
                          </button>
                        </>
                      ) : rw ? (
                        <>
                          <button onClick={() => startEdit(row)} className="text-xs text-slate-500 hover:text-slate-800 underline">Edit</button>
                          <button onClick={() => handleDelete(row)} className="text-xs text-red-400 hover:text-red-600 underline">Delete</button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="sm:hidden space-y-2">
            {rows.length === 0 && (
              <p className="text-center text-slate-400 py-8 text-sm">No classes configured yet.</p>
            )}
            {rows.map(row => (
              <div key={row.id} className="border border-slate-100 rounded-xl p-4 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono font-semibold text-slate-700">{row.degree_course_code} — {YEAR_SHORT[row.year_of_study]}</p>
                    <p className="text-sm text-slate-500 mt-0.5">{row.degree_course_name}</p>
                    {row.label && <p className="text-xs text-slate-400 mt-1">{row.label}</p>}
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${row.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                    {row.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {rw && (
                  <div className="flex gap-3 mt-3">
                    <button onClick={() => startEdit(row)} className="text-xs text-slate-500 hover:text-slate-800 underline">Edit</button>
                    <button onClick={() => handleDelete(row)} className="text-xs text-red-400 hover:text-red-600 underline">Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white'
