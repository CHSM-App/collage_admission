/**
 * ApplicationPrintView — read-only view + professional PDF print of a submitted application.
 * buildHTML() generates a fully self-contained HTML document with pure inline styles —
 * no dependency on the React DOM or Tailwind classes in the print output.
 */
import { useEffect, useState } from 'react'
import api from '../../../services/api.js'

const YEAR_LABEL = { 1: 'FY — First Year', 2: 'SY — Second Year', 3: 'TY — Third Year' }

export default function ApplicationPrintView({ appId, regNumber, onClose }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    api.get(`api/applications/${appId}/form`)
      .then(r => setData(r.data.data))
      .catch(() => setError('Failed to load application details.'))
      .finally(() => setLoading(false))
  }, [appId])

  function handlePrint() {
    if (!data) return
    const win = window.open('', '_blank', 'width=900,height=960')
    win.document.write(buildHTML(data, regNumber))
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 600)
  }

  if (loading) return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
      Loading application…
    </div>
  )
  if (error) return (
    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
      {error}
    </div>
  )

  const { application: app, previous_exam, documents } = data
  const fullName = [app.app_surname, app.app_first_name, app.app_middle_name].filter(Boolean).join(' ')
  const address  = [app.app_address, app.app_taluka, app.app_district, app.app_state].filter(Boolean).join(', ')

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white overflow-hidden">

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
        <p className="text-sm font-bold text-slate-700">Application Details</p>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-md bg-slate-900 text-white text-xs font-semibold px-3 py-1.5 hover:bg-slate-700 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
            </svg>
            Print / Save PDF
          </button>
          <button onClick={onClose} className="rounded-md border border-slate-200 bg-white text-slate-500 text-xs font-semibold px-3 py-1.5 hover:bg-slate-50 transition">
            Close
          </button>
        </div>
      </div>

      {/* ── On-screen preview ── */}
      <div className="bg-white overflow-hidden">

        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b-2 border-slate-900">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Application Form</p>
          <p className="text-lg font-extrabold text-slate-900">{app.college_name}</p>
          <p className="text-sm text-slate-500 mt-0.5">{app.course_name} · {YEAR_LABEL[app.year_of_study]} · {app.academic_year}</p>
          {regNumber && <p className="text-sm font-bold text-emerald-600 font-mono mt-1">Reg No: {regNumber}</p>}
        </div>

        {/* Sections */}
        <div className="px-6 py-5 space-y-5">

          <PreviewSection title="Application Context">
            <PRow label="College"         value={app.college_name} />
            <PRow label="Course"          value={app.course_name} />
            <PRow label="Year of Study"   value={YEAR_LABEL[app.year_of_study]} />
            <PRow label="Academic Year"   value={app.academic_year} />
            <PRow label="Application Fee" value={`₹${Number(app.application_fee || 0).toLocaleString('en-IN')}`} />
          </PreviewSection>

          <PreviewSection title="Personal Details">
            <PRow label="Full Name"       value={fullName} />
            <PRow label="Mother's Name"   value={app.app_mother_name} />
            <PRow label="Gender"          value={app.app_sex} />
            <PRow label="Mobile"          value={app.app_mobile} />
            <PRow label="Email"           value={app.app_email} full />
            <PRow label="Address"         value={address} full />
            <PRow label="Category"        value={app.app_category} />
            <PRow label="Fees Category"   value={app.fees_category} />
          </PreviewSection>

          <PreviewSection title="Other Details">
            <PRow label="Date of Birth"       value={fmtDate(app.app_birth_date)} />
            <PRow label="Birth Place"         value={[app.app_birth_place, app.app_birth_state].filter(Boolean).join(', ')} />
            <PRow label="Nationality"         value={app.app_nationality} />
            <PRow label="Marital Status"      value={app.app_marital_status} />
            <PRow label="Religion"            value={app.app_religion} />
            <PRow label="Caste"               value={app.app_caste} />
            <PRow label="Mother Tongue"       value={app.app_mother_tongue} />
            <PRow label="Blood Group"         value={app.app_blood_group} />
            <PRow label="Aadhaar"             value={maskAadhaar(app.app_aadhaar)} />
            <PRow label="ABC ID"              value={app.app_abc_id} />
            {app.app_prn && <PRow label="PRN" value={app.app_prn} />}
            <PRow label="Father's Name"       value={app.app_father_full_name} />
            <PRow label="Father's Occupation" value={app.app_father_occupation} />
            <PRow label="Annual Income"       value={app.app_annual_income ? `₹${Number(app.app_annual_income).toLocaleString('en-IN')}` : '—'} />
            {app.app_bank_account && <PRow label="Bank Account" value={`****${app.app_bank_account.slice(-4)}`} />}
          </PreviewSection>

          {previous_exam && (
            <PreviewSection title="Previous Exam Details">
              <PRow label="Board / College" value={previous_exam.board_or_college_name} />
              <PRow label="Year of Passing" value={previous_exam.year_of_passing} />
              <PRow label="Seat / PRN"      value={previous_exam.seat_number || previous_exam.prn_or_seat} />
              <PRow label="Total Marks"     value={previous_exam.total_marks_obtained && previous_exam.total_marks_max ? `${previous_exam.total_marks_obtained} / ${previous_exam.total_marks_max}` : '—'} />
              {previous_exam.result && <PRow label="Result" value={previous_exam.result?.toUpperCase()} />}
              {previous_exam.subjects?.filter(s => s.subject_name).map((s, i) => (
                <PRow key={i} label={s.subject_name} value={`${s.marks_obtained} / ${s.marks_max}`} />
              ))}
            </PreviewSection>
          )}

          <PreviewSection title="Documents">
            {(documents || []).length === 0
              ? <p className="text-sm text-slate-500 sm:col-span-2">No documents linked.</p>
              : (documents || []).map(d => <PRow key={d.document_type_id} label={d.document_name} value={d.file_name} />)
            }
          </PreviewSection>

          {/* Declaration */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Declaration</p>
            <p className="text-xs text-slate-600 leading-relaxed">
              I declare that the information provided is true to the best of my knowledge. I understand
              that any false information may lead to cancellation of admission.
            </p>
            <p className="text-xs font-semibold text-emerald-700">✓ Declaration accepted at time of submission.</p>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-2.5">
          <p className="text-xs text-slate-400">Computer-generated application form · {app.college_name}</p>
          <p className="text-xs font-mono text-slate-400">{regNumber}</p>
        </div>

      </div>
    </div>
  )
}

// ── On-screen preview sub-components ────────────────────────
function PreviewSection({ title, children }) {
  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <div className="bg-slate-100 border-b border-slate-200 px-4 py-2">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{title}</p>
      </div>
      <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0.5">
        {children}
      </div>
    </div>
  )
}

function PRow({ label, value, full }) {
  return (
    <div className={`flex gap-2 py-1 border-b border-slate-50 text-sm min-w-0 ${full ? 'sm:col-span-2' : ''}`}>
      <span className="shrink-0 text-slate-400 w-36">{label}</span>
      <span className="text-slate-800 font-semibold break-words min-w-0">{value || '—'}</span>
    </div>
  )
}

// ── Build full self-contained HTML for print ─────────────────
function buildHTML(data, regNumber) {
  const { application: app, previous_exam, documents } = data
  const fullName  = [app.app_surname, app.app_first_name, app.app_middle_name].filter(Boolean).join(' ')
  const address   = [app.app_address, app.app_taluka, app.app_district, app.app_state].filter(Boolean).join(', ')

  function row(label, value) {
    return `
      <tr>
        <td style="padding:5px 10px;font-size:11.5px;color:#64748b;font-weight:500;width:38%;border-bottom:1px solid #f1f5f9;vertical-align:top;white-space:nowrap;">${label}</td>
        <td style="padding:5px 10px;font-size:11.5px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9;word-break:break-word;vertical-align:top;">${value || '—'}</td>
      </tr>`
  }

  function section(title, rows) {
    return `
      <div style="margin-bottom:14px;">
        <div style="background:#f1f5f9;border:1px solid #e2e8f0;border-bottom:none;padding:6px 10px;border-radius:6px 6px 0 0;">
          <span style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#64748b;">${title}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:0 0 6px 6px;overflow:hidden;">
          <tbody>${rows}</tbody>
        </table>
      </div>`
  }

  const subjectRows = (previous_exam?.subjects || [])
    .filter(s => s.subject_name)
    .map(s => row(s.subject_name, `${s.marks_obtained} / ${s.marks_max}`))
    .join('')

  const docRows = (documents || []).length === 0
    ? `<tr><td colspan="2" style="padding:8px 10px;font-size:11.5px;color:#94a3b8;font-style:italic;">No documents linked.</td></tr>`
    : (documents || []).map(d => row(d.document_name, d.file_name)).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Application — ${regNumber || ''}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#0f172a;padding:24px}
    @media print{
      body{padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      @page{size:A4;margin:14mm 16mm}
    }
  </style>
</head>
<body>
<div style="max-width:680px;margin:0 auto;">

  <!-- Header -->
  <div style="border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:16px;">
    <div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#64748b;margin-bottom:4px;">Application Form</div>
    <div style="font-size:19px;font-weight:800;color:#0f172a;">${app.college_name || '—'}</div>
    <div style="font-size:11.5px;color:#475569;margin-top:3px;">${app.course_name} &nbsp;·&nbsp; ${YEAR_LABEL[app.year_of_study]} &nbsp;·&nbsp; ${app.academic_year}</div>
    ${regNumber ? `<div style="font-size:11px;font-weight:700;color:#059669;margin-top:4px;font-family:monospace;">Reg No: ${regNumber}</div>` : ''}
  </div>

  <!-- Sections -->
  ${section('Application Context',
      row('College',         app.college_name) +
      row('Course',          app.course_name) +
      row('Year of Study',   YEAR_LABEL[app.year_of_study]) +
      row('Academic Year',   app.academic_year) +
      row('Application Fee', '&#8377;' + Number(app.application_fee || 0).toLocaleString('en-IN'))
  )}

  ${section('Personal Details',
      row('Full Name',       fullName) +
      row('Mother\'s Name',  app.app_mother_name) +
      row('Gender',          app.app_sex) +
      row('Mobile',          app.app_mobile) +
      row('Email',           app.app_email) +
      row('Address',         address) +
      row('Category',        app.app_category) +
      row('Fees Category',   app.fees_category)
  )}

  ${section('Other Details',
      row('Date of Birth',        fmtDate(app.app_birth_date)) +
      row('Birth Place',          [app.app_birth_place, app.app_birth_state].filter(Boolean).join(', ')) +
      row('Nationality',          app.app_nationality) +
      row('Marital Status',       app.app_marital_status) +
      row('Religion',             app.app_religion) +
      row('Caste',                app.app_caste) +
      row('Mother Tongue',        app.app_mother_tongue) +
      row('Blood Group',          app.app_blood_group) +
      row('Aadhaar',              maskAadhaar(app.app_aadhaar)) +
      row('ABC ID',               app.app_abc_id) +
      (app.app_prn ? row('PRN',   app.app_prn) : '') +
      row('Father\'s Name',       app.app_father_full_name) +
      row('Father\'s Occupation', app.app_father_occupation) +
      row('Annual Income',        app.app_annual_income ? '&#8377;' + Number(app.app_annual_income).toLocaleString('en-IN') : '—') +
      (app.app_bank_account ? row('Bank Account', '****' + app.app_bank_account.slice(-4)) : '')
  )}

  ${previous_exam ? section('Previous Exam Details',
      row('Board / College', previous_exam.board_or_college_name) +
      row('Year of Passing', previous_exam.year_of_passing) +
      row('Seat / PRN',      previous_exam.seat_number || previous_exam.prn_or_seat) +
      row('Total Marks',     previous_exam.total_marks_obtained && previous_exam.total_marks_max
        ? `${previous_exam.total_marks_obtained} / ${previous_exam.total_marks_max}` : '—') +
      (previous_exam.result ? row('Result', previous_exam.result.toUpperCase()) : '') +
      subjectRows
  ) : ''}

  ${section('Documents', docRows)}

  <!-- Declaration -->
  <div style="border:1px solid #e2e8f0;border-radius:6px;padding:12px 14px;margin-bottom:16px;background:#f8fafc;">
    <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#64748b;margin-bottom:7px;">Declaration</div>
    <p style="font-size:11.5px;color:#475569;line-height:1.7;">
      I declare that the information provided is true and correct to the best of my knowledge.
      I understand that any false information may lead to cancellation of admission.
    </p>
    <p style="font-size:11.5px;font-weight:700;color:#059669;margin-top:8px;">&#10003; Declaration accepted at time of submission.</p>
  </div>

  <!-- Footer -->
  <div style="border-top:1px solid #e2e8f0;padding-top:8px;display:flex;justify-content:space-between;align-items:center;">
    <span style="font-size:9.5px;color:#94a3b8;">Computer-generated application form · ${app.college_name}</span>
    <span style="font-size:9.5px;color:#94a3b8;font-family:monospace;">${regNumber || ''}</span>
  </div>

</div>
</body>
</html>`
}

function fmtDate(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return d }
}

function maskAadhaar(a) {
  if (!a || a.length < 4) return a || '—'
  return `XXXX XXXX ${a.slice(-4)}`
}
