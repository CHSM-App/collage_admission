/**
 * college_admin.js — College admin endpoints.
 *
 * Admission periods:
 *   GET  /college-admin/:collegeId/admission-periods         — list all periods
 *   POST /college-admin/:collegeId/admission-periods         — create period
 *   PUT  /college-admin/:collegeId/admission-periods/:id     — update period
 *
 * Application review:
 *   GET  /college-admin/:collegeId/applications              — inbox (filter by status/course/year)
 *   GET  /college-admin/:collegeId/applications/:appId       — full detail
 *   POST /college-admin/:collegeId/applications/:appId/approve              (scrutiny accept → scrutiny_accepted)
 *   POST /college-admin/:collegeId/applications/:appId/reject               (reject at scrutiny)
 *   POST /college-admin/:collegeId/applications/:appId/call-for-doc-verification (→ doc_verification_pending)
 *   POST /college-admin/:collegeId/applications/:appId/confirm              (physical docs ok → confirmed)
 *   POST /college-admin/:collegeId/applications/:appId/cancel
 *
 * Roll numbers:
 *   POST /college-admin/:collegeId/roll-numbers/generate     — batch generate
 */

const express = require('express');
const router  = express.Router({ mergeParams: true });
const db      = require('./db');
const mssqlShared = require('mssql');
const { authenticate, requireCollegeAccess, requirePerm, requireWrite } = require('../middleware/auth');
const { parsePage, paginateQuery, paginatedResponse } = require('../middleware/paginate');
const whatsapp = require('../services/whatsapp');
const logger = require('../config/logger');

// All routes in this file require authentication and college ownership
router.use(authenticate, requireCollegeAccess);

// ── Activity log helper ─────────────────────────────────────
async function logActivity(appId, action, actorRole, note = null) {
  try {
    await db.request()
      .input('appId',     mssqlShared.Int,      parseInt(appId))
      .input('action',    mssqlShared.NVarChar,  action)
      .input('actorRole', mssqlShared.NVarChar,  actorRole)
      .input('note',      mssqlShared.NVarChar,  note || null)
      .query(`
        INSERT INTO application_activity_log (application_id, action, actor_role, note)
        VALUES (@appId, @action, @actorRole, @note)
      `);
  } catch (e) {
    logger.warn({ err: e }, 'logActivity failed');
  }
}

// ── WhatsApp student info helper ────────────────────────────
async function getStudentForNotification(appId) {
  try {
    const r = await db.request()
      .input('id', mssqlShared.Int, parseInt(appId))
      .query(`
        SELECT s.full_name AS name, s.phone,
               COALESCE(CONCAT(fm.degree_course_code, ' — ', fm.degree_course_name), CAST(a.course_id AS NVARCHAR)) AS course_name,
               c.name AS college_name,
               ap.start_date,
               ap.end_date
        FROM applications a
        JOIN students s ON s.id = a.student_id
        LEFT JOIN faculty_master fm ON fm.code_no = a.course_id AND fm.college_id = a.college_id
        LEFT JOIN colleges c ON c.id = a.college_id
        LEFT JOIN admission_periods ap ON ap.id = a.admission_period_id
        WHERE a.id = @id
      `);
    return r.recordset[0] || null;
  } catch (e) {
    logger.warn({ err: e }, 'getStudentForNotification failed');
    return null;
  }
}

// ── Admission Periods ───────────────────────────────────────

router.get('/:collegeId/admission-periods', async (req, res) => {
  const activeOnly = req.query.active === '1';
  const today = new Date().toISOString().slice(0, 10);
  try {
    // Auto-close any active periods whose end_date has passed
    await db.request()
      .input('col',   parseInt(req.params.collegeId))
      .input('today', today)
      .query(`
        UPDATE admission_periods
        SET is_active = 0
        WHERE college_id = @col AND is_active = 1 AND is_disabled = 0 AND end_date < @today
      `);

    const result = await db.request()
      .input('col',   parseInt(req.params.collegeId))
      .input('today', today)
      .query(`
        SELECT ap.id, ap.year_of_study, ap.academic_year,
               ap.start_date, ap.end_date, ap.total_seats, ap.filled_seats,
               ap.is_active, ap.is_disabled,
               fm.code_no AS course_id,
               CONCAT(fm.degree_course_code, ' — ', fm.degree_course_name) AS course_name
        FROM admission_periods ap
        JOIN faculty_master fm ON fm.code_no = ap.course_id AND fm.college_id = ap.college_id
        WHERE ap.college_id = @col
          ${activeOnly ? 'AND ap.is_active = 1 AND ap.is_disabled = 0 AND ap.start_date <= @today AND ap.end_date >= @today' : ''}
        ORDER BY ap.academic_year DESC, fm.degree_course_name, ap.year_of_study
      `);
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.post('/:collegeId/admission-periods', requirePerm('masters'), async (req, res) => {
  const { course_id, year_of_study, academic_year, start_date, end_date, total_seats } = req.body;

  if (!course_id || !year_of_study || !academic_year || !start_date || !end_date || !total_seats) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

  try {
    const result = await db.request()
      .input('col',  parseInt(req.params.collegeId))
      .input('crs',  parseInt(course_id))
      .input('yr',   parseInt(year_of_study))
      .input('ay',   academic_year)
      .input('sd',   start_date)
      .input('ed',   end_date)
      .input('seats',parseInt(total_seats))
      .query(`
        INSERT INTO admission_periods
          (college_id, course_id, year_of_study, academic_year, start_date, end_date, total_seats, is_active)
        OUTPUT INSERTED.id
        VALUES (@col, @crs, @yr, @ay, @sd, @ed, @seats, 1)
      `);

    return res.status(201).json({ success: true, data: { id: result.recordset[0].id } });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.put('/:collegeId/admission-periods/:periodId', requirePerm('masters'), async (req, res) => {
  const { start_date, end_date, total_seats, is_active, is_disabled } = req.body;

  try {
    const mssql = require('mssql');
    await db.request()
      .input('id',    mssql.Int,  parseInt(req.params.periodId))
      .input('col',   mssql.Int,  parseInt(req.params.collegeId))
      .input('sd',    mssql.NVarChar, start_date    || null)
      .input('ed',    mssql.NVarChar, end_date      || null)
      .input('seats', mssql.Int,  total_seats   ? parseInt(total_seats)         : null)
      .input('act',   mssql.Bit,  is_active    !== undefined ? (is_active    ? 1 : 0) : null)
      .input('dis',   mssql.Bit,  is_disabled  !== undefined ? (is_disabled  ? 1 : 0) : null)
      .query(`
        UPDATE admission_periods
        SET
          start_date  = COALESCE(@sd,    start_date),
          end_date    = COALESCE(@ed,    end_date),
          total_seats = COALESCE(@seats, total_seats),
          is_active   = COALESCE(@act,   is_active),
          is_disabled = COALESCE(@dis,   is_disabled)
        WHERE id = @id AND college_id = @col
      `);

    return res.json({ success: true, message: 'Admission period updated.' });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.delete('/:collegeId/admission-periods/:periodId', requirePerm('masters'), async (req, res) => {
  const periodId  = parseInt(req.params.periodId);
  const collegeId = parseInt(req.params.collegeId);
  try {
    const check = await db.request()
      .input('pid', periodId)
      .query(`SELECT COUNT(*) AS cnt FROM applications WHERE period_id = @pid`);
    const cnt = check.recordset[0]?.cnt || 0;
    if (cnt > 0) {
      return res.status(400).json({ success: false, message: `Cannot delete — ${cnt} application(s) exist for this period.` });
    }
    const del = await db.request()
      .input('pid', periodId)
      .input('cid', collegeId)
      .query(`DELETE FROM admission_periods WHERE id = @pid AND college_id = @cid`);
    if (!del.rowsAffected[0]) {
      return res.status(404).json({ success: false, message: 'Period not found.' });
    }
    return res.json({ success: true, message: 'Admission period deleted.' });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Student search (for college-side application creation) ──
router.get('/:collegeId/students/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ success: false, message: 'Query must be at least 2 characters.' });
  }
  try {
    const result = await db.request()
      .input('q', `%${q.trim()}%`)
      .query(`
        SELECT TOP 20 id, full_name, email, phone, category
        FROM students
        WHERE full_name LIKE @q OR email LIKE @q OR phone LIKE @q
        ORDER BY full_name
      `);
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Application Inbox ───────────────────────────────────────

router.get('/:collegeId/applications', requirePerm('review_application'), async (req, res) => {
  const { status, course_id, year_of_study } = req.query;
  const { page, limit, offset } = parsePage(req.query);

  try {
    const pool = await db;
    const collegeId = parseInt(req.params.collegeId);

    let where = `WHERE a.college_id = @col AND a.status <> 'draft'`;

    // Build shared inputs map to apply to both requests independently
    const extraInputs = [];
    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        where += ' AND a.status = @status';
        extraInputs.push(r => r.input('status', statuses[0]));
      } else {
        const placeholders = statuses.map((_, i) => `@s${i}`).join(',');
        where += ` AND a.status IN (${placeholders})`;
        statuses.forEach((s, i) => extraInputs.push(r => r.input(`s${i}`, s)));
      }
    }
    if (course_id) {
      where += ' AND a.course_id = @crs';
      extraInputs.push(r => r.input('crs', parseInt(course_id)));
    }
    if (year_of_study) {
      where += ' AND a.year_of_study = @yr';
      extraInputs.push(r => r.input('yr', parseInt(year_of_study)));
    }

    function makeRequest() {
      const r = pool.request().input('col', collegeId);
      extraInputs.forEach(fn => fn(r));
      return r;
    }

    const joins = `
      FROM applications a
      JOIN students       s  ON s.id  = a.student_id
      LEFT JOIN faculty_master fm ON fm.code_no = a.course_id AND fm.college_id = a.college_id
    `;

    // Use separate request objects — mssql requests are single-use
    const [countRes, dataRes] = await Promise.all([
      makeRequest().query(`SELECT COUNT(*) AS total ${joins} ${where}`),
      makeRequest().query(`
        SELECT
          a.id, a.registration_number, a.year_of_study, a.academic_year,
          a.status, a.submitted_at, a.roll_number, a.course_id,
          s.full_name AS student_name, s.email AS student_email, s.phone,
          COALESCE(CONCAT(fm.degree_course_code, ' — ', fm.degree_course_name), CAST(a.course_id AS NVARCHAR)) AS course_name
        ${joins} ${where}
        ORDER BY a.submitted_at DESC
        ${paginateQuery(offset, limit)}
      `),
    ]);

    return res.json(paginatedResponse(dataRes.recordset, countRes.recordset[0].total, page, limit));
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Export applications (no pagination — all matching rows) ──
router.get('/:collegeId/applications/export', requirePerm('review_application'), async (req, res) => {
  const { status, course_id, year_of_study } = req.query;
  try {
    const pool = await db;
    const collegeId = parseInt(req.params.collegeId);

    let where = `WHERE a.college_id = @col AND a.status <> 'draft'`;
    const extraInputs = [];

    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        where += ' AND a.status = @status';
        extraInputs.push(r => r.input('status', statuses[0]));
      } else {
        const placeholders = statuses.map((_, i) => `@s${i}`).join(',');
        where += ` AND a.status IN (${placeholders})`;
        statuses.forEach((s, i) => extraInputs.push(r => r.input(`s${i}`, s)));
      }
    }
    if (course_id) {
      where += ' AND a.course_id = @crs';
      extraInputs.push(r => r.input('crs', parseInt(course_id)));
    }
    if (year_of_study) {
      where += ' AND a.year_of_study = @yr';
      extraInputs.push(r => r.input('yr', parseInt(year_of_study)));
    }

    const req2 = pool.request().input('col', collegeId);
    extraInputs.forEach(fn => fn(req2));

    const dataRes = await req2.query(`
      SELECT
        a.registration_number,
        s.full_name        AS student_name,
        s.phone,
        s.email            AS student_email,
        a.year_of_study,
        a.academic_year,
        a.status,
        a.submitted_at,
        a.roll_number,
        COALESCE(CONCAT(fm.degree_course_code, ' — ', fm.degree_course_name), CAST(a.course_id AS NVARCHAR)) AS course_name,
        -- SSC
        ssc.board_or_college_name  AS ssc_board,
        ssc.seat_number            AS ssc_seat_no,
        ssc.month_year_passing     AS ssc_passing,
        ssc.total_marks_obtained   AS ssc_marks_obtained,
        ssc.total_marks_max        AS ssc_marks_max,
        ssc.percentage             AS ssc_percentage,
        ssc.class_grade            AS ssc_class,
        -- HSC
        hsc.board_or_college_name  AS hsc_board,
        hsc.seat_number            AS hsc_seat_no,
        hsc.month_year_passing     AS hsc_passing,
        hsc.total_marks_obtained   AS hsc_marks_obtained,
        hsc.total_marks_max        AS hsc_marks_max,
        hsc.percentage             AS hsc_percentage,
        hsc.class_grade            AS hsc_class
      FROM applications a
      JOIN students s ON s.id = a.student_id
      LEFT JOIN faculty_master fm ON fm.code_no = a.course_id AND fm.college_id = a.college_id
      LEFT JOIN application_previous_exam ssc ON ssc.application_id = a.id AND ssc.exam_type = 'SSC'
      LEFT JOIN application_previous_exam hsc ON hsc.application_id = a.id AND hsc.exam_type = 'HSC'
      ${where}
      ORDER BY a.submitted_at DESC
    `);

    return res.json({ success: true, data: dataRes.recordset });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.get('/:collegeId/applications/:appId', requirePerm('review_application'), async (req, res) => {
  try {
    const result = await db.request()
      .input('id',  parseInt(req.params.appId))
      .input('col', parseInt(req.params.collegeId))
      .query(`
        SELECT
          a.*,
          s.full_name, s.email AS student_email, s.phone,
          s.dob, s.gender, s.address, s.city, s.category,
          COALESCE(CONCAT(fm.degree_course_code, ' — ', fm.degree_course_name), CAST(a.course_id AS NVARCHAR)) AS course_name,
          col.name AS college_name
        FROM applications a
        JOIN students       s   ON s.id      = a.student_id
        LEFT JOIN faculty_master fm  ON fm.code_no = a.course_id AND fm.college_id = a.college_id
        JOIN colleges       col ON col.id    = a.college_id
        WHERE a.id = @id AND a.college_id = @col
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const docs = await db.request()
      .input('appId', parseInt(req.params.appId))
      .query(`
        SELECT ad.id, ad.is_verified, ad.verified_at,
               dt.name AS document_name,
               sd.id AS student_document_id,
               sd.file_name, sd.file_path, sd.uploaded_at
        FROM application_documents ad
        JOIN student_documents sd ON sd.id = ad.student_document_id
        JOIN document_types    dt ON dt.id = ad.document_type_id
        WHERE ad.application_id = @appId
      `);

    const examRes = await db.request()
      .input('appId', parseInt(req.params.appId))
      .query(`
        SELECT
          ape.id, ape.exam_type,
          ape.board_or_college_name   AS institute,
          ape.school_or_college_address AS board,
          ape.month_year_passing      AS month_year,
          ape.seat_number             AS seat_no,
          ape.total_marks_obtained    AS marks_obtained,
          ape.total_marks_max         AS marks_max,
          ape.percentage,
          ape.class_grade,
          ape.remark
        FROM application_previous_exam ape
        WHERE ape.application_id = @appId
        ORDER BY ape.id
      `);

    const exams = {};
    for (const row of examRes.recordset) {
      exams[row.exam_type || 'SSC'] = row;
    }
    const exam = examRes.recordset[0] || null;

    const activityRes = await db.request()
      .input('appId', parseInt(req.params.appId))
      .query(`
        SELECT id, action, actor_role, note,
               REPLACE(CONVERT(NVARCHAR(19), created_at, 120), ' ', 'T') AS created_at
        FROM application_activity_log
        WHERE application_id = @appId
        ORDER BY created_at ASC
      `);

    return res.json({
      success: true,
      data: { ...result.recordset[0], documents: docs.recordset, exam, exams, activity: activityRes.recordset },
    });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Request Correction (submitted/under_review → correction_requested) ──────
router.post('/:collegeId/applications/:appId/request-correction', requireWrite('review_application'), async (req, res) => {
  const { note } = req.body;
  if (!note || !note.trim()) {
    return res.status(400).json({ success: false, message: 'A correction note is required.' });
  }
  try {
    const appRes = await db.request()
      .input('id',  parseInt(req.params.appId))
      .input('col', parseInt(req.params.collegeId))
      .query('SELECT id, status FROM applications WHERE id=@id AND college_id=@col');

    if (appRes.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    if (!['submitted', 'under_review', 'correction_requested', 'correction_done'].includes(appRes.recordset[0].status)) {
      return res.status(400).json({ success: false, message: 'Correction can only be requested for submitted or under-review applications.' });
    }

    await db.request()
      .input('id',   mssqlShared.Int,      parseInt(req.params.appId))
      .input('note', mssqlShared.NVarChar, note.trim())
      .query(`
        UPDATE applications
        SET status = 'correction_requested', correction_note = @note, updated_at = GETDATE(), status_updated_at = GETDATE()
        WHERE id = @id
      `);

    await logActivity(req.params.appId, 'correction_requested', 'college', note.trim());
    getStudentForNotification(req.params.appId).then(s => s && whatsapp.notifyCorrectionRequested(s));

    return res.json({ success: true, message: 'Correction requested. Student has been notified.' });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Accept Application (submitted/correction_done → doc_verified) ────────────
// College accepts the application. Student is notified to visit for doc check.
router.post('/:collegeId/applications/:appId/approve', requireWrite('review_application'), async (req, res) => {
  try {
    const appRes = await db.request()
      .input('id',  parseInt(req.params.appId))
      .input('col', parseInt(req.params.collegeId))
      .query('SELECT id, status, admission_period_id FROM applications WHERE id=@id AND college_id=@col');

    if (appRes.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    if (!['submitted', 'under_review', 'correction_requested', 'correction_done'].includes(appRes.recordset[0].status)) {
      return res.status(400).json({ success: false, message: 'Application must be under review to accept.' });
    }

    const pool1 = await db;
    const tx1   = pool1.transaction();
    await tx1.begin();
    try {
      await tx1.request()
        .input('pid', mssqlShared.Int, appRes.recordset[0].admission_period_id)
        .query('UPDATE admission_periods SET filled_seats = filled_seats + 1 WHERE id = @pid AND filled_seats < total_seats');

      await tx1.request()
        .input('id', mssqlShared.Int, parseInt(req.params.appId))
        .query(`
          UPDATE applications
          SET status = 'doc_verified', approved_at = GETDATE(), updated_at = GETDATE(), status_updated_at = GETDATE(),
              correction_note = NULL
          WHERE id = @id
        `);

      await tx1.commit();
    } catch (txErr) {
      await tx1.rollback();
      throw txErr;
    }

    await logActivity(req.params.appId, 'accepted', 'college', null);
    getStudentForNotification(req.params.appId).then(s => s && whatsapp.notifyApplicationAccepted(s));

    return res.json({ success: true, message: 'Application accepted. Student has been notified to visit the college.' });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Reject ──────────────────────────────────────────────────
router.post('/:collegeId/applications/:appId/reject', requireWrite('review_application'), async (req, res) => {
  const { reason } = req.body;

  try {
    const appRes = await db.request()
      .input('id',  parseInt(req.params.appId))
      .input('col', parseInt(req.params.collegeId))
      .query('SELECT id, status FROM applications WHERE id=@id AND college_id=@col');

    if (appRes.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    if (!['submitted', 'under_review', 'correction_requested', 'correction_done', 'doc_verified'].includes(appRes.recordset[0].status)) {
      return res.status(400).json({ success: false, message: 'Application cannot be rejected in current status.' });
    }

    await db.request()
      .input('id',     parseInt(req.params.appId))
      .input('reason', reason || null)
      .query(`
        UPDATE applications
        SET status = 'rejected', rejection_reason = @reason, updated_at = GETDATE(), status_updated_at = GETDATE()
        WHERE id = @id
      `);

    await logActivity(req.params.appId, 'rejected', 'college', reason || null);
    getStudentForNotification(req.params.appId).then(s => s && whatsapp.notifyApplicationRejected(s));

    return res.json({ success: true, message: 'Application rejected.' });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Confirm after doc visit: set fees and move to confirmed ──────────────────
// Student visited college. College verifies docs, sets fees, confirms admission.
// Status: doc_verified → confirmed
router.post('/:collegeId/applications/:appId/confirm', requireWrite('review_application'), async (req, res) => {
  const { fee_total_amount, fee_pay_now_amount, division, document_ids_verified } = req.body;

  const total  = parseFloat(fee_total_amount);
  const payNow = parseFloat(fee_pay_now_amount);

  if (!total || total <= 0) {
    return res.status(400).json({ success: false, message: 'Total payable amount is required and must be positive.' });
  }
  if (isNaN(payNow) || payNow <= 0) {
    return res.status(400).json({ success: false, message: 'Amount to pay now must be a positive number.' });
  }
  if (payNow > total + 0.01) {
    return res.status(400).json({ success: false, message: 'Amount to pay now cannot exceed the total payable amount.' });
  }

  try {
    const appRes = await db.request()
      .input('id',  parseInt(req.params.appId))
      .input('col', parseInt(req.params.collegeId))
      .query('SELECT id, status FROM applications WHERE id=@id AND college_id=@col');

    if (appRes.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    if (appRes.recordset[0].status !== 'doc_verified') {
      return res.status(400).json({ success: false, message: 'Application must be in doc_verified status to confirm.' });
    }

    const pool2 = await db;
    const tx2   = pool2.transaction();
    await tx2.begin();
    try {
      // Mark documents as physically verified
      if (Array.isArray(document_ids_verified) && document_ids_verified.length > 0) {
        for (const docId of document_ids_verified) {
          await tx2.request()
            .input('docId', mssqlShared.Int, parseInt(docId))
            .input('appId', mssqlShared.Int, parseInt(req.params.appId))
            .query(`
              UPDATE application_documents
              SET is_verified = 1, verified_at = GETDATE()
              WHERE id = @docId AND application_id = @appId
            `);
        }
      }

      await tx2.request()
        .input('id',    mssqlShared.Int,     parseInt(req.params.appId))
        .input('total', mssqlShared.Decimal, total)
        .input('now',   mssqlShared.Decimal, payNow)
        .input('div',   mssqlShared.Char,    division || null)
        .query(`
          UPDATE applications
          SET status = 'confirmed', confirmed_at = GETDATE(), updated_at = GETDATE(), status_updated_at = GETDATE(),
              fee_total_amount = @total, fee_pay_now_amount = @now,
              app_division = COALESCE(@div, app_division)
          WHERE id = @id
        `);

      await tx2.commit();
    } catch (txErr) {
      await tx2.rollback();
      throw txErr;
    }

    await logActivity(req.params.appId, 'confirmed', 'college', `Total fee: ₹${total}, Pay now: ₹${payNow}`);

    return res.json({ success: true, message: 'Admission confirmed. Student can now pay the college fee.' });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Set fee amounts (college enters total fee and amount due now) ─────────────
router.post('/:collegeId/applications/:appId/set-fee', requireWrite('review_application'), async (req, res) => {
  const { fee_total_amount, fee_pay_now_amount } = req.body;

  const total  = parseFloat(fee_total_amount);
  const payNow = parseFloat(fee_pay_now_amount);

  if (!total || total <= 0) {
    return res.status(400).json({ success: false, message: 'Total payable amount is required and must be positive.' });
  }
  if (isNaN(payNow) || payNow <= 0) {
    return res.status(400).json({ success: false, message: 'Amount to pay now must be a positive number.' });
  }
  if (payNow > total + 0.01) {
    return res.status(400).json({ success: false, message: 'Amount to pay now cannot exceed the total payable amount.' });
  }

  try {
    const appRes = await db.request()
      .input('id',  parseInt(req.params.appId))
      .input('col', parseInt(req.params.collegeId))
      .query('SELECT id, status FROM applications WHERE id=@id AND college_id=@col');

    if (!appRes.recordset.length) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    if (!['doc_verified', 'confirmed', 'fees_paid'].includes(appRes.recordset[0].status)) {
      return res.status(400).json({ success: false, message: 'Fee can only be set for accepted or confirmed applications.' });
    }

    await db.request()
      .input('id',    parseInt(req.params.appId))
      .input('total', require('mssql').Decimal, total)
      .input('now',   require('mssql').Decimal, payNow)
      .query(`
        UPDATE applications
        SET fee_total_amount = @total, fee_pay_now_amount = @now, updated_at = GETDATE()
        WHERE id = @id
      `);

    return res.json({ success: true, message: 'Fee amounts saved.' });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Cancel (held seat freed) ─────────────────────────────────
router.post('/:collegeId/applications/:appId/cancel', requireWrite('review_application'), async (req, res) => {
  const { reason } = req.body;

  try {
    const appRes = await db.request()
      .input('id',  parseInt(req.params.appId))
      .input('col', parseInt(req.params.collegeId))
      .query('SELECT id, status, admission_period_id FROM applications WHERE id=@id AND college_id=@col');

    if (appRes.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const { status, admission_period_id } = appRes.recordset[0];

    const pool3 = await db;
    const tx3   = pool3.transaction();
    await tx3.begin();
    try {
      // Free the seat if one was held (doc_verified or later)
      if (['doc_verified', 'scrutiny_accepted', 'doc_verification_pending', 'confirmed'].includes(status)) {
        await tx3.request()
          .input('pid', mssqlShared.Int, admission_period_id)
          .query('UPDATE admission_periods SET filled_seats = filled_seats - 1 WHERE id = @pid AND filled_seats > 0');
      }

      await tx3.request()
        .input('id',     mssqlShared.Int,     parseInt(req.params.appId))
        .input('reason', mssqlShared.NVarChar, reason || null)
        .query(`
          UPDATE applications
          SET status = 'cancelled', cancellation_reason = @reason, updated_at = GETDATE(), status_updated_at = GETDATE()
          WHERE id = @id
        `);

      await tx3.commit();
    } catch (txErr) {
      await tx3.rollback();
      throw txErr;
    }

    await logActivity(req.params.appId, 'cancelled', 'college', reason || null);

    return res.json({ success: true, message: 'Application cancelled and seat freed.' });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Record offline (cash) college fee payment ────────────────
// POST /:collegeId/applications/:appId/record-cash-payment
// body: { amount, note? }
router.post('/:collegeId/applications/:appId/record-cash-payment', requirePerm('collect_fees'), async (req, res) => {
  const { amount, note } = req.body;
  const amt = parseFloat(amount);

  if (!amt || amt <= 0) {
    return res.status(400).json({ success: false, message: 'Amount must be a positive number.' });
  }

  const appId    = parseInt(req.params.appId);
  const collegeId = parseInt(req.params.collegeId);

  try {
    const appRes = await db.request()
      .input('id',  mssqlShared.Int, appId)
      .input('col', mssqlShared.Int, collegeId)
      .query(`
        SELECT id, status, fee_total_amount, fee_pay_now_amount
        FROM applications
        WHERE id = @id AND college_id = @col
      `);

    if (!appRes.recordset.length) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    const app = appRes.recordset[0];
    if (!['confirmed', 'fees_paid'].includes(app.status)) {
      return res.status(400).json({ success: false, message: 'Application must be in confirmed or fees_paid status.' });
    }

    const totalFee        = parseFloat(app.fee_total_amount)    || 0;
    const payNowThreshold = parseFloat(app.fee_pay_now_amount) || totalFee;

    // Check already paid
    const paidRes = await db.request()
      .input('appId', mssqlShared.Int, appId)
      .query(`
        SELECT ISNULL(SUM(amount), 0) AS total_paid
        FROM payments
        WHERE application_id = @appId AND payment_type = 'college_fee' AND status = 'success'
      `);
    const alreadyPaid = parseFloat(paidRes.recordset[0].total_paid) || 0;
    const remaining   = Math.max(0, totalFee - alreadyPaid);

    if (remaining <= 0) {
      return res.status(400).json({ success: false, message: 'Fee has already been fully paid.' });
    }
    if (amt > remaining + 0.01) {
      return res.status(400).json({ success: false, message: `Amount (₹${amt}) exceeds remaining balance (₹${remaining}).` });
    }

    const newTotalPaid = alreadyPaid + amt;
    const newRemaining = Math.max(0, totalFee - newTotalPaid);
    const firstPaid    = payNowThreshold > 0 && newTotalPaid >= payNowThreshold - 0.01;
    const fullyPaid    = totalFee > 0 && newTotalPaid >= totalFee - 0.01;

    const pool = await db;
    const tx   = pool.transaction();
    await tx.begin();
    try {
      await tx.request()
        .input('appId',  mssqlShared.Int,      appId)
        .input('amount', mssqlShared.Decimal,   amt)
        .input('userId', mssqlShared.Int,       req.user.staff_id || req.user.id)
        .query(`
          INSERT INTO payments (application_id, payment_type, amount, status,
            razorpay_order_id, razorpay_payment_id, completed_at, paid_by, paid_by_user_id)
          VALUES (@appId, 'college_fee', @amount, 'success',
            CONCAT('CASH-', CAST(@appId AS NVARCHAR), '-', CAST(CHECKSUM(NEWID()) AS NVARCHAR)),
            CONCAT('CASH-', FORMAT(GETDATE(),'yyyyMMddHHmmss')),
            GETDATE(), 'college', @userId)
        `);

      if (firstPaid) {
        await tx.request()
          .input('id', mssqlShared.Int, appId)
          .query(`
            UPDATE applications
            SET status = 'fees_paid', college_fee_paid = 1, updated_at = GETDATE(), status_updated_at = GETDATE()
            WHERE id = @id
          `);
      }

      await tx.commit();
    } catch (txErr) {
      await tx.rollback();
      throw txErr;
    }

    const noteText = note ? ` — ${note}` : '';
    if (fullyPaid) {
      await logActivity(appId, 'fees_paid', 'college', `Cash: ₹${newTotalPaid.toLocaleString('en-IN')} (full)${noteText}`);
      getStudentForNotification(appId).then(s => s && whatsapp.notifyAdmissionConfirmed(s, appId));
    } else if (firstPaid) {
      await logActivity(appId, 'fees_paid', 'college', `Cash: ₹${newTotalPaid.toLocaleString('en-IN')} paid, ₹${newRemaining.toLocaleString('en-IN')} remaining${noteText}`);
      getStudentForNotification(appId).then(s => s && whatsapp.notifyAdmissionConfirmed(s, appId));
    } else {
      await logActivity(appId, 'fee_instalment_paid', 'college', `Cash: ₹${amt.toLocaleString('en-IN')}, ₹${newRemaining.toLocaleString('en-IN')} remaining${noteText}`);
    }

    return res.json({
      success: true,
      message: fullyPaid  ? 'Fee fully paid!' :
               firstPaid  ? `₹${amt.toLocaleString('en-IN')} recorded. Admission confirmed! ₹${newRemaining.toLocaleString('en-IN')} remaining.` :
                            `₹${amt.toLocaleString('en-IN')} recorded. ₹${newRemaining.toLocaleString('en-IN')} remaining.`,
      data: { all_paid: firstPaid, fully_paid: fullyPaid, total_paid: newTotalPaid, remaining: newRemaining },
    });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Generate roll numbers (batch) ───────────────────────────
router.post('/:collegeId/roll-numbers/generate', requirePerm('assign_subjects'), async (req, res) => {
  const { course_id } = req.body;

  if (!course_id) {
    return res.status(400).json({ success: false, message: 'course_id is required.' });
  }

  try {
    // Find highest existing roll number for this college + course (across all years/batches)
    const maxRes = await db.request()
      .input('col', parseInt(req.params.collegeId))
      .input('crs', parseInt(course_id))
      .query(`
        SELECT MAX(CAST(roll_number AS INT)) AS max_roll
        FROM applications
        WHERE college_id = @col AND course_id = @crs
          AND roll_number IS NOT NULL
          AND ISNUMERIC(roll_number) = 1
      `);

    let nextRoll = (maxRes.recordset[0].max_roll || 0) + 1;

    // Get ALL fees_paid applications without a roll number for this college + course,
    // ordered by when fee was paid (first-come first-served, across all years/batches)
    const pending = await db.request()
      .input('col', parseInt(req.params.collegeId))
      .input('crs', parseInt(course_id))
      .query(`
        SELECT id FROM applications
        WHERE college_id = @col AND course_id = @crs
          AND status = 'fees_paid'
          AND roll_number IS NULL
        ORDER BY status_updated_at ASC
      `);

    if (pending.recordset.length === 0) {
      return res.json({ success: true, message: 'No pending applications for roll number assignment.', assigned: 0 });
    }

    const pool4 = await db;
    const tx4   = pool4.transaction();
    await tx4.begin();
    const assignedRolls = []; // track id→roll for post-commit notifications
    try {
      for (const app of pending.recordset) {
        await tx4.request()
          .input('id',   mssqlShared.Int,     app.id)
          .input('roll', mssqlShared.NVarChar, String(nextRoll))
          .query(`
            UPDATE applications
            SET roll_number = @roll, status = 'roll_assigned', updated_at = GETDATE()
            WHERE id = @id
          `);
        await logActivity(app.id, 'roll_assigned', 'college', `Roll number: ${nextRoll}`);
        assignedRolls.push({ id: app.id, roll: String(nextRoll) });
        nextRoll++;
      }
      await tx4.commit();
    } catch (txErr) {
      await tx4.rollback();
      throw txErr;
    }

    // Fire WhatsApp notifications after commit (non-blocking)
    for (const { id, roll } of assignedRolls) {
      getStudentForNotification(id).then(s => s && whatsapp.notifyRollAssigned(s, roll));
    }

    return res.json({
      success: true,
      message: `Roll numbers assigned to ${pending.recordset.length} student(s).`,
      assigned: pending.recordset.length,
      starting_from: nextRoll - pending.recordset.length,
    });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── College Fee Receipts ─────────────────────────────────────
// GET /:collegeId/fee-receipts?status=paid|partial|pending&course_id=&year_of_study=&q=
router.get('/:collegeId/fee-receipts', requirePerm('collect_fees'), async (req, res) => {
  const { status, course_id, year_of_study, q } = req.query;
  const { page, limit, offset } = parsePage(req.query);

  try {
    const joins = `
      FROM applications a
      JOIN students s ON s.id = a.student_id
      LEFT JOIN faculty_master fm ON fm.code_no = a.course_id AND fm.college_id = a.college_id
      LEFT JOIN (
        SELECT application_id,
               SUM(amount) AS total_paid,
               MAX(completed_at) AS last_paid_at
        FROM payments
        WHERE payment_type = 'college_fee' AND status = 'success'
        GROUP BY application_id
      ) psum ON psum.application_id = a.id
    `;

    let where = `
      WHERE a.college_id = @col
        AND a.status NOT IN ('draft','submitted','under_review','correction_requested','correction_done',
                             'scrutiny_accepted','doc_verification_pending','rejected','cancelled')
    `;
    const pool2 = await db;
    const collegeId2 = parseInt(req.params.collegeId);
    const extraInputs2 = [];

    if (status === 'paid') {
      where += ' AND a.fee_total_amount > 0 AND ISNULL(psum.total_paid, 0) >= a.fee_total_amount - 0.01';
    } else if (status === 'partial') {
      where += ' AND a.fee_total_amount > 0 AND ISNULL(psum.total_paid, 0) > 0 AND ISNULL(psum.total_paid, 0) < a.fee_total_amount - 0.01';
    } else if (status === 'pending') {
      where += ' AND (a.fee_total_amount IS NULL OR a.fee_total_amount = 0 OR ISNULL(psum.total_paid, 0) = 0)';
    }
    if (course_id) {
      where += ' AND a.course_id = @crs';
      extraInputs2.push(r => r.input('crs', parseInt(course_id)));
    }
    if (year_of_study) {
      where += ' AND a.year_of_study = @yr';
      extraInputs2.push(r => r.input('yr', parseInt(year_of_study)));
    }
    if (q) {
      where += ` AND (s.full_name LIKE @q OR s.phone LIKE @q OR a.registration_number LIKE @q OR a.roll_number LIKE @q)`;
      extraInputs2.push(r => r.input('q', `%${q.trim()}%`));
    }

    function makeRequest2() {
      const r = pool2.request().input('col', collegeId2);
      extraInputs2.forEach(fn => fn(r));
      return r;
    }

    const orderBy = `ORDER BY (CASE WHEN a.fee_total_amount > 0 AND ISNULL(psum.total_paid,0) >= a.fee_total_amount - 0.01 THEN 1 ELSE 0 END) ASC, a.confirmed_at DESC`;

    const [countRes2, dataRes] = await Promise.all([
      makeRequest2().query(`SELECT COUNT(*) AS total ${joins} ${where}`),
      makeRequest2().query(`
        SELECT
          a.id AS application_id,
          a.registration_number,
          a.year_of_study,
          a.academic_year,
          a.college_fee_paid,
          a.status AS application_status,
          a.roll_number,
          a.fee_total_amount,
          s.full_name  AS student_name,
          s.phone      AS student_phone,
          COALESCE(CONCAT(fm.degree_course_code, ' — ', fm.degree_course_name), CAST(a.course_id AS NVARCHAR)) AS course_name,
          ISNULL(psum.total_paid, 0) AS amount_paid,
          psum.last_paid_at AS completed_at
        ${joins} ${where}
        ${orderBy}
        ${paginateQuery(offset, limit)}
      `),
    ]);

    return res.json(paginatedResponse(dataRes.recordset, countRes2.recordset[0].total, page, limit));
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
