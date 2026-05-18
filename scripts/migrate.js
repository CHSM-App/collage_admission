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

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

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
    console.log('[migrate] All migrations are already applied. Nothing to do.');
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

  // Post-step: create admission_periods triggers.
  // These cannot live in a .sql file because MSSQL validates the target table
  // at parse time even inside sp_executesql — error 8197. We issue them as
  // plain query() calls from Node so they compile only at execution time.
  try {
    await applyTriggers(pool);
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

async function applyTriggers(pool) {
  // Check the table exists before attempting trigger DDL
  const chk = await pool.request().query(
    `SELECT 1 AS found FROM sys.tables WHERE name = 'admission_periods' AND schema_id = SCHEMA_ID('dbo')`
  );
  if (!chk.recordset.length) {
    console.log('  Triggers skipped (admission_periods table not found)');
    return;
  }

  const triggers = [
    {
      name: 'trg_admission_periods_arc_ins',
      action: 'INSERT',
      source: 'inserted i',
      alias: 'i',
    },
    {
      name: 'trg_admission_periods_arc_upd',
      action: 'UPDATE',
      source: 'inserted i',
      alias: 'i',
    },
    {
      name: 'trg_admission_periods_arc_del',
      action: 'DELETE',
      source: 'deleted d',
      alias: 'd',
    },
  ];

  for (const t of triggers) {
    // Drop via sys.triggers check — avoids touching the table directly
    await pool.request().query(`
      IF EXISTS (SELECT 1 FROM sys.triggers WHERE name = '${t.name}')
        EXEC('DROP TRIGGER [dbo].[${t.name}]')
    `);

    // CREATE TRIGGER must be the only statement — use EXEC to defer compilation
    await pool.request().query(`
      EXEC('
        CREATE TRIGGER [dbo].[${t.name}]
        ON [dbo].[admission_periods]
        AFTER ${t.action}
        AS
        BEGIN
          SET NOCOUNT ON;
          BEGIN TRY
            INSERT INTO [dbo].[admission_periods$Arc] (
              id, college_id, course_id, year_of_study, academic_year,
              start_date, end_date, total_seats, filled_seats,
              is_active, is_disabled, created_at,
              action_type, action_by, machine_mac_address, comments
            )
            SELECT
              ${t.alias}.id, ${t.alias}.college_id, ${t.alias}.course_id,
              ${t.alias}.year_of_study, ${t.alias}.academic_year,
              ${t.alias}.start_date, ${t.alias}.end_date,
              ${t.alias}.total_seats, ${t.alias}.filled_seats,
              ${t.alias}.is_active, ${t.alias}.is_disabled, ${t.alias}.created_at,
              ''${t.action}'',
              CONVERT(NVARCHAR(150), SESSION_CONTEXT(N''app_user_id'')),
              CONVERT(NVARCHAR(50),  SESSION_CONTEXT(N''app_machine_mac'')),
              CONVERT(NVARCHAR(500), SESSION_CONTEXT(N''app_comments''))
            FROM ${t.source};
          END TRY
          BEGIN CATCH
          END CATCH
        END
      ')
    `);
  }
  console.log('  Triggers applied                              ✓ done');
}

main();
