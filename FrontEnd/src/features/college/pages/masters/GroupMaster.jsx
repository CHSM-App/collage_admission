import { useEffect, useState, useCallback, useMemo } from 'react'
import { getFaculty, getGroups, getGroup, getCourses, createGroup, updateGroup, deleteGroup, invalidateGroups, masterCacheRead, masterCacheHas } from '../../../../services/masterService.js'
import { usePermissions } from '../../hooks/usePermissions.js'
import { SkeletonTable } from '../../../../shared/components/Skeleton.jsx'
import ImportButton from '../../../../shared/components/ImportButton.jsx'
import { useToast } from '../../../../context/ToastContext.jsx'
import { getErrorMessage } from '../../../../shared/hooks/useNetworkError.js'
import { COURSE_TYPES } from '../../constants/courseTypes.js'

const semCountFor = (yrs) => Math.max(1, Math.min(10, (parseInt(yrs) || 0) * 2))

const EMPTY_GROUP = (facultyId, sem) => ({
  faculty_master_id: facultyId,
  semester: sem,
  group_description: '',
  is_active: true,
  course_master_ids: [],
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
  const [subjects, setSubjects]     = useState([])     // Course Master rows for the form's semester
  const [typeFilter, setTypeFilter] = useState('')
  const [dropped, setDropped]       = useState([])     // legacy members with no Course Master link
  const [viewing, setViewing]       = useState(null)   // { group, courses }
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

  // The picker only ever offers subjects of the group's own program-semester —
  // that is exactly what the API will accept back.
  const loadSubjects = useCallback((facultyId, sem) => {
    setSubjects([])
    return getCourses(collegeId, facultyId, sem, r => setSubjects(activeSubjects(r)))
      .then(r => setSubjects(activeSubjects(r)))
      .catch(() => setSubjects([]))
  }, [collegeId])

  function openNew() {
    setForm(EMPTY_GROUP(selFaculty, selSem))
    setDropped([]); setTypeFilter(''); setError('')
    setModal('new')
    loadSubjects(selFaculty, selSem)
  }

  async function openEdit(g) {
    try {
      const r = await getGroup(collegeId, g.id)
      const data = r.data.data
      const members = data.courses || []
      // Members with no Course Master link are free-text rows from before
      // migration 046, or subjects since deleted. They cannot be re-sent as
      // ids, so say plainly that saving drops them rather than losing them
      // quietly.
      const linked = members.filter(c => c.course_master_id != null)
      setDropped(members.filter(c => c.course_master_id == null))
      setForm({
        faculty_master_id: data.faculty_master_id,
        semester: data.semester,
        group_description: data.group_description || '',
        is_active: !!data.is_active,
        course_master_ids: linked.map(c => c.course_master_id),
      })
      setTypeFilter(''); setError('')
      setModal(data)
      loadSubjects(data.faculty_master_id, data.semester)
    } catch (e) { toast.error(getErrorMessage(e, 'Could not open that group.')) }
  }

  async function openView(g) {
    try {
      const r = await getGroup(collegeId, g.id)
      setViewing({ group: r.data.data, courses: r.data.data.courses || [] })
    } catch (e) { toast.error(getErrorMessage(e, 'Could not open that group.')) }
  }

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function toggleSubject(id) {
    setForm(f => ({
      ...f,
      course_master_ids: f.course_master_ids.includes(id)
        ? f.course_master_ids.filter(x => x !== id)
        : [...f.course_master_ids, id],
    }))
  }

  const filteredSubjects = useMemo(
    () => typeFilter ? subjects.filter(s => s.subject_type === typeFilter) : subjects,
    [subjects, typeFilter]
  )

  async function save() {
    if (!form.group_description.trim()) return setError('Group Description is required.')
    if (form.course_master_ids.length === 0) return setError('Select at least one subject.')

    setSaving(true); setError('')
    try {
      if (modal === 'new') await createGroup(collegeId, form)
      else await updateGroup(collegeId, modal.id, form)
      setModal(null); loadGroups(true)
    } catch (e) { setError(getErrorMessage(e, 'Save failed.')) }
    finally { setSaving(false) }
  }

  async function softDelete(g) {
    if (!confirm(`Deactivate group "${g.group_code}"?`)) return
    try { await deleteGroup(collegeId, g.id); loadGroups(true) }
    catch { toast.error('Failed.') }
  }

  const semSubjectCount = subjects.length

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
        <h2 className="text-lg font-semibold text-slate-800">
          Group Master <span className="text-sm font-normal text-slate-400">(Subject Combinations)</span>
        </h2>
        {rw && (
          <div className="flex items-center gap-2 flex-wrap">
            <ImportButton
              label="Import groupmaster.xls"
              path={`masters/${collegeId}/group/import`}
              title="Upload the university's groupmaster file. Needs the member subjects in Course Master first, and a Univ. Faculty No on each program."
              describe={d => `${d.inserted} groups added, ${d.updated} updated (${d.items} subject memberships).`}
              // The file spans every program and semester, so drop the whole
              // group cache — not just the tab currently on screen.
              onDone={() => { invalidateGroups(collegeId); loadGroups(true) }}
            />
            <button onClick={openNew} className="shrink-0 px-3 py-1.5 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700">+ New Group</button>
          </div>
        )}
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

      {loading ? <SkeletonTable rows={4} cols={3} /> : (
        <>
          {/* Desktop table — matches Program Master grid styling. */}
          <div className="hidden sm:block overflow-x-auto border border-slate-300">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wide border-b border-slate-300">
                <tr>
                  <GMTh col="group_code"        label="Group Code"  align="left"   sortCol={sortCol} sortDir={sortDir} onSort={toggleSortGM} />
                  <GMTh col="group_description" label="Description" align="left"   sortCol={sortCol} sortDir={sortDir} onSort={toggleSortGM} />
                  <GMTh col="course_count"      label="Subjects"    align="center" sortCol={sortCol} sortDir={sortDir} onSort={toggleSortGM} />
                  <GMTh col="is_active"         label="Status"      align="center" sortCol={sortCol} sortDir={sortDir} onSort={toggleSortGM} />
                  <th className="px-3 py-1 border-r border-slate-200" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sortedGroups.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No groups defined.</td></tr>}
                {sortedGroups.map(g => (
                  <tr key={g.id} className="hover:bg-blue-50 transition">
                    <td className="px-3 py-1 font-mono font-semibold text-slate-900 border-r border-slate-200">{g.group_code}</td>
                    <td className="px-3 py-1 text-slate-700 border-r border-slate-200">{g.group_description}</td>
                    <td className="px-3 py-1 text-center text-slate-700 border-r border-slate-200">{g.course_count}</td>
                    <td className="px-3 py-1 text-center border-r border-slate-200">
                      <span className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${g.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {g.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-1 text-right space-x-3 whitespace-nowrap">
                      <button onClick={() => openView(g)} className="text-xs font-medium text-slate-500 hover:text-slate-800 underline">View</button>
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
                  <button onClick={() => openView(g)} className="text-xs font-medium text-slate-500 hover:text-slate-800 underline">View</button>
                  {rw && <button onClick={() => openEdit(g)} className="text-xs font-medium text-slate-500 hover:text-slate-800 underline">Edit</button>}
                  {rw && g.is_active && <button onClick={() => softDelete(g)} className="text-xs font-medium text-red-400 hover:text-red-600 underline">Deactivate</button>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Create / edit */}
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
                  <label className="text-xs font-semibold text-slate-600">Group Code</label>
                  {modal === 'new' ? (
                    <p className="text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg px-3 py-2">
                      Generated on save
                    </p>
                  ) : (
                    <p className="font-mono font-semibold text-slate-900 border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm">
                      {modal.group_code}
                    </p>
                  )}
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

              {dropped.length > 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {dropped.length} member{dropped.length !== 1 ? 's' : ''} of this group{' '}
                  ({dropped.map(c => c.course_code).join(', ')}) are not in Course Master, so they cannot be
                  ticked below and <strong>saving will remove them</strong>. Add them to Course Master for
                  this program and semester first if you want to keep them.
                </p>
              )}

              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Subjects
                    <span className="normal-case font-normal text-slate-400 ml-2">
                      {form.course_master_ids.length} selected
                    </span>
                  </p>
                  <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                    className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-300 w-40">
                    <option value="">All Types</option>
                    {COURSE_TYPES.map(t => <option key={t.code} value={t.code} title={t.title}>{t.code} — {t.title}</option>)}
                  </select>
                </div>

                {semSubjectCount === 0 ? (
                  <p className="text-xs text-slate-400">Add subjects to Sem {form.semester} in Course Master before creating a group.</p>
                ) : filteredSubjects.length === 0 ? (
                  <p className="text-xs text-slate-400">No {typeFilter} subjects in Sem {form.semester}.</p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-80 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    {filteredSubjects.map(s => {
                      const selected = form.course_master_ids.includes(s.id)
                      return (
                        <label key={s.id} className={`flex items-start gap-2.5 text-sm px-3 py-2 rounded-lg border cursor-pointer transition ${selected ? 'bg-slate-800 border-slate-800' : 'bg-white border-slate-200 hover:border-slate-400'}`}>
                          <input type="checkbox" className="w-4 h-4 mt-0.5 accent-slate-900 cursor-pointer shrink-0"
                            checked={selected} onChange={() => toggleSubject(s.id)} />
                          <div className="flex flex-col gap-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={selected ? 'text-white font-medium' : 'text-slate-800 font-medium'}>{s.course_title}</span>
                              <Tag selected={selected} mono>{s.course_code}</Tag>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {s.subject_type && <Tag selected={selected}>{s.subject_type}</Tag>}
                              {s.credits != null && <Tag selected={selected}>{s.credits} cr</Tag>}
                              <Tag selected={selected}>Int/SE {s.max_internal ?? '—'}/{s.max_sem_end ?? '—'}</Tag>
                            </div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
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

      {/* Group details — read-only, so a group's contents can be checked
          without entering edit and risking a stray tick. */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="font-semibold text-slate-800">{viewing.group.group_description}</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {viewing.group.group_code} · Sem {viewing.group.semester ?? '—'} · {viewing.courses.length} subjects
                </p>
              </div>
              <button onClick={() => setViewing(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="overflow-y-auto px-6 py-5">
              {viewing.courses.length === 0 ? (
                <p className="text-center text-slate-500 py-8 text-sm">No subjects in this group.</p>
              ) : (
                <div className="overflow-x-auto border border-slate-300">
                  <table className="w-full text-sm border-collapse">
                    <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wide border-b border-slate-300">
                      <tr>
                        <th className="px-3 py-1 text-center w-10 border-r border-slate-200">#</th>
                        <th className="px-3 py-1 text-left w-32 border-r border-slate-200">Code</th>
                        <th className="px-3 py-1 text-left border-r border-slate-200">Title</th>
                        <th className="px-3 py-1 text-center w-20 border-r border-slate-200">Type</th>
                        <th className="px-3 py-1 text-center w-16 border-r border-slate-200">Credits</th>
                        <th className="px-3 py-1 text-center w-24">Int/SE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {viewing.courses.map(c => (
                        <tr key={c.id} className={c.course_master_id == null ? 'bg-amber-50/60' : ''}>
                          <td className="px-3 py-1 text-center text-slate-400 border-r border-slate-200">{c.course_position}</td>
                          <td className="px-3 py-1 font-mono text-slate-900 border-r border-slate-200">
                            {c.course_code}
                            {c.course_master_id == null && (
                              <span className="ml-1 text-amber-600" title="Not linked to Course Master">*</span>
                            )}
                          </td>
                          <td className="px-3 py-1 text-slate-700 border-r border-slate-200">{c.course_title || '—'}</td>
                          <td className="px-3 py-1 text-center text-slate-500 border-r border-slate-200">{c.subject_type || '—'}</td>
                          <td className="px-3 py-1 text-center text-slate-500 border-r border-slate-200">{c.credits ?? '—'}</td>
                          <td className="px-3 py-1 text-center text-slate-500">{c.max_internal ?? '—'}/{c.max_sem_end ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {viewing.courses.some(c => c.course_master_id == null) && (
                <p className="text-xs text-amber-700 mt-3">* Not linked to a Course Master subject — shown from the stored code and title.</p>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
              <button onClick={() => setViewing(null)} className="px-4 py-2 text-sm text-slate-600">Close</button>
              {rw && (
                <button
                  onClick={() => { const g = viewing.group; setViewing(null); openEdit(g) }}
                  className="px-5 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700"
                >
                  Edit
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Course Master rows are soft-deleted; a deactivated subject is not offerable. */
function activeSubjects(r) {
  return (r.data.data || []).filter(s => s.is_active !== false)
}

const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300'

function Tag({ children, selected, mono }) {
  return (
    <span className={`text-[11px] px-1.5 py-0.5 rounded border ${mono ? 'font-mono' : ''} ${
      selected ? 'border-white/30 text-white/80' : 'border-slate-200 text-slate-500'
    }`}>
      {children}
    </span>
  )
}

function GMTh({ col, label, align = 'left', sortCol, sortDir, onSort }) {
  const active = sortCol === col
  return (
    <th
      className={`px-3 py-1 text-${align} cursor-pointer select-none text-xs font-bold uppercase tracking-wide text-slate-600 hover:text-slate-900 transition border-r border-slate-200`}
      onClick={() => onSort(col)}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'ml-auto' : ''}`}>
        {label}
        <span className="text-slate-300">{active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
      </span>
    </th>
  )
}
