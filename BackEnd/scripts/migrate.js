/**
 * migrate.js — Database migration runner
 *
 * Usage:
 *   node scripts/migrate.js            — apply all pending migrations
 *   node scripts/migrate.js --status   — show applied / pending status, no SQL run
 *
 * How it works:
 *   1. Opens a single dedicated MSSQL connection (not a pool).
 *   2. Creates a `schema_migrations` table if it doesn't exist.
 *   3. Reads all *.sql files from scripts/migrations/ sorted by filename.
 *   4. Skips files already recorded in schema_migrations.
 *   5. Runs each pending file's batches (split on GO) sequentially on the
 *      same connection so DDL from earlier batches is visible to later ones.
 *   6. Stops on the first failure and reports the error.
 */

'use strict';

require('dotenv').config();
const mssql = require('mssql');
const fs    = require('fs');
const path  = require('path');

// ── Config ────────────────────────────────────────────────────
const config = {
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server:   process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port:     parseInt(process.env.DB_PORT) || 1433,
  options:  { encrypt: true, trustServerCertificate: true },
  pool:     { max: 1, min: 1 },          // single connection — DDL visibility
  requestTimeout:    60000,
  connectionTimeout: 15000,
};

const MIGRATIONS_DIR      = path.join(__dirname, 'migrations');
const AUDIT_TRIGGERS_FILE = path.join(__dirname, 'create_audit_triggers.sql');

// ── Helpers ───────────────────────────────────────────────────

/** Split a SQL file on GO batch separators (case-insensitive, own line). */
function splitBatches(sql) {
  return sql
    .split(/^\s*GO\s*(?:--.*)?$/im)
    .map(b => b.trim())
    .filter(b => b.length > 0);
}

function pad(str, len) {
  return String(str).padEnd(len, ' ');
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  const statusOnly = process.argv.includes('--status');

  // 1. Connect — single connection so all DDL is visible across batches
  let pool;
  try {
    pool = new mssql.ConnectionPool(config);
    await pool.connect();
    console.log('[migrate] Connected to database:', process.env.DB_NAME);
  } catch (err) {
    console.error('[migrate] ✗ Could not connect to database:', err.message);
    process.exit(1);
  }

  // 2. Ensure schema_migrations table exists
  await pool.request().query(`
    IF OBJECT_ID('schema_migrations', 'U') IS NULL
    CREATE TABLE schema_migrations (
      id          INT IDENTITY(1,1) PRIMARY KEY,
      filename    NVARCHAR(200) NOT NULL UNIQUE,
      applied_at  DATETIME2     NOT NULL DEFAULT GETDATE()
    )
  `);

  // 3. Load applied migrations
  const appliedResult = await pool.request().query(
    `SELECT filename FROM schema_migrations ORDER BY filename`
  );
  const applied = new Set(appliedResult.recordset.map(r => r.filename));

  // 4. Read migration files
  let files;
  try {
    files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();
  } catch (err) {
    console.error('[migrate] ✗ Cannot read migrations directory:', err.message);
    await pool.close();
    process.exit(1);
  }

  if (files.length === 0) {
    console.log('[migrate] No migration files found in', MIGRATIONS_DIR);
    await pool.close();
    return;
  }

  // 5. Status mode
  if (statusOnly) {
    console.log('\n  Migration Status\n  ' + '─'.repeat(60));
    console.log('  ' + pad('File', 45) + pad('Status', 10));
    console.log('  ' + '─'.repeat(60));
    for (const f of files) {
      const status = applied.has(f) ? '✓ applied' : '○ pending';
      console.log('  ' + pad(f, 45) + status);
    }
    console.log('  ' + '─'.repeat(60));
    const pending = files.filter(f => !applied.has(f));
    console.log(`\n  ${applied.size} applied, ${pending.length} pending.\n`);
    await pool.close();
    return;
  }

  // 6. Apply pending migrations
  const pending = files.filter(f => !applied.has(f));

  if (pending.length === 0) {
    console.log('[migrate] All migrations already applied. Re-applying triggers.\n');
    try {
      await applyAuditTriggers(pool);
    } catch (err) {
      console.error('\n[migrate] ✗ Failed to apply triggers:');
      console.error('  Message:', err.message);
      console.error('  Number: ', err.number);
      await pool.close();
      process.exit(1);
    }
    await pool.close();
    return;
  }

  console.log(`[migrate] ${pending.length} pending migration(s) to apply.\n`);

  for (const filename of pending) {
    const filepath = path.join(MIGRATIONS_DIR, filename);
    const sql = fs.readFileSync(filepath, 'utf8');
    const batches = splitBatches(sql);

    process.stdout.write(`  Running ${filename} ... `);

    let currentBatch = '';
    try {
      for (const batch of batches) {
        currentBatch = batch;
        await pool.request().batch(batch);
      }

      await pool.request()
        .input('filename', mssql.NVarChar, filename)
        .query(`INSERT INTO schema_migrations (filename) VALUES (@filename)`);

      console.log('✓ done');
    } catch (err) {
      console.log('✗ FAILED');
      console.error('\n[migrate] Error in', filename + ':');
      console.error('  Message:', err.message);
      console.error('  Number: ', err.number);
      console.error('  Batch:  ', currentBatch.slice(0, 300));
      console.error('\n[migrate] Stopping. Fix the error above and re-run.');
      await pool.close();
      process.exit(1);
    }
  }

  // Post-step: re-create all 66 audit triggers.
  try {
    await applyAuditTriggers(pool);
  } catch (err) {
    console.error('\n[migrate] ✗ Failed to apply triggers:');
    console.error('  Message:', err.message);
    console.error('  Number: ', err.number);
    await pool.close();
    process.exit(1);
  }

  console.log(`\n[migrate] ✓ ${pending.length} migration(s) applied successfully.`);
  await pool.close();
}

// ── Audit triggers ────────────────────────────────────────────
// Reads create_audit_triggers.sql and runs it batch-by-batch.
// The file uses DROP-then-CREATE so it is safe to re-run (idempotent).
// Must be executed by a DB user with ALTER permission on each audited table
// (i.e. sa / db_owner in SSMS, or the app user after GRANT ALTER is run).
async function applyAuditTriggers(pool) {
  if (!fs.existsSync(AUDIT_TRIGGERS_FILE)) {
    console.log('  Audit triggers skipped (create_audit_triggers.sql not found)');
    return;
  }

  // Skip if $Arc tables haven't been created yet (migration 011 not applied)
  const arcCheck = await pool.request().query(
    `SELECT OBJECT_ID('admission_periods$Arc', 'U') AS oid`
  );
  if (!arcCheck.recordset[0].oid) {
    console.log('  Audit triggers skipped ($Arc tables not found — run migration 011 first)');
    return;
  }

  const sql     = fs.readFileSync(AUDIT_TRIGGERS_FILE, 'utf8');
  const batches = splitBatches(sql);

  // Pair each DROP batch with the following CREATE batch and run them together
  // using EXEC(N'...') so CREATE TRIGGER is the first statement in its own
  // dynamic-SQL batch, while the DROP runs in the outer batch first.
  let batchNo = 0;
  let i = 0;
  while (i < batches.length) {
    const batch = batches[i];
    batchNo++;

    // Skip USE and comment-only batches
    if (/^\s*USE\s+\w+\s*;?\s*$/i.test(batch)) { i++; continue; }
    if (/^[\s\-]+$/.test(batch))                  { i++; continue; }

    // If this batch is a DROP and the next is a CREATE TRIGGER, combine them:
    // run DROP then EXEC the CREATE so CREATE is first in its own inner batch.
    const isDropBatch   = /DROP TRIGGER/i.test(batch) && !/CREATE TRIGGER/i.test(batch);
    const nextBatch     = batches[i + 1];
    const nextIsCreate  = nextBatch && /^\s*CREATE TRIGGER/i.test(nextBatch);

    if (isDropBatch && nextIsCreate) {
      // Extract trigger name from the CREATE batch
      const nameMatch = nextBatch.match(/CREATE\s+TRIGGER\s+(\w+)/i);
      const trigName  = nameMatch ? nameMatch[1] : null;

      // Step 1: drop using sys.objects (works on Azure SQL where OBJECT_ID type 'TR' returns NULL)
      if (trigName) {
        const dropSql = `
          IF EXISTS (SELECT 1 FROM sys.objects WHERE name = '${trigName}' AND type = 'TR')
            DROP TRIGGER dbo.${trigName};`;
        try {
          await pool.request().batch(dropSql);
        } catch (dropErr) {
          // ignore "does not exist" errors
        }
      }

      // Step 2: CREATE TRIGGER must be the only statement — run it as its own batch
      const escaped  = nextBatch.replace(/'/g, "''");
      const execSql  = `EXEC(N'${escaped}')`;
      try {
        await pool.request().batch(execSql);
      } catch (err) {
        throw new Error(
          `Audit trigger batch ${batchNo} failed: ${err.message}\n` +
          `  (batch: ${nextBatch.slice(0, 200)})`
        );
      }
      i += 2; // consumed both DROP and CREATE batches
    } else {
      try {
        await pool.request().batch(batch);
      } catch (err) {
        throw new Error(
          `Audit trigger batch ${batchNo} failed: ${err.message}\n` +
          `  (batch: ${batch.slice(0, 200)})`
        );
      }
      i++;
    }
  }

  console.log('  Audit triggers (66)                           ✓ done');
}

main();
