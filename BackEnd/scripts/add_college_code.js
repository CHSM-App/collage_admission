/**
 * add_college_code.js
 * Adds college_code column to colleges table and backfills existing rows.
 * Run once: node scripts/add_college_code.js
 */
require('dotenv').config()
const mssql = require('mssql')

const cfg = {
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER, database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT, 10),
  options: { encrypt: true, trustServerCertificate: true },
}

async function run() {
  const pool = await mssql.connect(cfg)

  // 1. Add column if not exists
  const col = await pool.request().query(
    `SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('colleges') AND name='college_code'`
  )
  if (!col.recordset.length) {
    await pool.request().query(
      `ALTER TABLE colleges ADD college_code NVARCHAR(20) NULL`
    )
    console.log('Added college_code column.')
  } else {
    console.log('college_code column already exists.')
  }

  // 2. Backfill FIRST — must have no NULLs before adding unique constraint
  const existing = await pool.request().query(
    `SELECT id FROM colleges WHERE college_code IS NULL ORDER BY id`
  )
  for (const row of existing.recordset) {
    const code = `CL${String(row.id).padStart(3, '0')}`
    await pool.request()
      .input('code', mssql.NVarChar, code)
      .input('id',   mssql.Int,      row.id)
      .query(`UPDATE colleges SET college_code=@code WHERE id=@id`)
    console.log(`Backfilled id=${row.id} → ${code}`)
  }

  // 3. Add unique constraint only after all rows are filled
  const uc = await pool.request().query(
    `SELECT 1 FROM sys.indexes WHERE name='UQ_colleges_college_code'`
  )
  if (!uc.recordset.length) {
    await pool.request().query(
      `ALTER TABLE colleges ADD CONSTRAINT UQ_colleges_college_code UNIQUE (college_code)`
    )
    console.log('Added unique constraint on college_code.')
  } else {
    console.log('Unique constraint already exists.')
  }

  console.log('Done.')
  await pool.close()
}

run().catch(err => { console.error(err); process.exit(1) })
