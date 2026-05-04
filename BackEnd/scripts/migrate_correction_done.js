/**
 * Adds 'correction_done' to the applications.status CHECK constraint.
 * Run once: node scripts/migrate_correction_done.js
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

  // Drop existing CHECK constraint on status
  const ccRes = await pool.request().query(`
    SELECT cc.name AS constraint_name
    FROM sys.check_constraints cc
    JOIN sys.columns col ON col.object_id = cc.parent_object_id AND col.column_id = cc.parent_column_id
    JOIN sys.tables t ON t.object_id = cc.parent_object_id
    WHERE t.name = 'applications' AND col.name = 'status'
  `);

  if (ccRes.recordset.length > 0) {
    const name = ccRes.recordset[0].constraint_name;
    console.log(`Dropping constraint: ${name}`);
    await pool.request().query(`ALTER TABLE applications DROP CONSTRAINT [${name}]`);
  } else {
    console.log('No existing CHECK constraint found — skipping drop.');
  }

  // Re-add with correction_done included
  console.log('Adding new CHECK constraint...');
  await pool.request().query(`
    ALTER TABLE applications
    ADD CONSTRAINT CK_applications_status
    CHECK (status IN (
      'draft','payment_pending','submitted','under_review',
      'correction_requested','correction_done',
      'scrutiny_accepted','doc_verification_pending','confirmed',
      'fees_paid','roll_assigned','enrolled',
      'rejected','cancelled'
    ))
  `);
  console.log('Done.');

  await pool.close();
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
