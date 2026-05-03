/**
 * Creates college_required_documents table (per college, per faculty_master course, per year).
 * Also creates global document_types table if not already present.
 * Run: node BackEnd/scripts/create_college_required_docs.js
 */
require('dotenv').config();
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT),
  options: { encrypt: true, trustServerCertificate: true }
};

async function run() {
  const pool = await sql.connect(config)

  // Ensure global document_types table exists
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='document_types')
    CREATE TABLE document_types (
      id          INT IDENTITY(1,1) PRIMARY KEY,
      name        NVARCHAR(100) NOT NULL UNIQUE,
      description NVARCHAR(500),
      created_at  DATETIME2 DEFAULT GETDATE()
    )
  `)
  console.log('document_types table OK')

  // Seed common document types
  const docTypes = [
    ['SSC Marksheet',              '10th standard marksheet'],
    ['HSC Marksheet',              '12th standard marksheet'],
    ['Leaving Certificate',        'School/college leaving certificate'],
    ['Aadhaar Card',               'Aadhaar identity card'],
    ['Caste Certificate',          'Caste certificate issued by competent authority'],
    ['Domicile Certificate',       'Maharashtra domicile certificate'],
    ['Income Certificate',         'Annual family income certificate'],
    ['Transfer Certificate',       'Transfer certificate from previous institution'],
    ['Passport Size Photograph',   '2 recent passport size photographs'],
    ['Migration Certificate',      'Migration certificate (if applicable)'],
    ['Gap Certificate',            'Gap year affidavit (if applicable)'],
    ['ABC ID Card',                'Academic Bank of Credits ID'],
  ]
  for (const [name, desc] of docTypes) {
    await pool.request()
      .input('name', sql.NVarChar, name)
      .input('desc', sql.NVarChar, desc)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM document_types WHERE name=@name)
          INSERT INTO document_types (name, description) VALUES (@name, @desc)
      `)
  }
  console.log(`Seeded ${docTypes.length} document types`)

  // Create college_required_documents table (keyed by faculty_master.code_no)
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='college_required_documents')
    CREATE TABLE college_required_documents (
      id               INT IDENTITY(1,1) PRIMARY KEY,
      college_id       INT NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
      faculty_master_id INT NOT NULL REFERENCES faculty_master(code_no),
      year_of_study    INT NOT NULL CHECK (year_of_study IN (1,2,3)),
      document_type_id INT NOT NULL REFERENCES document_types(id),
      is_mandatory     BIT NOT NULL DEFAULT 1,
      created_at       DATETIME2 DEFAULT GETDATE(),
      CONSTRAINT uix_college_req_doc UNIQUE (college_id, faculty_master_id, year_of_study, document_type_id)
    )
  `)
  console.log('college_required_documents table OK')

  await pool.close()
  console.log('Done.')
}

run().catch(e => { console.error(e); process.exit(1) })
