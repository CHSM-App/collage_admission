-- ============================================================
-- 006_prev_exam_columns.sql
-- Ensures application_previous_exam has the column names the
-- route code (application_form.js) actually uses.
-- The original schema.sql used generic names (board_name etc.)
-- but the live DB and all route queries use the longer names.
-- Idempotent — each column added only if missing.
-- ============================================================

-- exam_type (already added by 002 but guard here too)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('application_previous_exam') AND name = 'exam_type')
    ALTER TABLE application_previous_exam ADD exam_type NVARCHAR(20) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('application_previous_exam') AND name = 'board_or_college_name')
    ALTER TABLE application_previous_exam ADD board_or_college_name NVARCHAR(200) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('application_previous_exam') AND name = 'school_or_college_address')
    ALTER TABLE application_previous_exam ADD school_or_college_address NVARCHAR(300) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('application_previous_exam') AND name = 'month_year_passing')
    ALTER TABLE application_previous_exam ADD month_year_passing NVARCHAR(20) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('application_previous_exam') AND name = 'total_marks_obtained')
    ALTER TABLE application_previous_exam ADD total_marks_obtained DECIMAL(8,2) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('application_previous_exam') AND name = 'total_marks_max')
    ALTER TABLE application_previous_exam ADD total_marks_max DECIMAL(8,2) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('application_previous_exam') AND name = 'class_grade')
    ALTER TABLE application_previous_exam ADD class_grade NVARCHAR(50) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('application_previous_exam') AND name = 'remark')
    ALTER TABLE application_previous_exam ADD remark NVARCHAR(500) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('application_previous_exam') AND name = 'updated_at')
    ALTER TABLE application_previous_exam ADD updated_at DATETIME2 NULL;
GO
