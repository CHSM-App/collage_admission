'use strict';

/**
 * Which application statuses occupy a seat.
 *
 * A seat is taken only once the student's admission is CONFIRMED by the college —
 * not when they merely apply. Everything before `confirmed` (draft → submitted →
 * scrutiny → doc_verified) is still just an application: those students may yet be
 * rejected, may never turn up, or may withdraw, so holding a seat for them would
 * wrongly show the course as full and block genuine applicants.
 *
 * This is the same for BOTH college types:
 *   • agriculture — `confirmed` IS admission success (there is no college fee)
 *   • general     — `confirmed`, then the student pays the college fee → `fees_paid`
 * so counting from `confirmed` onward covers both. `roll_assigned` and `enrolled`
 * are later stages of an already-confirmed admission and obviously still hold a seat.
 *
 * `rejected` and `cancelled` are excluded, which is what frees a seat back up.
 */
const SEAT_HOLDING_STATUSES = ['confirmed', 'fees_paid', 'roll_assigned', 'enrolled'];

// Ready-made SQL literal, e.g. "'confirmed','fees_paid',..." — keeps every
// filled-seat query using one definition instead of hand-rolling the list.
const SEAT_STATUS_SQL_LIST = SEAT_HOLDING_STATUSES.map(s => `'${s}'`).join(',');

/**
 * Correlated subquery that counts the seats an admission period has actually
 * filled. `periodAlias` is the alias of admission_periods in the outer query.
 */
function filledSeatsSql(periodAlias = 'ap', appAlias = 'a') {
  return `(SELECT COUNT(*) FROM applications ${appAlias}
            WHERE ${appAlias}.admission_period_id = ${periodAlias}.id
              AND ${appAlias}.status IN (${SEAT_STATUS_SQL_LIST}))`;
}

module.exports = { SEAT_HOLDING_STATUSES, SEAT_STATUS_SQL_LIST, filledSeatsSql };
