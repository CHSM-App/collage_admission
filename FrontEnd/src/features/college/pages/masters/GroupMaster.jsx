import { useEffect, useState, useCallback, useMemo } from 'react'
import { getFaculty, getGroups, getGroup, getCoursesForSemester, createGroup, updateGroup, deleteGroup, masterCacheRead, masterCacheHas } from '../../../../services/masterService.js'
import { usePermissions } from '../../hooks/usePermissions.js'
import { SkeletonTable } from '../../../../shared/components/Skeleton.jsx'
import { useToast } from '../../../../context/ToastContext.jsx'
import { getErrorMessage } from '../../../../shared/hooks/useNetworkError.js'

const NUM_SLOTS  = 11
const semCountFor = (yrs) => Math.max(1, Math.min(10, (parseInt(yrs) || 0) * 2))

const EMPTY_GROUP = (facultyId, sem) => ({
  faculty_master_id: facultyId,
  semester: sem,
  group_code: '',
  group_description: '',
  is_active: true,
  courses: Array.from({ length: NUM_SLOTS }, (_, i) => ({ course_position: i + 1, course_code: '', course_title: '' })),
})

export default function GroupMaster({ collegeId }) {
  const { canWrite } = usePermissions()
  const rw = canWrite('masters')
  const toast = useToast()
  const [faculty, setFaculty]       = useState(() => (masterCacheRead(`faculty:${collegeId}`)?.data?.data ?? []).filter(f => f.is_active))
  const [selFaculty, setSelFaculty] = useState(() => {
    const cached = (masterCacheRead(`faculty:${collegeId}`)?.data?.data ?? []).filter(f => f.is_active)
    return cached.length ? cached[0].code_no : ''
  })
  const [selSem, setSelSem]         = useState(1)
  const [groups, setGroups]         = useState([])
  const [loading, setLoading]       = useState(false)
  const [modal, setModal]           = useState(null)   // null | 'new' | group object
  const [form, setForm]             = useState(null)
  const [courseHints, setCourseHints] = useState([])   // autocomplete from course_master
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [sortCol, setSortCol] = useState('group_code')
  const [sortDir, setSortDir] = useState('asc')
  function toggleSortGM(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }
  const sortedGroups = useMemo(() => [...groups].sort((a, b) => {
    let av = a[sortCol], bv = b[sortCol]
    if (av == null) av = ''; if (bv == null) bv = ''
    const cmp = sortCol === 'course_count' ? Number(av) - Number(bv)
      : typeof av === 'boolean' || typeof bv === 'boolean'
        ? (av === bv ? 0 : av ? -1 : 1)
        : String(av).localeCompare(String(bv))
    return sortDir === 'asc' ? cmp : -cmp
  }), [groups, sortCol, sortDir])

  useEffect(() => {
    getFaculty(collegeId, r => {
      const active = (r.data.data || []).filter(f => f.is_active)
      setFaculty(active)
    }).then(r => {
      const active = (r.data.data || []).filter(f => f.is_active)
      setFaculty(active)
      if (active.length && !selFaculty) setSelFaculty(active[0].code_no)
    })
  }, [collegeId])

  const selFacultyRow = faculty.find(f => f.code_no == selFaculty)
  const semCount      = semCountFor(selFacultyRow?.duration_years)
  const semesters     = Array.from({ length: semCount }, (_, i) => i + 1)

  // Snap selSem back to 1 when switching to a program with fewer semesters
  useEffect(() => {
    if (selFacultyRow && selSem > semCount) setSelSem(1)
  }, [selFacultyRow, semCount, selSem])

  const loadGroups = useCallback((silent = false) => {
    if (!selFaculty) return
    const wasMiss = !masterCacheHas(`group:${collegeId}:${selFaculty}:${selSem}`)
    if (!silent && wasMiss) setLoading(true)
    getGroups(collegeId, selFaculty, selSem, r => setGroups(r.data.data || []))
      .then(r => setGroups(r.data.data || []))
      .catch(() => {})
      .finally(() => { if (!silent && wasMiss) setLoading(false) })
  }, [collegeId, selFaculty, selSem])

  useEffect(() => { loadGroups() }, [loadGroups])

  // Load course hints for ALL faculties at the selected semester (for elective autocomplete)
  useEffect(() => {
    getCoursesForSemester(collegeId, selSem, r => setCourseHints(r.data.data || []))
      .then(r => setCourseHints(r.data.data || []))
      .catch(() => {})
  }, [collegeId, selSem])

  function openNew() {
    setForm(EMPTY_GROUP(selFaculty, selSem))
    setModal('new'); setError('')
  }

  async function openEdit(g) {
    const r = await getGroup(collegeId, g.id)
    const data = r.data.data
    const existing = data.courses || []
    const padded = Array.from({ length: NUM_SLOTS }, (_, i) => {
      const found = existing.find(c => c.course_position === i + 1)
      return found || { course_position: i + 1, course_code: '', course_title: '' }
    })
    setForm({ ...data, courses: padded })
    setModal(data); setError('')
  }

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function setCourseRow(pos, field, val) {
    setForm(f => ({
      ...f,
      courses: f.courses.map(c => c.course_position === pos ? { ...c, [field]: val } : c),
    }))
  }

  function handleCodeChange(pos, code) {
    setCourseRow(pos, 'course_code', code)
    const hint = courseHints.find(h => h.course_code === code)
    if (hint) setCourseRow(pos, 'course_title', hint.course_title)
  }

  async function save() {
    if (!form.group_code.trim())       return setError('Group Code is required.')
    if (!form.group_description.trim()) return setError('Group Description is required.')

    // Duplicate Code+Title check within this group's slots.
    // Compare on trimmed/lowercased values to match SQL's case-insensitive collation.
    const filledRows = form.courses.filter(c => c.course_code.trim() || c.course_title.trim())
    const seen = new Map()
    for (const c of filledRows) {
      const key = `${c.course_code.trim().toLowerCase()}|${c.course_title.trim().toLowerCase()}`
      if (seen.has(key)) {
        return setError(`Selected Course Code and Course Title combination already exists (slots ${seen.get(key)} and ${c.course_position}).`)
      }
      seen.set(key, c.course_position)
    }

    setSaving(true); setError('')
    const payload = {
      ...form,
      courses: form.courses.filter(c => c.course_code.trim()),
    }
    try {
      if (modal === 'new') await createGroup(collegeId, payload)
      else await updateGroup(collegeId, modal.id, payload)
      setModal(null); loadGroups(true)
    } catch (e) { setError(getErrorMessage(e, 'Save failed.')) }
    finally { setSaving(false) }
  }

  async function softDelete(g) {
    if (!confirm(`Deactivate group "${g.group_code}"?`)) return
    try { await deleteGroup(collegeId, g.id); loadGroups(true) }
    catch { toast.error('Failed.') }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="text-lg font-semibold text-slate-800">
          Group Master <span className="text-sm font-normal text-slate-400">(Subject Combinations)</span>
        </h2>
        {rw && <button onClick={openNew} className="shrink-0 px-3 py-1.5 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700">+ New Group</button>}
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
            {semesters.map(s => (
              <button key={s} onClick={() => setSelSem(s)}
                className={`w-9 h-9 rounded-lg text-sm font-medium border transition ${selSem === s ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TODO: confirm with stakeholder — BA uses Group Master alone or alongside Course Master? */}
      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
        ⚠ Stakeholder confirmation needed: does this program use Group Master alone, or alongside Course Master?
        Currently treated as supplemental (Course Master holds all subjects; Group Master defines valid combinations).
      </p>

      {loading ? <SkeletonTable rows={4} cols={3} /> : (
        <>
          {/* Desktop table — matches Program Master grid styling. */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border-2 border-slate-400">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-100 text-xs font-bold text-slate-600 uppercase tracking-wide border-b-2 border-slate-400">
                <tr>
                  <GMTh col="group_code"        label="Group Code"  align="left"   sortCol={sortCol} sortDir={sortDir} onSort={toggleSortGM} />
                  <GMTh col="group_description" label="Description" align="left"   sortCol={sortCol} sortDir={sortDir} onSort={toggleSortGM} />
                  <GMTh col="course_count"      label="Subjects"    align="center" sortCol={sortCol} sortDir={sortDir} onSort={toggleSortGM} />
                  <GMTh col="is_active"         label="Status"      align="center" sortCol={sortCol} sortDir={sortDir} onSort={toggleSortGM} />
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-300">
                {sortedGroups.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No groups defined.</td></tr>}
                {sortedGroups.map(g => (
                  <tr key={g.id} className="hover:bg-blue-50 transition">
                    <td className="px-4 py-2.5 font-mono font-semibold text-slate-900">{g.group_code}</td>
                    <td className="px-4 py-2.5 text-slate-700">{g.group_description}</td>
                    <td className="px-4 py-2.5 text-center text-slate-700">{g.course_count}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${g.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {g.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right space-x-3 whitespace-nowrap">
                      {rw && <button onClick={() => openEdit(g)} className="text-xs font-medium text-slate-500 hover:text-slate-800 underline">Edit</button>}
                      {rw && g.is_active && <button onClick={() => softDelete(g)} className="text-xs font-medium text-red-400 hover:text-red-600 underline">Deactivate</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="sm:hidden space-y-2">
            {sortedGroups.length === 0 && <p className="text-center text-slate-500 py-8 text-sm">No groups defined.</p>}
            {sortedGroups.map(g => (
              <div key={g.id} className="border-2 border-slate-400 rounded-lg p-4 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono font-semibold text-slate-900">{g.group_code}</p>
                    <p className="text-sm text-slate-700 mt-0.5">{g.group_description}</p>
                    <p className="text-xs text-slate-400 mt-1">{g.course_count} subjects</p>
                  </div>
                  <span className={`shrink-0 inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${g.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {g.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex gap-3 mt-3">
                  <button onClick={() => openEdit(g)} className="text-xs font-medium text-slate-500 hover:text-slate-800 underline">Edit</button>
                  {g.is_active && <button onClick={() => softDelete(g)} className="text-xs font-medium text-red-400 hover:text-red-600 underline">Deactivate</button>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal */}
      {modal && form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <h3 className="font-semibold text-slate-800">{modal === 'new' ? 'New Group' : 'Edit Group'}</h3>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="overflow-y-auto px-6 py-5 space-y-4">
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-600">Group Code *</label>
                  <input value={form.group_code} onChange={e => setField('group_code', e.target.value.toUpperCase())}
                    className={inp} placeholder="HPE-01" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-600">Status</label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 mt-2">
                    <input type="checkbox" checked={!!form.is_active} onChange={e => setField('is_active', e.target.checked)} className="accent-slate-700" />
                    Active
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">Group Description *</label>
                <input value={form.group_description} onChange={e => setField('group_description', e.target.value)}
                  className={inp} placeholder="History-Political Science-Economics" />
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Subject Slots (up to {NUM_SLOTS})
                  {courseHints.length > 0 && <span className="normal-case font-normal text-slate-400 ml-2">— Course codes auto-fill from Course Master</span>}
                </p>
                <div className="space-y-1.5">
                  {form.courses.map(c => (
                    <div key={c.course_position} className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-5 text-right shrink-0">{c.course_position}.</span>
                      <input
                        list={`hints-${c.course_position}`}
                        value={c.course_code}
                        onChange={e => handleCodeChange(c.course_position, e.target.value)}
                        className="border border-slate-200 rounded px-2 py-1.5 text-xs w-28 sm:w-32 focus:outline-none focus:ring-1 focus:ring-slate-300"
                        placeholder="Code"
                      />
                      <datalist id={`hints-${c.course_position}`}>
                        {courseHints.map(h => <option key={h.course_code} value={h.course_code}>{h.course_title}</option>)}
                      </datalist>
                      <input
                        value={c.course_title}
                        onChange={e => setCourseRow(c.course_position, 'course_title', e.target.value)}
                        className="border border-slate-200 rounded px-2 py-1.5 text-xs flex-1 focus:outline-none focus:ring-1 focus:ring-slate-300"
                        placeholder="Course Title"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
              <button onClick={save} disabled={saving} className="px-5 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300'

function GMTh({ col, label, align = 'left', sortCol, sortDir, onSort }) {
  const active = sortCol === col
  return (
    <th
      className={`px-4 py-2.5 text-${align} cursor-pointer select-none text-xs font-bold uppercase tracking-wide text-slate-600 hover:text-slate-900 transition`}
      onClick={() => onSort(col)}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'ml-auto' : ''}`}>
        {label}
        <span className="text-slate-300">{active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
      </span>
    </th>
  )
}
