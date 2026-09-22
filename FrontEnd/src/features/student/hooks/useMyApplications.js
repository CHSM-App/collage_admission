import { useEffect, useState, useCallback } from 'react'
import { getApplications } from '../../../services/applicationService.js'
import { useCollege } from '../../../context/CollegeContext.jsx'

/**
 * useMyApplications — fetches the student's applications list, scoped to the
 * college portal they are currently in.
 *
 * @param {number} studentId
 * @returns {{ apps, loading, fetchApps }}
 */
export function useMyApplications(studentId) {
  const college = useCollege()
  const collegeId = college?.id
  const [apps, setApps]       = useState([])
  const [loading, setLoading] = useState(true)

  const fetchApps = useCallback(() => {
    setLoading(true)
    getApplications(studentId, collegeId)
      .then(r => setApps(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [studentId, collegeId])

  useEffect(() => { fetchApps() }, [fetchApps])

  return { apps, loading, fetchApps }
}
