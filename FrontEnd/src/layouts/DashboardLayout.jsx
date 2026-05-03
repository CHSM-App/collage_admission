import { Link, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { DASHBOARD_PATHS } from '../app/routePaths.js'
import Button from '../shared/components/Button.jsx'
import { useAuth } from '../features/auth/hooks/useAuth.js'
import api from '../services/api.js'

const roleLabels = {
  student: 'Student Portal',
  college: 'College Portal',
  admin:   'Admin Console',
}

// permission key for each college sidebar item (null = always visible)
const sidebarItems = {
  student: [
    { label: 'Overview',       to: DASHBOARD_PATHS.student },
    { label: 'Browse & Apply', to: `${DASHBOARD_PATHS.student}?section=browse` },
    { label: 'My Applications',to: `${DASHBOARD_PATHS.student}?section=applications` },
    { label: 'My Documents',   to: `${DASHBOARD_PATHS.student}?section=documents` },
  ],
  college: [
    { label: 'Overview',          to: DASHBOARD_PATHS.college,                                   perm: null },
    { label: 'Admission Periods', to: `${DASHBOARD_PATHS.college}?section=periods`,              perm: null },
    { label: 'Application Inbox', to: `${DASHBOARD_PATHS.college}?section=inbox`,                perm: 'review_application' },
    { label: 'Add Application',   to: `${DASHBOARD_PATHS.college}?section=add-application`,      perm: 'submit_application' },
    { label: 'Roll Numbers',      to: `${DASHBOARD_PATHS.college}?section=rollnumbers`,          perm: 'assign_subjects' },
    { label: '— Masters —',       to: null },
    { label: 'Faculty Master',    to: `${DASHBOARD_PATHS.college}?section=master-faculty`,       perm: 'masters' },
    { label: 'Bank Master',       to: `${DASHBOARD_PATHS.college}?section=master-bank`,          perm: 'masters' },
    { label: 'Course Master',     to: `${DASHBOARD_PATHS.college}?section=master-course`,        perm: 'masters' },
    { label: 'Group Master',      to: `${DASHBOARD_PATHS.college}?section=master-group`,         perm: 'masters' },
    { label: 'Division Master',   to: `${DASHBOARD_PATHS.college}?section=master-division`,      perm: 'masters' },
    { label: 'Fees Master',       to: `${DASHBOARD_PATHS.college}?section=master-fees`,          perm: 'masters' },
    { label: 'Req. Documents',   to: `${DASHBOARD_PATHS.college}?section=master-documents`,      perm: 'masters' },
  ],
  admin: [
    { label: 'Colleges & Roles', to: DASHBOARD_PATHS.admin },
    { label: '+ New College',    to: `${DASHBOARD_PATHS.admin}?section=create-college` },
  ],
}

function getDisplayName(user) {
  return user?.name || user?.fullName || user?.email || 'User'
}

export default function DashboardLayout() {
  const location = useLocation()
  const { user, role, logout } = useAuth()
  const [hasPayments, setHasPayments] = useState(false)
  const currentPath = `${location.pathname}${location.search}`

  const isStaff       = !!user?.is_staff
  const permissions   = user?.permissions || {}

  useEffect(() => {
    if (role === 'student' && user?.id) {
      api.get(`payments/student-has-payments?student_id=${user.id}`)
        .then(r => setHasPayments(r.data.data?.has_payments || false))
        .catch(() => {})
    }
  }, [role, user?.id])

  const baseItems = sidebarItems[role] || []
  let currentItems = role === 'student' && hasPayments
    ? [...baseItems, { label: 'My Receipts', to: `${DASHBOARD_PATHS.student}?section=receipts` }]
    : baseItems

  // For staff: hide items they have no permission for at all
  // (items with perm=null are always shown; items where perm has no entry are hidden for staff)
  if (role === 'college' && isStaff) {
    // Filter out separator if all items below it are hidden
    currentItems = currentItems.filter((item, idx, arr) => {
      if (!item.to) {
        // separator — keep only if there's a visible item after it
        const nextVisible = arr.slice(idx + 1).some(
          i => i.to && (i.perm === null || i.perm === undefined || permissions[i.perm] !== undefined)
        )
        return nextVisible
      }
      if (item.perm === null || item.perm === undefined) return true
      // Show if the staff member has any entry for this permission (true=write, false=read-only)
      return item.perm in permissions
    })
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 lg:flex">
      <aside className="border-b border-slate-200 bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">College Admission</p>
            <h2 className="mt-1 text-lg font-bold text-slate-950">{roleLabels[role]}</h2>
            {isStaff && (
              <p className="mt-0.5 text-xs text-blue-600 font-semibold">{user.role_name}</p>
            )}
          </div>

          <nav className="mt-6 flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {currentItems.map((item, idx) => {
              if (!item.to) {
                return (
                  <p key={`sep-${idx}`} className="px-3 pt-3 pb-1 text-xs font-bold uppercase tracking-wider text-slate-400 hidden lg:block">
                    {item.label.replace(/—/g, '').trim()}
                  </p>
                )
              }
              const isActive  = currentPath === item.to
              // Read-only badge: staff has the perm but can_write=false
              const readOnly  = isStaff && item.perm && permissions[item.perm] === false
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold transition flex items-center justify-between gap-2 ${
                    isActive
                      ? 'bg-slate-950 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                  }`}
                >
                  <span>{item.label}</span>
                  {readOnly && (
                    <span className={`text-xs font-normal rounded px-1.5 py-0.5 ${isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'}`}>
                      view
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          <div className="mt-6 border-t border-slate-200 pt-5 lg:mt-auto">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Signed in as</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-800">
              {isStaff ? user.staff_name : getDisplayName(user)}
            </p>
            <p className="truncate text-xs text-slate-400">{user?.email}</p>
            <Button variant="secondary" className="mt-4 w-full" onClick={() => {
              if (confirm('Are you sure you want to logout?')) logout()
            }}>Logout</Button>
          </div>
        </div>
      </aside>

      <div className="flex-1 lg:pl-64">
        <header className="border-b border-slate-200 bg-white px-5 py-4">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Welcome back,</p>
              <p className="text-base font-bold text-slate-950">
                {isStaff ? user.staff_name : getDisplayName(user)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isStaff && (
                <span className="rounded-full px-3 py-1 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  {user.role_name}
                </span>
              )}
              <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                role === 'student' ? 'bg-emerald-50 text-emerald-700' :
                role === 'college' ? 'bg-blue-50 text-blue-700' :
                'bg-violet-50 text-violet-700'
              }`}>
                {role}
              </span>
              <button
                onClick={() => { if (confirm('Are you sure you want to logout?')) logout() }}
                className="lg:hidden rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-5 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
