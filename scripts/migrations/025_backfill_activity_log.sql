-- Migration 025: Backfill activity log for existing applications
-- Inserts one activity entry per application based on its current status,
-- using status_updated_at as the timestamp (falls back to updated_at / created_at).
-- Only inserts where no log entry already exists for that application.

INSERT INTO application_activity_log (application_id, action, actor_role, note, created_at)
SELECT
  a.id AS application_id,
  CASE a.status
    WHEN 'submitted'                  THEN 'submitted'
    WHEN 'under_review'               THEN 'submitted'
    WHEN 'correction_requested'       THEN 'correction_requested'
    WHEN 'correction_done'            THEN 'correction_resubmitted'
    WHEN 'scrutiny_accepted'          THEN 'accepted'
    WHEN 'doc_verification_pending'   THEN 'accepted'
    WHEN 'doc_verified'               THEN 'accepted'
    WHEN 'confirmed'                  THEN 'confirmed'
    WHEN 'fees_paid'                  THEN 'fees_paid'
    WHEN 'roll_assigned'              THEN 'roll_assigned'
    WHEN 'enrolled'                   THEN 'enrolled'
    WHEN 'rejected'                   THEN 'rejected'
    WHEN 'cancelled'                  THEN 'cancelled'
    ELSE 'submitted'
  END AS action,
  CASE a.status
    WHEN 'submitted'                  THEN 'student'
    WHEN 'under_review'               THEN 'student'
    WHEN 'correction_requested'       THEN 'college'
    WHEN 'correction_done'            THEN 'student'
    WHEN 'scrutiny_accepted'          THEN 'college'
    WHEN 'doc_verification_pending'   THEN 'college'
    WHEN 'doc_verified'               THEN 'college'
    WHEN 'confirmed'                  THEN 'college'
    WHEN 'fees_paid'                  THEN 'student'
    WHEN 'roll_assigned'              THEN 'college'
    WHEN 'enrolled'                   THEN 'student'
    WHEN 'rejected'                   THEN 'college'
    WHEN 'cancelled'                  THEN 'college'
    ELSE 'student'
  END AS actor_role,
  'Backfilled from application status' AS note,
  COALESCE(a.status_updated_at, a.updated_at, a.created_at) AS created_at
FROM applications a
WHERE a.status NOT IN ('draft')
  AND NOT EXISTS (
    SELECT 1 FROM application_activity_log l WHERE l.application_id = a.id
  );

PRINT CONCAT('Backfilled ', @@ROWCOUNT, ' application activity entries.');
