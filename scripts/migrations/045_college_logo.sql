-- Migration 045: Add logo_url column to colleges table
-- Date: 2026-09-21
--
-- Each college gets a white-labelled student portal at /c/<college_code>.
-- The logo renders on the public landing page, the login page and the student
-- sidebar, so the file is served from /logos (BackEnd/uploads/logos) — NOT from
-- BackEnd/public, which the frontend build wipes on every deploy.

ALTER TABLE colleges
ADD logo_url NVARCHAR(300) NULL;

-- Add logo_url to audit table as well
ALTER TABLE [colleges$Arc]
ADD logo_url NVARCHAR(300) NULL;
GO
