-- Migration 028: Add 'student_transfer' as a valid OTP purpose

-- Drop the existing inline CHECK constraint on otp_store.purpose
DECLARE @cn NVARCHAR(200)
SELECT @cn = c.name
FROM sys.check_constraints c
JOIN sys.columns col
  ON col.object_id = c.parent_object_id AND col.column_id = c.parent_column_id
WHERE OBJECT_NAME(c.parent_object_id) = 'otp_store' AND col.name = 'purpose'

IF @cn IS NOT NULL
  EXEC('ALTER TABLE otp_store DROP CONSTRAINT [' + @cn + ']')
GO

ALTER TABLE otp_store
  ADD CONSTRAINT chk_otp_store_purpose
  CHECK (purpose IN ('registration', 'password_reset', 'student_transfer'))
GO
