'use strict';

/**
 * When an application counts as an ADMISSION — it occupies a seat, and it is the
 * one admission a student may hold per college per academic year.
 *
 *   • Colleges that charge a college fee: admission is confirmed only once the
 *     student has paid ANY amount of it (`fees_paid`). `confirmed` there means
 *     "college accepted, fee pending" — no seat yet.
 *   • Colleges with the college fee turned off (e.g. agriculture): there is no fee
 *     to pay, so `confirmed` itself is the admission.
 *
 * `roll_assigned` / `enrolled` are later stages of an admission. Everything before
 * (draft → submitted → review → doc_verified) is only an application, and
 * `rejected` / `cancelled` free the seat.
 */
const PAID_ADMISSION_STATUSES = ['fees_paid', 'roll_assigned', 'enrolled'];
const PAID_SQL_LIST = PAID_ADMISSION_STATUSES.map(s => `'${s}'`).join(',');

/** SQL condition: application `a` is an admission (see above). */
function admittedSql(a = 'a') {
  return `(${a}.status IN (${PAID_SQL_LIST})
           OR (${a}.status = 'confirmed' AND EXISTS (
                 SELECT 1 FROM colleges c_fee
                 WHERE c_fee.id = ${a}.college_id
                   AND JSON_VALUE(c_fee.features_config, '$.payment.college_fee') = 'false')))`;
}

/**
 * Correlated subquery that counts the seats an admission period has actually
 * filled. `periodAlias` is the alias of admission_periods in the outer query.
 */
function filledSeatsSql(periodAlias = 'ap', appAlias = 'a') {
  return `(SELECT COUNT(*) FROM applications ${appAlias}
            WHERE ${appAlias}.admission_period_id = ${periodAlias}.id
              AND ${admittedSql(appAlias)})`;
}

module.exports = { PAID_ADMISSION_STATUSES, admittedSql, filledSeatsSql };
