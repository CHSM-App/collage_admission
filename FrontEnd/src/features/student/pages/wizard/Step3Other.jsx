import { useState } from 'react'
import FormField from '../../../../shared/components/FormField.jsx'
import { StepHeader, StepFooter } from './Step1Context.jsx'
import api from '../../../../services/api'
import scrollToField from '../../../../shared/scrollToField.js'
import {
  sanitizeName, toTitleCase, capitalizeWords, digitsOnly, decimalOnly, codeOnly, isValidAadhaar,
} from '../../../../shared/validators.js'

// First letter of each word capitalised on save. All but the bank fields are also
// letters-only while typing (bank names carry "&", branches can carry numbers).
const WORD_FIELDS = ['birth_place', 'birth_taluka', 'birth_district', 'birth_state', 'nationality',
  'religion', 'caste', 'mother_tongue', 'father_occupation', 'bank_name', 'bank_branch']

const MARITAL = [{ value:'Unmarried', label:'Unmarried' }, { value:'Married', label:'Married' }]
const BLOOD   = ['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(v => ({ value: v, label: v }))

const today = new Date().toISOString().slice(0, 10)
const maxBirthDate = (() => {
  const d = new Date(); d.setFullYear(d.getFullYear() - 16); return d.toISOString().slice(0, 10)
})()

export default function Step3Other({ data, errors, globalError, saving, onChange, onBack, onNext, extraFooter, readOnly, features }) {
  // Client-side check failure: { field, msg, value }. Shown until the value changes.
  const [localError, setLocalError] = useState(null)

  // onChange that runs the typed value through a filter first
  const filtered = fn => ev => onChange({ target: { name: ev.target.name, value: fn(ev.target.value) } })
  const onWord = filtered(sanitizeName)

  function onIfscChange(ev) {
    const ifsc = codeOnly(ev.target.value, 11)
    onChange({ target: { name: 'bank_ifsc', value: ifsc } })
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return
    api.get(`api/ifsc/${ifsc}`)
      .then(({ data: b }) => {
        if (!b?.bank_name) return
        onChange({ target: { name: 'bank_name', value: b.bank_name } })
        onChange({ target: { name: 'bank_branch', value: b.branch } })
      })
      .catch(() => {}) // lookup is a convenience; user can still type manually
  }

  function handleNext() {
    const num = v => parseFloat(v)
    // Checked in on-screen order, so the scroll lands on the topmost problem
    const checks = [
      [data.height_cm && (num(data.height_cm) < 50 || num(data.height_cm) > 250), 'height_cm', 'Height must be between 50 and 250 cm.'],
      [data.weight_kg && (num(data.weight_kg) < 10 || num(data.weight_kg) > 300), 'weight_kg', 'Weight must be between 10 and 300 kg.'],
      [data.son_daughter_number && num(data.son_daughter_number) < 1,             'son_daughter_number', 'Birth order must be 1 or more.'],
      [data.aadhaar && !isValidAadhaar(data.aadhaar),                             'aadhaar', 'Aadhaar must be 12 digits and cannot start with 0 or 1.'],
      [data.abc_id && String(data.abc_id).length !== 12,                          'abc_id',  'ABC ID must be exactly 12 digits.'],
    ]
    const failed = checks.find(([bad]) => bad)
    if (failed) {
      const [, field, msg] = failed
      setLocalError({ field, msg, value: data[field] })
      scrollToField(field)
      return
    }
    setLocalError(null)

    // Fix casing and reflect it on screen, so Review shows exactly what is stored
    const fixed = {
      father_full_name: toTitleCase(data.father_full_name),
      ...Object.fromEntries(WORD_FIELDS.map(k => [k, capitalizeWords(data[k])])),
    }
    Object.entries(fixed).forEach(([k, v]) => { if ((data[k] || '') !== v) onChange({ target: { name: k, value: v } }) })

    onNext({
      birth_date: data.birth_date, birth_place: fixed.birth_place,
      birth_taluka: fixed.birth_taluka, birth_district: fixed.birth_district,
      birth_state: fixed.birth_state, nationality: fixed.nationality,
      marital_status: data.marital_status, religion: fixed.religion,
      caste: fixed.caste, mother_tongue: fixed.mother_tongue,
      height_cm: data.height_cm, weight_kg: data.weight_kg, blood_group: data.blood_group,
      father_full_name: fixed.father_full_name, son_daughter_number: data.son_daughter_number,
      father_occupation: fixed.father_occupation, annual_income: data.annual_income,
      aadhaar: data.aadhaar, prn: data.prn, abc_id: data.abc_id,
      university_app_no: data.university_app_no || null,
      bank_account: data.bank_account, bank_ifsc: data.bank_ifsc,
      bank_name: fixed.bank_name, bank_branch: fixed.bank_branch,
    })
  }

  const f = features?.admission_form ?? {}
  const showAbc      = f.abc_id       !== false
  const showPrn      = f.prn          !== false
  const showBank     = f.bank_details !== false
  const showHscFlags = f.hsc_subject_flags === true
  const showHostel   = f.hostel_facility   === true

  const e = localError && data[localError.field] === localError.value
    ? { ...errors, [localError.field]: localError.msg }
    : errors

  return (
    <div>
      <StepHeader
        step={3}
        title="Other Details"
        desc="Birth information, family details, identity numbers, and optional bank details."
      />

      <div className="px-4 sm:px-5 py-5 space-y-6">

        {/* Birth info */}
        <Section title="Birth Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Date of Birth" name="birth_date" type="date" value={data.birth_date}
              onChange={onChange} error={e.birth_date} required max={maxBirthDate} />
            <FormField label="Age" value={calcAge(data.birth_date)} readOnly
              hint="Auto-calculated from date of birth" />
            <FormField label="Birth Place" name="birth_place" value={data.birth_place} inputClassName="capitalize"
              onChange={onWord} error={e.birth_place} placeholder="Vengurla" maxLength={100} />
            <FormField label="Birth Taluka" name="birth_taluka" value={data.birth_taluka} error={e.birth_taluka} inputClassName="capitalize"
              onChange={onWord} placeholder="Vengurla" maxLength={100} />
            <FormField label="Birth District" name="birth_district" value={data.birth_district} error={e.birth_district} inputClassName="capitalize"
              onChange={onWord} placeholder="Sindhudurg" maxLength={100} />
            <FormField label="Birth State" name="birth_state" value={data.birth_state} error={e.birth_state} inputClassName="capitalize"
              onChange={onWord} placeholder="Maharashtra" maxLength={100} />
            <FormField label="Nationality" name="nationality" value={data.nationality} inputClassName="capitalize"
              onChange={onWord} error={e.nationality} required placeholder="Indian" maxLength={50} />
            <FormField label="Marital Status" name="marital_status" type="select"
              value={data.marital_status} onChange={onChange} error={e.marital_status}
              required options={MARITAL} placeholder="Select…" />
          </div>
        </Section>

        {/* Personal misc */}
        <Section title="Personal Information (Optional)">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Religion"     name="religion"     value={data.religion}     error={e.religion} onChange={onWord} inputClassName="capitalize" maxLength={50} placeholder="Hindu" />
            <FormField label="Caste"        name="caste"        value={data.caste}        error={e.caste} onChange={onWord} inputClassName="capitalize" maxLength={50} placeholder="e.g. Maratha" />
            <FormField label="Mother Tongue"name="mother_tongue"value={data.mother_tongue} error={e.mother_tongue} onChange={onWord} inputClassName="capitalize" maxLength={50} placeholder="Marathi" />
            <FormField label="Height (cm)"  name="height_cm"   value={data.height_cm}  onChange={filtered(v => decimalOnly(v, 5))}
              inputMode="decimal" error={e.height_cm} placeholder="165" />
            <FormField label="Weight (kg)"  name="weight_kg"   value={data.weight_kg}  onChange={filtered(v => decimalOnly(v, 5))}
              inputMode="decimal" error={e.weight_kg} placeholder="60" />
            <FormField label="Blood Group"  name="blood_group" type="select" value={data.blood_group} onChange={onChange}
              options={BLOOD} placeholder="Select…" />
          </div>
        </Section>

        {/* Family */}
        <Section title="Family Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Father's Full Name" name="father_full_name" value={data.father_full_name}
              onChange={onWord} inputClassName="uppercase" error={e.father_full_name} required placeholder="Ramesh Shetty" maxLength={150} />
            <FormField label="Son/Daughter Number (Birth Order)" name="son_daughter_number" inputMode="numeric"
              value={data.son_daughter_number} onChange={filtered(v => digitsOnly(v, 2))} error={e.son_daughter_number}
              placeholder="1" hint="Your birth order among siblings" />
            <FormField label="Father's Occupation" name="father_occupation" value={data.father_occupation} inputClassName="capitalize"
              onChange={onWord} error={e.father_occupation} required placeholder="Farmer" maxLength={100} />
            <FormField label="Annual Family Income (₹)" name="annual_income" inputMode="numeric"
              value={data.annual_income} onChange={filtered(v => digitsOnly(v, 10))} error={e.annual_income}
              required placeholder="150000" hint="Digits only" />
          </div>
        </Section>

        {/* Identity */}
        <Section title="Identity & Academic Numbers">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Aadhaar Number" name="aadhaar" value={data.aadhaar}
              onChange={filtered(v => digitsOnly(v, 12))} error={e.aadhaar} required placeholder="123456789012"
              hint="12 digits, no spaces" maxLength={12} inputMode="numeric" />
            {showAbc && (
              <FormField
                label={`ABC ID (Academic Bank of Credits)${data.year_of_study > 1 ? ' *' : ''}`}
                name="abc_id"
                value={data.abc_id}
                onChange={filtered(v => digitsOnly(v, 12))}
                inputMode="numeric"
                error={e.abc_id}
                required={data.year_of_study > 1}
                placeholder="123456789012"
                maxLength={12}
                hint={data.year_of_study === 1
                  ? '12 digits — optional, can be added later once issued'
                  : '12 digits, no spaces — mandatory for SY and TY'}
              />
            )}
            {showPrn && (
              <FormField
                label={`PRN/ERN${data.year_of_study > 1 ? ' *' : ''}`}
                name="prn" value={data.prn} onChange={filtered(v => codeOnly(v, 20))} error={e.prn} maxLength={20}
                placeholder={data.year_of_study > 1 ? 'Required for SY/TY' : 'Leave blank for FY'}
                hint={data.year_of_study === 1 ? 'Assigned after FY enrollment — leave blank' : 'Mandatory for SY and TY'}
              />
            )}
            <FormField
              label="University Application No."
              name="university_app_no"
              value={data.university_app_no || ''}
              onChange={filtered(v => codeOnly(v, 30, '/-'))}
              maxLength={30}
              placeholder="Enter university application number"
              hint="Optional — as issued by the university"
            />
          </div>
        </Section>

        {/* HSC Subject Flags */}
        {showHscFlags && (
          <Section title="HSC Subjects">
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" name="hsc_maths"
                  checked={!!data.hsc_maths}
                  onChange={e => onChange({ target: { name: 'hsc_maths', value: e.target.checked } })}
                  className="h-4 w-4 accent-slate-800"
                />
                Passed with Maths at HSC
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" name="hsc_biology"
                  checked={!!data.hsc_biology}
                  onChange={e => onChange({ target: { name: 'hsc_biology', value: e.target.checked } })}
                  className="h-4 w-4 accent-slate-800"
                />
                Passed with Biology at HSC
              </label>
            </div>
          </Section>
        )}

        {/* Hostel */}
        {showHostel && (
          <Section title="Hostel">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" name="hostel_facility"
                checked={!!data.hostel_facility}
                onChange={e => onChange({ target: { name: 'hostel_facility', value: e.target.checked } })}
                className="h-4 w-4 accent-slate-800"
              />
              Hostel Facility Required
            </label>
          </Section>
        )}

        {/* Bank */}
        {showBank && (
          <Section title="Bank Account Details (Optional)">
            <p className="text-xs text-slate-400 mb-3">
              If you provide any bank detail, Account Number and IFSC become mandatory.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="IFSC Code" name="bank_ifsc" value={data.bank_ifsc}
                onChange={onIfscChange} error={e.bank_ifsc} placeholder="SBIN0001234" maxLength={11}
                hint="Bank name and branch fill automatically" />
              <FormField label="Account Number" name="bank_account" value={data.bank_account}
                onChange={ev => onChange({ target: { name: 'bank_account', value: ev.target.value.replace(/\D/g, '').slice(0, 18) } })}
                error={e.bank_account} placeholder="Your bank account number" inputMode="numeric" maxLength={18}
                hint="Digits only, 9–18" />
              <FormField label="Bank Name" name="bank_name" value={data.bank_name} inputClassName="capitalize"
                onChange={onChange} placeholder="State Bank of India" maxLength={100} />
              <FormField label="Branch" name="bank_branch" value={data.bank_branch} inputClassName="capitalize"
                onChange={onChange} placeholder="Vengurla Main" maxLength={100} />
            </div>
          </Section>
        )}

        {globalError && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{globalError}</p>
        )}

        <StepFooter onBack={onBack} onNext={handleNext} saving={saving} extraFooter={extraFooter} readOnly={readOnly} />
      </div>
    </div>
  )
}

function calcAge(dob) {
  if (!dob) return ''
  const d = new Date(dob)
  if (isNaN(d)) return ''
  const today = new Date()
  let age = today.getFullYear() - d.getFullYear()
  const m = today.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--
  return `${age} years`
}

function Section({ title, children }) {
  return (
    <div>
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400 border-b border-slate-100 pb-1.5">{title}</p>
      {children}
    </div>
  )
}
