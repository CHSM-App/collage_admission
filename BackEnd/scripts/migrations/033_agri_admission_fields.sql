-- Migration 033: Add agriculture-form admission fields to applications table
-- Date: 2026-07-10
--   app_date_of_admission — date the student was admitted
--   app_is_diploma_direct_sy — "Diploma Student (Direct SY)" checkbox
--   app_name_as_on_aadhaar — student name exactly as printed on Aadhaar card
--   app_son_of — S/o name (if needed on Transcript & Certificate)

ALTER TABLE applications
ADD
  app_date_of_admission     DATE          NULL,
  app_is_diploma_direct_sy  BIT           NULL DEFAULT 0,
  app_name_as_on_aadhaar    NVARCHAR(200) NULL,
  app_son_of                NVARCHAR(200) NULL;
GO

-- Audit table mirror (no defaults — audit rows are copies)
ALTER TABLE [applications$Arc]
ADD
  app_date_of_admission     DATE          NULL,
  app_is_diploma_direct_sy  BIT           NULL,
  app_name_as_on_aadhaar    NVARCHAR(200) NULL,
  app_son_of                NVARCHAR(200) NULL;
