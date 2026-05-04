import { useCallback, useEffect, useState } from 'react'
import api from '../../../services/api.js'

const SEEN_KEY    = 'notif_last_seen'
const CLEARED_KEY = 'notif_cleared_at' // localStorage — persists across sessions

export function useNotifications(studentId) {
  const [allNotifications, setAllNotifications] = useState([])
  const [unread, setUnread]                     = useState(0)
  const [loading, setLoading]                   = useState(false)

  const computeState = useCallback((data) => {
    const clearedAt = parseInt(localStorage.getItem(`${CLEARED_KEY}_${studentId}`) || '0')
    const lastSeen  = parseInt(sessionStorage.getItem(SEEN_KEY) || '0')

    // Visible = newer than cleared timestamp
    const visible = data.filter(n => {
      const t = n.updated_at ? new Date(n.updated_at).getTime() : 0
      return t > clearedAt
    })

    // Unread = visible and newer than last seen
    const newCount = visible.filter(n => {
      const t = n.updated_at ? new Date(n.updated_at).getTime() : 0
      return t > lastSeen
    }).length

    setAllNotifications(visible)
    setUnread(newCount)
  }, [studentId])

  const fetch = useCallback(() => {
    if (!studentId) return
    setLoading(true)
    api.get(`notifications/student/${studentId}`)
      .then(r => computeState(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [studentId, computeState])

  useEffect(() => {
    fetch()
  }, [fetch])

  function markSeen() {
    sessionStorage.setItem(SEEN_KEY, Date.now().toString())
    setUnread(0)
  }

  function clearAll() {
    localStorage.setItem(`${CLEARED_KEY}_${studentId}`, Date.now().toString())
    sessionStorage.setItem(SEEN_KEY, Date.now().toString())
    setAllNotifications([])
    setUnread(0)
  }

  return { notifications: allNotifications, unread, loading, markSeen, clearAll, refetch: fetch }
}
