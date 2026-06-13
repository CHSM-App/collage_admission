/**
 * PayViaLink — Public page (no auth) for payment links sent via WhatsApp.
 * Route: /pay/:token
 * Fetches PayU form fields from backend and auto-submits.
 */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getPaymentLinkData } from '../../../services/collegeAdminService.js'

export default function PayViaLink() {
  const { token } = useParams()
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [info,   setInfo]   = useState(null)
  const [error,  setError]  = useState('')

  useEffect(() => {
    getPaymentLinkData(token)
      .then(r => {
        setInfo(r.data)
        setStatus('ready')
      })
      .catch(err => {
        setError(err?.response?.data?.message || 'Invalid or expired payment link.')
        setStatus('error')
      })
  }, [token])

  // Auto-submit PayU form once data is ready
  useEffect(() => {
    if (status !== 'ready' || !info) return
    const form = document.getElementById('payu-form')
    if (form) {
      setTimeout(() => form.submit(), 800) // small delay so user sees the page
    }
  }, [status, info])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600 mx-auto" />
          <p className="text-slate-500 text-sm">Loading payment…</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="rounded-xl border border-red-200 bg-white p-8 text-center max-w-sm space-y-3 shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-900">Link Unavailable</h2>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    )
  }

  const { endpoint, fields, college_name, student_name, amount } = info

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center max-w-sm space-y-4 shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">{college_name}</h2>
          <p className="text-sm text-slate-500 mt-1">Dear {student_name},</p>
        </div>
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 py-3 px-4">
          <p className="text-xs text-emerald-700 font-medium uppercase tracking-wide">Amount to Pay</p>
          <p className="text-3xl font-black text-emerald-700 mt-1">₹{Number(amount).toLocaleString('en-IN')}</p>
        </div>
        <p className="text-xs text-slate-400">Redirecting to payment gateway…</p>

        {/* Hidden PayU auto-submit form */}
        <form id="payu-form" method="POST" action={endpoint} style={{ display: 'none' }}>
          {Object.entries(fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
        </form>
      </div>
    </div>
  )
}
