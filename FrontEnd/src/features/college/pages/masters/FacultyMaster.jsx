import { useEffect, useState } from 'react'
import { getFaculty, createFaculty, updateFaculty, deleteFaculty, masterCacheRead, masterCacheHas } from '../../../../services/masterService.js'
import { usePermissions } from '../../hooks/usePermissions.js'
import { SkeletonTable } from '../../../../shared/components/Skeleton.jsx'
import { useToast } from '../../../../context/ToastContext.jsx'
import { getErrorMessage } from '../../../../shared/hooks/useNetworkError.js'

// Duration-driven slot count: sem codes = duration*2, year codes = duration.
// Matrix: 2yr→4/2, 3yr→6/3, 4yr→8/4, 5yr→10/5.
const DURATIONS = [2, 3, 4, 5]
const semSlotsFor  = (yrs) => Math.max(0, Math.min(10, parseInt(yrs) * 2 || 0))
const yearSlotsFor = (yrs) => Math.max(0, Math.min(5,  parseInt(yrs)     || 0))

const EMPTY = {
  degree_course_code: '', degree_course_name: '', duration_years: 3,
  unique_code_sem1: '',  unique_code_sem2: '',  unique_code_sem3: '',
  unique_code_sem4: '',  unique_code_sem5: '',  unique_code_sem6: '',
  unique_code_sem7: '',  unique_code_sem8: '',  unique_code_sem9: '',
  unique_code_sem10: '',
  exam_seat_code_year1: '', exam_seat_code_year2: '', exam_seat_code_year3: '',
  exam_seat_code_year4: '', exam_seat_code_year5: '',
  is_active: true,
}

const YEAR_LABELS = ['FY', 'SY', 'TY', 'Year 4', 'Year 5']

export default function FacultyMaster({ collegeId }) {
  const { canWrite } = usePermissions()
  const rw = canWrite('masters')
  const toast = useToast()
  const [rows, setRows]       = useState(() => masterCacheRead(`faculty:${collegeId}`)?.data?.data ?? [])
  const [loading, setLoading] = useState(() => !masterCacheRead(`faculty:${collegeId}`))
  const [search, setSearch]   = useState('')
  const [modal, setModal]     = useState(null)   // null | 'new' | row object
  const [form, setForm]       = useState(EMPTY)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [sortCol, setSortCol] = useState('degree_course_code')
  const [sortDir, setSortDir] = useState('asc')

  function load(silent = false) {
    const wasMiss = !masterCacheHas(`faculty:${collegeId}`)
    if (!silent && wasMiss) setLoading(true)
    getFaculty(collegeId, r => setRows(r.data.data || []))
      .then(r => setRows(r.data.data || []))
      .catch(() => setError('Failed to load.'))
      .finally(() => { if (!silent && wasMiss) setLoading(false) })
  }
  useEffect(() => { load() }, [collegeId])

  function openNew()  { setForm(EMPTY); setModal('new'); setError('') }
  function openEdit(r){ setForm({ ...r }); setModal(r); setError('') }
  function closeModal(){ setModal(null) }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  // Auto-configure: when duration changes, clear sem/year slots that fall
  // outside the new range so stale values from a longer program don't persist.
  function setDuration(yrs) {
    const semSlots  = semSlotsFor(yrs)
    const yearSlots = yearSlotsFor(yrs)
    setForm(f => {
      const next = { ...f, duration_years: yrs }
      for (let i = semSlots + 1;  i <= 10; i++) next[`unique_code_sem${i}`]    = ''
      for (let i = yearSlots + 1; i <= 5;  i++) next[`exam_seat_code_year${i}`] = ''
      return next
    })
  }

  async function save() {
    if (!form.degree_course_code.trim()) return setError('Degree Course Code is required.')
    if (!form.degree_course_name.trim()) return setError('Degree Course Name is required.')
    const yrs       = parseInt(form.duration_years) || 3
    const semSlots  = semSlotsFor(yrs)
    const yearSlots = yearSlotsFor(yrs)
    for (let i = 1; i <= semSlots; i++) {
      if (!form[`unique_code_sem${i}`]?.trim()) return setError(`Semester ${i} code is required for a ${yrs}-year program.`)
    }
    for (let i = 1; i <= yearSlots; i++) {
      if (!form[`exam_seat_code_year${i}`]?.trim()) return setError(`Year ${i} exam seat code is required for a ${yrs}-year program.`)
    }
    setSaving(true); setError('')
    try {
      if (modal === 'new') {
        await createFaculty(collegeId, form)
      } else {
        await updateFaculty(collegeId, modal.code_no, form)
      }
      closeModal(); load(true)
    } catch (e) {
      setError(getErrorMessage(e, 'Could not save the degree course. Please review your input and try again.'))
    } finally { setSaving(false) }
  }

  async function softDelete(row) {
    if (!confirm(`Deactivate "${row.degree_course_name}"?`)) return
    try {
      await deleteFaculty(collegeId, row.code_no)
      load(true)
    } catch { toast.error('Delete failed.') }
  }

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const filtered = rows
    .filter(r =>
      r.degree_course_code.toLowerCase().includes(search.toLowerCase()) ||
      r.degree_course_name.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol]
      if (sortCol === 'is_active') { av = av ? 1 : 0; bv = bv ? 1 : 0 }
      if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av
      return sortDir === 'asc'
        ? String(av ?? '').localeCompare(String(bv ?? ''))
        : String(bv ?? '').localeCompare(String(av ?? ''))
    })

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="text-lg font-semibold text-slate-800">Program Master <span className="text-sm font-normal text-slate-400">(Degree Courses)</span></h2>
        {rw && <button onClick={openNew} className="shrink-0 px-3 py-1.5 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700">+ New</button>}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search by code or name…"
        className="mb-3 w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />

      {loading ? <SkeletonTable rows={5} cols={4} /> : (
        <>
          {/* Desktop table — styled to match the Application Inbox grid:
              border-2/slate-400 outer, slate-100 header, bold uppercase tracked
              titles, blue-50 row hover, slate-300 row dividers. */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border-2 border-slate-400">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-100 text-xs font-bold text-slate-600 uppercase tracking-wide border-b-2 border-slate-400">
                <tr>
                  <Th col="degree_course_code" label="Code"      align="left"   sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <Th col="degree_course_name" label="Name"      align="left"   sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <Th col="duration_years"     label="Years"     align="center" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <th className="px-4 py-2.5 text-left">Exam Seat Codes</th>
                  <Th col="is_active"          label="Status"    align="center" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-300">
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No records found.</td></tr>
                )}
                {filtered.map(r => (
                  <tr key={r.code_no} className="hover:bg-blue-50 transition">
                    <td className="px-4 py-2.5 font-mono font-semibold text-slate-900">{r.degree_course_code}</td>
                    <td className="px-4 py-2.5 text-slate-700">{r.degree_course_name}</td>
                    <td className="px-4 py-2.5 text-center text-slate-700">{r.duration_years}</td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">
                      {[r.exam_seat_code_year1, r.exam_seat_code_year2, r.exam_seat_code_year3, r.exam_seat_code_year4, r.exam_seat_code_year5].filter(Boolean).join(' / ') || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {r.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right space-x-3 whitespace-nowrap">
                      {rw && <button onClick={() => openEdit(r)} className="text-xs font-medium text-slate-500 hover:text-slate-800 underline">Edit</button>}
                      {rw && r.is_active && <button onClick={() => softDelete(r)} className="text-xs font-medium text-red-400 hover:text-red-600 underline">Deactivate</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="sm:hidden space-y-2">
            {filtered.length === 0 && <p className="text-center text-slate-400 py-8 text-sm">No records found.</p>}
            {filtered.map(r => (
              <div key={r.code_no} className="border-2 border-slate-400 rounded-lg p-4 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono font-semibold text-slate-700">{r.degree_course_code}</p>
                    <p className="text-sm text-slate-800 mt-0.5">{r.degree_course_name}</p>
                    <p className="text-xs text-slate-400 mt-1">{r.duration_years} years · Exam codes: {[r.exam_seat_code_year1, r.exam_seat_code_year2, r.exam_seat_code_year3, r.exam_seat_code_year4, r.exam_seat_code_year5].filter(Boolean).join(' / ') || '—'}</p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                    {r.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex gap-3 mt-3">
                  {rw && <button onClick={() => openEdit(r)} className="text-xs text-slate-500 hover:text-slate-800 underline">Edit</button>}
                  {rw && r.is_active && <button onClick={() => softDelete(r)} className="text-xs text-red-400 hover:text-red-600 underline">Deactivate</button>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">{modal === 'new' ? 'New Degree Course' : 'Edit Degree Course'}</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Degree Course Code *" hint="e.g. BSC(MICRO), BA, BCOM">
                  <input value={form.degree_course_code} onChange={e => set('degree_course_code', e.target.value.toUpperCase())}
                    className={inp} placeholder="BCOM" />
                </Field>
                <Field label="Duration (Years)">
                  <select value={form.duration_years} onChange={e => setDuration(parseInt(e.target.value))} className={inp}>
                    {DURATIONS.map(y => <option key={y} value={y}>{y} Years</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Degree Course Name *">
                <input value={form.degree_course_name} onChange={e => set('degree_course_name', e.target.value)}
                  className={inp} placeholder="Bachelor of Commerce" />
              </Field>

              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-1">
                University Semester Codes
                <span className="ml-2 normal-case font-normal text-slate-400">
                  ({semSlotsFor(form.duration_years)} required for a {form.duration_years}-year program)
                </span>
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Array.from({ length: semSlotsFor(form.duration_years) }, (_, idx) => idx + 1).map(s => (
                  <Field key={s} label={`Sem ${s} *`}>
                    <input value={form[`unique_code_sem${s}`]} onChange={e => set(`unique_code_sem${s}`, e.target.value)}
                      className={inp} placeholder={`SEM${s}CODE`} />
                  </Field>
                ))}
              </div>

              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-1">
                Exam Seat Code (Year-Level Prefix)
                <span className="ml-2 normal-case font-normal text-slate-400">
                  ({yearSlotsFor(form.duration_years)} required for a {form.duration_years}-year program)
                </span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {Array.from({ length: yearSlotsFor(form.duration_years) }, (_, idx) => idx + 1).map(yr => (
                  <Field key={yr} label={`Year ${yr} Code *`} hint="Letters only">
                    <input value={form[`exam_seat_code_year${yr}`]}
                      onChange={e => set(`exam_seat_code_year${yr}`, e.target.value.replace(/[^A-Za-z]/g,'').toUpperCase())}
                      className={inp} placeholder={YEAR_LABELS[yr - 1]} />
                  </Field>
                ))}
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={!!form.is_active} onChange={e => set('is_active', e.target.checked)} className="accent-slate-700" />
                Active
              </label>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={closeModal} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
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

function Th({ col, label, align, sortCol, sortDir, onSort }) {
  const active = sortCol === col
  return (
    <th
      className={`px-4 py-2.5 text-${align} cursor-pointer select-none text-xs font-bold uppercase tracking-wide text-slate-600 hover:text-slate-900 transition`}
      onClick={() => onSort(col)}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'ml-auto' : ''}`}>
        {label}
        <span className="text-slate-300">
          {active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </span>
    </th>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  )
}
const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300'
