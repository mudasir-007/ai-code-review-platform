/**
 * authApi.js — thin API client for authentication endpoints.
 *
 * Mirrors the response shapes from authController.js:
 *   POST /api/auth/login    → { user, token }
 *   POST /api/auth/register → { user, token }
 *   GET  /api/auth/me       → { user }
 */

export class AuthApiError extends Error {
  constructor(message, { code, statusCode } = {}) {
    super(message);
    this.name = 'AuthApiError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

async function handleResponse(res) {
  let body;
  try {
    body = await res.json();
  } catch {
    throw new AuthApiError('Server returned an unreadable response.', {
      code: 'BAD_RESPONSE',
      statusCode: res.status,
    });
  }
  if (!res.ok) {
    throw new AuthApiError(body.error ?? 'Something went wrong.', {
      code: body.code ?? 'UNKNOWN_ERROR',
      statusCode: res.status,
    });
  }
  return body;
}

/**
 * @param {{ email: string, password: string }} creds
 * @returns {Promise<{ user: object, token: string }>}
 */
export async function loginUser({ email, password }) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse(res);
}

/**
 * @param {{ name: string, email: string, password: string }} data
 * @returns {Promise<{ user: object, token: string }>}
 */
export async function registerUser({ name, email, password }) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  return handleResponse(res);
}

/**
 * @param {string} token
 * @returns {Promise<{ user: object }>}
 */
export async function getMe(token) {
  const res = await fetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(res);
}
