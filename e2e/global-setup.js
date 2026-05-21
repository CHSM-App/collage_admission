/**
 * Playwright globalSetup — runs once before all test projects.
 *
 * Reseeds the E2E test database so:
 *   - Draft application current_step is reset to 1 (wizard starts at step 1)
 *   - All seed data is present
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');

module.exports = async function globalSetup() {
  const backendDir = path.join(__dirname, '../BackEnd');
  console.log('\n[global-setup] Reseeding E2E database...');
  try {
    execSync('node scripts/seed_e2e_runner.js', {
      cwd: backendDir,
      stdio: 'inherit',
      timeout: 30000,
    });
    console.log('[global-setup] Seed complete.\n');
  } catch (err) {
    console.error('[global-setup] Seed failed:', err.message);
    // Don't throw — let tests run even if seed fails (may pass with existing data)
  }
};
