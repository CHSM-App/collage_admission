/**
 * AdmissionGuard — a student may hold only ONE confirmed admission per college
 * per academic year. They can apply as many times as they like; only the
 * confirmation is limited.
 *
 * Backed by the filtered unique index UX_applications_one_confirmed_per_year
 * (migration 055), which catches any path or race this check misses.
 */

const db    = require('../routes/db')
const mssql = require('mssql')

// Statuses that count as "admission confirmed" — keep in sync with migration 055
const CONFIRMED_STATUSES = ['confirmed', 'fees_paid', 'roll_assigned', 'enrolled']

/**
 * Another confirmed application for the same student + college + academic year,
 * or null.
 */
async function findOtherConfirmed(appId) {
  const r = await db.request()
    .input('id', mssql.Int, appId)
    .query(`
      SELECT TOP 1 o.id, o.registration_number, o.status
      FROM applications a
      JOIN applications o
        ON  o.student_id    = a.student_id
        AND o.college_id    = a.college_id
        AND o.academic_year = a.academic_year
        AND o.id <> a.id
        AND o.status IN (${CONFIRMED_STATUSES.map(s => `'${s}'`).join(',')})
      WHERE a.id = @id
    `)
  return r.recordset[0] || null
}

/**
 * The student's confirmed admission at this college for this academic year, or
 * null. Once one exists the student may not start another application there.
 */
async function findConfirmedFor(studentId, collegeId, academicYear) {
  const r = await db.request()
    .input('sid', mssql.Int, studentId)
    .input('cid', mssql.Int, collegeId)
    .input('ay',  mssql.NVarChar, academicYear)
    .query(`
      SELECT TOP 1 id, registration_number, status FROM applications
      WHERE student_id = @sid AND college_id = @cid AND academic_year = @ay
        AND status IN (${CONFIRMED_STATUSES.map(s => `'${s}'`).join(',')})
    `)
  return r.recordset[0] || null
}

/** Message for a refused new application. */
function alreadyAdmittedMessage(existing) {
  const ref = existing.registration_number ? ` (Reg. No. ${existing.registration_number})` : ''
  return `Admission is already confirmed at this college for this academic year${ref}. A new application cannot be started.`
}

/**
 * Status for an application whose application fee was just paid. College-filled
 * applications are directly confirmed — unless the student already has a
 * confirmed admission this year, in which case it goes to review instead.
 * Never throws for the duplicate case: this runs while recording a payment, and
 * the payment must be saved even when the confirmation can't happen.
 */
async function statusAfterFeePaid(appId, createdByCollege) {
  if (!createdByCollege) return 'submitted'
  return (await findOtherConfirmed(appId)) ? 'submitted' : 'confirmed'
}

/** Message for a refused confirmation. */
function duplicateMessage(other) {
  const ref = other.registration_number ? ` (Reg. No. ${other.registration_number})` : ` (application #${other.id})`
  return `This student already has a confirmed admission at this college for this academic year${ref}. Only one admission can be confirmed per academic year`
}

module.exports = { CONFIRMED_STATUSES, findOtherConfirmed, findConfirmedFor, statusAfterFeePaid, duplicateMessage, alreadyAdmittedMessage }
