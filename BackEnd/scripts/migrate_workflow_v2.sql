-- ============================================================
-- Migration: Workflow v2 — new status flow
-- Run this once against the existing database.
-- ============================================================

-- 1. Drop the old CHECK constraint on applications.status (name may vary)
--    Find the constraint name first:
--    SELECT name FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('applications')
--    Then drop it:
DECLARE @chk NVARCHAR(200)
SELECT @chk = name FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID('applications') AND [definition] LIKE '%status%'
IF @chk IS NOT NULL
  EXEC('ALTER TABLE applications DROP CONSTRAINT [' + @chk + ']')

-- 2. Add new CHECK constraint with updated statuses
ALTER TABLE applications
  ADD CONSTRAINT chk_applications_status
  CHECK (status IN (
    'draft','payment_pending','submitted','under_review',
    'correction_requested','correction_done',
    'doc_verified',
    'confirmed','fees_paid','roll_assigned','enrolled',
    'rejected','cancelled'
  ));

-- 3. Add missing columns if they don't already exist
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'status_updated_at')
  ALTER TABLE applications ADD status_updated_at DATETIME2 NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'correction_note')
  ALTER TABLE applications ADD correction_note NVARCHAR(1000) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'fee_total_amount')
  ALTER TABLE applications ADD fee_total_amount DECIMAL(12,2) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('applications') AND name = 'fee_pay_now_amount')
  ALTER TABLE applications ADD fee_pay_now_amount DECIMAL(12,2) NULL;

-- 4. Migrate any existing old statuses to new equivalents
UPDATE applications SET status = 'submitted'    WHERE status = 'payment_pending';
UPDATE applications SET status = 'doc_verified' WHERE status IN ('scrutiny_accepted', 'doc_verification_pending');
UPDATE applications SET status = 'confirmed'    WHERE status = 'approved' AND status NOT IN ('enrolled','fees_paid','roll_assigned');

-- 5. Create activity log table if it doesn't exist
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'application_activity_log')
  EXEC('
    CREATE TABLE application_activity_log (
      id             INT IDENTITY(1,1) PRIMARY KEY,
      application_id INT NOT NULL REFERENCES applications(id),
      action         NVARCHAR(60)   NOT NULL,
      actor_role     NVARCHAR(20)   NOT NULL,
      note           NVARCHAR(1000) NULL,
      created_at     DATETIME2 DEFAULT GETDATE()
    )
  ');

PRINT 'Migration complete.';
