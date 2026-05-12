import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const ToastContext = createContext(null)

const ICONS = {
  success: (
    <svg className="w-5 h-5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  ),
}

const BORDER = {
  success: 'border-emerald-200 bg-white',
  error:   'border-red-200 bg-white',
  info:    'border-blue-200 bg-white',
  warning: 'border-amber-200 bg-white',
}

const PROGRESS = {
  success: 'bg-emerald-400',
  error:   'bg-red-400',
  info:    'bg-blue-400',
  warning: 'bg-amber-400',
}

let _id = 0

function Toast({ toast, onRemove }) {
  return (
    <div
      className={`relative flex items-start gap-3 w-80 max-w-sm rounded-xl border shadow-lg px-4 py-3 overflow-hidden
        animate-[slideIn_0.2s_ease-out] ${BORDER[toast.type]}`}
    >
      {ICONS[toast.type]}
      <p className="text-sm text-slate-700 leading-snug flex-1 pt-0.5">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-slate-400 hover:text-slate-600 mt-0.5 shrink-0"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      {/* progress bar */}
      <span
        className={`absolute bottom-0 left-0 h-1 ${PROGRESS[toast.type]} rounded-bl-xl`}
        style={{ animation: `shrink ${toast.duration}ms linear forwards` }}
      />
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const remove = useCallback((id) => {
    clearTimeout(timers.current[id])
    delete timers.current[id]
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const add = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++_id
    setToasts(prev => [...prev, { id, message, type, duration }])
    timers.current[id] = setTimeout(() => remove(id), duration)
    return id
  }, [remove])

  const toast = {
    success: (msg, ms)  => add(msg, 'success', ms ?? 4000),
    error:   (msg, ms)  => add(msg, 'error',   ms ?? 5000),
    info:    (msg, ms)  => add(msg, 'info',     ms ?? 4000),
    warning: (msg, ms)  => add(msg, 'warning',  ms ?? 4000),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {createPortal(
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
          {toasts.map(t => (
            <div key={t.id} className="pointer-events-auto">
              <Toast toast={t} onRemove={remove} />
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
