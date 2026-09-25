-- Migration 054: Student email optional
-- Date: 2026-09-24
--
-- Students log in by phone (unique); email is contact info only. College staff
-- registering a student at the counter often have no email for them, so the
-- column must accept NULL instead of forcing a placeholder value.

IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('students') AND name = 'email' AND is_nullable = 0)
    ALTER TABLE students ALTER COLUMN email NVARCHAR(150) NULL;
GO
