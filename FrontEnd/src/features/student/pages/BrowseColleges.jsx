import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../../../context/AuthContext.jsx'
import { getApplications } from '../../../services/applicationService.js'
import { searchColleges, getCollegeByCode } from '../../../services/collegeService.js'
import { getErrorMessage } from '../../../shared/hooks/useNetworkError.js'

const YEAR_LABEL = { 1: 'FY', 2: 'SY', 3: 'TY', 4: '4Y', 5: '5Y' }
const ACTIVE_STATUSES = ['draft','submitted','under_review','correction_requested','correction_done','scrutiny_accepted','doc_verification_pending','confirmed','fees_paid','roll_assigned','enrolled']

export default function BrowseColleges() {
  const { user } = useAuthContext()
  const navigate  = useNavigate()
  const inputRef = useRef(null)

  const [query, setQuery]   = useState('')
  const [result, setResult] = useState(null)   // { college, periods }
  const [myApps, setMyApps] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => {
    if (user?.id) {
      getApplications(user.id)
        .then(r => setMyApps(r.data.data || []))
        .catch(() => {})
    }
  }, [user?.id])

  function handleInputChange(e) {
    setQuery(e.target.value)
    setError('')
    setResult(null)
  }

  async function handleSearch(e) {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    setError('')
    setResult(null)
    setLoading(true)
    try {
      const res = await searchColleges(trimmed)
      const matches = res.data.data || []
      if (matches.length === 1) {
        setQuery(matches[0].name)
        const detail = await getCollegeByCode(matches[0].college_code)
        setResult(detail.data.data)
      } else {
        setError('College not found. Please enter the exact college name or code.')
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Something went wrong. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  function handleApply(period) {
    navigate(
      `/apply/new?college_id=${result.college.id}&course_id=${period.course_id}&period_id=${period.id}&academic_year=${encodeURIComponent(period.academic_year)}&year_of_study=${period.year_of_study}`
    )
  }

  function handleReset() {
    setQuery('')
    setResult(null)
    setError('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">Student portal</p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-slate-950">Find Your College</h1>
        <p className="mt-1 text-slate-600">
          Enter the <strong>exact</strong> college name or college code to view open admissions.
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 max-w-lg">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder="Exact college name or code e.g. CL001"
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            autoFocus
            autoComplete="off"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
        >
          {loading ? 'Searching…' : 'Find College'}
        </button>
        {result && (
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 transition"
          >
            Clear
          </button>
        )}
      </form>

      {error && (
        <div className="max-w-lg rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {/* College card */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">College Found</p>
            <h2 className="mt-1 text-lg font-bold text-slate-950">{result.college.name}</h2>
            <p className="text-sm text-slate-500">{result.college.city}{result.college.phone ? ` · ${result.college.phone}` : ''}</p>
          </div>

          {/* Open admissions */}
          {result.periods.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white px-5 py-8 text-center">
              <p className="font-semibold text-slate-700">No open admissions at this time</p>
              <p className="mt-1 text-sm text-slate-400">This college has no active admission periods currently. Please check back later.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Open Admissions — {result.periods[0]?.academic_year}
              </p>
              {result.periods.map(period => {
                const alreadyApplied = myApps.some(a =>
                  a.college_id    === result.college.id &&
                  a.course_id     === period.course_id &&
                  a.year_of_study === period.year_of_study &&
                  ACTIVE_STATUSES.includes(a.status)
                )
                return (
                  <div
                    key={period.id}
                    className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {period.course_name} — {YEAR_LABEL[period.year_of_study]}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Seats available: {period.total_seats - period.filled_seats} of {period.total_seats}
                        
                        {' · '}Last date: {new Date(period.end_date).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                    {alreadyApplied ? (
                      <span className="self-start rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400 cursor-not-allowed">
                        Already Applied
                      </span>
                    ) : (
                      <button
                        onClick={() => handleApply(period)}
                        className="self-start rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
                      >
                        Apply →
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
