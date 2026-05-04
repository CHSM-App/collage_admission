/**
 * migrate_correction_requested.js
 * Adds correction_note column to applications table and widens the status CHECK constraint
 * to include 'correction_requested'.
 *
 * Run once: node BackEnd/scripts/migrate_correction_requested.js
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

  // 1. Add correction_note column if not exists
  const colCheck = await pool.request().query(`
    SELECT COUNT(*) AS cnt FROM sys.columns
    WHERE object_id = OBJECT_ID('applications') AND name = 'correction_note'
  `);
  if (colCheck.recordset[0].cnt > 0) {
    console.log('Column correction_note already exists — skipping.');
  } else {
    console.log('Adding correction_note column...');
    await pool.request().query(`
      ALTER TABLE applications ADD correction_note NVARCHAR(1000) NULL
    `);
    console.log('Column added.');
  }

  // 2. Drop existing CHECK constraint on status
  const ccRes = await pool.request().query(`
    SELECT cc.name AS constraint_name
    FROM sys.check_constraints cc
    JOIN sys.columns col ON col.object_id = cc.parent_object_id AND col.column_id = cc.parent_column_id
    JOIN sys.tables t ON t.object_id = cc.parent_object_id
    WHERE t.name = 'applications' AND col.name = 'status'
  `);
  if (ccRes.recordset.length === 0) {
    console.log('No CHECK constraint found on applications.status — skipping drop.');
  } else {
    const name = ccRes.recordset[0].constraint_name;
    console.log(`Dropping constraint: ${name}`);
    await pool.request().query(`ALTER TABLE applications DROP CONSTRAINT [${name}]`);
    console.log('Old constraint dropped.');
  }

  // 3. Re-add with correction_requested included
  console.log('Adding new CHECK constraint on applications.status...');
  await pool.request().query(`
    ALTER TABLE applications
    ADD CONSTRAINT CK_applications_status
    CHECK (status IN (
      'draft','payment_pending','submitted','under_review',
      'correction_requested',
      'scrutiny_accepted','doc_verification_pending','confirmed',
      'fees_paid','roll_assigned','enrolled',
      'rejected','cancelled'
    ))
  `);
  console.log('New constraint added.');

  await pool.close();
  console.log('Migration complete.');
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
