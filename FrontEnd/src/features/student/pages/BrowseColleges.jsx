import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../services/api.js'
import { useAuthContext } from '../../../context/AuthContext.jsx'

const YEAR_LABEL = { 1: 'FY', 2: 'SY', 3: 'TY' }
const ACTIVE_STATUSES = ['draft','submitted','under_review','scrutiny_accepted','doc_verification_pending','confirmed','fees_paid','roll_assigned','enrolled']

export default function BrowseColleges() {
  const { user } = useAuthContext()
  const [colleges, setColleges] = useState([])
  const [selected, setSelected] = useState(null)   // selected college id
  const [periods, setPeriods]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [loadingPeriods, setLoadingPeriods] = useState(false)
  const [myApps, setMyApps]     = useState([])  // student's existing applications
  const [error, setError]       = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    api.get('colleges')
      .then(r => setColleges(r.data.data || []))
      .catch(() => setError('Failed to load colleges.'))
      .finally(() => setLoading(false))
    if (user?.id) {
      api.get(`applications?student_id=${user.id}`)
        .then(r => setMyApps(r.data.data || []))
        .catch(() => {})
    }
  }, [user?.id])

  function selectCollege(id) {
    if (selected === id) {
      setSelected(null)
      setPeriods([])
      return
    }
    setSelected(id)
    setLoadingPeriods(true)
    api.get(`colleges/${id}/admission-periods`)
      .then(r => setPeriods(r.data.data || []))
      .catch(() => setPeriods([]))
      .finally(() => setLoadingPeriods(false))
  }

  function handleApply(period, collegeId) {
    navigate(
      `/apply/new?college_id=${collegeId}&course_id=${period.course_id}&period_id=${period.id}&academic_year=${encodeURIComponent(period.academic_year)}&year_of_study=${period.year_of_study}`
    )
  }

  if (loading) return <PageShell><p className="text-slate-500">Loading colleges…</p></PageShell>
  if (error)   return <PageShell><p className="text-red-500">{error}</p></PageShell>

  return (
    <PageShell>
      <div className="space-y-3">
        {colleges.length === 0 && (
          <p className="text-slate-500">No colleges available at this time.</p>
        )}
        {colleges.map(college => (
          <div key={college.id} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <button
              onClick={() => selectCollege(college.id)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition"
            >
              <div>
                <p className="font-semibold text-slate-950">{college.name}</p>
                <p className="text-sm text-slate-500">{college.city} · {college.phone}</p>
              </div>
              <span className="text-slate-400 text-lg">{selected === college.id ? '▲' : '▼'}</span>
            </button>

            {selected === college.id && (
              <div className="border-t border-slate-100 px-5 py-4">
                {loadingPeriods && <p className="text-sm text-slate-400">Loading open admissions…</p>}

                {!loadingPeriods && periods.length === 0 && (
                  <p className="text-sm text-slate-500">No open admissions at this time.</p>
                )}

                {!loadingPeriods && periods.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
                      Open Admissions — {periods[0]?.academic_year}
                    </p>
                    {periods.map(period => (
                      <div
                        key={period.id}
                        className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-4 py-3"
                      >
                        <div>
                          <p className="font-medium text-slate-800">
                            {period.course_name} — {YEAR_LABEL[period.year_of_study]}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Seats: {period.total_seats - period.filled_seats} available of {period.total_seats} ·
                            Application fee: ₹{Number(period.application_fee).toLocaleString('en-IN')} ·
                            Last date: {new Date(period.end_date).toLocaleDateString('en-IN')}
                          </p>
                        </div>
                        {(() => {
                          const alreadyApplied = myApps.some(a =>
                            a.college_id === college.id &&
                            a.course_id === period.course_id &&
                            a.year_of_study === period.year_of_study &&
                            ACTIVE_STATUSES.includes(a.status)
                          )
                          return alreadyApplied ? (
                            <span className="ml-4 rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400 cursor-not-allowed">
                              Applied
                            </span>
                          ) : (
                            <button
                              onClick={() => handleApply(period, college.id)}
                              className="ml-4 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
                            >
                              Apply
                            </button>
                          )
                        })()}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </PageShell>
  )
}

function PageShell({ children }) {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">Student portal</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Browse Colleges</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Click on a college to see its open admissions for 2026-27.
        </p>
      </div>
      {children}
    </section>
  )
}
