/**
 * auth.js — Login endpoints for students and college admins.
 * POST /auth/login/student
 * POST /auth/login/college
 */

const express = require('express');
const bcrypt  = require('bcryptjs');
const router  = express.Router();
const db      = require('./db');

// ── Student login ───────────────────────────────────────────
router.post('/login/student', async (req, res) => {
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

    return res.json({
      message: 'Login successful',
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
    console.error('Student login error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── College login (admin OR staff — single endpoint) ────────
router.post('/login/college', async (req, res) => {
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

      return res.json({
        message: 'Login successful',
        role: 'college',
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

    return res.json({
      message: 'Login successful',
      role: 'college',
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
router.post('/login/admin', async (req, res) => {
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
    return res.json({
      message: 'Login successful',
      role: 'admin',
      user: { id: admin.id, name: admin.name, email: admin.email },
    });
  } catch (err) {
    console.error('Admin login error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── College staff (sub-user) login ──────────────────────────
router.post('/login/college-user', async (req, res) => {
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

    return res.json({
      message: 'Login successful',
      role: 'college',
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

// ── Student registration ────────────────────────────────────
router.post('/register/student', async (req, res) => {
  const { full_name, email, password, phone, dob, gender, address, city, category } = req.body;

  if (!full_name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required.' });
  }

  try {
    const exists = await db.request()
      .input('email', email)
      .query('SELECT id FROM students WHERE email = @email');

    if (exists.recordset.length > 0) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
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

module.exports = router;
