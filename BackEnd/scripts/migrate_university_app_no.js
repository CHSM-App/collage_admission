/**
 * migrate_university_app_no.js
 * Adds app_university_app_no NVARCHAR(50) column to applications table.
 *
 * Run once: node BackEnd/scripts/migrate_university_app_no.js
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
    SELECT COUNT(*) AS cnt
    FROM sys.columns
    WHERE object_id = OBJECT_ID('applications') AND name = 'app_university_app_no'
  `);

  if (check.recordset[0].cnt > 0) {
    console.log('Column app_university_app_no already exists — skipping.');
  } else {
    console.log('Adding app_university_app_no column...');
    await pool.request().query(`
      ALTER TABLE applications
      ADD app_university_app_no NVARCHAR(50) NULL
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
