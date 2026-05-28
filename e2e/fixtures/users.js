/**
 * Test credentials.
 * These accounts must exist in your dev/test database.
 * See e2e/fixtures/README.md for setup instructions.
 */

exports.STUDENT = {
  phone:    '9000000001',
  password: 'Test@1234',
  name:     'Test Student',
  email:    'teststudent001@example.com',
}

exports.COLLEGE_ADMIN = {
  email:       'admin@testcollege.edu',
  password:    'Admin@1234',
  collegeCode: 'TC001',
  collegeName: 'Test College of Commerce',
}

exports.SUPER_ADMIN = {
  email:    'vtadmin@test.com',
  password: 'Admin@1234',
}

/**
 * A unique phone/email generator for tests that create new accounts.
 * Uses timestamp suffix to avoid conflicts on re-runs.
 */
exports.uniquePhone = () => {
  // Generate a valid 10-digit phone number starting with 9
  // Use timestamp last 9 digits to stay unique across test runs
  const suffix = Date.now().toString().slice(-9)
  return `9${suffix}`
}

exports.uniqueEmail = () => {
  const suffix = Date.now().toString()
  return `e2e_${suffix}@test.com`
}
