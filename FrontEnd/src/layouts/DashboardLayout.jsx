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

const sidebarItems = {
  student: [
    { label: 'Overview',      to: DASHBOARD_PATHS.student },
    { label: 'Browse & Apply',to: `${DASHBOARD_PATHS.student}?section=browse` },
    { label: 'My Applications',to:`${DASHBOARD_PATHS.student}?section=applications` },
    { label: 'My Documents',  to: `${DASHBOARD_PATHS.student}?section=documents` },
  ],
  college: [
    { label: 'Overview',         to: DASHBOARD_PATHS.college },
    { label: 'Admission Periods',to: `${DASHBOARD_PATHS.college}?section=periods` },
    { label: 'Application Inbox',to: `${DASHBOARD_PATHS.college}?section=inbox` },
    { label: 'Add Application',  to: `${DASHBOARD_PATHS.college}?section=add-application` },
    { label: 'Roll Numbers',     to: `${DASHBOARD_PATHS.college}?section=rollnumbers` },
    // ── Masters ──
    { label: '— Masters —',      to: null },
    { label: 'Faculty Master',   to: `${DASHBOARD_PATHS.college}?section=master-faculty` },
    { label: 'Bank Master',      to: `${DASHBOARD_PATHS.college}?section=master-bank` },
    { label: 'Course Master',    to: `${DASHBOARD_PATHS.college}?section=master-course` },
    { label: 'Group Master',     to: `${DASHBOARD_PATHS.college}?section=master-group` },
    { label: 'Division Master',  to: `${DASHBOARD_PATHS.college}?section=master-division` },
    { label: 'Fees Master',      to: `${DASHBOARD_PATHS.college}?section=master-fees` },
  ],
  admin: [
    { label: 'Overview',     to: DASHBOARD_PATHS.admin },
    { label: 'Institutions', to: `${DASHBOARD_PATHS.admin}?section=institutions` },
    { label: 'Users',        to: `${DASHBOARD_PATHS.admin}?section=users` },
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

  useEffect(() => {
    if (role === 'student' && user?.id) {
      api.get(`payments/student-has-payments?student_id=${user.id}`)
        .then(r => setHasPayments(r.data.data?.has_payments || false))
        .catch(() => {})
    }
  }, [role, user?.id])

  const baseItems = sidebarItems[role] || []
  const currentItems = role === 'student' && hasPayments
    ? [...baseItems, { label: 'My Receipts', to: `${DASHBOARD_PATHS.student}?section=receipts` }]
    : baseItems

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 lg:flex">
      <aside className="border-b border-slate-200 bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">
              College Admission
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-950">{roleLabels[role]}</h2>
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
              const isActive = currentPath === item.to
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-slate-950 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="mt-6 border-t border-slate-200 pt-5 lg:mt-auto">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Signed in as
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-800">
              {getDisplayName(user)}
            </p>
            <p className="truncate text-xs text-slate-400">{user?.email}</p>
            <Button variant="secondary" className="mt-4 w-full" onClick={logout}>
              Logout
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex-1 lg:pl-64">
        <header className="border-b border-slate-200 bg-white px-5 py-4">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Welcome back,</p>
              <p className="text-base font-bold text-slate-950">{getDisplayName(user)}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
              role === 'student' ? 'bg-emerald-50 text-emerald-700' :
              role === 'college' ? 'bg-blue-50 text-blue-700' :
              'bg-violet-50 text-violet-700'
            }`}>
              {role}
            </span>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-5 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
