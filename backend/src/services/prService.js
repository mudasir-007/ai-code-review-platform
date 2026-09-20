/**
 * prService.js
 *
 * Orchestrates the "auto-fix PR" flow: generate patches for the worst
 * issues, commit them to a new branch via the Git Data API, open a PR
 * against the reviewed branch. Only called by reviewService when
 * scoringService.shouldOpenPr() returns true.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import axios from 'axios';
import { generateFixes } from './fixGenerationService.js';
import { ensureBranch, commitFixes, GitWriteError } from './githubWriteService.js';

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_API_VERSION = '2022-11-28';

function headers(token) {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
    'User-Agent': 'ai-code-review-platform',
    Authorization: `Bearer ${token}`,
  };
}

async function readFilesFromDisk(sourceRoot, filePaths) {
  const entries = await Promise.all(
    filePaths.map(async (file) => {
      try {
        const content = await fs.readFile(path.join(sourceRoot, file), 'utf-8');
        return [file, content];
      } catch {
        return null; // file unreadable/binary — fixGenerationService will just skip it
      }
    }),
  );
  return Object.fromEntries(entries.filter(Boolean));
}

/**
 * @param {object} options
 * @param {string} options.owner
 * @param {string} options.repo
 * @param {string} options.repoUrl
 * @param {string} options.baseBranch   - branch the PR targets (the one that was reviewed)
 * @param {string} options.headSha      - current HEAD sha of baseBranch, PR branch starts here
 * @param {string} options.sourceRoot   - local checkout of the reviewed repo (from repoService)
 * @param {Array}  options.issues       - report.issues, worst-first not required (fixGenerationService sorts)
 * @param {string} options.githubToken  - needs `repo` scope
 * @returns {Promise<{ opened: boolean, prUrl: string|null, prNumber: number|null, reason?: string }>}
 */
export async function openFixPr({ owner, repo, repoUrl, baseBranch, headSha, sourceRoot, issues, githubToken }) {
  if (!githubToken) {
    return { opened: false, prUrl: null, prNumber: null, reason: 'no githubToken with write access provided' };
  }

  const filesNeeded = [...new Set(issues.map((i) => i.file))];
  const fileContents = await readFilesFromDisk(sourceRoot, filesNeeded);

  const { prTitle, prBody, fixes } = await generateFixes({ repoUrl, issues, fileContents });

  if (!fixes.length) {
    return { opened: false, prUrl: null, prNumber: null, reason: 'AI did not return any safe fixes' };
  }

  const branchName = `ai-review-fixes/${headSha.slice(0, 7)}-${Date.now()}`;

  try {
    await ensureBranch({ owner, repo, branchName, fromSha: headSha, githubToken });

    await commitFixes({
      owner,
      repo,
      branchName,
      baseSha: headSha,
      fixes,
      commitMessage: `fix: ${prTitle}\n\nAutomated fixes generated from an AI code review.`,
      githubToken,
    });

    const prResponse = await axios.post(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls`,
      {
        title: prTitle,
        head: branchName,
        base: baseBranch,
        body: `${prBody}\n\n---\n_Opened automatically by the AI code review pipeline because this review's findings crossed the auto-fix threshold._\n\n**Files changed:**\n${fixes.map((f) => `- \`${f.file}\` — ${f.explanation}`).join('\n')}`,
      },
      { headers: headers(githubToken), validateStatus: () => true },
    );

    if (prResponse.status >= 400) {
      return { opened: false, prUrl: null, prNumber: null, reason: `PR creation failed: ${JSON.stringify(prResponse.data)}` };
    }

    return { opened: true, prUrl: prResponse.data.html_url, prNumber: prResponse.data.number };
  } catch (err) {
    if (err instanceof GitWriteError) {
      return { opened: false, prUrl: null, prNumber: null, reason: err.message };
    }
    throw err;
  }
}
