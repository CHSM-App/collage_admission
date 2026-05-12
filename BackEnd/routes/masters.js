/**
 * masters.js — CRUD routes for all master tables
 * Mounted at /masters
 *
 * All endpoints require college_id context (from URL param or query).
 * A college admin can only access their own college's data.
 *
 * Routes:
 *   Faculty Master       GET/POST/PUT/DELETE /masters/:collegeId/faculty
 *   Bank Master          GET/POST/PUT/DELETE /masters/:collegeId/bank
 *   Course Master        GET/POST/PUT/DELETE /masters/:collegeId/course
 *   Group Master         GET/POST/PUT/DELETE /masters/:collegeId/group
 *   Group Courses        GET/POST/PUT/DELETE /masters/:collegeId/group/:groupId/courses
 *   Division Master      GET/POST/PUT/DELETE /masters/:collegeId/division
 *   Fees Master          GET/POST/PUT/DELETE /masters/:collegeId/fees
 *   Classwise Fees       GET/POST/PUT/DELETE /masters/:collegeId/fees/classwise
 *   Document Types       GET                  /masters/document-types
 *   Required Documents   GET/POST/DELETE      /masters/:collegeId/required-documents
 */

const express  = require('express')
const router   = express.Router()
const db       = require('./db')
const mssql    = require('mssql')
const feeSvc   = require('../services/FeeDeterminationService')
const { authenticate, requireCollegeAccess, requirePerm } = require('../middleware/auth')
const logger   = require('../config/logger')

// All masters routes require authentication and college ownership
router.use(authenticate, requireCollegeAccess)

// ── Helper: assert college ownership ────────────────────────────
// In production, verify JWT token's college_id matches param.
// For now, trusts the param (auth middleware can be added globally).
function cid(req) { return parseInt(req.params.collegeId) }

// ═══════════════════════════════════════════════════════════════
// FACULTY MASTER
// ═══════════════════════════════════════════════════════════════

// GET /masters/:collegeId/faculty — list all (active + inactive)
router.get('/:collegeId/faculty', async (req, res) => {
  try {
    const r = await db.request()
      .input('cid', mssql.Int, cid(req))
      .query(`
        SELECT * FROM faculty_master
        WHERE college_id = @cid
        ORDER BY degree_course_code
      `)
    res.json({ success: true, data: r.recordset })
  } catch (e) { res.status(500).json({ success: false, message: e.message }) }
})

// Duration-driven slot count (sems = duration*2, exam codes = duration).
// Mirrors the Program Master form's auto-config matrix.
const SEM_SLOTS  = (yrs) => Math.max(0, Math.min(10, parseInt(yrs) * 2 || 0))
const YEAR_SLOTS = (yrs) => Math.max(0, Math.min( 5, parseInt(yrs)     || 0))

// Legacy column layout — what every faculty_master had before the
// extended-duration migration. Used as a safe fallback when schema
// discovery can't locate the table (wrong DB context, non-dbo schema,
// permissions issue on sys.columns, etc.). Prefers "save still works for
// 2/3-year programs" over "fail loudly with 0-column nonsense".
const LEGACY_FACULTY_COLS = {
  sems:  ['unique_code_sem1','unique_code_sem2','unique_code_sem3','unique_code_sem4','unique_code_sem5','unique_code_sem6'],
  years: ['exam_seat_code_year1','exam_seat_code_year2','exam_seat_code_year3'],
  source: 'fallback',
}

// Discover which sem/year columns actually exist on faculty_master.
// Older databases (pre-migrate_faculty_master_extended_duration) only have
// sem1..6 and year1..3 — referencing sem7..10 / year4..5 in those DBs throws
// "Invalid column name". Resolving the table via OBJECT_ID() respects the
// current user's schema search path, so this works regardless of whether
// faculty_master is in dbo, a per-tenant schema, or anywhere else the user
// can see by default. Tries an explicit dbo-prefixed fallback as a second
// chance before giving up.
async function getFacultyMasterCols() {
  let recordset = []
  try {
    const r = await db.request().query(`
      SELECT c.name AS COLUMN_NAME
      FROM sys.columns c
      WHERE c.object_id = COALESCE(OBJECT_ID('faculty_master'), OBJECT_ID('dbo.faculty_master'))
        AND (c.name LIKE 'unique_code_sem%' OR c.name LIKE 'exam_seat_code_year%')
    `)
    recordset = r.recordset || []
  } catch (e) {
    logger.warn({ err: e }, '[faculty-master] schema discovery query failed')
  }

  const all   = recordset.map(x => x.COLUMN_NAME)
  const byNum = (a, b) => parseInt(a.match(/\d+$/)[0], 10) - parseInt(b.match(/\d+$/)[0], 10)
  const sems  = all.filter(n => /^unique_code_sem\d+$/i.test(n)).sort(byNum)
  const years = all.filter(n => /^exam_seat_code_year\d+$/i.test(n)).sort(byNum)

  if (sems.length === 0 || years.length === 0) {
    logger.warn(
      `[faculty-master] schema discovery found ${sems.length} sem cols / ${years.length} year cols. ` +
      `Falling back to the legacy 6-sem / 3-year layout. ` +
      `If the migration HAS been run, verify the DB connection's current database contains faculty_master ` +
      `and the user can read sys.columns for it.`
    )
    return LEGACY_FACULTY_COLS
  }
  return { sems, years, source: 'discovered' }
}

// Centralized SQL → HTTP error translator for faculty_master saves. Logs
// the full SQL detail server-side (so a developer can debug) and returns
// a user-friendly, action-oriented message to the client. Never leaks raw
// SQL message text to the response.
function handleFacultySaveError(e, res, op) {
  logger.error({ err: e, op, sqlNumber: e.number, sqlState: e.state, procedure: e.procName }, `[faculty-master ${op}] save failed`)
  // Unique constraint violation (degree_course_code per college)
  if (e.number === 2627 || e.number === 2601) {
    return res.status(409).json({ success: false, message: 'A degree course with this code already exists for this college.' })
  }
  // Invalid column / schema mismatch (pre-migration DB)
  if (e.number === 207) {
    return res.status(500).json({
      success: false,
      message: 'The database schema is out of date. Please ask an administrator to run the latest migrations (BackEnd/scripts/migrate_faculty_master_extended_duration.js) and try again.',
    })
  }
  // NOT NULL violation
  if (e.number === 515) {
    return res.status(422).json({ success: false, message: 'A required field is missing. Please review the form and try again.' })
  }
  // String / binary truncation
  if (e.number === 8152 || e.number === 2628) {
    return res.status(422).json({ success: false, message: 'One of the values entered is too long. Please shorten it and try again.' })
  }
  // Foreign key violation
  if (e.number === 547) {
    return res.status(422).json({ success: false, message: 'A referenced college or course is invalid.' })
  }
  // Generic fallback — do not include raw SQL text in the user response.
  return res.status(500).json({
    success: false,
    message: 'Could not save the degree course due to an internal error. Please try again, or contact your administrator if the problem persists.',
  })
}

// POST /masters/:collegeId/faculty — create
router.post('/:collegeId/faculty', requirePerm('masters'), async (req, res) => {
  try {
    const body = req.body
    const {
      degree_course_code, degree_course_name, duration_years = 3,
      is_active = true, created_by,
    } = body

    if (!degree_course_code?.trim()) return res.status(422).json({ success: false, message: 'Degree Course Code is required.' })
    if (!degree_course_name?.trim()) return res.status(422).json({ success: false, message: 'Degree Course Name is required.' })

    const yrs       = parseInt(duration_years) || 3
    const semSlots  = SEM_SLOTS(yrs)
    const yearSlots = YEAR_SLOTS(yrs)

    // Schema-aware: only reference columns that actually exist. Pre-migration
    // DBs only have sem1..6 / year1..3.
    const cols = await getFacultyMasterCols()
    if (semSlots > cols.sems.length || yearSlots > cols.years.length) {
      return res.status(422).json({
        success: false,
        message:
          `This database supports degree programs up to ${Math.floor(cols.sems.length / 2)} years. ` +
          `To enable longer durations, an administrator must run the migration: ` +
          `node BackEnd/scripts/migrate_faculty_master_extended_duration.js`,
      })
    }

    // Required-count validation: sem codes = duration * 2, year codes = duration
    for (let i = 0; i < semSlots; i++) {
      if (!body[`unique_code_sem${i + 1}`]?.toString().trim()) {
        return res.status(422).json({ success: false, message: `Semester ${i + 1} code is required for a ${yrs}-year program.` })
      }
    }
    for (let i = 0; i < yearSlots; i++) {
      if (!body[`exam_seat_code_year${i + 1}`]?.toString().trim()) {
        return res.status(422).json({ success: false, message: `Year ${i + 1} exam seat code is required for a ${yrs}-year program.` })
      }
    }

    // Slot arrays sized to what the schema actually has. Indices >= active
    // slot count are forced null so stale data from a longer duration doesn't
    // linger if duration is later shrunk.
    const semVals  = cols.sems.map((c, i)  => i < semSlots  ? (body[c] || null) : null)
    const yearVals = cols.years.map((c, i) => i < yearSlots ? (body[c] || null) : null)

    // Uniqueness check per college (excluding nulls), using only existing columns
    const semCodes  = semVals.filter(Boolean)
    const examCodes = yearVals.filter(Boolean)
    if (semCodes.length > 0) {
      const existing = await db.request().input('cid', mssql.Int, cid(req)).query(`
        SELECT ${cols.sems.join(',')} FROM faculty_master WHERE college_id=@cid AND is_active=1
      `)
      const allSems = existing.recordset.flatMap(r => cols.sems.map(c => r[c]).filter(Boolean))
      const dup = semCodes.find(c => allSems.includes(c))
      if (dup) return res.status(409).json({ success: false, message: `Semester code "${dup}" is already used by another course in this college.` })
    }
    if (examCodes.length > 0) {
      const existing = await db.request().input('cid', mssql.Int, cid(req)).query(`
        SELECT ${cols.years.join(',')} FROM faculty_master WHERE college_id=@cid AND is_active=1
      `)
      const allExam = existing.recordset.flatMap(r => cols.years.map(c => r[c]).filter(Boolean))
      const dup = examCodes.find(c => allExam.includes(c))
      if (dup) return res.status(409).json({ success: false, message: `Exam seat code "${dup}" is already used by another course in this college.` })
    }

    const reqQ = db.request()
      .input('cid', mssql.Int,      cid(req))
      .input('dc',  mssql.NVarChar, degree_course_code.trim().toUpperCase())
      .input('dn',  mssql.NVarChar, degree_course_name.trim())
      .input('dy',  mssql.Int,      yrs)
      .input('ia',  mssql.Bit,      is_active ? 1 : 0)
      .input('cb',  mssql.NVarChar, created_by || null)
    cols.sems.forEach((_,  i) => reqQ.input(`s${i + 1}`, mssql.NVarChar, semVals[i]))
    cols.years.forEach((_, i) => reqQ.input(`e${i + 1}`, mssql.NVarChar, yearVals[i]))

    const semParams  = cols.sems.map((_,  i) => `@s${i + 1}`).join(',')
    const yearParams = cols.years.map((_, i) => `@e${i + 1}`).join(',')

    const r = await reqQ.query(`
      INSERT INTO faculty_master
        (college_id,degree_course_code,degree_course_name,duration_years,
         ${cols.sems.join(',')},
         ${cols.years.join(',')},
         is_active,created_by)
      OUTPUT INSERTED.*
      VALUES
        (@cid,@dc,@dn,@dy,${semParams},${yearParams},@ia,@cb)
    `)
    return res.status(201).json({ success: true, data: r.recordset[0] })
  } catch (e) {
    return handleFacultySaveError(e, res, 'create')
  }
})

// PUT /masters/:collegeId/faculty/:id — update
router.put('/:collegeId/faculty/:id', requirePerm('masters'), async (req, res) => {
  try {
    const body = req.body
    const {
      degree_course_code, degree_course_name, duration_years,
      is_active, modified_by,
    } = body

    if (!degree_course_code?.trim()) return res.status(422).json({ success: false, message: 'Degree Course Code is required.' })
    if (!degree_course_name?.trim()) return res.status(422).json({ success: false, message: 'Degree Course Name is required.' })

    const yrs       = parseInt(duration_years) || 3
    const semSlots  = SEM_SLOTS(yrs)
    const yearSlots = YEAR_SLOTS(yrs)

    const cols = await getFacultyMasterCols()
    if (semSlots > cols.sems.length || yearSlots > cols.years.length) {
      return res.status(422).json({
        success: false,
        message:
          `This database supports degree programs up to ${Math.floor(cols.sems.length / 2)} years. ` +
          `To enable longer durations, an administrator must run the migration: ` +
          `node BackEnd/scripts/migrate_faculty_master_extended_duration.js`,
      })
    }

    for (let i = 0; i < semSlots; i++) {
      if (!body[`unique_code_sem${i + 1}`]?.toString().trim()) {
        return res.status(422).json({ success: false, message: `Semester ${i + 1} code is required for a ${yrs}-year program.` })
      }
    }
    for (let i = 0; i < yearSlots; i++) {
      if (!body[`exam_seat_code_year${i + 1}`]?.toString().trim()) {
        return res.status(422).json({ success: false, message: `Year ${i + 1} exam seat code is required for a ${yrs}-year program.` })
      }
    }

    // Slots beyond the active duration are explicitly cleared in the UPDATE.
    const semVals  = cols.sems.map((c, i)  => i < semSlots  ? (body[c] || null) : null)
    const yearVals = cols.years.map((c, i) => i < yearSlots ? (body[c] || null) : null)

    const reqQ = db.request()
      .input('id',  mssql.Int,      parseInt(req.params.id))
      .input('cid', mssql.Int,      cid(req))
      .input('dc',  mssql.NVarChar, degree_course_code.trim().toUpperCase())
      .input('dn',  mssql.NVarChar, degree_course_name.trim())
      .input('dy',  mssql.Int,      yrs)
      .input('ia',  mssql.Bit,      is_active ? 1 : 0)
      .input('mb',  mssql.NVarChar, modified_by || null)
    cols.sems.forEach((_,  i) => reqQ.input(`s${i + 1}`, mssql.NVarChar, semVals[i]))
    cols.years.forEach((_, i) => reqQ.input(`e${i + 1}`, mssql.NVarChar, yearVals[i]))

    const semSet  = cols.sems.map((c, i)  => `${c}=@s${i + 1}`).join(',')
    const yearSet = cols.years.map((c, i) => `${c}=@e${i + 1}`).join(',')

    const r = await reqQ.query(`
      UPDATE faculty_master SET
        degree_course_code=@dc, degree_course_name=@dn, duration_years=@dy,
        ${semSet},
        ${yearSet},
        is_active=@ia, modified_by=@mb, modified_on=GETDATE()
      OUTPUT INSERTED.*
      WHERE code_no=@id AND college_id=@cid
    `)
    if (!r.recordset.length) return res.status(404).json({ success: false, message: 'Degree course not found.' })
    return res.json({ success: true, data: r.recordset[0] })
  } catch (e) {
    return handleFacultySaveError(e, res, 'update')
  }
})

// DELETE /masters/:collegeId/faculty/:id — soft delete (set is_active=0)
router.delete('/:collegeId/faculty/:id', requirePerm('masters'), async (req, res) => {
  try {
    await db.request()
      .input('id',  mssql.Int, parseInt(req.params.id))
      .input('cid', mssql.Int, cid(req))
      .query(`UPDATE faculty_master SET is_active=0, modified_on=GETDATE() WHERE code_no=@id AND college_id=@cid`)
    res.json({ success: true })
  } catch (e) { res.status(500).json({ success: false, message: e.message }) }
})

// ═══════════════════════════════════════════════════════════════
// BANK MASTER
// ═══════════════════════════════════════════════════════════════

router.get('/:collegeId/bank', async (req, res) => {
  try {
    const r = await db.request()
      .input('cid', mssql.Int, cid(req))
      .query(`SELECT * FROM bank_master WHERE college_id=@cid ORDER BY bank_name`)
    res.json({ success: true, data: r.recordset })
  } catch (e) { res.status(500).json({ success: false, message: e.message }) }
})

router.post('/:collegeId/bank', requirePerm('masters'), async (req, res) => {
  const { bank_account_number, bank_name, branch, ifsc_code, account_type, is_active = true } = req.body
  if (!bank_account_number?.trim()) return res.status(422).json({ success: false, message: 'bank_account_number is required.' })
  if (!bank_name?.trim())           return res.status(422).json({ success: false, message: 'bank_name is required.' })
  if (!ifsc_code?.trim())           return res.status(422).json({ success: false, message: 'IFSC code is required.' })
  try {
    // Check for duplicate account number within the same college
    const dup = await db.request()
      .input('cid', mssql.Int,      cid(req))
      .input('an',  mssql.NVarChar, bank_account_number.trim())
      .query(`SELECT ledger_code FROM bank_master WHERE college_id=@cid AND bank_account_number=@an`)
    if (dup.recordset.length) {
      return res.status(409).json({ success: false, message: 'A bank account with this account number already exists.' })
    }

    const r = await db.request()
      .input('cid', mssql.Int,      cid(req))
      .input('an',  mssql.NVarChar, bank_account_number.trim())
      .input('bn',  mssql.NVarChar, bank_name.trim())
      .input('br',  mssql.NVarChar, branch || null)
      .input('if',  mssql.NVarChar, ifsc_code || null)
      .input('at',  mssql.NVarChar, account_type || null)
      .input('ia',  mssql.Bit,      is_active ? 1 : 0)
      .query(`
        INSERT INTO bank_master (college_id,bank_account_number,bank_name,branch,ifsc_code,account_type,is_active)
        OUTPUT INSERTED.*
        VALUES (@cid,@an,@bn,@br,@if,@at,@ia)
      `)
    res.status(201).json({ success: true, data: r.recordset[0] })
  } catch (e) { res.status(500).json({ success: false, message: e.message }) }
})

router.put('/:collegeId/bank/:id', requirePerm('masters'), async (req, res) => {
  const { bank_account_number, bank_name, branch, ifsc_code, account_type, is_active } = req.body
  try {
    const r = await db.request()
      .input('id',  mssql.Int,      parseInt(req.params.id))
      .input('cid', mssql.Int,      cid(req))
      .input('an',  mssql.NVarChar, bank_account_number?.trim())
      .input('bn',  mssql.NVarChar, bank_name?.trim())
      .input('br',  mssql.NVarChar, branch || null)
      .input('if',  mssql.NVarChar, ifsc_code || null)
      .input('at',  mssql.NVarChar, account_type || null)
      .input('ia',  mssql.Bit,      is_active ? 1 : 0)
      .query(`
        UPDATE bank_master SET
          bank_account_number=@an, bank_name=@bn, branch=@br,
          ifsc_code=@if, account_type=@at, is_active=@ia, modified_on=GETDATE()
        OUTPUT INSERTED.*
        WHERE ledger_code=@id AND college_id=@cid
      `)
    if (!r.recordset.length) return res.status(404).json({ success: false, message: 'Record not found.' })
    res.json({ success: true, data: r.recordset[0] })
  } catch (e) { res.status(500).json({ success: false, message: e.message }) }
})

router.delete('/:collegeId/bank/:id', requirePerm('masters'), async (req, res) => {
  try {
    await db.request()
      .input('id',  mssql.Int, parseInt(req.params.id))
      .input('cid', mssql.Int, cid(req))
      .query(`UPDATE bank_master SET is_active=0, modified_on=GETDATE() WHERE ledger_code=@id AND college_id=@cid`)
    res.json({ success: true })
  } catch (e) { res.status(500).json({ success: false, message: e.message }) }
})

// ═══════════════════════════════════════════════════════════════
// COURSE MASTER (subjects per semester)
// ═══════════════════════════════════════════════════════════════

// GET /masters/:collegeId/course?faculty_id=&semester=
router.get('/:collegeId/course', async (req, res) => {
  const { faculty_id, semester } = req.query
  try {
    let q = `
      SELECT cm.*, fm.degree_course_code, fm.degree_course_name
      FROM course_master cm
      JOIN faculty_master fm ON fm.code_no = cm.faculty_master_id
      WHERE cm.college_id = @cid
    `
    const req2 = db.request().input('cid', mssql.Int, cid(req))
    if (faculty_id) { q += ' AND cm.faculty_master_id = @fid'; req2.input('fid', mssql.Int, parseInt(faculty_id)) }
    if (semester)   { q += ' AND cm.semester = @sem';          req2.input('sem', mssql.Int, parseInt(semester)) }
    q += ' ORDER BY cm.display_order, cm.id'
    const r = await req2.query(q)
    res.json({ success: true, data: r.recordset })
  } catch (e) { res.status(500).json({ success: false, message: e.message }) }
})

// POST — create single course master row
router.post('/:collegeId/course', requirePerm('masters'), async (req, res) => {
  const {
    faculty_master_id, semester, course_code, course_title,
    credits, max_internal, min_internal, max_sem_end, min_sem_end,
    max_total, min_total, subject_type, display_order = 0,
  } = req.body

  if (!faculty_master_id) return res.status(422).json({ success: false, message: 'faculty_master_id required.' })
  if (!semester)          return res.status(422).json({ success: false, message: 'semester required.' })
  if (!course_code?.trim()) return res.status(422).json({ success: false, message: 'course_code required.' })
  if (!course_title?.trim()) return res.status(422).json({ success: false, message: 'course_title required.' })
  if (max_internal && min_internal && min_internal > max_internal)
    return res.status(422).json({ success: false, message: 'min_internal cannot exceed max_internal.' })
  if (max_sem_end && min_sem_end && min_sem_end > max_sem_end)
    return res.status(422).json({ success: false, message: 'min_sem_end cannot exceed max_sem_end.' })

  try {
    const r = await db.request()
      .input('cid', mssql.Int,      cid(req))
      .input('fid', mssql.Int,      parseInt(faculty_master_id))
      .input('sem', mssql.Int,      parseInt(semester))
      .input('cc',  mssql.NVarChar, course_code.trim())
      .input('ct',  mssql.NVarChar, course_title.trim())
      .input('cr',  mssql.Decimal,  credits != null ? parseFloat(credits) : null)
      .input('mi',  mssql.Int,      max_internal != null ? parseInt(max_internal) : null)
      .input('ni',  mssql.Int,      min_internal != null ? parseInt(min_internal) : null)
      .input('ms',  mssql.Int,      max_sem_end  != null ? parseInt(max_sem_end)  : null)
      .input('ns',  mssql.Int,      min_sem_end  != null ? parseInt(min_sem_end)  : null)
      .input('mt',  mssql.Int,      max_total    != null ? parseInt(max_total)    : null)
      .input('nt',  mssql.Int,      min_total    != null ? parseInt(min_total)    : null)
      .input('st',  mssql.NVarChar, subject_type || null)
      .input('do',  mssql.Int,      parseInt(display_order) || 0)
      .query(`
        INSERT INTO course_master
          (college_id,faculty_master_id,semester,course_code,course_title,
           credits,max_internal,min_internal,max_sem_end,min_sem_end,
           max_total,min_total,subject_type,display_order)
        OUTPUT INSERTED.*
        VALUES (@cid,@fid,@sem,@cc,@ct,@cr,@mi,@ni,@ms,@ns,@mt,@nt,@st,@do)
      `)
    res.status(201).json({ success: true, data: r.recordset[0] })
  } catch (e) {
    if (e.number === 2627 || e.number === 2601)
      return res.status(409).json({ success: false, message: 'Course code already exists for this program-semester.' })
    res.status(500).json({ success: false, message: e.message })
  }
})

router.put('/:collegeId/course/:id', requirePerm('masters'), async (req, res) => {
  const {
    faculty_master_id, semester, course_code, course_title,
    credits, max_internal, min_internal, max_sem_end, min_sem_end,
    max_total, min_total, subject_type, display_order, is_active,
  } = req.body
  if (max_internal && min_internal && min_internal > max_internal)
    return res.status(422).json({ success: false, message: 'min_internal cannot exceed max_internal.' })
  try {
    const r = await db.request()
      .input('id',  mssql.Int,      parseInt(req.params.id))
      .input('cid', mssql.Int,      cid(req))
      .input('fid', mssql.Int,      parseInt(faculty_master_id))
      .input('sem', mssql.Int,      parseInt(semester))
      .input('cc',  mssql.NVarChar, course_code?.trim())
      .input('ct',  mssql.NVarChar, course_title?.trim())
      .input('cr',  mssql.Decimal,  credits != null ? parseFloat(credits) : null)
      .input('mi',  mssql.Int,      max_internal != null ? parseInt(max_internal) : null)
      .input('ni',  mssql.Int,      min_internal != null ? parseInt(min_internal) : null)
      .input('ms',  mssql.Int,      max_sem_end  != null ? parseInt(max_sem_end)  : null)
      .input('ns',  mssql.Int,      min_sem_end  != null ? parseInt(min_sem_end)  : null)
      .input('mt',  mssql.Int,      max_total    != null ? parseInt(max_total)    : null)
      .input('nt',  mssql.Int,      min_total    != null ? parseInt(min_total)    : null)
      .input('st',  mssql.NVarChar, subject_type || null)
      .input('do',  mssql.Int,      parseInt(display_order) || 0)
      .input('ia',  mssql.Bit,      is_active ? 1 : 0)
      .query(`
        UPDATE course_master SET
          faculty_master_id=@fid, semester=@sem, course_code=@cc, course_title=@ct,
          credits=@cr, max_internal=@mi, min_internal=@ni, max_sem_end=@ms, min_sem_end=@ns,
          max_total=@mt, min_total=@nt, subject_type=@st, display_order=@do,
          is_active=@ia, modified_on=GETDATE()
        OUTPUT INSERTED.*
        WHERE id=@id AND college_id=@cid
      `)
    if (!r.recordset.length) return res.status(404).json({ success: false, message: 'Record not found.' })
    res.json({ success: true, data: r.recordset[0] })
  } catch (e) {
    if (e.number === 2627 || e.number === 2601)
      return res.status(409).json({ success: false, message: 'Course code already exists for this program-semester.' })
    res.status(500).json({ success: false, message: e.message })
  }
})

router.delete('/:collegeId/course/:id', requirePerm('masters'), async (req, res) => {
  try {
    await db.request()
      .input('id',  mssql.Int, parseInt(req.params.id))
      .input('cid', mssql.Int, cid(req))
      .query(`DELETE FROM course_master WHERE id=@id AND college_id=@cid`)
    res.json({ success: true })
  } catch (e) { res.status(500).json({ success: false, message: e.message }) }
})

// POST /masters/:collegeId/course/bulk-save — save entire semester grid at once
router.post('/:collegeId/course/bulk-save', requirePerm('masters'), async (req, res) => {
  const { faculty_master_id, semester, rows } = req.body
  if (!faculty_master_id || !semester || !Array.isArray(rows))
    return res.status(422).json({ success: false, message: 'faculty_master_id, semester, rows[] required.' })

  try {
    for (const row of rows) {
      if (!row.course_code?.trim() || !row.course_title?.trim()) continue
      // Upsert by (college_id, faculty_master_id, semester, course_code)
      await db.request()
        .input('cid', mssql.Int,      cid(req))
        .input('fid', mssql.Int,      parseInt(faculty_master_id))
        .input('sem', mssql.Int,      parseInt(semester))
        .input('cc',  mssql.NVarChar, row.course_code.trim())
        .input('ct',  mssql.NVarChar, row.course_title.trim())
        .input('cr',  mssql.Decimal,  row.credits != null ? parseFloat(row.credits) : null)
        .input('mi',  mssql.Int,      row.max_internal != null ? parseInt(row.max_internal) : null)
        .input('ni',  mssql.Int,      row.min_internal != null ? parseInt(row.min_internal) : null)
        .input('ms',  mssql.Int,      row.max_sem_end  != null ? parseInt(row.max_sem_end)  : null)
        .input('ns',  mssql.Int,      row.min_sem_end  != null ? parseInt(row.min_sem_end)  : null)
        .input('mt',  mssql.Int,      row.max_total    != null ? parseInt(row.max_total)    : null)
        .input('nt',  mssql.Int,      row.min_total    != null ? parseInt(row.min_total)    : null)
        .input('st',  mssql.NVarChar, row.subject_type || null)
        .input('do',  mssql.Int,      parseInt(row.display_order) || 0)
        .query(`
          MERGE course_master AS target
          USING (SELECT @cid AS college_id, @fid AS faculty_master_id, @sem AS semester, @cc AS course_code) AS src
          ON target.college_id=src.college_id AND target.faculty_master_id=src.faculty_master_id
             AND target.semester=src.semester AND target.course_code=src.course_code
          WHEN MATCHED THEN UPDATE SET
            course_title=@ct, credits=@cr, max_internal=@mi, min_internal=@ni,
            max_sem_end=@ms, min_sem_end=@ns, max_total=@mt, min_total=@nt,
            subject_type=@st, display_order=@do, modified_on=GETDATE()
          WHEN NOT MATCHED THEN INSERT
            (college_id,faculty_master_id,semester,course_code,course_title,credits,
             max_internal,min_internal,max_sem_end,min_sem_end,max_total,min_total,subject_type,display_order)
          VALUES (@cid,@fid,@sem,@cc,@ct,@cr,@mi,@ni,@ms,@ns,@mt,@nt,@st,@do);
        `)
    }
    res.json({ success: true, message: 'Saved.' })
  } catch (e) { res.status(500).json({ success: false, message: e.message }) }
})

// ═══════════════════════════════════════════════════════════════
// GROUP MASTER
// ═══════════════════════════════════════════════════════════════

router.get('/:collegeId/group', async (req, res) => {
  const { faculty_id, semester } = req.query
  try {
    let q = `
      SELECT gm.*, fm.degree_course_code,
        (SELECT COUNT(*) FROM group_courses gc WHERE gc.group_id=gm.id) AS course_count
      FROM group_master gm
      JOIN faculty_master fm ON fm.code_no=gm.faculty_master_id
      WHERE gm.college_id=@cid
    `
    const req2 = db.request().input('cid', mssql.Int, cid(req))
    if (faculty_id) { q += ' AND gm.faculty_master_id=@fid'; req2.input('fid', mssql.Int, parseInt(faculty_id)) }
    if (semester)   { q += ' AND gm.semester=@sem';          req2.input('sem', mssql.Int, parseInt(semester)) }
    q += ' ORDER BY gm.group_code'
    const r = await req2.query(q)
    res.json({ success: true, data: r.recordset })
  } catch (e) { res.status(500).json({ success: false, message: e.message }) }
})

router.get('/:collegeId/group/:id', async (req, res) => {
  try {
    const [gRes, gcRes] = await Promise.all([
      db.request()
        .input('id',  mssql.Int, parseInt(req.params.id))
        .input('cid', mssql.Int, cid(req))
        .query(`SELECT * FROM group_master WHERE id=@id AND college_id=@cid`),
      db.request()
        .input('gid', mssql.Int, parseInt(req.params.id))
        .query(`SELECT * FROM group_courses WHERE group_id=@gid ORDER BY course_position`),
    ])
    if (!gRes.recordset.length) return res.status(404).json({ success: false, message: 'Not found.' })
    res.json({ success: true, data: { ...gRes.recordset[0], courses: gcRes.recordset } })
  } catch (e) { res.status(500).json({ success: false, message: e.message }) }
})

// Reject duplicate (course_code, course_title) combinations inside one group.
// Comparison normalizes case + whitespace to match SQL Server's default
// case-insensitive collation, so the API matches the DB constraint.
function findDuplicateCourseCombo(courses) {
  const seen = new Map()
  for (const c of courses || []) {
    const code  = (c.course_code  || '').trim().toLowerCase()
    const title = (c.course_title || '').trim().toLowerCase()
    if (!code && !title) continue
    const key = `${code}|${title}`
    if (seen.has(key)) {
      return { firstPos: seen.get(key), dupPos: c.course_position, code: c.course_code, title: c.course_title }
    }
    seen.set(key, c.course_position)
  }
  return null
}

router.post('/:collegeId/group', requirePerm('masters'), async (req, res) => {
  const { faculty_master_id, semester, group_code, group_description, is_active = true, courses = [] } = req.body
  if (!faculty_master_id) return res.status(422).json({ success: false, message: 'faculty_master_id required.' })
  if (!group_code?.trim()) return res.status(422).json({ success: false, message: 'group_code required.' })
  if (!group_description?.trim()) return res.status(422).json({ success: false, message: 'group_description required.' })
  const dup = findDuplicateCourseCombo(courses)
  if (dup) return res.status(422).json({ success: false, message: `Selected Course Code and Course Title combination already exists (slots ${dup.firstPos} and ${dup.dupPos}).` })
  try {
    const r = await db.request()
      .input('cid', mssql.Int,      cid(req))
      .input('fid', mssql.Int,      parseInt(faculty_master_id))
      .input('sem', mssql.Int,      parseInt(semester))
      .input('gc',  mssql.NVarChar, group_code.trim())
      .input('gd',  mssql.NVarChar, group_description.trim())
      .input('ia',  mssql.Bit,      is_active ? 1 : 0)
      .query(`
        INSERT INTO group_master (college_id,faculty_master_id,semester,group_code,group_description,is_active)
        OUTPUT INSERTED.*
        VALUES (@cid,@fid,@sem,@gc,@gd,@ia)
      `)
    const newGroup = r.recordset[0]
    // Insert child courses
    for (const c of courses) {
      if (!c.course_code?.trim()) continue
      await db.request()
        .input('gid', mssql.Int,      newGroup.id)
        .input('pos', mssql.Int,      parseInt(c.course_position))
        .input('cc',  mssql.NVarChar, c.course_code.trim())
        .input('ct',  mssql.NVarChar, c.course_title?.trim() || '')
        .query(`INSERT INTO group_courses (group_id,course_position,course_code,course_title) VALUES (@gid,@pos,@cc,@ct)`)
    }
    res.status(201).json({ success: true, data: newGroup })
  } catch (e) {
    if (e.number === 2627 || e.number === 2601) {
      // The group_master uq_group_master and group_courses uq_group_course_combo
      // both surface as 2627/2601. Disambiguate by message text.
      if (/uq_group_course_combo/i.test(e.message || ''))
        return res.status(409).json({ success: false, message: 'Selected Course Code and Course Title combination already exists.' })
      return res.status(409).json({ success: false, message: 'Group code already exists for this program-semester.' })
    }
    res.status(500).json({ success: false, message: e.message })
  }
})

router.put('/:collegeId/group/:id', requirePerm('masters'), async (req, res) => {
  const { faculty_master_id, semester, group_code, group_description, is_active, courses = [] } = req.body
  const dup = findDuplicateCourseCombo(courses)
  if (dup) return res.status(422).json({ success: false, message: `Selected Course Code and Course Title combination already exists (slots ${dup.firstPos} and ${dup.dupPos}).` })
  try {
    const r = await db.request()
      .input('id',  mssql.Int,      parseInt(req.params.id))
      .input('cid', mssql.Int,      cid(req))
      .input('fid', mssql.Int,      parseInt(faculty_master_id))
      .input('sem', mssql.Int,      parseInt(semester))
      .input('gc',  mssql.NVarChar, group_code?.trim())
      .input('gd',  mssql.NVarChar, group_description?.trim())
      .input('ia',  mssql.Bit,      is_active ? 1 : 0)
      .query(`
        UPDATE group_master SET
          faculty_master_id=@fid, semester=@sem, group_code=@gc,
          group_description=@gd, is_active=@ia, modified_on=GETDATE()
        OUTPUT INSERTED.*
        WHERE id=@id AND college_id=@cid
      `)
    if (!r.recordset.length) return res.status(404).json({ success: false, message: 'Record not found.' })
    // Replace child courses
    await db.request().input('gid', mssql.Int, parseInt(req.params.id))
      .query(`DELETE FROM group_courses WHERE group_id=@gid`)
    for (const c of courses) {
      if (!c.course_code?.trim()) continue
      await db.request()
        .input('gid', mssql.Int,      parseInt(req.params.id))
        .input('pos', mssql.Int,      parseInt(c.course_position))
        .input('cc',  mssql.NVarChar, c.course_code.trim())
        .input('ct',  mssql.NVarChar, c.course_title?.trim() || '')
        .query(`INSERT INTO group_courses (group_id,course_position,course_code,course_title) VALUES (@gid,@pos,@cc,@ct)`)
    }
    res.json({ success: true, data: r.recordset[0] })
  } catch (e) {
    if ((e.number === 2627 || e.number === 2601) && /uq_group_course_combo/i.test(e.message || ''))
      return res.status(409).json({ success: false, message: 'Selected Course Code and Course Title combination already exists.' })
    res.status(500).json({ success: false, message: e.message })
  }
})

router.delete('/:collegeId/group/:id', requirePerm('masters'), async (req, res) => {
  try {
    await db.request()
      .input('id',  mssql.Int, parseInt(req.params.id))
      .input('cid', mssql.Int, cid(req))
      .query(`UPDATE group_master SET is_active=0, modified_on=GETDATE() WHERE id=@id AND college_id=@cid`)
    res.json({ success: true })
  } catch (e) { res.status(500).json({ success: false, message: e.message }) }
})

// ═══════════════════════════════════════════════════════════════
// DIVISION MASTER
// ═══════════════════════════════════════════════════════════════

// GET /masters/:collegeId/division?faculty_id=&year_level=
router.get('/:collegeId/division', async (req, res) => {
  const { faculty_id, year_level } = req.query
  try {
    let q = `
      SELECT dm.*, fm.degree_course_code, fm.degree_course_name
      FROM division_master dm
      JOIN faculty_master fm ON fm.code_no=dm.faculty_master_id
      WHERE dm.college_id=@cid
    `
    const req2 = db.request().input('cid', mssql.Int, cid(req))
    if (faculty_id)  { q += ' AND dm.faculty_master_id=@fid'; req2.input('fid', mssql.Int, parseInt(faculty_id)) }
    if (year_level)  { q += ' AND dm.year_level=@yl';         req2.input('yl', mssql.NVarChar, year_level) }
    q += ' ORDER BY dm.year_level, dm.division_letter'
    const r = await req2.query(q)
    res.json({ success: true, data: r.recordset })
  } catch (e) { res.status(500).json({ success: false, message: e.message }) }
})

// POST /masters/:collegeId/division/save-grid — save entire A-J grid for one class-year
// Body: { faculty_master_id, year_level, class_year_code, divisions: [{letter, funding_type},...] }
router.post('/:collegeId/division/save-grid', requirePerm('masters'), async (req, res) => {
  const { faculty_master_id, year_level, class_year_code, divisions } = req.body
  if (!faculty_master_id || !year_level || !Array.isArray(divisions))
    return res.status(422).json({ success: false, message: 'faculty_master_id, year_level, divisions[] required.' })
  try {
    for (const d of divisions) {
      if (!d.division_letter || !d.funding_type) continue
      await db.request()
        .input('cid', mssql.Int,      cid(req))
        .input('fid', mssql.Int,      parseInt(faculty_master_id))
        .input('yl',  mssql.NVarChar, year_level)
        .input('cyc', mssql.NVarChar, class_year_code || '')
        .input('dl',  mssql.Char,     d.division_letter)
        .input('ft',  mssql.NVarChar, d.funding_type)
        .input('ia',  mssql.Bit,      d.is_active !== false ? 1 : 0)
        .query(`
          MERGE division_master AS target
          USING (SELECT @cid AS college_id, @fid AS faculty_master_id, @yl AS year_level, @dl AS division_letter) AS src
          ON target.college_id=src.college_id AND target.faculty_master_id=src.faculty_master_id
             AND target.year_level=src.year_level AND target.division_letter=src.division_letter
          WHEN MATCHED THEN UPDATE SET funding_type=@ft, class_year_code=@cyc, is_active=@ia, modified_on=GETDATE()
          WHEN NOT MATCHED THEN INSERT
            (college_id,faculty_master_id,year_level,class_year_code,division_letter,funding_type,is_active)
          VALUES (@cid,@fid,@yl,@cyc,@dl,@ft,@ia);
        `)
    }
    res.json({ success: true })
  } catch (e) { res.status(500).json({ success: false, message: e.message }) }
})

router.delete('/:collegeId/division/:id', requirePerm('masters'), async (req, res) => {
  try {
    await db.request()
      .input('id',  mssql.Int, parseInt(req.params.id))
      .input('cid', mssql.Int, cid(req))
      .query(`UPDATE division_master SET is_active=0, modified_on=GETDATE() WHERE id=@id AND college_id=@cid`)
    res.json({ success: true })
  } catch (e) { res.status(500).json({ success: false, message: e.message }) }
})

// ═══════════════════════════════════════════════════════════════
// FEES MASTER
// ═══════════════════════════════════════════════════════════════

router.get('/:collegeId/fees', async (req, res) => {
  try {
    const r = await db.request()
      .input('cid', mssql.Int, cid(req))
      .query(`
        SELECT fm.*, bm.bank_name, bm.bank_account_number
        FROM fees_master fm
        LEFT JOIN bank_master bm ON bm.ledger_code = fm.credit_to_bank_ledger
        WHERE fm.college_id = @cid
        ORDER BY fm.sequence_auto_fees, fm.fees_code
      `)
    res.json({ success: true, data: r.recordset })
  } catch (e) { res.status(500).json({ success: false, message: e.message }) }
})

router.post('/:collegeId/fees', requirePerm('masters'), async (req, res) => {
  const {
    fees_type, is_other_misc = false, fees_head, short_name,
    sequence_auto_fees = 0, credit_to_bank_ledger,
    is_refundable = false,
    fees_cat1_amount = 0, fees_cat2_amount = 0,
    fees_cat3_amount = 0, fees_cat4_amount = 0,
    cat4_description, is_active = true,
  } = req.body
  if (!fees_type)     return res.status(422).json({ success: false, message: 'fees_type required.' })
  if (!fees_head?.trim()) return res.status(422).json({ success: false, message: 'fees_head required.' })
  if (!short_name?.trim()) return res.status(422).json({ success: false, message: 'short_name required.' })
  try {
    const r = await db.request()
      .input('cid', mssql.Int,      cid(req))
      .input('ft',  mssql.NVarChar, fees_type)
      .input('iom', mssql.Bit,      is_other_misc ? 1 : 0)
      .input('fh',  mssql.NVarChar, fees_head.trim())
      .input('sn',  mssql.NVarChar, short_name.trim())
      .input('seq', mssql.Int,      parseInt(sequence_auto_fees) || 0)
      .input('ctb', mssql.Int,      credit_to_bank_ledger ? parseInt(credit_to_bank_ledger) : null)
      .input('ir',  mssql.Bit,      is_refundable ? 1 : 0)
      .input('a1',  mssql.Decimal,  parseFloat(fees_cat1_amount) || 0)
      .input('a2',  mssql.Decimal,  parseFloat(fees_cat2_amount) || 0)
      .input('a3',  mssql.Decimal,  parseFloat(fees_cat3_amount) || 0)
      .input('a4',  mssql.Decimal,  parseFloat(fees_cat4_amount) || 0)
      .input('c4',  mssql.NVarChar, cat4_description || null)
      .input('ia',  mssql.Bit,      is_active ? 1 : 0)
      .query(`
        INSERT INTO fees_master
          (college_id,fees_type,is_other_misc,fees_head,short_name,sequence_auto_fees,
           credit_to_bank_ledger,is_refundable,fees_cat1_amount,fees_cat2_amount,
           fees_cat3_amount,fees_cat4_amount,cat4_description,is_active)
        OUTPUT INSERTED.*
        VALUES (@cid,@ft,@iom,@fh,@sn,@seq,@ctb,@ir,@a1,@a2,@a3,@a4,@c4,@ia)
      `)
    res.status(201).json({ success: true, data: r.recordset[0] })
  } catch (e) { res.status(500).json({ success: false, message: e.message }) }
})

router.put('/:collegeId/fees/:id', requirePerm('masters'), async (req, res) => {
  const {
    fees_type, is_other_misc, fees_head, short_name,
    sequence_auto_fees, credit_to_bank_ledger, is_refundable,
    fees_cat1_amount, fees_cat2_amount, fees_cat3_amount, fees_cat4_amount,
    cat4_description, is_active,
  } = req.body
  try {
    const r = await db.request()
      .input('id',  mssql.Int,      parseInt(req.params.id))
      .input('cid', mssql.Int,      cid(req))
      .input('ft',  mssql.NVarChar, fees_type)
      .input('iom', mssql.Bit,      is_other_misc ? 1 : 0)
      .input('fh',  mssql.NVarChar, fees_head?.trim())
      .input('sn',  mssql.NVarChar, short_name?.trim())
      .input('seq', mssql.Int,      parseInt(sequence_auto_fees) || 0)
      .input('ctb', mssql.Int,      credit_to_bank_ledger ? parseInt(credit_to_bank_ledger) : null)
      .input('ir',  mssql.Bit,      is_refundable ? 1 : 0)
      .input('a1',  mssql.Decimal,  parseFloat(fees_cat1_amount) || 0)
      .input('a2',  mssql.Decimal,  parseFloat(fees_cat2_amount) || 0)
      .input('a3',  mssql.Decimal,  parseFloat(fees_cat3_amount) || 0)
      .input('a4',  mssql.Decimal,  parseFloat(fees_cat4_amount) || 0)
      .input('c4',  mssql.NVarChar, cat4_description || null)
      .input('ia',  mssql.Bit,      is_active ? 1 : 0)
      .query(`
        UPDATE fees_master SET
          fees_type=@ft, is_other_misc=@iom, fees_head=@fh, short_name=@sn,
          sequence_auto_fees=@seq, credit_to_bank_ledger=@ctb, is_refundable=@ir,
          fees_cat1_amount=@a1, fees_cat2_amount=@a2, fees_cat3_amount=@a3,
          fees_cat4_amount=@a4, cat4_description=@c4, is_active=@ia, modified_on=GETDATE()
        OUTPUT INSERTED.*
        WHERE fees_code=@id AND college_id=@cid
      `)
    if (!r.recordset.length) return res.status(404).json({ success: false, message: 'Record not found.' })
    res.json({ success: true, data: r.recordset[0] })
  } catch (e) { res.status(500).json({ success: false, message: e.message }) }
})

router.delete('/:collegeId/fees/:id', requirePerm('masters'), async (req, res) => {
  try {
    await db.request()
      .input('id',  mssql.Int, parseInt(req.params.id))
      .input('cid', mssql.Int, cid(req))
      .query(`UPDATE fees_master SET is_active=0, modified_on=GETDATE() WHERE fees_code=@id AND college_id=@cid`)
    res.json({ success: true })
  } catch (e) { res.status(500).json({ success: false, message: e.message }) }
})

// ── Classwise Fees ───────────────────────────────────────────

// GET /masters/:collegeId/fees/classwise?faculty_id=&year_level=
router.get('/:collegeId/fees/classwise', async (req, res) => {
  const { faculty_id, year_level } = req.query
  try {
    let q = `
      SELECT cf.*, fm_row.fees_head, fm_row.short_name, fm_row.fees_type,
             fm.degree_course_code
      FROM classwise_fees cf
      JOIN fees_master fm_row ON fm_row.fees_code = cf.fees_code
      JOIN faculty_master fm  ON fm.code_no = cf.faculty_master_id
      WHERE cf.college_id = @cid
    `
    const req2 = db.request().input('cid', mssql.Int, cid(req))
    if (faculty_id) { q += ' AND cf.faculty_master_id=@fid'; req2.input('fid', mssql.Int, parseInt(faculty_id)) }
    if (year_level) { q += ' AND cf.year_level=@yl';         req2.input('yl',  mssql.NVarChar, year_level) }
    q += ' ORDER BY fm_row.sequence_auto_fees'
    const r = await req2.query(q)
    res.json({ success: true, data: r.recordset })
  } catch (e) { res.status(500).json({ success: false, message: e.message }) }
})

// POST /masters/:collegeId/fees/classwise/save — upsert classwise fees
router.post('/:collegeId/fees/classwise/save', requirePerm('masters'), async (req, res) => {
  const { faculty_master_id, year_level, rows } = req.body
  if (!faculty_master_id || !year_level || !Array.isArray(rows))
    return res.status(422).json({ success: false, message: 'faculty_master_id, year_level, rows[] required.' })
  try {
    for (const row of rows) {
      await db.request()
        .input('cid', mssql.Int,     cid(req))
        .input('fid', mssql.Int,     parseInt(faculty_master_id))
        .input('yl',  mssql.NVarChar, year_level)
        .input('fc',  mssql.Int,     parseInt(row.fees_code))
        .input('a1',  mssql.Decimal, row.cat1_amount != null ? parseFloat(row.cat1_amount) : null)
        .input('a2',  mssql.Decimal, row.cat2_amount != null ? parseFloat(row.cat2_amount) : null)
        .input('a3',  mssql.Decimal, row.cat3_amount != null ? parseFloat(row.cat3_amount) : null)
        .input('a4',  mssql.Decimal, row.cat4_amount != null ? parseFloat(row.cat4_amount) : null)
        .query(`
          MERGE classwise_fees AS target
          USING (SELECT @cid AS college_id, @fid AS faculty_master_id, @yl AS year_level, @fc AS fees_code) AS src
          ON target.college_id=src.college_id AND target.faculty_master_id=src.faculty_master_id
             AND target.year_level=src.year_level AND target.fees_code=src.fees_code
          WHEN MATCHED THEN UPDATE SET cat1_amount=@a1,cat2_amount=@a2,cat3_amount=@a3,cat4_amount=@a4
          WHEN NOT MATCHED THEN INSERT
            (college_id,faculty_master_id,year_level,fees_code,cat1_amount,cat2_amount,cat3_amount,cat4_amount)
          VALUES (@cid,@fid,@yl,@fc,@a1,@a2,@a3,@a4);
        `)
    }
    res.json({ success: true })
  } catch (e) { res.status(500).json({ success: false, message: e.message }) }
})

// ═══════════════════════════════════════════════════════════════
// FEE DETERMINATION — compute endpoint
// ═══════════════════════════════════════════════════════════════

/**
 * POST /masters/:collegeId/fees/compute
 * Body: { faculty_master_id, year_level, division_letter, caste, special_status }
 * Returns full fee breakdown + payment mode + slab for the given student context.
 */
router.post('/:collegeId/fees/compute', async (req, res) => {
  const { faculty_master_id, year_level, division_letter, caste, special_status } = req.body
  try {
    const result = await feeSvc.compute({
      collegeId:       cid(req),
      facultyMasterId: faculty_master_id ? parseInt(faculty_master_id) : null,
      yearLevel:       year_level || null,
      divisionLetter:  division_letter || null,
      caste:           caste || null,
      specialStatus:   special_status || null,
      pool:            db,
    })
    res.json({ success: true, data: result })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// ═══════════════════════════════════════════════════════════════
// DOCUMENT TYPES (global list)
// ═══════════════════════════════════════════════════════════════

// GET /masters/document-types — list all global document types
router.get('/document-types', async (req, res) => {
  try {
    const r = await db.request()
      .query('SELECT id, name, description FROM document_types ORDER BY name')
    res.json({ success: true, data: r.recordset })
  } catch (e) { res.status(500).json({ success: false, message: e.message }) }
})

// ═══════════════════════════════════════════════════════════════
// REQUIRED DOCUMENTS MASTER
// ═══════════════════════════════════════════════════════════════

// GET /masters/:collegeId/required-documents?faculty_master_id=&year_of_study=
router.get('/:collegeId/required-documents', async (req, res) => {
  const { faculty_master_id, year_of_study } = req.query
  try {
    let query = `
      SELECT rd.id, rd.faculty_master_id, rd.year_of_study, rd.document_type_id,
             rd.is_mandatory, dt.name AS document_type_name,
             fm.degree_course_code, fm.degree_course_name
      FROM college_required_documents rd
      JOIN document_types dt ON dt.id = rd.document_type_id
      JOIN faculty_master fm ON fm.code_no = rd.faculty_master_id
      WHERE rd.college_id = @cid
    `
    const req2 = db.request().input('cid', mssql.Int, cid(req))
    if (faculty_master_id) {
      query += ' AND rd.faculty_master_id = @fmid'
      req2.input('fmid', mssql.Int, parseInt(faculty_master_id))
    }
    if (year_of_study) {
      query += ' AND rd.year_of_study = @yr'
      req2.input('yr', mssql.Int, parseInt(year_of_study))
    }
    query += ' ORDER BY fm.degree_course_code, rd.year_of_study, dt.name'
    const r = await req2.query(query)
    res.json({ success: true, data: r.recordset })
  } catch (e) { res.status(500).json({ success: false, message: e.message }) }
})

// Maps a Document Type name to the admission year it should accompany.
// Returns null if the type is year-agnostic. Mirrors the UI helper in
// FrontEnd/.../DocumentsMaster.jsx — keep them in sync.
//
// Policy:
//   "Semester 1/2 Marksheet"  → year 2 (SY)
//   "Semester 3/4 Marksheet"  → year 3 (TY)
//   "FY Marksheet"            → year 2 (SY)
//   "SY Marksheet"            → year 3 (TY)
function expectedYearForMarksheet(name) {
  const n = (name || '').toLowerCase()
  const sem = n.match(/semester\s*(\d+)/)
  if (sem && /marksheet|mark\s*sheet|result/.test(n)) {
    const num = parseInt(sem[1])
    if (num === 1 || num === 2) return 2
    if (num === 3 || num === 4) return 3
    return null
  }
  if (/(^|\W)fy\s+marksheet/.test(n) || /first\s+year\s+marksheet/.test(n)) return 2
  if (/(^|\W)sy\s+marksheet/.test(n) || /second\s+year\s+marksheet/.test(n)) return 3
  return null
}

// POST /masters/:collegeId/required-documents — add a required document
router.post('/:collegeId/required-documents', requirePerm('masters'), async (req, res) => {
  const { faculty_master_id, year_of_study, document_type_id, is_mandatory } = req.body
  if (!faculty_master_id || !year_of_study || !document_type_id) {
    return res.status(400).json({ success: false, message: 'faculty_master_id, year_of_study, document_type_id are required.' })
  }
  try {
    // Look up the doc type name to enforce the year/marksheet rule.
    const dtRes = await db.request()
      .input('dtid', mssql.Int, parseInt(document_type_id))
      .query('SELECT name FROM document_types WHERE id = @dtid')
    if (!dtRes.recordset.length) {
      return res.status(404).json({ success: false, message: 'Document type not found.' })
    }
    const dtName = dtRes.recordset[0].name
    const expected = expectedYearForMarksheet(dtName)
    const yr = parseInt(year_of_study)
    if (expected !== null && expected !== yr) {
      const yrLabel = yr === 1 ? 'FY' : yr === 2 ? 'SY' : yr === 3 ? 'TY' : `Year ${yr}`
      return res.status(422).json({
        success: false,
        message: `"${dtName}" cannot be assigned to ${yrLabel} admissions — this marksheet belongs to a different year.`,
      })
    }

    const r = await db.request()
      .input('cid',   mssql.Int,  cid(req))
      .input('fmid',  mssql.Int,  parseInt(faculty_master_id))
      .input('yr',    mssql.Int,  yr)
      .input('dtid',  mssql.Int,  parseInt(document_type_id))
      .input('mand',  mssql.Bit,  is_mandatory !== false ? 1 : 0)
      .query(`
        INSERT INTO college_required_documents
          (college_id, faculty_master_id, year_of_study, document_type_id, is_mandatory)
        OUTPUT INSERTED.id
        VALUES (@cid, @fmid, @yr, @dtid, @mand)
      `)
    res.status(201).json({ success: true, data: { id: r.recordset[0].id } })
  } catch (e) {
    if (e.number === 2627 || e.number === 2601) {
      return res.status(409).json({ success: false, message: 'This document is already in the list.' })
    }
    res.status(500).json({ success: false, message: e.message })
  }
})

// PUT /masters/:collegeId/required-documents/:id — toggle is_mandatory
router.put('/:collegeId/required-documents/:id', requirePerm('masters'), async (req, res) => {
  const { is_mandatory } = req.body
  try {
    await db.request()
      .input('id',   mssql.Int, parseInt(req.params.id))
      .input('cid',  mssql.Int, cid(req))
      .input('mand', mssql.Bit, is_mandatory ? 1 : 0)
      .query('UPDATE college_required_documents SET is_mandatory=@mand WHERE id=@id AND college_id=@cid')
    res.json({ success: true })
  } catch (e) { res.status(500).json({ success: false, message: e.message }) }
})

// DELETE /masters/:collegeId/required-documents/:id
router.delete('/:collegeId/required-documents/:id', requirePerm('masters'), async (req, res) => {
  try {
    await db.request()
      .input('id',  mssql.Int, parseInt(req.params.id))
      .input('cid', mssql.Int, cid(req))
      .query('DELETE FROM college_required_documents WHERE id=@id AND college_id=@cid')
    res.json({ success: true })
  } catch (e) { res.status(500).json({ success: false, message: e.message }) }
})

// ═══════════════════════════════════════════════════════════════
// CLASS MASTER
// ═══════════════════════════════════════════════════════════════

// GET /masters/:collegeId/class — list all, joined with faculty_master
router.get('/:collegeId/class', async (req, res) => {
  try {
    const r = await db.request()
      .input('cid', mssql.Int, cid(req))
      .query(`
        SELECT cm.*, fm.degree_course_code, fm.degree_course_name
        FROM class_master cm
        JOIN faculty_master fm ON fm.code_no = cm.faculty_master_id
        WHERE cm.college_id = @cid
        ORDER BY fm.degree_course_code, cm.year_of_study
      `)
    res.json({ success: true, data: r.recordset })
  } catch (e) { res.status(500).json({ success: false, message: e.message }) }
})

// POST /masters/:collegeId/class — create
router.post('/:collegeId/class', requirePerm('masters'), async (req, res) => {
  const { faculty_master_id, year_of_study, label, is_active = true } = req.body
  if (!faculty_master_id) return res.status(422).json({ success: false, message: 'faculty_master_id is required.' })
  const yr = parseInt(year_of_study)
  // Schema supports 1-5 year programs; the per-program ceiling (duration_years)
  // is enforced below after we look up the selected program.
  if (!yr || yr < 1 || yr > 5)
    return res.status(422).json({ success: false, message: 'year_of_study must be between 1 and 5.' })
  try {
    // Look up the program so we can reject year_of_study that exceeds its duration.
    const prog = await db.request()
      .input('cid', mssql.Int, cid(req))
      .input('fid', mssql.Int, parseInt(faculty_master_id))
      .query(`SELECT duration_years FROM faculty_master WHERE code_no=@fid AND college_id=@cid`)
    if (!prog.recordset.length)
      return res.status(404).json({ success: false, message: 'Program not found for this college.' })
    const duration = parseInt(prog.recordset[0].duration_years) || 3
    if (yr > duration)
      return res.status(422).json({
        success: false,
        message: `Year ${yr} is not valid for this program — its duration is ${duration} year${duration === 1 ? '' : 's'}.`,
      })

    const r = await db.request()
      .input('cid', mssql.Int,      cid(req))
      .input('fid', mssql.Int,      parseInt(faculty_master_id))
      .input('yr',  mssql.TinyInt,  yr)
      .input('lbl', mssql.NVarChar, label?.trim() || null)
      .input('ia',  mssql.Bit,      is_active ? 1 : 0)
      .query(`
        INSERT INTO class_master (college_id, faculty_master_id, year_of_study, label, is_active)
        OUTPUT INSERTED.*
        VALUES (@cid, @fid, @yr, @lbl, @ia)
      `)
    res.status(201).json({ success: true, data: r.recordset[0] })
  } catch (e) {
    if (e.number === 2627 || e.number === 2601)
      return res.status(409).json({ success: false, message: 'This program + year combination already exists.' })
    // SQL Server CHECK constraint violation: surface a helpful hint pointing
    // at the migration that relaxes year_of_study from (1,2,3) to (1..5).
    if (e.number === 547 && /year_of_study/i.test(e.message || ''))
      return res.status(500).json({
        success: false,
        message: 'The database still restricts year_of_study to 1-3. Please ask an administrator to run BackEnd/scripts/migrate_class_master_extended_years.js.',
      })
    res.status(500).json({ success: false, message: e.message })
  }
})

// PUT /masters/:collegeId/class/:id — update label and/or is_active
router.put('/:collegeId/class/:id', requirePerm('masters'), async (req, res) => {
  const { label, is_active } = req.body
  try {
    const r = await db.request()
      .input('id',  mssql.Int,      parseInt(req.params.id))
      .input('cid', mssql.Int,      cid(req))
      .input('lbl', mssql.NVarChar, label?.trim() || null)
      .input('ia',  mssql.Bit,      is_active ? 1 : 0)
      .query(`
        UPDATE class_master SET label=@lbl, is_active=@ia
        OUTPUT INSERTED.*
        WHERE id=@id AND college_id=@cid
      `)
    if (!r.recordset.length) return res.status(404).json({ success: false, message: 'Record not found.' })
    res.json({ success: true, data: r.recordset[0] })
  } catch (e) { res.status(500).json({ success: false, message: e.message }) }
})

// DELETE /masters/:collegeId/class/:id — hard delete
router.delete('/:collegeId/class/:id', requirePerm('masters'), async (req, res) => {
  try {
    await db.request()
      .input('id',  mssql.Int, parseInt(req.params.id))
      .input('cid', mssql.Int, cid(req))
      .query(`DELETE FROM class_master WHERE id=@id AND college_id=@cid`)
    res.json({ success: true })
  } catch (e) { res.status(500).json({ success: false, message: e.message }) }
})

module.exports = router
