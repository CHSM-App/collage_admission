import { useEffect, useState, useRef } from 'react'
import FormField from '../../../../shared/components/FormField.jsx'
import { StepHeader, StepFooter } from './Step1Context.jsx'
import { getFaculty, getDivisions, computeFees, getCategoryMaster } from '../../../../services/masterService.js'

const YEAR_LEVEL_MAP = { 1: 'FY', 2: 'SY', 3: 'TY' }
const SEX_OPTIONS    = [{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Other' }]
const FUNDING_LABELS = { Granted: 'Granted', NonGranted: 'Non-Granted', Both: 'Both' }
const FUNDING_COLORS = {
  Granted:    'bg-green-50 text-green-700 border-green-200',
  NonGranted: 'bg-amber-50 text-amber-700 border-amber-200',
  Both:       'bg-blue-50 text-blue-700 border-blue-200',
}

export default function Step2Personal({ data, errors, globalError, saving, onChange, onBack, onNext, readOnly, isCollege }) {
  const [determined, setDetermined]         = useState({ category: '', reason: '' })
  const [overrideMode, setOverrideMode]     = useState(!!data.fees_category_override)
  const [overrideRemark, setOverrideRemark] = useState(data.fees_category_override_remark || '')
  const [localError, setLocalError]         = useState('')

  // Category master (dynamic, from backend)
  const [categoryMaster, setCategoryMaster] = useState(null)

  // Masters data
  const [divisions, setDivisions]       = useState([])
  const [degreeCourse, setDegreeCourse] = useState(null)
  const [feeResult, setFeeResult]       = useState(null)
  const [feeLoading, setFeeLoading]     = useState(false)

  const feeDebounce = useRef(null)

  // Derived options from master (fall back to empty until loaded)
  const casteOptions   = categoryMaster ? categoryMaster.castes.filter(c => c.is_active).map(c => c.caste_name) : []
  const specialOptions = categoryMaster ? categoryMaster.specialStatuses.filter(s => s.is_active).map(s => s.status_name) : []
  const feesOptions    = categoryMaster ? categoryMaster.feesCategories.filter(f => f.is_active).map(f => f.category_name) : []

  // Dynamic determineFeesCategory using master mappings
  function determineFeesCategory(casteName, specialStatus) {
    if (!categoryMaster) return { category: '', reason: '' }
    const { castes, specialStatuses, feesCategories, casteMappings, statusMappings } = categoryMaster

    const casteRow  = castes.find(c => c.caste_name === casteName)
    const casteMap  = casteRow ? casteMappings.find(m => m.caste_id === casteRow.id) : null
    const fcFromCaste = casteMap ? feesCategories.find(f => f.id === casteMap.fees_category_id) : null

    const statusRow = specialStatus ? specialStatuses.find(s => s.status_name === specialStatus) : null
    const statusMap = statusRow ? statusMappings.find(m => m.special_status_id === statusRow.id) : null
    const fcFromStatus = statusMap ? feesCategories.find(f => f.id === statusMap.fees_category_id) : null

    // Special status overrides caste; fallback to caste category
    const fc = fcFromStatus || fcFromCaste
    if (!fc) {
      return { category: feesOptions[0] || '', reason: 'No category mapping found.' }
    }
    return { category: fc.category_name, reason: `${fc.category_name} assigned.` }
  }

  // Special status only enabled for castes marked is_gen_type
  const selectedCasteRow      = categoryMaster?.castes?.find(c => c.caste_name === data.category)
  const specialStatusDisabled = categoryMaster ? !selectedCasteRow?.is_gen_type : data.category !== 'Gen.'

  // ── Load category master for this college ──
  useEffect(() => {
    if (!data.college_id) return
    getCategoryMaster(data.college_id)
      .then(r => setCategoryMaster(r.data.data))
      .catch(() => {})
  }, [data.college_id])

  // ── Load divisions + degree course for this college+course+year ──
  useEffect(() => {
    const collegeId = data.college_id
    const courseId  = data.course_id
    const yearLevel = YEAR_LEVEL_MAP[data.year_of_study]
    if (!collegeId || !courseId || !yearLevel) return

    // Fetch divisions for this program+year
    getDivisions(collegeId, courseId, yearLevel)
      .then(r => setDivisions((r.data.data || []).filter(d => d.is_active)))
      .catch(() => {})

    // Fetch degree course info (faculty_master)
    getFaculty(collegeId)
      .then(r => {
        const match = (r.data.data || []).find(f => f.code_no === courseId)
        setDegreeCourse(match || null)
        // Auto-set degree_course_code if not already set
        if (match && !data.degree_course_code) {
          onChange({ target: { name: 'degree_course_code', value: match.degree_course_code } })
        }
      })
      .catch(() => {})
  }, [data.college_id, data.course_id, data.year_of_study])

  // ── Clear special_status when selected caste doesn't allow it ──
  useEffect(() => {
    if (specialStatusDisabled && data.special_status) {
      onChange({ target: { name: 'special_status', value: '' } })
    }
  }, [data.category, categoryMaster])

  // ── Auto-determine fees_category from caste+special_status ──
  useEffect(() => {
    if (!categoryMaster) return  // wait until master is loaded before overwriting
    const result = determineFeesCategory(data.category, data.special_status)
    setDetermined(result)
    if (!overrideMode) {
      onChange({ target: { name: 'fees_category', value: result.category } })
      onChange({ target: { name: 'fees_category_override', value: false } })
      onChange({ target: { name: 'fees_category_override_remark', value: '' } })
    }
  }, [data.category, data.special_status, overrideMode, categoryMaster])

  // Keep remark in sync
  useEffect(() => {
    onChange({ target: { name: 'fees_category_override_remark', value: overrideRemark } })
  }, [overrideRemark])

  // ── Compute fee breakdown from backend whenever relevant fields change ──
  useEffect(() => {
    const collegeId = data.college_id
    const courseId  = data.course_id
    const yearLevel = YEAR_LEVEL_MAP[data.year_of_study]
    if (!collegeId || !courseId || !yearLevel) return

    clearTimeout(feeDebounce.current)
    feeDebounce.current = setTimeout(async () => {
      setFeeLoading(true)
      try {
        const r = await computeFees(collegeId, {
          faculty_master_id: courseId,
          year_level:        yearLevel,
          division_letter:   data.division || null,
          caste:             data.category || null,
          special_status:    data.special_status || null,
        })
        setFeeResult(r.data.data || null)
      } catch {
        setFeeResult(null)
      } finally {
        setFeeLoading(false)
      }
    }, 400)
  }, [data.college_id, data.course_id, data.year_of_study, data.division, data.category, data.special_status])

  function enterOverride() {
    setOverrideMode(true)
    onChange({ target: { name: 'fees_category_override', value: true } })
  }

  function cancelOverride() {
    setOverrideMode(false)
    setOverrideRemark('')
    const result = categoryMaster
      ? determineFeesCategory(data.category, data.special_status)
      : { category: '' }
    onChange({ target: { name: 'fees_category', value: result.category } })
    onChange({ target: { name: 'fees_category_override', value: false } })
    onChange({ target: { name: 'fees_category_override_remark', value: '' } })
  }

  function handleDivisionSelect(letter) {
    const same = data.division === letter
    onChange({ target: { name: 'division', value: same ? '' : letter } })
  }

  function handleNext() {
    // Validate division (college only)
    if (isCollege && divisions.length > 0 && !data.division) {
      setLocalError('Division selection is required.'); return
    }
    // Validate caste selection
    if (!data.category) {
      setLocalError('Caste / Community Category is required.'); return
    }
    // Validate mobile
    if (data.mobile && !/^[6-9]\d{9}$/.test(data.mobile.trim())) {
      setLocalError('Mobile number must be 10 digits starting with 6–9.'); return
    }
    setLocalError('')
    onNext({
      surname: data.surname, first_name: data.first_name,
      middle_name: data.middle_name, mother_name: data.mother_name,
      sex: data.sex, mobile: data.mobile, email: data.email,
      address: data.address, taluka: data.taluka, district: data.district, state: data.state,
      category:       data.category       || null,
      special_status: data.special_status || null,
      fees_category:  data.fees_category || (determined.category || null),
      fees_category_override:        overrideMode,
      fees_category_override_remark: overrideMode ? overrideRemark : '',
      degree_course_code: data.degree_course_code || degreeCourse?.degree_course_code || null,
      division: data.division || null,
    })
  }

  // Auto-capitalize first letter for name fields
  function onNameChange(e) {
    const val = e.target.value
    const capitalized = val.length > 0 ? val.charAt(0).toUpperCase() + val.slice(1) : val
    onChange({ target: { name: e.target.name, value: capitalized } })
  }

  const e = errors

  return (
    <div>
      <StepHeader step={2} title="Personal Details"
        desc="Fill in your personal and contact information. Fields marked * are mandatory." />

      <div className="px-4 sm:px-5 py-5 space-y-5">

        {/* Name */}
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Full Name</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <FormField label="Surname"                name="surname"     value={data.surname}     onChange={onNameChange} error={e.surname}     required placeholder="Shetty" />
            <FormField label="First Name"             name="first_name"  value={data.first_name}  onChange={onNameChange} error={e.first_name}  required placeholder="Aarav" />
            <FormField label="Middle / Father's Name" name="middle_name" value={data.middle_name} onChange={onNameChange} error={e.middle_name} required placeholder="Ramesh" />
            <FormField label="Mother's First Name"    name="mother_name" value={data.mother_name} onChange={onNameChange} error={e.mother_name} required placeholder="Sunita" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Gender" name="sex" type="select" value={data.sex} onChange={onChange}
            error={e.sex} required options={SEX_OPTIONS} placeholder="Select gender…" />
          <FormField label="Mobile Number" name="mobile" type="tel" value={data.mobile}
            onChange={e => onChange({ target: { name: 'mobile', value: e.target.value.replace(/\D/g, '').slice(0, 10) } })}
            error={e.mobile} required placeholder="9876543210" hint="10 digits, starting with 6-9" maxLength={10} inputMode="numeric" />
        </div>

        <FormField label="Email Address" name="email" type="email" value={data.email}
          onChange={onChange} error={e.email} required readOnly
          hint="Pre-filled from your account. Cannot be changed here." />

        {/* Address */}
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Residential Address</p>
          <div className="space-y-3">
            <FormField label="Address" name="address" type="textarea" rows={2} value={data.address}
              onChange={onChange} error={e.address} required={!isCollege} placeholder="House no., Street, Area…" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label="Taluka"   name="taluka"   value={data.taluka}   onChange={onChange} error={e.taluka}   required={!isCollege} placeholder="Vengurla" />
              <FormField label="District" name="district" value={data.district} onChange={onChange} error={e.district} required={!isCollege} placeholder="Sindhudurg" />
              <FormField label="State"    name="state"    value={data.state}    onChange={onChange} error={e.state}    required={!isCollege} placeholder="Maharashtra" />
            </div>
          </div>
        </div>

        {/* Degree Course */}
        {degreeCourse && (
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Degree Course</p>
            <p className="font-semibold text-slate-800">{degreeCourse.degree_course_code}
              <span className="ml-2 font-normal text-slate-500 text-sm">— {degreeCourse.degree_course_name}</span>
            </p>
            <p className="text-xs text-slate-400 mt-0.5">{degreeCourse.duration_years}-year program &nbsp;·&nbsp; {YEAR_LEVEL_MAP[data.year_of_study]} ({data.year_of_study === 1 ? 'First' : data.year_of_study === 2 ? 'Second' : 'Third'} Year)</p>
          </div>
        )}


        {/* Division — college only */}
        {isCollege && divisions.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Division</p>
            <div className="flex flex-wrap gap-2">
              {divisions.map(d => (
                <button
                  key={d.division_letter}
                  type="button"
                  onClick={() => handleDivisionSelect(d.division_letter)}
                  className={`px-4 py-1.5 rounded-lg border text-sm font-semibold transition ${
                    data.division === d.division_letter
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'
                  }`}
                >
                  {d.division_letter}
                  {d.funding_type && <span className="ml-1.5 text-xs font-normal opacity-70">{d.funding_type}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Caste Category */}
        <FormField label={<span>Caste / Community Category <span className="text-red-500">*</span></span>}>
          {!categoryMaster ? (
            <p className="text-xs text-slate-400 mt-1">Loading categories…</p>
          ) : (
            <RadioGroup
              name="category"
              options={casteOptions}
              value={data.category}
              onChange={v => onChange({ target: { name: 'category', value: v } })}
            />
          )}
          {categoryMaster && !data.category && <p className="mt-1 text-xs text-slate-400">This field is mandatory — please select one.</p>}
          {e.category && <p className="mt-1 text-xs font-medium text-red-600">{e.category}</p>}
        </FormField>

        {/* Special Status */}
        <FormField
          label="Special Status (Optional)"
          hint={specialStatusDisabled ? 'Special status is only applicable for General (Gen.) category.' : 'Select only if applicable — may qualify for additional concession.'}
        >
          <RadioGroup
            name="special_status"
            options={specialOptions}
            value={data.special_status}
            onChange={v => onChange({ target: { name: 'special_status', value: v } })}
            clearable
            disabled={specialStatusDisabled}
          />
        </FormField>

        {/* Fees Category */}
        <FormField
          label={
            <span className="flex items-center gap-2">
              Fees Category
              <span className="text-xs font-normal text-slate-400">
                {overrideMode ? '— manual override' : '— auto-determined'}
              </span>
              {!overrideMode && (
                <button type="button" onClick={enterOverride}
                  className="text-xs font-semibold text-amber-600 hover:text-amber-800 underline underline-offset-2">
                  Override
                </button>
              )}
              {overrideMode && (
                <button type="button" onClick={cancelOverride}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline underline-offset-2">
                  Cancel override
                </button>
              )}
            </span>
          }
          required
        >
          <div className="space-y-2">
            {determined.reason && (
              <div className="flex items-start gap-1.5 text-xs text-slate-500">
                <svg className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{determined.reason}</span>
              </div>
            )}
            <RadioGroup
              name="fees_category"
              options={feesOptions}
              value={data.fees_category}
              onChange={v => overrideMode && onChange({ target: { name: 'fees_category', value: v } })}
              disabled={!overrideMode}
              autoValue={!overrideMode ? determined.category : null}
              autoSelected={!overrideMode}
            />
            {overrideMode && (
              <div className="flex flex-col gap-1 pt-1">
                <label className="text-xs font-semibold text-slate-600">
                  Override Remark <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={overrideRemark}
                  onChange={e => setOverrideRemark(e.target.value)}
                  placeholder="Reason for manual override…"
                  className="w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
                {!overrideRemark.trim() && (
                  <p className="text-xs text-amber-600">A remark is required when overriding.</p>
                )}
              </div>
            )}
          </div>
          {e.fees_category && !determined.category && <p className="mt-1 text-xs font-medium text-red-600">{e.fees_category}</p>}
        </FormField>

        {/* Fee Breakdown */}
        {/* <FeeBreakdown result={feeResult} loading={feeLoading} /> */}

        {(localError || globalError) && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{localError || globalError}</p>
        )}

        <StepFooter onBack={onBack} onNext={handleNext} saving={saving} readOnly={readOnly} />
      </div>
    </div>
  )
}

// ── Fee Breakdown panel ───────────────────────────────────────
function FeeBreakdown({ result, loading }) {
  if (loading) {
    return (
      <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-400 animate-pulse">
        Computing fee breakdown…
      </div>
    )
  }
  if (!result || !result.breakdown?.length) return null

  const fmt = n => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-800 flex items-center justify-between">
        <p className="text-xs font-bold text-white uppercase tracking-wide">Fee Breakdown</p>
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span>Category {result.feesCategorySlab}</span>
        </div>
      </div>

      {/* Reason lines */}
      {result.slabReason && (
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 space-y-0.5">
          <p className="text-xs text-slate-500">{result.slabReason}</p>
        </div>
      )}

      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
          <tr>
            <th className="px-4 py-2 text-left">Fee Head</th>
            <th className="px-4 py-2 text-center w-20">Type</th>
            <th className="px-4 py-2 text-right w-28">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {result.breakdown.map(row => (
            <tr key={row.fees_code} className="hover:bg-slate-50">
              <td className="px-4 py-2 text-slate-800">{row.fees_head}
                <span className="ml-2 text-xs text-slate-400">{row.short_name}</span>
              </td>
              <td className="px-4 py-2 text-center">
                <span className="text-xs text-slate-500">{row.fees_type}</span>
              </td>
              <td className="px-4 py-2 text-right font-mono text-slate-800">{fmt(row.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-slate-200">
          <tr className="bg-slate-50">
            <td colSpan={2} className="px-4 py-2.5 text-sm font-semibold text-slate-700">Total Fees</td>
            <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">{fmt(result.totalFee)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ── Shared radio group ────────────────────────────────────────
function RadioGroup({ name, options, value, onChange, disabled, clearable, autoValue, autoSelected }) {
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {options.map(opt => {
        const checked = value === opt || (autoSelected && autoValue === opt)
        const isAuto  = autoValue === opt && autoSelected
        return (
          <label key={opt} className={`flex items-center gap-1.5 cursor-pointer ${disabled ? 'cursor-default' : ''}`}>
            <input
              type="radio"
              name={name}
              value={opt}
              checked={checked}
              disabled={disabled}
              onChange={() => !disabled && onChange(opt)}
              className="h-3.5 w-3.5 accent-slate-800"
            />
            <span className={`text-sm px-2 py-0.5 rounded border transition select-none ${
              checked
                ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                : 'bg-white text-slate-600 border-slate-200'
            } ${disabled && !checked ? 'opacity-50' : ''}`}>
              {opt}
            </span>
          </label>
        )
      })}
      {clearable && value && !disabled && (
        <button type="button" onClick={() => onChange('')} className="text-xs text-slate-400 hover:text-red-500 self-center">✕</button>
      )}
    </div>
  )
}
