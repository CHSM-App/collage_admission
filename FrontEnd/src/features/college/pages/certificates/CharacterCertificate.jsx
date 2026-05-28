import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCharacterList, getCharacterNextNo, createCharacter, updateCharacter, lookupStudent } from '../../../../services/certificateService.js'
import { getClasses } from '../../../../services/masterService.js'
import FormField from '../../../../shared/components/FormField.jsx'
import {
  GenderRadio,
  ExStudentCheckbox,
  RegNoLookupRow,
  CertActionBar,
  CertFormShell,
} from './shared.jsx'
import { SkeletonLines } from '../../../../shared/components/Skeleton.jsx'

const EMPTY = {
  character_certificate_id: null,
  certificate_no:           '',
  certificate_date:         new Date().toISOString().slice(0, 10),
  reg_no:                   '',
  student_name:             '',
  gender:                   '',
  is_ex_student:            false,
  class_name:               '',
  academic_year:            '',
  known_from_years:         '',
  birth_date:               '',
  roll_no:                  '',
  caste:                    '',
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

export default function CharacterCertificate({ collegeId, readOnly }) {
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
  const [classList, setClassList] = useState([])

  const isReadOnlyMode = mode === 'view'
  const canEdit = !readOnly
  const canSave = !readOnly && (mode === 'new' || mode === 'edit')

  const loadList = useCallback(() => {
    setLoading(true)
    getCharacterList(collegeId)
      .then(r => setList(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [collegeId])

  const loadNextNo = useCallback(() => {
    getCharacterNextNo(collegeId)
      .then(r => setForm(f => ({ ...f, certificate_no: r.data.data?.certificate_no || '' })))
      .catch(() => {})
  }, [collegeId])

  useEffect(() => { loadList() }, [loadList])
  useEffect(() => {
    getClasses(collegeId)
      .then(r => setClassList(r.data.data || []))
      .catch(() => {})
  }, [collegeId])
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
      const r = await lookupStudent(collegeId, reg)
      const d = r.data.data
      setForm(f => ({
        ...f,
        student_name:  d.student_name  || f.student_name,
        gender:        d.gender        || f.gender,
        class_name:    d.class_name    || f.class_name,
        academic_year: d.academic_year || f.academic_year,
        birth_date:    toDateInput(d.birth_date) || f.birth_date,
        roll_no:       d.roll_no != null ? String(d.roll_no) : f.roll_no,
        caste:         d.caste         || f.caste,
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
      character_certificate_id: row.character_certificate_id,
      certificate_no:           row.certificate_no,
      certificate_date:         toDateInput(row.certificate_date),
      reg_no:                   row.reg_no || '',
      student_name:             row.student_name || '',
      gender:                   row.gender || '',
      is_ex_student:            !!row.is_ex_student,
      class_name:               row.class_name || '',
      academic_year:            row.academic_year || '',
      known_from_years:         row.known_from_years != null ? String(row.known_from_years) : '',
      birth_date:               toDateInput(row.birth_date),
      roll_no:                  row.roll_no != null ? String(row.roll_no) : '',
      caste:                    row.caste || '',
    }
    setForm(data); setOriginal(data); setErrors({}); setGlobalError(''); setMode('view')
  }
  function handleEdit() { if (form.character_certificate_id) setMode('edit') }
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
    if (!form.academic_year?.trim()) e.academic_year    = 'Academic year is required.'
    if (form.roll_no && isNaN(parseInt(form.roll_no))) e.roll_no = 'Roll number must be numeric.'
    if (form.known_from_years !== '' && form.known_from_years != null) {
      const n = parseInt(form.known_from_years)
      if (isNaN(n) || n < 0) e.known_from_years = 'Known From must be a non-negative number.'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    setGlobalError('')
    if (!validate()) return
    setSaving(true)
    const payload = {
      certificate_date: form.certificate_date,
      reg_no:           form.reg_no?.trim() || null,
      student_name:     form.student_name.trim(),
      gender:           form.gender || null,
      is_ex_student:    !!form.is_ex_student,
      class_name:       form.class_name.trim(),
      academic_year:    form.academic_year.trim(),
      known_from_years: form.known_from_years === '' ? null : parseInt(form.known_from_years),
      birth_date:       form.birth_date || null,
      roll_no:          form.roll_no === '' ? null : parseInt(form.roll_no),
      caste:            form.caste?.trim() || null,
    }
    try {
      let saved
      if (mode === 'new') {
        const r = await createCharacter(collegeId, payload)
        saved = r.data.data
      } else {
        const r = await updateCharacter(collegeId, form.character_certificate_id, payload)
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
    if (!form.character_certificate_id) { setGlobalError('Save the certificate first, then print.'); return }
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
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Character Certificate</h1>
        <p className="mt-1 text-slate-600">Issue a character certificate for a student.</p>
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
            hint={mode === 'new' ? 'Auto-generated on save (CHAR/yyyy/0001)' : 'System-issued'}
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
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Class <span className="text-red-500">*</span>
            </label>
            {isReadOnlyMode ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                {form.class_name || '—'}
              </p>
            ) : (
              <select
                name="class_name"
                value={form.class_name}
                onChange={handleChange}
                className={`rounded-lg border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.class_name ? 'border-red-400' : 'border-slate-300'}`}
              >
                <option value="">— Select class —</option>
                {classList.map(c => {
                  const label = c.label || `${c.degree_course_code} Year ${c.year_of_study}`
                  return <option key={c.id} value={label}>{label}</option>
                })}
              </select>
            )}
            {errors.class_name && <p className="text-xs text-red-500">{errors.class_name}</p>}
          </div>
          <FormField
            label="Academic Year"
            name="academic_year"
            value={form.academic_year}
            onChange={e => {
              const v = e.target.value.replace(/[^0-9-]/g, '')
              set('academic_year', v)
            }}
            error={errors.academic_year}
            required
            readOnly={isReadOnlyMode}
            placeholder="e.g. 2026-27"
            inputMode="numeric"
          />
          <FormField
            label="Roll No."
            name="roll_no"
            type="number"
            value={form.roll_no}
            onChange={handleChange}
            error={errors.roll_no}
            readOnly={isReadOnlyMode}
            placeholder="Numeric"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField
            label="Known From (years)"
            name="known_from_years"
            type="number"
            value={form.known_from_years}
            onChange={handleChange}
            error={errors.known_from_years}
            readOnly={isReadOnlyMode}
            min={0}
            placeholder="e.g. 2"
            hint="Years known to the institution"
          />
          <FormField
            label="Birth Date"
            name="birth_date"
            type="date"
            value={form.birth_date}
            onChange={handleChange}
            readOnly={isReadOnlyMode}
            hint="DD/MM/YYYY"
            max={(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 16); return d.toISOString().slice(0,10) })()}
            error={errors.birth_date}
          />
          <FormField
            label="Caste / Category"
            name="caste"
            value={form.caste}
            onChange={handleChange}
            readOnly={isReadOnlyMode}
            placeholder="e.g. Open / OBC / SC / ST"
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
          canEdit={canEdit && mode === 'view' && !!form.character_certificate_id}
          canPrint={!!form.character_certificate_id}
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
          <div className="px-5 py-4"><SkeletonLines rows={3} /></div>
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
                  <th className="px-4 py-2.5 text-left">Class</th>
                  <th className="px-4 py-2.5 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map(row => (
                  <tr key={row.character_certificate_id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-mono text-slate-700 text-xs">{row.certificate_no}</td>
                    <td className="px-4 py-2 text-slate-600">{fmtDateIN(row.certificate_date)}</td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">{row.reg_no || '—'}</td>
                    <td className="px-4 py-2 text-slate-800">{row.student_name}</td>
                    <td className="px-4 py-2 text-slate-600">{row.class_name || '—'}</td>
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
  const dateStr = fmtDateIN(c.certificate_date)
  const dobStr  = c.birth_date ? fmtDateIN(c.birth_date) : '__________'
  const pronoun = c.gender === 'Female' ? 'She' : 'He'
  const possess = c.gender === 'Female' ? 'her'  : 'his'
  const title   = c.gender === 'Female' ? 'Ms.' : 'Mr.'
  const exNote  = c.is_ex_student ? 'an ex-student' : 'a student'

  // "Known from" line — only render if a value was provided.
  const known = c.known_from_years !== '' && c.known_from_years != null
    ? parseInt(c.known_from_years)
    : null
  const knownSentence = known != null
    ? ` ${pronoun} has been known to the institution for ${known} year${known === 1 ? '' : 's'}.`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Character Certificate — ${escapeHTML(c.certificate_no)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Times New Roman',Georgia,serif;background:#f1f5f9;color:#1e293b;padding:32px 24px}
    @media print{
      body{background:#fff;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      @page{size:A4;margin:18mm 20mm}
    }
    .sheet{max-width:780px;margin:0 auto;background:#fff;border:6px double #4c1d95;padding:36px 44px;}
    .hdr{text-align:center;border-bottom:2px solid #4c1d95;padding-bottom:14px;margin-bottom:22px}
    .hdr h1{font-size:22px;color:#4c1d95;letter-spacing:.5px;margin-bottom:4px}
    .hdr p{font-size:12px;color:#475569}
    .meta{display:flex;justify-content:space-between;font-size:13px;color:#334155;margin-bottom:24px}
    .title{text-align:center;font-size:18px;font-weight:bold;letter-spacing:6px;margin:18px 0 28px;text-transform:uppercase;color:#0f172a}
    .body{font-size:14px;line-height:1.85;text-align:justify;color:#1e293b}
    .body strong{color:#0f172a}
    .sign{display:flex;justify-content:space-between;margin-top:64px;font-size:13px;color:#334155}
    .sign div{text-align:center}
    .sign div span{display:block;border-top:1px solid #94a3b8;margin-top:48px;padding-top:6px;min-width:200px}
  </style>
</head>
<body>
  <div class="sheet">
    <div class="hdr">
      <h1>CHARACTER CERTIFICATE</h1>
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
        ${c.reg_no ? `, bearing Registration Number <strong>${escapeHTML(c.reg_no)}</strong>` : ''}${c.roll_no ? ` and Roll Number <strong>${escapeHTML(String(c.roll_no))}</strong>` : ''},
        is ${escapeHTML(exNote)} of this institution, enrolled in
        <strong>${escapeHTML(c.class_name || '')}</strong> for the academic year
        <strong>${escapeHTML(c.academic_year || '')}</strong>.${knownSentence}
      </p>
      <br/>
      <p>
        ${pronoun} was born on <strong>${escapeHTML(dobStr)}</strong>${c.caste ? ` and belongs to the <strong>${escapeHTML(c.caste)}</strong> category` : ''}.
      </p>
      <br/>
      <p>
        To the best of our knowledge and belief, ${possess} character and conduct have been
        <strong>good</strong> throughout the period of ${possess} association with this
        institution. ${pronoun.charAt(0).toUpperCase() + pronoun.slice(1).toLowerCase()} bears a
        sound moral character and has not been involved in any act of misconduct or indiscipline
        during ${possess} stay.
      </p>
      <br/>
      <p>
        We wish ${possess === 'her' ? 'her' : 'him'} every success in ${possess} future endeavours.
      </p>
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
