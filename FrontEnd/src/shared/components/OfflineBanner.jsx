import { useEffect, useRef, useState } from 'react'
import { useOnline } from '../hooks/useOnline.js'

/**
 * Sticky banner shown when the browser goes offline.
 * - Appears immediately on disconnect with a slide-down animation.
 * - When reconnected, shows a brief "Back online" confirmation then dismisses.
 * - Explicitly tells users their form data is safe so they don't panic-navigate away.
 */
export default function OfflineBanner() {
  const online  = useOnline()
  const [visible,  setVisible]  = useState(!online)
  const [restored, setRestored] = useState(false)
  const timerRef = useRef(null)
  const prevOnline = useRef(online)

  useEffect(() => {
    clearTimeout(timerRef.current)

    if (!online) {
      // Went offline — show banner immediately
      setRestored(false)
      setVisible(true)
    } else if (!prevOnline.current && online) {
      // Just came back online — show "restored" state briefly, then hide
      setRestored(true)
      timerRef.current = setTimeout(() => {
        setVisible(false)
        setRestored(false)
      }, 3000)
    }

    prevOnline.current = online
    return () => clearTimeout(timerRef.current)
  }, [online])

  if (!visible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-0 inset-x-0 z-[10000] flex items-center justify-center gap-2.5 px-4 py-2.5 text-sm font-medium shadow-md
        transition-all duration-300
        ${restored
          ? 'bg-emerald-600 text-white'
          : 'bg-slate-900 text-white'
        }`}
    >
      {restored ? (
        <>
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Back online — you can continue.
        </>
      ) : (
        <>
          <svg className="w-4 h-4 shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M12 12h.01
                 M3 3l18 18" />
          </svg>
          No internet connection.
        </>
      )}
    </div>
  )
}
