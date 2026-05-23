/**
 * Shared environment config for E2E tests.
 * Values come from the root .env file (loaded by playwright.config.js).
 */
const BACKEND_URL = process.env.E2E_BACKEND_URL || 'http://localhost:8000'
const FRONTEND_URL = process.env.E2E_FRONTEND_URL || 'http://localhost:5173'

module.exports = { BACKEND_URL, FRONTEND_URL }
