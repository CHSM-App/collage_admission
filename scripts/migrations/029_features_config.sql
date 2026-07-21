-- Migration 029: Add features_config column to colleges table
-- Date: 2026-07-09

-- Add features_config column to colleges
ALTER TABLE colleges
ADD features_config NVARCHAR(MAX) NULL;

-- Add features_config to audit table as well
ALTER TABLE [colleges$Arc]
ADD features_config NVARCHAR(MAX) NULL;
GO

-- Set default features_config for all existing colleges
UPDATE colleges
SET features_config = N'{
  "payment": {
    "platform_fee": true,
    "college_fee": false
  },
  "admission_form": {
    "caste_category": true,
    "admitted_category": false,
    "other_category": false,
    "admission_quota": false,
    "hostel_facility": false,
    "hsc_subject_flags": false,
    "bank_details": true,
    "abc_id": true,
    "prn": true,
    "father_name_split": false
  },
  "documents": {
    "required_docs": true,
    "certificate_checklist": false
  },
  "notifications": {
    "whatsapp": true,
    "email": true
  }
}'
WHERE features_config IS NULL;
