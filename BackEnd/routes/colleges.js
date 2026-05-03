/**
 * colleges.js — Public endpoints for browsing colleges and courses.
 * GET /colleges                    — list all colleges
 * GET /colleges/:id                — single college details
 * GET /colleges/:id/courses        — courses offered by a college
 * GET /colleges/:id/admission-periods  — active admission periods
 * GET /colleges/:id/admission-periods/:periodId/fee  — fee for a period
 * GET /colleges/:id/admission-periods/:periodId/required-docs  — required documents
 */

const express = require('express');
const router  = express.Router();
const db      = require('./db');

// List all colleges
router.get('/', async (req, res) => {
  try {
    const result = await db.request().query(
      'SELECT id, name, address, city, phone, email FROM colleges ORDER BY name'
    );
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// Single college
router.get('/:id', async (req, res) => {
  try {
    const result = await db.request()
      .input('id', parseInt(req.params.id))
      .query('SELECT id, name, address, city, phone, email FROM colleges WHERE id = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'College not found.' });
    }
    return res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// Courses offered by a college
router.get('/:id/courses', async (req, res) => {
  try {
    const result = await db.request()
      .input('id', parseInt(req.params.id))
      .query(`
        SELECT fm.code_no AS id,
               CONCAT(fm.degree_course_code, ' — ', fm.degree_course_name) AS name,
               fm.duration_years,
               fm.degree_course_code AS category
        FROM faculty_master fm
        WHERE fm.college_id = @id AND fm.is_active = 1
        ORDER BY fm.degree_course_name
      `);
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// Active admission periods for a college (what students can apply to)
router.get('/:id/admission-periods', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const result = await db.request()
      .input('id',    parseInt(req.params.id))
      .input('today', today)
      .query(`
        SELECT
          ap.id, ap.year_of_study, ap.academic_year,
          ap.start_date, ap.end_date,
          ap.total_seats, ap.filled_seats, ap.application_fee, ap.is_active,
          fm.code_no AS course_id,
          CONCAT(fm.degree_course_code, ' — ', fm.degree_course_name) AS course_name,
          fm.duration_years,
          fm.degree_course_code AS course_category
        FROM admission_periods ap
        JOIN faculty_master fm ON fm.code_no = ap.course_id AND fm.college_id = ap.college_id
        WHERE ap.college_id = @id
          AND ap.is_active  = 1
          AND ap.start_date <= @today
          AND ap.end_date   >= @today
          AND ap.filled_seats < ap.total_seats
        ORDER BY fm.degree_course_name, ap.year_of_study
      `);

    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// Fee structure for a specific admission period
router.get('/:collegeId/admission-periods/:periodId/fee', async (req, res) => {
  try {
    const { collegeId, periodId } = req.params;
    const { category } = req.query; // 'grant' or 'non-grant'

    const period = await db.request()
      .input('pid', parseInt(periodId))
      .query('SELECT course_id, year_of_study FROM admission_periods WHERE id = @pid');

    if (period.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Admission period not found.' });
    }

    const { course_id, year_of_study } = period.recordset[0];
    const cat = category || 'grant';

    const fee = await db.request()
      .input('col', parseInt(collegeId))
      .input('crs', course_id)
      .input('yr',  year_of_study)
      .input('cat', cat)
      .query(`
        SELECT tuition_fee, exam_fee, other_fee,
               (tuition_fee + exam_fee + other_fee) AS total_fee
        FROM fee_structures
        WHERE college_id = @col AND course_id = @crs
          AND year_of_study = @yr AND category = @cat
      `);

    return res.json({ success: true, data: fee.recordset[0] || null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// Required documents for an admission period
router.get('/:collegeId/admission-periods/:periodId/required-docs', async (req, res) => {
  try {
    const { collegeId, periodId } = req.params;

    const period = await db.request()
      .input('pid', parseInt(periodId))
      .query('SELECT course_id, year_of_study FROM admission_periods WHERE id = @pid');

    if (period.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Admission period not found.' });
    }

    const { course_id, year_of_study } = period.recordset[0];

    const docs = await db.request()
      .input('col', parseInt(collegeId))
      .input('crs', course_id)
      .input('yr',  year_of_study)
      .query(`
        SELECT rd.id, rd.document_type_id, rd.is_mandatory,
               dt.name AS document_name, dt.description
        FROM required_documents rd
        JOIN document_types dt ON dt.id = rd.document_type_id
        WHERE rd.college_id = @col AND rd.course_id = @crs AND rd.year_of_study = @yr
        ORDER BY rd.is_mandatory DESC, dt.name
      `);

    return res.json({ success: true, data: docs.recordset });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// Subjects for a course and year (for subject selection after enrollment)
router.get('/:collegeId/courses/:courseId/subjects/:year', async (req, res) => {
  try {
    const { courseId, year } = req.params;

    const result = await db.request()
      .input('crs', parseInt(courseId))
      .input('yr',  parseInt(year))
      .query(`
        SELECT id, name, subject_type, elective_group
        FROM subjects
        WHERE course_id = @crs AND year_of_study = @yr
        ORDER BY subject_type DESC, elective_group, name
      `);

    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
