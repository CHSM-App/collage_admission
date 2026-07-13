/**
 * college_users.js — Admin endpoints for managing college staff roles & users.
 *
 * Roles:
 *   GET    /admin/colleges                              — list all colleges
 *   GET    /admin/colleges/:collegeId/roles             — list roles + permissions + users
 *   POST   /admin/colleges/:collegeId/roles             — create a role with permissions
 *   PUT    /admin/colleges/:collegeId/roles/:roleId     — update role name + permissions
 *   DELETE /admin/colleges/:collegeId/roles/:roleId     — delete role (only if no users)
 *
 * Users:
 *   GET    /admin/colleges/:collegeId/users             — list staff users
 *   POST   /admin/colleges/:collegeId/users             — create staff user
 *   PUT    /admin/colleges/:collegeId/users/:userId     — update user (name/email/role/active)
 *   DELETE /admin/colleges/:collegeId/users/:userId     — delete user
 *
 * Auth:
 *   POST   /auth/login/college-user                    — staff login (returns permissions)
 */

const express = require('express');
const bcrypt  = require('bcryptjs');
const router  = express.Router();
const db      = require('./db');
const mssql   = require('mssql');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { parsePage, paginateQuery, paginatedResponse } = require('../middleware/paginate');
const logger  = require('../config/logger');
const { presetForType, isValidType, COLLEGE_TYPES } = require('../constants/collegePresets');

// Rejects the shapes users actually typo: no @, nothing before/after the @, a dot
// straight after the @ or straight before it, consecutive dots, and a missing or
// too-short TLD ("rahulgmail.@com", "a@b", "a@b.c" all fail).
const EMAIL_RE = /^[^\s@.]+(\.[^\s@.]+)*@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i;
const isValidEmail = (v) => EMAIL_RE.test(String(v || '').trim());

const ALL_PERMISSIONS = [
  'submit_application',
  'review_application',
  'edit_application',
  'upload_documents',
  'review_documents',
  'assign_subjects',
  'collect_fees',
  'manage_admission_periods',
  'masters',
  'certificates',
];

const NAV_ITEMS = [
  'overview',
  'periods',
  'inbox',
  'add-application',
  'rollnumbers',
  'fee-receipts',
  'master-faculty',
  'master-class',
  'master-bank',
  'master-course',
  'master-group',
  'master-division',
  'master-fees',
  'master-documents',
  'certificates',
];

// ── PUT /admin/colleges/:id ──────────────────────────────────
router.put('/colleges/:id', authenticate, requireAdmin, async (req, res) => {
  const { application_fee, is_enabled, college_type } = req.body;
  const id = parseInt(req.params.id);

  // Change college type — overwrites features_config with that type's preset
  if (college_type !== undefined) {
    if (!isValidType(college_type)) {
      return res.status(400).json({ success: false, message: `college_type must be one of: ${COLLEGE_TYPES.join(', ')}.` });
    }
    try {
      await db.request()
        .input('ctype',    mssql.NVarChar, college_type)
        .input('features', mssql.NVarChar, JSON.stringify(presetForType(college_type)))
        .input('id',       mssql.Int,      id)
        .input('actor',    mssql.NVarChar, String(req.user.id))
        .query(`UPDATE colleges SET college_type = @ctype, features_config = @features, updated_by = @actor WHERE id = @id`);
      return res.json({ success: true, message: 'College type updated.' });
    } catch (err) {
      logger.error({ err });
      return res.status(500).json({ success: false, message: 'Server error.' });
    }
  }

  // Toggle enabled/disabled
  if (is_enabled !== undefined) {
    const enabled = is_enabled ? 1 : 0;
    try {
      await db.request()
        .input('enabled', mssql.Bit,      enabled)
        .input('id',      mssql.Int,      id)
        .input('actor',   mssql.NVarChar, String(req.user.id))
        .query(`UPDATE colleges SET is_enabled = @enabled, updated_by = @actor WHERE id = @id`);
      return res.json({ success: true, message: enabled ? 'College enabled.' : 'College disabled.' });
    } catch (err) {
      logger.error({ err });
      return res.status(500).json({ success: false, message: 'Server error.' });
    }
  }

  // Update the onboarding profile (name, code, contact, address).
  // Only the fields actually sent are changed; the rest are left alone.
  const PROFILE_FIELDS = ['name', 'college_code', 'city', 'address', 'phone', 'email'];
  const profile = {};
  for (const f of PROFILE_FIELDS) {
    if (req.body[f] !== undefined) profile[f] = req.body[f];
  }

  if (Object.keys(profile).length > 0) {
    if (profile.name !== undefined && !String(profile.name).trim()) {
      return res.status(400).json({ success: false, message: 'College name cannot be empty.' });
    }
    if (profile.college_code !== undefined && !String(profile.college_code).trim()) {
      return res.status(400).json({ success: false, message: 'College code cannot be empty.' });
    }
    if (profile.city !== undefined && !String(profile.city).trim()) {
      return res.status(400).json({ success: false, message: 'City cannot be empty.' });
    }
    if (profile.email !== undefined && !isValidEmail(profile.email)) {
      return res.status(400).json({ success: false, message: 'Enter a valid college email address.' });
    }
    if (profile.phone) {
      const cleanPhone = String(profile.phone).replace(/\D/g, '');
      if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
        return res.status(400).json({ success: false, message: 'Phone must be a 10-digit number starting with 6–9.' });
      }
      profile.phone = cleanPhone;
    }

    try {
      const r = db.request()
        .input('id',    mssql.Int,      id)
        .input('actor', mssql.NVarChar, String(req.user.id));
      const sets = [];
      for (const [f, v] of Object.entries(profile)) {
        const val = typeof v === 'string' ? v.trim() : v;
        r.input(f, mssql.NVarChar, val === '' ? null : val);
        sets.push(`${f} = @${f}`);
      }
      await r.query(
        `UPDATE colleges SET ${sets.join(', ')}, updated_by = @actor WHERE id = @id`);
      return res.json({ success: true, message: 'College details updated.' });
    } catch (err) {
      if (err.number === 2627 || err.number === 2601) {
        return res.status(409).json({ success: false, message: 'That college code or email is already in use.' });
      }
      logger.error({ err });
      return res.status(500).json({ success: false, message: 'Server error.' });
    }
  }

  // Update application fee
  if (application_fee === undefined || application_fee === null || application_fee === '') {
    return res.status(400).json({ success: false, message: 'application_fee is required.' });
  }
  const fee = parseFloat(application_fee);
  if (isNaN(fee) || fee < 0) {
    return res.status(400).json({ success: false, message: 'application_fee must be a non-negative number.' });
  }
  try {
    await db.request()
      .input('fee',   mssql.Decimal,  fee)
      .input('id',    mssql.Int,      id)
      .input('actor', mssql.NVarChar, String(req.user.id))
      .query(`UPDATE colleges SET application_fee = @fee, updated_by = @actor WHERE id = @id`);
    return res.json({ success: true, message: 'Application fee updated.' });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /admin/colleges/:id/features ────────────────────────
router.get('/colleges/:id/features', authenticate, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const result = await db.request()
      .input('id', mssql.Int, id)
      .query(`SELECT features_config, college_type FROM colleges WHERE id = @id`);
    if (!result.recordset.length)
      return res.status(404).json({ success: false, message: 'College not found.' });

    const raw = result.recordset[0].features_config;
    const features = raw ? JSON.parse(raw) : null;
    return res.json({ success: true, data: features, college_type: result.recordset[0].college_type });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /admin/colleges ──────────────────────────────────────
router.get('/colleges', authenticate, requireAdmin, async (req, res) => {
  const { page, limit, offset } = parsePage(req.query);
  try {
    const countRes = await db.request().query('SELECT COUNT(*) AS total FROM colleges');
    const total    = countRes.recordset[0].total;

    const dataRes = await db.request().query(`
      SELECT c.id, c.name, c.city, c.address, c.phone, c.email, c.college_code,
             c.application_fee, c.is_enabled, c.college_type,
             (SELECT COUNT(*) FROM college_users cu WHERE cu.college_id = c.id AND cu.is_active = 1) AS active_users,
             (SELECT COUNT(*) FROM college_roles cr WHERE cr.college_id = c.id) AS roles_count
      FROM colleges c
      ORDER BY c.name
      ${paginateQuery(offset, limit)}
    `);

    return res.json(paginatedResponse(dataRes.recordset, total, page, limit));
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /admin/colleges/:collegeId/roles ─────────────────────
router.get('/colleges/:collegeId/roles', authenticate, requireAdmin, async (req, res) => {
  const collegeId = parseInt(req.params.collegeId);
  try {
    const rolesRes = await db.request()
      .input('cid', mssql.Int, collegeId)
      .query(`
        SELECT r.id, r.role_name,
          (SELECT p.permission, p.can_write
           FROM college_role_permissions p
           WHERE p.role_id = r.id
           FOR JSON PATH) AS permissions_json,
          (SELECT u.id, u.full_name, u.email, u.phone, u.is_active
           FROM college_users u
           WHERE u.role_id = r.id
           FOR JSON PATH) AS users_json
        FROM college_roles r
        WHERE r.college_id = @cid
        ORDER BY r.role_name
      `);

    const roles = rolesRes.recordset.map(r => ({
      ...r,
      permissions: r.permissions_json ? JSON.parse(r.permissions_json) : [],
      users:       r.users_json       ? JSON.parse(r.users_json)       : [],
      permissions_json: undefined,
      users_json:       undefined,
    }));

    return res.json({ success: true, data: roles });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /admin/colleges/:collegeId/roles ────────────────────
// body: { role_name, permissions: { submit_application: true, ... }, nav_visibility: { inbox: true, ... } }
router.post('/colleges/:collegeId/roles', authenticate, requireAdmin, async (req, res) => {
  const collegeId = parseInt(req.params.collegeId);
  const { role_name, permissions = {}, nav_visibility = {} } = req.body;

  if (!role_name?.trim()) {
    return res.status(400).json({ success: false, message: 'role_name is required.' });
  }

  try {
    const roleRes = await db.request()
      .input('cid',   mssql.Int,      collegeId)
      .input('name',  mssql.NVarChar, role_name.trim())
      .input('actor', mssql.NVarChar, String(req.user.id))
      .query(`
        DECLARE @t TABLE (id INT, role_name NVARCHAR(100));
        INSERT INTO college_roles (college_id, role_name, created_by)
        OUTPUT INSERTED.id, INSERTED.role_name INTO @t
        VALUES (@cid, @name, @actor);
        SELECT id, role_name FROM @t;
      `);

    const roleId = roleRes.recordset[0].id;

    const actor = String(req.user.id);
    // Insert permissions
    for (const perm of ALL_PERMISSIONS) {
      const canWrite = permissions[perm] ? 1 : 0;
      await db.request()
        .input('rid',   mssql.Int,      roleId)
        .input('perm',  mssql.NVarChar, perm)
        .input('write', mssql.Bit,      canWrite)
        .input('actor', mssql.NVarChar, actor)
        .query(`INSERT INTO college_role_permissions (role_id, permission, can_write, created_by) VALUES (@rid, @perm, @write, @actor)`);
    }

    // Insert nav visibility
    for (const key of NAV_ITEMS) {
      const visible = nav_visibility[key] === true ? 1 : 0;
      await db.request()
        .input('rid',   mssql.Int,      roleId)
        .input('perm',  mssql.NVarChar, `nav:${key}`)
        .input('write', mssql.Bit,      visible)
        .input('actor', mssql.NVarChar, actor)
        .query(`INSERT INTO college_role_permissions (role_id, permission, can_write, created_by) VALUES (@rid, @perm, @write, @actor)`);
    }

    return res.status(201).json({ success: true, data: { id: roleId, role_name: role_name.trim() } });
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
      return res.status(409).json({ success: false, message: 'A role with this name already exists for this college.' });
    }
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /admin/colleges/:collegeId/roles/:roleId ─────────────
router.put('/colleges/:collegeId/roles/:roleId', authenticate, requireAdmin, async (req, res) => {
  const roleId = parseInt(req.params.roleId);
  const { role_name, permissions = {}, nav_visibility = {} } = req.body;

  try {
    if (role_name?.trim()) {
      await db.request()
        .input('id',    mssql.Int,      roleId)
        .input('name',  mssql.NVarChar, role_name.trim())
        .input('actor', mssql.NVarChar, String(req.user.id))
        .query(`UPDATE college_roles SET role_name = @name, updated_by = @actor WHERE id = @id`);
    }

    const actor = String(req.user.id);
    // Upsert each permission
    for (const perm of ALL_PERMISSIONS) {
      const canWrite = permissions[perm] ? 1 : 0;
      await db.request()
        .input('rid',   mssql.Int,      roleId)
        .input('perm',  mssql.NVarChar, perm)
        .input('write', mssql.Bit,      canWrite)
        .input('actor', mssql.NVarChar, actor)
        .query(`
          MERGE college_role_permissions AS target
          USING (SELECT @rid AS role_id, @perm AS permission) AS src
            ON target.role_id = src.role_id AND target.permission = src.permission
          WHEN MATCHED THEN UPDATE SET can_write = @write, updated_by = @actor
          WHEN NOT MATCHED THEN INSERT (role_id, permission, can_write, created_by) VALUES (@rid, @perm, @write, @actor);
        `);
    }

    // Upsert nav visibility
    for (const key of NAV_ITEMS) {
      const visible = nav_visibility[key] === true ? 1 : 0;
      await db.request()
        .input('rid',   mssql.Int,      roleId)
        .input('perm',  mssql.NVarChar, `nav:${key}`)
        .input('write', mssql.Bit,      visible)
        .input('actor', mssql.NVarChar, actor)
        .query(`
          MERGE college_role_permissions AS target
          USING (SELECT @rid AS role_id, @perm AS permission) AS src
            ON target.role_id = src.role_id AND target.permission = src.permission
          WHEN MATCHED THEN UPDATE SET can_write = @write, updated_by = @actor
          WHEN NOT MATCHED THEN INSERT (role_id, permission, can_write, created_by) VALUES (@rid, @perm, @write, @actor);
        `);
    }

    return res.json({ success: true, message: 'Role updated.' });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── DELETE /admin/colleges/:collegeId/roles/:roleId ──────────
router.delete('/colleges/:collegeId/roles/:roleId', authenticate, requireAdmin, async (req, res) => {
  const roleId = parseInt(req.params.roleId);
  try {
    const hasUsers = await db.request()
      .input('rid', mssql.Int, roleId)
      .query(`SELECT COUNT(*) AS cnt FROM college_users WHERE role_id = @rid`);

    if (hasUsers.recordset[0].cnt > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete role while users are assigned to it.' });
    }

    await db.request()
      .input('rid', mssql.Int, roleId)
      .query(`DELETE FROM college_roles WHERE id = @rid`);

    return res.json({ success: true, message: 'Role deleted.' });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /admin/colleges/:collegeId/users ─────────────────────
router.get('/colleges/:collegeId/users', authenticate, requireAdmin, async (req, res) => {
  const collegeId = parseInt(req.params.collegeId);
  const { page, limit, offset } = parsePage(req.query);
  try {
    const countRes = await db.request()
      .input('cid', mssql.Int, collegeId)
      .query('SELECT COUNT(*) AS total FROM college_users WHERE college_id = @cid');
    const total = countRes.recordset[0].total;

    const dataRes = await db.request()
      .input('cid', mssql.Int, collegeId)
      .query(`
        SELECT u.id, u.full_name, u.email, u.phone, u.is_active, u.created_at,
               r.id AS role_id, r.role_name
        FROM college_users u
        JOIN college_roles r ON r.id = u.role_id
        WHERE u.college_id = @cid
        ORDER BY u.full_name
        ${paginateQuery(offset, limit)}
      `);

    return res.json(paginatedResponse(dataRes.recordset, total, page, limit));
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /admin/colleges/:collegeId/users ────────────────────
// body: { full_name, email, password, role_id }
router.post('/colleges/:collegeId/users', authenticate, requireAdmin, async (req, res) => {
  const collegeId = parseInt(req.params.collegeId);
  const { full_name, email, password, role_id, phone } = req.body;

  if (!full_name?.trim() || !email?.trim() || !password || !role_id) {
    return res.status(400).json({ success: false, message: 'full_name, email, password and role_id are required.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
  }
  const cleanPhone = phone ? String(phone).replace(/\D/g, '') : null;
  if (cleanPhone && !/^[6-9]\d{9}$/.test(cleanPhone)) {
    return res.status(400).json({ success: false, message: 'Phone must be a 10-digit number starting with 6–9.' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await db.request()
      .input('cid',   mssql.Int,      collegeId)
      .input('rid',   mssql.Int,      parseInt(role_id))
      .input('name',  mssql.NVarChar, full_name.trim())
      .input('em',    mssql.NVarChar, email.trim().toLowerCase())
      .input('phone', mssql.NVarChar, cleanPhone)
      .input('hash',  mssql.NVarChar, hash)
      .input('actor', mssql.NVarChar, String(req.user.id))
      .query(`
        DECLARE @t TABLE (id INT, full_name NVARCHAR(150), email NVARCHAR(150));
        INSERT INTO college_users (college_id, role_id, full_name, email, phone, password_hash, created_by)
        OUTPUT INSERTED.id, INSERTED.full_name, INSERTED.email INTO @t
        VALUES (@cid, @rid, @name, @em, @phone, @hash, @actor);
        SELECT id, full_name, email FROM @t;
      `);

    return res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
      return res.status(409).json({ success: false, message: 'A user with this email already exists.' });
    }
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /admin/colleges/:collegeId/users/:userId ─────────────
router.put('/colleges/:collegeId/users/:userId', authenticate, requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.userId);
  const { full_name, email, password, role_id, is_active, phone } = req.body;
  const cleanPhone = phone !== undefined ? (phone ? String(phone).replace(/\D/g, '') : null) : undefined;
  if (cleanPhone && !/^[6-9]\d{9}$/.test(cleanPhone)) {
    return res.status(400).json({ success: false, message: 'Phone must be a 10-digit number starting with 6–9.' });
  }
  // Only validate the fields that were actually sent — a partial update such as
  // toggling `is_active` must not be rejected for omitting an email or password.
  if (email !== undefined && !isValidEmail(email)) {
    return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
  }
  if (password && String(password).length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
  }
  try {
    let hashClause = '';
    const req2 = db.request()
      .input('id',    mssql.Int,      userId)
      .input('name',  mssql.NVarChar, full_name  || null)
      .input('em',    mssql.NVarChar, email?.trim().toLowerCase() || null)
      .input('rid',   mssql.Int,      role_id    ? parseInt(role_id) : null)
      .input('act',   mssql.Bit,      is_active !== undefined ? (is_active ? 1 : 0) : null)
      // phone: undefined = not provided (keep); null = explicitly cleared; string = set
      .input('phone', mssql.NVarChar, cleanPhone === undefined ? null : cleanPhone)
      .input('phoneProvided', mssql.Bit, cleanPhone === undefined ? 0 : 1)
      .input('actor', mssql.NVarChar, String(req.user.id));

    if (password) {
      const hash = await bcrypt.hash(password, 10);
      req2.input('hash', mssql.NVarChar, hash);
      hashClause = ', password_hash = @hash';
    }

    await req2.query(`
      UPDATE college_users SET
        full_name  = COALESCE(@name, full_name),
        email      = COALESCE(@em,   email),
        role_id    = COALESCE(@rid,  role_id),
        is_active  = COALESCE(@act,  is_active),
        phone      = CASE WHEN @phoneProvided = 1 THEN @phone ELSE phone END,
        updated_by = @actor
        ${hashClause}
      WHERE id = @id
    `);

    return res.json({ success: true, message: 'User updated.' });
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
      return res.status(409).json({ success: false, message: 'A user with this email already exists.' });
    }
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── DELETE /admin/colleges/:collegeId/users/:userId ──────────
router.delete('/colleges/:collegeId/users/:userId', authenticate, requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.userId);
  try {
    await db.request()
      .input('id', mssql.Int, userId)
      .query(`DELETE FROM college_users WHERE id = @id`);
    return res.json({ success: true, message: 'User deleted.' });
  } catch (err) {
    logger.error({ err });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
