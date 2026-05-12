/**
 * application_form.js — Multi-step application form endpoints.
 *
 * POST   /api/applications/init                       — create/resume draft, determine year
 * GET    /api/applications/:id/form                   — fetch full draft for resume
 * GET    /api/student-profile/autofill?student_id=    — autofill data from profile + last app
 * PATCH  /api/applications/:id/personal-details       — save step 2
 * PATCH  /api/applications/:id/other-details          — save step 3
 * PATCH  /api/applications/:id/previous-exam          — save step 4 (with subjects array)
 * POST   /api/applications/:id/form-documents         — upload/link a document
 * DELETE /api/applications/:id/form-documents/:docTypeId — unlink a document
 * POST   /api/applications/:id/declaration            — accept declaration → ready for payment
 * GET    /api/subject-lookup                          — ?college_id=&course_id=&semester=&code=
 * GET    /api/applications/:id/subject-selections     — get subject selections grouped by semester
 * POST   /api/applications/:id/subject-selections     — save selections for a semester
 * GET    /api/required-documents                      — ?college_id=&course_id=&year=
 */

const express  = require('express');
const router   = express.Router();
const db       = require('./db');
const mssql    = require('mssql');
const { authenticate } = require('../middleware/auth');
const logger   = require('../config/logger');

// All application form routes require authentication
router.use(authenticate);

async function logActivity(appId, action, actorRole, note = null) {
  try {
    await db.request()
      .input('appId',     mssql.Int,     parseInt(appId))
      .input('action',    mssql.NVarChar, action)
      .input('actorRole', mssql.NVarChar, actorRole)
      .input('note',      mssql.NVarChar, note || null)
      .query(`INSERT INTO application_activity_log (application_id, action, actor_role, note) VALUES (@appId, @action, @actorRole, @note)`);
  } catch (e) { logger.warn({ err: e }, 'logActivity failed'); }
}

const MIN_AGE_FOR_FY = 17; // years

// ── Validation helpers ───────────────────────────────────────
function validateAadhaar(v)  { return /^\d{12}$/.test(v); }
function validateMobile(v)   { return /^[6-9]\d{9}$/.test(v); }
function validateEmail(v)    { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

function ageFrom(dob) {
  const d = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

function pick(obj, keys) {
  const out = {};
  keys.forEach(k => { if (obj[k] !== undefined) out[k] = obj[k]; });
  return out;
}

// ── POST /api/applications/init ──────────────────────────────
// Create a new draft or return existing draft for same (student, college, course, year, academic_year).
// If year_of_study is omitted, auto-determine from history.
router.post('/applications/init', async (req, res) => {
  const { student_id, college_id, course_id, academic_year, year_of_study, admission_period_id } = req.body;

  if (!student_id || !college_id || !course_id || !academic_year || !admission_period_id) {
    return res.status(400).json({ success: false, message: 'student_id, college_id, course_id, academic_year, admission_period_id are required.' });
  }

  try {
    let yr = parseInt(year_of_study) || null;

    // Auto-determine year if not provided
    if (!yr) {
      const history = await db.request()
        .input('sid', mssql.Int, parseInt(student_id))
        .input('col', mssql.Int, parseInt(college_id))
        .query(`
          SELECT year_of_study FROM applications
          WHERE student_id = @sid AND college_id = @col
            AND status IN ('confirmed','fees_paid','roll_assigned','enrolled')
          ORDER BY year_of_study DESC
        `);

      if (history.recordset.length === 0) {
        yr = 1; // FY by default
      } else {
        const highest = history.recordset[0].year_of_study;
        yr = Math.min(highest + 1, 3);
      }
    }

    // Verify period and enforce year_of_study from period
    const period = await db.request()
      .input('pid', mssql.Int, parseInt(admission_period_id))
      .query(`
        SELECT id, year_of_study, course_id, total_seats, filled_seats, is_active, end_date
        FROM admission_periods WHERE id = @pid
      `);

    if (!period.recordset.length || !period.recordset[0].is_active) {
      return res.status(400).json({ success: false, message: 'Admission period is not active.' });
    }
    const p = period.recordset[0];
    if (new Date(p.end_date) < new Date()) {
      return res.status(400).json({ success: false, message: 'Admission deadline has passed.' });
    }
    if (p.filled_seats >= p.total_seats) {
      return res.status(400).json({ success: false, message: 'No seats available.' });
    }

    // Always use the year from the admission period — never trust client or auto-detect
    yr = p.year_of_study;

    // Check for any existing application for this course+year (any status, any period)
    const existingAny = await db.request()
      .input('sid', mssql.Int, parseInt(student_id))
      .input('col', mssql.Int, parseInt(college_id))
      .input('crs', mssql.Int, parseInt(course_id))
      .input('yr',  mssql.Int, yr)
      .input('ay',  mssql.NVarChar, academic_year)
      .query(`
        SELECT id, status, current_step FROM applications
        WHERE student_id = @sid AND college_id = @col AND course_id = @crs
          AND year_of_study = @yr AND academic_year = @ay
      `);

    if (existingAny.recordset.length > 0) {
      const existing = existingAny.recordset[0];
      // Resume an existing draft
      if (existing.status === 'draft') {
        return res.json({
          success: true,
          data: {
            application_id: existing.id,
            year_of_study:  yr,
            current_step:   existing.current_step || 1,
            resumed: true,
          },
        });
      }
      // Block if active application already exists
      if (!['cancelled', 'rejected'].includes(existing.status)) {
        return res.status(409).json({
          success: false,
          message: 'You have already applied for this course at this college. Applying again for the same course is not allowed.',
        });
      }
    }

    // Create draft — use MERGE to avoid race-condition duplicate inserts
    const result = await db.request()
      .input('sid',  mssql.Int, parseInt(student_id))
      .input('col',  mssql.Int, parseInt(college_id))
      .input('crs',  mssql.Int, parseInt(course_id))
      .input('yr',   mssql.Int, yr)
      .input('ay',   mssql.NVarChar, academic_year)
      .input('apid', mssql.Int, parseInt(admission_period_id))
      .query(`
        MERGE applications AS target
        USING (SELECT @sid AS student_id, @col AS college_id, @crs AS course_id,
                      @yr AS year_of_study, @ay AS academic_year) AS src
          ON  target.student_id    = src.student_id
          AND target.college_id    = src.college_id
          AND target.course_id     = src.course_id
          AND target.year_of_study = src.year_of_study
          AND target.academic_year = src.academic_year
          AND target.status        = 'draft'
        WHEN NOT MATCHED THEN
          INSERT (student_id, college_id, course_id, year_of_study, academic_year,
                  admission_period_id, status, current_step)
          VALUES (@sid, @col, @crs, @yr, @ay, @apid, 'draft', 1)
        OUTPUT INSERTED.id, $action AS merge_action;
      `);

    // If MERGE matched an existing draft (no INSERT happened), fetch it
    if (!result.recordset.length || result.recordset[0].merge_action !== 'INSERT') {
      const existing2 = await db.request()
        .input('sid', mssql.Int, parseInt(student_id))
        .input('col', mssql.Int, parseInt(college_id))
        .input('crs', mssql.Int, parseInt(course_id))
        .input('yr',  mssql.Int, yr)
        .input('ay',  mssql.NVarChar, academic_year)
        .query(`
          SELECT id, current_step FROM applications
          WHERE student_id=@sid AND college_id=@col AND course_id=@crs
            AND year_of_study=@yr AND academic_year=@ay AND status='draft'
        `);
      if (existing2.recordset.length) {
        return res.json({
          success: true,
          data: {
            application_id: existing2.recordset[0].id,
            year_of_study:  yr,
            current_step:   existing2.recordset[0].current_step || 1,
            resumed: true,
          },
        });
      }
    }

    return res.status(201).json({
      success: true,
      data: {
        application_id: result.recordset[0].id,
        year_of_study:  yr,
        current_step:   1,
        resumed: false,
      },
    });
  } catch (err) {
    // Gracefully handle duplicate-key race condition
    if (err.number === 2601 || err.number === 2627) {
      try {
        const existing3 = await db.request()
          .input('sid', mssql.Int, parseInt(student_id))
          .input('col', mssql.Int, parseInt(college_id))
          .input('crs', mssql.Int, parseInt(course_id))
          .input('ay',  mssql.NVarChar, academic_year)
          .query(`
            SELECT id, year_of_study, current_step FROM applications
            WHERE student_id=@sid AND college_id=@col AND course_id=@crs
              AND academic_year=@ay AND status='draft'
          `);
        if (existing3.recordset.length) {
          const r = existing3.recordset[0];
          return res.json({
            success: true,
            data: {
              application_id: r.id,
              year_of_study:  r.year_of_study,
              current_step:   r.current_step || 1,
              resumed: true,
            },
          });
        }
      } catch (_) { /* fall through */ }
    }
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/applications/init-by-college ────────────────────
// College admin creates/resumes a draft on behalf of a student.
// Skips is_active / deadline / seat checks (admin override).
router.post('/applications/init-by-college', async (req, res) => {
  const { student_id, college_id, course_id, academic_year, year_of_study, admission_period_id } = req.body;

  if (!student_id || !college_id || !course_id || !academic_year || !admission_period_id) {
    return res.status(400).json({ success: false, message: 'student_id, college_id, course_id, academic_year, admission_period_id are required.' });
  }

  try {
    // Always get year_of_study from the admission period — same as student init route
    const period = await db.request()
      .input('pid', mssql.Int, parseInt(admission_period_id))
      .query('SELECT id, year_of_study FROM admission_periods WHERE id=@pid');

    if (!period.recordset.length) {
      return res.status(400).json({ success: false, message: 'Admission period not found.' });
    }

    const yr = period.recordset[0].year_of_study;

    // Return existing draft if present (using correct year from period)
    const existing = await db.request()
      .input('sid', mssql.Int, parseInt(student_id))
      .input('col', mssql.Int, parseInt(college_id))
      .input('crs', mssql.Int, parseInt(course_id))
      .input('yr',  mssql.Int, yr)
      .input('ay',  mssql.NVarChar, academic_year)
      .query(`
        SELECT id, current_step FROM applications
        WHERE student_id=@sid AND college_id=@col AND course_id=@crs
          AND year_of_study=@yr AND academic_year=@ay AND status='draft'
      `);

    if (existing.recordset.length > 0) {
      return res.json({
        success: true,
        data: {
          application_id: existing.recordset[0].id,
          year_of_study: yr,
          current_step: existing.recordset[0].current_step || 1,
          resumed: true,
        },
      });
    }

    // Block if an active (non-draft, non-cancelled, non-rejected) application already exists
    const activeCheck = await db.request()
      .input('sid', mssql.Int, parseInt(student_id))
      .input('col', mssql.Int, parseInt(college_id))
      .input('crs', mssql.Int, parseInt(course_id))
      .input('yr',  mssql.Int, yr)
      .input('ay',  mssql.NVarChar, academic_year)
      .query(`
        SELECT id, status FROM applications
        WHERE student_id = @sid AND college_id = @col AND course_id = @crs
          AND year_of_study = @yr AND academic_year = @ay
          AND status NOT IN ('draft','cancelled','rejected')
      `);

    if (activeCheck.recordset.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'This student already has an active application for this course at this college.',
      });
    }

    const result = await db.request()
      .input('sid',  mssql.Int, parseInt(student_id))
      .input('col',  mssql.Int, parseInt(college_id))
      .input('crs',  mssql.Int, parseInt(course_id))
      .input('yr',   mssql.Int, yr)
      .input('ay',   mssql.NVarChar, academic_year)
      .input('apid', mssql.Int, parseInt(admission_period_id))
      .query(`
        INSERT INTO applications
          (student_id, college_id, course_id, year_of_study, academic_year,
           admission_period_id, status, current_step)
        OUTPUT INSERTED.id
        VALUES (@sid, @col, @crs, @yr, @ay, @apid, 'draft', 1)
      `);

    return res.status(201).json({
      success: true,
      data: {
        application_id: result.recordset[0].id,
        year_of_study: yr,
        current_step: 1,
        resumed: false,
      },
    });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/applications/:id/form ───────────────────────────
router.get('/applications/:id/form', async (req, res) => {
  try {
    const appRes = await db.request()
      .input('id', mssql.Int, parseInt(req.params.id))
      .query(`
        SELECT a.*,
               c.name  AS college_name,  c.city AS college_city, c.address AS college_address,
               COALESCE(c.application_fee, 0) AS application_fee,
               COALESCE(cr.degree_course_name, CAST(a.course_id AS NVARCHAR)) AS course_name,
               ap.academic_year AS period_ay,
               s.email AS student_email, s.full_name AS student_name, s.phone AS student_phone,
               s.surname, s.first_name, s.middle_name, s.mother_name,
               s.sex, s.birth_date, s.birth_place, s.birth_state, s.nationality,
               s.marital_status, s.religion, s.caste, s.mother_tongue,
               s.height_cm, s.weight_kg, s.blood_group,
               s.father_full_name, s.father_occupation, s.annual_income,
               s.son_daughter_number, s.aadhaar, s.abc_id, s.prn,
               s.bank_account_number, s.bank_ifsc, s.bank_name, s.bank_branch
        FROM applications a
        JOIN colleges         c  ON c.id       = a.college_id
        LEFT JOIN faculty_master  cr ON cr.code_no  = a.course_id AND cr.college_id = a.college_id
        JOIN admission_periods ap ON ap.id     = a.admission_period_id
        JOIN students         s  ON s.id       = a.student_id
        WHERE a.id = @id
      `);

    if (!appRes.recordset.length) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const app = appRes.recordset[0];

    // Previous exams (multiple rows keyed by exam_type)
    const examQuery = `
      SELECT
        e.id, e.exam_type,
        e.board_or_college_name   AS institute,
        e.school_or_college_address AS board,
        e.month_year_passing      AS month_year,
        e.seat_number             AS seat_no,
        e.total_marks_obtained    AS marks_obtained,
        e.total_marks_max         AS marks_max,
        e.percentage,
        e.class_grade,
        e.remark,
        (SELECT s.id, s.subject_name, s.marks_obtained, s.marks_max
         FROM application_previous_exam_subjects s
         WHERE s.application_previous_exam_id = e.id
         FOR JSON PATH) AS subjects_json
      FROM application_previous_exam e
      WHERE e.application_id = @appId
    `;
    const examRes = await db.request()
      .input('appId', mssql.Int, parseInt(req.params.id))
      .query(examQuery);

    const exams = {};
    for (const row of examRes.recordset) {
      if (row.subjects_json) { row.subjects = JSON.parse(row.subjects_json); delete row.subjects_json; }
      exams[row.exam_type || 'SSC'] = row;
    }

    // If this draft has no exam rows yet, pre-fill from the student's last application
    if (Object.keys(exams).length === 0) {
      const prevExamRes = await db.request()
        .input('sid',   mssql.Int, app.student_id)
        .input('appId', mssql.Int, parseInt(req.params.id))
        .query(`
          SELECT TOP 1 a.id FROM applications a
          WHERE a.student_id = @sid AND a.id != @appId
            AND EXISTS (SELECT 1 FROM application_previous_exam e WHERE e.application_id = a.id)
          ORDER BY a.id DESC
        `);
      if (prevExamRes.recordset.length > 0) {
        const prevAppId = prevExamRes.recordset[0].id;
        const prevRows = await db.request()
          .input('appId', mssql.Int, prevAppId)
          .query(examQuery);
        for (const row of prevRows.recordset) {
          if (row.subjects_json) { row.subjects = JSON.parse(row.subjects_json); delete row.subjects_json; }
          exams[row.exam_type || 'SSC'] = row;
        }
      }
    }

    // Legacy: if only one row without exam_type, keep backward compat
    const exam = examRes.recordset[0] || null;
    if (exam && exam.subjects_json) { exam.subjects = JSON.parse(exam.subjects_json); delete exam.subjects_json; }

    // Linked documents
    const docsRes = await db.request()
      .input('appId', mssql.Int, parseInt(req.params.id))
      .query(`
        SELECT ad.document_type_id,
               dt.name AS document_name,
               sd.id   AS student_document_id,
               sd.file_name, sd.file_path, sd.uploaded_at
        FROM application_documents ad
        JOIN student_documents sd ON sd.id = ad.student_document_id
        JOIN document_types    dt ON dt.id = ad.document_type_id
        WHERE ad.application_id = @appId
      `);

    return res.json({
      success: true,
      data: { application: app, previous_exam: exam, previous_exams: exams, documents: docsRes.recordset },
    });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/student-profile/autofill ───────────────────────
router.get('/student-profile/autofill', async (req, res) => {
  const { student_id } = req.query;
  if (!student_id) return res.status(400).json({ success: false, message: 'student_id required.' });

  try {
    const profRes = await db.request()
      .input('sid', mssql.Int, parseInt(student_id))
      .query(`
        SELECT full_name, email, phone, city, address,
               surname, first_name, middle_name, mother_name,
               sex, birth_date, birth_place, birth_taluka, birth_district, birth_state,
               nationality, marital_status, religion, caste, mother_tongue,
               height_cm, weight_kg, blood_group,
               father_full_name, father_occupation, annual_income, son_daughter_number,
               aadhaar, abc_id, prn,
               bank_account_number AS bank_account, bank_ifsc, bank_name, bank_branch
        FROM students WHERE id = @sid
      `);

    const profile = profRes.recordset[0] || {};

    // Most recent completed application for extra autofill
    const lastAppRes = await db.request()
      .input('sid', mssql.Int, parseInt(student_id))
      .query(`
        SELECT TOP 1
          app_surname, app_first_name, app_middle_name, app_mother_name,
          app_sex, app_mobile, app_email, app_address, app_taluka, app_district, app_state,
          app_category, fees_category,
          app_birth_date, app_birth_place, app_birth_taluka, app_birth_district, app_birth_state,
          app_nationality, app_marital_status, app_religion, app_caste, app_mother_tongue,
          app_height_cm, app_weight_kg, app_blood_group,
          app_father_full_name, app_son_daughter_no, app_father_occupation, app_annual_income,
          app_aadhaar, app_prn, app_abc_id, app_university_app_no,
          app_bank_account, app_bank_ifsc, app_bank_name, app_bank_branch
        FROM applications
        WHERE student_id = @sid AND status NOT IN ('draft','rejected','cancelled')
        ORDER BY created_at DESC
      `);

    const lastApp = lastAppRes.recordset[0] || {};

    return res.json({ success: true, data: { profile, last_application: lastApp } });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

async function getCollegeName(appId) {
  const r = await db.request()
    .input('id', require('mssql').Int, appId)
    .query('SELECT c.name FROM applications a JOIN colleges c ON c.id = a.college_id WHERE a.id = @id');
  return r.recordset[0]?.name || null;
}

// ── Helper: assert draft and ownership ──────────────────────
// Editable statuses: student can edit form until scrutiny_accepted
const EDITABLE_STATUSES = ['draft', 'submitted', 'under_review', 'correction_requested', 'correction_done'];

async function assertDraft(appId, res) {
  const r = await db.request()
    .input('id', mssql.Int, appId)
    .query('SELECT id, status, student_id, year_of_study, application_fee_paid FROM applications WHERE id = @id');
  if (!r.recordset.length) { res.status(404).json({ success: false, message: 'Application not found.' }); return null; }
  const app = r.recordset[0];
  if (!EDITABLE_STATUSES.includes(app.status)) {
    res.status(400).json({ success: false, message: 'Application can no longer be edited after scrutiny acceptance.' });
    return null;
  }
  return app;
}

// ── PATCH /api/applications/:id/personal-details (Step 2) ───
router.patch('/applications/:id/personal-details', async (req, res) => {
  const appId = parseInt(req.params.id);
  const app = await assertDraft(appId, res);
  if (!app) return;

  const {
    surname, first_name, middle_name, mother_name,
    sex, mobile, email,
    address, taluka, district, state,
    category, special_status,
    fees_category, fees_category_override, fees_category_override_remark,
    division, degree_course_code,
  } = req.body;

  const errors = {};
  if (!surname)       errors.surname       = 'Surname is required.';
  if (!first_name)    errors.first_name    = 'First name is required.';
  if (!middle_name)   errors.middle_name   = 'Middle name / father\'s name is required.';
  if (!mother_name)   errors.mother_name   = 'Mother\'s name is required.';
  if (!sex)           errors.sex           = 'Sex is required.';
  if (!mobile)        errors.mobile        = 'Mobile number is required.';
  else if (!validateMobile(mobile)) errors.mobile = 'Mobile must be 10 digits starting with 6-9.';
  if (!email)         errors.email         = 'Email is required.';
  else if (!validateEmail(email)) errors.email = 'Invalid email format.';
  if (!address)       errors.address       = 'Residential address is required.';
  if (!taluka)        errors.taluka        = 'Taluka is required.';
  if (!district)      errors.district      = 'District is required.';
  if (!state)         errors.state         = 'State is required.';
  if (!fees_category) errors.fees_category = 'Fees category is required.';

  if (Object.keys(errors).length) {
    return res.status(422).json({ success: false, errors });
  }

  try {
    await db.request()
      .input('id',    mssql.Int,      appId)
      .input('sn',    mssql.NVarChar, surname)
      .input('fn',    mssql.NVarChar, first_name)
      .input('mn',    mssql.NVarChar, middle_name)
      .input('moth',  mssql.NVarChar, mother_name)
      .input('sex',   mssql.NVarChar, sex)
      .input('mob',   mssql.NVarChar, mobile)
      .input('em',    mssql.NVarChar, email)
      .input('addr',  mssql.NVarChar, address)
      .input('tal',   mssql.NVarChar, taluka)
      .input('dist',  mssql.NVarChar, district)
      .input('st',    mssql.NVarChar, state)
      .input('cat',      mssql.NVarChar, category        || null)
      .input('sstat',    mssql.NVarChar, special_status  || null)
      .input('fcat',     mssql.NVarChar, fees_category)
      .input('fover',    mssql.Bit,      fees_category_override ? 1 : 0)
      .input('fovermk',  mssql.NVarChar, fees_category_override_remark || null)
      .input('div',      mssql.Char,     division || null)
      .input('dcc',      mssql.NVarChar, degree_course_code || null)
      .input('step',     mssql.Int,      2)
      .query(`
        UPDATE applications SET
          app_surname=@sn, app_first_name=@fn, app_middle_name=@mn, app_mother_name=@moth,
          app_sex=@sex, app_mobile=@mob, app_email=@em,
          app_address=@addr, app_taluka=@tal, app_district=@dist, app_state=@st,
          app_category=@cat, app_special_status=@sstat,
          fees_category=@fcat,
          fees_category_override=@fover,
          fees_category_override_remark=@fovermk,
          app_division=@div,
          app_degree_course_code=@dcc,
          current_step = CASE WHEN current_step < @step THEN @step ELSE current_step END,
          updated_at=GETDATE()
        WHERE id=@id
      `);

    return res.json({ success: true, message: 'Personal details saved.', current_step: 2 });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PATCH /api/applications/:id/other-details (Step 3) ──────
router.patch('/applications/:id/other-details', async (req, res) => {
  const appId = parseInt(req.params.id);
  const app = await assertDraft(appId, res);
  if (!app) return;

  const {
    birth_date, birth_place, birth_taluka, birth_district, birth_state, nationality,
    marital_status, religion, caste, mother_tongue, height_cm, weight_kg, blood_group,
    father_full_name, son_daughter_number, father_occupation, annual_income,
    aadhaar, prn, abc_id, university_app_no,
    bank_account, bank_ifsc, bank_name, bank_branch,
  } = req.body;

  const errors = {};
  if (!birth_date)      errors.birth_date      = 'Birth date is required.';
  else {
    const age = ageFrom(birth_date);
    if (app.year_of_study === 1 && age < MIN_AGE_FOR_FY) {
      errors.birth_date = `Student must be at least ${MIN_AGE_FOR_FY} years old for FY.`;
    }
  }
  if (!nationality)     errors.nationality     = 'Nationality is required.';
  if (!marital_status)  errors.marital_status  = 'Marital status is required.';
  if (!father_full_name)errors.father_full_name= 'Father\'s full name is required.';
  if (!father_occupation)errors.father_occupation='Father\'s occupation is required.';
  if (!annual_income) {
    errors.annual_income = 'Annual family income is required.';
  } else {
    const ai = parseFloat(annual_income);
    if (isNaN(ai) || ai <= 0) errors.annual_income = 'Annual family income must be greater than 0.';
  }
  if (!aadhaar)         errors.aadhaar         = 'Aadhaar number is required.';
  else if (!validateAadhaar(aadhaar)) errors.aadhaar = 'Aadhaar must be exactly 12 digits.';
  if (app.year_of_study > 1 && !abc_id) errors.abc_id = 'ABC ID is required for SY/TY students.';
  if (app.year_of_study > 1 && !prn) errors.prn = 'PRN is required for SY/TY students.';

  // Bank: if any one provided, account + IFSC become required
  const anyBank = bank_account || bank_ifsc || bank_name || bank_branch;
  if (anyBank) {
    if (!bank_account) errors.bank_account = 'Bank account number is required when bank details are provided.';
    if (!bank_ifsc)    errors.bank_ifsc    = 'IFSC code is required when bank details are provided.';
  }

  if (Object.keys(errors).length) {
    return res.status(422).json({ success: false, errors });
  }

  try {
    await db.request()
      .input('id',   mssql.Int,      appId)
      .input('bd',   mssql.Date,     birth_date)
      .input('bp',   mssql.NVarChar, birth_place)
      .input('btal', mssql.NVarChar, birth_taluka   || null)
      .input('bdi',  mssql.NVarChar, birth_district || null)
      .input('bst',  mssql.NVarChar, birth_state)
      .input('nat',  mssql.NVarChar, nationality)
      .input('ms',   mssql.NVarChar, marital_status)
      .input('rel',  mssql.NVarChar, religion       || null)
      .input('cas',  mssql.NVarChar, caste          || null)
      .input('mtg',  mssql.NVarChar, mother_tongue  || null)
      .input('hgt',  mssql.Int,      height_cm      ? parseInt(height_cm)     : null)
      .input('wgt',  mssql.Decimal,  weight_kg      ? parseFloat(weight_kg)   : null)
      .input('bg',   mssql.NVarChar, blood_group    || null)
      .input('ffn',  mssql.NVarChar, father_full_name)
      .input('sdn',  mssql.Int,      son_daughter_number ? parseInt(son_daughter_number) : null)
      .input('fo',   mssql.NVarChar, father_occupation)
      .input('ai',   mssql.Decimal,  parseFloat(annual_income))
      .input('adh',  mssql.NVarChar, aadhaar)
      .input('prn',  mssql.NVarChar, prn              || null)
      .input('abc',  mssql.NVarChar, abc_id)
      .input('uano', mssql.NVarChar, university_app_no || null)
      .input('bacc', mssql.NVarChar, bank_account   || null)
      .input('bifc', mssql.NVarChar, bank_ifsc      || null)
      .input('bnm',  mssql.NVarChar, bank_name      || null)
      .input('bbr',  mssql.NVarChar, bank_branch    || null)
      .input('step', mssql.Int,      3)
      .query(`
        UPDATE applications SET
          app_birth_date=@bd, app_birth_place=@bp, app_birth_taluka=@btal,
          app_birth_district=@bdi, app_birth_state=@bst, app_nationality=@nat,
          app_marital_status=@ms, app_religion=@rel, app_caste=@cas,
          app_mother_tongue=@mtg, app_height_cm=@hgt, app_weight_kg=@wgt, app_blood_group=@bg,
          app_father_full_name=@ffn, app_son_daughter_no=@sdn, app_father_occupation=@fo,
          app_annual_income=@ai, app_aadhaar=@adh, app_prn=@prn, app_abc_id=@abc,
          app_university_app_no=@uano,
          app_bank_account=@bacc, app_bank_ifsc=@bifc, app_bank_name=@bnm, app_bank_branch=@bbr,
          current_step = CASE WHEN current_step < @step THEN @step ELSE current_step END,
          updated_at=GETDATE()
        WHERE id=@id
      `);

    // Write prn back to students table so future applications autofill it
    if (prn) {
      await db.request()
        .input('sid', mssql.Int,      app.student_id)
        .input('prn', mssql.NVarChar, prn)
        .query('UPDATE students SET prn=@prn WHERE id=@sid');
    }

    return res.json({ success: true, message: 'Other details saved.', current_step: 3 });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PATCH /api/applications/:id/previous-exam (Step 4) ──────
// Body: { exams: { SSC: {...}, HSC: {...}, FY_SEM1: {...}, FY_SEM2: {...}, ... } }
// Each exam row: { institute, board, month_year, seat_no, marks_obtained, marks_max, percentage, class_grade, remark }
router.patch('/applications/:id/previous-exam', async (req, res) => {
  const appId = parseInt(req.params.id);
  const app = await assertDraft(appId, res);
  if (!app) return;

  const { exams } = req.body; // keyed by exam_type

  if (!exams || typeof exams !== 'object') {
    return res.status(422).json({ success: false, message: 'exams object is required.' });
  }

  const yearOfStudy = app.year_of_study;

  // Mandatory exam types per year
  const mandatory = {
    1: ['SSC', 'HSC'],
    2: ['SSC', 'HSC', 'FY_SEM1', 'FY_SEM2'],
    3: ['SSC', 'HSC', 'FY_SEM1', 'FY_SEM2', 'SY_SEM1', 'SY_SEM2'],
  }[yearOfStudy] || ['SSC', 'HSC'];

  const REQUIRED_EXAM_FIELDS = ['institute', 'board', 'month_year', 'seat_no', 'marks_obtained', 'marks_max', 'percentage', 'class_grade'];
  const errors = {};
  for (const type of mandatory) {
    const row = exams[type];
    if (!row) { errors[type] = `${type} details are required.`; continue; }
    for (const field of REQUIRED_EXAM_FIELDS) {
      if (!String(row[field] || '').trim()) {
        errors[`${type}_${field}`] = `${type}: ${field} is required.`;
      }
    }
  }
  if (Object.keys(errors).length) {
    return res.status(422).json({ success: false, errors });
  }

  try {
    // Upsert each provided exam row
    for (const [examType, row] of Object.entries(exams)) {
      if (!row) continue;
      const existing = await db.request()
        .input('appId', mssql.Int,      appId)
        .input('type',  mssql.NVarChar, examType)
        .query('SELECT id FROM application_previous_exam WHERE application_id=@appId AND exam_type=@type');

      const inputs = (r) => r
        .input('inst', mssql.NVarChar, row.institute?.trim()          || null)
        .input('brd',  mssql.NVarChar, row.board?.trim()              || null)
        .input('my',   mssql.NVarChar, row.month_year?.trim()         || null)
        .input('seat', mssql.NVarChar, row.seat_no?.trim()            || null)
        .input('tmo',  mssql.Decimal,  parseFloat(row.marks_obtained) || null)
        .input('tmx',  mssql.Decimal,  parseFloat(row.marks_max)      || null)
        .input('pct',  mssql.Decimal,  parseFloat(row.percentage)     || null)
        .input('cls',  mssql.NVarChar, row.class_grade?.trim()        || null)
        .input('rem',  mssql.NVarChar, row.remark?.trim()             || null)

      if (existing.recordset.length > 0) {
        await inputs(db.request().input('id', mssql.Int, existing.recordset[0].id))
          .query(`
            UPDATE application_previous_exam SET
              board_or_college_name=@inst, school_or_college_address=@brd,
              seat_number=@seat, month_year_passing=@my,
              total_marks_obtained=@tmo, total_marks_max=@tmx,
              percentage=@pct, class_grade=@cls, remark=@rem,
              updated_at=GETDATE()
            WHERE id=@id
          `);
      } else {
        await inputs(db.request().input('appId', mssql.Int, appId).input('type', mssql.NVarChar, examType))
          .query(`
            INSERT INTO application_previous_exam
              (application_id, exam_type, board_or_college_name, school_or_college_address,
               seat_number, month_year_passing, total_marks_obtained, total_marks_max,
               percentage, class_grade, remark)
            VALUES (@appId,@type,@inst,@brd,@seat,@my,@tmo,@tmx,@pct,@cls,@rem)
          `);
      }
    }

    await db.request()
      .input('id',   mssql.Int, appId)
      .input('step', mssql.Int, 4)
      .query(`
        UPDATE applications SET
          current_step = CASE WHEN current_step < @step THEN @step ELSE current_step END,
          updated_at=GETDATE()
        WHERE id=@id
      `);

    return res.json({ success: true, message: 'Previous exam details saved.', current_step: 4 });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/applications/:id/form-documents (Step 5) ──────
// Links an existing student_document to this application, or creates a new student_document entry.
router.post('/applications/:id/form-documents', async (req, res) => {
  const appId = parseInt(req.params.id);
  const app = await assertDraft(appId, res);
  if (!app) return;

  const { student_id, document_type_id, file_name, file_path } = req.body;
  if (!student_id || !document_type_id || !file_name || !file_path) {
    return res.status(400).json({ success: false, message: 'student_id, document_type_id, file_name, file_path are required.' });
  }

  // Validate extension
  const ext = file_name.split('.').pop().toLowerCase();
  if (!['pdf','jpg','jpeg','png'].includes(ext)) {
    return res.status(422).json({ success: false, message: 'Only PDF, JPG and PNG files are allowed.' });
  }

  try {
    // Upsert student_document
    const existSD = await db.request()
      .input('sid',  mssql.Int, parseInt(student_id))
      .input('dtid', mssql.Int, parseInt(document_type_id))
      .query('SELECT id FROM student_documents WHERE student_id=@sid AND document_type_id=@dtid');

    let sdId;
    if (existSD.recordset.length > 0) {
      sdId = existSD.recordset[0].id;
      await db.request()
        .input('id', mssql.Int,      sdId)
        .input('fn', mssql.NVarChar, file_name)
        .input('fp', mssql.NVarChar, file_path)
        .query('UPDATE student_documents SET file_name=@fn, file_path=@fp, uploaded_at=GETDATE() WHERE id=@id');
    } else {
      const ins = await db.request()
        .input('sid',  mssql.Int,      parseInt(student_id))
        .input('dtid', mssql.Int,      parseInt(document_type_id))
        .input('fn',   mssql.NVarChar, file_name)
        .input('fp',   mssql.NVarChar, file_path)
        .query(`
          INSERT INTO student_documents (student_id, document_type_id, file_name, file_path)
          OUTPUT INSERTED.id VALUES (@sid, @dtid, @fn, @fp)
        `);
      sdId = ins.recordset[0].id;
    }

    // Upsert application_documents
    const existAD = await db.request()
      .input('appId', mssql.Int, appId)
      .input('dtid',  mssql.Int, parseInt(document_type_id))
      .query('SELECT id FROM application_documents WHERE application_id=@appId AND document_type_id=@dtid');

    if (existAD.recordset.length > 0) {
      await db.request()
        .input('id',   mssql.Int, existAD.recordset[0].id)
        .input('sdId', mssql.Int, sdId)
        .query('UPDATE application_documents SET student_document_id=@sdId WHERE id=@id');
    } else {
      await db.request()
        .input('appId', mssql.Int, appId)
        .input('sdId',  mssql.Int, sdId)
        .input('dtid',  mssql.Int, parseInt(document_type_id))
        .query(`
          INSERT INTO application_documents (application_id, student_document_id, document_type_id)
          VALUES (@appId, @sdId, @dtid)
        `);
    }

    await db.request()
      .input('id',   mssql.Int, appId)
      .input('step', mssql.Int, 5)
      .query(`
        UPDATE applications SET
          current_step = CASE WHEN current_step < @step THEN @step ELSE current_step END,
          updated_at=GETDATE()
        WHERE id=@id
      `);

    return res.json({ success: true, message: 'Document linked to application.' });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── DELETE /api/applications/:id/form-documents/:docTypeId ──
router.delete('/applications/:id/form-documents/:docTypeId', async (req, res) => {
  const appId      = parseInt(req.params.id);
  const docTypeId  = parseInt(req.params.docTypeId);
  const app = await assertDraft(appId, res);
  if (!app) return;

  try {
    await db.request()
      .input('appId', mssql.Int, appId)
      .input('dtid',  mssql.Int, docTypeId)
      .query('DELETE FROM application_documents WHERE application_id=@appId AND document_type_id=@dtid');

    return res.json({ success: true, message: 'Document removed from application.' });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/applications/:id/declaration (Step 6) ─────────
router.post('/applications/:id/declaration', async (req, res) => {
  const appId = parseInt(req.params.id);
  const app = await assertDraft(appId, res);
  if (!app) return;

  const { accepted } = req.body;
  if (!accepted) {
    return res.status(422).json({ success: false, message: 'You must accept the declaration to proceed.' });
  }

  try {
    // Verify all mandatory docs are linked
    const missingDocs = await db.request()
      .input('appId', mssql.Int, appId)
      .query(`
        SELECT rd.document_type_id, dt.name AS doc_name
        FROM required_documents rd
        JOIN document_types dt ON dt.id = rd.document_type_id
        JOIN applications a ON a.college_id = rd.college_id
                           AND a.course_id  = rd.course_id
                           AND a.year_of_study = rd.year_of_study
        WHERE a.id = @appId AND rd.is_mandatory = 1
          AND NOT EXISTS (
            SELECT 1 FROM application_documents ad
            WHERE ad.application_id = @appId AND ad.document_type_id = rd.document_type_id
          )
      `);

    if (missingDocs.recordset.length > 0) {
      const names = missingDocs.recordset.map(d => d.doc_name).join(', ');
      return res.status(422).json({
        success: false,
        message: `Please upload the following mandatory documents before proceeding: ${names}`,
        missing_documents: missingDocs.recordset,
      });
    }

    await db.request()
      .input('id',   mssql.Int,      appId)
      .input('step', mssql.Int,      6)
      .query(`
        UPDATE applications SET
          declaration_accepted_at = GETDATE(),
          current_step = @step,
          updated_at   = GETDATE()
        WHERE id = @id
      `);

    return res.json({ success: true, message: 'Declaration accepted. Application ready for payment.' });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/applications/:id/resubmit (correction flow) ───
// Called when student has already paid the application fee and is resubmitting
// after a college correction request. Skips payment, sets status → under_review.
router.post('/applications/:id/resubmit', async (req, res) => {
  const appId = parseInt(req.params.id);
  const app = await assertDraft(appId, res);
  if (!app) return;

  if (!app.application_fee_paid) {
    return res.status(400).json({ success: false, message: 'Application fee not paid. Please use the standard submit flow.' });
  }

  try {
    // Verify all mandatory docs are linked
    const missingDocs = await db.request()
      .input('appId', mssql.Int, appId)
      .query(`
        SELECT rd.document_type_id, dt.name AS doc_name
        FROM required_documents rd
        JOIN document_types dt ON dt.id = rd.document_type_id
        JOIN applications a ON a.college_id = rd.college_id
                           AND a.course_id  = rd.course_id
                           AND a.year_of_study = rd.year_of_study
        WHERE a.id = @appId AND rd.is_mandatory = 1
          AND NOT EXISTS (
            SELECT 1 FROM application_documents ad
            WHERE ad.application_id = @appId AND ad.document_type_id = rd.document_type_id
          )
      `);

    if (missingDocs.recordset.length > 0) {
      const names = missingDocs.recordset.map(d => d.doc_name).join(', ');
      return res.status(422).json({
        success: false,
        message: `Please upload the following mandatory documents before proceeding: ${names}`,
        missing_documents: missingDocs.recordset,
      });
    }

    // If coming from a correction request → correction_done (college sees it in Awaiting Correction tab)
    // If student is just re-editing a submitted/under_review application → stay under_review
    const newStatus = ['correction_requested', 'correction_done'].includes(app.status)
      ? 'correction_done'
      : 'under_review';

    await db.request()
      .input('id',     mssql.Int,      appId)
      .input('status', mssql.NVarChar, newStatus)
      .query(`
        UPDATE applications SET
          status = @status,
          correction_note = NULL,
          declaration_accepted_at = GETDATE(),
          current_step = 6,
          updated_at = GETDATE(),
          status_updated_at = GETDATE()
        WHERE id = @id
      `);

    await logActivity(appId, 'correction_resubmitted', 'student', null);

    return res.json({ success: true, message: 'Application resubmitted successfully.' });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/subjects-list ───────────────────────────────────
// List all active subjects for a college + course + semester
// ?college_id=&course_id=&semester=
router.get('/subjects-list', async (req, res) => {
  const { college_id, course_id, semester } = req.query;
  if (!college_id || !course_id || !semester) {
    return res.status(400).json({ success: false, message: 'college_id, course_id, and semester are required.' });
  }
  try {
    const result = await db.request()
      .input('collegeId', mssql.Int, parseInt(college_id))
      .input('courseId',  mssql.Int, parseInt(course_id))
      .input('semester',  mssql.Int, parseInt(semester))
      .query(`
        SELECT course_code, course_title, subject_type, display_order
        FROM course_master
        WHERE college_id = @collegeId
          AND faculty_master_id = @courseId
          AND semester = @semester
          AND is_active = 1
        ORDER BY display_order, course_code
      `);
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/subject-lookup ─────────────────────────────────
// Lookup a subject by code for a college + course + semester
// ?college_id=&course_id=&semester=&code=
router.get('/subject-lookup', async (req, res) => {
  const { college_id, course_id, semester, code } = req.query;
  if (!college_id || !course_id || !semester || !code) {
    return res.status(400).json({ success: false, message: 'college_id, course_id, semester, and code are required.' });
  }
  try {
    const result = await db.request()
      .input('collegeId',  mssql.Int,      parseInt(college_id))
      .input('courseId',   mssql.Int,      parseInt(course_id))
      .input('semester',   mssql.Int,      parseInt(semester))
      .input('code',       mssql.NVarChar, code.trim().toUpperCase())
      .query(`
        SELECT course_code, course_title
        FROM course_master
        WHERE college_id = @collegeId
          AND faculty_master_id = @courseId
          AND semester = @semester
          AND UPPER(course_code) = @code
          AND is_active = 1
      `);
    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Subject code not found.' });
    }
    return res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/applications/:id/subject-selections ────────────
// Get student's saved subject selections grouped by semester
router.get('/applications/:id/subject-selections', async (req, res) => {
  const appId = parseInt(req.params.id);
  try {
    const appRes = await db.request()
      .input('id', mssql.Int, appId)
      .query(`SELECT id, status, college_id, course_id, year_of_study FROM applications WHERE id = @id`);
    if (appRes.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    const app = appRes.recordset[0];

    const subs = await db.request()
      .input('appId', mssql.Int, appId)
      .query(`
        SELECT semester, subject_code, subject_title, display_order
        FROM application_subjects
        WHERE application_id = @appId
        ORDER BY semester, display_order, id
      `);

    // Group by semester
    const bySem = { 1: [], 2: [] };
    for (const row of subs.recordset) {
      if (bySem[row.semester]) bySem[row.semester].push({ code: row.subject_code, title: row.subject_title });
    }

    const canSelect = ['fees_paid', 'roll_assigned', 'enrolled'].includes(app.status);

    return res.json({
      success: true,
      data: {
        semester1: bySem[1],
        semester2: bySem[2],
        can_select: canSelect,
        college_id: app.college_id,
        course_id: app.course_id,
        year_of_study: app.year_of_study,
        status: app.status,
      },
    });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/applications/:id/subject-selections ───────────
// Save subject selections for a semester. Body: { semester, subjects: [{code, title}] }
router.post('/applications/:id/subject-selections', async (req, res) => {
  const appId = parseInt(req.params.id);
  const { semester, subjects } = req.body;

  if (!semester || ![1, 2].includes(parseInt(semester))) {
    return res.status(400).json({ success: false, message: 'semester must be 1 or 2.' });
  }
  if (!Array.isArray(subjects)) {
    return res.status(400).json({ success: false, message: 'subjects array is required.' });
  }

  const semInt = parseInt(semester);

  try {
    const appRes = await db.request()
      .input('id', mssql.Int, appId)
      .query(`SELECT id, status FROM applications WHERE id = @id`);
    if (appRes.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    if (!['fees_paid', 'roll_assigned', 'enrolled'].includes(appRes.recordset[0].status)) {
      return res.status(400).json({ success: false, message: 'Subject selection is only available after admission is confirmed.' });
    }

    // Delete existing selections for this semester
    await db.request()
      .input('appId', mssql.Int, appId)
      .input('sem',   mssql.Int, semInt)
      .query(`DELETE FROM application_subjects WHERE application_id = @appId AND semester = @sem`);

    // Insert new selections
    for (let i = 0; i < subjects.length; i++) {
      const s = subjects[i];
      if (!s.code || !s.title) continue;
      await db.request()
        .input('appId',   mssql.Int,      appId)
        .input('sem',     mssql.Int,      semInt)
        .input('code',    mssql.NVarChar, s.code.trim().toUpperCase())
        .input('title',   mssql.NVarChar, s.title.trim())
        .input('order',   mssql.Int,      i)
        .query(`
          INSERT INTO application_subjects (application_id, semester, subject_code, subject_title, display_order)
          VALUES (@appId, @sem, @code, @title, @order)
        `);
    }

    // Log subject selection activity
    const subjectNote = `Semester ${semInt}: ${subjects.length} subject${subjects.length !== 1 ? 's' : ''} selected`;
    await logActivity(appId, 'subject_selected', 'student', subjectNote);

    // Update status to enrolled if roll_assigned and both sems have subjects
    if (appRes.recordset[0].status === 'roll_assigned') {
      const countRes = await db.request()
        .input('appId', mssql.Int, appId)
        .query(`SELECT COUNT(DISTINCT semester) AS sem_count FROM application_subjects WHERE application_id = @appId`);
      if (countRes.recordset[0].sem_count >= 2) {
        await db.request()
          .input('id', mssql.Int, appId)
          .query(`UPDATE applications SET status = 'enrolled', updated_at = GETDATE(), status_updated_at = GETDATE() WHERE id = @id`);
        await logActivity(appId, 'enrolled', 'student', 'Subject selection completed');
      }
    }

    return res.json({ success: true, message: 'Subjects saved.' });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/required-documents ─────────────────────────────
router.get('/required-documents', async (req, res) => {
  const { college_id, course_id, year } = req.query;
  if (!college_id || !course_id || !year) {
    return res.status(400).json({ success: false, message: 'college_id, course_id, year are required.' });
  }

  try {
    const result = await db.request()
      .input('col', mssql.Int, parseInt(college_id))
      .input('crs', mssql.Int, parseInt(course_id))
      .input('yr',  mssql.Int, parseInt(year))
      .query(`
        SELECT rd.id, rd.document_type_id, rd.is_mandatory,
               dt.name AS document_name, dt.description
        FROM college_required_documents rd
        JOIN document_types dt ON dt.id = rd.document_type_id
        WHERE rd.college_id = @col AND rd.faculty_master_id = @crs AND rd.year_of_study = @yr
        ORDER BY rd.is_mandatory DESC, dt.name
      `);

    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
