/**
 * seed_e2e_runner.js — Runs seed_e2e.sql against the configured database.
 *
 * Usage:
 *   node scripts/seed_e2e_runner.js
 *   npm run seed:e2e          (from BackEnd/)
 *
 * What it does:
 *   - Reads BackEnd/scripts/seed_e2e.sql
 *   - Splits on GO batch separators (same as migrate.js)
 *   - Runs each batch sequentially on a single connection
 *   - Reports success or the first failing batch
 *
 * Safe to re-run — the SQL is fully idempotent (no duplicates created).
 */

'use strict';

require('dotenv').config();
const mssql = require('mssql');
const fs    = require('fs');
const path  = require('path');

const config = {
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server:   process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port:     parseInt(process.env.DB_PORT) || 1433,
  options:  { encrypt: true, trustServerCertificate: true },
  pool:     { max: 1, min: 1 },
  requestTimeout:    60000,
  connectionTimeout: 15000,
};

const SEED_FILE = path.join(__dirname, 'seed_e2e.sql');

function splitBatches(sql) {
  return sql
    .split(/^\s*GO\s*(?:--.*)?$/im)
    .map(b => b.trim())
    .filter(b => b.length > 0);
}

async function main() {
  // Read the seed file
  let sql;
  try {
    sql = fs.readFileSync(SEED_FILE, 'utf8');
  } catch (err) {
    console.error('[seed:e2e] ✗ Cannot read seed file:', err.message);
    process.exit(1);
  }

  const batches = splitBatches(sql);
  console.log(`[seed:e2e] Found ${batches.length} SQL batch(es) to run.`);

  // Connect
  let pool;
  try {
    pool = new mssql.ConnectionPool(config);
    await pool.connect();
    console.log('[seed:e2e] Connected to:', process.env.DB_NAME, 'on', process.env.DB_SERVER);
  } catch (err) {
    console.error('[seed:e2e] ✗ Could not connect:', err.message);
    process.exit(1);
  }

  // Run each batch
  let batchNo = 0;
  for (const batch of batches) {
    batchNo++;
    try {
      await pool.request().batch(batch);
    } catch (err) {
      console.error(`\n[seed:e2e] ✗ Batch ${batchNo} failed:`);
      console.error('  Message:', err.message);
      console.error('  Number: ', err.number);
      console.error('  Batch (first 400 chars):\n  ', batch.slice(0, 400));
      await pool.close();
      process.exit(1);
    }
  }

  console.log(`[seed:e2e] ✓ All ${batches.length} batches applied successfully.`);
  console.log('\n  Test accounts ready:');
  console.log('  Super Admin  → vtadmin@test.com        / Admin@1234');
  console.log('  College Admin→ admin@testcollege.edu   / Admin@1234');
  console.log('  Student 1    → phone 9000000001        / Test@1234');
  console.log('  Student 2    → phone 9000000002        / Test@1234');
  console.log('\n  College code: TC001\n');

  await pool.close();
}

main();
