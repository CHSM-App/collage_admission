/**
 * exams.js — Exam registration (and, later, marks entry)
 * Mounted at /exams
 *
 * Routes:
 *   GET  /exams/:collegeId/registration   — students + their registered subjects
 *   POST /exams/:collegeId/registration   — save one student's subject/exam-type set
 *
 * A student appears on the exam-registration list when they have an application
 * at this college for the selected faculty + semester + academic year whose status
 * means the admission is settled (confirmed onwards).
 */

const express  = require('express')
const router   = express.Router()
const db       = require('./db')
const mssql    = require('mssql')
const logger   = require('../config/logger')
const { authenticate, requireCollegeAccess, requirePerm } = require('../middleware/auth')

router.use(authenticate)

// college_id comes from the URL for college staff; super-admin passes it too.
const cid = (req) => parseInt(req.params.collegeId)

// Statuses that mean the student has actually taken the seat.
const CONFIRMED_STATUSES = ['confirmed', 'fees_paid', 'roll_assigned', 'enrolled']
const CONFIRMED_SQL = CONFIRMED_STATUSES.map(s => `'${s}'`).join(',')

const EXAM_TYPES = ['RR', 'OE', 'Repeater']

/**
 * GET /exams/:collegeId/registration?faculty_id=&semester=&academic_year=
 *
 * Returns the confirmed students for that class along with the subjects each is
 * already registered for. Also returns the semester's subject list from
 * course_master so the UI can offer it when adding a subject to a student.
 */
router.get('/:collegeId/registration', requireCollegeAccess, async (req, res) => {
  const { faculty_id, semester, academic_year } = req.query
  if (!faculty_id || !semester || !academic_year)
    return res.status(422).json({ success: false, message: 'faculty_id, semester, academic_year required.' })

  try {
    const collegeId = cid(req)
    const facultyId = parseInt(faculty_id)
    const sem       = parseInt(semester)

    // Subjects offered this semester — the pool the operator picks from.
    const subjectsRes = await db.request()
      .input('cid', mssql.Int,      collegeId)
      .input('fid', mssql.Int,      facultyId)
      .input('sem', mssql.Int,      sem)
      .query(`
        SELECT id, course_code, course_title, subject_type, credits,
               max_internal, max_sem_end, max_total, display_order
        FROM course_master
        WHERE college_id = @cid AND faculty_master_id = @fid
          AND semester = @sem AND is_active = 1
        ORDER BY display_order, id
      `)

    // Confirmed students of this class. app_semester is the semester the student
    // was admitted into; it is the agriculture-form field shown in the mockup.
    const studentsRes = await db.request()
      .input('cid', mssql.Int,      collegeId)
      .input('fid', mssql.Int,      facultyId)
      .input('sem', mssql.Int,      sem)
      .input('ay',  mssql.NVarChar, academic_year)
      .query(`
        SELECT a.id                 AS application_id,
               a.registration_number,
               a.roll_number,
               a.app_semester,
               a.status,
               s.id                 AS student_id,
               s.full_name,
               s.email
        FROM applications a
        JOIN students s ON s.id = a.student_id
        WHERE a.college_id    = @cid
          AND a.course_id     = @fid
          AND a.academic_year = @ay
          AND a.app_semester  = @sem
          AND a.status IN (${CONFIRMED_SQL})
        ORDER BY s.full_name
      `)

    // Existing registrations for exactly these students.
    const regsRes = await db.request()
      .input('cid', mssql.Int,      collegeId)
      .input('fid', mssql.Int,      facultyId)
      .input('sem', mssql.Int,      sem)
      .input('ay',  mssql.NVarChar, academic_year)
      .query(`
        SELECT application_id, course_master_id, subject_code, subject_title, exam_type
        FROM exam_registrations
        WHERE college_id = @cid AND faculty_master_id = @fid
          AND semester = @sem AND academic_year = @ay
      `)

    const byApp = new Map()
    for (const r of regsRes.recordset) {
      if (!byApp.has(r.application_id)) byApp.set(r.application_id, [])
      byApp.get(r.application_id).push({
        course_master_id: r.course_master_id,
        subject_code:     r.subject_code,
        subject_title:    r.subject_title,
        exam_type:        r.exam_type,
      })
    }

    const students = studentsRes.recordset.map(s => ({
      ...s,
      subjects: byApp.get(s.application_id) || [],
    }))

    res.json({
      success: true,
      data: { subjects: subjectsRes.recordset, students },
    })
  } catch (e) {
    logger.error({ err: e }, 'get exam registration')
    res.status(500).json({ success: false, message: e.message })
  }
})

/**
 * POST /exams/:collegeId/registration
 * Body: { faculty_master_id, semester, academic_year,
 *         students: [{ application_id, subjects: [{ course_master_id, exam_type }] }] }
 *
 * Bulk save of the whole grid in one transaction. For each student listed, their
 * registration set for the semester is REPLACED by the given subjects — a student
 * with an empty `subjects` array ends up registered for nothing.
 *
 * Only the students present in the payload are touched; students omitted keep
 * whatever they had. The whole thing is one transaction, so a class of 100 either
 * saves completely or not at all.
 */
router.post('/:collegeId/registration', requirePerm('exams'), async (req, res) => {
  const { faculty_master_id, semester, academic_year, students } = req.body

  if (!faculty_master_id || !semester || !academic_year || !Array.isArray(students))
    return res.status(422).json({
      success: false,
      message: 'faculty_master_id, semester, academic_year, students[] required.',
    })
  if (!students.length)
    return res.status(422).json({ success: false, message: 'No students to save.' })

  // Validate the payload before touching the database.
  for (const st of students) {
    if (!st.application_id)
      return res.status(422).json({ success: false, message: 'Each student needs an application_id.' })
    if (!Array.isArray(st.subjects))
      return res.status(422).json({ success: false, message: 'Each student needs a subjects[] array.' })

    for (const s of st.subjects) {
      if (!s.course_master_id)
        return res.status(422).json({ success: false, message: 'Each subject needs a course_master_id.' })
      if (!EXAM_TYPES.includes(s.exam_type))
        return res.status(422).json({ success: false, message: `exam_type must be one of: ${EXAM_TYPES.join(', ')}` })
    }
    // A subject may only be registered once per student per semester.
    const ids = st.subjects.map(s => parseInt(s.course_master_id))
    if (new Set(ids).size !== ids.length)
      return res.status(422).json({
        success: false,
        message: `Application ${st.application_id} lists the same subject more than once.`,
      })
  }

  const collegeId = cid(req)
  const facultyId = parseInt(faculty_master_id)
  const sem       = parseInt(semester)
  const actor     = String(req.user.staff_id || req.user.id)

  try {
    // Every application must belong to this college + class and be confirmed.
    const appRes = await db.request()
      .input('cid', mssql.Int,      collegeId)
      .input('fid', mssql.Int,      facultyId)
      .input('sem', mssql.Int,      sem)
      .input('ay',  mssql.NVarChar, academic_year)
      .query(`
        SELECT id FROM applications
        WHERE college_id = @cid AND course_id = @fid
          AND app_semester = @sem AND academic_year = @ay
          AND status IN (${CONFIRMED_SQL})
      `)
    const eligible = new Set(appRes.recordset.map(r => r.id))
    for (const st of students) {
      if (!eligible.has(parseInt(st.application_id)))
        return res.status(422).json({
          success: false,
          message: `Application ${st.application_id} is not a confirmed student of this class.`,
        })
    }

    // Resolve every subject from course_master rather than trusting the client,
    // so the stored code/title snapshot cannot be forged.
    const subRes = await db.request()
      .input('cid', mssql.Int, collegeId)
      .input('fid', mssql.Int, facultyId)
      .input('sem', mssql.Int, sem)
      .query(`
        SELECT id, course_code, course_title
        FROM course_master
        WHERE college_id = @cid AND faculty_master_id = @fid
          AND semester = @sem AND is_active = 1
      `)
    const valid = new Map(subRes.recordset.map(r => [r.id, r]))

    const plan = []
    for (const st of students) {
      const rows = []
      for (const s of st.subjects) {
        const row = valid.get(parseInt(s.course_master_id))
        if (!row)
          return res.status(422).json({
            success: false,
            message: `Subject #${s.course_master_id} is not offered in semester ${sem} of this program.`,
          })
        rows.push({ ...row, exam_type: s.exam_type })
      }
      plan.push({ appId: parseInt(st.application_id), rows })
    }

    const pool = await db
    const tx   = pool.transaction()
    await tx.begin()
    let written = 0
    try {
      for (const p of plan) {
        // Full replace for this student — the payload is the intended final state.
        await tx.request()
          .input('appId', mssql.Int, p.appId)
          .input('sem',   mssql.Int, sem)
          .query(`DELETE FROM exam_registrations WHERE application_id = @appId AND semester = @sem`)

        for (const r of p.rows) {
          await tx.request()
            .input('cid',   mssql.Int,      collegeId)
            .input('appId', mssql.Int,      p.appId)
            .input('fid',   mssql.Int,      facultyId)
            .input('sem',   mssql.Int,      sem)
            .input('ay',    mssql.NVarChar, academic_year)
            .input('cmid',  mssql.Int,      r.id)
            .input('code',  mssql.NVarChar, r.course_code)
            .input('title', mssql.NVarChar, r.course_title)
            .input('etype', mssql.NVarChar, r.exam_type)
            .input('actor', mssql.NVarChar, actor)
            .query(`
              INSERT INTO exam_registrations
                (college_id, application_id, faculty_master_id, semester, academic_year,
                 course_master_id, subject_code, subject_title, exam_type, created_by, updated_by, updated_at)
              VALUES (@cid, @appId, @fid, @sem, @ay, @cmid, @code, @title, @etype, @actor, @actor, GETDATE())
            `)
          written++
        }
      }
      await tx.commit()
    } catch (e) {
      await tx.rollback()
      throw e
    }

    res.json({
      success: true,
      message: `Saved ${written} registration(s) for ${plan.length} student(s).`,
      students: plan.length,
      registrations: written,
    })
  } catch (e) {
    logger.error({ err: e }, 'save exam registration')
    res.status(500).json({ success: false, message: e.message })
  }
})

module.exports = router
