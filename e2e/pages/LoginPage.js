/**
 * LoginPage — Page Object for Student and College login forms.
 *
 * Usage:
 *   const login = new LoginPage(page)
 *   await login.gotoStudent()
 *   await login.loginAsStudent('9876543210', 'Test@1234')
 */
class LoginPage {
  constructor(page) {
    this.page = page
  }

  // ── Navigation ──────────────────────────────────────────────

  async gotoStudent() {
    await this.page.goto('/login/student')
    await this.page.waitForSelector('form', { timeout: 8000 })
  }

  async gotoCollege() {
    await this.page.goto('/login/college')
    await this.page.waitForSelector('form', { timeout: 8000 })
  }

  async gotoAdmin() {
    await this.page.goto('/login/vtadmin')
    await this.page.waitForSelector('form', { timeout: 8000 })
  }

  // ── Actions ──────────────────────────────────────────────────

  async loginAsStudent(phone, password) {
    await this.page.fill('input[name="phone"]', phone)
    await this.page.fill('input[name="password"]', password)
    await this.page.click('button[type="submit"]')
  }

  async loginAsCollege(email, password) {
    await this.page.fill('input[name="email"]', email)
    await this.page.fill('input[name="password"]', password)
    await this.page.click('button[type="submit"]')
  }

  async loginAsAdmin(email, password) {
    await this.page.fill('input[name="email"]', email)
    await this.page.fill('input[name="password"]', password)
    await this.page.click('button[type="submit"]')
  }

  // ── Assertions / Getters ─────────────────────────────────────

  async getErrorText() {
    const alert = this.page.locator('[role="alert"]')
    await alert.waitFor({ timeout: 5000 })
    return alert.textContent()
  }

  async waitForDashboard(role = 'student') {
    const paths = {
      student: '/student/dashboard',
      college: '/college/dashboard',
      admin:   '/admin/dashboard',
    }
    await this.page.waitForURL(`**${paths[role]}`, { timeout: 10000 })
  }

  /**
   * Dismisses the one-time notification popup that appears after student login
   * when there are unread notifications. Safe to call even if the popup is not
   * present — it will simply do nothing.
   */
  async dismissNotificationPopup() {
    const dismiss = this.page.locator('button:has-text("Dismiss")')
    try {
      await dismiss.waitFor({ state: 'visible', timeout: 3000 })
      await dismiss.click()
      // Wait for the overlay to disappear
      await this.page.locator('button:has-text("Dismiss")').waitFor({ state: 'hidden', timeout: 3000 })
    } catch {
      // Popup did not appear — no unread notifications, nothing to do
    }
  }
}

module.exports = { LoginPage }
