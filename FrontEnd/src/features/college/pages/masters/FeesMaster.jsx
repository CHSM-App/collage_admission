import { useEffect, useState, useMemo } from 'react'
import { getFeesList, createFees, updateFees, deleteFees, getBankLedgers, getFaculty, getClasswiseFees, saveClasswiseFees, deleteClasswiseFee, masterCacheRead, masterCacheHas } from '../../../../services/masterService.js'
import { usePermissions } from '../../hooks/usePermissions.js'
import { SkeletonTable } from '../../../../shared/components/Skeleton.jsx'
import { useToast } from '../../../../context/ToastContext.jsx'
import { getErrorMessage } from '../../../../shared/hooks/useNetworkError.js'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const FEES_TYPES = ['Student','Misc','ExamFees']
const ALL_YEAR_LEVELS = ['FY','SY','TY','4Y','5Y']

function yearLevelsFor(durationYears) {
  const n = Math.max(1, Math.min(5, parseInt(durationYears) || 3))
  return ALL_YEAR_LEVELS.slice(0, n)
}

// Generate 20 academic year options: 5 past + current + 14 future
function academicYearOptions() {
  const now = new Date()
  const base = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1
  return Array.from({ length: 20 }, (_, i) => {
    const y = base - 5 + i
    return `${y}-${String(y + 1).slice(-2)}`
  })
}
const AY_OPTIONS = academicYearOptions()
const CURRENT_AY = AY_OPTIONS[5]

const EMPTY_FEE = {
  fees_type: 'Student', is_other_misc: false,
  fees_head: '', short_name: '', sequence_auto_fees: 1,
  credit_to_bank_ledger: '', is_refundable: false,
  fees_cat1_amount: 0, fees_cat2_amount: 0,
  fees_cat3_amount: 0, fees_cat4_amount: 0,
  cat4_description: '', is_active: true,
  academic_year: CURRENT_AY,
}

export default function FeesMaster({ collegeId }) {
  const { canWrite } = usePermissions()
  const rw = canWrite('masters')
  const toast = useToast()
  const [allRows, setAllRows]     = useState(() => masterCacheRead(`fees:${collegeId}`)?.data?.data ?? [])
  const [banks, setBanks]         = useState(() => (masterCacheRead(`bank:${collegeId}`)?.data?.data ?? []).filter(b => b.is_active))
  const [loading, setLoading]     = useState(() => !masterCacheRead(`fees:${collegeId}`) || !masterCacheRead(`bank:${collegeId}`))
  const [modal, setModal]         = useState(null)
  const [form, setForm]           = useState(EMPTY_FEE)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  // Academic year filter for heads table
  const [selAY, setSelAY]         = useState(CURRENT_AY)

  const [sortCol, setSortCol] = useState('sequence_auto_fees')
  const [sortDir, setSortDir] = useState('asc')
  function toggleSortFM(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  // Filter rows by selected academic year
  const rows = useMemo(() => allRows.filter(r => r.academic_year === selAY), [allRows, selAY])

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
  const [cwModal, setCwModal]         = useState(false)
  const [cwFaculty, setCwFaculty]     = useState([])
  const [cwSelFac, setCwSelFac]       = useState('')
  const [cwSelYear, setCwSelYear]     = useState('FY')
  const [cwSelType, setCwSelType]     = useState('Grand')
  const [cwSelAY, setCwSelAY]         = useState(CURRENT_AY)
  const [cwRows, setCwRows]           = useState([])
  const [cwSaving, setCwSaving]       = useState(false)
  const [cwError, setCwError]         = useState('')
  const [cwSuccess, setCwSuccess]     = useState('')

  const CW_STUDENT_TYPES = ['Grand', 'NonGrand', 'Outsider']
  const CW_STUDENT_TYPE_LABEL = { Grand: 'Grant', NonGrand: 'Non-Grant', Outsider: 'Outsider' }

  function load(silent = false) {
    const wasMiss = !masterCacheHas(`fees:${collegeId}:`) || !masterCacheHas(`bank:${collegeId}`)
    if (!silent && wasMiss) setLoading(true)
    Promise.all([
      getFeesList(collegeId, null, r => setAllRows(r.data.data || [])),
      getBankLedgers(collegeId,    r => setBanks((r.data.data || []).filter(b => b.is_active))),
    ]).then(([fRes, bRes]) => {
      setAllRows(fRes.data.data || [])
      setBanks((bRes.data.data || []).filter(b => b.is_active))
    }).catch(() => setError('Failed to load.')).finally(() => { if (!silent && wasMiss) setLoading(false) })
  }
  useEffect(() => { load() }, [collegeId])

  function openNew()  { setForm({ ...EMPTY_FEE, academic_year: selAY }); setModal('new'); setError('') }
  function openEdit(r){ setForm({ ...r, credit_to_bank_ledger: r.credit_to_bank_ledger || '' }); setModal(r); setError('') }
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function save() {
    if (!form.fees_head.trim()) return setError('Fees Head is required.')
    if (!form.short_name.trim()) return setError('Short Name is required.')
    if (!form.academic_year) return setError('Academic Year is required.')
    setSaving(true); setError('')
    try {
      if (modal === 'new') await createFees(collegeId, form)
      else await updateFees(collegeId, modal.fees_code, form)
      setModal(null); load(true)
    } catch (e) { setError(getErrorMessage(e, 'Save failed.')) }
    finally { setSaving(false) }
  }

  async function softDelete(row) {
    if (!confirm(`Deactivate "${row.fees_head}"?`)) return
    try { await deleteFees(collegeId, row.fees_code); load(true) }
    catch { toast.error('Failed.') }
  }

  const [dragRows, setDragRows] = useState([])
  const [dragging, setDragging] = useState(false)
  // Keep dragRows in sync when sorted changes (AY switch, reload)
  useEffect(() => { setDragRows(sorted) }, [sorted])

  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  async function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = dragRows.findIndex(r => r.fees_code === active.id)
    const newIdx = dragRows.findIndex(r => r.fees_code === over.id)
    const reordered = arrayMove(dragRows, oldIdx, newIdx)
    // Assign new sequential sequence numbers
    const updated = reordered.map((r, i) => ({ ...r, sequence_auto_fees: i + 1 }))
    setDragRows(updated) // optimistic
    setDragging(true)
    // Build old seq map by fees_code to correctly detect changes
    const oldSeqMap = Object.fromEntries(dragRows.map(r => [r.fees_code, r.sequence_auto_fees]))
    try {
      const changed = updated.filter(r => r.sequence_auto_fees !== oldSeqMap[r.fees_code])
      await Promise.all(changed.map(r => updateFees(collegeId, r.fees_code, { ...r })))
      load(true)
    } catch { toast.error('Reorder failed.'); setDragRows(sorted) }
    finally { setDragging(false) }
  }

  const [pulling, setPulling] = useState(false)
  async function pullFromPrevYear() {
    const idx = AY_OPTIONS.indexOf(selAY)
    if (idx <= 0) return
    const prevAY = AY_OPTIONS[idx - 1]
    const prevRows = allRows.filter(r => r.academic_year === prevAY)
    if (prevRows.length === 0) { toast.error(`No fee heads found for ${prevAY}.`); return }
    const existing = new Set(rows.map(r => r.fees_head.trim().toLowerCase()))
    const toCopy = prevRows.filter(r => !existing.has(r.fees_head.trim().toLowerCase()))
    if (toCopy.length === 0) { toast.error(`All heads from ${prevAY} already exist in ${selAY}.`); return }
    if (!confirm(`Copy ${toCopy.length} fee head(s) from ${prevAY} to ${selAY}?`)) return
    setPulling(true)
    try {
      const maxSeq = rows.reduce((m, r) => Math.max(m, r.sequence_auto_fees || 0), 0)
      for (let i = 0; i < toCopy.length; i++) {
        const { fees_code, bank_name, ...rest } = toCopy[i]
        await createFees(collegeId, { ...rest, academic_year: selAY, sequence_auto_fees: maxSeq + i + 1 })
      }
      load(true)
      toast.success(`Copied ${toCopy.length} head(s) from ${prevAY} to ${selAY}.`)
    } catch (e) { toast.error(getErrorMessage(e, 'Pull failed.')) }
    finally { setPulling(false) }
  }

  // ── Classwise Fees ──────────────────────────────────────────
  async function openCw() {
    setCwModal(true); setCwError(''); setCwSuccess('')
    setCwSelAY(selAY) // sync to current head filter year
    const r = await getFaculty(collegeId, bg => {
      const active = (bg.data.data || []).filter(f => f.is_active)
      setCwFaculty(active)
    })
    const active = (r.data.data || []).filter(f => f.is_active)
    setCwFaculty(active)
    if (active.length) { setCwSelFac(active[0].code_no) }
  }

  const cwSelFacRow = cwFaculty.find(f => f.code_no == cwSelFac)
  const cwYearLevels = yearLevelsFor(cwSelFacRow?.duration_years)

  useEffect(() => {
    if (cwSelFacRow && !cwYearLevels.includes(cwSelYear)) setCwSelYear('FY')
  }, [cwSelFacRow, cwYearLevels, cwSelYear])

  // Heads for classwise fees: only those matching cwSelAY
  const cwHeadRows = useMemo(() => allRows.filter(r => r.is_active && r.academic_year === cwSelAY), [allRows, cwSelAY])

  useEffect(() => {
    if (!cwModal || !cwSelFac) return
    getClasswiseFees(collegeId, cwSelFac, cwSelYear, cwSelType, cwSelAY)
      .then(cwRes => {
        const existing = cwRes.data.data || []
        const merged = cwHeadRows.map(r => {
          const ov = existing.find(e => e.fees_code === r.fees_code)
          return {
            fees_code:   r.fees_code,
            fees_head:   r.fees_head,
            short_name:  r.short_name,
            fees_type:   r.fees_type,
            base_cat1:   r.fees_cat1_amount,
            base_cat2:   r.fees_cat2_amount,
            base_cat3:   r.fees_cat3_amount,
            base_cat4:   r.fees_cat4_amount,
            selected:    !!ov,
            cat1_amount: ov?.cat1_amount ?? '',
            cat2_amount: ov?.cat2_amount ?? '',
            cat3_amount: ov?.cat3_amount ?? '',
            cat4_amount: ov?.cat4_amount ?? '',
          }
        })
        setCwRows(merged)
      }).catch(() => setCwError('Failed to load classwise fees.'))
  }, [cwModal, cwSelFac, cwSelYear, cwSelType, cwSelAY, cwHeadRows])

  function updateCw(feesCode, field, val) {
    setCwRows(rs => rs.map(r => r.fees_code === feesCode ? { ...r, [field]: val } : r))
  }

  async function saveCw() {
    setCwSaving(true); setCwError(''); setCwSuccess('')
    try {
      const selected   = cwRows.filter(r => r.selected)
      const deselected = cwRows.filter(r => !r.selected)

      if (selected.length) {
        await saveClasswiseFees(collegeId, {
          faculty_master_id: cwSelFac,
          year_level:        cwSelYear,
          student_type:      cwSelType,
          academic_year:     cwSelAY,
          rows: selected.map(r => ({
            fees_code:   r.fees_code,
            cat1_amount: r.cat1_amount !== '' ? parseFloat(r.cat1_amount) : null,
            cat2_amount: r.cat2_amount !== '' ? parseFloat(r.cat2_amount) : null,
            cat3_amount: r.cat3_amount !== '' ? parseFloat(r.cat3_amount) : null,
            cat4_amount: r.cat4_amount !== '' ? parseFloat(r.cat4_amount) : null,
          })),
        })
      }

      for (const r of deselected) {
        await deleteClasswiseFee(collegeId, {
          faculty_master_id: cwSelFac,
          year_level:        cwSelYear,
          student_type:      cwSelType,
          academic_year:     cwSelAY,
          fees_code:         r.fees_code,
        })
      }

      setCwSuccess('Saved.')
    } catch (e) { setCwError(e?.response?.data?.message || 'Save failed.') }
    finally { setCwSaving(false) }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <h2 className="text-lg font-semibold text-slate-800">Fees Master</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Academic Year filter pill */}
          <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2 py-1 bg-white">
            <span className="text-xs text-slate-500 font-medium">Year:</span>
            <select value={selAY} onChange={e => setSelAY(e.target.value)}
              className="text-sm font-semibold text-slate-800 bg-transparent outline-none cursor-pointer">
              {AY_OPTIONS.map(ay => <option key={ay} value={ay}>{ay}</option>)}
            </select>
          </div>
          <button onClick={openCw} className="px-3 py-1.5 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50">
            Classwise Fees
          </button>
          {rw && AY_OPTIONS.indexOf(selAY) > 0 && (
            <button onClick={pullFromPrevYear} disabled={pulling}
              className="px-3 py-1.5 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50 disabled:opacity-50">
              {pulling ? 'Pulling…' : `↓ Pull from ${AY_OPTIONS[AY_OPTIONS.indexOf(selAY) - 1]}`}
            </button>
          )}
          {rw && <button onClick={openNew} className="px-3 py-1.5 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700">+ New Fee Head</button>}
        </div>
      </div>

      {loading ? <SkeletonTable rows={4} cols={4} /> : (
        <>
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
                  {rw && <th className="px-3 py-2.5 w-8" />}
                  <th className="px-3 py-2.5 w-20" />
                </tr>
              </thead>
              <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={dragRows.map(r => r.fees_code)} strategy={verticalListSortingStrategy}>
                  <tbody className="divide-y-2 divide-slate-300">
                    {dragRows.length === 0 && (
                      <tr><td colSpan={rw ? 12 : 11} className="px-4 py-8 text-center text-slate-500">
                        No fee heads configured for {selAY}.
                      </td></tr>
                    )}
                    {dragRows.map(r => (
                      <SortableFMRow key={r.fees_code} row={r} rw={rw} onEdit={openEdit} onDelete={softDelete} dragging={dragging} />
                    ))}
                  </tbody>
                </SortableContext>
              </DndContext>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="sm:hidden space-y-2">
            {rows.length === 0 && <p className="text-center text-slate-500 py-8 text-sm">No fee heads configured for {selAY}.</p>}
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

              {/* Academic Year */}
              <F label="Academic Year *">
                <select value={form.academic_year} onChange={e => set('academic_year', e.target.value)} className={inp}>
                  {AY_OPTIONS.map(ay => <option key={ay} value={ay}>{ay}</option>)}
                </select>
              </F>

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
              {/* Academic Year selector */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500">Academic Year</label>
                <select value={cwSelAY} onChange={e => { setCwSelAY(e.target.value); setCwSuccess('') }}
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300">
                  {AY_OPTIONS.map(ay => <option key={ay} value={ay}>{ay}</option>)}
                </select>
              </div>
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
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500">Student Type</label>
                <div className="flex gap-1">
                  {CW_STUDENT_TYPES.map(t => (
                    <button key={t} onClick={() => setCwSelType(t)}
                      className={`px-4 h-9 rounded-lg text-sm font-medium border transition ${cwSelType === t ? 'bg-indigo-700 text-white border-indigo-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                      {CW_STUDENT_TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="overflow-auto flex-1 px-6 py-4">
              {cwError   && <p className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{cwError}</p>}
              {cwSuccess && <p className="mb-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{cwSuccess}</p>}
              {cwHeadRows.length === 0
                ? <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                    No fee heads configured for <strong>{cwSelAY}</strong>. Add heads in the Fee Heads table first.
                  </div>
                : <>
                    <p className="text-xs text-slate-400 mb-3">Check a fee head to include it for this class. Leave amounts blank to use the base Fees Master amount.</p>
                    <div className="min-w-[640px]">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          <tr>
                            <th className="px-3 py-2 text-center w-10">
                              <input
                                type="checkbox"
                                title="Select all"
                                checked={cwRows.length > 0 && cwRows.every(r => r.selected)}
                                onChange={e => setCwRows(rs => rs.map(r => ({ ...r, selected: e.target.checked })))}
                                className="accent-slate-700"
                              />
                            </th>
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
                        <tbody className="divide-y divide-slate-100">
                          {cwRows.map(r => (
                            <tr key={r.fees_code} className={`transition ${r.selected ? 'hover:bg-slate-50' : 'opacity-40'}`}>
                              <td className="px-3 py-2 text-center">
                                <input type="checkbox" checked={!!r.selected}
                                  onChange={e => updateCw(r.fees_code, 'selected', e.target.checked)}
                                  className="accent-slate-700" />
                              </td>
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
                                      disabled={!r.selected}
                                      className="w-20 border border-slate-200 rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-slate-300 disabled:bg-slate-50 disabled:cursor-not-allowed"
                                    />
                                  </td>
                                </>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
              }
            </div>
            <div className="border-t border-slate-100 shrink-0">
              {cwRows.length > 0 && (
                <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-x-6 gap-y-1">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wide self-center mr-2">Total (selected)</span>
                  {[1,2,3,4].map(n => {
                    const total = cwRows
                      .filter(r => r.selected)
                      .reduce((sum, r) => {
                        const ov = r[`cat${n}_amount`]
                        const amt = ov !== '' && ov != null ? parseFloat(ov) : parseFloat(r[`base_cat${n}`] || 0)
                        return sum + (isNaN(amt) ? 0 : amt)
                      }, 0)
                    return (
                      <div key={n} className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-400">Cat-{n}:</span>
                        <span className="text-xs font-bold font-mono text-slate-800">₹{total.toLocaleString('en-IN')}</span>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="flex items-center justify-between px-6 py-4">
                <span className="text-xs text-slate-400">
                  {cwRows.filter(r => r.selected).length} of {cwRows.length} fee heads selected for {cwSelAY}
                </span>
                <div className="flex gap-3">
                  <button onClick={() => setCwModal(false)} className="px-4 py-2 text-sm text-slate-600">Close</button>
                  <button onClick={saveCw} disabled={cwSaving || cwHeadRows.length === 0} className="px-5 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50">
                    {cwSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SortableFMRow({ row: r, rw, onEdit, onDelete, dragging }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: r.fees_code })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: isDragging ? '#f1f5f9' : undefined,
  }
  return (
    <tr ref={setNodeRef} style={style} className="hover:bg-blue-50 transition">
      {rw && (
        <td className="px-2 py-2.5 text-center w-8">
          <span {...attributes} {...listeners}
            className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 select-none text-lg leading-none"
            title="Drag to reorder">⠿</span>
        </td>
      )}
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
        {rw && <button onClick={() => onEdit(r)} className="text-xs font-medium text-slate-500 hover:text-slate-800 underline">Edit</button>}
        {rw && r.is_active && <button onClick={() => onDelete(r)} className="text-xs font-medium text-red-400 hover:text-red-600 underline">Off</button>}
      </td>
    </tr>
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
