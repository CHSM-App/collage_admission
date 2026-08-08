-- Migration 037: Allow duplicate student emails.
-- Date: 2026-07-11
-- Students log in and reset passwords by PHONE, not email, so email does not
-- need to be unique. Phone remains UNIQUE (the real identifier).
-- This drops the UNIQUE constraint / unique index on students.email if present.
-- Email stays NOT NULL.

SET NOCOUNT ON;

DECLARE @sql NVARCHAR(MAX);

-- 1) Drop a UNIQUE KEY constraint on students.email (system-named), if any.
SELECT @sql = 'ALTER TABLE students DROP CONSTRAINT ' + QUOTENAME(kc.name) + ';'
FROM sys.key_constraints kc
JOIN sys.index_columns ic ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE kc.parent_object_id = OBJECT_ID('students')
  AND kc.type = 'UQ'
  AND c.name = 'email';

IF @sql IS NOT NULL
BEGIN
    EXEC sp_executesql @sql;
    PRINT 'Dropped UNIQUE constraint on students.email.';
END

-- 2) Drop a standalone UNIQUE INDEX on students.email (if the constraint was an index), if any.
SET @sql = NULL;
SELECT @sql = 'DROP INDEX ' + QUOTENAME(i.name) + ' ON students;'
FROM sys.indexes i
JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE i.object_id = OBJECT_ID('students')
  AND i.is_unique = 1
  AND i.is_primary_key = 0
  AND i.is_unique_constraint = 0
  AND c.name = 'email'
  -- only single-column indexes on email
  AND (SELECT COUNT(*) FROM sys.index_columns ic2 WHERE ic2.object_id = i.object_id AND ic2.index_id = i.index_id) = 1;

IF @sql IS NOT NULL
BEGIN
    EXEC sp_executesql @sql;
    PRINT 'Dropped UNIQUE index on students.email.';
END

PRINT 'Done: students.email is now non-unique (phone remains unique).';
