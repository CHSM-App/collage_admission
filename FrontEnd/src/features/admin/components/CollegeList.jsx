import { useEffect, useState } from 'react'
import api from '../../../services/api.js'
import Button from '../../../shared/components/Button.jsx'
import RolesPanel from './RolesPanel.jsx'

export default function CollegeList() {
  const [colleges, setColleges] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState(null)  // college object

  useEffect(() => {
    api.get('admin/colleges')
      .then(r => setColleges(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-sm text-slate-400">Loading colleges…</div>

  return (
    <div className="space-y-4">
      {!selected ? (
        <>
          <p className="text-sm text-slate-500">{colleges.length} college{colleges.length !== 1 ? 's' : ''} registered.</p>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">College</th>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">City</th>
                  <th className="px-4 py-3 text-center">Roles</th>
                  <th className="px-4 py-3 text-center">Staff</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {colleges.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-semibold text-slate-900">{c.name}</td>
                    <td className="px-4 py-3 font-mono text-blue-700">{c.college_code}</td>
                    <td className="px-4 py-3 text-slate-500">{c.city}</td>
                    <td className="px-4 py-3 text-center text-slate-700">{c.roles_count}</td>
                    <td className="px-4 py-3 text-center text-slate-700">{c.active_users}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelected(c)}
                        className="text-xs font-semibold text-amber-600 hover:underline"
                      >
                        Manage →
                      </button>
                    </td>
                  </tr>
                ))}
                {colleges.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                      No colleges yet. Create one first.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <button
            onClick={() => setSelected(null)}
            className="text-sm font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
          >
            ← All Colleges
          </button>
          <RolesPanel college={selected} />
        </div>
      )}
    </div>
  )
}
