/**
 * migrate_certificate_noc.js
 * Creates certificate_noc table + indexes for the No Objection Certificate module.
 *
 * Run once: node BackEnd/scripts/migrate_certificate_noc.js
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

async function tableExists(pool, name) {
  const r = await pool.request().query(`SELECT COUNT(*) AS cnt FROM sys.tables WHERE name = '${name}'`);
  return r.recordset[0].cnt > 0;
}
async function indexExists(pool, name) {
  const r = await pool.request().query(`SELECT COUNT(*) AS cnt FROM sys.indexes WHERE name = '${name}'`);
  return r.recordset[0].cnt > 0;
}

async function run() {
  const pool = await sql.connect(config);

  if (await tableExists(pool, 'certificate_noc')) {
    console.log('Table certificate_noc already exists — skipping create.');
  } else {
    console.log('Creating certificate_noc...');
    await pool.request().query(`
      CREATE TABLE certificate_noc (
        noc_certificate_id    INT IDENTITY(1,1) PRIMARY KEY,
        college_id            INT           NOT NULL REFERENCES colleges(id),
        certificate_no        NVARCHAR(50)  NOT NULL,
        certificate_date      DATE          NOT NULL,
        reg_no                NVARCHAR(50)  NULL,
        student_name          NVARCHAR(200) NOT NULL,
        gender                NVARCHAR(10)  NULL,
        is_ex_student         BIT           NOT NULL DEFAULT 0,
        class_name            NVARCHAR(100) NULL,
        from_date             DATE          NULL,
        to_date               DATE          NULL,
        prn_no                NVARCHAR(100) NULL,
        final_confirmation_no NVARCHAR(100) NULL,
        created_by            INT           NULL,
        created_date          DATETIME      NOT NULL DEFAULT GETDATE(),
        updated_by            INT           NULL,
        updated_date          DATETIME      NULL,
        is_deleted            BIT           NOT NULL DEFAULT 0,
        CONSTRAINT chk_cert_noc_date_range CHECK (from_date IS NULL OR to_date IS NULL OR from_date <= to_date)
      )
    `);
    console.log('  table created.');
  }

  if (await indexExists(pool, 'ix_cert_noc_certificate_no')) {
    console.log('Index ix_cert_noc_certificate_no already exists — skipping.');
  } else {
    console.log('Adding ix_cert_noc_certificate_no...');
    await pool.request().query(`
      CREATE UNIQUE INDEX ix_cert_noc_certificate_no
        ON certificate_noc (college_id, certificate_no)
        WHERE is_deleted = 0
    `);
    console.log('  index added.');
  }

  if (await indexExists(pool, 'ix_cert_noc_reg_no')) {
    console.log('Index ix_cert_noc_reg_no already exists — skipping.');
  } else {
    console.log('Adding ix_cert_noc_reg_no...');
    await pool.request().query(`
      CREATE INDEX ix_cert_noc_reg_no
        ON certificate_noc (college_id, reg_no)
    `);
    console.log('  index added.');
  }

  if (await indexExists(pool, 'ix_cert_noc_prn_no')) {
    console.log('Index ix_cert_noc_prn_no already exists — skipping.');
  } else {
    console.log('Adding ix_cert_noc_prn_no...');
    await pool.request().query(`
      CREATE INDEX ix_cert_noc_prn_no
        ON certificate_noc (college_id, prn_no)
    `);
    console.log('  index added.');
  }

  await pool.close();
  console.log('Migration complete.');
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
