/**
 * PayUService — server-side PayU Salt v2 integration.
 *
 * All secrets (key, salt) come from environment variables only.
 * Never exposed to the client.
 *
 * Environment variables required:
 *   PAYU_MERCHANT_KEY   — merchant key
 *   PAYU_MERCHANT_SALT  — merchant salt (v2)
 *   PAYU_ENV            — 'test' | 'production'  (default: 'test')
 *   PAYU_DEBUG_HASH     — '1' to log pre-hash string server-side during testing
 *
 * PayU Salt v2 request hash formula:
 *   SHA512( key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT )
 *
 * PayU Salt v2 response hash formula (reverse order):
 *   SHA512( SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key )
 *
 * The 6 empty pipes between udf5 and udf4 in the response formula represent
 * additional_charges, udf10, udf9, udf8, udf7, udf6 — all empty.
 */

'use strict';

const crypto = require('crypto');
const logger = require('../config/logger');

const ENDPOINTS = {
  test:       'https://test.payu.in/_payment',
  production: 'https://secure.payu.in/_payment',
};

function cfg() {
  return {
    key:      process.env.PAYU_MERCHANT_KEY,
    salt:     process.env.PAYU_MERCHANT_SALT,
    env:      process.env.PAYU_ENV || 'test',
    debug:    process.env.PAYU_DEBUG_HASH === '1',
  };
}

/**
 * Generate a unique transaction ID.
 * Format: TXN-<appId>-<paymentType short>-<timestamp>-<random 4 hex>
 * Guaranteed unique for all practical purposes; never reused.
 */
function generateTxnId(appId, paymentType) {
  const typeCode = paymentType === 'application_fee' ? 'AF' : 'CF';
  const ts       = Date.now().toString(36).toUpperCase();
  const rnd      = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `TXN-${appId}-${typeCode}-${ts}-${rnd}`;
}

/**
 * Compute PayU Salt v2 request hash.
 *
 * Hash string (mandatory fields must be non-empty; unused udf fields are empty
 * but their pipe delimiters are preserved):
 *   key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT
 */
function computeRequestHash({ txnid, amount, productinfo, firstname, email, udf1 = '', udf2 = '', udf3 = '', udf4 = '', udf5 = '' }) {
  const { key, salt, debug } = cfg();

  // amount must be formatted to exactly 2 decimal places — PayU is strict
  const amtStr = parseFloat(amount).toFixed(2);

  // PayU Salt v2 formula — exact PHP reference from docs:
  // key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT
  // That is 16 total pipe separators (17 segments including SALT).
  // After udf5: exactly 5 empty strings → produces "udf5||||||SALT" (5 pipes between udf5 and SALT).
  const pre = [
    key, txnid, amtStr, productinfo, firstname, email,
    udf1, udf2, udf3, udf4, udf5,
    '', '', '', '', '',   // 5 empty slots → udf5||||||SALT
    salt,
  ].join('|');

  const hash = crypto.createHash('sha512').update(pre).digest('hex');

  console.log('[PayU] pre-hash :', pre);
  console.log('[PayU] hash     :', hash);

  if (debug) {
    logger.info({ pre_hash: pre, hash }, '[PayU] request pre-hash string');
  }

  return hash;
}

/**
 * Verify PayU response hash.
 *
 * Reverse formula:
 *   SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
 *
 * The 6 empty pipes after status represent:
 *   additional_charges|udf10|udf9|udf8|udf7|udf6
 */
function verifyResponseHash(params) {
  const { salt, debug } = cfg();
  const { key, txnid, amount, productinfo, firstname, email,
          udf1 = '', udf2 = '', udf3 = '', udf4 = '', udf5 = '',
          status, hash: receivedHash } = params;

  const amtStr = parseFloat(amount).toFixed(2);

  // Reverse formula from docs:
  // SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
  // 5 empty strings after status → "status||||||udf5" (5 pipes between status and udf5)
  const pre = [
    salt, status,
    '', '', '', '', '',  // 5 empty slots
    udf5, udf4, udf3, udf2, udf1,
    email, firstname, productinfo, amtStr, txnid, key,
  ].join('|');

  if (debug) {
    logger.info({ pre_hash: pre }, '[PayU] response pre-hash string');
  }

  const expected = crypto.createHash('sha512').update(pre).digest('hex');

  if (expected !== receivedHash) {
    logger.warn({ txnid, expected, received: receivedHash }, '[PayU] hash mismatch');
    return false;
  }
  return true;
}

/**
 * Build the full set of form fields to POST to PayU.
 * Returns { endpoint, fields } — the client auto-submits a form POST.
 *
 * @param {object} opts
 * @param {string}  opts.txnid
 * @param {number}  opts.amount      — rupees (server-derived, never client-supplied)
 * @param {string}  opts.productinfo — short description
 * @param {string}  opts.firstname
 * @param {string}  opts.email
 * @param {string}  opts.phone
 * @param {string}  opts.surl        — success return URL
 * @param {string}  opts.furl        — failure return URL
 * @param {string}  [opts.udf1]      — carry-along: application_id
 * @param {string}  [opts.udf2]      — carry-along: payment_type
 * @param {string}  [opts.udf3]      — carry-along: app_division
 * @param {string}  [opts.udf4]      — reserved
 * @param {string}  [opts.udf5]      — reserved
 */
function buildPaymentFields(opts) {
  const { key, env } = cfg();
  const {
    txnid, amount, productinfo, firstname, email, phone = '',
    surl, furl,
    udf1 = '', udf2 = '', udf3 = '', udf4 = '', udf5 = '',
  } = opts;

  const hash = computeRequestHash({ txnid, amount, productinfo, firstname, email, udf1, udf2, udf3, udf4, udf5 });

  return {
    endpoint: ENDPOINTS[env] || ENDPOINTS.test,
    fields: {
      key,
      txnid,
      amount:      parseFloat(amount).toFixed(2),
      productinfo,
      firstname,
      email,
      phone,
      surl,
      furl,
      udf1, udf2, udf3, udf4, udf5,
      service_provider: 'payu_paisa',
      hash,
    },
  };
}

module.exports = { generateTxnId, buildPaymentFields, verifyResponseHash, computeRequestHash };
