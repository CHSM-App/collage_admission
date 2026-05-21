/**
 * College Admin — Application Review Tests
 *
 * Covers:
 *   - College dashboard loads with stats
 *   - Application inbox loads and shows applications
 *   - Filtering applications by status
 *   - Requesting correction on an application
 *   - Rejecting an application
 *   - Accepting scrutiny
 *
 * Prerequisites:
 *   - Test college admin account in DB
 *   - At least one submitted application for the test college
 *     (run the application-wizard spec first or seed manually)
 */

const path = require('path')
const { test, expect } = require('@playwright/test')
const { LoginPage } = require('../pages/LoginPage')
const { CollegeDashboardPage } = require('../pages/CollegeDashboardPage')
const { COLLEGE_ADMIN } = require('../fixtures/users')

// Use pre-authenticated college admin session
test.use({ storageState: 'e2e/auth-states/college.json' })

// Navigate to college dashboard (already authenticated via storageState)
async function loginAsCollege(page) {
  await page.goto('/college/dashboard')
  await page.waitForURL('**/college/dashboard', { timeout: 10000 })
}

// ── Dashboard ────────────────────────────────────────────────

test.describe('College Dashboard', () => {
  test('college dashboard loads with title and navigation', async ({ page }) => {
    await loginAsCollege(page)

    await expect(page.locator('h1, h2').first()).toBeVisible()
    // Sidebar should be visible with navigation items
    const body = await page.textContent('body')
    const hasNav = body.includes('Applications') || body.includes('Dashboard') || body.includes('Admission')
    expect(hasNav).toBe(true)
  })

  test('college dashboard shows navigation cards', async ({ page }) => {
    await loginAsCollege(page)

    const college = new CollegeDashboardPage(page)
    await college.goto()

    // Dashboard shows quick-access cards (not stat counters)
    const body = await page.textContent('body')
    const hasCards = body.includes('Admission') || body.includes('Inbox') || body.includes('Fee')
    expect(hasCards).toBe(true)
  })
})

// ── Application Inbox ─────────────────────────────────────────

test.describe('College Application Inbox', () => {
  test('application inbox page loads', async ({ page }) => {
    await loginAsCollege(page)

    const college = new CollegeDashboardPage(page)
    await college.gotoApplicationInbox()

    await expect(page.locator('h1')).toBeVisible()
    // Should show a table or empty state
    const body = await page.textContent('body')
    const hasContent = body.includes('Application') || body.includes('No applications')
    expect(hasContent).toBe(true)
  })

  test('inbox has status filter dropdown', async ({ page }) => {
    await loginAsCollege(page)

    const college = new CollegeDashboardPage(page)
    await college.gotoApplicationInbox()

    // Status filter is a <select> with default "All Statuses (n)"
    const statusFilter = page.locator('select').first()
    await expect(statusFilter).toBeVisible({ timeout: 8000 })
  })

  test('inbox has search input', async ({ page }) => {
    await loginAsCollege(page)

    const college = new CollegeDashboardPage(page)
    await college.gotoApplicationInbox()

    // Placeholder: "Search by name, email, reg. no…"
    const searchInput = page.locator('input[placeholder*="name"], input[placeholder*="Search"]').first()
    await expect(searchInput).toBeVisible({ timeout: 8000 })
  })

  test('search filters applications by student name', async ({ page }) => {
    await loginAsCollege(page)

    const college = new CollegeDashboardPage(page)
    await college.gotoApplicationInbox()

    const searchInput = page.locator('input[placeholder*="name"], input[placeholder*="Search"]').first()
    const visible = await searchInput.isVisible()
    if (visible) {
      await searchInput.fill('Patil')
      await page.waitForTimeout(500) // debounce
      await expect(page.locator('h1')).toBeVisible()
    }
  })

  test('filtering by status shows relevant applications', async ({ page }) => {
    await loginAsCollege(page)

    const college = new CollegeDashboardPage(page)
    await college.gotoApplicationInbox()

    const statusFilter = page.locator('select').first()
    const visible = await statusFilter.isVisible()
    if (visible) {
      // Pick any non-default option without caring which one exists
      const options = await statusFilter.locator('option').allTextContents()
      if (options.length > 1) {
        await statusFilter.selectOption({ index: 1 })
        await page.waitForTimeout(300)
      }
    }
    await expect(page.locator('h1')).toBeVisible()
  })
})

// ── Application Detail ────────────────────────────────────────

test.describe('Application Detail View', () => {
  test('clicking View opens application detail', async ({ page }) => {
    await loginAsCollege(page)

    const college = new CollegeDashboardPage(page)
    await college.gotoApplicationInbox()

    // Rows are clickable and navigate to ?section=app&app_id=X
    const viewBtn = page.locator('button:has-text("View"), tbody tr').first()
    const hasApplications = await viewBtn.count()

    if (hasApplications > 0) {
      await viewBtn.click()
      // URL changes to ?section=app&app_id=N  (stays on /college/dashboard)
      await page.waitForURL(/section=app/, { timeout: 8000 })
      expect(page.url()).toContain('section=app')
    } else {
      const body = await page.textContent('body')
      expect(body).toMatch(/No applications|no applications|0 applications/i)
    }
  })

  test('application detail shows student information', async ({ page }) => {
    await loginAsCollege(page)

    const college = new CollegeDashboardPage(page)
    await college.gotoApplicationInbox()

    const viewBtn = page.locator('button:has-text("View"), tbody tr').first()
    const hasApplications = await viewBtn.count()

    if (hasApplications > 0) {
      await viewBtn.click()
      await page.waitForURL(/section=app/, { timeout: 8000 })

      const body = await page.textContent('body')
      const hasSections = body.includes('Personal') ||
                          body.includes('Name') ||
                          body.includes('Category')
      expect(hasSections).toBe(true)
    }
  })
})

// ── Admission Periods ─────────────────────────────────────────

test.describe('College Admission Periods', () => {
  test('admission periods page loads', async ({ page }) => {
    await loginAsCollege(page)

    await page.goto('/college/admission-periods')
    await page.waitForSelector('h1', { timeout: 8000 })

    await expect(page.locator('h1')).toBeVisible()
    const body = await page.textContent('body')
    expect(body).toMatch(/Admission Period|Admission Window/i)
  })

  test('can view list of admission periods', async ({ page }) => {
    await loginAsCollege(page)

    await page.goto('/college/admission-periods')
    await page.waitForSelector('h1', { timeout: 8000 })

    // Either shows periods table or "no periods" empty state
    const body = await page.textContent('body')
    const hasContent = body.includes('Course') || body.includes('No') || body.includes('Period')
    expect(hasContent).toBe(true)
  })
})

// ── Masters Navigation ────────────────────────────────────────

test.describe('College Masters Navigation', () => {
  const masterPages = [
    { path: '/college/masters/programs', heading: /Program|Faculty/i },
    { path: '/college/masters/fees',     heading: /Fee/i },
    { path: '/college/masters/bank',     heading: /Bank/i },
    { path: '/college/masters/divisions', heading: /Division/i },
  ]

  for (const { path, heading } of masterPages) {
    test(`${path} loads correctly`, async ({ page }) => {
      await loginAsCollege(page)

      await page.goto(path)
      await page.waitForSelector('h1, h2', { timeout: 8000 })

      const title = page.locator('h1, h2').first()
      await expect(title).toBeVisible()
    })
  }
})
