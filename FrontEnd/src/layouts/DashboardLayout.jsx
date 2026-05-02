import { Link, Outlet, useLocation } from 'react-router-dom'
import { DASHBOARD_PATHS } from '../app/routePaths.js'
import Button from '../shared/components/Button.jsx'
import { useAuth } from '../features/auth/hooks/useAuth.js'

const roleLabels = {
  student: 'Student Portal',
  college: 'College Portal',
  admin: 'Admin Console',
}

const sidebarItems = {
  student: [
    { label: 'Overview', to: DASHBOARD_PATHS.student },
    { label: 'Applications', to: `${DASHBOARD_PATHS.student}?section=applications` },
    { label: 'Documents', to: `${DASHBOARD_PATHS.student}?section=documents` },
  ],
  college: [
    { label: 'Overview', to: DASHBOARD_PATHS.college },
    { label: 'Applicants', to: `${DASHBOARD_PATHS.college}?section=applicants` },
    { label: 'Seat Matrix', to: `${DASHBOARD_PATHS.college}?section=seats` },
  ],
  admin: [
    { label: 'Overview', to: DASHBOARD_PATHS.admin },
    { label: 'Institutions', to: `${DASHBOARD_PATHS.admin}?section=institutions` },
    { label: 'Users', to: `${DASHBOARD_PATHS.admin}?section=users` },
  ],
}

function getDisplayName(user) {
  return user?.name || user?.fullName || user?.email || 'User'
}

export default function DashboardLayout() {
  const location = useLocation()
  const { user, role, logout } = useAuth()
  const currentItems = sidebarItems[role] || []
  const currentPath = `${location.pathname}${location.search}`

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 lg:flex">
      <aside className="border-b border-slate-200 bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-72 lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col p-5">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-emerald-600">
              College Admission
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-950">{roleLabels[role]}</h2>
          </div>

          <nav className="mt-8 flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {currentItems.map((item) => {
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
              Signed in
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-800">
              {getDisplayName(user)}
            </p>
            <Button variant="secondary" className="mt-4 w-full" onClick={logout}>
              Logout
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex-1 lg:pl-72">
        <header className="border-b border-slate-200 bg-white px-5 py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Welcome back,</p>
              <p className="text-lg font-bold text-slate-950">{getDisplayName(user)}</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
              {role}
            </span>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-5 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
