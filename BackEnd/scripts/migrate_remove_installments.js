/**
 * Removes all installment plan infrastructure:
 *   1. Drops fee_installment_plans table (and its data)
 *   2. Removes installment_plan_id, installment_no columns from payments
 *   3. Updates payments CHECK constraint to only allow 'application_fee','college_fee'
 *   4. Deletes any college_fee_installment payment records (none expected in prod)
 *
 * Run once: node scripts/migrate_remove_installments.js
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

  // 1 — Drop CHECK constraint on payments.payment_type (if any)
  const ccRes = await pool.request().query(`
    SELECT cc.name AS constraint_name
    FROM sys.check_constraints cc
    JOIN sys.columns col ON col.object_id = cc.parent_object_id AND col.column_id = cc.parent_column_id
    JOIN sys.tables t ON t.object_id = cc.parent_object_id
    WHERE t.name = 'payments' AND col.name = 'payment_type'
  `);
  for (const row of ccRes.recordset) {
    console.log(`Dropping constraint: ${row.constraint_name}`);
    await pool.request().query(`ALTER TABLE payments DROP CONSTRAINT [${row.constraint_name}]`);
  }

  // 2 — Delete any college_fee_installment payment rows
  const del = await pool.request().query(`DELETE FROM payments WHERE payment_type = 'college_fee_installment'`);
  console.log(`Deleted ${del.rowsAffected[0]} college_fee_installment payment row(s).`);

  // 3 — Drop FK on payments.installment_plan_id if exists
  const fkRes = await pool.request().query(`
    SELECT fk.name FROM sys.foreign_keys fk
    JOIN sys.tables t ON t.object_id = fk.parent_object_id
    WHERE t.name = 'payments' AND fk.name LIKE '%installment%'
  `);
  for (const row of fkRes.recordset) {
    console.log(`Dropping FK: ${row.name}`);
    await pool.request().query(`ALTER TABLE payments DROP CONSTRAINT [${row.name}]`);
  }

  // 4 — Drop installment_plan_id and installment_no columns from payments (if they exist)
  for (const col of ['installment_plan_id', 'installment_no']) {
    const colCheck = await pool.request().query(`
      SELECT COUNT(*) AS cnt FROM sys.columns
      WHERE object_id = OBJECT_ID('payments') AND name = '${col}'
    `);
    if (colCheck.recordset[0].cnt > 0) {
      await pool.request().query(`ALTER TABLE payments DROP COLUMN ${col}`);
      console.log(`Dropped column payments.${col}.`);
    } else {
      console.log(`Column payments.${col} not found — skipping.`);
    }
  }

  // 5 — Drop fee_installment_plans table (if exists)
  const tblCheck = await pool.request().query(`
    SELECT COUNT(*) AS cnt FROM sys.tables WHERE name = 'fee_installment_plans'
  `);
  if (tblCheck.recordset[0].cnt > 0) {
    await pool.request().query(`DROP TABLE fee_installment_plans`);
    console.log('Dropped table fee_installment_plans.');
  } else {
    console.log('Table fee_installment_plans not found — skipping.');
  }

  // 6 — Re-add CHECK constraint: only application_fee and college_fee allowed
  await pool.request().query(`
    ALTER TABLE payments
    ADD CONSTRAINT CK_payments_payment_type
    CHECK (payment_type IN ('application_fee', 'college_fee'))
  `);
  console.log('Added CHECK constraint: application_fee, college_fee only.');

  await pool.close();
  console.log('Migration complete.');
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
