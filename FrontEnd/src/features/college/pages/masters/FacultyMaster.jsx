import { useEffect, useState } from 'react'
import api from '../../../../services/api.js'

const EMPTY = {
  degree_course_code: '', degree_course_name: '', duration_years: 3,
  unique_code_sem1: '', unique_code_sem2: '', unique_code_sem3: '',
  unique_code_sem4: '', unique_code_sem5: '', unique_code_sem6: '',
  exam_seat_code_year1: '', exam_seat_code_year2: '', exam_seat_code_year3: '',
  is_active: true,
}

export default function FacultyMaster({ collegeId }) {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [modal, setModal]     = useState(null)   // null | 'new' | row object
  const [form, setForm]       = useState(EMPTY)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  function load() {
    setLoading(true)
    api.get(`masters/${collegeId}/faculty`)
      .then(r => setRows(r.data.data || []))
      .catch(() => setError('Failed to load.'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [collegeId])

  function openNew()  { setForm(EMPTY); setModal('new'); setError('') }
  function openEdit(r){ setForm({ ...r }); setModal(r); setError('') }
  function closeModal(){ setModal(null) }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function save() {
    if (!form.degree_course_code.trim()) return setError('Degree Course Code is required.')
    if (!form.degree_course_name.trim()) return setError('Degree Course Name is required.')
    setSaving(true); setError('')
    try {
      if (modal === 'new') {
        await api.post(`masters/${collegeId}/faculty`, form)
      } else {
        await api.put(`masters/${collegeId}/faculty/${modal.code_no}`, form)
      }
      closeModal(); load()
    } catch (e) {
      setError(e?.response?.data?.message || 'Save failed.')
    } finally { setSaving(false) }
  }

  async function softDelete(row) {
    if (!confirm(`Deactivate "${row.degree_course_name}"?`)) return
    try {
      await api.delete(`masters/${collegeId}/faculty/${row.code_no}`)
      load()
    } catch { alert('Delete failed.') }
  }

  const filtered = rows.filter(r =>
    r.degree_course_code.toLowerCase().includes(search.toLowerCase()) ||
    r.degree_course_name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="text-lg font-semibold text-slate-800">Faculty Master <span className="text-sm font-normal text-slate-400">(Degree Courses)</span></h2>
        <button onClick={openNew} className="shrink-0 px-3 py-1.5 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700">+ New</button>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search by code or name…"
        className="mb-3 w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />

      {loading ? <p className="text-sm text-slate-400">Loading…</p> : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-center">Years</th>
                  <th className="px-4 py-3 text-left">Exam Seat Codes</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No records found.</td></tr>
                )}
                {filtered.map(r => (
                  <tr key={r.code_no} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-700">{r.degree_course_code}</td>
                    <td className="px-4 py-3 text-slate-800">{r.degree_course_name}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{r.duration_years}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {[r.exam_seat_code_year1, r.exam_seat_code_year2, r.exam_seat_code_year3].filter(Boolean).join(' / ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                        {r.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => openEdit(r)} className="text-xs text-slate-500 hover:text-slate-800 underline">Edit</button>
                      {r.is_active && <button onClick={() => softDelete(r)} className="text-xs text-red-400 hover:text-red-600 underline">Deactivate</button>}
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
              <div key={r.code_no} className="border border-slate-100 rounded-xl p-4 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono font-semibold text-slate-700">{r.degree_course_code}</p>
                    <p className="text-sm text-slate-800 mt-0.5">{r.degree_course_name}</p>
                    <p className="text-xs text-slate-400 mt-1">{r.duration_years} years · Exam codes: {[r.exam_seat_code_year1, r.exam_seat_code_year2, r.exam_seat_code_year3].filter(Boolean).join(' / ') || '—'}</p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                    {r.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex gap-3 mt-3">
                  <button onClick={() => openEdit(r)} className="text-xs text-slate-500 hover:text-slate-800 underline">Edit</button>
                  {r.is_active && <button onClick={() => softDelete(r)} className="text-xs text-red-400 hover:text-red-600 underline">Deactivate</button>}
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
                  <select value={form.duration_years} onChange={e => set('duration_years', parseInt(e.target.value))} className={inp}>
                    {[2,3,4,5].map(y => <option key={y} value={y}>{y} Years</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Degree Course Name *">
                <input value={form.degree_course_name} onChange={e => set('degree_course_name', e.target.value)}
                  className={inp} placeholder="Bachelor of Commerce" />
              </Field>

              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-1">University Semester Codes</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[1,2,3,4,5,6].map(s => (
                  <Field key={s} label={`Sem ${s}`}>
                    <input value={form[`unique_code_sem${s}`]} onChange={e => set(`unique_code_sem${s}`, e.target.value)}
                      className={inp} placeholder={`SEM${s}CODE`} />
                  </Field>
                ))}
              </div>

              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-1">Exam Seat Code (Year-Level Prefix)</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {['year1','year2','year3'].map((y, i) => (
                  <Field key={y} label={`Year ${i+1} Code`} hint="Letters only">
                    <input value={form[`exam_seat_code_${y}`]}
                      onChange={e => set(`exam_seat_code_${y}`, e.target.value.replace(/[^A-Za-z]/g,'').toUpperCase())}
                      className={inp} placeholder={['FY','SY','TY'][i]} />
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
