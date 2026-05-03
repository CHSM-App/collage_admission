/**
 * fix_duplicate_drafts.js
 * Finds duplicate draft applications (same student+college+course+year+academic_year)
 * and deletes all but the newest one.
 * Run once: node scripts/fix_duplicate_drafts.js
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

  // Find all groups with more than one draft
  const dupes = await pool.request().query(`
    SELECT student_id, college_id, course_id, year_of_study, academic_year,
           COUNT(*) AS cnt
    FROM applications
    WHERE status = 'draft'
    GROUP BY student_id, college_id, course_id, year_of_study, academic_year
    HAVING COUNT(*) > 1
  `)

  if (dupes.recordset.length === 0) {
    console.log('No duplicate drafts found.')
    await pool.close()
    return
  }

  console.log(`Found ${dupes.recordset.length} duplicate group(s). Cleaning up...`)

  for (const row of dupes.recordset) {
    // Get all drafts in this group ordered newest first
    const drafts = await pool.request()
      .input('sid', mssql.Int,      row.student_id)
      .input('col', mssql.Int,      row.college_id)
      .input('crs', mssql.Int,      row.course_id)
      .input('yr',  mssql.Int,      row.year_of_study)
      .input('ay',  mssql.NVarChar, row.academic_year)
      .query(`
        SELECT id FROM applications
        WHERE student_id=@sid AND college_id=@col AND course_id=@crs
          AND year_of_study=@yr AND academic_year=@ay AND status='draft'
        ORDER BY created_at DESC
      `)

    // Keep the first (newest), delete the rest
    const keep   = drafts.recordset[0].id
    const remove = drafts.recordset.slice(1).map(r => r.id)

    for (const id of remove) {
      await pool.request().input('id', mssql.Int, id)
        .query('DELETE FROM application_documents WHERE application_id=@id')
      await pool.request().input('id', mssql.Int, id)
        .query('DELETE FROM application_subjects  WHERE application_id=@id')
      await pool.request().input('id', mssql.Int, id)
        .query('DELETE FROM applications          WHERE id=@id')
      console.log(`  Deleted duplicate draft id=${id} (kept id=${keep})`)
    }
  }

  console.log('Done.')
  await pool.close()
}

run().catch(err => { console.error(err); process.exit(1) })
