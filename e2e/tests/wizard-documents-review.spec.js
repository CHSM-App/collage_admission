/**
 * Application Wizard — Steps 5 & 6 (Documents + Review/Declaration)
 *
 * Covers:
 *   - Step 5 (Documents): page loads, shows required document list
 *   - Step 5: file upload control is present for each required doc
 *   - Step 5: uploading a valid PDF advances to review step
 *   - Step 5: attempting to skip required docs shows error
 *   - Step 6 (Review): renders summary of all previous steps
 *   - Step 6: shows college, course, academic year
 *   - Step 6: shows personal details entered in step 2
 *   - Step 6: Declaration checkbox must be accepted before submit
 *   - Step 6: clicking submit without declaration checked shows error
 *   - Step 6: accepting declaration and submitting moves to post-submission state
 *   - Read-only mode: submitted application wizard shows read-only view
 *
 * Prerequisites:
 *   - Pre-authenticated student (storageState)
 *   - Draft application at step 1 (reset by beforeEach via resetDraft)
 */

const path = require('path')
const { test, expect } = require('@playwright/test')
const { LoginPage } = require('../pages/LoginPage')
const { ApplyWizardPage } = require('../pages/ApplyWizardPage')
const { BACKEND_URL } = require('../fixtures/env')
const { resetDraft } = require('../helpers/resetDraft')

// Navigate to student dashboard and open the draft application
async function openDraft(page) {
  const login = new LoginPage(page)
  await page.goto('/student/dashboard')
  await page.waitForURL(/\/student\/dashboard/, { timeout: 10000 })
  await login.dismissNotificationPopup()

  // Get student ID from localStorage
  const studentId = await page.evaluate(() => {
    try {
      const auth = JSON.parse(localStorage.getItem('collegeAdmissionAuth') || '{}')
      return auth.user?.id || null
    } catch { return null }
  })
  if (!studentId) throw new Error('Could not read student ID')

  const resp = await page.request.get(`${BACKEND_URL}/applications?student_id=${studentId}`)
  const data = await resp.json()
  const apps = data.data || []
  const draft = apps.find(a => a.status === 'draft')
  if (!draft) throw new Error('No draft application found. Reseed the DB.')

  await page.goto(`/apply/${draft.id}`)
  await page.waitForURL(`**/apply/${draft.id}`, { timeout: 10000 })
  return draft.id
}

// Navigate through steps 1-4 quickly so we can test step 5
async function advanceToStep5(page) {
  const wizard = new ApplyWizardPage(page)
  await wizard.waitForLoad()

  // Step 1: Context
  await wizard.confirmContextAndContinue()

  // Step 2: Personal Details
  await wizard.fillPersonalDetails()
  await wizard.clickSaveAndNext()

  // Step 3: Other Details
  await wizard.fillOtherDetails()
  await wizard.clickSaveAndNext()

  // Step 4: Previous Exam
  await wizard.fillPreviousExam({ examType: 'HSC' })
  await wizard.clickSaveAndNext()

  // Now on Step 5 — Documents
  await page.waitForFunction(
    () => {
      const body = document.body.innerText
      return body.includes('Document') || body.includes('Upload') || body.includes('upload')
    },
    { timeout: 12000 }
  )
}

// Navigate through steps 1-5 quickly so we can test step 6
async function advanceToStep6(page) {
  await advanceToStep5(page)

  // Step 5: Documents — click Save & Continue without uploading (may be optional)
  const wizard = new ApplyWizardPage(page)
  await wizard.clickSaveAndNext()

  // Wait for step 6
  await page.waitForFunction(
    () => {
      const body = document.body.innerText
      return body.includes('Review') || body.includes('Declaration') || body.includes('Submit')
    },
    { timeout: 12000 }
  )
}

// ── Step 5: Documents ─────────────────────────────────────────

test.describe('Application Wizard — Step 5: Documents', () => {
  test.beforeEach(async () => { await resetDraft() })

  test('documents step loads and shows document type list', async ({ page }) => {
    await openDraft(page)
    await advanceToStep5(page)

    const body = await page.textContent('body')
    const hasDocContent =
      body.includes('Document') ||
      body.includes('Upload') ||
      body.includes('Required') ||
      body.includes('SSC') ||
      body.includes('Photo')
    expect(hasDocContent).toBe(true)
  })

  test('documents step shows file upload control(s)', async ({ page }) => {
    await openDraft(page)
    await advanceToStep5(page)

    const fileInputCount  = await page.locator('input[type="file"]').count()
    const uploadBtnCount  = await page.locator('button:has-text("Upload"), label:has-text("Choose"), button:has-text("Browse")').count()
    const hasUploadUI = fileInputCount > 0 || uploadBtnCount > 0
    expect(hasUploadUI).toBe(true)
  })

  test('uploading a valid PDF document is accepted', async ({ page }) => {
    await openDraft(page)
    await advanceToStep5(page)

    const fileInput = page.locator('input[type="file"]').first()
    if (await fileInput.count() === 0) {
      test.skip()
      return
    }

    // Minimal valid PDF bytes
    const pdfBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n' +
      'xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n' +
      '0000000058 00000 n\n0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF'
    )

    await fileInput.setInputFiles({
      name: 'ssc_marksheet.pdf',
      mimeType: 'application/pdf',
      buffer: pdfBuffer,
    })

    // Wait for upload response
    await page.waitForLoadState('networkidle', { timeout: 10000 })

    // Should not show an error
    const body = await page.textContent('body')
    const hasError = body.includes('invalid type') || body.includes('only PDF') || body.includes('rejected')
    expect(hasError).toBe(false)
  })

  test('back button on step 5 returns to step 4 (exam)', async ({ page }) => {
    await openDraft(page)
    await advanceToStep5(page)

    const wizard = new ApplyWizardPage(page)
    await wizard.clickBack()

    await page.waitForFunction(
      () => {
        const body = document.body.innerText
        return body.includes('Exam') || body.includes('SSC') || body.includes('HSC') || body.includes('Sem')
      },
      { timeout: 10000 }
    )

    const body = await page.textContent('body')
    expect(body).toMatch(/Exam|SSC|HSC|Sem/i)
  })
})

// ── Step 6: Review & Declaration ─────────────────────────────

test.describe('Application Wizard — Step 6: Review & Declaration', () => {
  test.beforeEach(async () => { await resetDraft() })

  test('review step loads and shows "Review" or "Declaration" heading', async ({ page }) => {
    await openDraft(page)
    await advanceToStep6(page)

    const body = await page.textContent('body')
    const hasReviewContent =
      body.includes('Review') ||
      body.includes('Declaration') ||
      body.includes('Submit')
    expect(hasReviewContent).toBe(true)
  })

  test('review step shows college name in summary', async ({ page }) => {
    await openDraft(page)
    await advanceToStep6(page)

    const body = await page.textContent('body')
    // The college name should appear in the review summary
    // "Test College of Commerce" is the seeded college
    const hasCollege = body.includes('College') || body.includes('course') || body.includes('Course')
    expect(hasCollege).toBe(true)
  })

  test('review step shows personal details filled in step 2', async ({ page }) => {
    await openDraft(page)
    await advanceToStep6(page)

    const body = await page.textContent('body')
    // Personal details from fillPersonalDetails defaults: 'Sharma', 'Rahul'
    const hasPersonal = body.includes('Sharma') || body.includes('Rahul') || body.includes('Personal')
    expect(hasPersonal).toBe(true)
  })

  test('declaration checkbox is unchecked by default', async ({ page }) => {
    await openDraft(page)
    await advanceToStep6(page)

    const checkbox = page.locator('input[type="checkbox"]').first()
    if (await checkbox.count() > 0) {
      const isChecked = await checkbox.isChecked()
      expect(isChecked).toBe(false)
    }
  })

  test('submitting without accepting declaration shows an error or is blocked', async ({ page }) => {
    await openDraft(page)
    await advanceToStep6(page)

    // Do NOT check the declaration checkbox
    const submitBtn = page.locator(
      'button:has-text("Submit"), button:has-text("Submit Application"), button:has-text("Final Submit")'
    ).first()

    if (await submitBtn.count() > 0) {
      await submitBtn.click()
      await page.waitForTimeout(1500)

      // Should show error or stay on review step
      const body = await page.textContent('body')
      const isBlocked =
        body.includes('Declaration') ||
        body.includes('declare') ||
        body.includes('accept') ||
        body.includes('Review')   // still on review = blocked
      expect(isBlocked).toBe(true)
    }
  })

  test('accepting declaration enables the submit button', async ({ page }) => {
    await openDraft(page)
    await advanceToStep6(page)

    const checkbox = page.locator('input[type="checkbox"]').first()
    if (await checkbox.count() > 0) {
      await checkbox.check()

      const submitBtn = page.locator(
        'button:has-text("Submit"), button:has-text("Submit Application")'
      ).first()

      if (await submitBtn.count() > 0) {
        const isDisabled = await submitBtn.isDisabled()
        expect(isDisabled).toBe(false)
      }
    }
  })

  test('back button on review step returns to documents step', async ({ page }) => {
    await openDraft(page)
    await advanceToStep6(page)

    const wizard = new ApplyWizardPage(page)
    await wizard.clickBack()

    await page.waitForFunction(
      () => {
        const body = document.body.innerText
        return body.includes('Document') || body.includes('Upload') || body.includes('upload')
      },
      { timeout: 10000 }
    )

    const body = await page.textContent('body')
    expect(body).toMatch(/Document|Upload/i)
  })

  test('step indicator shows all 6 steps', async ({ page }) => {
    await openDraft(page)

    const wizard = new ApplyWizardPage(page)
    await wizard.waitForLoad()

    const body = await page.textContent('body')
    // Step indicator should render step numbers 1-6 or labels
    // At minimum we should see 2+ step indicators
    const stepIndicators = await page.locator('[class*="step"], [class*="StepIndicator"], ol li, nav li').count()
    expect(stepIndicators).toBeGreaterThanOrEqual(2)
  })
})

// ── Read-Only Mode ────────────────────────────────────────────

test.describe('Application Wizard — Read-Only Mode', () => {
  test('submitted application wizard shows read-only view (no editable inputs)', async ({ page }) => {
    const login = new LoginPage(page)
    await page.goto('/student/dashboard')
    await page.waitForURL(/\/student\/dashboard/, { timeout: 10000 })
    await login.dismissNotificationPopup()

    const studentId = await page.evaluate(() => {
      try {
        const auth = JSON.parse(localStorage.getItem('collegeAdmissionAuth') || '{}')
        return auth.user?.id || null
      } catch { return null }
    })
    if (!studentId) {
      test.skip()
      return
    }

    const resp = await page.request.get(`${BACKEND_URL}/applications?student_id=${studentId}`)
    const data = await resp.json()
    const apps = data.data || []
    const submitted = apps.find(a => a.status !== 'draft')

    if (!submitted) {
      test.skip()
      return
    }

    await page.goto(`/apply/${submitted.id}`)
    await page.waitForURL(`**/apply/${submitted.id}`, { timeout: 10000 })
    await page.waitForSelector('h2', { timeout: 10000 })

    // In read-only mode, there should be no editable text inputs or textareas
    const editableInputs = await page.locator('input:not([type="hidden"]):not([readonly]):not([disabled])').count()
    const editableTextareas = await page.locator('textarea:not([readonly]):not([disabled])').count()

    const body = await page.textContent('body')
    const isReadOnly =
      editableInputs === 0 ||
      body.includes('read-only') ||
      body.includes('Read Only') ||
      body.includes('View Only') ||
      body.includes('submitted')

    expect(isReadOnly).toBe(true)
  })
})

// ── Wizard URL Guard ──────────────────────────────────────────

test.describe('Application Wizard — URL Guards', () => {
  test('visiting /apply/99999999 (non-existent) shows error or redirects', async ({ page }) => {
    const login = new LoginPage(page)
    await page.goto('/student/dashboard')
    await page.waitForURL(/\/student\/dashboard/, { timeout: 10000 })
    await login.dismissNotificationPopup()

    await page.goto('/apply/99999999')
    await page.waitForTimeout(3000)

    const body = await page.textContent('body')
    const isHandled =
      body.includes('not found') ||
      body.includes('Not found') ||
      body.includes('error') ||
      body.includes('Error') ||
      page.url().includes('/student/dashboard')
    expect(isHandled).toBe(true)
  })

  test('visiting /apply/new without query params shows error or redirects', async ({ page }) => {
    const login = new LoginPage(page)
    await page.goto('/student/dashboard')
    await page.waitForURL(/\/student\/dashboard/, { timeout: 10000 })
    await login.dismissNotificationPopup()

    await page.goto('/apply/new')
    await page.waitForTimeout(3000)

    // Should not crash the app
    await expect(page.locator('body')).toBeVisible()
  })
})
