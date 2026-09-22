export const ROLES = {
  student: 'student',
  college: 'college',
  admin: 'admin',
}

// ── Student portal paths ─────────────────────────────────────
// Every student-facing page lives under the college's own portal segment
// (/c/<college_code>) so the college identity is in the URL on every screen,
// survives a refresh, and never has to be searched for.
export const COLLEGE_SCOPE_PREFIX = '/c'
export const STUDENT_PATHS = {
  landing:   (code)     => `${COLLEGE_SCOPE_PREFIX}/${code}`,
  login:     (code)     => `${COLLEGE_SCOPE_PREFIX}/${code}/login`,
  register:  (code)     => `${COLLEGE_SCOPE_PREFIX}/${code}/register`,
  forgot:    (code)     => `${COLLEGE_SCOPE_PREFIX}/${code}/forgot-password`,
  dashboard: (code)     => `${COLLEGE_SCOPE_PREFIX}/${code}/dashboard`,
  apply:     (code, id) => `${COLLEGE_SCOPE_PREFIX}/${code}/apply/${id}`,
}

// The last college portal this browser visited. Legacy unscoped student URLs
// (old bookmarks, /student/dashboard) use it to recover the college segment.
const LAST_COLLEGE_KEY = 'lastCollegeCode'
export const rememberCollegeCode = (code) => {
  try { localStorage.setItem(LAST_COLLEGE_KEY, code) } catch { /* private mode */ }
}
export const getLastCollegeCode = () => {
  try { return localStorage.getItem(LAST_COLLEGE_KEY) } catch { return null }
}

// ── Staff paths (unchanged — not white-labelled) ─────────────
export const LOGIN_PATHS = {
  student: '/login/student',
  college: '/login/college',
  admin: '/login/vtadmin',
}

export const DASHBOARD_PATHS = {
  student: '/student/dashboard',
  college: '/college/dashboard',
  admin: '/admin/dashboard',
}

export const REGISTER_PATHS = {
  student: '/register/student',
}

export const FORGOT_PASSWORD_PATH = '/forgot-password'
export const COLLEGE_FORGOT_PASSWORD_PATH = '/college/forgot-password'

export const getDashboardPath = (role) => DASHBOARD_PATHS[role] || LOGIN_PATHS.student

export const getLoginPath = (role) => LOGIN_PATHS[role] || LOGIN_PATHS.student

/**
 * Where to send a user once they are authenticated.
 *
 * Honours a ?next= param so a student who hit "Apply" while logged out lands
 * back on the college page they came from. `next` arrives from the URL, i.e.
 * from anyone who can hand the user a link — only same-origin absolute paths
 * are accepted. `//evil.com` is a protocol-relative URL the browser treats as
 * another origin, so the leading-slash check alone is not enough.
 */
export const getPostLoginPath = (role, collegeCode, search = window.location.search) => {
  const next = new URLSearchParams(search).get('next')
  if (next && next.startsWith('/') && !next.startsWith('//')) return next
  if (role === 'student' && collegeCode) return STUDENT_PATHS.dashboard(collegeCode)
  return getDashboardPath(role)
}
