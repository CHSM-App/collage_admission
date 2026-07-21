/**
 * FeeLockService.js
 * ─────────────────────────────────────────────────────────────
 * Fees for a class are frozen for an academic year once admission
 * for that class has been opened. Rationale: students who applied
 * under an advertised fee must not have it changed underneath them.
 *
 * A class is identified by (college_id, faculty_master_id, year_level).
 * The lock is scoped per academic_year, so opening 2026-27 admissions
 * does not freeze the 2027-28 fee sheet for the same class.
 *
 * Locking rows:
 *   - classwise_fees — the per-class amounts (direct hit)
 *   - fees_master    — a fee head is college-wide per academic year, so
 *                      editing its amounts/active flag can shift the total
 *                      of any locked class that references it
 *
 * Super-admins (role === 'admin') bypass the lock. Every bypass is logged.
 */

const mssql  = require('mssql')
const db     = require('../routes/db')
const logger = require('../config/logger')

const YEAR_LEVEL_MAP = { 1: 'FY', 2: 'SY', 3: 'TY', 4: '4Y', 5: '5Y' }

function isSuperAdmin(user) {
  return user?.role === 'admin'
}

/**
 * Admission periods that freeze a given class for an academic year.
 * "Opened" means the period row exists and was not withdrawn (is_disabled).
 * A period that has merely ended (is_active = 0) still counts — its students
 * already paid under those fees.
 */
async function lockingPeriods({ collegeId, facultyMasterId, yearLevel, academicYear, pool = db }) {
  const resolvedPool = await Promise.resolve(pool)
  const r = await resolvedPool.request()
    .input('cid', mssql.Int,      collegeId)
    .input('fid', mssql.Int,      facultyMasterId)
    .input('yl',  mssql.NVarChar, yearLevel)
    .input('ay',  mssql.NVarChar, academicYear)
    .query(`
      SELECT ap.id, ap.academic_year, ap.year_of_study, ap.start_date, ap.end_date,
             fm.degree_course_code, fm.degree_course_name
      FROM admission_periods ap
      JOIN faculty_master fm ON fm.code_no = ap.course_id AND fm.college_id = ap.college_id
      WHERE ap.college_id = @cid
        AND ap.course_id  = @fid
        AND ap.academic_year = @ay
        AND ap.is_disabled = 0
        AND CASE ap.year_of_study
              WHEN 1 THEN 'FY' WHEN 2 THEN 'SY' WHEN 3 THEN 'TY'
              WHEN 4 THEN '4Y' WHEN 5 THEN '5Y' END = @yl
    `)
  return r.recordset
}

/**
 * True when admission has been opened for this exact class + academic year.
 */
async function isClassLocked(args) {
  const rows = await lockingPeriods(args)
  return rows.length > 0
}

/**
 * Classes frozen by an open admission period that charge a given fee head.
 * Used to guard fees_master edits, where the head is college-wide but the
 * damage is per-class.
 */
async function lockedClassesForFeeHead({ collegeId, feesCode, pool = db }) {
  const resolvedPool = await Promise.resolve(pool)
  const r = await resolvedPool.request()
    .input('cid', mssql.Int, collegeId)
    .input('fc',  mssql.Int, feesCode)
    .query(`
      SELECT DISTINCT
             ap.academic_year,
             fm.degree_course_code,
             fm.degree_course_name,
             cf.year_level
      FROM classwise_fees cf
      JOIN admission_periods ap
        ON ap.college_id    = cf.college_id
       AND ap.course_id     = cf.faculty_master_id
       AND ap.academic_year = cf.academic_year
       AND ap.is_disabled   = 0
       AND CASE ap.year_of_study
             WHEN 1 THEN 'FY' WHEN 2 THEN 'SY' WHEN 3 THEN 'TY'
             WHEN 4 THEN '4Y' WHEN 5 THEN '5Y' END = cf.year_level
      JOIN faculty_master fm
        ON fm.code_no = cf.faculty_master_id AND fm.college_id = cf.college_id
      WHERE cf.college_id = @cid
        AND cf.fees_code  = @fc
    `)
  return r.recordset
}

function describeClasses(rows) {
  return rows
    .map(c => `${c.degree_course_code} · ${c.year_level} · ${c.academic_year}`)
    .join(', ')
}

/**
 * Throw-free guard. Returns null when the edit may proceed, or a
 * { status, body } response payload when it must be rejected.
 *
 * Callers that are a super-admin get null plus an audit log line.
 */
function denial(message, lockedClasses) {
  return {
    status: 409,
    body: {
      success: false,
      code: 'FEES_LOCKED',
      message,
      locked_classes: lockedClasses,
    },
  }
}

/**
 * Guard a classwise_fees write (save or delete) for one class.
 */
async function guardClasswiseWrite({ user, collegeId, facultyMasterId, yearLevel, academicYear, pool = db }) {
  const periods = await lockingPeriods({ collegeId, facultyMasterId, yearLevel, academicYear, pool })
  if (!periods.length) return null

  const label = `${periods[0].degree_course_code} · ${yearLevel} · ${academicYear}`

  if (isSuperAdmin(user)) {
    logger.warn(
      { collegeId, facultyMasterId, yearLevel, academicYear, actor: String(user.id) },
      `Fee lock overridden by super-admin for ${label}`,
    )
    return null
  }

  return denial(
    `Fees for ${label} are locked — admission has already been opened for this class this academic year. ` +
    `Fees cannot change mid-year. Contact the platform administrator if a correction is genuinely required.`,
    [{ degree_course_code: periods[0].degree_course_code, year_level: yearLevel, academic_year: academicYear }],
  )
}

/**
 * Guard a fees_master write. A fee head is shared across classes, so the edit
 * is blocked when ANY locked class currently charges it.
 */
async function guardFeeHeadWrite({ user, collegeId, feesCode, pool = db }) {
  const locked = await lockedClassesForFeeHead({ collegeId, feesCode, pool })
  if (!locked.length) return null

  if (isSuperAdmin(user)) {
    logger.warn(
      { collegeId, feesCode, actor: String(user.id), locked: describeClasses(locked) },
      'Fee-head lock overridden by super-admin',
    )
    return null
  }

  return denial(
    `This fee head is in use by ${locked.length} class(es) whose admission is already open ` +
    `(${describeClasses(locked)}). Its amounts are locked for those academic years. ` +
    `Contact the platform administrator if a correction is genuinely required.`,
    locked,
  )
}

module.exports = {
  YEAR_LEVEL_MAP,
  isSuperAdmin,
  isClassLocked,
  lockingPeriods,
  lockedClassesForFeeHead,
  guardClasswiseWrite,
  guardFeeHeadWrite,
}
