/**
 * Shared input rules, so the same field behaves the same wherever it appears.
 */

// A person's name: letters (any script — Devanagari names are common here),
// spaces, and the punctuation Indian names actually use — dots for initials,
// hyphens and apostrophes in compound names. Digits are the thing being kept
// out; a name field that accepts "Aarav123" produces bad records downstream.
const NAME_DISALLOWED_RE = /[^\p{L}\s.'-]/gu

/** Strip anything that cannot appear in a name. Safe to run on every keystroke. */
export function sanitizeName(value) {
  return String(value ?? '').replace(NAME_DISALLOWED_RE, '')
}

/** True when the value contains only name-legal characters (blank counts as valid — use `required` for presence). */
export function isValidName(value) {
  const v = String(value ?? '').trim()
  return v === '' || !NAME_DISALLOWED_RE.test(v)
}

/**
 * Capitalise each word: "komal  ramesh" → "Komal Ramesh".
 *
 * Applied on blur and before saving, never on every keystroke — recasing while
 * someone is still typing fights the cursor. Inner whitespace is collapsed
 * because these values end up on printed forms and roll lists.
 */
export function toTitleCase(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\p{L}+/gu, w => w.charAt(0).toLocaleUpperCase() + w.slice(1).toLocaleLowerCase())
}
