-- ============================================================
-- College Admission System — Full Database Schema
-- This file reflects the CURRENT state of the database.
-- Run on a fresh DB. For existing DBs use migration scripts.
-- ============================================================

-- ============================================================
-- COLLEGES
-- ============================================================
CREATE TABLE colleges (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    name                NVARCHAR(200)  NOT NULL,
    address             NVARCHAR(500),
    city                NVARCHAR(100),
    phone               NVARCHAR(20),
    email               NVARCHAR(150)  UNIQUE NOT NULL,
    admin_email         NVARCHAR(150)  UNIQUE NOT NULL,
    admin_password_hash NVARCHAR(255)  NOT NULL,
    college_code        NVARCHAR(20)   UNIQUE,
    application_fee     DECIMAL(10,2)  NULL,        -- per-application fee charged to students
    bank_account_name   NVARCHAR(200),
    bank_account_number NVARCHAR(50),
    bank_ifsc           NVARCHAR(20),
    bank_upi_id         NVARCHAR(100),
    created_at          DATETIME2 DEFAULT GETDATE()
);

-- ============================================================
-- COLLEGE ROLES (staff role definitions)
-- ============================================================
CREATE TABLE college_roles (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    college_id  INT           NOT NULL REFERENCES colleges(id),
    role_name   NVARCHAR(100) NOT NULL,
    created_at  DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT uq_college_role UNIQUE (college_id, role_name)
);

-- ============================================================
-- COLLEGE ROLE PERMISSIONS
-- Stores both functional permissions (e.g. review_application)
-- and nav visibility (e.g. nav:inbox) as separate rows.
-- can_write = 1 means granted / visible.
-- ============================================================
CREATE TABLE college_role_permissions (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    role_id     INT           NOT NULL REFERENCES college_roles(id) ON DELETE CASCADE,
    permission  NVARCHAR(100) NOT NULL,   -- e.g. 'review_application' or 'nav:inbox'
    can_write   BIT           NOT NULL DEFAULT 0,
    CONSTRAINT uq_role_permission UNIQUE (role_id, permission)
);

-- ============================================================
-- COLLEGE USERS (staff accounts)
-- ============================================================
CREATE TABLE college_users (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    college_id    INT           NOT NULL REFERENCES colleges(id),
    role_id       INT           NOT NULL REFERENCES college_roles(id),
    full_name     NVARCHAR(200) NOT NULL,
    email         NVARCHAR(150) UNIQUE NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    is_active     BIT           NOT NULL DEFAULT 1,
    created_at    DATETIME2 DEFAULT GETDATE()
);

-- ============================================================
-- ADMINS (super-admin accounts)
-- ============================================================
CREATE TABLE admins (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    name          NVARCHAR(200) NOT NULL,
    email         NVARCHAR(150) UNIQUE NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    created_at    DATETIME2 DEFAULT GETDATE()
);

-- ============================================================
-- STUDENTS
-- ============================================================
CREATE TABLE students (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    full_name       NVARCHAR(200) NOT NULL,
    email           NVARCHAR(150) UNIQUE NOT NULL,
    password_hash   NVARCHAR(255) NOT NULL,
    phone           NVARCHAR(20)  UNIQUE,
    dob             DATE,
    gender          NVARCHAR(10),
    address         NVARCHAR(500),
    city            NVARCHAR(100),
    aadhaar_number  NVARCHAR(20),
    category        NVARCHAR(30),   -- general / obc / sc / st
    created_at      DATETIME2 DEFAULT GETDATE()
);

-- ============================================================
-- FACULTY MASTER (programs offered per college)
-- PK is code_no (auto-int), not id, for legacy reasons.
-- ============================================================
CREATE TABLE faculty_master (
    code_no                 INT IDENTITY(1,1) PRIMARY KEY,
    college_id              INT           NOT NULL REFERENCES colleges(id),
    degree_course_code      NVARCHAR(20)  NOT NULL,
    degree_course_name      NVARCHAR(200) NOT NULL,
    duration_years          INT           NOT NULL DEFAULT 3,
    -- Semester unique codes (used for exam roll/registration numbering).
    -- Required count = duration_years * 2 (enforced at the application layer).
    unique_code_sem1        NVARCHAR(20)  NULL,
    unique_code_sem2        NVARCHAR(20)  NULL,
    unique_code_sem3        NVARCHAR(20)  NULL,
    unique_code_sem4        NVARCHAR(20)  NULL,
    unique_code_sem5        NVARCHAR(20)  NULL,
    unique_code_sem6        NVARCHAR(20)  NULL,
    unique_code_sem7        NVARCHAR(20)  NULL,
    unique_code_sem8        NVARCHAR(20)  NULL,
    unique_code_sem9        NVARCHAR(20)  NULL,
    unique_code_sem10       NVARCHAR(20)  NULL,
    -- Year-wise exam seat codes. Required count = duration_years.
    exam_seat_code_year1    NVARCHAR(20)  NULL,
    exam_seat_code_year2    NVARCHAR(20)  NULL,
    exam_seat_code_year3    NVARCHAR(20)  NULL,
    exam_seat_code_year4    NVARCHAR(20)  NULL,
    exam_seat_code_year5    NVARCHAR(20)  NULL,
    is_active               BIT           NOT NULL DEFAULT 1,
    created_by              NVARCHAR(100) NULL,
    modified_by             NVARCHAR(100) NULL,
    modified_on             DATETIME2     NULL,
    created_at              DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT uq_faculty_college_code UNIQUE (college_id, degree_course_code)
);

-- ============================================================
-- BANK MASTER (college bank accounts)
-- ============================================================
CREATE TABLE bank_master (
    ledger_code          INT IDENTITY(1,1) PRIMARY KEY,
    college_id           INT           NOT NULL REFERENCES colleges(id),
    bank_account_number  NVARCHAR(50)  NOT NULL,
    bank_name            NVARCHAR(200) NOT NULL,
    branch               NVARCHAR(200) NULL,
    ifsc_code            NVARCHAR(20)  NULL,
    account_type         NVARCHAR(50)  NULL,
    is_active            BIT           NOT NULL DEFAULT 1,
    modified_on          DATETIME2     NULL
);

-- ============================================================
-- COURSE MASTER (subject list per program-semester)
-- ============================================================
CREATE TABLE course_master (
    id                INT IDENTITY(1,1) PRIMARY KEY,
    college_id        INT           NOT NULL REFERENCES colleges(id),
    faculty_master_id INT           NOT NULL REFERENCES faculty_master(code_no),
    semester          INT           NOT NULL,
    course_code       NVARCHAR(30)  NOT NULL,
    course_title      NVARCHAR(200) NOT NULL,
    credits           DECIMAL(4,2)  NULL,
    max_internal      INT           NULL,
    min_internal      INT           NULL,
    max_sem_end       INT           NULL,
    min_sem_end       INT           NULL,
    max_total         INT           NULL,
    min_total         INT           NULL,
    subject_type      NVARCHAR(30)  NULL,   -- e.g. 'core', 'elective', 'practical'
    display_order     INT           NOT NULL DEFAULT 0,
    is_active         BIT           NOT NULL DEFAULT 1,
    modified_on       DATETIME2     NULL,
    CONSTRAINT uq_course_master UNIQUE (college_id, faculty_master_id, semester, course_code)
);

-- ============================================================
-- GROUP MASTER (optional grouping of courses for electives)
-- ============================================================
CREATE TABLE group_master (
    id                INT IDENTITY(1,1) PRIMARY KEY,
    college_id        INT           NOT NULL REFERENCES colleges(id),
    faculty_master_id INT           NOT NULL REFERENCES faculty_master(code_no),
    semester          INT           NULL,
    group_code        NVARCHAR(20)  NOT NULL,
    group_description NVARCHAR(300) NOT NULL,
    is_active         BIT           NOT NULL DEFAULT 1,
    modified_on       DATETIME2     NULL,
    CONSTRAINT uq_group_master UNIQUE (college_id, faculty_master_id, group_code)
);

-- ============================================================
-- GROUP COURSES (courses belonging to a group)
-- ============================================================
CREATE TABLE group_courses (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    group_id        INT           NOT NULL REFERENCES group_master(id) ON DELETE CASCADE,
    course_position INT           NOT NULL DEFAULT 0,
    course_code     NVARCHAR(30)  NOT NULL,
    course_title    NVARCHAR(200) NOT NULL DEFAULT '',
    -- A given (course_code, course_title) pair may appear at most once per group.
    -- Default SQL Server collation is case-insensitive, matching the API check.
    CONSTRAINT uq_group_course_combo UNIQUE (group_id, course_code, course_title)
);

-- ============================================================
-- DIVISION MASTER (class divisions per program-year)
-- ============================================================
CREATE TABLE division_master (
    id                INT IDENTITY(1,1) PRIMARY KEY,
    college_id        INT           NOT NULL REFERENCES colleges(id),
    faculty_master_id INT           NOT NULL REFERENCES faculty_master(code_no),
    year_level        NVARCHAR(10)  NOT NULL,   -- 'FY', 'SY', 'TY'
    class_year_code   NVARCHAR(20)  NULL,
    division_letter   CHAR(1)       NOT NULL,   -- 'A'–'J'
    funding_type      NVARCHAR(30)  NOT NULL,   -- 'grant', 'non-grant', 'self'
    is_active         BIT           NOT NULL DEFAULT 1,
    modified_on       DATETIME2     NULL,
    CONSTRAINT uq_division_master UNIQUE (college_id, faculty_master_id, year_level, division_letter)
);

-- ============================================================
-- FEES MASTER (fee heads per college)
-- ============================================================
CREATE TABLE fees_master (
    fees_code              INT IDENTITY(1,1) PRIMARY KEY,
    college_id             INT           NOT NULL REFERENCES colleges(id),
    fees_type              NVARCHAR(50)  NOT NULL,
    is_other_misc          BIT           NOT NULL DEFAULT 0,
    fees_head              NVARCHAR(200) NOT NULL,
    short_name             NVARCHAR(50)  NOT NULL,
    sequence_auto_fees     INT           NOT NULL DEFAULT 0,
    credit_to_bank_ledger  INT           NULL REFERENCES bank_master(ledger_code),
    is_refundable          BIT           NOT NULL DEFAULT 0,
    fees_cat1_amount       DECIMAL(10,2) NOT NULL DEFAULT 0,   -- general
    fees_cat2_amount       DECIMAL(10,2) NOT NULL DEFAULT 0,   -- obc
    fees_cat3_amount       DECIMAL(10,2) NOT NULL DEFAULT 0,   -- sc/st
    fees_cat4_amount       DECIMAL(10,2) NOT NULL DEFAULT 0,   -- custom/special
    cat4_description       NVARCHAR(200) NULL,
    is_active              BIT           NOT NULL DEFAULT 1,
    modified_on            DATETIME2     NULL
);

-- ============================================================
-- CLASSWISE FEES (fee amounts per program-year-fees_head)
-- ============================================================
CREATE TABLE classwise_fees (
    id                INT IDENTITY(1,1) PRIMARY KEY,
    college_id        INT           NOT NULL REFERENCES colleges(id),
    faculty_master_id INT           NOT NULL REFERENCES faculty_master(code_no),
    year_level        NVARCHAR(10)  NOT NULL,   -- 'FY', 'SY', 'TY'
    fees_code         INT           NOT NULL REFERENCES fees_master(fees_code),
    cat1_amount       DECIMAL(10,2) NULL,
    cat2_amount       DECIMAL(10,2) NULL,
    cat3_amount       DECIMAL(10,2) NULL,
    cat4_amount       DECIMAL(10,2) NULL,
    CONSTRAINT uq_classwise_fees UNIQUE (college_id, faculty_master_id, year_level, fees_code)
);

-- ============================================================
-- CLASS MASTER (FY/SY/TY class entries per program per college)
-- ============================================================
CREATE TABLE class_master (
    id                INT IDENTITY(1,1) PRIMARY KEY,
    college_id        INT          NOT NULL REFERENCES colleges(id),
    faculty_master_id INT          NOT NULL REFERENCES faculty_master(code_no),
    year_of_study     TINYINT      NOT NULL CHECK (year_of_study IN (1,2,3)),
    label             NVARCHAR(50) NULL,
    is_active         BIT          NOT NULL DEFAULT 1,
    CONSTRAINT uq_class_master UNIQUE (college_id, faculty_master_id, year_of_study)
);

-- ============================================================
-- DOCUMENT TYPES (global master list)
-- ============================================================
CREATE TABLE document_types (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    name        NVARCHAR(100) NOT NULL,
    description NVARCHAR(300) NULL,
    created_at  DATETIME2 DEFAULT GETDATE()
);

-- ============================================================
-- COLLEGE REQUIRED DOCUMENTS (per college/program/year)
-- ============================================================
CREATE TABLE college_required_documents (
    id                INT IDENTITY(1,1) PRIMARY KEY,
    college_id        INT NOT NULL REFERENCES colleges(id),
    faculty_master_id INT NOT NULL REFERENCES faculty_master(code_no),
    year_of_study     INT NOT NULL CHECK (year_of_study IN (1,2,3)),
    document_type_id  INT NOT NULL REFERENCES document_types(id),
    is_mandatory      BIT NOT NULL DEFAULT 1,
    CONSTRAINT uq_college_req_doc UNIQUE (college_id, faculty_master_id, year_of_study, document_type_id)
);

-- ============================================================
-- ADMISSION PERIODS
-- ============================================================
CREATE TABLE admission_periods (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    college_id      INT           NOT NULL REFERENCES colleges(id),
    course_id       INT           NOT NULL REFERENCES faculty_master(code_no),
    year_of_study   INT           NOT NULL CHECK (year_of_study IN (1,2,3)),
    academic_year   NVARCHAR(10)  NOT NULL,   -- e.g. 2026-27
    start_date      DATE          NOT NULL,
    end_date        DATE          NOT NULL,
    total_seats     INT           NOT NULL,
    filled_seats    INT           NOT NULL DEFAULT 0,
    is_active       BIT           NOT NULL DEFAULT 1,
    is_disabled     BIT           NOT NULL DEFAULT 0,
    created_at      DATETIME2 DEFAULT GETDATE()
);
GO

-- ============================================================
-- ADMISSION PERIODS ARCHIVE (audit log)
-- Mirrors admission_periods columns + audit metadata. Populated by
-- AFTER INSERT/UPDATE/DELETE triggers below. No FKs / IDENTITY on the
-- mirror columns — archive rows are historical snapshots.
-- ============================================================
CREATE TABLE [dbo].[admission_periods$Arc] (
    arc_id              INT IDENTITY(1,1) PRIMARY KEY,
    id                  INT           NULL,
    college_id          INT           NULL,
    course_id           INT           NULL,
    year_of_study       INT           NULL,
    academic_year       NVARCHAR(10)  NULL,
    start_date          DATE          NULL,
    end_date            DATE          NULL,
    total_seats         INT           NULL,
    filled_seats        INT           NULL,
    is_active           BIT           NULL,
    is_disabled         BIT           NULL,
    created_at          DATETIME2     NULL,
    action_type         NVARCHAR(10)  NOT NULL CHECK (action_type IN ('INSERT','UPDATE','DELETE')),
    action_date         DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    action_by           NVARCHAR(150) NULL,
    machine_mac_address NVARCHAR(50)  NULL,
    comments            NVARCHAR(500) NULL,
    archived_date       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX ix_admission_periods_arc_action_date ON [dbo].[admission_periods$Arc] (action_date);
CREATE INDEX ix_admission_periods_arc_action_type ON [dbo].[admission_periods$Arc] (action_type);
CREATE INDEX ix_admission_periods_arc_action_by   ON [dbo].[admission_periods$Arc] (action_by);
GO

-- Triggers — see migrate_admission_periods_archive.sql for the trigger
-- bodies. They populate [admission_periods$Arc] with TRY/CATCH soft logging
-- and read SESSION_CONTEXT keys 'app_user_id' / 'app_machine_mac' /
-- 'app_comments' for the audit columns.
-- ============================================================

-- ============================================================
-- STUDENT DOCUMENTS (uploaded once per student per type)
-- ============================================================
CREATE TABLE student_documents (
    id                INT IDENTITY(1,1) PRIMARY KEY,
    student_id        INT           NOT NULL REFERENCES students(id),
    document_type_id  INT           NOT NULL REFERENCES document_types(id),
    file_name         NVARCHAR(300) NOT NULL,
    file_path         NVARCHAR(500) NOT NULL,
    uploaded_at       DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT uq_student_doc UNIQUE (student_id, document_type_id)
);

-- ============================================================
-- APPLICATIONS (central state machine table)
-- ============================================================
CREATE TABLE applications (
    id                      INT IDENTITY(1,1) PRIMARY KEY,
    registration_number     NVARCHAR(30)   NULL,
    student_id              INT            NOT NULL REFERENCES students(id),
    college_id              INT            NOT NULL REFERENCES colleges(id),
    course_id               INT            NOT NULL REFERENCES faculty_master(code_no),
    year_of_study           INT            NOT NULL CHECK (year_of_study IN (1,2,3)),
    academic_year           NVARCHAR(10)   NOT NULL,
    admission_period_id     INT            NOT NULL REFERENCES admission_periods(id),

    -- Status machine
    status                  NVARCHAR(30)   NOT NULL DEFAULT 'draft'
                            CONSTRAINT chk_applications_status CHECK (status IN (
                                'draft','payment_pending','submitted','under_review',
                                'correction_requested','correction_done',
                                'doc_verified',
                                'confirmed','fees_paid','roll_assigned','enrolled',
                                'rejected','cancelled'
                            )),
    correction_note         NVARCHAR(1000) NULL,
    rejection_reason        NVARCHAR(500)  NULL,
    cancellation_reason     NVARCHAR(500)  NULL,

    -- Fee amounts set by college at confirmation
    fee_total_amount        DECIMAL(12,2)  NULL,
    fee_pay_now_amount      DECIMAL(12,2)  NULL,

    -- Identifiers
    roll_number             NVARCHAR(20)   NULL,

    -- Payment flags (first instalment threshold, NOT "fully paid")
    application_fee_paid    BIT            NOT NULL DEFAULT 0,
    college_fee_paid        BIT            NOT NULL DEFAULT 0,   -- set when fee_pay_now_amount reached

    -- Application form snapshot fields (captured at submit time)
    app_surname             NVARCHAR(100)  NULL,
    app_first_name          NVARCHAR(100)  NULL,
    app_middle_name         NVARCHAR(100)  NULL,
    app_mobile              NVARCHAR(20)   NULL,
    app_email               NVARCHAR(150)  NULL,
    app_category            NVARCHAR(30)   NULL,   -- caste category for fee slab
    fees_category           NVARCHAR(30)   NULL,
    app_division            NVARCHAR(5)    NULL,   -- division letter for fee determination

    -- Timestamps
    submitted_at            DATETIME2 NULL,
    approved_at             DATETIME2 NULL,
    confirmed_at            DATETIME2 NULL,
    enrolled_at             DATETIME2 NULL,
    status_updated_at       DATETIME2 NULL,
    created_at              DATETIME2 DEFAULT GETDATE(),
    updated_at              DATETIME2 DEFAULT GETDATE()
);

-- Unique index on registration_number (NULL-safe: allows multiple NULLs for drafts)
CREATE UNIQUE INDEX uix_applications_reg_number
    ON applications (registration_number)
    WHERE registration_number IS NOT NULL;

-- ============================================================
-- APPLICATION DOCUMENTS (links application to student_documents)
-- ============================================================
CREATE TABLE application_documents (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    application_id      INT       NOT NULL REFERENCES applications(id),
    student_document_id INT       NOT NULL REFERENCES student_documents(id),
    document_type_id    INT       NOT NULL REFERENCES document_types(id),
    is_verified         BIT       NOT NULL DEFAULT 0,
    verified_at         DATETIME2 NULL,
    created_at          DATETIME2 DEFAULT GETDATE()
);

-- ============================================================
-- APPLICATION PREVIOUS EXAM (academic history)
-- ============================================================
CREATE TABLE application_previous_exam (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    application_id  INT           NOT NULL REFERENCES applications(id),
    board_name      NVARCHAR(200) NULL,
    passing_year    INT           NULL,
    seat_number     NVARCHAR(50)  NULL,
    total_marks     DECIMAL(8,2)  NULL,
    obtained_marks  DECIMAL(8,2)  NULL,
    percentage      DECIMAL(5,2)  NULL,
    created_at      DATETIME2 DEFAULT GETDATE()
);

-- ============================================================
-- APPLICATION PREVIOUS EXAM SUBJECTS
-- ============================================================
CREATE TABLE application_previous_exam_subjects (
    id                          INT IDENTITY(1,1) PRIMARY KEY,
    application_previous_exam_id INT          NOT NULL REFERENCES application_previous_exam(id) ON DELETE CASCADE,
    subject_name                NVARCHAR(200) NOT NULL,
    marks_obtained              DECIMAL(8,2)  NULL,
    marks_max                   DECIMAL(8,2)  NULL
);

-- ============================================================
-- APPLICATION ACTIVITY LOG (immutable audit trail)
-- ============================================================
CREATE TABLE application_activity_log (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    application_id  INT            NOT NULL REFERENCES applications(id),
    action          NVARCHAR(60)   NOT NULL,
    actor_role      NVARCHAR(20)   NOT NULL,   -- 'student' | 'college' | 'system'
    note            NVARCHAR(1000) NULL,
    created_at      DATETIME2 DEFAULT GETDATE()
);

-- ============================================================
-- APPLICATION SUBJECTS (subject selections after roll assignment)
-- ============================================================
CREATE TABLE application_subjects (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    application_id  INT       NOT NULL REFERENCES applications(id),
    subject_id      INT       NOT NULL,        -- references subjects table if used
    created_at      DATETIME2 DEFAULT GETDATE()
);

-- ============================================================
-- PAYMENTS
-- Columns: razorpay_order_id / razorpay_payment_id used for
-- Razorpay integration; CASH- prefix used for offline payments.
-- ============================================================
CREATE TABLE payments (
    id                   INT IDENTITY(1,1) PRIMARY KEY,
    application_id       INT           NOT NULL REFERENCES applications(id),
    payment_type         NVARCHAR(30)  NOT NULL
                         CHECK (payment_type IN ('application_fee','college_fee','college_fee_installment')),
    amount               DECIMAL(10,2) NOT NULL,
    razorpay_order_id    NVARCHAR(100) NULL,
    razorpay_payment_id  NVARCHAR(100) NULL,
    status               NVARCHAR(20)  NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','success','failed','cancelled')),
    attempted_at         DATETIME2 DEFAULT GETDATE(),
    completed_at         DATETIME2 NULL
);

-- ============================================================
-- LEGACY TABLES (kept for backward compatibility)
-- ============================================================

-- Old courses table (replaced by faculty_master)
CREATE TABLE courses (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    college_id     INT            NOT NULL REFERENCES colleges(id),
    name           NVARCHAR(100)  NOT NULL,
    duration_years INT            NOT NULL DEFAULT 3,
    category       NVARCHAR(20)   NOT NULL CHECK (category IN ('grant','non-grant')),
    created_at     DATETIME2 DEFAULT GETDATE()
);

-- Old subjects table
CREATE TABLE subjects (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    course_id       INT           NOT NULL REFERENCES courses(id),
    year_of_study   INT           NOT NULL CHECK (year_of_study IN (1,2,3)),
    name            NVARCHAR(200) NOT NULL,
    subject_type    NVARCHAR(20)  NOT NULL CHECK (subject_type IN ('core','elective')),
    elective_group  NVARCHAR(10)  NULL,
    created_at      DATETIME2 DEFAULT GETDATE()
);

-- Old fee_structures table (fallback in payments.js)
CREATE TABLE fee_structures (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    college_id      INT           NOT NULL REFERENCES colleges(id),
    course_id       INT           NOT NULL REFERENCES courses(id),
    year_of_study   INT           NOT NULL CHECK (year_of_study IN (1,2,3)),
    category        NVARCHAR(20)  NOT NULL CHECK (category IN ('grant','non-grant')),
    tuition_fee     DECIMAL(10,2) NOT NULL DEFAULT 0,
    exam_fee        DECIMAL(10,2) NOT NULL DEFAULT 0,
    other_fee       DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at      DATETIME2 DEFAULT GETDATE()
);

-- Old required_documents table (replaced by college_required_documents)
CREATE TABLE required_documents (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    college_id       INT NOT NULL REFERENCES colleges(id),
    course_id        INT NOT NULL REFERENCES courses(id),
    year_of_study    INT NOT NULL CHECK (year_of_study IN (1,2,3)),
    document_type_id INT NOT NULL REFERENCES document_types(id),
    is_mandatory     BIT NOT NULL DEFAULT 1,
    created_at       DATETIME2 DEFAULT GETDATE()
);

-- ============================================================
-- BONAFIDE CERTIFICATE
-- Certificate numbers are auto-generated server-side as
-- "BON/<calendar-year>/<4-digit-serial>" and are unique within a college.
-- ============================================================
CREATE TABLE certificate_bonafide (
    bonafide_id      INT IDENTITY(1,1) PRIMARY KEY,
    college_id       INT           NOT NULL REFERENCES colleges(id),
    certificate_no   NVARCHAR(50)  NOT NULL,
    certificate_date DATE          NOT NULL,
    reg_no           NVARCHAR(50)  NULL,
    student_name     NVARCHAR(200) NOT NULL,
    gender           NVARCHAR(10)  NULL,
    is_ex_student    BIT           NOT NULL DEFAULT 0,
    class_name       NVARCHAR(100) NULL,
    academic_year    NVARCHAR(20)  NULL,
    birth_date       DATE          NULL,
    roll_no          INT           NULL,
    caste            NVARCHAR(100) NULL,
    created_by       INT           NULL,
    created_date     DATETIME      NOT NULL DEFAULT GETDATE(),
    updated_by       INT           NULL,
    updated_date     DATETIME      NULL,
    is_deleted       BIT           NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX ix_cert_bonafide_certificate_no
    ON certificate_bonafide (college_id, certificate_no)
    WHERE is_deleted = 0;
CREATE INDEX ix_cert_bonafide_reg_no
    ON certificate_bonafide (college_id, reg_no);

-- ============================================================
-- CHARACTER CERTIFICATE
-- Certificate numbers are auto-generated server-side as
-- "CHAR/<calendar-year>/<4-digit-serial>" and are unique within a college.
-- ============================================================
CREATE TABLE certificate_character (
    character_certificate_id INT IDENTITY(1,1) PRIMARY KEY,
    college_id               INT           NOT NULL REFERENCES colleges(id),
    certificate_no           NVARCHAR(50)  NOT NULL,
    certificate_date         DATE          NOT NULL,
    reg_no                   NVARCHAR(50)  NULL,
    student_name             NVARCHAR(200) NOT NULL,
    gender                   NVARCHAR(10)  NULL,
    is_ex_student            BIT           NOT NULL DEFAULT 0,
    class_name               NVARCHAR(100) NULL,
    academic_year            NVARCHAR(20)  NULL,
    known_from_years         INT           NULL,
    birth_date               DATE          NULL,
    roll_no                  INT           NULL,
    caste                    NVARCHAR(100) NULL,
    created_by               INT           NULL,
    created_date             DATETIME      NOT NULL DEFAULT GETDATE(),
    updated_by               INT           NULL,
    updated_date             DATETIME      NULL,
    is_deleted               BIT           NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX ix_cert_character_certificate_no
    ON certificate_character (college_id, certificate_no)
    WHERE is_deleted = 0;
CREATE INDEX ix_cert_character_reg_no
    ON certificate_character (college_id, reg_no);

-- ============================================================
-- NO OBJECTION CERTIFICATE
-- Certificate numbers are auto-generated server-side as
-- "NOC/<calendar-year>/<4-digit-serial>" and are unique within a college.
-- ============================================================
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
);
CREATE UNIQUE INDEX ix_cert_noc_certificate_no
    ON certificate_noc (college_id, certificate_no)
    WHERE is_deleted = 0;
CREATE INDEX ix_cert_noc_reg_no
    ON certificate_noc (college_id, reg_no);
CREATE INDEX ix_cert_noc_prn_no
    ON certificate_noc (college_id, prn_no);
