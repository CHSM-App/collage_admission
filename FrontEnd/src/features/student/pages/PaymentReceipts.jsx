/**
 * PaymentReceipts — shows all payment receipts for an application.
 * Each receipt is printable / downloadable as PDF.
 */
import { useEffect, useRef, useState } from 'react'
import { SkeletonLines } from '../../../shared/components/Skeleton.jsx'
import { getPaymentReceipts } from '../../../services/paymentService.js'

const YEAR_LABEL = { 1: 'First Year (FY)', 2: 'Second Year (SY)', 3: 'Third Year (TY)', 4: 'Fourth Year (4Y)', 5: 'Fifth Year (5Y)' }
const TYPE_LABEL = {
  application_fee: 'Platform Fee',
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

export default function PaymentReceipts({ applicationId, onClose, hideTypes = [], showOrderId = false }) {
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [activeId, setActiveId] = useState(null)

  useEffect(() => {
    getPaymentReceipts(applicationId)
      .then(r => {
        const d = r.data.data
        setData(d)
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
          {activeId === pmt.id && <ReceiptSheet app={data.application} pmt={pmt} showOrderId={showOrderId} />}
        </div>
      ))}
    </div>
  )
}

// ── Printable receipt ────────────────────────────────────────
function ReceiptSheet({ app, pmt, showOrderId = false }) {
  const receiptNo   = `RCP-${String(pmt.id).padStart(6, '0')}`
  const typeLabel   = TYPE_LABEL[pmt.payment_type] || pmt.payment_type
  const fullLabel   = typeLabel
  const studentName = (app.app_full_name || app.student_name || '').trim()
  const sheetRef    = useRef(null)

  function buildReceiptBlock(copyLabel) {
    const receiptDate = fmtDate(pmt.completed_at)
    // Format as DD/MM/YY
    const d = parseLocalDate(pmt.completed_at)
    const shortDate = d
      ? `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`
      : receiptDate
    const yearLabel = { 1:'FY', 2:'SY', 3:'TY', 4:'4Y', 5:'5Y' }
    const yrShort = yearLabel[app.year_of_study] || ''
    const courseShort = app.degree_course_code || ''
    const divShort = app.app_division ? ` - ${app.app_division}` : ''
    const classLabel = `${yrShort}${courseShort}${divShort}`
    const heads = (pmt.fee_heads || [])
    const rows = heads.length
      ? heads.map((h, i) => `
          <tr>
            <td style="border:1px solid #000;padding:3px 6px;text-align:center;font-size:11px;">${i+1}</td>
            <td style="border:1px solid #000;padding:3px 8px;font-size:11px;">${h.fees_head}</td>
            <td style="border:1px solid #000;padding:3px 8px;text-align:right;font-size:11px;">${Number(h.paid||h.amount).toFixed(2)}</td>
          </tr>`).join('')
      : `<tr>
          <td style="border:1px solid #000;padding:3px 6px;text-align:center;font-size:11px;">1</td>
          <td style="border:1px solid #000;padding:3px 8px;font-size:11px;">${fullLabel}</td>
          <td style="border:1px solid #000;padding:3px 8px;text-align:right;font-size:11px;">${Number(pmt.amount).toFixed(2)}</td>
        </tr>`

    const totalAmt = Number(pmt.amount).toFixed(2)

    return `
    <div style="width:48%;font-family:'Times New Roman',Times,serif;font-size:12px;color:#000;border:1px solid #000;padding:10px 12px;box-sizing:border-box;position:relative;">
      <div style="text-align:right;font-size:10px;font-style:italic;margin-bottom:2px;">${copyLabel}</div>
      ${app.trust_name ? `<div style="text-align:center;font-size:11px;">${app.trust_name}</div>` : ''}
      <div style="text-align:center;font-size:13px;font-weight:bold;">${app.college_name || ''}</div>
      ${app.college_address ? `<div style="text-align:center;font-size:10.5px;">${app.college_address}${app.college_city ? ', ' + app.college_city : ''}</div>` : ''}
      ${app.college_affiliation ? `<div style="text-align:center;font-size:10px;">(${app.college_affiliation})</div>` : ''}

      <div style="margin-top:8px;display:flex;justify-content:space-between;font-size:11px;">
        <span>Receipt No.- <strong>${receiptNo}</strong></span>
        <span>Date &nbsp;- &nbsp;${shortDate}</span>
        <span>Class &nbsp;- &nbsp;${classLabel}</span>
      </div>

      <div style="margin-top:4px;font-size:11px;">
        <span>Received from &nbsp;<strong>${studentName}</strong></span>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-top:8px;">
        <thead>
          <tr>
            <th style="border:1px solid #000;padding:3px 6px;font-size:11px;text-align:center;width:40px;">Sr. No.</th>
            <th style="border:1px solid #000;padding:3px 8px;font-size:11px;text-align:center;">Particular</th>
            <th style="border:1px solid #000;padding:3px 8px;font-size:11px;text-align:center;width:70px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <!-- empty filler rows -->
          ${Array.from({length:Math.max(0, 8-Math.max(heads.length,1))}, (_,i)=>`
          <tr>
            <td style="border:1px solid #000;padding:3px 6px;font-size:11px;">&nbsp;</td>
            <td style="border:1px solid #000;padding:3px 8px;font-size:11px;">&nbsp;</td>
            <td style="border:1px solid #000;padding:3px 8px;font-size:11px;">&nbsp;</td>
          </tr>`).join('')}
        </tbody>
      </table>

      <div style="margin-top:10px;display:flex;justify-content:space-between;font-size:11px;">
        <span>Total : <strong>₹ ${totalAmt}</strong></span>
        <span style="font-style:italic;font-size:10px;">${numberToWords(Number(pmt.amount))} Only</span>
      </div>

      <div style="margin-top:20px;display:flex;justify-content:space-between;font-size:11px;">
        <span>Student Signature</span>
        <span>Cashier / Accountant</span>
      </div>
    </div>`
  }

  function buildHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Fee Receipt — ${receiptNo}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Times New Roman',Times,serif;background:#fff;color:#000;padding:20px}
    @media print{
      body{padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .no-print{display:none}
      @page{size:A4 landscape;margin:10mm 12mm}
    }
  </style>
</head>
<body>
  <div class="no-print" style="text-align:center;margin-bottom:12px;">
    <button onclick="window.print()" style="padding:8px 24px;font-size:14px;cursor:pointer;background:#1e293b;color:#fff;border:none;border-radius:6px;">Print / Save PDF</button>
  </div>
  <div style="display:flex;gap:2%;justify-content:center;align-items:flex-start;">
    ${buildReceiptBlock('Office Copy')}
    ${buildReceiptBlock("Student's Copy")}
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

  const d = parseLocalDate(pmt.completed_at)
  const shortDate = d
    ? `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`
    : fmtDate(pmt.completed_at)
  const yrShort = { 1:'FY', 2:'SY', 3:'TY', 4:'4Y', 5:'5Y' }[app.year_of_study] || ''
  const classLabel = `${yrShort}${app.degree_course_code || ''}${app.app_division ? ' - ' + app.app_division : ''}`
  const heads = pmt.fee_heads || []
  const displayRows = heads.length
    ? heads
    : [{ fees_head: fullLabel, paid: pmt.amount, amount: pmt.amount }]
  const fillerCount = Math.max(0, 8 - displayRows.length)

  return (
    <div className="border-t border-slate-100">
      <div className="flex gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100 justify-end">
        <button onClick={handlePrint}
          className="flex items-center gap-1.5 rounded-md bg-slate-900 text-white text-xs font-semibold px-3 py-1.5 hover:bg-slate-700 transition">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
          </svg>
          Print / Save PDF
        </button>
      </div>

      {/* Receipt preview — traditional college format */}
      <div ref={sheetRef} className="bg-white p-4" style={{ fontFamily: "'Times New Roman', Times, serif", color: '#000' }}>
        <ReceiptCopy copyLabel="Office Copy" app={app} receiptNo={receiptNo} shortDate={shortDate}
          classLabel={classLabel} studentName={studentName} displayRows={displayRows}
          fillerCount={fillerCount} pmt={pmt} />
      </div>
    </div>
  )
}


// ── Traditional college receipt copy (JSX) ───────────────────
function ReceiptCopy({ copyLabel, app, receiptNo, shortDate, classLabel, studentName, displayRows, fillerCount, pmt }) {
  const td = 'border border-black px-2 py-1 text-xs'
  return (
    <div className="border border-black p-3 text-xs" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
      <div className="text-right italic text-xs mb-1">{copyLabel}</div>
      {app.trust_name && <div className="text-center text-xs">{app.trust_name}</div>}
      <div className="text-center font-bold text-sm">{app.college_name}</div>
      {(app.college_address || app.college_city) && (
        <div className="text-center text-xs">{[app.college_address, app.college_city].filter(Boolean).join(', ')}</div>
      )}
      {app.college_affiliation && <div className="text-center text-xs">({app.college_affiliation})</div>}

      <div className="flex justify-between mt-2 text-xs">
        <span>Receipt No.- <strong>{receiptNo}</strong></span>
        <span>Date &nbsp;- &nbsp;{shortDate}</span>
        {classLabel && <span>Class &nbsp;- &nbsp;{classLabel}</span>}
      </div>

      <div className="mt-1 text-xs">
        Received from &nbsp;<strong>{studentName}</strong>
      </div>

      <table className="w-full border-collapse mt-2">
        <thead>
          <tr>
            <th className={`${td} text-center w-10`}>Sr. No.</th>
            <th className={`${td} text-center`}>Particular</th>
            <th className={`${td} text-center w-20`}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {displayRows.map((h, i) => (
            <tr key={i}>
              <td className={`${td} text-center`}>{i + 1}</td>
              <td className={td}>{h.fees_head}</td>
              <td className={`${td} text-right`}>{Number(h.paid ?? h.amount).toFixed(2)}</td>
            </tr>
          ))}
          {Array.from({ length: fillerCount }).map((_, i) => (
            <tr key={`f${i}`}>
              <td className={td}>&nbsp;</td>
              <td className={td}>&nbsp;</td>
              <td className={td}>&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-between mt-2 text-xs">
        <span>Total : <strong>₹ {Number(pmt.amount).toFixed(2)}</strong></span>
        <span className="italic">{numberToWords(Number(pmt.amount))} Only</span>
      </div>

      <div className="flex justify-between mt-5 text-xs">
        <span>Student Signature</span>
        <span>Cashier / Accountant</span>
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
