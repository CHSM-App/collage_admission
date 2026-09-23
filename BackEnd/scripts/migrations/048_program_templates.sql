-- Migration 048: Shared program catalogue, per university
-- Date: 2026-09-23
--
-- Programs are the same for every college affiliated to the same university,
-- and their codes must stay fixed because coursemaster/groupmaster imports key
-- on them (group_master.faculty_master_id, and the `faculty` column of
-- groupmaster.xls resolved via university_faculty_no).
--
-- faculty_master stays per-college and is NOT restructured: 8 tables FK to
-- faculty_master.code_no and live applications/admission_periods point at it.
-- Instead the super admin owns a per-university TEMPLATE, and onboarding a
-- college copies the template rows into that college's faculty_master with the
-- canonical codes already filled in. Showing/hiding a program for one college
-- remains faculty_master.is_active, which already exists and is already
-- respected everywhere.

-- ── Universities ─────────────────────────────────────────────
IF OBJECT_ID('universities', 'U') IS NULL
CREATE TABLE universities (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    name        NVARCHAR(200) NOT NULL,
    short_code  NVARCHAR(20)  NULL,
    is_active   BIT           NOT NULL DEFAULT 1,
    created_by  NVARCHAR(100) NULL,
    created_at  DATETIME2     DEFAULT GETDATE(),
    CONSTRAINT uq_universities_name UNIQUE (name)
);
GO

-- ── Program templates (the shared catalogue) ─────────────────
-- Mirrors the shape of faculty_master minus college_id, so a template row can
-- be copied into faculty_master column-for-column.
IF OBJECT_ID('program_templates', 'U') IS NULL
CREATE TABLE program_templates (
    id                      INT IDENTITY(1,1) PRIMARY KEY,
    university_id           INT           NOT NULL REFERENCES universities(id),
    degree_course_code      NVARCHAR(20)  NOT NULL,
    degree_course_name      NVARCHAR(200) NOT NULL,
    duration_years          INT           NOT NULL DEFAULT 3,
    university_faculty_no   INT           NULL,
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
    created_at              DATETIME2     DEFAULT GETDATE(),
    CONSTRAINT uq_program_template_code UNIQUE (university_id, degree_course_code)
);
GO

-- The university's own faculty number is what groupmaster.xls resolves against,
-- so it must not repeat inside one university. Filtered: it is nullable until
-- the admin fills it in.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_program_template_faculty_no')
    CREATE UNIQUE INDEX uq_program_template_faculty_no
        ON program_templates (university_id, university_faculty_no)
        WHERE university_faculty_no IS NOT NULL;
GO

-- ── Link colleges to their university ────────────────────────
IF COL_LENGTH('colleges', 'university_id') IS NULL
    ALTER TABLE colleges ADD university_id INT NULL REFERENCES universities(id);
GO

IF COL_LENGTH('colleges$Arc', 'university_id') IS NULL
    ALTER TABLE [colleges$Arc] ADD university_id INT NULL;
GO
