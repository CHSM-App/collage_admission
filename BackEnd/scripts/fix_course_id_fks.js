/**
 * fix_course_id_fks.js
 *
 * After the courses → faculty_master refactor, admission_periods.course_id and
 * applications.course_id still carry FKs to courses(id). The app now writes
 * faculty_master.code_no values into those columns, so inserts fail with
 * FK violations (e.g. FK__admission__cours__*, FK__applicati__cours__*).
 *
 * This script drops the stale FKs and re-points them at faculty_master(code_no).
 * Constraint names are auto-generated, so they're looked up dynamically.
 *
 * Usage:
 *   node scripts/fix_course_id_fks.js          # dry-run on orphans, abort if any
 *   node scripts/fix_course_id_fks.js --clean  # delete orphan rows then add FKs
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const mssql = require('mssql')

const CLEAN = process.argv.includes('--clean')

const cfg = {
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER, database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT),
  options: { encrypt: true, trustServerCertificate: true },
}

async function dropFkOn(pool, table, column) {
  const r = await pool.request()
    .input('tbl', table)
    .input('col', column)
    .query(`
      SELECT fk.name AS fk_name
      FROM sys.foreign_keys fk
      JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
      JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
      WHERE OBJECT_NAME(fk.parent_object_id) = @tbl AND c.name = @col
    `)
  for (const row of r.recordset) {
    await pool.request().query(`ALTER TABLE ${table} DROP CONSTRAINT ${row.fk_name}`)
    console.log(`  Dropped FK ${row.fk_name} on ${table}.${column}`)
  }
  if (!r.recordset.length) console.log(`  No FK on ${table}.${column} (already dropped).`)
}

async function findOrphans(pool, table, column) {
  const r = await pool.request().query(`
    SELECT t.id, t.${column} AS bad_value
    FROM ${table} t
    LEFT JOIN faculty_master fm ON fm.code_no = t.${column}
    WHERE fm.code_no IS NULL
  `)
  return r.recordset
}

async function deleteOrphans(pool, table, column) {
  const r = await pool.request().query(`
    DELETE FROM ${table}
    WHERE ${column} NOT IN (SELECT code_no FROM faculty_master)
  `)
  console.log(`  Deleted ${r.rowsAffected[0]} orphan row(s) from ${table}.`)
}

async function addFkToFaculty(pool, table, column, fkName) {
  const exists = await pool.request()
    .input('n', fkName)
    .query(`SELECT 1 FROM sys.foreign_keys WHERE name = @n`)
  if (exists.recordset.length) {
    console.log(`  FK ${fkName} already exists, skipping.`)
    return
  }
  await pool.request().query(`
    ALTER TABLE ${table}
    ADD CONSTRAINT ${fkName}
    FOREIGN KEY (${column}) REFERENCES faculty_master(code_no)
  `)
  console.log(`  Added FK ${fkName} on ${table}.${column} -> faculty_master(code_no)`)
}

async function processTable(pool, table, column, fkName) {
  console.log(`\n${table}.${column}`)
  await dropFkOn(pool, table, column)

  const orphans = await findOrphans(pool, table, column)
  if (orphans.length) {
    console.log(`  Found ${orphans.length} orphan row(s) (course_id not in faculty_master.code_no):`)
    for (const o of orphans.slice(0, 10)) console.log(`    id=${o.id}  bad course_id=${o.bad_value}`)
    if (orphans.length > 10) console.log(`    ... and ${orphans.length - 10} more`)

    if (!CLEAN) {
      console.log(`\n  Re-run with --clean to DELETE these rows and add the FK.`)
      console.log(`  (Aborting before adding FK on ${table}.)`)
      return false
    }
    await deleteOrphans(pool, table, column)
  }

  await addFkToFaculty(pool, table, column, fkName)
  return true
}

async function run() {
  const pool = await mssql.connect(cfg)
  console.log('Connected to DB.', CLEAN ? '(--clean: orphan rows will be deleted)' : '(dry-run: orphan rows will be reported only)')

  const ok1 = await processTable(pool, 'admission_periods', 'course_id', 'fk_admission_periods_faculty')
  const ok2 = await processTable(pool, 'applications',      'course_id', 'fk_applications_faculty')

  console.log('\n' + (ok1 && ok2 ? 'Done.' : 'Finished with issues — see above.'))
  await pool.close()
}

run().catch(err => { console.error(err); process.exit(1) })
