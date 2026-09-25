/**
 * aiService.js — Gemini AI wrapper for the admission chatbot.
 *
 * Uses the new @google/genai SDK (replaces deprecated @google/generative-ai).
 * Model: gemini-2.5-flash
 */

const { GoogleGenAI } = require('@google/genai');
const logger = require('../config/logger');

let _client = null;

function getClient() {
  if (!_client) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY environment variable is not set.');
    _client = new GoogleGenAI({ apiKey: key });
  }
  return _client;
}

/**
 * @param {string} question  - Raw user question
 * @param {string} context   - Concatenated knowledge entries from the DB
 * @param {string} role      - 'student' | 'college' | 'admin'
 * @returns {Promise<string>} - AI-generated answer
 */
async function askAI(question, context, role = 'student') {
  const roleLabel = role === 'college' ? 'college administrator' : 'student';

  const prompt = `You are a helpful college admission assistant for an Indian college admission portal.
You are speaking with a ${roleLabel}.

STRICT RULES:
- Answer ONLY using the information provided in the CONTEXT below.
- Do NOT answer questions unrelated to college admissions, this portal, or education.
- If the answer is not found in the CONTEXT, respond exactly with: "I don't have information about that. Please contact college support for help."
- Keep answers clear, concise, and friendly.
- Use numbered steps when explaining a process.
- Do not mention that you are using "context" or "knowledge base" in your answer.

CONTEXT:
${context}

QUESTION:
${question}

ANSWER:`;

  try {
    const response = await getClient().models.generateContent({
      model:    'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text.trim();
  } catch (err) {
    logger.error({ err }, 'Gemini API error');
    throw err;
  }
}

module.exports = { askAI };
