import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthContext } from '../../../context/AuthContext.jsx'
import { useCollege } from '../../../context/CollegeContext.jsx'
import { getApplications } from '../../../services/applicationService.js'
import { STUDENT_PATHS } from '../../../app/routePaths.js'

const YEAR_LABEL = { 1: 'FY', 2: 'SY', 3: 'TY', 4: '4Y', 5: '5Y' }
const ACTIVE_STATUSES = ['draft','submitted','under_review','correction_requested','correction_done','scrutiny_accepted','doc_verification_pending','confirmed','fees_paid','roll_assigned','enrolled']

/**
 * The public front page of one college's admission portal (/c/<code>).
 * Replaces the old "find your college by code" search step — the code is in
 * the URL, so the open admissions are on screen immediately.
 */
export default function CollegeLanding() {
  const college  = useCollege()
  const { user, isAuthenticated, role } = useAuthContext()
  const navigate = useNavigate()
  const location = useLocation()

  const [myApps, setMyApps] = useState([])

  const isStudent = isAuthenticated && role === 'student'

  useEffect(() => {
    if (!isStudent || !user?.id) return
    getApplications(user.id, college.id)
      .then(r => setMyApps(r.data.data || []))
      .catch(() => {})
  }, [isStudent, user?.id, college.id])

  function handleApply(period) {
    if (!isStudent) {
      // Send them through login/register and straight back to this page.
      navigate(`${STUDENT_PATHS.login(college.code)}?next=${encodeURIComponent(location.pathname)}`)
      return
    }
    navigate(
      `${STUDENT_PATHS.apply(college.code, 'new')}?college_id=${college.id}&course_id=${period.course_id}&period_id=${period.id}&academic_year=${encodeURIComponent(period.academic_year)}&year_of_study=${period.year_of_study}`
    )
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
        {/* College header */}
        <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:gap-4 sm:text-left">
          {college.logoUrl && (
            <img
              src={college.logoUrl}
              alt=""
              className="h-16 w-16 shrink-0 rounded-lg object-contain"
            />
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-950">{college.name}</h1>
            <p className="text-sm text-slate-500">
              {college.city}{college.phone ? ` · ${college.phone}` : ''}
            </p>
          </div>
          {!isStudent && (
            <button
              onClick={() => navigate(STUDENT_PATHS.login(college.code))}
              className="sm:ml-auto rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white transition"
            >
              Sign in
            </button>
          )}
        </div>

        {/* Open admissions */}
        {college.periods.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white px-5 py-8 text-center">
            <p className="font-semibold text-slate-700">No open admissions at this time</p>
            <p className="mt-1 text-sm text-slate-400">There are no active admission periods currently. Please check back later.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Open Admissions — {college.periods[0]?.academic_year}
            </p>
            {college.periods.map(period => {
              // Match on the admission period itself, not course+year, so a
              // semester college's later-semester period stays open for a
              // student who already applied into the earlier one.
              const alreadyApplied = myApps.some(a =>
                a.admission_period_id === period.id &&
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

        {isStudent && (
          <button
            onClick={() => navigate(STUDENT_PATHS.dashboard(college.code))}
            className="text-sm font-semibold text-emerald-700 hover:underline"
          >
            Go to my dashboard →
          </button>
        )}
      </div>
    </main>
  )
}
