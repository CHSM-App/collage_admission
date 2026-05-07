import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../../services/api.js'
import FormField from '../../../../shared/components/FormField.jsx'
import {
  GenderRadio,
  ExStudentCheckbox,
  RegNoLookupRow,
  CertActionBar,
  CertFormShell,
} from './shared.jsx'

const EMPTY = {
  noc_certificate_id:    null,
  certificate_no:        '',
  certificate_date:      new Date().toISOString().slice(0, 10),
  reg_no:                '',
  student_name:          '',
  gender:                '',
  is_ex_student:         false,
  class_name:            '',
  from_date:             '',
  to_date:               '',
  prn_no:                '',
  final_confirmation_no: '',
}

function toDateInput(d) {
  if (!d) return ''
  const s = String(d)
  return s.length >= 10 ? s.slice(0, 10) : s
}

function fmtDateIN(d) {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date)) return String(d).slice(0, 10)
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function NoObjectionCertificate({ collegeId, readOnly }) {
  const navigate = useNavigate()
  const [form,    setForm]    = useState(EMPTY)
  const [mode,    setMode]    = useState('new')
  const [errors,  setErrors]  = useState({})
  const [globalError, setGlobalError] = useState('')
  const [list,    setList]    = useState([])
  const [loading, setLoading] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [original, setOriginal]   = useState(null)

  const isReadOnlyMode = mode === 'view'
  const canEdit = !readOnly
  const canSave = !readOnly && (mode === 'new' || mode === 'edit')

  const loadList = useCallback(() => {
    setLoading(true)
    api.get(`certificates/${collegeId}/noc`)
      .then(r => setList(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [collegeId])

  const loadNextNo = useCallback(() => {
    api.get(`certificates/${collegeId}/noc/next-no`)
      .then(r => setForm(f => ({ ...f, certificate_no: r.data.data?.certificate_no || '' })))
      .catch(() => {})
  }, [collegeId])

  useEffect(() => { loadList() }, [loadList])
  useEffect(() => {
    if (mode === 'new' && !form.certificate_no) loadNextNo()
  }, [mode, form.certificate_no, loadNextNo])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })) }
  function handleChange(e) {
    const { name, value, type, checked } = e.target
    set(name, type === 'checkbox' ? checked : value)
  }

  async function lookupRegNo() {
    const reg = form.reg_no?.trim()
    if (!reg) { setGlobalError('Enter a registration number to look up.'); return }
    setGlobalError(''); setLookingUp(true)
    try {
      const r = await api.get(`certificates/${collegeId}/student-lookup`, { params: { reg_no: reg } })
      const d = r.data.data
      setForm(f => ({
        ...f,
        student_name: d.student_name || f.student_name,
        gender:       d.gender       || f.gender,
        class_name:   d.class_name   || f.class_name,
        prn_no:       d.prn_no       || f.prn_no,
      }))
    } catch (err) {
      setGlobalError(err?.response?.data?.message || 'Lookup failed.')
    } finally {
      setLookingUp(false)
    }
  }

  function startNew() {
    setForm(EMPTY); setOriginal(null); setErrors({}); setGlobalError(''); setMode('new')
    loadNextNo()
  }
  function loadRecord(row) {
    const data = {
      noc_certificate_id:    row.noc_certificate_id,
      certificate_no:        row.certificate_no,
      certificate_date:      toDateInput(row.certificate_date),
      reg_no:                row.reg_no || '',
      student_name:          row.student_name || '',
      gender:                row.gender || '',
      is_ex_student:         !!row.is_ex_student,
      class_name:            row.class_name || '',
      from_date:             toDateInput(row.from_date),
      to_date:               toDateInput(row.to_date),
      prn_no:                row.prn_no || '',
      final_confirmation_no: row.final_confirmation_no || '',
    }
    setForm(data); setOriginal(data); setErrors({}); setGlobalError(''); setMode('view')
  }
  function handleEdit() { if (form.noc_certificate_id) setMode('edit') }
  function handleCancel() {
    if (mode === 'edit' && original) {
      setForm(original); setErrors({}); setGlobalError(''); setMode('view')
    } else {
      startNew()
    }
  }
  function handleExit() {
    navigate('/college/dashboard')
  }

  function validate() {
    const e = {}
    if (!form.certificate_date)      e.certificate_date = 'Date is required.'
    if (!form.student_name?.trim())  e.student_name     = 'Student name is required.'
    if (!form.class_name?.trim())    e.class_name       = 'Class is required.'
    // Both From/To optional individually, but if both supplied, From <= To.
    if (form.from_date && form.to_date) {
      if (new Date(form.from_date) > new Date(form.to_date)) {
        e.to_date = 'To Date must be on or after From Date.'
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    setGlobalError('')
    if (!validate()) return
    setSaving(true)
    const payload = {
      certificate_date:      form.certificate_date,
      reg_no:                form.reg_no?.trim() || null,
      student_name:          form.student_name.trim(),
      gender:                form.gender || null,
      is_ex_student:         !!form.is_ex_student,
      class_name:            form.class_name.trim(),
      from_date:             form.from_date || null,
      to_date:               form.to_date   || null,
      prn_no:                form.prn_no?.trim() || null,
      final_confirmation_no: form.final_confirmation_no?.trim() || null,
    }
    try {
      let saved
      if (mode === 'new') {
        const r = await api.post(`certificates/${collegeId}/noc`, payload)
        saved = r.data.data
      } else {
        const r = await api.put(`certificates/${collegeId}/noc/${form.noc_certificate_id}`, payload)
        saved = r.data.data
      }
      loadRecord(saved)
      loadList()
    } catch (err) {
      const resp = err?.response?.data
      if (resp?.errors) setErrors(resp.errors)
      setGlobalError(resp?.message || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  function handlePrint() {
    if (!form.noc_certificate_id) { setGlobalError('Save the certificate first, then print.'); return }
    const win = window.open('', '_blank', 'width=860,height=900')
    if (!win) { setGlobalError('Pop-up blocked — allow pop-ups for this site to print.'); return }
    win.document.write(buildPrintHTML(form))
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 500)
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Certificates</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">No Objection Certificate</h1>
        <p className="mt-1 text-slate-600">Issue an NOC for a student transferring or applying elsewhere.</p>
      </div>

      {readOnly && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          You have view-only access to this section.
        </p>
      )}

      <CertFormShell mode={mode} certNo={form.certificate_no}>
        {globalError && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{globalError}</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            label="Certificate No."
            name="certificate_no"
            value={form.certificate_no}
            readOnly
            hint={mode === 'new' ? 'Auto-generated on save (NOC/yyyy/0001)' : 'System-issued'}
          />
          <FormField
            label="Date"
            name="certificate_date"
            type="date"
            value={form.certificate_date}
            onChange={handleChange}
            error={errors.certificate_date}
            required
            readOnly={isReadOnlyMode}
          />
        </div>

        <RegNoLookupRow
          value={form.reg_no}
          onChange={handleChange}
          onSearch={lookupRegNo}
          disabled={isReadOnlyMode}
          lookingUp={lookingUp}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            label="Student Name"
            name="student_name"
            value={form.student_name}
            onChange={handleChange}
            error={errors.student_name}
            required
            readOnly={isReadOnlyMode}
            placeholder="Full name as per records"
          />
          <GenderRadio
            value={form.gender}
            onChange={handleChange}
            disabled={isReadOnlyMode}
            error={errors.gender}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField
            label="Class"
            name="class_name"
            value={form.class_name}
            onChange={handleChange}
            error={errors.class_name}
            required
            readOnly={isReadOnlyMode}
            placeholder="e.g. SY BCOM"
          />
          <FormField
            label="From Date"
            name="from_date"
            type="date"
            value={form.from_date}
            onChange={handleChange}
            readOnly={isReadOnlyMode}
            hint="Academic period start"
          />
          <FormField
            label="To Date"
            name="to_date"
            type="date"
            value={form.to_date}
            onChange={handleChange}
            error={errors.to_date}
            readOnly={isReadOnlyMode}
            hint="Academic period end"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            label="PRN No."
            name="prn_no"
            value={form.prn_no}
            onChange={handleChange}
            readOnly={isReadOnlyMode}
            placeholder="University PRN number"
          />
          <FormField
            label="Final Confirmation No."
            name="final_confirmation_no"
            value={form.final_confirmation_no}
            onChange={handleChange}
            readOnly={isReadOnlyMode}
            placeholder="Reference / confirmation number"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ExStudentCheckbox
            checked={form.is_ex_student}
            onChange={handleChange}
            disabled={isReadOnlyMode}
          />
        </div>

        <CertActionBar
          onSave={handleSave}
          onEdit={handleEdit}
          onCancel={handleCancel}
          onPrint={handlePrint}
          onExit={handleExit}
          saving={saving}
          canSave={canSave}
          canEdit={canEdit && mode === 'view' && !!form.noc_certificate_id}
          canPrint={!!form.noc_certificate_id}
        />
      </CertFormShell>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-700">Issued Certificates</p>
          {!readOnly && (
            <button onClick={startNew} className="text-xs font-semibold text-blue-600 hover:underline">+ New</button>
          )}
        </div>
        {loading ? (
          <p className="px-5 py-6 text-sm text-slate-400">Loading…</p>
        ) : list.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">No certificates issued yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 text-left">Cert. No.</th>
                  <th className="px-4 py-2.5 text-left">Date</th>
                  <th className="px-4 py-2.5 text-left">Reg. No.</th>
                  <th className="px-4 py-2.5 text-left">Student</th>
                  <th className="px-4 py-2.5 text-left">PRN</th>
                  <th className="px-4 py-2.5 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map(row => (
                  <tr key={row.noc_certificate_id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-mono text-slate-700 text-xs">{row.certificate_no}</td>
                    <td className="px-4 py-2 text-slate-600">{fmtDateIN(row.certificate_date)}</td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">{row.reg_no || '—'}</td>
                    <td className="px-4 py-2 text-slate-800">{row.student_name}</td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">{row.prn_no || '—'}</td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => loadRecord(row)}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

// ─── Print template ──────────────────────────────────────────
function buildPrintHTML(c) {
  const dateStr   = fmtDateIN(c.certificate_date)
  const fromStr   = c.from_date ? fmtDateIN(c.from_date) : null
  const toStr     = c.to_date   ? fmtDateIN(c.to_date)   : null
  const pronoun   = c.gender === 'Female' ? 'She' : 'He'
  const possess   = c.gender === 'Female' ? 'her'  : 'his'
  const title     = c.gender === 'Female' ? 'Ms.' : 'Mr.'
  const exNote    = c.is_ex_student ? 'an ex-student' : 'a student'

  // Compose the period sentence only if both dates are present, or one of them.
  let periodSentence = ''
  if (fromStr && toStr) {
    periodSentence = ` ${pronoun} attended the institution from <strong>${escapeHTML(fromStr)}</strong> to <strong>${escapeHTML(toStr)}</strong>.`
  } else if (fromStr) {
    periodSentence = ` ${pronoun} has been attending the institution since <strong>${escapeHTML(fromStr)}</strong>.`
  } else if (toStr) {
    periodSentence = ` ${pronoun} attended the institution up to <strong>${escapeHTML(toStr)}</strong>.`
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>No Objection Certificate — ${escapeHTML(c.certificate_no)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Times New Roman',Georgia,serif;background:#f1f5f9;color:#1e293b;padding:32px 24px}
    @media print{
      body{background:#fff;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      @page{size:A4;margin:18mm 20mm}
    }
    .sheet{max-width:780px;margin:0 auto;background:#fff;border:6px double #065f46;padding:36px 44px;}
    .hdr{text-align:center;border-bottom:2px solid #065f46;padding-bottom:14px;margin-bottom:22px}
    .hdr h1{font-size:22px;color:#065f46;letter-spacing:.5px;margin-bottom:4px}
    .hdr p{font-size:12px;color:#475569}
    .meta{display:flex;justify-content:space-between;font-size:13px;color:#334155;margin-bottom:24px}
    .title{text-align:center;font-size:18px;font-weight:bold;letter-spacing:6px;margin:18px 0 28px;text-transform:uppercase;color:#0f172a}
    .body{font-size:14px;line-height:1.85;text-align:justify;color:#1e293b}
    .body strong{color:#0f172a}
    .refs{margin-top:18px;font-size:13px;color:#334155}
    .refs div{margin-bottom:4px}
    .sign{display:flex;justify-content:space-between;margin-top:64px;font-size:13px;color:#334155}
    .sign div{text-align:center}
    .sign div span{display:block;border-top:1px solid #94a3b8;margin-top:48px;padding-top:6px;min-width:200px}
  </style>
</head>
<body>
  <div class="sheet">
    <div class="hdr">
      <h1>NO OBJECTION CERTIFICATE</h1>
      <p>This certificate is issued under the seal of the institution</p>
    </div>

    <div class="meta">
      <span><strong>Cert. No:</strong> ${escapeHTML(c.certificate_no)}</span>
      <span><strong>Date:</strong> ${escapeHTML(dateStr)}</span>
    </div>

    <div class="title">To Whom It May Concern</div>

    <div class="body">
      <p>
        This is to certify that <strong>${escapeHTML(title)} ${escapeHTML(c.student_name || '')}</strong>
        ${c.reg_no ? `, bearing Registration Number <strong>${escapeHTML(c.reg_no)}</strong>` : ''},
        is ${escapeHTML(exNote)} of this institution, enrolled in
        <strong>${escapeHTML(c.class_name || '')}</strong>.${periodSentence}
      </p>
      <br/>
      <p>
        The institution has <strong>no objection</strong> to ${possess} seeking admission, transfer,
        or employment in any other institution or organisation, and confirms that all academic and
        administrative obligations to this institution have been duly discharged on ${possess} part
        as on the date of this certificate.
      </p>
      <br/>
      <p>
        We wish ${possess === 'her' ? 'her' : 'him'} every success in ${possess} future endeavours.
      </p>

      ${(c.prn_no || c.final_confirmation_no) ? `
        <div class="refs">
          ${c.prn_no                ? `<div><strong>PRN No:</strong> ${escapeHTML(c.prn_no)}</div>` : ''}
          ${c.final_confirmation_no ? `<div><strong>Final Confirmation No:</strong> ${escapeHTML(c.final_confirmation_no)}</div>` : ''}
        </div>
      ` : ''}
    </div>

    <div class="sign">
      <div><span>Class Teacher</span></div>
      <div><span>Principal / Authorised Signatory</span></div>
    </div>
  </div>
</body>
</html>`
}

function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]))
}
