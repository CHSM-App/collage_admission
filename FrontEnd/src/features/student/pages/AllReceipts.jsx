
import { useEffect, useState } from 'react'
import api from '../../../services/api.js'
import { useAuthContext } from '../../../context/AuthContext.jsx'
import PaymentReceipts from './PaymentReceipts.jsx'

export default function AllReceipts() {
  const { user } = useAuthContext()
  const [apps, setApps]     = useState([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState(null)

  useEffect(() => {
    api.get(`applications?student_id=${user.id}`)
      .then(r => {
        const all = r.data.data || []
        // Only show apps that have had at least one payment (fee paid flag)
        setApps(all.filter(a => a.application_fee_paid))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user.id])

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">Student portal</p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-slate-950">My Receipts</h1>
        <p className="mt-1 text-slate-600">Download or share receipts for all your payments.</p>
      </div>

      {loading && <p className="text-slate-500">Loading…</p>}

      {!loading && apps.length === 0 && (
        <p className="text-slate-500">No payment receipts found.</p>
      )}

      <div className="space-y-4">
        {apps.map(app => (
          <div key={app.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <button
              onClick={() => setActiveId(activeId === app.id ? null : app.id)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition"
            >
              <div>
                <p className="font-semibold text-slate-950">{app.college_name}</p>
                <p className="text-sm text-slate-500">{app.course_name} · {app.academic_year}</p>
                {app.registration_number && (
                  <p className="font-mono text-xs text-slate-400 mt-0.5">Reg: {app.registration_number}</p>
                )}
              </div>
              <span className="text-slate-400 text-xs ml-4 shrink-0">{activeId === app.id ? '▲ Hide' : '▼ View Receipts'}</span>
            </button>

            {activeId === app.id && (
              <div className="border-t border-slate-100 px-5 py-4">
                <PaymentReceipts applicationId={app.id} />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
