/**
 * run_sql.js — Paste any SQL here and run it against the database.
 *
 * Usage:
 *   node scripts/run_sql.js
 */

'use strict';

require('dotenv').config();
const mssql = require('mssql');

// ── Paste your SQL here ───────────────────────────────────────
//
// ⚠️  DESTRUCTIVE: deletes ALL students and ALL applications (every college)
//     and every row that hangs off them. Colleges, staff, roles, masters,
//     admission periods and fees master are KEPT. Take a DB backup first.
//
// Order matters: child rows are removed before their parents. The
// application_activity_log audit trigger blocks deletes, so it is disabled
// first and re-enabled at the end. (DISABLE TRIGGER references the trigger by
// its name on the table, so it works regardless of the table's schema.)
const SQL = `

-- ── 1. Disable the audit-log delete guard so its rows can be removed ──
DISABLE TRIGGER trg_activity_log_no_delete ON application_activity_log;
GO

-- ── 2. Delete application child rows (child-first) ──
DELETE FROM whatsapp_message_log      WHERE application_id IS NOT NULL;
DELETE FROM payment_link_tokens;
DELETE FROM fee_installments;
DELETE FROM payments;
DELETE FROM application_documents;
DELETE FROM application_previous_exam;
DELETE FROM application_subjects;
DELETE FROM application_activity_log;
GO

-- ── 3. Delete applications, then reset seat counts ──
DELETE FROM applications;
UPDATE admission_periods SET filled_seats = 0;
GO

-- ── 4. Delete student-owned data, then the students ──
DELETE FROM student_documents;
DELETE FROM otp_store;
DELETE FROM students;
GO

-- ── 5. Re-enable the audit-log delete guard ──
ENABLE TRIGGER trg_activity_log_no_delete ON application_activity_log;
GO

-- ── 6. Verify everything is gone (all counts should be 0) ──
SELECT
    (SELECT COUNT(*) FROM students)              AS students,
    (SELECT COUNT(*) FROM applications)          AS applications,
    (SELECT COUNT(*) FROM payments)              AS payments,
    (SELECT COUNT(*) FROM student_documents)     AS student_documents,
    (SELECT COUNT(*) FROM application_documents) AS application_documents,
    (SELECT COUNT(*) FROM application_activity_log) AS activity_log;

`

const config = {
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server:   process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port:     parseInt(process.env.DB_PORT) || 1433,
  options:  { encrypt: true, trustServerCertificate: true },
  pool:     { max: 1, min: 1 },
  requestTimeout:    120000,
  connectionTimeout: 15000,
};

function splitBatches(sql) {
  return sql
    .split(/^\s*GO\s*(?:--.*)?$/im)
    .map(b => b.trim())
    .filter(b => b.length > 0);
}

async function main() {
  let pool;
  try {
    pool = new mssql.ConnectionPool(config);
    await pool.connect();
    console.log(`[run_sql] Connected to: ${process.env.DB_NAME}\n`);
  } catch (err) {
    console.error('[run_sql] ✗ Connection failed:', err.message);
    process.exit(1);
  }

  const batches = splitBatches(SQL);
  console.log(`[run_sql] Running ${batches.length} batch(es)...\n`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`── Batch ${i + 1} ${'─'.repeat(50)}`);
    console.log(batch.slice(0, 300) + (batch.length > 300 ? '\n  ...' : ''));
    console.log('');

    try {
      const result = await pool.request().batch(batch);
      const rows = result.recordset;
      const affected = result.rowsAffected?.[0];

      if (rows && rows.length > 0) {
        console.table(rows);
      } else if (affected !== undefined) {
        console.log(`  ✓ ${affected} row(s) affected`);
      } else {
        console.log('  ✓ OK');
      }
    } catch (err) {
      console.error(`  ✗ Error: ${err.message}`);
      console.error(`  Number: ${err.number}`);
      await pool.close();
      process.exit(1);
    }

    console.log('');
  }

  console.log('[run_sql] ✓ Done.');
  await pool.close();
}

main();
