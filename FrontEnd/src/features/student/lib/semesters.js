/**
 * A year of study covers two absolute semesters: year Y -> 2Y-1 and 2Y.
 *
 * The application records `year_of_study` (1-5) while group_master and
 * course_master store the absolute semester (1-10), so this is where the two
 * numbering schemes meet. The backend derives the same pair in
 * application_form.js (semestersForYear) and returns it on
 * GET /api/applications/:id/groups — prefer that value when you have it, and
 * use this only where no request has been made yet.
 */
export function semestersForYear(year) {
  const y = parseInt(year)
  return Number.isInteger(y) && y > 0 ? [y * 2 - 1, y * 2] : []
}
