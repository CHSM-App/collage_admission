/**
 * FeeDeterminationService.js
 * ─────────────────────────────────────────────────────────────
 * Encapsulates all fee-category and payment-mode determination logic.
 * Stateless — takes inputs, returns a structured result.
 * Modify only this file when university policies change.
 *
 * Usage:
 *   const svc = require('./services/FeeDeterminationService')
 *   const result = await svc.compute({ collegeId, facultyMasterId, yearLevel,
 *                                       divisionLetter, caste, specialStatus, pool })
 */

const mssql = require('mssql')

// ── Caste / Status group constants ────────────────────────────

// BCC castes: qualify for full government fee reimbursement
const BCC_CASTES    = ['SC', 'ST', 'DT/VJ', 'NT(A)', 'NT(B)', 'NT(C)', 'SBC']

// Cat-3 castes (backward classes — use Cat-3 slab in Fees Master)
// Same set as BCC plus OBC
const CAT3_CASTES   = ['SC', 'ST', 'DT/VJ', 'NT(A)', 'NT(B)', 'NT(C)', 'SBC', 'OBC']

// Statuses that map to Cat-2 (partial concession: EBC/PTC/STC/Army)
const CAT2_STATUSES = ['EBC', 'PTC', 'STC', 'Ex-Service']

// Statuses that map to Cat-4 (institution-configurable: FF/PH/Widows/Govt.Wards)
// TODO: confirm with stakeholder the official institutional definition of Cat-4
const CAT4_STATUSES = ['FF', 'PH', 'Widows', 'C.Govt.', 'S.Govt.']

/**
 * determineSlab(caste, specialStatus) → { slab: 1|2|3|4, reason: string }
 *
 * Priority order per spec:
 *   1. Caste in CAT3_CASTES → Cat-3
 *   2. Status in CAT2_STATUSES → Cat-2
 *   3. Status in CAT4_STATUSES → Cat-4
 *   4. Default → Cat-1 (General/Open)
 */
function determineSlab(caste, specialStatus) {
  if (caste && CAT3_CASTES.includes(caste)) {
    return { slab: 3, reason: `Cat-3 assigned — Caste "${caste}" qualifies as backward class.` }
  }
  if (specialStatus && CAT2_STATUSES.includes(specialStatus)) {
    return { slab: 2, reason: `Cat-2 assigned — Special status "${specialStatus}" qualifies for partial concession.` }
  }
  if (specialStatus && CAT4_STATUSES.includes(specialStatus)) {
    return { slab: 4, reason: `Cat-4 assigned — Special status "${specialStatus}" qualifies for institutional concession.` }
  }
  return {
    slab: 1,
    reason: caste
      ? `Cat-1 assigned — Caste "${caste}" with no qualifying status; full fees apply.`
      : 'Cat-1 assigned by default — General/Open category.',
  }
}

/**
 * determinePaymentMode(caste, specialStatus, fundingType)
 *   → { mode: 'Paying'|'Other'|'BCC', reason: string }
 *
 * Priority:
 *   A. Caste in BCC_CASTES AND fundingType != 'NonGranted' → BCC
 *   B. Caste = OBC OR any specialStatus selected → Other
 *   C. Default → Paying
 *   C modifier: if fundingType = 'NonGranted' → override to Paying
 */
function determinePaymentMode(caste, specialStatus, fundingType) {
  let mode, reason

  if (caste && BCC_CASTES.includes(caste)) {
    mode   = 'BCC'
    reason = `BCC assigned — Caste "${caste}" qualifies for government fee reimbursement.`
  } else if ((caste === 'OBC') || specialStatus) {
    mode   = 'Other'
    reason = specialStatus
      ? `Other assigned — Special status "${specialStatus}" qualifies for concession/scheme.`
      : 'Other assigned — OBC may qualify for non-creamy-layer concession.'
  } else {
    mode   = 'Paying'
    reason = caste
      ? `Paying assigned — Caste "${caste}" with no concession scheme.`
      : 'Paying assigned by default — no caste/status selected.'
  }

  // NonGranted seats don't receive government concessions — override to Paying
  if (fundingType === 'NonGranted' && mode !== 'Paying') {
    reason += ` [Overridden to Paying — Division is Non-Granted; government concessions don't apply.]`
    mode = 'Paying'
  }

  return { mode, reason }
}

/**
 * compute({ collegeId, facultyMasterId, yearLevel, divisionLetter,
 *            caste, specialStatus, studentType, pool })
 *
 * studentType: 'Grand' | 'NonGrand' | 'Outsider' (defaults to 'Grand')
 *
 * Returns:
 * {
 *   feesCategorySlab:   1|2|3|4,
 *   slabReason:         string,
 *   paymentMode:        'Paying'|'Other'|'BCC',
 *   paymentModeReason:  string,
 *   fundingType:        'Granted'|'NonGranted'|'Both'|null,
 *   studentType:        'Grand'|'NonGrand'|'Outsider',
 *   breakdown: [{ fees_code, fees_head, short_name, fees_type, is_refundable, amount }],
 *   totalFee:           number,
 *   reimbursableAmount: number,   // for BCC: sum of reimbursable heads
 *   studentPayable:     number,   // totalFee - reimbursableAmount
 * }
 */
async function compute({ collegeId, facultyMasterId, yearLevel, divisionLetter, caste, specialStatus, studentType, pool }) {
  // pool may be a Promise (from db.js connect) — await it
  const resolvedPool = await Promise.resolve(pool)

  // 1. Look up division funding type
  let fundingType = null
  if (divisionLetter && facultyMasterId && yearLevel) {
    const divRes = await resolvedPool.request()
      .input('cid', mssql.Int,      collegeId)
      .input('fid', mssql.Int,      facultyMasterId)
      .input('yl',  mssql.NVarChar, yearLevel)
      .input('dl',  mssql.Char,     divisionLetter)
      .query(`
        SELECT funding_type FROM division_master
        WHERE college_id=@cid AND faculty_master_id=@fid
          AND year_level=@yl AND division_letter=@dl AND is_active=1
      `)
    if (divRes.recordset.length) fundingType = divRes.recordset[0].funding_type
  }

  // Derive student_type from division's funding_type.
  // funding_type 'Granted' → 'Grand', 'NonGranted' → 'NonGrand', 'Both' → use caller-supplied studentType.
  // If no division selected, fall back to caller-supplied studentType (default 'Grand').
  const VALID_STUDENT_TYPES = ['Grand', 'NonGrand', 'Outsider']
  const FUNDING_TO_STUDENT_TYPE = { Granted: 'Grand', NonGranted: 'NonGrand' }
  const resolvedStudentType = fundingType && FUNDING_TO_STUDENT_TYPE[fundingType]
    ? FUNDING_TO_STUDENT_TYPE[fundingType]
    : (VALID_STUDENT_TYPES.includes(studentType) ? studentType : 'Grand')

  // 2. Determine slab and payment mode
  const { slab, reason: slabReason }               = determineSlab(caste, specialStatus)
  const { mode: paymentMode, reason: paymentModeReason } = determinePaymentMode(caste, specialStatus, fundingType)

  // 3. Fetch applicable fee heads + amounts
  // Only return heads that have a classwise_fees entry for this class+student_type (selected heads).
  // If no division/student_type context, fall back to all active heads using base amounts.
  const slabCol = `fees_cat${slab}_amount`
  const feesRes = await resolvedPool.request()
    .input('cid', mssql.Int,      collegeId)
    .input('fid', mssql.Int,      facultyMasterId || null)
    .input('yl',  mssql.NVarChar, yearLevel || null)
    .input('st',  mssql.NVarChar, resolvedStudentType)
    .query(`
      SELECT
        fm.fees_code, fm.fees_head, fm.short_name, fm.fees_type,
        fm.is_refundable,
        fm.fees_cat1_amount, fm.fees_cat2_amount, fm.fees_cat3_amount, fm.fees_cat4_amount,
        cf.cat1_amount AS cw_cat1, cf.cat2_amount AS cw_cat2,
        cf.cat3_amount AS cw_cat3, cf.cat4_amount AS cw_cat4
      FROM fees_master fm
      ${facultyMasterId && yearLevel ? 'INNER' : 'LEFT'} JOIN classwise_fees cf
        ON cf.fees_code = fm.fees_code
        AND cf.college_id = @cid
        AND cf.faculty_master_id = @fid
        AND cf.year_level = @yl
        AND cf.student_type = @st
      WHERE fm.college_id = @cid AND fm.is_active = 1
      ORDER BY fm.sequence_auto_fees
    `)

  // 4. Build breakdown — classwise override takes priority
  const breakdown = feesRes.recordset.map(row => {
    const cwCol  = `cw_cat${slab}`
    const baseCol = `fees_cat${slab}_amount`
    const amount = row[cwCol] != null ? parseFloat(row[cwCol]) : parseFloat(row[baseCol] || 0)
    return {
      fees_code:    row.fees_code,
      fees_head:    row.fees_head,
      short_name:   row.short_name,
      fees_type:    row.fees_type,
      is_refundable: !!row.is_refundable,
      amount,
    }
  })

  const totalFee           = breakdown.reduce((s, r) => s + r.amount, 0)
  // For BCC: reimbursable = all heads marked is_refundable; student pays only non-refundable
  // TODO: confirm with stakeholder which specific heads are reimbursed for BCC
  const reimbursableAmount = paymentMode === 'BCC'
    ? breakdown.filter(r => r.is_refundable).reduce((s, r) => s + r.amount, 0)
    : 0
  const studentPayable     = totalFee - reimbursableAmount

  return {
    feesCategorySlab:  slab,
    slabReason,
    paymentMode,
    paymentModeReason,
    fundingType,
    studentType: resolvedStudentType,
    breakdown,
    totalFee,
    reimbursableAmount,
    studentPayable,
  }
}

module.exports = { compute, determineSlab, determinePaymentMode }
