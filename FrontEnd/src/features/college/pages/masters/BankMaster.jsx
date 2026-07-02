import { useEffect, useState, useMemo } from 'react'
import { getBankLedgers, createBankLedger, updateBankLedger, deleteBankLedger, masterCacheRead, masterCacheHas } from '../../../../services/masterService.js'
import { usePermissions } from '../../hooks/usePermissions.js'
import { SkeletonTable } from '../../../../shared/components/Skeleton.jsx'
import { useToast } from '../../../../context/ToastContext.jsx'
import { getErrorMessage } from '../../../../shared/hooks/useNetworkError.js'

const EMPTY = { bank_account_number: '', bank_name: '', branch: '', ifsc_code: '', account_type: 'Savings', is_active: true }

export default function BankMaster({ collegeId }) {
  const { canWrite } = usePermissions()
  const rw = canWrite('masters')
  const toast = useToast()
  const [rows, setRows]       = useState(() => masterCacheRead(`bank:${collegeId}`)?.data?.data ?? [])
  const [loading, setLoading] = useState(() => !masterCacheRead(`bank:${collegeId}`))
  const [modal, setModal]     = useState(null)
  const [form, setForm]       = useState(EMPTY)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [sortCol, setSortCol] = useState('bank_name')
  const [sortDir, setSortDir] = useState('asc')
  function toggleSortBM(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    let av = a[sortCol], bv = b[sortCol]
    if (av == null) av = ''; if (bv == null) bv = ''
    const cmp = typeof av === 'boolean' || typeof bv === 'boolean'
      ? (av === bv ? 0 : av ? -1 : 1)
      : String(av).localeCompare(String(bv))
    return sortDir === 'asc' ? cmp : -cmp
  }), [rows, sortCol, sortDir])

  function load(silent = false) {
    const wasMiss = !masterCacheHas(`bank:${collegeId}`)
    if (!silent && wasMiss) setLoading(true)
    getBankLedgers(collegeId, r => setRows(r.data.data || []))
      .then(r => setRows(r.data.data || []))
      .catch(() => setError('Failed to load.'))
      .finally(() => { if (!silent && wasMiss) setLoading(false) })
  }
  useEffect(() => { load() }, [collegeId])

  function openNew()  { setForm(EMPTY); setModal('new'); setError('') }
  function openEdit(r){ setForm({ ...r }); setModal(r); setError('') }
  function closeModal(){ setModal(null) }
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function save() {
    if (!form.bank_account_number.trim()) return setError('Account number is required.')
    if (!form.bank_name.trim())           return setError('Bank name is required.')
    if (!form.ifsc_code.trim())           return setError('IFSC code is required.')
    setSaving(true); setError('')
    try {
      if (modal === 'new') await createBankLedger(collegeId, form)
      else await updateBankLedger(collegeId, modal.ledger_code, form)
      closeModal(); load(true)
    } catch (e) { setError(getErrorMessage(e, 'Save failed.')) }
    finally { setSaving(false) }
  }

  async function softDelete(row) {
    if (!confirm(`Deactivate "${row.bank_name}"?`)) return
    try { await deleteBankLedger(collegeId, row.ledger_code); load(true) }
    catch { toast.error('Failed.') }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="text-lg font-semibold text-slate-800">Bank Master</h2>
        {rw && <button onClick={openNew} className="shrink-0 px-3 py-1.5 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700">+ New</button>}
      </div>

      {loading ? <SkeletonTable rows={4} cols={3} /> : (
        <>
          {/* Desktop table — matches Program Master grid styling. */}
          <div className="hidden sm:block overflow-x-auto border border-slate-300">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wide border-b border-slate-300">
                <tr>
                  <MSTh col="bank_name"           label="Bank Name"   align="left"   sortCol={sortCol} sortDir={sortDir} onSort={toggleSortBM} />
                  <MSTh col="bank_account_number" label="Account No." align="left"   sortCol={sortCol} sortDir={sortDir} onSort={toggleSortBM} />
                  <MSTh col="branch"              label="Branch"      align="left"   sortCol={sortCol} sortDir={sortDir} onSort={toggleSortBM} />
                  <MSTh col="ifsc_code"           label="IFSC"        align="left"   sortCol={sortCol} sortDir={sortDir} onSort={toggleSortBM} />
                  <MSTh col="account_type"        label="Type"        align="center" sortCol={sortCol} sortDir={sortDir} onSort={toggleSortBM} />
                  <MSTh col="is_active"           label="Status"      align="center" sortCol={sortCol} sortDir={sortDir} onSort={toggleSortBM} />
                  <th className="px-3 py-1 border-r border-slate-200" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sorted.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No bank accounts configured.</td></tr>}
                {sorted.map(r => (
                  <tr key={r.ledger_code} className="hover:bg-blue-50 transition">
                    <td className="px-3 py-1 font-medium text-slate-900 border-r border-slate-200">{r.bank_name}</td>
                    <td className="px-3 py-1 font-mono text-slate-700 border-r border-slate-200">{r.bank_account_number}</td>
                    <td className="px-3 py-1 text-slate-700 border-r border-slate-200">{r.branch || '—'}</td>
                    <td className="px-3 py-1 font-mono text-slate-700 border-r border-slate-200">{r.ifsc_code || '—'}</td>
                    <td className="px-3 py-1 text-center text-slate-700 border-r border-slate-200">{r.account_type || '—'}</td>
                    <td className="px-3 py-1 text-center border-r border-slate-200">
                      <span className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {r.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-1 text-right space-x-3 whitespace-nowrap">
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
            {sorted.length === 0 && <p className="text-center text-slate-500 py-8 text-sm">No bank accounts configured.</p>}
            {sorted.map(r => (
              <div key={r.ledger_code} className="border-2 border-slate-400 rounded-lg p-4 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{r.bank_name}</p>
                    <p className="font-mono text-sm text-slate-700 mt-0.5 truncate">{r.bank_account_number}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {r.branch || '—'} · IFSC: {r.ifsc_code || '—'} · {r.account_type || '—'}
                    </p>
                  </div>
                  <span className={`shrink-0 inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {r.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex gap-3 mt-3">
                  <button onClick={() => openEdit(r)} className="text-xs font-medium text-slate-500 hover:text-slate-800 underline">Edit</button>
                  {r.is_active && <button onClick={() => softDelete(r)} className="text-xs font-medium text-red-400 hover:text-red-600 underline">Deactivate</button>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">{modal === 'new' ? 'New Bank Account' : 'Edit Bank Account'}</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-3">
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
              <F label="Bank Name *"><input value={form.bank_name} onChange={e => { const v = e.target.value; if (/^[a-zA-Z\s]*$/.test(v)) set('bank_name', v) }} className={inp} placeholder="State Bank of India" /></F>
              <F label="Account Number *"><input value={form.bank_account_number} onChange={e => { const v = e.target.value; if (/^\d*$/.test(v)) set('bank_account_number', v) }} className={inp} placeholder="012345678901" inputMode="numeric" /></F>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <F label="Branch"><input value={form.branch} onChange={e => set('branch', e.target.value)} className={inp} placeholder="Vengurla" /></F>
                <F label="IFSC Code *"><input value={form.ifsc_code} onChange={e => set('ifsc_code', e.target.value.toUpperCase())} className={inp} placeholder="SBIN0001234" /></F>
              </div>
              <F label="Account Type">
                <select value={form.account_type} onChange={e => set('account_type', e.target.value)} className={inp}>
                  <option value="Savings">Savings</option>
                  <option value="Current">Current</option>
                </select>
              </F>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={!!form.is_active} onChange={e => set('is_active', e.target.checked)} className="accent-slate-700" />
                Active
              </label>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={closeModal} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
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

function F({ label, children }) {
  return <div className="flex flex-col gap-1"><label className="text-xs font-semibold text-slate-600">{label}</label>{children}</div>
}
const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300'

function MSTh({ col, label, align = 'left', sortCol, sortDir, onSort }) {
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
