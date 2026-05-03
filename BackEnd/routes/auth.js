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
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const result = await db.request()
      .input('email', email)
      .query('SELECT id, full_name, email, password_hash, phone, city, category FROM students WHERE email = @email');

    if (result.recordset.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const student = result.recordset[0];
    const match   = await bcrypt.compare(password, student.password_hash);

    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password.' });
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

// ── College admin login ─────────────────────────────────────
router.post('/login/college', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const result = await db.request()
      .input('email', email)
      .query('SELECT id, name, admin_email, admin_password_hash, city FROM colleges WHERE admin_email = @email');

    if (result.recordset.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const college = result.recordset[0];
    const match   = await bcrypt.compare(password, college.admin_password_hash);

    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    return res.json({
      message: 'Login successful',
      role: 'college',
      user: {
        id:    college.id,
        name:  college.name,
        email: college.admin_email,
        city:  college.city,
      },
    });
  } catch (err) {
    console.error('College login error:', err);
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
