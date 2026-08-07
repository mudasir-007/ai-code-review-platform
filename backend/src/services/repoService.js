import axios from 'axios';
import AdmZip from 'adm-zip';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_API_VERSION = '2022-11-28';
const FETCH_TIMEOUT_MS = 30_000;

export class RepoFetchError extends Error {
  constructor(message, { code, statusCode, details } = {}) {
    super(message);
    this.name = 'RepoFetchError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function buildGitHubHeaders(githubToken) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
    'User-Agent': 'ai-code-review-platform',
  };

  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  return headers;
}

async function downloadZipball({ owner, repo, branch, githubToken }) {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/zipball/${encodeURIComponent(branch)}`;

  try {
    const response = await axios.get(url, {
      headers: buildGitHubHeaders(githubToken),
      responseType: 'arraybuffer',
      timeout: FETCH_TIMEOUT_MS,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      validateStatus: () => true,
    });

    if (response.status === 404) {
      throw new RepoFetchError(
        githubToken
          ? `Repository or branch not found: ${owner}/${repo}@${branch}`
          : `Repository or branch not found: ${owner}/${repo}@${branch}. Private repos require a GitHub token.`,
        { code: 'REPO_NOT_FOUND', statusCode: 404, details: { owner, repo, branch } },
      );
    }

    if (response.status === 403) {
      throw new RepoFetchError('GitHub denied access to the zipball download.', {
        code: 'DOWNLOAD_FORBIDDEN',
        statusCode: 403,
        details: response.data,
      });
    }

    if (response.status >= 400) {
      throw new RepoFetchError('Failed to download repository zipball from GitHub.', {
        code: 'DOWNLOAD_FAILED',
        statusCode: response.status,
        details: response.data,
      });
    }

    const buffer = Buffer.from(response.data);
    if (!buffer.length) {
      throw new RepoFetchError('Downloaded zipball is empty.', {
        code: 'EMPTY_ARCHIVE',
        statusCode: 422,
      });
    }

    return buffer;
  } catch (error) {
    if (error instanceof RepoFetchError) throw error;

    if (error.code === 'ECONNABORTED') {
      throw new RepoFetchError(`Zipball download timed out after ${FETCH_TIMEOUT_MS / 1000} seconds.`, {
        code: 'DOWNLOAD_TIMEOUT',
        statusCode: 408,
      });
    }

    throw new RepoFetchError('Unexpected error while downloading repository zipball.', {
      code: 'DOWNLOAD_ERROR',
      statusCode: 500,
      details: error.message,
    });
  }
}

function extractZipToDirectory(zipBuffer, targetDir) {
  let zip;

  try {
    zip = new AdmZip(zipBuffer);
  } catch (error) {
    throw new RepoFetchError('Failed to read downloaded zipball.', {
      code: 'INVALID_ARCHIVE',
      statusCode: 422,
      details: error.message,
    });
  }

  const entries = zip.getEntries();
  if (!entries.length) {
    throw new RepoFetchError('Downloaded repository archive contains no files.', {
      code: 'EMPTY_ARCHIVE',
      statusCode: 422,
    });
  }

  try {
    zip.extractAllTo(targetDir, true);
  } catch (error) {
    throw new RepoFetchError('Failed to extract repository archive.', {
      code: 'EXTRACTION_FAILED',
      statusCode: 500,
      details: error.message,
    });
  }
}

async function resolveSourceRoot(extractDir) {
  const entries = await fs.readdir(extractDir, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory());

  if (directories.length === 1) {
    return path.join(extractDir, directories[0].name);
  }

  const hasFiles = entries.some((entry) => entry.isFile());
  if (hasFiles) {
    return extractDir;
  }

  throw new RepoFetchError('Could not locate extracted source root directory.', {
    code: 'SOURCE_ROOT_NOT_FOUND',
    statusCode: 422,
    details: { directories: directories.map((entry) => entry.name) },
  });
}

async function assertSourceRootNotEmpty(sourceRoot) {
  const entries = await fs.readdir(sourceRoot);
  if (!entries.length) {
    throw new RepoFetchError('Extracted repository directory is empty.', {
      code: 'EMPTY_REPOSITORY',
      statusCode: 422,
    });
  }
}

/**
 * Downloads a GitHub repository zipball and extracts it to a unique temp directory.
 *
 * @returns {Promise<{ sourceRoot: string, cleanup: () => Promise<void>, tempDir: string }>}
 */
export async function fetchAndExtractRepo({
  owner,
  repo,
  branch,
  githubToken = process.env.GITHUB_TOKEN,
}) {
  if (!owner || !repo || !branch) {
    throw new RepoFetchError('owner, repo, and branch are required.', {
      code: 'INVALID_INPUT',
      statusCode: 400,
    });
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `review-${randomUUID()}-`));

  try {
    const zipBuffer = await downloadZipball({ owner, repo, branch, githubToken });
    extractZipToDirectory(zipBuffer, tempDir);

    const sourceRoot = await resolveSourceRoot(tempDir);
    await assertSourceRootNotEmpty(sourceRoot);

    const cleanup = async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    };

    return { sourceRoot, cleanup, tempDir };
  } catch (error) {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}
