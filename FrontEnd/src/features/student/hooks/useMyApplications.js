import { useEffect, useState, useCallback } from 'react'
import { getApplications } from '../../../services/applicationService.js'

/**
 * useMyApplications — fetches the student's applications list.
 *
 * @param {number} studentId
 * @returns {{ apps, loading, fetchApps }}
 */
export function useMyApplications(studentId) {
  const [apps, setApps]       = useState([])
  const [loading, setLoading] = useState(true)

  const fetchApps = useCallback(() => {
    setLoading(true)
    getApplications(studentId)
      .then(r => setApps(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [studentId])

  useEffect(() => { fetchApps() }, [fetchApps])

  return { apps, loading, fetchApps }
}
