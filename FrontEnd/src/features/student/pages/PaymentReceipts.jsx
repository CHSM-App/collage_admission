/**
 * PaymentReceipts — shows all payment receipts for an application.
 * Each receipt is printable / downloadable as PDF.
 */
import { useEffect, useRef, useState } from 'react'
import { SkeletonLines } from '../../../shared/components/Skeleton.jsx'
import { getPaymentReceipts } from '../../../services/paymentService.js'

const YEAR_LABEL = { 1: 'First Year (FY)', 2: 'Second Year (SY)', 3: 'Third Year (TY)', 4: 'Fourth Year (4Y)', 5: 'Fifth Year (5Y)' }
const TYPE_LABEL = {
  application_fee: 'Application Fee',
  college_fee:     'College Fee',
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
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
}

function fmtTime(str) {
  const d = parseLocalDate(str)
  if (!d) return ''
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
}

export default function PaymentReceipts({ applicationId, onClose, hideTypes = [] }) {
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [activeId, setActiveId] = useState(null)

  useEffect(() => {
    getPaymentReceipts(applicationId)
      .then(r => {
        const d = r.data.data
        setData(d)
        const visible = (d.payments || []).filter(p => !hideTypes.includes(p.payment_type))
        if (visible.length) setActiveId(visible[visible.length - 1].id)
      })
      .catch(() => setError('Failed to load receipts.'))
      .finally(() => setLoading(false))
  }, [applicationId])

  if (loading) return <div className="py-4 px-2"><SkeletonLines rows={4} /></div>
  if (error)   return <div className="py-6 text-center text-red-500 text-sm">{error}</div>
  const payments = (data?.payments || []).filter(p => !hideTypes.includes(p.payment_type))

  if (!payments.length) return <div className="py-6 text-center text-slate-400 text-sm">No payment receipts found.</div>

  return (
    <div className="space-y-2">
      {onClose && (
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-bold text-slate-700">Payment Receipts</p>
          <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">✕ Close</button>
        </div>
      )}
      {payments.map((pmt, idx) => (
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
  const receiptNo   = `RCP-${String(pmt.id).padStart(6, '0')}`
  const typeLabel   = TYPE_LABEL[pmt.payment_type] || pmt.payment_type
  const fullLabel   = typeLabel
  const studentName = (app.app_full_name || app.student_name || '').trim()
  const sheetRef    = useRef(null)

  function buildHTML() {
    const collegeAddr   = [app.college_address, app.college_city].filter(Boolean).join(', ')
    const collegePhone  = app.college_phone  ? `Ph: ${app.college_phone}`  : ''
    const collegeEmail  = app.college_email  ? `${app.college_email}`      : ''
    const contactLine   = [collegePhone, collegeEmail].filter(Boolean).join('  |  ')

    const amountWords   = numberToWords(Number(pmt.amount))
    const printDate     = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })

    function trow(label, value, mono) {
      return `
        <tr>
          <td style="padding:7px 12px;font-size:11.5px;color:#64748b;font-weight:500;width:38%;border-bottom:1px solid #f1f5f9;white-space:nowrap;">${label}</td>
          <td style="padding:7px 12px;font-size:11.5px;color:#1e293b;font-weight:600;border-bottom:1px solid #f1f5f9;word-break:break-all;${mono ? 'font-family:monospace;font-size:10.5px;' : ''}">${value || '—'}</td>
        </tr>`
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Payment Receipt — ${receiptNo}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#f1f5f9;color:#1e293b;padding:32px 24px}
    @media print{
      body{background:#fff;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .no-print{display:none}
      @page{size:A4;margin:14mm 16mm}
    }
  </style>
</head>
<body>

<div style="max-width:680px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

  <!-- ═══ TOP ACCENT BAR ═══ -->
  <div style="height:5px;background:linear-gradient(90deg,#0f172a 0%,#1d4ed8 50%,#0ea5e9 100%);"></div>

  <!-- ═══ HEADER ═══ -->
  <div style="padding:24px 28px 20px;display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #e2e8f0;">
    <div>
      <div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#64748b;margin-bottom:4px;">Official Payment Receipt</div>
      <div style="font-size:18px;font-weight:800;color:#0f172a;line-height:1.2;">${app.college_name || '—'}</div>
      ${collegeAddr  ? `<div style="font-size:11px;color:#64748b;margin-top:3px;">${collegeAddr}</div>` : ''}
      ${contactLine  ? `<div style="font-size:10.5px;color:#94a3b8;margin-top:2px;">${contactLine}</div>` : ''}
    </div>
    <div style="text-align:right;flex-shrink:0;margin-left:20px;">
      <div style="display:inline-block;background:#dcfce7;border:1.5px solid #86efac;border-radius:6px;padding:6px 14px;margin-bottom:8px;">
        <div style="font-size:8px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#15803d;">Payment Status</div>
        <div style="font-size:14px;font-weight:800;color:#16a34a;margin-top:1px;">&#10003; PAID</div>
      </div>
      <div style="font-size:10px;color:#94a3b8;font-family:monospace;font-weight:600;">${receiptNo}</div>
      <div style="font-size:10px;color:#94a3b8;margin-top:2px;">Printed: ${printDate}</div>
    </div>
  </div>

  <!-- ═══ AMOUNT HERO BAND ═══ -->
  <div style="background:#0f172a;padding:20px 28px;display:flex;justify-content:space-between;align-items:center;">
    <div>
      <div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#64748b;margin-bottom:4px;">Amount Paid</div>
      <div style="font-size:32px;font-weight:900;color:#4ade80;letter-spacing:-0.5px;">&#8377;${Number(pmt.amount).toLocaleString('en-IN')}</div>
      <div style="font-size:10.5px;color:#94a3b8;margin-top:4px;font-style:italic;">${amountWords} Only</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#64748b;margin-bottom:4px;">Payment For</div>
      <div style="font-size:13px;font-weight:700;color:#e2e8f0;">${fullLabel}</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:6px;">${fmtDate(pmt.completed_at)}&nbsp;&nbsp;${fmtTime(pmt.completed_at)}</div>
    </div>
  </div>

  <!-- ═══ BODY ═══ -->
  <div style="padding:0 28px 24px;">

    <!-- Student Details -->
    <div style="margin-top:22px;">
      <div style="font-size:8.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#94a3b8;margin-bottom:8px;padding-bottom:4px;border-bottom:2px solid #0f172a;">Student &amp; Application Details</div>
      <table style="width:100%;border-collapse:collapse;">
        <tbody>
          ${trow('Student Name',    studentName)}
          ${trow('Mobile',          app.app_mobile || app.student_phone)}
          ${trow('College',         app.college_name)}
          ${trow('Course',          app.course_name)}
          ${trow('Year of Study',   YEAR_LABEL[app.year_of_study])}
          ${trow('Academic Year',   app.academic_year)}
          ${app.registration_number ? trow('Registration No.', app.registration_number, true) : ''}
        </tbody>
      </table>
    </div>

    <!-- Payment Details -->
    <div style="margin-top:20px;">
      <div style="font-size:8.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#94a3b8;margin-bottom:8px;padding-bottom:4px;border-bottom:2px solid #0f172a;">Transaction Details</div>
      <table style="width:100%;border-collapse:collapse;">
        <tbody>
          ${trow('Receipt Number',  receiptNo,  true)}
          ${trow('Payment Type',    fullLabel)}
          ${trow('Amount Paid',     '&#8377;' + Number(pmt.amount).toLocaleString('en-IN'))}
          ${trow('Payment Status',  'Paid')}
          ${trow('Payment Date',    fmtDate(pmt.completed_at) + '  ' + fmtTime(pmt.completed_at))}
          ${pmt.razorpay_payment_id ? trow('Transaction ID',  pmt.razorpay_payment_id, true) : ''}
        </tbody>
      </table>
    </div>

    <!-- Stamp + Declaration row -->
    <div style="margin-top:24px;display:flex;justify-content:space-between;align-items:flex-end;gap:16px;">
      <div style="flex:1;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;padding:12px 16px;">
        <p style="font-size:10px;color:#64748b;line-height:1.6;">
          This is a computer-generated receipt and does not require a physical signature.
          Please retain this for your records. For queries, contact the college office.
        </p>
      </div>
      <div style="flex-shrink:0;text-align:center;">
        <div style="width:90px;height:90px;border-radius:50%;border:3px solid #16a34a;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f0fdf4;">
          <div style="font-size:20px;color:#16a34a;line-height:1;">&#10003;</div>
          <div style="font-size:8px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#16a34a;margin-top:2px;">VERIFIED</div>
          <div style="font-size:7px;color:#86efac;margin-top:1px;">e-Verified</div>
        </div>
      </div>
    </div>

  </div>

  <!-- ═══ FOOTER BAR ═══ -->
  <div style="height:3px;background:linear-gradient(90deg,#0f172a 0%,#1d4ed8 50%,#0ea5e9 100%);"></div>
  <div style="background:#f8fafc;padding:10px 28px;display:flex;justify-content:space-between;align-items:center;">
    <span style="font-size:9.5px;color:#94a3b8;">College Admission Portal</span>
    <span style="font-size:9.5px;color:#94a3b8;font-family:monospace;">${receiptNo}</span>
  </div>

</div>
</body>
</html>`
  }

  function handlePrint() {
    const win = window.open('', '_blank', 'width=860,height=900')
    win.document.write(buildHTML())
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 600)
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
      </div>

      {/* Receipt preview card — also the source of the shared PDF */}
      <div ref={sheetRef} className="bg-white overflow-hidden">

        {/* Top accent */}
        <div className="h-1" style={{ background: 'linear-gradient(90deg,#0f172a 0%,#1d4ed8 50%,#0ea5e9 100%)' }} />

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-0.5">Official Payment Receipt</p>
            <p className="text-base font-extrabold text-slate-900">{app.college_name}</p>
            {(app.college_address || app.college_city) && (
              <p className="text-xs text-slate-500 mt-0.5">{[app.college_address, app.college_city].filter(Boolean).join(', ')}</p>
            )}
          </div>
          <div className="text-right shrink-0 ml-4">
            <div className="inline-block border border-emerald-300 bg-emerald-50 rounded-md px-3 py-1.5 mb-1.5">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">✓ PAID</p>
            </div>
            <p className="text-xs font-mono text-slate-400">{receiptNo}</p>
          </div>
        </div>

        {/* Amount hero */}
        <div className="flex items-center justify-between bg-slate-900 px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-0.5">Amount Paid</p>
            <p className="text-3xl font-black text-emerald-400">₹{Number(pmt.amount).toLocaleString('en-IN')}</p>
            <p className="text-xs text-slate-500 italic mt-1">{numberToWords(Number(pmt.amount))} Only</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-0.5">Payment For</p>
            <p className="text-sm font-bold text-slate-200">{fullLabel}</p>
            <p className="text-xs text-slate-500 mt-1">{fmtDate(pmt.completed_at)} &nbsp; {fmtTime(pmt.completed_at)}</p>
          </div>
        </div>

        {/* Details tables */}
        <div className="px-5 py-4 space-y-5">

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b-2 border-slate-900 pb-1 mb-2">Student &amp; Application Details</p>
            <table className="w-full text-sm">
              <tbody>
                {[
                  ['Student Name',   studentName],
                  ['Mobile',         app.app_mobile || app.student_phone],
                  ['College',        app.college_name],
                  ['Course',         app.course_name],
                  ['Year of Study',  YEAR_LABEL[app.year_of_study]],
                  ['Academic Year',  app.academic_year],
                  ...(app.registration_number ? [['Registration No.', app.registration_number]] : []),
                ].map(([label, value]) => (
                  <tr key={label} className="border-b border-slate-50">
                    <td className="py-1.5 pr-4 text-slate-500 font-medium w-40 whitespace-nowrap">{label}</td>
                    <td className="py-1.5 text-slate-800 font-semibold">{value || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b-2 border-slate-900 pb-1 mb-2">Transaction Details</p>
            <table className="w-full text-sm">
              <tbody>
                {[
                  ['Receipt Number',  receiptNo,  true],
                  ['Payment Type',    fullLabel,  false],
                  ['Amount Paid',     `₹${Number(pmt.amount).toLocaleString('en-IN')}`, false],
                  ['Payment Status',  'Paid',     false],
                  ['Payment Date',    `${fmtDate(pmt.completed_at)}  ${fmtTime(pmt.completed_at)}`, false],
                  ...(pmt.razorpay_payment_id ? [['Transaction ID', pmt.razorpay_payment_id, true]] : []),
                  ...(pmt.razorpay_order_id   ? [['Order ID',       pmt.razorpay_order_id,   true]] : []),
                ].map(([label, value, mono]) => (
                  <tr key={label} className="border-b border-slate-50">
                    <td className="py-1.5 pr-4 text-slate-500 font-medium w-40 whitespace-nowrap">{label}</td>
                    <td className={`py-1.5 text-slate-800 font-semibold break-all ${mono ? 'font-mono text-xs' : ''}`}>{value || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom row: note + stamp */}
          <div className="flex items-end justify-between gap-4 pt-1">
            <div className="flex-1 bg-slate-50 border border-dashed border-slate-200 rounded-lg px-4 py-3">
              <p className="text-xs text-slate-500 leading-relaxed">
                This is a computer-generated receipt and does not require a physical signature.
                Please retain this for your records.
              </p>
            </div>
            <div className="shrink-0 flex flex-col items-center justify-center w-20 h-20 rounded-full border-2 border-emerald-500 bg-emerald-50">
              <span className="text-lg text-emerald-600">✓</span>
              <span className="text-xs font-black uppercase tracking-wide text-emerald-700 leading-tight text-center">Verified</span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="h-0.5" style={{ background: 'linear-gradient(90deg,#0f172a 0%,#1d4ed8 50%,#0ea5e9 100%)' }} />
        <div className="flex items-center justify-between bg-slate-50 px-5 py-2">
          <p className="text-xs text-slate-400">College Admission Portal</p>
          <p className="text-xs font-mono text-slate-400">{receiptNo}</p>
        </div>

      </div>
    </div>
  )
}


// ── Amount in words (Indian numbering) ───────────────────────
function numberToWords(n) {
  if (!n || isNaN(n)) return 'Zero Rupees'
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
    'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']

  function words(num) {
    if (num === 0) return ''
    if (num < 20)  return ones[num] + ' '
    if (num < 100) return tens[Math.floor(num/10)] + (num%10 ? ' ' + ones[num%10] : '') + ' '
    if (num < 1000) return ones[Math.floor(num/100)] + ' Hundred ' + words(num%100)
    if (num < 100000)  return words(Math.floor(num/1000))  + 'Thousand ' + words(num%1000)
    if (num < 10000000) return words(Math.floor(num/100000)) + 'Lakh '    + words(num%100000)
    return words(Math.floor(num/10000000)) + 'Crore ' + words(num%10000000)
  }

  const rupees = Math.floor(n)
  const paise  = Math.round((n - rupees) * 100)
  let result   = words(rupees).trim() + ' Rupees'
  if (paise > 0) result += ' and ' + words(paise).trim() + ' Paise'
  return result
}
