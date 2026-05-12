import { useEffect, useState, useMemo } from 'react'
import api from '../../../../services/api.js'
import { usePermissions } from '../../hooks/usePermissions.js'
import { SkeletonTable } from '../../../../shared/components/Skeleton.jsx'

const FEES_TYPES = ['Student','Misc','ExamFees']
const ALL_YEAR_LEVELS = ['FY','SY','TY','4Y','5Y']
// Year tabs are derived from the selected program's duration (matches
// DivisionMaster.yearLevelsFor and FacultyMaster's exam_seat_code_year* layout).
function yearLevelsFor(durationYears) {
  const n = Math.max(1, Math.min(5, parseInt(durationYears) || 3))
  return ALL_YEAR_LEVELS.slice(0, n)
}

const EMPTY_FEE = {
  fees_type: 'Student', is_other_misc: false,
  fees_head: '', short_name: '', sequence_auto_fees: 0,
  credit_to_bank_ledger: '', is_refundable: false,
  fees_cat1_amount: 0, fees_cat2_amount: 0,
  fees_cat3_amount: 0, fees_cat4_amount: 0,
  cat4_description: '', is_active: true,
}

export default function FeesMaster({ collegeId }) {
  const { canWrite } = usePermissions()
  const rw = canWrite('masters')
  const [rows, setRows]           = useState([])
  const [banks, setBanks]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(null)
  const [form, setForm]           = useState(EMPTY_FEE)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [sortCol, setSortCol] = useState('sequence_auto_fees')
  const [sortDir, setSortDir] = useState('asc')
  function toggleSortFM(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    let av = a[sortCol], bv = b[sortCol]
    if (av == null) av = ''; if (bv == null) bv = ''
    const numCols = ['sequence_auto_fees','fees_cat1_amount','fees_cat2_amount','fees_cat3_amount','fees_cat4_amount']
    const cmp = numCols.includes(sortCol)
      ? Number(av) - Number(bv)
      : typeof av === 'boolean' || typeof bv === 'boolean'
        ? (av === bv ? 0 : av ? -1 : 1)
        : String(av).localeCompare(String(bv))
    return sortDir === 'asc' ? cmp : -cmp
  }), [rows, sortCol, sortDir])
  // Classwise fees modal
  const [cwModal, setCwModal]     = useState(false)
  const [cwFaculty, setCwFaculty] = useState([])
  const [cwSelFac, setCwSelFac]   = useState('')
  const [cwSelYear, setCwSelYear] = useState('FY')
  const [cwRows, setCwRows]       = useState([])
  const [cwSaving, setCwSaving]   = useState(false)
  const [cwError, setCwError]     = useState('')
  const [cwSuccess, setCwSuccess] = useState('')

  function load() {
    setLoading(true)
    Promise.all([
      api.get(`masters/${collegeId}/fees`),
      api.get(`masters/${collegeId}/bank`),
    ]).then(([fRes, bRes]) => {
      setRows(fRes.data.data || [])
      setBanks((bRes.data.data || []).filter(b => b.is_active))
    }).catch(() => setError('Failed to load.')).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [collegeId])

  function openNew()  { setForm({ ...EMPTY_FEE }); setModal('new'); setError('') }
  function openEdit(r){ setForm({ ...r, credit_to_bank_ledger: r.credit_to_bank_ledger || '' }); setModal(r); setError('') }
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function save() {
    if (!form.fees_head.trim()) return setError('Fees Head is required.')
    if (!form.short_name.trim()) return setError('Short Name is required.')
    setSaving(true); setError('')
    try {
      if (modal === 'new') await api.post(`masters/${collegeId}/fees`, form)
      else await api.put(`masters/${collegeId}/fees/${modal.fees_code}`, form)
      setModal(null); load()
    } catch (e) { setError(e?.response?.data?.message || 'Save failed.') }
    finally { setSaving(false) }
  }

  async function softDelete(row) {
    if (!confirm(`Deactivate "${row.fees_head}"?`)) return
    try { await api.delete(`masters/${collegeId}/fees/${row.fees_code}`); load() }
    catch { alert('Failed.') }
  }

  // ── Classwise Fees ──────────────────────────────────────────
  async function openCw() {
    setCwModal(true); setCwError(''); setCwSuccess('')
    const r = await api.get(`masters/${collegeId}/faculty`)
    const active = (r.data.data || []).filter(f => f.is_active)
    setCwFaculty(active)
    if (active.length) { setCwSelFac(active[0].code_no) }
  }

  const cwSelFacRow = cwFaculty.find(f => f.code_no == cwSelFac)
  const cwYearLevels = yearLevelsFor(cwSelFacRow?.duration_years)

  // If the user switches to a shorter program, the currently selected year
  // (e.g. 4Y) may no longer be valid — snap back to FY silently.
  useEffect(() => {
    if (cwSelFacRow && !cwYearLevels.includes(cwSelYear)) setCwSelYear('FY')
  }, [cwSelFacRow, cwYearLevels, cwSelYear])

  useEffect(() => {
    if (!cwModal || !cwSelFac) return
    api.get(`masters/${collegeId}/fees/classwise?faculty_id=${cwSelFac}&year_level=${cwSelYear}`)
      .then(cwRes => {
        const existing = cwRes.data.data || []
        const merged = rows.filter(r => r.is_active).map(r => {
          const ov = existing.find(e => e.fees_code === r.fees_code)
          return {
            fees_code:  r.fees_code,
            fees_head:  r.fees_head,
            short_name: r.short_name,
            fees_type:  r.fees_type,
            base_cat1:  r.fees_cat1_amount,
            base_cat2:  r.fees_cat2_amount,
            base_cat3:  r.fees_cat3_amount,
            base_cat4:  r.fees_cat4_amount,
            cat1_amount: ov?.cat1_amount ?? '',
            cat2_amount: ov?.cat2_amount ?? '',
            cat3_amount: ov?.cat3_amount ?? '',
            cat4_amount: ov?.cat4_amount ?? '',
          }
        })
        setCwRows(merged)
      }).catch(() => setCwError('Failed to load classwise fees.'))
  }, [cwModal, cwSelFac, cwSelYear, rows])

  function updateCw(feesCode, field, val) {
    setCwRows(rs => rs.map(r => r.fees_code === feesCode ? { ...r, [field]: val } : r))
  }

  async function saveCw() {
    setCwSaving(true); setCwError(''); setCwSuccess('')
    try {
      await api.post(`masters/${collegeId}/fees/classwise/save`, {
        faculty_master_id: cwSelFac,
        year_level: cwSelYear,
        rows: cwRows.map(r => ({
          fees_code:   r.fees_code,
          cat1_amount: r.cat1_amount !== '' ? parseFloat(r.cat1_amount) : null,
          cat2_amount: r.cat2_amount !== '' ? parseFloat(r.cat2_amount) : null,
          cat3_amount: r.cat3_amount !== '' ? parseFloat(r.cat3_amount) : null,
          cat4_amount: r.cat4_amount !== '' ? parseFloat(r.cat4_amount) : null,
        })),
      })
      setCwSuccess('Saved.')
    } catch (e) { setCwError(e?.response?.data?.message || 'Save failed.') }
    finally { setCwSaving(false) }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <h2 className="text-lg font-semibold text-slate-800">Fees Master</h2>
        <div className="flex gap-2">
          <button onClick={openCw} className="px-3 py-1.5 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50">
            Classwise Fees
          </button>
          {rw && <button onClick={openNew} className="px-3 py-1.5 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700">+ New Fee Head</button>}
        </div>
      </div>

      {loading ? <SkeletonTable rows={4} cols={4} /> : (
        <>
          {/* Desktop table — matches Program Master grid styling. */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border-2 border-slate-400">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-100 text-xs font-bold text-slate-600 uppercase tracking-wide border-b-2 border-slate-400">
                <tr>
                  <FMTh col="sequence_auto_fees"  label="Seq"     align="left"   sortCol={sortCol} sortDir={sortDir} onSort={toggleSortFM} className="w-8" />
                  <FMTh col="fees_head"           label="Fees Head" align="left" sortCol={sortCol} sortDir={sortDir} onSort={toggleSortFM} />
                  <FMTh col="short_name"          label="Short"   align="left"   sortCol={sortCol} sortDir={sortDir} onSort={toggleSortFM} className="w-20" />
                  <FMTh col="fees_type"           label="Type"    align="center" sortCol={sortCol} sortDir={sortDir} onSort={toggleSortFM} className="w-20" />
                  <FMTh col="fees_cat1_amount"    label="Cat-1"   align="right"  sortCol={sortCol} sortDir={sortDir} onSort={toggleSortFM} className="w-20" />
                  <FMTh col="fees_cat2_amount"    label="Cat-2"   align="right"  sortCol={sortCol} sortDir={sortDir} onSort={toggleSortFM} className="w-20" />
                  <FMTh col="fees_cat3_amount"    label="Cat-3"   align="right"  sortCol={sortCol} sortDir={sortDir} onSort={toggleSortFM} className="w-20" />
                  <FMTh col="fees_cat4_amount"    label="Cat-4"   align="right"  sortCol={sortCol} sortDir={sortDir} onSort={toggleSortFM} className="w-20" />
                  <th className="px-3 py-2.5 text-center w-20">Refund.</th>
                  <FMTh col="is_active"           label="Status"  align="center" sortCol={sortCol} sortDir={sortDir} onSort={toggleSortFM} className="w-16" />
                  <th className="px-3 py-2.5 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-300">
                {sorted.length === 0 && <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-500">No fee heads configured.</td></tr>}
                {sorted.map(r => (
                  <tr key={r.fees_code} className="hover:bg-blue-50 transition">
                    <td className="px-3 py-2.5 text-slate-500 text-center">{r.sequence_auto_fees}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-slate-900">{r.fees_head}</p>
                      {r.bank_name && <p className="text-xs text-slate-400">{r.bank_name}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 text-xs">{r.short_name}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{r.fees_type}</span>
                      {r.is_other_misc ? <span className="ml-1 text-xs text-amber-500">Misc</span> : null}
                    </td>
                    {['fees_cat1_amount','fees_cat2_amount','fees_cat3_amount','fees_cat4_amount'].map(k => (
                      <td key={k} className="px-3 py-2.5 text-right font-mono text-slate-700">
                        ₹{parseFloat(r[k] || 0).toLocaleString('en-IN')}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-center">
                      {r.is_refundable ? <span className="text-green-600 text-xs font-medium">Yes</span> : <span className="text-slate-300 text-xs">No</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {r.is_active ? 'Active' : 'Off'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right space-x-3 whitespace-nowrap">
                      {rw && <button onClick={() => openEdit(r)} className="text-xs font-medium text-slate-500 hover:text-slate-800 underline">Edit</button>}
                      {rw && r.is_active && <button onClick={() => softDelete(r)} className="text-xs font-medium text-red-400 hover:text-red-600 underline">Off</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="sm:hidden space-y-2">
            {rows.length === 0 && <p className="text-center text-slate-500 py-8 text-sm">No fee heads configured.</p>}
            {rows.map(r => (
              <div key={r.fees_code} className="border-2 border-slate-400 rounded-lg p-4 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-slate-900">{r.fees_head}</p>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{r.fees_type}</span>
                      {r.is_other_misc && <span className="text-xs text-amber-500">Misc</span>}
                    </div>
                    {r.bank_name && <p className="text-xs text-slate-400 mt-0.5">{r.bank_name}</p>}
                    <div className="grid grid-cols-2 gap-x-4 mt-2 text-xs text-slate-700">
                      <span>Cat-1: ₹{parseFloat(r.fees_cat1_amount || 0).toLocaleString('en-IN')}</span>
                      <span>Cat-2: ₹{parseFloat(r.fees_cat2_amount || 0).toLocaleString('en-IN')}</span>
                      <span>Cat-3: ₹{parseFloat(r.fees_cat3_amount || 0).toLocaleString('en-IN')}</span>
                      <span>Cat-4: ₹{parseFloat(r.fees_cat4_amount || 0).toLocaleString('en-IN')}</span>
                    </div>
                    {r.is_refundable && <p className="text-xs text-green-600 mt-1">Refundable</p>}
                  </div>
                  <span className={`shrink-0 inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {r.is_active ? 'Active' : 'Off'}
                  </span>
                </div>
                <div className="flex gap-3 mt-3">
                  {rw && <button onClick={() => openEdit(r)} className="text-xs font-medium text-slate-500 hover:text-slate-800 underline">Edit</button>}
                  {rw && r.is_active && <button onClick={() => softDelete(r)} className="text-xs font-medium text-red-400 hover:text-red-600 underline">Deactivate</button>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        <span>Cat-1: Open/General (Full)</span>
        <span>Cat-2: EBC/PTC/STC/Army</span>
        <span>Cat-3: SC/ST/OBC/BCC</span>
        {/* TODO: confirm with stakeholder — official definition of Cat-4 */}
        <span>Cat-4: FF/PH/Widows/Govt.Wards (confirm)</span>
      </div>

      {/* Edit / New Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <h3 className="font-semibold text-slate-800">{modal === 'new' ? 'New Fee Head' : 'Edit Fee Head'}</h3>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="overflow-y-auto px-6 py-5 space-y-4">
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

              {/* Fees Type radio */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-2">Fees Type *</label>
                <div className="flex flex-wrap gap-4">
                  {FEES_TYPES.map(t => (
                    <label key={t} className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                      <input type="radio" checked={form.fees_type === t} onChange={() => set('fees_type', t)} className="accent-slate-700" />
                      {t}
                    </label>
                  ))}
                </div>
                <label className="flex items-center gap-2 mt-2 text-sm text-slate-600">
                  <input type="checkbox" checked={!!form.is_other_misc} onChange={e => set('is_other_misc', e.target.checked)} className="accent-slate-700" />
                  Other / Misc
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <F label="Fees Head *"><input value={form.fees_head} onChange={e => set('fees_head', e.target.value)} className={inp} placeholder="Tuition Fees" /></F>
                <F label="Short Name *"><input value={form.short_name} onChange={e => set('short_name', e.target.value)} className={inp} placeholder="Tui.F" /></F>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <F label="Display Sequence">
                  <input type="number" value={form.sequence_auto_fees} onChange={e => set('sequence_auto_fees', e.target.value)} className={inp} />
                </F>
                <F label="Credit to Bank Account">
                  <select value={form.credit_to_bank_ledger} onChange={e => set('credit_to_bank_ledger', e.target.value)} className={inp}>
                    <option value="">— None —</option>
                    {banks.map(b => <option key={b.ledger_code} value={b.ledger_code}>{b.bank_name} ({b.bank_account_number})</option>)}
                  </select>
                </F>
              </div>

              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-1">Fee Amounts by Category</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <F label="Cat-1 Amount — Open/General (₹)">
                  <input type="number" step="0.01" value={form.fees_cat1_amount} onChange={e => set('fees_cat1_amount', e.target.value)} className={inp} />
                </F>
                <F label="Cat-2 Amount — EBC/PTC/STC/Army (₹)">
                  <input type="number" step="0.01" value={form.fees_cat2_amount} onChange={e => set('fees_cat2_amount', e.target.value)} className={inp} />
                </F>
                <F label="Cat-3 Amount — SC/ST/OBC/BCC (₹)">
                  <input type="number" step="0.01" value={form.fees_cat3_amount} onChange={e => set('fees_cat3_amount', e.target.value)} className={inp} />
                </F>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-600">Cat-4 Amount (₹)
                    <span className="ml-1 font-normal text-slate-400 normal-case">— configurable</span>
                  </label>
                  <input type="number" step="0.01" value={form.fees_cat4_amount} onChange={e => set('fees_cat4_amount', e.target.value)} className={inp} />
                  <input value={form.cat4_description} onChange={e => set('cat4_description', e.target.value)}
                    className={inp} placeholder="FF/PH/Widows/Govt.Wards (confirm with stakeholder)" />
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={!!form.is_refundable} onChange={e => set('is_refundable', e.target.checked)} className="accent-slate-700" />
                  Refundable
                  <span className="text-xs text-slate-400">(reimbursed for BCC students)</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={!!form.is_active} onChange={e => set('is_active', e.target.checked)} className="accent-slate-700" />
                  Active
                </label>
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

      {/* Classwise Fees Modal */}
      {cwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <h3 className="font-semibold text-slate-800">Classwise Fees Table</h3>
              <button onClick={() => setCwModal(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-4 shrink-0 flex flex-col sm:flex-row flex-wrap gap-3 border-b border-slate-100">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500">Degree Course</label>
                <select value={cwSelFac} onChange={e => setCwSelFac(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 w-full sm:min-w-[200px]">
                  {cwFaculty.map(f => <option key={f.code_no} value={f.code_no}>{f.degree_course_code} — {f.degree_course_name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500">Year Level</label>
                <div className="flex gap-1">
                  {cwYearLevels.map(y => (
                    <button key={y} onClick={() => setCwSelYear(y)}
                      className={`px-4 h-9 rounded-lg text-sm font-medium border transition ${cwSelYear === y ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                      {y}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="overflow-auto flex-1 px-6 py-4">
              {cwError   && <p className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{cwError}</p>}
              {cwSuccess && <p className="mb-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{cwSuccess}</p>}
              <p className="text-xs text-slate-400 mb-3">Leave blank to use the base Fees Master amount. Enter a value to override for this class-year.</p>
              <div className="min-w-[600px]">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-3 py-2 text-left">Fee Head</th>
                      <th className="px-3 py-2 text-center">Cat-1 Base</th>
                      <th className="px-3 py-2 text-center">Cat-1 Override</th>
                      <th className="px-3 py-2 text-center">Cat-2 Base</th>
                      <th className="px-3 py-2 text-center">Cat-2 Override</th>
                      <th className="px-3 py-2 text-center">Cat-3 Base</th>
                      <th className="px-3 py-2 text-center">Cat-3 Override</th>
                      <th className="px-3 py-2 text-center">Cat-4 Base</th>
                      <th className="px-3 py-2 text-center">Cat-4 Override</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {cwRows.map(r => (
                      <tr key={r.fees_code} className="hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <p className="font-medium text-slate-800">{r.fees_head}</p>
                          <p className="text-slate-400">{r.short_name}</p>
                        </td>
                        {[1,2,3,4].map(n => (
                          <>
                            <td key={`b${n}`} className="px-3 py-2 text-center text-slate-400 font-mono">
                              ₹{parseFloat(r[`base_cat${n}`] || 0).toLocaleString('en-IN')}
                            </td>
                            <td key={`o${n}`} className="px-3 py-2 text-center">
                              <input
                                type="number" step="0.01"
                                value={r[`cat${n}_amount`]}
                                onChange={e => updateCw(r.fees_code, `cat${n}_amount`, e.target.value)}
                                placeholder="—"
                                className="w-20 border border-slate-200 rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-slate-300"
                              />
                            </td>
                          </>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
              <button onClick={() => setCwModal(false)} className="px-4 py-2 text-sm text-slate-600">Close</button>
              <button onClick={saveCw} disabled={cwSaving} className="px-5 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50">
                {cwSaving ? 'Saving…' : 'Save Overrides'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function F({ label, children }) {
  return <div className="flex flex-col gap-1"><label className="text-xs font-semibold text-slate-600">{label}</label>{children}</div>
}
const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300'

function FMTh({ col, label, align = 'left', sortCol, sortDir, onSort, className = '' }) {
  const active = sortCol === col
  return (
    <th
      className={`px-3 py-2.5 text-${align} cursor-pointer select-none text-xs font-bold uppercase tracking-wide text-slate-600 hover:text-slate-900 transition ${className}`}
      onClick={() => onSort(col)}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'ml-auto' : ''}`}>
        {label}
        <span className="text-slate-300">{active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
      </span>
    </th>
  )
}
