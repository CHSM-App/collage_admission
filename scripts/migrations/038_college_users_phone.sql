-- Migration 038: Add phone to college_users (staff)
-- Date: 2026-07-11
-- Staff need a phone number so they can receive a password-reset OTP.
-- Nullable (existing staff may not have one yet); not unique.

ALTER TABLE college_users
ADD phone NVARCHAR(20) NULL;
GO

-- Audit table mirror, if present
IF OBJECT_ID('[college_users$Arc]', 'U') IS NOT NULL
    ALTER TABLE [college_users$Arc] ADD phone NVARCHAR(20) NULL;
