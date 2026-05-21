/**
 * update_test_passwords.js — Temporary script to fix bcrypt hashes for E2E test accounts.
 *
 * Usage:
 *   node scripts/update_test_passwords.js
 *
 * DELETE this file after running it once.
 */

'use strict';

require('dotenv').config();
const mssql   = require('mssql');
const bcrypt  = require('bcryptjs');

const config = {
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server:   process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port:     parseInt(process.env.DB_PORT) || 1433,
  options:  { encrypt: true, trustServerCertificate: true },
  pool:     { max: 1, min: 1 },
  requestTimeout:    30000,
  connectionTimeout: 15000,
};

async function main() {
  // Generate fresh hashes
  const [adminHash, studentHash] = await Promise.all([
    bcrypt.hash('Admin@1234', 10),
    bcrypt.hash('Test@1234',  10),
  ]);

  console.log('Generated hashes:');
  console.log('  Admin@1234 →', adminHash);
  console.log('  Test@1234  →', studentHash);

  // Connect
  const pool = new mssql.ConnectionPool(config);
  await pool.connect();
  console.log('\nConnected to:', process.env.DB_NAME);

  const updates = [
    {
      label: 'Super Admin (vtadmin@test.com)',
      sql:   `UPDATE admins SET password_hash = @hash WHERE email = 'vtadmin@test.com'`,
      hash:  adminHash,
    },
    {
      label: 'College Admin (admin@testcollege.edu)',
      sql:   `UPDATE colleges SET admin_password_hash = @hash WHERE admin_email = 'admin@testcollege.edu'`,
      hash:  adminHash,
    },
    {
      label: 'Student 1 (phone 9000000001)',
      sql:   `UPDATE students SET password_hash = @hash WHERE phone = '9000000001'`,
      hash:  studentHash,
    },
    {
      label: 'Student 2 (phone 9000000002)',
      sql:   `UPDATE students SET password_hash = @hash WHERE phone = '9000000002'`,
      hash:  studentHash,
    },
  ];

  for (const u of updates) {
    const result = await pool.request()
      .input('hash', mssql.NVarChar, u.hash)
      .query(u.sql);
    const rows = result.rowsAffected[0];
    console.log(`  ${rows > 0 ? '✓' : '✗ (0 rows)'} ${u.label}`);
  }

  await pool.close();
  console.log('\nDone. You can delete this file now.');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});