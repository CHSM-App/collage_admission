/**
 * payments.js — Razorpay payment integration.
 *
 * POST /payments/create-order
 *   body: { application_id, payment_type, installment_plan_id? }
 *   payment_type: 'application_fee' | 'college_fee' | 'college_fee_installment'
 *
 * POST /payments/verify
 *   body: { application_id, payment_type, installment_plan_id?,
 *           razorpay_order_id, razorpay_payment_id, razorpay_signature }
 *
 * GET  /payments/college-fee-status/:applicationId
 *   Returns total fee, installment plan (if any), and what has been paid
 */

const express  = require('express');
const crypto   = require('crypto');
const Razorpay = require('razorpay');
const router   = express.Router();
const db       = require('./db');
const mssql    = require('mssql');
const feeSvc   = require('../services/FeeDeterminationService');

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
// Uses FeeDeterminationService when fees_master records exist for the college;
// falls back to legacy fee_structures table if no fees_master data found.
async function getCollegeFeTotal(app) {
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
// Returns installment plan + what has already been paid for college fee.
router.get('/college-fee-status/:applicationId', async (req, res) => {
  const appId = parseInt(req.params.applicationId);
  try {
    const appRes = await db.request()
      .input('id', mssql.Int, appId)
      .query(`
        SELECT a.id, a.status, a.college_id, a.course_id, a.year_of_study,
               a.admission_period_id, a.college_fee_paid
        FROM applications a WHERE a.id = @id
      `);
    if (!appRes.recordset.length) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    const app = appRes.recordset[0];

    // Total fee (uses FeeDeterminationService or legacy fallback)
    const feeInfo = await getCollegeFeTotal(app);
    // For BCC students, student_payable may be less than total_fee
    const totalFee = feeInfo?.student_payable ?? feeInfo?.total_fee ?? 0;

    // Installment plan for this admission period
    const planRes = await db.request()
      .input('pid', mssql.Int, app.admission_period_id)
      .query(`
        SELECT id, installment_no, label, amount, due_date
        FROM fee_installment_plans
        WHERE admission_period_id = @pid
        ORDER BY installment_no
      `);
    const installments = planRes.recordset;

    // Payments already made for college fee (successful)
    const paidRes = await db.request()
      .input('appId', mssql.Int, appId)
      .query(`
        SELECT id, payment_type, amount, installment_plan_id, installment_no,
               razorpay_payment_id, completed_at
        FROM payments
        WHERE application_id = @appId
          AND payment_type IN ('college_fee','college_fee_installment')
          AND status = 'success'
        ORDER BY installment_no, completed_at
      `);
    const paidInstallments = paidRes.recordset;

    const totalPaid = paidInstallments.reduce((s, p) => s + parseFloat(p.amount), 0);
    const remaining = Math.max(0, totalFee - totalPaid);

    return res.json({
      success: true,
      data: {
        application_id: appId,
        status:         app.status,
        college_fee_paid: app.college_fee_paid,
        total_fee:          feeInfo?.total_fee || 0,
        student_payable:    totalFee,
        reimbursable_amount: feeInfo?.reimbursable_amount || 0,
        payment_mode:       feeInfo?.payment_mode || null,
        fees_category_slab: feeInfo?.fees_category_slab || null,
        total_paid:         totalPaid,
        remaining:          remaining,
        fee_breakdown:      feeInfo?.breakdown || feeInfo,
        fee_source:         feeInfo?.source || 'unknown',
        has_installment_plan: installments.length > 0,
        installments:   installments.map(ins => {
          const paid = paidInstallments.find(p => p.installment_plan_id === ins.id);
          return {
            ...ins,
            is_paid:       !!paid,
            paid_at:       paid?.completed_at || null,
            payment_id:    paid?.razorpay_payment_id || null,
          };
        }),
        paid_records:   paidInstallments,
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
          p.installment_no,
          p.completed_at,
          fip.label AS installment_label
        FROM payments p
        LEFT JOIN fee_installment_plans fip ON fip.id = p.installment_plan_id
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
  const { application_id, payment_type, installment_plan_id, amount: customAmount } = req.body;

  if (!application_id || !payment_type) {
    return res.status(400).json({ success: false, message: 'application_id and payment_type are required.' });
  }
  if (!['application_fee', 'college_fee', 'college_fee_installment'].includes(payment_type)) {
    return res.status(400).json({ success: false, message: 'Invalid payment_type.' });
  }

  try {
    const appRes = await db.request()
      .input('id', mssql.Int, parseInt(application_id))
      .query(`
        SELECT a.id, a.status, a.college_id, a.course_id, a.year_of_study, a.academic_year,
               a.admission_period_id, a.student_id,
               ap.application_fee,
               s.full_name AS student_name, s.email AS student_email, s.phone AS student_phone
        FROM applications a
        JOIN admission_periods ap ON ap.id = a.admission_period_id
        JOIN students s ON s.id = a.student_id
        WHERE a.id = @id
      `);

    if (!appRes.recordset.length) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    const app = appRes.recordset[0];

    let amount = 0;
    let description = '';
    let installmentLabel = '';

    if (payment_type === 'application_fee') {
      if (app.status !== 'draft') {
        return res.status(400).json({ success: false, message: `Cannot pay application fee for status: ${app.status}` });
      }
      amount = app.application_fee;
      description = 'Application Fee';

    } else if (payment_type === 'college_fee') {
      if (!['approved', 'document_verification', 'confirmed'].includes(app.status)) {
        return res.status(400).json({ success: false, message: 'Application must be approved or confirmed to pay college fee.' });
      }
      // Validate custom amount against remaining balance
      const feeInfo = await getCollegeFeTotal(app);
      const totalFee = feeInfo?.student_payable ?? feeInfo?.total_fee ?? 0;
      const paidRes = await db.request()
        .input('appId', mssql.Int, parseInt(application_id))
        .query(`
          SELECT ISNULL(SUM(amount), 0) AS total_paid FROM payments
          WHERE application_id = @appId
            AND payment_type IN ('college_fee','college_fee_installment')
            AND status = 'success'
        `);
      const totalPaid = parseFloat(paidRes.recordset[0].total_paid) || 0;
      const remaining = Math.max(0, totalFee - totalPaid);

      // College-defined installment plan enforcement is disabled — students enter any amount freely.
      // const planRes = await db.request()
      //   .input('pid', mssql.Int, app.admission_period_id)
      //   .query('SELECT COUNT(*) AS cnt FROM fee_installment_plans WHERE admission_period_id = @pid');
      // const hasInstallmentPlan = (planRes.recordset[0].cnt || 0) > 0;

      const parsedAmount = parseFloat(customAmount);
      if (!parsedAmount || parsedAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Enter a valid payment amount.' });
      }
      // if (hasInstallmentPlan && Math.abs(parsedAmount - remaining) > 0.01) {
      //   return res.status(400).json({ success: false, message: 'An installment plan is set. You must pay either the full remaining balance or use the installment options.' });
      // }
      if (parsedAmount > remaining + 0.01) {
        return res.status(400).json({ success: false, message: `Amount cannot exceed the remaining balance of ₹${remaining}.` });
      }
      amount = parsedAmount;
      description = totalFee > 0 && parsedAmount >= remaining - 0.01 ? 'College Fee (Full)' : 'College Fee (Partial)';

    } else {
      // college_fee_installment — college-defined installment plan
      if (!['approved', 'document_verification', 'confirmed'].includes(app.status)) {
        return res.status(400).json({ success: false, message: 'Application must be approved or confirmed to pay college fee.' });
      }
      if (!installment_plan_id) {
        return res.status(400).json({ success: false, message: 'installment_plan_id is required for installment payments.' });
      }
      const insRes = await db.request()
        .input('insId', mssql.Int, parseInt(installment_plan_id))
        .input('pid',   mssql.Int, app.admission_period_id)
        .query(`
          SELECT id, installment_no, label, amount, due_date
          FROM fee_installment_plans
          WHERE id = @insId AND admission_period_id = @pid
        `);
      if (!insRes.recordset.length) {
        return res.status(404).json({ success: false, message: 'Installment not found for this application.' });
      }
      const ins = insRes.recordset[0];
      const alreadyPaid = await db.request()
        .input('appId', mssql.Int, parseInt(application_id))
        .input('insId', mssql.Int, parseInt(installment_plan_id))
        .query(`SELECT id FROM payments WHERE application_id = @appId AND installment_plan_id = @insId AND status = 'success'`);
      if (alreadyPaid.recordset.length > 0) {
        return res.status(400).json({ success: false, message: `${ins.label} has already been paid.` });
      }
      amount = ins.amount;
      description = ins.label;
      installmentLabel = ins.label;
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Payment amount could not be determined.' });
    }

    const order = await razorpay.orders.create({
      amount:   Math.round(amount * 100),
      currency: 'INR',
      receipt:  `r_${application_id}_${Date.now().toString().slice(-8)}`,
      notes: {
        application_id:      String(application_id),
        payment_type,
        installment_plan_id: installment_plan_id ? String(installment_plan_id) : '',
        student_name:        app.student_name,
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
        installment_plan_id: installment_plan_id || null,
        description,
        installment_label:  installmentLabel,
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
    application_id, payment_type, installment_plan_id,
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
               a.admission_period_id, ap.application_fee
        FROM applications a
        JOIN admission_periods ap ON ap.id = a.admission_period_id
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

      // Check if fully paid now (use student_payable for BCC support)
      const feeInfo = await getCollegeFeTotal(app);
      const totalFee = feeInfo?.student_payable ?? feeInfo?.total_fee ?? 0;
      const paidRes = await db.request()
        .input('appId', mssql.Int, appId)
        .query(`
          SELECT ISNULL(SUM(amount), 0) AS total_paid FROM payments
          WHERE application_id = @appId
            AND payment_type IN ('college_fee','college_fee_installment')
            AND status = 'success'
        `);
      const totalPaid = parseFloat(paidRes.recordset[0].total_paid) || 0;
      const allPaid   = totalFee > 0 && totalPaid >= totalFee - 0.01;

      if (allPaid) {
        await db.request()
          .input('id', mssql.Int, appId)
          .query(`
            UPDATE applications
            SET status = 'fees_paid', college_fee_paid = 1, updated_at = GETDATE(), status_updated_at = GETDATE()
            WHERE id = @id
          `);
      }

      return res.json({
        success: true,
        message: allPaid ? 'College fee fully paid!' : `₹${amount.toLocaleString('en-IN')} paid. ₹${(totalFee - totalPaid).toLocaleString('en-IN')} remaining.`,
        data: { all_paid: allPaid, total_paid: totalPaid, remaining: Math.max(0, totalFee - totalPaid) },
      });

    // ── college_fee_installment — college-defined installment plan ──
    } else {
      if (!installment_plan_id) {
        return res.status(400).json({ success: false, message: 'installment_plan_id required.' });
      }
      const insRes = await db.request()
        .input('insId', mssql.Int, parseInt(installment_plan_id))
        .query('SELECT id, installment_no, label, amount FROM fee_installment_plans WHERE id = @insId');
      if (!insRes.recordset.length) {
        return res.status(404).json({ success: false, message: 'Installment plan not found.' });
      }
      const ins = insRes.recordset[0];
      await db.request()
        .input('appId',   mssql.Int,      appId)
        .input('ptype',   mssql.NVarChar, 'college_fee_installment')
        .input('amount',  mssql.Decimal,  ins.amount)
        .input('insId',   mssql.Int,      parseInt(installment_plan_id))
        .input('insNo',   mssql.Int,      ins.installment_no)
        .input('orderId', mssql.NVarChar, razorpay_order_id)
        .input('payId',   mssql.NVarChar, razorpay_payment_id)
        .query(`
          INSERT INTO payments
            (application_id, payment_type, amount, status, installment_plan_id, installment_no,
             razorpay_order_id, razorpay_payment_id, completed_at)
          VALUES (@appId, @ptype, @amount, 'success', @insId, @insNo, @orderId, @payId, GETDATE())
        `);
      const allInstallments = await db.request()
        .input('pid', mssql.Int, app.admission_period_id)
        .query('SELECT id FROM fee_installment_plans WHERE admission_period_id = @pid');
      const paidInstallments = await db.request()
        .input('appId', mssql.Int, appId)
        .query(`
          SELECT DISTINCT installment_plan_id FROM payments
          WHERE application_id = @appId
            AND payment_type = 'college_fee_installment'
            AND status = 'success'
        `);
      const allPlanIds  = allInstallments.recordset.map(r => r.id).sort().join(',');
      const paidPlanIds = paidInstallments.recordset.map(r => r.installment_plan_id).sort().join(',');
      const allPaid = allPlanIds === paidPlanIds;
      if (allPaid) {
        await db.request()
          .input('id', mssql.Int, appId)
          .query(`UPDATE applications SET status = 'fees_paid', college_fee_paid = 1, updated_at = GETDATE(), status_updated_at = GETDATE() WHERE id = @id`);
      }
      return res.json({
        success: true,
        message: allPaid ? `${ins.label} paid. All installments complete — fees fully paid!` : `${ins.label} paid successfully.`,
        data: { all_paid: allPaid, installment_no: ins.installment_no },
      });
    }
  } catch (err) {
    console.error('verify error:', err);
    return res.status(500).json({ success: false, message: 'Payment verification failed.' });
  }
});

module.exports = router;
