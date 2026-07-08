'use strict';

const bcrypt = require('bcryptjs');
const mssql  = require('mssql');
const db     = require('../routes/db');

/**
 * Save an OTP to otp_store, invalidating any previous unused OTP for the
 * same phone + purpose combination first.
 *
 * @param {string} normPhone   - Normalised E.164 phone (e.g. "919876543210")
 * @param {string} otp         - Plain-text 6-digit OTP
 * @param {string} purpose     - 'registration' | 'password_reset' | 'student_transfer'
 * @param {object} pendingData - Any extra data to store (JSON-serialised)
 */
async function saveOtp(normPhone, otp, purpose, pendingData) {
  const hash      = await bcrypt.hash(otp, 8);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Invalidate previous unused OTPs for same phone+purpose
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

/**
 * Verify an OTP and mark it as used if valid.
 *
 * @returns {{ valid: boolean, reason?: string, pendingData?: object }}
 */
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

  await db.request().input('id', mssql.Int, row.id).query('UPDATE otp_store SET used = 1 WHERE id = @id');
  return { valid: true, pendingData: row.pending_data ? JSON.parse(row.pending_data) : null };
}

module.exports = { saveOtp, verifyAndConsumeOtp };
