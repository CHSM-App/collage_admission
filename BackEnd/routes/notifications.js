/**
 * notifications.js — Student notification feed derived from application state.
 *
 * GET /notifications/student/:studentId        — all notifications
 * POST /notifications/student/:studentId/read  — mark all as read (updates last_notif_seen_at on student)
 */

const express = require('express');
const router  = express.Router();
const db      = require('./db');

// Map each application status to a notification message + action link
function buildNotifications(apps) {
  const notes = [];

  for (const app of apps) {
    const link = `/student/dashboard?section=applications`;
    const appLink = `/apply/${app.id}`;

    switch (app.status) {
      case 'under_review':
        notes.push({
          app_id:    app.id,
          status:    app.status,
          college:   app.college_name,
          course:    app.course_name,
          title:     'Application Under Review',
          body:      `Your application to ${app.college_name} (${app.course_name}) is being reviewed by the college.`,
          link,
          updated_at: app.status_updated_at || app.submitted_at,
          type:      'info',
        });
        break;

      case 'correction_requested':
        notes.push({
          app_id:    app.id,
          status:    app.status,
          college:   app.college_name,
          course:    app.course_name,
          title:     'Correction Required',
          body:      `${app.college_name} has requested corrections to your ${app.course_name} application. Please review and resubmit.`,
          link:      appLink,
          updated_at: app.status_updated_at || app.submitted_at,
          type:      'warning',
        });
        break;

      case 'correction_done':
        notes.push({
          app_id:    app.id,
          status:    app.status,
          college:   app.college_name,
          course:    app.course_name,
          title:     'Correction Submitted — Awaiting Review',
          body:      `Your corrected application for ${app.course_name} at ${app.college_name} has been submitted. The college will review it.`,
          link,
          updated_at: app.status_updated_at || app.submitted_at,
          type:      'info',
        });
        break;

      case 'scrutiny_accepted':
        notes.push({
          app_id:    app.id,
          status:    app.status,
          college:   app.college_name,
          course:    app.course_name,
          title:     'Scrutiny Accepted — Visit College',
          body:      `Your application for ${app.course_name} at ${app.college_name} has been accepted. Please visit the college for document verification.`,
          link,
          updated_at: app.status_updated_at || app.submitted_at,
          type:      'success',
        });
        break;

      case 'doc_verification_pending':
        notes.push({
          app_id:    app.id,
          status:    app.status,
          college:   app.college_name,
          course:    app.course_name,
          title:     'Document Verification Pending',
          body:      `Bring your original documents to ${app.college_name} for verification of your ${app.course_name} application.`,
          link,
          updated_at: app.status_updated_at || app.submitted_at,
          type:      'warning',
        });
        break;

      case 'confirmed':
        notes.push({
          app_id:    app.id,
          status:    app.status,
          college:   app.college_name,
          course:    app.course_name,
          title:     'Admission Confirmed — Pay College Fee',
          body:      `Your admission to ${app.course_name} at ${app.college_name} is confirmed. Pay the college fee to secure your seat.`,
          link:      `/student/dashboard?section=applications`,
          updated_at: app.status_updated_at || app.submitted_at,
          type:      'action',
        });
        break;

      case 'fees_paid':
        notes.push({
          app_id:    app.id,
          status:    app.status,
          college:   app.college_name,
          course:    app.course_name,
          title:     'Fees Paid Successfully',
          body:      `College fee payment received for ${app.course_name} at ${app.college_name}. Awaiting roll number assignment.`,
          link,
          updated_at: app.status_updated_at || app.submitted_at,
          type:      'success',
        });
        break;

      case 'roll_assigned':
        notes.push({
          app_id:    app.id,
          status:    app.status,
          college:   app.college_name,
          course:    app.course_name,
          title:     'Roll Number Assigned — Select Subjects',
          body:      `Roll number ${app.roll_number} assigned for ${app.course_name} at ${app.college_name}. Please select your subjects to complete enrollment.`,
          link:      `/student/dashboard?section=applications`,
          updated_at: app.status_updated_at || app.submitted_at,
          type:      'action',
        });
        break;

      case 'enrolled':
        notes.push({
          app_id:    app.id,
          status:    app.status,
          college:   app.college_name,
          course:    app.course_name,
          title:     'Enrollment Complete',
          body:      `Congratulations! You are now enrolled in ${app.course_name} at ${app.college_name}.`,
          link,
          updated_at: app.status_updated_at || app.submitted_at,
          type:      'success',
        });
        break;

      case 'rejected':
        notes.push({
          app_id:    app.id,
          status:    app.status,
          college:   app.college_name,
          course:    app.course_name,
          title:     'Application Rejected',
          body:      `Your application for ${app.course_name} at ${app.college_name} was not accepted.${app.rejection_reason ? ' Reason: ' + app.rejection_reason : ''}`,
          link,
          updated_at: app.status_updated_at || app.submitted_at,
          type:      'error',
        });
        break;

      default:
        break; // draft / submitted — no notification needed
    }
  }

  // Sort newest first
  notes.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  return notes;
}

// ── GET notifications ────────────────────────────────────────
router.get('/student/:studentId', async (req, res) => {
  const studentId = parseInt(req.params.studentId);
  if (!studentId) return res.status(400).json({ success: false, message: 'Invalid studentId' });

  try {
    const result = await db.request()
      .input('sid', studentId)
      .query(`
        SELECT
          a.id, a.status, a.roll_number, a.submitted_at,
          a.rejection_reason, a.correction_note,
          a.status_updated_at,
          c.name  AS college_name,
          COALESCE(cr.degree_course_name, CAST(a.course_id AS NVARCHAR)) AS course_name
        FROM applications a
        JOIN colleges         c  ON c.id       = a.college_id
        LEFT JOIN faculty_master cr ON cr.code_no = a.course_id AND cr.college_id = a.college_id
        WHERE a.student_id = @sid
          AND a.status NOT IN ('draft', 'cancelled')
        ORDER BY COALESCE(a.status_updated_at, a.submitted_at) DESC
      `);

    const notifications = buildNotifications(result.recordset);

    // Determine unread count — statuses the student must act on or newly changed
    const ACTION_STATUSES = ['correction_requested', 'confirmed', 'roll_assigned'];
    const unread = notifications.filter(n => ACTION_STATUSES.includes(n.status)).length;

    return res.json({ success: true, data: notifications, unread });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
