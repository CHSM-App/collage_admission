/**
 * Turn a staff role's college_role_permissions rows into the two maps the
 * session carries: { permissions: { collect_fees: true, ... }, nav_visibility: { inbox: true, ... } }.
 *
 * Admission Periods is only reachable with the Manage Admission Periods
 * permission — the role editor shows it locked-hidden otherwise, so it is
 * forced hidden here whatever the stored nav row says.
 */
function buildStaffAccess(permsArray) {
  const permissions = {};
  const nav_visibility = {};
  for (const p of permsArray || []) {
    if (p.permission.startsWith('nav:')) nav_visibility[p.permission.slice(4)] = !!p.can_write;
    else permissions[p.permission] = !!p.can_write;
  }
  if (!permissions.manage_admission_periods) nav_visibility.periods = false;
  return { permissions, nav_visibility };
}

module.exports = { buildStaffAccess };

if (require.main === module) {
  const assert = require('assert');
  const a = buildStaffAccess([
    { permission: 'collect_fees', can_write: true },
    { permission: 'manage_admission_periods', can_write: false },
    { permission: 'nav:periods', can_write: true },
    { permission: 'nav:reports', can_write: false },
  ]);
  assert.deepStrictEqual(a.permissions, { collect_fees: true, manage_admission_periods: false });
  assert.deepStrictEqual(a.nav_visibility, { periods: false, reports: false });
  const b = buildStaffAccess([{ permission: 'manage_admission_periods', can_write: true }, { permission: 'nav:periods', can_write: true }]);
  assert.strictEqual(b.nav_visibility.periods, true);
  console.log('staffAccess ok');
}
