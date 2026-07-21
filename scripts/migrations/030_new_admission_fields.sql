-- Migration 030: Add new admission fields to applications table
-- Date: 2026-07-09

ALTER TABLE applications
ADD
  app_hsc_maths          BIT           NULL DEFAULT 0,
  app_hsc_biology        BIT           NULL DEFAULT 0,
  app_hostel_facility    BIT           NULL DEFAULT 0,
  app_admitted_category  NVARCHAR(50)  NULL,
  app_other_category     NVARCHAR(50)  NULL,
  app_admission_quota    NVARCHAR(50)  NULL,
  app_father_surname     NVARCHAR(100) NULL,
  app_father_first_name  NVARCHAR(100) NULL,
  app_father_middle_name NVARCHAR(100) NULL,
  app_mother_surname     NVARCHAR(100) NULL,
  app_mother_first_name  NVARCHAR(100) NULL,
  app_mother_middle_name NVARCHAR(100) NULL;
GO

-- Add to audit table as well
ALTER TABLE [applications$Arc]
ADD
  app_hsc_maths          BIT           NULL,
  app_hsc_biology        BIT           NULL,
  app_hostel_facility    BIT           NULL,
  app_admitted_category  NVARCHAR(50)  NULL,
  app_other_category     NVARCHAR(50)  NULL,
  app_admission_quota    NVARCHAR(50)  NULL,
  app_father_surname     NVARCHAR(100) NULL,
  app_father_first_name  NVARCHAR(100) NULL,
  app_father_middle_name NVARCHAR(100) NULL,
  app_mother_surname     NVARCHAR(100) NULL,
  app_mother_first_name  NVARCHAR(100) NULL,
  app_mother_middle_name NVARCHAR(100) NULL;
