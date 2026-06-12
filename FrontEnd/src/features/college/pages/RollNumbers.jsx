import { useEffect, useState } from 'react'
import { generateRollNumbers } from '../../../services/collegeAdminService.js'
import { getFaculty } from '../../../services/masterService.js'
import Button from '../../../shared/components/Button.jsx'
import { usePermissions } from '../hooks/usePermissions.js'
import { SkeletonLine } from '../../../shared/components/Skeleton.jsx'
import { getErrorMessage } from '../../../shared/hooks/useNetworkError.js'

const YEAR_LABEL = { 1: 'FY', 2: 'SY', 3: 'TY', 4: '4Y', 5: '5Y' }
const YEAR_LONG  = { 1: 'FY — First Year', 2: 'SY — Second Year', 3: 'TY — Third Year', 4: '4Y — Fourth Year', 5: '5Y — Fifth Year' }

export default function RollNumbers({ collegeId }) {
  const { canWrite } = usePermissions()
  const rw = canWrite('assign_subjects')
  const [courses, setCourses]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [generating, setGenerating] = useState(false)
  const [result, setResult]         = useState(null)
  const [error, setError]           = useState('')
  const [form, setForm] = useState({ course_id: '', year_of_study: '' })

  useEffect(() => {
    getFaculty(collegeId)
      .then(r => setCourses((r.data.data || []).filter(f => f.is_active)))
      .catch(() => setError('Failed to load courses.'))
      .finally(() => setLoading(false))
  }, [collegeId])

  const selectedCourse = courses.find(c => String(c.code_no) === String(form.course_id))
  const maxYear = Math.max(1, Math.min(5, parseInt(selectedCourse?.duration_years) || 3))
  const yearOptions = Array.from({ length: maxYear }, (_, i) => i + 1)

  // Reset year when course changes and current selection is out of range
  useEffect(() => {
    if (selectedCourse && form.year_of_study && parseInt(form.year_of_study) > maxYear) {
      setForm(f => ({ ...f, year_of_study: '' }))
    }
  }, [selectedCourse, maxYear])

  async function handleGenerate(e) {
    e.preventDefault()
    if (!form.course_id || !form.year_of_study) return
    setGenerating(true)
    setResult(null)
    setError('')
    try {
      const res = await generateRollNumbers(collegeId, form)
      setResult(res.data)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to generate roll numbers.'))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <section className="space-y-6 max-w-2xl">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">College portal</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Generate Roll Numbers</h1>
        <p className="mt-1 text-slate-600">
          Assigns sequential roll numbers to all students with "Fees Paid" status.
          You can run this multiple times — it only assigns numbers to students who don't have one yet.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">How it works</p>
        <ul className="mt-2 space-y-1 text-sm text-slate-600 list-disc list-inside">
          <li>Finds all <strong>Fees Paid</strong> applications for the selected course and year of study with no roll number yet.</li>
          <li>Assigns roll numbers in the order fees were paid — first to pay gets the lowest number.</li>
          <li>Roll numbers are unique per college + course + year of study.</li>
          <li>Safe to run multiple times — only unassigned students are processed.</li>
        </ul>
      </div>

      <form onSubmit={handleGenerate} className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <p className="font-semibold text-slate-950">Select course &amp; year</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Course</label>
            {loading
              ? <SkeletonLine className="h-9 w-full rounded-md" />
              : (
                <select
                  required
                  value={form.course_id}
                  onChange={e => setForm(f => ({ ...f, course_id: e.target.value, year_of_study: '' }))}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Select course…</option>
                  {courses.map(c => (
                    <option key={c.code_no} value={c.code_no}>{c.degree_course_code} — {c.degree_course_name}</option>
                  ))}
                </select>
              )
            }
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Year of Study</label>
            <select
              required
              value={form.year_of_study}
              onChange={e => setForm(f => ({ ...f, year_of_study: e.target.value }))}
              disabled={!form.course_id}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Select year…</option>
              {yearOptions.map(y => (
                <option key={y} value={y}>{YEAR_LONG[y]}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</p>
        )}

        {result && (
          <div className="rounded-md bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
            <p className="font-semibold">{result.message}</p>
            {result.assigned > 0 && (
              <p className="mt-1">
                Roll numbers {result.starting_from} → {result.starting_from + result.assigned - 1} assigned.
              </p>
            )}
          </div>
        )}

        {rw && <Button type="submit" loading={generating}>
          Generate Roll Numbers
        </Button>}
      </form>
    </section>
  )
}
