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
const { authenticate, requireCollegeAccess, requirePerm, requireWrite } = require('../middleware/auth')
const logger   = require('../config/logger')

// All routes require authentication
router.use(authenticate)

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
  } catch (e) { logger.error({ err: e }, 'get faculty master'); res.status(500).json({ success: false, message: e.message }) }
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
      is_active = true,
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
      .input('cid',   mssql.Int,      cid(req))
      .input('dc',    mssql.NVarChar, degree_course_code.trim().toUpperCase())
      .input('dn',    mssql.NVarChar, degree_course_name.trim())
      .input('dy',    mssql.Int,      yrs)
      .input('ia',    mssql.Bit,      is_active ? 1 : 0)
      .input('actor', mssql.NVarChar, String(req.user.staff_id || req.user.id))
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
      VALUES
        (@cid,@dc,@dn,@dy,${semParams},${yearParams},@ia,@actor);
      SELECT * FROM faculty_master WHERE code_no = SCOPE_IDENTITY();
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
      is_active,
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
      .input('id',    mssql.Int,      parseInt(req.params.id))
      .input('cid',   mssql.Int,      cid(req))
      .input('dc',    mssql.NVarChar, degree_course_code.trim().toUpperCase())
      .input('dn',    mssql.NVarChar, degree_course_name.trim())
      .input('dy',    mssql.Int,      yrs)
      .input('ia',    mssql.Bit,      is_active ? 1 : 0)
      .input('actor', mssql.NVarChar, String(req.user.staff_id || req.user.id))
    cols.sems.forEach((_,  i) => reqQ.input(`s${i + 1}`, mssql.NVarChar, semVals[i]))
    cols.years.forEach((_, i) => reqQ.input(`e${i + 1}`, mssql.NVarChar, yearVals[i]))

    const semSet  = cols.sems.map((c, i)  => `${c}=@s${i + 1}`).join(',')
    const yearSet = cols.years.map((c, i) => `${c}=@e${i + 1}`).join(',')

    const r = await reqQ.query(`
      UPDATE faculty_master SET
        degree_course_code=@dc, degree_course_name=@dn, duration_years=@dy,
        ${semSet},
        ${yearSet},
        is_active=@ia, modified_by=@actor, modified_on=GETDATE()
      WHERE code_no=@id AND college_id=@cid;
      SELECT * FROM faculty_master WHERE code_no=@id AND college_id=@cid;
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
  } catch (e) { logger.error({ err: e }, 'delete faculty master'); res.status(500).json({ success: false, message: e.message }) }
})

// ═══════════════════════════════════════════════════════════════
// BANK MASTER
// ═══════════════════════════════════════════════════════════════

router.get('/:collegeId/bank', requireCollegeAccess, async (req, res) => {
  try {
    const r = await db.request()
      .input('cid', mssql.Int, cid(req))
      .query(`SELECT * FROM bank_master WHERE college_id=@cid ORDER BY bank_name`)
    res.json({ success: true, data: r.recordset })
  } catch (e) { logger.error({ err: e }, 'get bank master'); res.status(500).json({ success: false, message: e.message }) }
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
      .input('cid',   mssql.Int,      cid(req))
      .input('an',    mssql.NVarChar, bank_account_number.trim())
      .input('bn',    mssql.NVarChar, bank_name.trim())
      .input('br',    mssql.NVarChar, branch || null)
      .input('if',    mssql.NVarChar, ifsc_code || null)
      .input('at',    mssql.NVarChar, account_type || null)
      .input('ia',    mssql.Bit,      is_active ? 1 : 0)
      .input('actor', mssql.NVarChar, String(req.user.staff_id || req.user.id))
      .query(`
        INSERT INTO bank_master (college_id,bank_account_number,bank_name,branch,ifsc_code,account_type,is_active,created_by)
        VALUES (@cid,@an,@bn,@br,@if,@at,@ia,@actor);
        SELECT * FROM bank_master WHERE ledger_code = SCOPE_IDENTITY();
      `)
    res.status(201).json({ success: true, data: r.recordset[0] })
  } catch (e) { logger.error({ err: e }, 'create bank master'); res.status(500).json({ success: false, message: e.message }) }
})

router.put('/:collegeId/bank/:id', requirePerm('masters'), async (req, res) => {
  const { bank_account_number, bank_name, branch, ifsc_code, account_type, is_active } = req.body
  try {
    const r = await db.request()
      .input('id',    mssql.Int,      parseInt(req.params.id))
      .input('cid',   mssql.Int,      cid(req))
      .input('an',    mssql.NVarChar, bank_account_number?.trim())
      .input('bn',    mssql.NVarChar, bank_name?.trim())
      .input('br',    mssql.NVarChar, branch || null)
      .input('if',    mssql.NVarChar, ifsc_code || null)
      .input('at',    mssql.NVarChar, account_type || null)
      .input('ia',    mssql.Bit,      is_active ? 1 : 0)
      .input('actor', mssql.NVarChar, String(req.user.staff_id || req.user.id))
      .query(`
        UPDATE bank_master SET
          bank_account_number=@an, bank_name=@bn, branch=@br,
          ifsc_code=@if, account_type=@at, is_active=@ia, updated_by=@actor, modified_on=GETDATE()
        WHERE ledger_code=@id AND college_id=@cid;
        SELECT * FROM bank_master WHERE ledger_code=@id AND college_id=@cid;
      `)
    if (!r.recordset.length) return res.status(404).json({ success: false, message: 'Record not found.' })
    res.json({ success: true, data: r.recordset[0] })
  } catch (e) { logger.error({ err: e }, 'update bank master'); res.status(500).json({ success: false, message: e.message }) }
})

router.delete('/:collegeId/bank/:id', requirePerm('masters'), async (req, res) => {
  try {
    await db.request()
      .input('id',  mssql.Int, parseInt(req.params.id))
      .input('cid', mssql.Int, cid(req))
      .query(`UPDATE bank_master SET is_active=0, modified_on=GETDATE() WHERE ledger_code=@id AND college_id=@cid`)
    res.json({ success: true })
  } catch (e) { logger.error({ err: e }, 'delete bank master'); res.status(500).json({ success: false, message: e.message }) }
})

// ═══════════════════════════════════════════════════════════════
// COURSE MASTER (subjects per semester)
// ═══════════════════════════════════════════════════════════════

// GET /masters/:collegeId/course?faculty_id=&semester=
router.get('/:collegeId/course', requireCollegeAccess, async (req, res) => {
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
  } catch (e) { logger.error({ err: e }, 'get course master'); res.status(500).json({ success: false, message: e.message }) }
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
      .input('cid',   mssql.Int,      cid(req))
      .input('fid',   mssql.Int,      parseInt(faculty_master_id))
      .input('sem',   mssql.Int,      parseInt(semester))
      .input('cc',    mssql.NVarChar, course_code.trim())
      .input('ct',    mssql.NVarChar, course_title.trim())
      .input('cr',    mssql.Decimal,  credits != null ? parseFloat(credits) : null)
      .input('mi',    mssql.Int,      max_internal != null ? parseInt(max_internal) : null)
      .input('ni',    mssql.Int,      min_internal != null ? parseInt(min_internal) : null)
      .input('ms',    mssql.Int,      max_sem_end  != null ? parseInt(max_sem_end)  : null)
      .input('ns',    mssql.Int,      min_sem_end  != null ? parseInt(min_sem_end)  : null)
      .input('mt',    mssql.Int,      max_total    != null ? parseInt(max_total)    : null)
      .input('nt',    mssql.Int,      min_total    != null ? parseInt(min_total)    : null)
      .input('st',    mssql.NVarChar, subject_type || null)
      .input('do',    mssql.Int,      parseInt(display_order) || 0)
      .input('actor', mssql.NVarChar, String(req.user.staff_id || req.user.id))
      .query(`
        INSERT INTO course_master
          (college_id,faculty_master_id,semester,course_code,course_title,
           credits,max_internal,min_internal,max_sem_end,min_sem_end,
           max_total,min_total,subject_type,display_order,created_by)
        VALUES (@cid,@fid,@sem,@cc,@ct,@cr,@mi,@ni,@ms,@ns,@mt,@nt,@st,@do,@actor);
        SELECT * FROM course_master WHERE id = SCOPE_IDENTITY();
      `)
    res.status(201).json({ success: true, data: r.recordset[0] })
  } catch (e) {
    if (e.number === 2627 || e.number === 2601)
      return res.status(409).json({ success: false, message: 'Course code already exists for this program-semester.' })
    logger.error({ err: e }, 'create course master')
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
      .input('id',    mssql.Int,      parseInt(req.params.id))
      .input('cid',   mssql.Int,      cid(req))
      .input('fid',   mssql.Int,      parseInt(faculty_master_id))
      .input('sem',   mssql.Int,      parseInt(semester))
      .input('cc',    mssql.NVarChar, course_code?.trim())
      .input('ct',    mssql.NVarChar, course_title?.trim())
      .input('cr',    mssql.Decimal,  credits != null ? parseFloat(credits) : null)
      .input('mi',    mssql.Int,      max_internal != null ? parseInt(max_internal) : null)
      .input('ni',    mssql.Int,      min_internal != null ? parseInt(min_internal) : null)
      .input('ms',    mssql.Int,      max_sem_end  != null ? parseInt(max_sem_end)  : null)
      .input('ns',    mssql.Int,      min_sem_end  != null ? parseInt(min_sem_end)  : null)
      .input('mt',    mssql.Int,      max_total    != null ? parseInt(max_total)    : null)
      .input('nt',    mssql.Int,      min_total    != null ? parseInt(min_total)    : null)
      .input('st',    mssql.NVarChar, subject_type || null)
      .input('do',    mssql.Int,      parseInt(display_order) || 0)
      .input('ia',    mssql.Bit,      is_active ? 1 : 0)
      .input('actor', mssql.NVarChar, String(req.user.staff_id || req.user.id))
      .query(`
        UPDATE course_master SET
          faculty_master_id=@fid, semester=@sem, course_code=@cc, course_title=@ct,
          credits=@cr, max_internal=@mi, min_internal=@ni, max_sem_end=@ms, min_sem_end=@ns,
          max_total=@mt, min_total=@nt, subject_type=@st, display_order=@do,
          is_active=@ia, updated_by=@actor, modified_on=GETDATE()
        WHERE id=@id AND college_id=@cid;
        SELECT * FROM course_master WHERE id=@id AND college_id=@cid;
      `)
    if (!r.recordset.length) return res.status(404).json({ success: false, message: 'Record not found.' })
    res.json({ success: true, data: r.recordset[0] })
  } catch (e) {
    if (e.number === 2627 || e.number === 2601)
      return res.status(409).json({ success: false, message: 'Course code already exists for this program-semester.' })
    logger.error({ err: e }, 'update course master')
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
  } catch (e) { logger.error({ err: e }, 'delete course master'); res.status(500).json({ success: false, message: e.message }) }
})

// POST /masters/:collegeId/course/bulk-save — insert new rows only (no upsert)
router.post('/:collegeId/course/bulk-save', requirePerm('masters'), async (req, res) => {
  const { faculty_master_id, semester, rows } = req.body
  if (!faculty_master_id || !semester || !Array.isArray(rows))
    return res.status(422).json({ success: false, message: 'faculty_master_id, semester, rows[] required.' })

  const validRows = rows.filter(r => r.course_code?.trim() && r.course_title?.trim())
  if (!validRows.length) return res.json({ success: true, message: 'Saved.' })

  const actor = String(req.user.staff_id || req.user.id)
  try {
    for (const row of validRows) {
      await db.request()
        .input('cid',   mssql.Int,      cid(req))
        .input('fid',   mssql.Int,      parseInt(faculty_master_id))
        .input('sem',   mssql.Int,      parseInt(semester))
        .input('cc',    mssql.NVarChar, row.course_code.trim())
        .input('ct',    mssql.NVarChar, row.course_title.trim())
        .input('cr',    mssql.Decimal,  row.credits != null ? parseFloat(row.credits) : null)
        .input('mi',    mssql.Int,      row.max_internal != null ? parseInt(row.max_internal) : null)
        .input('ni',    mssql.Int,      row.min_internal != null ? parseInt(row.min_internal) : null)
        .input('ms',    mssql.Int,      row.max_sem_end  != null ? parseInt(row.max_sem_end)  : null)
        .input('ns',    mssql.Int,      row.min_sem_end  != null ? parseInt(row.min_sem_end)  : null)
        .input('mt',    mssql.Int,      row.max_total    != null ? parseInt(row.max_total)    : null)
        .input('nt',    mssql.Int,      row.min_total    != null ? parseInt(row.min_total)    : null)
        .input('st',    mssql.NVarChar, row.subject_type || null)
        .input('do',    mssql.Int,      parseInt(row.display_order) || 0)
        .input('actor', mssql.NVarChar, actor)
        .query(`
          INSERT INTO course_master
            (college_id,faculty_master_id,semester,course_code,course_title,credits,
             max_internal,min_internal,max_sem_end,min_sem_end,max_total,min_total,subject_type,display_order,created_by)
          VALUES (@cid,@fid,@sem,@cc,@ct,@cr,@mi,@ni,@ms,@ns,@mt,@nt,@st,@do,@actor)
        `)
    }
    res.json({ success: true, message: 'Saved.' })
  } catch (e) {
    if (e.number === 2627 || e.number === 2601) {
      const match = e.message.match(/\(([^)]+)\)$/)
      const code  = match ? match[1].split(',').map(s => s.trim())[3] : null
      const msg   = code
        ? `Subject code "${code}" already exists in this program and semester.`
        : 'One or more subject codes already exist in this program and semester.'
      return res.status(409).json({ success: false, message: msg })
    }
    logger.error({ err: e }, 'bulk save course master')
    res.status(500).json({ success: false, message: e.message })
  }
})

// ═══════════════════════════════════════════════════════════════
// GROUP MASTER
// ═══════════════════════════════════════════════════════════════

router.get('/:collegeId/group', requireCollegeAccess, async (req, res) => {
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
  } catch (e) { logger.error({ err: e }, 'get group master'); res.status(500).json({ success: false, message: e.message }) }
})

router.get('/:collegeId/group/:id', requireCollegeAccess, async (req, res) => {
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
  } catch (e) { logger.error({ err: e }, 'get group master by id'); res.status(500).json({ success: false, message: e.message }) }
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
      .input('cid',   mssql.Int,      cid(req))
      .input('fid',   mssql.Int,      parseInt(faculty_master_id))
      .input('sem',   mssql.Int,      parseInt(semester))
      .input('gc',    mssql.NVarChar, group_code.trim())
      .input('gd',    mssql.NVarChar, group_description.trim())
      .input('ia',    mssql.Bit,      is_active ? 1 : 0)
      .input('actor', mssql.NVarChar, String(req.user.staff_id || req.user.id))
      .query(`
        INSERT INTO group_master (college_id,faculty_master_id,semester,group_code,group_description,is_active,created_by)
        VALUES (@cid,@fid,@sem,@gc,@gd,@ia,@actor);
        SELECT * FROM group_master WHERE id = SCOPE_IDENTITY();
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
    logger.error({ err: e }, 'create group master')
    res.status(500).json({ success: false, message: e.message })
  }
})

router.put('/:collegeId/group/:id', requirePerm('masters'), async (req, res) => {
  const { faculty_master_id, semester, group_code, group_description, is_active, courses = [] } = req.body
  const dup = findDuplicateCourseCombo(courses)
  if (dup) return res.status(422).json({ success: false, message: `Selected Course Code and Course Title combination already exists (slots ${dup.firstPos} and ${dup.dupPos}).` })
  try {
    const r = await db.request()
      .input('id',    mssql.Int,      parseInt(req.params.id))
      .input('cid',   mssql.Int,      cid(req))
      .input('fid',   mssql.Int,      parseInt(faculty_master_id))
      .input('sem',   mssql.Int,      parseInt(semester))
      .input('gc',    mssql.NVarChar, group_code?.trim())
      .input('gd',    mssql.NVarChar, group_description?.trim())
      .input('ia',    mssql.Bit,      is_active ? 1 : 0)
      .input('actor', mssql.NVarChar, String(req.user.staff_id || req.user.id))
      .query(`
        UPDATE group_master SET
          faculty_master_id=@fid, semester=@sem, group_code=@gc,
          group_description=@gd, is_active=@ia, updated_by=@actor, modified_on=GETDATE()
        WHERE id=@id AND college_id=@cid;
        SELECT * FROM group_master WHERE id=@id AND college_id=@cid;
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
    logger.error({ err: e }, 'update group master')
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
  } catch (e) { logger.error({ err: e }, 'delete group master'); res.status(500).json({ success: false, message: e.message }) }
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
  } catch (e) { logger.error({ err: e }, 'get division master'); res.status(500).json({ success: false, message: e.message }) }
})

// POST /masters/:collegeId/division/save-grid — save entire A-J grid for one class-year
// Body: { faculty_master_id, year_level, class_year_code, divisions: [{letter, funding_type},...] }
router.post('/:collegeId/division/save-grid', requirePerm('masters'), async (req, res) => {
  const { faculty_master_id, year_level, class_year_code, divisions } = req.body
  if (!faculty_master_id || !year_level || !Array.isArray(divisions))
    return res.status(422).json({ success: false, message: 'faculty_master_id, year_level, divisions[] required.' })
  const actor = String(req.user.staff_id || req.user.id)
  try {
    for (const d of divisions) {
      if (!d.division_letter || !d.funding_type) continue
      await db.request()
        .input('cid',   mssql.Int,      cid(req))
        .input('fid',   mssql.Int,      parseInt(faculty_master_id))
        .input('yl',    mssql.NVarChar, year_level)
        .input('cyc',   mssql.NVarChar, class_year_code || '')
        .input('dl',    mssql.Char,     d.division_letter)
        .input('ft',    mssql.NVarChar, d.funding_type)
        .input('ia',    mssql.Bit,      d.is_active !== false ? 1 : 0)
        .input('actor', mssql.NVarChar, actor)
        .query(`
          MERGE division_master AS target
          USING (SELECT @cid AS college_id, @fid AS faculty_master_id, @yl AS year_level, @dl AS division_letter) AS src
          ON target.college_id=src.college_id AND target.faculty_master_id=src.faculty_master_id
             AND target.year_level=src.year_level AND target.division_letter=src.division_letter
          WHEN MATCHED THEN UPDATE SET funding_type=@ft, class_year_code=@cyc, is_active=@ia, updated_by=@actor, modified_on=GETDATE()
          WHEN NOT MATCHED THEN INSERT
            (college_id,faculty_master_id,year_level,class_year_code,division_letter,funding_type,is_active,created_by)
          VALUES (@cid,@fid,@yl,@cyc,@dl,@ft,@ia,@actor);
        `)
    }
    res.json({ success: true })
  } catch (e) { logger.error({ err: e }, 'save division grid'); res.status(500).json({ success: false, message: e.message }) }
})

router.delete('/:collegeId/division/:id', requirePerm('masters'), async (req, res) => {
  try {
    await db.request()
      .input('id',  mssql.Int, parseInt(req.params.id))
      .input('cid', mssql.Int, cid(req))
      .query(`UPDATE division_master SET is_active=0, modified_on=GETDATE() WHERE id=@id AND college_id=@cid`)
    res.json({ success: true })
  } catch (e) { logger.error({ err: e }, 'delete division master'); res.status(500).json({ success: false, message: e.message }) }
})

// ═══════════════════════════════════════════════════════════════
// FEES MASTER
// ═══════════════════════════════════════════════════════════════

router.get('/:collegeId/fees', requireCollegeAccess, async (req, res) => {
  const { academic_year } = req.query
  try {
    const req2 = db.request().input('cid', mssql.Int, cid(req))
    let q = `
      SELECT fm.*, bm.bank_name, bm.bank_account_number
      FROM fees_master fm
      LEFT JOIN bank_master bm ON bm.ledger_code = fm.credit_to_bank_ledger
      WHERE fm.college_id = @cid
    `
    if (academic_year) { q += ' AND fm.academic_year=@ay'; req2.input('ay', mssql.NVarChar, academic_year) }
    q += ' ORDER BY fm.sequence_auto_fees, fm.fees_code'
    const r = await req2.query(q)
    res.json({ success: true, data: r.recordset })
  } catch (e) { logger.error({ err: e }, 'get fees master'); res.status(500).json({ success: false, message: e.message }) }
})

router.post('/:collegeId/fees', requirePerm('masters'), async (req, res) => {
  const {
    fees_type, is_other_misc = false, fees_head, short_name,
    sequence_auto_fees = 0, credit_to_bank_ledger,
    is_refundable = false,
    fees_cat1_amount = 0, fees_cat2_amount = 0,
    fees_cat3_amount = 0, fees_cat4_amount = 0,
    cat4_description, is_active = true, academic_year,
  } = req.body
  if (!fees_type)          return res.status(422).json({ success: false, message: 'fees_type required.' })
  if (!fees_head?.trim())  return res.status(422).json({ success: false, message: 'fees_head required.' })
  if (!short_name?.trim()) return res.status(422).json({ success: false, message: 'short_name required.' })
  if (!academic_year)      return res.status(422).json({ success: false, message: 'academic_year required.' })
  try {
    const r = await db.request()
      .input('cid',   mssql.Int,      cid(req))
      .input('ft',    mssql.NVarChar, fees_type)
      .input('iom',   mssql.Bit,      is_other_misc ? 1 : 0)
      .input('fh',    mssql.NVarChar, fees_head.trim())
      .input('sn',    mssql.NVarChar, short_name.trim())
      .input('seq',   mssql.Int,      parseInt(sequence_auto_fees) || 0)
      .input('ctb',   mssql.Int,      credit_to_bank_ledger ? parseInt(credit_to_bank_ledger) : null)
      .input('ir',    mssql.Bit,      is_refundable ? 1 : 0)
      .input('a1',    mssql.Decimal,  parseFloat(fees_cat1_amount) || 0)
      .input('a2',    mssql.Decimal,  parseFloat(fees_cat2_amount) || 0)
      .input('a3',    mssql.Decimal,  parseFloat(fees_cat3_amount) || 0)
      .input('a4',    mssql.Decimal,  parseFloat(fees_cat4_amount) || 0)
      .input('c4',    mssql.NVarChar, cat4_description || null)
      .input('ia',    mssql.Bit,      is_active ? 1 : 0)
      .input('ay',    mssql.NVarChar, academic_year)
      .input('actor', mssql.NVarChar, String(req.user.staff_id || req.user.id))
      .query(`
        INSERT INTO fees_master
          (college_id,fees_type,is_other_misc,fees_head,short_name,sequence_auto_fees,
           credit_to_bank_ledger,is_refundable,fees_cat1_amount,fees_cat2_amount,
           fees_cat3_amount,fees_cat4_amount,cat4_description,is_active,academic_year,created_by)
        VALUES (@cid,@ft,@iom,@fh,@sn,@seq,@ctb,@ir,@a1,@a2,@a3,@a4,@c4,@ia,@ay,@actor);
        SELECT * FROM fees_master WHERE fees_code = SCOPE_IDENTITY();
      `)
    res.status(201).json({ success: true, data: r.recordset[0] })
  } catch (e) { logger.error({ err: e }, 'create fees master'); res.status(500).json({ success: false, message: e.message }) }
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
      .input('id',    mssql.Int,      parseInt(req.params.id))
      .input('cid',   mssql.Int,      cid(req))
      .input('ft',    mssql.NVarChar, fees_type)
      .input('iom',   mssql.Bit,      is_other_misc ? 1 : 0)
      .input('fh',    mssql.NVarChar, fees_head?.trim())
      .input('sn',    mssql.NVarChar, short_name?.trim())
      .input('seq',   mssql.Int,      parseInt(sequence_auto_fees) || 0)
      .input('ctb',   mssql.Int,      credit_to_bank_ledger ? parseInt(credit_to_bank_ledger) : null)
      .input('ir',    mssql.Bit,      is_refundable ? 1 : 0)
      .input('a1',    mssql.Decimal,  parseFloat(fees_cat1_amount) || 0)
      .input('a2',    mssql.Decimal,  parseFloat(fees_cat2_amount) || 0)
      .input('a3',    mssql.Decimal,  parseFloat(fees_cat3_amount) || 0)
      .input('a4',    mssql.Decimal,  parseFloat(fees_cat4_amount) || 0)
      .input('c4',    mssql.NVarChar, cat4_description || null)
      .input('ia',    mssql.Bit,      is_active ? 1 : 0)
      .input('actor', mssql.NVarChar, String(req.user.staff_id || req.user.id))
      .query(`
        UPDATE fees_master SET
          fees_type=@ft, is_other_misc=@iom, fees_head=@fh, short_name=@sn,
          sequence_auto_fees=@seq, credit_to_bank_ledger=@ctb, is_refundable=@ir,
          fees_cat1_amount=@a1, fees_cat2_amount=@a2, fees_cat3_amount=@a3,
          fees_cat4_amount=@a4, cat4_description=@c4, is_active=@ia, updated_by=@actor, modified_on=GETDATE()
        WHERE fees_code=@id AND college_id=@cid;
        SELECT * FROM fees_master WHERE fees_code=@id AND college_id=@cid;
      `)
    if (!r.recordset.length) return res.status(404).json({ success: false, message: 'Record not found.' })
    res.json({ success: true, data: r.recordset[0] })
  } catch (e) { logger.error({ err: e }, 'update fees master'); res.status(500).json({ success: false, message: e.message }) }
})

// ── Classwise Fees ───────────────────────────────────────────
// NOTE: These specific routes MUST be registered before /:collegeId/fees/:id
// to prevent Express from matching 'classwise' as the :id parameter.

// GET /masters/:collegeId/fees/classwise?faculty_id=&year_level=&student_type=&academic_year=
router.get('/:collegeId/fees/classwise', requireCollegeAccess, async (req, res) => {
  const { faculty_id, year_level, student_type, academic_year } = req.query
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
    if (faculty_id)    { q += ' AND cf.faculty_master_id=@fid'; req2.input('fid', mssql.Int,      parseInt(faculty_id)) }
    if (year_level)    { q += ' AND cf.year_level=@yl';         req2.input('yl',  mssql.NVarChar, year_level) }
    if (student_type)  { q += ' AND cf.student_type=@st';       req2.input('st',  mssql.NVarChar, student_type) }
    if (academic_year) { q += ' AND cf.academic_year=@ay';      req2.input('ay',  mssql.NVarChar, academic_year) }
    q += ' ORDER BY fm_row.sequence_auto_fees'
    const r = await req2.query(q)
    res.json({ success: true, data: r.recordset })
  } catch (e) { logger.error({ err: e }, 'get classwise fees'); res.status(500).json({ success: false, message: e.message }) }
})

// DELETE /masters/:collegeId/fees/classwise — remove a specific classwise override row
router.delete('/:collegeId/fees/classwise', requirePerm('masters'), async (req, res) => {
  const { faculty_master_id, year_level, student_type, fees_code, academic_year } = req.body
  if (!faculty_master_id || !year_level || !student_type || !fees_code || !academic_year)
    return res.status(422).json({ success: false, message: 'faculty_master_id, year_level, student_type, fees_code, academic_year required.' })
  try {
    const result = await db.request()
      .input('cid', mssql.Int,      cid(req))
      .input('fid', mssql.Int,      parseInt(faculty_master_id))
      .input('yl',  mssql.NVarChar, year_level)
      .input('st',  mssql.NVarChar, student_type)
      .input('fc',  mssql.Int,      parseInt(fees_code))
      .input('ay',  mssql.NVarChar, academic_year)
      .query(`
        DELETE FROM classwise_fees
        WHERE college_id=@cid AND faculty_master_id=@fid
          AND year_level=@yl AND student_type=@st AND fees_code=@fc AND academic_year=@ay
      `)
    res.json({ success: true, rowsAffected: result.rowsAffected })
  } catch (e) { logger.error({ err: e }, 'delete classwise fee'); res.status(500).json({ success: false, message: e.message }) }
})

router.delete('/:collegeId/fees/:id', requirePerm('masters'), async (req, res) => {
  try {
    await db.request()
      .input('id',  mssql.Int, parseInt(req.params.id))
      .input('cid', mssql.Int, cid(req))
      .query(`UPDATE fees_master SET is_active=0, modified_on=GETDATE() WHERE fees_code=@id AND college_id=@cid`)
    res.json({ success: true })
  } catch (e) { logger.error({ err: e }, 'delete fees master'); res.status(500).json({ success: false, message: e.message }) }
})

// POST /masters/:collegeId/fees/classwise/save — upsert classwise fees
router.post('/:collegeId/fees/classwise/save', requirePerm('masters'), async (req, res) => {
  const { faculty_master_id, year_level, student_type, academic_year, rows } = req.body
  const VALID_STUDENT_TYPES = ['Grand', 'NonGrand', 'Outsider']
  if (!faculty_master_id || !year_level || !student_type || !academic_year || !Array.isArray(rows))
    return res.status(422).json({ success: false, message: 'faculty_master_id, year_level, student_type, academic_year, rows[] required.' })
  if (!VALID_STUDENT_TYPES.includes(student_type))
    return res.status(422).json({ success: false, message: `student_type must be one of: ${VALID_STUDENT_TYPES.join(', ')}` })
  const actor = String(req.user.staff_id || req.user.id)
  try {
    for (const row of rows) {
      await db.request()
        .input('cid',   mssql.Int,      cid(req))
        .input('fid',   mssql.Int,      parseInt(faculty_master_id))
        .input('yl',    mssql.NVarChar, year_level)
        .input('st',    mssql.NVarChar, student_type)
        .input('ay',    mssql.NVarChar, academic_year)
        .input('fc',    mssql.Int,      parseInt(row.fees_code))
        .input('a1',    mssql.Decimal,  row.cat1_amount != null ? parseFloat(row.cat1_amount) : null)
        .input('a2',    mssql.Decimal,  row.cat2_amount != null ? parseFloat(row.cat2_amount) : null)
        .input('a3',    mssql.Decimal,  row.cat3_amount != null ? parseFloat(row.cat3_amount) : null)
        .input('a4',    mssql.Decimal,  row.cat4_amount != null ? parseFloat(row.cat4_amount) : null)
        .input('a5',    mssql.Decimal,  row.cat5_amount != null ? parseFloat(row.cat5_amount) : null)
        .input('a6',    mssql.Decimal,  row.cat6_amount != null ? parseFloat(row.cat6_amount) : null)
        .input('a7',    mssql.Decimal,  row.cat7_amount != null ? parseFloat(row.cat7_amount) : null)
        .input('a8',    mssql.Decimal,  row.cat8_amount != null ? parseFloat(row.cat8_amount) : null)
        .input('actor', mssql.NVarChar, actor)
        .query(`
          MERGE classwise_fees AS target
          USING (SELECT @cid AS college_id, @fid AS faculty_master_id, @yl AS year_level,
                        @fc AS fees_code, @st AS student_type, @ay AS academic_year) AS src
          ON target.college_id=src.college_id AND target.faculty_master_id=src.faculty_master_id
             AND target.year_level=src.year_level AND target.fees_code=src.fees_code
             AND target.student_type=src.student_type AND target.academic_year=src.academic_year
          WHEN MATCHED THEN UPDATE SET
            cat1_amount=@a1,cat2_amount=@a2,cat3_amount=@a3,cat4_amount=@a4,
            cat5_amount=@a5,cat6_amount=@a6,cat7_amount=@a7,cat8_amount=@a8,
            updated_by=@actor
          WHEN NOT MATCHED THEN INSERT
            (college_id,faculty_master_id,year_level,fees_code,student_type,academic_year,
             cat1_amount,cat2_amount,cat3_amount,cat4_amount,cat5_amount,cat6_amount,cat7_amount,cat8_amount,created_by)
          VALUES (@cid,@fid,@yl,@fc,@st,@ay,@a1,@a2,@a3,@a4,@a5,@a6,@a7,@a8,@actor);
        `)
    }
    res.json({ success: true })
  } catch (e) { logger.error({ err: e }, 'save classwise fees'); res.status(500).json({ success: false, message: e.message }) }
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
  const { faculty_master_id, year_level, division_letter, caste, special_status, student_type, academic_year } = req.body
  try {
    const result = await feeSvc.compute({
      collegeId:       cid(req),
      facultyMasterId: faculty_master_id ? parseInt(faculty_master_id) : null,
      yearLevel:       year_level || null,
      divisionLetter:  division_letter || null,
      caste:           caste || null,
      specialStatus:   special_status || null,
      studentType:     student_type || 'Grand',
      academicYear:    academic_year || null,
      pool:            db,
    })
    res.json({ success: true, data: result })
  } catch (e) {
    logger.error({ err: e }, 'compute fees')
    res.status(500).json({ success: false, message: e.message })
  }
})

// GET /masters/:collegeId/fees/configured?faculty_master_id=&year_level=&academic_year=
// Returns whether fee heads are configured for a specific program+year+academic_year.
// Used by AdmissionPeriods to block opening admission if fees are not set up.
router.get('/:collegeId/fees/configured', requireCollegeAccess, async (req, res) => {
  const { faculty_master_id, year_level, academic_year } = req.query
  if (!faculty_master_id || !year_level || !academic_year)
    return res.status(422).json({ success: false, message: 'faculty_master_id, year_level, academic_year required.' })
  try {
    // Fees are "configured" if there is at least one active fee head for this academic_year
    // AND at least one classwise_fees row for this program+year_level+academic_year
    const headsRes = await db.request()
      .input('cid', mssql.Int,      cid(req))
      .input('ay',  mssql.NVarChar, academic_year)
      .query(`
        SELECT COUNT(*) AS head_count
        FROM fees_master
        WHERE college_id=@cid AND is_active=1 AND academic_year=@ay
      `)
    const cwRes = await db.request()
      .input('cid', mssql.Int,      cid(req))
      .input('fid', mssql.Int,      parseInt(faculty_master_id))
      .input('yl',  mssql.NVarChar, year_level)
      .input('ay',  mssql.NVarChar, academic_year)
      .query(`
        SELECT COUNT(*) AS cw_count
        FROM classwise_fees
        WHERE college_id=@cid AND faculty_master_id=@fid
          AND year_level=@yl AND academic_year=@ay
      `)
    const headCount = headsRes.recordset[0].head_count
    const cwCount   = cwRes.recordset[0].cw_count
    res.json({
      success: true,
      data: {
        configured:  headCount > 0 && cwCount > 0,
        head_count:  headCount,
        cw_count:    cwCount,
      }
    })
  } catch (e) {
    logger.error({ err: e }, 'fees configured check')
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
  } catch (e) { logger.error({ err: e }, 'get document types'); res.status(500).json({ success: false, message: e.message }) }
})

// ═══════════════════════════════════════════════════════════════
// REQUIRED DOCUMENTS MASTER
// ═══════════════════════════════════════════════════════════════

// GET /masters/:collegeId/required-documents?faculty_master_id=&year_of_study=
router.get('/:collegeId/required-documents', requireCollegeAccess, async (req, res) => {
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
  } catch (e) { logger.error({ err: e }, 'get required documents'); res.status(500).json({ success: false, message: e.message }) }
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
      .input('cid',   mssql.Int,      cid(req))
      .input('fmid',  mssql.Int,      parseInt(faculty_master_id))
      .input('yr',    mssql.Int,      yr)
      .input('dtid',  mssql.Int,      parseInt(document_type_id))
      .input('mand',  mssql.Bit,      is_mandatory !== false ? 1 : 0)
      .input('actor', mssql.NVarChar, String(req.user.staff_id || req.user.id))
      .query(`
        DECLARE @t TABLE (id INT);
        INSERT INTO college_required_documents
          (college_id, faculty_master_id, year_of_study, document_type_id, is_mandatory, created_by)
        OUTPUT INSERTED.id INTO @t
        VALUES (@cid, @fmid, @yr, @dtid, @mand, @actor);
        SELECT id FROM @t;
      `)
    res.status(201).json({ success: true, data: { id: r.recordset[0].id } })
  } catch (e) {
    if (e.number === 2627 || e.number === 2601) {
      return res.status(409).json({ success: false, message: 'This document is already in the list.' })
    }
    logger.error({ err: e }, 'add required document')
    res.status(500).json({ success: false, message: e.message })
  }
})

// PUT /masters/:collegeId/required-documents/:id — toggle is_mandatory
router.put('/:collegeId/required-documents/:id', requirePerm('masters'), async (req, res) => {
  const { is_mandatory } = req.body
  try {
    await db.request()
      .input('id',    mssql.Int,      parseInt(req.params.id))
      .input('cid',   mssql.Int,      cid(req))
      .input('mand',  mssql.Bit,      is_mandatory ? 1 : 0)
      .input('actor', mssql.NVarChar, String(req.user.staff_id || req.user.id))
      .query('UPDATE college_required_documents SET is_mandatory=@mand, updated_by=@actor WHERE id=@id AND college_id=@cid')
    res.json({ success: true })
  } catch (e) { logger.error({ err: e }, 'update required document'); res.status(500).json({ success: false, message: e.message }) }
})

// DELETE /masters/:collegeId/required-documents/:id
router.delete('/:collegeId/required-documents/:id', requirePerm('masters'), async (req, res) => {
  try {
    await db.request()
      .input('id',  mssql.Int, parseInt(req.params.id))
      .input('cid', mssql.Int, cid(req))
      .query('DELETE FROM college_required_documents WHERE id=@id AND college_id=@cid')
    res.json({ success: true })
  } catch (e) { logger.error({ err: e }, 'delete required document'); res.status(500).json({ success: false, message: e.message }) }
})

// ═══════════════════════════════════════════════════════════════
// CLASS MASTER
// ═══════════════════════════════════════════════════════════════

// GET /masters/:collegeId/class — list all, joined with faculty_master
router.get('/:collegeId/class', requireCollegeAccess, async (req, res) => {
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
  } catch (e) { logger.error({ err: e }, 'get class master'); res.status(500).json({ success: false, message: e.message }) }
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
    if (e.number === 547 && /year_of_study/i.test(e.message || '')) {
      logger.error({ err: e }, 'create class master')
      return res.status(500).json({
        success: false,
        message: 'The database still restricts year_of_study to 1-3. Please ask an administrator to run BackEnd/scripts/migrate_class_master_extended_years.js.',
      })
    }
    logger.error({ err: e }, 'create class master')
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
  } catch (e) { logger.error({ err: e }, 'update class master'); res.status(500).json({ success: false, message: e.message }) }
})

// DELETE /masters/:collegeId/class/:id — hard delete
router.delete('/:collegeId/class/:id', requirePerm('masters'), async (req, res) => {
  try {
    await db.request()
      .input('id',  mssql.Int, parseInt(req.params.id))
      .input('cid', mssql.Int, cid(req))
      .query(`DELETE FROM class_master WHERE id=@id AND college_id=@cid`)
    res.json({ success: true })
  } catch (e) { logger.error({ err: e }, 'delete class master'); res.status(500).json({ success: false, message: e.message }) }
})

// ═══════════════════════════════════════════════════════════════
// CATEGORY MASTER — castes, special statuses, fees categories
// ═══════════════════════════════════════════════════════════════

// ── Auto-seed defaults for a college that has no category master yet ──
async function seedCategoryDefaults(collegeId) {
  const castes = [
    { name: 'SC',    order: 1, is_gen: 0 },
    { name: 'ST',    order: 2, is_gen: 0 },
    { name: 'NT(A)', order: 3, is_gen: 0 },
    { name: 'NT(B)', order: 4, is_gen: 0 },
    { name: 'NT(C)', order: 5, is_gen: 0 },
    { name: 'DT/VJ', order: 6, is_gen: 0 },
    { name: 'OBC',   order: 7, is_gen: 0 },
    { name: 'SBC',   order: 8, is_gen: 0 },
    { name: 'Gen.',  order: 9, is_gen: 1 },
  ]
  const statuses = [
    { name: 'EBC',        order: 1 },
    { name: 'PTC',        order: 2 },
    { name: 'STC',        order: 3 },
    { name: 'Ex-Service', order: 4 },
    { name: 'FF',         order: 5 },
    { name: 'PH',         order: 6 },
    { name: 'C.Govt.',    order: 7 },
    { name: 'S.Govt.',    order: 8 },
    { name: 'Widows',     order: 9 },
  ]
  // Slab mapping to match existing fees_master columns:
  //   cat1 = Paying (Open/General), cat2 = Other (EBC/OBC concession),
  //   cat3 = BCC (SC/ST reimbursable), cat4 = Special (FF/PH/Widows/Govt)
  const feesCats = [
    { name: 'Paying',  slab: 1, order: 1 },
    { name: 'Other',   slab: 2, order: 2 },
    { name: 'BCC',     slab: 3, order: 3 },
    { name: 'Special', slab: 4, order: 4 },
  ]

  // Insert castes
  const casteIds = {}
  for (const c of castes) {
    const r = await db.request()
      .input('col',  mssql.Int,      collegeId)
      .input('name', mssql.NVarChar, c.name)
      .input('ord',  mssql.Int,      c.order)
      .input('gen',  mssql.Bit,      c.is_gen)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM category_castes WHERE college_id=@col AND caste_name=@name)
          INSERT INTO category_castes (college_id, caste_name, is_gen_type, display_order) VALUES (@col, @name, @gen, @ord)
        SELECT id FROM category_castes WHERE college_id=@col AND caste_name=@name
      `)
    casteIds[c.name] = r.recordset[0].id
  }

  // Insert statuses
  const statusIds = {}
  for (const s of statuses) {
    const r = await db.request()
      .input('col',  mssql.Int,      collegeId)
      .input('name', mssql.NVarChar, s.name)
      .input('ord',  mssql.Int,      s.order)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM category_special_statuses WHERE college_id=@col AND status_name=@name)
          INSERT INTO category_special_statuses (college_id, status_name, display_order) VALUES (@col, @name, @ord)
        SELECT id FROM category_special_statuses WHERE college_id=@col AND status_name=@name
      `)
    statusIds[s.name] = r.recordset[0].id
  }

  // Insert fees categories + mappings
  for (const fc of feesCats) {
    const r = await db.request()
      .input('col',  mssql.Int,      collegeId)
      .input('name', mssql.NVarChar, fc.name)
      .input('slab', mssql.Int,      fc.slab)
      .input('ord',  mssql.Int,      fc.order)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM fees_categories WHERE college_id=@col AND category_name=@name)
          INSERT INTO fees_categories (college_id, category_name, slab_index, display_order)
          VALUES (@col, @name, @slab, @ord)
        SELECT id FROM fees_categories WHERE college_id=@col AND category_name=@name
      `)
    const fcId = r.recordset[0].id

    if (fc.name === 'BCC') {
      for (const cn of ['SC', 'ST', 'NT(A)', 'NT(B)', 'NT(C)', 'DT/VJ', 'SBC']) {
        if (casteIds[cn]) await db.request()
          .input('fc', mssql.Int, fcId).input('c', mssql.Int, casteIds[cn])
          .query(`IF NOT EXISTS (SELECT 1 FROM fees_category_castes WHERE fees_category_id=@fc AND caste_id=@c)
                  INSERT INTO fees_category_castes VALUES (@fc, @c)`)
      }
    } else if (fc.name === 'Other') {
      if (casteIds['OBC']) await db.request()
        .input('fc', mssql.Int, fcId).input('c', mssql.Int, casteIds['OBC'])
        .query(`IF NOT EXISTS (SELECT 1 FROM fees_category_castes WHERE fees_category_id=@fc AND caste_id=@c)
                INSERT INTO fees_category_castes VALUES (@fc, @c)`)
      for (const sn of ['EBC', 'PTC', 'STC', 'Ex-Service']) {
        if (statusIds[sn]) await db.request()
          .input('fc', mssql.Int, fcId).input('s', mssql.Int, statusIds[sn])
          .query(`IF NOT EXISTS (SELECT 1 FROM fees_category_special_statuses WHERE fees_category_id=@fc AND special_status_id=@s)
                  INSERT INTO fees_category_special_statuses VALUES (@fc, @s)`)
      }
    } else if (fc.name === 'Special') {
      for (const sn of ['FF', 'PH', 'C.Govt.', 'S.Govt.', 'Widows']) {
        if (statusIds[sn]) await db.request()
          .input('fc', mssql.Int, fcId).input('s', mssql.Int, statusIds[sn])
          .query(`IF NOT EXISTS (SELECT 1 FROM fees_category_special_statuses WHERE fees_category_id=@fc AND special_status_id=@s)
                  INSERT INTO fees_category_special_statuses VALUES (@fc, @s)`)
      }
    } else if (fc.name === 'Paying') {
      if (casteIds['Gen.']) await db.request()
        .input('fc', mssql.Int, fcId).input('c', mssql.Int, casteIds['Gen.'])
        .query(`IF NOT EXISTS (SELECT 1 FROM fees_category_castes WHERE fees_category_id=@fc AND caste_id=@c)
                INSERT INTO fees_category_castes VALUES (@fc, @c)`)
    }
  }
}

// ── Internal helper: load full category master for a college ──
async function getCategoryMaster(collegeId) {
  const [castesRes, statusesRes, feesCatsRes, casteMapsRes, statusMapsRes] = await Promise.all([
    db.request().input('col', mssql.Int, collegeId)
      .query('SELECT * FROM category_castes WHERE college_id=@col ORDER BY display_order, caste_name'),
    db.request().input('col', mssql.Int, collegeId)
      .query('SELECT * FROM category_special_statuses WHERE college_id=@col ORDER BY display_order, status_name'),
    db.request().input('col', mssql.Int, collegeId)
      .query('SELECT * FROM fees_categories WHERE college_id=@col ORDER BY display_order, slab_index'),
    db.request().input('col', mssql.Int, collegeId)
      .query(`SELECT fcc.fees_category_id, fcc.caste_id
              FROM fees_category_castes fcc
              JOIN fees_categories fc ON fc.id = fcc.fees_category_id
              WHERE fc.college_id = @col`),
    db.request().input('col', mssql.Int, collegeId)
      .query(`SELECT fcs.fees_category_id, fcs.special_status_id
              FROM fees_category_special_statuses fcs
              JOIN fees_categories fc ON fc.id = fcs.fees_category_id
              WHERE fc.college_id = @col`),
  ])
  return {
    castes:          castesRes.recordset,
    specialStatuses: statusesRes.recordset,
    feesCategories:  feesCatsRes.recordset,
    casteMappings:   casteMapsRes.recordset,
    statusMappings:  statusMapsRes.recordset,
  }
}

// GET /masters/:collegeId/category-master — returns full master (auto-seeds if empty)
// No college-role check needed — students need this to render caste/fees category options.
router.get('/:collegeId/category-master', async (req, res) => {
  const collegeId = parseInt(req.params.collegeId)
  try {
    const check = await db.request().input('col', mssql.Int, collegeId)
      .query('SELECT COUNT(*) AS cnt FROM category_castes WHERE college_id=@col')
    if (check.recordset[0].cnt === 0) await seedCategoryDefaults(collegeId)
    const data = await getCategoryMaster(collegeId)
    res.json({ success: true, data })
  } catch (err) {
    logger.error({ err }, 'category-master GET')
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ── Castes CRUD ───────────────────────────────────────────────

// POST /masters/:collegeId/category-castes
router.post('/:collegeId/category-castes', requireCollegeAccess, requireWrite('masters'), async (req, res) => {
  const collegeId = parseInt(req.params.collegeId)
  const { caste_name, is_gen_type = false, display_order = 99 } = req.body
  if (!caste_name?.trim()) return res.status(400).json({ success: false, message: 'caste_name required.' })
  try {
    const r = await db.request()
      .input('col',  mssql.Int,      collegeId)
      .input('name', mssql.NVarChar, caste_name.trim())
      .input('gen',  mssql.Bit,      is_gen_type ? 1 : 0)
      .input('ord',  mssql.Int,      display_order)
      .query('INSERT INTO category_castes (college_id, caste_name, is_gen_type, display_order) OUTPUT INSERTED.* VALUES (@col, @name, @gen, @ord)')
    res.json({ success: true, data: r.recordset[0] })
  } catch (err) {
    if (err.number === 2627) return res.status(400).json({ success: false, message: 'Caste already exists.' })
    logger.error({ err }, 'category-castes POST')
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// PATCH /masters/:collegeId/category-castes/:id
router.patch('/:collegeId/category-castes/:id', requireCollegeAccess, requireWrite('masters'), async (req, res) => {
  const collegeId = parseInt(req.params.collegeId)
  const id = parseInt(req.params.id)
  const { caste_name, is_gen_type, display_order, is_active } = req.body
  try {
    await db.request()
      .input('id',   mssql.Int,      id)
      .input('col',  mssql.Int,      collegeId)
      .input('name', mssql.NVarChar, caste_name?.trim() ?? null)
      .input('gen',  mssql.Bit,      is_gen_type != null ? (is_gen_type ? 1 : 0) : null)
      .input('ord',  mssql.Int,      display_order ?? null)
      .input('act',  mssql.Bit,      is_active != null ? (is_active ? 1 : 0) : null)
      .query(`UPDATE category_castes SET
        caste_name    = ISNULL(@name, caste_name),
        is_gen_type   = ISNULL(@gen,  is_gen_type),
        display_order = ISNULL(@ord,  display_order),
        is_active     = ISNULL(@act,  is_active)
        WHERE id=@id AND college_id=@col`)
    res.json({ success: true })
  } catch (err) {
    if (err.number === 2627) return res.status(400).json({ success: false, message: 'Caste name already exists.' })
    logger.error({ err }, 'category-castes PATCH')
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// DELETE /masters/:collegeId/category-castes/:id — soft delete
router.delete('/:collegeId/category-castes/:id', requireCollegeAccess, requireWrite('masters'), async (req, res) => {
  const collegeId = parseInt(req.params.collegeId)
  const id = parseInt(req.params.id)
  try {
    await db.request().input('id', mssql.Int, id).input('col', mssql.Int, collegeId)
      .query('UPDATE category_castes SET is_active=0 WHERE id=@id AND college_id=@col')
    res.json({ success: true })
  } catch (err) {
    logger.error({ err }, 'category-castes DELETE')
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ── Special Statuses CRUD ─────────────────────────────────────

// POST /masters/:collegeId/category-special-statuses
router.post('/:collegeId/category-special-statuses', requireCollegeAccess, requireWrite('masters'), async (req, res) => {
  const collegeId = parseInt(req.params.collegeId)
  const { status_name, display_order = 99 } = req.body
  if (!status_name?.trim()) return res.status(400).json({ success: false, message: 'status_name required.' })
  try {
    const r = await db.request()
      .input('col',  mssql.Int,      collegeId)
      .input('name', mssql.NVarChar, status_name.trim())
      .input('ord',  mssql.Int,      display_order)
      .query('INSERT INTO category_special_statuses (college_id, status_name, display_order) OUTPUT INSERTED.* VALUES (@col, @name, @ord)')
    res.json({ success: true, data: r.recordset[0] })
  } catch (err) {
    if (err.number === 2627) return res.status(400).json({ success: false, message: 'Status already exists.' })
    logger.error({ err }, 'category-special-statuses POST')
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// PATCH /masters/:collegeId/category-special-statuses/:id
router.patch('/:collegeId/category-special-statuses/:id', requireCollegeAccess, requireWrite('masters'), async (req, res) => {
  const collegeId = parseInt(req.params.collegeId)
  const id = parseInt(req.params.id)
  const { status_name, display_order, is_active } = req.body
  try {
    await db.request()
      .input('id',   mssql.Int,      id)
      .input('col',  mssql.Int,      collegeId)
      .input('name', mssql.NVarChar, status_name?.trim() ?? null)
      .input('ord',  mssql.Int,      display_order ?? null)
      .input('act',  mssql.Bit,      is_active != null ? (is_active ? 1 : 0) : null)
      .query(`UPDATE category_special_statuses SET
        status_name   = ISNULL(@name, status_name),
        display_order = ISNULL(@ord,  display_order),
        is_active     = ISNULL(@act,  is_active)
        WHERE id=@id AND college_id=@col`)
    res.json({ success: true })
  } catch (err) {
    if (err.number === 2627) return res.status(400).json({ success: false, message: 'Status name already exists.' })
    logger.error({ err }, 'category-special-statuses PATCH')
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// DELETE /masters/:collegeId/category-special-statuses/:id — soft delete
router.delete('/:collegeId/category-special-statuses/:id', requireCollegeAccess, requireWrite('masters'), async (req, res) => {
  const collegeId = parseInt(req.params.collegeId)
  const id = parseInt(req.params.id)
  try {
    await db.request().input('id', mssql.Int, id).input('col', mssql.Int, collegeId)
      .query('UPDATE category_special_statuses SET is_active=0 WHERE id=@id AND college_id=@col')
    res.json({ success: true })
  } catch (err) {
    logger.error({ err }, 'category-special-statuses DELETE')
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ── Fees Categories CRUD ──────────────────────────────────────

// POST /masters/:collegeId/fees-categories
router.post('/:collegeId/fees-categories', requireCollegeAccess, requireWrite('masters'), async (req, res) => {
  const collegeId = parseInt(req.params.collegeId)
  const { category_name, slab_index, display_order = 99, caste_ids = [], special_status_ids = [] } = req.body
  if (!category_name?.trim()) return res.status(400).json({ success: false, message: 'category_name required.' })
  if (!slab_index || slab_index < 1 || slab_index > 8) return res.status(400).json({ success: false, message: 'slab_index must be 1–8.' })
  try {
    const r = await db.request()
      .input('col',  mssql.Int,      collegeId)
      .input('name', mssql.NVarChar, category_name.trim())
      .input('slab', mssql.Int,      slab_index)
      .input('ord',  mssql.Int,      display_order)
      .query('INSERT INTO fees_categories (college_id, category_name, slab_index, display_order) OUTPUT INSERTED.id VALUES (@col, @name, @slab, @ord)')
    const fcId = r.recordset[0].id
    for (const cid of caste_ids) await db.request().input('fc', mssql.Int, fcId).input('c', mssql.Int, cid)
      .query('INSERT INTO fees_category_castes VALUES (@fc, @c)')
    for (const sid of special_status_ids) await db.request().input('fc', mssql.Int, fcId).input('s', mssql.Int, sid)
      .query('INSERT INTO fees_category_special_statuses VALUES (@fc, @s)')
    res.json({ success: true, data: { id: fcId } })
  } catch (err) {
    if (err.number === 2627) return res.status(400).json({ success: false, message: 'Category name or slab already exists.' })
    logger.error({ err }, 'fees-categories POST')
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// PATCH /masters/:collegeId/fees-categories/:id — update + replace mappings
router.patch('/:collegeId/fees-categories/:id', requireCollegeAccess, requireWrite('masters'), async (req, res) => {
  const collegeId = parseInt(req.params.collegeId)
  const id = parseInt(req.params.id)
  const { category_name, slab_index, display_order, is_active, caste_ids, special_status_ids } = req.body
  try {
    await db.request()
      .input('id',   mssql.Int,      id)
      .input('col',  mssql.Int,      collegeId)
      .input('name', mssql.NVarChar, category_name?.trim() ?? null)
      .input('slab', mssql.Int,      slab_index ?? null)
      .input('ord',  mssql.Int,      display_order ?? null)
      .input('act',  mssql.Bit,      is_active != null ? (is_active ? 1 : 0) : null)
      .query(`UPDATE fees_categories SET
        category_name  = ISNULL(@name, category_name),
        slab_index     = ISNULL(@slab, slab_index),
        display_order  = ISNULL(@ord,  display_order),
        is_active      = ISNULL(@act,  is_active)
        WHERE id=@id AND college_id=@col`)
    if (Array.isArray(caste_ids)) {
      await db.request().input('fc', mssql.Int, id)
        .query('DELETE FROM fees_category_castes WHERE fees_category_id=@fc')
      for (const cid of caste_ids) await db.request().input('fc', mssql.Int, id).input('c', mssql.Int, cid)
        .query('INSERT INTO fees_category_castes VALUES (@fc, @c)')
    }
    if (Array.isArray(special_status_ids)) {
      await db.request().input('fc', mssql.Int, id)
        .query('DELETE FROM fees_category_special_statuses WHERE fees_category_id=@fc')
      for (const sid of special_status_ids) await db.request().input('fc', mssql.Int, id).input('s', mssql.Int, sid)
        .query('INSERT INTO fees_category_special_statuses VALUES (@fc, @s)')
    }
    res.json({ success: true })
  } catch (err) {
    if (err.number === 2627) return res.status(400).json({ success: false, message: 'Category name or slab already exists.' })
    logger.error({ err }, 'fees-categories PATCH')
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// DELETE /masters/:collegeId/fees-categories/:id — soft delete
router.delete('/:collegeId/fees-categories/:id', requireCollegeAccess, requireWrite('masters'), async (req, res) => {
  const collegeId = parseInt(req.params.collegeId)
  const id = parseInt(req.params.id)
  try {
    await db.request().input('id', mssql.Int, id).input('col', mssql.Int, collegeId)
      .query('UPDATE fees_categories SET is_active=0 WHERE id=@id AND college_id=@col')
    res.json({ success: true })
  } catch (err) {
    logger.error({ err }, 'fees-categories DELETE')
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

module.exports = router
