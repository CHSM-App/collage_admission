import { useEffect, useState, useCallback } from 'react'
import { getApplications } from '../../../services/applicationService.js'
import { useCollege } from '../../../context/CollegeContext.jsx'

/**
 * useMyApplications — fetches the student's applications list, scoped to the
 * college portal they are currently in.
 *
 * @param {number} studentId
 * @returns {{ apps, loading, error, fetchApps }}
 */
export function useMyApplications(studentId) {
  const college = useCollege()
  const collegeId = college?.id
  const [apps, setApps]       = useState([])
  const [loading, setLoading] = useState(true)
  // A failed load must not look like "no applications"
  const [error, setError]     = useState(false)

  const fetchApps = useCallback(() => {
    setLoading(true)
    setError(false)
    getApplications(studentId, collegeId)
      .then(r => setApps(r.data.data || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [studentId, collegeId])

  useEffect(() => { fetchApps() }, [fetchApps])

  return { apps, loading, error, fetchApps }
}
