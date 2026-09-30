-- Migration 051: Add state to the native/permanent address
-- Date: 2026-09-23
--
-- The residential address captures taluka, district AND state
-- (app_taluka / app_district / app_state) but the native/permanent address
-- stopped at district. That asymmetry leaves the permanent address incomplete
-- on printed forms, and makes a "same as residential" copy lossy — the state
-- would have nowhere to go.

IF COL_LENGTH('applications', 'app_native_state') IS NULL
    ALTER TABLE applications ADD app_native_state NVARCHAR(100) NULL;
GO

-- Existing rows that already copied their residential address across (same
-- house number and district) almost certainly share its state too. Anything
-- else is left NULL for the student or clerk to fill in.
UPDATE applications
SET    app_native_state = app_state
WHERE  app_native_state IS NULL
  AND  NULLIF(LTRIM(RTRIM(app_native_address)), '') IS NOT NULL
  AND  LTRIM(RTRIM(app_native_address))  = LTRIM(RTRIM(app_address))
  AND  LTRIM(RTRIM(app_native_district)) = LTRIM(RTRIM(app_district));
GO
