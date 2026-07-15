-- Migration 042: Exam registration
-- Date: 2026-07-14
-- One row per (student application, semester, subject). Records which subjects a
-- confirmed student is sitting for in a given semester, and under what exam type.
--
-- exam_type is single-valued: a subject is either a regular registration (RR),
-- an open elective (OE), or a repeat attempt (Repeater) — never more than one.
--
-- Keyed to application_id (not student_id) because a student re-applies each
-- year; the application row is what pins them to a college + course + academic
-- year + semester.

IF OBJECT_ID('exam_registrations', 'U') IS NULL
CREATE TABLE exam_registrations (
    id                INT IDENTITY(1,1) PRIMARY KEY,
    college_id        INT           NOT NULL REFERENCES colleges(id),
    application_id    INT           NOT NULL REFERENCES applications(id),
    faculty_master_id INT           NOT NULL REFERENCES faculty_master(code_no),
    semester          INT           NOT NULL,
    academic_year     NVARCHAR(10)  NOT NULL,
    course_master_id  INT           NOT NULL REFERENCES course_master(id),
    subject_code      NVARCHAR(30)  NOT NULL,
    subject_title     NVARCHAR(200) NOT NULL,
    exam_type         NVARCHAR(10)  NOT NULL DEFAULT 'RR'
                      CONSTRAINT chk_exam_reg_type CHECK (exam_type IN ('RR','OE','Repeater')),
    created_by        NVARCHAR(150) NULL,
    updated_by        NVARCHAR(150) NULL,
    created_at        DATETIME2     NOT NULL DEFAULT GETDATE(),
    updated_at        DATETIME2     NULL,
    -- A student sits a given subject once per semester.
    CONSTRAINT uq_exam_reg UNIQUE (application_id, semester, course_master_id)
);
GO

-- The page always loads by college + faculty + semester + academic year.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_exam_reg_lookup')
    CREATE INDEX ix_exam_reg_lookup
        ON exam_registrations (college_id, faculty_master_id, semester, academic_year);
GO

-- Marks entry (built next) joins straight from a registration row.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_exam_reg_app')
    CREATE INDEX ix_exam_reg_app ON exam_registrations (application_id);
GO
