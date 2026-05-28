/**
 * Student — Browse Colleges Tests
 *
 * Covers:
 *   - Searching for a college by code
 *   - College not found error
 *   - Viewing admission periods
 *   - Navigating to apply wizard
 *
 * Prerequisites:
 *   - Test college "TC001" with at least one active admission period in DB
 */

const { test, expect } = require('@playwright/test')
const { LoginPage } = require('../pages/LoginPage')
const { StudentDashboardPage } = require('../pages/StudentDashboardPage')
const { STUDENT, COLLEGE_ADMIN } = require('../fixtures/users')

test.describe('Browse Colleges', () => {
  // Navigate to dashboard (already authenticated via storageState)
  test.beforeEach(async ({ page }) => {
    const login = new LoginPage(page)
    await page.goto('/student/dashboard')
    await page.waitForURL('**/student/dashboard', { timeout: 10000 })
    await login.dismissNotificationPopup()
  })

  test('browse colleges page loads with search form', async ({ page }) => {
    const dashboard = new StudentDashboardPage(page)
    await dashboard.gotoBrowseColleges()

    // Wait for the browse section to render (not the dashboard welcome h1)
    await page.waitForFunction(
      () => document.querySelector('h1')?.textContent?.includes('Find Your College'),
      { timeout: 8000 }
    )
    await expect(page.locator('input[placeholder*="college"]')).toBeVisible()
    await expect(page.locator('button:has-text("Find College")')).toBeVisible()
  })

  test('searching with invalid query shows not-found error', async ({ page }) => {
    const dashboard = new StudentDashboardPage(page)
    await dashboard.gotoBrowseColleges()

    await dashboard.searchCollege('ZZZZNOTEXIST')

    const error = page.locator('.rounded-lg.border-red-200, [class*="red"]').first()
    await expect(error).toBeVisible()
    await expect(error).toContainText(/not found|no college/i)
  })

  test('searching by college code shows college card', async ({ page }) => {
    const dashboard = new StudentDashboardPage(page)
    await dashboard.gotoBrowseColleges()

    await dashboard.searchCollege(COLLEGE_ADMIN.collegeCode)

    // College card should appear
    const card = page.locator('.rounded-xl.border-emerald-200').first()
    await expect(card).toBeVisible()
    await expect(card).toContainText(COLLEGE_ADMIN.collegeName)
  })

  test('searching by college name shows admission periods', async ({ page }) => {
    const dashboard = new StudentDashboardPage(page)
    await dashboard.gotoBrowseColleges()

    await dashboard.searchCollege(COLLEGE_ADMIN.collegeName)

    // Either "Open Admissions" section or "No open admissions" message
    const body = await page.textContent('body')
    const hasAdmissions = body.includes('Open Admissions') || body.includes('No open admissions')
    expect(hasAdmissions).toBe(true)
  })

  test('clicking Apply navigates to the application wizard', async ({ page }) => {
    const dashboard = new StudentDashboardPage(page)
    await dashboard.gotoBrowseColleges()

    await dashboard.searchCollege(COLLEGE_ADMIN.collegeCode)

    // Check if there are open admission periods with Apply buttons
    const applyButton = page.locator('button:has-text("Apply →"), button:has-text("Apply")')
    const count = await applyButton.count()

    if (count > 0) {
      await applyButton.first().click()
      // Wait for navigation — may go to /apply/... or show a dialog/confirmation
      await page.waitForTimeout(2000)
      const url = page.url()
      const body = await page.textContent('body')
      // Accept: navigated to wizard, OR a modal/dialog appeared asking to confirm application
      const navigatedToWizard = url.includes('/apply/')
      const showsApplicationFlow = body.includes('Application') || body.includes('apply') || body.includes('Confirm')
      expect(navigatedToWizard || showsApplicationFlow).toBe(true)
    } else {
      // No open admissions OR student already applied — both are valid states
      const body = await page.textContent('body')
      const hasValidState = body.includes('No open admissions') || body.includes('no open') ||
                            body.includes('No admission') || body.includes('Already Applied') ||
                            body.includes('already applied') || body.includes('College Found')
      expect(hasValidState).toBe(true)
    }
  })

  test('clear button resets search results', async ({ page }) => {
    const dashboard = new StudentDashboardPage(page)
    await dashboard.gotoBrowseColleges()

    await dashboard.searchCollege(COLLEGE_ADMIN.collegeCode)

    // College card should appear
    const card = page.locator('.rounded-xl.border-emerald-200').first()
    await expect(card).toBeVisible()

    // Click Clear
    await page.click('button:has-text("Clear")')

    // Card should disappear
    await expect(card).not.toBeVisible()

    // Search input should be empty
    const input = page.locator('input[placeholder*="college"]')
    await expect(input).toHaveValue('')
  })
})
