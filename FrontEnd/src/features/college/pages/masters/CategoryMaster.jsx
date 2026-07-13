import { useEffect, useState } from 'react'
import { usePermissions } from '../../hooks/usePermissions.js'
import { useCollegeFeatures } from '../../hooks/useCollegeFeatures.js'
import { useToast } from '../../../../context/ToastContext.jsx'
import { getErrorMessage } from '../../../../shared/hooks/useNetworkError.js'
import {
  getCategoryMaster,
  createCaste, updateCaste, deleteCaste,
  createSpecialStatus, updateSpecialStatus, deleteSpecialStatus,
  createFeesCategory, updateFeesCategory, deleteFeesCategory,
} from '../../../../services/masterService.js'

const SLAB_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8]

const inp = 'w-full border border-slate-200 rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300'

export default function CategoryMaster({ collegeId }) {
  const { canWrite } = usePermissions()
  const rw           = canWrite('masters')
  const toast        = useToast()
  // Fees categories only exist to price the college fee. A college that does not
  // charge one (agriculture) has no use for the tab.
  const { collegeFeeEnabled } = useCollegeFeatures(collegeId)

  const [master, setMaster]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('castes')

  const TABS = [
    { key: 'castes',   label: 'Castes' },
    { key: 'statuses', label: 'Special Statuses' },
    ...(collegeFeeEnabled ? [{ key: 'fees', label: 'Fees Categories' }] : []),
  ]

  // Never leave the user stranded on a tab that no longer exists.
  const activeTab = TABS.some(t => t.key === tab) ? tab : 'castes'

  function load() {
    setLoading(true)
    getCategoryMaster(collegeId)
      .then(r => setMaster(r.data.data))
      .catch(() => toast.error('Failed to load category master.'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [collegeId])

  if (loading) return <div className="p-6 text-sm text-slate-400">Loading category master…</div>
  if (!master)  return <div className="p-6 text-sm text-red-500">Failed to load.</div>

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-800">Category Master</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${
              activeTab === t.key
                ? 'border-slate-800 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'castes'   && <CastesTab   master={master} collegeId={collegeId} rw={rw} onReload={load} toast={toast} collegeFeeEnabled={collegeFeeEnabled} />}
      {activeTab === 'statuses' && <StatusesTab master={master} collegeId={collegeId} rw={rw} onReload={load} toast={toast} collegeFeeEnabled={collegeFeeEnabled} />}
      {activeTab === 'fees'     && <FeesCatsTab master={master} collegeId={collegeId} rw={rw} onReload={load} toast={toast} />}
    </div>
  )
}

// ── Castes Tab ────────────────────────────────────────────────
function CastesTab({ master, collegeId, rw, onReload, toast, collegeFeeEnabled = true }) {
  const [modal, setModal] = useState(null) // null | 'new' | row
  const [form, setForm]   = useState({ caste_name: '', is_gen_type: false, display_order: 1 })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  // Which fees category each caste belongs to (for display)
  function feesCatForCaste(casteId) {
    const map = master.casteMappings.find(m => m.caste_id === casteId)
    if (!map) return null
    return master.feesCategories.find(f => f.id === map.fees_category_id)
  }

  function openNew() { setForm({ caste_name: '', is_gen_type: false, display_order: (master.castes.length + 1) }); setModal('new'); setError('') }
  function openEdit(r) { setForm({ caste_name: r.caste_name, is_gen_type: !!r.is_gen_type, display_order: r.display_order }); setModal(r); setError('') }

  async function save() {
    if (!form.caste_name.trim()) { setError('Caste name is required.'); return }
    setSaving(true); setError('')
    try {
      if (modal === 'new') await createCaste(collegeId, form)
      else await updateCaste(collegeId, modal.id, form)
      setModal(null); onReload()
    } catch (e) { setError(getErrorMessage(e, 'Save failed.')) }
    finally { setSaving(false) }
  }

  async function softDelete(row) {
    if (!confirm(`Deactivate caste "${row.caste_name}"?`)) return
    try { await deleteCaste(collegeId, row.id); onReload() }
    catch { toast.error('Failed to deactivate.') }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="text-xs text-slate-500">{master.castes.filter(c => c.is_active).length} active castes</p>
        {rw && <button onClick={openNew} className="px-3 py-1.5 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700">+ Add Caste</button>}
      </div>

      <div className="border border-slate-300 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600 border-b border-slate-300">
            <tr>
              <th className="px-3 py-1 text-center w-12 border-r border-slate-200">Order</th>
              <th className="px-3 py-1 text-left border-r border-slate-200">Caste Name</th>
              <th className="px-3 py-1 text-center w-20 border-r border-slate-200">Gen. Type</th>
              {collegeFeeEnabled && <th className="px-3 py-1 text-left border-r border-slate-200">Fees Category</th>}
              <th className="px-3 py-1 text-center w-16 border-r border-slate-200">Status</th>
              {rw && <th className="px-3 py-1 w-20" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {master.castes.length === 0 && (
              <tr><td colSpan={(collegeFeeEnabled ? 5 : 4) + (rw ? 1 : 0)} className="px-4 py-6 text-center text-slate-400">No castes configured yet.</td></tr>
            )}
            {master.castes.map(r => {
              const fc = feesCatForCaste(r.id)
              return (
                <tr key={r.id} className={`hover:bg-blue-50 transition ${!r.is_active ? 'opacity-40' : ''}`}>
                  <td className="px-3 py-1 text-center text-slate-500 border-r border-slate-200">{r.display_order}</td>
                  <td className="px-3 py-1 font-medium text-slate-900 border-r border-slate-200">{r.caste_name}</td>
                  <td className="px-3 py-1 text-center border-r border-slate-200">
                    {r.is_gen_type ? <span className="text-xs bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5 font-semibold">Gen.</span> : <span className="text-slate-300">—</span>}
                  </td>
                  {collegeFeeEnabled && (
                    <td className="px-3 py-1 border-r border-slate-200">
                      {fc ? <span className="text-xs bg-slate-100 text-slate-700 rounded-full px-2 py-0.5">{fc.category_name}</span> : <span className="text-xs text-slate-400">Not mapped</span>}
                    </td>
                  )}
                  <td className="px-3 py-1 text-center border-r border-slate-200">
                    <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {r.is_active ? 'Active' : 'Off'}
                    </span>
                  </td>
                  {rw && (
                    <td className="px-3 py-1 text-right space-x-2 whitespace-nowrap">
                      <button onClick={() => openEdit(r)} className="text-xs font-medium text-slate-500 hover:text-slate-800 underline">Edit</button>
                      {r.is_active && <button onClick={() => softDelete(r)} className="text-xs font-medium text-red-400 hover:text-red-600 underline">Off</button>}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === 'new' ? 'Add Caste' : 'Edit Caste'} onClose={() => setModal(null)}>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1">{error}</p>}
          <F label="Caste Name *"><input value={form.caste_name} onChange={e => setForm(f => ({ ...f, caste_name: e.target.value }))} className={inp} placeholder="e.g. SC" /></F>
          <F label="Display Order"><input type="number" value={form.display_order} onChange={e => setForm(f => ({ ...f, display_order: parseInt(e.target.value) || 1 }))} className={inp} /></F>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={!!form.is_gen_type} onChange={e => setForm(f => ({ ...f, is_gen_type: e.target.checked }))} className="accent-slate-700" />
            General / Open category <span className="text-xs text-slate-400">(special status only applies to this caste)</span>
          </label>
          <ModalFooter onClose={() => setModal(null)} onSave={save} saving={saving} />
        </Modal>
      )}
    </div>
  )
}

// ── Special Statuses Tab ──────────────────────────────────────
function StatusesTab({ master, collegeId, rw, onReload, toast, collegeFeeEnabled = true }) {
  const [modal, setModal]   = useState(null)
  const [form, setForm]     = useState({ status_name: '', display_order: 1 })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function feesCatForStatus(statusId) {
    const map = master.statusMappings.find(m => m.special_status_id === statusId)
    if (!map) return null
    return master.feesCategories.find(f => f.id === map.fees_category_id)
  }

  function openNew() { setForm({ status_name: '', display_order: master.specialStatuses.length + 1 }); setModal('new'); setError('') }
  function openEdit(r) { setForm({ status_name: r.status_name, display_order: r.display_order }); setModal(r); setError('') }

  async function save() {
    if (!form.status_name.trim()) { setError('Status name is required.'); return }
    setSaving(true); setError('')
    try {
      if (modal === 'new') await createSpecialStatus(collegeId, form)
      else await updateSpecialStatus(collegeId, modal.id, form)
      setModal(null); onReload()
    } catch (e) { setError(getErrorMessage(e, 'Save failed.')) }
    finally { setSaving(false) }
  }

  async function softDelete(row) {
    if (!confirm(`Deactivate status "${row.status_name}"?`)) return
    try { await deleteSpecialStatus(collegeId, row.id); onReload() }
    catch { toast.error('Failed to deactivate.') }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="text-xs text-slate-500">{master.specialStatuses.filter(s => s.is_active).length} active statuses</p>
        {rw && <button onClick={openNew} className="px-3 py-1.5 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700">+ Add Status</button>}
      </div>

      <div className="border border-slate-300 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600 border-b border-slate-300">
            <tr>
              <th className="px-3 py-1 text-center w-12 border-r border-slate-200">Order</th>
              <th className="px-3 py-1 text-left border-r border-slate-200">Status Name</th>
              {collegeFeeEnabled && <th className="px-3 py-1 text-left border-r border-slate-200">Fees Category</th>}
              <th className="px-3 py-1 text-center w-16 border-r border-slate-200">Status</th>
              {rw && <th className="px-3 py-1 w-20" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {master.specialStatuses.length === 0 && (
              <tr><td colSpan={(collegeFeeEnabled ? 4 : 3) + (rw ? 1 : 0)} className="px-4 py-6 text-center text-slate-400">No special statuses configured yet.</td></tr>
            )}
            {master.specialStatuses.map(r => {
              const fc = feesCatForStatus(r.id)
              return (
                <tr key={r.id} className={`hover:bg-blue-50 transition ${!r.is_active ? 'opacity-40' : ''}`}>
                  <td className="px-3 py-1 text-center text-slate-500 border-r border-slate-200">{r.display_order}</td>
                  <td className="px-3 py-1 font-medium text-slate-900 border-r border-slate-200">{r.status_name}</td>
                  {collegeFeeEnabled && (
                    <td className="px-3 py-1 border-r border-slate-200">
                      {fc ? <span className="text-xs bg-slate-100 text-slate-700 rounded-full px-2 py-0.5">{fc.category_name}</span> : <span className="text-xs text-slate-400">Not mapped</span>}
                    </td>
                  )}
                  <td className="px-3 py-1 text-center border-r border-slate-200">
                    <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {r.is_active ? 'Active' : 'Off'}
                    </span>
                  </td>
                  {rw && (
                    <td className="px-3 py-1 text-right space-x-2 whitespace-nowrap">
                      <button onClick={() => openEdit(r)} className="text-xs font-medium text-slate-500 hover:text-slate-800 underline">Edit</button>
                      {r.is_active && <button onClick={() => softDelete(r)} className="text-xs font-medium text-red-400 hover:text-red-600 underline">Off</button>}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === 'new' ? 'Add Special Status' : 'Edit Special Status'} onClose={() => setModal(null)}>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1">{error}</p>}
          <F label="Status Name *"><input value={form.status_name} onChange={e => setForm(f => ({ ...f, status_name: e.target.value }))} className={inp} placeholder="e.g. EBC" /></F>
          <F label="Display Order"><input type="number" value={form.display_order} onChange={e => setForm(f => ({ ...f, display_order: parseInt(e.target.value) || 1 }))} className={inp} /></F>
          <ModalFooter onClose={() => setModal(null)} onSave={save} saving={saving} />
        </Modal>
      )}
    </div>
  )
}

// ── Fees Categories Tab ───────────────────────────────────────
function FeesCatsTab({ master, collegeId, rw, onReload, toast }) {
  const EMPTY_FORM = { category_name: '', slab_index: '', display_order: 1, caste_ids: [], special_status_ids: [] }
  const [modal, setModal]   = useState(null)
  const [form, setForm]     = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  // Castes mapped to a given fees category
  function castesForFc(fcId) {
    return master.casteMappings.filter(m => m.fees_category_id === fcId).map(m => master.castes.find(c => c.id === m.caste_id)).filter(Boolean)
  }
  function statusesForFc(fcId) {
    return master.statusMappings.filter(m => m.fees_category_id === fcId).map(m => master.specialStatuses.find(s => s.id === m.special_status_id)).filter(Boolean)
  }

  // Used category indexes (excluding current modal's own index)
  const usedSlabs = master.feesCategories.filter(f => f.is_active && (!modal || modal === 'new' || f.id !== modal.id)).map(f => f.slab_index)

  function openNew() {
    const nextOrder = master.feesCategories.length + 1
    const nextSlab  = SLAB_OPTIONS.find(s => !master.feesCategories.some(f => f.slab_index === s)) || ''
    setForm({ ...EMPTY_FORM, display_order: nextOrder, slab_index: nextSlab })
    setModal('new'); setError('')
  }

  function openEdit(r) {
    setForm({
      category_name:      r.category_name,
      slab_index:         r.slab_index,
      display_order:      r.display_order,
      caste_ids:          master.casteMappings.filter(m => m.fees_category_id === r.id).map(m => m.caste_id),
      special_status_ids: master.statusMappings.filter(m => m.fees_category_id === r.id).map(m => m.special_status_id),
    })
    setModal(r); setError('')
  }

  function toggleCaste(id) {
    setForm(f => ({ ...f, caste_ids: f.caste_ids.includes(id) ? f.caste_ids.filter(x => x !== id) : [...f.caste_ids, id] }))
  }
  function toggleStatus(id) {
    setForm(f => ({ ...f, special_status_ids: f.special_status_ids.includes(id) ? f.special_status_ids.filter(x => x !== id) : [...f.special_status_ids, id] }))
  }

  async function save() {
    if (!form.category_name.trim()) { setError('Category name is required.'); return }
    if (!form.slab_index) { setError('Category index is required.'); return }
    setSaving(true); setError('')
    try {
      if (modal === 'new') await createFeesCategory(collegeId, form)
      else await updateFeesCategory(collegeId, modal.id, form)
      setModal(null); onReload()
    } catch (e) { setError(getErrorMessage(e, 'Save failed.')) }
    finally { setSaving(false) }
  }

  async function softDelete(row) {
    if (!confirm(`Deactivate fees category "${row.category_name}"?`)) return
    try { await deleteFeesCategory(collegeId, row.id); onReload() }
    catch { toast.error('Failed to deactivate.') }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="text-xs text-slate-500">{master.feesCategories.filter(f => f.is_active).length} active categories (max 8 category indexes)</p>
        {rw && <button onClick={openNew} disabled={master.feesCategories.filter(f => f.is_active).length >= 8}
          className="px-3 py-1.5 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-40">
          + Add Category
        </button>}
      </div>

      <div className="border border-slate-300 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600 border-b border-slate-300">
            <tr>
              <th className="px-3 py-1 text-center w-14 border-r border-slate-200">Cat. Index</th>
              <th className="px-3 py-1 text-left border-r border-slate-200">Category Name</th>
              <th className="px-3 py-1 text-left border-r border-slate-200">Mapped Castes</th>
              <th className="px-3 py-1 text-left border-r border-slate-200">Mapped Statuses</th>
              <th className="px-3 py-1 text-center w-16 border-r border-slate-200">Status</th>
              {rw && <th className="px-3 py-1 w-20" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {master.feesCategories.length === 0 && (
              <tr><td colSpan={rw ? 6 : 5} className="px-4 py-6 text-center text-slate-400">No fees categories configured yet.</td></tr>
            )}
            {master.feesCategories.map(r => {
              const mappedCastes   = castesForFc(r.id)
              const mappedStatuses = statusesForFc(r.id)
              return (
                <tr key={r.id} className={`hover:bg-blue-50 transition ${!r.is_active ? 'opacity-40' : ''}`}>
                  <td className="px-3 py-1 text-center border-r border-slate-200">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-800 text-white text-xs font-bold">{r.slab_index}</span>
                  </td>
                  <td className="px-3 py-1 font-semibold text-slate-900 border-r border-slate-200">{r.category_name}</td>
                  <td className="px-3 py-1 border-r border-slate-200">
                    <div className="flex flex-wrap gap-1">
                      {mappedCastes.length === 0 ? <span className="text-xs text-slate-400">—</span> :
                        mappedCastes.map(c => <span key={c.id} className="text-xs bg-slate-100 text-slate-700 rounded px-1.5 py-0.5">{c.caste_name}</span>)}
                    </div>
                  </td>
                  <td className="px-3 py-1 border-r border-slate-200">
                    <div className="flex flex-wrap gap-1">
                      {mappedStatuses.length === 0 ? <span className="text-xs text-slate-400">—</span> :
                        mappedStatuses.map(s => <span key={s.id} className="text-xs bg-indigo-50 text-indigo-700 rounded px-1.5 py-0.5">{s.status_name}</span>)}
                    </div>
                  </td>
                  <td className="px-3 py-1 text-center border-r border-slate-200">
                    <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {r.is_active ? 'Active' : 'Off'}
                    </span>
                  </td>
                  {rw && (
                    <td className="px-3 py-1 text-right space-x-2 whitespace-nowrap">
                      <button onClick={() => openEdit(r)} className="text-xs font-medium text-slate-500 hover:text-slate-800 underline">Edit</button>
                      {r.is_active && <button onClick={() => softDelete(r)} className="text-xs font-medium text-red-400 hover:text-red-600 underline">Off</button>}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Edit / New Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <h3 className="font-semibold text-slate-800">{modal === 'new' ? 'New Fees Category' : `Edit — ${modal.category_name}`}</h3>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1">{error}</p>}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <F label="Category Name *">
                  <input value={form.category_name} onChange={e => setForm(f => ({ ...f, category_name: e.target.value }))} className={inp} placeholder="e.g. BCC" />
                </F>
                <F label="Category Index (1–8) *">
                  <select value={form.slab_index} onChange={e => setForm(f => ({ ...f, slab_index: parseInt(e.target.value) }))} className={inp}>
                    <option value="">— Select index —</option>
                    {SLAB_OPTIONS.map(s => (
                      <option key={s} value={s} disabled={usedSlabs.includes(s)}>Cat-{s}{usedSlabs.includes(s) ? ' (in use)' : ''}</option>
                    ))}
                  </select>
                </F>
                <F label="Display Order">
                  <input type="number" value={form.display_order} onChange={e => setForm(f => ({ ...f, display_order: parseInt(e.target.value) || 1 }))} className={inp} />
                </F>
              </div>

              {/* Caste mapping */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Mapped Castes</p>
                <p className="text-xs text-slate-400 mb-2">Students with these castes will be assigned this fees category.</p>
                <div className="flex flex-wrap gap-2">
                  {master.castes.filter(c => c.is_active).map(c => (
                    <label key={c.id} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={form.caste_ids.includes(c.id)}
                        onChange={() => toggleCaste(c.id)} className="accent-slate-700" />
                      <span className={`text-sm px-2 py-0.5 rounded border transition select-none ${
                        form.caste_ids.includes(c.id)
                          ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}>{c.caste_name}</span>
                    </label>
                  ))}
                  {master.castes.filter(c => c.is_active).length === 0 && <p className="text-xs text-slate-400">No castes defined yet.</p>}
                </div>
              </div>

              {/* Special status mapping */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Mapped Special Statuses</p>
                <p className="text-xs text-slate-400 mb-2">Students with these special statuses will be assigned this fees category (overrides caste mapping).</p>
                <div className="flex flex-wrap gap-2">
                  {master.specialStatuses.filter(s => s.is_active).map(s => (
                    <label key={s.id} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={form.special_status_ids.includes(s.id)}
                        onChange={() => toggleStatus(s.id)} className="accent-slate-700" />
                      <span className={`text-sm px-2 py-0.5 rounded border transition select-none ${
                        form.special_status_ids.includes(s.id)
                          ? 'bg-indigo-700 text-white border-indigo-700 font-semibold'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}>{s.status_name}</span>
                    </label>
                  ))}
                  {master.specialStatuses.filter(s => s.is_active).length === 0 && <p className="text-xs text-slate-400">No special statuses defined yet.</p>}
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

// ── Shared helpers ────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-5 space-y-4">{children}</div>
      </div>
    </div>
  )
}

function ModalFooter({ onClose, onSave, saving }) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
      <button onClick={onSave} disabled={saving} className="px-5 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50">
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}

function F({ label, children }) {
  return <div className="flex flex-col gap-1"><label className="text-xs font-semibold text-slate-600">{label}</label>{children}</div>
}
