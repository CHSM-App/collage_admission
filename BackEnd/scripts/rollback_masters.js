/**
 * rollback_masters.js
 * ─────────────────────────────────────────────────────────────
 * Reverses migrate_masters.js:
 *   - Drops new master tables (in reverse FK order)
 *   - Restores courses and subjects from backup tables
 *
 * Run: node scripts/rollback_masters.js
 */

require('dotenv').config()
const mssql = require('mssql')

const cfg = {
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER, database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT),
  options: { encrypt: true, trustServerCertificate: true },
}

async function tableExists(pool, table) {
  const r = await pool.request().query(
    `SELECT 1 FROM sys.tables WHERE name='${table}'`
  )
  return r.recordset.length > 0
}

async function dropIfExists(pool, table) {
  if (await tableExists(pool, table)) {
    await pool.request().query(`DROP TABLE ${table}`)
    console.log(`  Dropped: ${table}`)
  } else {
    console.log(`  Not found (skip): ${table}`)
  }
}

async function run() {
  const pool = await mssql.connect(cfg)
  console.log('Connected. Starting rollback...\n')

  // Drop in reverse FK dependency order
  await dropIfExists(pool, 'fee_override_audit')
  await dropIfExists(pool, 'classwise_fees')
  await dropIfExists(pool, 'fees_master')
  await dropIfExists(pool, 'division_master')
  await dropIfExists(pool, 'group_courses')
  await dropIfExists(pool, 'group_master')
  await dropIfExists(pool, 'course_master')
  await dropIfExists(pool, 'bank_master')
  await dropIfExists(pool, 'faculty_master')

  // Restore subjects from backup
  if (await tableExists(pool, 'subjects_backup')) {
    if (await tableExists(pool, 'subjects')) {
      console.log('  subjects table exists — truncating before restore.')
      await pool.request().query(`DELETE FROM subjects`)
    }
    await pool.request().query(`INSERT INTO subjects SELECT * FROM subjects_backup`)
    await pool.request().query(`DROP TABLE subjects_backup`)
    console.log('  subjects restored from subjects_backup.')
  }

  // Restore courses from backup
  if (await tableExists(pool, 'courses_backup')) {
    if (await tableExists(pool, 'courses')) {
      console.log('  courses table exists — truncating before restore.')
      await pool.request().query(`DELETE FROM courses`)
    }
    await pool.request().query(`INSERT INTO courses SELECT * FROM courses_backup`)
    await pool.request().query(`DROP TABLE courses_backup`)
    console.log('  courses restored from courses_backup.')
  }

  console.log('\n✓ Rollback complete.')
  await pool.close()
}

run().catch(err => { console.error(err); process.exit(1) })
