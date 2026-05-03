-- College Admission System - Database Schema
-- Run this once to create all tables

-- ============================================================
-- COLLEGES
-- ============================================================
CREATE TABLE colleges (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    name        NVARCHAR(200) NOT NULL,
    address     NVARCHAR(500),
    city        NVARCHAR(100),
    phone       NVARCHAR(20),
    email       NVARCHAR(150) UNIQUE NOT NULL,
    admin_email NVARCHAR(150) UNIQUE NOT NULL,
    admin_password_hash NVARCHAR(255) NOT NULL,
    bank_account_name   NVARCHAR(200),
    bank_account_number NVARCHAR(50),
    bank_ifsc           NVARCHAR(20),
    bank_upi_id         NVARCHAR(100),
    created_at  DATETIME2 DEFAULT GETDATE()
);

-- ============================================================
-- COURSES
-- ============================================================
CREATE TABLE courses (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    college_id  INT NOT NULL REFERENCES colleges(id),
    name        NVARCHAR(100) NOT NULL,   -- e.g. BCA, BCom, BSc-IT
    duration_years INT NOT NULL DEFAULT 3,
    category    NVARCHAR(20) NOT NULL CHECK (category IN ('grant','non-grant')),
    created_at  DATETIME2 DEFAULT GETDATE()
);

-- ============================================================
-- SUBJECTS
-- ============================================================
CREATE TABLE subjects (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    course_id       INT NOT NULL REFERENCES courses(id),
    year_of_study   INT NOT NULL CHECK (year_of_study IN (1,2,3)),  -- 1=FY,2=SY,3=TY
    name            NVARCHAR(200) NOT NULL,
    subject_type    NVARCHAR(20) NOT NULL CHECK (subject_type IN ('core','elective')),
    elective_group  NVARCHAR(10) NULL,   -- e.g. 'A','B' for grouping electives
    created_at      DATETIME2 DEFAULT GETDATE()
);

-- ============================================================
-- FEE STRUCTURES
-- ============================================================
CREATE TABLE fee_structures (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    college_id      INT NOT NULL REFERENCES colleges(id),
    course_id       INT NOT NULL REFERENCES courses(id),
    year_of_study   INT NOT NULL CHECK (year_of_study IN (1,2,3)),
    category        NVARCHAR(20) NOT NULL CHECK (category IN ('grant','non-grant')),
    tuition_fee     DECIMAL(10,2) NOT NULL DEFAULT 0,
    exam_fee        DECIMAL(10,2) NOT NULL DEFAULT 0,
    other_fee       DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at      DATETIME2 DEFAULT GETDATE()
);

-- ============================================================
-- DOCUMENT TYPES MASTER
-- ============================================================
CREATE TABLE document_types (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    name        NVARCHAR(100) NOT NULL,   -- e.g. Aadhaar, Photo, 12th Marksheet
    description NVARCHAR(300),
    created_at  DATETIME2 DEFAULT GETDATE()
);

-- ============================================================
-- REQUIRED DOCUMENTS (per college/course/year)
-- ============================================================
CREATE TABLE required_documents (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    college_id          INT NOT NULL REFERENCES colleges(id),
    course_id           INT NOT NULL REFERENCES courses(id),
    year_of_study       INT NOT NULL CHECK (year_of_study IN (1,2,3)),
    document_type_id    INT NOT NULL REFERENCES document_types(id),
    is_mandatory        BIT NOT NULL DEFAULT 1,
    created_at          DATETIME2 DEFAULT GETDATE()
);

-- ============================================================
-- STUDENTS
-- ============================================================
CREATE TABLE students (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    full_name       NVARCHAR(200) NOT NULL,
    email           NVARCHAR(150) UNIQUE NOT NULL,
    password_hash   NVARCHAR(255) NOT NULL,
    phone           NVARCHAR(20),
    dob             DATE,
    gender          NVARCHAR(10),
    address         NVARCHAR(500),
    city            NVARCHAR(100),
    aadhaar_number  NVARCHAR(20),
    category        NVARCHAR(30),   -- general/obc/sc/st
    created_at      DATETIME2 DEFAULT GETDATE()
);

-- ============================================================
-- ADMISSION PERIODS (college controls open/close per course/year)
-- ============================================================
CREATE TABLE admission_periods (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    college_id      INT NOT NULL REFERENCES colleges(id),
    course_id       INT NOT NULL REFERENCES courses(id),
    year_of_study   INT NOT NULL CHECK (year_of_study IN (1,2,3)),
    academic_year   NVARCHAR(10) NOT NULL,   -- e.g. 2026-27
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    total_seats     INT NOT NULL,
    filled_seats    INT NOT NULL DEFAULT 0,
    application_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_active       BIT NOT NULL DEFAULT 1,
    created_at      DATETIME2 DEFAULT GETDATE()
);

-- ============================================================
-- STUDENT DOCUMENTS (uploaded once per student per type)
-- ============================================================
CREATE TABLE student_documents (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    student_id          INT NOT NULL REFERENCES students(id),
    document_type_id    INT NOT NULL REFERENCES document_types(id),
    file_name           NVARCHAR(300) NOT NULL,
    file_path           NVARCHAR(500) NOT NULL,
    uploaded_at         DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT uq_student_doc UNIQUE (student_id, document_type_id)
);

-- ============================================================
-- APPLICATIONS (central state machine table)
-- ============================================================
CREATE TABLE applications (
    id                      INT IDENTITY(1,1) PRIMARY KEY,
    registration_number     NVARCHAR(30) NULL,          -- generated after submission; filtered unique index below
    student_id              INT NOT NULL REFERENCES students(id),
    college_id              INT NOT NULL REFERENCES colleges(id),
    course_id               INT NOT NULL REFERENCES courses(id),
    year_of_study           INT NOT NULL CHECK (year_of_study IN (1,2,3)),
    academic_year           NVARCHAR(10) NOT NULL,
    admission_period_id     INT NOT NULL REFERENCES admission_periods(id),
    status                  NVARCHAR(30) NOT NULL DEFAULT 'draft'
                            CHECK (status IN (
                                'draft','payment_pending','submitted','under_review',
                                'approved','document_verification','confirmed',
                                'fees_paid','roll_assigned','enrolled',
                                'rejected','cancelled'
                            )),
    rejection_reason        NVARCHAR(500) NULL,
    cancellation_reason     NVARCHAR(500) NULL,
    roll_number             NVARCHAR(20) NULL,
    application_fee_paid    BIT NOT NULL DEFAULT 0,
    college_fee_paid        BIT NOT NULL DEFAULT 0,
    submitted_at            DATETIME2 NULL,
    approved_at             DATETIME2 NULL,
    confirmed_at            DATETIME2 NULL,
    enrolled_at             DATETIME2 NULL,
    created_at              DATETIME2 DEFAULT GETDATE(),
    updated_at              DATETIME2 DEFAULT GETDATE()
);

-- Filtered unique index: enforces uniqueness only on non-NULL registration_number
-- (MSSQL UNIQUE constraint treats multiple NULLs as duplicates, so we use a filtered index)
CREATE UNIQUE INDEX uix_applications_reg_number
    ON applications (registration_number)
    WHERE registration_number IS NOT NULL;

-- ============================================================
-- APPLICATION DOCUMENTS (links application to student_documents)
-- ============================================================
CREATE TABLE application_documents (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    application_id      INT NOT NULL REFERENCES applications(id),
    student_document_id INT NOT NULL REFERENCES student_documents(id),
    document_type_id    INT NOT NULL REFERENCES document_types(id),
    is_verified         BIT NOT NULL DEFAULT 0,
    verified_at         DATETIME2 NULL,
    created_at          DATETIME2 DEFAULT GETDATE()
);

-- ============================================================
-- APPLICATION SUBJECTS (chosen after enrollment)
-- ============================================================
CREATE TABLE application_subjects (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    application_id  INT NOT NULL REFERENCES applications(id),
    subject_id      INT NOT NULL REFERENCES subjects(id),
    created_at      DATETIME2 DEFAULT GETDATE()
);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE payments (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    application_id      INT NOT NULL REFERENCES applications(id),
    payment_type        NVARCHAR(20) NOT NULL CHECK (payment_type IN ('application_fee','college_fee')),
    amount              DECIMAL(10,2) NOT NULL,
    gateway_order_id    NVARCHAR(100) NULL,
    gateway_payment_id  NVARCHAR(100) NULL,
    status              NVARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','success','failed','cancelled')),
    attempted_at        DATETIME2 DEFAULT GETDATE(),
    completed_at        DATETIME2 NULL
);
