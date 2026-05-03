/**
 * PaymentReceipts — shows all payment receipts for an application.
 * Each receipt is printable / downloadable as PDF and shareable via Web Share API.
 */
import { useEffect, useRef, useState } from 'react'
import api from '../../../services/api.js'

const YEAR_LABEL = { 1: 'First Year (FY)', 2: 'Second Year (SY)', 3: 'Third Year (TY)' }
const TYPE_LABEL = {
  application_fee:         'Application Fee',
  college_fee:             'College Fee',
  college_fee_installment: 'College Fee (Installment)',
}

// DB returns datetime strings without timezone (IST stored as-is).
// Treat them as local time by replacing the space with 'T' — no UTC offset applied.
function parseLocalDate(str) {
  if (!str) return null
  try {
    // e.g. "2026-05-02 19:32:31.8200000" → "2026-05-02T19:32:31"
    return new Date(str.toString().replace(' ', 'T').split('.')[0])
  } catch { return null }
}

function fmtDate(str) {
  const d = parseLocalDate(str)
  if (!d) return '—'
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtTime(str) {
  const d = parseLocalDate(str)
  if (!d) return ''
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export default function PaymentReceipts({ applicationId, onClose }) {
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [activeId, setActiveId] = useState(null)

  useEffect(() => {
    api.get(`payments/receipts/${applicationId}`)
      .then(r => {
        const d = r.data.data
        setData(d)
        if (d.payments?.length) setActiveId(d.payments[d.payments.length - 1].id)
      })
      .catch(() => setError('Failed to load receipts.'))
      .finally(() => setLoading(false))
  }, [applicationId])

  if (loading) return <div className="py-6 text-center text-slate-400 text-sm">Loading receipts…</div>
  if (error)   return <div className="py-6 text-center text-red-500 text-sm">{error}</div>
  if (!data?.payments?.length) return <div className="py-6 text-center text-slate-400 text-sm">No payment receipts found.</div>

  return (
    <div className="space-y-2">
      {onClose && (
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-bold text-slate-700">Payment Receipts</p>
          <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">✕ Close</button>
        </div>
      )}
      {data.payments.map((pmt, idx) => (
        <div key={pmt.id} className="rounded-lg border border-slate-200 overflow-hidden">
          <button
            onClick={() => setActiveId(activeId === pmt.id ? null : pmt.id)}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-white hover:bg-slate-50 transition text-left"
          >
            <div className="flex items-center gap-2.5">
              <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <span className="text-emerald-700 text-xs font-bold">{idx + 1}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 leading-tight">
                  {TYPE_LABEL[pmt.payment_type] || pmt.payment_type}
                  {pmt.installment_label ? ` — ${pmt.installment_label}` : ''}
                </p>
                <p className="text-xs text-slate-400">
                  {fmtDate(pmt.completed_at)} {fmtTime(pmt.completed_at)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-bold text-slate-950">₹{Number(pmt.amount).toLocaleString('en-IN')}</span>
              <span className="text-slate-300 text-xs">{activeId === pmt.id ? '▲' : '▼'}</span>
            </div>
          </button>
          {activeId === pmt.id && <ReceiptSheet app={data.application} pmt={pmt} />}
        </div>
      ))}
    </div>
  )
}

// ── Printable receipt ────────────────────────────────────────
function ReceiptSheet({ app, pmt }) {
  const receiptRef  = useRef(null)
  const receiptNo   = `RCP-${String(pmt.id).padStart(6, '0')}`
  const typeLabel   = TYPE_LABEL[pmt.payment_type] || pmt.payment_type
  const fullLabel   = pmt.installment_label ? `${typeLabel} — ${pmt.installment_label}` : typeLabel
  const studentName = (app.app_full_name || app.student_name || '').trim()

  const printCSS = `
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#1e293b;padding:16px}
    .rc{max-width:580px;margin:0 auto;border:1.5px solid #e2e8f0;border-radius:10px;overflow:hidden}
    .hd{background:#0f172a;color:#fff;padding:16px 20px;display:flex;justify-content:space-between;align-items:flex-start}
    .hd-l h1{font-size:15px;font-weight:700}.hd-l p{font-size:11px;color:#94a3b8;margin-top:1px}
    .hd-r{text-align:right}.badge{background:#10b981;color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:999px;display:inline-block}
    .rno{font-size:11px;color:#94a3b8;margin-top:4px;font-family:monospace}
    .ab{background:#f0fdf4;border-bottom:1px solid #d1fae5;padding:12px 20px;display:flex;justify-content:space-between;align-items:center}
    .ab-amt{font-size:24px;font-weight:800;color:#059669}.ab-lbl{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;font-weight:600}
    .ab-type{font-size:12px;color:#374151;font-weight:600;margin-top:2px}
    .ab-date{text-align:right}.ab-date .dv{font-size:13px;font-weight:700;color:#1e293b}.ab-date .tv{font-size:10px;color:#6b7280}
    .bd{padding:14px 20px}
    .sec-title{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;font-weight:700;margin-bottom:6px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;margin-bottom:12px}
    .row{display:flex;gap:6px;font-size:11px;padding:3px 0;border-bottom:1px solid #f1f5f9}
    .row.wide{grid-column:1/-1}.row .lb{color:#94a3b8;min-width:110px;flex-shrink:0}
    .row .vl{color:#1e293b;font-weight:600;word-break:break-all}
    .row .vl.mono{font-family:monospace;font-size:10px}.row .vl.green{color:#059669}
    .ft{background:#f8fafc;border-top:1px solid #e2e8f0;padding:10px 20px;display:flex;justify-content:space-between;align-items:center}
    .ft p{font-size:10px;color:#94a3b8}.ft .stamp{font-weight:700;color:#10b981;font-size:11px}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  `

  function handlePrint() {
    const content = receiptRef.current?.innerHTML
    if (!content) return
    const win = window.open('', '_blank', 'width=720,height=600')
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Receipt ${receiptNo}</title><style>${printCSS}</style></head><body>${content}</body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 400)
  }

  async function handleShare() {
    const text = [
      `Payment Receipt — ${receiptNo}`,
      `College: ${app.college_name}`,
      `Student: ${studentName}`,
      `Purpose: ${fullLabel}`,
      `Amount: ₹${Number(pmt.amount).toLocaleString('en-IN')}`,
      `Date: ${fmtDate(pmt.completed_at)} ${fmtTime(pmt.completed_at)}`,
      `Transaction ID: ${pmt.razorpay_payment_id || '—'}`,
      `Reg No: ${app.registration_number || '—'}`,
    ].join('\n')

    if (navigator.share) {
      try { await navigator.share({ title: `Receipt ${receiptNo}`, text }) } catch {}
    } else {
      await navigator.clipboard.writeText(text)
      alert('Receipt details copied to clipboard.')
    }
  }

  return (
    <div className="border-t border-slate-100">
      {/* Action buttons */}
      <div className="flex gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100 justify-end">
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 rounded-md bg-slate-900 text-white text-xs font-semibold px-3 py-1.5 hover:bg-slate-700 transition"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
          </svg>
          Print / Save PDF
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white text-slate-700 text-xs font-semibold px-3 py-1.5 hover:bg-slate-50 transition"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
          </svg>
          Share
        </button>
      </div>

      {/* Receipt (also used for print) */}
      <div ref={receiptRef}>
        <div className="rc" style={{ fontFamily: "'Segoe UI',Arial,sans-serif", color: '#1e293b' }}>

          {/* Header */}
          <div className="hd" style={{ background:'#0f172a', color:'#fff', padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div className="hd-l">
              <h1 style={{ fontSize:15, fontWeight:700 }}>{app.college_name}</h1>
              <p style={{ fontSize:11, color:'#94a3b8', marginTop:1 }}>
                {[app.college_address, app.college_city].filter(Boolean).join(', ')}
                {app.college_email ? ` · ${app.college_email}` : ''}
              </p>
            </div>
            <div className="hd-r" style={{ textAlign:'right' }}>
              <span className="badge" style={{ background:'#10b981', color:'#fff', fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:999, display:'inline-block', letterSpacing:'0.5px' }}>PAID</span>
              <div className="rno" style={{ fontSize:11, color:'#94a3b8', marginTop:4, fontFamily:'monospace' }}>{receiptNo}</div>
            </div>
          </div>

          {/* Amount band */}
          <div className="ab" style={{ background:'#f0fdf4', borderBottom:'1px solid #d1fae5', padding:'12px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'1px', color:'#6b7280', fontWeight:600 }}>Amount Paid</div>
              <div style={{ fontSize:24, fontWeight:800, color:'#059669', marginTop:1 }}>₹{Number(pmt.amount).toLocaleString('en-IN')}</div>
              <div style={{ fontSize:12, color:'#374151', fontWeight:600, marginTop:2 }}>{fullLabel}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'1px', color:'#6b7280', fontWeight:600 }}>Date &amp; Time</div>
              <div style={{ fontSize:13, fontWeight:700, color:'#1e293b', marginTop:2 }}>{fmtDate(pmt.completed_at)}</div>
              <div style={{ fontSize:10, color:'#6b7280' }}>{fmtTime(pmt.completed_at)}</div>
            </div>
          </div>

          {/* Body */}
          <div className="bd" style={{ padding:'14px 20px' }}>

            <div style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'1px', color:'#94a3b8', fontWeight:700, marginBottom:6 }}>Student &amp; Application</div>
            <div className="grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2px 12px', marginBottom:12 }}>
              <DR label="Name"         value={studentName} />
              <DR label="Mobile"       value={app.app_mobile || app.student_phone} />
              <DR label="College"      value={app.college_name} />
              <DR label="Course"       value={app.course_name} />
              <DR label="Year"         value={YEAR_LABEL[app.year_of_study]} />
              <DR label="Academic Yr"  value={app.academic_year} />
              {app.registration_number && <DR label="Reg No" value={app.registration_number} mono />}
            </div>

            <div style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'1px', color:'#94a3b8', fontWeight:700, marginBottom:6 }}>Payment Details</div>
            <div className="grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2px 12px', marginBottom:4 }}>
              <DR label="Receipt No"   value={receiptNo} mono />
              <DR label="Type"         value={fullLabel} />
              <DR label="Amount"       value={`₹${Number(pmt.amount).toLocaleString('en-IN')}`} />
              <DR label="Status"       value="Paid" green />
              {pmt.razorpay_payment_id && <DR label="Transaction ID" value={pmt.razorpay_payment_id} mono wide />}
              {pmt.razorpay_order_id   && <DR label="Order ID"       value={pmt.razorpay_order_id}   mono wide />}
            </div>
          </div>

          {/* Footer */}
          <div className="ft" style={{ background:'#f8fafc', borderTop:'1px solid #e2e8f0', padding:'10px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <p style={{ fontSize:10, color:'#94a3b8' }}>Computer-generated receipt · No signature required</p>
            <span style={{ fontWeight:700, color:'#10b981', fontSize:11 }}>✓ Verified</span>
          </div>

        </div>
      </div>
    </div>
  )
}

function DR({ label, value, mono, green, wide }) {
  return (
    <div className={`row${wide ? ' wide' : ''}`} style={{ display:'flex', gap:6, fontSize:11, padding:'3px 0', borderBottom:'1px solid #f1f5f9', gridColumn: wide ? '1/-1' : undefined }}>
      <span className="lb" style={{ color:'#94a3b8', minWidth:110, flexShrink:0 }}>{label}:</span>
      <span className="vl" style={{ color: green ? '#059669' : '#1e293b', fontWeight:600, fontFamily: mono ? 'monospace' : undefined, fontSize: mono ? 10 : undefined, wordBreak:'break-all' }}>
        {value || '—'}
      </span>
    </div>
  )
}
