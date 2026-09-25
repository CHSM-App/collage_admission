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

module.exports = { titleCaseName, titleCaseFields }

if (require.main === module) {
  const assert = require('assert')
  assert.strictEqual(titleCaseName('NAIK rajesh'), 'Naik Rajesh')
  assert.strictEqual(titleCaseName("  d'souza   RAO-patil "), "D'Souza Rao-Patil")
  assert.strictEqual(titleCaseName(''), '')
  assert.strictEqual(titleCaseName(null), null)
  console.log('names ok')
}
