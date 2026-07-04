import { useEffect, useState, useMemo, useRef } from 'react'
import { getFeesList, createFees, updateFees, deleteFees, getBankLedgers, getFaculty, getClasswiseFees, getClasswiseFeesLive, saveClasswiseFees, deleteClasswiseFee, getCategoryMaster, masterCacheRead, masterCacheHas } from '../../../../services/masterService.js'
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
  is_active: true,
  academic_year: CURRENT_AY,
  fees_cat1_amount: '',
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
  const [selAY, setSelAY]         = useState(CURRENT_AY)
  const [activeTab, setActiveTab] = useState('heads') // 'heads' | 'classwise'
  const [feesCategories, setFeesCategories] = useState(null) // null = loading, [] = no master (fallback)
  const [catMasterData, setCatMasterData]   = useState(null) // full master: castes, statuses, mappings

  // Effective categories: use master if loaded, otherwise fallback to default 4
  const DEFAULT_CATS = [
    { slab_index: 1, category_name: 'Category 1' },
    { slab_index: 2, category_name: 'Category 2' },
    { slab_index: 3, category_name: 'Category 3' },
    { slab_index: 4, category_name: 'Category 4' },
  ]
  const effectiveCats = (feesCategories && feesCategories.length > 0) ? feesCategories : DEFAULT_CATS

  const [sortCol, setSortCol] = useState('sequence_auto_fees')
  const [sortDir, setSortDir] = useState('asc')
  function toggleSortFM(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const rows = useMemo(() => allRows.filter(r => r.academic_year === selAY), [allRows, selAY])

  const sorted = useMemo(() => [...rows].sort((a, b) => {
    let av = a[sortCol], bv = b[sortCol]
    if (av == null) av = ''; if (bv == null) bv = ''
    const numCols = ['sequence_auto_fees']
    const cmp = numCols.includes(sortCol)
      ? Number(av) - Number(bv)
      : typeof av === 'boolean' || typeof bv === 'boolean'
        ? (av === bv ? 0 : av ? -1 : 1)
        : String(av).localeCompare(String(bv))
    return sortDir === 'asc' ? cmp : -cmp
  }), [rows, sortCol, sortDir])

  // Classwise fees state
  const [cwFaculty, setCwFaculty]     = useState([])
  const [cwFacLoaded, setCwFacLoaded] = useState(false)
  const [cwSelFac, setCwSelFac]       = useState('')
  const [cwSelYear, setCwSelYear]     = useState('FY')
  const [cwSelType, setCwSelType]     = useState('Grand')
  const [cwSelAY, setCwSelAY]         = useState(CURRENT_AY)
  const [cwRows, setCwRows]           = useState([])
  const [cwSaving, setCwSaving]       = useState(false)
  const [cwError, setCwError]         = useState('')
  const [cwSuccess, setCwSuccess]     = useState('')
  const cwSavingRef = useRef(false)

  const CW_STUDENT_TYPES = ['Grand', 'NonGrand', 'Outsider']
  const CW_STUDENT_TYPE_LABEL = { Grand: 'Grant', NonGrand: 'Non-Grant', Outsider: 'Outsider' }

  function load(silent = false) {
    const wasMiss = !masterCacheHas(`fees:${collegeId}`) || !masterCacheHas(`bank:${collegeId}`)
    if (!silent && wasMiss) setLoading(true)
    Promise.all([
      getFeesList(collegeId, null, r => setAllRows(r.data.data || [])),
      getBankLedgers(collegeId,    r => setBanks((r.data.data || []).filter(b => b.is_active))),
    ]).then(([fRes, bRes]) => {
      setAllRows(fRes.data.data || [])
      setBanks((bRes.data.data || []).filter(b => b.is_active))
    }).catch(() => setError('Failed to load.')).finally(() => { if (!silent && wasMiss) setLoading(false) })
  }
  useEffect(() => {
    load()
    getCategoryMaster(collegeId).then(r => {
      const data = r.data.data || {}
      const cats = (data.feesCategories || [])
        .filter(c => c.is_active)
        .sort((a, b) => a.slab_index - b.slab_index)
      setFeesCategories(cats)
      setCatMasterData(data)
    }).catch(() => { setFeesCategories([]); setCatMasterData({}) })
  }, [collegeId])

  // Load faculty when switching to classwise tab
  useEffect(() => {
    if (activeTab !== 'classwise' || cwFacLoaded) return
    getFaculty(collegeId).then(r => {
      const active = (r.data.data || []).filter(f => f.is_active)
      setCwFaculty(active)
      if (active.length) setCwSelFac(active[0].code_no)
      setCwFacLoaded(true)
    }).catch(() => setCwError('Failed to load faculty.'))
  }, [activeTab, cwFacLoaded, collegeId])

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
  useEffect(() => { setDragRows(sorted) }, [sorted])

  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  async function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = dragRows.findIndex(r => r.fees_code === active.id)
    const newIdx = dragRows.findIndex(r => r.fees_code === over.id)
    const reordered = arrayMove(dragRows, oldIdx, newIdx)
    const updated = reordered.map((r, i) => ({ ...r, sequence_auto_fees: i + 1 }))
    setDragRows(updated)
    setDragging(true)
    const oldSeqMap = Object.fromEntries(dragRows.map(r => [r.fees_code, r.sequence_auto_fees]))
    try {
      const changed = updated.filter(r => r.sequence_auto_fees !== oldSeqMap[r.fees_code])
      await Promise.all(changed.map(r => updateFees(collegeId, r.fees_code, { ...r })))
      load(true)
    } catch { toast.error('Reorder failed.'); setDragRows(sorted) }
    finally { setDragging(false) }
  }

  const [pullModal, setPullModal]   = useState(null)
  const [pullSaving, setPullSaving] = useState(false)

  function openPullModal() {
    const idx = AY_OPTIONS.indexOf(selAY)
    if (idx <= 0) return
    const prevAY = AY_OPTIONS[idx - 1]
    const prevRows = allRows.filter(r => r.academic_year === prevAY)
    if (prevRows.length === 0) { toast.error(`No fee heads found for ${prevAY}.`); return }
    const existing = new Set(rows.map(r => r.fees_head.trim().toLowerCase()))
    const toCopy = prevRows.filter(r => !existing.has(r.fees_head.trim().toLowerCase()))
    if (toCopy.length === 0) { toast.error(`All heads from ${prevAY} already exist in ${selAY}.`); return }
    setPullModal({ prevAY, toCopy, selected: new Set(toCopy.map(r => r.fees_code)) })
  }

  async function confirmPull() {
    if (!pullModal) return
    const { prevAY, toCopy, selected } = pullModal
    const chosen = toCopy.filter(r => selected.has(r.fees_code))
    if (chosen.length === 0) { toast.error('Select at least one fee head.'); return }
    setPullSaving(true)
    try {
      const maxSeq = rows.reduce((m, r) => Math.max(m, r.sequence_auto_fees || 0), 0)
      for (let i = 0; i < chosen.length; i++) {
        const { fees_code, bank_name, ...rest } = chosen[i]
        await createFees(collegeId, { ...rest, academic_year: selAY, sequence_auto_fees: maxSeq + i + 1 })
      }
      load(true)
      toast.success(`Copied ${chosen.length} head(s) from ${prevAY} to ${selAY}.`)
      setPullModal(null)
    } catch (e) { toast.error(getErrorMessage(e, 'Pull failed.')) }
    finally { setPullSaving(false) }
  }

  function togglePullRow(code) {
    setPullModal(m => {
      const next = new Set(m.selected)
      next.has(code) ? next.delete(code) : next.add(code)
      return { ...m, selected: next }
    })
  }

  function toggleAllPull(checked) {
    setPullModal(m => ({ ...m, selected: checked ? new Set(m.toCopy.map(r => r.fees_code)) : new Set() }))
  }

  // Classwise fees
  const cwSelFacRow  = cwFaculty.find(f => f.code_no == cwSelFac)
  const cwYearLevels = yearLevelsFor(cwSelFacRow?.duration_years)

  useEffect(() => {
    if (cwSelFacRow && !cwYearLevels.includes(cwSelYear)) setCwSelYear('FY')
  }, [cwSelFacRow, cwYearLevels, cwSelYear])

  const cwHeadRows = useMemo(() => allRows.filter(r => r.is_active && r.academic_year === cwSelAY), [allRows, cwSelAY])
  // Track a load key to explicitly trigger classwise reload only on filter changes, not on allRows background refresh
  const [cwLoadKey, setCwLoadKey] = useState(0)
  const cwLoadKeyRef = useRef(0)

  // Trigger a classwise reload when filters change (but NOT when allRows changes due to background refresh)
  useEffect(() => {
    if (activeTab !== 'classwise' || !cwSelFac) return
    cwLoadKeyRef.current += 1
    setCwLoadKey(cwLoadKeyRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, cwSelFac, cwSelYear, cwSelType, cwSelAY])

  // Also trigger reload when feesCategories first loads (if on classwise tab)
  const prevFeesCategories = useRef(null)
  useEffect(() => {
    if (feesCategories === prevFeesCategories.current) return
    prevFeesCategories.current = feesCategories
    if (activeTab !== 'classwise' || !cwSelFac) return
    cwLoadKeyRef.current += 1
    setCwLoadKey(cwLoadKeyRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feesCategories])

  useEffect(() => {
    if (activeTab !== 'classwise' || !cwSelFac) return
    if (cwSavingRef.current) return  // don't overwrite cwRows while save is in progress
    const headRows = allRows.filter(r => r.is_active && r.academic_year === cwSelAY)
    const cats = (feesCategories && feesCategories.length > 0) ? feesCategories : DEFAULT_CATS
    setCwError(''); setCwSuccess('')
    getClasswiseFees(collegeId, cwSelFac, cwSelYear, cwSelType, cwSelAY)
      .then(cwRes => {
        if (cwSavingRef.current) return  // save started while fetch was in flight
        const existing = cwRes.data.data || []
        const merged = headRows.map(r => {
          const ov = existing.find(e => e.fees_code === r.fees_code)
          const catAmounts = {}
          cats.forEach(c => {
            catAmounts[`cat${c.slab_index}_amount`] = ov?.[`cat${c.slab_index}_amount`] ?? ''
          })
          return {
            fees_code:    r.fees_code,
            fees_head:    r.fees_head,
            short_name:   r.short_name,
            fees_type:    r.fees_type,
            selected:     !!ov,
            _existsInDb:  !!ov,
            ...catAmounts,
          }
        })
        setCwRows(merged)
      }).catch(() => setCwError('Failed to load classwise fees.'))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwLoadKey])

  function updateCw(feesCode, field, val) {
    setCwRows(rs => rs.map(r => r.fees_code === feesCode ? { ...r, [field]: val } : r))
  }

  async function saveCw() {
    cwSavingRef.current = true
    setCwSaving(true); setCwError(''); setCwSuccess('')
    try {
      const selected = cwRows.filter(r => r.selected)
      const toDelete = cwRows.filter(r => !r.selected && r._existsInDb)

      if (selected.length) {
        await saveClasswiseFees(collegeId, {
          faculty_master_id: cwSelFac,
          year_level:        cwSelYear,
          student_type:      cwSelType,
          academic_year:     cwSelAY,
          rows: selected.map(r => {
            const catAmounts = {}
            effectiveCats.forEach(c => {
              const v = r[`cat${c.slab_index}_amount`]
              catAmounts[`cat${c.slab_index}_amount`] = v !== '' && v != null ? parseFloat(v) : null
            })
            return { fees_code: r.fees_code, ...catAmounts }
          }),
        })
      }

      for (const r of toDelete) {
        await deleteClasswiseFee(collegeId, {
          faculty_master_id: cwSelFac,
          year_level:        cwSelYear,
          student_type:      cwSelType,
          academic_year:     cwSelAY,
          fees_code:         r.fees_code,
        })
      }

      // Re-fetch from server to get ground truth, then update rows.
      // Keep cwSavingRef.current = true until after setCwRows so the useEffect
      // re-render triggered by state change doesn't race and overwrite our result.
      const cwRes = await getClasswiseFeesLive(collegeId, cwSelFac, cwSelYear, cwSelType, cwSelAY)
      const existing = cwRes.data.data || []
      setCwRows(prev => prev.map(r => {
        const ov = existing.find(e => e.fees_code === r.fees_code)
        const catAmounts = {}
        effectiveCats.forEach(c => {
          catAmounts[`cat${c.slab_index}_amount`] = ov?.[`cat${c.slab_index}_amount`] ?? ''
        })
        return { ...r, selected: !!ov, _existsInDb: !!ov, ...catAmounts }
      }))
      setCwSuccess('Saved successfully.')
    } catch (e) { setCwError(e?.response?.data?.message || 'Save failed.') }
    finally {
      setCwSaving(false)
      // Release the save guard after current render cycle so the useEffect
      // triggered by setCwRows above doesn't overwrite the fresh data.
      setTimeout(() => { cwSavingRef.current = false }, 0)
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <h2 className="text-lg font-semibold text-slate-800">Fees Master</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2 py-1 bg-white">
            <span className="text-xs text-slate-500 font-medium">Year:</span>
            <select value={selAY} onChange={e => { setSelAY(e.target.value); setCwSelAY(e.target.value) }}
              className="text-sm font-semibold text-slate-800 bg-transparent outline-none cursor-pointer">
              {AY_OPTIONS.map(ay => <option key={ay} value={ay}>{ay}</option>)}
            </select>
          </div>
          {activeTab === 'heads' && rw && AY_OPTIONS.indexOf(selAY) > 0 && (
            <button onClick={openPullModal}
              className="px-3 py-1.5 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50">
              ↓ Pull from {AY_OPTIONS[AY_OPTIONS.indexOf(selAY) - 1]}
            </button>
          )}
          {activeTab === 'heads' && rw && (
            <button onClick={openNew} className="px-3 py-1.5 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700">
              + New Fee Head
            </button>
          )}
          {activeTab === 'classwise' && (
            <button onClick={saveCw} disabled={cwSaving || cwHeadRows.length === 0}
              className="px-4 py-1.5 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50">
              {cwSaving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-slate-200">
        {[['heads', 'Fee Heads'], ['classwise', 'Classwise Fees']].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition -mb-px ${
              activeTab === key
                ? 'border-slate-800 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Fee Heads Tab ── */}
      {activeTab === 'heads' && (
        <>
          {loading ? <SkeletonTable rows={4} cols={4} /> : (
            <>
              <div className="hidden sm:block overflow-x-auto border border-slate-300">
                <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={dragRows.map(r => r.fees_code)} strategy={verticalListSortingStrategy}>
                    <table className="w-full text-sm border-collapse">
                      <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wide border-b border-slate-300">
                        <tr>
                          {rw && <th className="px-2 py-1 w-8 border-r border-slate-200" />}
                          <FMTh col="sequence_auto_fees" label="Seq"      align="left"   sortCol={sortCol} sortDir={sortDir} onSort={toggleSortFM} className="w-8" />
                          <FMTh col="fees_head"          label="Fees Head" align="left"  sortCol={sortCol} sortDir={sortDir} onSort={toggleSortFM} />
                          <FMTh col="short_name"         label="Short"    align="left"   sortCol={sortCol} sortDir={sortDir} onSort={toggleSortFM} className="w-20" />
                          <FMTh col="fees_type"          label="Type"     align="center" sortCol={sortCol} sortDir={sortDir} onSort={toggleSortFM} className="w-20" />
                          <th className="px-3 py-1 text-center w-20 border-r border-slate-200">Refund.</th>
                          <FMTh col="is_active"          label="Status"   align="center" sortCol={sortCol} sortDir={sortDir} onSort={toggleSortFM} className="w-16" />
                          <th className="px-3 py-1 w-20 border-r border-slate-200" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {dragRows.length === 0 && (
                          <tr><td colSpan={rw ? 8 : 7} className="px-4 py-8 text-center text-slate-500">
                            No fee heads configured for {selAY}.
                          </td></tr>
                        )}
                        {dragRows.map(r => (
                          <SortableFMRow key={r.fees_code} row={r} rw={rw} onEdit={openEdit} onDelete={softDelete} dragging={dragging} />
                        ))}
                      </tbody>
                    </table>
                  </SortableContext>
                </DndContext>
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
        </>
      )}

      {/* ── Classwise Fees Tab ── */}
      {activeTab === 'classwise' && (
        <div>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-4 pb-4 border-b border-slate-200">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500">Academic Year</label>
              <select value={cwSelAY} onChange={e => { setCwSelAY(e.target.value); setSelAY(e.target.value); setCwSuccess('') }}
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

          {cwError   && <p className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{cwError}</p>}
          {cwSuccess && <p className="mb-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{cwSuccess}</p>}

          {feesCategories === null ? (
            <SkeletonTable rows={4} cols={3} />
          ) : cwHeadRows.length === 0 ? (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              No fee heads configured for <strong>{cwSelAY}</strong>. Add heads in the Fee Heads tab first.
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-400 mb-3">Check a fee head to include it for this class. Leave amounts blank to use the base Fees Master amount.</p>
              <div className="overflow-x-auto border border-slate-300">
                <table className="w-full text-sm border-collapse min-w-[640px]">
                  <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-300">
                    <tr>
                      <th className="px-3 py-1 text-center w-10 border-r border-slate-200">
                        <input
                          type="checkbox"
                          title="Select all"
                          checked={cwRows.length > 0 && cwRows.every(r => r.selected)}
                          onChange={e => setCwRows(rs => rs.map(r => ({ ...r, selected: e.target.checked })))}
                          className="accent-slate-700"
                        />
                      </th>
                      <th className="px-3 py-1 text-left border-r border-slate-200">Fee Head</th>
                      {effectiveCats.map(c => (
                        <th key={c.slab_index} className="px-3 py-1 text-center whitespace-nowrap border-r border-slate-200">
                          {`Cat ${c.slab_index}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {cwRows.map(r => (
                      <tr key={r.fees_code} className={`transition ${r.selected ? 'hover:bg-blue-50' : 'opacity-40'}`}>
                        <td className="px-3 py-1 text-center border-r border-slate-200">
                          <input type="checkbox" checked={!!r.selected}
                            onChange={e => updateCw(r.fees_code, 'selected', e.target.checked)}
                            className="accent-slate-700" />
                        </td>
                        <td className="px-3 py-1 border-r border-slate-200">
                          <p className="font-medium text-slate-900">{r.fees_head}</p>
                          <p className="text-xs text-slate-400">{r.short_name}</p>
                        </td>
                        {effectiveCats.map(c => (
                          <td key={c.slab_index} className="px-3 py-1 text-center border-r border-slate-200">
                            <input
                              type="number" step="0.01"
                              value={r[`cat${c.slab_index}_amount`] ?? ''}
                              onChange={e => updateCw(r.fees_code, `cat${c.slab_index}_amount`, e.target.value)}
                              placeholder="—"
                              disabled={!r.selected}
                              className="w-24 border border-slate-200 rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-slate-300 disabled:bg-slate-50 disabled:cursor-not-allowed"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals bar */}
              {cwRows.length > 0 && (
                <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 flex flex-wrap gap-x-6 gap-y-1 items-center">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wide mr-2">Total (selected)</span>
                  {effectiveCats.map(c => {
                    const total = cwRows
                      .filter(r => r.selected)
                      .reduce((sum, r) => {
                        const ov = r[`cat${c.slab_index}_amount`]
                        return sum + (ov !== '' && ov != null ? parseFloat(ov) || 0 : 0)
                      }, 0)
                    return (
                      <div key={c.slab_index} className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-400">{`Cat ${c.slab_index}`}:</span>
                        <span className="text-xs font-bold font-mono text-slate-800">₹{total.toLocaleString('en-IN')}</span>
                      </div>
                    )
                  })}
                  <span className="ml-auto text-xs text-slate-400">
                    {cwRows.filter(r => r.selected).length} of {cwRows.length} selected
                  </span>
                </div>
              )}

              {/* Category legend — castes & special statuses per cat */}
              {effectiveCats.length > 0 && catMasterData && (
                <div className="mt-3 flex flex-wrap gap-3">
                  {effectiveCats.map(c => {
                    const casteNames = (catMasterData.casteMappings || [])
                      .filter(m => m.fees_category_id === c.id)
                      .map(m => (catMasterData.castes || []).find(cs => cs.id === m.caste_id)?.caste_name)
                      .filter(Boolean)
                    const statusNames = (catMasterData.statusMappings || [])
                      .filter(m => m.fees_category_id === c.id)
                      .map(m => (catMasterData.specialStatuses || []).find(ss => ss.id === m.special_status_id)?.status_name)
                      .filter(Boolean)
                    const all = [...casteNames, ...statusNames]
                    return (
                      <span key={c.slab_index} className="text-xs text-slate-400">
                        <span className="font-semibold text-slate-600">{`Cat ${c.slab_index}`}:</span>{' '}
                        {all.length > 0 ? all.join(', ') : <span className="italic">—</span>}
                      </span>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

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

              <F label="Academic Year *">
                <select value={form.academic_year} onChange={e => set('academic_year', e.target.value)} className={inp}>
                  {AY_OPTIONS.map(ay => <option key={ay} value={ay}>{ay}</option>)}
                </select>
              </F>

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

              {['Misc', 'ExamFees'].includes(form.fees_type) && (
                <F label="Amount (₹)">
                  <input
                    type="number" min="0" step="0.01"
                    value={form.fees_cat1_amount}
                    onChange={e => set('fees_cat1_amount', e.target.value)}
                    className={inp}
                    placeholder="0.00"
                  />
                </F>
              )}

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

      {/* Pull from Previous Year Modal */}
      {pullModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="font-semibold text-slate-800">Pull from {pullModal.prevAY}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Select fee heads to copy into {selAY}</p>
              </div>
              <button onClick={() => setPullModal(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4">
              <table className="w-full text-sm">
                <thead className="text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200">
                  <tr>
                    <th className="pb-2 text-center w-10 border-r border-slate-200">
                      <input
                        type="checkbox"
                        checked={pullModal.toCopy.length > 0 && pullModal.selected.size === pullModal.toCopy.length}
                        onChange={e => toggleAllPull(e.target.checked)}
                        className="accent-slate-700"
                      />
                    </th>
                    <th className="pb-2 text-left border-r border-slate-200">Fee Head</th>
                    <th className="pb-2 text-center w-20">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pullModal.toCopy.map(r => (
                    <tr key={r.fees_code} className={`transition ${pullModal.selected.has(r.fees_code) ? '' : 'opacity-40'}`}>
                      <td className="py-2 text-center border-r border-slate-200">
                        <input type="checkbox" checked={pullModal.selected.has(r.fees_code)}
                          onChange={() => togglePullRow(r.fees_code)} className="accent-slate-700" />
                      </td>
                      <td className="py-2 border-r border-slate-200">
                        <p className="font-medium text-slate-800">{r.fees_head}</p>
                        <p className="text-xs text-slate-400">{r.short_name}</p>
                      </td>
                      <td className="py-2 text-center">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{r.fees_type}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 shrink-0">
              <span className="text-xs text-slate-400">{pullModal.selected.size} of {pullModal.toCopy.length} selected</span>
              <div className="flex gap-3">
                <button onClick={() => setPullModal(null)} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
                <button onClick={confirmPull} disabled={pullSaving || pullModal.selected.size === 0}
                  className="px-5 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50">
                  {pullSaving ? 'Copying…' : `Copy ${pullModal.selected.size} Head(s)`}
                </button>
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
        <td className="px-2 py-1 text-center w-8 border-r border-slate-200">
          <span {...attributes} {...listeners}
            className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 select-none text-lg leading-none"
            title="Drag to reorder">⠿</span>
        </td>
      )}
      <td className="px-3 py-1 text-slate-500 text-center border-r border-slate-200">{r.sequence_auto_fees}</td>
      <td className="px-3 py-1 border-r border-slate-200">
        <p className="font-medium text-slate-900">{r.fees_head}</p>
        {r.bank_name && <p className="text-xs text-slate-400">{r.bank_name}</p>}
      </td>
      <td className="px-3 py-1 text-slate-700 text-xs border-r border-slate-200">{r.short_name}</td>
      <td className="px-3 py-1 text-center border-r border-slate-200">
        <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{r.fees_type}</span>
        {r.is_other_misc ? <span className="ml-1 text-xs text-amber-500">Misc</span> : null}
      </td>
      <td className="px-3 py-1 text-center border-r border-slate-200">
        {r.is_refundable ? <span className="text-green-600 text-xs font-medium">Yes</span> : <span className="text-slate-300 text-xs">No</span>}
      </td>
      <td className="px-3 py-1 text-center border-r border-slate-200">
        <span className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
          {r.is_active ? 'Active' : 'Off'}
        </span>
      </td>
      <td className="px-3 py-1 text-right space-x-3 whitespace-nowrap">
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
      className={`px-3 py-1 text-${align} cursor-pointer select-none text-xs font-bold uppercase tracking-wide text-slate-600 hover:text-slate-900 transition border-r border-slate-200 ${className}`}
      onClick={() => onSort(col)}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'ml-auto' : ''}`}>
        {label}
        <span className="text-slate-300">{active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
      </span>
    </th>
  )
}
