-- ============================================================
-- 001_base_schema.sql
-- Base schema: all core tables as they exist right now.
-- Run on a FRESH database only.
-- For existing databases, start from 002 onwards.
-- ============================================================

-- ============================================================
-- COLLEGES
-- ============================================================
IF OBJECT_ID('colleges', 'U') IS NULL
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
    application_fee     DECIMAL(12,2)  NULL,
    bank_account_name   NVARCHAR(200),
    bank_account_number NVARCHAR(50),
    bank_ifsc           NVARCHAR(20),
    bank_upi_id         NVARCHAR(100),
    created_at          DATETIME2 DEFAULT GETDATE()
);
GO

-- ============================================================
-- COLLEGE ROLES
-- ============================================================
IF OBJECT_ID('college_roles', 'U') IS NULL
CREATE TABLE college_roles (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    college_id  INT           NOT NULL REFERENCES colleges(id),
    role_name   NVARCHAR(100) NOT NULL,
    created_at  DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT uq_college_role UNIQUE (college_id, role_name)
);
GO

-- ============================================================
-- COLLEGE ROLE PERMISSIONS
-- ============================================================
IF OBJECT_ID('college_role_permissions', 'U') IS NULL
CREATE TABLE college_role_permissions (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    role_id     INT           NOT NULL REFERENCES college_roles(id) ON DELETE CASCADE,
    permission  NVARCHAR(100) NOT NULL,
    can_write   BIT           NOT NULL DEFAULT 0,
    CONSTRAINT uq_role_permission UNIQUE (role_id, permission)
);
GO

-- ============================================================
-- COLLEGE USERS (staff accounts)
-- ============================================================
IF OBJECT_ID('college_users', 'U') IS NULL
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
GO

-- ============================================================
-- ADMINS (super-admin accounts)
-- ============================================================
IF OBJECT_ID('admins', 'U') IS NULL
CREATE TABLE admins (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    name          NVARCHAR(200) NOT NULL,
    email         NVARCHAR(150) UNIQUE NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    created_at    DATETIME2 DEFAULT GETDATE()
);
GO

-- ============================================================
-- STUDENTS
-- ============================================================
IF OBJECT_ID('students', 'U') IS NULL
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
    category        NVARCHAR(30),
    prn             NVARCHAR(50),
    created_at      DATETIME2 DEFAULT GETDATE()
);
GO

-- ============================================================
-- FACULTY MASTER (programs offered per college)
-- ============================================================
IF OBJECT_ID('faculty_master', 'U') IS NULL
CREATE TABLE faculty_master (
    code_no                 INT IDENTITY(1,1) PRIMARY KEY,
    college_id              INT           NOT NULL REFERENCES colleges(id),
    degree_course_code      NVARCHAR(20)  NOT NULL,
    degree_course_name      NVARCHAR(200) NOT NULL,
    duration_years          INT           NOT NULL DEFAULT 3,
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
GO

-- ============================================================
-- BANK MASTER
-- ============================================================
IF OBJECT_ID('bank_master', 'U') IS NULL
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
GO

-- ============================================================
-- COURSE MASTER (subjects per program-semester)
-- ============================================================
IF OBJECT_ID('course_master', 'U') IS NULL
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
    subject_type      NVARCHAR(30)  NULL,
    display_order     INT           NOT NULL DEFAULT 0,
    is_active         BIT           NOT NULL DEFAULT 1,
    modified_on       DATETIME2     NULL,
    CONSTRAINT uq_course_master UNIQUE (college_id, faculty_master_id, semester, course_code)
);
GO

-- ============================================================
-- GROUP MASTER
-- ============================================================
IF OBJECT_ID('group_master', 'U') IS NULL
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
GO

-- ============================================================
-- GROUP COURSES
-- ============================================================
IF OBJECT_ID('group_courses', 'U') IS NULL
CREATE TABLE group_courses (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    group_id        INT           NOT NULL REFERENCES group_master(id) ON DELETE CASCADE,
    course_position INT           NOT NULL DEFAULT 0,
    course_code     NVARCHAR(30)  NOT NULL,
    course_title    NVARCHAR(200) NOT NULL DEFAULT '',
    CONSTRAINT uq_group_course_combo UNIQUE (group_id, course_code, course_title)
);
GO

-- ============================================================
-- DIVISION MASTER
-- ============================================================
IF OBJECT_ID('division_master', 'U') IS NULL
CREATE TABLE division_master (
    id                INT IDENTITY(1,1) PRIMARY KEY,
    college_id        INT           NOT NULL REFERENCES colleges(id),
    faculty_master_id INT           NOT NULL REFERENCES faculty_master(code_no),
    year_level        NVARCHAR(10)  NOT NULL,
    class_year_code   NVARCHAR(20)  NULL,
    division_letter   CHAR(1)       NOT NULL,
    funding_type      NVARCHAR(30)  NOT NULL,
    is_active         BIT           NOT NULL DEFAULT 1,
    modified_on       DATETIME2     NULL,
    CONSTRAINT uq_division_master UNIQUE (college_id, faculty_master_id, year_level, division_letter)
);
GO

-- ============================================================
-- FEES MASTER
-- ============================================================
IF OBJECT_ID('fees_master', 'U') IS NULL
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
    fees_cat1_amount       DECIMAL(10,2) NOT NULL DEFAULT 0,
    fees_cat2_amount       DECIMAL(10,2) NOT NULL DEFAULT 0,
    fees_cat3_amount       DECIMAL(10,2) NOT NULL DEFAULT 0,
    fees_cat4_amount       DECIMAL(10,2) NOT NULL DEFAULT 0,
    cat4_description       NVARCHAR(200) NULL,
    is_active              BIT           NOT NULL DEFAULT 1,
    modified_on            DATETIME2     NULL
);
GO

-- ============================================================
-- CLASSWISE FEES
-- ============================================================
IF OBJECT_ID('classwise_fees', 'U') IS NULL
CREATE TABLE classwise_fees (
    id                INT IDENTITY(1,1) PRIMARY KEY,
    college_id        INT           NOT NULL REFERENCES colleges(id),
    faculty_master_id INT           NOT NULL REFERENCES faculty_master(code_no),
    year_level        NVARCHAR(10)  NOT NULL,
    fees_code         INT           NOT NULL REFERENCES fees_master(fees_code),
    cat1_amount       DECIMAL(10,2) NULL,
    cat2_amount       DECIMAL(10,2) NULL,
    cat3_amount       DECIMAL(10,2) NULL,
    cat4_amount       DECIMAL(10,2) NULL,
    CONSTRAINT uq_classwise_fees UNIQUE (college_id, faculty_master_id, year_level, fees_code)
);
GO

-- ============================================================
-- CLASS MASTER
-- ============================================================
IF OBJECT_ID('class_master', 'U') IS NULL
CREATE TABLE class_master (
    id                INT IDENTITY(1,1) PRIMARY KEY,
    college_id        INT          NOT NULL REFERENCES colleges(id),
    faculty_master_id INT          NOT NULL REFERENCES faculty_master(code_no),
    year_of_study     TINYINT      NOT NULL CHECK (year_of_study IN (1,2,3,4,5)),
    label             NVARCHAR(50) NULL,
    is_active         BIT          NOT NULL DEFAULT 1,
    CONSTRAINT uq_class_master UNIQUE (college_id, faculty_master_id, year_of_study)
);
GO

-- ============================================================
-- DOCUMENT TYPES
-- ============================================================
IF OBJECT_ID('document_types', 'U') IS NULL
CREATE TABLE document_types (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    name        NVARCHAR(100) NOT NULL,
    description NVARCHAR(300) NULL,
    created_at  DATETIME2 DEFAULT GETDATE()
);
GO

-- ============================================================
-- COLLEGE REQUIRED DOCUMENTS
-- ============================================================
IF OBJECT_ID('college_required_documents', 'U') IS NULL
CREATE TABLE college_required_documents (
    id                INT IDENTITY(1,1) PRIMARY KEY,
    college_id        INT NOT NULL REFERENCES colleges(id),
    faculty_master_id INT NOT NULL REFERENCES faculty_master(code_no),
    year_of_study     INT NOT NULL CHECK (year_of_study IN (1,2,3,4,5)),
    document_type_id  INT NOT NULL REFERENCES document_types(id),
    is_mandatory      BIT NOT NULL DEFAULT 1,
    CONSTRAINT uq_college_req_doc UNIQUE (college_id, faculty_master_id, year_of_study, document_type_id)
);
GO

-- ============================================================
-- ADMISSION PERIODS
-- ============================================================
IF OBJECT_ID('admission_periods', 'U') IS NULL
CREATE TABLE admission_periods (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    college_id      INT           NOT NULL REFERENCES colleges(id),
    course_id       INT           NOT NULL REFERENCES faculty_master(code_no),
    year_of_study   INT           NOT NULL CHECK (year_of_study IN (1,2,3,4,5)),
    academic_year   NVARCHAR(10)  NOT NULL,
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
-- STUDENT DOCUMENTS
-- No UNIQUE constraint — allows multiple versions per student
-- per document type (one per application).
-- ============================================================
IF OBJECT_ID('student_documents', 'U') IS NULL
CREATE TABLE student_documents (
    id                INT IDENTITY(1,1) PRIMARY KEY,
    student_id        INT           NOT NULL REFERENCES students(id),
    document_type_id  INT           NOT NULL REFERENCES document_types(id),
    file_name         NVARCHAR(300) NOT NULL,
    file_path         NVARCHAR(500) NOT NULL,
    uploaded_at       DATETIME2 DEFAULT GETDATE()
);
GO

-- ============================================================
-- APPLICATIONS (central state machine)
-- Includes all app_* form snapshot fields and current_step.
-- ============================================================
IF OBJECT_ID('applications', 'U') IS NULL
CREATE TABLE applications (
    id                      INT IDENTITY(1,1) PRIMARY KEY,
    registration_number     NVARCHAR(30)   NULL,
    student_id              INT            NOT NULL REFERENCES students(id),
    college_id              INT            NOT NULL REFERENCES colleges(id),
    course_id               INT            NOT NULL REFERENCES faculty_master(code_no),
    year_of_study           INT            NOT NULL CHECK (year_of_study IN (1,2,3,4,5)),
    academic_year           NVARCHAR(10)   NOT NULL,
    admission_period_id     INT            NOT NULL REFERENCES admission_periods(id),

    -- Status machine
    status                  NVARCHAR(30)   NOT NULL DEFAULT 'draft'
                            CONSTRAINT chk_applications_status CHECK (status IN (
                                'draft','payment_pending','submitted','under_review',
                                'correction_requested','correction_done',
                                'scrutiny_accepted','doc_verification_pending','doc_verified',
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

    -- Payment flags
    application_fee_paid    BIT            NOT NULL DEFAULT 0,
    college_fee_paid        BIT            NOT NULL DEFAULT 0,

    -- Multi-step form progress tracker
    current_step            INT            NOT NULL DEFAULT 1,

    -- Personal details (Step 1)
    app_surname             NVARCHAR(100)  NULL,
    app_first_name          NVARCHAR(100)  NULL,
    app_middle_name         NVARCHAR(100)  NULL,
    app_mother_name         NVARCHAR(200)  NULL,
    app_sex                 NVARCHAR(10)   NULL,
    app_mobile              NVARCHAR(20)   NULL,
    app_email               NVARCHAR(150)  NULL,
    app_address             NVARCHAR(500)  NULL,
    app_taluka              NVARCHAR(100)  NULL,
    app_district            NVARCHAR(100)  NULL,
    app_state               NVARCHAR(100)  NULL,
    app_category            NVARCHAR(30)   NULL,
    app_special_status      NVARCHAR(100)  NULL,
    fees_category           NVARCHAR(30)   NULL,
    fees_category_override  BIT            NULL DEFAULT 0,
    fees_category_override_remark NVARCHAR(500) NULL,
    app_division            NVARCHAR(5)    NULL,
    app_degree_course_code  NVARCHAR(20)   NULL,

    -- Other details (Step 2)
    app_birth_date          DATE           NULL,
    app_birth_place         NVARCHAR(200)  NULL,
    app_birth_taluka        NVARCHAR(100)  NULL,
    app_birth_district      NVARCHAR(100)  NULL,
    app_birth_state         NVARCHAR(100)  NULL,
    app_nationality         NVARCHAR(100)  NULL,
    app_marital_status      NVARCHAR(20)   NULL,
    app_religion            NVARCHAR(100)  NULL,
    app_caste               NVARCHAR(100)  NULL,
    app_mother_tongue       NVARCHAR(100)  NULL,
    app_height_cm           DECIMAL(5,2)   NULL,
    app_weight_kg           DECIMAL(5,2)   NULL,
    app_blood_group         NVARCHAR(5)    NULL,
    app_father_full_name    NVARCHAR(200)  NULL,
    app_son_daughter_no     INT            NULL,
    app_father_occupation   NVARCHAR(200)  NULL,
    app_annual_income       DECIMAL(12,2)  NULL,
    app_aadhaar             NVARCHAR(20)   NULL,
    app_prn                 NVARCHAR(50)   NULL,
    app_abc_id              NVARCHAR(50)   NULL,
    app_university_app_no   NVARCHAR(50)   NULL,
    app_bank_account        NVARCHAR(50)   NULL,
    app_bank_ifsc           NVARCHAR(20)   NULL,
    app_bank_name           NVARCHAR(200)  NULL,
    app_bank_branch         NVARCHAR(200)  NULL,

    -- Declaration
    declaration_accepted_at DATETIME2      NULL,

    -- Timestamps
    submitted_at            DATETIME2 NULL,
    approved_at             DATETIME2 NULL,
    confirmed_at            DATETIME2 NULL,
    enrolled_at             DATETIME2 NULL,
    status_updated_at       DATETIME2 NULL,
    created_at              DATETIME2 DEFAULT GETDATE(),
    updated_at              DATETIME2 DEFAULT GETDATE()
);
GO

-- Unique index on registration_number (NULL-safe)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uix_applications_reg_number' AND object_id = OBJECT_ID('applications'))
    CREATE UNIQUE INDEX uix_applications_reg_number
        ON applications (registration_number)
        WHERE registration_number IS NOT NULL;
GO

-- ============================================================
-- APPLICATION DOCUMENTS
-- ============================================================
IF OBJECT_ID('application_documents', 'U') IS NULL
CREATE TABLE application_documents (
    id                  INT       IDENTITY(1,1) PRIMARY KEY,
    application_id      INT       NOT NULL REFERENCES applications(id),
    student_document_id INT       NOT NULL REFERENCES student_documents(id),
    document_type_id    INT       NOT NULL REFERENCES document_types(id),
    is_verified         BIT       NOT NULL DEFAULT 0,
    verified_at         DATETIME2 NULL,
    created_at          DATETIME2 DEFAULT GETDATE()
);
GO

-- ============================================================
-- APPLICATION PREVIOUS EXAM
-- ============================================================
IF OBJECT_ID('application_previous_exam', 'U') IS NULL
CREATE TABLE application_previous_exam (
    id                        INT IDENTITY(1,1) PRIMARY KEY,
    application_id            INT           NOT NULL REFERENCES applications(id),
    exam_type                 NVARCHAR(20)  NULL,   -- e.g. 'SSC', 'HSC'
    board_or_college_name     NVARCHAR(200) NULL,
    school_or_college_address NVARCHAR(300) NULL,
    seat_number               NVARCHAR(50)  NULL,
    month_year_passing        NVARCHAR(20)  NULL,
    total_marks_obtained      DECIMAL(8,2)  NULL,
    total_marks_max           DECIMAL(8,2)  NULL,
    percentage                DECIMAL(5,2)  NULL,
    class_grade               NVARCHAR(50)  NULL,
    remark                    NVARCHAR(500) NULL,
    created_at                DATETIME2 DEFAULT GETDATE(),
    updated_at                DATETIME2 NULL
);
GO

-- ============================================================
-- APPLICATION ACTIVITY LOG
-- ============================================================
IF OBJECT_ID('application_activity_log', 'U') IS NULL
CREATE TABLE application_activity_log (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    application_id  INT            NOT NULL REFERENCES applications(id),
    action          NVARCHAR(60)   NOT NULL,
    actor_role      NVARCHAR(20)   NOT NULL,
    note            NVARCHAR(1000) NULL,
    created_at      DATETIME2 DEFAULT GETDATE()
);
GO

-- ============================================================
-- APPLICATION SUBJECTS
-- ============================================================
IF OBJECT_ID('application_subjects', 'U') IS NULL
CREATE TABLE application_subjects (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    application_id INT           NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    semester       INT           NOT NULL,
    subject_code   NVARCHAR(30)  NOT NULL,
    subject_title  NVARCHAR(200) NOT NULL,
    display_order  INT           NOT NULL DEFAULT 0,
    created_at     DATETIME2     NOT NULL DEFAULT GETDATE(),
    CONSTRAINT uq_app_subject UNIQUE (application_id, semester, subject_code)
);
GO

-- ============================================================
-- PAYMENTS
-- ============================================================
IF OBJECT_ID('payments', 'U') IS NULL
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
    paid_by              NVARCHAR(10)  NULL CHECK (paid_by IN ('student','college')),
    paid_by_user_id      INT           NULL,
    attempted_at         DATETIME2 DEFAULT GETDATE(),
    completed_at         DATETIME2 NULL
);
GO

-- ============================================================
-- OTP STORE
-- ============================================================
IF OBJECT_ID('otp_store', 'U') IS NULL
CREATE TABLE otp_store (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    phone        NVARCHAR(20)  NOT NULL,
    otp_hash     NVARCHAR(255) NOT NULL,
    purpose      NVARCHAR(30)  NOT NULL CHECK (purpose IN ('registration','password_reset')),
    pending_data NVARCHAR(MAX) NULL,
    expires_at   DATETIME2     NOT NULL,
    used         BIT           NOT NULL DEFAULT 0,
    created_at   DATETIME2 DEFAULT GETDATE()
);
GO

-- ============================================================
-- WHATSAPP MESSAGE LOG
-- ============================================================
IF OBJECT_ID('whatsapp_message_log', 'U') IS NULL
CREATE TABLE whatsapp_message_log (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    phone          NVARCHAR(20)  NOT NULL,
    campaign_name  NVARCHAR(100) NOT NULL,
    template_id    NVARCHAR(50)  NULL,
    sample         NVARCHAR(500) NULL,
    status         NVARCHAR(20)  NOT NULL DEFAULT 'sent'
                   CHECK (status IN ('sent','failed','skipped')),
    campaign_id    NVARCHAR(50)  NULL,
    error_detail   NVARCHAR(500) NULL,
    application_id INT           NULL REFERENCES applications(id),
    created_at     DATETIME2 DEFAULT GETDATE()
);
GO

-- ============================================================
-- CERTIFICATE TABLES
-- ============================================================
IF OBJECT_ID('certificate_bonafide', 'U') IS NULL
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
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_cert_bonafide_certificate_no')
    CREATE UNIQUE INDEX ix_cert_bonafide_certificate_no
        ON certificate_bonafide (college_id, certificate_no)
        WHERE is_deleted = 0;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_cert_bonafide_reg_no')
    CREATE INDEX ix_cert_bonafide_reg_no
        ON certificate_bonafide (college_id, reg_no);
GO

IF OBJECT_ID('certificate_character', 'U') IS NULL
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
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_cert_character_certificate_no')
    CREATE UNIQUE INDEX ix_cert_character_certificate_no
        ON certificate_character (college_id, certificate_no)
        WHERE is_deleted = 0;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_cert_character_reg_no')
    CREATE INDEX ix_cert_character_reg_no
        ON certificate_character (college_id, reg_no);
GO

IF OBJECT_ID('certificate_noc', 'U') IS NULL
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
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_cert_noc_certificate_no')
    CREATE UNIQUE INDEX ix_cert_noc_certificate_no
        ON certificate_noc (college_id, certificate_no)
        WHERE is_deleted = 0;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_cert_noc_reg_no')
    CREATE INDEX ix_cert_noc_reg_no
        ON certificate_noc (college_id, reg_no);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_cert_noc_prn_no')
    CREATE INDEX ix_cert_noc_prn_no
        ON certificate_noc (college_id, prn_no);
GO

-- ============================================================
-- LEGACY TABLES (kept for backward compatibility only)
-- ============================================================
IF OBJECT_ID('courses', 'U') IS NULL
CREATE TABLE courses (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    college_id     INT            NOT NULL REFERENCES colleges(id),
    name           NVARCHAR(100)  NOT NULL,
    duration_years INT            NOT NULL DEFAULT 3,
    category       NVARCHAR(20)   NOT NULL CHECK (category IN ('grant','non-grant')),
    created_at     DATETIME2 DEFAULT GETDATE()
);
GO

IF OBJECT_ID('subjects', 'U') IS NULL
CREATE TABLE subjects (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    course_id       INT           NOT NULL REFERENCES courses(id),
    year_of_study   INT           NOT NULL CHECK (year_of_study IN (1,2,3,4,5)),
    name            NVARCHAR(200) NOT NULL,
    subject_type    NVARCHAR(20)  NOT NULL CHECK (subject_type IN ('core','elective')),
    elective_group  NVARCHAR(10)  NULL,
    created_at      DATETIME2 DEFAULT GETDATE()
);
GO

IF OBJECT_ID('fee_structures', 'U') IS NULL
CREATE TABLE fee_structures (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    college_id      INT           NOT NULL REFERENCES colleges(id),
    course_id       INT           NOT NULL REFERENCES courses(id),
    year_of_study   INT           NOT NULL CHECK (year_of_study IN (1,2,3,4,5)),
    category        NVARCHAR(20)  NOT NULL CHECK (category IN ('grant','non-grant')),
    tuition_fee     DECIMAL(10,2) NOT NULL DEFAULT 0,
    exam_fee        DECIMAL(10,2) NOT NULL DEFAULT 0,
    other_fee       DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at      DATETIME2 DEFAULT GETDATE()
);
GO

IF OBJECT_ID('required_documents', 'U') IS NULL
CREATE TABLE required_documents (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    college_id       INT NOT NULL REFERENCES colleges(id),
    course_id        INT NOT NULL REFERENCES courses(id),
    year_of_study    INT NOT NULL CHECK (year_of_study IN (1,2,3,4,5)),
    document_type_id INT NOT NULL REFERENCES document_types(id),
    is_mandatory     BIT NOT NULL DEFAULT 1,
    created_at       DATETIME2 DEFAULT GETDATE()
);
GO
