/**
 * rateLimits.js — Centralized, env-configurable rate limiting.
 *
 * Three tiers:
 *   • auth      — strict: login / register / password-reset / OTP.
 *                 Combines a per-IP hard cap, a per-ACCOUNT hard cap, and a
 *                 progressive slow-down (exponential-ish backoff) instead of a
 *                 flat lockout, so a legitimate user who fumbles a password is
 *                 delayed, not locked out, while brute-force is throttled hard.
 *   • public    — moderate: unauthenticated GETs (browse colleges, masters).
 *   • authed    — loose: authenticated user actions.
 *
 * Every threshold is read from env with a sensible default — nothing hardcoded.
 * In non-production, limiters are skipped so dev/tests aren't throttled.
 */

'use strict';

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const slowDown  = require('express-slow-down');

const IS_PROD = process.env.NODE_ENV === 'production';
const num = (key, def) => {
  const v = parseInt(process.env[key], 10);
  return Number.isFinite(v) ? v : def;
};

// ── Tunable thresholds (all env-overridable) ─────────────────
const CFG = {
  // window sizes (minutes)
  authWindowMin:    num('RL_AUTH_WINDOW_MIN', 15),
  registerWindowMin:num('RL_REGISTER_WINDOW_MIN', 60),
  otpWindowMin:     num('RL_OTP_WINDOW_MIN', 10),
  publicWindowMin:  num('RL_PUBLIC_WINDOW_MIN', 1),
  authedWindowMin:  num('RL_AUTHED_WINDOW_MIN', 15),

  // per-IP hard caps
  authMaxPerIp:     num('RL_AUTH_MAX_IP', 20),
  authMaxPerAccount:num('RL_AUTH_MAX_ACCOUNT', 8),
  registerMax:      num('RL_REGISTER_MAX', 5),
  otpMax:           num('RL_OTP_MAX', 3),
  publicMax:        num('RL_PUBLIC_MAX', 120),
  authedMax:        num('RL_AUTHED_MAX', 300),

  // slow-down (backoff) — start delaying after N attempts, +delayMs each,
  // capped at maxDelayMs. This is the "exponential backoff, not lockout" part.
  authSlowAfter:    num('RL_AUTH_SLOW_AFTER', 3),
  authSlowDelayMs:  num('RL_AUTH_SLOW_DELAY_MS', 500),
  authSlowMaxMs:    num('RL_AUTH_SLOW_MAX_MS', 10000),
};

const min = (m) => m * 60 * 1000;

// Skip limiting in non-prod, and for loopback in prod (local ops / health checks).
const skip = (req) => {
  if (!IS_PROD) return true;
  const ip = req.ip || '';
  return ip === '::1' || ip === '127.0.0.1' || ip.includes('127.0.0.1');
};

const commonLimiterOpts = {
  standardHeaders: true,
  legacyHeaders: false,
  skip,
};

// Derive an "account" key from the request body (email or phone), lowercased.
// Falls back to an IPv6-safe IP key when no identifier is present.
const accountKey = (req, res) => {
  const id = (req.body?.email || req.body?.phone || '').toString().trim().toLowerCase();
  return id ? `acct:${id}` : ipKeyGenerator(req, res);
};

// ── AUTH tier ────────────────────────────────────────────────
// Per-IP hard cap.
const authIpLimiter = rateLimit({
  ...commonLimiterOpts,
  windowMs: min(CFG.authWindowMin),
  max: CFG.authMaxPerIp,
  message: { success: false, message: `Too many attempts from this network. Try again in ${CFG.authWindowMin} minutes.` },
});

// Per-account hard cap (stops IP-rotation brute force against one account).
const authAccountLimiter = rateLimit({
  ...commonLimiterOpts,
  windowMs: min(CFG.authWindowMin),
  max: CFG.authMaxPerAccount,
  keyGenerator: accountKey,
  message: { success: false, message: `Too many attempts for this account. Try again in ${CFG.authWindowMin} minutes.` },
});

// Progressive backoff — delays responses after a few attempts instead of a
// hard block, keyed per-account so one user's fumbling doesn't slow others.
const authSlowDown = slowDown({
  windowMs: min(CFG.authWindowMin),
  delayAfter: CFG.authSlowAfter,
  delayMs: (used) => (used - CFG.authSlowAfter) * CFG.authSlowDelayMs,
  maxDelayMs: CFG.authSlowMaxMs,
  keyGenerator: accountKey,
  skip,
});

// Convenience: the full auth stack (order: slow-down, per-account, per-IP).
const authLimiter = [authSlowDown, authAccountLimiter, authIpLimiter];

// ── REGISTER tier (spam-account prevention) ──────────────────
const registerLimiter = rateLimit({
  ...commonLimiterOpts,
  windowMs: min(CFG.registerWindowMin),
  max: CFG.registerMax,
  message: { success: false, message: `Too many registration attempts. Try again in ${CFG.registerWindowMin} minutes.` },
});

// ── OTP tier ─────────────────────────────────────────────────
const otpLimiter = rateLimit({
  ...commonLimiterOpts,
  windowMs: min(CFG.otpWindowMin),
  max: CFG.otpMax,
  keyGenerator: accountKey,
  message: { success: false, message: `Too many OTP requests. Try again in ${CFG.otpWindowMin} minutes.` },
});

// ── PUBLIC tier (unauthenticated GETs) ───────────────────────
const publicLimiter = rateLimit({
  ...commonLimiterOpts,
  windowMs: min(CFG.publicWindowMin),
  max: CFG.publicMax,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

// ── AUTHED tier (authenticated user actions) ─────────────────
const authedLimiter = rateLimit({
  ...commonLimiterOpts,
  windowMs: min(CFG.authedWindowMin),
  max: CFG.authedMax,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

module.exports = {
  CFG,
  authLimiter,        // array of middlewares — spread when applying
  authIpLimiter,
  authAccountLimiter,
  authSlowDown,
  registerLimiter,
  otpLimiter,
  publicLimiter,
  authedLimiter,
};
