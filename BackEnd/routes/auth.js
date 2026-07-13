/**
 * auth.js — Login endpoints for students and college admins.
 * POST /auth/login/student
 * POST /auth/login/college
 */

const express   = require('express');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const { authLimiter, registerLimiter, otpLimiter } = require('../middleware/rateLimits');
const router    = express.Router();
const db        = require('./db');
const whatsapp  = require('../services/whatsapp');
const mssql     = require('mssql');
const logger    = require('../config/logger');
const { saveOtp, verifyAndConsumeOtp, checkOtp } = require('../services/otpService');
const { body, validationResult } = require('express-validator');
const auditLog = require('../middleware/auditLog');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }
  next();
}

// ── Password policy ─────────────────────────────────────────
// Returns an error string if invalid, null if valid.
function validatePassword(password) {
  if (!password || password.length < 8)       return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password))                return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(password))                return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(password))                return 'Password must contain at least one number.';
  if (!/[^A-Za-z0-9]/.test(password))         return 'Password must contain at least one special character.';
  return null;
}

// OTP helpers imported from ../services/otpService

const JWT_SECRET = process.env.JWT_SECRET;
const IS_PROD    = process.env.NODE_ENV === 'production';

// ── Daily session expiry ─────────────────────────────────────
// Every session expires at a fixed hour each day (default: midnight, local time),
// so all users are logged out daily. This is an ABSOLUTE deadline: /auth/refresh
// re-issues a token but can never push the expiry past it.
//
// SESSION_EXPIRY_HOUR — hour of day (0-23) at which sessions expire. Default 0 (midnight).
const SESSION_EXPIRY_HOUR = (() => {
  const h = parseInt(process.env.SESSION_EXPIRY_HOUR, 10);
  return Number.isInteger(h) && h >= 0 && h <= 23 ? h : 0;
})();

/** Date of the next daily expiry boundary (the next SESSION_EXPIRY_HOUR from now). */
function nextExpiryDate() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(SESSION_EXPIRY_HOUR, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1); // already passed today → tomorrow
  return next;
}

/** Seconds from now until the next daily expiry (min 60s so a token is never useless). */
function secondsUntilExpiry(deadline = nextExpiryDate()) {
  return Math.max(60, Math.floor((deadline.getTime() - Date.now()) / 1000));
}

/**
 * Sign a token that expires at the next daily boundary.
 * The absolute deadline is embedded as `sxp` (session expiry, epoch seconds) so
 * /auth/refresh can honour it and never extend a session past it.
 */
function signSessionToken(claims) {
  const deadline = nextExpiryDate();
  const sxp = Math.floor(deadline.getTime() / 1000);
  return {
    token: jwt.sign({ ...claims, sxp }, JWT_SECRET, { expiresIn: secondsUntilExpiry(deadline) }),
    deadline,
  };
}

// httpOnly cookie options — token never accessible to JS.
// Cookie is kept as a convenience for same-origin deployments (production).
// Cross-origin / LAN dev uses Authorization: Bearer header instead (see AuthContext).
const COOKIE_BASE = {
  httpOnly: true,
  secure:   IS_PROD,
  sameSite: IS_PROD ? 'strict' : 'lax',
  path:     '/',
};

// Cookie expires exactly when the token does (the daily boundary).
function setAuthCookie(res, token, deadline) {
  res.cookie('auth_token', token, {
    ...COOKIE_BASE,
    maxAge: Math.max(60_000, (deadline?.getTime() ?? nextExpiryDate().getTime()) - Date.now()),
  });
}

// Rate limiters (login, register, OTP) are centralized in
// middleware/rateLimits.js — env-configurable, per-IP + per-account, with
// progressive backoff. See that file for the tunable thresholds.

const studentLoginValidators = [
  body('phone').isString().trim().notEmpty().withMessage('Phone number is required.'),
  body('password').isString().notEmpty().withMessage('Password is required.'),
];

const emailLoginValidators = [
  body('email').isEmail().normalizeEmail().withMessage('A valid email address is required.'),
  body('password').isString().notEmpty().withMessage('Password is required.'),
];

// Audit-log all login and OTP routes (user not yet on req, so userId will be null)
router.use('/login', auditLog);
router.use('/otp',   auditLog);
router.use('/forgot-password', auditLog);

// ── Student login ───────────────────────────────────────────
router.post('/login/student', ...authLimiter, studentLoginValidators, validate, async (req, res) => {
  const { phone, password } = req.body;

  try {
    const result = await db.request()
      .input('phone', phone.trim())
      .query('SELECT id, full_name, email, password_hash, phone, city, category FROM students WHERE phone = @phone');

    if (result.recordset.length === 0) {
      return res.status(401).json({ message: 'Invalid phone number or password.' });
    }

    const student = result.recordset[0];
    const match   = await bcrypt.compare(password, student.password_hash);

    if (!match) {
      return res.status(401).json({ message: 'Invalid phone number or password.' });
    }

    const { token, deadline } = signSessionToken({ id: student.id, role: 'student' });
    setAuthCookie(res, token, deadline);

    return res.json({
      message: 'Login successful',
      token,
      role: 'student',
      user: {
        id:       student.id,
        name:     student.full_name,
        email:    student.email,
        phone:    student.phone,
        city:     student.city,
        category: student.category,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Student login error');
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── College login (admin OR staff — single endpoint) ────────
router.post('/login/college', ...authLimiter, emailLoginValidators, validate, async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Try college admin first
    const adminResult = await db.request()
      .input('email', email.trim().toLowerCase())
      .query('SELECT id, name, address, admin_email, admin_password_hash, city, college_code, is_enabled FROM colleges WHERE admin_email = @email');

    if (adminResult.recordset.length > 0) {
      const college = adminResult.recordset[0];
      const match   = await bcrypt.compare(password, college.admin_password_hash);
      if (!match) return res.status(401).json({ message: 'Invalid email or password.' });
      if (!college.is_enabled) return res.status(403).json({ message: 'This college account has been disabled. Please contact the platform administrator.' });

      const { token, deadline } = signSessionToken({ id: college.id, role: 'college', is_staff: false });
      setAuthCookie(res, token, deadline);

      return res.json({
        message: 'Login successful',
        token,
        role: 'college',
        user: {
          id:           college.id,
          name:         college.name,
          address:      college.address || '',
          city:         college.city,
          college_code: college.college_code,
        },
      });
    }

    // 2. Try college staff user
    const staffResult = await db.request()
      .input('email', email.trim().toLowerCase())
      .query(`
        SELECT u.id, u.full_name, u.email, u.password_hash, u.is_active,
               u.college_id, u.role_id,
               c.name AS college_name, c.address AS college_address, c.college_code, c.is_enabled AS college_enabled,
               r.role_name,
               (SELECT p.permission, p.can_write
                FROM college_role_permissions p
                WHERE p.role_id = u.role_id
                FOR JSON PATH) AS permissions_json
        FROM college_users u
        JOIN colleges c ON c.id = u.college_id
        JOIN college_roles r ON r.id = u.role_id
        WHERE u.email = @email
      `);

    if (!staffResult.recordset.length) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const staff = staffResult.recordset[0];
    if (!staff.college_enabled) {
      return res.status(403).json({ message: 'This college account has been disabled. Please contact the platform administrator.' });
    }
    if (!staff.is_active) {
      return res.status(403).json({ message: 'Your account has been deactivated. Contact the administrator.' });
    }

    const match = await bcrypt.compare(password, staff.password_hash);
    if (!match) return res.status(401).json({ message: 'Invalid email or password.' });

    const permsArray = staff.permissions_json ? JSON.parse(staff.permissions_json) : [];
    const permissions = {};
    const nav_visibility = {};
    permsArray.forEach(p => {
      if (p.permission.startsWith('nav:')) {
        nav_visibility[p.permission.slice(4)] = !!p.can_write;
      } else {
        permissions[p.permission] = !!p.can_write;
      }
    });

    const { token, deadline } = signSessionToken(
      { id: staff.college_id, role: 'college', is_staff: true, staff_id: staff.id, permissions, nav_visibility }
    );
    setAuthCookie(res, token, deadline);

    return res.json({
      message: 'Login successful',
      token,
      role: 'college',
      user: {
        id:           staff.college_id,
        name:         staff.college_name,
        address:      staff.college_address || '',
        email:        staff.email,
        college_code: staff.college_code,
        staff_id:     staff.id,
        staff_name:   staff.full_name,
        role_name:    staff.role_name,
        permissions,
        nav_visibility,
        is_staff:     true,
      },
    });
  } catch (err) {
    logger.error({ err }, 'College login error');
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── Admin login ─────────────────────────────────────────────
router.post('/login/admin', ...authLimiter, emailLoginValidators, validate, async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await db.request()
      .input('email', email)
      .query('SELECT id, name, email, password_hash FROM admins WHERE email = @email');

    if (result.recordset.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    const admin = result.recordset[0];
    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    const { token, deadline } = signSessionToken({ id: admin.id, role: 'admin' });
    setAuthCookie(res, token, deadline);
    return res.json({
      message: 'Login successful',
      token,
      role: 'admin',
      user: { id: admin.id, name: admin.name, email: admin.email },
    });
  } catch (err) {
    logger.error({ err }, 'Admin login error');
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── College staff (sub-user) login ──────────────────────────
router.post('/login/college-user', ...authLimiter, emailLoginValidators, validate, async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await db.request()
      .input('email', email.trim().toLowerCase())
      .query(`
        SELECT u.id, u.full_name, u.email, u.password_hash, u.is_active,
               u.college_id, u.role_id,
               c.name AS college_name, c.address AS college_address, c.college_code,
               r.role_name,
               (SELECT p.permission, p.can_write
                FROM college_role_permissions p
                WHERE p.role_id = u.role_id
                FOR JSON PATH) AS permissions_json
        FROM college_users u
        JOIN colleges c ON c.id = u.college_id
        JOIN college_roles r ON r.id = u.role_id
        WHERE u.email = @email
      `);

    if (!result.recordset.length) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const user = result.recordset[0];

    if (!user.is_active) {
      return res.status(403).json({ message: 'Your account has been deactivated. Contact the administrator.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Build permissions map: { submit_application: true/false, ... }
    const permsArray = user.permissions_json ? JSON.parse(user.permissions_json) : [];
    const permissions = {};
    const nav_visibility = {};
    permsArray.forEach(p => {
      if (p.permission.startsWith('nav:')) {
        nav_visibility[p.permission.slice(4)] = !!p.can_write;
      } else {
        permissions[p.permission] = !!p.can_write;
      }
    });

    const { token, deadline } = signSessionToken(
      { id: user.college_id, role: 'college', is_staff: true, staff_id: user.id, permissions, nav_visibility }
    );
    setAuthCookie(res, token, deadline);

    return res.json({
      message: 'Login successful',
      token,
      role: 'college',
      user: {
        id:           user.college_id,
        name:         user.college_name,
        address:      user.college_address || '',
        email:        user.email,
        college_code: user.college_code,
        // staff-specific fields
        staff_id:     user.id,
        staff_name:   user.full_name,
        role_name:    user.role_name,
        permissions,
        nav_visibility,
        is_staff:     true,
      },
    });
  } catch (err) {
    logger.error({ err }, 'College-user login error');
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// otpLimiter is imported from middleware/rateLimits.js (per-account keyed).

const otpSendValidators = [
  body('full_name').isString().trim().notEmpty().isLength({ max: 150 }).withMessage('Full name is required (max 150 characters).'),
  body('email').isEmail().normalizeEmail().withMessage('A valid email address is required.'),
  body('phone').matches(/^[6-9]\d{9}$/).withMessage('Phone number must be 10 digits starting with 6–9.'),
  body('password').isString().notEmpty().withMessage('Password is required.'),
  body('confirm_password').isString().notEmpty().withMessage('Please confirm your password.'),
];

// ── Send OTP for phone verification ─────────────────────────
// POST /auth/otp/send   body: { phone, ...registrationFields }
router.post('/otp/send', otpLimiter, otpSendValidators, validate, async (req, res) => {
  const { phone, full_name, email, password, confirm_password, city, category } = req.body;

  const pwdErr = validatePassword(password);
  if (pwdErr) return res.status(400).json({ message: pwdErr });
  if (password !== confirm_password) {
    return res.status(400).json({ message: 'Passwords do not match.' });
  }

  try {
    const exists = await db.request()
      .input('email', email.trim().toLowerCase())
      .input('phone', phone.trim())
      .query('SELECT id, email, phone FROM students WHERE email = @email OR phone = @phone');

    if (exists.recordset.length > 0) {
      const dup = exists.recordset[0];
      if (dup.email.toLowerCase() === email.trim().toLowerCase()) {
        return res.status(409).json({ message: 'An account with this email already exists.' });
      }
      return res.status(409).json({ message: 'An account with this phone number already exists.' });
    }

    const otp       = String(Math.floor(100000 + Math.random() * 900000));
    const normPhone = whatsapp.normalisePhone(phone.trim());

    await whatsapp.sendOtp(normPhone, otp);
    await saveOtp(normPhone, otp, 'registration', {
      full_name, email: email.trim().toLowerCase(), password, phone: phone.trim(), city, category,
    });

    return res.json({ message: 'OTP sent to your WhatsApp number. Valid for 10 minutes.' });
  } catch (err) {
    logger.error({ err }, 'OTP send error');
    return res.status(500).json({ message: 'Failed to send OTP. Please try again.' });
  }
});

const otpVerifyValidators = [
  body('phone').matches(/^[6-9]\d{9}$/).withMessage('A valid 10-digit phone number is required.'),
  body('otp').isString().trim().matches(/^\d{6}$/).withMessage('OTP must be a 6-digit number.'),
];

// ── Verify OTP and complete registration ─────────────────────
// POST /auth/otp/verify   body: { phone, otp }
router.post('/otp/verify', otpVerifyValidators, validate, async (req, res) => {
  const { phone, otp } = req.body;

  const normPhone = whatsapp.normalisePhone(phone.trim());

  try {
    const { valid, reason, pendingData } = await verifyAndConsumeOtp(normPhone, otp, 'registration');
    if (!valid) return res.status(400).json({ message: reason });

    const { full_name, email, password, phone: rawPhone, city, category } = pendingData;
    const hash = await bcrypt.hash(password, 10);

    const result = await db.request()
      .input('full_name', full_name)
      .input('email',     email)
      .input('hash',      hash)
      .input('phone',     rawPhone || null)
      .input('city',      city     || null)
      .input('category',  category || 'general')
      .query(`
        DECLARE @t TABLE (id INT, full_name NVARCHAR(150), email NVARCHAR(150));
        INSERT INTO students (full_name, email, password_hash, phone, city, category, created_by)
        OUTPUT INSERTED.id, INSERTED.full_name, INSERTED.email INTO @t
        VALUES (@full_name, @email, @hash, @phone, @city, @category, 'self');
        SELECT id, full_name, email FROM @t;
      `);

    const newStudent = result.recordset[0];
    return res.status(201).json({
      message: 'Phone verified and registration successful.',
      role: 'student',
      user: { id: newStudent.id, name: newStudent.full_name, email: newStudent.email },
    });
  } catch (err) {
    logger.error({ err }, 'Registration after OTP verify error');
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── Student registration ────────────────────────────────────
router.post('/register/student', registerLimiter, async (req, res) => {
  const { full_name, password, phone, dob, gender, address, city, category } = req.body;

  if (!full_name || !req.body.email) {
    return res.status(400).json({ message: 'Name and email are required.' });
  }
  // Normalize email (stored lowercased). Duplicate emails are allowed.
  const email = String(req.body.email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'A valid email address is required.' });
  }
  // If no password provided (college-registered student), generate a random one.
  // The student will use Forgot Password to set their own password.
  const effectivePassword = password || require('crypto').randomBytes(16).toString('hex');
  const pwdErr = password ? validatePassword(password) : null;
  if (pwdErr) return res.status(400).json({ message: pwdErr });

  try {
    // Duplicate emails are allowed (students log in by phone, not email), so we
    // only look up existing students by PHONE. Phone stays unique.
    const exists = await db.request()
      .input('phone', phone ? phone.trim() : null)
      .query('SELECT id, full_name, email, phone FROM students WHERE phone IS NOT NULL AND phone = @phone');

    if (exists.recordset.length > 0) {
      const dup = exists.recordset[0];

      // Phone collision — check if confirmed somewhere
      const confirmedCheck = await db.request()
        .input('studentId', mssql.Int, dup.id)
        .query(`
          SELECT TOP 1 college_id FROM applications
          WHERE student_id = @studentId
            AND status IN ('confirmed','fees_paid','roll_assigned','enrolled')
        `);

      if (confirmedCheck.recordset.length > 0) {
        // Confirmed elsewhere — trigger transfer OTP
        const rawPhone = phone ? phone.trim() : null;
        if (rawPhone) {
          try {
            const normPhone = whatsapp.normalisePhone(rawPhone);
            const otp = String(Math.floor(100000 + Math.random() * 900000));
            await whatsapp.sendOtp(normPhone, otp);
            await saveOtp(normPhone, otp, 'student_transfer', { phone: rawPhone });
          } catch (otpErr) {
            logger.warn({ err: otpErr }, 'Could not send transfer OTP during registration');
          }
        }
        return res.status(409).json({
          transfer_required: true,
          student_id: dup.id,
          message: 'This student has a confirmed admission at another college. An OTP has been sent to their WhatsApp to verify the transfer.',
        });
      }

      // Phone exists but not confirmed anywhere — reuse existing student silently
      return res.status(200).json({
        message: 'Existing student account found.',
        role: 'student',
        user: { id: dup.id, name: dup.full_name, email: dup.email },
      });
    }

    const hash = await bcrypt.hash(effectivePassword, 10);

    const result = await db.request()
      .input('full_name', full_name)
      .input('email',     email)
      .input('hash',      hash)
      .input('phone',     phone     || null)
      .input('dob',       dob       || null)
      .input('gender',    gender    || null)
      .input('address',   address   || null)
      .input('city',      city      || null)
      .input('category',  category  || 'general')
      .query(`
        DECLARE @t TABLE (id INT, full_name NVARCHAR(150), email NVARCHAR(150));
        INSERT INTO students (full_name, email, password_hash, phone, dob, gender, address, city, category, created_by)
        OUTPUT INSERTED.id, INSERTED.full_name, INSERTED.email INTO @t
        VALUES (@full_name, @email, @hash, @phone, @dob, @gender, @address, @city, @category, 'self');
        SELECT id, full_name, email FROM @t;
      `);

    const newStudent = result.recordset[0];

    return res.status(201).json({
      message: 'Registration successful',
      role: 'student',
      user: {
        id:    newStudent.id,
        name:  newStudent.full_name,
        email: newStudent.email,
      },
    });
  } catch (err) {
    // UNIQUE constraint violation — only phone is unique now (email can duplicate).
    // A concurrent request may have inserted the same phone between check and insert.
    if (err.number === 2627 || err.number === 2601) {
      return res.status(409).json({ message: 'An account with this phone number already exists.' });
    }
    logger.error({ err }, 'Student registration error');
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── Forgot password — send OTP ───────────────────────────────
// POST /auth/forgot-password/send-otp   body: { phone }
router.post('/forgot-password/send-otp', otpLimiter,
  body('phone').matches(/^[6-9]\d{9}$/).withMessage('A valid 10-digit phone number is required.'),
  validate,
  async (req, res) => {
  const { phone } = req.body;

  try {
    const found = await db.request()
      .input('phone', phone.trim())
      .query('SELECT id FROM students WHERE phone = @phone');

    if (found.recordset.length === 0) {
      return res.json({ message: 'If this number is registered, an OTP has been sent.' });
    }

    const otp       = String(Math.floor(100000 + Math.random() * 900000));
    const normPhone = whatsapp.normalisePhone(phone.trim());

    await whatsapp.sendOtp(normPhone, otp);
    await saveOtp(normPhone, otp, 'password_reset', { phone: phone.trim() });

    return res.json({ message: 'OTP sent to your WhatsApp number. Valid for 10 minutes.' });
  } catch (err) {
    logger.error({ err }, 'Forgot password OTP error');
    return res.status(500).json({ message: 'Failed to send OTP. Please try again.' });
  }
});

// ── Forgot password — verify OTP (does NOT consume it) ───────
// POST /auth/forgot-password/verify-otp   body: { phone, otp }
//
// Gates the OTP screen so the user cannot reach the new-password screen with an
// OTP that was never valid — including the case where no OTP was ever sent
// because the phone is not registered. The OTP stays valid for the /reset call,
// which is what actually consumes it.
router.post('/forgot-password/verify-otp', ...authLimiter,
  body('phone').matches(/^[6-9]\d{9}$/).withMessage('A valid 10-digit phone number is required.'),
  body('otp').isString().trim().matches(/^\d{6}$/).withMessage('OTP must be a 6-digit number.'),
  validate,
  async (req, res) => {
  const { phone, otp } = req.body;
  const normPhone = whatsapp.normalisePhone(phone.trim());

  try {
    const { valid, reason, expired } = await checkOtp(normPhone, otp, 'password_reset');
    if (!valid) {
      // An unregistered number has no OTP on file. Saying "no OTP found" there
      // would reveal that the number is not registered, so a missing OTP and a
      // wrong OTP are reported identically. Expiry is safe to state plainly —
      // it only ever happens for a number that really did receive an OTP.
      return res.status(400).json({
        message: expired ? reason : 'Incorrect or expired OTP. Please try again.',
      });
    }
    return res.json({ message: 'OTP verified.' });
  } catch (err) {
    logger.error({ err }, 'Forgot password OTP verify error');
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

const forgotPasswordResetValidators = [
  body('phone').matches(/^[6-9]\d{9}$/).withMessage('A valid 10-digit phone number is required.'),
  body('otp').isString().trim().matches(/^\d{6}$/).withMessage('OTP must be a 6-digit number.'),
  body('new_password').isString().notEmpty().withMessage('New password is required.'),
];

// ── Forgot password — verify OTP + reset password ────────────
// POST /auth/forgot-password/reset   body: { phone, otp, new_password }
router.post('/forgot-password/reset', ...authLimiter, forgotPasswordResetValidators, validate, async (req, res) => {
  const { phone, otp, new_password } = req.body;

  const pwdErr = validatePassword(new_password);
  if (pwdErr) return res.status(400).json({ message: pwdErr });

  const normPhone = whatsapp.normalisePhone(phone.trim());

  try {
    const { valid, reason, pendingData } = await verifyAndConsumeOtp(normPhone, otp, 'password_reset');
    if (!valid) return res.status(400).json({ message: reason });

    const hash   = await bcrypt.hash(new_password, 10);
    const result = await db.request()
      .input('phone', pendingData.phone)
      .input('hash',  hash)
      .query('UPDATE students SET password_hash = @hash, updated_by = \'self\' WHERE phone = @phone');

    if (!result.rowsAffected[0]) {
      return res.status(404).json({ message: 'Account not found.' });
    }
    return res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (err) {
    logger.error({ err }, 'Password reset error');
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── College forgot password (admin + staff) ──────────────────
// Identify by email: college admin (colleges.admin_email → college phone) or
// staff (college_users.email → staff phone). OTP is sent to the found phone.
//
// Resolves the account for a given email. Returns { type, id, phone, phoneRaw } or null.
async function resolveCollegeAccount(email) {
  const em = email.trim().toLowerCase();
  // 1) College admin
  const adminRes = await db.request()
    .input('em', mssql.NVarChar, em)
    .query('SELECT id, phone FROM colleges WHERE LOWER(admin_email) = @em');
  if (adminRes.recordset.length) {
    const row = adminRes.recordset[0];
    return { type: 'college_admin', id: row.id, phoneRaw: row.phone };
  }
  // 2) Staff
  const staffRes = await db.request()
    .input('em', mssql.NVarChar, em)
    .query('SELECT id, phone FROM college_users WHERE LOWER(email) = @em AND is_active = 1');
  if (staffRes.recordset.length) {
    const row = staffRes.recordset[0];
    return { type: 'college_staff', id: row.id, phoneRaw: row.phone };
  }
  return null;
}

// POST /auth/forgot-password/college/send-otp   body: { email }
router.post('/forgot-password/college/send-otp', otpLimiter,
  body('email').isEmail().normalizeEmail().withMessage('A valid email address is required.'),
  validate,
  async (req, res) => {
  const { email } = req.body;
  // Generic response either way so we don't reveal which emails exist.
  const generic = { message: 'If this email is registered, an OTP has been sent to the associated phone.' };
  try {
    const account = await resolveCollegeAccount(email);
    if (!account || !account.phoneRaw || !/^[6-9]\d{9}$/.test(String(account.phoneRaw).replace(/\D/g, ''))) {
      // No account, or no usable phone on file — tell the user to contact support/admin.
      if (account && !account.phoneRaw) {
        return res.status(400).json({ message: 'No phone number is on file for this account. Please contact your college admin to set one.' });
      }
      return res.json(generic);
    }

    const rawPhone  = String(account.phoneRaw).replace(/\D/g, '');
    const normPhone = whatsapp.normalisePhone(rawPhone);
    const otp       = String(Math.floor(100000 + Math.random() * 900000));

    await whatsapp.sendOtp(normPhone, otp);
    await saveOtp(normPhone, otp, 'college_password_reset', {
      accountType: account.type, accountId: account.id, email: email.trim().toLowerCase(),
    });

    return res.json({ message: 'OTP sent to the registered WhatsApp number. Valid for 10 minutes.' });
  } catch (err) {
    logger.error({ err }, 'College forgot-password OTP error');
    return res.status(500).json({ message: 'Failed to send OTP. Please try again.' });
  }
});

// POST /auth/forgot-password/college/verify-otp   body: { email, otp }
//
// Gates the OTP screen without consuming the OTP — see the student
// /forgot-password/verify-otp route above for the reasoning.
router.post('/forgot-password/college/verify-otp', ...authLimiter,
  body('email').isEmail().normalizeEmail().withMessage('A valid email address is required.'),
  body('otp').isString().trim().matches(/^\d{6}$/).withMessage('OTP must be a 6-digit number.'),
  validate,
  async (req, res) => {
  const { email, otp } = req.body;
  // Unknown email and wrong OTP must be indistinguishable, or this endpoint
  // becomes a way to discover which emails are registered.
  const genericFail = { message: 'Incorrect or expired OTP. Please try again.' };

  try {
    const account = await resolveCollegeAccount(email);
    if (!account || !account.phoneRaw) return res.status(400).json(genericFail);

    const normPhone = whatsapp.normalisePhone(String(account.phoneRaw).replace(/\D/g, ''));
    const { valid, reason, expired, pendingData } = await checkOtp(normPhone, otp, 'college_password_reset');
    if (!valid) return res.status(400).json(expired ? { message: reason } : genericFail);

    // Same guard the reset route applies: the OTP must belong to THIS account.
    if (!pendingData || pendingData.email !== email.trim().toLowerCase()) {
      return res.status(400).json(genericFail);
    }
    return res.json({ message: 'OTP verified.' });
  } catch (err) {
    logger.error({ err }, 'College forgot-password OTP verify error');
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// POST /auth/forgot-password/college/reset   body: { email, otp, new_password }
router.post('/forgot-password/college/reset', ...authLimiter,
  body('email').isEmail().normalizeEmail().withMessage('A valid email address is required.'),
  body('otp').isString().trim().matches(/^\d{6}$/).withMessage('OTP must be a 6-digit number.'),
  body('new_password').isString().notEmpty().withMessage('New password is required.'),
  validate,
  async (req, res) => {
  const { email, otp, new_password } = req.body;
  const pwdErr = validatePassword(new_password);
  if (pwdErr) return res.status(400).json({ message: pwdErr });

  try {
    const account = await resolveCollegeAccount(email);
    if (!account || !account.phoneRaw) {
      return res.status(400).json({ message: 'Invalid request. Please start the reset again.' });
    }
    const normPhone = whatsapp.normalisePhone(String(account.phoneRaw).replace(/\D/g, ''));

    const { valid, reason, pendingData } = await verifyAndConsumeOtp(normPhone, otp, 'college_password_reset');
    if (!valid) return res.status(400).json({ message: reason });

    // Ensure the OTP was issued for THIS email/account (defence in depth).
    if (!pendingData || pendingData.email !== email.trim().toLowerCase()) {
      return res.status(400).json({ message: 'This OTP does not match the account. Please start again.' });
    }

    const hash = await bcrypt.hash(new_password, 10);
    if (account.type === 'college_admin') {
      await db.request()
        .input('id', mssql.Int, account.id)
        .input('hash', mssql.NVarChar, hash)
        .query('UPDATE colleges SET admin_password_hash = @hash, updated_by = \'self\' WHERE id = @id');
    } else {
      await db.request()
        .input('id', mssql.Int, account.id)
        .input('hash', mssql.NVarChar, hash)
        .query('UPDATE college_users SET password_hash = @hash, updated_by = \'self\' WHERE id = @id');
    }

    return res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (err) {
    logger.error({ err }, 'College password reset error');
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── Refresh token ────────────────────────────────────────────
// Reads the existing httpOnly cookie OR Authorization: Bearer header, verifies it,
// and issues a fresh one (both cookie and body).
router.post('/refresh', (req, res) => {
  let token = req.cookies?.auth_token;
  if (!token) {
    const header = req.headers['authorization'];
    if (header && header.startsWith('Bearer ')) token = header.slice(7);
  }
  if (!token) return res.status(401).json({ message: 'No session found.' });

  const clearAndReject = (msg) => {
    res.clearCookie('auth_token', { ...COOKIE_BASE });
    return res.status(401).json({ message: msg });
  };

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // Strip JWT metadata fields before re-signing
    const { iat, exp, sxp, ...claims } = payload;

    // Absolute daily deadline: a refresh may NEVER extend a session past `sxp`.
    // Once that moment passes, the user must log in again.
    const nowSec = Math.floor(Date.now() / 1000);
    if (sxp && nowSec >= sxp) {
      return clearAndReject('Your session has expired for the day. Please log in again.');
    }

    // Re-issue a token that still expires at the SAME deadline (not a fresh window).
    const deadline = sxp ? new Date(sxp * 1000) : nextExpiryDate();
    const secs = Math.max(60, Math.floor((deadline.getTime() - Date.now()) / 1000));
    const newToken = jwt.sign(
      { ...claims, sxp: Math.floor(deadline.getTime() / 1000) },
      JWT_SECRET,
      { expiresIn: secs },
    );
    setAuthCookie(res, newToken, deadline);
    return res.json({ message: 'Session refreshed.', token: newToken, expires_at: deadline.toISOString() });
  } catch {
    return clearAndReject('Session expired. Please log in again.');
  }
});

// ── Logout ──────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('auth_token', { ...COOKIE_BASE });
  return res.json({ message: 'Logged out.' });
});

module.exports = router;
