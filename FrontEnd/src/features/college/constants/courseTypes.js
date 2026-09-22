// Canonical course-type sequence (the university's Coursetypemaster,
// coursecat 1-9). This one list drives the Course Master type dropdown, the
// Group Master subject picker's type filter, and how subjects are ordered in
// both — so a subject appears in the same place wherever it is shown.
export const COURSE_TYPES = [
  { code: 'Major', title: 'Major' },
  { code: 'Minor', title: 'Minor' },
  { code: 'OE',    title: 'Open Elective' },
  { code: 'VSC',   title: 'Vocational Skill Course' },
  { code: 'SEC',   title: 'Skill Enhancement Course' },
  { code: 'IKS',   title: 'Indian Knowledge System' },
  { code: 'AEC',   title: 'Ability Enhancement Course' },
  { code: 'VEC',   title: 'Value Education Course' },
  { code: 'CC',    title: 'Cocurricular Course' },
]

const CODES = new Set(COURSE_TYPES.map(ct => ct.code))

/**
 * True when a row's stored type predates this list (Core, Elective,
 * Practical…). Such a row keeps its value as a selectable option rather than
 * being silently retyped — it is still a real subject until the clerk re-saves
 * it under the new vocabulary.
 *
 * Note: college_result also sorts subjects by this sequence, because it has no
 * other ordering. Admission does — course_master.display_order, which the
 * clerk sets in the grid — so ordering stays with display_order here.
 */
export const isLegacyType = t => t != null && t !== '' && !CODES.has(t)
