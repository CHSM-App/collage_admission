-- ============================================================
-- 007_applications_missing_columns.sql
-- Adds columns referenced in application_form.js routes that
-- were absent from the live applications table.
-- Idempotent — each column added only if missing.
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'app_special_status')
    ALTER TABLE applications ADD app_special_status NVARCHAR(100) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'fees_category_override')
    ALTER TABLE applications ADD fees_category_override BIT NULL DEFAULT 0;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'fees_category_override_remark')
    ALTER TABLE applications ADD fees_category_override_remark NVARCHAR(500) NULL;
GO
