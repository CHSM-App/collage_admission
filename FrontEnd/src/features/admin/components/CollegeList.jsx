import { useEffect, useRef, useState } from 'react'
import { getAdminColleges, updateAdminCollege } from '../../../services/adminService.js'
import Pagination from '../../../shared/components/Pagination.jsx'
import Button from '../../../shared/components/Button.jsx'
import RolesPanel      from './RolesPanel.jsx'
import { SkeletonTable } from '../../../shared/components/Skeleton.jsx'
import FacultyMaster   from '../../college/pages/masters/FacultyMaster.jsx'
import CourseMaster    from '../../college/pages/masters/CourseMaster.jsx'
import GroupMaster     from '../../college/pages/masters/GroupMaster.jsx'
import DivisionMaster  from '../../college/pages/masters/DivisionMaster.jsx'
import DocumentsMaster from '../../college/pages/masters/DocumentsMaster.jsx'
import BankMaster      from '../../college/pages/masters/BankMaster.jsx'
import ClassMaster     from '../../college/pages/masters/ClassMaster.jsx'

const TABS = [
  { key: 'roles',      label: 'Roles & Staff' },
  { key: 'faculty',    label: 'Program' },
  // { key: 'class',      label: 'Classes' },
  { key: 'course',     label: 'Courses' },
  { key: 'group',      label: 'Groups' },
  { key: 'division',   label: 'Divisions' },
  { key: 'documents',  label: 'Documents' },
  { key: 'bank',       label: 'Bank' },
]

const LIMIT = 20

export default function CollegeList() {
  const [colleges,    setColleges]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [selected,    setSelected]    = useState(null)
  const [tab,         setTab]         = useState('roles')
  const [feeEdit,     setFeeEdit]     = useState(false)
  const [feeVal,      setFeeVal]      = useState('')
  const [feeSaving,   setFeeSaving]   = useState(false)
  const [feeMsg,      setFeeMsg]      = useState('')
  const [pagination,  setPagination]  = useState({ page: 1, totalPages: 1, total: 0 })
  const [page,        setPage]        = useState(1)

  function fetchColleges() {
    getAdminColleges(page, LIMIT)
      .then(r => {
        const list = r.data.data || []
        setColleges(list)
        setPagination(r.data.pagination || { page: 1, totalPages: 1, total: 0 })
        // Keep selected in sync
        if (selected) {
          const updated = list.find(c => c.id === selected.id)
          if (updated) setSelected(updated)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchColleges() }, [page])

  function selectCollege(c) { setSelected(c); setTab('roles'); setFeeEdit(false); setFeeMsg('') }
  function goBack()          { setSelected(null) }

  const feeMsgTimer = useRef(null)

  function showFeeMsg(msg) {
    setFeeMsg(msg)
    clearTimeout(feeMsgTimer.current)
    // Auto-clear success message after 3 seconds
    if (msg === 'Fee updated.') {
      feeMsgTimer.current = setTimeout(() => setFeeMsg(''), 3000)
    }
  }

  async function saveFee() {
    const fee = parseFloat(feeVal)
    if (isNaN(fee) || fee < 0) { showFeeMsg('Enter a valid amount.'); return }
    setFeeSaving(true); setFeeMsg('')
    try {
      await updateAdminCollege(selected.id, { application_fee: fee })
      showFeeMsg('Fee updated.')
      setFeeEdit(false)
      fetchColleges()
    } catch (err) {
      showFeeMsg(err?.response?.data?.message || 'Failed to update.')
    } finally { setFeeSaving(false) }
  }

  if (loading) return <SkeletonTable rows={5} cols={4} />

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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold text-slate-950">{selected.name}</h2>
            <span className="rounded-full bg-amber-50 border border-amber-200 px-3 py-0.5 text-sm font-mono font-semibold text-amber-700">
              {selected.college_code}
            </span>
            {selected.city && (
              <span className="text-sm text-slate-500">{selected.city}</span>
            )}
          </div>
          {/* Application fee editor */}
          <div className="flex items-center gap-2 flex-wrap">
            {!feeEdit ? (
              <>
                <span className="text-sm text-slate-500">
                  App fee: <span className="font-semibold text-slate-800">
                    {selected.application_fee != null ? `₹${Number(selected.application_fee).toLocaleString('en-IN')}` : 'Not set'}
                  </span>
                </span>
                <button
                  onClick={() => { setFeeVal(selected.application_fee ?? ''); setFeeEdit(true); setFeeMsg('') }}
                  className="text-xs font-semibold text-amber-600 hover:underline"
                >
                  Edit fee
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center rounded-lg border border-amber-300 overflow-hidden focus-within:ring-2 focus-within:ring-amber-400">
                  <span className="px-2 py-1.5 bg-amber-50 text-amber-700 text-sm font-semibold border-r border-amber-200">₹</span>
                  <input
                    type="number" min="0" step="1"
                    value={feeVal}
                    onChange={e => { setFeeVal(e.target.value); setFeeMsg('') }}
                    className="w-28 px-2 py-1.5 text-sm outline-none"
                    placeholder="e.g. 500"
                    autoFocus
                  />
                </div>
                <Button onClick={saveFee} loading={feeSaving}>Save</Button>
                <button onClick={() => { setFeeEdit(false); setFeeMsg('') }} className="text-xs text-slate-400 hover:text-slate-600 font-medium">Cancel</button>
              </div>
            )}
            {feeMsg && <span className={`text-xs font-semibold ${feeMsg === 'Fee updated.' ? 'text-emerald-600' : 'text-red-600'}`}>{feeMsg}</span>}
          </div>
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
          {tab === 'class'     && <ClassMaster     collegeId={selected.id} />}
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
      <p className="text-sm text-slate-500">{pagination.total} college{pagination.total !== 1 ? 's' : ''} registered.</p>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">College</th>
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">City</th>
              <th className="px-4 py-3 text-right">App Fee</th>
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
                <td className="px-4 py-3 text-right text-slate-700">
                  {c.application_fee != null ? `₹${Number(c.application_fee).toLocaleString('en-IN')}` : <span className="text-slate-300">—</span>}
                </td>
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
      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        onPageChange={setPage}
      />
    </div>
  )
}
