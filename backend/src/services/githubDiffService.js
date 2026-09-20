/**
 * githubDiffService.js
 *
 * Everything needed to turn "review only what changed" into concrete data:
 *   - the current HEAD sha of a branch
 *   - the list of files that changed since the last reviewed sha, with
 *     their unified diff patches, via GitHub's compare API
 *
 * No local git and no extra clone — this reuses the same axios + header
 * pattern as repoService.js / validationService.js, one more GitHub API
 * call on top of the zipball we already fetch for linting.
 */

import axios from 'axios';

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_API_VERSION = '2022-11-28';

export class DiffError extends Error {
  constructor(message, { code, statusCode, details } = {}) {
    super(message);
    this.name = 'DiffError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function buildGitHubHeaders(token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
    'User-Agent': 'ai-code-review-platform',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * Resolves the current HEAD commit sha for a branch.
 *
 * @param {object} options
 * @param {string} options.owner
 * @param {string} options.repo
 * @param {string} options.branch
 * @param {string} [options.githubToken]
 * @returns {Promise<string>} commit sha
 */
export async function getLatestCommitSha({ owner, repo, branch, githubToken }) {
  const response = await axios.get(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${encodeURIComponent(branch)}`,
    { headers: buildGitHubHeaders(githubToken), validateStatus: () => true },
  );

  if (response.status === 404) {
    throw new DiffError(`Branch not found: ${owner}/${repo}@${branch}`, {
      code: 'BRANCH_NOT_FOUND',
      statusCode: 404,
      details: { owner, repo, branch },
    });
  }
  if (response.status >= 400) {
    throw new DiffError('Failed to resolve the latest commit for this branch.', {
      code: 'HEAD_LOOKUP_FAILED',
      statusCode: response.status,
      details: response.data,
    });
  }

  return response.data.sha;
}

/**
 * Compares two commits/branches and returns the changed files with their
 * unified diff patches (GitHub's compare API caps the `patch` field per
 * file around ~300 lines of diff — huge single-file rewrites fall back to
 * `patch: undefined`, which callers should treat as "review whole file").
 *
 * @param {object} options
 * @param {string} options.owner
 * @param {string} options.repo
 * @param {string} options.base   - previously reviewed sha
 * @param {string} options.head   - current HEAD sha
 * @param {string} [options.githubToken]
 * @returns {Promise<{
 *   changedFiles: Array<{ filename: string, previousFilename: string|null, status: string, patch: string|null, additions: number, deletions: number }>,
 *   totalCommits: number,
 *   aheadBy: number,
 *   behindBy: number,
 * }>}
 */
export async function compareCommits({ owner, repo, base, head, githubToken }) {
  if (!base || !head) {
    throw new DiffError('base and head commit SHAs are required to compute a diff.', {
      code: 'INVALID_INPUT',
      statusCode: 400,
    });
  }

  const response = await axios.get(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/compare/${base}...${head}`,
    { headers: buildGitHubHeaders(githubToken), validateStatus: () => true },
  );

  if (response.status === 404) {
    // Common cause: base sha no longer exists (force-push / history rewrite).
    // Callers should catch this and fall back to a full review.
    throw new DiffError('Could not compare commits — the base commit may no longer exist (e.g. after a force-push).', {
      code: 'BASE_NOT_COMPARABLE',
      statusCode: 404,
      details: { owner, repo, base, head },
    });
  }
  if (response.status >= 400) {
    throw new DiffError('Failed to compare commits on GitHub.', {
      code: 'COMPARE_FAILED',
      statusCode: response.status,
      details: response.data,
    });
  }

  const data = response.data;

  if (base === head || data.status === 'identical') {
    return { changedFiles: [], totalCommits: 0, aheadBy: 0, behindBy: data.behind_by ?? 0 };
  }

  const changedFiles = (data.files ?? []).map((f) => ({
    filename: f.filename,
    previousFilename: f.previous_filename ?? null,
    status: f.status, // 'added' | 'modified' | 'removed' | 'renamed'
    patch: f.patch ?? null, // null when GitHub omits the patch (binary, or too large)
    additions: f.additions,
    deletions: f.deletions,
  }));

  return {
    changedFiles,
    totalCommits: data.total_commits ?? 0,
    aheadBy: data.ahead_by ?? 0,
    behindBy: data.behind_by ?? 0,
  };
}
