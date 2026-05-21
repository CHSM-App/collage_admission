/**
 * ApplyWizardPage — Page Object for the 6-step application wizard.
 *
 * Actual wizard steps (from ApplyWizard.jsx):
 *   Step 1 — Application Context  (read-only, just confirm and continue)
 *   Step 2 — Personal Details     (name, mobile, address, caste radio buttons)
 *   Step 3 — Other Details        (DOB, family, Aadhaar)
 *   Step 4 — Previous Exam        (nested rows per exam type)
 *   Step 5 — Documents            (file uploads)
 *   Step 6 — Review & Declaration
 */
class ApplyWizardPage {
  constructor(page) {
    this.page = page
  }

  async waitForLoad() {
    await this.page.waitForURL('**/apply/**', { timeout: 15000 })
    // Wait for the skeleton to disappear and the actual step heading to appear
    await this.page.waitForSelector('h2', { timeout: 20000 })
  }

  // ── Step 1: Application Context (read-only) ──────────────────
  // This is the first step the wizard always opens on.
  // It shows college/course info and has a single "Looks correct — Continue →" button.

  async confirmContextAndContinue() {
    // If we're already on step 2+ (draft resumed past step 1), skip this.
    const btn = this.page.locator('button:has-text("Looks correct")')
    if (await btn.count() === 0) return

    // Wait for the button to be enabled (not in saving/loading state)
    await btn.waitFor({ state: 'visible', timeout: 8000 })
    await this.page.waitForFunction(
      () => {
        const b = [...document.querySelectorAll('button')].find(el => el.textContent.includes('Looks correct'))
        return b && !b.disabled
      },
      { timeout: 8000 }
    )
    await btn.click()
    // Wait for the step indicator to show step 2 active (i.e., Personal step is now current)
    await this.page.waitForFunction(
      () => {
        // Step 2 is active when heading says "Personal Details" OR when surname input appears
        const h2 = document.querySelector('h2')
        return h2 && (h2.textContent.includes('Personal') || h2.textContent.includes('Other') || h2.textContent.includes('Exam'))
      },
      { timeout: 15000 }
    )
    // Wait for the form to stabilize
    await this.page.waitForLoadState('networkidle', { timeout: 8000 })
  }

  // ── Step 2: Personal Details ─────────────────────────────────
  // Category (caste) and sex use radio buttons, NOT <select>.

  async fillPersonalDetails({
    surname     = 'Sharma',
    firstName   = 'Rahul',
    middleName  = 'Kumar',
    motherName  = 'Sunita',
    sex         = 'Male',
    mobile      = '9876543210',
    address     = '12, Gandhi Nagar',
    taluka      = 'Vengurla',
    district    = 'Sindhudurg',
    state       = 'Maharashtra',
    category    = 'OBC',
  } = {}) {
    const p = this.page

    // Wait for form to stabilize after step navigation
    await p.locator('input[name="surname"]').waitFor({ state: 'visible', timeout: 10000 })
    await p.waitForLoadState('networkidle', { timeout: 8000 })

    await p.locator('input[name="surname"]').fill(surname)
    await p.locator('input[name="first_name"]').fill(firstName)
    await p.locator('input[name="middle_name"]').fill(middleName)
    await p.locator('input[name="mother_name"]').fill(motherName)

    // Sex/Gender — rendered as a <select> combobox
    const sexSelect = p.locator('select[name="sex"], select[name="gender"]')
    if (await sexSelect.count() > 0) {
      await sexSelect.selectOption(sex)
    }

    await p.fill('input[name="mobile"]', mobile)

    // address is a textarea
    await p.fill('textarea[name="address"], input[name="address"]', address)
    await p.fill('input[name="taluka"]',    taluka)
    await p.fill('input[name="district"]',  district)
    await p.fill('input[name="state"]',     state)

    // Category (caste) — radio button group (SC, ST, OBC, Gen., etc.)
    // Skip if category is empty (intentionally left blank to test validation)
    if (category) {
      await p.locator(`input[type="radio"][name="category"][value="${category}"]`).check()
    }
  }

  // ── Step 3: Other Details ─────────────────────────────────────

  async fillOtherDetails({
    birthDate     = '2001-01-01',
    birthPlace    = 'Vengurla',
    nationality   = 'Indian',
    maritalStatus = 'Unmarried',
    fatherName    = 'Raj Kumar Sharma',
    aadhaar       = '123456789012',
  } = {}) {
    const p = this.page

    const dobInput = p.locator('input[name="birth_date"]')
    if (await dobInput.count()) await dobInput.fill(birthDate)

    const birthPlaceInput = p.locator('input[name="birth_place"]')
    if (await birthPlaceInput.count()) await birthPlaceInput.fill(birthPlace)

    const nationalityInput = p.locator('input[name="nationality"]')
    if (await nationalityInput.count()) await nationalityInput.fill(nationality)

    const maritalSelect = p.locator('select[name="marital_status"]')
    if (await maritalSelect.count()) await maritalSelect.selectOption({ value: maritalStatus })

    const fatherInput = p.locator('input[name="father_full_name"]')
    if (await fatherInput.count()) await fatherInput.fill(fatherName)

    const aadhaarInput = p.locator('input[name="aadhaar"]')
    if (await aadhaarInput.count()) await aadhaarInput.fill(aadhaar)
  }

  // ── Step 4: Previous Exam ─────────────────────────────────────
  // Exam data is a nested row structure. Each exam type (SSC, HSC, etc.)
  // has its own input group. Fields are identified by name pattern or
  // by being inside a section labelled with the exam type.

  async fillPreviousExam({
    examType    = 'HSC',     // Which exam row to fill: 'SSC' or 'HSC'
    institute   = 'Maharashtra State Board',
    board       = 'Maharashtra State Board',
    monthYear   = 'March 2022',
    seatNo      = 'MH12345',
    obtained    = '450',
    maxMarks    = '600',
    percentage  = '75.00',
    classGrade  = 'First Class',
  } = {}) {
    const p = this.page

    // Each exam row has inputs named like: exams_HSC_board, exams_HSC_marks_obtained
    // OR the rows are grouped inside a container that has a label with the exam type name.
    // Try data-exam-type attribute first, then fall back to label-based locator.

    const rowLocator = p.locator(`[data-exam-type="${examType}"], tr:has-text("${examType}"), [class*="exam-row"]:has-text("${examType}")`)
    const rowCount = await rowLocator.count()

    if (rowCount > 0) {
      // Structured row — fill fields relative to the row container
      const row = rowLocator.first()
      const inputs = row.locator('input')
      const inputCount = await inputs.count()
      if (inputCount >= 1) await inputs.nth(0).fill(institute)  // institute/board
      if (inputCount >= 2) await inputs.nth(1).fill(monthYear)  // month_year
      if (inputCount >= 3) await inputs.nth(2).fill(seatNo)     // seat_no
      if (inputCount >= 4) await inputs.nth(3).fill(obtained)   // marks_obtained
      if (inputCount >= 5) await inputs.nth(4).fill(maxMarks)   // marks_max
      // percentage is usually auto-calculated
      if (inputCount >= 7) await inputs.nth(6).fill(classGrade) // class_grade
    } else {
      // Fallback: flat field names (older schema)
      const boardInput = p.locator('input[name="board_or_college_name"]')
      if (await boardInput.count()) await boardInput.fill(board)
      const seatInput = p.locator('input[name="seat_number"]')
      if (await seatInput.count()) await seatInput.fill(seatNo)
      const monthYearInput = p.locator('input[name="month_year_passing"]')
      if (await monthYearInput.count()) await monthYearInput.fill(monthYear)
      const obtainedInput = p.locator('input[name="total_marks_obtained"]')
      if (await obtainedInput.count()) await obtainedInput.fill(obtained)
      const maxInput = p.locator('input[name="total_marks_max"]')
      if (await maxInput.count()) await maxInput.fill(maxMarks)
    }
  }

  // ── Step 6: Review & Declaration ────────────────────────────

  async acceptDeclaration() {
    const checkbox = this.page.locator('input[type="checkbox"]').first()
    if (await checkbox.count()) await checkbox.check()
  }

  // ── Navigation ───────────────────────────────────────────────

  async clickSaveAndNext() {
    // StepFooter renders: "{nextLabel} →"
    // Step 1: "Looks correct — Continue →"
    // All other steps: "Save & Continue →"
    const btn = this.page.locator(
      'button:has-text("Save & Continue"), button:has-text("Looks correct"), button:has-text("Continue")'
    ).first()
    await btn.click({ timeout: 5000 })
    // Wait for the button to go away (step changed) or for networkidle
    await this.page.waitForLoadState('networkidle', { timeout: 10000 })
  }

  async clickBack() {
    // StepFooter renders: "← Back"
    const btn = this.page.locator('button:has-text("Back")').first()
    await btn.waitFor({ state: 'visible', timeout: 10000 })
    await btn.click()
  }

  async getCurrentStepTitle() {
    const heading = this.page.locator('h2').first()
    return heading.textContent()
  }

  async isOnReviewStep() {
    const text = await this.page.textContent('body')
    return text.includes('Review') || text.includes('Declaration') || text.includes('Submit')
  }

  async getValidationErrors() {
    const errors = this.page.locator('.text-red-600, .text-red-700, [class*="error"]')
    const texts = []
    const count = await errors.count()
    for (let i = 0; i < count; i++) {
      const t = (await errors.nth(i).textContent()).trim()
      if (t.length > 0) texts.push(t)
    }
    return texts
  }
}

module.exports = { ApplyWizardPage }
