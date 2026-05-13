import { useEffect, useState, useCallback } from 'react'
import { getFaculty, getCourses, updateCourse, bulkSaveCourses, deleteCourse } from '../../../../services/masterService.js'
import { usePermissions } from '../../hooks/usePermissions.js'
import { SkeletonTable } from '../../../../shared/components/Skeleton.jsx'

const SUBJECT_TYPES = ['Core','Elective','Practical','Project','Foundation','AbilityEnhancement']
// Semester tabs are derived from the selected program's duration: tabs = years * 2
// (matches FacultyMaster's semSlotsFor). Clamp to [1, 10] to mirror schema limits.
const semCountFor = (yrs) => Math.max(1, Math.min(10, (parseInt(yrs) || 0) * 2))

const EMPTY_ROW = () => ({
  _key: Math.random(),
  course_code: '', course_title: '', credits: '', subject_type: 'Core',
  max_internal: '', min_internal: '', max_sem_end: '', min_sem_end: '',
  max_total: '', min_total: '', display_order: '',
  id: null, is_new: true,
})

function autoCalcTotal(row, field, val) {
  const updated = { ...row, [field]: val }
  const maxInt = parseFloat(updated.max_internal) || 0
  const maxSE  = parseFloat(updated.max_sem_end)  || 0
  const minInt = parseFloat(updated.min_internal) || 0
  const minSE  = parseFloat(updated.min_sem_end)  || 0
  if (maxInt || maxSE) updated.max_total = String(maxInt + maxSE)
  if (minInt || minSE) updated.min_total = String(minInt + minSE)
  return updated
}

export default function CourseMaster({ collegeId }) {
  const { canWrite } = usePermissions()
  const rw = canWrite('masters')
  const [faculty, setFaculty]     = useState([])
  const [selFaculty, setSelFaculty] = useState('')
  const [selSem, setSelSem]       = useState(1)
  const [rows, setRows]           = useState([])
  const [loading, setLoading]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')
  const [dirty, setDirty]         = useState(false)

  useEffect(() => {
    getFaculty(collegeId)
      .then(r => {
        const active = (r.data.data || []).filter(f => f.is_active)
        setFaculty(active)
        if (active.length) setSelFaculty(active[0].code_no)
      })
  }, [collegeId])

  const loadRows = useCallback(() => {
    if (!selFaculty) return
    setLoading(true); setError(''); setSuccess('')
    getCourses(collegeId, selFaculty, selSem)
      .then(r => { setRows((r.data.data || []).filter(row => row.is_active !== false).map(row => ({ ...row, _key: row.id, is_new: false }))); setDirty(false) })
      .catch(() => setError('Failed to load subjects.'))
      .finally(() => setLoading(false))
  }, [collegeId, selFaculty, selSem])

  useEffect(() => { loadRows() }, [loadRows])

  function switchSem(s) {
    if (dirty && !confirm('You have unsaved changes. Switch semester and discard them?')) return
    setSelSem(s)
  }

  function switchFaculty(v) {
    if (dirty && !confirm('You have unsaved changes. Switch course and discard them?')) return
    setSelFaculty(v)
  }

  function addRow() { setRows(r => [...r, EMPTY_ROW()]); setDirty(true) }

  function updateRow(key, field, val) {
    setRows(rs => rs.map(r => {
      if (r._key !== key) return r
      const isMarkField = ['max_internal','min_internal','max_sem_end','min_sem_end'].includes(field)
      return isMarkField ? autoCalcTotal(r, field, val) : { ...r, [field]: val }
    }))
    setDirty(true)
  }

  function removeRow(key) { setRows(rs => rs.filter(r => r._key !== key)); setDirty(true) }

  async function saveAll() {
    setError(''); setSuccess('')
    const valid = rows.filter(r => r.course_code.trim() && r.course_title.trim())
    for (const r of valid) {
      if (r.max_internal && r.min_internal && parseInt(r.min_internal) > parseInt(r.max_internal))
        return setError(`Row "${r.course_title}": min_internal > max_internal.`)
      if (r.max_sem_end && r.min_sem_end && parseInt(r.min_sem_end) > parseInt(r.max_sem_end))
        return setError(`Row "${r.course_title}": min_sem_end > max_sem_end.`)
    }
    // Check for duplicate subject codes within the current batch
    const newCodes = valid.filter(r => r.is_new || !r.id).map(r => r.course_code.trim().toUpperCase())
    const dupInBatch = newCodes.find((c, i) => newCodes.indexOf(c) !== i)
    if (dupInBatch) return setError(`Duplicate subject code "${dupInBatch}" in the list. Each subject code must be unique.`)
    // Check new codes against already-saved rows (different id, same code)
    const existingCodes = valid.filter(r => !r.is_new && r.id).map(r => r.course_code.trim().toUpperCase())
    const dupWithExisting = newCodes.find(c => existingCodes.includes(c))
    if (dupWithExisting) return setError(`Subject code "${dupWithExisting}" already exists in this program and semester.`)
    setSaving(true)
    try {
      // Existing rows: update individually by id (avoids creating duplicates when course_code is edited)
      const existingRows = valid.filter(r => !r.is_new && r.id)
      const newRows      = valid.filter(r => r.is_new || !r.id)

      for (const r of existingRows) {
        await updateCourse(collegeId, r.id, {
          faculty_master_id: selFaculty, semester: selSem,
          course_code: r.course_code, course_title: r.course_title,
          credits: r.credits, subject_type: r.subject_type,
          max_internal: r.max_internal, min_internal: r.min_internal,
          max_sem_end: r.max_sem_end, min_sem_end: r.min_sem_end,
          max_total: r.max_total, min_total: r.min_total,
          display_order: r.display_order, is_active: 1,
        })
      }

      // New rows: use bulk-save (MERGE insert)
      if (newRows.length > 0) {
        await bulkSaveCourses(collegeId, {
          faculty_master_id: selFaculty,
          semester: selSem,
          rows: newRows,
        })
      }

      setSuccess('Saved successfully.')
      setDirty(false)
      setTimeout(() => setSuccess(''), 3000)
      loadRows()
    } catch (e) { setError(e?.response?.data?.message || 'Save failed.') }
    finally { setSaving(false) }
  }

  async function deleteRow(row) {
    if (row.is_new) { removeRow(row._key); return }
    if (!confirm(`Delete "${row.course_title}"? This cannot be undone.`)) return
    try {
      await deleteCourse(collegeId, row.id)
      setRows(rs => rs.filter(r => r._key !== row._key))
    } catch { alert('Delete failed.') }
  }

  const selFacultyRow  = faculty.find(f => f.code_no == selFaculty)
  const selFacultyName = selFacultyRow?.degree_course_name || ''
  const semCount       = semCountFor(selFacultyRow?.duration_years)
  const semesters      = Array.from({ length: semCount }, (_, i) => i + 1)

  // Selected semester can fall outside the new program's range when the user
  // switches from a longer to a shorter course — snap back to Sem 1 silently.
  useEffect(() => {
    if (selFacultyRow && selSem > semCount) setSelSem(1)
  }, [selFacultyRow, semCount, selSem])

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <h2 className="text-lg font-semibold text-slate-800">Course Master <span className="text-sm font-normal text-slate-400">(Subjects per Semester)</span></h2>
        <div className="flex gap-2">
          {rw && <button onClick={addRow} className="px-3 py-1.5 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50">+ Add Row</button>}
          {rw && <button onClick={saveAll} disabled={saving} className="px-3 py-1.5 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save All'}
          </button>}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500">Degree Course</label>
          <select value={selFaculty} onChange={e => switchFaculty(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 w-full sm:min-w-[200px]">
            {faculty.map(f => <option key={f.code_no} value={f.code_no}>{f.degree_course_code} — {f.degree_course_name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500">Semester</label>
          <div className="flex gap-1 flex-wrap">
            {semesters.map(s => (
              <button key={s} onClick={() => switchSem(s)}
                className={`w-9 h-9 rounded-lg text-sm font-medium border transition ${selSem === s ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {selFacultyName && (
        <p className="text-xs text-slate-400 mb-3">
          {selFacultyName} — {selFacultyRow?.duration_years || '?'} years ({semCount} semesters) — Semester {selSem}
        </p>
      )}

      {error   && <p className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      {success && <p className="mb-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{success}</p>}

      {loading ? <SkeletonTable rows={4} cols={5} /> : (
        <div className="overflow-x-auto rounded-lg border-2 border-slate-400 -mx-0">
          <div className="min-w-[860px]">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-slate-100 text-xs font-bold text-slate-600 uppercase tracking-wide border-b-2 border-slate-400">
                <tr>
                  <th className="px-3 py-2.5 text-left w-28">Subject Code</th>
                  <th className="px-3 py-2.5 text-left">Subject Title</th>
                  <th className="px-3 py-2.5 text-center w-16">Credits</th>
                  <th className="px-3 py-2.5 text-center w-20">Type</th>
                  <th className="px-3 py-2.5 text-center w-20">Max Int.</th>
                  <th className="px-3 py-2.5 text-center w-20">Min Int.</th>
                  <th className="px-3 py-2.5 text-center w-20">Max SE</th>
                  <th className="px-3 py-2.5 text-center w-20">Min SE</th>
                  <th className="px-3 py-2.5 text-center w-20">Max Tot.</th>
                  <th className="px-3 py-2.5 text-center w-20">Min Tot.</th>
                  <th className="px-3 py-2.5 text-center w-16">Order</th>
                  <th className="px-3 py-2.5 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-300">
                {rows.length === 0 && (
                  <tr><td colSpan={12} className="px-4 py-8 text-center text-slate-500">
                    No subjects yet. Click "+ Add Row" to begin.
                  </td></tr>
                )}
                {rows.map(r => (
                  <tr key={r._key} className={r.is_new ? 'bg-blue-50/40' : 'hover:bg-blue-50 transition'}>
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
