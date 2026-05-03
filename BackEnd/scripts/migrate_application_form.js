/**
 * migrate_application_form.js
 * Adds new columns and tables needed for the multi-step application form.
 * Safe to run multiple times — all changes are idempotent.
 *
 * Usage: node scripts/migrate_application_form.js
 */

const mssql = require('mssql');
require('dotenv').config();

const sqlConfig = {
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server:   process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port:     parseInt(process.env.DB_PORT),
  options:  { encrypt: true, trustServerCertificate: true },
};

async function run() {
  const pool = await mssql.connect(sqlConfig);
  const q = (sql) => pool.request().query(sql);
  console.log('Connected. Running migrations…');

  // ── 1. Extend students table with profile fields ────────────
  const studentCols = [
    ['surname',            'NVARCHAR(100)'],
    ['first_name',         'NVARCHAR(100)'],
    ['middle_name',        'NVARCHAR(100)'],
    ['mother_name',        'NVARCHAR(100)'],
    ['sex',                'NVARCHAR(10)'],
    ['marital_status',     'NVARCHAR(20)'],
    ['birth_date',         'DATE'],
    ['birth_place',        'NVARCHAR(100)'],
    ['birth_taluka',       'NVARCHAR(100)'],
    ['birth_district',     'NVARCHAR(100)'],
    ['birth_state',        'NVARCHAR(100)'],
    ['nationality',        'NVARCHAR(50)'],
    ['religion',           'NVARCHAR(50)'],
    ['caste',              'NVARCHAR(50)'],
    ['mother_tongue',      'NVARCHAR(50)'],
    ['height_cm',          'INT'],
    ['weight_kg',          'DECIMAL(5,2)'],
    ['blood_group',        'NVARCHAR(5)'],
    ['father_full_name',   'NVARCHAR(200)'],
    ['father_occupation',  'NVARCHAR(100)'],
    ['annual_income',      'DECIMAL(12,2)'],
    ['son_daughter_number','INT'],
    ['aadhaar',            'NVARCHAR(12)'],
    ['abc_id',             'NVARCHAR(50)'],
    ['prn',                'NVARCHAR(30)'],
    ['bank_account_number','NVARCHAR(50)'],
    ['bank_ifsc',          'NVARCHAR(20)'],
    ['bank_name',          'NVARCHAR(100)'],
    ['bank_branch',        'NVARCHAR(100)'],
  ];

  for (const [col, type] of studentCols) {
    await q(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID('students') AND name = '${col}'
      )
      ALTER TABLE students ADD ${col} ${type} NULL
    `);
  }
  console.log('students table extended');

  // ── 2. Extend applications table ────────────────────────────
  const appCols = [
    // Step 2 — personal
    ['app_surname',          'NVARCHAR(100)'],
    ['app_first_name',       'NVARCHAR(100)'],
    ['app_middle_name',      'NVARCHAR(100)'],
    ['app_mother_name',      'NVARCHAR(100)'],
    ['app_sex',              'NVARCHAR(10)'],
    ['app_mobile',           'NVARCHAR(15)'],
    ['app_email',            'NVARCHAR(150)'],
    ['app_address',          'NVARCHAR(500)'],
    ['app_taluka',           'NVARCHAR(100)'],
    ['app_district',         'NVARCHAR(100)'],
    ['app_state',            'NVARCHAR(100)'],
    ['app_category',         'NVARCHAR(30)'],
    ['fees_category',        'NVARCHAR(20)'],
    // Step 3 — other details
    ['app_birth_date',       'DATE'],
    ['app_birth_place',      'NVARCHAR(100)'],
    ['app_birth_taluka',     'NVARCHAR(100)'],
    ['app_birth_district',   'NVARCHAR(100)'],
    ['app_birth_state',      'NVARCHAR(100)'],
    ['app_nationality',      'NVARCHAR(50)'],
    ['app_marital_status',   'NVARCHAR(20)'],
    ['app_religion',         'NVARCHAR(50)'],
    ['app_caste',            'NVARCHAR(50)'],
    ['app_mother_tongue',    'NVARCHAR(50)'],
    ['app_height_cm',        'INT'],
    ['app_weight_kg',        'DECIMAL(5,2)'],
    ['app_blood_group',      'NVARCHAR(5)'],
    ['app_father_full_name', 'NVARCHAR(200)'],
    ['app_son_daughter_no',  'INT'],
    ['app_father_occupation','NVARCHAR(100)'],
    ['app_annual_income',    'DECIMAL(12,2)'],
    ['app_aadhaar',          'NVARCHAR(12)'],
    ['app_prn',              'NVARCHAR(30)'],
    ['app_abc_id',           'NVARCHAR(50)'],
    ['app_bank_account',     'NVARCHAR(50)'],
    ['app_bank_ifsc',        'NVARCHAR(20)'],
    ['app_bank_name',        'NVARCHAR(100)'],
    ['app_bank_branch',      'NVARCHAR(100)'],
    // Step tracking
    ['current_step',         'INT'],
    ['declaration_accepted_at', 'DATETIME2'],
  ];

  for (const [col, type] of appCols) {
    await q(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID('applications') AND name = '${col}'
      )
      ALTER TABLE applications ADD ${col} ${type} NULL
    `);
  }
  console.log('applications table extended');

  // ── 3. application_previous_exam ────────────────────────────
  await q(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='application_previous_exam')
    CREATE TABLE application_previous_exam (
      id                     INT IDENTITY(1,1) PRIMARY KEY,
      application_id         INT NOT NULL UNIQUE REFERENCES applications(id),
      board_or_college_name  NVARCHAR(200) NULL,
      school_or_college_address NVARCHAR(500) NULL,
      seat_number            NVARCHAR(50)  NULL,
      prn_or_seat            NVARCHAR(50)  NULL,
      year_of_passing        INT           NULL,
      total_marks_obtained   DECIMAL(8,2)  NULL,
      total_marks_max        DECIMAL(8,2)  NULL,
      result                 NVARCHAR(10)  NULL CHECK (result IN ('pass','atkt','fail') OR result IS NULL),
      created_at             DATETIME2 DEFAULT GETDATE(),
      updated_at             DATETIME2 DEFAULT GETDATE()
    )
  `);
  console.log('application_previous_exam created');

  // ── 4. application_previous_exam_subjects ───────────────────
  await q(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='application_previous_exam_subjects')
    CREATE TABLE application_previous_exam_subjects (
      id                          INT IDENTITY(1,1) PRIMARY KEY,
      application_previous_exam_id INT NOT NULL REFERENCES application_previous_exam(id) ON DELETE CASCADE,
      subject_name                NVARCHAR(200) NOT NULL,
      marks_obtained              DECIMAL(6,2)  NOT NULL,
      marks_max                   DECIMAL(6,2)  NOT NULL,
      created_at                  DATETIME2 DEFAULT GETDATE()
    )
  `);
  console.log('application_previous_exam_subjects created');

  await pool.close();
  console.log('\nAll migrations completed successfully.');
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
