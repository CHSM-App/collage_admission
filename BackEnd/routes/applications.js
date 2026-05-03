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

const express = require('express');
const router  = express.Router();
const db      = require('./db');

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

  if (!student_id) {
    return res.status(400).json({ success: false, message: 'student_id is required.' });
  }

  try {
    let query = `
      SELECT
        a.id, a.registration_number, a.year_of_study, a.academic_year,
        a.status, a.roll_number, a.submitted_at, a.created_at,
        a.rejection_reason, a.cancellation_reason,
        a.application_fee_paid, a.college_fee_paid,
        c.id   AS college_id,   c.name  AS college_name,  c.city AS college_city,
        fm.code_no AS course_id,
        CONCAT(fm.degree_course_code, ' — ', fm.degree_course_name) AS course_name,
        ap.application_fee, ap.total_seats, ap.filled_seats
      FROM applications a
      JOIN colleges        c  ON c.id  = a.college_id
      JOIN faculty_master  fm ON fm.code_no = a.course_id AND fm.college_id = a.college_id
      JOIN admission_periods ap ON ap.id = a.admission_period_id
      WHERE a.student_id = @sid
    `;

    const req2 = db.request().input('sid', parseInt(student_id));

    if (academic_year) {
      query += ' AND a.academic_year = @ay';
      req2.input('ay', academic_year);
    }

    query += ' ORDER BY a.created_at DESC';
    const result = await req2.query(query);
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error(err);
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
          CONCAT(fm.degree_course_code, ' — ', fm.degree_course_name) AS course_name,
          ap.application_fee, ap.total_seats, ap.filled_seats,
          ap.start_date, ap.end_date
        FROM applications a
        JOIN students       s  ON s.id  = a.student_id
        JOIN colleges       c  ON c.id  = a.college_id
        JOIN faculty_master fm ON fm.code_no = a.course_id AND fm.college_id = a.college_id
        JOIN admission_periods ap ON ap.id = a.admission_period_id
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
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Create draft application ────────────────────────────────
router.post('/', async (req, res) => {
  const { student_id, college_id, course_id, year_of_study, academic_year, admission_period_id } = req.body;

  if (!student_id || !college_id || !course_id || !year_of_study || !academic_year || !admission_period_id) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

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
        SELECT id, total_seats, filled_seats, is_active, end_date, application_fee
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

    const result = await db.request()
      .input('sid',  parseInt(student_id))
      .input('col',  parseInt(college_id))
      .input('crs',  parseInt(course_id))
      .input('yr',   parseInt(year_of_study))
      .input('ay',   academic_year)
      .input('apid', parseInt(admission_period_id))
      .query(`
        INSERT INTO applications
          (student_id, college_id, course_id, year_of_study, academic_year, admission_period_id, status)
        OUTPUT INSERTED.id
        VALUES (@sid, @col, @crs, @yr, @ay, @apid, 'draft')
      `);

    return res.status(201).json({
      success: true,
      message: 'Draft application created.',
      data: { id: result.recordset[0].id },
    });
  } catch (err) {
    console.error(err);
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
    await db.request().input('appId', appId).query('DELETE FROM application_documents WHERE application_id = @appId');
    await db.request().input('appId', appId).query('DELETE FROM application_subjects  WHERE application_id = @appId');
    await db.request().input('appId', appId).query('DELETE FROM applications          WHERE id = @appId');

    return res.json({ success: true, message: 'Draft application deleted.' });
  } catch (err) {
    console.error(err);
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
               ap.application_fee
        FROM applications a
        JOIN admission_periods ap ON ap.id = a.admission_period_id
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

    // Record payment
    await db.request()
      .input('appId',  appId)
      .input('ptype',  'application_fee')
      .input('amount', app.application_fee)
      .input('status', 'success')
      .query(`
        INSERT INTO payments (application_id, payment_type, amount, status, completed_at)
        VALUES (@appId, @ptype, @amount, @status, GETDATE())
      `);

    // Update application
    await db.request()
      .input('id',     appId)
      .input('regNum', regNum)
      .query(`
        UPDATE applications
        SET status = 'submitted',
            registration_number = @regNum,
            application_fee_paid = 1,
            submitted_at = GETDATE(),
            updated_at   = GETDATE()
        WHERE id = @id
      `);

    return res.json({
      success: true,
      message: 'Application submitted successfully.',
      data: { registration_number: regNum },
    });
  } catch (err) {
    console.error(err);
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
               s.category AS student_category
        FROM applications a
        JOIN students s ON s.id = a.student_id
        WHERE a.id = @id
      `);

    if (appRes.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const app = appRes.recordset[0];

    if (app.status !== 'confirmed') {
      return res.status(400).json({ success: false, message: 'Application must be confirmed before paying college fee.' });
    }

    // Determine course category for fee lookup
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

    const amount = feeRes.recordset[0]?.total_fee || 0;

    // Record payment
    await db.request()
      .input('appId',  appId)
      .input('ptype',  'college_fee')
      .input('amount', amount)
      .input('status', 'success')
      .query(`
        INSERT INTO payments (application_id, payment_type, amount, status, completed_at)
        VALUES (@appId, @ptype, @amount, @status, GETDATE())
      `);

    // Update application
    await db.request()
      .input('id', appId)
      .query(`
        UPDATE applications
        SET status = 'fees_paid',
            college_fee_paid = 1,
            updated_at = GETDATE()
        WHERE id = @id
      `);

    return res.json({ success: true, message: 'College fee paid successfully.' });
  } catch (err) {
    console.error(err);
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
    console.error(err);
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

    // Delete previous selections
    await db.request()
      .input('appId', appId)
      .query('DELETE FROM application_subjects WHERE application_id = @appId');

    // Insert new selections
    for (const subId of subject_ids) {
      await db.request()
        .input('appId', appId)
        .input('subId', parseInt(subId))
        .query(`
          INSERT INTO application_subjects (application_id, subject_id)
          VALUES (@appId, @subId)
        `);
    }

    // Move to enrolled
    await db.request()
      .input('id', appId)
      .query(`
        UPDATE applications
        SET status = 'enrolled', enrolled_at = GETDATE(), updated_at = GETDATE()
        WHERE id = @id
      `);

    return res.json({ success: true, message: 'Subjects selected. Enrollment complete.' });
  } catch (err) {
    console.error(err);
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
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
