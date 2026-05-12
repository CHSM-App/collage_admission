import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import ErrorBoundary from '../shared/components/ErrorBoundary.jsx'
import { DASHBOARD_PATHS } from '../app/routePaths.js'
import Button from '../shared/components/Button.jsx'
import { useAuth } from '../features/auth/hooks/useAuth.js'
import { useNotifications } from '../features/student/hooks/useNotifications.js'
import { studentHasPayments } from '../services/paymentService.js'

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
    // { label: 'My Documents',   to: `${DASHBOARD_PATHS.student}?section=documents` },
    { label: 'Notifications',  to: `${DASHBOARD_PATHS.student}?section=notifications` },
  ],
  college: [
    { label: 'Overview',          to: DASHBOARD_PATHS.college,                                   perm: null },
    { label: 'Admission Periods', to: `${DASHBOARD_PATHS.college}?section=periods`,              perm: null },
    { label: 'Admission Inbox', to: `${DASHBOARD_PATHS.college}?section=inbox`,                perm: 'review_application' },
    { label: 'Admission',   to: `${DASHBOARD_PATHS.college}?section=add-application`,      perm: 'submit_application' },
    { label: 'Roll Numbers',      to: `${DASHBOARD_PATHS.college}?section=rollnumbers`,          perm: 'assign_subjects' },
    { label: 'Fee Receipts',      to: `${DASHBOARD_PATHS.college}?section=fee-receipts`,          perm: 'collect_fees' },
    { label: '— Masters —',       to: null },
    { label: 'Program Master',    to: `${DASHBOARD_PATHS.college}?section=master-faculty`,       perm: 'masters' },
    { label: 'Class Master',      to: `${DASHBOARD_PATHS.college}?section=master-class`,         perm: 'masters' },
    { label: 'Bank Master',       to: `${DASHBOARD_PATHS.college}?section=master-bank`,          perm: 'masters' },
    { label: 'Course Master',     to: `${DASHBOARD_PATHS.college}?section=master-course`,        perm: 'masters' },
    { label: 'Group Master',      to: `${DASHBOARD_PATHS.college}?section=master-group`,         perm: 'masters' },
    { label: 'Division Master',   to: `${DASHBOARD_PATHS.college}?section=master-division`,      perm: 'masters' },
    { label: 'Fees Master',       to: `${DASHBOARD_PATHS.college}?section=master-fees`,          perm: 'masters' },
    { label: 'Req. Documents',    to: `${DASHBOARD_PATHS.college}?section=master-documents`,     perm: 'masters' },
    { label: '— Certificates —',         to: null },
    { label: 'Bonafide Certificate',     to: `${DASHBOARD_PATHS.college}?section=cert-bonafide`,  perm: 'certificates' },
    { label: 'Character Certificate',    to: `${DASHBOARD_PATHS.college}?section=cert-character`, perm: 'certificates' },
    { label: 'No Objection Certificate', to: `${DASHBOARD_PATHS.college}?section=cert-noc`,       perm: 'certificates' },
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
  const navigate  = useNavigate()
  const { user, role, logout } = useAuth()
  const [hasPayments, setHasPayments] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const currentPath = `${location.pathname}${location.search}`

  const isStaff       = !!user?.is_staff
  const permissions   = user?.permissions || {}

  // ── Notifications (student only) ──────────────────────────
  const { notifications, unread, markSeen, clearAll } = useNotifications(
    role === 'student' ? user?.id : null
  )
  const [bellOpen, setBellOpen]   = useState(false)
  const [popup, setPopup]         = useState(false)
  const bellRef                   = useRef(null)

  // Show one-time popup per session when there are unread notifications
  useEffect(() => {
    if (role === 'student' && unread > 0 && !sessionStorage.getItem('notif_popup_shown')) {
      setPopup(true)
      sessionStorage.setItem('notif_popup_shown', '1')
    }
  }, [role, unread])

  // Close bell dropdown on outside click
  useEffect(() => {
    function handleOutside(e) {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  function goToNotifications() {
    markSeen()
    setBellOpen(false)
    setPopup(false)
    navigate(`${DASHBOARD_PATHS.student}?section=notifications`)
  }

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (role === 'student' && user?.id) {
      studentHasPayments(user.id)
        .then(r => setHasPayments(r.data.data?.has_payments || false))
        .catch(() => {})
    }
  }, [role, user?.id])

  const baseItems = sidebarItems[role] || []
  let currentItems = role === 'student' && hasPayments
    ? [...baseItems, { label: 'My Receipts', to: `${DASHBOARD_PATHS.student}?section=receipts` }]
    : baseItems

  // For staff: hide items they have no permission for at all
  if (role === 'college' && isStaff) {
    currentItems = currentItems.filter((item, idx, arr) => {
      if (!item.to) {
        const nextVisible = arr.slice(idx + 1).some(
          i => i.to && (i.perm === null || i.perm === undefined || permissions[i.perm] !== undefined)
        )
        return nextVisible
      }
      if (item.perm === null || item.perm === undefined) return true
      return item.perm in permissions
    })
  }

  // For staff: additionally hide items based on nav_visibility
  const navVisibility = user?.nav_visibility
  if (role === 'college' && isStaff && navVisibility) {
    currentItems = currentItems.filter((item, idx, arr) => {
      if (!item.to) {
        // Keep separator only if at least one following nav item is visible
        const nextVisible = arr.slice(idx + 1).some(i => {
          if (!i.to) return false
          const params = new URLSearchParams(i.to.split('?')[1] || '')
          const key = params.get('section') || 'overview'
          return navVisibility[key] !== false
        })
        return nextVisible
      }
      const params = new URLSearchParams(item.to.split('?')[1] || '')
      const key = params.get('section') || 'overview'
      return navVisibility[key] !== false
    })
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 lg:flex">

      {/* ── Mobile overlay backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-72 bg-white border-r border-slate-200 flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:w-64 lg:z-auto
      `}>
        <div className="flex h-full flex-col p-5 overflow-y-auto">
          {/* Header with close button on mobile */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">College Admission</p>
              <h2 className="mt-1 text-lg font-bold text-slate-950">{roleLabels[role]}</h2>
              {isStaff && (
                <p className="mt-0.5 text-xs text-blue-600 font-semibold">{user.role_name}</p>
              )}
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden ml-2 mt-1 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              aria-label="Close sidebar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="mt-6 flex flex-col gap-1">
            {currentItems.map((item, idx) => {
              if (!item.to) {
                return (
                  <p key={`sep-${idx}`} className="px-3 pt-3 pb-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                    {item.label.replace(/—/g, '').trim()}
                  </p>
                )
              }
              const isActive  = currentPath === item.to
              const readOnly  = isStaff && item.perm && permissions[item.perm] === false
              const isNotifItem = item.to?.includes('section=notifications')
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`rounded-md px-3 py-2 text-sm font-semibold transition flex items-center justify-between gap-2 ${
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
                  {isNotifItem && unread > 0 && (
                    <span className={`ml-auto text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center ${isActive ? 'bg-white text-slate-950' : 'bg-red-500 text-white'}`}>
                      {unread > 9 ? '9+' : unread}
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

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 lg:pl-64">

        {/* Top header bar */}
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3 sm:px-5 sm:py-4">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {/* Hamburger — visible only on mobile */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden shrink-0 rounded-md p-2 text-slate-600 hover:bg-slate-100 transition"
                aria-label="Open menu"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 hidden sm:block">Welcome back,</p>
                <p className="text-sm font-bold text-slate-950 truncate">
                  {isStaff ? user.staff_name : getDisplayName(user)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isStaff && (
                <span className="hidden sm:inline-flex rounded-full px-3 py-1 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  {user.role_name}
                </span>
              )}
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
                role === 'student' ? 'bg-emerald-50 text-emerald-700' :
                role === 'college' ? 'bg-blue-50 text-blue-700' :
                'bg-violet-50 text-violet-700'
              }`}>
                {role}
              </span>

              {/* Bell icon — student only */}
              {role === 'student' && (
                <div className="relative" ref={bellRef}>
                  <button
                    onClick={() => { setBellOpen(o => !o); if (!bellOpen) markSeen() }}
                    className="relative rounded-md p-1.5 text-slate-500 hover:bg-slate-100 transition"
                    aria-label="Notifications"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {unread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </button>

                  {/* Dropdown preview */}
                  {bellOpen && (
                    <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg z-50 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
                        <p className="text-sm font-bold text-slate-800">Notifications</p>
                        <div className="flex items-center gap-3">
                          {notifications.length > 0 && (
                            <button onClick={() => { clearAll(); setBellOpen(false) }} className="text-xs text-slate-400 hover:text-slate-600 font-semibold">Clear all</button>
                          )}
                          <button onClick={goToNotifications} className="text-xs text-blue-600 hover:underline font-semibold">View all</button>
                        </div>
                      </div>
                      {notifications.length === 0 ? (
                        <p className="px-4 py-5 text-sm text-slate-400 text-center">No notifications</p>
                      ) : (
                        <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                          {notifications.slice(0, 5).map((n, i) => (
                            <li key={i}>
                              <button
                                onClick={() => { markSeen(); setBellOpen(false); navigate(n.link) }}
                                className="w-full text-left px-4 py-3 hover:bg-slate-50 transition"
                              >
                                <p className="text-sm font-semibold text-slate-800 truncate">{n.title}</p>
                                <p className="text-xs text-slate-500 truncate mt-0.5">{n.body}</p>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => { if (confirm('Are you sure you want to logout?')) logout() }}
                className="lg:hidden rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-5 sm:py-8">
          <ErrorBoundary key={location.pathname + location.search}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* ── New notification popup (shown once per session on login) ── */}
      {popup && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-emerald-600 px-5 py-4 flex items-center gap-3">
              <svg className="w-6 h-6 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <p className="text-white font-bold text-base">You have new notifications</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              {notifications.slice(0, 3).map((n, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-base shrink-0">
                    {n.type === 'action' || n.type === 'warning' ? '🔔' : n.type === 'error' ? '❌' : '✅'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{n.title}</p>
                    <p className="text-xs text-slate-500 truncate">{n.college}</p>
                  </div>
                </div>
              ))}
              {notifications.length > 3 && (
                <p className="text-xs text-slate-400">+{notifications.length - 3} more notifications</p>
              )}
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={goToNotifications}
                className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
              >
                View Notifications
              </button>
              <button
                onClick={() => { setPopup(false); markSeen() }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
