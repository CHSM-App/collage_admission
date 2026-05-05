/**
 * Adds application_fee column to colleges table.
 * Run once: node scripts/migrate_college_app_fee.js
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

  const check = await pool.request().query(`
    SELECT COUNT(*) AS cnt FROM sys.columns
    WHERE object_id = OBJECT_ID('colleges') AND name = 'application_fee'
  `);
  if (check.recordset[0].cnt > 0) {
    console.log('Column application_fee already exists on colleges — skipping.');
  } else {
    await pool.request().query(`ALTER TABLE colleges ADD application_fee DECIMAL(12,2) NULL`);
    console.log('Column application_fee added to colleges.');
  }

  await pool.close();
  console.log('Migration complete.');
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
