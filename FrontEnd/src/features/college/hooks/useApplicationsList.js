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
// Last response per (college + filters). Revisiting the inbox shows these rows at
// once and refreshes in the background, instead of a skeleton on every visit.
const cache = new Map()

function buildParams({ page, filterStatus, filterCourse, filterYear, pendingLink, filterDivision }) {
  const params = new URLSearchParams({ page, limit: LIMIT })
  if (filterStatus)   params.set('status', filterStatus)
  if (filterCourse)   params.set('course_id', filterCourse)
  if (filterYear)     params.set('year_of_study', filterYear)
  if (pendingLink)    params.set('pending_link', '1')
  if (filterDivision) params.set('division', filterDivision)
  return params
}

export function useApplicationsList(collegeId, { page, filterStatus, filterCourse, filterYear, pendingLink, filterDivision }) {
  const params   = buildParams({ page, filterStatus, filterCourse, filterYear, pendingLink, filterDivision })
  const cacheKey = `${collegeId}?${params}`
  const cached   = cache.get(cacheKey)

  const [apps, setApps]             = useState(cached?.data || [])
  const [loading, setLoading]       = useState(!cached)
  const [pagination, setPagination] = useState(cached?.pagination || { page: 1, totalPages: 1, total: 0 })
  // Per-status counts computed by the backend over the full set (ignoring the
  // status filter), so selecting a status doesn't zero out the other counts.
  const [statusCounts, setStatusCounts] = useState(cached?.status_counts || {})
  const [statusTotal, setStatusTotal]   = useState(cached?.status_total ?? 0)
  // Course / year / division choices across ALL applications (server ignores filters for these)
  const [filterOptions, setFilterOptions] = useState(cached?.filter_options || { courses: [], years: [], divisions: [] })

  function apply(d) {
    setApps(d.data || [])
    setPagination(d.pagination || { page: 1, totalPages: 1, total: 0 })
    setStatusCounts(d.status_counts || {})
    setStatusTotal(d.status_total ?? 0)
    if (d.filter_options) setFilterOptions(d.filter_options)
  }

  const fetchApps = useCallback(() => {
    const hit = cache.get(cacheKey)
    if (hit) { apply(hit); setLoading(false) }   // show last-known rows now…
    else setLoading(true)
    getApplicationsList(collegeId, buildParams({ page, filterStatus, filterCourse, filterYear, pendingLink, filterDivision }))
      .then(r => { cache.set(cacheKey, r.data); apply(r.data) })   // …then the fresh ones
      .catch(() => { if (!hit) { setApps([]); setStatusCounts({}); setStatusTotal(0) } })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey])

  useEffect(() => { fetchApps() }, [fetchApps])

  return { apps, loading, pagination, fetchApps, statusCounts, statusTotal, filterOptions }
}
