/**
 * chat.js — Chatbot API route.
 *
 * POST /chat
 *   body: { message, role? }
 *   auth: optional (works for unauthenticated users too — role defaults to 'student')
 *
 * Flow:
 *   1. Keyword search against chatbot_knowledge table
 *   2. Build context string from matched rows
 *   3. Send question + context to Gemini
 *   4. Log question + answer to chatbot_logs
 *   5. Return { answer, suggested } to client
 */

const express  = require('express');
const router   = express.Router();
const mssql    = require('mssql');
const db       = require('./db');
const { askAI } = require('../services/aiService');
const logger   = require('../config/logger');
const { body, validationResult } = require('express-validator');

// Optional auth — attach user if cookie is present, but do not block unauthenticated
const { authenticate } = require('../middleware/auth');

function optionalAuth(req, res, next) {
  authenticate(req, res, () => next());  // ignores auth errors — always proceeds
}

// ── Keyword search against chatbot_knowledge ─────────────────
// Splits the question into words and looks for rows where any
// keyword appears in the `keywords` column. Returns up to 5 rows
// ordered by how many keywords matched (most relevant first).
async function searchKnowledge(question, role) {
  // Sanitise: keep only alphanumeric + spaces, lowercase
  const rawWords = question
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1)   // skip single-char words only (a, i…)
    .slice(0, 10);                // limit to first 10 meaningful words

  if (rawWords.length === 0) return [];

  // Stem: strip common suffixes so 'programs'→'program', 'steps'→'step', 'inserting'→'insert'
  function stem(w) {
    if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
    if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
    if (w.length > 4 && w.endsWith('es'))  return w.slice(0, -2);
    if (w.length > 3 && w.endsWith('s'))   return w.slice(0, -1);
    return w;
  }
  // Deduplicate after stemming
  const words = [...new Set(rawWords.map(stem))];

  if (words.length === 0) return [];

  // Build OR conditions: keywords LIKE '%word%' for each word
  const conditions = words.map((_, i) => `keywords LIKE @w${i}`).join(' OR ');

  // category filter: 'student' rows + 'both' rows for students,
  //                  'college' rows + 'both' rows for college/admin
  const catFilter = (role === 'college' || role === 'admin')
    ? `category IN ('college', 'both')`
    : `category IN ('student', 'both')`;

  try {
    const req = db.request();
    words.forEach((w, i) => req.input(`w${i}`, mssql.NVarChar, `%${w}%`));

    const result = await req.query(`
      SELECT TOP 5 title, content
      FROM chatbot_knowledge
      WHERE is_active = 1
        AND ${catFilter}
        AND (${conditions})
      ORDER BY (
        ${words.map((_, i) => `CASE WHEN keywords LIKE @w${i} THEN 1 ELSE 0 END`).join(' + ')}
      ) DESC
    `);

    return result.recordset;
  } catch (err) {
    logger.warn({ err }, 'chatbot knowledge search failed');
    return [];
  }
}

// ── Log chat exchange ────────────────────────────────────────
async function logChat(userId, role, question, answer) {
  try {
    await db.request()
      .input('uid',      mssql.Int,      userId || null)
      .input('role',     mssql.NVarChar, role   || null)
      .input('question', mssql.NVarChar, question)
      .input('answer',   mssql.NVarChar, answer)
      .query(`
        INSERT INTO chatbot_logs (user_id, role, question, answer)
        VALUES (@uid, @role, @question, @answer)
      `);
  } catch (err) {
    logger.warn({ err }, 'chatbot log insert failed');
  }
}

// ── Suggested questions per role ─────────────────────────────
const SUGGESTIONS = {
  student: [
    'How do I apply for admission?',
    'What documents do I need?',
    'What is the platform fee?',
    'How do I pay the college fee?',
    'What does my application status mean?',
  ],
  college: [
    'How do I review student applications?',
    'How do I add a program in Program Master?',
    'How do I set up fees in Fees Master?',
    'How do I assign roll numbers?',
    'How do I manage admission periods?',
    'What is Group Master?',
    'How do I configure Division Master?',
  ],
  admin: [
    'How do I add a new college?',
    'How do I manage college roles and permissions?',
    'How do I review applications?',
  ],
};

// ── POST /chat ───────────────────────────────────────────────
router.post('/',
  optionalAuth,
  body('message').isString().trim().notEmpty().isLength({ max: 500 })
    .withMessage('Message is required (max 500 characters).'),
  async (req, res) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const message  = req.body.message.trim();
    const role     = req.user?.role || req.body.role || 'student';
    const userId   = req.user?.id   || null;

    // Check Gemini is configured
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        success: false,
        message: 'AI service is not configured. Please contact support.',
      });
    }

    try {
      // 1. Retrieve relevant knowledge
      const rows    = await searchKnowledge(message, role);
      const context = rows.length > 0
        ? rows.map(r => `### ${r.title}\n${r.content}`).join('\n\n')
        : 'No specific knowledge found. Advise the user to contact college support.';

      // 2. Ask AI
      const answer = await askAI(message, context, role);

      // 3. Log async (non-blocking)
      logChat(userId, role, message, answer);

      return res.json({
        success: true,
        answer,
        suggested: SUGGESTIONS[role] || SUGGESTIONS.student,
      });

    } catch (err) {
      logger.error({ err }, 'chat route error');
      return res.status(500).json({
        success: false,
        message: 'Sorry, the AI assistant is unavailable right now. Please try again shortly.',
      });
    }
  }
);

// ── GET /chat/suggestions ────────────────────────────────────
// Returns the suggested questions for a role (used on chatbot open)
router.get('/suggestions', optionalAuth, (req, res) => {
  const role = req.user?.role || req.query.role || 'student';
  return res.json({
    success: true,
    data: SUGGESTIONS[role] || SUGGESTIONS.student,
  });
});

module.exports = router;
