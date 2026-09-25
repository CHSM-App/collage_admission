-- ============================================================
-- 002_applications_app_fields.sql
-- Adds all app_* form snapshot columns + current_step +
-- declaration_accepted_at to the applications table.
-- Also adds exam_type to application_previous_exam.
-- Also adds prn column to students (used for autofill).
-- Also ensures paid_by / paid_by_user_id exist on payments.
-- Safe to run on existing databases — all changes are idempotent.
--
-- NOTE: All these columns are already in 001_base_schema.sql.
-- This file is only needed for databases created before 001 was
-- consolidated (i.e. existing production databases).
-- ============================================================

-- ── applications: multi-step form tracker ──────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'current_step')
    ALTER TABLE applications ADD current_step INT NOT NULL DEFAULT 1;
GO

-- ── applications: Step 1 — personal details ────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_mother_name')
    ALTER TABLE applications ADD app_mother_name NVARCHAR(200) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_sex')
    ALTER TABLE applications ADD app_sex NVARCHAR(10) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_address')
    ALTER TABLE applications ADD app_address NVARCHAR(500) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_taluka')
    ALTER TABLE applications ADD app_taluka NVARCHAR(100) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_district')
    ALTER TABLE applications ADD app_district NVARCHAR(100) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_state')
    ALTER TABLE applications ADD app_state NVARCHAR(100) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_degree_course_code')
    ALTER TABLE applications ADD app_degree_course_code NVARCHAR(20) NULL;
GO

-- ── applications: Step 2 — other details ───────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_birth_date')
    ALTER TABLE applications ADD app_birth_date DATE NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_birth_place')
    ALTER TABLE applications ADD app_birth_place NVARCHAR(200) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_birth_taluka')
    ALTER TABLE applications ADD app_birth_taluka NVARCHAR(100) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_birth_district')
    ALTER TABLE applications ADD app_birth_district NVARCHAR(100) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_birth_state')
    ALTER TABLE applications ADD app_birth_state NVARCHAR(100) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_nationality')
    ALTER TABLE applications ADD app_nationality NVARCHAR(100) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_marital_status')
    ALTER TABLE applications ADD app_marital_status NVARCHAR(20) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_religion')
    ALTER TABLE applications ADD app_religion NVARCHAR(100) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_caste')
    ALTER TABLE applications ADD app_caste NVARCHAR(100) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_mother_tongue')
    ALTER TABLE applications ADD app_mother_tongue NVARCHAR(100) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_height_cm')
    ALTER TABLE applications ADD app_height_cm DECIMAL(5,2) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_weight_kg')
    ALTER TABLE applications ADD app_weight_kg DECIMAL(5,2) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_blood_group')
    ALTER TABLE applications ADD app_blood_group NVARCHAR(5) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_father_full_name')
    ALTER TABLE applications ADD app_father_full_name NVARCHAR(200) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_son_daughter_no')
    ALTER TABLE applications ADD app_son_daughter_no INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_father_occupation')
    ALTER TABLE applications ADD app_father_occupation NVARCHAR(200) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_annual_income')
    ALTER TABLE applications ADD app_annual_income DECIMAL(12,2) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_aadhaar')
    ALTER TABLE applications ADD app_aadhaar NVARCHAR(20) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_prn')
    ALTER TABLE applications ADD app_prn NVARCHAR(50) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_abc_id')
    ALTER TABLE applications ADD app_abc_id NVARCHAR(50) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_bank_account')
    ALTER TABLE applications ADD app_bank_account NVARCHAR(50) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_bank_ifsc')
    ALTER TABLE applications ADD app_bank_ifsc NVARCHAR(20) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_bank_name')
    ALTER TABLE applications ADD app_bank_name NVARCHAR(200) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_bank_branch')
    ALTER TABLE applications ADD app_bank_branch NVARCHAR(200) NULL;
GO

-- ── applications: declaration timestamp ────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'declaration_accepted_at')
    ALTER TABLE applications ADD declaration_accepted_at DATETIME2 NULL;
GO

-- ── application_previous_exam: exam type ───────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('application_previous_exam') AND name = 'exam_type')
BEGIN
    ALTER TABLE application_previous_exam ADD exam_type NVARCHAR(20) NULL;
    -- Mark all existing rows as SSC (original/only exam type at time of migration)
    UPDATE application_previous_exam SET exam_type = 'SSC' WHERE exam_type IS NULL;
END
GO

-- ── students: prn for autofill across applications ─────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'prn')
    ALTER TABLE students ADD prn NVARCHAR(50) NULL;
GO

-- ── payments: who made the payment ─────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('payments') AND name = 'paid_by')
    ALTER TABLE payments ADD paid_by NVARCHAR(10) NULL
        CONSTRAINT chk_payments_paid_by CHECK (paid_by IN ('student','college'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('payments') AND name = 'paid_by_user_id')
    ALTER TABLE payments ADD paid_by_user_id INT NULL;
GO
