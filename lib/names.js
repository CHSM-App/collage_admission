/**
 * Person names are stored in title case ("NAIK rajesh" → "Naik Rajesh"),
 * however they were typed. Letters after an apostrophe or hyphen start a new
 * word ("D'souza" → "D'Souza", "Rao-patil" → "Rao-Patil"). Non-strings pass through.
 */
function titleCaseName(v) {
  if (typeof v !== 'string') return v
  return v.trim().replace(/\s+/g, ' ')
    .replace(/\p{L}+/gu, w => w.charAt(0).toLocaleUpperCase() + w.slice(1).toLocaleLowerCase())
}

/** Title-case the given keys of obj in place. */
function titleCaseFields(obj, keys) {
  for (const k of keys) if (obj && k in obj) obj[k] = titleCaseName(obj[k])
  return obj
}

/**
 * Letters (any script), spaces and . ' - only — no digits or symbols. Blank is
 * valid (presence is checked separately). Mirrors FrontEnd shared/validators.js.
 */
function isValidName(v) {
  // \p{M}: combining marks — Devanagari vowel signs ("ा", "े") are marks, not letters
  return v == null || /^[\p{L}\p{M}\s.'-]*$/u.test(String(v))
}

/** Field names in obj (among keys) that hold something other than a name. */
function invalidNameFields(obj, keys) {
  return keys.filter(k => obj && !isValidName(obj[k]))
}

module.exports = { titleCaseName, titleCaseFields, isValidName, invalidNameFields }

if (require.main === module) {
  const assert = require('assert')
  assert.strictEqual(titleCaseName('NAIK rajesh'), 'Naik Rajesh')
  assert.strictEqual(titleCaseName("  d'souza   RAO-patil "), "D'Souza Rao-Patil")
  assert.strictEqual(titleCaseName(''), '')
  assert.strictEqual(titleCaseName(null), null)
  assert.ok(isValidName("D'Souza Rao-Patil"))
  assert.ok(isValidName('राजेश'))
  assert.ok(isValidName(null) && isValidName(''))
  assert.ok(!isValidName('Aarav123'))
  assert.ok(!isValidName('Ram@'))
  assert.deepStrictEqual(invalidNameFields({ a: 'Ok', b: 'X1' }, ['a', 'b', 'c']), ['b'])
  console.log('names ok')
}
