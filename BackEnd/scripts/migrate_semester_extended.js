/**
 * migrate_semester_extended.js
 * Relaxes the `semester` CHECK constraints on course_master and group_master
 * from (1..6) to (1..10) so 4-year and 5-year programs can register
 * subjects/groups for sems 7-10.
 *
 * Run once: node BackEnd/scripts/migrate_semester_extended.js
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

const NEW_CHECK = 'semester BETWEEN 1 AND 10';
const TABLES    = ['course_master', 'group_master'];

async function run() {
  const pool = await sql.connect(config);

  const ctx = await pool.request().query(`
    SELECT @@SERVERNAME AS server_name, DB_NAME() AS db_name, SUSER_SNAME() AS user_name
  `);
  const c = ctx.recordset[0];
  console.log(`Connected to ${c.server_name} / database "${c.db_name}" as user "${c.user_name}"`);

  let totalDropped = 0, totalAdded = 0;

  for (const table of TABLES) {
    console.log(`\n[${table}]`);

    const oidRes = await pool.request().query(`
      SELECT COALESCE(OBJECT_ID('${table}'), OBJECT_ID('dbo.${table}')) AS oid
    `);
    const tableOid = oidRes.recordset[0].oid;
    if (!tableOid) {
      console.log(`  Table not found — skipping.`);
      continue;
    }

    // Find CHECK constraints attached to a column named `semester` on this table.
    const constraints = await pool.request()
      .input('oid', sql.Int, tableOid)
      .query(`
        SELECT cc.name, cc.definition
        FROM sys.check_constraints cc
        JOIN sys.columns col
          ON col.object_id = cc.parent_object_id
         AND col.column_id = cc.parent_column_id
        WHERE cc.parent_object_id = @oid
          AND col.name = 'semester'
      `);

    if (constraints.recordset.length === 0) {
      console.log(`  No existing semester CHECK constraint found.`);
    }

    for (const row of constraints.recordset) {
      console.log(`  Dropping ${row.name}: ${row.definition}`);
      await pool.request().query(`ALTER TABLE ${table} DROP CONSTRAINT [${row.name}]`);
      totalDropped++;
    }

    const newName = `CK_${table}_semester`;
    console.log(`  Adding constraint ${newName}: ${NEW_CHECK}`);
    await pool.request().query(`
      ALTER TABLE ${table}
      ADD CONSTRAINT ${newName} CHECK (${NEW_CHECK})
    `);
    totalAdded++;
  }

  await pool.close();
  console.log(`\nMigration complete: ${totalDropped} old constraint(s) dropped, ${totalAdded} new constraint(s) installed.`);
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
