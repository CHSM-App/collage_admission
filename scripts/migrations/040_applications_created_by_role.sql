-- Migration 040: Track who created an application (student vs college)
-- Date: 2026-07-13
--
-- The admission flow branches on this:
--   created_by_role = 'student' -> full scrutiny pipeline (accept, student visited,
--                                  division selection, fees set) before confirmation.
--   created_by_role = 'college' -> direct approval on application-fee payment
--                                  (the college is reviewing it inline).
--
-- Existing rows are backfilled to 'student' (the conservative default: they keep the
-- full scrutiny path).

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'applications' AND COLUMN_NAME = 'created_by_role'
)
BEGIN
    ALTER TABLE applications
    ADD created_by_role NVARCHAR(20) NOT NULL
        CONSTRAINT df_applications_created_by_role DEFAULT 'student';
END
GO

-- Audit table mirror
IF OBJECT_ID('[applications$Arc]', 'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_NAME = 'applications$Arc' AND COLUMN_NAME = 'created_by_role'
   )
    ALTER TABLE [applications$Arc] ADD created_by_role NVARCHAR(20) NULL;
GO

-- Backfill any pre-existing rows (DEFAULT covers new inserts).
UPDATE applications SET created_by_role = 'student' WHERE created_by_role IS NULL;
