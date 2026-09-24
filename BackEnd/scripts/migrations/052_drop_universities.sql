-- Migration 052: Drop the universities / shared program catalogue
-- Date: 2026-09-23
--
-- Reverses migrations 048 and 049 (both removed). Programs stay per-college in
-- faculty_master, which 048/049 never modified, so nothing live is affected.
-- faculty_master.university_faculty_no is from migration 046 and is KEPT — the
-- groupmaster import resolves against it.

IF COL_LENGTH('colleges', 'university_id') IS NOT NULL
BEGIN
    DECLARE @fk NVARCHAR(200) = (
        SELECT TOP 1 name FROM sys.foreign_keys
        WHERE parent_object_id = OBJECT_ID('colleges')
          AND EXISTS (SELECT 1 FROM sys.foreign_key_columns fkc
                      WHERE fkc.constraint_object_id = sys.foreign_keys.object_id
                        AND fkc.parent_column_id = COLUMNPROPERTY(OBJECT_ID('colleges'), 'university_id', 'ColumnId'))
    );
    IF @fk IS NOT NULL EXEC('ALTER TABLE colleges DROP CONSTRAINT [' + @fk + ']');
    ALTER TABLE colleges DROP COLUMN university_id;
END
GO

IF COL_LENGTH('colleges$Arc', 'university_id') IS NOT NULL
    ALTER TABLE [colleges$Arc] DROP COLUMN university_id;
GO

IF OBJECT_ID('program_templates', 'U') IS NOT NULL DROP TABLE program_templates;
GO

IF OBJECT_ID('universities', 'U') IS NOT NULL DROP TABLE universities;
GO
