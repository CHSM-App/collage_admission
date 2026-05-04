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

// ── Admission Periods ───────────────────────────────────────

router.get('/:collegeId/admission-periods', async (req, res) => {
  const activeOnly = req.query.active === '1';
  try {
    const result = await db.request()
      .input('col', parseInt(req.params.collegeId))
      .query(`
        SELECT ap.id, ap.year_of_study, ap.academic_year,
               ap.start_date, ap.end_date, ap.total_seats, ap.filled_seats,
               ap.application_fee, ap.is_active, ap.is_disabled,
               fm.code_no AS course_id,
               CONCAT(fm.degree_course_code, ' — ', fm.degree_course_name) AS course_name
        FROM admission_periods ap
        JOIN faculty_master fm ON fm.code_no = ap.course_id AND fm.college_id = ap.college_id
        WHERE ap.college_id = @col
          ${activeOnly ? 'AND ap.is_active = 1 AND ap.is_disabled = 0' : ''}
        ORDER BY ap.academic_year DESC, fm.degree_course_name, ap.year_of_study
      `);
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.post('/:collegeId/admission-periods', async (req, res) => {
  const { course_id, year_of_study, academic_year, start_date, end_date, total_seats, application_fee } = req.body;

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
      .input('fee',  parseFloat(application_fee) || 0)
      .query(`
        INSERT INTO admission_periods
          (college_id, course_id, year_of_study, academic_year, start_date, end_date, total_seats, application_fee, is_active)
        OUTPUT INSERTED.id
        VALUES (@col, @crs, @yr, @ay, @sd, @ed, @seats, @fee, 1)
      `);

    return res.status(201).json({ success: true, data: { id: result.recordset[0].id } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.put('/:collegeId/admission-periods/:periodId', async (req, res) => {
  const { start_date, end_date, total_seats, application_fee, is_active, is_disabled } = req.body;

  try {
    const mssql = require('mssql');
    await db.request()
      .input('id',    mssql.Int,  parseInt(req.params.periodId))
      .input('col',   mssql.Int,  parseInt(req.params.collegeId))
      .input('sd',    mssql.NVarChar, start_date    || null)
      .input('ed',    mssql.NVarChar, end_date      || null)
      .input('seats', mssql.Int,  total_seats   ? parseInt(total_seats)         : null)
      .input('fee',   mssql.Decimal, application_fee ? parseFloat(application_fee) : null)
      .input('act',   mssql.Bit,  is_active    !== undefined ? (is_active    ? 1 : 0) : null)
      .input('dis',   mssql.Bit,  is_disabled  !== undefined ? (is_disabled  ? 1 : 0) : null)
      .query(`
        UPDATE admission_periods
        SET
          start_date      = COALESCE(@sd,    start_date),
          end_date        = COALESCE(@ed,    end_date),
          total_seats     = COALESCE(@seats, total_seats),
          application_fee = COALESCE(@fee,   application_fee),
          is_active       = COALESCE(@act,   is_active),
          is_disabled     = COALESCE(@dis,   is_disabled)
        WHERE id = @id AND college_id = @col
      `);

    return res.json({ success: true, message: 'Admission period updated.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.delete('/:collegeId/admission-periods/:periodId', async (req, res) => {
  const periodId  = parseInt(req.params.periodId);
  const collegeId = parseInt(req.params.collegeId);
  try {
    // Block delete if any applications exist for this period
    const check = await db.request()
      .input('pid', periodId)
      .query(`SELECT COUNT(*) AS cnt FROM applications WHERE period_id = @pid`);
    const cnt = check.recordset[0]?.cnt || 0;
    if (cnt > 0) {
      return res.status(400).json({ success: false, message: `Cannot delete — ${cnt} application(s) exist for this period.` });
    }
    // Remove installment plans first
    await db.request()
      .input('pid', periodId)
      .query(`DELETE FROM fee_installment_plans WHERE admission_period_id = @pid`);
    const del = await db.request()
      .input('pid', periodId)
      .input('cid', collegeId)
      .query(`DELETE FROM admission_periods WHERE id = @pid AND college_id = @cid`);
    if (!del.rowsAffected[0]) {
      return res.status(404).json({ success: false, message: 'Period not found.' });
    }
    return res.json({ success: true, message: 'Admission period deleted.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Installment Plans ───────────────────────────────────────
// GET  /:collegeId/admission-periods/:periodId/installments
// POST /:collegeId/admission-periods/:periodId/installments   (replace all)

router.get('/:collegeId/admission-periods/:periodId/installments', async (req, res) => {
  try {
    const result = await db.request()
      .input('pid', parseInt(req.params.periodId))
      .query(`
        SELECT id, installment_no, label, amount, due_date
        FROM fee_installment_plans
        WHERE admission_period_id = @pid
        ORDER BY installment_no
      `);
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.post('/:collegeId/admission-periods/:periodId/installments', async (req, res) => {
  const periodId = parseInt(req.params.periodId);
  const { installments } = req.body;
  // installments: [{ installment_no, label, amount, due_date }]

  if (!Array.isArray(installments)) {
    return res.status(400).json({ success: false, message: 'installments must be an array.' });
  }
  if (installments.length > 6) {
    return res.status(400).json({ success: false, message: 'Maximum 6 installments allowed.' });
  }
  for (const ins of installments) {
    if (!ins.label || !ins.amount || parseFloat(ins.amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Each installment needs a label and positive amount.' });
    }
  }

  try {
    // Replace: delete existing, then insert new (empty array = clear plan)
    await db.request()
      .input('pid', parseInt(periodId))
      .query('DELETE FROM fee_installment_plans WHERE admission_period_id = @pid');

    for (let i = 0; i < installments.length; i++) {
      const ins = installments[i];
      await db.request()
        .input('pid',    parseInt(periodId))
        .input('no',     i + 1)
        .input('label',  ins.label)
        .input('amount', parseFloat(ins.amount))
        .input('due',    ins.due_date || null)
        .query(`
          INSERT INTO fee_installment_plans (admission_period_id, installment_no, label, amount, due_date)
          VALUES (@pid, @no, @label, @amount, @due)
        `);
    }

    return res.json({ success: true, message: 'Installment plan saved.' });
  } catch (err) {
    console.error(err);
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
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Application Inbox ───────────────────────────────────────

router.get('/:collegeId/applications', async (req, res) => {
  const { status, course_id, year_of_study } = req.query;

  try {
    let query = `
      SELECT
        a.id, a.registration_number, a.year_of_study, a.academic_year,
        a.status, a.submitted_at, a.roll_number, a.course_id,
        s.full_name AS student_name, s.email AS student_email, s.phone,
        COALESCE(CONCAT(fm.degree_course_code, ' — ', fm.degree_course_name), CAST(a.course_id AS NVARCHAR)) AS course_name
      FROM applications a
      JOIN students       s  ON s.id  = a.student_id
      LEFT JOIN faculty_master fm ON fm.code_no = a.course_id AND fm.college_id = a.college_id
      WHERE a.college_id = @col
    `;

    const req2 = db.request().input('col', parseInt(req.params.collegeId));

    if (status) {
      // Support comma-separated values e.g. status=approved,document_verification,confirmed
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        query += ' AND a.status = @status';
        req2.input('status', statuses[0]);
      } else {
        const placeholders = statuses.map((_, i) => `@s${i}`).join(',');
        query += ` AND a.status IN (${placeholders})`;
        statuses.forEach((s, i) => req2.input(`s${i}`, s));
      }
    }
    if (course_id) {
      query += ' AND a.course_id = @crs';
      req2.input('crs', parseInt(course_id));
    }
    if (year_of_study) {
      query += ' AND a.year_of_study = @yr';
      req2.input('yr', parseInt(year_of_study));
    }

    query += ' ORDER BY a.submitted_at DESC';

    const result = await req2.query(query);
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.get('/:collegeId/applications/:appId', async (req, res) => {
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
               sd.file_name, sd.file_path, sd.uploaded_at
        FROM application_documents ad
        JOIN student_documents sd ON sd.id = ad.student_document_id
        JOIN document_types    dt ON dt.id = ad.document_type_id
        WHERE ad.application_id = @appId
      `);

    const examRes = await db.request()
      .input('appId', parseInt(req.params.appId))
      .query(`
        SELECT ape.*,
               (SELECT apes.subject_name, apes.marks_obtained, apes.marks_max
                FROM application_previous_exam_subjects apes
                WHERE apes.application_previous_exam_id = ape.id
                FOR JSON PATH) AS subjects_json
        FROM application_previous_exam ape
        WHERE ape.application_id = @appId
      `);

    const exam = examRes.recordset[0] || null;
    if (exam && exam.subjects_json) {
      try { exam.subjects = JSON.parse(exam.subjects_json); } catch { exam.subjects = []; }
      delete exam.subjects_json;
    }

    return res.json({
      success: true,
      data: { ...result.recordset[0], documents: docs.recordset, exam },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Request Correction (submitted/under_review → correction_requested) ──────
router.post('/:collegeId/applications/:appId/request-correction', async (req, res) => {
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
    if (!['submitted', 'under_review', 'correction_requested'].includes(appRes.recordset[0].status)) {
      return res.status(400).json({ success: false, message: 'Correction can only be requested for submitted or under-review applications.' });
    }

    const mssql = require('mssql');
    await db.request()
      .input('id',   mssql.Int,      parseInt(req.params.appId))
      .input('note', mssql.NVarChar, note.trim())
      .query(`
        UPDATE applications
        SET status = 'correction_requested', correction_note = @note, updated_at = GETDATE(), status_updated_at = GETDATE()
        WHERE id = @id
      `);

    return res.json({ success: true, message: 'Correction requested. Student has been notified.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Scrutiny Accept (submitted/correction_requested → scrutiny_accepted) ─────
router.post('/:collegeId/applications/:appId/approve', async (req, res) => {
  try {
    const appRes = await db.request()
      .input('id',  parseInt(req.params.appId))
      .input('col', parseInt(req.params.collegeId))
      .query('SELECT id, status, admission_period_id FROM applications WHERE id=@id AND college_id=@col');

    if (appRes.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    if (!['submitted', 'under_review', 'correction_requested'].includes(appRes.recordset[0].status)) {
      return res.status(400).json({ success: false, message: 'Application must be submitted/under_review to accept.' });
    }

    // Hold a seat
    await db.request()
      .input('pid', appRes.recordset[0].admission_period_id)
      .query('UPDATE admission_periods SET filled_seats = filled_seats + 1 WHERE id = @pid AND filled_seats < total_seats');

    await db.request()
      .input('id', parseInt(req.params.appId))
      .query(`
        UPDATE applications
        SET status = 'scrutiny_accepted', approved_at = GETDATE(), updated_at = GETDATE(), status_updated_at = GETDATE(),
            correction_note = NULL
        WHERE id = @id
      `);

    return res.json({ success: true, message: 'Scrutiny accepted. Application accepted.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Reject ──────────────────────────────────────────────────
router.post('/:collegeId/applications/:appId/reject', async (req, res) => {
  const { reason } = req.body;

  try {
    const appRes = await db.request()
      .input('id',  parseInt(req.params.appId))
      .input('col', parseInt(req.params.collegeId))
      .query('SELECT id, status FROM applications WHERE id=@id AND college_id=@col');

    if (appRes.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    if (!['submitted', 'under_review', 'scrutiny_accepted'].includes(appRes.recordset[0].status)) {
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

    return res.json({ success: true, message: 'Application rejected.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Call for physical doc verification (scrutiny_accepted → doc_verification_pending) ──
// College selects this student for physical document visit. Can be triggered multiple times
// (e.g. student didn't come, re-invite). Always sets status to doc_verification_pending.
router.post('/:collegeId/applications/:appId/call-for-doc-verification', async (req, res) => {
  try {
    const appRes = await db.request()
      .input('id',  parseInt(req.params.appId))
      .input('col', parseInt(req.params.collegeId))
      .query('SELECT id, status FROM applications WHERE id=@id AND college_id=@col');

    if (appRes.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    // Allow from scrutiny_accepted or re-trigger from doc_verification_pending
    if (!['scrutiny_accepted', 'doc_verification_pending'].includes(appRes.recordset[0].status)) {
      return res.status(400).json({ success: false, message: 'Application must be scrutiny accepted to call for doc verification.' });
    }

    await db.request()
      .input('id', parseInt(req.params.appId))
      .query(`
        UPDATE applications
        SET status = 'doc_verification_pending', updated_at = GETDATE(), status_updated_at = GETDATE()
        WHERE id = @id
      `);

    return res.json({ success: true, message: 'Student called for physical document verification.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Verify-docs alias (kept for backward compat) ─────────────
router.post('/:collegeId/applications/:appId/verify-docs', async (req, res) => {
  req.url = req.url.replace('verify-docs', 'call-for-doc-verification');
  // Forward to call-for-doc-verification
  const appRes = await db.request()
    .input('id',  parseInt(req.params.appId))
    .input('col', parseInt(req.params.collegeId))
    .query('SELECT id, status FROM applications WHERE id=@id AND college_id=@col');
  if (!appRes.recordset.length) return res.status(404).json({ success: false, message: 'Not found.' });
  if (!['scrutiny_accepted', 'doc_verification_pending', 'approved'].includes(appRes.recordset[0].status)) {
    return res.status(400).json({ success: false, message: 'Invalid status for doc verification.' });
  }
  await db.request().input('id', parseInt(req.params.appId)).query(`
    UPDATE applications SET status = 'doc_verification_pending', updated_at = GETDATE(), status_updated_at = GETDATE() WHERE id = @id
  `);
  return res.json({ success: true, message: 'Student called for physical document verification.' });
});

// ── Confirm admission (after physical doc check) ─────────────
router.post('/:collegeId/applications/:appId/confirm', async (req, res) => {
  const { document_ids_verified } = req.body; // optional: array of application_documents ids to mark verified

  try {
    const appRes = await db.request()
      .input('id',  parseInt(req.params.appId))
      .input('col', parseInt(req.params.collegeId))
      .query('SELECT id, status FROM applications WHERE id=@id AND college_id=@col');

    if (appRes.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    if (appRes.recordset[0].status !== 'doc_verification_pending') {
      return res.status(400).json({ success: false, message: 'Application must be in doc_verification_pending status to confirm.' });
    }

    // Mark submitted documents as physically verified
    if (Array.isArray(document_ids_verified) && document_ids_verified.length > 0) {
      for (const docId of document_ids_verified) {
        await db.request()
          .input('docId', parseInt(docId))
          .input('appId', parseInt(req.params.appId))
          .query(`
            UPDATE application_documents
            SET is_verified = 1, verified_at = GETDATE()
            WHERE id = @docId AND application_id = @appId
          `);
      }
    }

    await db.request()
      .input('id', parseInt(req.params.appId))
      .query(`
        UPDATE applications
        SET status = 'confirmed', confirmed_at = GETDATE(), updated_at = GETDATE(), status_updated_at = GETDATE()
        WHERE id = @id
      `);

    return res.json({ success: true, message: 'Admission confirmed. Student can now pay college fee.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Cancel (held seat freed) ─────────────────────────────────
router.post('/:collegeId/applications/:appId/cancel', async (req, res) => {
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

    // Free the seat if one was held (scrutiny_accepted or later)
    if (['scrutiny_accepted', 'doc_verification_pending', 'confirmed'].includes(status)) {
      await db.request()
        .input('pid', admission_period_id)
        .query('UPDATE admission_periods SET filled_seats = filled_seats - 1 WHERE id = @pid AND filled_seats > 0');
    }

    await db.request()
      .input('id',     parseInt(req.params.appId))
      .input('reason', reason || null)
      .query(`
        UPDATE applications
        SET status = 'cancelled', cancellation_reason = @reason, updated_at = GETDATE(), status_updated_at = GETDATE()
        WHERE id = @id
      `);

    return res.json({ success: true, message: 'Application cancelled and seat freed.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Generate roll numbers (batch) ───────────────────────────
router.post('/:collegeId/roll-numbers/generate', async (req, res) => {
  const { course_id, year_of_study, academic_year } = req.body;

  if (!course_id || !year_of_study || !academic_year) {
    return res.status(400).json({ success: false, message: 'course_id, year_of_study, academic_year are required.' });
  }

  try {
    // Find highest existing roll number for this college/course
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

    // Get all fees_paid applications without a roll number, sorted by registration_number
    const pending = await db.request()
      .input('col', parseInt(req.params.collegeId))
      .input('crs', parseInt(course_id))
      .input('yr',  parseInt(year_of_study))
      .input('ay',  academic_year)
      .query(`
        SELECT id FROM applications
        WHERE college_id = @col AND course_id = @crs
          AND year_of_study = @yr AND academic_year = @ay
          AND status = 'fees_paid'
          AND roll_number IS NULL
        ORDER BY registration_number
      `);

    if (pending.recordset.length === 0) {
      return res.json({ success: true, message: 'No pending applications for roll number assignment.', assigned: 0 });
    }

    for (const app of pending.recordset) {
      await db.request()
        .input('id',   app.id)
        .input('roll', String(nextRoll))
        .query(`
          UPDATE applications
          SET roll_number = @roll, status = 'roll_assigned', updated_at = GETDATE()
          WHERE id = @id
        `);
      nextRoll++;
    }

    return res.json({
      success: true,
      message: `Roll numbers assigned to ${pending.recordset.length} student(s).`,
      assigned: pending.recordset.length,
      starting_from: nextRoll - pending.recordset.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
