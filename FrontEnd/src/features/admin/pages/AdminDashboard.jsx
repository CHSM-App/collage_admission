import { useState } from 'react'
import api from '../../../services/api.js'
import Button from '../../../shared/components/Button.jsx'

const EMPTY = {
  name:           '',
  address:        '',
  city:           '',
  phone:          '',
  email:          '',
  admin_email:    '',
  admin_password: '',
}

export default function AdminDashboard() {
  const [form, setForm]       = useState(EMPTY)
  const [saving, setSaving]   = useState(false)
  const [success, setSuccess] = useState(null)   // { college_code, name }
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
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to create college.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="max-w-2xl space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">Admin console</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">Create College</h1>
        <p className="mt-1 text-slate-500">Onboard a new college. A unique college code will be generated automatically.</p>
      </div>

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 space-y-1">
          <p className="font-semibold text-emerald-900">College created successfully!</p>
          <p className="text-sm text-emerald-700">
            <span className="font-medium">{success.name}</span> — Code:{' '}
            <span className="font-mono font-bold">{success.college_code}</span>
          </p>
          <p className="text-xs text-emerald-600">Admin can now log in with the email and password you set.</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <fieldset className="space-y-4">
          <legend className="text-sm font-bold text-slate-700 uppercase tracking-wide">College Info</legend>

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
                placeholder="e.g. 02366-262XXX" className={inputCls} />
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
        </fieldset>

        <hr className="border-slate-100" />

        <fieldset className="space-y-4">
          <legend className="text-sm font-bold text-slate-700 uppercase tracking-wide">Admin Account</legend>
          <p className="text-xs text-slate-400">These credentials are used by the college admin to log in.</p>

          <Field label="Admin Login Email" required>
            <input name="admin_email" type="email" value={form.admin_email} onChange={handleChange} required
              placeholder="admin@college.edu.in" className={inputCls} />
          </Field>

          <Field label="Admin Password" required>
            <input name="admin_password" type="password" value={form.admin_password} onChange={handleChange} required
              placeholder="Min 8 characters" minLength={8} className={inputCls} />
          </Field>
        </fieldset>

        <div className="pt-2">
          <Button type="submit" loading={saving} disabled={saving}>
            Create College
          </Button>
        </div>
      </form>
    </section>
  )
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
