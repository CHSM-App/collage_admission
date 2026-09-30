-- Migration 056: Backfill staff-role rows for permission / sidebar keys the
-- roles API used to drop
-- Date: 2026-09-25
--
-- The role editor sent `exams`, `nav:exam-registration`, `nav:reports` and
-- `nav:master-categories`, but routes/college_users.js did not list them, so
-- they were never stored — and a missing nav row reads as "visible", so those
-- sections showed for every staff role regardless of the editor.
--
-- Defaults follow the nearest existing setting on the same role:
--   nav:reports           ← nav:fee-receipts   (both are fee collection)
--   nav:master-categories ← nav:master-fees    (categories drive fee slabs)
--   exams / nav:exam-registration ← hidden, view-only (never granted before)
-- Only missing rows are inserted; nothing an admin saved is overwritten.

INSERT INTO college_role_permissions (role_id, permission, can_write, created_by)
SELECT r.id, k.permission,
       COALESCE((SELECT p.can_write FROM college_role_permissions p
                 WHERE p.role_id = r.id AND p.permission = k.source), 0),
       'migration-056'
FROM college_roles r
CROSS JOIN (VALUES
    ('nav:reports',           'nav:fee-receipts'),
    ('nav:master-categories', 'nav:master-fees'),
    ('nav:exam-registration', NULL),
    ('exams',                 NULL)
) AS k(permission, source)
WHERE NOT EXISTS (SELECT 1 FROM college_role_permissions p
                  WHERE p.role_id = r.id AND p.permission = k.permission);
GO

-- Admission Periods is only visible with Manage Admission Periods (the editor
-- locks it; login enforces it). Align stored rows so the data says the same.
UPDATE p SET can_write = 0, updated_by = 'migration-056'
FROM college_role_permissions p
WHERE p.permission = 'nav:periods' AND p.can_write = 1
  AND NOT EXISTS (SELECT 1 FROM college_role_permissions m
                  WHERE m.role_id = p.role_id AND m.permission = 'manage_admission_periods' AND m.can_write = 1);
GO
