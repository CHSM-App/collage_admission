/**
 * migrate_faculty_master_extended_duration.js
 * Adds extended semester and year code columns to faculty_master so the
 * Program Master form can support 4-year (8 sem / 4 year codes) and
 * 5-year (10 sem / 5 year codes) degree programs.
 *
 * Adds (all NVARCHAR(20) NULL):
 *   unique_code_sem7, unique_code_sem8, unique_code_sem9, unique_code_sem10
 *   exam_seat_code_year4, exam_seat_code_year5
 *
 * Run once: node BackEnd/scripts/migrate_faculty_master_extended_duration.js
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

const NEW_COLS = [
  'unique_code_sem7',
  'unique_code_sem8',
  'unique_code_sem9',
  'unique_code_sem10',
  'exam_seat_code_year4',
  'exam_seat_code_year5',
];

async function run() {
  const pool = await sql.connect(config);

  for (const col of NEW_COLS) {
    const check = await pool.request().query(`
      SELECT COUNT(*) AS cnt
      FROM sys.columns
      WHERE object_id = OBJECT_ID('faculty_master') AND name = '${col}'
    `);
    if (check.recordset[0].cnt > 0) {
      console.log(`Column ${col} already exists — skipping.`);
    } else {
      console.log(`Adding ${col}...`);
      await pool.request().query(`
        ALTER TABLE faculty_master ADD ${col} NVARCHAR(20) NULL
      `);
      console.log(`  added.`);
    }
  }

  await pool.close();
  console.log('Migration complete.');
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});