/**
 * payments.js — PayU payment integration.
 *
 * POST /payments/initiate
 *   body: { application_id, payment_type, amount? }
 *   Returns PayU form fields + endpoint for client-side auto-submit.
 *
 * POST /payments/payu-return
 *   PayU redirects the browser here after success/failure.
 *   Verifies hash, updates payment status, redirects to frontend.
 *
 * POST /payments/payu-webhook  (NO auth middleware — PayU server-to-server)
 *   Authoritative source of truth for payment status.
 *   Validates hash, updates payment idempotently.
 *
 * GET  /payments/college-fee-status/:applicationId
 * GET  /payments/receipts/:applicationId
 * GET  /payments/student-has-payments
 */

const express  = require('express');
const crypto   = require('crypto');
const router   = express.Router();
const db       = require('./db');
const mssql    = require('mssql');
const feeSvc   = require('../services/FeeDeterminationService');
const whatsapp = require('../services/whatsapp');
const payU     = require('../services/PayUService');
const { authenticate } = require('../middleware/auth');
const logger    = require('../config/logger');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const auditLog  = require('../middleware/auditLog');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }
  next();
}

// ── Routes that receive PayU redirects/callbacks — NO auth middleware ─
// PayU POSTs to these without any JWT token.
router.post('/payu-webhook', express.urlencoded({ extended: false }), handlePayUWebhook);
router.post('/payu-return',  express.urlencoded({ extended: false }), handlePayUReturn);

// ── Public payment link route — NO auth middleware ────────────
// Student opens a /pay/:token link from WhatsApp — no login required.
router.get('/pay/:token', handlePayViaToken);

// All remaining routes require authentication
router.use(authenticate);
router.use(auditLog);

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many payment requests. Please wait 15 minutes.' },
});

router.use('/initiate', paymentLimiter);

// ── Shared helpers ────────────────────────────────────────────

async function logActivity(appId, action, actorRole, note = null) {
  try {
    await db.request()
      .input('appId',     mssql.Int,      parseInt(appId))
      .input('action',    mssql.NVarChar, action)
      .input('actorRole', mssql.NVarChar, actorRole)
      .input('note',      mssql.NVarChar, note || null)
      .query(`INSERT INTO application_activity_log (application_id, action, actor_role, note) VALUES (@appId, @action, @actorRole, @note)`);
  } catch (e) { logger.warn({ err: e }, 'logActivity failed'); }
}

async function getStudentForNotification(appId) {
  try {
    const r = await db.request()
      .input('id', mssql.Int, parseInt(appId))
      .query(`
        SELECT s.full_name AS name, s.phone,
               COALESCE(CONCAT(fm.degree_course_code, ' — ', fm.degree_course_name), CAST(a.course_id AS NVARCHAR)) AS course_name,
               c.name AS college_name
        FROM applications a
        JOIN students s ON s.id = a.student_id
        LEFT JOIN faculty_master fm ON fm.code_no = a.course_id AND fm.college_id = a.college_id
        LEFT JOIN colleges c ON c.id = a.college_id
        WHERE a.id = @id
      `);
    return r.recordset[0] || null;
  } catch (e) {
    logger.warn({ err: e }, 'getStudentForNotification failed');
    return null;
  }
}

async function generateRegNumber(collegeId, courseId, year, academicYear, requestObj) {
  const prefix = `${academicYear.replace('-', '')}-${String(courseId).padStart(2, '0')}-${year}`;
  const result = await requestObj
    .input('regPrefix', mssql.NVarChar, `${prefix}-%`)
    .query(`
      SELECT COUNT(*) AS cnt FROM applications
      WHERE registration_number LIKE @regPrefix AND registration_number IS NOT NULL
    `);
  const seq = (result.recordset[0].cnt || 0) + 1;
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}

// ── Helper: compute college fee total ────────────────────────
// Priority 1: manual fee_total_amount on application row
// Priority 2: FeeDeterminationService (fees_master)
// Priority 3: legacy fee_structures table
async function getCollegeFeTotal(app) {
  if (app.fee_total_amount && parseFloat(app.fee_total_amount) > 0) {
    const total  = parseFloat(app.fee_total_amount);
    const payNow = app.fee_pay_now_amount ? parseFloat(app.fee_pay_now_amount) : total;
    return { total_fee: total, student_payable: payNow, source: 'manual' };
  }

  const YEAR_MAP = { 1: 'FY', 2: 'SY', 3: 'TY' };
  const yearLevel = YEAR_MAP[app.year_of_study];

  try {
    const fmRes = await db.request()
      .input('id',  mssql.Int, app.course_id)
      .input('cid', mssql.Int, app.college_id)
      .query(`SELECT code_no FROM faculty_master WHERE code_no = @id AND college_id = @cid`);

    if (fmRes.recordset.length) {
      const appDetails = await db.request()
        .input('id', mssql.Int, app.id)
        .query(`SELECT app_category, app_special_status, fees_category, app_division FROM applications WHERE id = @id`);
      const det = appDetails.recordset[0] || {};

      const result = await feeSvc.compute({
        collegeId:       app.college_id,
        facultyMasterId: app.course_id,
        yearLevel,
        divisionLetter:  det.app_division || null,
        caste:           det.app_category || null,
        specialStatus:   det.app_special_status || null,
        academicYear:    app.academic_year || null,
        pool:            db,
      });

      if (result.breakdown.length > 0) {
        // Exclude Misc and ExamFees from regular college fee totals
        const regularBreakdown = result.breakdown.filter(h => {
          const t = (h.fees_type || '').toLowerCase();
          return t !== 'misc' && t !== 'examfees';
        });
        const regularTotal   = regularBreakdown.reduce((s, h) => s + (parseFloat(h.amount) || 0), 0);
        return {
          total_fee:          regularTotal,
          student_payable:    regularTotal,
          reimbursable_amount: 0,
          fees_category_slab: result.feesCategorySlab,
          breakdown:          regularBreakdown,
          source:             'fees_master',
        };
      }
    }
  } catch (e) {
    logger.warn({ err: e }, 'FeeDeterminationService failed, falling back to fee_structures');
  }

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

// ── Core: commit a successful payment (gateway-agnostic) ─────
// Called from both payu-return and payu-webhook.
// Idempotent: checks for existing success record by gateway_txnid before writing.
// Returns { alreadyProcessed, regNum?, firstPaid?, fullyPaid?, totalPaid? }
async function commitPayment({ appId, paymentType, amount, txnid, gatewayPaymentId, actorStr }) {
  const app = await (async () => {
    const r = await db.request()
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
    return r.recordset[0] || null;
  })();

  if (!app) throw new Error(`Application ${appId} not found`);

  // misc_fee / exam_fee — simply mark the payment as success, no application status change
  if (paymentType === 'misc_fee' || paymentType === 'exam_fee') {
    const dup = await db.request()
      .input('txnid', mssql.NVarChar, txnid)
      .query(`SELECT id FROM payments WHERE gateway_txnid = @txnid AND status = 'success'`);
    if (dup.recordset.length > 0) return { alreadyProcessed: true };

    await db.request()
      .input('txnid', mssql.NVarChar, txnid)
      .input('gpid',  mssql.NVarChar, gatewayPaymentId || null)
      .input('appId', mssql.Int,      appId)
      .input('actor', mssql.NVarChar, actorStr)
      .query(`
        UPDATE payments
        SET status = 'success', gateway_payment_id = @gpid, completed_at = GETDATE(), updated_by = @actor
        WHERE gateway_txnid = @txnid AND application_id = @appId AND status = 'pending'
      `);

    return { alreadyProcessed: false };
  }

  if (paymentType === 'application_fee') {
    const pool = await db;
    const tx   = pool.transaction();
    await tx.begin();
    let regNum;
    let alreadyProcessed = false;
    try {
      const dup = await tx.request()
        .input('txnid', mssql.NVarChar, txnid)
        .query(`SELECT id FROM payments WHERE gateway_txnid = @txnid AND status = 'success'`);
      if (dup.recordset.length > 0) {
        alreadyProcessed = true;
        await tx.rollback();
      } else {
        regNum = await generateRegNumber(
          app.college_id, app.course_id, app.year_of_study, app.academic_year, tx.request()
        );

        await tx.request()
          .input('appId',  mssql.Int,      appId)
          .input('ptype',  mssql.NVarChar, 'application_fee')
          .input('amount', mssql.Decimal,  app.application_fee)
          .input('txnid',  mssql.NVarChar, txnid)
          .input('gpid',   mssql.NVarChar, gatewayPaymentId || null)
          .input('actor',  mssql.NVarChar, actorStr)
          .query(`
            UPDATE payments
            SET status = 'success', gateway_payment_id = @gpid, completed_at = GETDATE(), updated_by = @actor
            WHERE gateway_txnid = @txnid AND application_id = @appId AND status = 'pending'
          `);

        await tx.request()
          .input('id',     mssql.Int,      appId)
          .input('regNum', mssql.NVarChar, regNum)
          .input('actor',  mssql.NVarChar, actorStr)
          .query(`
            UPDATE applications
            SET status = 'submitted', registration_number = @regNum,
                application_fee_paid = 1, submitted_at = GETDATE(),
                updated_at = GETDATE(), status_updated_at = GETDATE(),
                updated_by = @actor
            WHERE id = @id AND status = 'draft'
          `);

        await tx.commit();

        // Mark payment link token used (if payment originated from a link)
        await db.request()
          .input('txnid', mssql.NVarChar, txnid)
          .query(`UPDATE payment_link_tokens SET used=1 WHERE gateway_txnid=@txnid AND used=0`);
      }
    } catch (e) {
      await tx.rollback();
      throw e;
    }
    return { alreadyProcessed, regNum };
  }

  // college_fee
  const feeInfo = await getCollegeFeTotal(app);
  const totalFee = feeInfo?.source === 'manual'
    ? (feeInfo?.total_fee ?? 0)
    : (feeInfo?.student_payable ?? feeInfo?.total_fee ?? 0);

  // Determine pay-now threshold from installment plan if set, else full total
  const instRes = await db.request()
    .input('appId', mssql.Int, appId)
    .query(`SELECT installment_no, amount FROM fee_installments WHERE application_id=@appId ORDER BY installment_no`);
  const installments = instRes.recordset.map(r => parseFloat(r.amount));
  // Threshold = cumulative sum up to and including first installment not yet paid
  // (evaluated BEFORE this payment, so we use prior totalPaid)
  const priorPaidRes = await db.request()
    .input('appId', mssql.Int, appId)
    .query(`SELECT ISNULL(SUM(amount),0) AS total_paid FROM payments WHERE application_id=@appId AND payment_type='college_fee' AND status='success'`);
  const priorPaid = parseFloat(priorPaidRes.recordset[0].total_paid) || 0;

  let payNowThreshold = totalFee; // default: full amount
  if (installments.length > 0) {
    let cumulative = 0;
    for (const amt of installments) {
      cumulative += amt;
      if (priorPaid < cumulative - 0.01) {
        payNowThreshold = cumulative;
        break;
      }
    }
    // all installments already paid → threshold = totalFee (free remainder)
  }

  const pool = await db;
  const tx   = pool.transaction();
  await tx.begin();

  let totalPaid, firstPaid, fullyPaid;
  let alreadyProcessed = false;
  try {
    const dup = await tx.request()
      .input('txnid', mssql.NVarChar, txnid)
      .query(`SELECT id FROM payments WHERE gateway_txnid = @txnid AND status = 'success'`);
    if (dup.recordset.length > 0) {
      alreadyProcessed = true;
      await tx.rollback();
    } else {
      await tx.request()
        .input('txnid', mssql.NVarChar, txnid)
        .input('gpid',  mssql.NVarChar, gatewayPaymentId || null)
        .input('appId', mssql.Int,      appId)
        .input('actor', mssql.NVarChar, actorStr)
        .query(`
          UPDATE payments
          SET status = 'success', gateway_payment_id = @gpid, completed_at = GETDATE(), updated_by = @actor
          WHERE gateway_txnid = @txnid AND application_id = @appId AND status = 'pending'
        `);

      const paidRes = await tx.request()
        .input('appId', mssql.Int, appId)
        .query(`
          SELECT ISNULL(SUM(amount), 0) AS total_paid FROM payments
          WHERE application_id = @appId AND payment_type = 'college_fee' AND status = 'success'
        `);
      totalPaid = parseFloat(paidRes.recordset[0].total_paid) || 0;
      firstPaid = payNowThreshold > 0 && totalPaid >= payNowThreshold - 0.01;
      fullyPaid = totalFee > 0 && totalPaid >= totalFee - 0.01;

      if (firstPaid) {
        await tx.request()
          .input('id',    mssql.Int,      appId)
          .input('actor', mssql.NVarChar, actorStr)
          .query(`
            UPDATE applications
            SET status = 'fees_paid', college_fee_paid = 1,
                updated_at = GETDATE(), status_updated_at = GETDATE(),
                updated_by = @actor
            WHERE id = @id AND status != 'fees_paid'
          `);
      }

      await tx.commit();

      if (!alreadyProcessed) {
        // Mark payment link token used (if payment originated from a link)
        await db.request()
          .input('txnid', mssql.NVarChar, txnid)
          .query(`UPDATE payment_link_tokens SET used=1 WHERE gateway_txnid=@txnid AND used=0`);
      }
    }
  } catch (e) {
    await tx.rollback();
    throw e;
  }

  return { alreadyProcessed, totalPaid, totalFee, firstPaid, fullyPaid };
}

// ── Core: mark a payment failed ──────────────────────────────
async function markPaymentFailed(txnid, reason) {
  try {
    await db.request()
      .input('txnid',  mssql.NVarChar, txnid)
      .input('reason', mssql.NVarChar, (reason || 'failed').substring(0, 100))
      .query(`
        UPDATE payments SET status = 'failed'
        WHERE gateway_txnid = @txnid AND status = 'pending'
      `);
  } catch (e) {
    logger.warn({ err: e, txnid }, 'markPaymentFailed error');
  }
}

// ── Frontend redirect URL helper ─────────────────────────────
function frontendUrl(path) {
  const base = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();
  return `${base}${path}`;
}

// ── GET /payments/misc-fee-status/:applicationId ─────────────
// Returns pending and paid misc/exam payments for this application (student auth)
router.get('/misc-fee-status/:applicationId', async (req, res) => {
  const appId = parseInt(req.params.applicationId);
  try {
    const pmtRes = await db.request()
      .input('appId', mssql.Int, appId)
      .query(`
        SELECT id, payment_type, amount, status, notes, attempted_at, completed_at
        FROM payments
        WHERE application_id = @appId
          AND payment_type IN ('misc_fee', 'exam_fee')
        ORDER BY attempted_at DESC
      `);

    const rows = pmtRes.recordset;
    if (!rows.length) {
      return res.json({ success: true, data: { pending: [], paid: [] } });
    }

    // Collect all unique fee_codes across all payments
    const allCodes = new Set();
    const parsedNotes = rows.map(r => {
      let parsed = {};
      try { parsed = JSON.parse(r.notes || '{}'); } catch (_) {}
      (parsed.fee_codes || []).forEach(c => allCodes.add(parseInt(c)));
      return parsed;
    });

    // Fetch fee head names in bulk
    let headMap = {};
    if (allCodes.size > 0) {
      const codesStr = [...allCodes].join(',');
      const headsRes = await db.request().query(`
        SELECT fees_code, fees_head FROM fees_master WHERE fees_code IN (${codesStr})
      `);
      headsRes.recordset.forEach(h => { headMap[h.fees_code] = h.fees_head; });
    }

    const toItem = (r, notes) => ({
      id:           r.id,
      payment_type: r.payment_type,
      amount:       parseFloat(r.amount) || 0,
      fee_heads:    (notes.fee_codes || []).map(c => ({
        fees_code: c,
        fees_head: headMap[c] || String(c),
      })),
      created_at:   r.attempted_at,
      completed_at: r.completed_at,
    });

    const pending = [];
    const paid    = [];
    rows.forEach((r, i) => {
      const item = toItem(r, parsedNotes[i]);
      if (r.status === 'success') paid.push(item);
      else if (r.status === 'pending') pending.push(item);
    });

    return res.json({ success: true, data: { pending, paid } });
  } catch (err) {
    logger.error({ err }, 'misc-fee-status error');
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /payments/college-fee-status/:applicationId ──────────
router.get('/college-fee-status/:applicationId', async (req, res) => {
  const appId = parseInt(req.params.applicationId);
  try {
    const appRes = await db.request()
      .input('id', mssql.Int, appId)
      .query(`
        SELECT a.id, a.status, a.college_id, a.course_id, a.year_of_study, a.academic_year,
               a.admission_period_id, a.college_fee_paid,
               a.fee_total_amount, a.fee_pay_now_amount,
               a.app_division, a.app_category, a.app_caste, a.app_special_status,
               a.student_id,
               fm.code_no AS faculty_master_id,
               CASE a.year_of_study WHEN 1 THEN 'FY' WHEN 2 THEN 'SY' WHEN 3 THEN 'TY'
                                    WHEN 4 THEN '4Y' WHEN 5 THEN '5Y' ELSE NULL END AS year_level
        FROM applications a
        LEFT JOIN faculty_master fm ON fm.code_no = a.course_id AND fm.college_id = a.college_id
        WHERE a.id = @id
      `);
    if (!appRes.recordset.length) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    const app = appRes.recordset[0];

    const feeInfo = await getCollegeFeTotal(app);
    const totalFee = feeInfo?.source === 'manual'
      ? (feeInfo?.total_fee ?? 0)
      : (feeInfo?.student_payable ?? feeInfo?.total_fee ?? 0);

    // Fetch fee breakdown from FeeDeterminationService for head-level payment display
    let breakdown = [];
    try {
      // Determine if student is new to this college:
      // FY (year 1) → always new. Higher years → new if no prior confirmed app at this college.
      let isNewStudent = app.year_of_study === 1;
      if (!isNewStudent) {
        const priorRes = await db.request()
          .input('sid', mssql.Int, app.student_id)
          .input('col', mssql.Int, app.college_id)
          .input('cur', mssql.Int, appId)
          .query(`
            SELECT TOP 1 id FROM applications
            WHERE student_id = @sid
              AND college_id = @col
              AND id <> @cur
              AND status IN ('confirmed', 'fees_paid', 'roll_assigned')
          `);
        isNewStudent = priorRes.recordset.length === 0;
      }
      const feeResult = await feeSvc.compute({
        collegeId:       app.college_id,
        facultyMasterId: app.faculty_master_id,
        yearLevel:       app.year_level,
        divisionLetter:  app.app_division,
        caste:           app.app_category || app.app_caste || null,
        specialStatus:   app.app_special_status,
        academicYear:    app.academic_year || null,
        isNewStudent,
        pool:            db,
      });
      // Exclude Misc and ExamFees from the regular college fee breakdown —
      // those are collected separately via the Misc/Exam Fees receipt flow.
      breakdown = (feeResult?.breakdown || []).filter(h => {
        const t = (h.fees_type || '').toLowerCase();
        return t !== 'misc' && t !== 'examfees';
      });
    } catch (_) { /* breakdown stays empty if fee not configured */ }

    const paidRes = await db.request()
      .input('appId', mssql.Int, appId)
      .query(`
        SELECT p.id, p.payment_type, p.amount, p.gateway, p.gateway_txnid, p.gateway_payment_id, p.completed_at,
               CASE WHEN plt.id IS NOT NULL THEN 1 ELSE 0 END AS via_payment_link
        FROM payments p
        LEFT JOIN payment_link_tokens plt ON plt.gateway_txnid = p.gateway_txnid AND plt.gateway_txnid IS NOT NULL
        WHERE p.application_id = @appId AND p.payment_type = 'college_fee' AND p.status = 'success'
        ORDER BY p.completed_at
      `);
    const paidRecords = paidRes.recordset;
    const totalPaid   = paidRecords.reduce((s, p) => s + parseFloat(p.amount), 0);

    // totalFee from getCollegeFeTotal already excludes Misc/ExamFees for fees_master source.
    // For manual fee overrides, use as-is (college explicitly set the amount).
    const effectiveTotalFeeBase = totalFee;

    const remaining   = Math.max(0, effectiveTotalFeeBase - totalPaid);

    // Compute head-level payment status: heads clear sequentially (first head first).
    // Platform Fees heads are excluded from sequential clearance — they are shown but not
    // counted in the deduction order.
    // For each head: paid_amount = how much of this head has been covered by totalPaid.
    // status: 'paid' | 'partial' | 'unpaid'
    const nonPlatformBreakdown = breakdown.filter(h => (h.fees_type || '').toLowerCase() !== 'platform');
    const platformBreakdown    = breakdown.filter(h => (h.fees_type || '').toLowerCase() === 'platform');
    const platformTotal        = platformBreakdown.reduce((s, h) => s + (parseFloat(h.amount) || 0), 0);

    // Subtract platform fee amounts from totalPaid before sequential clearance —
    // platform fees are collected alongside college fees but don't participate in
    // head-by-head deduction order.
    let runningPaid = Math.max(0, totalPaid - platformTotal);
    const clearedBreakdown = nonPlatformBreakdown.map(h => {
      const amt = parseFloat(h.amount) || 0;
      if (runningPaid >= amt - 0.01) {
        runningPaid -= amt;
        return { ...h, paid_amount: amt, status: 'paid' };
      } else if (runningPaid > 0.01) {
        const partial = runningPaid;
        runningPaid = 0;
        return { ...h, paid_amount: partial, status: 'partial' };
      } else {
        return { ...h, paid_amount: 0, status: 'unpaid' };
      }
    });

    // Platform Fees heads are always shown as-is (not part of sequential clearance)
    const platformWithStatus = platformBreakdown.map(h => ({ ...h, paid_amount: 0, status: 'unpaid' }));

    // Merge: preserve original order but replace entries with their computed status
    const breakdownWithStatus = breakdown.map(h => {
      if ((h.fees_type || '').toLowerCase() === 'platform') {
        return platformWithStatus.find(p => p.fees_code === h.fees_code) || h;
      }
      return clearedBreakdown.find(c => c.fees_code === h.fees_code) || h;
    });

    // Fetch installment plan
    const instRes = await db.request()
      .input('appId', mssql.Int, appId)
      .query(`SELECT installment_no, due_date, amount FROM fee_installments WHERE application_id=@appId ORDER BY installment_no`);
    const installments = instRes.recordset.map(r => ({ ...r, amount: parseFloat(r.amount) }));

    // Compute current due amount from installment plan:
    // Sum of all installment amounts up to the first installment not yet fully covered by totalPaid.
    // After all fixed installments are satisfied, student can pay freely (remaining balance).
    let currentDue = remaining; // default: free payment
    if (installments.length > 0) {
      let cumulative = 0;
      for (const inst of installments) {
        cumulative += inst.amount;
        if (totalPaid < cumulative - 0.01) {
          // This installment is not yet fully paid — current due is this installment's cumulative threshold minus what's paid
          currentDue = Math.min(cumulative - totalPaid, remaining);
          break;
        }
      }
      // If all installments satisfied, currentDue = remaining (free payment)
    }

    // If no fee is configured but there's an active pending payment link, use the link amount as total_fee
    let effectiveTotalFee = effectiveTotalFeeBase || 0;
    let pendingLinkAmount = null;
    if (effectiveTotalFee === 0) {
      const linkRes = await db.request()
        .input('appId', mssql.Int, appId)
        .query(`SELECT TOP 1 amount FROM payment_link_tokens WHERE application_id=@appId AND used=0 AND expires_at > GETDATE() ORDER BY created_at DESC`);
      if (linkRes.recordset.length) {
        pendingLinkAmount = parseFloat(linkRes.recordset[0].amount);
        effectiveTotalFee = pendingLinkAmount;
      }
    }
    const effectiveRemaining = Math.max(0, effectiveTotalFee - totalPaid);

    return res.json({
      success: true,
      data: {
        application_id:    appId,
        status:            app.status,
        college_fee_paid:  app.college_fee_paid,
        total_fee:         effectiveTotalFee,
        total_paid:        totalPaid,
        remaining:         effectiveRemaining,
        current_due:       pendingLinkAmount ? Math.min(pendingLinkAmount, effectiveRemaining) : currentDue,
        breakdown:         breakdownWithStatus,
        installments,
        paid_records:      paidRecords,
        pending_link_amount: pendingLinkAmount,
      },
    });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /payments/student-has-payments ───────────────────────
router.get('/student-has-payments', async (req, res) => {
  const studentId = parseInt(req.query.student_id);
  if (!studentId) return res.json({ success: true, data: { has_payments: false } });
  try {
    const r = await db.request()
      .input('sid', mssql.Int, studentId)
      .query(`
        SELECT TOP 1 p.id FROM payments p
        JOIN applications a ON a.id = p.application_id
        WHERE a.student_id = @sid AND p.status = 'success'
      `);
    return res.json({ success: true, data: { has_payments: r.recordset.length > 0 } });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /payments/receipts/:applicationId ────────────────────
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
          NULL AS trust_name,
          NULL AS college_affiliation,
          COALESCE(c.degree_course_name, CAST(a.course_id AS NVARCHAR)) AS course_name,
          c.degree_course_code AS degree_course_code,
          a.app_division,
          s.full_name     AS student_name,
          s.email         AS student_email,
          s.phone         AS student_phone,
          COALESCE(
            NULLIF(LTRIM(RTRIM(ISNULL(a.app_surname,'') + ' ' + ISNULL(a.app_first_name,'') + ' ' + ISNULL(a.app_middle_name,''))), ''),
            s.full_name
          ) AS app_full_name,
          a.app_mobile,
          a.app_email
        FROM applications a
        JOIN colleges col ON col.id = a.college_id
        LEFT JOIN faculty_master c ON c.code_no = a.course_id AND c.college_id = a.college_id
        JOIN students s ON s.id = a.student_id
        WHERE a.id = @id
      `);
    if (!appRes.recordset.length) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    const app = appRes.recordset[0];

    const pmtRes = await db.request()
      .input('appId', mssql.Int, appId)
      .query(`
        SELECT p.id, p.payment_type, p.amount, p.status, p.gateway, p.gateway_txnid, p.gateway_payment_id, p.completed_at, p.notes,
               CASE WHEN plt.id IS NOT NULL THEN 1 ELSE 0 END AS via_payment_link
        FROM payments p
        LEFT JOIN payment_link_tokens plt ON plt.gateway_txnid = p.gateway_txnid AND plt.gateway_txnid IS NOT NULL
        WHERE p.application_id = @appId
          AND (p.status = 'success' OR (p.status = 'pending' AND p.payment_type IN ('misc_fee','exam_fee')))
        ORDER BY p.completed_at ASC
      `);
    const payments = pmtRes.recordset;

    // Build fee breakdown for college_fee payments
    // Compute head-level status per payment: heads clear sequentially (first head first).
    // For each payment we track the cumulative paid BEFORE that payment, then AFTER.
    let feeBreakdown = [];
    try {
      const appExtra = await db.request()
        .input('id2', mssql.Int, appId)
        .query(`
          SELECT a.college_id, a.course_id, a.year_of_study, a.academic_year, a.app_division, a.app_category, a.app_caste, a.app_special_status,
                 fm.code_no AS faculty_master_id,
                 CASE a.year_of_study WHEN 1 THEN 'FY' WHEN 2 THEN 'SY' WHEN 3 THEN 'TY'
                                      WHEN 4 THEN '4Y' WHEN 5 THEN '5Y' ELSE NULL END AS year_level
          FROM applications a
          LEFT JOIN faculty_master fm ON fm.code_no = a.course_id AND fm.college_id = a.college_id
          WHERE a.id = @id2
        `);
      if (appExtra.recordset.length) {
        const ae = appExtra.recordset[0];
        const feeResult = await feeSvc.compute({
          collegeId:       ae.college_id,
          facultyMasterId: ae.faculty_master_id,
          yearLevel:       ae.year_level,
          divisionLetter:  ae.app_division,
          caste:           ae.app_category || ae.app_caste || null,
          specialStatus:   ae.app_special_status,
          academicYear:    ae.academic_year || null,
          pool:            db,
        });
        feeBreakdown = (feeResult?.breakdown || []).filter(h => {
          const t = (h.fees_type || '').toLowerCase();
          return t !== 'misc' && t !== 'examfees';
        });
      }
    } catch (_) { /* leave feeBreakdown empty */ }

    // For each college_fee payment, compute which heads it covered (partially or fully)
    // by tracking running cumulative paid before/after this payment.
    // Platform Fees heads are excluded from sequential clearance order.
    const clearableFeeBreakdown = feeBreakdown.filter(h => (h.fees_type || '').toLowerCase() !== 'platform');
    const feeBreakdownPlatformTotal = feeBreakdown
      .filter(h => (h.fees_type || '').toLowerCase() === 'platform')
      .reduce((s, h) => s + (parseFloat(h.amount) || 0), 0);

    // Track cumulative paid against non-platform heads only.
    // Each payment covers the full fee (including platform fees), so we subtract
    // the platform total once from the first payment(s) to get the non-platform portion.
    let platformDebt = feeBreakdownPlatformTotal; // platform portion yet to be "consumed"
    let cumulativeBefore = 0;
    const paymentsWithHeads = payments.map(pmt => {
      if (pmt.payment_type !== 'college_fee' || feeBreakdown.length === 0) {
        return pmt;
      }
      const pmtAmt = parseFloat(pmt.amount);
      // Subtract any remaining platform debt from this payment before crediting non-platform heads
      const platformConsumed = Math.min(platformDebt, pmtAmt);
      platformDebt -= platformConsumed;
      const effectiveAmt = pmtAmt - platformConsumed;
      const cumulativeAfter = cumulativeBefore + effectiveAmt;
      // Walk only non-platform heads for sequential clearance
      let runningTotal = 0;
      const headRows = clearableFeeBreakdown.map(h => {
        const headAmt = parseFloat(h.amount) || 0;
        const headStart = runningTotal;
        const headEnd   = runningTotal + headAmt;
        runningTotal = headEnd;
        // How much of this head was paid in this payment:
        // overlap between [cumulativeBefore, cumulativeAfter] and [headStart, headEnd]
        const overlapStart = Math.max(cumulativeBefore, headStart);
        const overlapEnd   = Math.min(cumulativeAfter, headEnd);
        const paidInThis   = Math.max(0, overlapEnd - overlapStart);
        if (paidInThis < 0.01) return null; // this head not touched by this payment
        return {
          fees_code:  h.fees_code,
          fees_head:  h.fees_head,
          short_name: h.short_name,
          amount:     headAmt,
          paid:       paidInThis,
          cleared:    headEnd <= cumulativeAfter + 0.01,
        };
      }).filter(Boolean);
      cumulativeBefore = cumulativeAfter;
      return { ...pmt, fee_heads: headRows };
    });

    // Enrich misc_fee/exam_fee payments with fee_heads from their notes JSON
    // Collect unique fee_codes used across all misc/exam payments
    const miscFeeCodeSet = new Set();
    const miscNotesMap = {};
    paymentsWithHeads.forEach(pmt => {
      if (pmt.payment_type === 'misc_fee' || pmt.payment_type === 'exam_fee') {
        let notes = {};
        try { notes = JSON.parse(pmt.notes || '{}'); } catch (_) {}
        miscNotesMap[pmt.id] = notes;
        (notes.fee_codes || []).forEach(c => miscFeeCodeSet.add(parseInt(c)));
      }
    });

    let miscHeadMap = {};
    if (miscFeeCodeSet.size > 0) {
      const codesStr = [...miscFeeCodeSet].join(',');
      try {
        const miscHeadsRes = await db.request().query(`
          SELECT fees_code, fees_head FROM fees_master WHERE fees_code IN (${codesStr})
        `);
        miscHeadsRes.recordset.forEach(h => { miscHeadMap[h.fees_code] = h.fees_head; });
      } catch (_) {}
    }

    const enrichedPayments = paymentsWithHeads.map(pmt => {
      if (pmt.payment_type !== 'misc_fee' && pmt.payment_type !== 'exam_fee') return pmt;
      const notes = miscNotesMap[pmt.id] || {};
      const feeHeads = (notes.fee_codes || []).map(c => ({
        fees_code: c,
        fees_head: miscHeadMap[c] || String(c),
      }));
      return { ...pmt, fee_heads: feeHeads };
    });

    return res.json({ success: true, data: { application: app, payments: enrichedPayments } });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /payments/initiate ───────────────────────────────────
// Replaces create-order. Returns PayU form fields for client auto-submit.
const initiateValidators = [
  body('application_id').isInt({ min: 1 }).toInt(),
  body('payment_type').isIn(['application_fee', 'college_fee']),
  body('amount').optional().isFloat({ min: 1 }).toFloat(),
];

router.post('/initiate', initiateValidators, validate, async (req, res) => {
  const { application_id, payment_type, amount: customAmount } = req.body;

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
      amount      = parseFloat(app.application_fee);
      description = 'ApplicationFee';

    } else if (payment_type === 'college_fee') {
      if (!['confirmed', 'fees_paid', 'roll_assigned', 'enrolled'].includes(app.status)) {
        return res.status(400).json({ success: false, message: 'Application must be confirmed to pay college fee.' });
      }
      if ((!app.fee_total_amount || parseFloat(app.fee_total_amount) <= 0) &&
          (!app.fee_pay_now_amount || parseFloat(app.fee_pay_now_amount) <= 0)) {
        return res.status(400).json({ success: false, message: 'The college has not set a fee amount yet.' });
      }
      const paidRes = await db.request()
        .input('appId', mssql.Int, parseInt(application_id))
        .query(`SELECT ISNULL(SUM(amount),0) AS total_paid FROM payments WHERE application_id=@appId AND payment_type='college_fee' AND status='success'`);
      const totalPaid = parseFloat(paidRes.recordset[0].total_paid) || 0;
      const totalFee  = parseFloat(app.fee_total_amount) || 0;
      const remaining = Math.max(0, totalFee - totalPaid);
      if (remaining <= 0) {
        return res.status(400).json({ success: false, message: 'No outstanding balance to pay.' });
      }
      if (customAmount && parseFloat(customAmount) > 0) {
        const reqAmt = parseFloat(customAmount);
        if (reqAmt > remaining + 0.01) {
          return res.status(400).json({ success: false, message: `Amount ₹${reqAmt} exceeds remaining balance ₹${remaining}.` });
        }
        amount = reqAmt;
      } else {
        // Compute current_due from installment plan (same logic as college-fee-status)
        const instRes2 = await db.request()
          .input('appId2', mssql.Int, parseInt(application_id))
          .query(`SELECT installment_no, amount FROM fee_installments WHERE application_id=@appId2 ORDER BY installment_no`);
        const instRows = instRes2.recordset;
        let currentDue = remaining;
        if (instRows.length > 0) {
          let cumulative = 0;
          for (const inst of instRows) {
            cumulative += parseFloat(inst.amount);
            if (totalPaid < cumulative - 0.01) {
              currentDue = Math.min(cumulative - totalPaid, remaining);
              break;
            }
          }
        }
        amount = currentDue > 0 ? currentDue : remaining;
      }
      if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, message: 'No outstanding balance to pay.' });
      }
      description = amount >= totalFee - 0.01 ? 'CollegeFee-Full' : 'CollegeFee';
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Payment amount could not be determined.' });
    }

    // Generate unique txnid and persist a pending payment record BEFORE redirecting
    const txnid    = payU.generateTxnId(application_id, payment_type);
    const actorStr = String(req.user.id);
    const isCollege = req.user.role === 'college';

    await db.request()
      .input('appId',  mssql.Int,      parseInt(application_id))
      .input('ptype',  mssql.NVarChar, payment_type)
      .input('amount', mssql.Decimal(10, 2), amount)
      .input('txnid',  mssql.NVarChar, txnid)
      .input('paidBy', mssql.NVarChar, isCollege ? 'college' : 'student')
      .input('userId', mssql.Int,      req.user.staff_id || req.user.id)
      .input('actor',  mssql.NVarChar, actorStr)
      .query(`
        INSERT INTO payments
          (application_id, payment_type, amount, status, gateway, gateway_txnid, paid_by, paid_by_user_id, created_by)
        VALUES
          (@appId, @ptype, @amount, 'pending', 'payu', @txnid, @paidBy, @userId, @actor)
      `);

    // Sanitize fields for PayU — no special chars, trimmed, no empty mandatory fields.
    // productinfo: alphanumeric + spaces only (PayU rejects parentheses, slashes, etc.)
    const safeProductinfo = description.replace(/[^a-zA-Z0-9_-]/g, '') || 'AdmissionFee';
    const safeFirstname   = ((app.student_name || '').split(' ')[0] || 'Student').replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Student';
    const safeEmail       = (app.student_email || '').trim();
    // PayU requires exactly 10-digit phone; strip non-digits and take last 10
    const rawPhone        = String(app.student_phone || '').replace(/\D/g, '');
    const safePhone       = rawPhone.length >= 10 ? rawPhone.slice(-10) : rawPhone.padEnd(10, '0');

    // Build PayU form fields (hash computed server-side, salt never leaves server)
    const { endpoint, fields } = payU.buildPaymentFields({
      txnid,
      amount,
      productinfo: safeProductinfo,
      firstname:   safeFirstname,
      email:       safeEmail,
      phone:       safePhone,
      surl:        `${process.env.API_BASE_URL || 'http://localhost:5000'}/payments/payu-return`,
      furl:        `${process.env.API_BASE_URL || 'http://localhost:5000'}/payments/payu-return`,
      udf1:        String(application_id),
      udf2:        payment_type,
      udf3:        '',
      udf4:        '',
      udf5:        '',
    });

    return res.json({
      success: true,
      data: {
        endpoint,
        fields,
        // Expose only safe fields to client — key is public, hash is MAC only
        amount_inr:     amount,
        payment_type,
        application_id,
        description,
      },
    });
  } catch (err) {
    logger.error({ err }, 'initiate error');
    return res.status(500).json({ success: false, message: 'Failed to initiate payment.' });
  }
});

// ── POST /payments/initiate-misc-fee ─────────────────────────
// Student pays a pending misc/exam fee online via PayU.
// body: { application_id, payment_id }
router.post('/initiate-misc-fee', async (req, res) => {
  const { application_id, payment_id } = req.body;
  const appId = parseInt(application_id);
  const pmtId = parseInt(payment_id);

  if (!appId || !pmtId) {
    return res.status(400).json({ success: false, message: 'application_id and payment_id are required.' });
  }

  try {
    // Fetch the pending payment and verify it belongs to this student's application
    const pmtRes = await db.request()
      .input('pmtId', mssql.Int, pmtId)
      .input('appId', mssql.Int, appId)
      .query(`
        SELECT p.id, p.payment_type, p.amount, p.status, p.gateway_txnid, p.notes,
               a.student_id, a.college_id,
               s.full_name AS student_name, s.email AS student_email, s.phone AS student_phone
        FROM payments p
        JOIN applications a ON a.id = p.application_id
        JOIN students s ON s.id = a.student_id
        WHERE p.id = @pmtId AND p.application_id = @appId
          AND p.payment_type IN ('misc_fee','exam_fee')
          AND p.status = 'pending'
      `);

    if (!pmtRes.recordset.length) {
      return res.status(404).json({ success: false, message: 'Pending misc/exam payment not found for this application.' });
    }
    const pmt = pmtRes.recordset[0];

    // Verify the authenticated student owns this application
    if (req.user.role === 'student' && req.user.id !== pmt.student_id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const amount      = parseFloat(pmt.amount);
    const paymentType = pmt.payment_type;

    // Generate a new unique txnid for PayU and update the pending payment row
    const txnid = payU.generateTxnId(appId, paymentType);

    await db.request()
      .input('pmtId',  mssql.Int,      pmtId)
      .input('txnid',  mssql.NVarChar, txnid)
      .query(`UPDATE payments SET gateway_txnid = @txnid, gateway = 'payu' WHERE id = @pmtId AND status = 'pending'`);

    const description    = paymentType === 'misc_fee' ? 'MiscFee' : 'ExamFee';
    const safeProductinfo = description;
    const safeFirstname   = ((pmt.student_name || '').split(' ')[0] || 'Student').replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Student';
    const safeEmail       = (pmt.student_email || '').trim();
    const rawPhone        = String(pmt.student_phone || '').replace(/\D/g, '');
    const safePhone       = rawPhone.length >= 10 ? rawPhone.slice(-10) : rawPhone.padEnd(10, '0');

    const { endpoint, fields } = payU.buildPaymentFields({
      txnid,
      amount,
      productinfo: safeProductinfo,
      firstname:   safeFirstname,
      email:       safeEmail,
      phone:       safePhone,
      surl:        `${process.env.API_BASE_URL || 'http://localhost:5000'}/payments/payu-return`,
      furl:        `${process.env.API_BASE_URL || 'http://localhost:5000'}/payments/payu-return`,
      udf1:        String(appId),
      udf2:        paymentType,
      udf3:        '',
      udf4:        '',
      udf5:        '',
    });

    return res.json({
      success: true,
      data: {
        endpoint,
        fields,
        amount_inr:     amount,
        payment_type:   paymentType,
        application_id: appId,
        description,
      },
    });
  } catch (err) {
    logger.error({ err }, 'initiate-misc-fee error');
    return res.status(500).json({ success: false, message: 'Failed to initiate misc fee payment.' });
  }
});

// ── POST /payments/payu-return ────────────────────────────────
// PayU redirects the browser here after success OR failure.
// Registered BEFORE auth middleware — PayU has no JWT.
// We verify hash, then redirect to frontend with result.
// This is the UI signal — payu-webhook is the source of truth.
async function handlePayUReturn(req, res) {
  const p = req.body;

  const txnid     = p.txnid;
  const status    = (p.status || '').toLowerCase();
  const appId     = parseInt(p.udf1 || '0');
  const payType   = p.udf2 || '';

  const ok = payU.verifyResponseHash(p);

  if (!ok) {
    logger.warn({ txnid }, '[PayU] return: hash mismatch — ignoring browser redirect');
    return res.redirect(frontendUrl(`/payment-result?status=error&msg=hash_mismatch`));
  }

  if (status !== 'success') {
    await markPaymentFailed(txnid, p.error_Message || status);
    const msg = encodeURIComponent(p.error_Message || 'Payment was not successful.');
    return res.redirect(frontendUrl(`/payment-result?status=failed&msg=${msg}&app_id=${appId}`));
  }

  // Amount integrity check: compare what PayU reports against our pending record
  const pendingRes = await db.request()
    .input('txnid', mssql.NVarChar, txnid)
    .query(`SELECT amount, application_id, payment_type FROM payments WHERE gateway_txnid = @txnid`);

  if (!pendingRes.recordset.length) {
    logger.error({ txnid }, '[PayU] return: no pending payment record found');
    return res.redirect(frontendUrl(`/payment-result?status=error&msg=record_not_found`));
  }

  const record = pendingRes.recordset[0];
  const payuAmt = parseFloat(p.amount);
  const ourAmt  = parseFloat(record.amount);
  if (Math.abs(payuAmt - ourAmt) > 0.01) {
    logger.error({ txnid, payuAmt, ourAmt }, '[PayU] return: amount mismatch');
    return res.redirect(frontendUrl(`/payment-result?status=error&msg=amount_mismatch`));
  }

  try {
    const result = await commitPayment({
      appId,
      paymentType:      payType || record.payment_type,
      amount:           ourAmt,
      txnid,
      gatewayPaymentId: p.mihpayid || null,
      actorStr:         p.udf1 || 'payu_return',
    });

    if (result.alreadyProcessed) {
      // Webhook already committed — just redirect to success
      return res.redirect(frontendUrl(`/payment-result?status=success&app_id=${appId}&payment_type=${payType}`));
    }

    // Check if payment came via a payment link (to suppress dashboard button on result page)
    const viaLinkRes = await db.request()
      .input('txnid', mssql.NVarChar, txnid)
      .query(`SELECT COUNT(*) AS cnt FROM payment_link_tokens WHERE gateway_txnid=@txnid`);
    const viaLink = viaLinkRes.recordset[0].cnt > 0;
    const viaParam = viaLink ? '&via=link' : '';

    // Post-commit side effects
    if (payType === 'application_fee') {
      await logActivity(appId, 'submitted', 'student', null);
      const regParam = result.regNum ? `&reg=${encodeURIComponent(result.regNum)}` : '';
      return res.redirect(frontendUrl(`/payment-result?status=success&app_id=${appId}&payment_type=application_fee${regParam}${viaParam}`));
    } else if (payType === 'misc_fee' || payType === 'exam_fee') {
      return res.redirect(frontendUrl(`/payment-result?status=success&app_id=${appId}&payment_type=${payType}`));
    } else {
      const { totalPaid, totalFee, firstPaid, fullyPaid } = result;
      if (firstPaid || fullyPaid) {
        await logActivity(appId, 'fees_paid', 'student', `₹${totalPaid?.toLocaleString('en-IN')} paid`);
        if (firstPaid) getStudentForNotification(appId).then(s => s && whatsapp.notifyAdmissionConfirmed(s, appId));
      }
      return res.redirect(frontendUrl(`/payment-result?status=success&app_id=${appId}&payment_type=college_fee&fully_paid=${fullyPaid ? '1' : '0'}${viaParam}`));
    }
  } catch (err) {
    logger.error({ err, txnid }, '[PayU] return: commitPayment failed');
    return res.redirect(frontendUrl(`/payment-result?status=error&msg=commit_failed&app_id=${appId}`));
  }
}

// ── POST /payments/payu-webhook ───────────────────────────────
// PayU calls this independently of the browser.
// No auth middleware. Source of truth for payment status.
// Respond with "success" to acknowledge receipt.
async function handlePayUWebhook(req, res) {
  const p = req.body;

  // Always respond 200 first — then process (prevents PayU retry storms)
  res.status(200).send('success');

  const txnid  = p.txnid;
  const status = (p.status || '').toLowerCase();

  if (!txnid) {
    logger.warn('[PayU] webhook: missing txnid');
    return;
  }

  const ok = payU.verifyResponseHash(p);
  if (!ok) {
    logger.warn({ txnid }, '[PayU] webhook: hash mismatch — ignoring');
    return;
  }

  if (status !== 'success') {
    await markPaymentFailed(txnid, p.error_Message || status);
    return;
  }

  // Amount integrity check
  const pendingRes = await db.request()
    .input('txnid', mssql.NVarChar, txnid)
    .query(`SELECT amount, application_id, payment_type FROM payments WHERE gateway_txnid = @txnid`);

  if (!pendingRes.recordset.length) {
    logger.error({ txnid }, '[PayU] webhook: no payment record found');
    return;
  }

  const record  = pendingRes.recordset[0];
  const payuAmt = parseFloat(p.amount);
  const ourAmt  = parseFloat(record.amount);

  if (Math.abs(payuAmt - ourAmt) > 0.01) {
    logger.error({ txnid, payuAmt, ourAmt }, '[PayU] webhook: amount mismatch — not crediting');
    await markPaymentFailed(txnid, 'amount_mismatch');
    return;
  }

  const appId   = record.application_id;
  const payType = record.payment_type;

  try {
    const result = await commitPayment({
      appId,
      paymentType:      payType,
      amount:           ourAmt,
      txnid,
      gatewayPaymentId: p.mihpayid || null,
      actorStr:         'payu_webhook',
    });

    if (result.alreadyProcessed) {
      logger.info({ txnid }, '[PayU] webhook: already processed — idempotent skip');
      return;
    }

    // Side effects
    if (payType === 'application_fee') {
      await logActivity(appId, 'submitted', 'student', 'PayU webhook');
    } else if (result.firstPaid || result.fullyPaid) {
      await logActivity(appId, 'fees_paid', 'student', `PayU webhook: ₹${result.totalPaid?.toLocaleString('en-IN')} paid`);
      if (result.firstPaid) getStudentForNotification(appId).then(s => s && whatsapp.notifyAdmissionConfirmed(s, appId));
    }

    logger.info({ txnid, appId, payType }, '[PayU] webhook: committed successfully');
  } catch (err) {
    logger.error({ err, txnid }, '[PayU] webhook: commitPayment error');
  }
}

// ── POST /payments/cash (college-side cash recording) ────────
// Kept for backwards compatibility — cash payments don't use a gateway.
router.post('/cash/:collegeId/applications/:appId', async (req, res) => {
  const { collegeId, appId: appIdParam } = req.params;
  const appId   = parseInt(appIdParam);
  const amount  = parseFloat(req.body.amount);
  const actorStr = String(req.user.staff_id || req.user.id);

  if (!amount || amount <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid amount.' });
  }

  try {
    const pool = await db;
    const tx   = pool.transaction();
    await tx.begin();
    try {
      await tx.request()
        .input('appId',  mssql.Int,      appId)
        .input('ptype',  mssql.NVarChar, 'college_fee')
        .input('amount', mssql.Decimal(10, 2), amount)
        .input('actor',  mssql.NVarChar, actorStr)
        .input('userId', mssql.Int,      req.user.staff_id || req.user.id)
        .query(`
          INSERT INTO payments
            (application_id, payment_type, amount, status, gateway, paid_by, paid_by_user_id, completed_at, created_by)
          VALUES
            (@appId, @ptype, @amount, 'success', 'cash', 'college', @userId, GETDATE(), @actor)
        `);

      await tx.request()
        .input('id',    mssql.Int,      appId)
        .input('actor', mssql.NVarChar, actorStr)
        .query(`
          UPDATE applications
          SET status = 'fees_paid', college_fee_paid = 1,
              updated_at = GETDATE(), status_updated_at = GETDATE(),
              updated_by = @actor
          WHERE id = @id AND status != 'fees_paid'
        `);

      await tx.commit();
    } catch (e) {
      await tx.rollback();
      throw e;
    }

    await logActivity(appId, 'fees_paid', 'college', `Cash ₹${amount.toLocaleString('en-IN')}`);
    return res.json({ success: true, message: `Cash payment of ₹${amount.toLocaleString('en-IN')} recorded.` });
  } catch (err) {
    logger.error({ err }, 'cash payment error');
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /payments/generate-link ─────────────────────────────
// Creates a single-use token for a payment link (auth required).
// body: { application_id, payment_type }
router.post('/generate-link', authenticate, async (req, res) => {
  const { application_id, payment_type = 'application_fee' } = req.body;
  const appId = parseInt(application_id);
  if (!appId || !['application_fee','college_fee'].includes(payment_type)) {
    return res.status(400).json({ success: false, message: 'Invalid parameters.' });
  }

  try {
    const appRes = await db.request()
      .input('id', mssql.Int, appId)
      .query(`
        SELECT a.id, a.status, a.fee_total_amount, COALESCE(c.application_fee,0) AS application_fee,
               c.name AS college_name, a.registration_number
        FROM applications a
        JOIN colleges c ON c.id = a.college_id
        WHERE a.id = @id
      `);
    if (!appRes.recordset.length)
      return res.status(404).json({ success: false, message: 'Application not found.' });

    const app = appRes.recordset[0];
    let amount = 0;
    if (payment_type === 'application_fee') {
      amount = parseFloat(app.application_fee) || 0;
    } else {
      const paidRes = await db.request().input('id', mssql.Int, appId)
        .query(`SELECT ISNULL(SUM(amount),0) AS paid FROM payments WHERE application_id=@id AND payment_type='college_fee' AND status='success'`);
      amount = Math.max(0, (parseFloat(app.fee_total_amount) || 0) - (parseFloat(paidRes.recordset[0].paid) || 0));
    }
    if (amount <= 0)
      return res.status(400).json({ success: false, message: 'No outstanding amount to pay.' });

    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.request()
      .input('token',   mssql.NVarChar, token)
      .input('appId',   mssql.Int,      appId)
      .input('ptype',   mssql.NVarChar, payment_type)
      .input('amount',  mssql.Decimal,  amount)
      .input('creator', mssql.NVarChar, req.user?.email || req.user?.name || null)
      .input('exp',     mssql.DateTime2, expiresAt)
      .query(`
        INSERT INTO payment_link_tokens (token, application_id, payment_type, amount, created_by, expires_at)
        VALUES (@token, @appId, @ptype, @amount, @creator, @exp)
      `);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const link = `${frontendUrl}/pay/${token}`;

    return res.json({
      success: true,
      link,
      amount,
      college_name:        app.college_name,
      registration_number: app.registration_number,
    });
  } catch (err) {
    logger.error({ err }, 'generate-link error');
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /payments/send-payment-link ─────────────────────────
// Generates a link and sends it via WhatsApp template 590.
// body: { application_id, payment_type, phone, amount? }
router.post('/send-payment-link', authenticate, async (req, res) => {
  const { application_id, payment_type = 'application_fee', phone, amount: customAmount } = req.body;
  if (!phone) return res.status(400).json({ success: false, message: 'Phone number is required.' });

  try {
    const appId = parseInt(application_id);
    const appRes = await db.request()
      .input('id', mssql.Int, appId)
      .query(`
        SELECT a.id, a.status, a.fee_total_amount, a.registration_number,
               COALESCE(c.application_fee,0) AS application_fee,
               c.name AS college_name
        FROM applications a
        JOIN colleges c ON c.id = a.college_id
        WHERE a.id = @id
      `);
    if (!appRes.recordset.length)
      return res.status(404).json({ success: false, message: 'Application not found.' });

    const app = appRes.recordset[0];
    let maxAmount = 0;
    if (payment_type === 'application_fee') {
      maxAmount = parseFloat(app.application_fee) || 0;
    } else {
      const paidRes = await db.request().input('id', mssql.Int, appId)
        .query(`SELECT ISNULL(SUM(amount),0) AS paid FROM payments WHERE application_id=@id AND payment_type='college_fee' AND status='success'`);
      maxAmount = Math.max(0, (parseFloat(app.fee_total_amount) || 0) - (parseFloat(paidRes.recordset[0].paid) || 0));
    }
    if (maxAmount <= 0)
      return res.status(400).json({ success: false, message: 'No outstanding amount to pay.' });

    // Use caller-specified amount if provided and valid, otherwise use full outstanding
    let amount = maxAmount;
    if (customAmount) {
      const reqAmt = parseFloat(customAmount);
      if (!reqAmt || reqAmt <= 0) return res.status(400).json({ success: false, message: 'Invalid amount.' });
      if (reqAmt > maxAmount + 0.01) return res.status(400).json({ success: false, message: `Amount ₹${reqAmt} exceeds outstanding balance ₹${maxAmount}.` });
      amount = reqAmt;
    }

    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.request()
      .input('token',   mssql.NVarChar,  token)
      .input('appId',   mssql.Int,       appId)
      .input('ptype',   mssql.NVarChar,  payment_type)
      .input('amount',  mssql.Decimal,   amount)
      .input('creator', mssql.NVarChar,  req.user?.email || req.user?.name || null)
      .input('exp',     mssql.DateTime2, expiresAt)
      .query(`
        INSERT INTO payment_link_tokens (token, application_id, payment_type, amount, created_by, expires_at)
        VALUES (@token, @appId, @ptype, @amount, @creator, @exp)
      `);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const link = `${frontendUrl}/pay/${token}`;

    // Template 590: shop_name, bill_no, bill_url
    const normPhone = whatsapp.normalisePhone(phone);
    const sample    = `${app.college_name},${app.registration_number || appId},${link}`;
    await whatsapp.sendTemplateMessage(normPhone, '590', sample, 'payment_link', appId);

    await logActivity(appId, 'payment_link_sent', 'college',
      `₹${amount.toLocaleString('en-IN')} ${payment_type} link sent to ${phone}`);

    return res.json({ success: true, message: 'Payment link sent via WhatsApp.', link });
  } catch (err) {
    logger.error({ err }, 'send-payment-link error');
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /payments/pay/:token ──────────────────────────────────
// No auth — returns PayU form fields for the payment link token.
// NOTE: this route is also registered BEFORE authenticate middleware above.
async function handlePayViaToken(req, res) {
  const { token } = req.params;
  try {
    const tokRes = await db.request()
      .input('token', mssql.NVarChar, token)
      .query(`
        SELECT t.id, t.application_id, t.payment_type, t.amount, t.expires_at, t.used, t.gateway_txnid,
               a.app_division,
               s.full_name AS student_name, s.email AS student_email, s.phone AS student_phone,
               c.name AS college_name
        FROM payment_link_tokens t
        JOIN applications a ON a.id = t.application_id
        JOIN students s ON s.id = a.student_id
        JOIN colleges c ON c.id = a.college_id
        WHERE t.token = @token
      `);

    if (!tokRes.recordset.length)
      return res.status(404).json({ success: false, message: 'Payment link not found.' });

    const tok = tokRes.recordset[0];

    if (tok.used)
      return res.status(410).json({ success: false, message: 'This payment link has already been used.' });
    if (new Date() > new Date(tok.expires_at))
      return res.status(410).json({ success: false, message: 'This payment link has expired.' });

    const amount      = parseFloat(tok.amount);
    const productinfo = tok.payment_type === 'application_fee' ? 'ApplicationFee' : 'CollegeFee';
    const firstname   = (tok.student_name || 'Student').split(' ')[0].replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Student';
    const email       = tok.student_email || 'student@college.edu';
    const phone       = (tok.student_phone || '').replace(/\D/g, '').slice(-10).padStart(10, '0');
    const apiBase     = process.env.API_BASE_URL || 'http://localhost:5000';

    // Reuse the same txnid if this token was already seen (page reload).
    // Generate a new one only on the first visit, then persist it on the token row.
    let txnid = tok.gateway_txnid;
    if (!txnid) {
      txnid = payU.generateTxnId(tok.application_id, tok.payment_type);

      // Persist txnid on the token so reloads reuse it
      await db.request()
        .input('txnid', mssql.NVarChar, txnid)
        .input('token', mssql.NVarChar, token)
        .query(`UPDATE payment_link_tokens SET gateway_txnid = @txnid WHERE token = @token`);

      // Insert a single pending payment row (idempotent — only on first visit)
      await db.request()
        .input('appId',  mssql.Int,      tok.application_id)
        .input('ptype',  mssql.NVarChar, tok.payment_type)
        .input('amount', mssql.Decimal,  amount)
        .input('txnid',  mssql.NVarChar, txnid)
        .query(`
          INSERT INTO payments (application_id, payment_type, amount, status, gateway, gateway_txnid, paid_by)
          VALUES (@appId, @ptype, @amount, 'pending', 'payu', @txnid, 'student')
        `);

      await logActivity(tok.application_id, 'payment_link_opened', 'student',
        `₹${amount.toLocaleString('en-IN')} ${tok.payment_type} link opened`);
    }

    // Token is NOT marked used here — payu-return/webhook marks it used after payment succeeds.

    const { endpoint, fields } = payU.buildPaymentFields({
      txnid, amount, productinfo, firstname, email, phone,
      surl: `${apiBase}/payments/payu-return`,
      furl: `${apiBase}/payments/payu-return`,
      udf1: String(tok.application_id),
      udf2: tok.payment_type,
      udf3: tok.app_division || '',
    });

    return res.json({ success: true, endpoint, fields, college_name: tok.college_name, student_name: tok.student_name, amount });
  } catch (err) {
    logger.error({ err }, 'pay/:token error');
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = router;
