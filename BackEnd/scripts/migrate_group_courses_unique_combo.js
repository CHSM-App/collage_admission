/**
 * migrate_group_courses_unique_combo.js
 * Adds UNIQUE (group_id, course_code, course_title) to group_courses so a
 * given Course Code + Course Title pair cannot repeat inside one group.
 *
 * Refuses to run if existing duplicates would be violated by the constraint,
 * and prints the offending rows so they can be cleaned up first.
 *
 * Run once: node BackEnd/scripts/migrate_group_courses_unique_combo.js
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

const CONSTRAINT_NAME = 'uq_group_course_combo';

async function run() {
  const pool = await sql.connect(config);

  const exists = await pool.request().query(`
    SELECT COUNT(*) AS cnt
    FROM sys.objects
    WHERE name = '${CONSTRAINT_NAME}' AND type = 'UQ'
  `);
  if (exists.recordset[0].cnt > 0) {
    console.log(`Constraint ${CONSTRAINT_NAME} already exists — skipping.`);
    await pool.close();
    return;
  }

  const dups = await pool.request().query(`
    SELECT group_id, course_code, course_title, COUNT(*) AS cnt
    FROM group_courses
    GROUP BY group_id, course_code, course_title
    HAVING COUNT(*) > 1
  `);
  if (dups.recordset.length > 0) {
    console.error('Cannot add unique constraint — duplicate (group_id, course_code, course_title) rows exist:');
    dups.recordset.forEach(r => {
      console.error(`  group_id=${r.group_id}  code="${r.course_code}"  title="${r.course_title}"  count=${r.cnt}`);
    });
    console.error('Resolve duplicates and re-run.');
    await pool.close();
    process.exit(2);
  }

  console.log(`Adding ${CONSTRAINT_NAME}...`);
  await pool.request().query(`
    ALTER TABLE group_courses
    ADD CONSTRAINT ${CONSTRAINT_NAME} UNIQUE (group_id, course_code, course_title)
  `);
  console.log('Constraint added.');

  await pool.close();
  console.log('Migration complete.');
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
