import { useEffect, useState, useCallback } from 'react'
import { getApplicationsList } from '../../../services/collegeAdminService.js'

const LIMIT = 20

/**
 * useApplicationsList — fetches paginated, filtered college application inbox.
 *
 * @param {number} collegeId
 * @param {{ page, filterStatus, filterCourse, filterYear }} filters
 * @returns {{ apps, loading, pagination, fetchApps }}
 */
export function useApplicationsList(collegeId, { page, filterStatus, filterCourse, filterYear, pendingLink, filterDivision }) {
  const [apps, setApps]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  // Per-status counts computed by the backend over the full set (ignoring the
  // status filter), so selecting a status doesn't zero out the other counts.
  const [statusCounts, setStatusCounts] = useState({})
  const [statusTotal, setStatusTotal]   = useState(0)

  const fetchApps = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page, limit: LIMIT })
    if (filterStatus) params.set('status', filterStatus)
    if (filterCourse) params.set('course_id', filterCourse)
    if (filterYear)       params.set('year_of_study', filterYear)
    if (pendingLink)      params.set('pending_link', '1')
    if (filterDivision)   params.set('division', filterDivision)
    getApplicationsList(collegeId, params)
      .then(r => {
        setApps(r.data.data || [])
        setPagination(r.data.pagination || { page: 1, totalPages: 1, total: 0 })
        setStatusCounts(r.data.status_counts || {})
        setStatusTotal(r.data.status_total ?? 0)
      })
      .catch(() => { setApps([]); setStatusCounts({}); setStatusTotal(0) })
      .finally(() => setLoading(false))
  }, [collegeId, page, filterStatus, filterCourse, filterYear, pendingLink, filterDivision])

  useEffect(() => { fetchApps() }, [fetchApps])

  return { apps, loading, pagination, fetchApps, statusCounts, statusTotal }
}
