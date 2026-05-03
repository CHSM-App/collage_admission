/**
 * fix_admission_period_fk.js
 * Drops the FK constraint on admission_periods.course_id that references
 * the old courses table. faculty_master is now the source of truth.
 * Run once: node scripts/fix_admission_period_fk.js
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

  // Tables whose course_id FK points to old courses table — drop them all
  const targets = [
    { table: 'admission_periods', column: 'course_id' },
    { table: 'applications',      column: 'course_id' },
    { table: 'fee_structures',    column: 'course_id' },
    { table: 'required_documents',column: 'course_id' },
    { table: 'subjects',          column: 'course_id' },
  ]

  for (const target of targets) {
    const fkRes = await pool.request().query(`
      SELECT fk.name AS fk_name
      FROM sys.foreign_keys fk
      JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
      JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
      JOIN sys.tables t ON t.object_id = fk.parent_object_id
      JOIN sys.tables rt ON rt.object_id = fk.referenced_object_id
      WHERE t.name  = '${target.table}'
        AND c.name  = '${target.column}'
        AND rt.name = 'courses'
    `)

    if (!fkRes.recordset.length) {
      console.log(`No FK found on ${target.table}.${target.column} → courses. Skipping.`)
      continue
    }

    for (const row of fkRes.recordset) {
      await pool.request().query(
        `ALTER TABLE ${target.table} DROP CONSTRAINT ${row.fk_name}`
      )
      console.log(`Dropped FK: ${row.fk_name} on ${target.table}.${target.column}`)
    }
  }

  console.log('Done. All course_id FKs pointing to courses table have been removed.')
  await pool.close()
}

run().catch(err => { console.error(err); process.exit(1) })
