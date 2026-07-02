/**
 * Certificates — unified page for Bonafide, Character, and NOC certificates.
 *
 * Flow:
 *  1. User selects certificate type + optionally enters a reg no, clicks Search
 *  2. Student details autofill; the relevant form fields appear
 *  3. User fills any remaining fields and clicks Issue Certificate
 *  4. On success the cert is added to the Issued Certificates list below
 *  5. The list shows all three types merged, with a type filter + search
 *  6. Each issued row has a Print button — opens a print-ready popup
 */

import { useCallback, useEffect, useState } from 'react'
import { useAuthContext } from '../../../../context/AuthContext.jsx'
import { useToast } from '../../../../context/ToastContext.jsx'
import {
  lookupStudent,
  getBonafideList, getBonafideNextNo, createBonafide,
  getCharacterList, getCharacterNextNo, createCharacter,
  getNocList, getNocNextNo, createNoc,
} from '../../../../services/certificateService.js'
import FormField from '../../../../shared/components/FormField.jsx'
import Button from '../../../../shared/components/Button.jsx'
import { GenderRadio, ExStudentCheckbox } from './shared.jsx'
import { SkeletonLines } from '../../../../shared/components/Skeleton.jsx'

// ─── Helpers ─────────────────────────────────────────────────

function toDateInput(d) {
  if (!d) return ''
  return String(d).slice(0, 10)
}

function fmtDateIN(d) {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date)) return String(d).slice(0, 10)
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])
  )
}

const CERT_TYPES = [
  { value: 'bonafide',   label: 'Bonafide Certificate',       prefix: 'BON'  },
  { value: 'character',  label: 'Character Certificate',      prefix: 'CHAR' },
  { value: 'noc',        label: 'No Objection Certificate',   prefix: 'NOC'  },
]

const TYPE_BADGE = {
  bonafide:  { label: 'Bonafide',   cls: 'bg-blue-100 text-blue-700'    },
  character: { label: 'Character',  cls: 'bg-purple-100 text-purple-700' },
  noc:       { label: 'NOC',        cls: 'bg-emerald-100 text-emerald-700' },
}

// Empty form state per type
function emptyForm(type) {
  const base = {
    certificate_date: new Date().toISOString().slice(0, 10),
    reg_no: '', student_name: '', gender: '', is_ex_student: false,
    class_name: '', academic_year: '', birth_date: '', roll_no: '', caste: '',
  }
  if (type === 'character') return { ...base, known_from_years: '' }
  if (type === 'noc')       return { ...base, from_date: '', to_date: '', prn_no: '', final_confirmation_no: '' }
  return base
}

// ─── Main component ───────────────────────────────────────────

export default function Certificates({ collegeId, readOnly }) {
  const { user } = useAuthContext()
  const toast = useToast()
  const collegeName    = user?.name    || ''
  const collegeAddress = user?.address || (user?.city || '')
  const [certType,    setCertType]    = useState('bonafide')
  const [form,        setForm]        = useState(() => emptyForm('bonafide'))
  const [certNo,      setCertNo]      = useState('')
  const [errors,      setErrors]      = useState({})
  const [globalError, setGlobalError] = useState('')
  const [saving,      setSaving]      = useState(false)
  const [lookingUp,   setLookingUp]   = useState(false)
  const [issued,      setIssued]      = useState(null)   // set after successful save

  // Issued list state
  const [allList,     setAllList]     = useState([])    // merged from all 3 types
  const [listLoading, setListLoading] = useState(false)
  const [typeFilter,  setTypeFilter]  = useState('')
  const [search,      setSearch]      = useState('')

  // ── Load all lists ──────────────────────────────────────────
  const loadAll = useCallback(() => {
    setListLoading(true)
    Promise.all([
      getBonafideList(collegeId).then(r => (r.data.data || []).map(x => ({ ...x, _type: 'bonafide',  _id: x.bonafide_id }))),
      getCharacterList(collegeId).then(r => (r.data.data || []).map(x => ({ ...x, _type: 'character', _id: x.character_certificate_id }))),
      getNocList(collegeId).then(r => (r.data.data || []).map(x => ({ ...x, _type: 'noc', _id: x.noc_certificate_id }))),
    ])
      .then(([b, c, n]) => {
        const merged = [...b, ...c, ...n].sort((a, z) =>
          new Date(z.certificate_date) - new Date(a.certificate_date) ||
          z._id - a._id
        )
        setAllList(merged)
      })
      .catch(() => {})
      .finally(() => setListLoading(false))
  }, [collegeId])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Next cert number when type changes ──────────────────────
  const loadNextNo = useCallback((type) => {
    const fn = type === 'bonafide' ? getBonafideNextNo
             : type === 'character' ? getCharacterNextNo
             : getNocNextNo
    fn(collegeId)
      .then(r => setCertNo(r.data.data?.certificate_no || ''))
      .catch(() => {})
  }, [collegeId])

  useEffect(() => {
    setCertNo('')
    setForm(emptyForm(certType))
    setErrors({})
    setGlobalError('')
    setIssued(null)
    loadNextNo(certType)
  }, [certType, loadNextNo])

  // ── Field change ────────────────────────────────────────────
  function set(k, v) {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => ({ ...e, [k]: '' }))
  }
  function handleChange(e) {
    const { name, value, type, checked } = e.target
    set(name, type === 'checkbox' ? checked : value)
  }

  // ── Reg no lookup ───────────────────────────────────────────
  async function handleLookup() {
    const reg = form.reg_no?.trim()
    setGlobalError('')
    setLookingUp(true)
    try {
      const r = await lookupStudent(collegeId, reg || '__NONE__')
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
        ...(certType === 'noc' ? { prn_no: d.prn_no || f.prn_no } : {}),
      }))
    } catch (err) {
      const status = err?.response?.status
      const msg    = err?.response?.data?.message
      if (status === 404) {
        setGlobalError(`No student found for reg. no. "${reg}".`)
      } else if (msg) {
        setGlobalError(msg)
      } else {
        setGlobalError('Lookup failed — check the registration number and try again.')
      }
    } finally {
      setLookingUp(false)
    }
  }

  // ── Validation ──────────────────────────────────────────────
  function validate() {
    const e = {}
    if (!form.certificate_date)     e.certificate_date = 'Date is required.'
    if (!form.student_name?.trim()) e.student_name     = 'Student name is required.'
    if (certType !== 'noc') {
      if (!form.class_name?.trim())    e.class_name    = 'Class is required.'
      if (!form.academic_year?.trim()) e.academic_year = 'Academic year is required.'
    } else {
      if (!form.class_name?.trim()) e.class_name = 'Class is required.'
      if (form.from_date && form.to_date && new Date(form.from_date) > new Date(form.to_date)) {
        e.to_date = 'To Date must be on or after From Date.'
      }
    }
    if (form.roll_no && isNaN(parseInt(form.roll_no))) e.roll_no = 'Must be numeric.'
    if (certType === 'character' && form.known_from_years !== '' && form.known_from_years != null) {
      if (isNaN(parseInt(form.known_from_years)) || parseInt(form.known_from_years) < 0) {
        e.known_from_years = 'Must be a non-negative number.'
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Save ────────────────────────────────────────────────────
  async function handleIssue(e) {
    e.preventDefault()
    setGlobalError('')
    if (!validate()) return
    setSaving(true)

    const base = {
      certificate_date: form.certificate_date,
      reg_no:           form.reg_no?.trim() || null,
      student_name:     form.student_name.trim(),
      gender:           form.gender || null,
      is_ex_student:    !!form.is_ex_student,
      class_name:       form.class_name.trim(),
    }

    let payload
    if (certType === 'bonafide') {
      payload = { ...base, academic_year: form.academic_year.trim(), birth_date: form.birth_date || null,
        roll_no: form.roll_no === '' ? null : parseInt(form.roll_no), caste: form.caste?.trim() || null }
    } else if (certType === 'character') {
      payload = { ...base, academic_year: form.academic_year.trim(), birth_date: form.birth_date || null,
        roll_no: form.roll_no === '' ? null : parseInt(form.roll_no), caste: form.caste?.trim() || null,
        known_from_years: form.known_from_years === '' ? null : parseInt(form.known_from_years) }
    } else {
      payload = { ...base, from_date: form.from_date || null, to_date: form.to_date || null,
        prn_no: form.prn_no?.trim() || null, final_confirmation_no: form.final_confirmation_no?.trim() || null }
    }

    try {
      const fn = certType === 'bonafide' ? createBonafide
               : certType === 'character' ? createCharacter
               : createNoc
      const r = await fn(collegeId, payload)
      const saved = r.data.data
      setIssued({ ...saved, _type: certType })
      loadAll()
      // Reset form for next certificate
      setForm(emptyForm(certType))
      setCertNo('')
      loadNextNo(certType)
    } catch (err) {
      const resp = err?.response?.data
      if (resp?.errors) setErrors(resp.errors)
      setGlobalError(resp?.message || 'Failed to issue certificate.')
    } finally {
      setSaving(false)
    }
  }

  // ── Print ───────────────────────────────────────────────────
  function handlePrint(row) {
    const type    = row._type || certType
    const college = { name: collegeName, address: collegeAddress }
    const html = type === 'bonafide'  ? buildBonafideHTML(row, college)
               : type === 'character' ? buildCharacterHTML(row, college)
               : buildNocHTML(row, college)
    const win = window.open('', '_blank', 'width=860,height=900')
    if (!win) { toast.error('Pop-up blocked — allow pop-ups for this site to print.'); return }
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 500)
  }

  // ── Filtered list ───────────────────────────────────────────
  const q = search.trim().toLowerCase()
  const filteredList = allList.filter(row => {
    if (typeFilter && row._type !== typeFilter) return false
    if (q) {
      return (row.certificate_no || '').toLowerCase().includes(q) ||
             (row.student_name   || '').toLowerCase().includes(q) ||
             (row.reg_no         || '').toLowerCase().includes(q)
    }
    return true
  })

  return (
    <section className="space-y-6">
      {/* ── Page header ── */}
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Certificates</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Issue Certificate</h1>
        <p className="mt-1 text-slate-600">Issue bonafide, character, or NOC certificates for students.</p>
      </div>

      {readOnly && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          You have view-only access to this section.
        </p>
      )}

      {/* ── Issue form ── */}
      {!readOnly && (
        <form onSubmit={handleIssue} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {/* Header row: type selector */}
          <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-100 bg-slate-50">
            <p className="text-sm font-semibold text-slate-700 shrink-0">Certificate Type</p>
            <div className="flex flex-wrap gap-2">
              {CERT_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setCertType(t.value)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition border ${
                    certType === t.value
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="px-5 py-5 space-y-5">
            {globalError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{globalError}</p>
            )}

            {issued && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-emerald-800">
                    Certificate issued — <span className="font-mono">{issued.certificate_no || certNo}</span>
                  </p>
                  <p className="text-xs text-emerald-700 mt-0.5">You can print it from the Issued Certificates list below.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handlePrint({ ...issued, _type: certType, collegeName, collegeAddress })}
                  className="shrink-0 rounded-lg bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 hover:bg-emerald-800 transition"
                >
                  Print Now
                </button>
              </div>
            )}

            {/* Cert no + Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Certificate No.</label>
                <input
                  readOnly
                  value={certNo}
                  placeholder={`Auto-generated on issue (${CERT_TYPES.find(t=>t.value===certType)?.prefix}/yyyy/0001)`}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 cursor-not-allowed"
                />
              </div>
              <FormField
                label="Date" name="certificate_date" type="date"
                value={form.certificate_date} onChange={handleChange}
                error={errors.certificate_date} required
              />
            </div>

            {/* Reg no lookup */}
            <div className="space-y-1">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
                <FormField
                  label="Registration No. (optional)"
                  name="reg_no"
                  value={form.reg_no}
                  onChange={handleChange}
                  placeholder="Enter to auto-fill student details"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleLookup}
                  disabled={lookingUp}
                  className="min-w-[96px]"
                >
                  {lookingUp ? 'Searching…' : 'Search'}
                </Button>
              </div>
              <p className="text-xs text-slate-400">Registration number is optional — you can fill student details manually.</p>
            </div>

            {/* Student name + gender */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                label="Student Name" name="student_name"
                value={form.student_name} onChange={handleChange}
                error={errors.student_name} required
                placeholder="Full name as per records"
              />
              <GenderRadio value={form.gender} onChange={handleChange} error={errors.gender} />
            </div>

            {/* Fields common to bonafide + character */}
            {(certType === 'bonafide' || certType === 'character') && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <FormField
                    label="Class" name="class_name"
                    value={form.class_name} onChange={handleChange}
                    error={errors.class_name} required placeholder="e.g. SY BCOM"
                  />
                  <FormField
                    label="Academic Year" name="academic_year"
                    value={form.academic_year} onChange={handleChange}
                    error={errors.academic_year} required placeholder="e.g. 2026-27"
                  />
                  <FormField
                    label="Roll No." name="roll_no" type="number"
                    value={form.roll_no} onChange={handleChange}
                    error={errors.roll_no} placeholder="Numeric"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <FormField
                    label="Birth Date" name="birth_date" type="date"
                    value={form.birth_date} onChange={handleChange}
                    max={(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 16); return d.toISOString().slice(0,10) })()}
                    error={errors.birth_date}
                  />
                  <FormField
                    label="Caste / Category" name="caste"
                    value={form.caste} onChange={handleChange}
                    placeholder="e.g. Open / OBC / SC / ST"
                  />
                  {certType === 'character' ? (
                    <FormField
                      label="Known From (years)" name="known_from_years" type="number"
                      value={form.known_from_years} onChange={handleChange}
                      error={errors.known_from_years} min={0} placeholder="e.g. 2"
                      hint="Years known to the institution"
                    />
                  ) : (
                    <ExStudentCheckbox checked={form.is_ex_student} onChange={handleChange} />
                  )}
                </div>
                {certType === 'character' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <ExStudentCheckbox checked={form.is_ex_student} onChange={handleChange} />
                  </div>
                )}
              </>
            )}

            {/* NOC-specific fields */}
            {certType === 'noc' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <FormField
                    label="Class" name="class_name"
                    value={form.class_name} onChange={handleChange}
                    error={errors.class_name} required placeholder="e.g. SY BCOM"
                  />
                  <FormField
                    label="From Date" name="from_date" type="date"
                    value={form.from_date} onChange={handleChange}
                    hint="Academic period start"
                  />
                  <FormField
                    label="To Date" name="to_date" type="date"
                    value={form.to_date} onChange={handleChange}
                    error={errors.to_date} hint="Academic period end"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField
                    label="PRN No." name="prn_no"
                    value={form.prn_no} onChange={handleChange}
                    placeholder="University PRN number"
                  />
                  <FormField
                    label="Final Confirmation No." name="final_confirmation_no"
                    value={form.final_confirmation_no} onChange={handleChange}
                    placeholder="Reference / confirmation number"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <ExStudentCheckbox checked={form.is_ex_student} onChange={handleChange} />
                </div>
              </>
            )}

            {/* Submit */}
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button type="submit" disabled={saving} className="min-w-[160px]">
                {saving ? 'Issuing…' : 'Issue Certificate'}
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* ── Issued certificates list ── */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-700">Issued Certificates</p>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="">All Types</option>
              {CERT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input
              type="text"
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name, reg no, cert no…"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-52"
            />
          </div>
        </div>

        {listLoading ? (
          <div className="px-5 py-4"><SkeletonLines rows={4} /></div>
        ) : filteredList.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">
            {allList.length === 0 ? 'No certificates issued yet.' : 'No certificates match the filter.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-1 text-left border-r border-slate-200">Type</th>
                  <th className="px-3 py-1 text-left border-r border-slate-200">Cert. No.</th>
                  <th className="px-3 py-1 text-left border-r border-slate-200">Date</th>
                  <th className="px-3 py-1 text-left border-r border-slate-200">Student</th>
                  <th className="px-3 py-1 text-left border-r border-slate-200">Reg. No.</th>
                  <th className="px-3 py-1 text-left border-r border-slate-200">Class</th>
                  <th className="px-3 py-1 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map(row => {
                  const badge = TYPE_BADGE[row._type] || {}
                  return (
                    <tr key={`${row._type}-${row._id}`} className="hover:bg-slate-50">
                      <td className="px-3 py-1 border-r border-slate-200">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-3 py-1 font-mono text-xs text-slate-700 border-r border-slate-200">{row.certificate_no}</td>
                      <td className="px-3 py-1 text-slate-600 whitespace-nowrap border-r border-slate-200">{fmtDateIN(row.certificate_date)}</td>
                      <td className="px-3 py-1 text-slate-800 border-r border-slate-200">{row.student_name}</td>
                      <td className="px-3 py-1 font-mono text-xs text-slate-500 border-r border-slate-200">{row.reg_no || '—'}</td>
                      <td className="px-3 py-1 text-slate-600 border-r border-slate-200">{row.class_name || '—'}</td>
                      <td className="px-3 py-1 text-right">
                        <button
                          onClick={() => handlePrint(row)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                          Print
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

// ─── Print templates ──────────────────────────────────────────

const PRINT_BASE_CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Times New Roman',Georgia,serif;background:#f1f5f9;color:#1e293b;padding:32px 24px}
  @media print{
    body{background:#fff;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    @page{size:A4;margin:18mm 20mm}
  }
  .meta{display:flex;justify-content:space-between;font-size:13px;color:#334155;margin-bottom:24px}
  .title{text-align:center;font-size:15px;font-weight:bold;letter-spacing:4px;margin:14px 0 24px;text-transform:uppercase;color:#0f172a}
  .body{font-size:14px;line-height:1.85;text-align:justify;color:#1e293b}
  .body strong{color:#0f172a}
  .refs{margin-top:18px;font-size:13px;color:#334155}
  .refs div{margin-bottom:4px}
  .sign{display:flex;justify-content:space-between;margin-top:64px;font-size:13px;color:#334155}
  .sign div{text-align:center}
  .sign div span{display:block;border-top:1px solid #94a3b8;margin-top:48px;padding-top:6px;min-width:200px}
`

function printShell({ accentColor, title, certNo, dateStr, body, collegeName = '', collegeAddress = '', css = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHTML(title)} — ${escapeHTML(certNo)}</title>
  <style>
    ${PRINT_BASE_CSS}
    .sheet{max-width:780px;margin:0 auto;background:#fff;border:6px double ${accentColor};padding:36px 44px}
    .hdr{text-align:center;border-bottom:2px solid ${accentColor};padding-bottom:14px;margin-bottom:22px}
    .hdr .clg-name{font-size:20px;font-weight:bold;color:${accentColor};letter-spacing:.4px;margin-bottom:4px}
    .hdr .clg-addr{font-size:12px;color:#475569;margin-bottom:10px}
    .hdr .cert-title{font-size:17px;font-weight:bold;letter-spacing:4px;text-transform:uppercase;color:#0f172a;margin-top:10px}
    ${css}
  </style>
</head>
<body>
  <div class="sheet">
    <div class="hdr">
      ${collegeName ? `<div class="clg-name">${escapeHTML(collegeName)}</div>` : ''}
      ${collegeAddress ? `<div class="clg-addr">${escapeHTML(collegeAddress)}</div>` : ''}
      <div class="cert-title">${escapeHTML(title)}</div>
    </div>
    <div class="meta">
      <span><strong>Cert. No:</strong> ${escapeHTML(certNo)}</span>
      <span><strong>Date:</strong> ${escapeHTML(dateStr)}</span>
    </div>
    <div class="title">To Whom It May Concern</div>
    <div class="body">${body}</div>
    <div class="sign">
      <div><span>Class Teacher</span></div>
      <div><span>Principal / Authorised Signatory</span></div>
    </div>
  </div>
</body>
</html>`
}

function genderVars(gender) {
  const f = gender === 'Female'
  return { pronoun: f ? 'She' : 'He', possess: f ? 'her' : 'his', title: f ? 'Ms.' : 'Mr.' }
}

function buildBonafideHTML(c, college = {}) {
  const { pronoun, possess, title } = genderVars(c.gender)
  const dateStr = fmtDateIN(c.certificate_date)
  const dobStr  = c.birth_date ? fmtDateIN(c.birth_date) : '__________'
  const exNote  = c.is_ex_student ? 'an ex-student' : 'a bonafide student'
  const body = `
    <p>This is to certify that <strong>${escapeHTML(title)} ${escapeHTML(c.student_name || '')}</strong>
    ${c.reg_no ? `, bearing Registration Number <strong>${escapeHTML(c.reg_no)}</strong>` : ''}
    ${c.roll_no ? ` and Roll Number <strong>${escapeHTML(String(c.roll_no))}</strong>` : ''},
    is ${escapeHTML(exNote)} of this institution.
    ${pronoun} is enrolled in <strong>${escapeHTML(c.class_name || '')}</strong>
    for the academic year <strong>${escapeHTML(c.academic_year || '')}</strong>.</p>
    <br/>
    <p>${pronoun} was born on <strong>${escapeHTML(dobStr)}</strong>${c.caste ? ` and belongs to the <strong>${escapeHTML(c.caste)}</strong> category` : ''}.
    ${possess.charAt(0).toUpperCase() + possess.slice(1)} conduct and character, to the best of our knowledge, have been satisfactory during the period of ${possess} stay at this institution.</p>
    <br/>
    <p>This certificate is issued on ${possess} request for the purpose ${possess} may deem appropriate.</p>
  `
  return printShell({ accentColor: '#1e3a8a', title: 'BONAFIDE CERTIFICATE',
    collegeName: college.name, collegeAddress: college.address,
    certNo: c.certificate_no || '', dateStr, body })
}

function buildCharacterHTML(c, college = {}) {
  const { pronoun, possess, title } = genderVars(c.gender)
  const dateStr = fmtDateIN(c.certificate_date)
  const dobStr  = c.birth_date ? fmtDateIN(c.birth_date) : '__________'
  const exNote  = c.is_ex_student ? 'an ex-student' : 'a student'
  const known   = c.known_from_years != null && c.known_from_years !== '' ? parseInt(c.known_from_years) : null
  const knownSentence = known != null
    ? ` ${pronoun} has been known to the institution for ${known} year${known === 1 ? '' : 's'}.`
    : ''
  const body = `
    <p>This is to certify that <strong>${escapeHTML(title)} ${escapeHTML(c.student_name || '')}</strong>
    ${c.reg_no ? `, bearing Registration Number <strong>${escapeHTML(c.reg_no)}</strong>` : ''}
    ${c.roll_no ? ` and Roll Number <strong>${escapeHTML(String(c.roll_no))}</strong>` : ''},
    is ${escapeHTML(exNote)} of this institution, enrolled in
    <strong>${escapeHTML(c.class_name || '')}</strong> for the academic year
    <strong>${escapeHTML(c.academic_year || '')}</strong>.${knownSentence}</p>
    <br/>
    <p>${pronoun} was born on <strong>${escapeHTML(dobStr)}</strong>${c.caste ? ` and belongs to the <strong>${escapeHTML(c.caste)}</strong> category` : ''}.</p>
    <br/>
    <p>To the best of our knowledge and belief, ${possess} character and conduct have been
    <strong>good</strong> throughout the period of ${possess} association with this institution.
    ${pronoun} bears a sound moral character and has not been involved in any act of misconduct or indiscipline during ${possess} stay.</p>
    <br/>
    <p>We wish ${possess === 'her' ? 'her' : 'him'} every success in ${possess} future endeavours.</p>
  `
  return printShell({ accentColor: '#4c1d95', title: 'CHARACTER CERTIFICATE',
    collegeName: college.name, collegeAddress: college.address,
    certNo: c.certificate_no || '', dateStr, body })
}

function buildNocHTML(c, college = {}) {
  const { pronoun, possess, title } = genderVars(c.gender)
  const dateStr  = fmtDateIN(c.certificate_date)
  const fromStr  = c.from_date ? fmtDateIN(c.from_date) : null
  const toStr    = c.to_date   ? fmtDateIN(c.to_date)   : null
  const exNote   = c.is_ex_student ? 'an ex-student' : 'a student'
  let periodSentence = ''
  if (fromStr && toStr)   periodSentence = ` ${pronoun} attended the institution from <strong>${escapeHTML(fromStr)}</strong> to <strong>${escapeHTML(toStr)}</strong>.`
  else if (fromStr)       periodSentence = ` ${pronoun} has been attending the institution since <strong>${escapeHTML(fromStr)}</strong>.`
  else if (toStr)         periodSentence = ` ${pronoun} attended the institution up to <strong>${escapeHTML(toStr)}</strong>.`
  const refs = (c.prn_no || c.final_confirmation_no) ? `
    <div class="refs">
      ${c.prn_no                ? `<div><strong>PRN No:</strong> ${escapeHTML(c.prn_no)}</div>` : ''}
      ${c.final_confirmation_no ? `<div><strong>Final Confirmation No:</strong> ${escapeHTML(c.final_confirmation_no)}</div>` : ''}
    </div>` : ''
  const body = `
    <p>This is to certify that <strong>${escapeHTML(title)} ${escapeHTML(c.student_name || '')}</strong>
    ${c.reg_no ? `, bearing Registration Number <strong>${escapeHTML(c.reg_no)}</strong>` : ''},
    is ${escapeHTML(exNote)} of this institution, enrolled in
    <strong>${escapeHTML(c.class_name || '')}</strong>.${periodSentence}</p>
    <br/>
    <p>The institution has <strong>no objection</strong> to ${possess} seeking admission, transfer,
    or employment in any other institution or organisation, and confirms that all academic and
    administrative obligations to this institution have been duly discharged on ${possess} part
    as on the date of this certificate.</p>
    <br/>
    <p>We wish ${possess === 'her' ? 'her' : 'him'} every success in ${possess} future endeavours.</p>
    ${refs}
  `
  return printShell({ accentColor: '#065f46', title: 'NO OBJECTION CERTIFICATE',
    collegeName: college.name, collegeAddress: college.address,
    certNo: c.certificate_no || '', dateStr, body })
}
