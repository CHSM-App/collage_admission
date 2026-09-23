-- Migration 050: Split student name into parts
-- Date: 2026-09-23
--
-- The admission form asks for surname / first name / middle name
-- (applications.app_surname, app_first_name, app_middle_name), but registration
-- only ever captured a single full_name. So a first-time applicant had nothing
-- to autofill from and retyped their own name.
--
-- full_name is KEPT and stays authoritative for display, login greetings and
-- every existing query. The parts are additive.

IF COL_LENGTH('students', 'surname') IS NULL
    ALTER TABLE students ADD surname NVARCHAR(100) NULL;
GO
IF COL_LENGTH('students', 'first_name') IS NULL
    ALTER TABLE students ADD first_name NVARCHAR(100) NULL;
GO
IF COL_LENGTH('students', 'middle_name') IS NULL
    ALTER TABLE students ADD middle_name NVARCHAR(100) NULL;
GO

-- Backfill from the most recent application the student actually completed —
-- that form already holds the properly split, college-verified spelling.
UPDATE s
SET    s.surname     = la.app_surname,
       s.first_name  = la.app_first_name,
       s.middle_name = la.app_middle_name
FROM   students s
CROSS APPLY (
  SELECT TOP 1 a.app_surname, a.app_first_name, a.app_middle_name
  FROM   applications a
  WHERE  a.student_id = s.id
    AND  a.status NOT IN ('draft', 'rejected', 'cancelled')
    AND  NULLIF(LTRIM(RTRIM(a.app_surname)), '') IS NOT NULL
  ORDER BY a.created_at DESC
) la
WHERE  s.surname IS NULL;
GO

-- Whatever is left has never completed an application. Split full_name on
-- whitespace using the same "Surname First Middle" order the form uses.
-- Single-word names become the surname; anything past the third word is folded
-- into the middle name rather than dropped.
UPDATE students
SET    surname    = LTRIM(RTRIM(LEFT(nm, CHARINDEX(' ', nm + ' ') - 1))),
       first_name = LTRIM(RTRIM(
                      CASE WHEN CHARINDEX(' ', nm) = 0 THEN ''
                           ELSE LEFT(SUBSTRING(nm, CHARINDEX(' ', nm) + 1, 200),
                                     CHARINDEX(' ', SUBSTRING(nm, CHARINDEX(' ', nm) + 1, 200) + ' ') - 1)
                      END)),
       middle_name = LTRIM(RTRIM(
                      CASE WHEN CHARINDEX(' ', nm) = 0 THEN ''
                           WHEN CHARINDEX(' ', SUBSTRING(nm, CHARINDEX(' ', nm) + 1, 200)) = 0 THEN ''
                           ELSE SUBSTRING(SUBSTRING(nm, CHARINDEX(' ', nm) + 1, 200),
                                          CHARINDEX(' ', SUBSTRING(nm, CHARINDEX(' ', nm) + 1, 200)) + 1, 200)
                      END))
FROM   (SELECT id, LTRIM(RTRIM(REPLACE(full_name, '  ', ' '))) AS nm FROM students) src
WHERE  students.id = src.id
  AND  students.surname IS NULL
  AND  NULLIF(LTRIM(RTRIM(students.full_name)), '') IS NOT NULL;
GO

-- Blank strings from the splits above read better as NULL.
UPDATE students SET first_name  = NULL WHERE first_name  = '';
UPDATE students SET middle_name = NULL WHERE middle_name = '';
GO
