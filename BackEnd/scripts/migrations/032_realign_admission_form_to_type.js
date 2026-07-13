/**
 * Migration 032: Re-align each college's admission_form features to its college_type.
 *
 * Existing colleges kept their original features_config when college_type was
 * introduced (migration 031), so a college could be type='general' yet still have
 * admission_form fields (e.g. admitted_category, admission_quota) left ON from
 * manual toggling before types existed. This drift makes the admission form show
 * fields that don't belong to the college's type.
 *
 * This migration rewrites ONLY the admission_form block from the type's preset,
 * leaving payment / documents / notifications untouched (those are not type-driven).
 *
 * Run:  node scripts/migrations/032_realign_admission_form_to_type.js
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
  console.log(`[032] Connected to: ${process.env.DB_NAME}\n`);

  const rows = (await pool.request()
    .query('SELECT id, name, college_type, features_config FROM colleges')).recordset;

  let changed = 0;
  for (const row of rows) {
    const type = row.college_type || 'general';
    const preset = presetForType(type);

    // Preserve everything; replace only the admission_form block.
    const current = row.features_config ? JSON.parse(row.features_config) : {};
    const before = JSON.stringify(current.admission_form || {});
    const after = JSON.stringify(preset.admission_form);

    if (before === after) {
      console.log(`  = ${row.name} (${type}) — already aligned`);
      continue;
    }

    const merged = { ...current, admission_form: { ...preset.admission_form } };
    await pool.request()
      .input('id', mssql.Int, row.id)
      .input('features', mssql.NVarChar, JSON.stringify(merged))
      .query('UPDATE colleges SET features_config = @features WHERE id = @id');

    console.log(`  ✓ ${row.name} (${type}) — admission_form re-aligned`);
    changed++;
  }

  console.log(`\n[032] Done. ${changed} college(s) updated.`);
  await pool.close();
}

main().catch(err => { console.error('[032] FAILED:', err.message); process.exit(1); });
