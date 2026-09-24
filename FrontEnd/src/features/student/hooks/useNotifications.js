import { useCallback, useEffect, useRef, useState } from 'react'
import { getStudentNotifications } from '../../../services/notificationService.js'
import { useCollege } from '../../../context/CollegeContext.jsx'

// localStorage, per student — persists across sessions so the badge doesn't return on re-login
const SEEN_KEY    = 'notif_last_seen'
const CLEARED_KEY = 'notif_cleared_at'
// Several components use this hook at once (layout bell + notifications page);
// markSeen/clearAll broadcast this so every instance recomputes its badge.
const CHANGE_EVENT = 'notifications:changed'

const readTs = key => parseInt(localStorage.getItem(key) || '0')
const tsOf   = n => (n.updated_at ? new Date(n.updated_at).getTime() : 0)

export function useNotifications(studentId) {
  // Scoped to the college portal in view — see getApplications.
  const collegeId = useCollege()?.id
  const [allNotifications, setAllNotifications] = useState([])
  const [unread, setUnread]                     = useState(0)
  const [loading, setLoading]                   = useState(false)
  const raw = useRef([])

  const computeState = useCallback(() => {
    const clearedAt = readTs(`${CLEARED_KEY}_${studentId}`)
    const lastSeen  = readTs(`${SEEN_KEY}_${studentId}`)
    const visible   = raw.current.filter(n => tsOf(n) > clearedAt)
    setAllNotifications(visible)
    setUnread(visible.filter(n => tsOf(n) > lastSeen).length)
  }, [studentId])

  const fetch = useCallback(() => {
    if (!studentId) return
    setLoading(true)
    getStudentNotifications(studentId, collegeId)
      .then(r => { raw.current = r.data.data || []; computeState() })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [studentId, collegeId, computeState])

  useEffect(() => { fetch() }, [fetch])

  useEffect(() => {
    window.addEventListener(CHANGE_EVENT, computeState)
    return () => window.removeEventListener(CHANGE_EVENT, computeState)
  }, [computeState])

  const markSeen = useCallback(() => {
    if (!studentId) return
    localStorage.setItem(`${SEEN_KEY}_${studentId}`, Date.now().toString())
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [studentId])

  const clearAll = useCallback(() => {
    if (!studentId) return
    const now = Date.now().toString()
    localStorage.setItem(`${CLEARED_KEY}_${studentId}`, now)
    localStorage.setItem(`${SEEN_KEY}_${studentId}`, now)
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [studentId])

  return { notifications: allNotifications, unread, loading, markSeen, clearAll, refetch: fetch }
}
