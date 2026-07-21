-- Migration 024: Add notes column to payments table
-- Stores JSON metadata e.g. {"fee_codes":[1,2],"note":"..."}

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'payments' AND COLUMN_NAME = 'notes'
)
BEGIN
  ALTER TABLE payments ADD notes NVARCHAR(MAX) NULL;
END
GO
