-- Migration: Add UNIQUE constraint on students.phone
-- Safe to re-run: checks for duplicates and existing constraint before applying
-- Run: sqlcmd -S <server> -d <database> -i migrate_phone_unique.sql

-- Step 1: Report any duplicate phone numbers
PRINT '=== Checking for duplicate phone numbers ==='

SELECT phone, COUNT(*) AS cnt
FROM students
WHERE phone IS NOT NULL
GROUP BY phone
HAVING COUNT(*) > 1

-- Step 2: Abort if duplicates found
IF EXISTS (
  SELECT 1 FROM students WHERE phone IS NOT NULL
  GROUP BY phone HAVING COUNT(*) > 1
)
BEGIN
  RAISERROR('DUPLICATE PHONES FOUND. Fix duplicates above before applying constraint.', 16, 1)
  RETURN
END

PRINT 'No duplicates found — safe to proceed.'

-- Step 3: Skip if constraint already exists
IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('students')
    AND name = 'uq_students_phone'
)
BEGIN
  PRINT 'Constraint uq_students_phone already exists — skipping.'
  RETURN
END

-- Step 4: Add the UNIQUE constraint
ALTER TABLE students
  ADD CONSTRAINT uq_students_phone UNIQUE (phone)

PRINT 'Constraint uq_students_phone added successfully.'
