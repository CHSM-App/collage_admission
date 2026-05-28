/**
 * Global auth setup — runs once before all test projects.
 * Logs in as each role via the API (bypasses UI rate limiting) and saves
 * the browser storage state (cookies + localStorage) for all test suites.
 */

const { test: setup } = require('@playwright/test')
const path = require('path')
const { STUDENT, COLLEGE_ADMIN, SUPER_ADMIN } = require('../fixtures/users')
const { BACKEND_URL } = require('../fixtures/env')

const STATES_DIR = path.join(__dirname, '../auth-states')

/**
 * Log in via the backend API, then inject the session into the page context
 * so that both the httpOnly cookie and localStorage are correctly set.
 */
async function apiLogin(page, endpoint, credentials, role, dashboardPath, localStorageKey) {
  // Navigate to the frontend first so the cookie domain matches
  await page.goto(dashboardPath)
  await page.waitForLoadState('domcontentloaded')

  // Hit the backend login endpoint — the Set-Cookie header sets auth_token
  const resp = await page.request.post(`${BACKEND_URL}/${endpoint}`, {
    data: credentials,
  })
  if (!resp.ok()) {
    throw new Error(`Login failed (${resp.status()}): ${await resp.text()}`)
  }

  const data = await resp.json()
  const user = data.user

  // Inject the auth session into localStorage so the React app thinks it's logged in
  await page.evaluate(
    ({ key, session }) => localStorage.setItem(key, JSON.stringify(session)),
    {
      key: localStorageKey,
      session: { user, role: data.role || role, isAuthenticated: true },
    }
  )

  // Reload so the React app picks up the localStorage session
  await page.reload()
  await page.waitForLoadState('domcontentloaded')

  await page.context().storageState({ path: path.join(STATES_DIR, `${role}.json`) })
}

setup('login as student', async ({ page }) => {
  await apiLogin(
    page,
    'auth/login/student',
    { phone: STUDENT.phone, password: STUDENT.password },
    'student',
    '/login/student',
    'collegeAdmissionAuth'
  )
})

setup('login as college admin', async ({ page }) => {
  await apiLogin(
    page,
    'auth/login/college',
    { email: COLLEGE_ADMIN.email, password: COLLEGE_ADMIN.password },
    'college',
    '/login/college',
    'collegeAdmissionAuth'
  )
})

setup('login as super admin', async ({ page }) => {
  await apiLogin(
    page,
    'auth/login/admin',
    { email: SUPER_ADMIN.email, password: SUPER_ADMIN.password },
    'admin',
    '/login/vtadmin',
    'collegeAdmissionAuth'
  )
})
