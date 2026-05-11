/**
 * auth.js — Login endpoints for students and college admins.
 * POST /auth/login/student
 * POST /auth/login/college
 */

const express   = require('express');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const router    = express.Router();
const db        = require('./db');
const whatsapp  = require('../services/whatsapp');
const mssql     = require('mssql');

// ── DB OTP helpers ───────────────────────────────────────────

async function saveOtp(normPhone, otp, purpose, pendingData) {
  const hash      = await bcrypt.hash(otp, 8);           // lighter cost — OTPs are short-lived
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  // Invalidate any previous unused OTP for same phone+purpose
  await db.request()
    .input('phone',   mssql.NVarChar, normPhone)
    .input('purpose', mssql.NVarChar, purpose)
    .query(`UPDATE otp_store SET used = 1 WHERE phone = @phone AND purpose = @purpose AND used = 0`);
  await db.request()
    .input('phone',       mssql.NVarChar,  normPhone)
    .input('hash',        mssql.NVarChar,  hash)
    .input('purpose',     mssql.NVarChar,  purpose)
    .input('pendingData', mssql.NVarChar,  pendingData ? JSON.stringify(pendingData) : null)
    .input('expiresAt',   mssql.DateTime2, expiresAt)
    .query(`
      INSERT INTO otp_store (phone, otp_hash, purpose, pending_data, expires_at)
      VALUES (@phone, @hash, @purpose, @pendingData, @expiresAt)
    `);
}

async function verifyAndConsumeOtp(normPhone, otp, purpose) {
  const result = await db.request()
    .input('phone',   mssql.NVarChar, normPhone)
    .input('purpose', mssql.NVarChar, purpose)
    .query(`
      SELECT TOP 1 id, otp_hash, pending_data, expires_at
      FROM otp_store
      WHERE phone = @phone AND purpose = @purpose AND used = 0
      ORDER BY created_at DESC
    `);

  const row = result.recordset[0];
  if (!row) return { valid: false, reason: 'No OTP found for this number. Please request a new one.' };
  if (new Date() > new Date(row.expires_at)) {
    await db.request().input('id', mssql.Int, row.id).query('UPDATE otp_store SET used = 1 WHERE id = @id');
    return { valid: false, reason: 'OTP has expired. Please request a new one.' };
  }

  const match = await bcrypt.compare(String(otp).trim(), row.otp_hash);
  if (!match) return { valid: false, reason: 'Incorrect OTP. Please try again.' };

  // Mark used
  await db.request().input('id', mssql.Int, row.id).query('UPDATE otp_store SET used = 1 WHERE id = @id');
  return { valid: true, pendingData: row.pending_data ? JSON.parse(row.pending_data) : null };
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_prod';

// 10 attempts per 15 minutes per IP for login endpoints
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again after 15 minutes.' },
});

// 5 registrations per hour per IP to prevent spam accounts
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many registration attempts. Please try again after an hour.' },
});

// ── Student login ───────────────────────────────────────────
router.post('/login/student', loginLimiter, async (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ message: 'Phone number and password are required.' });
  }

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

    const token = jwt.sign({ id: student.id, role: 'student' }, JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      message: 'Login successful',
      role: 'student',
      token,
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
    console.error('Student login error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── College login (admin OR staff — single endpoint) ────────
router.post('/login/college', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    // 1. Try college admin first
    const adminResult = await db.request()
      .input('email', email.trim().toLowerCase())
      .query('SELECT id, name, admin_email, admin_password_hash, city, college_code FROM colleges WHERE admin_email = @email');

    if (adminResult.recordset.length > 0) {
      const college = adminResult.recordset[0];
      const match   = await bcrypt.compare(password, college.admin_password_hash);
      if (!match) return res.status(401).json({ message: 'Invalid email or password.' });

      const token = jwt.sign({ id: college.id, role: 'college', is_staff: false }, JWT_SECRET, { expiresIn: '7d' });

      return res.json({
        message: 'Login successful',
        role: 'college',
        token,
        user: {
          id:           college.id,
          name:         college.name,
          email:        college.admin_email,
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
               c.name AS college_name, c.college_code,
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

    const token = jwt.sign(
      { id: staff.college_id, role: 'college', is_staff: true, staff_id: staff.id, permissions, nav_visibility },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      message: 'Login successful',
      role: 'college',
      token,
      user: {
        id:           staff.college_id,
        name:         staff.college_name,
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
    console.error('College login error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── Admin login ─────────────────────────────────────────────
router.post('/login/admin', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }
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
    const token = jwt.sign({ id: admin.id, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({
      message: 'Login successful',
      role: 'admin',
      token,
      user: { id: admin.id, name: admin.name, email: admin.email },
    });
  } catch (err) {
    console.error('Admin login error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── College staff (sub-user) login ──────────────────────────
router.post('/login/college-user', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }
  try {
    const result = await db.request()
      .input('email', email.trim().toLowerCase())
      .query(`
        SELECT u.id, u.full_name, u.email, u.password_hash, u.is_active,
               u.college_id, u.role_id,
               c.name AS college_name, c.college_code,
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

    const token = jwt.sign(
      { id: user.college_id, role: 'college', is_staff: true, staff_id: user.id, permissions, nav_visibility },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      message: 'Login successful',
      role: 'college',
      token,
      user: {
        id:           user.college_id,
        name:         user.college_name,
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
    console.error('College-user login error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── OTP rate limiter: 3 sends per 10 min per IP ─────────────
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many OTP requests. Please wait 10 minutes.' },
});

// ── Send OTP for phone verification ─────────────────────────
// POST /auth/otp/send   body: { phone, ...registrationFields }
router.post('/otp/send', otpLimiter, async (req, res) => {
  const { phone, full_name, email, password, confirm_password, city, category } = req.body;

  if (!full_name || !email || !password || !phone) {
    return res.status(400).json({ message: 'Name, email, password and phone are required.' });
  }
  if (!/^[6-9]\d{9}$/.test(phone.trim())) {
    return res.status(400).json({ message: 'Phone number must be 10 digits starting with 6–9.' });
  }
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
    console.error('OTP send error:', err);
    return res.status(500).json({ message: err.message || 'Failed to send OTP. Please try again.' });
  }
});

// ── Verify OTP and complete registration ─────────────────────
// POST /auth/otp/verify   body: { phone, otp }
router.post('/otp/verify', async (req, res) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ message: 'Phone and OTP are required.' });
  }

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
        INSERT INTO students (full_name, email, password_hash, phone, city, category)
        OUTPUT INSERTED.id, INSERTED.full_name, INSERTED.email
        VALUES (@full_name, @email, @hash, @phone, @city, @category)
      `);

    const newStudent = result.recordset[0];
    return res.status(201).json({
      message: 'Phone verified and registration successful.',
      role: 'student',
      user: { id: newStudent.id, name: newStudent.full_name, email: newStudent.email },
    });
  } catch (err) {
    console.error('Registration after OTP verify error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── Student registration ────────────────────────────────────
router.post('/register/student', registerLimiter, async (req, res) => {
  const { full_name, email, password, phone, dob, gender, address, city, category } = req.body;

  if (!full_name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required.' });
  }

  try {
    const exists = await db.request()
      .input('email', email)
      .input('phone', phone ? phone.trim() : null)
      .query('SELECT id, email, phone FROM students WHERE email = @email OR (phone IS NOT NULL AND phone = @phone)');

    if (exists.recordset.length > 0) {
      const dup = exists.recordset[0];
      if (dup.email === email) {
        return res.status(409).json({ message: 'An account with this email already exists.' });
      }
      return res.status(409).json({ message: 'An account with this phone number already exists.' });
    }

    const hash = await bcrypt.hash(password, 10);

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
        INSERT INTO students (full_name, email, password_hash, phone, dob, gender, address, city, category)
        OUTPUT INSERTED.id, INSERTED.full_name, INSERTED.email
        VALUES (@full_name, @email, @hash, @phone, @dob, @gender, @address, @city, @category)
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
    console.error('Student registration error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── Forgot password — send OTP ───────────────────────────────
// POST /auth/forgot-password/send-otp   body: { phone }
router.post('/forgot-password/send-otp', otpLimiter, async (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^[6-9]\d{9}$/.test(phone.trim())) {
    return res.status(400).json({ message: 'A valid 10-digit phone number is required.' });
  }

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
    console.error('Forgot password OTP error:', err);
    return res.status(500).json({ message: err.message || 'Failed to send OTP. Please try again.' });
  }
});

// ── Forgot password — verify OTP + reset password ────────────
// POST /auth/forgot-password/reset   body: { phone, otp, new_password }
router.post('/forgot-password/reset', async (req, res) => {
  const { phone, otp, new_password } = req.body;

  if (!phone || !otp || !new_password) {
    return res.status(400).json({ message: 'Phone, OTP and new password are required.' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });
  }

  const normPhone = whatsapp.normalisePhone(phone.trim());

  try {
    const { valid, reason, pendingData } = await verifyAndConsumeOtp(normPhone, otp, 'password_reset');
    if (!valid) return res.status(400).json({ message: reason });

    const hash   = await bcrypt.hash(new_password, 10);
    const result = await db.request()
      .input('phone', pendingData.phone)
      .input('hash',  hash)
      .query('UPDATE students SET password_hash = @hash WHERE phone = @phone');

    if (!result.rowsAffected[0]) {
      return res.status(404).json({ message: 'Account not found.' });
    }
    return res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (err) {
    console.error('Password reset error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

module.exports = router;
