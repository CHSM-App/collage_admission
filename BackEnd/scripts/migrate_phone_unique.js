/**
 * Migration: Add UNIQUE constraint on students.phone
 * Safe to re-run: checks for duplicates and existing constraint before applying.
 * Run: node scripts/migrate_phone_unique.js
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

  // Step 1: Check for duplicates
  const dupResult = await pool.request().query(`
    SELECT phone, COUNT(*) AS cnt
    FROM students
    WHERE phone IS NOT NULL
    GROUP BY phone
    HAVING COUNT(*) > 1
  `);

  if (dupResult.recordset.length > 0) {
    console.error('DUPLICATE PHONE NUMBERS FOUND — fix these before applying the constraint:');
    console.table(dupResult.recordset);
    process.exit(1);
  }

  console.log('No duplicate phone numbers found.');

  // Step 2: Check if constraint already exists
  const existsResult = await pool.request().query(`
    SELECT 1 AS found FROM sys.indexes
    WHERE object_id = OBJECT_ID('students') AND name = 'uq_students_phone'
  `);

  if (existsResult.recordset.length > 0) {
    console.log('Constraint uq_students_phone already exists — nothing to do.');
    await pool.close();
    return;
  }

  // Step 3: Add the constraint
  await pool.request().query(`
    ALTER TABLE students ADD CONSTRAINT uq_students_phone UNIQUE (phone)
  `);

  console.log('Constraint uq_students_phone added successfully.');
  await pool.close();
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
