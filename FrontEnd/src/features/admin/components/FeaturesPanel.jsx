import { useEffect, useState } from 'react'
import { getCollegeFeatures, updateAdminCollege } from '../../../services/adminService.js'
import Button from '../../../shared/components/Button.jsx'

const COLLEGE_TYPE_OPTIONS = [
  {
    value: 'general',
    label: 'General (BSc / BCom / Arts)',
    desc: 'Standard admission form — caste category, bank details, ABC ID, PRN.',
  },
  {
    value: 'agriculture',
    label: 'Agriculture',
    desc: 'General fields plus Admitted/Other Category, Admission Quota, Hostel Facility, HSC subject flags and a certificate checklist.',
  },
]

export default function FeaturesPanel({ collegeId }) {
  const [collegeType, setCollegeType] = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]       = useState(false)
  const [selected,    setSelected]     = useState('general')
  const [msg,         setMsg]          = useState('')

  useEffect(() => {
    let active = true
    getCollegeFeatures(collegeId)
      .then(r => {
        if (!active) return
        const type = r.data.college_type || 'general'
        setCollegeType(type)
        setSelected(type)
      })
      .catch(() => { if (active) { setCollegeType('general'); setSelected('general') } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [collegeId])

  async function save() {
    setSaving(true)
    setMsg('')
    try {
      await updateAdminCollege(collegeId, { college_type: selected })
      setCollegeType(selected)
      setMsg('saved')
    } catch {
      setMsg('error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-slate-400 py-4">Loading…</p>

  const dirty = selected !== collegeType

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">College Type</h3>
        <p className="text-xs text-slate-400 mt-1">
          The type decides which fields the admission form collects. Changing it re-applies that type's full field set.
        </p>
      </div>

      <div className="space-y-3">
        {COLLEGE_TYPE_OPTIONS.map(opt => {
          const active = selected === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => { setSelected(opt.value); setMsg('') }}
              className={`w-full text-left rounded-xl border p-4 transition
                ${active ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-500' : 'border-slate-200 bg-white hover:border-slate-300'}`}
            >
              <div className="flex items-center gap-2">
                <span className={`flex h-4 w-4 items-center justify-center rounded-full border-2
                  ${active ? 'border-amber-500' : 'border-slate-300'}`}>
                  {active && <span className="h-2 w-2 rounded-full bg-amber-500" />}
                </span>
                <p className="text-sm font-semibold text-slate-800">{opt.label}</p>
              </div>
              <p className="text-xs text-slate-400 mt-1 ml-6">{opt.desc}</p>
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={save} loading={saving} disabled={!dirty}>Save College Type</Button>
        {msg === 'saved' && <span className="text-sm font-semibold text-emerald-600">College type saved.</span>}
        {msg === 'error' && <span className="text-sm font-semibold text-red-600">Failed to save.</span>}
      </div>
    </div>
  )
}
