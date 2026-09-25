/**
 * Shared input rules, so the same field behaves the same wherever it appears.
 */

// A person's name: letters (any script — Devanagari names are common here),
// spaces, and the punctuation Indian names actually use — dots for initials,
// hyphens and apostrophes in compound names. Digits are the thing being kept
// out; a name field that accepts "Aarav123" produces bad records downstream.
// \p{M} keeps combining marks: Devanagari vowel signs ("ा", "े") are marks, not letters.
const NAME_DISALLOWED_RE = /[^\p{L}\p{M}\s.'-]/gu

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

/**
 * Capitalise the first letter of each word and leave the rest as typed, so
 * acronyms survive: "st. xavier's college, MSBSHSE" → "St. Xavier's College, MSBSHSE".
 * For institutions, places, occupations — anything that is not a person's name.
 * Pair with the `capitalize` CSS class so the screen matches what is saved.
 */
export function capitalizeWords(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
    .replace(/(^|\s)(\p{Ll})/gu, (_, sp, c) => sp + c.toLocaleUpperCase())
}

/** Digits only, capped at `max` characters (Aadhaar, ABC ID, counts, amounts). */
export const digitsOnly = (value, max) => String(value ?? '').replace(/\D/g, '').slice(0, max)

/** A non-negative decimal as typed: digits and one dot ("62.5"). Blocks the e/+/- a number input lets through. */
export const decimalOnly = (value, max) =>
  String(value ?? '').replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').slice(0, max)

/** Uppercase codes (PRN, seat no., IFSC): letters, digits and the given extra characters. */
export const codeOnly = (value, max, extra = '') =>
  String(value ?? '').toUpperCase().replace(new RegExp(`[^A-Z0-9${extra}]`, 'g'), '').slice(0, max)

/** Aadhaar: 12 digits, never starting with 0 or 1 (UIDAI does not issue those). */
export const isValidAadhaar = v => /^[2-9]\d{11}$/.test(String(v ?? ''))
export const isValidMobile  = v => /^[6-9]\d{9}$/.test(String(v ?? ''))
export const isValidEmail   = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v ?? '').trim())
