/**
 * ReceiptNumberService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates sequential, per-college receipt numbers.
 *
 * Five independent series per college, each resetting every academic year:
 *
 *   Series  Payment type          Format example
 *   ──────  ───────────────────   ──────────────
 *   G       college_fee (Grant)   G-0001
 *   NG      college_fee (NGrant)  NG-0001
 *   AF      application_fee       AF-0001
 *   MISC    misc_fee              MISC-0001
 *   EXAM    exam_fee              EXAM-0001
 *
 * Academic year follows a 1-June cutover:
 *   1 Jun YYYY → 31 May YYYY+1  →  "YYYY-YY"   e.g. "2026-27"
 *
 * All counters live in receipt_counters (college_id, series, academic_year).
 * Increment is done inside the caller's transaction with UPDLOCK to prevent gaps.
 *
 * Usage:
 *   const rcptSvc = require('./services/ReceiptNumberService')
 *
 *   // Inside a transaction (tx = pool.transaction()):
 *   const receiptNo = await rcptSvc.next({
 *     tx,           // mssql transaction (must be already begun)
 *     collegeId,
 *     paymentType,  // 'college_fee' | 'application_fee' | 'misc_fee' | 'exam_fee'
 *     divisionLetter, facultyMasterId, yearLevel,  // needed for college_fee only
 *     pool,         // db pool — used to look up division_master
 *   })
 */

const mssql = require('mssql')

// ── Academic year helper ──────────────────────────────────────────────────────
// Returns the academic year string for a given Date (defaults to now).
// 1 June onward → new year starts.  e.g. 1 Jun 2026 → "2026-27"
function currentAcademicYear(now = new Date()) {
  const y = now.getFullYear()
  const m = now.getMonth() + 1  // 1-based
  const startYear = m >= 6 ? y : y - 1
  const endYear   = (startYear + 1) % 100             // last two digits
  return `${startYear}-${String(endYear).padStart(2, '0')}`
}

// ── Resolve series for college_fee ────────────────────────────────────────────
// Looks up division_master to determine funding_type, then maps to G / NG.
// Falls back to 'NG' if division is unknown (no division college or no match).
async function resolveCollegeFeeSeries(collegeId, divisionLetter, facultyMasterId, yearLevel, pool) {
  if (!divisionLetter || !facultyMasterId || !yearLevel) return 'NG'

  try {
    const r = await pool.request()
      .input('cid', mssql.Int,      parseInt(collegeId))
      .input('fid', mssql.Int,      parseInt(facultyMasterId))
      .input('yl',  mssql.NVarChar, yearLevel)
      .input('dl',  mssql.Char,     divisionLetter)
      .query(`
        SELECT funding_type FROM division_master
        WHERE college_id=@cid AND faculty_master_id=@fid
          AND year_level=@yl AND division_letter=@dl AND is_active=1
      `)

    const ft = r.recordset[0]?.funding_type
    if (ft === 'Granted') return 'G'
    if (ft === 'NonGranted') return 'NG'
    // 'Both' or unknown → default NG
    return 'NG'
  } catch (_) {
    return 'NG'
  }
}

// ── Map payment_type to series key ────────────────────────────────────────────
const PAYMENT_TYPE_TO_SERIES = {
  application_fee: 'AF',
  misc_fee:        'MISC',
  exam_fee:        'EXAM',
  // college_fee resolved dynamically via division
}

// ── Format the receipt number string ─────────────────────────────────────────
function format(series, seq) {
  return `${series}-${String(seq).padStart(4, '0')}`
}

// ── Main: generate next receipt number ───────────────────────────────────────
/**
 * @param {object} opts
 * @param {import('mssql').Transaction} opts.tx          - active mssql transaction
 * @param {import('mssql').ConnectionPool} opts.pool     - db pool (for division lookup)
 * @param {number} opts.collegeId
 * @param {string} opts.paymentType                      - payment_type value
 * @param {string} [opts.divisionLetter]                 - app_division (college_fee only)
 * @param {number} [opts.facultyMasterId]                - course code_no (college_fee only)
 * @param {string} [opts.yearLevel]                      - 'FY'|'SY'|'TY' (college_fee only)
 * @param {Date}   [opts.now]                            - override clock (testing)
 * @returns {Promise<string>}  e.g. "G-0001"
 */
async function next({ tx, pool, collegeId, paymentType, divisionLetter, facultyMasterId, yearLevel, now }) {
  // 1. Determine series
  let series
  if (paymentType === 'college_fee' || paymentType === 'college_fee_installment') {
    series = await resolveCollegeFeeSeries(collegeId, divisionLetter, facultyMasterId, yearLevel, pool)
  } else {
    series = PAYMENT_TYPE_TO_SERIES[paymentType]
    if (!series) throw new Error(`ReceiptNumberService: unknown payment_type "${paymentType}"`)
  }

  const ay = currentAcademicYear(now)

  // 2. Upsert counter row and atomically increment — UPDLOCK prevents concurrent gaps
  //    MERGE ensures the row exists, then we UPDATE last_seq and SELECT the new value.
  const r = await tx.request()
    .input('cid',    mssql.Int,      parseInt(collegeId))
    .input('series', mssql.NVarChar, series)
    .input('ay',     mssql.NVarChar, ay)
    .query(`
      MERGE receipt_counters WITH (HOLDLOCK) AS target
      USING (SELECT @cid AS college_id, @series AS series, @ay AS academic_year) AS src
        ON  target.college_id   = src.college_id
        AND target.series       = src.series
        AND target.academic_year = src.academic_year
      WHEN MATCHED THEN
        UPDATE SET last_seq = last_seq + 1
      WHEN NOT MATCHED THEN
        INSERT (college_id, series, academic_year, last_seq)
        VALUES (@cid, @series, @ay, 1);

      SELECT last_seq
      FROM receipt_counters
      WHERE college_id=@cid AND series=@series AND academic_year=@ay;
    `)

  const seq = r.recordset[0].last_seq
  return format(series, seq)
}

module.exports = { next, currentAcademicYear }
