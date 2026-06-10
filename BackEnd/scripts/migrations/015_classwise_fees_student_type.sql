-- ============================================================
-- Migration 015: Add student_type to classwise_fees
-- Values: 'Grand' | 'NonGrand' | 'Outsider'
-- The unique constraint must include student_type so the same
-- fee head can have different overrides per student type.
-- ============================================================

-- 1. Drop the old unique constraint
IF EXISTS (
  SELECT 1 FROM sys.key_constraints
  WHERE name = 'uq_classwise_fees' AND parent_object_id = OBJECT_ID('classwise_fees')
)
  ALTER TABLE classwise_fees DROP CONSTRAINT uq_classwise_fees;
GO

-- 2. Add student_type column (default 'Grand' for existing rows)
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('classwise_fees') AND name = 'student_type'
)
  ALTER TABLE classwise_fees
    ADD student_type NVARCHAR(20) NOT NULL DEFAULT 'Grand'
      CONSTRAINT chk_classwise_fees_student_type CHECK (student_type IN ('Grand','NonGrand','Outsider'));
GO

-- 3. Re-create unique constraint including student_type
IF NOT EXISTS (
  SELECT 1 FROM sys.key_constraints
  WHERE name = 'uq_classwise_fees' AND parent_object_id = OBJECT_ID('classwise_fees')
)
  ALTER TABLE classwise_fees
    ADD CONSTRAINT uq_classwise_fees
      UNIQUE (college_id, faculty_master_id, year_level, fees_code, student_type);
GO
