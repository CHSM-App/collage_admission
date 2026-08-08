-- Migration 034: Add general admission-form fields to applications table
-- Date: 2026-07-11
--   Native (permanent) address block, distinct from the existing local address
--   app_native_address, app_native_taluka, app_native_district
--   app_parent_mobile — parent's / guardian's mobile number
--   app_land_line — landline number
--   app_guardian_relation — relation of guardian with student

ALTER TABLE applications
ADD
  app_native_address    NVARCHAR(300) NULL,
  app_native_taluka     NVARCHAR(100) NULL,
  app_native_district   NVARCHAR(100) NULL,
  app_parent_mobile     NVARCHAR(20)  NULL,
  app_land_line         NVARCHAR(20)  NULL,
  app_guardian_relation NVARCHAR(50)  NULL;
GO

-- Audit table mirror
ALTER TABLE [applications$Arc]
ADD
  app_native_address    NVARCHAR(300) NULL,
  app_native_taluka     NVARCHAR(100) NULL,
  app_native_district   NVARCHAR(100) NULL,
  app_parent_mobile     NVARCHAR(20)  NULL,
  app_land_line         NVARCHAR(20)  NULL,
  app_guardian_relation NVARCHAR(50)  NULL;
