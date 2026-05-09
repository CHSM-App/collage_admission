import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../../../context/AuthContext.jsx'
import { useNotifications } from '../hooks/useNotifications.js'
import { SkeletonLines } from '../../../shared/components/Skeleton.jsx'

const TYPE_STYLES = {
  info:    'bg-blue-50   border-blue-200   text-blue-800',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  warning: 'bg-orange-50 border-orange-200 text-orange-800',
  action:  'bg-indigo-50 border-indigo-200 text-indigo-800',
  error:   'bg-red-50    border-red-200    text-red-800',
}

const TYPE_ICON = {
  info:    'ℹ️',
  success: '✅',
  warning: '⚠️',
  action:  '🔔',
  error:   '❌',
}

export default function StudentNotifications() {
  const { user } = useAuthContext()
  const navigate  = useNavigate()
  const { notifications, loading, markSeen, clearAll } = useNotifications(user?.id)

  function handleClick(notif) {
    markSeen()
    navigate(notif.link)
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">Student portal</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Notifications</h1>
          <p className="mt-1 text-slate-600">Updates and required actions for your applications.</p>
        </div>
        {!loading && notifications.length > 0 && (
          <button
            onClick={clearAll}
            className="shrink-0 self-end rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition"
          >
            Clear all
          </button>
        )}
      </div>

      {loading && <SkeletonLines rows={5} />}

      {!loading && notifications.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white px-6 py-10 text-center">
          <p className="text-2xl mb-2">🔔</p>
          <p className="font-semibold text-slate-700">No notifications yet</p>
          <p className="mt-1 text-sm text-slate-500">You'll be notified here when your application status changes.</p>
        </div>
      )}

      <div className="space-y-3">
        {notifications.map((n, i) => {
          const style = TYPE_STYLES[n.type] || TYPE_STYLES.info
          const icon  = TYPE_ICON[n.type]  || '🔔'
          return (
            <button
              key={`${n.app_id}-${i}`}
              onClick={() => handleClick(n)}
              className={`w-full text-left rounded-lg border px-4 py-4 hover:opacity-90 transition ${style}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl shrink-0 mt-0.5">{icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-1">
                    <p className="font-semibold text-sm">{n.title}</p>
                    <span className="text-xs opacity-70 whitespace-nowrap">
                      {n.updated_at ? new Date(n.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                    </span>
                  </div>
                  <p className="mt-1 text-sm opacity-90">{n.body}</p>
                  <p className="mt-1 text-xs opacity-60">{n.college} · {n.course}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
