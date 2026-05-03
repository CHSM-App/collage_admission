import { useEffect, useState, useCallback } from 'react'
import api from '../../../../services/api.js'

const SUBJECT_TYPES = ['Core','Elective','Practical','Project','Foundation','AbilityEnhancement']
const SEMESTERS     = [1,2,3,4,5,6]

const EMPTY_ROW = () => ({
  _key: Math.random(),
  course_code: '', course_title: '', credits: '', subject_type: 'Core',
  max_internal: '', min_internal: '', max_sem_end: '', min_sem_end: '',
  max_total: '', min_total: '', display_order: '',
  id: null, is_new: true,
})

export default function CourseMaster({ collegeId }) {
  const [faculty, setFaculty]     = useState([])
  const [selFaculty, setSelFaculty] = useState('')
  const [selSem, setSelSem]       = useState(1)
  const [rows, setRows]           = useState([])
  const [loading, setLoading]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')

  useEffect(() => {
    api.get(`masters/${collegeId}/faculty`)
      .then(r => {
        const active = (r.data.data || []).filter(f => f.is_active)
        setFaculty(active)
        if (active.length) setSelFaculty(active[0].code_no)
      })
  }, [collegeId])

  const loadRows = useCallback(() => {
    if (!selFaculty) return
    setLoading(true); setError('')
    api.get(`masters/${collegeId}/course?faculty_id=${selFaculty}&semester=${selSem}`)
      .then(r => setRows((r.data.data || []).map(row => ({ ...row, _key: row.id, is_new: false }))))
      .catch(() => setError('Failed to load subjects.'))
      .finally(() => setLoading(false))
  }, [collegeId, selFaculty, selSem])

  useEffect(() => { loadRows() }, [loadRows])

  function addRow() { setRows(r => [...r, EMPTY_ROW()]) }

  function updateRow(key, field, val) {
    setRows(rs => rs.map(r => r._key === key ? { ...r, [field]: val } : r))
  }

  function removeRow(key) { setRows(rs => rs.filter(r => r._key !== key)) }

  async function saveAll() {
    setError(''); setSuccess('')
    for (const r of rows) {
      if (!r.course_code.trim() || !r.course_title.trim()) continue
      if (r.max_internal && r.min_internal && parseInt(r.min_internal) > parseInt(r.max_internal))
        return setError(`Row "${r.course_title}": min_internal > max_internal.`)
      if (r.max_sem_end && r.min_sem_end && parseInt(r.min_sem_end) > parseInt(r.max_sem_end))
        return setError(`Row "${r.course_title}": min_sem_end > max_sem_end.`)
    }
    setSaving(true)
    try {
      await api.post(`masters/${collegeId}/course/bulk-save`, {
        faculty_master_id: selFaculty,
        semester: selSem,
        rows: rows.filter(r => r.course_code.trim() && r.course_title.trim()),
      })
      setSuccess('Saved successfully.')
      loadRows()
    } catch (e) { setError(e?.response?.data?.message || 'Save failed.') }
    finally { setSaving(false) }
  }

  async function deleteRow(row) {
    if (row.is_new) { removeRow(row._key); return }
    if (!confirm(`Delete "${row.course_title}"?`)) return
    try {
      await api.delete(`masters/${collegeId}/course/${row.id}`)
      loadRows()
    } catch { alert('Delete failed.') }
  }

  const selFacultyName = faculty.find(f => f.code_no == selFaculty)?.degree_course_name || ''

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <h2 className="text-lg font-semibold text-slate-800">Course Master <span className="text-sm font-normal text-slate-400">(Subjects per Semester)</span></h2>
        <div className="flex gap-2">
          <button onClick={addRow} className="px-3 py-1.5 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50">+ Add Row</button>
          <button onClick={saveAll} disabled={saving} className="px-3 py-1.5 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save All'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500">Degree Course</label>
          <select value={selFaculty} onChange={e => setSelFaculty(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 w-full sm:min-w-[200px]">
            {faculty.map(f => <option key={f.code_no} value={f.code_no}>{f.degree_course_code} — {f.degree_course_name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500">Semester</label>
          <div className="flex gap-1 flex-wrap">
            {SEMESTERS.map(s => (
              <button key={s} onClick={() => setSelSem(s)}
                className={`w-9 h-9 rounded-lg text-sm font-medium border transition ${selSem === s ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {selFacultyName && (
        <p className="text-xs text-slate-400 mb-3">{selFacultyName} — Semester {selSem}</p>
      )}

      {error   && <p className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      {success && <p className="mb-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{success}</p>}

      {loading ? <p className="text-sm text-slate-400">Loading…</p> : (
        <div className="overflow-x-auto rounded-xl border border-slate-100 -mx-0">
          <div className="min-w-[860px]">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2 text-left w-28">Course Code</th>
                  <th className="px-3 py-2 text-left">Course Title</th>
                  <th className="px-3 py-2 text-center w-16">Credits</th>
                  <th className="px-3 py-2 text-center w-20">Type</th>
                  <th className="px-3 py-2 text-center w-20">Max Int.</th>
                  <th className="px-3 py-2 text-center w-20">Min Int.</th>
                  <th className="px-3 py-2 text-center w-20">Max SE</th>
                  <th className="px-3 py-2 text-center w-20">Min SE</th>
                  <th className="px-3 py-2 text-center w-20">Max Tot.</th>
                  <th className="px-3 py-2 text-center w-20">Min Tot.</th>
                  <th className="px-3 py-2 text-center w-16">Order</th>
                  <th className="px-3 py-2 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.length === 0 && (
                  <tr><td colSpan={12} className="px-4 py-8 text-center text-slate-400">
                    No subjects yet. Click "+ Add Row" to begin.
                  </td></tr>
                )}
                {rows.map(r => (
                  <tr key={r._key} className={r.is_new ? 'bg-blue-50/40' : 'hover:bg-slate-50'}>
                    <td className="px-2 py-1.5">
                      <input value={r.course_code} onChange={e => updateRow(r._key,'course_code',e.target.value.toUpperCase())}
                        className={cell} placeholder="UBIFSI.1" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={r.course_title} onChange={e => updateRow(r._key,'course_title',e.target.value)}
                        className={`${cell} min-w-[160px]`} placeholder="Financial Accounting" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" step="0.5" value={r.credits} onChange={e => updateRow(r._key,'credits',e.target.value)}
                        className={`${cell} text-center`} placeholder="4.0" />
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={r.subject_type} onChange={e => updateRow(r._key,'subject_type',e.target.value)} className={cell}>
                        {SUBJECT_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </td>
                    {['max_internal','min_internal','max_sem_end','min_sem_end','max_total','min_total'].map(f => (
                      <td key={f} className="px-2 py-1.5">
                        <input type="number" value={r[f]} onChange={e => updateRow(r._key, f, e.target.value)}
                          className={`${cell} text-center`} placeholder="—" />
                      </td>
                    ))}
                    <td className="px-2 py-1.5">
                      <input type="number" value={r.display_order} onChange={e => updateRow(r._key,'display_order',e.target.value)}
                        className={`${cell} text-center`} placeholder="0" />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button onClick={() => deleteRow(r)} className="text-red-400 hover:text-red-600 text-base leading-none">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-slate-400">
        SE = Semester End exam. All marks fields are optional. Min ≤ Max enforced on save.
        {/* TODO: "Update from Result 9" — stub for legacy sync; confirm exact source with stakeholder */}
      </p>
    </div>
  )
}

const cell = 'w-full border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-300 bg-white'
