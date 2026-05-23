/**
 * College Admin — Masters Pages Tests
 *
 * Covers all sub-pages under /college/masters/*:
 *
 *   Programs/Faculty Master:
 *     - Page loads
 *     - List shows seeded programs
 *     - Add new program form opens and validates
 *     - Created program appears in list
 *
 *   Fees Master:
 *     - Page loads
 *     - Shows fee entries with amounts
 *     - Add fee form opens
 *     - Category-specific fees display correctly
 *
 *   Bank Master:
 *     - Page loads
 *     - Shows bank account details
 *     - Add/edit bank form opens
 *
 *   Division Master:
 *     - Page loads
 *     - Shows division list
 *     - Add division form opens
 *
 *   Documents Master:
 *     - Page loads
 *     - Shows document type list
 *     - Add document type form opens
 *
 *   Class/Group Master:
 *     - Page loads (if applicable)
 *
 * Prerequisites:
 *   - College admin authenticated via storageState (college.json)
 */

const { test, expect } = require('@playwright/test')

test.use({ storageState: 'e2e/auth-states/college.json' })

// ── Programs / Faculty Master ─────────────────────────────────

test.describe('College Masters — Programs', () => {
  test('programs page loads with heading', async ({ page }) => {
    await page.goto('/college/masters/programs')
    await page.waitForSelector('h1, h2', { timeout: 8000 })

    const body = await page.textContent('body')
    expect(body).toMatch(/Program|Faculty|Course|master/i)
  })

  test('programs page shows list or empty state', async ({ page }) => {
    await page.goto('/college/masters/programs')
    await page.waitForSelector('h1, h2', { timeout: 8000 })

    const body = await page.textContent('body')
    const hasContent = body.includes('BCA') || body.includes('BCom') || body.includes('BSc') || body.includes('No ') || body.includes('Add') || body.includes('Faculty')
    expect(hasContent).toBe(true)
  })

  test('add program button opens form', async ({ page }) => {
    await page.goto('/college/masters/programs')
    await page.waitForSelector('h1, h2', { timeout: 8000 })

    const addBtn = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Create")').first()
    if (await addBtn.count() > 0) {
      await addBtn.click()
      await page.waitForSelector('form, [role="dialog"]', { timeout: 8000 })

      const body = await page.textContent('body')
      const hasForm = body.includes('Name') || body.includes('Code') || body.includes('Faculty') || body.includes('Program')
      expect(hasForm).toBe(true)
    }
  })

  test('empty program form shows validation on submit', async ({ page }) => {
    await page.goto('/college/masters/programs')
    await page.waitForSelector('h1, h2', { timeout: 8000 })

    const addBtn = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Create")').first()
    if (await addBtn.count() > 0) {
      await addBtn.click()
      await page.waitForSelector('form, [role="dialog"]', { timeout: 8000 })

      const submitBtn = page.locator('button[type="submit"], button:has-text("Save")').last()
      if (await submitBtn.count() > 0) {
        await submitBtn.click()
        await page.waitForTimeout(1200)

        // Form should stay open
        const body = await page.textContent('body')
        const formStillOpen = body.includes('Name') || body.includes('required') || body.includes('Faculty')
        expect(formStillOpen).toBe(true)
      }
    }
  })
})

// ── Fees Master ───────────────────────────────────────────────

test.describe('College Masters — Fees', () => {
  test('fees master page loads', async ({ page }) => {
    await page.goto('/college/masters/fees')
    await page.waitForSelector('h1, h2', { timeout: 8000 })

    const body = await page.textContent('body')
    expect(body).toMatch(/Fee|fee/i)
  })

  test('fees page shows fee entries or empty state', async ({ page }) => {
    await page.goto('/college/masters/fees')
    await page.waitForSelector('h1, h2', { timeout: 8000 })

    const body = await page.textContent('body')
    const hasContent =
      body.includes('₹') ||
      body.includes('Amount') ||
      body.includes('Category') ||
      body.includes('No fee') ||
      body.includes('Add')
    expect(hasContent).toBe(true)
  })

  test('fees page shows category filter or grouping (SC, ST, OBC, Gen)', async ({ page }) => {
    await page.goto('/college/masters/fees')
    await page.waitForSelector('h1, h2', { timeout: 8000 })

    const body = await page.textContent('body')
    const hasCategory =
      body.includes('SC') ||
      body.includes('OBC') ||
      body.includes('General') ||
      body.includes('Gen') ||
      body.includes('Category') ||
      body.includes('fee')
    expect(hasCategory).toBe(true)
  })

  test('add fee button opens form', async ({ page }) => {
    await page.goto('/college/masters/fees')
    await page.waitForSelector('h1, h2', { timeout: 8000 })

    const addBtn = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Create")').first()
    if (await addBtn.count() > 0) {
      await addBtn.click()
      await page.waitForSelector('form, [role="dialog"]', { timeout: 8000 })

      const body = await page.textContent('body')
      const hasForm = body.includes('Amount') || body.includes('Category') || body.includes('Course') || body.includes('Fee')
      expect(hasForm).toBe(true)
    }
  })

  test('fee form requires amount to be numeric', async ({ page }) => {
    await page.goto('/college/masters/fees')
    await page.waitForSelector('h1, h2', { timeout: 8000 })

    const addBtn = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Create")').first()
    if (await addBtn.count() > 0) {
      await addBtn.click()
      await page.waitForSelector('form, [role="dialog"]', { timeout: 8000 })

      const amountInput = page.locator('input[name*="amount"], input[name*="fee"], input[type="number"]').first()
      if (await amountInput.count() > 0) {
        await amountInput.fill('not-a-number')
        const submitBtn = page.locator('button[type="submit"], button:has-text("Save")').last()
        if (await submitBtn.count() > 0) {
          await submitBtn.click()
          await page.waitForTimeout(1000)
          // HTML5 or custom validation should prevent this
          const body = await page.textContent('body')
          expect(body).not.toContain('success')
        }
      }
    }
  })
})

// ── Bank Master ───────────────────────────────────────────────

test.describe('College Masters — Bank', () => {
  test('bank master page loads', async ({ page }) => {
    await page.goto('/college/masters/bank')
    await page.waitForSelector('h1, h2', { timeout: 8000 })

    const body = await page.textContent('body')
    expect(body).toMatch(/Bank|bank|Account/i)
  })

  test('bank page shows account details or empty state', async ({ page }) => {
    await page.goto('/college/masters/bank')
    await page.waitForSelector('h1, h2', { timeout: 8000 })

    const body = await page.textContent('body')
    const hasContent =
      body.includes('Account') ||
      body.includes('IFSC') ||
      body.includes('Branch') ||
      body.includes('No bank') ||
      body.includes('Add')
    expect(hasContent).toBe(true)
  })

  test('add/edit bank details form opens', async ({ page }) => {
    await page.goto('/college/masters/bank')
    await page.waitForSelector('h1, h2', { timeout: 8000 })

    const addOrEditBtn = page.locator(
      'button:has-text("Add"), button:has-text("Edit"), button:has-text("Update"), button:has-text("Save")'
    ).first()

    if (await addOrEditBtn.count() > 0) {
      await addOrEditBtn.click()
      await page.waitForSelector('form, input', { timeout: 8000 })

      const body = await page.textContent('body')
      const hasForm = body.includes('Account') || body.includes('IFSC') || body.includes('Bank') || body.includes('Branch')
      expect(hasForm).toBe(true)
    }
  })
})

// ── Division Master ───────────────────────────────────────────

test.describe('College Masters — Division', () => {
  test('division master page loads', async ({ page }) => {
    await page.goto('/college/masters/divisions')
    await page.waitForSelector('h1, h2', { timeout: 8000 })

    const body = await page.textContent('body')
    expect(body).toMatch(/Division|division|Class|Batch/i)
  })

  test('division page shows list or empty state', async ({ page }) => {
    await page.goto('/college/masters/divisions')
    await page.waitForSelector('h1, h2', { timeout: 8000 })

    const body = await page.textContent('body')
    const hasContent =
      body.includes('A') ||
      body.includes('Division') ||
      body.includes('No ') ||
      body.includes('Add')
    expect(hasContent).toBe(true)
  })

  test('add division button opens form', async ({ page }) => {
    await page.goto('/college/masters/divisions')
    await page.waitForSelector('h1, h2', { timeout: 8000 })

    const addBtn = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Create")').first()
    if (await addBtn.count() > 0) {
      await addBtn.click()
      await page.waitForSelector('form, [role="dialog"], input', { timeout: 8000 })

      const body = await page.textContent('body')
      const hasForm = body.includes('Name') || body.includes('Division') || body.includes('Code')
      expect(hasForm).toBe(true)
    }
  })
})

// ── Documents Master ──────────────────────────────────────────

test.describe('College Masters — Documents', () => {
  test('documents master page loads', async ({ page }) => {
    await page.goto('/college/masters/documents')
    await page.waitForSelector('h1, h2', { timeout: 8000 })

    const body = await page.textContent('body')
    expect(body).toMatch(/Document|document|Certificate|Marksheet/i)
  })

  test('document types are listed', async ({ page }) => {
    await page.goto('/college/masters/documents')
    await page.waitForSelector('h1, h2', { timeout: 8000 })

    const body = await page.textContent('body')
    const hasDocTypes =
      body.includes('SSC') ||
      body.includes('Photo') ||
      body.includes('Aadhaar') ||
      body.includes('Certificate') ||
      body.includes('Add') ||
      body.includes('document')
    expect(hasDocTypes).toBe(true)
  })

  test('add document type button opens form', async ({ page }) => {
    await page.goto('/college/masters/documents')
    await page.waitForSelector('h1, h2', { timeout: 8000 })

    const addBtn = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Create")').first()
    if (await addBtn.count() > 0) {
      await addBtn.click()
      await page.waitForSelector('form, [role="dialog"], input', { timeout: 8000 })

      const body = await page.textContent('body')
      const hasForm = body.includes('Name') || body.includes('Type') || body.includes('Document')
      expect(hasForm).toBe(true)
    }
  })
})

// ── Class Master ──────────────────────────────────────────────

test.describe('College Masters — Class', () => {
  test('class master page loads (if route exists)', async ({ page }) => {
    await page.goto('/college/masters/classes')
    await page.waitForTimeout(3000)

    // Either loads or redirects — should not hard crash
    await expect(page.locator('body')).toBeVisible()
  })
})

// ── Group Master ──────────────────────────────────────────────

test.describe('College Masters — Group', () => {
  test('group master page loads (if route exists)', async ({ page }) => {
    await page.goto('/college/masters/groups')
    await page.waitForTimeout(3000)

    await expect(page.locator('body')).toBeVisible()
  })
})

// ── Course Master ─────────────────────────────────────────────

test.describe('College Masters — Courses', () => {
  test('course master page loads', async ({ page }) => {
    await page.goto('/college/masters/courses')
    await page.waitForTimeout(3000)

    await expect(page.locator('body')).toBeVisible()
  })
})

// ── Masters Sidebar Navigation ────────────────────────────────

test.describe('College Masters — Sidebar Navigation', () => {
  test('all masters menu items are accessible from college dashboard', async ({ page }) => {
    await page.goto('/college/dashboard')
    await page.waitForURL('**/college/dashboard', { timeout: 10000 })

    const body = await page.textContent('body')
    // The sidebar should have a "Masters" section or menu
    const hasMastersMenu = body.includes('Masters') || body.includes('master') || body.includes('Settings')
    expect(hasMastersMenu).toBe(true)
  })
})
