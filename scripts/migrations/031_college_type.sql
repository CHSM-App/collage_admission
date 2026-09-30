-- Migration 031: Add college_type to colleges
-- Date: 2026-07-10
-- A college's type (general | agriculture) drives which features_config bundle
-- its admission form uses. Existing colleges default to 'general' and keep
-- their current features_config untouched.

ALTER TABLE colleges
ADD college_type NVARCHAR(20) NOT NULL CONSTRAINT df_colleges_college_type DEFAULT 'general';
GO

-- Add to audit table as well (no default — audit rows are copies)
ALTER TABLE [colleges$Arc]
ADD college_type NVARCHAR(20) NULL;
GO

-- Backfill any pre-existing rows explicitly (DEFAULT covers new inserts).
UPDATE colleges SET college_type = 'general' WHERE college_type IS NULL;
