-- Migration: Add exam_type column to application_previous_exam
-- Run: sqlcmd -S <server> -d <db> -i migrate_exam_type.sql

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('application_previous_exam') AND name = 'exam_type'
)
BEGIN
  ALTER TABLE application_previous_exam
    ADD exam_type NVARCHAR(20) NULL;
  PRINT 'Column exam_type added.';
END
ELSE
  PRINT 'Column exam_type already exists — skipping.';

-- Mark existing rows as legacy (SSC by default since old form only stored one record)
UPDATE application_previous_exam SET exam_type = 'SSC' WHERE exam_type IS NULL;
PRINT 'Existing rows marked as SSC.';
