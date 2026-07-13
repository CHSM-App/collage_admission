import FormField from '../../../../shared/components/FormField.jsx'
import { StepHeader, StepFooter } from './Step1Context.jsx'

const MARITAL = [{ value:'Unmarried', label:'Unmarried' }, { value:'Married', label:'Married' }]
const BLOOD   = ['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(v => ({ value: v, label: v }))

const today = new Date().toISOString().slice(0, 10)
const maxBirthDate = (() => {
  const d = new Date(); d.setFullYear(d.getFullYear() - 16); return d.toISOString().slice(0, 10)
})()

export default function Step3Other({ data, errors, globalError, saving, onChange, onBack, onNext, extraFooter, readOnly, features }) {
  function handleNext() {
    onNext({
      birth_date: data.birth_date, birth_place: data.birth_place,
      birth_taluka: data.birth_taluka, birth_district: data.birth_district,
      birth_state: data.birth_state, nationality: data.nationality,
      marital_status: data.marital_status, religion: data.religion,
      caste: data.caste, mother_tongue: data.mother_tongue,
      height_cm: data.height_cm, weight_kg: data.weight_kg, blood_group: data.blood_group,
      father_full_name: data.father_full_name, son_daughter_number: data.son_daughter_number,
      father_occupation: data.father_occupation, annual_income: data.annual_income,
      aadhaar: data.aadhaar, prn: data.prn, abc_id: data.abc_id,
      university_app_no: data.university_app_no || null,
      bank_account: data.bank_account, bank_ifsc: data.bank_ifsc,
      bank_name: data.bank_name, bank_branch: data.bank_branch,
    })
  }

  const f = features?.admission_form ?? {}
  const showAbc      = f.abc_id       !== false
  const showPrn      = f.prn          !== false
  const showBank     = f.bank_details !== false
  const showHscFlags = f.hsc_subject_flags === true
  const showHostel   = f.hostel_facility   === true

  const e = errors

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
            <FormField label="Birth Place" name="birth_place" value={data.birth_place}
              onChange={onChange} error={e.birth_place} placeholder="Vengurla" />
            <FormField label="Birth Taluka" name="birth_taluka" value={data.birth_taluka}
              onChange={onChange} placeholder="Vengurla" />
            <FormField label="Birth District" name="birth_district" value={data.birth_district}
              onChange={onChange} placeholder="Sindhudurg" />
            <FormField label="Birth State" name="birth_state" value={data.birth_state}
              onChange={onChange} placeholder="Maharashtra" />
            <FormField label="Nationality" name="nationality" value={data.nationality}
              onChange={onChange} error={e.nationality} required placeholder="Indian" />
            <FormField label="Marital Status" name="marital_status" type="select"
              value={data.marital_status} onChange={onChange} error={e.marital_status}
              required options={MARITAL} placeholder="Select…" />
          </div>
        </Section>

        {/* Personal misc */}
        <Section title="Personal Information (Optional)">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Religion"     name="religion"     value={data.religion}     onChange={onChange} placeholder="Hindu" />
            <FormField label="Caste"        name="caste"        value={data.caste}        onChange={onChange} placeholder="e.g. Maratha" />
            <FormField label="Mother Tongue"name="mother_tongue"value={data.mother_tongue}onChange={onChange} placeholder="Marathi" />
            <FormField label="Height (cm)"  name="height_cm"   type="number" value={data.height_cm}  onChange={onChange} placeholder="165" />
            <FormField label="Weight (kg)"  name="weight_kg"   type="number" value={data.weight_kg}  onChange={onChange} placeholder="60" />
            <FormField label="Blood Group"  name="blood_group" type="select" value={data.blood_group} onChange={onChange}
              options={BLOOD} placeholder="Select…" />
          </div>
        </Section>

        {/* Family */}
        <Section title="Family Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Father's Full Name" name="father_full_name" value={data.father_full_name}
              onChange={onChange} error={e.father_full_name} required placeholder="Ramesh Shetty" />
            <FormField label="Son/Daughter Number (Birth Order)" name="son_daughter_number" type="number"
              value={data.son_daughter_number} onChange={onChange} placeholder="1" hint="Your birth order among siblings" />
            <FormField label="Father's Occupation" name="father_occupation" value={data.father_occupation}
              onChange={onChange} error={e.father_occupation} required placeholder="Farmer" />
            <FormField label="Annual Family Income (₹)" name="annual_income" type="number"
              value={data.annual_income} onChange={onChange} error={e.annual_income}
              required placeholder="150000" />
          </div>
        </Section>

        {/* Identity */}
        <Section title="Identity & Academic Numbers">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Aadhaar Number" name="aadhaar" value={data.aadhaar}
              onChange={onChange} error={e.aadhaar} required placeholder="123456789012"
              hint="12 digits, no spaces" maxLength={12} />
            {showAbc && (
              <FormField
                label={`ABC ID (Academic Bank of Credits)${data.year_of_study > 1 ? ' *' : ''}`}
                name="abc_id"
                value={data.abc_id}
                onChange={onChange}
                error={e.abc_id}
                required={data.year_of_study > 1}
                placeholder={data.year_of_study > 1 ? 'Required for SY/TY' : 'Optional for FY'}
                hint={data.year_of_study === 1 ? 'Optional — can be added later once issued' : 'Mandatory for SY and TY'}
              />
            )}
            {showPrn && (
              <FormField
                label={`PRN/ERN${data.year_of_study > 1 ? ' *' : ''}`}
                name="prn" value={data.prn} onChange={onChange} error={e.prn}
                placeholder={data.year_of_study > 1 ? 'Required for SY/TY' : 'Leave blank for FY'}
                hint={data.year_of_study === 1 ? 'Assigned after FY enrollment — leave blank' : 'Mandatory for SY and TY'}
              />
            )}
            <FormField
              label="University Application No."
              name="university_app_no"
              value={data.university_app_no || ''}
              onChange={onChange}
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
              <FormField label="Account Number" name="bank_account" value={data.bank_account}
                onChange={onChange} error={e.bank_account} placeholder="Your bank account number" />
              <FormField label="IFSC Code" name="bank_ifsc" value={data.bank_ifsc}
                onChange={onChange} error={e.bank_ifsc} placeholder="SBIN0001234" />
              <FormField label="Bank Name" name="bank_name" value={data.bank_name}
                onChange={onChange} placeholder="State Bank of India" />
              <FormField label="Branch" name="bank_branch" value={data.bank_branch}
                onChange={onChange} placeholder="Vengurla Main" />
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
