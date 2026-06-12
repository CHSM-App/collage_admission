/**
 * Reports — Fees Collection report for college admin.
 * Filters: date range (daily default), course, year of study, payment type.
 * Shows: summary cards, day-wise table, course-wise table, transaction list.
 */
import { useEffect, useState, useCallback } from 'react'
import { getFeesCollectionReport, getFeesByHeadReport } from '../../../services/collegeAdminService.js'
import { getFaculty } from '../../../services/masterService.js'
import { SkeletonTable } from '../../../shared/components/Skeleton.jsx'

const YEAR_LABEL = { 1: 'FY — First Year', 2: 'SY — Second Year', 3: 'TY — Third Year', 4: '4Y — Fourth Year', 5: '5Y — Fifth Year' }
const YEAR_SHORT = { 1: 'FY', 2: 'SY', 3: 'TY', 4: '4Y', 5: '5Y' }

const REPORT_TYPES = [
  { key: 'fees',       label: 'Fees Report' },
  { key: 'ng_fees',    label: 'NG Fees Report' },
  { key: 'misc',       label: 'Misc. Fees Report' },
  { key: 'ng_misc',    label: 'NG Misc. Fees Report' },
  { key: 'exam_grant', label: 'Exam Fees (Grant)' },
  { key: 'exam_ng',    label: 'Exam Fees (Non-Grant)' },
]

const PAY_MODES = [
  { key: '',       label: 'All Modes' },
  { key: 'cash',   label: 'Cash' },
  { key: 'online', label: 'Online/GPay' },
]

function buildAYOptions() {
  const now = new Date()
  const base = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1
  return Array.from({ length: 10 }, (_, i) => {
    const y = base - 3 + i
    return `${y}-${String(y + 1).slice(-2)}`
  })
}
const AY_OPTIONS = buildAYOptions()
const CURRENT_AY = (() => { const now = new Date(); const b = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1; return `${b}-${String(b+1).slice(-2)}` })()

function today() { return new Date().toISOString().slice(0, 10) }
function fmtINR(n) { return `₹${Number(n || 0).toLocaleString('en-IN')}` }
function parseLocalDate(str) {
  if (!str) return null
  try { return new Date(str.toString().replace(' ', 'T').split('.')[0]) } catch { return null }
}
function fmtDate(str) {
  const d = parseLocalDate(str)
  return d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}
function fmtTime(str) {
  const d = parseLocalDate(str)
  return d ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''
}
function fmtDisplayDate(isoDate) {
  if (!isoDate) return '—'
  const d = new Date(isoDate + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Quick-select presets
function getPreset(key) {
  const t = new Date()
  const iso = d => d.toISOString().slice(0, 10)
  if (key === 'today')      return { from: iso(t), to: iso(t) }
  if (key === 'yesterday')  { const d = new Date(t); d.setDate(d.getDate() - 1); return { from: iso(d), to: iso(d) } }
  if (key === 'this_week')  { const d = new Date(t); d.setDate(d.getDate() - d.getDay()); return { from: iso(d), to: iso(t) } }
  if (key === 'this_month') { return { from: iso(new Date(t.getFullYear(), t.getMonth(), 1)), to: iso(t) } }
  if (key === 'last_month') {
    const s = new Date(t.getFullYear(), t.getMonth() - 1, 1)
    const e = new Date(t.getFullYear(), t.getMonth(), 0)
    return { from: iso(s), to: iso(e) }
  }
  return null
}

const PRESETS = [
  { key: 'today',      label: 'Today' },
  { key: 'yesterday',  label: 'Yesterday' },
  { key: 'this_week',  label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'custom',     label: 'Custom' },
]

export default function Reports({ collegeId }) {
  const [courses, setCourses]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [data, setData]         = useState(null)
  const [error, setError]       = useState('')

  // Filters
  const [reportType, setReportType]   = useState('fees')
  const [payMode, setPayMode]         = useState('')
  const [grantType, setGrantType]     = useState('')
  const [eduYear, setEduYear]         = useState('')
  const [preset, setPreset]           = useState('today')
  const [dateFrom, setDateFrom]       = useState(today())
  const [dateTo, setDateTo]           = useState(today())
  const [courseId, setCourseId]       = useState('')
  const [yearFilter, setYearFilter]   = useState('')
  const [paymentType, setPaymentType] = useState('college_fee')

  // UI state
  const [txnOpen, setTxnOpen] = useState(false)
  const [dlLoading, setDlLoading] = useState('')  // 'total'|'bank'|'daily'|''

  useEffect(() => {
    getFaculty(collegeId)
      .then(r => setCourses((r.data.data || []).filter(f => f.is_active)))
      .catch(() => {})
  }, [collegeId])

  function applyPreset(key) {
    setPreset(key)
    if (key !== 'custom') {
      const p = getPreset(key)
      setDateFrom(p.from)
      setDateTo(p.to)
    }
  }

  const fetchReport = useCallback(() => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({
      date_from:    dateFrom,
      date_to:      dateTo,
      payment_type: paymentType,
    })
    if (courseId)    params.set('course_id', courseId)
    if (yearFilter)  params.set('year_of_study', yearFilter)
    if (eduYear)   params.set('academic_year', eduYear)
    if (payMode)   params.set('pay_mode', payMode)
    if (grantType) params.set('grant_type', grantType)
    if (reportType !== 'fees') params.set('report_type', reportType)
    getFeesCollectionReport(collegeId, params)
      .then(r => setData(r.data.data))
      .catch(() => setError('Failed to load report.'))
      .finally(() => setLoading(false))
  }, [collegeId, dateFrom, dateTo, courseId, yearFilter, paymentType, eduYear, payMode, grantType, reportType])

  // Auto-fetch on mount and whenever filters change
  useEffect(() => { fetchReport() }, [fetchReport])

  const s = data?.summary
  const isSingleDay = dateFrom === dateTo

  function buildFilterParams() {
    const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo, payment_type: paymentType })
    if (courseId)    params.set('course_id', courseId)
    if (yearFilter)  params.set('year_of_study', yearFilter)
    if (eduYear)     params.set('academic_year', eduYear)
    if (payMode)     params.set('pay_mode', payMode)
    if (grantType)   params.set('grant_type', grantType)
    return params
  }

  function numFmt(n) { return Number(n || 0).toLocaleString('en-IN') }
  function amtToWords(n) {
    const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
      'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
    const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
    function convert(num) {
      if (num === 0) return ''
      if (num < 20) return ones[num]
      if (num < 100) return tens[Math.floor(num/10)] + (num%10 ? ' '+ones[num%10] : '')
      if (num < 1000) return ones[Math.floor(num/100)]+' Hundred'+(num%100?' '+convert(num%100):'')
      if (num < 100000) return convert(Math.floor(num/1000))+' Thousand'+(num%1000?' '+convert(num%1000):'')
      if (num < 10000000) return convert(Math.floor(num/100000))+' Lakh'+(num%100000?' '+convert(num%100000):'')
      return convert(Math.floor(num/10000000))+' Crore'+(num%10000000?' '+convert(num%10000000):'')
    }
    const amt = Math.round(n)
    return (convert(amt) || 'Zero') + ' Rupees Only'
  }

  function collegePrintHeader(college, title, dateLabel) {
    const name = college?.name || ''
    const addr = college?.address || ''
    return `
      <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:10px;">
        <div style="font-size:15px;font-weight:bold;">${name}</div>
        ${addr ? `<div style="font-size:11px;">${addr}</div>` : ''}
        <div style="font-size:13px;font-weight:bold;margin-top:6px;text-decoration:underline;">${title}</div>
        <div style="font-size:11px;margin-top:2px;">Period: ${dateLabel}${eduYear ? ' | Edu. Year: '+eduYear : ''}${grantType === 'Granted' ? ' | Grant' : grantType === 'NonGranted' ? ' | Non-Grant' : ''}</div>
      </div>`
  }

  async function handleTotalFeesReport() {
    setDlLoading('total')
    try {
      const r = await getFeesByHeadReport(collegeId, buildFilterParams())
      const { college, head_totals } = r.data.data
      const dateLabel = dateFrom === dateTo ? fmtDisplayDate(dateFrom) : `${fmtDisplayDate(dateFrom)} to ${fmtDisplayDate(dateTo)}`
      const grandTotal = head_totals.reduce((s, h) => s + (h.total_collected || 0), 0)
      const printDate = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })

      const rows = head_totals.map((h, i) => `
        <tr>
          <td style="border:1px solid #999;padding:4px 8px;text-align:center;">${i+1}</td>
          <td style="border:1px solid #999;padding:4px 8px;">${h.fees_head}${h.academic_year ? ' - ' + h.academic_year : ''}</td>
          <td style="border:1px solid #999;padding:4px 8px;text-align:right;font-family:monospace;">${numFmt(h.total_collected)}</td>
        </tr>`).join('')

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
        <title>Total Fees Collection</title>
        <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:12px;padding:20px}
        @media print{body{padding:0}@page{size:A4 portrait;margin:12mm}}</style>
      </head><body>
        ${collegePrintHeader(college, 'TOTAL FEES COLLECTION REPORT', dateLabel)}
        <table style="width:100%;border-collapse:collapse;margin-top:8px;">
          <thead>
            <tr style="background:#f0f0f0;">
              <th style="border:1px solid #999;padding:5px 8px;width:50px;">Sr.No.</th>
              <th style="border:1px solid #999;padding:5px 8px;text-align:left;">Particular</th>
              <th style="border:1px solid #999;padding:5px 8px;text-align:right;width:140px;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr style="font-weight:bold;background:#f8f8f8;">
              <td colspan="2" style="border:1px solid #999;padding:5px 8px;text-align:right;">Grand Total</td>
              <td style="border:1px solid #999;padding:5px 8px;text-align:right;font-family:monospace;">${numFmt(grandTotal)}</td>
            </tr>
            <tr>
              <td colspan="3" style="border:1px solid #999;padding:5px 8px;font-style:italic;">
                Rupees: ${amtToWords(grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
        <div style="margin-top:30px;display:flex;justify-content:space-between;font-size:11px;">
          <span>Printed on: ${printDate}</span>
          <span>Cashier's Signature</span>
          <span>Principal's Signature</span>
        </div>
      </body></html>`

      openPrint(html)
    } catch { alert('Failed to generate report.') }
    finally { setDlLoading('') }
  }

  async function handleBankwiseReport() {
    setDlLoading('bank')
    try {
      const r = await getFeesByHeadReport(collegeId, buildFilterParams())
      const { college, bank_groups } = r.data.data
      const dateLabel = dateFrom === dateTo ? fmtDisplayDate(dateFrom) : `${fmtDisplayDate(dateFrom)} to ${fmtDisplayDate(dateTo)}`
      const grandTotal = bank_groups.reduce((s, bg) => s + (bg.total || 0), 0)
      const printDate = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })

      let srNo = 0
      const bankSections = bank_groups.map(bg => {
        const bankLabel = bg.bank_name + (bg.bank_account_number ? ` (A/c: ${bg.bank_account_number})` : '') + (bg.branch ? ` — ${bg.branch}` : '')
        const headRows = bg.heads.map(h => {
          srNo++
          return `<tr>
            <td style="border:1px solid #999;padding:4px 8px;text-align:center;">${srNo}</td>
            <td style="border:1px solid #999;padding:4px 8px;">${h.fees_head}${h.academic_year ? ' - ' + h.academic_year : ''}</td>
            <td style="border:1px solid #999;padding:4px 8px;text-align:right;font-family:monospace;">${numFmt(h.total_collected)}</td>
          </tr>`
        }).join('')
        return `
          <tr style="background:#e8e8e8;">
            <td colspan="3" style="border:1px solid #999;padding:5px 8px;font-weight:bold;">${bankLabel}</td>
          </tr>
          ${headRows}
          <tr style="font-weight:bold;background:#f5f5f5;">
            <td colspan="2" style="border:1px solid #999;padding:4px 8px;text-align:right;">Bank Total</td>
            <td style="border:1px solid #999;padding:4px 8px;text-align:right;font-family:monospace;">${numFmt(bg.total)}</td>
          </tr>`
      }).join('')

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
        <title>Bankwise Statement</title>
        <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:12px;padding:20px}
        @media print{body{padding:0}@page{size:A4 portrait;margin:12mm}}</style>
      </head><body>
        ${collegePrintHeader(college, 'TOTAL FEES BANKWISE STATEMENT', dateLabel)}
        <table style="width:100%;border-collapse:collapse;margin-top:8px;">
          <thead>
            <tr style="background:#f0f0f0;">
              <th style="border:1px solid #999;padding:5px 8px;width:50px;">Sr.No.</th>
              <th style="border:1px solid #999;padding:5px 8px;text-align:left;">Particular</th>
              <th style="border:1px solid #999;padding:5px 8px;text-align:right;width:140px;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>${bankSections}</tbody>
          <tfoot>
            <tr style="font-weight:bold;background:#f0f0f0;">
              <td colspan="2" style="border:1px solid #999;padding:5px 8px;text-align:right;">Grand Total</td>
              <td style="border:1px solid #999;padding:5px 8px;text-align:right;font-family:monospace;">${numFmt(grandTotal)}</td>
            </tr>
            <tr>
              <td colspan="3" style="border:1px solid #999;padding:5px 8px;font-style:italic;">
                Rupees: ${amtToWords(grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
        <div style="margin-top:30px;display:flex;justify-content:space-between;font-size:11px;">
          <span>Printed on: ${printDate}</span>
          <span>Cashier's Signature</span>
          <span>Principal's Signature</span>
        </div>
      </body></html>`

      openPrint(html)
    } catch { alert('Failed to generate report.') }
    finally { setDlLoading('') }
  }

  async function handleDailyRegister() {
    setDlLoading('daily')
    try {
      const r = await getFeesByHeadReport(collegeId, buildFilterParams())
      const { college, student_rows, head_totals } = r.data.data
      const dateLabel = dateFrom === dateTo ? fmtDisplayDate(dateFrom) : `${fmtDisplayDate(dateFrom)} to ${fmtDisplayDate(dateTo)}`
      const printDate = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })

      // Get unique fee heads (ordered by backend)
      const heads = head_totals
      const headCodes = heads.map(h => h.fees_code)

      // Compute totals row
      const colTotals = {}
      for (const h of heads) colTotals[h.fees_code] = h.total_collected || 0
      const grandTotal = heads.reduce((s, h) => s + (h.total_collected || 0), 0)

      const YEAR_SHORT = { 1:'FY', 2:'SY', 3:'TY', 4:'4Y', 5:'5Y' }

      // Build column headers (abbreviated)
      const thCols = heads.map(h => `<th style="border:1px solid #999;padding:3px 4px;text-align:center;font-size:9px;min-width:52px;">${h.short_name || h.fees_head}</th>`).join('')

      // Group by date
      const byDate = new Map()
      for (const row of student_rows) {
        const dt = row.completed_at ? row.completed_at.toString().slice(0, 10) : 'Unknown'
        if (!byDate.has(dt)) byDate.set(dt, [])
        byDate.get(dt).push(row)
      }

      let srNo = 0
      let allRows = ''
      const dateTotals = {} // date → { fees_code → total }

      for (const [dt, rows] of byDate) {
        // Date header row
        allRows += `<tr style="background:#e8f0e8;">
          <td colspan="${3 + heads.length + 1}" style="border:1px solid #999;padding:3px 8px;font-weight:bold;font-size:10px;">
            Date: ${fmtDisplayDate(dt)}
          </td>
        </tr>`
        if (!dateTotals[dt]) dateTotals[dt] = {}
        for (const row of rows) {
          srNo++
          const isCash = row.gateway === 'cash' || (row.gateway_txnid || '').startsWith('CASH-')
          const classLabel = `${YEAR_SHORT[row.year_of_study] || ''}${row.degree_course_code || ''}${row.app_division ? ' '+row.app_division : ''}`
          const amtCols = heads.map(h => {
            const paid = row.head_amounts?.[h.fees_code] || 0
            dateTotals[dt][h.fees_code] = (dateTotals[dt][h.fees_code] || 0) + paid
            return `<td style="border:1px solid #999;padding:3px 4px;text-align:right;font-family:monospace;font-size:10px;">${paid > 0 ? numFmt(paid) : ''}</td>`
          }).join('')
          const rowTotal = Object.values(row.head_amounts || {}).reduce((s, v) => s + v, 0)
          allRows += `<tr>
            <td style="border:1px solid #999;padding:3px 4px;text-align:center;font-size:10px;">${srNo}</td>
            <td style="border:1px solid #999;padding:3px 6px;font-size:10px;">${row.student_name || '—'}</td>
            <td style="border:1px solid #999;padding:3px 4px;font-size:10px;text-align:center;">${classLabel}</td>
            ${amtCols}
            <td style="border:1px solid #999;padding:3px 4px;text-align:right;font-family:monospace;font-size:10px;font-weight:bold;">${numFmt(rowTotal)}</td>
          </tr>`
        }
        // Date subtotal row
        const dtTotalCols = heads.map(h => `<td style="border:1px solid #999;padding:3px 4px;text-align:right;font-family:monospace;font-size:10px;background:#f5f8f5;">${numFmt(dateTotals[dt][h.fees_code] || 0)}</td>`).join('')
        const dtGrandTotal = Object.values(dateTotals[dt]).reduce((s, v) => s + v, 0)
        allRows += `<tr style="font-weight:bold;background:#f5f8f5;">
          <td colspan="3" style="border:1px solid #999;padding:3px 8px;text-align:right;font-size:10px;">Daily Total</td>
          ${dtTotalCols}
          <td style="border:1px solid #999;padding:3px 4px;text-align:right;font-family:monospace;font-size:10px;">${numFmt(dtGrandTotal)}</td>
        </tr>`
      }

      // Grand total row
      const grandTotalCols = heads.map(h => `<td style="border:2px solid #666;padding:4px;text-align:right;font-family:monospace;font-size:10px;background:#f0f0e8;">${numFmt(colTotals[h.fees_code] || 0)}</td>`).join('')
      allRows += `<tr style="font-weight:bold;background:#f0f0e8;">
        <td colspan="3" style="border:2px solid #666;padding:4px 8px;text-align:right;font-size:11px;">Grand Total</td>
        ${grandTotalCols}
        <td style="border:2px solid #666;padding:4px;text-align:right;font-family:monospace;font-size:11px;">${numFmt(grandTotal)}</td>
      </tr>`

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
        <title>Daily Fees Register</title>
        <style>*{box-sizing:border-box;margin:0;padding:0}
        body{font-family:Arial,sans-serif;font-size:10px;padding:12px}
        @media print{body{padding:0}@page{size:A4 landscape;margin:8mm}}</style>
      </head><body>
        ${collegePrintHeader(college, 'FEES COLLECTION DAILY REGISTER', dateLabel)}
        <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;margin-top:8px;">
          <thead>
            <tr style="background:#f0f0f0;">
              <th style="border:1px solid #999;padding:4px;width:36px;text-align:center;font-size:10px;">Sr.</th>
              <th style="border:1px solid #999;padding:4px;text-align:left;font-size:10px;min-width:140px;">Student Name</th>
              <th style="border:1px solid #999;padding:4px;text-align:center;font-size:10px;width:60px;">Class</th>
              ${thCols}
              <th style="border:1px solid #999;padding:4px;text-align:right;font-size:10px;min-width:60px;">Total</th>
            </tr>
          </thead>
          <tbody>${allRows}</tbody>
        </table>
        </div>
        <div style="margin-top:8px;font-size:9px;color:#555;">
          <strong>Legend:</strong> ${heads.map(h => `${h.short_name} = ${h.fees_head}`).join(' | ')}
        </div>
        <div style="margin-top:24px;display:flex;justify-content:space-between;font-size:11px;">
          <span>Printed on: ${printDate}</span>
          <span>Cashier's Signature</span>
          <span>Principal's Signature</span>
        </div>
      </body></html>`

      openPrint(html)
    } catch { alert('Failed to generate report.') }
    finally { setDlLoading('') }
  }

  function openPrint(html) {
    const win = window.open('', '_blank', 'width=1200,height=900')
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 600)
  }

  function handlePrint() {
    if (!data) return
    const collegeName = data.college_name || ''
    const collegeAddr = data.college_address || ''
    const courseName  = courseId ? (courses.find(c => String(c.code_no) === String(courseId))?.degree_course_name || '') : 'All Classes'
    const yearName    = yearFilter ? (YEAR_SHORT[yearFilter] || yearFilter) : 'All Years'
    const ptLabel     = paymentType === 'college_fee' ? 'College Fee' : paymentType === 'application_fee' ? 'Application Fee' : 'All Types'
    const modeLabel   = payMode === 'cash' ? 'Cash' : payMode === 'online' ? 'Online' : 'All Modes'
    const grantLabel  = grantType === 'Granted' ? 'Grant' : grantType === 'NonGranted' ? 'Non-Grant' : 'All'
    const dateLabel   = isSingleDay ? fmtDisplayDate(dateFrom) : `${fmtDisplayDate(dateFrom)} to ${fmtDisplayDate(dateTo)}`
    const printDate   = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

    const th = (txt, right) => `<th style="border:1px solid #999;padding:5px 8px;background:#f0f0f0;font-size:11px;${right ? 'text-align:right;' : 'text-align:left;'}">${txt}</th>`
    const td = (txt, right, bold, mono) => `<td style="border:1px solid #ccc;padding:4px 8px;font-size:11px;${right ? 'text-align:right;' : ''}${bold ? 'font-weight:bold;' : ''}${mono ? 'font-family:monospace;' : ''}">${txt}</td>`
    const sectionTitle = txt => `<div style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #000;padding-bottom:3px;margin:18px 0 8px;">${txt}</div>`

    const summaryBlock = `
      <table style="width:100%;border-collapse:collapse;margin-bottom:4px;">
        <tr>
          ${['Total Collected', 'Transactions', 'Students', 'Cash', 'Online'].map(l => th(l, true)).join('')}
        </tr>
        <tr>
          ${[
            `&#8377;${Number(s.total_collected).toLocaleString('en-IN')}`,
            s.txn_count,
            s.student_count,
            `&#8377;${Number(s.cash_amount).toLocaleString('en-IN')}`,
            `&#8377;${Number(s.online_amount).toLocaleString('en-IN')}`,
          ].map(v => td(v, true, true, false)).join('')}
        </tr>
      </table>`

    const daySection = (!isSingleDay && data.by_day.length > 0) ? `
      ${sectionTitle('Day-wise Breakdown')}
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr>
          ${th('Date')}${th('Transactions', true)}${th('Cash (&#8377;)', true)}${th('Online (&#8377;)', true)}${th('Total (&#8377;)', true)}
        </tr></thead>
        <tbody>
          ${data.by_day.map(r => `<tr>
            ${td(fmtDisplayDate(r.date))}
            ${td(r.txn_count, true)}
            ${td(Number(r.cash).toLocaleString('en-IN'), true, false, true)}
            ${td(Number(r.online).toLocaleString('en-IN'), true, false, true)}
            ${td(Number(r.total).toLocaleString('en-IN'), true, true, true)}
          </tr>`).join('')}
        </tbody>
        <tfoot><tr style="background:#f5f5f5;">
          ${td('Total', false, true)}
          ${td(s.txn_count, true, true)}
          ${td(Number(s.cash_amount).toLocaleString('en-IN'), true, true, true)}
          ${td(Number(s.online_amount).toLocaleString('en-IN'), true, true, true)}
          ${td(Number(s.total_collected).toLocaleString('en-IN'), true, true, true)}
        </tr></tfoot>
      </table>` : ''

    const courseSection = data.by_course.length > 0 ? `
      ${sectionTitle('Course-wise Breakdown')}
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr>
          ${th('Course')}${th('Year')}${th('Transactions', true)}${th('Total (&#8377;)', true)}
        </tr></thead>
        <tbody>
          ${data.by_course.map(r => `<tr>
            ${td(r.course_name)}
            ${td(YEAR_SHORT[r.year_of_study] || r.year_of_study)}
            ${td(r.txn_count, true)}
            ${td(Number(r.total).toLocaleString('en-IN'), true, true, true)}
          </tr>`).join('')}
        </tbody>
      </table>` : ''

    const txnSection = data.transactions.length > 0 ? `
      ${sectionTitle(`Transactions (${data.transactions.length}${data.transactions.length === 200 ? '+' : ''})`)}
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr>
          ${th('#')}${th('Student')}${th('Course / Year')}${th('Reg. No.')}${th('Mode')}${th('Date & Time')}${th('Amount (&#8377;)', true)}
        </tr></thead>
        <tbody>
          ${data.transactions.map((t, i) => {
            const isCash = t.gateway === 'cash' || (t.gateway_txnid || '').startsWith('CASH-')
            return `<tr style="${i % 2 !== 0 ? 'background:#f9f9f9;' : ''}">
              ${td(i + 1)}
              ${td(t.student_name || '—')}
              ${td(`${t.course_name} · ${YEAR_SHORT[t.year_of_study] || ''}${t.app_division ? ' Div ' + t.app_division : ''}`)}
              ${td(t.registration_number || '—')}
              ${td(isCash ? 'Cash' : 'Online')}
              ${td(fmtDate(t.completed_at) + ' ' + fmtTime(t.completed_at))}
              ${td(Number(t.amount).toLocaleString('en-IN'), true, true, true)}
            </tr>`
          }).join('')}
        </tbody>
      </table>` : ''

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>Fees Collection Report</title>
      <style>*{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;font-size:12px;padding:20px}
      @media print{body{padding:0}@page{size:A4 landscape;margin:10mm 12mm}}</style>
    </head><body>
      <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:10px;">
        ${collegeName ? `<div style="font-size:15px;font-weight:bold;">${collegeName}</div>` : ''}
        ${collegeAddr ? `<div style="font-size:11px;">${collegeAddr}</div>` : ''}
        <div style="font-size:13px;font-weight:bold;margin-top:6px;text-decoration:underline;">FEES COLLECTION SUMMARY</div>
        <div style="font-size:11px;margin-top:2px;">Period: ${dateLabel}${eduYear ? ' | Edu. Year: ' + eduYear : ''}</div>
      </div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:11px;margin-bottom:10px;">
        <span>Class: <strong>${courseName}</strong></span>
        <span>Year: <strong>${yearName}</strong></span>
        <span>Type: <strong>${ptLabel}</strong></span>
        <span>Mode: <strong>${modeLabel}</strong></span>
        <span>Grant: <strong>${grantLabel}</strong></span>
        <span style="margin-left:auto;color:#555;">Printed: ${printDate}</span>
      </div>
      ${summaryBlock}
      ${daySection}
      ${courseSection}
      ${txnSection}
      <div style="margin-top:30px;display:flex;justify-content:space-between;font-size:11px;">
        <span></span>
        <span>Cashier's Signature</span>
        <span>Principal's Signature</span>
      </div>
    </body></html>`

    openPrint(html)
  }

  return (
    <section className="space-y-5 max-w-5xl">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">College Reports</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Fees Collection</h1>
        </div>
        {data && !loading && (
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              onClick={handleTotalFeesReport}
              disabled={!!dlLoading}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold px-3 py-2 hover:bg-emerald-600 transition disabled:opacity-50"
            >
              {dlLoading === 'total' ? '…' : '⬇'} Total Fees
            </button>
            <button
              onClick={handleBankwiseReport}
              disabled={!!dlLoading}
              className="flex items-center gap-1.5 rounded-lg bg-blue-700 text-white text-xs font-semibold px-3 py-2 hover:bg-blue-600 transition disabled:opacity-50"
            >
              {dlLoading === 'bank' ? '…' : '⬇'} Bankwise
            </button>
            <button
              onClick={handleDailyRegister}
              disabled={!!dlLoading}
              className="flex items-center gap-1.5 rounded-lg bg-violet-700 text-white text-xs font-semibold px-3 py-2 hover:bg-violet-600 transition disabled:opacity-50"
            >
              {dlLoading === 'daily' ? '…' : '⬇'} Daily Register
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-lg bg-slate-900 text-white text-sm font-semibold px-4 py-2 hover:bg-slate-700 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
              </svg>
              Print Summary
            </button>
          </div>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 space-y-4">

        {/* Report type radio row */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Report Type</p>
          <div className="flex flex-wrap gap-3">
            {REPORT_TYPES.map(rt => (
              <label key={rt.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="radio" name="reportType" value={rt.key}
                  checked={reportType === rt.key}
                  onChange={() => setReportType(rt.key)}
                  className="accent-slate-800" />
                <span className={reportType === rt.key ? 'font-semibold text-slate-900' : 'text-slate-600'}>{rt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Payment mode + Grant type */}
        <div className="border-t border-slate-100 pt-3 flex flex-wrap gap-6">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Payment Mode</p>
            <div className="flex gap-4">
              {PAY_MODES.map(m => (
                <label key={m.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" name="payMode" value={m.key}
                    checked={payMode === m.key}
                    onChange={() => setPayMode(m.key)}
                    className="accent-slate-800" />
                  <span className={payMode === m.key ? 'font-semibold text-slate-900' : 'text-slate-600'}>{m.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Grant Type</p>
            <div className="flex gap-4">
              {[{ key: '', label: 'All' }, { key: 'Granted', label: 'Grant' }, { key: 'NonGranted', label: 'Non-Grant' }].map(g => (
                <label key={g.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" name="grantType" value={g.key}
                    checked={grantType === g.key}
                    onChange={() => setGrantType(g.key)}
                    className="accent-slate-800" />
                  <span className={grantType === g.key ? 'font-semibold text-slate-900' : 'text-slate-600'}>{g.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Date range */}
        <div className="border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Date Range</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {PRESETS.map(p => (
              <button key={p.key} onClick={() => applyPreset(p.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  preset === p.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-slate-500 mb-1">From</label>
              <input type="date" value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPreset('custom') }}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">To</label>
              <input type="date" value={dateTo} min={dateFrom}
                onChange={e => { setDateTo(e.target.value); setPreset('custom') }}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            {/* Edu Year */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Edu. Year</label>
              <select value={eduYear} onChange={e => setEduYear(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                <option value="">All Years</option>
                {AY_OPTIONS.map(ay => <option key={ay} value={ay}>{ay}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Class / Year / Payment type */}
        <div className="flex flex-wrap gap-3 items-end pt-1 border-t border-slate-100">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Class / Course</label>
            <select value={courseId} onChange={e => setCourseId(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
              <option value="">All Classes</option>
              {courses.map(c => (
                <option key={c.code_no} value={c.code_no}>{c.degree_course_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Year</label>
            <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
              <option value="">All Years</option>
              {[1,2,3,4,5].map(y => <option key={y} value={y}>{YEAR_LABEL[y]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Payment Type</label>
            <select value={paymentType} onChange={e => setPaymentType(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
              <option value="college_fee">College Fee</option>
              <option value="application_fee">Application Fee</option>
              <option value="all">All Types</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {loading && (
        <div className="rounded-xl border border-slate-200 bg-white p-4"><SkeletonTable rows={5} cols={4} /></div>
      )}

      {!loading && data && (
        <>
          {/* ── Summary cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <SummaryCard
              label="Total Collected"
              value={fmtINR(s.total_collected)}
              accent="emerald"
              wide
            />
            <SummaryCard label="Transactions"   value={s.txn_count}     accent="slate" />
            <SummaryCard label="Students"        value={s.student_count} accent="slate" />
            <SummaryCard label="Cash / Offline"  value={fmtINR(s.cash_amount)}   accent="amber" />
            <SummaryCard label="Online (PayU)"   value={fmtINR(s.online_amount)} accent="blue" />
          </div>

          {/* ── Day-wise breakdown (only if range > 1 day) ── */}
          {!isSingleDay && data.by_day.length > 0 && (
            <TableCard title="Day-wise Breakdown">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <Th>Date</Th>
                  <Th right>Transactions</Th>
                  <Th right>Cash (₹)</Th>
                  <Th right>Online (₹)</Th>
                  <Th right>Total (₹)</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.by_day.map(row => (
                  <tr key={row.date} className="hover:bg-slate-50">
                    <Td>{fmtDisplayDate(row.date)}</Td>
                    <Td right>{row.txn_count}</Td>
                    <Td right mono>{Number(row.cash).toLocaleString('en-IN')}</Td>
                    <Td right mono>{Number(row.online).toLocaleString('en-IN')}</Td>
                    <Td right mono bold>{Number(row.total).toLocaleString('en-IN')}</Td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200 text-sm font-bold">
                <tr>
                  <td className="px-3 py-2 text-slate-700">Total</td>
                  <td className="px-3 py-2 text-right text-slate-700">{s.txn_count}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-800">{Number(s.cash_amount).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-800">{Number(s.online_amount).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2 text-right font-mono text-emerald-700">{Number(s.total_collected).toLocaleString('en-IN')}</td>
                </tr>
              </tfoot>
            </TableCard>
          )}

          {/* ── Course-wise breakdown ── */}
          {data.by_course.length > 0 && (
            <TableCard title="Course-wise Breakdown">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <Th>Course</Th>
                  <Th>Year</Th>
                  <Th right>Transactions</Th>
                  <Th right>Total (₹)</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.by_course.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <Td>{row.course_name}</Td>
                    <Td>{YEAR_SHORT[row.year_of_study] || row.year_of_study}</Td>
                    <Td right>{row.txn_count}</Td>
                    <Td right mono bold>{Number(row.total).toLocaleString('en-IN')}</Td>
                  </tr>
                ))}
              </tbody>
            </TableCard>
          )}

          {/* ── Transactions ── */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <button
              onClick={() => setTxnOpen(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition border-b border-slate-200"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Transactions
                <span className="ml-2 font-normal text-slate-400">({data.transactions.length}{data.transactions.length === 200 ? '+' : ''})</span>
              </p>
              <svg className={`w-4 h-4 text-slate-400 transition-transform ${txnOpen ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {txnOpen && (
              data.transactions.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-400 text-center">No transactions in this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                      <tr>
                        <Th>Student</Th>
                        <Th>Course / Year</Th>
                        <Th>Reg. No.</Th>
                        <Th>Type</Th>
                        <Th>Mode</Th>
                        <Th>Date &amp; Time</Th>
                        <Th right>Amount (₹)</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {data.transactions.map(t => {
                        const isCash = t.gateway === 'cash' || t.gateway_txnid?.startsWith('CASH-')
                        return (
                          <tr key={t.id} className="hover:bg-slate-50">
                            <Td>{t.student_name}</Td>
                            <Td>{t.course_name} · {YEAR_SHORT[t.year_of_study]}{t.app_division ? ` Div ${t.app_division}` : ''}</Td>
                            <Td mono>{t.registration_number || '—'}</Td>
                            <Td>
                              <span className={`rounded-full px-2 py-0.5 font-semibold ${
                                t.payment_type === 'college_fee' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                              }`}>
                                {t.payment_type === 'college_fee' ? 'College' : 'Application'}
                              </span>
                            </Td>
                            <Td>
                              <span className={`rounded-full px-2 py-0.5 font-semibold ${isCash ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'}`}>
                                {isCash ? 'Cash' : 'Online'}
                              </span>
                            </Td>
                            <Td>{fmtDate(t.completed_at)} {fmtTime(t.completed_at)}</Td>
                            <Td right mono bold>{Number(t.amount).toLocaleString('en-IN')}</Td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>

          {/* No data state */}
          {s.total_collected === 0 && s.txn_count === 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-10 text-center">
              <p className="text-slate-400 text-sm">No fee collections found for the selected filters.</p>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function SummaryCard({ label, value, accent, wide }) {
  const colors = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber:   'bg-amber-50  border-amber-200  text-amber-700',
    blue:    'bg-blue-50   border-blue-200   text-blue-700',
    slate:   'bg-white     border-slate-200  text-slate-800',
  }
  return (
    <div className={`rounded-xl border p-4 text-center ${colors[accent]} ${wide ? 'col-span-2 sm:col-span-1' : ''}`}>
      <p className="text-xs text-slate-400 font-medium mb-1">{label}</p>
      <p className={`text-xl font-black ${accent === 'emerald' ? 'text-emerald-700' : accent === 'amber' ? 'text-amber-700' : accent === 'blue' ? 'text-blue-700' : 'text-slate-950'}`}>
        {value}
      </p>
    </div>
  )
}

function TableCard({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">{children}</table>
      </div>
    </div>
  )
}

function Th({ children, right }) {
  return <th className={`px-3 py-2 font-semibold whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>{children}</th>
}
function Td({ children, right, mono, bold }) {
  return (
    <td className={`px-3 py-2 ${right ? 'text-right' : ''} ${mono ? 'font-mono' : ''} ${bold ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
      {children}
    </td>
  )
}
