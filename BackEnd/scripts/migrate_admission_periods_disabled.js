/**
 * migrate_admission_periods_disabled.js
 * Adds is_disabled BIT column to admission_periods table.
 *
 * Run once: node BackEnd/scripts/migrate_admission_periods_disabled.js
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

  // Check if column already exists
  const check = await pool.request().query(`
    SELECT COUNT(*) AS cnt
    FROM sys.columns
    WHERE object_id = OBJECT_ID('admission_periods') AND name = 'is_disabled'
  `);

  if (check.recordset[0].cnt > 0) {
    console.log('Column is_disabled already exists — skipping.');
  } else {
    console.log('Adding is_disabled column...');
    await pool.request().query(`
      ALTER TABLE admission_periods
      ADD is_disabled BIT NOT NULL DEFAULT 0
    `);
    console.log('Column added.');
  }

  await pool.close();
  console.log('Migration complete.');
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
