-- Migration 044: Atomic registration-number counters
-- Date: 2026-07-21
-- Replaces the old count-then-write registration-number generation (which could
-- produce duplicate numbers under concurrency and reuse freed serials after
-- deletion) with a per-scope atomic counter, mirroring receipt_counters.
--
-- Scope: one running serial per (college, course, year_of_study, academic_year).
-- The service MERGE-increments last_seq inside the caller's transaction, so
-- concurrent submissions are serialised by the row lock and can never collide.

IF OBJECT_ID('registration_counters', 'U') IS NULL
CREATE TABLE registration_counters (
    college_id     INT          NOT NULL,
    course_id      INT          NOT NULL,
    year_of_study  NVARCHAR(20) NOT NULL,
    academic_year  NVARCHAR(20) NOT NULL,
    last_seq       INT          NOT NULL DEFAULT 0,
    CONSTRAINT pk_registration_counters
        PRIMARY KEY (college_id, course_id, year_of_study, academic_year)
);
GO

-- Backfill counters from any registration numbers already issued, so the next
-- serial continues past existing rows rather than restarting at 1.
IF OBJECT_ID('registration_counters', 'U') IS NOT NULL
INSERT INTO registration_counters (college_id, course_id, year_of_study, academic_year, last_seq)
SELECT a.college_id,
       a.course_id,
       CAST(a.year_of_study AS NVARCHAR(20)),
       a.academic_year,
       COUNT(*)
FROM applications a
WHERE a.registration_number IS NOT NULL
  AND NOT EXISTS (
        SELECT 1 FROM registration_counters rc
        WHERE rc.college_id    = a.college_id
          AND rc.course_id     = a.course_id
          AND rc.year_of_study = CAST(a.year_of_study AS NVARCHAR(20))
          AND rc.academic_year = a.academic_year
      )
GROUP BY a.college_id, a.course_id,
         CAST(a.year_of_study AS NVARCHAR(20)), a.academic_year;
GO
