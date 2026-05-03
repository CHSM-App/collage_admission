/**
 * add_division_fields.js
 * Adds app_division and app_degree_course_code to the applications table.
 * Run once: node scripts/add_division_fields.js
 */
require('dotenv').config()
const mssql = require('mssql')

const cfg = {
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER, database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT),
  options: { encrypt: true, trustServerCertificate: true },
}

async function addColumn(pool, col, def) {
  const exists = await pool.request().query(
    `SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('applications') AND name='${col}'`
  )
  if (!exists.recordset.length) {
    await pool.request().query(`ALTER TABLE applications ADD ${col} ${def}`)
    console.log(`Added: ${col}`)
  } else {
    console.log(`Already exists: ${col}`)
  }
}

async function run() {
  const pool = await mssql.connect(cfg)
  await addColumn(pool, 'app_division',           'CHAR(1) NULL')
  await addColumn(pool, 'app_degree_course_code', 'NVARCHAR(30) NULL')
  console.log('Done.')
  await pool.close()
}

run().catch(err => { console.error(err); process.exit(1) })
