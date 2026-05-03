import { useEffect, useState } from 'react'
import api from '../../../services/api.js'
import Button from '../../../shared/components/Button.jsx'
import { usePermissions } from '../hooks/usePermissions.js'

const YEAR_LABEL = { 1: 'FY', 2: 'SY', 3: 'TY' }

export default function AdmissionPeriods({ collegeId }) {
  const { canWrite } = usePermissions()
  const rw = canWrite('masters')
  const [periods, setPeriods]   = useState([])
  const [courses, setCourses]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [form, setForm]         = useState({
    course_id: '', year_of_study: '1', academic_year: '2026-27',
    start_date: '', end_date: '', total_seats: '',
  })

  // Which period's installment editor is open
  const [editingInstallments, setEditingInstallments] = useState(null) // periodId

  function fetchData() {
    Promise.all([
      api.get(`college-admin/${collegeId}/admission-periods`),
      api.get(`masters/${collegeId}/faculty`),
    ])
      .then(([pRes, cRes]) => {
        setPeriods(pRes.data.data || [])
        setCourses((cRes.data.data || []).filter(f => f.is_active))
      })
      .catch(() => setError('Failed to load data.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [collegeId])

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      setError('End date must be on or after the start date.')
      return
    }
    setSaving(true)
    try {
      await api.post(`college-admin/${collegeId}/admission-periods`, form)
      setShowForm(false)
      setForm({ course_id: '', year_of_study: '1', academic_year: '2026-27', start_date: '', end_date: '', total_seats: '' })
      fetchData()
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to create period.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(period) {
    try {
      await api.put(`college-admin/${collegeId}/admission-periods/${period.id}`, { is_active: !period.is_active })
      fetchData()
    } catch {
      alert('Failed to update.')
    }
  }

  async function deletePeriod(period) {
    if (!confirm(`Delete "${period.course_name} — ${YEAR_LABEL[period.year_of_study]} · ${period.academic_year}"?\nThis cannot be undone.`)) return
    try {
      await api.delete(`college-admin/${collegeId}/admission-periods/${period.id}`)
      fetchData()
    } catch (err) {
      alert(err?.response?.data?.message || 'Delete failed.')
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">College portal</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Admission Periods</h1>
          <p className="mt-1 text-slate-600">Control when students can apply and set up fee installment plans.</p>
        </div>
        {rw && <Button onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ New Period'}
        </Button>}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-lg border border-blue-200 bg-blue-50 p-5 space-y-4 max-w-2xl">
          <p className="font-semibold text-slate-950">Create Admission Period</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Course</label>
              <select required value={form.course_id} onChange={e => setForm(f => ({ ...f, course_id: e.target.value }))}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm">
                <option value="">Select course…</option>
                {courses.map(c => <option key={c.code_no} value={c.code_no}>{c.degree_course_code} — {c.degree_course_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Year of Study</label>
              <select value={form.year_of_study} onChange={e => setForm(f => ({ ...f, year_of_study: e.target.value }))}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm">
                <option value="1">FY (First Year)</option>
                <option value="2">SY (Second Year)</option>
                <option value="3">TY (Third Year)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Academic Year</label>
              <input required value={form.academic_year} onChange={e => setForm(f => ({ ...f, academic_year: e.target.value }))}
                placeholder="2026-27" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Total Seats</label>
              <input required type="number" min="1" value={form.total_seats} onChange={e => setForm(f => ({ ...f, total_seats: e.target.value }))}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Start Date</label>
              <input required type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">End Date</label>
              <input required type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" loading={saving}>Create Period</Button>
        </form>
      )}

      {loading && <p className="text-slate-500">Loading…</p>}
      {!loading && periods.length === 0 && (
        <p className="text-slate-500">No admission periods configured yet.</p>
      )}

      <div className="space-y-4">
        {periods.map(p => (
          <div key={p.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {/* Period header row */}
            <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-950">
                  {p.course_name} — {YEAR_LABEL[p.year_of_study]} · {p.academic_year}
                </p>
                <p className="text-sm text-slate-500">
                  {new Date(p.start_date).toLocaleDateString('en-IN')} →{' '}
                  {new Date(p.end_date).toLocaleDateString('en-IN')} ·
                  Seats: {p.filled_seats}/{p.total_seats} ·
                  App fee: ₹{Number(p.application_fee).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${p.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {p.is_active ? 'Active' : 'Closed'}
                </span>
                {rw && <button onClick={() => toggleActive(p)} className="text-xs font-semibold text-blue-600 hover:underline">
                  {p.is_active ? 'Close' : 'Reopen'}
                </button>}
                {rw && <button onClick={() => deletePeriod(p)} className="text-xs font-semibold text-red-500 hover:underline">
                  Delete
                </button>}
                <button
                  onClick={() => setEditingInstallments(editingInstallments === p.id ? null : p.id)}
                  className="text-xs font-semibold text-indigo-600 hover:underline"
                >
                  {editingInstallments === p.id ? 'Hide Installments' : 'Fee Installments'}
                </button>
              </div>
            </div>

            {/* Installment plan editor */}
            {editingInstallments === p.id && (
              <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                <InstallmentEditor collegeId={collegeId} period={p} onClose={() => setEditingInstallments(null)} />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Installment plan editor ───────────────────────────────────
function InstallmentEditor({ collegeId, period, onClose }) {
  const { canWrite } = usePermissions()
  const rw = canWrite('masters')
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    api.get(`college-admin/${collegeId}/admission-periods/${period.id}/installments`)
      .then(r => {
        const data = r.data.data || []
        setRows(data.length > 0 ? data : [{ label: 'First Installment', amount: '', due_date: '' }])
      })
      .catch(() => setRows([{ label: 'First Installment', amount: '', due_date: '' }]))
      .finally(() => setLoading(false))
  }, [period.id, collegeId])

  function addRow() {
    const labels = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth']
    setRows(r => [...r, { label: `${labels[r.length] || (r.length + 1) + 'th'} Installment`, amount: '', due_date: '' }])
  }

  function removeRow(i) {
    setRows(r => r.filter((_, idx) => idx !== i))
  }

  function updateRow(i, field, value) {
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: value } : row))
  }

  const totalInstallments = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)

  async function handleSave() {
    setError('')
    setSuccess('')
    for (const row of rows) {
      if (!row.label.trim() || !row.amount || parseFloat(row.amount) <= 0) {
        setError('Each installment needs a label and a positive amount.')
        return
      }
    }
    setSaving(true)
    try {
      await api.post(`college-admin/${collegeId}/admission-periods/${period.id}/installments`, {
        installments: rows.map(r => ({
          label:    r.label.trim(),
          amount:   parseFloat(r.amount),
          due_date: r.due_date || null,
        })),
      })
      setSuccess('Installment plan saved.')
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    if (!confirm('Remove installment plan? Students will pay the full fee in one payment.')) return
    setSaving(true)
    try {
      await api.post(`college-admin/${collegeId}/admission-periods/${period.id}/installments`, { installments: [] })
      setRows([{ label: 'First Installment', amount: '', due_date: '' }])
      setSuccess('Installment plan cleared.')
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to clear.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>

  return (
    <div className="space-y-3 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-700">Fee Installment Plan</p>
        <p className="text-xs text-slate-400">
          If no plan is set, students pay the full college fee in one shot.
        </p>
      </div>

      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 w-4">{i + 1}.</span>
            <input
              value={row.label}
              onChange={e => updateRow(i, 'label', e.target.value)}
              placeholder="Label (e.g. First Installment)"
              className="flex-1 min-w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-sm">₹</span>
              <input
                type="number" min="1"
                value={row.amount}
                onChange={e => updateRow(i, 'amount', e.target.value)}
                placeholder="Amount"
                className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <input
              type="date"
              value={row.due_date || ''}
              onChange={e => updateRow(i, 'due_date', e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              title="Due date (optional)"
            />
            {rows.length > 1 && (
              <button onClick={() => removeRow(i)} className="text-red-400 hover:text-red-600 text-sm font-bold px-1">✕</button>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {rows.length < 6 && (
          <button onClick={addRow} className="text-sm text-indigo-600 hover:underline font-semibold">
            + Add installment
          </button>
        )}
        {totalInstallments > 0 && (
          <span className="text-xs text-slate-500">
            Total: ₹{totalInstallments.toLocaleString('en-IN')}
          </span>
        )}
      </div>

      {error   && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">{success}</p>}

      {rw && <div className="flex gap-3">
        <Button onClick={handleSave} loading={saving}>Save Plan</Button>
        <Button variant="secondary" onClick={handleClear} disabled={saving}>Clear Plan</Button>
      </div>}
    </div>
  )
}
