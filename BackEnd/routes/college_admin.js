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
const feeSvc   = require('../services/FeeDeterminationService');
const rcptSvc  = require('../services/ReceiptNumberService');

const YEAR_LEVEL_MAP = { 1: 'FY', 2: 'SY', 3: 'TY', 4: '4Y', 5: '5Y' };

// All routes require authentication. College ownership is enforced via router.param
// so that req.params.collegeId is available when the check runs.
router.use(authenticate);
router.param('collegeId', (req, res, next) => requireCollegeAccess(req, res, next));

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
               ap.start_date, ap.end_date, ap.total_seats,
               (SELECT COUNT(*) FROM applications a WHERE a.admission_period_id = ap.id AND a.status <> 'draft') AS filled_seats,
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

router.post('/:collegeId/admission-periods', requirePerm('manage_admission_periods'), async (req, res) => {
  const { course_id, year_of_study, academic_year, start_date, end_date, total_seats } = req.body;

  if (!course_id || !year_of_study || !academic_year || !start_date || !end_date || !total_seats) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

  const actorId = String(req.user.staff_id || req.user.id);
  try {
    const result = await db.request()
      .input('col',  parseInt(req.params.collegeId))
      .input('crs',  parseInt(course_id))
      .input('yr',   parseInt(year_of_study))
      .input('ay',   academic_year)
      .input('sd',   start_date)
      .input('ed',   end_date)
      .input('seats',parseInt(total_seats))
      .input('actor', actorId)
      .query(`
        DECLARE @t TABLE (id INT);
        INSERT INTO admission_periods
          (college_id, course_id, year_of_study, academic_year, start_date, end_date, total_seats, is_active, created_by)
        OUTPUT INSERTED.id INTO @t
        VALUES (@col, @crs, @yr, @ay, @sd, @ed, @seats, 1, @actor);
        SELECT id FROM @t;
      `);

    return res.status(201).json({ success: true, data: { id: result.recordset[0].id } });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.put('/:collegeId/admission-periods/:periodId', requirePerm('manage_admission_periods'), async (req, res) => {
  const { start_date, end_date, total_seats, is_active, is_disabled } = req.body;

  const actorId = String(req.user.staff_id || req.user.id);
  try {
    const mssql = require('mssql');
    await db.request()
      .input('id',    mssql.Int,       parseInt(req.params.periodId))
      .input('col',   mssql.Int,       parseInt(req.params.collegeId))
      .input('sd',    mssql.NVarChar,  start_date    || null)
      .input('ed',    mssql.NVarChar,  end_date      || null)
      .input('seats', mssql.Int,       total_seats   ? parseInt(total_seats)         : null)
      .input('act',   mssql.Bit,       is_active    !== undefined ? (is_active    ? 1 : 0) : null)
      .input('dis',   mssql.Bit,       is_disabled  !== undefined ? (is_disabled  ? 1 : 0) : null)
      .input('actor', mssql.NVarChar,  actorId)
      .query(`
        UPDATE admission_periods
        SET
          start_date  = COALESCE(@sd,    start_date),
          end_date    = COALESCE(@ed,    end_date),
          total_seats = COALESCE(@seats, total_seats),
          is_active   = COALESCE(@act,   is_active),
          is_disabled = COALESCE(@dis,   is_disabled),
          updated_by  = @actor
        WHERE id = @id AND college_id = @col
      `);

    return res.json({ success: true, message: 'Admission period updated.' });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.delete('/:collegeId/admission-periods/:periodId', requirePerm('manage_admission_periods'), async (req, res) => {
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
  const { status, course_id, year_of_study, pending_link, division } = req.query;
  const { page, limit, offset } = parsePage(req.query);

  try {
    const pool = await db;
    const collegeId = parseInt(req.params.collegeId);

    // When filtering by pending link, include draft applications too (link may have been sent before submission)
    let where = pending_link === '1'
      ? `WHERE a.college_id = @col`
      : `WHERE a.college_id = @col AND a.status <> 'draft'`;

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
    if (division) {
      where += ' AND a.app_division = @div';
      extraInputs.push(r => r.input('div', division));
    }
    // Filter: only applications that have an active (unused, unexpired) payment link
    if (pending_link === '1') {
      where += ` AND EXISTS (
        SELECT 1 FROM payment_link_tokens plt
        WHERE plt.application_id = a.id AND plt.used = 0 AND plt.expires_at > GETDATE()
      )`;
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
          a.status, a.submitted_at, a.roll_number, a.course_id, a.app_division,
          s.full_name AS student_name, s.email AS student_email, s.phone,
          COALESCE(CONCAT(fm.degree_course_code, ' — ', fm.degree_course_name), CAST(a.course_id AS NVARCHAR)) AS course_name,
          CASE WHEN EXISTS (
            SELECT 1 FROM payment_link_tokens plt
            WHERE plt.application_id = a.id AND plt.used = 0 AND plt.expires_at > GETDATE()
          ) THEN 1 ELSE 0 END AS has_pending_link
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
          col.name AS college_name,
          CASE WHEN EXISTS (
            SELECT 1 FROM payment_link_tokens plt
            WHERE plt.application_id = a.id AND plt.used = 0 AND plt.expires_at > GETDATE()
          ) THEN 1 ELSE 0 END AS has_pending_link
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
      .input('id',    mssqlShared.Int,      parseInt(req.params.appId))
      .input('note',  mssqlShared.NVarChar, note.trim())
      .input('actor', mssqlShared.NVarChar, String(req.user.staff_id || req.user.id))
      .query(`
        UPDATE applications
        SET status = 'correction_requested', correction_note = @note, updated_at = GETDATE(), status_updated_at = GETDATE(), updated_by = @actor
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
        .input('id',    mssqlShared.Int,      parseInt(req.params.appId))
        .input('actor', mssqlShared.NVarChar, String(req.user.staff_id || req.user.id))
        .query(`
          UPDATE applications
          SET status = 'doc_verified', approved_at = GETDATE(), updated_at = GETDATE(), status_updated_at = GETDATE(),
              correction_note = NULL, updated_by = @actor
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
      .input('id',     mssqlShared.Int,      parseInt(req.params.appId))
      .input('reason', mssqlShared.NVarChar, reason || null)
      .input('actor',  mssqlShared.NVarChar, String(req.user.staff_id || req.user.id))
      .query(`
        UPDATE applications
        SET status = 'rejected', rejection_reason = @reason, updated_at = GETDATE(), status_updated_at = GETDATE(), updated_by = @actor
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
// ── Helper: compute fee total from FeeDeterminationService for an application ─
async function computeFeeForApp(appId, collegeId, divisionOverride) {
  const r = await db.request()
    .input('id',  mssqlShared.Int, appId)
    .input('col', mssqlShared.Int, collegeId)
    .query(`
      SELECT course_id, year_of_study, academic_year, app_division, app_category,
             app_special_status, fees_category, student_id
      FROM applications WHERE id=@id AND college_id=@col
    `);
  if (!r.recordset.length) return null;
  const a = r.recordset[0];
  const yearMap = { 1: 'FY', 2: 'SY', 3: 'TY', 4: '4Y', 5: '5Y' };

  // Determine if this student is new to this college:
  // FY (year 1) → always new.
  // Higher years → new if no prior confirmed/fees_paid application exists at this college.
  let isNewStudent = a.year_of_study === 1;
  if (!isNewStudent) {
    const priorRes = await db.request()
      .input('sid', mssqlShared.Int, a.student_id)
      .input('col', mssqlShared.Int, collegeId)
      .input('cur', mssqlShared.Int, appId)
      .query(`
        SELECT TOP 1 id FROM applications
        WHERE student_id = @sid
          AND college_id = @col
          AND id <> @cur
          AND status IN ('confirmed', 'fees_paid', 'roll_assigned')
      `);
    isNewStudent = priorRes.recordset.length === 0;
  }

  const result = await feeSvc.compute({
    collegeId,
    facultyMasterId: a.course_id,
    yearLevel:       yearMap[a.year_of_study] || null,
    divisionLetter:  divisionOverride || a.app_division || null,
    caste:           a.app_category || null,
    specialStatus:   a.app_special_status || null,
    academicYear:    a.academic_year || null,
    isNewStudent,
    pool:            db,
  });

  // Exclude Misc and ExamFees — those are collected separately
  const regularBreakdown = result.breakdown.filter(h => {
    const t = (h.fees_type || '').toLowerCase();
    return t !== 'misc' && t !== 'examfees';
  });
  const regularTotal   = regularBreakdown.reduce((s, h) => s + (parseFloat(h.amount) || 0), 0);

  return {
    ...result,
    breakdown:          regularBreakdown,
    totalFee:           regularTotal,
    studentPayable:     regularTotal,
    reimbursableAmount: 0,
  };
}

// GET /:collegeId/applications/:appId/computed-fee?division=A
router.get('/:collegeId/applications/:appId/computed-fee', requirePerm('review_application'), async (req, res) => {
  try {
    const divisionOverride = req.query.division || null;
    const result = await computeFeeForApp(parseInt(req.params.appId), parseInt(req.params.collegeId), divisionOverride);
    if (!result) return res.status(404).json({ success: false, message: 'Application not found.' });
    res.json({ success: true, data: result });
  } catch (e) {
    logger.error({ err: e }, 'computed-fee');
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── Helper: upsert installment plan for an application ────────
async function saveInstallments(appId, installments, actor, tx) {
  const runner = tx || db;
  // Delete existing installments first
  await runner.request()
    .input('appId', mssqlShared.Int, appId)
    .query(`DELETE FROM fee_installments WHERE application_id = @appId`);
  for (const inst of installments) {
    await runner.request()
      .input('appId',  mssqlShared.Int,      appId)
      .input('no',     mssqlShared.TinyInt,  inst.installment_no)
      .input('amt',    mssqlShared.Decimal,  parseFloat(inst.amount))
      .input('due',    mssqlShared.Date,     inst.due_date || null)
      .input('actor',  mssqlShared.NVarChar, actor)
      .query(`
        INSERT INTO fee_installments (application_id, installment_no, due_date, amount, created_by)
        VALUES (@appId, @no, @due, @amt, @actor)
      `);
  }
}

// GET /:collegeId/applications/:appId/installments
router.get('/:collegeId/applications/:appId/installments', requirePerm('review_application'), async (req, res) => {
  try {
    const r = await db.request()
      .input('appId', mssqlShared.Int, parseInt(req.params.appId))
      .query(`SELECT installment_no, due_date, amount FROM fee_installments WHERE application_id=@appId ORDER BY installment_no`);
    res.json({ success: true, data: r.recordset });
  } catch (e) {
    logger.error({ err: e }, 'get installments');
    res.status(500).json({ success: false, message: e.message });
  }
});

// Student visited college. College verifies docs, sets fees, confirms admission.
// Status: doc_verified → confirmed
router.post('/:collegeId/applications/:appId/confirm', requireWrite('review_application'), async (req, res) => {
  const { installments, division, document_ids_verified } = req.body;

  const validInstallments = (Array.isArray(installments) ? installments : [])
    .filter(i => i.amount && parseFloat(i.amount) > 0)
    .map((i, idx) => ({ installment_no: idx + 1, amount: parseFloat(i.amount), due_date: i.due_date || null }));

  if (validInstallments.length === 0) {
    return res.status(400).json({ success: false, message: 'At least one installment with an amount is required.' });
  }

  try {
    const appRes = await db.request()
      .input('id',  parseInt(req.params.appId))
      .input('col', parseInt(req.params.collegeId))
      .query('SELECT id, status FROM applications WHERE id=@id AND college_id=@col');

    if (appRes.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    const CONFIRMABLE = ['doc_verified', 'scrutiny_accepted', 'doc_verification_pending'];
    if (!CONFIRMABLE.includes(appRes.recordset[0].status)) {
      return res.status(400).json({ success: false, message: 'Application must be accepted before it can be confirmed.' });
    }

    // Compute total fee from fees master
    const feeResult = await computeFeeForApp(parseInt(req.params.appId), parseInt(req.params.collegeId), division || null);
    const total = feeResult ? feeResult.totalFee : 0;
    if (!total || total <= 0) {
      return res.status(400).json({ success: false, message: 'Could not compute fee total. Please configure classwise fees in Fees Master first.' });
    }
    const instTotal = validInstallments.reduce((s, i) => s + i.amount, 0);
    if (instTotal > total + 0.01) {
      return res.status(400).json({ success: false, message: `Installment total (₹${instTotal}) cannot exceed fee total (₹${total}).` });
    }

    const actor = String(req.user.staff_id || req.user.id);
    const pool2 = await db;
    const tx2   = pool2.transaction();
    await tx2.begin();
    try {
      if (Array.isArray(document_ids_verified) && document_ids_verified.length > 0) {
        for (const docId of document_ids_verified) {
          await tx2.request()
            .input('docId', mssqlShared.Int,      parseInt(docId))
            .input('appId', mssqlShared.Int,      parseInt(req.params.appId))
            .input('actor', mssqlShared.NVarChar, actor)
            .query(`
              UPDATE application_documents
              SET is_verified = 1, verified_at = GETDATE(), updated_by = @actor
              WHERE id = @docId AND application_id = @appId
            `);
        }
      }

      // Store pay_now as first installment amount for backward-compat with payments.js
      const firstInstAmt = validInstallments[0].amount;
      await tx2.request()
        .input('id',    mssqlShared.Int,      parseInt(req.params.appId))
        .input('total', mssqlShared.Decimal,  total)
        .input('now',   mssqlShared.Decimal,  firstInstAmt)
        .input('div',   mssqlShared.Char,     division || null)
        .input('actor', mssqlShared.NVarChar, actor)
        .query(`
          UPDATE applications
          SET status = 'confirmed', confirmed_at = GETDATE(), updated_at = GETDATE(), status_updated_at = GETDATE(),
              fee_total_amount = @total, fee_pay_now_amount = @now,
              app_division = COALESCE(@div, app_division), updated_by = @actor
          WHERE id = @id
        `);

      await tx2.commit();
    } catch (txErr) {
      await tx2.rollback();
      throw txErr;
    }

    // Save installment plan outside transaction (non-critical — replace any existing)
    await saveInstallments(parseInt(req.params.appId), validInstallments, actor, null);

    const instSummary = validInstallments.map(i => `Inst-${i.installment_no}: ₹${i.amount}`).join(', ');
    await logActivity(req.params.appId, 'confirmed', 'college', `Total fee: ₹${total}. Installments: ${instSummary}`);

    return res.json({ success: true, message: 'Admission confirmed. Student can now pay the college fee.' });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Set fee amounts (total fetched from fees master; college enters amount due now) ─
router.post('/:collegeId/applications/:appId/set-fee', requireWrite('review_application'), async (req, res) => {
  const { installments } = req.body;

  const validInstallments = (Array.isArray(installments) ? installments : [])
    .filter(i => i.amount && parseFloat(i.amount) > 0)
    .map((i, idx) => ({ installment_no: idx + 1, amount: parseFloat(i.amount), due_date: i.due_date || null }));

  if (validInstallments.length === 0) {
    return res.status(400).json({ success: false, message: 'At least one installment with an amount is required.' });
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

    const feeResult = await computeFeeForApp(parseInt(req.params.appId), parseInt(req.params.collegeId));
    const total = feeResult ? feeResult.totalFee : 0;
    if (!total || total <= 0) {
      return res.status(400).json({ success: false, message: 'Could not compute fee total. Please configure classwise fees in Fees Master first.' });
    }
    const instTotal = validInstallments.reduce((s, i) => s + i.amount, 0);
    if (instTotal > total + 0.01) {
      return res.status(400).json({ success: false, message: `Installment total (₹${instTotal}) cannot exceed fee total (₹${total}).` });
    }

    const actor = String(req.user.staff_id || req.user.id);
    const firstInstAmt = validInstallments[0].amount;

    await db.request()
      .input('id',    mssqlShared.Int,     parseInt(req.params.appId))
      .input('total', mssqlShared.Decimal, total)
      .input('now',   mssqlShared.Decimal, firstInstAmt)
      .query(`
        UPDATE applications
        SET fee_total_amount = @total, fee_pay_now_amount = @now, updated_at = GETDATE()
        WHERE id = @id
      `);

    await saveInstallments(parseInt(req.params.appId), validInstallments, actor, null);

    return res.json({ success: true, message: 'Installment plan saved.' });
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
        .input('id',     mssqlShared.Int,      parseInt(req.params.appId))
        .input('reason', mssqlShared.NVarChar,  reason || null)
        .input('actor',  mssqlShared.NVarChar,  String(req.user.staff_id || req.user.id))
        .query(`
          UPDATE applications
          SET status = 'cancelled', cancellation_reason = @reason, updated_at = GETDATE(), status_updated_at = GETDATE(), updated_by = @actor
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

// ── Record application fee cash payment ──────────────────────
// POST /:collegeId/applications/:appId/record-application-fee
router.post('/:collegeId/applications/:appId/record-application-fee', requirePerm('collect_fees'), async (req, res) => {
  const appId     = parseInt(req.params.appId);
  const collegeId = parseInt(req.params.collegeId);
  const actor     = req.user?.email || req.user?.name || 'college';
  const userId    = req.user?.id;

  try {
    const appRes = await db.request()
      .input('id',  mssqlShared.Int, appId)
      .input('cid', mssqlShared.Int, collegeId)
      .query(`
        SELECT a.id, a.status, a.college_id, a.course_id, a.year_of_study, a.academic_year,
               COALESCE(c.application_fee, 0) AS application_fee
        FROM applications a
        JOIN colleges c ON c.id = a.college_id
        WHERE a.id = @id AND a.college_id = @cid
      `);

    if (!appRes.recordset.length)
      return res.status(404).json({ success: false, message: 'Application not found.' });

    const app = appRes.recordset[0];
    const fee = parseFloat(app.application_fee) || 0;
    if (fee <= 0)
      return res.status(400).json({ success: false, message: 'No application fee configured for this college.' });

    // Check not already paid
    const paidRes = await db.request()
      .input('appId', mssqlShared.Int, appId)
      .query(`SELECT COUNT(*) AS cnt FROM payments WHERE application_id=@appId AND payment_type='application_fee' AND status='success'`);
    if (paidRes.recordset[0].cnt > 0)
      return res.status(400).json({ success: false, message: 'Application fee already collected.' });

    // Generate registration number (same logic as payments.js)
    const ayClean  = (app.academic_year || '').replace('-', '');
    const prefix   = `${ayClean}-${String(app.course_id).padStart(2, '0')}-${app.year_of_study}`;
    const cntRes   = await db.request()
      .input('regPrefix', mssqlShared.NVarChar, `${prefix}-%`)
      .query(`SELECT COUNT(*) AS cnt FROM applications WHERE registration_number LIKE @regPrefix AND registration_number IS NOT NULL`);
    const seq    = (cntRes.recordset[0].cnt || 0) + 1;
    const regNum = `${prefix}-${String(seq).padStart(4, '0')}`;

    const pool = await db;
    const tx   = pool.transaction();
    await tx.begin();
    try {
      const receiptNo = await rcptSvc.next({ tx, pool, collegeId, paymentType: 'application_fee' });

      await tx.request()
        .input('appId',     mssqlShared.Int,      appId)
        .input('amount',    mssqlShared.Decimal,   fee)
        .input('userId',    mssqlShared.Int,       userId || null)
        .input('actor',     mssqlShared.NVarChar,  actor)
        .input('receiptNo', mssqlShared.NVarChar,  receiptNo)
        .query(`
          INSERT INTO payments (application_id, payment_type, amount, status, gateway, gateway_txnid, completed_at, paid_by, paid_by_user_id, created_by, receipt_no)
          VALUES (@appId, 'application_fee', @amount, 'success', 'cash',
            CONCAT('CASH-', FORMAT(GETDATE(),'yyyyMMddHHmmss')),
            GETDATE(), 'college', @userId, @actor, @receiptNo)
        `);

      await tx.request()
        .input('id',     mssqlShared.Int,      appId)
        .input('regNum', mssqlShared.NVarChar,  regNum)
        .input('actor',  mssqlShared.NVarChar,  actor)
        .query(`
          UPDATE applications
          SET status = 'submitted', registration_number = @regNum,
              application_fee_paid = 1, submitted_at = GETDATE(),
              updated_at = GETDATE(), status_updated_at = GETDATE(),
              updated_by = @actor
          WHERE id = @id AND status = 'draft'
        `);

      await tx.commit();
    } catch (e) {
      await tx.rollback();
      throw e;
    }

    await logActivity(appId, 'submitted', 'college', `Cash application fee: ₹${fee.toLocaleString('en-IN')}`);

    return res.json({ success: true, message: `Application fee collected and application submitted.`, amount: fee, registration_number: regNum });
  } catch (err) {
    logger.error({ err }, 'record-application-fee error');
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
        SELECT id, status, fee_total_amount, fee_pay_now_amount,
               app_division, course_id, year_of_study
        FROM applications
        WHERE id = @id AND college_id = @col
      `);

    if (!appRes.recordset.length) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    const app = appRes.recordset[0];
    if (!['confirmed', 'fees_paid', 'roll_assigned', 'enrolled'].includes(app.status)) {
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
      const actor     = String(req.user.staff_id || req.user.id);
      const receiptNo = await rcptSvc.next({
        tx,
        pool,
        collegeId,
        paymentType:     'college_fee',
        divisionLetter:  app.app_division || null,
        facultyMasterId: app.course_id,
        yearLevel:       YEAR_LEVEL_MAP[app.year_of_study] || 'FY',
      });

      await tx.request()
        .input('appId',     mssqlShared.Int,      appId)
        .input('amount',    mssqlShared.Decimal,   amt)
        .input('userId',    mssqlShared.Int,       req.user.staff_id || req.user.id)
        .input('actor',     mssqlShared.NVarChar,  actor)
        .input('receiptNo', mssqlShared.NVarChar,  receiptNo)
        .query(`
          INSERT INTO payments (application_id, payment_type, amount, status, gateway,
            gateway_txnid, gateway_payment_id, completed_at, paid_by, paid_by_user_id, created_by, receipt_no)
          VALUES (@appId, 'college_fee', @amount, 'success', 'cash',
            CONCAT('CASH-', CAST(@appId AS NVARCHAR), '-', CAST(CHECKSUM(NEWID()) AS NVARCHAR)),
            CONCAT('CASH-', FORMAT(GETDATE(),'yyyyMMddHHmmss')),
            GETDATE(), 'college', @userId, @actor, @receiptNo)
        `);

      if (firstPaid) {
        await tx.request()
          .input('id',    mssqlShared.Int,      appId)
          .input('actor', mssqlShared.NVarChar, actor)
          .query(`
            UPDATE applications
            SET status = 'fees_paid', college_fee_paid = 1, updated_at = GETDATE(), status_updated_at = GETDATE(), updated_by = @actor
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
      if (firstPaid) getStudentForNotification(appId).then(s => s && whatsapp.notifyAdmissionConfirmed(s, appId));
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

// ── Misc / Exam fee heads ────────────────────────────────────
// GET /:collegeId/fees/misc-exam-heads?type=Misc|ExamFees
router.get('/:collegeId/fees/misc-exam-heads', requirePerm('collect_fees'), async (req, res) => {
  const collegeId = parseInt(req.params.collegeId);
  const { type } = req.query;

  try {
    let typeFilter = `fees_type IN ('Misc','ExamFees')`;
    if (type === 'Misc')     typeFilter = `fees_type = 'Misc'`;
    if (type === 'ExamFees') typeFilter = `fees_type = 'ExamFees'`;

    // Misc/Exam heads have a single flat amount (fees_cat1_amount) — no per-category variation
    const result = await db.request()
      .input('cid', mssqlShared.Int, collegeId)
      .query(`
        SELECT fees_code, fees_head, short_name, fees_type, academic_year,
               fees_cat1_amount AS amount
        FROM fees_master
        WHERE college_id = @cid
          AND ${typeFilter}
          AND is_active = 1
        ORDER BY sequence_auto_fees, fees_head
      `);

    const data = result.recordset.map(row => ({
      fees_code:    row.fees_code,
      fees_head:    row.fees_head,
      short_name:   row.short_name,
      fees_type:    row.fees_type,
      academic_year: row.academic_year,
      amount:       parseFloat(row.amount) || 0,
    }));

    return res.json({ success: true, data });
  } catch (err) {
    logger.error({ err }, 'misc-exam-heads error');
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Create misc / exam fee for online payment ────────────────
// POST /:collegeId/applications/:appId/create-misc-fee
// body: { payment_type: 'misc_fee'|'exam_fee', fee_codes: [], note? }
router.post('/:collegeId/applications/:appId/create-misc-fee', requirePerm('collect_fees'), async (req, res) => {
  const { payment_type, fee_codes, note, amount: amountOverride } = req.body;
  const appId     = parseInt(req.params.appId);
  const collegeId = parseInt(req.params.collegeId);

  if (!['misc_fee', 'exam_fee'].includes(payment_type)) {
    return res.status(400).json({ success: false, message: 'payment_type must be misc_fee or exam_fee.' });
  }
  if (!Array.isArray(fee_codes) || fee_codes.length === 0) {
    return res.status(400).json({ success: false, message: 'fee_codes must be a non-empty array.' });
  }

  try {
    const appRes = await db.request()
      .input('id',  mssqlShared.Int, appId)
      .input('col', mssqlShared.Int, collegeId)
      .query(`SELECT id, status FROM applications WHERE id = @id AND college_id = @col`);

    if (!appRes.recordset.length) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    const app = appRes.recordset[0];
    if (!['confirmed', 'fees_paid', 'roll_assigned', 'enrolled'].includes(app.status)) {
      return res.status(400).json({ success: false, message: 'Application must be confirmed, fees_paid, roll_assigned, or enrolled.' });
    }

    // Fetch fee heads for the given fee_codes from fees_master
    const feeCodesParam = fee_codes.map(c => parseInt(c)).filter(c => !isNaN(c));
    if (feeCodesParam.length === 0) {
      return res.status(400).json({ success: false, message: 'fee_codes contains no valid integers.' });
    }
    const feeCodesStr = feeCodesParam.join(',');
    const headsRes = await db.request()
      .input('cid', mssqlShared.Int, collegeId)
      .query(`
        SELECT fees_code, fees_head, fees_cat1_amount AS amount
        FROM fees_master
        WHERE college_id = @cid
          AND fees_code IN (${feeCodesStr})
          AND is_active = 1
      `);

    if (!headsRes.recordset.length) {
      return res.status(400).json({ success: false, message: 'No matching fee heads found.' });
    }

    const feeHeads = headsRes.recordset.map(r => ({
      fees_code: r.fees_code,
      fees_head: r.fees_head,
      amount:    parseFloat(r.amount) || 0,
    }));
    const autoAmount = feeHeads.reduce((s, h) => s + h.amount, 0);
    const amount = amountOverride != null && parseFloat(amountOverride) > 0
      ? parseFloat(amountOverride)
      : autoAmount;

    if (amount <= 0) {
      return res.status(400).json({ success: false, message: 'Total amount must be greater than zero.' });
    }

    const notesJson = JSON.stringify({
      fee_codes: feeCodesParam,
      ...(note ? { note } : {}),
    });

    const actor  = String(req.user.staff_id || req.user.id);
    const userId = req.user.staff_id || req.user.id;
    // Use a placeholder txnid — will be replaced by PayU txnid when student pays
    const pendingTxnid = `MISC-PENDING-${appId}-${Date.now()}`;

    await db.request()
      .input('appId',   mssqlShared.Int,      appId)
      .input('ptype',   mssqlShared.NVarChar,  payment_type)
      .input('amount',  mssqlShared.Decimal,   amount)
      .input('txnid',   mssqlShared.NVarChar,  pendingTxnid)
      .input('userId',  mssqlShared.Int,       userId)
      .input('actor',   mssqlShared.NVarChar,  actor)
      .input('notes',   mssqlShared.NVarChar,  notesJson)
      .query(`
        INSERT INTO payments
          (application_id, payment_type, amount, status, gateway,
           gateway_txnid, paid_by, paid_by_user_id, created_by, notes)
        VALUES
          (@appId, @ptype, @amount, 'pending', 'online',
           @txnid, 'student', @userId, @actor, @notes)
      `);

    const idRes = await db.request().query(`SELECT SCOPE_IDENTITY() AS id`);
    const paymentId = idRes.recordset[0]?.id;

    return res.json({
      success: true,
      data: {
        payment_id: paymentId,
        amount,
        fee_heads: feeHeads,
      },
    });
  } catch (err) {
    logger.error({ err }, 'create-misc-fee error');
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Record misc / exam fee cash payment ──────────────────────
// POST /:collegeId/applications/:appId/record-misc-payment
// body: { payment_type: 'misc_fee'|'exam_fee', amount, fee_codes?: [], note? }
router.post('/:collegeId/applications/:appId/record-misc-payment', requirePerm('collect_fees'), async (req, res) => {
  const { payment_type, amount, fee_codes, note } = req.body;
  const amt = parseFloat(amount);

  if (!['misc_fee', 'exam_fee'].includes(payment_type)) {
    return res.status(400).json({ success: false, message: 'payment_type must be misc_fee or exam_fee.' });
  }
  if (!amt || amt <= 0) {
    return res.status(400).json({ success: false, message: 'Amount must be a positive number.' });
  }

  const appId     = parseInt(req.params.appId);
  const collegeId = parseInt(req.params.collegeId);

  try {
    const appRes = await db.request()
      .input('id',  mssqlShared.Int, appId)
      .input('col', mssqlShared.Int, collegeId)
      .query(`SELECT id, status FROM applications WHERE id = @id AND college_id = @col`);

    if (!appRes.recordset.length) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    const app = appRes.recordset[0];
    if (!['confirmed', 'fees_paid', 'roll_assigned', 'enrolled'].includes(app.status)) {
      return res.status(400).json({ success: false, message: 'Application must be confirmed, fees_paid, roll_assigned, or enrolled.' });
    }

    const actor  = String(req.user.staff_id || req.user.id);
    const userId = req.user.staff_id || req.user.id;

    // Build notes JSON if fee_codes provided
    const notesJson = (() => {
      const parts = {};
      if (fee_codes && Array.isArray(fee_codes) && fee_codes.length) parts.fee_codes = fee_codes;
      if (note) parts.note = note;
      return Object.keys(parts).length ? JSON.stringify(parts) : null;
    })();

    // Check if payments table has a notes column
    const colCheck = await db.request().query(`
      SELECT COUNT(*) AS cnt
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'payments' AND COLUMN_NAME = 'notes'
    `);
    const hasNotes = colCheck.recordset[0].cnt > 0;

    if (hasNotes && notesJson) {
      await db.request()
        .input('appId',   mssqlShared.Int,      appId)
        .input('ptype',   mssqlShared.NVarChar,  payment_type)
        .input('amount',  mssqlShared.Decimal,   amt)
        .input('userId',  mssqlShared.Int,       userId)
        .input('actor',   mssqlShared.NVarChar,  actor)
        .input('notes',   mssqlShared.NVarChar,  notesJson)
        .query(`
          INSERT INTO payments
            (application_id, payment_type, amount, status, gateway,
             gateway_txnid, gateway_payment_id, completed_at, paid_by, paid_by_user_id, created_by, notes)
          VALUES
            (@appId, @ptype, @amount, 'success', 'cash',
             CONCAT('CASH-MISC-', CAST(@appId AS NVARCHAR), '-', CAST(CHECKSUM(NEWID()) AS NVARCHAR)),
             CONCAT('CASH-MISC-', FORMAT(GETDATE(),'yyyyMMddHHmmss')),
             GETDATE(), 'college', @userId, @actor, @notes)
        `);
    } else {
      await db.request()
        .input('appId',   mssqlShared.Int,      appId)
        .input('ptype',   mssqlShared.NVarChar,  payment_type)
        .input('amount',  mssqlShared.Decimal,   amt)
        .input('userId',  mssqlShared.Int,       userId)
        .input('actor',   mssqlShared.NVarChar,  actor)
        .query(`
          INSERT INTO payments
            (application_id, payment_type, amount, status, gateway,
             gateway_txnid, gateway_payment_id, completed_at, paid_by, paid_by_user_id, created_by)
          VALUES
            (@appId, @ptype, @amount, 'success', 'cash',
             CONCAT('CASH-MISC-', CAST(@appId AS NVARCHAR), '-', CAST(CHECKSUM(NEWID()) AS NVARCHAR)),
             CONCAT('CASH-MISC-', FORMAT(GETDATE(),'yyyyMMddHHmmss')),
             GETDATE(), 'college', @userId, @actor)
        `);
    }

    return res.json({ success: true, message: 'Payment recorded.', data: { amount: amt } });
  } catch (err) {
    logger.error({ err }, 'record-misc-payment error');
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Misc / Exam fee receipts list ────────────────────────────
// GET /:collegeId/misc-exam-receipts?type=misc_fee|exam_fee&q=&page=&limit=
router.get('/:collegeId/misc-exam-receipts', requirePerm('collect_fees'), async (req, res) => {
  const collegeId = parseInt(req.params.collegeId);
  const { type, q } = req.query;
  const { page, limit, offset } = parsePage(req.query);

  try {
    const pool3 = await db;
    const extraInputs3 = [];

    let typeFilter = `p.payment_type IN ('misc_fee','exam_fee')`;
    if (type === 'misc_fee')  typeFilter = `p.payment_type = 'misc_fee'`;
    if (type === 'exam_fee')  typeFilter = `p.payment_type = 'exam_fee'`;

    let whereQ = '';
    if (q) {
      whereQ = ` AND (s.full_name LIKE @q OR s.phone LIKE @q OR a.registration_number LIKE @q)`;
      extraInputs3.push(r => r.input('q', `%${q.trim()}%`));
    }

    // Check if notes column exists (cached once per process ideally, but simple check here)
    const colCheck3 = await db.request().query(`
      SELECT COUNT(*) AS cnt
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'payments' AND COLUMN_NAME = 'notes'
    `);
    const hasNotes3 = colCheck3.recordset[0].cnt > 0;
    const notesSelect = hasNotes3 ? ', p.notes' : ', NULL AS notes';

    const joins3 = `
      FROM payments p
      JOIN applications a ON a.id = p.application_id
      JOIN students s ON s.id = a.student_id
      LEFT JOIN faculty_master fm ON fm.code_no = a.course_id AND fm.college_id = a.college_id
    `;
    const where3 = `
      WHERE a.college_id = @col
        AND ${typeFilter}
        ${whereQ}
    `;

    function makeRequest3() {
      const r = pool3.request().input('col', collegeId);
      extraInputs3.forEach(fn => fn(r));
      return r;
    }

    const [countRes3, dataRes3] = await Promise.all([
      makeRequest3().query(`SELECT COUNT(*) AS total ${joins3} ${where3}`),
      makeRequest3().query(`
        SELECT
          p.id           AS payment_id,
          a.id           AS application_id,
          a.registration_number,
          a.year_of_study,
          s.full_name    AS student_name,
          s.phone        AS student_phone,
          COALESCE(CONCAT(fm.degree_course_code, ' — ', fm.degree_course_name), CAST(a.course_id AS NVARCHAR)) AS course_name,
          p.payment_type,
          p.amount,
          p.status,
          p.completed_at,
          p.gateway
          ${notesSelect}
        ${joins3} ${where3}
        ORDER BY p.completed_at DESC
        ${paginateQuery(offset, limit)}
      `),
    ]);

    // Resolve fee_codes from notes JSON → fee head names
    const rows3 = dataRes3.recordset;
    const allFeeCodes = new Set();
    rows3.forEach(r => {
      try {
        const parsed = r.notes ? JSON.parse(r.notes) : {};
        if (Array.isArray(parsed.fee_codes)) parsed.fee_codes.forEach(c => allFeeCodes.add(parseInt(c)));
      } catch { /* ignore */ }
    });

    let feeHeadMap = {}; // fees_code → { fees_head, short_name }
    if (allFeeCodes.size > 0) {
      const codesArr = [...allFeeCodes].join(',');
      const fhRes = await db.request()
        .input('cid', mssqlShared.Int, collegeId)
        .query(`SELECT fees_code, fees_head, short_name FROM fees_master WHERE college_id=@cid AND fees_code IN (${codesArr})`);
      fhRes.recordset.forEach(h => { feeHeadMap[h.fees_code] = h; });
    }

    const enrichedRows = rows3.map(r => {
      let fee_heads = [];
      try {
        const parsed = r.notes ? JSON.parse(r.notes) : {};
        if (Array.isArray(parsed.fee_codes)) {
          fee_heads = parsed.fee_codes
            .map(c => feeHeadMap[parseInt(c)])
            .filter(Boolean)
            .map(h => ({ fees_code: h.fees_code, fees_head: h.fees_head, short_name: h.short_name }));
        }
      } catch { /* ignore */ }
      return { ...r, fee_heads };
    });

    return res.json(paginatedResponse(enrichedRows, countRes3.recordset[0].total, page, limit));
  } catch (err) {
    logger.error({ err }, 'misc-exam-receipts error');
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Generate roll numbers (batch) ───────────────────────────
router.post('/:collegeId/roll-numbers/generate', requirePerm('assign_subjects'), async (req, res) => {
  const { course_id, year_of_study } = req.body;

  if (!course_id) {
    return res.status(400).json({ success: false, message: 'course_id is required.' });
  }
  if (!year_of_study) {
    return res.status(400).json({ success: false, message: 'year_of_study is required.' });
  }

  try {
    // Find highest existing roll number for this college + course + year_of_study
    const maxRes = await db.request()
      .input('col', parseInt(req.params.collegeId))
      .input('crs', parseInt(course_id))
      .input('yr',  parseInt(year_of_study))
      .query(`
        SELECT MAX(CAST(roll_number AS INT)) AS max_roll
        FROM applications
        WHERE college_id = @col AND course_id = @crs AND year_of_study = @yr
          AND roll_number IS NOT NULL
          AND ISNUMERIC(roll_number) = 1
      `);

    let nextRoll = (maxRes.recordset[0].max_roll || 0) + 1;

    // Get fees_paid applications without a roll number for this college + course + year_of_study,
    // ordered by when fee was paid (first-come first-served)
    const pending = await db.request()
      .input('col', parseInt(req.params.collegeId))
      .input('crs', parseInt(course_id))
      .input('yr',  parseInt(year_of_study))
      .query(`
        SELECT id FROM applications
        WHERE college_id = @col AND course_id = @crs AND year_of_study = @yr
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
      const rollActor = String(req.user.staff_id || req.user.id);
      for (const app of pending.recordset) {
        await tx4.request()
          .input('id',    mssqlShared.Int,      app.id)
          .input('roll',  mssqlShared.NVarChar,  String(nextRoll))
          .input('actor', mssqlShared.NVarChar,  rollActor)
          .query(`
            UPDATE applications
            SET roll_number = @roll, status = 'roll_assigned', updated_at = GETDATE(), updated_by = @actor
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
      getStudentForNotification(id).then(s => s && whatsapp.notifyRollAssigned(s, roll, id));
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
        AND (a.fee_total_amount > 0 OR ISNULL(psum.total_paid, 0) > 0)
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
          a.app_category,
          a.app_special_status,
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

// ── GET /:collegeId/reports/fees-collection ───────────────────────────────────
// Query params:
//   date_from     YYYY-MM-DD  (default: today)
//   date_to       YYYY-MM-DD  (default: today)
//   course_id     number      (optional)
//   year_of_study 1-5         (optional)
//   payment_type  college_fee|application_fee|all (default: college_fee)
//   academic_year YYYY-YY     (optional)
//   pay_mode      cash|online (optional)
router.get('/:collegeId/reports/fees-collection', requirePerm('collect_fees'), async (req, res) => {
  const collegeId = parseInt(req.params.collegeId);
  const {
    date_from,
    date_to,
    course_id,
    year_of_study,
    payment_type = 'college_fee',
    academic_year,
    pay_mode,
    grant_type,   // 'Granted' | 'NonGranted'
  } = req.query;

  // Default to today
  const today = new Date().toISOString().slice(0, 10);
  const from  = date_from || today;
  const to    = date_to   || today;

  try {
    const r = db.request()
      .input('cid',   mssqlShared.Int,      collegeId)
      .input('from',  mssqlShared.Date,     from)
      .input('to',    mssqlShared.Date,     to);

    // Optional filters
    const courseFilter = course_id    ? `AND a.course_id = @cid2`       : '';
    const yearFilter   = year_of_study ? `AND a.year_of_study = @yr`    : '';
    const typeFilter   = payment_type !== 'all' ? `AND p.payment_type = @ptype` : '';
    const ayFilter     = academic_year ? `AND a.academic_year = @ay`    : '';
    const modeFilter   = pay_mode === 'cash'
      ? `AND (p.gateway = 'cash' OR p.gateway_txnid LIKE 'CASH-%' OR p.gateway IS NULL)`
      : pay_mode === 'online'
      ? `AND (p.gateway <> 'cash' AND p.gateway_txnid NOT LIKE 'CASH-%' AND p.gateway IS NOT NULL)`
      : '';
    // grant_type filter requires joining division_master
    const grantJoin   = grant_type ? `LEFT JOIN division_master dm ON dm.college_id = a.college_id AND dm.faculty_master_id = a.course_id AND dm.division_letter = a.app_division AND dm.year_level = CASE a.year_of_study WHEN 1 THEN 'FY' WHEN 2 THEN 'SY' WHEN 3 THEN 'TY' WHEN 4 THEN '4Y' WHEN 5 THEN '5Y' END` : '';
    const grantFilter = grant_type ? `AND dm.funding_type = @gtype` : '';

    if (course_id)     r.input('cid2',  mssqlShared.Int,      parseInt(course_id));
    if (year_of_study) r.input('yr',    mssqlShared.TinyInt,  parseInt(year_of_study));
    if (payment_type !== 'all') r.input('ptype', mssqlShared.NVarChar, payment_type);
    if (academic_year) r.input('ay',    mssqlShared.NVarChar, academic_year);
    if (grant_type)    r.input('gtype', mssqlShared.NVarChar, grant_type);

    const allFilters = `${courseFilter} ${yearFilter} ${typeFilter} ${ayFilter} ${modeFilter} ${grantFilter}`

    function addOptionalInputs(req) {
      if (course_id)     req.input('cid2',  mssqlShared.Int,      parseInt(course_id));
      if (year_of_study) req.input('yr',    mssqlShared.TinyInt,  parseInt(year_of_study));
      if (payment_type !== 'all') req.input('ptype', mssqlShared.NVarChar, payment_type);
      if (academic_year) req.input('ay',    mssqlShared.NVarChar, academic_year);
      if (grant_type)    req.input('gtype', mssqlShared.NVarChar, grant_type);
      return req;
    }

    // ── Summary totals ────────────────────────────────────────────────────────
    const summaryRes = await r.query(`
      SELECT
        COUNT(DISTINCT p.id)           AS txn_count,
        ISNULL(SUM(p.amount), 0)       AS total_collected,
        COUNT(DISTINCT p.application_id) AS student_count,
        ISNULL(SUM(CASE WHEN p.gateway='cash' OR p.gateway_txnid LIKE 'CASH-%' OR p.gateway IS NULL THEN p.amount ELSE 0 END), 0) AS cash_amount,
        ISNULL(SUM(CASE WHEN p.gateway IS NOT NULL AND p.gateway<>'cash' AND p.gateway_txnid NOT LIKE 'CASH-%' THEN p.amount ELSE 0 END), 0) AS online_amount
      FROM payments p
      JOIN applications a ON a.id = p.application_id
      ${grantJoin}
      WHERE a.college_id = @cid
        AND p.status = 'success'
        AND CAST(p.completed_at AS DATE) BETWEEN @from AND @to
        ${allFilters}
    `);
    const summary = summaryRes.recordset[0];

    // ── Day-wise breakdown ────────────────────────────────────────────────────
    const r2 = addOptionalInputs(db.request()
      .input('cid',  mssqlShared.Int,  collegeId)
      .input('from', mssqlShared.Date, from)
      .input('to',   mssqlShared.Date, to));

    const dayRes = await r2.query(`
      SELECT
        CAST(p.completed_at AS DATE)   AS date,
        COUNT(p.id)                    AS txn_count,
        ISNULL(SUM(p.amount), 0)       AS total,
        ISNULL(SUM(CASE WHEN p.gateway='cash' OR p.gateway_txnid LIKE 'CASH-%' THEN p.amount ELSE 0 END), 0) AS cash,
        ISNULL(SUM(CASE WHEN p.gateway<>'cash' AND p.gateway_txnid NOT LIKE 'CASH-%' THEN p.amount ELSE 0 END), 0) AS online
      FROM payments p
      JOIN applications a ON a.id = p.application_id
      ${grantJoin}
      WHERE a.college_id = @cid
        AND p.status = 'success'
        AND CAST(p.completed_at AS DATE) BETWEEN @from AND @to
        ${allFilters}
      GROUP BY CAST(p.completed_at AS DATE)
      ORDER BY CAST(p.completed_at AS DATE)
    `);

    // ── Course-wise breakdown ─────────────────────────────────────────────────
    const r3 = addOptionalInputs(db.request()
      .input('cid',  mssqlShared.Int,  collegeId)
      .input('from', mssqlShared.Date, from)
      .input('to',   mssqlShared.Date, to));

    const courseRes = await r3.query(`
      SELECT
        a.course_id,
        COALESCE(fm.degree_course_name, CAST(a.course_id AS NVARCHAR)) AS course_name,
        a.year_of_study,
        COUNT(p.id)              AS txn_count,
        ISNULL(SUM(p.amount), 0) AS total
      FROM payments p
      JOIN applications a ON a.id = p.application_id
      LEFT JOIN faculty_master fm ON fm.code_no = a.course_id AND fm.college_id = a.college_id
      ${grantJoin}
      WHERE a.college_id = @cid
        AND p.status = 'success'
        AND CAST(p.completed_at AS DATE) BETWEEN @from AND @to
        ${allFilters}
      GROUP BY a.course_id, fm.degree_course_name, a.year_of_study
      ORDER BY total DESC
    `);

    // ── Individual transactions ───────────────────────────────────────────────
    const r4 = addOptionalInputs(db.request()
      .input('cid',  mssqlShared.Int,  collegeId)
      .input('from', mssqlShared.Date, from)
      .input('to',   mssqlShared.Date, to));

    const txnRes = await r4.query(`
      SELECT TOP 200
        p.id, p.amount, p.payment_type, p.gateway, p.gateway_txnid, p.gateway_payment_id, p.completed_at,
        a.id AS app_id, a.year_of_study, a.academic_year, a.app_division,
        COALESCE(
          NULLIF(LTRIM(RTRIM(ISNULL(a.app_surname,'')+' '+ISNULL(a.app_first_name,'')+' '+ISNULL(a.app_middle_name,''))), ''),
          s.full_name
        ) AS student_name,
        a.registration_number,
        COALESCE(fm.degree_course_name, CAST(a.course_id AS NVARCHAR)) AS course_name,
        CASE WHEN plt.id IS NOT NULL THEN 1 ELSE 0 END AS via_payment_link
      FROM payments p
      JOIN applications a ON a.id = p.application_id
      JOIN students s ON s.id = a.student_id
      LEFT JOIN faculty_master fm ON fm.code_no = a.course_id AND fm.college_id = a.college_id
      LEFT JOIN payment_link_tokens plt ON plt.gateway_txnid = p.gateway_txnid AND plt.gateway_txnid IS NOT NULL
      ${grantJoin}
      WHERE a.college_id = @cid
        AND p.status = 'success'
        AND CAST(p.completed_at AS DATE) BETWEEN @from AND @to
        ${allFilters}
      ORDER BY p.completed_at DESC
    `);

    const colRes = await db.request()
      .input('cid', mssqlShared.Int, collegeId)
      .query(`SELECT name, address FROM colleges WHERE id = @cid`);
    const college = colRes.recordset[0] || {};

    return res.json({
      success: true,
      data: {
        college_name:    college.name || '',
        college_address: college.address || '',
        summary: {
          total_collected: parseFloat(summary.total_collected) || 0,
          txn_count:       summary.txn_count || 0,
          student_count:   summary.student_count || 0,
          cash_amount:     parseFloat(summary.cash_amount) || 0,
          online_amount:   parseFloat(summary.online_amount) || 0,
        },
        by_day:    dayRes.recordset.map(r => ({ ...r, total: parseFloat(r.total), cash: parseFloat(r.cash), online: parseFloat(r.online) })),
        by_course: courseRes.recordset.map(r => ({ ...r, total: parseFloat(r.total) })),
        transactions: txnRes.recordset,
        filters: { from, to, course_id: course_id || null, year_of_study: year_of_study || null, payment_type, academic_year: academic_year || null, pay_mode: pay_mode || null, grant_type: grant_type || null },
      },
    });
  } catch (err) {
    logger.error({ err }, 'reports/fees-collection error');
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /:collegeId/reports/fees-by-head ──────────────────────────────────────
// Returns fee-head-level totals for the given period/filters.
// Used for: Total Fees Collection, Bankwise Statement, Daily Fees Register.
// Query params: same as fees-collection endpoint.
router.get('/:collegeId/reports/fees-by-head', requirePerm('collect_fees'), async (req, res) => {
  const collegeId = parseInt(req.params.collegeId);
  const {
    date_from,
    date_to,
    course_id,
    year_of_study,
    payment_type = 'college_fee',
    academic_year,
    pay_mode,
    grant_type,
  } = req.query;

  const today = new Date().toISOString().slice(0, 10);
  const from  = date_from || today;
  const to    = date_to   || today;

  try {
    // ── Build filters ─────────────────────────────────────────────────────────
    const courseFilter = course_id     ? `AND a.course_id = @cid2`           : '';
    const yearFilter   = year_of_study ? `AND a.year_of_study = @yr`         : '';
    const typeFilter   = payment_type !== 'all' ? `AND p.payment_type = @ptype` : '';
    const ayFilter     = academic_year ? `AND a.academic_year = @ay`         : '';
    const modeFilter   = pay_mode === 'cash'
      ? `AND (p.gateway = 'cash' OR p.gateway_txnid LIKE 'CASH-%' OR p.gateway IS NULL)`
      : pay_mode === 'online'
      ? `AND (p.gateway <> 'cash' AND p.gateway_txnid NOT LIKE 'CASH-%' AND p.gateway IS NOT NULL)`
      : '';
    const grantJoin   = grant_type ? `LEFT JOIN division_master dm ON dm.college_id = a.college_id AND dm.faculty_master_id = a.course_id AND dm.division_letter = a.app_division AND dm.year_level = CASE a.year_of_study WHEN 1 THEN 'FY' WHEN 2 THEN 'SY' WHEN 3 THEN 'TY' WHEN 4 THEN '4Y' WHEN 5 THEN '5Y' END` : '';
    const grantFilter = grant_type ? `AND dm.funding_type = @gtype` : '';
    const allFilters  = `${courseFilter} ${yearFilter} ${typeFilter} ${ayFilter} ${modeFilter} ${grantFilter}`;

    const rPay = db.request()
      .input('cid',  mssqlShared.Int,  collegeId)
      .input('from', mssqlShared.Date, from)
      .input('to',   mssqlShared.Date, to);
    if (course_id)     rPay.input('cid2',  mssqlShared.Int,      parseInt(course_id));
    if (year_of_study) rPay.input('yr',    mssqlShared.TinyInt,  parseInt(year_of_study));
    if (payment_type !== 'all') rPay.input('ptype', mssqlShared.NVarChar, payment_type);
    if (academic_year) rPay.input('ay',    mssqlShared.NVarChar, academic_year);
    if (grant_type)    rPay.input('gtype', mssqlShared.NVarChar, grant_type);

    // Fetch all matching payments with app context
    const payRes = await rPay.query(`
      SELECT
        p.id AS payment_id,
        p.amount,
        p.payment_type,
        p.gateway,
        p.gateway_txnid,
        p.completed_at,
        a.id AS app_id,
        a.course_id,
        a.year_of_study,
        a.academic_year AS app_academic_year,
        a.app_division,
        a.app_caste,
        a.app_special_status,
        a.registration_number,
        COALESCE(
          NULLIF(LTRIM(RTRIM(ISNULL(a.app_surname,'')+' '+ISNULL(a.app_first_name,'')+' '+ISNULL(a.app_middle_name,''))), ''),
          s.full_name
        ) AS student_name,
        fm.code_no AS faculty_master_id,
        CASE a.year_of_study
          WHEN 1 THEN 'FY' WHEN 2 THEN 'SY' WHEN 3 THEN 'TY'
          WHEN 4 THEN '4Y' WHEN 5 THEN '5Y' ELSE NULL
        END AS year_level,
        COALESCE(fm.degree_course_name, CAST(a.course_id AS NVARCHAR)) AS course_name,
        fm.degree_course_code
      FROM payments p
      JOIN applications a ON a.id = p.application_id
      JOIN students s ON s.id = a.student_id
      LEFT JOIN faculty_master fm ON fm.code_no = a.course_id AND fm.college_id = a.college_id
      ${grantJoin}
      WHERE a.college_id = @cid
        AND p.status = 'success'
        AND CAST(p.completed_at AS DATE) BETWEEN @from AND @to
        ${allFilters}
      ORDER BY CAST(p.completed_at AS DATE), a.course_id, a.year_of_study, student_name
    `);

    const payments = payRes.recordset;

    // ── For each unique application, compute fee breakdown ───────────────────
    // Cache by app_id to avoid redundant computation
    const breakdownCache = new Map(); // app_id → { breakdown, platformTotal }

    async function getBreakdown(pmt) {
      if (breakdownCache.has(pmt.app_id)) return breakdownCache.get(pmt.app_id);
      try {
        const feeResult = await feeSvc.compute({
          collegeId,
          facultyMasterId: pmt.faculty_master_id,
          yearLevel:       pmt.year_level,
          divisionLetter:  pmt.app_division,
          caste:           pmt.app_caste,
          specialStatus:   pmt.app_special_status,
          academicYear:    pmt.app_academic_year || null,
          pool:            db,
        });
        let breakdown = feeResult?.breakdown || [];

        // Fallback: if classwise INNER JOIN returned nothing, fetch fees_master heads
        // directly for this AY (proportional split using master amounts).
        if (breakdown.length === 0 && pmt.app_academic_year) {
          const fbSlab = feeResult?.feesCategorySlab || 1;
          const fbRes = await db.request()
            .input('cid', mssqlShared.Int, collegeId)
            .input('ay',  mssqlShared.NVarChar, pmt.app_academic_year)
            .query(`
              SELECT fees_code, fees_head, short_name, fees_type, is_refundable,
                     fees_cat1_amount, fees_cat2_amount, fees_cat3_amount, fees_cat4_amount,
                     fees_cat5_amount, fees_cat6_amount, fees_cat7_amount, fees_cat8_amount
              FROM fees_master
              WHERE college_id = @cid AND academic_year = @ay AND is_active = 1
              ORDER BY sequence_auto_fees
            `);
          breakdown = fbRes.recordset.map(r => ({
            fees_code:    r.fees_code,
            fees_head:    r.fees_head,
            short_name:   r.short_name,
            fees_type:    r.fees_type,
            is_refundable: !!r.is_refundable,
            amount:       parseFloat(r[`fees_cat${fbSlab}_amount`] || r.fees_cat1_amount || 0),
          }));
        }

        const clearable = breakdown.filter(h => (h.fees_type || '').toLowerCase() !== 'platform');
        const platformTotal = breakdown
          .filter(h => (h.fees_type || '').toLowerCase() === 'platform')
          .reduce((s, h) => s + (parseFloat(h.amount) || 0), 0);
        const result = { clearable, platformTotal };
        breakdownCache.set(pmt.app_id, result);
        return result;
      } catch (_) {
        breakdownCache.set(pmt.app_id, { clearable: [], platformTotal: 0 });
        return { clearable: [], platformTotal: 0 };
      }
    }

    // ── Distribute each payment across fee heads ─────────────────────────────
    // Track cumulative paid per app across all payments (ordered by date)
    const appCumulative = new Map();  // app_id → { cumBefore, platformDebt }

    // fee-head totals: fees_code → { fees_code, fees_head, short_name, fees_type, total_collected }
    const headTotals = new Map();

    // bank-grouped totals: will need fees_master bank info — fetch separately
    // Per-student register rows
    const studentRows = [];

    for (const pmt of payments) {
      const { clearable, platformTotal } = await getBreakdown(pmt);
      const pmtAmt = parseFloat(pmt.amount);

      if (clearable.length === 0) {
        // Still no breakdown after fallback — skip head distribution, record row with no head amounts
        studentRows.push({
          payment_id:        pmt.payment_id,
          app_id:            pmt.app_id,
          student_name:      pmt.student_name,
          registration_number: pmt.registration_number,
          course_name:       pmt.course_name,
          degree_course_code: pmt.degree_course_code,
          year_of_study:     pmt.year_of_study,
          app_division:      pmt.app_division,
          completed_at:      pmt.completed_at,
          payment_type:      pmt.payment_type,
          gateway:           pmt.gateway,
          gateway_txnid:     pmt.gateway_txnid,
          amount:            pmtAmt,
          head_amounts:      {},
        });
        continue;
      }

      if (!appCumulative.has(pmt.app_id)) {
        appCumulative.set(pmt.app_id, { cumBefore: 0, platformDebt: platformTotal });
      }
      const appState = appCumulative.get(pmt.app_id);

      const platformConsumed = Math.min(appState.platformDebt, pmtAmt);
      appState.platformDebt -= platformConsumed;
      const effectiveAmt = pmtAmt - platformConsumed;
      const cumAfter = appState.cumBefore + effectiveAmt;

      let running = 0;
      const headAmounts = {};
      for (const h of clearable) {
        const headAmt   = parseFloat(h.amount) || 0;
        const headStart = running;
        const headEnd   = running + headAmt;
        running = headEnd;
        const overlapStart = Math.max(appState.cumBefore, headStart);
        const overlapEnd   = Math.min(cumAfter, headEnd);
        const paid = Math.max(0, overlapEnd - overlapStart);
        if (paid > 0.005) {
          headAmounts[h.fees_code] = (headAmounts[h.fees_code] || 0) + paid;
          if (!headTotals.has(h.fees_code)) {
            headTotals.set(h.fees_code, {
              fees_code:       h.fees_code,
              fees_head:       h.fees_head,
              short_name:      h.short_name,
              fees_type:       h.fees_type,
              total_collected: 0,
            });
          }
          headTotals.get(h.fees_code).total_collected += paid;
        }
      }
      appState.cumBefore = cumAfter;

      studentRows.push({
        payment_id:        pmt.payment_id,
        app_id:            pmt.app_id,
        student_name:      pmt.student_name,
        registration_number: pmt.registration_number,
        course_name:       pmt.course_name,
        degree_course_code: pmt.degree_course_code,
        year_of_study:     pmt.year_of_study,
        app_division:      pmt.app_division,
        completed_at:      pmt.completed_at,
        payment_type:      pmt.payment_type,
        gateway:           pmt.gateway,
        gateway_txnid:     pmt.gateway_txnid,
        amount:            pmtAmt,
        head_amounts:      headAmounts,
      });
    }

    // ── Fetch fees_master with bank info for the relevant heads ──────────────
    const headCodes = [...headTotals.keys()];
    let feesWithBank = [];
    if (headCodes.length > 0) {
      const codesParam = headCodes.join(',');
      const bankRes = await db.request()
        .input('cid', mssqlShared.Int, collegeId)
        .query(`
          SELECT fm.fees_code, fm.fees_head, fm.short_name, fm.fees_type,
                 fm.sequence_auto_fees, fm.credit_to_bank_ledger, fm.academic_year,
                 bm.bank_name, bm.bank_account_number, bm.branch
          FROM fees_master fm
          LEFT JOIN bank_master bm ON bm.ledger_code = fm.credit_to_bank_ledger AND bm.college_id = @cid
          WHERE fm.college_id = @cid
            AND fm.fees_code IN (${codesParam})
          ORDER BY fm.sequence_auto_fees
        `);
      feesWithBank = bankRes.recordset;
    }

    // Merge bank info into headTotals
    const headList = feesWithBank.map(f => ({
      ...headTotals.get(f.fees_code),
      sequence_auto_fees:    f.sequence_auto_fees,
      credit_to_bank_ledger: f.credit_to_bank_ledger,
      academic_year:         f.academic_year,
      bank_name:             f.bank_name,
      bank_account_number:   f.bank_account_number,
      branch:                f.branch,
    })).filter(Boolean);


    // ── Build bankwise grouping ───────────────────────────────────────────────
    const bankGroups = new Map(); // ledger_code → { bank_name, bank_account_number, branch, heads[], total }
    for (const h of headList) {
      const key = h.credit_to_bank_ledger ?? 'unassigned';
      if (!bankGroups.has(key)) {
        bankGroups.set(key, {
          ledger_code:        key,
          bank_name:          h.bank_name || 'Unassigned',
          bank_account_number: h.bank_account_number || '',
          branch:             h.branch || '',
          heads:              [],
          total:              0,
        });
      }
      const bg = bankGroups.get(key);
      bg.heads.push({ fees_code: h.fees_code, fees_head: h.fees_head, short_name: h.short_name, academic_year: h.academic_year, total_collected: h.total_collected });
      bg.total += h.total_collected;
    }

    // ── Collect info ─────────────────────────────────────────────────────────
    const colRes = await db.request()
      .input('cid', mssqlShared.Int, collegeId)
      .query(`SELECT name, address, phone FROM colleges WHERE id = @cid`);
    const college = colRes.recordset[0] || {};

    return res.json({
      success: true,
      data: {
        college,
        head_totals: headList,
        bank_groups: [...bankGroups.values()],
        student_rows: studentRows,
        filters: { from, to, course_id: course_id || null, year_of_study: year_of_study || null, payment_type, academic_year: academic_year || null, pay_mode: pay_mode || null, grant_type: grant_type || null },
      },
    });
  } catch (err) {
    logger.error({ err }, 'reports/fees-by-head error');
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
