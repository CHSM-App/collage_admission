-- Migration 041: seats are filled on CONFIRMATION, not on application
-- Date: 2026-07-13
--
-- A seat is now counted only once a student's admission is CONFIRMED by the
-- college (statuses: confirmed, fees_paid, roll_assigned, enrolled). Previously
-- every non-draft application consumed a seat, so merely applying — or being
-- accepted for document verification — made a course look full and blocked
-- genuine applicants. This is the same rule for both college types: agriculture
-- ends at `confirmed`, general continues to `fees_paid`.
--
-- `admission_periods.filled_seats` is no longer maintained: filled seats are
-- DERIVED from application status at read time (see constants/seatStatuses.js),
-- which cannot drift out of sync the way an incremented counter can. The column
-- is kept (audit triggers and the $Arc archive reference it) but is now unused.
-- Zero it so nothing accidentally trusts the stale counts left by the old logic.

UPDATE admission_periods
SET filled_seats = 0
WHERE filled_seats <> 0;
