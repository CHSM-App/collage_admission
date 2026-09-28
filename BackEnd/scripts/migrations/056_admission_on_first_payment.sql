-- Migration 056: Admission is confirmed on the first college-fee payment
-- Date: 2026-09-28
--
-- `confirmed` now means "college accepted, fee pending" and no longer holds a seat
-- or counts as the student's one admission for the year — several applications
-- may be fee-pending at once; the first one paid becomes the admission.
-- The one-per-year index therefore covers the PAID statuses only.
-- (Colleges with the college fee turned off admit at `confirmed`; for them the
-- rule is enforced in code — services/AdmissionGuard.js — since a filtered index
-- cannot read the college's settings.)

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_applications_one_confirmed_per_year')
    DROP INDEX UX_applications_one_confirmed_per_year ON applications;
GO

CREATE UNIQUE INDEX UX_applications_one_confirmed_per_year
    ON applications (student_id, college_id, academic_year)
    WHERE status IN ('fees_paid', 'roll_assigned', 'enrolled');
GO
