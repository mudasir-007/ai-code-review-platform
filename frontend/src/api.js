/**
 * api.js — thin wrapper around POST /api/review.
 *
 * Mirrors the exact response/error shapes from reviewController.js:
 *   success -> { success: true, report: ReviewReport }
 *   failure -> { error, code, details? }
 */

export class ReviewApiError extends Error {
  constructor(message, { code, statusCode, details } = {}) {
    super(message);
    this.name = 'ReviewApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * @param {{ repoUrl: string, branch?: string, githubToken?: string }} input
 * @returns {Promise<import('./types').ReviewReport>}
 */
export async function submitReview({ repoUrl, branch, githubToken }) {
  const res = await fetch('/api/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoUrl, branch, githubToken }),
  });

  let body;
  try {
    body = await res.json();
  } catch {
    throw new ReviewApiError('The server returned an unreadable response.', {
      code: 'BAD_RESPONSE',
      statusCode: res.status,
    });
  }

  if (!res.ok || !body.success) {
    throw new ReviewApiError(body.error ?? 'The review could not be completed.', {
      code: body.code ?? 'UNKNOWN_ERROR',
      statusCode: res.status,
      details: body.details,
    });
  }

  return body.report;
}
