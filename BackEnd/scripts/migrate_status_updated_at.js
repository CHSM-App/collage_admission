/**
 * Adds status_updated_at column to applications table.
 * Run once: node scripts/migrate_status_updated_at.js
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

  const colCheck = await pool.request().query(`
    SELECT COUNT(*) AS cnt FROM sys.columns
    WHERE object_id = OBJECT_ID('applications') AND name = 'status_updated_at'
  `);

  if (colCheck.recordset[0].cnt > 0) {
    console.log('Column status_updated_at already exists — skipping.');
  } else {
    console.log('Adding status_updated_at column...');
    await pool.request().query(`
      ALTER TABLE applications ADD status_updated_at DATETIME NULL
    `);
    await pool.request().query(`
      UPDATE applications SET status_updated_at = submitted_at WHERE status_updated_at IS NULL
    `);
    console.log('Column added and back-filled.');
  }

  await pool.close();
  console.log('Migration complete.');
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
