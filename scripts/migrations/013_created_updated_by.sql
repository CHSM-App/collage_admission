-- ============================================================
-- 013_created_updated_by.sql
-- Adds created_by / updated_by columns to all audited tables
-- that do not already have them.
--
-- Tables already covered (skipped here):
--   certificate_bonafide   — created_by INT, updated_by INT
--   certificate_character  — created_by INT, updated_by INT
--   certificate_noc        — created_by INT, updated_by INT
--   faculty_master         — created_by NVARCHAR(100), modified_by NVARCHAR(100)
--
-- All others get:
--   created_by  NVARCHAR(150) NULL
--   updated_by  NVARCHAR(150) NULL
-- ============================================================

-- ── admission_periods ────────────────────────────────────────
IF COL_LENGTH('admission_periods','created_by') IS NULL
    ALTER TABLE admission_periods ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('admission_periods','updated_by') IS NULL
    ALTER TABLE admission_periods ADD updated_by NVARCHAR(150) NULL;
GO

-- ── admins ───────────────────────────────────────────────────
IF COL_LENGTH('admins','created_by') IS NULL
    ALTER TABLE admins ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('admins','updated_by') IS NULL
    ALTER TABLE admins ADD updated_by NVARCHAR(150) NULL;
GO

-- ── colleges ─────────────────────────────────────────────────
IF COL_LENGTH('colleges','created_by') IS NULL
    ALTER TABLE colleges ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('colleges','updated_by') IS NULL
    ALTER TABLE colleges ADD updated_by NVARCHAR(150) NULL;
GO

-- ── college_roles ────────────────────────────────────────────
IF COL_LENGTH('college_roles','created_by') IS NULL
    ALTER TABLE college_roles ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('college_roles','updated_by') IS NULL
    ALTER TABLE college_roles ADD updated_by NVARCHAR(150) NULL;
GO

-- ── college_role_permissions ──────────────────────────────────
IF COL_LENGTH('college_role_permissions','created_by') IS NULL
    ALTER TABLE college_role_permissions ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('college_role_permissions','updated_by') IS NULL
    ALTER TABLE college_role_permissions ADD updated_by NVARCHAR(150) NULL;
GO

-- ── college_users ────────────────────────────────────────────
IF COL_LENGTH('college_users','created_by') IS NULL
    ALTER TABLE college_users ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('college_users','updated_by') IS NULL
    ALTER TABLE college_users ADD updated_by NVARCHAR(150) NULL;
GO

-- ── students ─────────────────────────────────────────────────
IF COL_LENGTH('students','created_by') IS NULL
    ALTER TABLE students ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('students','updated_by') IS NULL
    ALTER TABLE students ADD updated_by NVARCHAR(150) NULL;
GO

-- ── applications ─────────────────────────────────────────────
IF COL_LENGTH('applications','created_by') IS NULL
    ALTER TABLE applications ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('applications','updated_by') IS NULL
    ALTER TABLE applications ADD updated_by NVARCHAR(150) NULL;
GO

-- ── payments ─────────────────────────────────────────────────
IF COL_LENGTH('payments','created_by') IS NULL
    ALTER TABLE payments ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('payments','updated_by') IS NULL
    ALTER TABLE payments ADD updated_by NVARCHAR(150) NULL;
GO

-- ── fees_master ──────────────────────────────────────────────
IF COL_LENGTH('fees_master','created_by') IS NULL
    ALTER TABLE fees_master ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('fees_master','updated_by') IS NULL
    ALTER TABLE fees_master ADD updated_by NVARCHAR(150) NULL;
GO

-- ── classwise_fees ───────────────────────────────────────────
IF COL_LENGTH('classwise_fees','created_by') IS NULL
    ALTER TABLE classwise_fees ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('classwise_fees','updated_by') IS NULL
    ALTER TABLE classwise_fees ADD updated_by NVARCHAR(150) NULL;
GO

-- ── application_documents ────────────────────────────────────
IF COL_LENGTH('application_documents','created_by') IS NULL
    ALTER TABLE application_documents ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('application_documents','updated_by') IS NULL
    ALTER TABLE application_documents ADD updated_by NVARCHAR(150) NULL;
GO

-- ── bank_master ──────────────────────────────────────────────
IF COL_LENGTH('bank_master','created_by') IS NULL
    ALTER TABLE bank_master ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('bank_master','updated_by') IS NULL
    ALTER TABLE bank_master ADD updated_by NVARCHAR(150) NULL;
GO

-- ── course_master ────────────────────────────────────────────
IF COL_LENGTH('course_master','created_by') IS NULL
    ALTER TABLE course_master ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('course_master','updated_by') IS NULL
    ALTER TABLE course_master ADD updated_by NVARCHAR(150) NULL;
GO

-- ── division_master ──────────────────────────────────────────
IF COL_LENGTH('division_master','created_by') IS NULL
    ALTER TABLE division_master ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('division_master','updated_by') IS NULL
    ALTER TABLE division_master ADD updated_by NVARCHAR(150) NULL;
GO

-- ── group_master ─────────────────────────────────────────────
IF COL_LENGTH('group_master','created_by') IS NULL
    ALTER TABLE group_master ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('group_master','updated_by') IS NULL
    ALTER TABLE group_master ADD updated_by NVARCHAR(150) NULL;
GO

-- ── document_types ───────────────────────────────────────────
IF COL_LENGTH('document_types','created_by') IS NULL
    ALTER TABLE document_types ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('document_types','updated_by') IS NULL
    ALTER TABLE document_types ADD updated_by NVARCHAR(150) NULL;
GO

-- ── college_required_documents ───────────────────────────────
IF COL_LENGTH('college_required_documents','created_by') IS NULL
    ALTER TABLE college_required_documents ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('college_required_documents','updated_by') IS NULL
    ALTER TABLE college_required_documents ADD updated_by NVARCHAR(150) NULL;
GO

-- ── student_documents ───────────────────────────────────────
IF COL_LENGTH('student_documents','created_by') IS NULL
    ALTER TABLE student_documents ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('student_documents','updated_by') IS NULL
    ALTER TABLE student_documents ADD updated_by NVARCHAR(150) NULL;
GO

-- ── $Arc tables — add created_by / updated_by columns ────────
-- admission_periods$Arc
IF COL_LENGTH('admission_periods$Arc','created_by') IS NULL
    ALTER TABLE [admission_periods$Arc] ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('admission_periods$Arc','updated_by') IS NULL
    ALTER TABLE [admission_periods$Arc] ADD updated_by NVARCHAR(150) NULL;
GO

-- admins$Arc
IF COL_LENGTH('admins$Arc','created_by') IS NULL
    ALTER TABLE [admins$Arc] ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('admins$Arc','updated_by') IS NULL
    ALTER TABLE [admins$Arc] ADD updated_by NVARCHAR(150) NULL;
GO

-- colleges$Arc
IF COL_LENGTH('colleges$Arc','created_by') IS NULL
    ALTER TABLE [colleges$Arc] ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('colleges$Arc','updated_by') IS NULL
    ALTER TABLE [colleges$Arc] ADD updated_by NVARCHAR(150) NULL;
GO

-- college_roles$Arc
IF COL_LENGTH('college_roles$Arc','created_by') IS NULL
    ALTER TABLE [college_roles$Arc] ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('college_roles$Arc','updated_by') IS NULL
    ALTER TABLE [college_roles$Arc] ADD updated_by NVARCHAR(150) NULL;
GO

-- college_role_permissions$Arc
IF COL_LENGTH('college_role_permissions$Arc','created_by') IS NULL
    ALTER TABLE [college_role_permissions$Arc] ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('college_role_permissions$Arc','updated_by') IS NULL
    ALTER TABLE [college_role_permissions$Arc] ADD updated_by NVARCHAR(150) NULL;
GO

-- college_users$Arc
IF COL_LENGTH('college_users$Arc','created_by') IS NULL
    ALTER TABLE [college_users$Arc] ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('college_users$Arc','updated_by') IS NULL
    ALTER TABLE [college_users$Arc] ADD updated_by NVARCHAR(150) NULL;
GO

-- students$Arc
IF COL_LENGTH('students$Arc','created_by') IS NULL
    ALTER TABLE [students$Arc] ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('students$Arc','updated_by') IS NULL
    ALTER TABLE [students$Arc] ADD updated_by NVARCHAR(150) NULL;
GO

-- applications$Arc
IF COL_LENGTH('applications$Arc','created_by') IS NULL
    ALTER TABLE [applications$Arc] ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('applications$Arc','updated_by') IS NULL
    ALTER TABLE [applications$Arc] ADD updated_by NVARCHAR(150) NULL;
GO

-- payments$Arc
IF COL_LENGTH('payments$Arc','created_by') IS NULL
    ALTER TABLE [payments$Arc] ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('payments$Arc','updated_by') IS NULL
    ALTER TABLE [payments$Arc] ADD updated_by NVARCHAR(150) NULL;
GO

-- fees_master$Arc
IF COL_LENGTH('fees_master$Arc','created_by') IS NULL
    ALTER TABLE [fees_master$Arc] ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('fees_master$Arc','updated_by') IS NULL
    ALTER TABLE [fees_master$Arc] ADD updated_by NVARCHAR(150) NULL;
GO

-- classwise_fees$Arc
IF COL_LENGTH('classwise_fees$Arc','created_by') IS NULL
    ALTER TABLE [classwise_fees$Arc] ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('classwise_fees$Arc','updated_by') IS NULL
    ALTER TABLE [classwise_fees$Arc] ADD updated_by NVARCHAR(150) NULL;
GO

-- application_documents$Arc
IF COL_LENGTH('application_documents$Arc','created_by') IS NULL
    ALTER TABLE [application_documents$Arc] ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('application_documents$Arc','updated_by') IS NULL
    ALTER TABLE [application_documents$Arc] ADD updated_by NVARCHAR(150) NULL;
GO

-- bank_master$Arc
IF COL_LENGTH('bank_master$Arc','created_by') IS NULL
    ALTER TABLE [bank_master$Arc] ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('bank_master$Arc','updated_by') IS NULL
    ALTER TABLE [bank_master$Arc] ADD updated_by NVARCHAR(150) NULL;
GO

-- course_master$Arc
IF COL_LENGTH('course_master$Arc','created_by') IS NULL
    ALTER TABLE [course_master$Arc] ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('course_master$Arc','updated_by') IS NULL
    ALTER TABLE [course_master$Arc] ADD updated_by NVARCHAR(150) NULL;
GO

-- division_master$Arc
IF COL_LENGTH('division_master$Arc','created_by') IS NULL
    ALTER TABLE [division_master$Arc] ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('division_master$Arc','updated_by') IS NULL
    ALTER TABLE [division_master$Arc] ADD updated_by NVARCHAR(150) NULL;
GO

-- group_master$Arc
IF COL_LENGTH('group_master$Arc','created_by') IS NULL
    ALTER TABLE [group_master$Arc] ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('group_master$Arc','updated_by') IS NULL
    ALTER TABLE [group_master$Arc] ADD updated_by NVARCHAR(150) NULL;
GO

-- document_types$Arc
IF COL_LENGTH('document_types$Arc','created_by') IS NULL
    ALTER TABLE [document_types$Arc] ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('document_types$Arc','updated_by') IS NULL
    ALTER TABLE [document_types$Arc] ADD updated_by NVARCHAR(150) NULL;
GO

-- college_required_documents$Arc
IF COL_LENGTH('college_required_documents$Arc','created_by') IS NULL
    ALTER TABLE [college_required_documents$Arc] ADD created_by NVARCHAR(150) NULL;
GO
IF COL_LENGTH('college_required_documents$Arc','updated_by') IS NULL
    ALTER TABLE [college_required_documents$Arc] ADD updated_by NVARCHAR(150) NULL;
GO
