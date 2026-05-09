/**
 * certificates.js — endpoints for the Certificates module.
 *
 * Routes (all require auth + college ownership + 'certificates' permission):
 *   GET    /certificates/:collegeId/student-lookup?reg_no=
 *
 *   Bonafide:
 *     GET/POST/PUT/DELETE /certificates/:collegeId/bonafide[/:id]
 *     GET /certificates/:collegeId/bonafide/next-no
 *
 *   Character:
 *     GET/POST/PUT/DELETE /certificates/:collegeId/character[/:id]
 *     GET /certificates/:collegeId/character/next-no
 *
 *   NOC (No Objection Certificate):
 *     GET/POST/PUT/DELETE /certificates/:collegeId/noc[/:id]
 *     GET /certificates/:collegeId/noc/next-no
 *
 * Soft delete on DELETE; certificate_no is immutable once issued.
 */

const express = require('express')
const router  = express.Router()
const db      = require('./db')
const mssql   = require('mssql')
const { authenticate, requireCollegeAccess, requirePerm } = require('../middleware/auth')

router.use(authenticate, requireCollegeAccess)

const cid = (req) => parseInt(req.params.collegeId)

const YEAR_LABEL = { 1: 'FY', 2: 'SY', 3: 'TY' }

function pad4(n) { return String(n).padStart(4, '0') }

// ─── Compute the next certificate number for a college+year ──
// Format: <typePrefix>/<calendar-year>/<4-digit-serial>. Serial resets each
// calendar year per college. Reads the highest existing serial for the prefix
// in the given table and increments. The unique index (college_id, certificate_no)
// is the final race-condition guard — if two requests collide, the second
// insert fails with 2627/2601 and we surface a 409 to the caller.
//
// `table` must be a hard-coded value from this file — do NOT pass user input.
async function nextCertificateNumber(collegeId, year, { table, typePrefix }) {
  const prefix = `${typePrefix}/${year}/`
  const r = await db.request()
    .input('cid', mssql.Int, collegeId)
    .input('pfx', mssql.NVarChar, prefix + '%')
    .query(`
      SELECT certificate_no FROM ${table}
      WHERE college_id = @cid AND certificate_no LIKE @pfx
    `)
  let max = 0
  for (const row of r.recordset) {
    const tail = row.certificate_no.substring(prefix.length)
    const n = parseInt(tail, 10)
    if (!isNaN(n) && n > max) max = n
  }
  return `${prefix}${pad4(max + 1)}`
}

const BONAFIDE_CFG  = { table: 'certificate_bonafide',  typePrefix: 'BON',  pkCol: 'bonafide_id' }
const CHARACTER_CFG = { table: 'certificate_character', typePrefix: 'CHAR', pkCol: 'character_certificate_id' }
const NOC_CFG       = { table: 'certificate_noc',       typePrefix: 'NOC',  pkCol: 'noc_certificate_id' }

// ─── GET /certificates/:cid/student-lookup?reg_no= ────────────
// Pulls student details from the most recent application matching reg_no.
// Used by the Bonafide Certificate form to auto-fill student fields.
router.get('/:collegeId/student-lookup', requirePerm('certificates'), async (req, res) => {
  const reg = (req.query.reg_no || '').trim()
  if (!reg) return res.status(400).json({ success: false, message: 'reg_no is required.' })

  try {
    // Column map (per current schema):
    //   applications: app_surname / app_first_name / app_middle_name (no app_full_name),
    //                 app_category (no app_caste), no sex/birth_date/prn columns.
    //   students:     full_name, gender, dob, category (no sex / birth_date / caste / prn).
    const r = await db.request()
      .input('cid', mssql.Int, cid(req))
      .input('reg', mssql.NVarChar, reg)
      .query(`
        SELECT TOP 1
          a.registration_number,
          a.year_of_study,
          a.academic_year,
          a.roll_number,
          a.app_surname,
          a.app_first_name,
          a.app_middle_name,
          a.app_category,
          s.full_name  AS student_full_name,
          s.gender     AS student_gender,
          s.dob        AS student_dob,
          s.category   AS student_category,
          fm.degree_course_code,
          fm.degree_course_name
        FROM applications a
        JOIN students         s  ON s.id        = a.student_id
        LEFT JOIN faculty_master fm ON fm.code_no = a.course_id AND fm.college_id = a.college_id
        WHERE a.college_id = @cid
          AND a.registration_number = @reg
        ORDER BY a.created_at DESC
      `)

    if (!r.recordset.length) {
      return res.status(404).json({ success: false, message: 'No student found for this registration number.' })
    }

    const a   = r.recordset[0]
    const yr  = YEAR_LABEL[a.year_of_study] || `Year ${a.year_of_study || ''}`
    const cls = a.degree_course_code ? `${yr} ${a.degree_course_code}` : yr
    const appName = [a.app_surname, a.app_first_name, a.app_middle_name].filter(Boolean).join(' ').trim()
    return res.json({
      success: true,
      data: {
        registration_number: a.registration_number,
        student_name:        appName || a.student_full_name || '',
        gender:              a.student_gender   || '',
        birth_date:          a.student_dob,
        caste:               a.app_category     || a.student_category || '',
        roll_no:             a.roll_number      || '',
        academic_year:       a.academic_year    || '',
        class_name:          cls.trim(),
        prn_no:              '',
      },
    })
  } catch (e) {
    console.error('[student-lookup] query failed:', { reg, message: e.message, code: e.code })
    return res.status(500).json({
      success: false,
      message: 'Could not look up the student. The student database returned an error — please try again, or contact your administrator if the problem persists.',
    })
  }
})

// ─── GET /certificates/:cid/bonafide ──────────────────────────
// Lists non-deleted bonafide certificates, newest first. Optional ?q= filter.
router.get('/:collegeId/bonafide', requirePerm('certificates'), async (req, res) => {
  const q = (req.query.q || '').trim()
  try {
    const reqQ = db.request().input('cid', mssql.Int, cid(req))
    let where = `WHERE college_id = @cid AND is_deleted = 0`
    if (q) {
      where += ` AND (certificate_no LIKE @q OR reg_no LIKE @q OR student_name LIKE @q)`
      reqQ.input('q', mssql.NVarChar, `%${q}%`)
    }
    const r = await reqQ.query(`
      SELECT TOP 200 bonafide_id, certificate_no, certificate_date, reg_no, student_name,
                     gender, is_ex_student, class_name, academic_year, birth_date, roll_no, caste,
                     created_date, updated_date
      FROM certificate_bonafide
      ${where}
      ORDER BY bonafide_id DESC
    `)
    return res.json({ success: true, data: r.recordset })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ─── GET /certificates/:cid/bonafide/next-no ──────────────────
// Returns the next certificate number that *would* be assigned right now.
// The actual number is re-computed at insert time, so this is a preview.
router.get('/:collegeId/bonafide/next-no', requirePerm('certificates'), async (req, res) => {
  try {
    const year = new Date().getFullYear()
    const certNo = await nextCertificateNumber(cid(req), year, BONAFIDE_CFG)
    return res.json({ success: true, data: { certificate_no: certNo } })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ─── GET /certificates/:cid/bonafide/:id ──────────────────────
router.get('/:collegeId/bonafide/:id', requirePerm('certificates'), async (req, res) => {
  try {
    const r = await db.request()
      .input('cid', mssql.Int, cid(req))
      .input('id',  mssql.Int, parseInt(req.params.id))
      .query(`
        SELECT * FROM certificate_bonafide
        WHERE college_id = @cid AND bonafide_id = @id AND is_deleted = 0
      `)
    if (!r.recordset.length) return res.status(404).json({ success: false, message: 'Certificate not found.' })
    return res.json({ success: true, data: r.recordset[0] })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ─── Validation helper ────────────────────────────────────────
function validateBody(body) {
  const errors = {}
  if (!body.certificate_date)       errors.certificate_date = 'Date is required.'
  if (!body.student_name?.trim())   errors.student_name     = 'Student name is required.'
  if (!body.class_name?.trim())     errors.class_name       = 'Class is required.'
  if (!body.academic_year?.trim())  errors.academic_year    = 'Academic year is required.'
  if (body.gender && !['Male','Female','Other'].includes(body.gender)) {
    errors.gender = 'Gender must be Male, Female, or Other.'
  }
  if (body.roll_no !== undefined && body.roll_no !== null && body.roll_no !== '' && isNaN(parseInt(body.roll_no))) {
    errors.roll_no = 'Roll number must be a number.'
  }
  return errors
}

// ─── POST /certificates/:cid/bonafide ─────────────────────────
// Server generates the certificate_no — any client-supplied value is ignored.
router.post('/:collegeId/bonafide', requirePerm('certificates'), async (req, res) => {
  const errors = validateBody(req.body)
  if (Object.keys(errors).length) {
    return res.status(422).json({ success: false, message: 'Validation failed.', errors })
  }

  try {
    const collegeId = cid(req)
    const certDate  = new Date(req.body.certificate_date)
    const year      = certDate.getFullYear()
    const certNo    = await nextCertificateNumber(collegeId, year, BONAFIDE_CFG)

    const userId = req.user?.id || null

    const r = await db.request()
      .input('cid',  mssql.Int,      collegeId)
      .input('cn',   mssql.NVarChar, certNo)
      .input('cd',   mssql.Date,     certDate)
      .input('reg',  mssql.NVarChar, req.body.reg_no || null)
      .input('sn',   mssql.NVarChar, req.body.student_name.trim())
      .input('g',    mssql.NVarChar, req.body.gender || null)
      .input('ex',   mssql.Bit,      req.body.is_ex_student ? 1 : 0)
      .input('cls',  mssql.NVarChar, req.body.class_name.trim())
      .input('ay',   mssql.NVarChar, req.body.academic_year.trim())
      .input('bd',   mssql.Date,     req.body.birth_date || null)
      .input('roll', mssql.Int,      req.body.roll_no ? parseInt(req.body.roll_no) : null)
      .input('cas',  mssql.NVarChar, req.body.caste || null)
      .input('uid',  mssql.Int,      userId)
      .query(`
        INSERT INTO certificate_bonafide
          (college_id, certificate_no, certificate_date, reg_no, student_name, gender,
           is_ex_student, class_name, academic_year, birth_date, roll_no, caste, created_by)
        OUTPUT INSERTED.*
        VALUES
          (@cid, @cn, @cd, @reg, @sn, @g, @ex, @cls, @ay, @bd, @roll, @cas, @uid)
      `)
    return res.status(201).json({ success: true, data: r.recordset[0] })
  } catch (e) {
    if (e.number === 2627 || e.number === 2601) {
      return res.status(409).json({ success: false, message: 'Certificate number collision — please retry.' })
    }
    console.error(e)
    return res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ─── PUT /certificates/:cid/bonafide/:id ──────────────────────
// certificate_no is immutable once issued.
router.put('/:collegeId/bonafide/:id', requirePerm('certificates'), async (req, res) => {
  const errors = validateBody(req.body)
  if (Object.keys(errors).length) {
    return res.status(422).json({ success: false, message: 'Validation failed.', errors })
  }
  try {
    const userId = req.user?.id || null
    const r = await db.request()
      .input('cid',  mssql.Int,      cid(req))
      .input('id',   mssql.Int,      parseInt(req.params.id))
      .input('cd',   mssql.Date,     new Date(req.body.certificate_date))
      .input('reg',  mssql.NVarChar, req.body.reg_no || null)
      .input('sn',   mssql.NVarChar, req.body.student_name.trim())
      .input('g',    mssql.NVarChar, req.body.gender || null)
      .input('ex',   mssql.Bit,      req.body.is_ex_student ? 1 : 0)
      .input('cls',  mssql.NVarChar, req.body.class_name.trim())
      .input('ay',   mssql.NVarChar, req.body.academic_year.trim())
      .input('bd',   mssql.Date,     req.body.birth_date || null)
      .input('roll', mssql.Int,      req.body.roll_no ? parseInt(req.body.roll_no) : null)
      .input('cas',  mssql.NVarChar, req.body.caste || null)
      .input('uid',  mssql.Int,      userId)
      .query(`
        UPDATE certificate_bonafide SET
          certificate_date = @cd,
          reg_no           = @reg,
          student_name     = @sn,
          gender           = @g,
          is_ex_student    = @ex,
          class_name       = @cls,
          academic_year    = @ay,
          birth_date       = @bd,
          roll_no          = @roll,
          caste            = @cas,
          updated_by       = @uid,
          updated_date     = GETDATE()
        OUTPUT INSERTED.*
        WHERE bonafide_id = @id AND college_id = @cid AND is_deleted = 0
      `)
    if (!r.recordset.length) return res.status(404).json({ success: false, message: 'Certificate not found.' })
    return res.json({ success: true, data: r.recordset[0] })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ─── DELETE /certificates/:cid/bonafide/:id ───────────────────
// Soft delete — sets is_deleted=1, preserves the row for audit.
router.delete('/:collegeId/bonafide/:id', requirePerm('certificates'), async (req, res) => {
  try {
    const userId = req.user?.id || null
    const r = await db.request()
      .input('cid', mssql.Int, cid(req))
      .input('id',  mssql.Int, parseInt(req.params.id))
      .input('uid', mssql.Int, userId)
      .query(`
        UPDATE certificate_bonafide
        SET is_deleted = 1, updated_by = @uid, updated_date = GETDATE()
        WHERE bonafide_id = @id AND college_id = @cid AND is_deleted = 0
      `)
    if (!r.rowsAffected[0]) return res.status(404).json({ success: false, message: 'Certificate not found.' })
    return res.json({ success: true })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ════════════════════════════════════════════════════════════
// CHARACTER CERTIFICATE
// ════════════════════════════════════════════════════════════

// Validation helper for character certificate body
function validateCharacterBody(body) {
  const errors = {}
  if (!body.certificate_date)       errors.certificate_date = 'Date is required.'
  if (!body.student_name?.trim())   errors.student_name     = 'Student name is required.'
  if (!body.class_name?.trim())     errors.class_name       = 'Class is required.'
  if (!body.academic_year?.trim())  errors.academic_year    = 'Academic year is required.'
  if (body.gender && !['Male','Female','Other'].includes(body.gender)) {
    errors.gender = 'Gender must be Male, Female, or Other.'
  }
  if (body.roll_no !== undefined && body.roll_no !== null && body.roll_no !== '' && isNaN(parseInt(body.roll_no))) {
    errors.roll_no = 'Roll number must be a number.'
  }
  if (body.known_from_years !== undefined && body.known_from_years !== null && body.known_from_years !== '') {
    const n = parseInt(body.known_from_years)
    if (isNaN(n) || n < 0) errors.known_from_years = 'Known From must be a non-negative number.'
  }
  return errors
}

// ─── GET /certificates/:cid/character ─────────────────────────
router.get('/:collegeId/character', requirePerm('certificates'), async (req, res) => {
  const q = (req.query.q || '').trim()
  try {
    const reqQ = db.request().input('cid', mssql.Int, cid(req))
    let where = `WHERE college_id = @cid AND is_deleted = 0`
    if (q) {
      where += ` AND (certificate_no LIKE @q OR reg_no LIKE @q OR student_name LIKE @q)`
      reqQ.input('q', mssql.NVarChar, `%${q}%`)
    }
    const r = await reqQ.query(`
      SELECT TOP 200 character_certificate_id, certificate_no, certificate_date, reg_no, student_name,
                     gender, is_ex_student, class_name, academic_year, known_from_years, birth_date,
                     roll_no, caste, created_date, updated_date
      FROM certificate_character
      ${where}
      ORDER BY character_certificate_id DESC
    `)
    return res.json({ success: true, data: r.recordset })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ─── GET /certificates/:cid/character/next-no ─────────────────
router.get('/:collegeId/character/next-no', requirePerm('certificates'), async (req, res) => {
  try {
    const year = new Date().getFullYear()
    const certNo = await nextCertificateNumber(cid(req), year, CHARACTER_CFG)
    return res.json({ success: true, data: { certificate_no: certNo } })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ─── GET /certificates/:cid/character/:id ─────────────────────
router.get('/:collegeId/character/:id', requirePerm('certificates'), async (req, res) => {
  try {
    const r = await db.request()
      .input('cid', mssql.Int, cid(req))
      .input('id',  mssql.Int, parseInt(req.params.id))
      .query(`
        SELECT * FROM certificate_character
        WHERE college_id = @cid AND character_certificate_id = @id AND is_deleted = 0
      `)
    if (!r.recordset.length) return res.status(404).json({ success: false, message: 'Certificate not found.' })
    return res.json({ success: true, data: r.recordset[0] })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ─── POST /certificates/:cid/character ────────────────────────
router.post('/:collegeId/character', requirePerm('certificates'), async (req, res) => {
  const errors = validateCharacterBody(req.body)
  if (Object.keys(errors).length) {
    return res.status(422).json({ success: false, message: 'Validation failed.', errors })
  }

  try {
    const collegeId = cid(req)
    const certDate  = new Date(req.body.certificate_date)
    const year      = certDate.getFullYear()
    const certNo    = await nextCertificateNumber(collegeId, year, CHARACTER_CFG)
    const userId    = req.user?.id || null

    const r = await db.request()
      .input('cid',  mssql.Int,      collegeId)
      .input('cn',   mssql.NVarChar, certNo)
      .input('cd',   mssql.Date,     certDate)
      .input('reg',  mssql.NVarChar, req.body.reg_no || null)
      .input('sn',   mssql.NVarChar, req.body.student_name.trim())
      .input('g',    mssql.NVarChar, req.body.gender || null)
      .input('ex',   mssql.Bit,      req.body.is_ex_student ? 1 : 0)
      .input('cls',  mssql.NVarChar, req.body.class_name.trim())
      .input('ay',   mssql.NVarChar, req.body.academic_year.trim())
      .input('kfy',  mssql.Int,      req.body.known_from_years === '' || req.body.known_from_years == null ? null : parseInt(req.body.known_from_years))
      .input('bd',   mssql.Date,     req.body.birth_date || null)
      .input('roll', mssql.Int,      req.body.roll_no ? parseInt(req.body.roll_no) : null)
      .input('cas',  mssql.NVarChar, req.body.caste || null)
      .input('uid',  mssql.Int,      userId)
      .query(`
        INSERT INTO certificate_character
          (college_id, certificate_no, certificate_date, reg_no, student_name, gender,
           is_ex_student, class_name, academic_year, known_from_years, birth_date,
           roll_no, caste, created_by)
        OUTPUT INSERTED.*
        VALUES
          (@cid, @cn, @cd, @reg, @sn, @g, @ex, @cls, @ay, @kfy, @bd, @roll, @cas, @uid)
      `)
    return res.status(201).json({ success: true, data: r.recordset[0] })
  } catch (e) {
    if (e.number === 2627 || e.number === 2601) {
      return res.status(409).json({ success: false, message: 'Certificate number collision — please retry.' })
    }
    console.error(e)
    return res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ─── PUT /certificates/:cid/character/:id ─────────────────────
// certificate_no is immutable once issued.
router.put('/:collegeId/character/:id', requirePerm('certificates'), async (req, res) => {
  const errors = validateCharacterBody(req.body)
  if (Object.keys(errors).length) {
    return res.status(422).json({ success: false, message: 'Validation failed.', errors })
  }
  try {
    const userId = req.user?.id || null
    const r = await db.request()
      .input('cid',  mssql.Int,      cid(req))
      .input('id',   mssql.Int,      parseInt(req.params.id))
      .input('cd',   mssql.Date,     new Date(req.body.certificate_date))
      .input('reg',  mssql.NVarChar, req.body.reg_no || null)
      .input('sn',   mssql.NVarChar, req.body.student_name.trim())
      .input('g',    mssql.NVarChar, req.body.gender || null)
      .input('ex',   mssql.Bit,      req.body.is_ex_student ? 1 : 0)
      .input('cls',  mssql.NVarChar, req.body.class_name.trim())
      .input('ay',   mssql.NVarChar, req.body.academic_year.trim())
      .input('kfy',  mssql.Int,      req.body.known_from_years === '' || req.body.known_from_years == null ? null : parseInt(req.body.known_from_years))
      .input('bd',   mssql.Date,     req.body.birth_date || null)
      .input('roll', mssql.Int,      req.body.roll_no ? parseInt(req.body.roll_no) : null)
      .input('cas',  mssql.NVarChar, req.body.caste || null)
      .input('uid',  mssql.Int,      userId)
      .query(`
        UPDATE certificate_character SET
          certificate_date = @cd,
          reg_no           = @reg,
          student_name     = @sn,
          gender           = @g,
          is_ex_student    = @ex,
          class_name       = @cls,
          academic_year    = @ay,
          known_from_years = @kfy,
          birth_date       = @bd,
          roll_no          = @roll,
          caste            = @cas,
          updated_by       = @uid,
          updated_date     = GETDATE()
        OUTPUT INSERTED.*
        WHERE character_certificate_id = @id AND college_id = @cid AND is_deleted = 0
      `)
    if (!r.recordset.length) return res.status(404).json({ success: false, message: 'Certificate not found.' })
    return res.json({ success: true, data: r.recordset[0] })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ─── DELETE /certificates/:cid/character/:id ──────────────────
router.delete('/:collegeId/character/:id', requirePerm('certificates'), async (req, res) => {
  try {
    const userId = req.user?.id || null
    const r = await db.request()
      .input('cid', mssql.Int, cid(req))
      .input('id',  mssql.Int, parseInt(req.params.id))
      .input('uid', mssql.Int, userId)
      .query(`
        UPDATE certificate_character
        SET is_deleted = 1, updated_by = @uid, updated_date = GETDATE()
        WHERE character_certificate_id = @id AND college_id = @cid AND is_deleted = 0
      `)
    if (!r.rowsAffected[0]) return res.status(404).json({ success: false, message: 'Certificate not found.' })
    return res.json({ success: true })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ════════════════════════════════════════════════════════════
// NO OBJECTION CERTIFICATE
// ════════════════════════════════════════════════════════════

function validateNocBody(body) {
  const errors = {}
  if (!body.certificate_date)      errors.certificate_date = 'Date is required.'
  if (!body.student_name?.trim())  errors.student_name     = 'Student name is required.'
  if (!body.class_name?.trim())    errors.class_name       = 'Class is required.'
  if (body.gender && !['Male','Female','Other'].includes(body.gender)) {
    errors.gender = 'Gender must be Male, Female, or Other.'
  }
  // From/To date range — both optional individually, but if both supplied, from <= to.
  if (body.from_date && body.to_date) {
    const f = new Date(body.from_date)
    const t = new Date(body.to_date)
    if (!isNaN(f) && !isNaN(t) && f > t) {
      errors.to_date = 'To Date must be on or after From Date.'
    }
  }
  return errors
}

// ─── GET /certificates/:cid/noc ───────────────────────────────
router.get('/:collegeId/noc', requirePerm('certificates'), async (req, res) => {
  const q = (req.query.q || '').trim()
  try {
    const reqQ = db.request().input('cid', mssql.Int, cid(req))
    let where = `WHERE college_id = @cid AND is_deleted = 0`
    if (q) {
      where += ` AND (certificate_no LIKE @q OR reg_no LIKE @q OR student_name LIKE @q OR prn_no LIKE @q)`
      reqQ.input('q', mssql.NVarChar, `%${q}%`)
    }
    const r = await reqQ.query(`
      SELECT TOP 200 noc_certificate_id, certificate_no, certificate_date, reg_no, student_name,
                     gender, is_ex_student, class_name, from_date, to_date, prn_no, final_confirmation_no,
                     created_date, updated_date
      FROM certificate_noc
      ${where}
      ORDER BY noc_certificate_id DESC
    `)
    return res.json({ success: true, data: r.recordset })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ─── GET /certificates/:cid/noc/next-no ───────────────────────
router.get('/:collegeId/noc/next-no', requirePerm('certificates'), async (req, res) => {
  try {
    const year = new Date().getFullYear()
    const certNo = await nextCertificateNumber(cid(req), year, NOC_CFG)
    return res.json({ success: true, data: { certificate_no: certNo } })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ─── GET /certificates/:cid/noc/:id ───────────────────────────
router.get('/:collegeId/noc/:id', requirePerm('certificates'), async (req, res) => {
  try {
    const r = await db.request()
      .input('cid', mssql.Int, cid(req))
      .input('id',  mssql.Int, parseInt(req.params.id))
      .query(`
        SELECT * FROM certificate_noc
        WHERE college_id = @cid AND noc_certificate_id = @id AND is_deleted = 0
      `)
    if (!r.recordset.length) return res.status(404).json({ success: false, message: 'Certificate not found.' })
    return res.json({ success: true, data: r.recordset[0] })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ─── POST /certificates/:cid/noc ──────────────────────────────
router.post('/:collegeId/noc', requirePerm('certificates'), async (req, res) => {
  const errors = validateNocBody(req.body)
  if (Object.keys(errors).length) {
    return res.status(422).json({ success: false, message: 'Validation failed.', errors })
  }

  try {
    const collegeId = cid(req)
    const certDate  = new Date(req.body.certificate_date)
    const year      = certDate.getFullYear()
    const certNo    = await nextCertificateNumber(collegeId, year, NOC_CFG)
    const userId    = req.user?.id || null

    const r = await db.request()
      .input('cid',  mssql.Int,      collegeId)
      .input('cn',   mssql.NVarChar, certNo)
      .input('cd',   mssql.Date,     certDate)
      .input('reg',  mssql.NVarChar, req.body.reg_no || null)
      .input('sn',   mssql.NVarChar, req.body.student_name.trim())
      .input('g',    mssql.NVarChar, req.body.gender || null)
      .input('ex',   mssql.Bit,      req.body.is_ex_student ? 1 : 0)
      .input('cls',  mssql.NVarChar, req.body.class_name.trim())
      .input('fd',   mssql.Date,     req.body.from_date || null)
      .input('td',   mssql.Date,     req.body.to_date   || null)
      .input('prn',  mssql.NVarChar, req.body.prn_no?.trim() || null)
      .input('fc',   mssql.NVarChar, req.body.final_confirmation_no?.trim() || null)
      .input('uid',  mssql.Int,      userId)
      .query(`
        INSERT INTO certificate_noc
          (college_id, certificate_no, certificate_date, reg_no, student_name, gender,
           is_ex_student, class_name, from_date, to_date, prn_no, final_confirmation_no, created_by)
        OUTPUT INSERTED.*
        VALUES
          (@cid, @cn, @cd, @reg, @sn, @g, @ex, @cls, @fd, @td, @prn, @fc, @uid)
      `)
    return res.status(201).json({ success: true, data: r.recordset[0] })
  } catch (e) {
    if (e.number === 2627 || e.number === 2601) {
      return res.status(409).json({ success: false, message: 'Certificate number collision — please retry.' })
    }
    if (e.number === 547 && /chk_cert_noc_date_range/i.test(e.message || '')) {
      return res.status(422).json({ success: false, message: 'To Date must be on or after From Date.' })
    }
    console.error(e)
    return res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ─── PUT /certificates/:cid/noc/:id ───────────────────────────
router.put('/:collegeId/noc/:id', requirePerm('certificates'), async (req, res) => {
  const errors = validateNocBody(req.body)
  if (Object.keys(errors).length) {
    return res.status(422).json({ success: false, message: 'Validation failed.', errors })
  }
  try {
    const userId = req.user?.id || null
    const r = await db.request()
      .input('cid',  mssql.Int,      cid(req))
      .input('id',   mssql.Int,      parseInt(req.params.id))
      .input('cd',   mssql.Date,     new Date(req.body.certificate_date))
      .input('reg',  mssql.NVarChar, req.body.reg_no || null)
      .input('sn',   mssql.NVarChar, req.body.student_name.trim())
      .input('g',    mssql.NVarChar, req.body.gender || null)
      .input('ex',   mssql.Bit,      req.body.is_ex_student ? 1 : 0)
      .input('cls',  mssql.NVarChar, req.body.class_name.trim())
      .input('fd',   mssql.Date,     req.body.from_date || null)
      .input('td',   mssql.Date,     req.body.to_date   || null)
      .input('prn',  mssql.NVarChar, req.body.prn_no?.trim() || null)
      .input('fc',   mssql.NVarChar, req.body.final_confirmation_no?.trim() || null)
      .input('uid',  mssql.Int,      userId)
      .query(`
        UPDATE certificate_noc SET
          certificate_date      = @cd,
          reg_no                = @reg,
          student_name          = @sn,
          gender                = @g,
          is_ex_student         = @ex,
          class_name            = @cls,
          from_date             = @fd,
          to_date               = @td,
          prn_no                = @prn,
          final_confirmation_no = @fc,
          updated_by            = @uid,
          updated_date          = GETDATE()
        OUTPUT INSERTED.*
        WHERE noc_certificate_id = @id AND college_id = @cid AND is_deleted = 0
      `)
    if (!r.recordset.length) return res.status(404).json({ success: false, message: 'Certificate not found.' })
    return res.json({ success: true, data: r.recordset[0] })
  } catch (e) {
    if (e.number === 547 && /chk_cert_noc_date_range/i.test(e.message || '')) {
      return res.status(422).json({ success: false, message: 'To Date must be on or after From Date.' })
    }
    console.error(e)
    return res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ─── DELETE /certificates/:cid/noc/:id ────────────────────────
router.delete('/:collegeId/noc/:id', requirePerm('certificates'), async (req, res) => {
  try {
    const userId = req.user?.id || null
    const r = await db.request()
      .input('cid', mssql.Int, cid(req))
      .input('id',  mssql.Int, parseInt(req.params.id))
      .input('uid', mssql.Int, userId)
      .query(`
        UPDATE certificate_noc
        SET is_deleted = 1, updated_by = @uid, updated_date = GETDATE()
        WHERE noc_certificate_id = @id AND college_id = @cid AND is_deleted = 0
      `)
    if (!r.rowsAffected[0]) return res.status(404).json({ success: false, message: 'Certificate not found.' })
    return res.json({ success: true })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, message: 'Server error.' })
  }
})

module.exports = router
