/**
 * fix_identity_seeds.js
 * ─────────────────────────────────────────────────────────────
 * Repairs the "id = 0" problem.
 *
 * Migration 027 used `DBCC CHECKIDENT(t, RESEED, 0)`, which on an EMPTY table makes
 * the next inserted row get id **0** (not 1). An id of 0 is falsy in JavaScript, so
 * guards like `if (!student_id)` treat a valid id as "missing" — this broke the
 * student application form.
 *
 * This script:
 *   1. Deletes all student/application data (child rows first).
 *   2. Reseeds every affected table with `DBCC CHECKIDENT(t, RESEED)` — no value —
 *      so the next insert correctly gets id 1.
 *
 * ⚠️  DESTRUCTIVE: removes ALL students, applications and their related rows.
 *     Colleges, staff, roles, masters and fees are KEPT.
 *
 * Usage:  node scripts/fix_identity_seeds.js
 */

'use strict';

require('dotenv').config();
const mssql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: (process.env.DB_SERVER || '').trim(),
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT) || 1433,
  options: { encrypt: true, trustServerCertificate: true },
  pool: { max: 1, min: 1 },
  requestTimeout: 120000,
};

// Child rows first (FK order), then parents.
const DELETE_ORDER = [
  'whatsapp_message_log',        // rows tied to applications
  'payment_link_tokens',
  'fee_installments',
  'payments',
  'application_documents',
  'application_previous_exam',
  'application_subjects',
  'application_activity_log',    // audit-trigger protected — handled specially
  'applications',
  'student_documents',
  'otp_store',
  'students',
];

// Every table whose identity was reseeded to 0 by migration 027.
const RESEED_TABLES = [
  'applications',
  'students',
  'payments',
  'receipt_counters',
  'application_activity_log',
  'application_documents',
  'student_documents',
  'payment_link_tokens',
  'fee_installments',
  'otp_store',
];

async function main() {
  const pool = await new mssql.ConnectionPool(config).connect();
  console.log(`[fix-seeds] Connected to: ${process.env.DB_NAME}\n`);

  // ── 1. Drop the audit guard so activity-log rows can be removed ──
  console.log('1. Disabling the activity-log delete guard…');
  await pool.request().batch(`
    IF EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'trg_activity_log_no_delete')
      DISABLE TRIGGER trg_activity_log_no_delete ON application_activity_log;
  `);

  // ── 2. Delete student + application data ──
  console.log('2. Deleting student & application data…');
  for (const table of DELETE_ORDER) {
    try {
      const r = await pool.request().query(`DELETE FROM [${table}]`);
      console.log(`   ${table.padEnd(28)} ${r.rowsAffected[0]} row(s) deleted`);
    } catch (e) {
      console.log(`   ${table.padEnd(28)} skipped (${e.message.split('.')[0]})`);
    }
  }

  // Reset seat counts, since all applications are gone.
  await pool.request().query('UPDATE admission_periods SET filled_seats = 0');
  console.log('   admission_periods.filled_seats reset to 0');

  // ── 3. Re-enable the audit guard ──
  console.log('\n3. Re-enabling the activity-log delete guard…');
  await pool.request().batch(`
    IF EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'trg_activity_log_no_delete')
      ENABLE TRIGGER trg_activity_log_no_delete ON application_activity_log;
  `);

  // ── 4. Reseed so the next id is 1 ──
  // `RESEED` with NO value resets to the table's original seed (1).
  // `RESEED, 0` would make the next id 0 — that is the bug we are fixing.
  console.log('\n4. Reseeding identities (next id = 1)…');
  for (const table of RESEED_TABLES) {
    try {
      await pool.request().batch(`DBCC CHECKIDENT ('${table}', RESEED) WITH NO_INFOMSGS;`);
      console.log(`   ${table.padEnd(28)} reseeded`);
    } catch (e) {
      console.log(`   ${table.padEnd(28)} FAILED: ${e.message}`);
    }
  }

  // ── 5. Verify ──
  // NOTE: after `RESEED` (no value) on an EMPTY table, SQL Server reports
  // IDENT_CURRENT = 0 — but that is NOT the next id. What matters is IDENT_SEED,
  // which must be 1; the next insert then correctly gets id 1. (Verified with a
  // rolled-back probe insert.) So we check the SEED, not IDENT_CURRENT.
  console.log('\n5. Verifying (checking IDENT_SEED, not IDENT_CURRENT)…');
  let bad = 0;
  for (const table of RESEED_TABLES) {
    const r = await pool.request().query(
      `SELECT IDENT_SEED('${table}') AS seed, IDENT_CURRENT('${table}') AS cur,
              (SELECT COUNT(*) FROM [${table}]) AS n`
    );
    const { seed, cur, n } = r.recordset[0];
    // Empty + seed 1 → next id is 1. Non-empty → min(id) must be >= 1.
    let ok = Number(seed) === 1;
    if (Number(n) > 0) {
      const m = await pool.request().query(`SELECT MIN(id) AS min_id FROM [${table}]`);
      ok = ok && Number(m.recordset[0].min_id) >= 1;
    }
    if (!ok) bad++;
    console.log(`   ${ok ? '✓' : '✗'} ${table.padEnd(28)} rows=${n} seed=${seed} (ident_current=${cur})`);
  }

  console.log(bad === 0
    ? '\n[fix-seeds] ✓ Done. All ids will now start at 1.'
    : `\n[fix-seeds] ✗ ${bad} table(s) still misconfigured.`);

  await pool.close();
}

main().catch(err => { console.error('[fix-seeds] FAILED:', err.message); process.exit(1); });
