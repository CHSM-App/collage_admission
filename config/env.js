/**
 * env.js — Validate required environment variables at startup.
 * Required by bin/www before any other module so the server refuses
 * to start with a clear error instead of failing silently at runtime.
 */

'use strict';

require('dotenv').config();

const REQUIRED = [
  'JWT_SECRET',
  'DB_SERVER',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
];

const missing = REQUIRED.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error('');
  console.error('FATAL: Missing required environment variables:');
  missing.forEach(key => console.error(`  - ${key}`));
  console.error('');
  console.error('Set these in your .env file and restart the server.');
  process.exit(1);
}
