import api from './api'

// ─── Module-level SWR cache ──────────────────────────────────
// Public read helper for synchronous cache-based useState initializers.
// Map<key, { data, ts }> — keyed by "<resource>:<args...>"
// TTL: 5 minutes. Reads return cached data immediately and kick off
// a background refetch so the UI is never stale after TTL.
// Mutations call invalidate() to drop matching entries so the next
// read always fetches fresh.

const TTL = 5 * 60 * 1000   // 5 min
const _cache = new Map()

function cacheGet(key) {
  const entry = _cache.get(key)
  if (!entry) return null
  return entry   // always return; caller decides whether to revalidate
}

function cacheSet(key, data) {
  _cache.set(key, { data, ts: Date.now() })
}

function isStale(entry) {
  return Date.now() - entry.ts > TTL
}

/**
 * Synchronously read cached data for a key, or null on miss.
 * Use in useState initializers: useState(() => masterCacheRead('faculty:1') ?? [])
 */
export function masterCacheRead(key) {
  const entry = _cache.get(key)
  return entry ? entry.data : null
}

/** True if any cache entry exists for the key (fresh or stale). */
export function masterCacheHas(key) {
  return _cache.has(key)
}

/** Drop all cache entries whose key starts with prefix. */
function invalidate(prefix) {
  for (const key of _cache.keys()) {
    if (key.startsWith(prefix)) _cache.delete(key)
  }
}

/**
 * Cached GET helper.
 * - Returns a Promise that resolves with the cached axios-shaped response
 *   `{ data: { data: [...] } }` on a cache hit.
 * - On a miss, fetches, caches, then resolves.
 * - On a stale hit, resolves with cached data immediately AND revalidates
 *   in the background (stale-while-revalidate).
 * @param {string} key
 * @param {() => Promise} fetcher  — the raw api.get() call
 * @param {(r: any) => void} [onBg]  — called with fresh result after bg refetch
 */
function cachedGet(key, fetcher, onBg) {
  const entry = cacheGet(key)
  if (entry && !isStale(entry)) {
    // Fresh hit — return immediately, no network call
    return Promise.resolve(entry.data)
  }
  if (entry && isStale(entry)) {
    // Stale hit — return stale data right away; revalidate in the background
    fetcher().then(r => {
      cacheSet(key, r)
      onBg?.(r)
    }).catch(() => {})
    return Promise.resolve(entry.data)
  }
  // Miss — fetch, cache, return
  return fetcher().then(r => { cacheSet(key, r); return r })
}

// ─── Faculty ──────────────────────────────────────────────────

export const getFaculty = (collegeId, onBg) =>
  cachedGet(
    `faculty:${collegeId}`,
    () => api.get(`masters/${collegeId}/faculty`),
    onBg,
  )

export const createFaculty = (collegeId, data) =>
  api.post(`masters/${collegeId}/faculty`, data)
    .then(r => { invalidate(`faculty:${collegeId}`); return r })

export const updateFaculty = (collegeId, codeNo, data) =>
  api.put(`masters/${collegeId}/faculty/${codeNo}`, data)
    .then(r => { invalidate(`faculty:${collegeId}`); return r })

export const deleteFaculty = (collegeId, codeNo) =>
  api.delete(`masters/${collegeId}/faculty/${codeNo}`)
    .then(r => { invalidate(`faculty:${collegeId}`); return r })

// ─── Course ───────────────────────────────────────────────────

export const getCourses = (collegeId, facultyId, semester, onBg) =>
  cachedGet(
    `course:${collegeId}:${facultyId}:${semester}`,
    () => api.get(`masters/${collegeId}/course?faculty_id=${facultyId}&semester=${semester}`),
    onBg,
  )

export const updateCourse = (collegeId, courseId, data) =>
  api.put(`masters/${collegeId}/course/${courseId}`, data)
    .then(r => { invalidate(`course:${collegeId}:`); return r })

export const bulkSaveCourses = (collegeId, data) =>
  api.post(`masters/${collegeId}/course/bulk-save`, data)
    .then(r => { invalidate(`course:${collegeId}:`); return r })

export const deleteCourse = (collegeId, courseId) =>
  api.delete(`masters/${collegeId}/course/${courseId}`)
    .then(r => { invalidate(`course:${collegeId}:`); return r })

// ─── Class ────────────────────────────────────────────────────

export const getClasses = (collegeId, onBg) =>
  cachedGet(
    `class:${collegeId}`,
    () => api.get(`masters/${collegeId}/class`),
    onBg,
  )

export const createClass = (collegeId, data) =>
  api.post(`masters/${collegeId}/class`, data)
    .then(r => { invalidate(`class:${collegeId}`); return r })

export const updateClass = (collegeId, classId, data) =>
  api.put(`masters/${collegeId}/class/${classId}`, data)
    .then(r => { invalidate(`class:${collegeId}`); return r })

export const deleteClass = (collegeId, classId) =>
  api.delete(`masters/${collegeId}/class/${classId}`)
    .then(r => { invalidate(`class:${collegeId}`); return r })

// ─── Division ─────────────────────────────────────────────────

export const getDivisions = (collegeId, facultyId, yearLevel, onBg) =>
  cachedGet(
    `division:${collegeId}:${facultyId}:${yearLevel}`,
    () => api.get(`masters/${collegeId}/division?faculty_id=${facultyId}&year_level=${yearLevel}`),
    onBg,
  )

export const saveDivisionGrid = (collegeId, data) =>
  api.post(`masters/${collegeId}/division/save-grid`, data)
    .then(r => { invalidate(`division:${collegeId}:`); return r })

// ─── Group ────────────────────────────────────────────────────

export const getGroups = (collegeId, facultyId, semester, onBg) =>
  cachedGet(
    `group:${collegeId}:${facultyId}:${semester}`,
    () => api.get(`masters/${collegeId}/group?faculty_id=${facultyId}&semester=${semester}`),
    onBg,
  )

export const getGroup = (collegeId, groupId) =>
  api.get(`masters/${collegeId}/group/${groupId}`)

export const getCoursesForSemester = (collegeId, semester, onBg) =>
  cachedGet(
    `coursesForSem:${collegeId}:${semester}`,
    () => api.get(`masters/${collegeId}/course?semester=${semester}`),
    onBg,
  )

export const createGroup = (collegeId, data) =>
  api.post(`masters/${collegeId}/group`, data)
    .then(r => { invalidate(`group:${collegeId}:`); return r })

export const updateGroup = (collegeId, groupId, data) =>
  api.put(`masters/${collegeId}/group/${groupId}`, data)
    .then(r => { invalidate(`group:${collegeId}:`); return r })

export const deleteGroup = (collegeId, groupId) =>
  api.delete(`masters/${collegeId}/group/${groupId}`)
    .then(r => { invalidate(`group:${collegeId}:`); return r })

// ─── Bank ─────────────────────────────────────────────────────

export const getBankLedgers = (collegeId, onBg) =>
  cachedGet(
    `bank:${collegeId}`,
    () => api.get(`masters/${collegeId}/bank`),
    onBg,
  )

export const createBankLedger = (collegeId, data) =>
  api.post(`masters/${collegeId}/bank`, data)
    .then(r => { invalidate(`bank:${collegeId}`); return r })

export const updateBankLedger = (collegeId, ledgerCode, data) =>
  api.put(`masters/${collegeId}/bank/${ledgerCode}`, data)
    .then(r => { invalidate(`bank:${collegeId}`); return r })

export const deleteBankLedger = (collegeId, ledgerCode) =>
  api.delete(`masters/${collegeId}/bank/${ledgerCode}`)
    .then(r => { invalidate(`bank:${collegeId}`); return r })

// ─── Fees master ──────────────────────────────────────────────

export const getFeesList = (collegeId, academicYear, onBg) => {
  const ayParam = academicYear ? `?academic_year=${encodeURIComponent(academicYear)}` : ''
  return cachedGet(
    `fees:${collegeId}:${academicYear || ''}`,
    () => api.get(`masters/${collegeId}/fees${ayParam}`),
    onBg,
  )
}

export const createFees = (collegeId, data) =>
  api.post(`masters/${collegeId}/fees`, data)
    .then(r => { invalidate(`fees:${collegeId}:`); return r })

export const updateFees = (collegeId, feesCode, data) =>
  api.put(`masters/${collegeId}/fees/${feesCode}`, data)
    .then(r => { invalidate(`fees:${collegeId}:`); return r })

export const deleteFees = (collegeId, feesCode) =>
  api.delete(`masters/${collegeId}/fees/${feesCode}`)
    .then(r => { invalidate(`fees:${collegeId}:`); return r })

export const getClasswiseFees = (collegeId, facultyId, yearLevel, studentType = 'Grand', academicYear, onBg) =>
  cachedGet(
    `classwiseFees:${collegeId}:${facultyId}:${yearLevel}:${studentType}:${academicYear || ''}`,
    () => api.get(`masters/${collegeId}/fees/classwise?faculty_id=${facultyId}&year_level=${yearLevel}&student_type=${studentType}${academicYear ? `&academic_year=${encodeURIComponent(academicYear)}` : ''}`),
    onBg,
  )

export const saveClasswiseFees = (collegeId, data) =>
  api.post(`masters/${collegeId}/fees/classwise/save`, data)
    .then(r => { invalidate(`classwiseFees:${collegeId}:`); return r })

export const deleteClasswiseFee = (collegeId, data) =>
  api.delete(`masters/${collegeId}/fees/classwise`, { data })
    .then(r => { invalidate(`classwiseFees:${collegeId}:`); return r })

// ─── Fees configured check (not cached — always live) ─────────

export const checkFeesConfigured = (collegeId, facultyMasterId, yearLevel, academicYear) =>
  api.get(`masters/${collegeId}/fees/configured?faculty_master_id=${facultyMasterId}&year_level=${encodeURIComponent(yearLevel)}&academic_year=${encodeURIComponent(academicYear)}`)

// ─── Fees compute (not cached — always live) ──────────────────

export const computeFees = (collegeId, data) =>
  api.post(`masters/${collegeId}/fees/compute`, data)

// ─── Required Documents (not cached — filtered per faculty+year) ─

export const getMasterDocumentTypes = () =>
  api.get('masters/document-types')

export const getRequiredDocumentsMaster = (collegeId, params) =>
  api.get(`masters/${collegeId}/required-documents`, { params })

export const createRequiredDocument = (collegeId, data) =>
  api.post(`masters/${collegeId}/required-documents`, data)

export const updateRequiredDocument = (collegeId, docId, data) =>
  api.put(`masters/${collegeId}/required-documents/${docId}`, data)

export const deleteRequiredDocument = (collegeId, docId) =>
  api.delete(`masters/${collegeId}/required-documents/${docId}`)
