-- Migration 055: One confirmed admission per student per college per academic year
-- Date: 2026-09-24
--
-- A student may apply any number of times, but only one application per
-- college per academic year may be in a confirmed state. Enforced here so no
-- code path (or two staff confirming at once) can create a second one.
-- Status list must match CONFIRMED_STATUSES in services/AdmissionGuard.js.

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_applications_one_confirmed_per_year')
    CREATE UNIQUE INDEX UX_applications_one_confirmed_per_year
        ON applications (student_id, college_id, academic_year)
        WHERE status IN ('confirmed', 'fees_paid', 'roll_assigned', 'enrolled');
GO
