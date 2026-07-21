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

// ── Hardcoded fallback constants (used when college has no category master set up) ──
const CAT3_CASTES   = ['SC', 'ST', 'DT/VJ', 'NT(A)', 'NT(B)', 'NT(C)', 'SBC', 'OBC']
const CAT2_STATUSES = ['EBC', 'PTC', 'STC', 'Ex-Service']
const CAT4_STATUSES = ['FF', 'PH', 'Widows', 'C.Govt.', 'S.Govt.']

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
 * loadCollegeCategoryMaster(collegeId, pool)
 * Loads fees_categories with their caste/status mappings.
 * Returns null if college has no category master configured (triggers fallback).
 */
async function loadCollegeCategoryMaster(collegeId, pool) {
  const countRes = await pool.request()
    .input('col', mssql.Int, collegeId)
    .query('SELECT COUNT(*) AS cnt FROM fees_categories WHERE college_id=@col AND is_active=1')
  if (countRes.recordset[0].cnt === 0) return null

  const [catsRes, casteMapsRes, statusMapsRes] = await Promise.all([
    pool.request().input('col', mssql.Int, collegeId)
      .query('SELECT * FROM fees_categories WHERE college_id=@col AND is_active=1 ORDER BY display_order, slab_index'),
    pool.request().input('col', mssql.Int, collegeId)
      .query(`SELECT fcc.fees_category_id, cc.caste_name
              FROM fees_category_castes fcc
              JOIN category_castes cc ON cc.id = fcc.caste_id
              JOIN fees_categories fc ON fc.id = fcc.fees_category_id
              WHERE fc.college_id=@col`),
    pool.request().input('col', mssql.Int, collegeId)
      .query(`SELECT fcs.fees_category_id, css.status_name
              FROM fees_category_special_statuses fcs
              JOIN category_special_statuses css ON css.id = fcs.special_status_id
              JOIN fees_categories fc ON fc.id = fcs.fees_category_id
              WHERE fc.college_id=@col`),
  ])

  return {
    categories:    catsRes.recordset,
    casteMappings: casteMapsRes.recordset,    // [{ fees_category_id, caste_name }]
    statusMappings: statusMapsRes.recordset,  // [{ fees_category_id, status_name }]
  }
}

/**
 * resolveSlabFromMaster(master, caste, specialStatus)
 * Returns { slab, slabReason }
 * using the college's dynamic category master.
 *
 * Priority: special status overrides caste mapping; fallback to first category.
 */
function resolveSlabFromMaster(master, caste, specialStatus) {
  const { categories, casteMappings, statusMappings } = master

  // Find fees_category for this caste
  const casteMap = casteMappings.find(m => m.caste_name === caste)
  const fcFromCaste = casteMap ? categories.find(c => c.id === casteMap.fees_category_id) : null

  // Find fees_category for this special status
  const statusMap = specialStatus ? statusMappings.find(m => m.status_name === specialStatus) : null
  const fcFromStatus = statusMap ? categories.find(c => c.id === statusMap.fees_category_id) : null

  // Special status overrides caste; fallback to caste category, then first category
  const fc = fcFromStatus || fcFromCaste || categories[0]

  const slab       = fc.slab_index
  const slabReason = `${fc.category_name} assigned — slab ${slab}.`

  return { slab, slabReason }
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
 *   fundingType:        'Granted'|'NonGranted'|'Both'|null,
 *   studentType:        'Grand'|'NonGrand'|'Outsider',
 *   breakdown: [{ fees_code, fees_head, short_name, fees_type, is_refundable, amount }],
 *   totalFee:           number,
 *   reimbursableAmount: number,   // always 0
 *   studentPayable:     number,   // always equal to totalFee
 * }
 */
async function compute({ collegeId, facultyMasterId, yearLevel, divisionLetter, caste, specialStatus, studentType, academicYear, isNewStudent, pool }) {
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

  // 2. Determine slab — dynamic master if available, else hardcoded fallback
  let slab, slabReason
  const master = await loadCollegeCategoryMaster(collegeId, resolvedPool)
  if (master) {
    ;({ slab, slabReason } = resolveSlabFromMaster(master, caste, specialStatus))
  } else {
    ;({ slab, reason: slabReason } = determineSlab(caste, specialStatus))
  }

  // 3. Fetch applicable fee heads + amounts (cat1–cat8)
  const feesRes = await resolvedPool.request()
    .input('cid', mssql.Int,      collegeId)
    .input('fid', mssql.Int,      facultyMasterId || null)
    .input('yl',  mssql.NVarChar, yearLevel || null)
    .input('st',  mssql.NVarChar, resolvedStudentType)
    .input('ay',  mssql.NVarChar, academicYear || null)
    .query(`
      SELECT
        fm.fees_code, fm.fees_head, fm.short_name, fm.fees_type, fm.is_refundable,
        fm.fees_cat1_amount, fm.fees_cat2_amount, fm.fees_cat3_amount, fm.fees_cat4_amount,
        fm.fees_cat5_amount, fm.fees_cat6_amount, fm.fees_cat7_amount, fm.fees_cat8_amount,
        cf.cat1_amount AS cw_cat1, cf.cat2_amount AS cw_cat2,
        cf.cat3_amount AS cw_cat3, cf.cat4_amount AS cw_cat4,
        cf.cat5_amount AS cw_cat5, cf.cat6_amount AS cw_cat6,
        cf.cat7_amount AS cw_cat7, cf.cat8_amount AS cw_cat8
      FROM fees_master fm
      LEFT JOIN classwise_fees cf
        ON cf.fees_code = fm.fees_code
        AND cf.college_id = @cid
        AND (@fid IS NULL OR cf.faculty_master_id = @fid)
        AND (@yl IS NULL OR cf.year_level = @yl)
        AND cf.student_type = @st
        AND (@ay IS NULL OR cf.academic_year = @ay)
      WHERE fm.college_id = @cid
        AND fm.is_active = 1
        AND (@ay IS NULL OR fm.academic_year = @ay)
      ORDER BY fm.sequence_auto_fees
    `)

  // 4. Build breakdown — classwise override takes priority; slab drives which column to use
  //    Also fetch the set of fees_codes that have classwise rows ONLY for 'Outsider'
  //    (no row for the resolved student type) — these must be excluded for non-new students.
  let outsiderOnlyCodes = new Set()
  if (facultyMasterId && yearLevel) {
    const outsiderOnlyRes = await resolvedPool.request()
      .input('cid', mssql.Int,      collegeId)
      .input('fid', mssql.Int,      facultyMasterId)
      .input('yl',  mssql.NVarChar, yearLevel)
      .input('st',  mssql.NVarChar, resolvedStudentType)
      .input('ay',  mssql.NVarChar, academicYear || null)
      .query(`
        SELECT DISTINCT cf.fees_code
        FROM classwise_fees cf
        WHERE cf.college_id = @cid
          AND cf.faculty_master_id = @fid
          AND cf.year_level = @yl
          AND cf.student_type = 'Outsider'
          AND (@ay IS NULL OR cf.academic_year = @ay)
          AND NOT EXISTS (
            SELECT 1 FROM classwise_fees cf2
            WHERE cf2.college_id = cf.college_id
              AND cf2.faculty_master_id = cf.faculty_master_id
              AND cf2.year_level = cf.year_level
              AND cf2.fees_code = cf.fees_code
              AND cf2.student_type = @st
              AND (@ay IS NULL OR cf2.academic_year = @ay)
          )
      `)
    outsiderOnlyCodes = new Set(outsiderOnlyRes.recordset.map(r => r.fees_code))
  }

  // A fee head is only charged when the college has CONFIGURED it for this exact
  // course + year + student-type — i.e. there is a classwise_fees row with a
  // NON-NULL amount for the student's slab. The college-wide fees_master base
  // amount is NOT used as a fallback: if the classwise amount is blank (null) or
  // there is no classwise row at all, the fee is treated as "not set" (excluded).
  const breakdown = feesRes.recordset
    .filter(row => isNewStudent || !outsiderOnlyCodes.has(row.fees_code))
    .map(row => {
      const cwVal = row[`cw_cat${slab}`]
      if (cwVal == null) return null   // not configured for this class/year → not charged
      return {
        fees_code:    row.fees_code,
        fees_head:    row.fees_head,
        short_name:   row.short_name,
        fees_type:    row.fees_type,
        is_refundable: !!row.is_refundable,
        amount:       parseFloat(String(cwVal)),
      }
    })
    .filter(Boolean)

  // 5. For new students, also include Outsider-specific fee heads configured for this
  //    class and year. New = FY always, or higher years with no prior app at this college.
  if (isNewStudent && facultyMasterId) {
    const outsiderRes = await resolvedPool.request()
      .input('cid', mssql.Int,      collegeId)
      .input('fid', mssql.Int,      facultyMasterId)
      .input('yl',  mssql.NVarChar, yearLevel)
      .input('ay',  mssql.NVarChar, academicYear || null)
      .query(`
        SELECT
          fm.fees_code, fm.fees_head, fm.short_name, fm.fees_type, fm.is_refundable,
          cf.cat1_amount AS cw_cat1, cf.cat2_amount AS cw_cat2,
          cf.cat3_amount AS cw_cat3, cf.cat4_amount AS cw_cat4,
          cf.cat5_amount AS cw_cat5, cf.cat6_amount AS cw_cat6,
          cf.cat7_amount AS cw_cat7, cf.cat8_amount AS cw_cat8,
          fm.fees_cat1_amount, fm.fees_cat2_amount, fm.fees_cat3_amount, fm.fees_cat4_amount,
          fm.fees_cat5_amount, fm.fees_cat6_amount, fm.fees_cat7_amount, fm.fees_cat8_amount
        FROM classwise_fees cf
        JOIN fees_master fm ON fm.fees_code = cf.fees_code
        WHERE cf.college_id = @cid
          AND cf.faculty_master_id = @fid
          AND cf.year_level = @yl
          AND cf.student_type = 'Outsider'
          AND (@ay IS NULL OR cf.academic_year = @ay)
          AND fm.is_active = 1
          AND (@ay IS NULL OR fm.academic_year = @ay)
      `)

    for (const row of outsiderRes.recordset) {
      // Only the student's slab amount counts, and only if it is actually set
      // (non-null). A blank outsider amount is "not set" — skip it entirely.
      const cwSlabAmount = row[`cw_cat${slab}`]
      if (cwSlabAmount == null) continue
      const amount = parseFloat(String(cwSlabAmount))

      const existing = breakdown.find(h => h.fees_code === row.fees_code)
      if (existing) {
        existing.amount = amount
        existing.is_outsider = true
      } else {
        breakdown.push({
          fees_code:     row.fees_code,
          fees_head:     row.fees_head,
          short_name:    row.short_name,
          fees_type:     row.fees_type,
          is_refundable: !!row.is_refundable,
          amount,
          is_outsider:   true,
        })
      }
    }
  }

  const totalFee       = breakdown.reduce((s, r) => s + r.amount, 0)
  const studentPayable = totalFee

  return {
    feesCategorySlab: slab,
    slabReason,
    fundingType,
    studentType: resolvedStudentType,
    breakdown,
    totalFee,
    reimbursableAmount: 0,
    studentPayable,
  }
}

module.exports = { compute, determineSlab }
