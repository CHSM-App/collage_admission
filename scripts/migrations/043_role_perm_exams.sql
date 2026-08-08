-- ============================================================
-- 043_role_perm_exams.sql
-- Seeds the 'exams' permission (exam registration + marks entry) for existing
-- roles, plus its sidebar nav row.
--
-- Defaults to can_write = 0: this is a new capability, so no existing role
-- silently gains it. A college admin grants it per role in the Roles panel.
-- The main college admin (is_staff = 0) bypasses permission checks entirely
-- and so has access without any row here.
--
-- Idempotent — safe to re-run.
-- ============================================================

INSERT INTO college_role_permissions (role_id, permission, can_write)
SELECT r.id, N'exams', 0
FROM college_roles r
WHERE NOT EXISTS (
  SELECT 1 FROM college_role_permissions p
  WHERE p.role_id = r.id AND p.permission = N'exams'
);
GO

-- Sidebar visibility mirrors the permission — a role without the permission
-- has no reason to see the section.
INSERT INTO college_role_permissions (role_id, permission, can_write)
SELECT r.id,
       N'nav:exam-registration',
       ISNULL(e.can_write, 0)
FROM college_roles r
LEFT JOIN college_role_permissions e
  ON e.role_id = r.id AND e.permission = N'exams'
WHERE NOT EXISTS (
  SELECT 1 FROM college_role_permissions p
  WHERE p.role_id = r.id AND p.permission = N'nav:exam-registration'
);
GO
