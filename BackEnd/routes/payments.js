/**
 * payments.js — Razorpay payment integration.
 *
 * POST /payments/create-order
 *   body: { application_id, payment_type, amount? }
 *   payment_type: 'application_fee' | 'college_fee'
 *
 * POST /payments/verify
 *   body: { application_id, payment_type,
 *           razorpay_order_id, razorpay_payment_id, razorpay_signature }
 *
 * GET  /payments/college-fee-status/:applicationId
 *   Returns total fee, amount due now, and what has been paid
 */

const express  = require('express');
const crypto   = require('crypto');
const Razorpay = require('razorpay');
const router   = express.Router();
const db       = require('./db');
const mssql    = require('mssql');
const feeSvc   = require('../services/FeeDeterminationService');

async function logActivity(appId, action, actorRole, note = null) {
  try {
    await db.request()
      .input('appId',     mssql.Int,     parseInt(appId))
      .input('action',    mssql.NVarChar, action)
      .input('actorRole', mssql.NVarChar, actorRole)
      .input('note',      mssql.NVarChar, note || null)
      .query(`INSERT INTO application_activity_log (application_id, action, actor_role, note) VALUES (@appId, @action, @actorRole, @note)`);
  } catch (e) { console.warn('logActivity failed:', e.message); }
}

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ── Helper: generate registration number ────────────────────
async function generateRegNumber(collegeId, courseId, year, academicYear) {
  const prefix = `${academicYear.replace('-', '')}-${String(courseId).padStart(2, '0')}-${year}`;
  const result = await db.request()
    .input('prefix', `${prefix}-%`)
    .query(`
      SELECT COUNT(*) AS cnt FROM applications
      WHERE registration_number LIKE @prefix AND registration_number IS NOT NULL
    `);
  const seq = (result.recordset[0].cnt || 0) + 1;
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}

// ── Helper: compute college fee total for an application ─────
// Priority 1: college-entered fee_total_amount / fee_pay_now_amount on the application row.
// Priority 2: FeeDeterminationService (fees_master).
// Priority 3: legacy fee_structures table.
async function getCollegeFeTotal(app) {
  // Priority 1 — college manually entered amounts at confirmation
  if (app.fee_total_amount && parseFloat(app.fee_total_amount) > 0) {
    const total   = parseFloat(app.fee_total_amount);
    const payNow  = app.fee_pay_now_amount ? parseFloat(app.fee_pay_now_amount) : total;
    return {
      total_fee:       total,
      student_payable: payNow,
      source:          'manual',
    };
  }

  const YEAR_MAP = { 1: 'FY', 2: 'SY', 3: 'TY' };
  const yearLevel = YEAR_MAP[app.year_of_study];

  // Attempt FeeDeterminationService (new masters system)
  try {
    // Get faculty_master_id — same id as course_id after migration
    const fmRes = await db.request()
      .input('id',  mssql.Int, app.course_id)
      .input('cid', mssql.Int, app.college_id)
      .query(`SELECT code_no FROM faculty_master WHERE code_no = @id AND college_id = @cid`);

    if (fmRes.recordset.length) {
      // Fetch caste/division from application for accurate slab determination
      const appDetails = await db.request()
        .input('id', mssql.Int, app.id)
        .query(`SELECT app_category, fees_category, app_division FROM applications WHERE id = @id`);
      const det = appDetails.recordset[0] || {};

      const result = await feeSvc.compute({
        collegeId:       app.college_id,
        facultyMasterId: app.course_id,
        yearLevel,
        divisionLetter:  det.app_division   || null,
        caste:           det.app_category   || null,
        specialStatus:   null,
        pool:            db,
      });

      if (result.breakdown.length > 0) {
        return {
          total_fee:           result.totalFee,
          student_payable:     result.studentPayable,
          reimbursable_amount: result.reimbursableAmount,
          payment_mode:        result.paymentMode,
          fees_category_slab:  result.feesCategorySlab,
          breakdown:           result.breakdown,
          source:              'fees_master',
        };
      }
    }
  } catch (e) {
    console.warn('FeeDeterminationService failed, falling back to fee_structures:', e.message);
  }

  // Legacy fallback: fee_structures table
  const feeRes = await db.request()
    .input('col', mssql.Int, app.college_id)
    .input('crs', mssql.Int, app.course_id)
    .input('yr',  mssql.Int, app.year_of_study)
    .query(`
      SELECT TOP 1 (tuition_fee + exam_fee + other_fee) AS total_fee,
             tuition_fee, exam_fee, other_fee
      FROM fee_structures
      WHERE college_id = @col AND course_id = @crs AND year_of_study = @yr
      ORDER BY category
    `);
  const row = feeRes.recordset[0] || null;
  return row ? { ...row, student_payable: row.total_fee, source: 'fee_structures' } : null;
}

// ── GET /payments/college-fee-status/:applicationId ──────────
// Returns total fee, fee_pay_now_amount, and what has already been paid.
router.get('/college-fee-status/:applicationId', async (req, res) => {
  const appId = parseInt(req.params.applicationId);
  try {
    const appRes = await db.request()
      .input('id', mssql.Int, appId)
      .query(`
        SELECT a.id, a.status, a.college_id, a.course_id, a.year_of_study,
               a.admission_period_id, a.college_fee_paid,
               a.fee_total_amount, a.fee_pay_now_amount
        FROM applications a WHERE a.id = @id
      `);
    if (!appRes.recordset.length) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    const app = appRes.recordset[0];

    // Total fee (uses FeeDeterminationService or legacy fallback)
    const feeInfo = await getCollegeFeTotal(app);
    // For manual source: remaining tracks against total_fee (full obligation).
    // For BCC/fees_master: student_payable may be less (scholarship), track against that.
    const totalFee = feeInfo?.source === 'manual'
      ? (feeInfo?.total_fee ?? 0)
      : (feeInfo?.student_payable ?? feeInfo?.total_fee ?? 0);

    // Payments already made for college fee (successful)
    const paidRes = await db.request()
      .input('appId', mssql.Int, appId)
      .query(`
        SELECT id, payment_type, amount, razorpay_payment_id, completed_at
        FROM payments
        WHERE application_id = @appId
          AND payment_type = 'college_fee'
          AND status = 'success'
        ORDER BY completed_at
      `);
    const paidRecords = paidRes.recordset;

    const totalPaid = paidRecords.reduce((s, p) => s + parseFloat(p.amount), 0);
    const remaining = Math.max(0, totalFee - totalPaid);

    return res.json({
      success: true,
      data: {
        application_id:    appId,
        status:            app.status,
        college_fee_paid:  app.college_fee_paid,
        total_fee:         feeInfo?.total_fee || 0,
        fee_pay_now_amount: app.fee_pay_now_amount ? parseFloat(app.fee_pay_now_amount) : null,
        total_paid:        totalPaid,
        remaining:         remaining,
        paid_records:      paidRecords,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /payments/student-has-payments?student_id=X ─────────
router.get('/student-has-payments', async (req, res) => {
  const studentId = parseInt(req.query.student_id)
  if (!studentId) return res.json({ success: true, data: { has_payments: false } })
  try {
    const r = await db.request()
      .input('sid', mssql.Int, studentId)
      .query(`
        SELECT TOP 1 p.id FROM payments p
        JOIN applications a ON a.id = p.application_id
        WHERE a.student_id = @sid AND p.status = 'success'
      `)
    return res.json({ success: true, data: { has_payments: r.recordset.length > 0 } })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ── GET /payments/receipts/:applicationId ───────────────────
// Returns all successful payments for an application, enriched with college/student/application info.
router.get('/receipts/:applicationId', async (req, res) => {
  const appId = parseInt(req.params.applicationId);
  try {
    const appRes = await db.request()
      .input('id', mssql.Int, appId)
      .query(`
        SELECT
          a.id AS application_id,
          a.registration_number,
          a.academic_year,
          a.year_of_study,
          a.status,
          col.name        AS college_name,
          col.address     AS college_address,
          col.city        AS college_city,
          col.phone       AS college_phone,
          col.email       AS college_email,
          COALESCE(c.degree_course_name, CAST(a.course_id AS NVARCHAR)) AS course_name,
          s.full_name     AS student_name,
          s.email         AS student_email,
          s.phone         AS student_phone,
          -- snapshot fields take priority
          COALESCE(
            NULLIF(LTRIM(RTRIM(ISNULL(a.app_surname,'') + ' ' + ISNULL(a.app_first_name,'') + ' ' + ISNULL(a.app_middle_name,''))), ''),
            s.full_name
          ) AS app_full_name,
          a.app_mobile,
          a.app_email
        FROM applications a
        JOIN colleges col ON col.id    = a.college_id
        LEFT JOIN faculty_master c ON c.code_no = a.course_id AND c.college_id = a.college_id
        JOIN students  s   ON s.id     = a.student_id
        WHERE a.id = @id
      `);

    if (!appRes.recordset.length) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    const app = appRes.recordset[0];

    const pmtRes = await db.request()
      .input('appId', mssql.Int, appId)
      .query(`
        SELECT
          p.id,
          p.payment_type,
          p.amount,
          p.status,
          p.razorpay_order_id,
          p.razorpay_payment_id,
          p.completed_at
        FROM payments p
        WHERE p.application_id = @appId AND p.status = 'success'
        ORDER BY p.completed_at ASC
      `);

    return res.json({
      success: true,
      data: {
        application: app,
        payments:    pmtRes.recordset,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /payments/create-order ──────────────────────────────
router.post('/create-order', async (req, res) => {
  const { application_id, payment_type, amount: customAmount } = req.body;
  // `customAmount` is optional — if provided, used as the Razorpay order amount (must be ≤ remaining)

  if (!application_id || !payment_type) {
    return res.status(400).json({ success: false, message: 'application_id and payment_type are required.' });
  }
  if (!['application_fee', 'college_fee'].includes(payment_type)) {
    return res.status(400).json({ success: false, message: 'Invalid payment_type.' });
  }

  try {
    const appRes = await db.request()
      .input('id', mssql.Int, parseInt(application_id))
      .query(`
        SELECT a.id, a.status, a.college_id, a.course_id, a.year_of_study, a.academic_year,
               a.admission_period_id, a.student_id,
               a.fee_total_amount, a.fee_pay_now_amount,
               COALESCE(c.application_fee, 0) AS application_fee,
               s.full_name AS student_name, s.email AS student_email, s.phone AS student_phone
        FROM applications a
        JOIN admission_periods ap ON ap.id = a.admission_period_id
        JOIN colleges c ON c.id = a.college_id
        JOIN students s ON s.id = a.student_id
        WHERE a.id = @id
      `);

    if (!appRes.recordset.length) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    const app = appRes.recordset[0];

    let amount = 0;
    let description = '';

    if (payment_type === 'application_fee') {
      if (app.status !== 'draft') {
        return res.status(400).json({ success: false, message: `Cannot pay application fee for status: ${app.status}` });
      }
      amount = app.application_fee;
      description = 'Application Fee';

    } else if (payment_type === 'college_fee') {
      if (!['confirmed', 'fees_paid'].includes(app.status)) {
        return res.status(400).json({ success: false, message: 'Application must be confirmed to pay college fee.' });
      }
      if ((!app.fee_total_amount || parseFloat(app.fee_total_amount) <= 0) &&
          (!app.fee_pay_now_amount || parseFloat(app.fee_pay_now_amount) <= 0)) {
        return res.status(400).json({ success: false, message: 'The college has not set a fee amount yet. Please contact the college.' });
      }
      // Check how much has already been paid
      const paidRes2 = await db.request()
        .input('appId', mssql.Int, parseInt(application_id))
        .query(`SELECT ISNULL(SUM(amount),0) AS total_paid FROM payments WHERE application_id=@appId AND payment_type='college_fee' AND status='success'`);
      const totalPaid2 = parseFloat(paidRes2.recordset[0].total_paid) || 0;
      const totalFee   = parseFloat(app.fee_total_amount) || 0;
      const remaining2 = Math.max(0, totalFee - totalPaid2);
      if (remaining2 <= 0) {
        return res.status(400).json({ success: false, message: 'No outstanding balance to pay.' });
      }
      // If caller provides a custom amount, use it (must not exceed remaining)
      if (customAmount && parseFloat(customAmount) > 0) {
        const reqAmt = parseFloat(customAmount);
        if (reqAmt > remaining2 + 0.01) {
          return res.status(400).json({ success: false, message: `Amount ₹${reqAmt} exceeds remaining balance ₹${remaining2}.` });
        }
        amount = reqAmt;
      } else {
        // Default: first payment uses college-set instalment (fee_pay_now_amount),
        // or full fee if no instalment set; subsequent payments use remaining balance
        const payNowDefault = app.fee_pay_now_amount
          ? parseFloat(app.fee_pay_now_amount)
          : parseFloat(app.fee_total_amount);
        amount = totalPaid2 > 0 ? remaining2 : payNowDefault;
      }
      if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, message: 'No outstanding balance to pay.' });
      }
      description = amount >= totalFee - 0.01 ? 'College Fee (Full)' : 'College Fee';
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Payment amount could not be determined.' });
    }

    const order = await razorpay.orders.create({
      amount:   Math.round(amount * 100),
      currency: 'INR',
      receipt:  `r_${application_id}_${Date.now().toString().slice(-8)}`,
      notes: {
        application_id: String(application_id),
        payment_type,
        student_name:   app.student_name,
      },
    });

    return res.json({
      success: true,
      data: {
        order_id:           order.id,
        amount:             order.amount,
        amount_inr:         amount,
        currency:           order.currency,
        key_id:             process.env.RAZORPAY_KEY_ID,
        student_name:       app.student_name,
        student_email:      app.student_email,
        student_phone:      app.student_phone || '',
        payment_type,
        description,
        application_id,
      },
    });
  } catch (err) {
    console.error('create-order error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create payment order.' });
  }
});

// ── POST /payments/verify ────────────────────────────────────
router.post('/verify', async (req, res) => {
  const {
    application_id, payment_type,
    razorpay_order_id, razorpay_payment_id, razorpay_signature,
  } = req.body;

  if (!application_id || !payment_type || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ success: false, message: 'Missing required payment verification fields.' });
  }

  try {
    // Verify signature
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Payment signature verification failed.' });
    }

    const appId = parseInt(application_id);

    const appRes = await db.request()
      .input('id', mssql.Int, appId)
      .query(`
        SELECT a.id, a.status, a.college_id, a.course_id, a.year_of_study, a.academic_year,
               a.admission_period_id, a.fee_total_amount, a.fee_pay_now_amount,
               COALESCE(c.application_fee, 0) AS application_fee
        FROM applications a
        JOIN admission_periods ap ON ap.id = a.admission_period_id
        JOIN colleges c ON c.id = a.college_id
        WHERE a.id = @id
      `);
    if (!appRes.recordset.length) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    const app = appRes.recordset[0];

    // ── application_fee ──────────────────────────────────────
    if (payment_type === 'application_fee') {
      const regNum = await generateRegNumber(app.college_id, app.course_id, app.year_of_study, app.academic_year);

      await db.request()
        .input('appId',   mssql.Int,      appId)
        .input('ptype',   mssql.NVarChar, 'application_fee')
        .input('amount',  mssql.Decimal,  app.application_fee)
        .input('orderId', mssql.NVarChar, razorpay_order_id)
        .input('payId',   mssql.NVarChar, razorpay_payment_id)
        .query(`
          INSERT INTO payments (application_id, payment_type, amount, status,
            razorpay_order_id, razorpay_payment_id, completed_at)
          VALUES (@appId, @ptype, @amount, 'success', @orderId, @payId, GETDATE())
        `);

      await db.request()
        .input('id',     mssql.Int,      appId)
        .input('regNum', mssql.NVarChar, regNum)
        .query(`
          UPDATE applications
          SET status = 'submitted', registration_number = @regNum,
              application_fee_paid = 1, submitted_at = GETDATE(), updated_at = GETDATE(), status_updated_at = GETDATE()
          WHERE id = @id
        `);

      await logActivity(appId, 'submitted', 'student', null);

      return res.json({
        success: true,
        message: 'Application fee paid. Application submitted.',
        data: { registration_number: regNum },
      });

    // ── college_fee (partial or full) ───────────────────────
    } else if (payment_type === 'college_fee') {
      // Fetch actual amount from Razorpay order to avoid re-trusting the client
      const rzpOrder = await razorpay.orders.fetch(razorpay_order_id);
      const amount   = rzpOrder.amount / 100;  // paise → rupees

      await db.request()
        .input('appId',   mssql.Int,      appId)
        .input('ptype',   mssql.NVarChar, 'college_fee')
        .input('amount',  mssql.Decimal,  amount)
        .input('orderId', mssql.NVarChar, razorpay_order_id)
        .input('payId',   mssql.NVarChar, razorpay_payment_id)
        .query(`
          INSERT INTO payments (application_id, payment_type, amount, status,
            razorpay_order_id, razorpay_payment_id, completed_at)
          VALUES (@appId, @ptype, @amount, 'success', @orderId, @payId, GETDATE())
        `);

      // Check payment thresholds
      const feeInfo = await getCollegeFeTotal(app);
      const totalFee   = feeInfo?.source === 'manual'
        ? (feeInfo?.total_fee ?? 0)
        : (feeInfo?.student_payable ?? feeInfo?.total_fee ?? 0);
      // fee_pay_now_amount is the first-instalment threshold set by the college
      const payNowThreshold = app.fee_pay_now_amount ? parseFloat(app.fee_pay_now_amount) : totalFee;

      const paidRes = await db.request()
        .input('appId', mssql.Int, appId)
        .query(`
          SELECT ISNULL(SUM(amount), 0) AS total_paid FROM payments
          WHERE application_id = @appId
            AND payment_type = 'college_fee'
            AND status = 'success'
        `);
      const totalPaid  = parseFloat(paidRes.recordset[0].total_paid) || 0;
      // Admission is confirmed once first instalment (pay_now) is met
      const firstPaid  = payNowThreshold > 0 && totalPaid >= payNowThreshold - 0.01;
      const fullyPaid  = totalFee > 0 && totalPaid >= totalFee - 0.01;

      if (firstPaid) {
        await db.request()
          .input('id', mssql.Int, appId)
          .query(`
            UPDATE applications
            SET status = 'fees_paid', college_fee_paid = 1, updated_at = GETDATE(), status_updated_at = GETDATE()
            WHERE id = @id
          `);
      }

      if (fullyPaid)      await logActivity(appId, 'fees_paid',           'student', `₹${totalPaid.toLocaleString('en-IN')} paid (full)`);
      else if (firstPaid) await logActivity(appId, 'fees_paid',           'student', `₹${totalPaid.toLocaleString('en-IN')} paid, ₹${(totalFee - totalPaid).toLocaleString('en-IN')} remaining`);
      else                await logActivity(appId, 'fee_instalment_paid', 'student', `₹${amount.toLocaleString('en-IN')} paid, ₹${(totalFee - totalPaid).toLocaleString('en-IN')} remaining`);

      return res.json({
        success: true,
        message: fullyPaid  ? 'College fee fully paid!' :
                 firstPaid  ? `₹${amount.toLocaleString('en-IN')} paid. Admission confirmed! ₹${(totalFee - totalPaid).toLocaleString('en-IN')} remaining.` :
                              `₹${amount.toLocaleString('en-IN')} paid. ₹${(totalFee - totalPaid).toLocaleString('en-IN')} remaining.`,
        data: { all_paid: firstPaid, fully_paid: fullyPaid, total_paid: totalPaid, remaining: Math.max(0, totalFee - totalPaid) },
      });

    }
  } catch (err) {
    console.error('verify error:', err);
    return res.status(500).json({ success: false, message: 'Payment verification failed.' });
  }
});

module.exports = router;
