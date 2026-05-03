/**
 * add_unique_draft_index.js
 * Adds a filtered unique index so only one draft can exist per
 * (student, college, course, year, academic_year) at a time.
 * Run once: node scripts/add_unique_draft_index.js
 */

require('dotenv').config()
const mssql = require('mssql')

const cfg = {
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server:   process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port:     parseInt(process.env.DB_PORT),
  options:  { encrypt: true, trustServerCertificate: true },
}

async function run() {
  const pool = await mssql.connect(cfg)

  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = 'uix_applications_one_draft_per_slot'
    )
    CREATE UNIQUE INDEX uix_applications_one_draft_per_slot
      ON applications (student_id, college_id, course_id, year_of_study, academic_year)
      WHERE status = 'draft'
  `)

  console.log('Index created (or already existed).')
  await pool.close()
}

run().catch(err => { console.error(err); process.exit(1) })
