import { useEffect, useState } from 'react'
import api from '../../../../services/api.js'

const EMPTY = { bank_account_number: '', bank_name: '', branch: '', ifsc_code: '', account_type: 'Savings', is_active: true }

export default function BankMaster({ collegeId }) {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(null)
  const [form, setForm]       = useState(EMPTY)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  function load() {
    setLoading(true)
    api.get(`masters/${collegeId}/bank`)
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
    if (!form.bank_account_number.trim()) return setError('Account number is required.')
    if (!form.bank_name.trim())           return setError('Bank name is required.')
    setSaving(true); setError('')
    try {
      if (modal === 'new') await api.post(`masters/${collegeId}/bank`, form)
      else await api.put(`masters/${collegeId}/bank/${modal.ledger_code}`, form)
      closeModal(); load()
    } catch (e) { setError(e?.response?.data?.message || 'Save failed.') }
    finally { setSaving(false) }
  }

  async function softDelete(row) {
    if (!confirm(`Deactivate "${row.bank_name}"?`)) return
    try { await api.delete(`masters/${collegeId}/bank/${row.ledger_code}`); load() }
    catch { alert('Failed.') }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="text-lg font-semibold text-slate-800">Bank Master</h2>
        <button onClick={openNew} className="shrink-0 px-3 py-1.5 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700">+ New</button>
      </div>

      {loading ? <p className="text-sm text-slate-400">Loading…</p> : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Bank Name</th>
                  <th className="px-4 py-3 text-left">Account No.</th>
                  <th className="px-4 py-3 text-left">Branch</th>
                  <th className="px-4 py-3 text-left">IFSC</th>
                  <th className="px-4 py-3 text-center">Type</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No bank accounts configured.</td></tr>}
                {rows.map(r => (
                  <tr key={r.ledger_code} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{r.bank_name}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{r.bank_account_number}</td>
                    <td className="px-4 py-3 text-slate-500">{r.branch || '—'}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{r.ifsc_code || '—'}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{r.account_type || '—'}</td>
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
            {rows.length === 0 && <p className="text-center text-slate-400 py-8 text-sm">No bank accounts configured.</p>}
            {rows.map(r => (
              <div key={r.ledger_code} className="border border-slate-100 rounded-xl p-4 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">{r.bank_name}</p>
                    <p className="font-mono text-sm text-slate-600 mt-0.5 truncate">{r.bank_account_number}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {r.branch || '—'} · IFSC: {r.ifsc_code || '—'} · {r.account_type || '—'}
                    </p>
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

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">{modal === 'new' ? 'New Bank Account' : 'Edit Bank Account'}</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-3">
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
              <F label="Bank Name *"><input value={form.bank_name} onChange={e => set('bank_name', e.target.value)} className={inp} placeholder="State Bank of India" /></F>
              <F label="Account Number *"><input value={form.bank_account_number} onChange={e => set('bank_account_number', e.target.value)} className={inp} placeholder="012345678901" /></F>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <F label="Branch"><input value={form.branch} onChange={e => set('branch', e.target.value)} className={inp} placeholder="Vengurla" /></F>
                <F label="IFSC Code"><input value={form.ifsc_code} onChange={e => set('ifsc_code', e.target.value.toUpperCase())} className={inp} placeholder="SBIN0001234" /></F>
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
