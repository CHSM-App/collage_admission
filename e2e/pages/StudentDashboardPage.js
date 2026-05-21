/**
 * StudentDashboardPage — Page Object for the student dashboard and Browse Colleges.
 */
class StudentDashboardPage {
  constructor(page) {
    this.page = page
  }

  async goto() {
    await this.page.goto('/student/dashboard')
    await this.page.waitForURL('**/student/dashboard', { timeout: 10000 })
  }

  async gotoMyApplications() {
    await this.page.goto('/student/dashboard?section=applications')
    // Wait for the My Applications heading to render
    await this.page.waitForFunction(
      () => document.querySelector('h1')?.textContent?.includes('My Applications'),
      { timeout: 10000 }
    )
    // Wait for the table data to load (rows OR empty state message)
    await this.page.waitForFunction(
      () => {
        const tbody = document.querySelector('tbody')
        const empty = document.body.innerText.includes('No applications')
        return (tbody && tbody.querySelectorAll('tr').length > 0) || empty
      },
      { timeout: 10000 }
    )
  }

  async gotoBrowseColleges() {
    await this.page.goto('/student/dashboard?section=browse')
    // Wait for the college search input unique to Browse & Apply
    await this.page.waitForSelector('input[placeholder*="college name"], input[placeholder*="Exact college"]', { timeout: 10000 })
  }

  // ── Browse Colleges ──────────────────────────────────────────

  async searchCollege(query) {
    await this.page.fill('input[placeholder*="college name"], input[placeholder*="Exact college"]', query)
    await this.page.click('button:has-text("Find College"), button[type="submit"]')
    // Wait for either result card or error message
    await this.page.waitForSelector('.rounded-xl, [class*="red"]', { timeout: 10000 })
  }

  async getCollegeResult() {
    const card = this.page.locator('.rounded-xl.border-emerald-200').first()
    return card.textContent()
  }

  async clickApplyForFirstPeriod() {
    // The "Apply →" button in the first admission period card
    await this.page.click('button:has-text("Apply")', { timeout: 8000 })
    await this.page.waitForURL('**/apply/**', { timeout: 10000 })
  }

  // ── Logout ───────────────────────────────────────────────────

  async logout() {
    // Click the user menu / logout button in the sidebar or header
    await this.page.click('button:has-text("Logout"), button:has-text("Sign out")', { timeout: 5000 })
    await this.page.waitForURL('**/login/**', { timeout: 8000 })
  }

  // ── My Applications ──────────────────────────────────────────

  async getApplicationCount() {
    const rows = this.page.locator('tbody tr, .rounded-xl.border-slate-300')
    return rows.count()
  }

  async getFirstApplicationStatus() {
    // The status badge in the first application row
    const badge = this.page.locator('span.rounded-full').first()
    return badge.textContent()
  }
}

module.exports = { StudentDashboardPage }
