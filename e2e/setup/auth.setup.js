/**
 * Global auth setup — runs once before all tests.
 * Logs in as each role and saves the browser storage state (cookies + localStorage).
 * Test projects reference these state files so tests start pre-authenticated.
 */

const { test: setup, expect } = require('@playwright/test')
const path = require('path')
const { STUDENT, COLLEGE_ADMIN, SUPER_ADMIN } = require('../fixtures/users')

const STATES_DIR = path.join(__dirname, '../auth-states')

setup('login as student', async ({ page }) => {
  await page.goto('/login/student')
  await page.waitForSelector('form', { timeout: 8000 })
  await page.fill('input[name="phone"]', STUDENT.phone)
  await page.fill('input[name="password"]', STUDENT.password)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/student/dashboard', { timeout: 15000 })

  // Dismiss notification popup if present
  const dismiss = page.locator('button:has-text("Dismiss")')
  try {
    await dismiss.waitFor({ state: 'visible', timeout: 3000 })
    await dismiss.click()
  } catch { /* no popup */ }

  await page.context().storageState({ path: path.join(STATES_DIR, 'student.json') })
})

setup('login as college admin', async ({ page }) => {
  await page.goto('/login/college')
  await page.waitForSelector('form', { timeout: 8000 })
  await page.fill('input[name="email"]', COLLEGE_ADMIN.email)
  await page.fill('input[name="password"]', COLLEGE_ADMIN.password)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/college/dashboard', { timeout: 15000 })

  await page.context().storageState({ path: path.join(STATES_DIR, 'college.json') })
})

setup('login as super admin', async ({ page }) => {
  await page.goto('/login/vtadmin')
  await page.waitForSelector('form', { timeout: 8000 })
  await page.fill('input[name="email"]', SUPER_ADMIN.email)
  await page.fill('input[name="password"]', SUPER_ADMIN.password)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/admin/dashboard', { timeout: 15000 })

  await page.context().storageState({ path: path.join(STATES_DIR, 'admin.json') })
})
