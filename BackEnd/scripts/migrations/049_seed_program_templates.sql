-- Migration 049: Seed universities and the program catalogue from existing data
-- Date: 2026-09-23
--
-- Backfill only — creates a university per distinct college_type currently in
-- use, links existing colleges to it, and lifts each college's current programs
-- into that university's template. Nothing in faculty_master is modified, so
-- live courses, groups, admission periods and applications are untouched.
--
-- The generated university names are a best guess from the colleges present and
-- are meant to be renamed in the super-admin UI.

SET NOCOUNT ON;

-- ── Universities, one per college_type actually in use ───────
IF NOT EXISTS (SELECT 1 FROM universities WHERE name = N'University of Mumbai')
   AND EXISTS (SELECT 1 FROM colleges WHERE college_type = 'general')
    INSERT INTO universities (name, short_code, created_by)
    VALUES (N'University of Mumbai', N'MU', N'migration-049');

IF NOT EXISTS (SELECT 1 FROM universities WHERE name = N'Dr. Balasaheb Sawant Konkan Krishi Vidyapeeth')
   AND EXISTS (SELECT 1 FROM colleges WHERE college_type = 'agriculture')
    INSERT INTO universities (name, short_code, created_by)
    VALUES (N'Dr. Balasaheb Sawant Konkan Krishi Vidyapeeth', N'BSKKV', N'migration-049');
GO

-- ── Link each college to its university ──────────────────────
UPDATE c
SET    university_id = u.id
FROM   colleges c
JOIN   universities u
  ON   u.name = CASE c.college_type
                  WHEN 'agriculture' THEN N'Dr. Balasaheb Sawant Konkan Krishi Vidyapeeth'
                  ELSE N'University of Mumbai'
                END
WHERE  c.university_id IS NULL;
GO

-- ── Lift existing programs into the shared catalogue ─────────
-- One template row per (university, degree_course_code). Where two colleges of
-- the same university hold the same program, prefer the row that already has a
-- university_faculty_no — that is the one the groupmaster import depends on.
WITH ranked AS (
  SELECT f.*,
         c.university_id,
         ROW_NUMBER() OVER (
           PARTITION BY c.university_id, f.degree_course_code
           ORDER BY CASE WHEN f.university_faculty_no IS NULL THEN 1 ELSE 0 END,
                    f.university_faculty_no,
                    f.code_no
         ) AS rn
  FROM   faculty_master f
  JOIN   colleges c ON c.id = f.college_id
  WHERE  c.university_id IS NOT NULL
)
INSERT INTO program_templates (
    university_id, degree_course_code, degree_course_name, duration_years,
    university_faculty_no,
    unique_code_sem1, unique_code_sem2, unique_code_sem3, unique_code_sem4, unique_code_sem5,
    unique_code_sem6, unique_code_sem7, unique_code_sem8, unique_code_sem9, unique_code_sem10,
    exam_seat_code_year1, exam_seat_code_year2, exam_seat_code_year3,
    exam_seat_code_year4, exam_seat_code_year5,
    is_active, created_by
)
SELECT r.university_id, r.degree_course_code, r.degree_course_name, r.duration_years,
       r.university_faculty_no,
       r.unique_code_sem1, r.unique_code_sem2, r.unique_code_sem3, r.unique_code_sem4, r.unique_code_sem5,
       r.unique_code_sem6, r.unique_code_sem7, r.unique_code_sem8, r.unique_code_sem9, r.unique_code_sem10,
       r.exam_seat_code_year1, r.exam_seat_code_year2, r.exam_seat_code_year3,
       r.exam_seat_code_year4, r.exam_seat_code_year5,
       1, N'migration-049'
FROM   ranked r
WHERE  r.rn = 1
  AND  NOT EXISTS (
         SELECT 1 FROM program_templates pt
         WHERE  pt.university_id = r.university_id
           AND  pt.degree_course_code = r.degree_course_code
       );
GO

-- Report what landed, so the operator can see it in the migration output.
SELECT u.name AS university,
       COUNT(pt.id) AS programs,
       SUM(CASE WHEN pt.university_faculty_no IS NULL THEN 1 ELSE 0 END) AS missing_faculty_no
FROM   universities u
LEFT JOIN program_templates pt ON pt.university_id = u.id
GROUP BY u.name;
GO
