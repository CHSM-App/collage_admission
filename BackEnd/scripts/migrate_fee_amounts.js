/**
 * Adds fee_total_amount and fee_pay_now_amount columns to applications table.
 * fee_total_amount  — total fee the student must pay (set by college at confirmation)
 * fee_pay_now_amount — amount due now; can be less than total (college allows partial/installment)
 * Run once: node scripts/migrate_fee_amounts.js
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

async function addColumn(pool, colName) {
  const check = await pool.request().query(`
    SELECT COUNT(*) AS cnt FROM sys.columns
    WHERE object_id = OBJECT_ID('applications') AND name = '${colName}'
  `);
  if (check.recordset[0].cnt > 0) {
    console.log(`Column ${colName} already exists — skipping.`);
  } else {
    await pool.request().query(`ALTER TABLE applications ADD ${colName} DECIMAL(12,2) NULL`);
    console.log(`Column ${colName} added.`);
  }
}

async function run() {
  const pool = await sql.connect(config);
  await addColumn(pool, 'fee_total_amount');
  await addColumn(pool, 'fee_pay_now_amount');
  await pool.close();
  console.log('Migration complete.');
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
