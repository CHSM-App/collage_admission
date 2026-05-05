/**
 * clear_data.js
 *
 * Deletes all data from every table EXCEPT admins.
 * Preserves table structure and the admins table.
 *
 * Run: node scripts/clear_data.js
 */

const db = require('../routes/db');

async function run() {
  await db.connect?.();

  const tables = [
    // Deepest dependents first (FK order)
    'application_previous_exam_subjects',
    'application_previous_exam',
    'application_subjects',
    'application_documents',
    'payments',
    'applications',

    // Student docs (depends on students)
    'student_documents',

    // Students
    'students',

    // College staff/roles
    'college_role_permissions',
    'college_users',
    'college_roles',

    // Masters that depend on faculty_master
    'college_required_documents',
    'class_master',
    'classwise_fees',
    'fees_master',
    'group_courses',
    'group_master',
    'division_master',
    'course_master',
    'bank_master',

    // Admission periods depend on faculty_master and colleges
    'admission_periods',

    // Faculty depends on colleges
    'faculty_master',

    // Old tables (may still have data)
    'required_documents',
    'fee_structures',
    'subjects',
    'courses',

    // Top-level college data last
    'colleges',

    // Shared lookup — keep document_types since admin manages them,
    // but clear if you want a full reset (uncomment if needed)
    // 'document_types',
  ];

  console.log('Starting data clear...\n');

  for (const table of tables) {
    try {
      const result = await db.request().query(`DELETE FROM ${table}`);
      const rows = result.rowsAffected?.[0] ?? '?';
      console.log(`  ✓ ${table.padEnd(40)} ${rows} row(s) deleted`);
    } catch (err) {
      console.error(`  ✗ ${table.padEnd(40)} ERROR: ${err.message}`);
    }
  }

  console.log('\nDone. admins table was NOT touched.');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
