-- Migration 036: Add app_semester to applications
-- Date: 2026-07-11
-- Semester the student is admitted into (1-8). Feature-gated field, used by
-- agriculture colleges (see features_config.admission_form.semester).

ALTER TABLE applications
ADD app_semester INT NULL;
GO

-- Audit table mirror
ALTER TABLE [applications$Arc]
ADD app_semester INT NULL;
