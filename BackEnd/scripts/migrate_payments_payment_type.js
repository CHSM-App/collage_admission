/**
 * migrate_payments_payment_type.js
 * Fixes the payments.payment_type column:
 *   1. Drops the existing CHECK constraint (only allows 'application_fee','college_fee')
 *   2. Widens the column from NVARCHAR(20) to NVARCHAR(30)
 *   3. Re-adds the CHECK constraint including 'college_fee_installment'
 *
 * Run once: node BackEnd/scripts/migrate_payments_payment_type.js
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

  // Step 1 — find the CHECK constraint on payments.payment_type
  const res = await pool.request().query(`
    SELECT cc.name AS constraint_name
    FROM sys.check_constraints cc
    JOIN sys.columns col
      ON col.object_id = cc.parent_object_id
     AND col.column_id = cc.parent_column_id
    JOIN sys.tables t
      ON t.object_id = cc.parent_object_id
    WHERE t.name = 'payments' AND col.name = 'payment_type'
  `);

  if (res.recordset.length === 0) {
    console.log('No CHECK constraint found on payments.payment_type — skipping drop.');
  } else {
    const constraintName = res.recordset[0].constraint_name;
    console.log(`Dropping constraint: ${constraintName}`);
    await pool.request().query(`ALTER TABLE payments DROP CONSTRAINT [${constraintName}]`);
    console.log('Old constraint dropped.');
  }

  // Step 2 — widen column to NVARCHAR(30)
  console.log('Widening payments.payment_type to NVARCHAR(30)...');
  await pool.request().query(`
    ALTER TABLE payments ALTER COLUMN payment_type NVARCHAR(30) NOT NULL
  `);
  console.log('Column widened.');

  // Step 3 — re-add CHECK constraint with all three valid values
  console.log('Adding new CHECK constraint...');
  await pool.request().query(`
    ALTER TABLE payments
    ADD CONSTRAINT CK_payments_payment_type
    CHECK (payment_type IN ('application_fee', 'college_fee', 'college_fee_installment'))
  `);
  console.log('New constraint added.');

  await pool.close();
  console.log('Migration complete.');
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
