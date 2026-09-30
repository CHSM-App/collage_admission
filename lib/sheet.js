/**
 * Spreadsheet reader for the master files the college receives from the
 * university.
 *
 * SheetJS rather than ExcelJS: the university ships legacy BIFF .xls
 * (groupmaster.xls among them), which ExcelJS cannot read at all.
 *
 * Quirks this deliberately handles:
 *   - The header is not always on the declared row — some exports carry a
 *     legend block above it. `headerRow` is a hint; the real one is found by
 *     looking for the required columns (see findHeaderIdx).
 *   - Leading-zero codes come back as numbers: group code "042001" arrives as
 *     42001. Callers must use row.padded(col, 6), never row.get(col).
 *   - Blank spacer rows appear mid-file and at the end; they are skipped, but
 *     rowNumber still reports the true sheet row so "Row 5:" in an error
 *     message means row 5 when the clerk opens the file.
 */
const XLSX = require('xlsx')

/**
 * Header keys are matched case-, whitespace- and period-insensitively. The
 * source headers are inconsistent about trailing dots ("Roll No." but
 * "Seat No"), and a college retyping the template will not reproduce them
 * exactly either.
 */
function normalizeHeader(h) {
  return String(h == null ? '' : h)
    .trim().toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// How far to look for the header when the declared row does not carry it. A
// legend is a handful of rows; anything deeper is a different file, not a
// different layout of this one.
const HEADER_SCAN_ROWS = 10

/**
 * The declared row wins when it holds every required column. Otherwise the
 * first row in the leading block that does. With nothing required there is
 * nothing to search on, so the declared row stands.
 */
function findHeaderIdx(aoa, declaredIdx, required) {
  if (!required.length) return declaredIdx
  const carriesAll = idx => {
    const hs = (aoa[idx] || []).map(normalizeHeader)
    return required.every(c => hs.includes(normalizeHeader(c)))
  }
  if (declaredIdx >= 0 && declaredIdx < aoa.length && carriesAll(declaredIdx)) return declaredIdx
  const limit = Math.min(aoa.length, Math.max(declaredIdx + 1, HEADER_SCAN_ROWS))
  for (let i = 0; i < limit; i++) if (carriesAll(i)) return i
  // Nothing matched: report against the row the caller expected, or the first
  // row when the file is shorter than that — "Missing required column: x" is a
  // far more useful error than "has no row 4".
  return declaredIdx >= 0 && declaredIdx < aoa.length ? declaredIdx : 0
}

function isBlankRow(cells) {
  return !cells.some(c => c != null && String(c).trim() !== '')
}

/**
 * @param {Buffer} buffer            raw uploaded file
 * @param {string} [opts.sheetName]  preferred sheet (case-insensitive); falls back to the first
 * @param {number} [opts.headerRow]  1-based sheet row holding the headers
 * @param {string[]} [opts.required] header names that must be present
 * @returns {{ sheetName, headers, rows }}
 * @throws  Error with .statusCode 400 on anything unreadable
 */
function parseSheet(buffer, { sheetName, headerRow = 1, required = [] } = {}) {
  let wb
  try {
    // codepage 1252 matters for the .xls files: their titles contain
    // Windows-1252 punctuation (en-dashes in "Business Communication – I").
    wb = XLSX.read(buffer, { type: 'buffer', raw: true, codepage: 1252 })
  } catch (err) {
    throw Object.assign(new Error(`Could not read the file as Excel: ${err.message}`), { statusCode: 400 })
  }

  const names = wb.SheetNames || []
  if (!names.length) throw Object.assign(new Error('Workbook has no sheets'), { statusCode: 400 })

  const wanted = sheetName ? names.find(n => normalizeHeader(n) === normalizeHeader(sheetName)) : null
  const chosen = wanted || names[0]
  const ws = wb.Sheets[chosen]
  if (!ws || !ws['!ref']) {
    throw Object.assign(new Error(`Sheet "${chosen}" is empty`), { statusCode: 400 })
  }

  // sheet_to_json indexes from the used range's first row, which is not always
  // row 1 — track the offset so rowNumber stays true to the file.
  const firstSheetRow = XLSX.utils.decode_range(ws['!ref']).s.r // 0-based
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: true, defval: null, raw: true })

  const headerIdx = findHeaderIdx(aoa, headerRow - 1 - firstSheetRow, required)
  if (headerIdx < 0 || headerIdx >= aoa.length) {
    throw Object.assign(new Error(`Sheet "${chosen}" has no row ${headerRow} to read headers from`), { statusCode: 400 })
  }

  const headers = (aoa[headerIdx] || []).map(normalizeHeader)

  const missing = required.filter(c => !headers.includes(normalizeHeader(c)))
  if (missing.length) {
    throw Object.assign(
      new Error(`Missing required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`),
      { statusCode: 400 }
    )
  }

  const index = {}
  headers.forEach((h, i) => { if (h !== '' && !(h in index)) index[h] = i })

  const rows = []
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const cells = aoa[i] || []
    if (isBlankRow(cells)) continue
    rows.push(makeRow(cells, index, firstSheetRow + i + 1))
  }

  return { sheetName: chosen, headers, rows }
}

function makeRow(cells, index, rowNumber) {
  const at = name => {
    const i = index[normalizeHeader(name)]
    return i == null ? null : cells[i]
  }
  return {
    rowNumber,
    cells,
    /** Trimmed string, or null when blank. */
    get(name) {
      const v = at(name)
      if (v == null) return null
      const s = String(v).trim()
      return s === '' ? null : s
    },
    /** Finite number, or null. */
    num(name) {
      const v = at(name)
      if (v == null || v === '') return null
      const n = Number(String(v).trim())
      return Number.isFinite(n) ? n : null
    },
    /** Zero-padded code — required for every code column (see file header). */
    padded(name, width) {
      const s = this.get(name)
      return s == null ? null : s.padStart(width, '0')
    },
    has(name) { return index[normalizeHeader(name)] != null },
  }
}

module.exports = { parseSheet, normalizeHeader }
