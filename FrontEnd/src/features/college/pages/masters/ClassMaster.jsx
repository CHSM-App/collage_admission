import { useEffect, useState, useCallback, useMemo } from 'react'
import { getFaculty, getClasses, createClass, updateClass, deleteClass, masterCacheRead, masterCacheHas } from '../../../../services/masterService.js'
import { usePermissions } from '../../hooks/usePermissions.js'
import { SkeletonTable } from '../../../../shared/components/Skeleton.jsx'
import { useToast } from '../../../../context/ToastContext.jsx'

const YEAR_LABELS = [
  { value: 1, short: 'FY', label: 'FY — First Year'   },
  { value: 2, short: 'SY', label: 'SY — Second Year'  },
  { value: 3, short: 'TY', label: 'TY — Third Year'   },
  { value: 4, short: '4Y', label: '4Y — Fourth Year'  },
  { value: 5, short: '5Y', label: '5Y — Fifth Year'   },
]

function yearShort(y) { return YEAR_LABELS.find(l => l.value === y)?.short || `Y${y}` }
function yearOptions(durationYears) {
  const n = parseInt(durationYears) || 3
  return YEAR_LABELS.slice(0, Math.min(n, 5))
}

const EMPTY_FORM = { faculty_master_id: '', year_of_study: 1, label: '', is_active: true }

function durationFor(programs, facultyId) {
  return programs.find(p => String(p.code_no) === String(facultyId))?.duration_years || 3
}

export default function ClassMaster({ collegeId }) {
  const { canWrite } = usePermissions()
  const rw = canWrite('masters')
  const toast = useToast()

  const [programs, setPrograms] = useState(() => (masterCacheRead(`faculty:${collegeId}`)?.data?.data ?? []).filter(f => f.is_active))
  const [rows, setRows]         = useState(() => masterCacheRead(`class:${collegeId}`)?.data?.data ?? [])
  const [loading, setLoading]   = useState(() => !masterCacheRead(`class:${collegeId}`))
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

  const [sortCol, setSortCol] = useState('degree_course_code')
  const [sortDir, setSortDir] = useState('asc')
  function toggleSortCM(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const [search, setSearch]           = useState('')
  const [filterProgram, setFilterProgram] = useState('')
  const [filterYear, setFilterYear]   = useState('')

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase()
    return [...rows]
      .filter(r => {
        if (filterProgram && String(r.faculty_master_id) !== String(filterProgram)) return false
        if (filterYear   && String(r.year_of_study)     !== String(filterYear))     return false
        if (q) {
          const hay = [r.degree_course_code, r.degree_course_name, r.label, yearShort(r.year_of_study)]
            .join(' ').toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => {
        let av = a[sortCol], bv = b[sortCol]
        if (sortCol === 'year_of_study') { av = Number(av); bv = Number(bv) }
        if (av == null) av = ''; if (bv == null) bv = ''
        const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
        return sortDir === 'asc' ? cmp : -cmp
      })
  }, [rows, search, filterProgram, filterYear, sortCol, sortDir])

  const hasFilters = search || filterProgram || filterYear

  useEffect(() => {
    getFaculty(collegeId, r => {
      const active = (r.data.data || []).filter(f => f.is_active)
      setPrograms(active)
    }).then(r => {
      const active = (r.data.data || []).filter(f => f.is_active)
      setPrograms(active)
      if (active.length) setForm(f => ({ ...f, faculty_master_id: active[0].code_no }))
    }).catch(() => setError('Failed to load programs.'))
  }, [collegeId])

  const load = useCallback((silent = false) => {
    const wasMiss = !masterCacheHas(`class:${collegeId}`)
    if (!silent && wasMiss) setLoading(true)
    getClasses(collegeId, r => setRows(r.data.data || []))
      .then(r => setRows(r.data.data || []))
      .catch(() => setError('Failed to load classes.'))
      .finally(() => { if (!silent && wasMiss) setLoading(false) })
  }, [collegeId])

  useEffect(() => { load() }, [load])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.faculty_master_id) return setFormError('Select a program.')
    setSaving(true); setFormError('')
    try {
      await createClass(collegeId, {
        faculty_master_id: form.faculty_master_id,
        year_of_study:     form.year_of_study,
        label:             form.label || null,
        is_active:         form.is_active,
      })
      setShowForm(false)
      setForm({ ...EMPTY_FORM, faculty_master_id: programs[0]?.code_no || '' })
      load(true)
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
      await updateClass(collegeId, row.id, {
        label:     editLabel || null,
        is_active: editActive,
      })
      setEditId(null)
      load(true)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Save failed.')
    } finally { setEditSaving(false) }
  }

  async function handleDelete(row) {
    if (!confirm(`Delete class "${row.degree_course_code} — ${yearShort(row.year_of_study)}"? This cannot be undone.`)) return
    try {
      await deleteClass(collegeId, row.id)
      load(true)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Delete failed.')
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 flex-wrap mb-4">
        <div className="relative flex-1 min-w-40">
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search program, year, label…"
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">✕</button>
          )}
        </div>
        <select
          value={filterProgram}
          onChange={e => setFilterProgram(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-56"
        >
          <option value="">All Programs</option>
          {programs.map(p => (
            <option key={p.code_no} value={p.code_no}>{p.degree_course_code} — {p.degree_course_name}</option>
          ))}
        </select>
        <select
          value={filterYear}
          onChange={e => setFilterYear(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-36"
        >
          <option value="">All Years</option>
          {YEAR_LABELS.map(y => (
            <option key={y.value} value={y.value}>{y.short}</option>
          ))}
        </select>
        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setFilterProgram(''); setFilterYear('') }}
            className="text-sm text-slate-400 hover:text-slate-700 font-medium whitespace-nowrap self-center"
          >
            Clear filters
          </button>
        )}
      </div>
      {!loading && (
        <p className="text-xs text-slate-400 mb-3">
          {hasFilters
            ? `${sorted.length} result${sorted.length !== 1 ? 's' : ''}`
            : `${rows.length} class${rows.length !== 1 ? 'es' : ''} total`}
        </p>
      )}

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
                {yearOptions(durationFor(programs, form.faculty_master_id)).map(y => (
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
        <SkeletonTable rows={4} cols={4} />
      ) : (
        <>
          {/* Desktop table — styled to match the Program Master grid:
              border-2/slate-400 outer, slate-100 header, bold uppercase tracked
              titles, blue-50 row hover, slate-300 row dividers. */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border-2 border-slate-400">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-100 text-xs font-bold text-slate-600 uppercase tracking-wide border-b-2 border-slate-400">
                <tr>
                  <MSTh col="degree_course_code" label="Program" align="left"   sortCol={sortCol} sortDir={sortDir} onSort={toggleSortCM} />
                  <MSTh col="year_of_study"      label="Year"    align="center" sortCol={sortCol} sortDir={sortDir} onSort={toggleSortCM} />
                  <MSTh col="label"              label="Label"   align="left"   sortCol={sortCol} sortDir={sortDir} onSort={toggleSortCM} />
                  <MSTh col="is_active"          label="Status"  align="center" sortCol={sortCol} sortDir={sortDir} onSort={toggleSortCM} />
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-300">
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      {hasFilters ? 'No classes match your filters.' : 'No classes configured yet.'}
                    </td>
                  </tr>
                )}
                {sorted.map(row => (
                  <tr key={row.id} className="hover:bg-blue-50 transition">
                    <td className="px-4 py-2.5 text-slate-700">
                      <span className="font-mono font-semibold text-slate-900">{row.degree_course_code}</span>
                      <span className="text-slate-400 ml-1 text-xs">— {row.degree_course_name}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center font-semibold text-slate-700">
                      {yearShort(row.year_of_study)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {editId === row.id ? (
                        <input
                          value={editLabel}
                          onChange={e => setEditLabel(e.target.value)}
                          className={inp}
                          placeholder="Optional label"
                        />
                      ) : (
                        row.label || <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
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
                        <span className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${row.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {row.is_active ? 'Active' : 'Inactive'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right space-x-3 whitespace-nowrap">
                      {rw && editId === row.id ? (
                        <>
                          <button
                            onClick={() => saveEdit(row)}
                            disabled={editSaving}
                            className="text-xs font-medium text-slate-700 hover:text-slate-900 underline disabled:opacity-50"
                          >
                            {editSaving ? 'Saving…' : 'Save'}
                          </button>
                          <button onClick={cancelEdit} className="text-xs font-medium text-slate-400 hover:text-slate-600 underline">
                            Cancel
                          </button>
                        </>
                      ) : rw ? (
                        <>
                          <button onClick={() => startEdit(row)} className="text-xs font-medium text-slate-500 hover:text-slate-800 underline">Edit</button>
                          <button onClick={() => handleDelete(row)} className="text-xs font-medium text-red-400 hover:text-red-600 underline">Delete</button>
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
              <p className="text-center text-slate-400 py-8 text-sm">{hasFilters ? 'No classes match your filters.' : 'No classes configured yet.'}</p>
            )}
            {rows.map(row => (
              <div key={row.id} className="border-2 border-slate-400 rounded-lg p-4 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono font-semibold text-slate-900">{row.degree_course_code} — {yearShort(row.year_of_study)}</p>
                    <p className="text-sm text-slate-700 mt-0.5">{row.degree_course_name}</p>
                    {row.label && <p className="text-xs text-slate-400 mt-1">{row.label}</p>}
                  </div>
                  <span className={`shrink-0 inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${row.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {row.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {rw && (
                  <div className="flex gap-3 mt-3">
                    <button onClick={() => startEdit(row)} className="text-xs font-medium text-slate-500 hover:text-slate-800 underline">Edit</button>
                    <button onClick={() => handleDelete(row)} className="text-xs font-medium text-red-400 hover:text-red-600 underline">Delete</button>
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

function MSTh({ col, label, align = 'left', sortCol, sortDir, onSort }) {
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
