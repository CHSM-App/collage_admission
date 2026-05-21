/**
 * resetDraft — Resets the test student's draft application to current_step=1.
 * Used in beforeEach hooks so each wizard test starts at step 1.
 */

'use strict';

const path = require('path');
const backendModules = path.join(__dirname, '../../BackEnd/node_modules');
// dotenv and mssql live in the BackEnd package
require(path.join(backendModules, 'dotenv/config'));
// Override dotenv path to load BackEnd .env
require(path.join(backendModules, 'dotenv')).config({ path: path.join(__dirname, '../../BackEnd/.env'), override: true });
const mssql = require(path.join(backendModules, 'mssql'));

const config = {
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server:   process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port:     parseInt(process.env.DB_PORT) || 1433,
  options:  { encrypt: true, trustServerCertificate: true },
  pool:     { max: 1, min: 1 },
  requestTimeout:    15000,
  connectionTimeout: 10000,
};

async function resetDraft() {
  const pool = await mssql.connect(config);
  await pool.request().query(`
    UPDATE applications
    SET current_step = 1
    WHERE student_id = (SELECT id FROM students WHERE phone = '9000000001')
      AND status = 'draft'
      AND academic_year = '2025-26'
  `);
  await pool.close();
}

module.exports = { resetDraft };
