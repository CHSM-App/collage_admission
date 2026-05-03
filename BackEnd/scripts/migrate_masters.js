/**
 * migrate_masters.js
 * ─────────────────────────────────────────────────────────────
 * Creates all 6 master tables and migrates existing data:
 *   courses   → faculty_master  (same IDs preserved)
 *   subjects  → course_master   (year_of_study mapped to semester: year*2-1)
 *
 * Run: node scripts/migrate_masters.js
 * Rollback: node scripts/rollback_masters.js
 */

require('dotenv').config()
const mssql = require('mssql')

const cfg = {
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER, database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT),
  options: { encrypt: true, trustServerCertificate: true },
}

async function columnExists(pool, table, col) {
  const r = await pool.request().query(
    `SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('${table}') AND name='${col}'`
  )
  return r.recordset.length > 0
}

async function tableExists(pool, table) {
  const r = await pool.request().query(
    `SELECT 1 FROM sys.tables WHERE name='${table}'`
  )
  return r.recordset.length > 0
}

async function indexExists(pool, name) {
  const r = await pool.request().query(
    `SELECT 1 FROM sys.indexes WHERE name='${name}'`
  )
  return r.recordset.length > 0
}

async function run() {
  const pool = await mssql.connect(cfg)
  console.log('Connected to DB.')

  // ── 1. FACULTY MASTER ────────────────────────────────────────
  console.log('\n[1/7] Creating faculty_master...')
  if (!await tableExists(pool, 'faculty_master')) {
    await pool.request().query(`
      CREATE TABLE faculty_master (
        code_no               INT IDENTITY(1,1) PRIMARY KEY,
        college_id            INT NOT NULL REFERENCES colleges(id),
        degree_course_code    NVARCHAR(30)  NOT NULL,
        degree_course_name    NVARCHAR(200) NOT NULL,
        duration_years        INT NOT NULL DEFAULT 3,
        -- University semester codes (nullable; PG may use only 4)
        unique_code_sem1      NVARCHAR(30) NULL,
        unique_code_sem2      NVARCHAR(30) NULL,
        unique_code_sem3      NVARCHAR(30) NULL,
        unique_code_sem4      NVARCHAR(30) NULL,
        unique_code_sem5      NVARCHAR(30) NULL,
        unique_code_sem6      NVARCHAR(30) NULL,
        -- Year-level exam seat prefix codes (characters only)
        exam_seat_code_year1  NVARCHAR(20) NULL,
        exam_seat_code_year2  NVARCHAR(20) NULL,
        exam_seat_code_year3  NVARCHAR(20) NULL,
        is_active             BIT NOT NULL DEFAULT 1,
        created_by            NVARCHAR(100) NULL,
        created_on            DATETIME2 DEFAULT GETDATE(),
        modified_by           NVARCHAR(100) NULL,
        modified_on           DATETIME2 NULL,
        CONSTRAINT uq_faculty_college_code UNIQUE (college_id, degree_course_code)
      )
    `)
    console.log('  faculty_master created.')
  } else {
    console.log('  faculty_master already exists, skipping CREATE.')
  }

  // ── 2. BANK MASTER ───────────────────────────────────────────
  console.log('\n[2/7] Creating bank_master...')
  if (!await tableExists(pool, 'bank_master')) {
    await pool.request().query(`
      CREATE TABLE bank_master (
        ledger_code           INT IDENTITY(1,1) PRIMARY KEY,
        college_id            INT NOT NULL REFERENCES colleges(id),
        bank_account_number   NVARCHAR(30)  NOT NULL,
        bank_name             NVARCHAR(200) NOT NULL,
        branch                NVARCHAR(200) NULL,
        ifsc_code             NVARCHAR(20)  NULL,
        account_type          NVARCHAR(10)  NULL CHECK (account_type IN ('Savings','Current')),
        is_active             BIT NOT NULL DEFAULT 1,
        created_on            DATETIME2 DEFAULT GETDATE(),
        modified_on           DATETIME2 NULL
      )
    `)
    console.log('  bank_master created.')
  } else {
    console.log('  bank_master already exists, skipping CREATE.')
  }

  // ── 3. COURSE MASTER (subjects per semester) ─────────────────
  console.log('\n[3/7] Creating course_master...')
  if (!await tableExists(pool, 'course_master')) {
    await pool.request().query(`
      CREATE TABLE course_master (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        college_id          INT NOT NULL REFERENCES colleges(id),
        faculty_master_id   INT NOT NULL REFERENCES faculty_master(code_no),
        semester            INT NOT NULL CHECK (semester BETWEEN 1 AND 6),
        course_code         NVARCHAR(30)  NOT NULL,
        course_title        NVARCHAR(300) NOT NULL,
        credits             DECIMAL(4,1)  NULL,
        max_internal        INT NULL,
        min_internal        INT NULL,
        max_sem_end         INT NULL,
        min_sem_end         INT NULL,
        max_total           INT NULL,
        min_total           INT NULL,
        subject_type        NVARCHAR(30)  NULL
                            CHECK (subject_type IN (
                              'Core','Elective','Practical','Project',
                              'Foundation','AbilityEnhancement'
                            )),
        display_order       INT NOT NULL DEFAULT 0,
        is_active           BIT NOT NULL DEFAULT 1,
        created_on          DATETIME2 DEFAULT GETDATE(),
        modified_on         DATETIME2 NULL,
        CONSTRAINT uq_course_master UNIQUE (college_id, faculty_master_id, semester, course_code)
      )
    `)
    console.log('  course_master created.')
  } else {
    console.log('  course_master already exists, skipping CREATE.')
  }

  // ── 4. GROUP MASTER ──────────────────────────────────────────
  console.log('\n[4/7] Creating group_master + group_courses...')
  if (!await tableExists(pool, 'group_master')) {
    await pool.request().query(`
      CREATE TABLE group_master (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        college_id          INT NOT NULL REFERENCES colleges(id),
        faculty_master_id   INT NOT NULL REFERENCES faculty_master(code_no),
        semester            INT NOT NULL CHECK (semester BETWEEN 1 AND 6),
        group_code          NVARCHAR(20)  NOT NULL,
        group_description   NVARCHAR(300) NOT NULL,
        is_active           BIT NOT NULL DEFAULT 1,
        created_on          DATETIME2 DEFAULT GETDATE(),
        modified_on         DATETIME2 NULL,
        -- TODO: confirm with stakeholder whether group_code is unique per college+course+semester
        CONSTRAINT uq_group_master UNIQUE (college_id, faculty_master_id, semester, group_code)
      )
    `)
    console.log('  group_master created.')
  } else {
    console.log('  group_master already exists, skipping CREATE.')
  }

  if (!await tableExists(pool, 'group_courses')) {
    await pool.request().query(`
      CREATE TABLE group_courses (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        group_id        INT NOT NULL REFERENCES group_master(id) ON DELETE CASCADE,
        course_position INT NOT NULL CHECK (course_position BETWEEN 1 AND 11),
        course_code     NVARCHAR(30)  NOT NULL,
        course_title    NVARCHAR(300) NOT NULL,
        CONSTRAINT uq_group_course_pos UNIQUE (group_id, course_position)
      )
    `)
    console.log('  group_courses created.')
  } else {
    console.log('  group_courses already exists, skipping CREATE.')
  }

  // ── 5. DIVISION MASTER ───────────────────────────────────────
  console.log('\n[5/7] Creating division_master...')
  if (!await tableExists(pool, 'division_master')) {
    await pool.request().query(`
      CREATE TABLE division_master (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        college_id          INT NOT NULL REFERENCES colleges(id),
        faculty_master_id   INT NOT NULL REFERENCES faculty_master(code_no),
        year_level          NVARCHAR(2) NOT NULL CHECK (year_level IN ('FY','SY','TY')),
        class_year_code     NVARCHAR(20) NOT NULL,   -- e.g. FYBA, SYBCom
        division_letter     CHAR(1) NOT NULL CHECK (division_letter IN ('A','B','C','D','E','F','G','H','I','J')),
        -- TODO: confirm with stakeholder: 'Both' means mixed seats or accepts either type
        funding_type        NVARCHAR(12) NOT NULL CHECK (funding_type IN ('Granted','NonGranted','Both')),
        is_active           BIT NOT NULL DEFAULT 1,
        created_on          DATETIME2 DEFAULT GETDATE(),
        modified_on         DATETIME2 NULL,
        CONSTRAINT uq_division_master UNIQUE (college_id, faculty_master_id, year_level, division_letter)
      )
    `)
    console.log('  division_master created.')
  } else {
    console.log('  division_master already exists, skipping CREATE.')
  }

  // ── 6. FEES MASTER ───────────────────────────────────────────
  console.log('\n[6/7] Creating fees_master + classwise_fees...')
  if (!await tableExists(pool, 'fees_master')) {
    await pool.request().query(`
      CREATE TABLE fees_master (
        fees_code               INT IDENTITY(1,1) PRIMARY KEY,
        college_id              INT NOT NULL REFERENCES colleges(id),
        fees_type               NVARCHAR(15) NOT NULL
                                CHECK (fees_type IN ('Student','Misc','ExamFees')),
        is_other_misc           BIT NOT NULL DEFAULT 0,
        fees_head               NVARCHAR(200) NOT NULL,
        short_name              NVARCHAR(30)  NOT NULL,
        sequence_auto_fees      INT NOT NULL DEFAULT 0,
        credit_to_bank_ledger   INT NULL REFERENCES bank_master(ledger_code),
        is_refundable           BIT NOT NULL DEFAULT 0,
        -- Cat1=Open/General(Full), Cat2=EBC/PTC/STC/Army, Cat3=SC/ST/OBC/BCC, Cat4=configurable
        fees_cat1_amount        DECIMAL(10,2) NOT NULL DEFAULT 0,
        fees_cat2_amount        DECIMAL(10,2) NOT NULL DEFAULT 0,
        fees_cat3_amount        DECIMAL(10,2) NOT NULL DEFAULT 0,
        fees_cat4_amount        DECIMAL(10,2) NOT NULL DEFAULT 0,
        -- TODO: confirm with stakeholder the official institution definition of Cat-4
        cat4_description        NVARCHAR(100) NULL DEFAULT 'FF/PH/Widows/Govt.Wards',
        is_active               BIT NOT NULL DEFAULT 1,
        created_on              DATETIME2 DEFAULT GETDATE(),
        modified_on             DATETIME2 NULL
      )
    `)
    console.log('  fees_master created.')
  } else {
    console.log('  fees_master already exists, skipping CREATE.')
  }

  if (!await tableExists(pool, 'classwise_fees')) {
    await pool.request().query(`
      CREATE TABLE classwise_fees (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        college_id          INT NOT NULL REFERENCES colleges(id),
        faculty_master_id   INT NOT NULL REFERENCES faculty_master(code_no),
        year_level          NVARCHAR(2) NOT NULL CHECK (year_level IN ('FY','SY','TY')),
        fees_code           INT NOT NULL REFERENCES fees_master(fees_code),
        -- Override amounts per class-year (NULL = use fees_master base amount)
        cat1_amount         DECIMAL(10,2) NULL,
        cat2_amount         DECIMAL(10,2) NULL,
        cat3_amount         DECIMAL(10,2) NULL,
        cat4_amount         DECIMAL(10,2) NULL,
        CONSTRAINT uq_classwise_fees UNIQUE (college_id, faculty_master_id, year_level, fees_code)
      )
    `)
    console.log('  classwise_fees created.')
  } else {
    console.log('  classwise_fees already exists, skipping CREATE.')
  }

  // ── 7. FEE OVERRIDE AUDIT TABLE ──────────────────────────────
  console.log('\n[7/7] Creating fee_override_audit...')
  if (!await tableExists(pool, 'fee_override_audit')) {
    await pool.request().query(`
      CREATE TABLE fee_override_audit (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        application_id      INT NOT NULL REFERENCES applications(id),
        field_name          NVARCHAR(50) NOT NULL,  -- 'fees_category_slab' | 'payment_mode'
        original_value      NVARCHAR(50) NOT NULL,
        new_value           NVARCHAR(50) NOT NULL,
        override_remark     NVARCHAR(500) NOT NULL,
        overridden_by       NVARCHAR(150) NOT NULL,
        overridden_at       DATETIME2 DEFAULT GETDATE()
      )
    `)
    console.log('  fee_override_audit created.')
  } else {
    console.log('  fee_override_audit already exists, skipping CREATE.')
  }

  // ── MIGRATE: courses → faculty_master ────────────────────────
  console.log('\nMigrating courses → faculty_master...')
  const existing = await pool.request().query(
    `SELECT COUNT(*) AS cnt FROM faculty_master`
  )
  if (existing.recordset[0].cnt === 0) {
    // Back up courses table
    if (!await tableExists(pool, 'courses_backup')) {
      await pool.request().query(`SELECT * INTO courses_backup FROM courses`)
      console.log('  courses_backup created.')
    }

    // Map courses → faculty_master preserving IDs
    const courses = await pool.request().query(`SELECT * FROM courses ORDER BY id`)
    const nameMap = {
      'BCA':    { code: 'BCA',    name: 'Bachelor of Computer Applications' },
      'BCom':   { code: 'BCOM',   name: 'Bachelor of Commerce' },
      'BSc-IT': { code: 'BSCIT',  name: 'Bachelor of Science (Information Technology)' },
      'BBA':    { code: 'BBA',    name: 'Bachelor of Business Administration' },
    }

    // IDENTITY_INSERT must be ON in the SAME batch as the INSERT (session-scoped in MSSQL).
    // Use a single query string per row combining SET + INSERT.
    for (const c of courses.recordset) {
      const mapped = nameMap[c.name] || { code: c.name.toUpperCase().replace(/[^A-Z0-9]/g,''), name: c.name }
      // Inline values directly — safe here because values come from DB, not user input
      const escapedCode = mapped.code.replace(/'/g, "''")
      const escapedName = mapped.name.replace(/'/g, "''")
      await pool.request().query(`
        SET IDENTITY_INSERT faculty_master ON;
        INSERT INTO faculty_master (code_no,college_id,degree_course_code,degree_course_name,duration_years)
        VALUES (${c.id},${c.college_id},'${escapedCode}','${escapedName}',${c.duration_years});
        SET IDENTITY_INSERT faculty_master OFF;
      `)
      console.log(`  Migrated course id=${c.id} "${c.name}" → faculty_master code=${mapped.code}`)
    }
  } else {
    console.log('  faculty_master already has data, skipping migration.')
  }

  // ── MIGRATE: subjects → course_master ────────────────────────
  console.log('\nMigrating subjects → course_master...')
  const cmCount = await pool.request().query(`SELECT COUNT(*) AS cnt FROM course_master`)
  if (cmCount.recordset[0].cnt === 0) {
    if (!await tableExists(pool, 'subjects_backup')) {
      await pool.request().query(`SELECT * INTO subjects_backup FROM subjects`)
      console.log('  subjects_backup created.')
    }

    const subjects = await pool.request().query(`SELECT * FROM subjects ORDER BY id`)
    const typeMap = { 'core': 'Core', 'elective': 'Elective' }

    // Need to map course_id → faculty_master_id (same IDs after migration)
    for (const s of subjects.recordset) {
      // semester = year_of_study * 2 - 1 (odd semesters: 1,3,5)
      const semester = s.year_of_study * 2 - 1
      // course_code: derive from name (slugify first 10 chars)
      const courseCode = s.name.toUpperCase().replace(/[^A-Z0-9]/g,'').substring(0, 15)

      // Get college_id from faculty_master (same id as course_id)
      const fm = await pool.request()
        .input('fid', mssql.Int, s.course_id)
        .query(`SELECT college_id FROM faculty_master WHERE code_no=@fid`)

      if (!fm.recordset.length) {
        console.log(`  SKIP subject id=${s.id} — no faculty_master for course_id=${s.course_id}`)
        continue
      }
      const collegeId = fm.recordset[0].college_id

      await pool.request()
        .input('cid',  mssql.Int,      collegeId)
        .input('fid',  mssql.Int,      s.course_id)
        .input('sem',  mssql.Int,      semester)
        .input('cc',   mssql.NVarChar, courseCode)
        .input('ct',   mssql.NVarChar, s.name)
        .input('st',   mssql.NVarChar, typeMap[s.subject_type] || 'Core')
        .input('ord',  mssql.Int,      s.id)
        .query(`
          INSERT INTO course_master (college_id,faculty_master_id,semester,course_code,course_title,subject_type,display_order)
          VALUES (@cid,@fid,@sem,@cc,@ct,@st,@ord)
        `)
      console.log(`  Migrated subject id=${s.id} "${s.name}" → sem=${semester}`)
    }
  } else {
    console.log('  course_master already has data, skipping migration.')
  }

  // ── ADD college_id column to applications if needed ──────────
  // applications.college_id already exists per schema.sql — no change needed

  console.log('\n✓ Migration complete.')
  await pool.close()
}

run().catch(err => { console.error(err); process.exit(1) })
