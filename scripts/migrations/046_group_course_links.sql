-- Migration 046: Link group members to Course Master, and give programs a
-- university faculty number.
-- Date: 2026-09-22
--
-- Group Master used to hold its members as free text: eleven fixed slots of
-- course_code + course_title with no relationship to course_master at all. A
-- renamed or deleted subject left the group silently pointing at nothing, and
-- there was no way to answer "which groups contain this subject?".
--
-- This migration adds the missing foreign key so a group is a set of *actual*
-- Course Master rows, and adds the university's own faculty number to
-- faculty_master so the groupmaster.xls importer can resolve its `faculty`
-- column (BA=1, BCOM=2, BSC=3 ...) to a program.
--
-- course_code stays on group_courses as a snapshot: legacy rows that predate
-- this migration have no course_master_id to resolve, and the importer stores
-- the source file's codes verbatim.
--
-- Note: the new columns are added to the $Arc tables but the audit triggers are
-- not re-emitted, so they archive as NULL until create_audit_triggers.sql is
-- next regenerated. Migration 045 (colleges.logo_url) left logo_url the same way.

-- ── faculty_master.university_faculty_no ─────────────────────
IF COL_LENGTH('faculty_master','university_faculty_no') IS NULL
    ALTER TABLE faculty_master ADD university_faculty_no INT NULL;
GO

IF COL_LENGTH('faculty_master$Arc','university_faculty_no') IS NULL
    ALTER TABLE [faculty_master$Arc] ADD university_faculty_no INT NULL;
GO

-- Filtered so the many programs that have no number yet do not collide on NULL.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_faculty_university_no' AND object_id = OBJECT_ID('faculty_master'))
    CREATE UNIQUE INDEX uq_faculty_university_no
        ON faculty_master (college_id, university_faculty_no)
        WHERE university_faculty_no IS NOT NULL;
GO

-- ── group_courses.course_master_id ───────────────────────────
IF COL_LENGTH('group_courses','course_master_id') IS NULL
    ALTER TABLE group_courses ADD course_master_id INT NULL REFERENCES course_master(id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_group_courses_course' AND object_id = OBJECT_ID('group_courses'))
    CREATE INDEX ix_group_courses_course ON group_courses (course_master_id);
GO

-- Backfill: match the stored course_code against Course Master within the
-- owning group's own program and semester. A group whose semester is NULL, or
-- a code that was never in Course Master, stays NULL — those are genuine
-- free-text rows and the UI renders them from the snapshot.
IF COL_LENGTH('group_courses','course_master_id') IS NOT NULL
UPDATE gc
   SET course_master_id = cm.id
  FROM group_courses gc
  JOIN group_master  gm ON gm.id = gc.group_id
  JOIN course_master cm ON cm.college_id        = gm.college_id
                       AND cm.faculty_master_id = gm.faculty_master_id
                       AND cm.semester          = gm.semester
                       AND cm.course_code       = gc.course_code
 WHERE gc.course_master_id IS NULL;
GO
