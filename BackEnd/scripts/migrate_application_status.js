/**
 * migrate_application_status.js
 * Drops the old status CHECK constraint on applications and recreates it
 * with the new statuses: scrutiny_accepted, doc_verification_pending.
 * Run once: node BackEnd/scripts/migrate_application_status.js
 */
require('dotenv').config();
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT),
  options: { encrypt: true, trustServerCertificate: true }
};

async function run() {
  const pool = await sql.connect(config);

  // Find the name of the CHECK constraint on applications.status
  const res = await pool.request().query(`
    SELECT cc.name AS constraint_name
    FROM sys.check_constraints cc
    JOIN sys.columns col ON col.object_id = cc.parent_object_id AND col.column_id = cc.parent_column_id
    JOIN sys.tables t ON t.object_id = cc.parent_object_id
    WHERE t.name = 'applications' AND col.name = 'status'
  `);

  if (res.recordset.length === 0) {
    console.log('No CHECK constraint found on applications.status — skipping drop.');
  } else {
    const constraintName = res.recordset[0].constraint_name;
    console.log(`Dropping constraint: ${constraintName}`);
    await pool.request().query(`ALTER TABLE applications DROP CONSTRAINT [${constraintName}]`);
    console.log('Old constraint dropped.');
  }

  // Add new CHECK constraint with all valid statuses
  await pool.request().query(`
    ALTER TABLE applications
    ADD CONSTRAINT CK_applications_status CHECK (
      status IN (
        'draft',
        'payment_pending',
        'submitted',
        'under_review',
        'scrutiny_accepted',
        'doc_verification_pending',
        'confirmed',
        'fees_paid',
        'roll_assigned',
        'enrolled',
        'rejected',
        'cancelled'
      )
    )
  `);
  console.log('New status CHECK constraint added.');

  await pool.close();
  console.log('Done.');
}

run().catch(e => { console.error(e); process.exit(1) });
