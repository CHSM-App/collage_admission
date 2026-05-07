/**
 * Migration: Rebuild application_subjects for code-based subject selection.
 *
 * Changes:
 *  - Drop old application_subjects (had subject_id FK to legacy subjects table)
 *  - Create new application_subjects with (application_id, semester, subject_code, subject_title)
 *  - Add UNIQUE constraint on (application_id, semester, subject_code)
 *
 * Safe to re-run: checks if new schema already exists.
 * Run: node scripts/migrate_application_subjects_v2.js
 */

require('dotenv').config();
const sql = require('mssql');

const config = {
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server:   process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port:     parseInt(process.env.DB_PORT),
  options:  { encrypt: true, trustServerCertificate: true },
};

async function run() {
  const pool = await sql.connect(config);

  // Check if new schema already applied (subject_code column exists)
  const colCheck = await pool.request().query(`
    SELECT 1 AS found FROM sys.columns
    WHERE object_id = OBJECT_ID('application_subjects')
      AND name = 'subject_code'
  `);

  if (colCheck.recordset.length > 0) {
    console.log('application_subjects already has subject_code column — nothing to do.');
    await pool.close();
    return;
  }

  console.log('Dropping old application_subjects and recreating with new schema...');

  // Drop old table (FK constraints dropped automatically in MSSQL if we drop the table)
  await pool.request().query(`DROP TABLE IF EXISTS application_subjects`);

  // Create new table
  await pool.request().query(`
    CREATE TABLE application_subjects (
      id               INT IDENTITY(1,1) PRIMARY KEY,
      application_id   INT            NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      semester         INT            NOT NULL,   -- 1 or 2
      subject_code     NVARCHAR(30)   NOT NULL,
      subject_title    NVARCHAR(200)  NOT NULL,
      display_order    INT            NOT NULL DEFAULT 0,
      created_at       DATETIME2      NOT NULL DEFAULT GETDATE(),
      CONSTRAINT uq_app_subject UNIQUE (application_id, semester, subject_code)
    )
  `);

  console.log('application_subjects recreated successfully with new schema.');
  await pool.close();
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
