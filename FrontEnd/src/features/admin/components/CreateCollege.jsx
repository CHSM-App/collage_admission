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
  const [form, setForm]         = useState(EMPTY)
  const [saving, setSaving]     = useState(false)
  const [success, setSuccess]   = useState(null)
  const [error, setError]       = useState('')
  const [showPass, setShowPass] = useState(false)

  function handleChange(e) {
    let value = e.target.value
    if (e.target.name === 'phone') value = value.replace(/\D/g, '').slice(0, 10)
    setForm(f => ({ ...f, [e.target.name]: value }))
    setError('')
    setSuccess(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.phone && form.phone.length !== 10) {
      setError('Phone number must be exactly 10 digits.')
      return
    }
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
                placeholder="e.g. 9876543210" inputMode="numeric" pattern="[0-9]{10}"
                maxLength={10} className={inputCls} />
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
            <div className="relative">
              <input name="admin_password" type={showPass ? 'text' : 'password'} value={form.admin_password} onChange={handleChange} required
                placeholder="Min 8 characters" minLength={8} className={`${inputCls} pr-10`} />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600">
                {showPass ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7s4-7 9-7a9.97 9.97 0 016.364 2.273M15 12a3 3 0 11-4.243-4.243M3 3l18 18" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </Field>
        </fieldset>

        <Button type="submit" loading={saving} disabled={saving}>Create College</Button>
      </form>
    </div>
  )
}
