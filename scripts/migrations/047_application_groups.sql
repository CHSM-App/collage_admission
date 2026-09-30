-- Migration 047: Record the subject group a student picks while applying.
-- Date: 2026-09-22
--
-- Group Master (migration 046) defines the valid subject combinations, but
-- nothing student-facing referenced them: the college only learned which
-- combination an applicant wanted after admission, through the post-admission
-- Subject Selection screen, which picks loose subjects rather than a group.
--
-- The application wizard now asks for one group per semester, for both
-- semesters of the applicant's year (year Y -> semesters 2Y-1 and 2Y). This
-- table holds that choice; the group's member courses are ALSO expanded into
-- application_subjects, so the college's existing application detail and print
-- views keep working with no change.
--
-- group_code is snapshotted alongside group_id for the same reason
-- group_courses snapshots course_code: the code is what the university's own
-- files carry, and it should survive a group being renamed or removed.

IF OBJECT_ID('application_groups', 'U') IS NULL
CREATE TABLE application_groups (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    application_id INT          NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    semester       INT          NOT NULL,   -- absolute semester (2Y-1 / 2Y)
    group_id       INT          NOT NULL REFERENCES group_master(id),
    group_code     NVARCHAR(20) NOT NULL,
    created_at     DATETIME2    NOT NULL DEFAULT GETDATE(),
    -- One group per semester, enforced by the database rather than by the API.
    CONSTRAINT uq_app_group UNIQUE (application_id, semester)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_application_groups_group' AND object_id = OBJECT_ID('application_groups'))
    CREATE INDEX ix_application_groups_group ON application_groups (group_id);
GO
