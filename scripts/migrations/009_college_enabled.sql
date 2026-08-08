-- ============================================================
-- 012_college_enabled.sql
-- Adds is_enabled column to colleges table.
-- Idempotent — safe to re-run.
-- ============================================================

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('colleges') AND name = 'is_enabled'
)
  ALTER TABLE colleges ADD is_enabled BIT NOT NULL DEFAULT 1;
GO
