import { useEffect, useState } from 'react'
import api from '../../../services/api.js'
import RolesPanel      from './RolesPanel.jsx'
import FacultyMaster   from '../../college/pages/masters/FacultyMaster.jsx'
import CourseMaster    from '../../college/pages/masters/CourseMaster.jsx'
import GroupMaster     from '../../college/pages/masters/GroupMaster.jsx'
import DivisionMaster  from '../../college/pages/masters/DivisionMaster.jsx'
import DocumentsMaster from '../../college/pages/masters/DocumentsMaster.jsx'
import BankMaster      from '../../college/pages/masters/BankMaster.jsx'

const TABS = [
  { key: 'roles',      label: 'Roles & Staff' },
  { key: 'faculty',    label: 'Faculty' },
  { key: 'course',     label: 'Courses' },
  { key: 'group',      label: 'Groups' },
  { key: 'division',   label: 'Divisions' },
  { key: 'documents',  label: 'Documents' },
  { key: 'bank',       label: 'Bank' },
]

export default function CollegeList() {
  const [colleges, setColleges] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState(null)   // college object
  const [tab,      setTab]      = useState('roles')

  useEffect(() => {
    api.get('admin/colleges')
      .then(r => setColleges(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function selectCollege(c) { setSelected(c); setTab('roles') }
  function goBack()          { setSelected(null) }

  if (loading) return <div className="text-sm text-slate-400">Loading colleges…</div>

  if (selected) {
    return (
      <div className="space-y-4">
        <button
          onClick={goBack}
          className="text-sm font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
        >
          ← All Colleges
        </button>

        {/* College header */}
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold text-slate-950">{selected.name}</h2>
          <span className="rounded-full bg-amber-50 border border-amber-200 px-3 py-0.5 text-sm font-mono font-semibold text-amber-700">
            {selected.college_code}
          </span>
          {selected.city && (
            <span className="text-sm text-slate-500">{selected.city}</span>
          )}
        </div>

        {/* Tab strip */}
        <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap px-4 py-2 text-sm font-semibold border-b-2 transition ${
                tab === t.key
                  ? 'border-amber-500 text-amber-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>
          {tab === 'roles'     && <RolesPanel      college={selected} />}
          {tab === 'faculty'   && <FacultyMaster   collegeId={selected.id} />}
          {tab === 'course'    && <CourseMaster     collegeId={selected.id} />}
          {tab === 'group'     && <GroupMaster      collegeId={selected.id} />}
          {tab === 'division'  && <DivisionMaster   collegeId={selected.id} />}
          {tab === 'documents' && <DocumentsMaster  collegeId={selected.id} />}
          {tab === 'bank'      && <BankMaster       collegeId={selected.id} />}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
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
                    onClick={() => selectCollege(c)}
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
    </div>
  )
}
