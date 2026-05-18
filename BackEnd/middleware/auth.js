const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

if (!process.env.JWT_SECRET) {
  logger.error('FATAL: JWT_SECRET environment variable is not set. Refusing to start.');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

// Verify JWT and attach req.user.
// Reads from httpOnly cookie first; falls back to Authorization header for
// API clients (e.g. Postman, server-to-server calls).
function authenticate(req, res, next) {
  let token = req.cookies?.auth_token;

  if (!token) {
    const header = req.headers['authorization'];
    if (header && header.startsWith('Bearer ')) {
      token = header.slice(7);
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

// Require a specific permission for college staff.
// Main college admin (is_staff=false) always passes.
// Staff must have the permission key set to true in their JWT permissions.
function requirePerm(perm) {
  return (req, res, next) => {
    const u = req.user;
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    // Super-admin passes all permission checks
    if (u.role === 'admin') return next();
    if (u.role !== 'college') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    if (!u.is_staff) return next(); // main college admin always allowed
    if (u.permissions && u.permissions[perm] !== undefined) return next(); // read or write access
    return res.status(403).json({ success: false, message: `Permission denied: ${perm}` });
  };
}

// Require the caller is a college (admin or staff) and their college_id matches the :collegeId param.
// Super-admins (role === 'admin') can access any college's data.
function requireCollegeAccess(req, res, next) {
  const u = req.user;
  if (!u) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  // Super-admin can access any college
  if (u.role === 'admin') return next();
  if (u.role !== 'college') {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }
  const paramCollegeId = parseInt(req.params.collegeId);
  if (paramCollegeId && u.id !== paramCollegeId) {
    return res.status(403).json({ success: false, message: 'Access denied to this college.' });
  }
  next();
}

// Require student role
function requireStudent(req, res, next) {
  if (!req.user || req.user.role !== 'student') {
    return res.status(403).json({ success: false, message: 'Student access required.' });
  }
  next();
}

// Require admin role (the super-admin, not college staff)
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }
  next();
}

// Require write access for a permission (can_write = true).
// Use this on mutating routes (approve, reject, save, etc.) when the same
// permission also has a read-only variant.
function requireWrite(perm) {
  return (req, res, next) => {
    const u = req.user;
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    if (u.role === 'admin') return next();
    if (u.role !== 'college') return res.status(403).json({ success: false, message: 'Access denied.' });
    if (!u.is_staff) return next(); // main college admin always allowed
    if (u.permissions && u.permissions[perm] === true) return next();
    return res.status(403).json({ success: false, message: `Write permission denied: ${perm}` });
  };
}

module.exports = { authenticate, requirePerm, requireWrite, requireCollegeAccess, requireStudent, requireAdmin };
