/**
 * seeder.js — Run once to create tables and insert seed data.
 * Usage:  node scripts/seeder.js
 *
 * Prerequisites:
 *   npm install bcryptjs  (already in package.json after you add it)
 */

const mssql  = require('mssql');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const sqlConfig = {
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server:   process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port:     parseInt(process.env.DB_PORT),
  options:  { encrypt: true, trustServerCertificate: true },
};

const ADMIN_PLAIN    = 'Admin@123';
const STUDENT_PLAIN  = 'Student@123';

async function createTables(pool) {
  const q = (sql) => pool.request().query(sql);

  await q(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='colleges')
    CREATE TABLE colleges (
      id                  INT IDENTITY(1,1) PRIMARY KEY,
      name                NVARCHAR(200) NOT NULL,
      address             NVARCHAR(500),
      city                NVARCHAR(100),
      phone               NVARCHAR(20),
      email               NVARCHAR(150) UNIQUE NOT NULL,
      admin_email         NVARCHAR(150) UNIQUE NOT NULL,
      admin_password_hash NVARCHAR(255) NOT NULL,
      bank_account_name   NVARCHAR(200),
      bank_account_number NVARCHAR(50),
      bank_ifsc           NVARCHAR(20),
      bank_upi_id         NVARCHAR(100),
      created_at          DATETIME2 DEFAULT GETDATE()
    )
  `);

  await q(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='courses')
    CREATE TABLE courses (
      id             INT IDENTITY(1,1) PRIMARY KEY,
      college_id     INT NOT NULL REFERENCES colleges(id),
      name           NVARCHAR(100) NOT NULL,
      duration_years INT NOT NULL DEFAULT 3,
      category       NVARCHAR(20) NOT NULL CHECK (category IN ('grant','non-grant')),
      created_at     DATETIME2 DEFAULT GETDATE()
    )
  `);

  await q(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='document_types')
    CREATE TABLE document_types (
      id          INT IDENTITY(1,1) PRIMARY KEY,
      name        NVARCHAR(100) NOT NULL,
      description NVARCHAR(300),
      created_at  DATETIME2 DEFAULT GETDATE()
    )
  `);

  await q(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='subjects')
    CREATE TABLE subjects (
      id             INT IDENTITY(1,1) PRIMARY KEY,
      course_id      INT NOT NULL REFERENCES courses(id),
      year_of_study  INT NOT NULL CHECK (year_of_study IN (1,2,3)),
      name           NVARCHAR(200) NOT NULL,
      subject_type   NVARCHAR(20) NOT NULL CHECK (subject_type IN ('core','elective')),
      elective_group NVARCHAR(10) NULL,
      created_at     DATETIME2 DEFAULT GETDATE()
    )
  `);

  await q(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='fee_structures')
    CREATE TABLE fee_structures (
      id            INT IDENTITY(1,1) PRIMARY KEY,
      college_id    INT NOT NULL REFERENCES colleges(id),
      course_id     INT NOT NULL REFERENCES courses(id),
      year_of_study INT NOT NULL CHECK (year_of_study IN (1,2,3)),
      category      NVARCHAR(20) NOT NULL CHECK (category IN ('grant','non-grant')),
      tuition_fee   DECIMAL(10,2) NOT NULL DEFAULT 0,
      exam_fee      DECIMAL(10,2) NOT NULL DEFAULT 0,
      other_fee     DECIMAL(10,2) NOT NULL DEFAULT 0,
      created_at    DATETIME2 DEFAULT GETDATE()
    )
  `);

  await q(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='required_documents')
    CREATE TABLE required_documents (
      id               INT IDENTITY(1,1) PRIMARY KEY,
      college_id       INT NOT NULL REFERENCES colleges(id),
      course_id        INT NOT NULL REFERENCES courses(id),
      year_of_study    INT NOT NULL CHECK (year_of_study IN (1,2,3)),
      document_type_id INT NOT NULL REFERENCES document_types(id),
      is_mandatory     BIT NOT NULL DEFAULT 1,
      created_at       DATETIME2 DEFAULT GETDATE()
    )
  `);

  await q(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='students')
    CREATE TABLE students (
      id             INT IDENTITY(1,1) PRIMARY KEY,
      full_name      NVARCHAR(200) NOT NULL,
      email          NVARCHAR(150) UNIQUE NOT NULL,
      password_hash  NVARCHAR(255) NOT NULL,
      phone          NVARCHAR(20),
      dob            DATE,
      gender         NVARCHAR(10),
      address        NVARCHAR(500),
      city           NVARCHAR(100),
      aadhaar_number NVARCHAR(20),
      category       NVARCHAR(30),
      created_at     DATETIME2 DEFAULT GETDATE()
    )
  `);

  await q(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='admission_periods')
    CREATE TABLE admission_periods (
      id              INT IDENTITY(1,1) PRIMARY KEY,
      college_id      INT NOT NULL REFERENCES colleges(id),
      course_id       INT NOT NULL REFERENCES courses(id),
      year_of_study   INT NOT NULL CHECK (year_of_study IN (1,2,3)),
      academic_year   NVARCHAR(10) NOT NULL,
      start_date      DATE NOT NULL,
      end_date        DATE NOT NULL,
      total_seats     INT NOT NULL,
      filled_seats    INT NOT NULL DEFAULT 0,
      application_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
      is_active       BIT NOT NULL DEFAULT 1,
      created_at      DATETIME2 DEFAULT GETDATE()
    )
  `);

  await q(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='student_documents')
    CREATE TABLE student_documents (
      id               INT IDENTITY(1,1) PRIMARY KEY,
      student_id       INT NOT NULL REFERENCES students(id),
      document_type_id INT NOT NULL REFERENCES document_types(id),
      file_name        NVARCHAR(300) NOT NULL,
      file_path        NVARCHAR(500) NOT NULL,
      uploaded_at      DATETIME2 DEFAULT GETDATE(),
      CONSTRAINT uq_student_doc UNIQUE (student_id, document_type_id)
    )
  `);

  await q(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='applications')
    CREATE TABLE applications (
      id                   INT IDENTITY(1,1) PRIMARY KEY,
      registration_number  NVARCHAR(30) UNIQUE NULL,
      student_id           INT NOT NULL REFERENCES students(id),
      college_id           INT NOT NULL REFERENCES colleges(id),
      course_id            INT NOT NULL REFERENCES courses(id),
      year_of_study        INT NOT NULL CHECK (year_of_study IN (1,2,3)),
      academic_year        NVARCHAR(10) NOT NULL,
      admission_period_id  INT NOT NULL REFERENCES admission_periods(id),
      status               NVARCHAR(30) NOT NULL DEFAULT 'draft'
                           CHECK (status IN (
                             'draft','payment_pending','submitted','under_review',
                             'approved','document_verification','confirmed',
                             'fees_paid','roll_assigned','enrolled','rejected','cancelled'
                           )),
      rejection_reason     NVARCHAR(500) NULL,
      cancellation_reason  NVARCHAR(500) NULL,
      roll_number          NVARCHAR(20) NULL,
      application_fee_paid BIT NOT NULL DEFAULT 0,
      college_fee_paid     BIT NOT NULL DEFAULT 0,
      submitted_at         DATETIME2 NULL,
      approved_at          DATETIME2 NULL,
      confirmed_at         DATETIME2 NULL,
      enrolled_at          DATETIME2 NULL,
      created_at           DATETIME2 DEFAULT GETDATE(),
      updated_at           DATETIME2 DEFAULT GETDATE()
    )
  `);

  await q(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='application_documents')
    CREATE TABLE application_documents (
      id                  INT IDENTITY(1,1) PRIMARY KEY,
      application_id      INT NOT NULL REFERENCES applications(id),
      student_document_id INT NOT NULL REFERENCES student_documents(id),
      document_type_id    INT NOT NULL REFERENCES document_types(id),
      is_verified         BIT NOT NULL DEFAULT 0,
      verified_at         DATETIME2 NULL,
      created_at          DATETIME2 DEFAULT GETDATE()
    )
  `);

  await q(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='application_subjects')
    CREATE TABLE application_subjects (
      id             INT IDENTITY(1,1) PRIMARY KEY,
      application_id INT NOT NULL REFERENCES applications(id),
      subject_id     INT NOT NULL REFERENCES subjects(id),
      created_at     DATETIME2 DEFAULT GETDATE()
    )
  `);

  await q(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='payments')
    CREATE TABLE payments (
      id                 INT IDENTITY(1,1) PRIMARY KEY,
      application_id     INT NOT NULL REFERENCES applications(id),
      payment_type       NVARCHAR(20) NOT NULL CHECK (payment_type IN ('application_fee','college_fee')),
      amount             DECIMAL(10,2) NOT NULL,
      gateway_order_id   NVARCHAR(100) NULL,
      gateway_payment_id NVARCHAR(100) NULL,
      status             NVARCHAR(20) NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','success','failed','cancelled')),
      attempted_at       DATETIME2 DEFAULT GETDATE(),
      completed_at       DATETIME2 NULL
    )
  `);

  console.log('All tables created (or already existed)');
}

async function run() {
  const pool = await mssql.connect(sqlConfig);
  console.log('Connected to database');

  await createTables(pool);

  const adminHash   = await bcrypt.hash(ADMIN_PLAIN, 10);
  const studentHash = await bcrypt.hash(STUDENT_PLAIN, 10);

  const t = pool.transaction();
  await t.begin();

  try {
    const r = () => t.request();

    // ── DOCUMENT TYPES ───────────────────────────────────────
    const docTypes = [
      ['Aadhaar Card',          'Government issued Aadhaar identity card'],
      ['Passport Photo',        'Recent colour passport-size photograph'],
      ['10th Marksheet',        'Secondary School Certificate marksheet'],
      ['12th Marksheet',        'Higher Secondary Certificate marksheet'],
      ['FY Marksheet',          'First Year college marksheet'],
      ['SY Marksheet',          'Second Year college marksheet'],
      ['Leaving Certificate',   'School / College leaving certificate'],
      ['Caste Certificate',     'Caste certificate from competent authority'],
      ['Income Certificate',    'Family income certificate'],
      ['Migration Certificate', 'Migration certificate from previous institution'],
    ];

    const docIds = {};
    for (const [name, desc] of docTypes) {
      const res = await r()
        .input('name', mssql.NVarChar, name)
        .input('desc', mssql.NVarChar, desc)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM document_types WHERE name=@name)
            INSERT INTO document_types (name,description) VALUES (@name,@desc);
          SELECT id FROM document_types WHERE name=@name;
        `);
      docIds[name] = res.recordset[0].id;
    }
    console.log('Document types seeded');

    // ── COLLEGES ─────────────────────────────────────────────
    const colleges = [
      {
        name:    'Vengurla Education Society College of Arts & Science',
        address: 'Near Bus Stand, College Road',
        city:    'Vengurla',
        phone:   '02366-262101',
        email:   'info@vescas.edu.in',
        adminEmail: 'admin@vescas.edu.in',
        bank_name:   'VES College',
        bank_acc:    '012345678901',
        bank_ifsc:   'SBIN0001234',
        bank_upi:    'vescas@sbi',
      },
      {
        name:    'Konkan College of Commerce',
        address: 'Kankavli Road, Sawantwadi',
        city:    'Sawantwadi',
        phone:   '02363-272500',
        email:   'info@konkancom.edu.in',
        adminEmail: 'admin@konkancom.edu.in',
        bank_name:   'Konkan Commerce College',
        bank_acc:    '098765432109',
        bank_ifsc:   'HDFC0005678',
        bank_upi:    'konkancom@hdfc',
      },
      {
        name:    'Sindhudurg Institute of Technology & Management',
        address: 'Oros Road',
        city:    'Kudal',
        phone:   '02362-220100',
        email:   'info@sitm.edu.in',
        adminEmail: 'admin@sitm.edu.in',
        bank_name:   'SITM College',
        bank_acc:    '111222333444',
        bank_ifsc:   'ICIC0009012',
        bank_upi:    'sitm@icici',
      },
    ];

    const collegeIds = {};
    for (const c of colleges) {
      const res = await r()
        .input('name',    mssql.NVarChar, c.name)
        .input('address', mssql.NVarChar, c.address)
        .input('city',    mssql.NVarChar, c.city)
        .input('phone',   mssql.NVarChar, c.phone)
        .input('email',   mssql.NVarChar, c.email)
        .input('aemail',  mssql.NVarChar, c.adminEmail)
        .input('ahash',   mssql.NVarChar, adminHash)
        .input('bname',   mssql.NVarChar, c.bank_name)
        .input('bacc',    mssql.NVarChar, c.bank_acc)
        .input('bifsc',   mssql.NVarChar, c.bank_ifsc)
        .input('bupi',    mssql.NVarChar, c.bank_upi)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM colleges WHERE email=@email)
            INSERT INTO colleges
              (name,address,city,phone,email,admin_email,admin_password_hash,
               bank_account_name,bank_account_number,bank_ifsc,bank_upi_id)
            VALUES
              (@name,@address,@city,@phone,@email,@aemail,@ahash,
               @bname,@bacc,@bifsc,@bupi);
          SELECT id FROM colleges WHERE email=@email;
        `);
      collegeIds[c.adminEmail] = res.recordset[0].id;
    }
    console.log('Colleges seeded');

    const [vesId, konkanId, sitmId] = Object.values(collegeIds);

    // ── COURSES ──────────────────────────────────────────────
    const coursesDef = [
      { college_id: vesId,    name: 'BCA',    duration: 3, category: 'grant' },
      { college_id: vesId,    name: 'BCom',   duration: 3, category: 'grant' },
      { college_id: vesId,    name: 'BSc-IT', duration: 3, category: 'non-grant' },
      { college_id: konkanId, name: 'BCom',   duration: 3, category: 'grant' },
      { college_id: konkanId, name: 'BBA',    duration: 3, category: 'non-grant' },
      { college_id: sitmId,   name: 'BCA',    duration: 3, category: 'non-grant' },
      { college_id: sitmId,   name: 'BSc-IT', duration: 3, category: 'non-grant' },
      { college_id: sitmId,   name: 'BBA',    duration: 3, category: 'non-grant' },
    ];

    const courseIds = [];
    for (const c of coursesDef) {
      const res = await r()
        .input('cid',  mssql.Int,      c.college_id)
        .input('name', mssql.NVarChar, c.name)
        .input('dur',  mssql.Int,      c.duration)
        .input('cat',  mssql.NVarChar, c.category)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM courses WHERE college_id=@cid AND name=@name)
            INSERT INTO courses (college_id,name,duration_years,category)
            VALUES (@cid,@name,@dur,@cat);
          SELECT id FROM courses WHERE college_id=@cid AND name=@name;
        `);
      courseIds.push(res.recordset[0].id);
    }
    const [vesBcaId, vesComId, vesBscId, konComId, konBbaId, sitmBcaId, sitmBscId, sitmBbaId] = courseIds;
    console.log('Courses seeded');

    // ── SUBJECTS (VES BCA only — others follow same pattern) ─
    const subjectsDef = [
      // VES BCA FY
      { course_id: vesBcaId, year: 1, name: 'Fundamentals of Computers',          type: 'core',     group: null },
      { course_id: vesBcaId, year: 1, name: 'Programming in C',                   type: 'core',     group: null },
      { course_id: vesBcaId, year: 1, name: 'Mathematics I',                      type: 'core',     group: null },
      { course_id: vesBcaId, year: 1, name: 'Business Communication',             type: 'core',     group: null },
      { course_id: vesBcaId, year: 1, name: 'Web Design Basics',                  type: 'elective', group: 'A' },
      { course_id: vesBcaId, year: 1, name: 'Digital Electronics',                type: 'elective', group: 'A' },
      { course_id: vesBcaId, year: 1, name: 'Soft Skills',                        type: 'elective', group: 'B' },
      { course_id: vesBcaId, year: 1, name: 'Environmental Studies',              type: 'elective', group: 'B' },
      // VES BCA SY
      { course_id: vesBcaId, year: 2, name: 'Data Structures',                    type: 'core',     group: null },
      { course_id: vesBcaId, year: 2, name: 'Object Oriented Programming (Java)', type: 'core',     group: null },
      { course_id: vesBcaId, year: 2, name: 'Database Management Systems',        type: 'core',     group: null },
      { course_id: vesBcaId, year: 2, name: 'Operating Systems',                  type: 'core',     group: null },
      { course_id: vesBcaId, year: 2, name: 'Networking Fundamentals',            type: 'elective', group: 'A' },
      { course_id: vesBcaId, year: 2, name: 'Graphics & Multimedia',              type: 'elective', group: 'A' },
      { course_id: vesBcaId, year: 2, name: 'Numerical Methods',                  type: 'elective', group: 'B' },
      { course_id: vesBcaId, year: 2, name: 'Python Programming',                 type: 'elective', group: 'B' },
      // VES BCA TY
      { course_id: vesBcaId, year: 3, name: 'Software Engineering',               type: 'core',     group: null },
      { course_id: vesBcaId, year: 3, name: 'Advanced Java',                      type: 'core',     group: null },
      { course_id: vesBcaId, year: 3, name: 'Cloud Computing',                    type: 'core',     group: null },
      { course_id: vesBcaId, year: 3, name: 'Project Work',                       type: 'core',     group: null },
      { course_id: vesBcaId, year: 3, name: 'Artificial Intelligence',            type: 'elective', group: 'A' },
      { course_id: vesBcaId, year: 3, name: 'Machine Learning',                   type: 'elective', group: 'A' },
      { course_id: vesBcaId, year: 3, name: 'Cyber Security',                     type: 'elective', group: 'B' },
      { course_id: vesBcaId, year: 3, name: 'Mobile App Development',             type: 'elective', group: 'B' },
      // VES BCom FY
      { course_id: vesComId, year: 1, name: 'Financial Accounting',               type: 'core',     group: null },
      { course_id: vesComId, year: 1, name: 'Business Economics',                 type: 'core',     group: null },
      { course_id: vesComId, year: 1, name: 'Business Law',                       type: 'core',     group: null },
      { course_id: vesComId, year: 1, name: 'Mathematics & Statistics',           type: 'core',     group: null },
      { course_id: vesComId, year: 1, name: 'Entrepreneurship',                   type: 'elective', group: 'A' },
      { course_id: vesComId, year: 1, name: 'Computer Applications',              type: 'elective', group: 'A' },
      // VES BCom SY
      { course_id: vesComId, year: 2, name: 'Cost Accounting',                    type: 'core',     group: null },
      { course_id: vesComId, year: 2, name: 'Corporate Accounting',               type: 'core',     group: null },
      { course_id: vesComId, year: 2, name: 'Auditing',                           type: 'core',     group: null },
      { course_id: vesComId, year: 2, name: 'Income Tax',                         type: 'elective', group: 'A' },
      { course_id: vesComId, year: 2, name: 'Banking & Insurance',                type: 'elective', group: 'A' },
    ];

    for (const s of subjectsDef) {
      await r()
        .input('cid',   mssql.Int,      s.course_id)
        .input('year',  mssql.Int,      s.year)
        .input('name',  mssql.NVarChar, s.name)
        .input('type',  mssql.NVarChar, s.type)
        .input('grp',   mssql.NVarChar, s.group)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM subjects WHERE course_id=@cid AND year_of_study=@year AND name=@name)
            INSERT INTO subjects (course_id,year_of_study,name,subject_type,elective_group)
            VALUES (@cid,@year,@name,@type,@grp);
        `);
    }
    console.log('Subjects seeded');

    // ── FEE STRUCTURES ───────────────────────────────────────
    const fees = [
      // VES BCA
      { col: vesId, crs: vesBcaId, yr: 1, cat: 'grant',     tui: 6000,  exam: 500, oth: 300 },
      { col: vesId, crs: vesBcaId, yr: 2, cat: 'grant',     tui: 6000,  exam: 500, oth: 300 },
      { col: vesId, crs: vesBcaId, yr: 3, cat: 'grant',     tui: 6000,  exam: 500, oth: 300 },
      { col: vesId, crs: vesBcaId, yr: 1, cat: 'non-grant', tui: 18000, exam: 500, oth: 500 },
      { col: vesId, crs: vesBcaId, yr: 2, cat: 'non-grant', tui: 18000, exam: 500, oth: 500 },
      { col: vesId, crs: vesBcaId, yr: 3, cat: 'non-grant', tui: 18000, exam: 500, oth: 500 },
      // VES BCom
      { col: vesId, crs: vesComId, yr: 1, cat: 'grant',     tui: 4500,  exam: 400, oth: 250 },
      { col: vesId, crs: vesComId, yr: 2, cat: 'grant',     tui: 4500,  exam: 400, oth: 250 },
      { col: vesId, crs: vesComId, yr: 3, cat: 'grant',     tui: 4500,  exam: 400, oth: 250 },
      // VES BSc-IT
      { col: vesId, crs: vesBscId, yr: 1, cat: 'non-grant', tui: 22000, exam: 600, oth: 600 },
      { col: vesId, crs: vesBscId, yr: 2, cat: 'non-grant', tui: 22000, exam: 600, oth: 600 },
      { col: vesId, crs: vesBscId, yr: 3, cat: 'non-grant', tui: 22000, exam: 600, oth: 600 },
      // Konkan BCom
      { col: konkanId, crs: konComId, yr: 1, cat: 'grant',     tui: 5000,  exam: 450, oth: 300 },
      { col: konkanId, crs: konComId, yr: 2, cat: 'grant',     tui: 5000,  exam: 450, oth: 300 },
      { col: konkanId, crs: konComId, yr: 3, cat: 'grant',     tui: 5000,  exam: 450, oth: 300 },
      // Konkan BBA
      { col: konkanId, crs: konBbaId, yr: 1, cat: 'non-grant', tui: 20000, exam: 500, oth: 500 },
      { col: konkanId, crs: konBbaId, yr: 2, cat: 'non-grant', tui: 20000, exam: 500, oth: 500 },
      { col: konkanId, crs: konBbaId, yr: 3, cat: 'non-grant', tui: 20000, exam: 500, oth: 500 },
      // SITM BCA
      { col: sitmId, crs: sitmBcaId, yr: 1, cat: 'non-grant', tui: 25000, exam: 700, oth: 700 },
      { col: sitmId, crs: sitmBcaId, yr: 2, cat: 'non-grant', tui: 25000, exam: 700, oth: 700 },
      { col: sitmId, crs: sitmBcaId, yr: 3, cat: 'non-grant', tui: 25000, exam: 700, oth: 700 },
    ];

    for (const f of fees) {
      await r()
        .input('col', mssql.Int,     f.col)
        .input('crs', mssql.Int,     f.crs)
        .input('yr',  mssql.Int,     f.yr)
        .input('cat', mssql.NVarChar, f.cat)
        .input('tui', mssql.Decimal, f.tui)
        .input('ex',  mssql.Decimal, f.exam)
        .input('oth', mssql.Decimal, f.oth)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM fee_structures WHERE college_id=@col AND course_id=@crs AND year_of_study=@yr AND category=@cat)
            INSERT INTO fee_structures (college_id,course_id,year_of_study,category,tuition_fee,exam_fee,other_fee)
            VALUES (@col,@crs,@yr,@cat,@tui,@ex,@oth);
        `);
    }
    console.log('Fee structures seeded');

    // ── REQUIRED DOCUMENTS ───────────────────────────────────
    const aadhaar = docIds['Aadhaar Card'];
    const photo   = docIds['Passport Photo'];
    const t10     = docIds['10th Marksheet'];
    const t12     = docIds['12th Marksheet'];
    const fyMark  = docIds['FY Marksheet'];
    const syMark  = docIds['SY Marksheet'];
    const leaving = docIds['Leaving Certificate'];
    const caste   = docIds['Caste Certificate'];
    const income  = docIds['Income Certificate'];

    const requiredDocs = [
      // VES BCA FY
      { col: vesId, crs: vesBcaId, yr: 1, doc: aadhaar, mand: 1 },
      { col: vesId, crs: vesBcaId, yr: 1, doc: photo,   mand: 1 },
      { col: vesId, crs: vesBcaId, yr: 1, doc: t10,     mand: 1 },
      { col: vesId, crs: vesBcaId, yr: 1, doc: t12,     mand: 1 },
      { col: vesId, crs: vesBcaId, yr: 1, doc: leaving, mand: 1 },
      { col: vesId, crs: vesBcaId, yr: 1, doc: caste,   mand: 0 },
      { col: vesId, crs: vesBcaId, yr: 1, doc: income,  mand: 0 },
      // VES BCA SY
      { col: vesId, crs: vesBcaId, yr: 2, doc: aadhaar, mand: 1 },
      { col: vesId, crs: vesBcaId, yr: 2, doc: photo,   mand: 1 },
      { col: vesId, crs: vesBcaId, yr: 2, doc: fyMark,  mand: 1 },
      // VES BCA TY
      { col: vesId, crs: vesBcaId, yr: 3, doc: aadhaar, mand: 1 },
      { col: vesId, crs: vesBcaId, yr: 3, doc: photo,   mand: 1 },
      { col: vesId, crs: vesBcaId, yr: 3, doc: syMark,  mand: 1 },
    ];

    for (const d of requiredDocs) {
      await r()
        .input('col',  mssql.Int, d.col)
        .input('crs',  mssql.Int, d.crs)
        .input('yr',   mssql.Int, d.yr)
        .input('doc',  mssql.Int, d.doc)
        .input('mand', mssql.Bit, d.mand)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM required_documents WHERE college_id=@col AND course_id=@crs AND year_of_study=@yr AND document_type_id=@doc)
            INSERT INTO required_documents (college_id,course_id,year_of_study,document_type_id,is_mandatory)
            VALUES (@col,@crs,@yr,@doc,@mand);
        `);
    }
    console.log('Required documents seeded');

    // ── ADMISSION PERIODS ────────────────────────────────────
    const periods = [
      { col: vesId,    crs: vesBcaId,  yr: 1, ay: '2026-27', start: '2026-05-01', end: '2026-06-30', seats: 60, fee: 500 },
      { col: vesId,    crs: vesBcaId,  yr: 2, ay: '2026-27', start: '2026-05-01', end: '2026-06-30', seats: 55, fee: 500 },
      { col: vesId,    crs: vesBcaId,  yr: 3, ay: '2026-27', start: '2026-05-01', end: '2026-06-30', seats: 50, fee: 500 },
      { col: vesId,    crs: vesComId,  yr: 1, ay: '2026-27', start: '2026-05-01', end: '2026-06-30', seats: 80, fee: 300 },
      { col: vesId,    crs: vesComId,  yr: 2, ay: '2026-27', start: '2026-05-01', end: '2026-06-30', seats: 75, fee: 300 },
      { col: vesId,    crs: vesComId,  yr: 3, ay: '2026-27', start: '2026-05-01', end: '2026-06-30', seats: 70, fee: 300 },
      { col: vesId,    crs: vesBscId,  yr: 1, ay: '2026-27', start: '2026-05-01', end: '2026-06-30', seats: 40, fee: 600 },
      { col: konkanId, crs: konComId,  yr: 1, ay: '2026-27', start: '2026-05-05', end: '2026-07-05', seats: 100,fee: 250 },
      { col: konkanId, crs: konComId,  yr: 2, ay: '2026-27', start: '2026-05-05', end: '2026-07-05', seats: 90, fee: 250 },
      { col: konkanId, crs: konBbaId,  yr: 1, ay: '2026-27', start: '2026-05-05', end: '2026-07-05', seats: 60, fee: 500 },
      { col: sitmId,   crs: sitmBcaId, yr: 1, ay: '2026-27', start: '2026-05-10', end: '2026-07-10', seats: 50, fee: 600 },
      { col: sitmId,   crs: sitmBcaId, yr: 2, ay: '2026-27', start: '2026-05-10', end: '2026-07-10', seats: 45, fee: 600 },
      { col: sitmId,   crs: sitmBcaId, yr: 3, ay: '2026-27', start: '2026-05-10', end: '2026-07-10', seats: 40, fee: 600 },
    ];

    for (const p of periods) {
      await r()
        .input('col',   mssql.Int,      p.col)
        .input('crs',   mssql.Int,      p.crs)
        .input('yr',    mssql.Int,      p.yr)
        .input('ay',    mssql.NVarChar, p.ay)
        .input('start', mssql.Date,     p.start)
        .input('end',   mssql.Date,     p.end)
        .input('seats', mssql.Int,      p.seats)
        .input('fee',   mssql.Decimal,  p.fee)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM admission_periods WHERE college_id=@col AND course_id=@crs AND year_of_study=@yr AND academic_year=@ay)
            INSERT INTO admission_periods (college_id,course_id,year_of_study,academic_year,start_date,end_date,total_seats,application_fee,is_active)
            VALUES (@col,@crs,@yr,@ay,@start,@end,@seats,@fee,1);
        `);
    }
    console.log('Admission periods seeded');

    // ── DEMO STUDENT ─────────────────────────────────────────
    await r()
      .input('name',  mssql.NVarChar, 'Aarav Shetty')
      .input('email', mssql.NVarChar, 'aarav@example.com')
      .input('hash',  mssql.NVarChar, studentHash)
      .input('phone', mssql.NVarChar, '9876543210')
      .input('dob',   mssql.Date,     '2006-03-15')
      .input('gen',   mssql.NVarChar, 'Male')
      .input('addr',  mssql.NVarChar, '12, Shiv Nagar, Near Temple')
      .input('city',  mssql.NVarChar, 'Vengurla')
      .input('cat',   mssql.NVarChar, 'general')
      .query(`
        IF NOT EXISTS (SELECT 1 FROM students WHERE email=@email)
          INSERT INTO students (full_name,email,password_hash,phone,dob,gender,address,city,category)
          VALUES (@name,@email,@hash,@phone,@dob,@gen,@addr,@city,@cat);
      `);
    console.log('Demo student seeded  →  email: aarav@example.com  password: Student@123');
    console.log('College admin credentials  →  password: Admin@123');

    await t.commit();
    console.log('\nAll seed data inserted successfully.');
  } catch (err) {
    await t.rollback();
    console.error('Seeding failed, rolled back:', err);
    process.exit(1);
  }

  await pool.close();
}

run();
