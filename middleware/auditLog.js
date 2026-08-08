/**
 * auditLog.js — Structured audit logging for sensitive routes.
 *
 * Logs: method, path, authenticated user (id + role), IP, and response status.
 * Attach with: router.use(auditLog) on any router that needs an audit trail.
 */

const logger = require('../config/logger');

function auditLog(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const u = req.user;
    logger.info({
      audit:  true,
      method: req.method,
      path:   req.path,
      status: res.statusCode,
      ms:     Date.now() - start,
      userId: u?.id   ?? null,
      role:   u?.role ?? null,
      ip:     req.ip,
    }, 'audit');
  });

  next();
}

module.exports = auditLog;
