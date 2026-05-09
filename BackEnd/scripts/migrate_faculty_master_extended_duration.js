/**
 * migrate_faculty_master_extended_duration.js
 * Adds extended semester and year code columns to faculty_master so the
 * Program Master form can support 4-year (8 sem / 4 year codes) and
 * 5-year (10 sem / 5 year codes) degree programs.
 *
 * Adds (all NVARCHAR(20) NULL):
 *   unique_code_sem7, unique_code_sem8, unique_code_sem9, unique_code_sem10
 *   exam_seat_code_year4, exam_seat_code_year5
 *
 * Run once: node BackEnd/scripts/migrate_faculty_master_extended_duration.js
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

const NEW_COLS = [
  'unique_code_sem7',
  'unique_code_sem8',
  'unique_code_sem9',
  'unique_code_sem10',
  'exam_seat_code_year4',
  'exam_seat_code_year5',
];

async function run() {
  const pool = await sql.connect(config);

  // Print connection context so the operator can confirm we're on the
  // intended server/database. If the runtime app points at a different
  // DB (different env vars), running this migration here won't help there.
  const ctx = await pool.request().query(`
    SELECT @@SERVERNAME AS server_name, DB_NAME() AS db_name, SUSER_SNAME() AS user_name
  `);
  const c = ctx.recordset[0];
  console.log(`Connected to ${c.server_name} / database "${c.db_name}" as user "${c.user_name}"`);

  // Resolve the table once, accepting either the user's default schema or
  // explicit dbo. Bail clearly if the table isn't visible from this user.
  const oidRes = await pool.request().query(`
    SELECT COALESCE(OBJECT_ID('faculty_master'), OBJECT_ID('dbo.faculty_master')) AS oid
  `);
  const tableOid = oidRes.recordset[0].oid;
  if (!tableOid) {
    console.error(
      `faculty_master not found in database "${c.db_name}". ` +
      `Either the table doesn't exist here or this user can't see it. ` +
      `Verify .env (DB_SERVER / DB_NAME / DB_USER) points at the same database the application uses.`
    );
    await pool.close();
    process.exit(2);
  }

  let added = 0, skipped = 0;
  for (const col of NEW_COLS) {
    const check = await pool.request()
      .input('oid',  sql.Int,      tableOid)
      .input('name', sql.NVarChar, col)
      .query(`SELECT COUNT(*) AS cnt FROM sys.columns WHERE object_id = @oid AND name = @name`);
    if (check.recordset[0].cnt > 0) {
      console.log(`  ${col}: already exists — skipping.`);
      skipped++;
    } else {
      console.log(`  ${col}: adding...`);
      await pool.request().query(`ALTER TABLE faculty_master ADD ${col} NVARCHAR(20) NULL`);
      console.log(`  ${col}: added.`);
      added++;
    }
  }

  await pool.close();
  console.log(`Migration complete: ${added} column(s) added, ${skipped} already present.`);
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});