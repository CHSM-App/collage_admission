/**
 * CollegeDashboardPage — Page Object for the college admin side.
 */
class CollegeDashboardPage {
  constructor(page) {
    this.page = page
  }

  async goto() {
    await this.page.goto('/college/dashboard')
    await this.page.waitForURL('**/college/dashboard', { timeout: 10000 })
  }

  async gotoApplicationInbox() {
    await this.page.goto('/college/dashboard?section=inbox')
    await this.page.waitForSelector('h1', { timeout: 8000 })
  }

  // ── Application List ──────────────────────────────────────────

  /**
   * Opens the most recently submitted application in the inbox.
   * Looks for the first row in the table and clicks "View" or the row itself.
   */
  async openFirstApplication() {
    const viewBtn = this.page.locator(
      'button:has-text("View"), tbody tr'
    ).first()
    await viewBtn.waitFor({ timeout: 8000 })
    await viewBtn.click()
    await this.page.waitForURL(/section=app/, { timeout: 8000 })
  }

  /**
   * Opens an application by registration number (searches for it in the table).
   */
  async openApplicationByRegNo(regNo) {
    const searchInput = this.page.locator('input[placeholder*="search"], input[placeholder*="Search"]').first()
    if (await searchInput.count()) {
      await searchInput.fill(regNo)
      await this.page.waitForTimeout(500)
    }
    const row = this.page.locator(`tr:has-text("${regNo}")`).first()
    await row.click()
    await this.page.waitForURL('**/college/application/**', { timeout: 8000 })
  }

  // ── Application Detail Actions ────────────────────────────────

  async requestCorrection(note = 'Please fix your address details.') {
    await this.page.click('button:has-text("Request Correction"), button:has-text("Correction")')
    // Fill the note in the modal/textarea
    const noteField = this.page.locator('textarea, input[placeholder*="note"], input[placeholder*="Note"]').last()
    await noteField.waitFor({ timeout: 5000 })
    await noteField.fill(note)
    await this.page.click('button:has-text("Submit"), button:has-text("Send"), button:has-text("Confirm")')
    await this.page.waitForLoadState('networkidle', { timeout: 8000 })
  }

  async acceptScrutiny() {
    await this.page.click('button:has-text("Accept"), button:has-text("Approve"), button:has-text("Scrutiny")')
    await this.page.waitForLoadState('networkidle', { timeout: 8000 })
  }

  async rejectApplication(reason = 'Documents incomplete.') {
    await this.page.click('button:has-text("Reject")')
    const reasonField = this.page.locator('textarea, input[placeholder*="reason"], input[placeholder*="Reason"]').last()
    await reasonField.waitFor({ timeout: 5000 })
    await reasonField.fill(reason)
    await this.page.click('button:has-text("Submit"), button:has-text("Confirm"), button:has-text("Reject")')
    await this.page.waitForLoadState('networkidle', { timeout: 8000 })
  }

  async confirmAdmission(totalFee = '45000', payNow = '22500') {
    await this.page.click('button:has-text("Confirm"), button:has-text("Confirm Admission")')
    // Fill fee amounts in the confirmation modal
    const totalInput = this.page.locator('input[name*="total"], input[placeholder*="total"]').last()
    const payNowInput = this.page.locator('input[name*="pay_now"], input[placeholder*="pay now"]').last()
    if (await totalInput.count()) await totalInput.fill(totalFee)
    if (await payNowInput.count()) await payNowInput.fill(payNow)
    await this.page.click('button:has-text("Confirm"), button:has-text("Submit")')
    await this.page.waitForLoadState('networkidle', { timeout: 8000 })
  }

  async assignRollNumber(rollNo = 'TC001-001') {
    // Find the assign roll number button
    await this.page.click('button:has-text("Roll"), button:has-text("Assign Roll")')
    const rollInput = this.page.locator('input[name*="roll"], input[placeholder*="roll"]').last()
    if (await rollInput.count()) await rollInput.fill(rollNo)
    await this.page.click('button:has-text("Assign"), button:has-text("Submit"), button:has-text("Save")')
    await this.page.waitForLoadState('networkidle', { timeout: 8000 })
  }

  // ── Status check ─────────────────────────────────────────────

  async getApplicationStatus() {
    const badge = this.page.locator('span.rounded-full, [class*="status"]').first()
    return badge.textContent()
  }

  async getSuccessToast() {
    const toast = this.page.locator('[class*="toast"], [class*="success"], [role="status"]').first()
    await toast.waitFor({ timeout: 5000 })
    return toast.textContent()
  }

  // ── Logout ───────────────────────────────────────────────────

  async logout() {
    await this.page.click('button:has-text("Logout"), button:has-text("Sign out")', { timeout: 5000 })
    await this.page.waitForURL('**/login/**', { timeout: 8000 })
  }
}

module.exports = { CollegeDashboardPage }
