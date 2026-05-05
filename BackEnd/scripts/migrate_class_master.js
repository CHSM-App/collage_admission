/**
 * Creates the class_master table.
 * A class is a (program, year_of_study) pair for a college,
 * e.g. BA — FY (First Year), BSc IT — TY (Third Year).
 * Run once: node scripts/migrate_class_master.js
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
    SELECT COUNT(*) AS cnt FROM sys.tables WHERE name = 'class_master'
  `);

  if (check.recordset[0].cnt > 0) {
    console.log('Table class_master already exists — skipping.');
  } else {
    await pool.request().query(`
      CREATE TABLE class_master (
        id                INT IDENTITY(1,1) PRIMARY KEY,
        college_id        INT NOT NULL,
        faculty_master_id INT NOT NULL,
        year_of_study     TINYINT NOT NULL CHECK (year_of_study IN (1,2,3)),
        label             NVARCHAR(50) NULL,
        is_active         BIT NOT NULL DEFAULT 1,
        created_at        DATETIME DEFAULT GETDATE(),
        CONSTRAINT UQ_class_master UNIQUE (college_id, faculty_master_id, year_of_study)
      )
    `);
    console.log('Table class_master created.');
  }

  await pool.close();
  console.log('Migration complete.');
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
