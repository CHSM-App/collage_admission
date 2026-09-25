/**
 * RegistrationNumberService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates a student's admission registration number at submission/confirmation.
 *
 * The format depends on the college's `college_type`. Both formats embed the
 * college code, course code and year of study, so every number is fully
 * self-describing and globally unique:
 *
 *   Agriculture:  [4-digit start year][college code][course code][year][3-digit serial]
 *                 2025-26 + ELPH + 002 + 1 + 1  →  "2025ELPH002101"
 *
 *   General:      S[compact 4-digit year][college code][course code][year][4-digit serial]
 *                 2024-25 + ELPH + 002 + 1 + 1  →  "S2425ELPH00210001"
 *
 * Serial scope: per college + course + year_of_study + academic year.
 *
 * The serial comes from an ATOMIC per-scope counter (registration_counters),
 * incremented with MERGE ... WITH (HOLDLOCK) inside the caller's transaction.
 * This is race-safe: two concurrent submissions in the same scope are serialised
 * by the row lock and receive consecutive serials — they can never collide.
 * Because the counter only ever increases, deleting an application never causes a
 * freed serial to be reissued. (The old COUNT(*) approach had both problems.)
 *
 * generate() MUST be called with a transaction request (`request`), so the
 * counter increment commits atomically with the row that stores the number.
 */

const mssql = require('mssql')

// ── Year renderers ────────────────────────────────────────────────────────────
// academicYear arrives as "YYYY-YY" (e.g. "2025-26") or occasionally "YYYY-YYYY".

// Agriculture: the 4-digit start year → "2025".
function fullStartYear(academicYear) {
  return String(academicYear || '').slice(0, 4)
}

// General: compact two-year form → start(2) + end(2), e.g. "2024-25" → "2425".
function compactYear(academicYear) {
  const ay = String(academicYear || '')
  const parts = ay.split('-')
  const start = (parts[0] || '').slice(-2)          // "2024" → "24"
  const end   = (parts[1] || '').slice(-2)          // "25" or "2025" → "25"
  return `${start}${end}`
}

// ── Component sanitisers ──────────────────────────────────────────────────────
function normCollegeCode(code) {
  return String(code || '').toUpperCase().replace(/\s+/g, '')
}

function normCourseCode(code) {
  return String(code || '').toUpperCase().replace(/\s+/g, '')
}

// ── Look up the human-facing course code for the application's course_id ───────
// applications.course_id references faculty_master.code_no (numeric PK); the
// visible code is faculty_master.degree_course_code (e.g. "002").
async function resolveCourseCode(request, collegeId, courseId) {
  const r = await request
    .input('cc_cid', mssql.Int, parseInt(collegeId))
    .input('cc_crs', mssql.Int, parseInt(courseId))
    .query(`
      SELECT degree_course_code
      FROM faculty_master
      WHERE code_no = @cc_crs AND college_id = @cc_cid
    `)
  return r.recordset[0]?.degree_course_code || String(courseId)
}

// ── Atomic per-scope serial ───────────────────────────────────────────────────
// MERGE upserts the counter row and increments last_seq under HOLDLOCK so
// concurrent callers are serialised and gaps/duplicates cannot occur.
async function nextSerial(request, { collegeId, courseId, yearOfStudy, academicYear }) {
  const r = await request
    .input('rc_cid', mssql.Int,      parseInt(collegeId))
    .input('rc_crs', mssql.Int,      parseInt(courseId))
    .input('rc_yos', mssql.NVarChar, String(yearOfStudy))
    .input('rc_ay',  mssql.NVarChar, String(academicYear))
    .query(`
      MERGE registration_counters WITH (HOLDLOCK) AS target
      USING (SELECT @rc_cid AS college_id, @rc_crs AS course_id,
                    @rc_yos AS year_of_study, @rc_ay AS academic_year) AS src
        ON  target.college_id    = src.college_id
        AND target.course_id     = src.course_id
        AND target.year_of_study = src.year_of_study
        AND target.academic_year = src.academic_year
      WHEN MATCHED THEN
        UPDATE SET last_seq = last_seq + 1
      WHEN NOT MATCHED THEN
        INSERT (college_id, course_id, year_of_study, academic_year, last_seq)
        VALUES (@rc_cid, @rc_crs, @rc_yos, @rc_ay, 1);

      SELECT last_seq
      FROM registration_counters
      WHERE college_id=@rc_cid AND course_id=@rc_crs
        AND year_of_study=@rc_yos AND academic_year=@rc_ay;
    `)
  return r.recordset[0].last_seq
}

// ── Main: generate a registration number ──────────────────────────────────────
/**
 * MUST run inside a transaction so the counter increment and the row that stores
 * the returned number commit together.
 *
 * @param {object} opts
 * @param {import('mssql').Request} opts.request   - a request from the active
 *                                                   transaction (tx.request())
 * @param {number} opts.collegeId
 * @param {string} opts.collegeType                - 'agriculture' | 'general' | ...
 * @param {string} opts.collegeCode                - colleges.college_code
 * @param {number} opts.courseId                   - applications.course_id (code_no)
 * @param {string|number} opts.yearOfStudy
 * @param {string} opts.academicYear               - "YYYY-YY"
 * @returns {Promise<string>}
 */
async function generate({ request, collegeId, collegeType, collegeCode, courseId, yearOfStudy, academicYear }) {
  if (!request) {
    throw new Error('RegistrationNumberService.generate requires a transaction request')
  }

  const courseCode = await resolveCourseCode(request, collegeId, courseId)
  const seq        = await nextSerial(request, { collegeId, courseId, yearOfStudy, academicYear })

  const college = normCollegeCode(collegeCode)
  const course  = normCourseCode(courseCode)
  const year    = String(yearOfStudy)

  if (collegeType === 'agriculture') {
    const yr = fullStartYear(academicYear)
    return `${yr}${college}${course}${year}${String(seq).padStart(3, '0')}`
  }

  // Default / general
  const yr = compactYear(academicYear)
  return `S${yr}${college}${course}${year}${String(seq).padStart(4, '0')}`
}

module.exports = { generate, fullStartYear, compactYear }
