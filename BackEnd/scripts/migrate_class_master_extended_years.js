/**
 * migrate_class_master_extended_years.js
 * Relaxes class_master.year_of_study CHECK constraint from (1,2,3) to (1..5)
 * so 4-year and 5-year programs can register their later-year classes.
 *
 * Run once: node BackEnd/scripts/migrate_class_master_extended_years.js
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

const NEW_DEFINITION = 'year_of_study BETWEEN 1 AND 5';

async function run() {
  const pool = await sql.connect(config);

  const ctx = await pool.request().query(`
    SELECT @@SERVERNAME AS server_name, DB_NAME() AS db_name, SUSER_SNAME() AS user_name
  `);
  const c = ctx.recordset[0];
  console.log(`Connected to ${c.server_name} / database "${c.db_name}" as user "${c.user_name}"`);

  const tableOidRes = await pool.request().query(`
    SELECT COALESCE(OBJECT_ID('class_master'), OBJECT_ID('dbo.class_master')) AS oid
  `);
  const tableOid = tableOidRes.recordset[0].oid;
  if (!tableOid) {
    console.error(`class_master not found in database "${c.db_name}". Run migrate_class_master.js first.`);
    await pool.close();
    process.exit(2);
  }

  // Find existing CHECK constraints on year_of_study and drop any that
  // restrict the column to a subset of (1..5). System-generated names look
  // like "CK__class_ma__year___XXXXXXXX", so we filter by parent column.
  const constraints = await pool.request()
    .input('oid', sql.Int, tableOid)
    .query(`
      SELECT cc.name, cc.definition
      FROM sys.check_constraints cc
      JOIN sys.columns col
        ON col.object_id = cc.parent_object_id
       AND col.column_id = cc.parent_column_id
      WHERE cc.parent_object_id = @oid
        AND col.name = 'year_of_study'
    `);

  let dropped = 0;
  for (const row of constraints.recordset) {
    console.log(`  Dropping ${row.name}: ${row.definition}`);
    await pool.request().query(`ALTER TABLE class_master DROP CONSTRAINT [${row.name}]`);
    dropped++;
  }
  if (dropped === 0) console.log('  No existing year_of_study CHECK constraint found.');

  console.log(`  Adding new constraint: ${NEW_DEFINITION}`);
  await pool.request().query(`
    ALTER TABLE class_master
    ADD CONSTRAINT CK_class_master_year_of_study CHECK (${NEW_DEFINITION})
  `);

  await pool.close();
  console.log(`Migration complete: ${dropped} old constraint(s) dropped, new constraint installed.`);
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
