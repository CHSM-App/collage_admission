/**
 * AdmissionGuard — admission rules shared by every confirm and payment path.
 *
 *  • An application becomes an ADMISSION (seat taken) when the student pays any
 *    amount of the college fee — or, at colleges with no college fee, when the
 *    college confirms it. See constants/seatStatuses.js `admittedSql`.
 *  • A student may hold only ONE admission per college per academic year. They
 *    may apply, and be accepted/confirmed (fee pending), for several courses;
 *    the first one paid wins.
 *
 * Backed by the filtered unique index UX_applications_one_confirmed_per_year
 * (migration 056: paid statuses), which catches any path or race this misses.
 */

const db    = require('../routes/db')
const mssql = require('mssql')
const { PAID_ADMISSION_STATUSES, admittedSql, filledSeatsSql } = require('../constants/seatStatuses')

// Kept for callers that need a status list (paid admissions)
const CONFIRMED_STATUSES = PAID_ADMISSION_STATUSES

/**
 * Another admission for the same student + college + academic year, or null.
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
        AND ${admittedSql('o')}
      WHERE a.id = @id
    `)
  return r.recordset[0] || null
}

/**
 * The student's admission at this college for this academic year, or null.
 * Once one exists the student may not start another application there.
 */
async function findConfirmedFor(studentId, collegeId, academicYear) {
  const r = await db.request()
    .input('sid', mssql.Int, studentId)
    .input('cid', mssql.Int, collegeId)
    .input('ay',  mssql.NVarChar, academicYear)
    .query(`
      SELECT TOP 1 a.id, a.registration_number, a.status FROM applications a
      WHERE a.student_id = @sid AND a.college_id = @cid AND a.academic_year = @ay
        AND ${admittedSql('a')}
    `)
  return r.recordset[0] || null
}

/**
 * Before the FIRST college-fee payment of a fee-pending (`confirmed`) application:
 * why that payment must not be taken, or null if it may. Later installments of an
 * existing admission are never blocked.
 *   - the student already holds another admission at this college this year
 *   - the admission period has no seat left
 */
async function firstPaymentBlock(appId) {
  const r = await db.request()
    .input('id', mssql.Int, appId)
    .query(`
      SELECT a.status, ap.total_seats, ${filledSeatsSql('ap', 'x')} AS filled_seats
      FROM applications a
      LEFT JOIN admission_periods ap ON ap.id = a.admission_period_id
      WHERE a.id = @id
    `)
  const app = r.recordset[0]
  if (!app || app.status !== 'confirmed') return null   // not a first payment
  const other = await findOtherConfirmed(appId)
  if (other) return duplicateMessage(other)
  if (app.total_seats != null && app.total_seats > 0 && app.filled_seats >= app.total_seats) {
    return 'No seats left for this course — the admission cannot be confirmed, so the fee cannot be collected.'
  }
  return null
}

/**
 * SQL for the fee-pending → admission move. Only `confirmed` moves (never drags a
 * roll_assigned/enrolled student backwards), and only when the student holds no
 * other admission this year — so a completed online payment can never fail on the
 * one-per-year index; the payment is still recorded and staff resolve the rest.
 * Use with inputs @id and @actor. rowsAffected[0] === 1 ⇔ admission just confirmed.
 */
const CONFIRM_ON_PAYMENT_SQL = `
  UPDATE applications
  SET status = 'fees_paid', college_fee_paid = 1,
      updated_at = GETDATE(), status_updated_at = GETDATE(), updated_by = @actor
  WHERE id = @id AND status = 'confirmed'
    AND NOT EXISTS (
      SELECT 1 FROM applications o
      WHERE o.student_id = applications.student_id AND o.college_id = applications.college_id
        AND o.academic_year = applications.academic_year AND o.id <> applications.id
        AND ${admittedSql('o')})`

/**
 * Status for an application whose application fee was just paid. College-filled
 * applications skip review and go straight to `confirmed` (fee pending) — unless
 * the student already holds an admission this year, in which case to review.
 * Never throws for the duplicate case: this runs while recording a payment.
 */
async function statusAfterFeePaid(appId, createdByCollege) {
  if (!createdByCollege) return 'submitted'
  return (await findOtherConfirmed(appId)) ? 'submitted' : 'confirmed'
}

/** Message for a refused confirmation / first payment. */
function duplicateMessage(other) {
  const ref = other.registration_number ? ` (Reg. No. ${other.registration_number})` : ` (application #${other.id})`
  return `This student already has a confirmed admission at this college for this academic year${ref}. Only one admission can be confirmed per academic year.`
}

/** Message for a refused new application. */
function alreadyAdmittedMessage(existing) {
  const ref = existing.registration_number ? ` (Reg. No. ${existing.registration_number})` : ''
  return `Admission is already confirmed at this college for this academic year${ref}. A new application cannot be started.`
}

module.exports = {
  CONFIRMED_STATUSES, findOtherConfirmed, findConfirmedFor, firstPaymentBlock,
  CONFIRM_ON_PAYMENT_SQL, statusAfterFeePaid, duplicateMessage, alreadyAdmittedMessage,
}
