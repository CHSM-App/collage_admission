/**
 * ExportDialog — export applications as Excel or PDF.
 *
 * Props:
 *   collegeId      {number}
 *   collegeName    {string}
 *   courseOptions  {[id, name][]}  — from inbox
 *   yearOptions    {number[]}      — from inbox
 *   onClose        {() => void}
 */
import { useState } from 'react'
import * as XLSX from 'xlsx'
import { exportApplications } from '../../../services/collegeAdminService.js'

const YEAR_LABEL = { 1: 'FY', 2: 'SY', 3: 'TY', 4: '4Y', 5: '5Y' }

const STATUS_OPTIONS = [
  { value: 'submitted,under_review',  label: 'Review Pending' },
  { value: 'correction_requested',    label: 'Correction Pending' },
  { value: 'correction_done',         label: 'Correction Review' },
  { value: 'doc_verified',            label: 'Student Awaited' },
  { value: 'confirmed',               label: 'Fees Pending' },
  { value: 'fees_paid',               label: 'Admission Confirmed' },
  { value: 'roll_assigned',           label: 'Roll Assigned' },
  { value: 'rejected',                label: 'Rejected' },
]

const STATUS_LABEL = {
  submitted:             'Review Pending',
  under_review:          'Review Pending',
  correction_requested:  'Correction Pending',
  correction_done:       'Correction Review',
  doc_verified:          'Student Awaited',
  confirmed:             'Fees Pending',
  fees_paid:             'Admission Confirmed',
  roll_assigned:         'Roll Assigned',
  rejected:              'Rejected',
}

function fmtDate(val) {
  if (!val) return ''
  try { return new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return val }
}

function buildRows(data) {
  return data.map((r, i) => ({
    'Sr.No':              i + 1,
    'Reg. No.':           r.registration_number || '',
    'Student Name':       r.student_name        || '',
    'Phone':              r.phone               || '',
    'Email':              r.student_email       || '',
    'Course':             r.course_name         || '',
    'Year':               YEAR_LABEL[r.year_of_study] || r.year_of_study || '',
    'Academic Year':      r.academic_year       || '',
    'Status':             STATUS_LABEL[r.status] || r.status || '',
    'Roll No.':           r.roll_number         || '',
    'Submitted On':       fmtDate(r.submitted_at),
    'SSC %':              r.ssc_percentage      ?? '',
    'HSC %':              r.hsc_percentage      ?? '',
  }))
}

function exportExcel(data, filename) {
  const rows = buildRows(data)
  const ws   = XLSX.utils.json_to_sheet(rows)

  // Auto-width
  const colWidths = Object.keys(rows[0] || {}).map(key => ({
    wch: Math.max(key.length, ...rows.map(r => String(r[key] ?? '').length)) + 2
  }))
  ws['!cols'] = colWidths

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Applications')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

function exportPDF(data, filename, collegeName, filterLabel) {
  // Build HTML table then print it
  const rows = buildRows(data)
  if (!rows.length) return

  const headers = Object.keys(rows[0])
  const tableRows = rows.map(r =>
    `<tr>${headers.map(h => `<td>${r[h]}</td>`).join('')}</tr>`
  ).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${filename}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 9px; margin: 10px; }
  h2 { font-size: 13px; margin: 0 0 2px; }
  p  { font-size: 9px; margin: 0 0 8px; color: #555; }
  table { border-collapse: collapse; width: 100%; }
  th { background: #1e40af; color: #fff; padding: 4px 6px; text-align: left; font-size: 8px; white-space: nowrap; }
  td { padding: 3px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
</style>
</head>
<body>
  <h2>${collegeName} — Application List</h2>
  <p>${filterLabel} &nbsp;·&nbsp; Exported on ${new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</p>
  <table>
    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) { alert('Please allow pop-ups to export PDF.'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 500)
}

export default function ExportDialog({ collegeId, collegeName, courseOptions, yearOptions, onClose }) {
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCourse, setFilterCourse] = useState('')
  const [filterYear,   setFilterYear]   = useState('')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')

  async function fetchAndExport(format) {
    setError('')
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterStatus) params.set('status',       filterStatus)
      if (filterCourse) params.set('course_id',    filterCourse)
      if (filterYear)   params.set('year_of_study', filterYear)

      const res  = await exportApplications(collegeId, params.toString())
      const data = res.data.data || []

      if (!data.length) { setError('No applications match the selected filters.'); return }

      // Build a human-readable label for the filter combination
      const parts = []
      if (filterStatus) parts.push(STATUS_OPTIONS.find(s => s.value === filterStatus)?.label || filterStatus)
      if (filterCourse) parts.push(courseOptions.find(([id]) => String(id) === String(filterCourse))?.[1] || filterCourse)
      if (filterYear)   parts.push(YEAR_LABEL[filterYear] || filterYear)
      const filterLabel = parts.length ? parts.join(' · ') : 'All Applications'

      const dateStr  = new Date().toISOString().slice(0, 10)
      const filename = `Applications_${collegeName.replace(/\s+/g, '_')}_${dateStr}`

      if (format === 'excel') exportExcel(data, filename)
      else                    exportPDF(data, filename, collegeName, filterLabel)

      onClose()
    } catch {
      setError('Failed to fetch data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Export Applications</h2>
            <p className="text-xs text-slate-500 mt-0.5">Choose filters then select export format</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
        </div>

        {/* Filters */}
        <div className="px-6 py-5 space-y-4">

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Application Status</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Course */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Course</label>
            <select
              value={filterCourse}
              onChange={e => setFilterCourse(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Courses</option>
              {courseOptions.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Year of Study</label>
            <select
              value={filterYear}
              onChange={e => setFilterYear(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Years</option>
              {yearOptions.map(y => (
                <option key={y} value={y}>{YEAR_LABEL[y]} — Year {y}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{error}</p>
          )}
        </div>

        {/* Export buttons */}
        <div className="px-6 pb-6 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Export As</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => fetchAndExport('excel')}
              disabled={loading}
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-4 hover:border-emerald-400 hover:bg-emerald-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-2xl">📊</span>
              <span className="text-sm font-bold text-emerald-800">Excel (.xlsx)</span>
              <span className="text-xs text-emerald-600 text-center">All columns including exam details</span>
            </button>
            <button
              onClick={() => fetchAndExport('pdf')}
              disabled={loading}
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-red-200 bg-red-50 px-4 py-4 hover:border-red-400 hover:bg-red-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-2xl">📄</span>
              <span className="text-sm font-bold text-red-800">PDF (Print)</span>
              <span className="text-xs text-red-600 text-center">Opens print dialog in new tab</span>
            </button>
          </div>
          {loading && (
            <p className="text-center text-sm text-slate-500 animate-pulse">Fetching data…</p>
          )}
        </div>

      </div>
    </div>
  )
}
