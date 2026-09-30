-- Migration 023: Extend payment_type CHECK constraint to include misc_fee and exam_fee
-- Drop the existing constraint and recreate with the new allowed values.

-- Find and drop the existing CHECK constraint on payments.payment_type
DECLARE @constraintName NVARCHAR(200)
SELECT @constraintName = cc.name
FROM sys.check_constraints cc
JOIN sys.columns col ON col.object_id = cc.parent_object_id AND col.column_id = cc.parent_column_id
JOIN sys.tables t ON t.object_id = cc.parent_object_id
WHERE t.name = 'payments' AND col.name = 'payment_type'

IF @constraintName IS NOT NULL
BEGIN
  EXEC('ALTER TABLE payments DROP CONSTRAINT [' + @constraintName + ']')
END
GO

-- Recreate with misc_fee and exam_fee included
ALTER TABLE payments
  ADD CONSTRAINT CK_payments_payment_type
  CHECK (payment_type IN ('application_fee','college_fee','college_fee_installment','misc_fee','exam_fee'));
GO
