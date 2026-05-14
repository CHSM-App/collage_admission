import { useEffect, useState } from 'react'

/**
 * Returns true when the browser has network access, false when offline.
 * Uses navigator.onLine for the initial value and listens to the
 * window online/offline events for live updates.
 */
export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    function handleOnline()  { setOnline(true)  }
    function handleOffline() { setOnline(false) }

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return online
}
