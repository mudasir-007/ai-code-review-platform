/**
 * aiProviderService.js
 *
 * Multi-provider AI client with automatic fallback.
 *
 * Primary:  Groq → llama-3.3-70b-versatile  (fastest, 14,400 req/day free)
 * Fallback: Gemini → gemini-2.5-flash        (500 req/day free)
 *
 * Fallback triggers:
 *   - Groq rate limit (429)
 *   - Groq API / network error
 *   - Empty / unparseable response from Groq
 */

import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ─── Models ───────────────────────────────────────────────────────────────────

const GROQ_MODEL   = 'llama-3.3-70b-versatile';
const GEMINI_MODEL = 'gemini-2.5-flash';

// Token budgets (leave headroom for prompt + output)
const GROQ_MAX_TOKENS   = 2048;
const GEMINI_MAX_TOKENS = 2048;

// ─── Error class ──────────────────────────────────────────────────────────────

export class ReviewGenerationError extends Error {
  /** @param {string} message @param {{ groqError?: string, geminiError?: string }} [meta] */
  constructor(message, meta = {}) {
    super(message);
    this.name = 'ReviewGenerationError';
    this.groqError   = meta.groqError   ?? null;
    this.geminiError = meta.geminiError ?? null;
  }
}

// ─── Groq ─────────────────────────────────────────────────────────────────────

async function callGroq(systemPrompt, userPrompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'your_groq_api_key_here') {
    throw new Error('GROQ_API_KEY not configured');
  }

  const groq = new Groq({ apiKey });

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    max_tokens: GROQ_MAX_TOKENS,
    temperature: 0.2,          // Low temp = consistent, deterministic output
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt   },
    ],
  });

  const text = completion.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Groq returned an empty response');
  return text;
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

async function callGemini(systemPrompt, userPrompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: GEMINI_MAX_TOKENS,
      temperature: 0.2,
    },
  });

  const result = await model.generateContent(userPrompt);
  const text = result.response?.text()?.trim();
  if (!text) throw new Error('Gemini returned an empty response');
  return text;
}

// ─── Fallback logic ───────────────────────────────────────────────────────────

function isRateLimit(err) {
  const msg = err?.message?.toLowerCase() ?? '';
  const status = err?.status ?? err?.statusCode ?? err?.error?.status;
  return status === 429 || msg.includes('rate limit') || msg.includes('429');
}

/**
 * Calls the AI with Groq first, falls back to Gemini on rate-limit or error.
 *
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @returns {Promise<{ text: string; providerUsed: 'groq' | 'gemini' }>}
 */
export async function generateReview(systemPrompt, userPrompt) {
  let groqError = null;

  // ── Try Groq ──────────────────────────────────────────────────────────────
  try {
    const text = await callGroq(systemPrompt, userPrompt);
    return { text, providerUsed: 'groq' };
  } catch (err) {
    groqError = err instanceof Error ? err.message : String(err);
    const reason = isRateLimit(err) ? 'rate-limited' : 'errored';
    console.warn(`[aiProvider] Groq ${reason} — falling back to Gemini. Reason: ${groqError}`);
  }

  // ── Fallback to Gemini ────────────────────────────────────────────────────
  let geminiError = null;
  try {
    const text = await callGemini(systemPrompt, userPrompt);
    return { text, providerUsed: 'gemini' };
  } catch (err) {
    geminiError = err instanceof Error ? err.message : String(err);
  }

  throw new ReviewGenerationError(
    'Both Groq and Gemini failed to generate a review. Check your API keys and rate limits.',
    { groqError, geminiError },
  );
}
