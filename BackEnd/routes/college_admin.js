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
    console.warn('logActivity failed:', e.message);
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
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.post('/:collegeId/admission-periods', async (req, res) => {
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
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.put('/:collegeId/admission-periods/:periodId', async (req, res) => {
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
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.delete('/:collegeId/admission-periods/:periodId', async (req, res) => {
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
      WHERE a.college_id = @col AND a.status <> 'draft'
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

    const activityRes = await db.request()
      .input('appId', parseInt(req.params.appId))
      .query(`
        SELECT id, action, actor_role, note, created_at
        FROM application_activity_log
        WHERE application_id = @appId
        ORDER BY created_at ASC
      `);

    return res.json({
      success: true,
      data: { ...result.recordset[0], documents: docs.recordset, exam, activity: activityRes.recordset },
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

    return res.json({ success: true, message: 'Correction requested. Student has been notified.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Accept Application (submitted/correction_done → doc_verified) ────────────
// College accepts the application. Student is notified to visit for doc check.
router.post('/:collegeId/applications/:appId/approve', async (req, res) => {
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

    // Hold a seat in the admission period
    await db.request()
      .input('pid', appRes.recordset[0].admission_period_id)
      .query('UPDATE admission_periods SET filled_seats = filled_seats + 1 WHERE id = @pid AND filled_seats < total_seats');

    await db.request()
      .input('id', parseInt(req.params.appId))
      .query(`
        UPDATE applications
        SET status = 'doc_verified', approved_at = GETDATE(), updated_at = GETDATE(), status_updated_at = GETDATE(),
            correction_note = NULL
        WHERE id = @id
      `);

    await logActivity(req.params.appId, 'accepted', 'college', null);

    return res.json({ success: true, message: 'Application accepted. Student has been notified to visit the college.' });
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

    return res.json({ success: true, message: 'Application rejected.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Confirm after doc visit: set fees and move to confirmed ──────────────────
// Student visited college. College verifies docs, sets fees, confirms admission.
// Status: doc_verified → confirmed
router.post('/:collegeId/applications/:appId/confirm', async (req, res) => {
  const { fee_total_amount, fee_pay_now_amount, document_ids_verified } = req.body;

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

    // Mark documents as physically verified
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
      .input('id',    mssqlShared.Int,     parseInt(req.params.appId))
      .input('total', mssqlShared.Decimal, total)
      .input('now',   mssqlShared.Decimal, payNow)
      .query(`
        UPDATE applications
        SET status = 'confirmed', confirmed_at = GETDATE(), updated_at = GETDATE(), status_updated_at = GETDATE(),
            fee_total_amount = @total, fee_pay_now_amount = @now
        WHERE id = @id
      `);

    await logActivity(req.params.appId, 'confirmed', 'college', `Total fee: ₹${total}, Pay now: ₹${payNow}`);

    return res.json({ success: true, message: 'Admission confirmed. Student can now pay the college fee.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Set fee amounts (college enters total fee and amount due now) ─────────────
router.post('/:collegeId/applications/:appId/set-fee', async (req, res) => {
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

    // Free the seat if one was held (doc_verified or later)
    if (['doc_verified', 'scrutiny_accepted', 'doc_verification_pending', 'confirmed'].includes(status)) {
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

    await logActivity(req.params.appId, 'cancelled', 'college', reason || null);

    return res.json({ success: true, message: 'Application cancelled and seat freed.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Record offline (cash) college fee payment ────────────────
// POST /:collegeId/applications/:appId/record-cash-payment
// body: { amount, note? }
router.post('/:collegeId/applications/:appId/record-cash-payment', async (req, res) => {
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
        SELECT id, status, fee_total_amount
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

    const totalFee = parseFloat(app.fee_total_amount) || 0;

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

    // Record payment
    await db.request()
      .input('appId',  mssqlShared.Int,      appId)
      .input('amount', mssqlShared.Decimal,   amt)
      .input('note',   mssqlShared.NVarChar,  note || null)
      .query(`
        INSERT INTO payments (application_id, payment_type, amount, status,
          razorpay_order_id, razorpay_payment_id, completed_at)
        VALUES (@appId, 'college_fee', @amount, 'success',
          CONCAT('CASH-', CAST(@appId AS NVARCHAR), '-', CAST(CHECKSUM(NEWID()) AS NVARCHAR)),
          CONCAT('CASH-', FORMAT(GETDATE(),'yyyyMMddHHmmss')),
          GETDATE())
      `);

    const newTotalPaid = alreadyPaid + amt;
    const allPaid      = totalFee > 0 && newTotalPaid >= totalFee - 0.01;

    if (allPaid) {
      await db.request()
        .input('id', mssqlShared.Int, appId)
        .query(`
          UPDATE applications
          SET status = 'fees_paid', college_fee_paid = 1, updated_at = GETDATE(), status_updated_at = GETDATE()
          WHERE id = @id
        `);
    }

    const noteText = note ? ` — ${note}` : '';
    if (allPaid) {
      await logActivity(appId, 'fees_paid', 'college', `Cash: ₹${amt.toLocaleString('en-IN')} (full)${noteText}`);
    } else {
      const newRemaining = totalFee - newTotalPaid;
      await logActivity(appId, 'fee_instalment_paid', 'college', `Cash: ₹${amt.toLocaleString('en-IN')}, ₹${newRemaining.toLocaleString('en-IN')} remaining${noteText}`);
    }

    return res.json({
      success:    true,
      message:    allPaid ? 'Fee fully paid!' : `₹${amt.toLocaleString('en-IN')} recorded. ₹${(totalFee - newTotalPaid).toLocaleString('en-IN')} remaining.`,
      data: { all_paid: allPaid, total_paid: newTotalPaid, remaining: Math.max(0, totalFee - newTotalPaid) },
    });
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

// ── College Fee Receipts ─────────────────────────────────────
// GET /:collegeId/fee-receipts?status=paid|pending&course_id=&year_of_study=&q=
router.get('/:collegeId/fee-receipts', async (req, res) => {
  const { status, course_id, year_of_study, q } = req.query;
  try {
    let query = `
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
      WHERE a.college_id = @col
        AND a.status NOT IN ('draft','submitted','under_review','correction_requested','correction_done',
                             'scrutiny_accepted','doc_verification_pending','rejected','cancelled')
    `;
    const req2 = db.request().input('col', parseInt(req.params.collegeId));

    if (status === 'paid') {
      query += ' AND a.college_fee_paid = 1';
    } else if (status === 'pending') {
      query += ' AND a.college_fee_paid = 0';
    }
    if (course_id) {
      query += ' AND a.course_id = @crs';
      req2.input('crs', parseInt(course_id));
    }
    if (year_of_study) {
      query += ' AND a.year_of_study = @yr';
      req2.input('yr', parseInt(year_of_study));
    }
    if (q) {
      query += ` AND (s.full_name LIKE @q OR s.phone LIKE @q OR a.registration_number LIKE @q OR a.roll_number LIKE @q)`;
      req2.input('q', `%${q.trim()}%`);
    }

    query += ' ORDER BY a.college_fee_paid ASC, a.confirmed_at DESC';

    const result = await req2.query(query);
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
