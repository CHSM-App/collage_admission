/**
 * Drops application_fee column from admission_periods table.
 * Application fee now lives on colleges.application_fee (set by admin).
 * Run once: node scripts/migrate_drop_period_app_fee.js
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

async function run() {
  const pool = await sql.connect(config);

  const check = await pool.request().query(`
    SELECT COUNT(*) AS cnt FROM sys.columns
    WHERE object_id = OBJECT_ID('admission_periods') AND name = 'application_fee'
  `);

  if (check.recordset[0].cnt === 0) {
    console.log('Column application_fee does not exist on admission_periods — nothing to do.');
  } else {
    // Drop any DEFAULT constraint bound to the column first
    await pool.request().query(`
      DECLARE @con NVARCHAR(200)
      SELECT @con = dc.name
      FROM sys.default_constraints dc
      JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
      WHERE dc.parent_object_id = OBJECT_ID('admission_periods') AND c.name = 'application_fee'
      IF @con IS NOT NULL
        EXEC('ALTER TABLE admission_periods DROP CONSTRAINT [' + @con + ']')
    `);
    await pool.request().query(`ALTER TABLE admission_periods DROP COLUMN application_fee`);
    console.log('Column application_fee dropped from admission_periods.');
  }

  await pool.close();
  console.log('Migration complete.');
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
