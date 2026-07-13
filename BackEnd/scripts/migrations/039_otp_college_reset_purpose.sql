-- Migration 039: Add 'college_password_reset' as a valid OTP purpose
-- Date: 2026-07-11
-- Used for college admin / staff forgot-password (kept separate from the
-- student 'password_reset' purpose so the two flows never collide).

DECLARE @cname SYSNAME;
SELECT @cname = c.name
FROM sys.check_constraints c
JOIN sys.columns col ON col.object_id = c.parent_object_id AND col.column_id = c.parent_column_id
WHERE OBJECT_NAME(c.parent_object_id) = 'otp_store' AND col.name = 'purpose';

IF @cname IS NOT NULL
    EXEC('ALTER TABLE otp_store DROP CONSTRAINT ' + @cname);

ALTER TABLE otp_store
  ADD CONSTRAINT chk_otp_store_purpose
  CHECK (purpose IN ('registration', 'password_reset', 'student_transfer', 'college_password_reset'));
