import { useEffect, useMemo, useState } from 'react'
import { getExamRegistration, saveExamRegistration } from '../../../services/examService.js'
import { getFaculty } from '../../../services/masterService.js'
import Button from '../../../shared/components/Button.jsx'
import { usePermissions } from '../hooks/usePermissions.js'
import { SkeletonTable } from '../../../shared/components/Skeleton.jsx'
import { useToast } from '../../../context/ToastContext.jsx'
import { getErrorMessage } from '../../../shared/hooks/useNetworkError.js'

// A cell cycles through these. NONE means "not registered for this subject".
const NONE = ''
const CYCLE = ['RR', 'OE', 'Repeater', NONE]

const CELL_STYLE = {
  RR:         'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
  OE:         'bg-blue-50    text-blue-700    border-blue-200    hover:bg-blue-100',
  Repeater:   'bg-amber-50   text-amber-800   border-amber-200   hover:bg-amber-100',
  [NONE]:     'bg-white      text-slate-300   border-slate-200   hover:bg-slate-50',
}
const CELL_LABEL = { RR: 'RR', OE: 'OE', Repeater: 'REP', [NONE]: '–' }

function academicYearOptions() {
  const now  = new Date()
  const base = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1
  return Array.from({ length: 10 }, (_, i) => {
    const y = base - 5 + i
    return `${y}-${String(y + 1).slice(-2)}`
  })
}
const AY_OPTIONS = academicYearOptions()
const CURRENT_AY = (() => {
  const now = new Date()
  const b = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1
  return `${b}-${String(b + 1).slice(-2)}`
})()

// A degree of N years has 2N semesters.
function semestersFor(durationYears) {
  const n = Math.max(1, Math.min(5, parseInt(durationYears) || 3))
  return Array.from({ length: n * 2 }, (_, i) => i + 1)
}

const key = (appId, subId) => `${appId}:${subId}`

export default function ExamRegistration({ collegeId, readOnly = false }) {
  const { canWrite } = usePermissions()
  const rw = !readOnly && canWrite('exams')
  const toast = useToast()

  const [faculty, setFaculty] = useState([])
  const [selFac, setSelFac]   = useState('')
  const [selSem, setSelSem]   = useState('')
  const [selAY,  setSelAY]    = useState(CURRENT_AY)

  const [subjects, setSubjects] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading]   = useState(false)
  const [loaded, setLoaded]     = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [filter, setFilter]     = useState('')

  // The whole grid as a flat map: "appId:subjectId" -> 'RR' | 'OE' | 'Repeater' | ''
  const [grid, setGrid]   = useState({})
  const [saved, setSaved] = useState({})   // last-saved snapshot, for the dirty check

  useEffect(() => {
    getFaculty(collegeId)
      .then(r => setFaculty((r.data.data || []).filter(f => f.is_active)))
      .catch(() => setError('Failed to load programs.'))
  }, [collegeId])

  const selFacRow  = faculty.find(f => String(f.code_no) === String(selFac))
  const semOptions = semestersFor(selFacRow?.duration_years)

  useEffect(() => {
    if (selFacRow && selSem && !semOptions.includes(parseInt(selSem))) setSelSem('')
  }, [selFacRow, semOptions, selSem])

  async function load() {
    if (!selFac || !selSem || !selAY) return
    setLoading(true); setError(''); setLoaded(false)
    try {
      const r = await getExamRegistration(collegeId, selFac, selSem, selAY)
      const subs  = r.data?.data?.subjects || []
      const studs = r.data?.data?.students || []
      setSubjects(subs)
      setStudents(studs)

      // Build the grid. A student with no saved registrations is a NEW student on
      // this page, so default them to RR for every subject of the semester — the
      // college then removes what doesn't apply. A student who already has saved
      // registrations keeps exactly what was saved (blank where they were removed).
      const g = {}, s = {}
      for (const st of studs) {
        const has = st.subjects.length > 0
        const bySub = new Map(st.subjects.map(x => [x.course_master_id, x.exam_type]))
        for (const sub of subs) {
          const savedVal = bySub.get(sub.id) ?? NONE
          s[key(st.application_id, sub.id)] = savedVal
          g[key(st.application_id, sub.id)] = has ? savedVal : 'RR'
        }
      }
      setGrid(g)
      setSaved(s)
      setLoaded(true)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load exam registration.'))
    } finally {
      setLoading(false)
    }
  }

  function cycle(appId, subId) {
    if (!rw) return
    setGrid(g => {
      const cur  = g[key(appId, subId)] ?? NONE
      const next = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length]
      return { ...g, [key(appId, subId)]: next }
    })
  }

  // Shortcuts — set a whole row, a whole column, or the whole grid.
  function setRow(appId, val) {
    if (!rw) return
    setGrid(g => {
      const next = { ...g }
      for (const s of subjects) next[key(appId, s.id)] = val
      return next
    })
  }
  function setCol(subId, val) {
    if (!rw) return
    setGrid(g => {
      const next = { ...g }
      for (const st of visible) next[key(st.application_id, subId)] = val
      return next
    })
  }
  function setAll(val) {
    if (!rw) return
    setGrid(g => {
      const next = { ...g }
      for (const st of visible) for (const s of subjects) next[key(st.application_id, s.id)] = val
      return next
    })
  }

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return students
    return students.filter(s =>
      s.full_name?.toLowerCase().includes(q) ||
      s.registration_number?.toLowerCase().includes(q) ||
      s.roll_number?.toLowerCase().includes(q)
    )
  }, [students, filter])

  const dirtyCount = useMemo(() => {
    let n = 0
    for (const k of Object.keys(grid)) if ((grid[k] ?? NONE) !== (saved[k] ?? NONE)) n++
    return n
  }, [grid, saved])

  const registeredCount = useMemo(
    () => Object.values(grid).filter(v => v && v !== NONE).length,
    [grid],
  )

  async function saveAll() {
    setSaving(true)
    try {
      const payload = {
        faculty_master_id: selFac,
        semester:          parseInt(selSem),
        academic_year:     selAY,
        students: students.map(st => ({
          application_id: st.application_id,
          subjects: subjects
            .map(s => ({ course_master_id: s.id, exam_type: grid[key(st.application_id, s.id)] }))
            .filter(x => x.exam_type && x.exam_type !== NONE),
        })),
      }
      const r = await saveExamRegistration(collegeId, payload)
      setSaved({ ...grid })              // the grid is now the saved state
      toast.success(r.data?.message || 'Exam registration saved.')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">College portal</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Exam Registration</h1>
        <p className="mt-1 text-slate-600">
          Click a cell to cycle <span className="font-semibold">RR → OE → Repeater → not registered</span>.
          New students start registered RR for every subject.
        </p>
      </div>

      {/* Selector */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-56">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Faculty / Program</label>
            <select value={selFac} onChange={e => { setSelFac(e.target.value); setLoaded(false) }}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm">
              <option value="">Select program…</option>
              {faculty.map(f => (
                <option key={f.code_no} value={f.code_no}>
                  {f.degree_course_code} — {f.degree_course_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Semester</label>
            <select value={selSem} onChange={e => { setSelSem(e.target.value); setLoaded(false) }}
              disabled={!selFac}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50">
              <option value="">Sem…</option>
              {semOptions.map(s => <option key={s} value={s}>Sem {s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Academic Year</label>
            <select value={selAY} onChange={e => { setSelAY(e.target.value); setLoaded(false) }}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm">
              {AY_OPTIONS.map(ay => <option key={ay} value={ay}>{ay}</option>)}
            </select>
          </div>
          <Button onClick={load} loading={loading} disabled={!selFac || !selSem || !selAY}>
            Load Students
          </Button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      {loading && <SkeletonTable rows={6} cols={6} />}

      {loaded && !loading && subjects.length === 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No subjects are set up for Sem {selSem} of this program. Add them in{' '}
          <span className="font-semibold">Masters → Course Master</span> first.
        </p>
      )}

      {loaded && !loading && students.length === 0 && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          No students have confirmed admission for Sem {selSem} · {selAY} in this program.
        </p>
      )}

      {/* Grid */}
      {loaded && !loading && students.length > 0 && subjects.length > 0 && (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <input
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="Find student…"
                className="w-56 rounded-md border border-slate-200 px-3 py-1.5 text-sm"
              />
              <span className="text-sm text-slate-500">
                {visible.length} of {students.length} student{students.length === 1 ? '' : 's'}
                {' · '}{subjects.length} subject{subjects.length === 1 ? '' : 's'}
                {' · '}{registeredCount} registration{registeredCount === 1 ? '' : 's'}
              </span>
              {rw && (
                <span className="flex items-center gap-2 text-sm">
                  <button onClick={() => setAll('RR')}
                    className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                    All RR
                  </button>
                  <button onClick={() => setAll(NONE)}
                    className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                    Clear all
                  </button>
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {dirtyCount > 0 && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                  {dirtyCount} unsaved change{dirtyCount === 1 ? '' : 's'}
                </span>
              )}
              {rw && (
                <Button onClick={saveAll} loading={saving} disabled={dirtyCount === 0}>
                  Save All
                </Button>
              )}
            </div>
          </div>

          {/* Matrix — sticky header row and sticky student column */}
          <div className="overflow-auto rounded-lg border border-slate-200 bg-white" style={{ maxHeight: '65vh' }}>
            <table className="border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-30 min-w-64 border-b border-r border-slate-200 bg-slate-50 px-4 py-2 text-left text-xs font-semibold text-slate-600">
                    Student
                  </th>
                  {subjects.map(s => (
                    <th key={s.id}
                      className="sticky top-0 z-20 border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-center align-bottom">
                      <div className="font-mono text-xs font-bold text-slate-950" title={s.course_title}>
                        {s.course_code}
                      </div>
                      <div className="mx-auto max-w-24 truncate text-[10px] font-normal text-slate-400"
                        title={s.course_title}>
                        {s.course_title}
                      </div>
                      {rw && (
                        <div className="mt-1 flex justify-center gap-1">
                          <button onClick={() => setCol(s.id, 'RR')}
                            title="Set every visible student to RR for this subject"
                            className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100">
                            RR
                          </button>
                          <button onClick={() => setCol(s.id, NONE)}
                            title="Unregister every visible student from this subject"
                            className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-100">
                            –
                          </button>
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((st, i) => {
                  const rowDirty = subjects.some(s =>
                    (grid[key(st.application_id, s.id)] ?? NONE) !== (saved[key(st.application_id, s.id)] ?? NONE)
                  )
                  return (
                    <tr key={st.application_id} className={i % 2 ? 'bg-slate-50/40' : 'bg-white'}>
                      <td className={`sticky left-0 z-10 border-b border-r border-slate-200 px-4 py-1.5 ${
                        i % 2 ? 'bg-slate-50' : 'bg-white'
                      }`}>
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-medium text-slate-950">{st.full_name}</span>
                              {rowDirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" title="Unsaved" />}
                            </div>
                            {st.registration_number && (
                              <div className="font-mono text-[10px] text-slate-400">{st.registration_number}</div>
                            )}
                          </div>
                          {rw && (
                            <div className="flex shrink-0 gap-1">
                              <button onClick={() => setRow(st.application_id, 'RR')}
                                title="Set all subjects to RR for this student"
                                className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100">
                                RR
                              </button>
                              <button onClick={() => setRow(st.application_id, NONE)}
                                title="Unregister this student from all subjects"
                                className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-100">
                                –
                              </button>
                            </div>
                          )}
                        </div>
                      </td>

                      {subjects.map(s => {
                        const val = grid[key(st.application_id, s.id)] ?? NONE
                        return (
                          <td key={s.id} className="border-b border-r border-slate-200 px-1 py-1 text-center">
                            <button
                              type="button"
                              onClick={() => cycle(st.application_id, s.id)}
                              disabled={!rw}
                              title={`${st.full_name} · ${s.course_code}${rw ? ' — click to change' : ''}`}
                              className={`w-14 rounded border px-1 py-1 text-[11px] font-bold transition ${CELL_STYLE[val]} ${
                                rw ? 'cursor-pointer' : 'cursor-default'
                              }`}
                            >
                              {CELL_LABEL[val]}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className={`inline-block w-10 rounded border px-1 py-0.5 text-center font-bold ${CELL_STYLE.RR}`}>RR</span>
              Regular
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`inline-block w-10 rounded border px-1 py-0.5 text-center font-bold ${CELL_STYLE.OE}`}>OE</span>
              Open elective
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`inline-block w-10 rounded border px-1 py-0.5 text-center font-bold ${CELL_STYLE.Repeater}`}>REP</span>
              Repeater
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`inline-block w-10 rounded border px-1 py-0.5 text-center font-bold ${CELL_STYLE[NONE]}`}>–</span>
              Not registered
            </span>
          </div>
        </>
      )}
    </section>
  )
}
