/**
 * otpCleanup.js — Scheduled job to delete expired/used OTP records.
 *
 * Runs every hour. Removes rows from otp_store that are either:
 *   - already used (used = 1), or
 *   - expired (expires_at < NOW)
 *
 * Prevents the table from growing unbounded in production.
 */

const cron   = require('node-cron');
const db     = require('../routes/db');
const logger = require('../config/logger');

function startOtpCleanup() {
  // Run at minute 0 of every hour
  cron.schedule('0 * * * *', async () => {
    try {
      const result = await db.request().query(`
        DELETE FROM otp_store
        WHERE used = 1 OR expires_at < GETDATE()
      `);
      const deleted = result.rowsAffected?.[0] ?? 0;
      if (deleted > 0) {
        logger.info({ deleted }, 'OTP cleanup: removed expired/used records');
      }
    } catch (err) {
      logger.warn({ err }, 'OTP cleanup job failed');
    }
  });

  logger.info('OTP cleanup job scheduled (hourly)');
}

module.exports = { startOtpCleanup };
