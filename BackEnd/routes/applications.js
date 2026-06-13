/**
 * applications.js — Student-facing application endpoints.
 *
 * GET  /applications?student_id=&academic_year=   — list student's applications
 * GET  /applications/:id                           — single application detail
 * POST /applications                               — create draft application
 * POST /applications/:id/submit                   — simulate payment success → submitted
 * GET  /applications/:id/subjects                 — get available subjects
 * POST /applications/:id/subjects                 — submit subject selections → enrolled
 */

const express   = require('express');
const router    = express.Router();
const db        = require('./db');
const mssql     = require('mssql');
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../middleware/auth');
const { parsePage, paginateQuery, paginatedResponse } = require('../middleware/paginate');
const logger   = require('../config/logger');
const { body, validationResult } = require('express-validator');
const auditLog = require('../middleware/auditLog');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }
  next();
}

// All student-facing application routes require authentication + audit logging
router.use(authenticate);
router.use(auditLog);

// 30 application mutations per 15 minutes per IP (create/submit/subjects)
const applicationMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please wait 15 minutes.' },
});

router.use('/subjects', applicationMutationLimiter);
router.post('/',        applicationMutationLimiter);

// async function logActivity(appId, action, actorRole, note = null) {
//   try {
//     await db.request()
//       .input('appId',     mssql.Int,     parseInt(appId))
//       .input('action',    mssql.NVarChar, action)
//       .input('actorRole', mssql.NVarChar, actorRole)
//       .input('note',      mssql.NVarChar, note || null)
//       .query(`INSERT INTO application_activity_log (application_id, action, actor_role, note) VALUES (@appId, @action, @actorRole, @note)`);
//   } catch (e) { logger.warn({ err: e }, 'logActivity failed'); }
// }

// ── Helper: generate registration number ────────────────────
async function generateRegNumber(collegeId, courseId, year, academicYear) {
  const prefix = `${academicYear.replace('-', '')}-${String(courseId).padStart(2,'0')}-${year}`;

  const result = await db.request()
    .input('prefix', `${prefix}-%`)
    .query(`
      SELECT COUNT(*) AS cnt
      FROM applications
      WHERE registration_number LIKE @prefix
        AND registration_number IS NOT NULL
    `);

  const seq = (result.recordset[0].cnt || 0) + 1;
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}

// ── List applications for a student ────────────────────────
router.get('/', async (req, res) => {
  const { student_id, academic_year } = req.query;
  const { page, limit, offset } = parsePage(req.query);

  if (!student_id) {
    return res.status(400).json({ success: false, message: 'student_id is required.' });
  }

  try {
    const joins = `
      FROM applications a
      JOIN colleges        c  ON c.id       = a.college_id
      LEFT JOIN faculty_master cr ON cr.code_no = a.course_id AND cr.college_id = a.college_id
      JOIN admission_periods ap ON ap.id    = a.admission_period_id
      LEFT JOIN (
        SELECT application_id, SUM(amount) AS amount_paid
        FROM payments
        WHERE payment_type = 'college_fee' AND status = 'success'
        GROUP BY application_id
      ) psum ON psum.application_id = a.id
    `;

    let where = 'WHERE a.student_id = @sid';
    const pool = await db;
    const sid  = parseInt(student_id);
    const extraInputs = [];

    if (academic_year) {
      where += ' AND a.academic_year = @ay';
      extraInputs.push(r => r.input('ay', academic_year));
    }

    function makeRequest() {
      const r = pool.request().input('sid', sid);
      extraInputs.forEach(fn => fn(r));
      return r;
    }

    const [countRes, dataRes] = await Promise.all([
      makeRequest().query(`SELECT COUNT(*) AS total ${joins} ${where}`),
      makeRequest().query(`
        SELECT
          a.id, a.registration_number, a.year_of_study, a.academic_year,
          a.status, a.roll_number, a.submitted_at, a.created_at,
          a.rejection_reason, a.cancellation_reason, a.correction_note,
          a.application_fee_paid, a.college_fee_paid,
          a.fee_total_amount, a.fee_pay_now_amount,
          ISNULL(psum.amount_paid, 0) AS amount_paid,
          c.id   AS college_id,   c.name  AS college_name,  c.city AS college_city,
          a.course_id,    COALESCE(cr.degree_course_name, CAST(a.course_id AS NVARCHAR)) AS course_name,
          COALESCE(c.application_fee, 0) AS application_fee, ap.total_seats, ap.filled_seats
        ${joins} ${where}
        ORDER BY a.created_at DESC
        ${paginateQuery(offset, limit)}
      `),
    ]);

    return res.json(paginatedResponse(dataRes.recordset, countRes.recordset[0].total, page, limit));
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Single application ──────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const result = await db.request()
      .input('id', parseInt(req.params.id))
      .query(`
        SELECT
          a.*,
          s.full_name AS student_name, s.email AS student_email,
          s.phone, s.dob, s.gender, s.address, s.city, s.category,
          c.name  AS college_name,  c.city   AS college_city,
          COALESCE(cr.degree_course_name, CAST(a.course_id AS NVARCHAR)) AS course_name,
          COALESCE(c.application_fee, 0) AS application_fee, ap.total_seats, ap.filled_seats,
          ap.start_date, ap.end_date
        FROM applications a
        JOIN students       s  ON s.id       = a.student_id
        JOIN colleges       c  ON c.id       = a.college_id
        LEFT JOIN faculty_master cr ON cr.code_no = a.course_id AND cr.college_id = a.college_id
        JOIN admission_periods ap ON ap.id   = a.admission_period_id
        WHERE a.id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    // Fetch attached documents
    const docs = await db.request()
      .input('appId', parseInt(req.params.id))
      .query(`
        SELECT ad.id, ad.is_verified, ad.verified_at,
               dt.name AS document_name,
               sd.file_name, sd.file_path, sd.uploaded_at
        FROM application_documents ad
        JOIN student_documents sd ON sd.id  = ad.student_document_id
        JOIN document_types    dt ON dt.id  = ad.document_type_id
        WHERE ad.application_id = @appId
      `);

    return res.json({
      success: true,
      data: { ...result.recordset[0], documents: docs.recordset },
    });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

const createApplicationValidators = [
  body('student_id').isInt({ min: 1 }).withMessage('student_id must be a positive integer.').toInt(),
  body('college_id').isInt({ min: 1 }).withMessage('college_id must be a positive integer.').toInt(),
  body('course_id').isInt({ min: 1 }).withMessage('course_id must be a positive integer.').toInt(),
  body('year_of_study').isInt({ min: 1, max: 5 }).withMessage('year_of_study must be between 1 and 5.').toInt(),
  body('academic_year').isString().trim().notEmpty().matches(/^\d{4}-\d{2,4}$/).withMessage('academic_year must be in format YYYY-YY or YYYY-YYYY.'),
  body('admission_period_id').isInt({ min: 1 }).withMessage('admission_period_id must be a positive integer.').toInt(),
];

// ── Create draft application ────────────────────────────────
router.post('/', createApplicationValidators, validate, async (req, res) => {
  const { student_id, college_id, course_id, year_of_study, academic_year, admission_period_id } = req.body;

  try {
    // Check for duplicate active application this academic year for same college/course/year
    const dup = await db.request()
      .input('sid',  parseInt(student_id))
      .input('col',  parseInt(college_id))
      .input('crs',  parseInt(course_id))
      .input('yr',   parseInt(year_of_study))
      .input('ay',   academic_year)
      .query(`
        SELECT id FROM applications
        WHERE student_id = @sid AND college_id = @col AND course_id = @crs
          AND year_of_study = @yr AND academic_year = @ay
          AND status NOT IN ('rejected','cancelled')
      `);

    if (dup.recordset.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'You already have an active application for this course at this college.',
        existing_application_id: dup.recordset[0].id,
      });
    }

    // Verify admission period is open
    const period = await db.request()
      .input('pid', parseInt(admission_period_id))
      .query(`
        SELECT id, total_seats, filled_seats, is_active, end_date
        FROM admission_periods WHERE id = @pid
      `);

    if (period.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Admission period not found.' });
    }

    const p = period.recordset[0];
    if (!p.is_active || new Date(p.end_date) < new Date()) {
      return res.status(400).json({ success: false, message: 'Admissions are closed for this period.' });
    }
    if (p.filled_seats >= p.total_seats) {
      return res.status(400).json({ success: false, message: 'No seats available.' });
    }

    // Check for existing draft to avoid duplicate key error
    const existing = await db.request()
      .input('sid',  parseInt(student_id))
      .input('col',  parseInt(college_id))
      .input('crs',  parseInt(course_id))
      .input('yr',   parseInt(year_of_study))
      .input('ay',   academic_year)
      .input('apid', parseInt(admission_period_id))
      .query(`
        SELECT id FROM applications
        WHERE student_id=@sid AND college_id=@col AND course_id=@crs
          AND year_of_study=@yr AND academic_year=@ay AND admission_period_id=@apid
          AND status='draft'
      `);

    if (existing.recordset.length > 0) {
      return res.status(200).json({
        success: true,
        message: 'Resumed existing draft application.',
        data: { id: existing.recordset[0].id },
      });
    }

    const result = await db.request()
      .input('sid',   parseInt(student_id))
      .input('col',   parseInt(college_id))
      .input('crs',   parseInt(course_id))
      .input('yr',    parseInt(year_of_study))
      .input('ay',    academic_year)
      .input('apid',  parseInt(admission_period_id))
      .input('actor', mssql.NVarChar, String(req.user.staff_id || req.user.id))
      .query(`
        DECLARE @t TABLE (id INT);
        INSERT INTO applications
          (student_id, college_id, course_id, year_of_study, academic_year, admission_period_id, status, created_by)
        OUTPUT INSERTED.id INTO @t
        VALUES (@sid, @col, @crs, @yr, @ay, @apid, 'draft', @actor);
        SELECT id FROM @t;
      `);

    return res.status(201).json({
      success: true,
      message: 'Draft application created.',
      data: { id: result.recordset[0].id },
    });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Delete draft application ────────────────────────────────
router.delete('/:id', async (req, res) => {
  const appId = parseInt(req.params.id);
  try {
    const appRes = await db.request()
      .input('id', appId)
      .query('SELECT id, status, student_id FROM applications WHERE id = @id');

    if (!appRes.recordset.length) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    const app = appRes.recordset[0];

    if (app.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only draft applications can be deleted.' });
    }

    // Remove child rows first
    await db.request().input('appId', appId).query('DELETE FROM application_documents     WHERE application_id = @appId');
    await db.request().input('appId', appId).query('DELETE FROM application_subjects      WHERE application_id = @appId');
    await db.request().input('appId', appId).query('DELETE FROM application_previous_exam WHERE application_id = @appId');
    await db.request().input('appId', appId).query('DELETE FROM applications              WHERE id = @appId');

    return res.json({ success: true, message: 'Draft application deleted.' });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Simulate payment success → move draft → submitted ───────
// In production this would be triggered by the payment gateway webhook.
// For now a direct POST simulates a successful payment.
router.post('/:id/submit', async (req, res) => {
  const appId = parseInt(req.params.id);

  try {
    const appRes = await db.request()
      .input('id', appId)
      .query(`
        SELECT a.id, a.status, a.student_id, a.college_id, a.course_id,
               a.year_of_study, a.academic_year, a.admission_period_id,
               COALESCE(c.application_fee, 0) AS application_fee
        FROM applications a
        JOIN admission_periods ap ON ap.id = a.admission_period_id
        JOIN colleges c ON c.id = a.college_id
        WHERE a.id = @id
      `);

    if (appRes.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const app = appRes.recordset[0];

    if (app.status !== 'draft') {
      return res.status(400).json({ success: false, message: `Cannot submit application in status: ${app.status}` });
    }

    // Generate registration number
    const regNum = await generateRegNumber(
      app.college_id, app.course_id, app.year_of_study, app.academic_year
    );

    const pool = await db;
    const tx   = pool.transaction();
    await tx.begin();
    try {
      await tx.request()
        .input('appId',  mssql.Int,     appId)
        .input('ptype',  mssql.NVarChar,'application_fee')
        .input('amount', mssql.Decimal, app.application_fee)
        .input('userId', mssql.Int,     req.user.id)
        .input('actor',  mssql.NVarChar, String(req.user.staff_id || req.user.id))
        .query(`
          INSERT INTO payments (application_id, payment_type, amount, status, completed_at, paid_by, paid_by_user_id, created_by)
          VALUES (@appId, @ptype, @amount, 'success', GETDATE(), 'student', @userId, @actor)
        `);

      await tx.request()
        .input('id',     mssql.Int,      appId)
        .input('regNum', mssql.NVarChar, regNum)
        .input('actor',  mssql.NVarChar, String(req.user.staff_id || req.user.id))
        .query(`
          UPDATE applications
          SET status = 'submitted',
              registration_number = @regNum,
              application_fee_paid = 1,
              submitted_at = GETDATE(),
              updated_at   = GETDATE(),
              status_updated_at = GETDATE(),
              updated_by = @actor
          WHERE id = @id
        `);

      await tx.commit();
    } catch (txErr) {
      await tx.rollback();
      throw txErr;
    }

    // await logActivity(appId, 'submitted', 'student', null);

    return res.json({
      success: true,
      message: 'Application submitted successfully.',
      data: { registration_number: regNum },
    });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Pay college fee (simulate) ──────────────────────────────
router.post('/:id/pay-college-fee', async (req, res) => {
  const appId = parseInt(req.params.id);

  try {
    const appRes = await db.request()
      .input('id', appId)
      .query(`
        SELECT a.id, a.status, a.college_id, a.course_id, a.year_of_study, a.category,
               a.fee_total_amount,
               s.category AS student_category
        FROM applications a
        JOIN students s ON s.id = a.student_id
        WHERE a.id = @id
      `);

    if (appRes.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const app = appRes.recordset[0];

    if (!['confirmed', 'fees_paid'].includes(app.status)) {
      return res.status(400).json({ success: false, message: 'Application must be confirmed before paying college fee.' });
    }

    // Use fee_total_amount set by college admin if available, otherwise fall back to fee_structures
    let amount = app.fee_total_amount ? parseFloat(app.fee_total_amount) : 0;
    if (!amount) {
      const feeRes = await db.request()
        .input('col', app.college_id)
        .input('crs', app.course_id)
        .input('yr',  app.year_of_study)
        .input('cat', app.student_category || 'general')
        .query(`
          SELECT TOP 1 (tuition_fee + exam_fee + other_fee) AS total_fee
          FROM fee_structures
          WHERE college_id = @col AND course_id = @crs AND year_of_study = @yr
          ORDER BY category
        `);
      amount = feeRes.recordset[0]?.total_fee || 0;
    }

    const pool = await db;
    const tx   = pool.transaction();
    await tx.begin();
    try {
      await tx.request()
        .input('appId',  mssql.Int,     appId)
        .input('ptype',  mssql.NVarChar,'college_fee')
        .input('amount', mssql.Decimal, amount)
        .input('userId', mssql.Int,     req.user.id)
        .input('actor',  mssql.NVarChar, String(req.user.staff_id || req.user.id))
        .query(`
          INSERT INTO payments (application_id, payment_type, amount, status, completed_at, paid_by, paid_by_user_id, created_by)
          VALUES (@appId, @ptype, @amount, 'success', GETDATE(), 'student', @userId, @actor)
        `);

      await tx.request()
        .input('id',    mssql.Int,     appId)
        .input('actor', mssql.NVarChar, String(req.user.staff_id || req.user.id))
        .query(`
          UPDATE applications
          SET status = 'fees_paid',
              college_fee_paid = 1,
              updated_at = GETDATE(),
              status_updated_at = GETDATE(),
              updated_by = @actor
          WHERE id = @id
        `);

      await tx.commit();
    } catch (txErr) {
      await tx.rollback();
      throw txErr;
    }

    // await logActivity(appId, 'fees_paid', 'student', null);

    return res.json({ success: true, message: 'College fee paid successfully.' });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Get subjects for selection ──────────────────────────────
router.get('/:id/subjects', async (req, res) => {
  const appId = parseInt(req.params.id);

  try {
    const appRes = await db.request()
      .input('id', appId)
      .query('SELECT course_id, year_of_study, status FROM applications WHERE id = @id');

    if (appRes.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const { course_id, year_of_study, status } = appRes.recordset[0];

    const subs = await db.request()
      .input('crs', course_id)
      .input('yr',  year_of_study)
      .query(`
        SELECT id, name, subject_type, elective_group
        FROM subjects
        WHERE course_id = @crs AND year_of_study = @yr
        ORDER BY subject_type DESC, elective_group, name
      `);

    // Already selected?
    const selected = await db.request()
      .input('appId', appId)
      .query('SELECT subject_id FROM application_subjects WHERE application_id = @appId');

    const selectedIds = selected.recordset.map(r => r.subject_id);

    return res.json({
      success: true,
      data: {
        subjects: subs.recordset,
        selected_ids: selectedIds,
        can_select: ['roll_assigned'].includes(status),
      },
    });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Submit subject selections ───────────────────────────────
router.post('/:id/subjects', async (req, res) => {
  const appId      = parseInt(req.params.id);
  const { subject_ids } = req.body;

  if (!Array.isArray(subject_ids) || subject_ids.length === 0) {
    return res.status(400).json({ success: false, message: 'subject_ids array is required.' });
  }

  try {
    const appRes = await db.request()
      .input('id', appId)
      .query('SELECT status FROM applications WHERE id = @id');

    if (appRes.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    if (appRes.recordset[0].status !== 'roll_assigned') {
      return res.status(400).json({ success: false, message: 'Subject selection is only available after roll number assignment.' });
    }

    const pool = await db;
    const tx   = pool.transaction();
    await tx.begin();
    try {
      await tx.request()
        .input('appId', mssql.Int, appId)
        .query('DELETE FROM application_subjects WHERE application_id = @appId');

      for (const subId of subject_ids) {
        await tx.request()
          .input('appId', mssql.Int, appId)
          .input('subId', mssql.Int, parseInt(subId))
          .query(`INSERT INTO application_subjects (application_id, subject_id) VALUES (@appId, @subId)`);
      }

      await tx.request()
        .input('id',    mssql.Int,     appId)
        .input('actor', mssql.NVarChar, String(req.user.staff_id || req.user.id))
        .query(`
          UPDATE applications
          SET status = 'enrolled', enrolled_at = GETDATE(), updated_at = GETDATE(), status_updated_at = GETDATE(),
              updated_by = @actor
          WHERE id = @id
        `);

      await tx.commit();
    } catch (txErr) {
      await tx.rollback();
      throw txErr;
    }

    // await logActivity(appId, 'enrolled', 'student', null);

    return res.json({ success: true, message: 'Subjects selected. Enrollment complete.' });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Student uploads a document ──────────────────────────────
router.post('/:id/documents', async (req, res) => {
  const appId = parseInt(req.params.id);
  const { student_id, document_type_id, file_name, file_path } = req.body;

  if (!student_id || !document_type_id || !file_name || !file_path) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

  try {
    // Upsert student_documents
    const existing = await db.request()
      .input('sid', parseInt(student_id))
      .input('dtid', parseInt(document_type_id))
      .query('SELECT id FROM student_documents WHERE student_id=@sid AND document_type_id=@dtid');

    let sdId;
    if (existing.recordset.length > 0) {
      sdId = existing.recordset[0].id;
      await db.request()
        .input('id',   sdId)
        .input('fn',   file_name)
        .input('fp',   file_path)
        .query('UPDATE student_documents SET file_name=@fn, file_path=@fp, uploaded_at=GETDATE() WHERE id=@id');
    } else {
      const ins = await db.request()
        .input('sid',  parseInt(student_id))
        .input('dtid', parseInt(document_type_id))
        .input('fn',   file_name)
        .input('fp',   file_path)
        .query(`
          INSERT INTO student_documents (student_id, document_type_id, file_name, file_path)
          OUTPUT INSERTED.id
          VALUES (@sid, @dtid, @fn, @fp)
        `);
      sdId = ins.recordset[0].id;
    }

    // Link to application
    const linked = await db.request()
      .input('appId', appId)
      .input('dtid',  parseInt(document_type_id))
      .query('SELECT id FROM application_documents WHERE application_id=@appId AND document_type_id=@dtid');

    if (linked.recordset.length > 0) {
      await db.request()
        .input('appId', appId)
        .input('dtid',  parseInt(document_type_id))
        .input('sdId',  sdId)
        .query('UPDATE application_documents SET student_document_id=@sdId WHERE application_id=@appId AND document_type_id=@dtid');
    } else {
      await db.request()
        .input('appId', appId)
        .input('sdId',  sdId)
        .input('dtid',  parseInt(document_type_id))
        .query(`
          INSERT INTO application_documents (application_id, student_document_id, document_type_id)
          VALUES (@appId, @sdId, @dtid)
        `);
    }

    return res.json({ success: true, message: 'Document saved.' });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
