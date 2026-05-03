import { useEffect, useState } from 'react'
import api from '../../../services/api.js'
import Button from '../../../shared/components/Button.jsx'
import { usePermissions } from '../hooks/usePermissions.js'

const YEAR_LABEL = { 1: 'FY', 2: 'SY', 3: 'TY' }

export default function RollNumbers({ collegeId }) {
  const { canWrite } = usePermissions()
  const rw = canWrite('assign_subjects')
  const [courses, setCourses]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [generating, setGenerating] = useState(false)
  const [result, setResult]       = useState(null)
  const [error, setError]         = useState('')
  const [form, setForm] = useState({
    course_id: '', year_of_study: '1', academic_year: '2026-27',
  })

  useEffect(() => {
    api.get(`masters/${collegeId}/faculty`)
      .then(r => setCourses((r.data.data || []).filter(f => f.is_active)))
      .catch(() => setError('Failed to load courses.'))
      .finally(() => setLoading(false))
  }, [collegeId])

  async function handleGenerate(e) {
    e.preventDefault()
    if (!form.course_id) return
    setGenerating(true)
    setResult(null)
    setError('')
    try {
      const res = await api.post(`college-admin/${collegeId}/roll-numbers/generate`, form)
      setResult(res.data)
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to generate roll numbers.')
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
          <li>Finds all applications with status <strong>Fees Paid</strong> and no roll number.</li>
          <li>Sorts them by registration number and appends to the existing sequence.</li>
          <li>SY/TY students keep their existing roll number from FY — this step is skipped for them.</li>
        </ul>
      </div>

      <form onSubmit={handleGenerate} className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <p className="font-semibold text-slate-950">Select batch</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Course</label>
            {loading
              ? <p className="text-sm text-slate-400">Loading…</p>
              : (
                <select
                  required
                  value={form.course_id}
                  onChange={e => setForm(f => ({ ...f, course_id: e.target.value }))}
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
              value={form.year_of_study}
              onChange={e => setForm(f => ({ ...f, year_of_study: e.target.value }))}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="1">FY (First Year)</option>
              <option value="2">SY (Second Year)</option>
              <option value="3">TY (Third Year)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Academic Year</label>
            <input
              required
              value={form.academic_year}
              onChange={e => setForm(f => ({ ...f, academic_year: e.target.value }))}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
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
