/**
 * programSeed — copy a university's program catalogue into one college.
 *
 * Programs are the same for every college of a university, and their codes must
 * stay fixed: coursemaster/groupmaster imports resolve against
 * degree_course_code and university_faculty_no (see routes/masters.js). So a
 * college receives ALL of its university's programs on creation, and the super
 * admin then hides the ones it does not offer via faculty_master.is_active —
 * rather than each college retyping codes and drifting out of step.
 *
 * faculty_master stays per-college on purpose: eight tables FK to
 * faculty_master.code_no, and live applications and admission periods point at
 * it. Sharing rows outright would mean remapping all of that.
 */
const db    = require('../routes/db')
const mssql = require('mssql')

// program_templates mirrors faculty_master's shape minus college_id, so the
// copy is column-for-column.
const COPIED_COLUMNS = [
  'degree_course_code', 'degree_course_name', 'duration_years', 'university_faculty_no',
  ...Array.from({ length: 10 }, (_, i) => `unique_code_sem${i + 1}`),
  ...Array.from({ length: 5 },  (_, i) => `exam_seat_code_year${i + 1}`),
]

/**
 * Insert every catalogue program this college is missing.
 *
 * Idempotent — matches on degree_course_code, so re-running after the catalogue
 * gains a program adds only the new one and never touches what is already there.
 *
 * @param {number} collegeId
 * @param {number|null} universityId  no university → nothing to seed
 * @param {string} actor              user id recorded in created_by
 * @returns {Promise<number>} rows inserted
 */
async function seedProgramsFromTemplates(collegeId, universityId, actor) {
  if (!universityId) return 0

  const cols = COPIED_COLUMNS.join(', ')
  const src  = COPIED_COLUMNS.map(c => `pt.${c}`).join(', ')

  const r = await db.request()
    .input('cid',   mssql.Int,      collegeId)
    .input('uid',   mssql.Int,      universityId)
    .input('actor', mssql.NVarChar, actor)
    .query(`
      INSERT INTO faculty_master (college_id, ${cols}, is_active, created_by)
      SELECT @cid, ${src}, 1, @actor
      FROM program_templates pt
      WHERE pt.university_id = @uid
        AND pt.is_active = 1
        AND NOT EXISTS (
          SELECT 1 FROM faculty_master f
          WHERE f.college_id = @cid
            AND f.degree_course_code = pt.degree_course_code
        )
    `)

  return r.rowsAffected[0] || 0
}

module.exports = { seedProgramsFromTemplates, COPIED_COLUMNS }
