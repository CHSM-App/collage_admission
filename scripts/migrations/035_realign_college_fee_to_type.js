/**
 * Migration 035: Re-align each college's payment.college_fee to its college_type.
 *
 * General colleges have a college-fee system (college_fee=true); agriculture
 * colleges do not (college_fee=false). Earlier presets had general at
 * college_fee=false, so existing general colleges carry the wrong value.
 *
 * This updates ONLY payment.college_fee from the type preset, leaving
 * platform_fee and everything else untouched.
 *
 * Run:  node scripts/migrations/035_realign_college_fee_to_type.js
 */

'use strict';

require('dotenv').config();
const mssql = require('mssql');
const { presetForType } = require('../../constants/collegePresets');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT) || 1433,
  options: { encrypt: true, trustServerCertificate: true },
  pool: { max: 1, min: 1 },
  requestTimeout: 120000,
  connectionTimeout: 15000,
};

async function main() {
  const pool = await new mssql.ConnectionPool(config).connect();
  console.log(`[035] Connected to: ${process.env.DB_NAME}\n`);

  const rows = (await pool.request()
    .query('SELECT id, name, college_type, features_config FROM colleges')).recordset;

  let changed = 0;
  for (const row of rows) {
    const type = row.college_type || 'general';
    const wantFee = presetForType(type).payment.college_fee;

    const current = row.features_config ? JSON.parse(row.features_config) : {};
    const payment = current.payment || {};
    if (payment.college_fee === wantFee) {
      console.log(`  = ${row.name} (${type}) — college_fee already ${wantFee}`);
      continue;
    }

    const merged = { ...current, payment: { ...payment, college_fee: wantFee } };
    await pool.request()
      .input('id', mssql.Int, row.id)
      .input('features', mssql.NVarChar, JSON.stringify(merged))
      .query('UPDATE colleges SET features_config = @features WHERE id = @id');

    console.log(`  ✓ ${row.name} (${type}) — college_fee set to ${wantFee}`);
    changed++;
  }

  console.log(`\n[035] Done. ${changed} college(s) updated.`);
  await pool.close();
}

main().catch(err => { console.error('[035] FAILED:', err.message); process.exit(1); });
