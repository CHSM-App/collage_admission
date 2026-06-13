-- ============================================================
-- 010_role_perm_manage_admission_periods.sql
-- Seeds the new 'manage_admission_periods' permission for existing roles.
-- Previously, admission-period write routes were gated by 'masters', so
-- to preserve existing behavior we copy each role's 'masters' can_write
-- value into the new permission. Roles that don't yet have a row get
-- can_write = 0.
-- Idempotent — safe to re-run.
-- ============================================================

-- Insert the new permission row for any role that doesn't already have it,
-- copying can_write from that role's 'masters' permission (default 0 if absent).
INSERT INTO college_role_permissions (role_id, permission, can_write)
SELECT r.id,
       N'manage_admission_periods',
       ISNULL(m.can_write, 0)
FROM college_roles r
LEFT JOIN college_role_permissions m
  ON m.role_id = r.id AND m.permission = N'masters'
WHERE NOT EXISTS (
  SELECT 1 FROM college_role_permissions p
  WHERE p.role_id = r.id AND p.permission = N'manage_admission_periods'
);
GO

-- Also seed the nav:periods row for any role missing it, defaulting to the
-- new permission's can_write value (so newly-granted roles see the sidebar).
INSERT INTO college_role_permissions (role_id, permission, can_write)
SELECT r.id,
       N'nav:periods',
       ISNULL(mp.can_write, 0)
FROM college_roles r
LEFT JOIN college_role_permissions mp
  ON mp.role_id = r.id AND mp.permission = N'manage_admission_periods'
WHERE NOT EXISTS (
  SELECT 1 FROM college_role_permissions p
  WHERE p.role_id = r.id AND p.permission = N'nav:periods'
);
GO
