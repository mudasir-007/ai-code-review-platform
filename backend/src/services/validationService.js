import axios from 'axios';

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_API_VERSION = '2022-11-28';
const SIZE_WARN_KB = 500 * 1024; // 500 MB (GitHub reports size in KB)
const RATE_LIMIT_MIN_REMAINING = 10;

/**
 * Matches standard GitHub repository URLs and rejects gists, org pages, and bare profiles.
 *
 * Supported examples:
 * - https://github.com/owner/repo
 * - github.com/owner/repo.git
 * - https://github.com/owner/repo/tree/main
 */
const GITHUB_REPO_URL_REGEX =
  /^(?:https?:\/\/)?(?:www\.)?github\.com\/(?!orgs\/|settings\/|marketplace\/|features\/|pricing\/|login\/|signup\/|gist\/|gists\/)([^/?#\s]+)\/([^/?#\s]+?)(?:\.git)?(?:[/?#].*)?$/i;

const GIST_URL_REGEX = /^(?:https?:\/\/)?(?:www\.)?(?:gist\.github\.com|github\.com\/gist)/i;

export class ValidationError extends Error {
  constructor(message, { code, statusCode, details } = {}) {
    super(message);
    this.name = 'ValidationError';
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

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Parses and validates a GitHub repository URL.
 */
export function parseGitHubRepoUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new ValidationError('GitHub URL is required.', {
      code: 'INVALID_URL',
      statusCode: 400,
    });
  }

  const trimmed = url.trim();

  if (GIST_URL_REGEX.test(trimmed)) {
    throw new ValidationError('Gist URLs are not supported. Provide a repository URL.', {
      code: 'GIST_NOT_SUPPORTED',
      statusCode: 400,
    });
  }

  const match = trimmed.match(GITHUB_REPO_URL_REGEX);
  if (!match) {
    throw new ValidationError(
      'Invalid GitHub repository URL. Expected format: https://github.com/owner/repo',
      {
        code: 'INVALID_URL',
        statusCode: 400,
      },
    );
  }

  const owner = match[1];
  const repo = match[2];

  if (!owner || !repo) {
    throw new ValidationError('Could not extract owner and repository name from URL.', {
      code: 'INVALID_URL',
      statusCode: 400,
    });
  }

  return { owner, repo };
}

function getRateLimitRemaining(headers) {
  const remaining = headers?.['x-ratelimit-remaining'];
  if (remaining === undefined) return null;
  const parsed = Number.parseInt(String(remaining), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function assertRateLimitRemaining(headers, { minRemaining = RATE_LIMIT_MIN_REMAINING } = {}) {
  const remaining = getRateLimitRemaining(headers);
  if (remaining === null) return;

  if (remaining < minRemaining) {
    throw new ValidationError(
      `GitHub API rate limit is too low (${remaining} requests remaining). Try again later.`,
      {
        code: 'RATE_LIMIT_LOW',
        statusCode: 429,
        details: { remaining },
      },
    );
  }
}

async function fetchRateLimitStatus(token) {
  const response = await axios.get(`${GITHUB_API_BASE}/rate_limit`, {
    headers: buildGitHubHeaders(token),
    validateStatus: () => true,
  });

  if (response.status >= 400) {
    throw new ValidationError('Unable to check GitHub rate limit status.', {
      code: 'RATE_LIMIT_CHECK_FAILED',
      statusCode: response.status,
      details: response.data,
    });
  }

  const remaining = response.data?.resources?.core?.remaining;
  if (typeof remaining === 'number' && remaining < RATE_LIMIT_MIN_REMAINING) {
    throw new ValidationError(
      `GitHub API rate limit is too low (${remaining} requests remaining). Try again later.`,
      {
        code: 'RATE_LIMIT_LOW',
        statusCode: 429,
        details: { remaining },
      },
    );
  }

  return response.data;
}

async function fetchRepositoryMetadata(owner, repo, token) {
  const response = await axios.get(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
    headers: buildGitHubHeaders(token),
    validateStatus: () => true,
  });

  assertRateLimitRemaining(response.headers);

  if (response.status === 404) {
    throw new ValidationError(
      token
        ? 'Repository not found or your token does not have access to it.'
        : 'Repository not found. Private repositories require a GitHub token.',
      {
        code: 'REPO_NOT_FOUND',
        statusCode: 404,
        details: { owner, repo },
      },
    );
  }

  if (response.status === 401) {
    throw new ValidationError('GitHub token is invalid or expired.', {
      code: 'TOKEN_INVALID',
      statusCode: 401,
    });
  }

  if (response.status === 403) {
    const message =
      typeof response.data?.message === 'string'
        ? response.data.message
        : 'GitHub token lacks permission to access this repository.';

    throw new ValidationError(message, {
      code: 'TOKEN_FORBIDDEN',
      statusCode: 403,
      details: response.data,
    });
  }

  if (response.status >= 400) {
    throw new ValidationError('Failed to fetch repository metadata from GitHub.', {
      code: 'GITHUB_API_ERROR',
      statusCode: response.status,
      details: response.data,
    });
  }

  return response;
}

async function repositoryHasCommits(owner, repo, token) {
  const response = await axios.get(`${GITHUB_API_BASE}/repos/${owner}/${repo}/commits`, {
    headers: buildGitHubHeaders(token),
    params: { per_page: 1 },
    validateStatus: () => true,
  });

  assertRateLimitRemaining(response.headers);

  if (response.status === 409) {
    // GitHub returns 409 for empty repositories.
    return false;
  }

  if (response.status >= 400) {
    throw new ValidationError('Unable to verify whether the repository has commits.', {
      code: 'COMMIT_CHECK_FAILED',
      statusCode: response.status,
      details: response.data,
    });
  }

  return Array.isArray(response.data) && response.data.length > 0;
}

function collectMetadataWarnings(metadata) {
  const warnings = [];

  if (metadata.archived) {
    warnings.push({
      code: 'REPO_ARCHIVED',
      message: 'Repository is archived. Review results may be outdated.',
    });
  }

  if (typeof metadata.size === 'number' && metadata.size > SIZE_WARN_KB) {
    const sizeMb = (metadata.size / 1024).toFixed(1);
    warnings.push({
      code: 'REPO_LARGE',
      message: `Repository size is approximately ${sizeMb} MB (GitHub metadata). Large repos may be slow to process.`,
      details: { sizeKb: metadata.size },
    });
  }

  if (metadata.disabled) {
    warnings.push({
      code: 'REPO_DISABLED',
      message: 'Repository is disabled on GitHub.',
    });
  }

  if (metadata.fork) {
    warnings.push({
      code: 'REPO_FORK',
      message: 'Repository is a fork. Consider reviewing the upstream source of truth.',
    });
  }

  return warnings;
}

/**
 * Validates a GitHub repository URL and returns metadata plus extracted identifiers.
 *
 * File depth limits and secret scanning are intentionally handled later by the repo walker.
 */
export async function validateGitHubRepository(
  githubUrl,
  { githubToken = process.env.GITHUB_TOKEN, minRateLimitRemaining = RATE_LIMIT_MIN_REMAINING } = {},
) {
  const { owner, repo } = parseGitHubRepoUrl(githubUrl);

  await fetchRateLimitStatus(githubToken);

  const metadataResponse = await fetchRepositoryMetadata(owner, repo, githubToken);
  const metadata = metadataResponse.data;
  const warnings = collectMetadataWarnings(metadata);

  if (typeof metadata.size === 'number' && metadata.size === 0) {
    throw new ValidationError('Repository appears to be empty (size is 0 KB).', {
      code: 'REPO_EMPTY',
      statusCode: 422,
      details: { owner, repo },
    });
  }

  const hasCommits = await repositoryHasCommits(owner, repo, githubToken);
  if (!hasCommits) {
    throw new ValidationError('Repository has no commits.', {
      code: 'REPO_EMPTY',
      statusCode: 422,
      details: { owner, repo },
    });
  }

  if (!metadata.default_branch) {
    throw new ValidationError('Repository metadata is missing default_branch.', {
      code: 'DEFAULT_BRANCH_MISSING',
      statusCode: 422,
      details: { owner, repo },
    });
  }

  const remaining = getRateLimitRemaining(metadataResponse.headers);
  if (remaining !== null && remaining < minRateLimitRemaining) {
    throw new ValidationError(
      `GitHub API rate limit is too low (${remaining} requests remaining). Try again later.`,
      {
        code: 'RATE_LIMIT_LOW',
        statusCode: 429,
        details: { remaining },
      },
    );
  }

  return {
    owner,
    repo,
    defaultBranch: metadata.default_branch,
    visibility: metadata.private ? 'private' : 'public',
    metadata,
    warnings,
    rateLimit: {
      remaining,
      checkedAt: new Date().toISOString(),
    },
    notes: [
      'File depth limits and secret scanning are deferred to the repo walker stage.',
    ],
  };
}
