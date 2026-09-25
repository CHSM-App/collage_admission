-- ============================================================
-- 011_audit_arc_tables.sql
-- Creates $Arc (audit/archive) tables for all important tables.
-- Triggers are created by migrate.js (applyAuditTriggers) to
-- avoid MSSQL parse-time object validation errors.
--
-- Pattern: same as admission_periods$Arc (003).
-- Each $Arc table mirrors source columns + audit metadata:
--   action_type  IN ('INSERT','UPDATE','DELETE')
--   action_date  DATETIME2  (UTC)
--   action_by    from SESSION_CONTEXT(N'app_user_id')
--   machine_mac_address  from SESSION_CONTEXT(N'app_machine_mac')
--   comments     from SESSION_CONTEXT(N'app_comments')
-- ============================================================

-- ============================================================
-- HIGH PRIORITY
-- ============================================================

-- ── admins ───────────────────────────────────────────────────
IF OBJECT_ID('[dbo].[admins$Arc]', 'U') IS NULL
CREATE TABLE [dbo].[admins$Arc] (
    arc_id              INT IDENTITY(1,1) PRIMARY KEY,
    id                  INT           NULL,
    name                NVARCHAR(200) NULL,
    email               NVARCHAR(150) NULL,
    password_hash       NVARCHAR(255) NULL,
    created_at          DATETIME2     NULL,
    action_type         NVARCHAR(10)  NOT NULL CHECK (action_type IN ('INSERT','UPDATE','DELETE')),
    action_date         DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    action_by           NVARCHAR(150) NULL,
    machine_mac_address NVARCHAR(50)  NULL,
    comments            NVARCHAR(500) NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_admins_arc_action_date')
    CREATE INDEX ix_admins_arc_action_date ON [dbo].[admins$Arc] (action_date);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_admins_arc_action_type')
    CREATE INDEX ix_admins_arc_action_type ON [dbo].[admins$Arc] (action_type);
GO

-- ── colleges ─────────────────────────────────────────────────
IF OBJECT_ID('[dbo].[colleges$Arc]', 'U') IS NULL
CREATE TABLE [dbo].[colleges$Arc] (
    arc_id              INT IDENTITY(1,1) PRIMARY KEY,
    id                  INT            NULL,
    name                NVARCHAR(200)  NULL,
    address             NVARCHAR(500)  NULL,
    city                NVARCHAR(100)  NULL,
    phone               NVARCHAR(20)   NULL,
    email               NVARCHAR(150)  NULL,
    admin_email         NVARCHAR(150)  NULL,
    admin_password_hash NVARCHAR(255)  NULL,
    college_code        NVARCHAR(20)   NULL,
    application_fee     DECIMAL(12,2)  NULL,
    bank_account_name   NVARCHAR(200)  NULL,
    bank_account_number NVARCHAR(50)   NULL,
    bank_ifsc           NVARCHAR(20)   NULL,
    bank_upi_id         NVARCHAR(100)  NULL,
    is_enabled          BIT            NULL,
    created_at          DATETIME2      NULL,
    action_type         NVARCHAR(10)   NOT NULL CHECK (action_type IN ('INSERT','UPDATE','DELETE')),
    action_date         DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    action_by           NVARCHAR(150)  NULL,
    machine_mac_address NVARCHAR(50)   NULL,
    comments            NVARCHAR(500)  NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_colleges_arc_action_date')
    CREATE INDEX ix_colleges_arc_action_date ON [dbo].[colleges$Arc] (action_date);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_colleges_arc_action_type')
    CREATE INDEX ix_colleges_arc_action_type ON [dbo].[colleges$Arc] (action_type);
GO

-- ── college_roles ────────────────────────────────────────────
IF OBJECT_ID('[dbo].[college_roles$Arc]', 'U') IS NULL
CREATE TABLE [dbo].[college_roles$Arc] (
    arc_id              INT IDENTITY(1,1) PRIMARY KEY,
    id                  INT           NULL,
    college_id          INT           NULL,
    role_name           NVARCHAR(100) NULL,
    created_at          DATETIME2     NULL,
    action_type         NVARCHAR(10)  NOT NULL CHECK (action_type IN ('INSERT','UPDATE','DELETE')),
    action_date         DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    action_by           NVARCHAR(150) NULL,
    machine_mac_address NVARCHAR(50)  NULL,
    comments            NVARCHAR(500) NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_college_roles_arc_action_date')
    CREATE INDEX ix_college_roles_arc_action_date ON [dbo].[college_roles$Arc] (action_date);
GO

-- ── college_role_permissions ──────────────────────────────────
IF OBJECT_ID('[dbo].[college_role_permissions$Arc]', 'U') IS NULL
CREATE TABLE [dbo].[college_role_permissions$Arc] (
    arc_id              INT IDENTITY(1,1) PRIMARY KEY,
    id                  INT           NULL,
    role_id             INT           NULL,
    permission          NVARCHAR(100) NULL,
    can_write           BIT           NULL,
    action_type         NVARCHAR(10)  NOT NULL CHECK (action_type IN ('INSERT','UPDATE','DELETE')),
    action_date         DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    action_by           NVARCHAR(150) NULL,
    machine_mac_address NVARCHAR(50)  NULL,
    comments            NVARCHAR(500) NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_college_role_permissions_arc_action_date')
    CREATE INDEX ix_college_role_permissions_arc_action_date ON [dbo].[college_role_permissions$Arc] (action_date);
GO

-- ── college_users ────────────────────────────────────────────
IF OBJECT_ID('[dbo].[college_users$Arc]', 'U') IS NULL
CREATE TABLE [dbo].[college_users$Arc] (
    arc_id              INT IDENTITY(1,1) PRIMARY KEY,
    id                  INT           NULL,
    college_id          INT           NULL,
    role_id             INT           NULL,
    full_name           NVARCHAR(200) NULL,
    email               NVARCHAR(150) NULL,
    password_hash       NVARCHAR(255) NULL,
    is_active           BIT           NULL,
    created_at          DATETIME2     NULL,
    action_type         NVARCHAR(10)  NOT NULL CHECK (action_type IN ('INSERT','UPDATE','DELETE')),
    action_date         DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    action_by           NVARCHAR(150) NULL,
    machine_mac_address NVARCHAR(50)  NULL,
    comments            NVARCHAR(500) NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_college_users_arc_action_date')
    CREATE INDEX ix_college_users_arc_action_date ON [dbo].[college_users$Arc] (action_date);
GO

-- ── students ─────────────────────────────────────────────────
IF OBJECT_ID('[dbo].[students$Arc]', 'U') IS NULL
CREATE TABLE [dbo].[students$Arc] (
    arc_id              INT IDENTITY(1,1) PRIMARY KEY,
    id                  INT           NULL,
    full_name           NVARCHAR(200) NULL,
    email               NVARCHAR(150) NULL,
    password_hash       NVARCHAR(255) NULL,
    phone               NVARCHAR(20)  NULL,
    dob                 DATE          NULL,
    gender              NVARCHAR(10)  NULL,
    address             NVARCHAR(500) NULL,
    city                NVARCHAR(100) NULL,
    aadhaar_number      NVARCHAR(20)  NULL,
    category            NVARCHAR(30)  NULL,
    prn                 NVARCHAR(50)  NULL,
    created_at          DATETIME2     NULL,
    action_type         NVARCHAR(10)  NOT NULL CHECK (action_type IN ('INSERT','UPDATE','DELETE')),
    action_date         DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    action_by           NVARCHAR(150) NULL,
    machine_mac_address NVARCHAR(50)  NULL,
    comments            NVARCHAR(500) NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_students_arc_action_date')
    CREATE INDEX ix_students_arc_action_date ON [dbo].[students$Arc] (action_date);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_students_arc_action_type')
    CREATE INDEX ix_students_arc_action_type ON [dbo].[students$Arc] (action_type);
GO

-- ── applications ─────────────────────────────────────────────
IF OBJECT_ID('[dbo].[applications$Arc]', 'U') IS NULL
CREATE TABLE [dbo].[applications$Arc] (
    arc_id                        INT IDENTITY(1,1) PRIMARY KEY,
    id                            INT            NULL,
    registration_number           NVARCHAR(30)   NULL,
    student_id                    INT            NULL,
    college_id                    INT            NULL,
    course_id                     INT            NULL,
    year_of_study                 INT            NULL,
    academic_year                 NVARCHAR(10)   NULL,
    admission_period_id           INT            NULL,
    status                        NVARCHAR(30)   NULL,
    correction_note               NVARCHAR(1000) NULL,
    rejection_reason              NVARCHAR(500)  NULL,
    cancellation_reason           NVARCHAR(500)  NULL,
    fee_total_amount              DECIMAL(12,2)  NULL,
    fee_pay_now_amount            DECIMAL(12,2)  NULL,
    roll_number                   NVARCHAR(20)   NULL,
    application_fee_paid          BIT            NULL,
    college_fee_paid              BIT            NULL,
    current_step                  INT            NULL,
    app_surname                   NVARCHAR(100)  NULL,
    app_first_name                NVARCHAR(100)  NULL,
    app_middle_name               NVARCHAR(100)  NULL,
    app_mother_name               NVARCHAR(200)  NULL,
    app_sex                       NVARCHAR(10)   NULL,
    app_mobile                    NVARCHAR(20)   NULL,
    app_email                     NVARCHAR(150)  NULL,
    app_address                   NVARCHAR(500)  NULL,
    app_taluka                    NVARCHAR(100)  NULL,
    app_district                  NVARCHAR(100)  NULL,
    app_state                     NVARCHAR(100)  NULL,
    app_category                  NVARCHAR(30)   NULL,
    app_special_status            NVARCHAR(100)  NULL,
    fees_category                 NVARCHAR(30)   NULL,
    fees_category_override        BIT            NULL,
    fees_category_override_remark NVARCHAR(500)  NULL,
    app_division                  NVARCHAR(5)    NULL,
    app_degree_course_code        NVARCHAR(20)   NULL,
    app_birth_date                DATE           NULL,
    app_birth_place               NVARCHAR(200)  NULL,
    app_birth_taluka              NVARCHAR(100)  NULL,
    app_birth_district            NVARCHAR(100)  NULL,
    app_birth_state               NVARCHAR(100)  NULL,
    app_nationality               NVARCHAR(100)  NULL,
    app_marital_status            NVARCHAR(20)   NULL,
    app_religion                  NVARCHAR(100)  NULL,
    app_caste                     NVARCHAR(100)  NULL,
    app_mother_tongue             NVARCHAR(100)  NULL,
    app_height_cm                 DECIMAL(5,2)   NULL,
    app_weight_kg                 DECIMAL(5,2)   NULL,
    app_blood_group               NVARCHAR(5)    NULL,
    app_father_full_name          NVARCHAR(200)  NULL,
    app_son_daughter_no           INT            NULL,
    app_father_occupation         NVARCHAR(200)  NULL,
    app_annual_income             DECIMAL(12,2)  NULL,
    app_aadhaar                   NVARCHAR(20)   NULL,
    app_prn                       NVARCHAR(50)   NULL,
    app_abc_id                    NVARCHAR(50)   NULL,
    app_university_app_no         NVARCHAR(50)   NULL,
    app_bank_account              NVARCHAR(50)   NULL,
    app_bank_ifsc                 NVARCHAR(20)   NULL,
    app_bank_name                 NVARCHAR(200)  NULL,
    app_bank_branch               NVARCHAR(200)  NULL,
    declaration_accepted_at       DATETIME2      NULL,
    submitted_at                  DATETIME2      NULL,
    approved_at                   DATETIME2      NULL,
    confirmed_at                  DATETIME2      NULL,
    enrolled_at                   DATETIME2      NULL,
    status_updated_at             DATETIME2      NULL,
    created_at                    DATETIME2      NULL,
    updated_at                    DATETIME2      NULL,
    action_type                   NVARCHAR(10)   NOT NULL CHECK (action_type IN ('INSERT','UPDATE','DELETE')),
    action_date                   DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    action_by                     NVARCHAR(150)  NULL,
    machine_mac_address           NVARCHAR(50)   NULL,
    comments                      NVARCHAR(500)  NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_applications_arc_action_date')
    CREATE INDEX ix_applications_arc_action_date ON [dbo].[applications$Arc] (action_date);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_applications_arc_action_type')
    CREATE INDEX ix_applications_arc_action_type ON [dbo].[applications$Arc] (action_type);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_applications_arc_id')
    CREATE INDEX ix_applications_arc_id ON [dbo].[applications$Arc] (id);
GO

-- ── payments ─────────────────────────────────────────────────
IF OBJECT_ID('[dbo].[payments$Arc]', 'U') IS NULL
CREATE TABLE [dbo].[payments$Arc] (
    arc_id               INT IDENTITY(1,1) PRIMARY KEY,
    id                   INT           NULL,
    application_id       INT           NULL,
    payment_type         NVARCHAR(30)  NULL,
    amount               DECIMAL(10,2) NULL,
    razorpay_order_id    NVARCHAR(100) NULL,
    razorpay_payment_id  NVARCHAR(100) NULL,
    status               NVARCHAR(20)  NULL,
    paid_by              NVARCHAR(10)  NULL,
    paid_by_user_id      INT           NULL,
    attempted_at         DATETIME2     NULL,
    completed_at         DATETIME2     NULL,
    action_type          NVARCHAR(10)  NOT NULL CHECK (action_type IN ('INSERT','UPDATE','DELETE')),
    action_date          DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    action_by            NVARCHAR(150) NULL,
    machine_mac_address  NVARCHAR(50)  NULL,
    comments             NVARCHAR(500) NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_payments_arc_action_date')
    CREATE INDEX ix_payments_arc_action_date ON [dbo].[payments$Arc] (action_date);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_payments_arc_action_type')
    CREATE INDEX ix_payments_arc_action_type ON [dbo].[payments$Arc] (action_type);
GO

-- ============================================================
-- MEDIUM PRIORITY
-- ============================================================

-- ── fees_master ──────────────────────────────────────────────
IF OBJECT_ID('[dbo].[fees_master$Arc]', 'U') IS NULL
CREATE TABLE [dbo].[fees_master$Arc] (
    arc_id                 INT IDENTITY(1,1) PRIMARY KEY,
    fees_code              INT           NULL,
    college_id             INT           NULL,
    fees_type              NVARCHAR(50)  NULL,
    is_other_misc          BIT           NULL,
    fees_head              NVARCHAR(200) NULL,
    short_name             NVARCHAR(50)  NULL,
    sequence_auto_fees     INT           NULL,
    credit_to_bank_ledger  INT           NULL,
    is_refundable          BIT           NULL,
    fees_cat1_amount       DECIMAL(10,2) NULL,
    fees_cat2_amount       DECIMAL(10,2) NULL,
    fees_cat3_amount       DECIMAL(10,2) NULL,
    fees_cat4_amount       DECIMAL(10,2) NULL,
    cat4_description       NVARCHAR(200) NULL,
    is_active              BIT           NULL,
    modified_on            DATETIME2     NULL,
    action_type            NVARCHAR(10)  NOT NULL CHECK (action_type IN ('INSERT','UPDATE','DELETE')),
    action_date            DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    action_by              NVARCHAR(150) NULL,
    machine_mac_address    NVARCHAR(50)  NULL,
    comments               NVARCHAR(500) NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_fees_master_arc_action_date')
    CREATE INDEX ix_fees_master_arc_action_date ON [dbo].[fees_master$Arc] (action_date);
GO

-- ── classwise_fees ───────────────────────────────────────────
IF OBJECT_ID('[dbo].[classwise_fees$Arc]', 'U') IS NULL
CREATE TABLE [dbo].[classwise_fees$Arc] (
    arc_id              INT IDENTITY(1,1) PRIMARY KEY,
    id                  INT           NULL,
    college_id          INT           NULL,
    faculty_master_id   INT           NULL,
    year_level          NVARCHAR(10)  NULL,
    fees_code           INT           NULL,
    cat1_amount         DECIMAL(10,2) NULL,
    cat2_amount         DECIMAL(10,2) NULL,
    cat3_amount         DECIMAL(10,2) NULL,
    cat4_amount         DECIMAL(10,2) NULL,
    action_type         NVARCHAR(10)  NOT NULL CHECK (action_type IN ('INSERT','UPDATE','DELETE')),
    action_date         DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    action_by           NVARCHAR(150) NULL,
    machine_mac_address NVARCHAR(50)  NULL,
    comments            NVARCHAR(500) NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_classwise_fees_arc_action_date')
    CREATE INDEX ix_classwise_fees_arc_action_date ON [dbo].[classwise_fees$Arc] (action_date);
GO

-- ── faculty_master ───────────────────────────────────────────
IF OBJECT_ID('[dbo].[faculty_master$Arc]', 'U') IS NULL
CREATE TABLE [dbo].[faculty_master$Arc] (
    arc_id                  INT IDENTITY(1,1) PRIMARY KEY,
    code_no                 INT           NULL,
    college_id              INT           NULL,
    degree_course_code      NVARCHAR(20)  NULL,
    degree_course_name      NVARCHAR(200) NULL,
    duration_years          INT           NULL,
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
    is_active               BIT           NULL,
    created_by              NVARCHAR(100) NULL,
    modified_by             NVARCHAR(100) NULL,
    modified_on             DATETIME2     NULL,
    created_at              DATETIME2     NULL,
    action_type             NVARCHAR(10)  NOT NULL CHECK (action_type IN ('INSERT','UPDATE','DELETE')),
    action_date             DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    action_by               NVARCHAR(150) NULL,
    machine_mac_address     NVARCHAR(50)  NULL,
    comments                NVARCHAR(500) NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_faculty_master_arc_action_date')
    CREATE INDEX ix_faculty_master_arc_action_date ON [dbo].[faculty_master$Arc] (action_date);
GO

-- ── application_documents ────────────────────────────────────
IF OBJECT_ID('[dbo].[application_documents$Arc]', 'U') IS NULL
CREATE TABLE [dbo].[application_documents$Arc] (
    arc_id               INT IDENTITY(1,1) PRIMARY KEY,
    id                   INT       NULL,
    application_id       INT       NULL,
    student_document_id  INT       NULL,
    document_type_id     INT       NULL,
    is_verified          BIT       NULL,
    verified_at          DATETIME2 NULL,
    created_at           DATETIME2 NULL,
    action_type          NVARCHAR(10)  NOT NULL CHECK (action_type IN ('INSERT','UPDATE','DELETE')),
    action_date          DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    action_by            NVARCHAR(150) NULL,
    machine_mac_address  NVARCHAR(50)  NULL,
    comments             NVARCHAR(500) NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_application_documents_arc_action_date')
    CREATE INDEX ix_application_documents_arc_action_date ON [dbo].[application_documents$Arc] (action_date);
GO

-- ── certificate_bonafide ─────────────────────────────────────
IF OBJECT_ID('[dbo].[certificate_bonafide$Arc]', 'U') IS NULL
CREATE TABLE [dbo].[certificate_bonafide$Arc] (
    arc_id           INT IDENTITY(1,1) PRIMARY KEY,
    bonafide_id      INT           NULL,
    college_id       INT           NULL,
    certificate_no   NVARCHAR(50)  NULL,
    certificate_date DATE          NULL,
    reg_no           NVARCHAR(50)  NULL,
    student_name     NVARCHAR(200) NULL,
    gender           NVARCHAR(10)  NULL,
    is_ex_student    BIT           NULL,
    class_name       NVARCHAR(100) NULL,
    academic_year    NVARCHAR(20)  NULL,
    birth_date       DATE          NULL,
    roll_no          INT           NULL,
    caste            NVARCHAR(100) NULL,
    created_by       INT           NULL,
    created_date     DATETIME      NULL,
    updated_by       INT           NULL,
    updated_date     DATETIME      NULL,
    is_deleted       BIT           NULL,
    action_type      NVARCHAR(10)  NOT NULL CHECK (action_type IN ('INSERT','UPDATE','DELETE')),
    action_date      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    action_by        NVARCHAR(150) NULL,
    machine_mac_address NVARCHAR(50) NULL,
    comments         NVARCHAR(500) NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_certificate_bonafide_arc_action_date')
    CREATE INDEX ix_certificate_bonafide_arc_action_date ON [dbo].[certificate_bonafide$Arc] (action_date);
GO

-- ── certificate_character ────────────────────────────────────
IF OBJECT_ID('[dbo].[certificate_character$Arc]', 'U') IS NULL
CREATE TABLE [dbo].[certificate_character$Arc] (
    arc_id                   INT IDENTITY(1,1) PRIMARY KEY,
    character_certificate_id INT           NULL,
    college_id               INT           NULL,
    certificate_no           NVARCHAR(50)  NULL,
    certificate_date         DATE          NULL,
    reg_no                   NVARCHAR(50)  NULL,
    student_name             NVARCHAR(200) NULL,
    gender                   NVARCHAR(10)  NULL,
    is_ex_student            BIT           NULL,
    class_name               NVARCHAR(100) NULL,
    academic_year            NVARCHAR(20)  NULL,
    known_from_years         INT           NULL,
    birth_date               DATE          NULL,
    roll_no                  INT           NULL,
    caste                    NVARCHAR(100) NULL,
    created_by               INT           NULL,
    created_date             DATETIME      NULL,
    updated_by               INT           NULL,
    updated_date             DATETIME      NULL,
    is_deleted               BIT           NULL,
    action_type              NVARCHAR(10)  NOT NULL CHECK (action_type IN ('INSERT','UPDATE','DELETE')),
    action_date              DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    action_by                NVARCHAR(150) NULL,
    machine_mac_address      NVARCHAR(50)  NULL,
    comments                 NVARCHAR(500) NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_certificate_character_arc_action_date')
    CREATE INDEX ix_certificate_character_arc_action_date ON [dbo].[certificate_character$Arc] (action_date);
GO

-- ── certificate_noc ──────────────────────────────────────────
IF OBJECT_ID('[dbo].[certificate_noc$Arc]', 'U') IS NULL
CREATE TABLE [dbo].[certificate_noc$Arc] (
    arc_id                INT IDENTITY(1,1) PRIMARY KEY,
    noc_certificate_id    INT           NULL,
    college_id            INT           NULL,
    certificate_no        NVARCHAR(50)  NULL,
    certificate_date      DATE          NULL,
    reg_no                NVARCHAR(50)  NULL,
    student_name          NVARCHAR(200) NULL,
    gender                NVARCHAR(10)  NULL,
    is_ex_student         BIT           NULL,
    class_name            NVARCHAR(100) NULL,
    from_date             DATE          NULL,
    to_date               DATE          NULL,
    prn_no                NVARCHAR(100) NULL,
    final_confirmation_no NVARCHAR(100) NULL,
    created_by            INT           NULL,
    created_date          DATETIME      NULL,
    updated_by            INT           NULL,
    updated_date          DATETIME      NULL,
    is_deleted            BIT           NULL,
    action_type           NVARCHAR(10)  NOT NULL CHECK (action_type IN ('INSERT','UPDATE','DELETE')),
    action_date           DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    action_by             NVARCHAR(150) NULL,
    machine_mac_address   NVARCHAR(50)  NULL,
    comments              NVARCHAR(500) NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_certificate_noc_arc_action_date')
    CREATE INDEX ix_certificate_noc_arc_action_date ON [dbo].[certificate_noc$Arc] (action_date);
GO

-- ── bank_master ──────────────────────────────────────────────
IF OBJECT_ID('[dbo].[bank_master$Arc]', 'U') IS NULL
CREATE TABLE [dbo].[bank_master$Arc] (
    arc_id               INT IDENTITY(1,1) PRIMARY KEY,
    ledger_code          INT           NULL,
    college_id           INT           NULL,
    bank_account_number  NVARCHAR(50)  NULL,
    bank_name            NVARCHAR(200) NULL,
    branch               NVARCHAR(200) NULL,
    ifsc_code            NVARCHAR(20)  NULL,
    account_type         NVARCHAR(50)  NULL,
    is_active            BIT           NULL,
    modified_on          DATETIME2     NULL,
    action_type          NVARCHAR(10)  NOT NULL CHECK (action_type IN ('INSERT','UPDATE','DELETE')),
    action_date          DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    action_by            NVARCHAR(150) NULL,
    machine_mac_address  NVARCHAR(50)  NULL,
    comments             NVARCHAR(500) NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_bank_master_arc_action_date')
    CREATE INDEX ix_bank_master_arc_action_date ON [dbo].[bank_master$Arc] (action_date);
GO

-- ============================================================
-- LOW PRIORITY
-- ============================================================

-- ── course_master ────────────────────────────────────────────
IF OBJECT_ID('[dbo].[course_master$Arc]', 'U') IS NULL
CREATE TABLE [dbo].[course_master$Arc] (
    arc_id              INT IDENTITY(1,1) PRIMARY KEY,
    id                  INT           NULL,
    college_id          INT           NULL,
    faculty_master_id   INT           NULL,
    semester            INT           NULL,
    course_code         NVARCHAR(30)  NULL,
    course_title        NVARCHAR(200) NULL,
    credits             DECIMAL(4,2)  NULL,
    max_internal        INT           NULL,
    min_internal        INT           NULL,
    max_sem_end         INT           NULL,
    min_sem_end         INT           NULL,
    max_total           INT           NULL,
    min_total           INT           NULL,
    subject_type        NVARCHAR(30)  NULL,
    display_order       INT           NULL,
    is_active           BIT           NULL,
    modified_on         DATETIME2     NULL,
    action_type         NVARCHAR(10)  NOT NULL CHECK (action_type IN ('INSERT','UPDATE','DELETE')),
    action_date         DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    action_by           NVARCHAR(150) NULL,
    machine_mac_address NVARCHAR(50)  NULL,
    comments            NVARCHAR(500) NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_course_master_arc_action_date')
    CREATE INDEX ix_course_master_arc_action_date ON [dbo].[course_master$Arc] (action_date);
GO

-- ── division_master ──────────────────────────────────────────
IF OBJECT_ID('[dbo].[division_master$Arc]', 'U') IS NULL
CREATE TABLE [dbo].[division_master$Arc] (
    arc_id              INT IDENTITY(1,1) PRIMARY KEY,
    id                  INT           NULL,
    college_id          INT           NULL,
    faculty_master_id   INT           NULL,
    year_level          NVARCHAR(10)  NULL,
    class_year_code     NVARCHAR(20)  NULL,
    division_letter     CHAR(1)       NULL,
    funding_type        NVARCHAR(30)  NULL,
    is_active           BIT           NULL,
    modified_on         DATETIME2     NULL,
    action_type         NVARCHAR(10)  NOT NULL CHECK (action_type IN ('INSERT','UPDATE','DELETE')),
    action_date         DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    action_by           NVARCHAR(150) NULL,
    machine_mac_address NVARCHAR(50)  NULL,
    comments            NVARCHAR(500) NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_division_master_arc_action_date')
    CREATE INDEX ix_division_master_arc_action_date ON [dbo].[division_master$Arc] (action_date);
GO

-- ── group_master ─────────────────────────────────────────────
IF OBJECT_ID('[dbo].[group_master$Arc]', 'U') IS NULL
CREATE TABLE [dbo].[group_master$Arc] (
    arc_id              INT IDENTITY(1,1) PRIMARY KEY,
    id                  INT           NULL,
    college_id          INT           NULL,
    faculty_master_id   INT           NULL,
    semester            INT           NULL,
    group_code          NVARCHAR(20)  NULL,
    group_description   NVARCHAR(300) NULL,
    is_active           BIT           NULL,
    modified_on         DATETIME2     NULL,
    action_type         NVARCHAR(10)  NOT NULL CHECK (action_type IN ('INSERT','UPDATE','DELETE')),
    action_date         DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    action_by           NVARCHAR(150) NULL,
    machine_mac_address NVARCHAR(50)  NULL,
    comments            NVARCHAR(500) NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_group_master_arc_action_date')
    CREATE INDEX ix_group_master_arc_action_date ON [dbo].[group_master$Arc] (action_date);
GO

-- ── document_types ───────────────────────────────────────────
IF OBJECT_ID('[dbo].[document_types$Arc]', 'U') IS NULL
CREATE TABLE [dbo].[document_types$Arc] (
    arc_id              INT IDENTITY(1,1) PRIMARY KEY,
    id                  INT           NULL,
    name                NVARCHAR(100) NULL,
    description         NVARCHAR(300) NULL,
    created_at          DATETIME2     NULL,
    action_type         NVARCHAR(10)  NOT NULL CHECK (action_type IN ('INSERT','UPDATE','DELETE')),
    action_date         DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    action_by           NVARCHAR(150) NULL,
    machine_mac_address NVARCHAR(50)  NULL,
    comments            NVARCHAR(500) NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_document_types_arc_action_date')
    CREATE INDEX ix_document_types_arc_action_date ON [dbo].[document_types$Arc] (action_date);
GO

-- ── college_required_documents ───────────────────────────────
IF OBJECT_ID('[dbo].[college_required_documents$Arc]', 'U') IS NULL
CREATE TABLE [dbo].[college_required_documents$Arc] (
    arc_id              INT IDENTITY(1,1) PRIMARY KEY,
    id                  INT  NULL,
    college_id          INT  NULL,
    faculty_master_id   INT  NULL,
    year_of_study       INT  NULL,
    document_type_id    INT  NULL,
    is_mandatory        BIT  NULL,
    action_type         NVARCHAR(10)  NOT NULL CHECK (action_type IN ('INSERT','UPDATE','DELETE')),
    action_date         DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    action_by           NVARCHAR(150) NULL,
    machine_mac_address NVARCHAR(50)  NULL,
    comments            NVARCHAR(500) NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_college_required_documents_arc_action_date')
    CREATE INDEX ix_college_required_documents_arc_action_date ON [dbo].[college_required_documents$Arc] (action_date);
GO
