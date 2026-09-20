/**
 * githubWriteService.js
 *
 * Creates a branch and commits file changes to GitHub using the Git Data
 * API (blobs → tree → commit → ref) — the write-side counterpart to
 * repoService.js's read-only zipball fetch. Still no local git and no
 * clone: every step is a REST call.
 *
 * Requires a githubToken with `repo` scope (contents: write).
 */

import axios from 'axios';

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_API_VERSION = '2022-11-28';

export class GitWriteError extends Error {
  constructor(message, { code, statusCode, details } = {}) {
    super(message);
    this.name = 'GitWriteError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function headers(token) {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
    'User-Agent': 'ai-code-review-platform',
    Authorization: `Bearer ${token}`,
  };
}

async function gh(method, url, { token, data } = {}) {
  const response = await axios({
    method,
    url: `${GITHUB_API_BASE}${url}`,
    headers: headers(token),
    data,
    validateStatus: () => true,
  });
  if (response.status >= 400) {
    throw new GitWriteError(`GitHub API ${method.toUpperCase()} ${url} failed`, {
      code: 'GITHUB_WRITE_FAILED',
      statusCode: response.status,
      details: response.data,
    });
  }
  return response.data;
}

/**
 * Creates a new branch pointing at `fromSha`. If the branch already exists
 * (e.g. a retry), it is force-updated to point at fromSha instead of
 * erroring — keeps this idempotent for the caller.
 */
export async function ensureBranch({ owner, repo, branchName, fromSha, githubToken }) {
  const refUrl = `/repos/${owner}/${repo}/git/refs/heads/${branchName}`;

  const existing = await axios.get(`${GITHUB_API_BASE}${refUrl}`, {
    headers: headers(githubToken),
    validateStatus: () => true,
  });

  if (existing.status === 200) {
    await gh('patch', refUrl, { token: githubToken, data: { sha: fromSha, force: true } });
    return branchName;
  }

  await gh('post', `/repos/${owner}/${repo}/git/refs`, {
    token: githubToken,
    data: { ref: `refs/heads/${branchName}`, sha: fromSha },
  });
  return branchName;
}

/**
 * Commits a set of full-file replacements onto `branchName`, on top of
 * `baseSha`. Returns the new commit sha.
 *
 * @param {object} options
 * @param {string} options.owner
 * @param {string} options.repo
 * @param {string} options.branchName
 * @param {string} options.baseSha   - commit the new tree is built on top of
 * @param {Array<{ file: string, newContent: string }>} options.fixes
 * @param {string} options.commitMessage
 * @param {string} options.githubToken
 * @returns {Promise<string>} new commit sha
 */
export async function commitFixes({ owner, repo, branchName, baseSha, fixes, commitMessage, githubToken }) {
  if (!fixes.length) {
    throw new GitWriteError('No fixes to commit.', { code: 'NO_FIXES', statusCode: 400 });
  }

  const baseCommit = await gh('get', `/repos/${owner}/${repo}/git/commits/${baseSha}`, { token: githubToken });

  // One blob per changed file.
  const blobs = await Promise.all(
    fixes.map(async (fix) => {
      const blob = await gh('post', `/repos/${owner}/${repo}/git/blobs`, {
        token: githubToken,
        data: { content: fix.newContent, encoding: 'utf-8' },
      });
      return { path: fix.file, mode: '100644', type: 'blob', sha: blob.sha };
    }),
  );

  const newTree = await gh('post', `/repos/${owner}/${repo}/git/trees`, {
    token: githubToken,
    data: { base_tree: baseCommit.tree.sha, tree: blobs },
  });

  const newCommit = await gh('post', `/repos/${owner}/${repo}/git/commits`, {
    token: githubToken,
    data: { message: commitMessage, tree: newTree.sha, parents: [baseSha] },
  });

  await gh('patch', `/repos/${owner}/${repo}/git/refs/heads/${branchName}`, {
    token: githubToken,
    data: { sha: newCommit.sha },
  });

  return newCommit.sha;
}
