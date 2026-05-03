/**
 * add_fees_category_fields.js
 * Adds app_special_status, fees_category_override, fees_category_override_remark
 * to the applications table.
 * Run once: node scripts/add_fees_category_fields.js
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
    console.log(`Added column: ${col}`)
  } else {
    console.log(`Already exists: ${col}`)
  }
}

async function run() {
  const pool = await mssql.connect(cfg)
  await addColumn(pool, 'app_special_status',            'NVARCHAR(30) NULL')
  await addColumn(pool, 'fees_category_override',        'BIT NOT NULL DEFAULT 0')
  await addColumn(pool, 'fees_category_override_remark', 'NVARCHAR(300) NULL')
  console.log('Done.')
  await pool.close()
}

run().catch(err => { console.error(err); process.exit(1) })
