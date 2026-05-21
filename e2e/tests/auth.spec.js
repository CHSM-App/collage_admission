/**
 * Auth Tests
 *
 * Covers:
 *   - Student login: success, wrong password, wrong phone
 *   - College login: success, wrong credentials
 *   - Admin login: success
 *   - Redirect: authenticated user goes straight to dashboard
 *   - Logout: clears session and redirects to login
 *   - Forgot password page: loads correctly
 *
 * Prerequisites:
 *   - Test accounts in DB (see e2e/fixtures/README.md)
 */

const { test, expect } = require('@playwright/test')
const { LoginPage } = require('../pages/LoginPage')
const { STUDENT, COLLEGE_ADMIN, SUPER_ADMIN } = require('../fixtures/users')

// Auth tests must start unauthenticated — they test the login flow itself
test.use({ storageState: { cookies: [], origins: [] } })

// ── Student Login ─────────────────────────────────────────────

test.describe('Student Login', () => {
  test('loads the student login page', async ({ page }) => {
    const login = new LoginPage(page)
    await login.gotoStudent()

    await expect(page).toHaveTitle(/collage|admission|student/i)
    await expect(page.locator('h1, h2').first()).toContainText(/Student Login|Sign in/i)
    await expect(page.locator('input[name="phone"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('shows error for wrong password', async ({ page }) => {
    const login = new LoginPage(page)
    await login.gotoStudent()
    await login.loginAsStudent(STUDENT.phone, 'WrongPassword@1')

    const error = await login.getErrorText()
    expect(error).toMatch(/invalid|incorrect|wrong|not found/i)
  })

  test('shows error for non-existent phone', async ({ page }) => {
    const login = new LoginPage(page)
    await login.gotoStudent()
    await login.loginAsStudent('9000099999', 'Test@1234')

    const error = await login.getErrorText()
    expect(error).toMatch(/invalid|incorrect|not found/i)
  })

  test('successfully logs in with correct credentials', async ({ page }) => {
    const login = new LoginPage(page)
    await login.gotoStudent()
    await login.loginAsStudent(STUDENT.phone, STUDENT.password)

    await login.waitForDashboard('student')
    await login.dismissNotificationPopup()
    expect(page.url()).toContain('/student/dashboard')
  })

  test('already-logged-in student is redirected to dashboard', async ({ page }) => {
    // Login first
    const login = new LoginPage(page)
    await login.gotoStudent()
    await login.loginAsStudent(STUDENT.phone, STUDENT.password)
    await login.waitForDashboard('student')
    await login.dismissNotificationPopup()

    // Revisit the login page — should redirect back to dashboard
    await page.goto('/login/student')
    await page.waitForURL('**/student/dashboard', { timeout: 8000 })
  })
})

// ── College Login ─────────────────────────────────────────────

test.describe('College Login', () => {
  test('loads the college login page', async ({ page }) => {
    const login = new LoginPage(page)
    await login.gotoCollege()

    await expect(page.locator('h1, h2').first()).toContainText('College Login')
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
  })

  test('shows error for wrong credentials', async ({ page }) => {
    const login = new LoginPage(page)
    await login.gotoCollege()
    await login.loginAsCollege('notreal@college.com', 'WrongPass@1')

    const error = await login.getErrorText()
    expect(error).toMatch(/invalid|incorrect|not found/i)
  })

  test('successfully logs in college admin', async ({ page }) => {
    const login = new LoginPage(page)
    await login.gotoCollege()
    await login.loginAsCollege(COLLEGE_ADMIN.email, COLLEGE_ADMIN.password)

    await login.waitForDashboard('college')
    expect(page.url()).toContain('/college/dashboard')
  })
})

// ── Admin Login ───────────────────────────────────────────────

test.describe('Admin Login', () => {
  test('loads the admin login page', async ({ page }) => {
    const login = new LoginPage(page)
    await login.gotoAdmin()

    await expect(page.locator('h1, h2').first()).toContainText('Admin Login')
  })

  test('successfully logs in super admin', async ({ page }) => {
    const login = new LoginPage(page)
    await login.gotoAdmin()
    await login.loginAsAdmin(SUPER_ADMIN.email, SUPER_ADMIN.password)

    await login.waitForDashboard('admin')
    expect(page.url()).toContain('/admin/dashboard')
  })
})

// ── Logout ────────────────────────────────────────────────────

test.describe('Logout', () => {
  test('student logout clears session and redirects to login', async ({ page }) => {
    // Login
    const login = new LoginPage(page)
    await login.gotoStudent()
    await login.loginAsStudent(STUDENT.phone, STUDENT.password)
    await login.waitForDashboard('student')
    await login.dismissNotificationPopup()

    // Accept the confirm() dialog that appears on logout
    page.once('dialog', d => d.accept())
    await page.click('button:has-text("Logout")')
    await page.waitForURL('**/login/**', { timeout: 8000 })

    // Should not be able to access dashboard now
    await page.goto('/student/dashboard')
    await page.waitForURL('**/login/**', { timeout: 8000 })
    expect(page.url()).toContain('/login')
  })
})

// ── Forgot Password ───────────────────────────────────────────

test.describe('Forgot Password Page', () => {
  test('forgot password page loads and shows phone input', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.waitForSelector('form', { timeout: 8000 })

    // Should have a phone or email input for OTP
    const input = page.locator('input[name="phone"], input[name="email"], input[type="tel"]').first()
    await expect(input).toBeVisible()
  })
})

// ── Route Protection ──────────────────────────────────────────

test.describe('Route Protection', () => {
  test('unauthenticated user visiting /student/dashboard gets redirected to login', async ({ page }) => {
    await page.goto('/student/dashboard')
    await page.waitForURL('**/login/**', { timeout: 8000 })
    expect(page.url()).toContain('/login')
  })

  test('unauthenticated user visiting /college/dashboard gets redirected', async ({ page }) => {
    await page.goto('/college/dashboard')
    await page.waitForURL('**/login/**', { timeout: 8000 })
    expect(page.url()).toContain('/login')
  })

  test('student cannot access college dashboard', async ({ page }) => {
    // Login as student
    const login = new LoginPage(page)
    await login.gotoStudent()
    await login.loginAsStudent(STUDENT.phone, STUDENT.password)
    await login.waitForDashboard('student')
    await login.dismissNotificationPopup()

    // Try to visit college dashboard
    await page.goto('/college/dashboard')
    // Should redirect away (either to student dashboard or login)
    await page.waitForURL(/\/(student|login)\//, { timeout: 8000 })
    expect(page.url()).not.toContain('/college/dashboard')
  })
})
