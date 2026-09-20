/**
 * repositoryApi.js — thin API client for the tracked-repository endpoints.
 *
 * Mirrors the response shapes from repositoryController.js:
 *   POST /api/repositories             → { repository }
 *   GET  /api/repositories             → { repositories }
 *   POST /api/repositories/:id/review  → { success: true, report, reviewId }
 *   GET  /api/repositories/:id/reviews → { reviews }
 *
 * All requests require an Authorization: Bearer <token> header — these are
 * the "tracked repo" endpoints (incremental review + auto-PR), distinct from
 * the stateless POST /api/review flow in api.js.
 */

export class RepositoryApiError extends Error {
  constructor(message, { code, statusCode, details } = {}) {
    super(message);
    this.name = 'RepositoryApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

async function handleResponse(res) {
  let body;
  try {
    body = await res.json();
  } catch {
    throw new RepositoryApiError('The server returned an unreadable response.', {
      code: 'BAD_RESPONSE',
      statusCode: res.status,
    });
  }
  if (!res.ok || body.success === false) {
    throw new RepositoryApiError(body.error ?? 'Something went wrong.', {
      code: body.code ?? 'UNKNOWN_ERROR',
      statusCode: res.status,
      details: body.details,
    });
  }
  return body;
}

function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Parses a GitHub repo URL into the fields repositoryController.createRepository
 * expects. There's no GitHub App/OAuth repo picker wired up yet, so githubId
 * (meant to be GitHub's numeric repo id) is stood in with "owner/name" —
 * good enough to keep it unique per repo, but a real repo-picker integration
 * should replace this with the actual id from GitHub's API.
 */
export function parseRepoUrl(url) {
  const match = url
    .trim()
    .match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  if (!match) return null;
  const [, owner, name] = match;
  return {
    owner,
    name,
    fullName: `${owner}/${name}`,
    url: `https://github.com/${owner}/${name}`,
  };
}

/**
 * @param {string} token
 * @returns {Promise<Array<object>>}
 */
export async function listRepositories(token) {
  const res = await fetch('/api/repositories', { headers: authHeaders(token) });
  const body = await handleResponse(res);
  return body.repositories;
}

/**
 * @param {string} token
 * @param {{ url: string, private?: boolean }} input
 * @returns {Promise<object>}
 */
export async function addRepository(token, { url, private: isPrivate = false }) {
  const parsed = parseRepoUrl(url);
  if (!parsed) {
    throw new RepositoryApiError('Enter a valid GitHub repository URL, like https://github.com/owner/repo', {
      code: 'INVALID_URL',
      statusCode: 400,
    });
  }

  const res = await fetch('/api/repositories', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      githubId: parsed.fullName,
      name: parsed.name,
      fullName: parsed.fullName,
      owner: parsed.owner,
      url: parsed.url,
      private: isPrivate,
    }),
  });
  const body = await handleResponse(res);
  return body.repository;
}

/**
 * @param {string} token
 * @param {string} repositoryId
 * @param {{ autoPr?: boolean, forceFull?: boolean, githubToken?: string }} [options]
 * @returns {Promise<{ report: object, reviewId: string }>}
 */
export async function triggerRepositoryReview(token, repositoryId, options = {}) {
  const res = await fetch(`/api/repositories/${repositoryId}/review`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(options),
  });
  const body = await handleResponse(res);
  return { report: body.report, reviewId: body.reviewId };
}

/**
 * @param {string} token
 * @param {string} repositoryId
 * @returns {Promise<Array<object>>}
 */
export async function listRepositoryReviews(token, repositoryId) {
  const res = await fetch(`/api/repositories/${repositoryId}/reviews`, {
    headers: authHeaders(token),
  });
  const body = await handleResponse(res);
  return body.reviews;
}
