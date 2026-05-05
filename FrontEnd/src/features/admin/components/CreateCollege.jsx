import { useState } from 'react'
import api from '../../../services/api.js'
import Button from '../../../shared/components/Button.jsx'

const EMPTY = {
  name: '', address: '', city: '', phone: '',
  email: '', admin_email: '', admin_password: '', college_code: '', application_fee: '',
}

const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500'

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

export default function CreateCollege({ onCreated }) {
  const [form, setForm]       = useState(EMPTY)
  const [saving, setSaving]   = useState(false)
  const [success, setSuccess] = useState(null)
  const [error, setError]     = useState('')

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
    setError('')
    setSuccess(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess(null)
    try {
      const res = await api.post('colleges', form)
      setSuccess(res.data.data)
      setForm(EMPTY)
      setTimeout(() => onCreated?.(), 1500)
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to create college.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-slate-500 text-sm">Onboard a new college. Leave the college code blank to auto-generate one.</p>

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 space-y-1">
          <p className="font-semibold text-emerald-900">College created!</p>
          <p className="text-sm text-emerald-700">
            <span className="font-medium">{success.name}</span> — Code:{' '}
            <span className="font-mono font-bold">{success.college_code}</span>
          </p>
        </div>
      )}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <fieldset className="space-y-4">
          <legend className="text-xs font-bold text-slate-700 uppercase tracking-wide">College Info</legend>
          <Field label="College Name" required>
            <input name="name" value={form.name} onChange={handleChange} required
              placeholder="e.g. Shri Mallikarjun College" className={inputCls} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="City" required>
              <input name="city" value={form.city} onChange={handleChange} required
                placeholder="e.g. Vengurla" className={inputCls} />
            </Field>
            <Field label="Phone">
              <input name="phone" value={form.phone} onChange={handleChange}
                placeholder="02366-262XXX" className={inputCls} />
            </Field>
          </div>
          <Field label="Address">
            <input name="address" value={form.address} onChange={handleChange}
              placeholder="Street, Taluka, District" className={inputCls} />
          </Field>
          <Field label="College Email" required>
            <input name="email" type="email" value={form.email} onChange={handleChange} required
              placeholder="info@college.edu.in" className={inputCls} />
          </Field>
          <Field label="College Code">
            <input name="college_code" value={form.college_code}
              onChange={e => { setForm(f => ({ ...f, college_code: e.target.value.toUpperCase() })); setError(''); setSuccess(null) }}
              placeholder="e.g. CL007 (leave blank to auto-generate)"
              maxLength={20}
              className={`${inputCls} font-mono tracking-widest uppercase`} />
            <p className="mt-1 text-xs text-slate-400">This code is shared with students so they can find the college.</p>
          </Field>
          <Field label="Application Fee (₹)" required>
            <input name="application_fee" type="number" min="0" step="1"
              value={form.application_fee} onChange={handleChange} required
              placeholder="e.g. 500" className={inputCls} />
            <p className="mt-1 text-xs text-slate-400">Charged to students when they submit an application. Applied to all admission periods.</p>
          </Field>
        </fieldset>

        <hr className="border-slate-100" />

        <fieldset className="space-y-4">
          <legend className="text-xs font-bold text-slate-700 uppercase tracking-wide">Admin Account</legend>
          <p className="text-xs text-slate-400">Used by the principal admin of the college to log in.</p>
          <Field label="Admin Login Email" required>
            <input name="admin_email" type="email" value={form.admin_email} onChange={handleChange} required
              placeholder="admin@college.edu.in" className={inputCls} />
          </Field>
          <Field label="Admin Password" required>
            <input name="admin_password" type="password" value={form.admin_password} onChange={handleChange} required
              placeholder="Min 8 characters" minLength={8} className={inputCls} />
          </Field>
        </fieldset>

        <Button type="submit" loading={saving} disabled={saving}>Create College</Button>
      </form>
    </div>
  )
}
