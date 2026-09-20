/**
 * reviewService.js
 *
 * Full pipeline orchestrator:
 *   1. Validate repo via GitHub API  (validationService) — rate-limit, empty, archived, default-branch
 *   2. Fetch & extract repo           (repoService)
 *   3. Scan for secrets               (secretScanner)   — blocks pipeline if secrets found
 *   4. Run all linters                (linterService)
 *   5. Build AI prompt — full repo, or (if baseSha is given) just the diff
 *   6. Call AI with fallback          (aiProviderService)
 *   7. Parse & assemble ReviewReport  — merging with previousIssues when incremental
 *   8. If findings are bad enough and autoPr is on, open a fix PR (prService)
 */

import { fetchAndExtractRepo, RepoFetchError } from './repoService.js';
import { runLinters } from './linterService.js';
import { generateReview, ReviewGenerationError } from './aiProviderService.js';
import { validateGitHubRepository, ValidationError } from './validationService.js';
import { scanForSecrets } from './secretScanner.js';
import { getLatestCommitSha, compareCommits, DiffError } from './githubDiffService.js';
import { mergeFindings } from './mergeService.js';
import { shouldOpenPr } from './scoringService.js';
import { openFixPr } from './prService.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Max lint issues sent to AI (keeps prompt within token budget) */
const MAX_LINT_ISSUES_IN_PROMPT = 60;

/** Max files to show full issue lists for */
const MAX_FILES_IN_PROMPT = 20;

// ─── Typedefs ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ReviewIssue
 * @property {string}      file
 * @property {number|null} line
 * @property {'error'|'warning'|'info'} severity
 * @property {'security'|'lint'|'style'|'logic'|'performance'} category
 * @property {string} message
 * @property {string} suggestion
 */

/**
 * @typedef {Object} SecretFinding
 * @property {string} filePath
 * @property {number} line
 * @property {string} patternId
 * @property {string} label
 * @property {string} matchPreview  - Already redacted by secretScanner (safe to surface)
 */

/**
 * @typedef {Object} ReviewReport
 * @property {string}          repoUrl
 * @property {string}          defaultBranch    - Actual default branch read from GitHub metadata
 * @property {string[]}        languages
 * @property {'groq'|'gemini'} providerUsed
 * @property {string}          summary
 * @property {number}          score            - 0–100 code health score
 * @property {ReviewIssue[]}   issues
 * @property {number}          secretsFound
 * @property {SecretFinding[]} secretFindings   - Redacted findings (safe to return to caller)
 * @property {object[]}        validationWarnings - Warnings from repo metadata (archived, fork, large)
 * @property {number}          lintIssuesFound
 * @property {object}          linterRuns       - Per-linter status summary
 * @property {string}          generatedAt
 */

// ─── Prompt builder ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert code reviewer. You analyze repositories and produce structured, actionable code reviews.

IMPORTANT: You MUST respond with ONLY valid JSON — no markdown, no code fences, no prose before or after.

Your response must match this exact schema:
{
  "summary": "<2-3 sentence overall verdict>",
  "score": <integer 0-100, code health score>,
  "issues": [
    {
      "file": "<relative file path>",
      "line": <line number or null>,
      "severity": "<error|warning|info>",
      "category": "<security|lint|style|logic|performance>",
      "message": "<what the problem is>",
      "suggestion": "<how to fix it>"
    }
  ]
}

Scoring guide:
- 90-100: Excellent, production-ready
- 70-89:  Good, minor issues
- 50-69:  Fair, several issues to address
- 30-49:  Poor, significant problems
- 0-29:   Critical issues, major rework needed

Focus on:
1. Security vulnerabilities (highest priority)
2. Logic errors and bugs
3. Performance issues
4. Code quality and maintainability
5. Style and best practices

Be concise and actionable. Maximum 15 issues.`;

function buildUserPrompt({ repoUrl, languages, lintResults, linterRuns, secretScanWarnings, validationWarnings }) {
  const lines = [];

  lines.push(`## Repository: ${repoUrl}`);
  lines.push(`## Detected Languages: ${languages.join(', ') || 'unknown'}`);
  lines.push('');

  // ── Validation warnings (archived, fork, large repo, etc.) ───────────────
  if (validationWarnings && validationWarnings.length > 0) {
    lines.push('## Repository Metadata Warnings');
    for (const w of validationWarnings) {
      lines.push(`- [${w.code}] ${w.message}`);
    }
    lines.push('');
  }

  // ── Secret scan warnings (non-blocking — only shown if scanner ran but
  //    somehow produced no blocking findings, e.g. stats/skipped notices) ──
  if (secretScanWarnings && secretScanWarnings.length > 0) {
    lines.push('## Secret Scan Notices');
    for (const w of secretScanWarnings) {
      lines.push(`- ${w}`);
    }
    lines.push('');
  }

  // ── Linter run summary ───────────────────────────────────────────────────
  lines.push('## Linter Run Summary');
  for (const run of linterRuns) {
    if (run.status === 'success') {
      lines.push(`- ${run.linter}: ✓ ${run.results.length} files with issues`);
    } else if (run.status === 'failed') {
      lines.push(`- ${run.linter}: ✗ ${run.reason === 'binary_not_found' ? 'not installed' : run.error}`);
    }
  }
  lines.push('');

  // ── Lint findings ────────────────────────────────────────────────────────
  const allIssues = lintResults.flatMap((f) =>
    f.issues.map((i) => ({ ...i, file: f.filePath })),
  );

  const totalIssues = allIssues.length;
  const cappedIssues = allIssues
    .sort((a, b) => {
      const order = { error: 0, warning: 1, info: 2 };
      return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
    })
    .slice(0, MAX_LINT_ISSUES_IN_PROMPT);

  lines.push(`## Lint Findings (showing ${cappedIssues.length} of ${totalIssues} total)`);

  if (cappedIssues.length === 0) {
    lines.push('No lint issues found.');
  } else {
    // Group by file
    const byFile = new Map();
    for (const issue of cappedIssues) {
      if (!byFile.has(issue.file)) byFile.set(issue.file, []);
      byFile.get(issue.file).push(issue);
    }

    let fileCount = 0;
    for (const [file, issues] of byFile) {
      if (fileCount >= MAX_FILES_IN_PROMPT) break;
      lines.push(`\n### ${file}`);
      for (const issue of issues) {
        lines.push(`  [${issue.severity.toUpperCase()}] L${issue.line ?? '?'} [${issue.ruleId}] ${issue.message}`);
      }
      fileCount++;
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('Analyze the above findings and produce a structured JSON review report.');

  return lines.join('\n');
}

const SYSTEM_PROMPT_INCREMENTAL = `You are an expert code reviewer. You are reviewing ONLY the lines that changed in a set of commits, not the whole repository — files outside this diff were already reviewed previously and must not be re-flagged.

IMPORTANT: You MUST respond with ONLY valid JSON — no markdown, no code fences, no prose before or after.

Your response must match this exact schema:
{
  "summary": "<2-3 sentence verdict on THIS diff specifically>",
  "score": <integer 0-100, health score of the changed code in this diff>,
  "issues": [
    {
      "file": "<relative file path, must be one of the changed files>",
      "line": <line number within the new version of the file, or null>,
      "severity": "<error|warning|info>",
      "category": "<security|lint|style|logic|performance>",
      "message": "<what the problem is>",
      "suggestion": "<how to fix it>"
    }
  ]
}

Scoring guide (for this diff only):
- 90-100: Excellent, production-ready
- 70-89:  Good, minor issues
- 50-69:  Fair, several issues to address
- 30-49:  Poor, significant problems
- 0-29:   Critical issues, major rework needed

Only flag issues introduced by, or clearly visible within, the diff hunks below. Do not comment on unchanged code you cannot see. Maximum 15 issues.`;

function buildIncrementalUserPrompt({ repoUrl, changedFiles, lintResults }) {
  const lines = [];
  lines.push(`## Repository: ${repoUrl}`);
  lines.push(`## Files changed in this diff: ${changedFiles.length}`);
  lines.push('');

  lines.push('## Diff');
  for (const file of changedFiles) {
    lines.push(`\n### ${file.filename} (${file.status})`);
    if (file.previousFilename) lines.push(`renamed from: ${file.previousFilename}`);
    if (file.patch) {
      lines.push('```diff');
      lines.push(file.patch);
      lines.push('```');
    } else {
      lines.push('(no patch available — file is binary, or the diff is too large to inline; skip detailed review of this file)');
    }
  }

  const relevantLint = lintResults.filter((f) =>
    changedFiles.some((c) => c.filename === f.filePath),
  );
  if (relevantLint.length > 0) {
    lines.push('\n## Lint findings for changed files');
    for (const f of relevantLint) {
      for (const issue of f.issues) {
        lines.push(`  [${issue.severity.toUpperCase()}] ${f.filePath}:L${issue.line ?? '?'} [${issue.ruleId}] ${issue.message}`);
      }
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('Review only the diff above and produce the structured JSON review report.');
  return lines.join('\n');
}

// ─── Response parser ──────────────────────────────────────────────────────────

function parseAiResponse(text) {
  // Strip markdown fences if model ignores instructions
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Last resort: try to extract JSON object from anywhere in the response
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { parsed = JSON.parse(match[0]); } catch { /* fall through */ }
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    // Fallback report when AI returns unexpected format
    return {
      summary: text.slice(0, 300),
      score: 50,
      issues: [],
    };
  }

  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    score: typeof parsed.score === 'number'
      ? Math.max(0, Math.min(100, Math.round(parsed.score)))
      : 50,
    issues: Array.isArray(parsed.issues)
      ? parsed.issues.map((i) => ({
          file:       typeof i.file       === 'string' ? i.file       : 'unknown',
          line:       typeof i.line       === 'number' ? i.line       : null,
          severity:   ['error', 'warning', 'info'].includes(i.severity) ? i.severity : 'info',
          category:   ['security', 'lint', 'style', 'logic', 'performance'].includes(i.category)
                        ? i.category : 'lint',
          message:    typeof i.message    === 'string' ? i.message    : '',
          suggestion: typeof i.suggestion === 'string' ? i.suggestion : '',
        }))
      : [],
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Runs the review pipeline against a GitHub repository — full or incremental.
 *
 * @param {object}  options
 * @param {string}  options.repoUrl        - e.g. https://github.com/owner/repo
 * @param {string}  [options.branch]       - Branch to review; defaults to the repo's actual
 *                                          default_branch read from GitHub metadata.
 * @param {string}  [options.githubToken]  - GitHub PAT (repo scope needed for private repos / auto-PR)
 * @param {string}  [options.baseSha]      - Previously reviewed commit sha. When provided, only the
 *                                          diff between this sha and current HEAD is linted/reviewed.
 *                                          Falls back to a full review if the diff can't be computed
 *                                          (e.g. force-push moved history — see DiffError).
 * @param {Array}   [options.previousIssues] - Issues carried over from the repository's last stored
 *                                          Review, used to produce a merged/deduped issue list when
 *                                          baseSha is set.
 * @param {boolean} [options.autoPr]       - If true and findings cross scoringService's threshold,
 *                                          open a PR with AI-generated fixes (requires a write-scoped
 *                                          githubToken).
 * @returns {Promise<ReviewReport & { mode: 'full'|'incremental', baseSha: string|null, headSha: string, changedFiles: string[], pr: object|null }>}
 */
export async function reviewRepository({ repoUrl, branch, githubToken, baseSha = null, previousIssues = [], autoPr = false }) {

  // ── Step 1: Validate repo via GitHub API ──────────────────────────────────
  // Checks: URL format, gist rejection, rate-limit, repo existence, 401/403,
  // empty repo, archived flag, fork notice, default_branch, repo size.
  const {
    owner,
    repo,
    defaultBranch,
    metadata,
    warnings: validationWarnings,
  } = await validateGitHubRepository(repoUrl, { githubToken });

  // Prefer an explicit branch override from the caller; fall back to the
  // actual default branch from GitHub metadata (never hardcode 'main').
  const targetBranch = branch ?? defaultBranch;

  // ── Step 1b: Resolve current HEAD + diff, when this is an incremental run ──
  // Done before the (expensive) zipball fetch so a force-push/rewrite can be
  // detected and the caller can decide whether to retry as a full review.
  const headSha = await getLatestCommitSha({ owner, repo, branch: targetBranch, githubToken });

  let changedFiles = null; // null = full review; [] = incremental, nothing changed
  if (baseSha) {
    if (baseSha === headSha) {
      changedFiles = [];
    } else {
      // Lets DiffError (e.g. BASE_NOT_COMPARABLE after a force-push) bubble up
      // to the caller, which should retry with baseSha: null for a full review.
      const diff = await compareCommits({ owner, repo, base: baseSha, head: headSha, githubToken });
      changedFiles = diff.changedFiles;
    }
  }

  // Nothing changed since the last review — skip linting/AI entirely.
  if (changedFiles && changedFiles.length === 0) {
    return {
      repoUrl,
      defaultBranch: targetBranch,
      mode: 'incremental',
      baseSha,
      headSha,
      changedFiles: [],
      languages: [],
      providerUsed: null,
      summary: 'No changes since the last review.',
      score: null,
      issues: previousIssues,
      secretsFound: 0,
      secretFindings: [],
      validationWarnings,
      lintIssuesFound: previousIssues.length,
      linterRuns: [],
      generatedAt: new Date().toISOString(),
      pr: null,
    };
  }

  // ── Step 2: Fetch & extract repo ──────────────────────────────────────────
  // Still needed even for incremental reviews — the linters run against files
  // on disk, and a fix PR needs the current file contents. Only the AI prompt
  // (the expensive, token-metered step) is actually scoped down below.
  // Pass metadata.size so repoService can enforce the pre-download size cap
  // without re-fetching metadata.
  const { sourceRoot, cleanup } = await fetchAndExtractRepo({
    owner,
    repo,
    branch: targetBranch,
    githubToken,
    maxRepoSizeKb: typeof metadata.size === 'number' ? metadata.size : null,
  });

  try {
    // ── Step 3: Scan for secrets ─────────────────────────────────────────────
    // Must run BEFORE linting and before any AI call so we never send secrets
    // to an external provider.
    const secretScanResult = await scanForSecrets(sourceRoot);

    if (secretScanResult.findings.length > 0) {
      // Surface the redacted findings to the caller — matchPreview values are
      // already truncated to 6 chars + '***REDACTED***' by the scanner.
      throw new ValidationError(
        `Secret scan detected ${secretScanResult.findings.length} potential secret(s) in the repository. ` +
        'Review aborted to prevent leaking credentials to the AI provider.',
        {
          code: 'SECRETS_FOUND',
          statusCode: 422,
          details: {
            findingsCount: secretScanResult.findings.length,
            findings: secretScanResult.findings,  // redacted previews only
            scanStats: secretScanResult.stats,
          },
        },
      );
    }

    // ── Step 4: Run all linters ───────────────────────────────────────────────
    // Note: linters still run over the whole checkout (rewiring all 13 linter
    // integrations to accept a file allowlist is future work) — but for an
    // incremental run we immediately filter the *results* down to changed
    // files below, so only relevant findings ever reach the prompt.
    const { results: allLintResults, runs: linterRuns, detection } = await runLinters(sourceRoot);

    const lintResults = changedFiles
      ? allLintResults.filter((f) => changedFiles.some((c) => c.filename === f.filePath))
      : allLintResults;

    const totalLintIssues = lintResults.reduce((sum, f) => sum + f.issues.length, 0);

    // ── Step 5: Build prompt ──────────────────────────────────────────────────
    // Incremental: only diff hunks + lint findings for changed files.
    // Full: whole-repo lint summary, as before.
    const userPrompt = changedFiles
      ? buildIncrementalUserPrompt({ repoUrl, changedFiles, lintResults })
      : buildUserPrompt({
          repoUrl,
          languages: detection.languages,
          lintResults,
          linterRuns,
          secretScanWarnings: secretScanResult.warnings,  // non-fatal scanner notices
          validationWarnings,
        });

    // ── Step 6: Call AI ───────────────────────────────────────────────────────
    const { text, providerUsed } = await generateReview(
      changedFiles ? SYSTEM_PROMPT_INCREMENTAL : SYSTEM_PROMPT,
      userPrompt,
    );

    // ── Step 7: Parse & assemble report ──────────────────────────────────────
    const { summary, score, issues: newIssues } = parseAiResponse(text);

    // When incremental, merge this round's findings with the carried-over
    // issue set (dropping stale entries for files that were just re-reviewed
    // or removed) so the report still reflects the whole repo's outstanding
    // issues, not just the two files someone happened to touch.
    const issues = changedFiles ? mergeFindings(previousIssues, newIssues, changedFiles) : newIssues;

    /** @type {ReviewReport} */
    const report = {
      repoUrl,
      defaultBranch: targetBranch,
      mode: changedFiles ? 'incremental' : 'full',
      baseSha,
      headSha,
      changedFiles: changedFiles ? changedFiles.map((f) => f.filename) : [],
      languages: detection.languages,
      providerUsed,
      summary,
      score,
      issues,
      secretsFound: secretScanResult.stats.findingsCount,
      secretFindings: [],   // empty — pipeline only reaches here when zero secrets found
      validationWarnings,
      lintIssuesFound: totalLintIssues,
      linterRuns: linterRuns.map((r) => ({
        linter: r.linter,
        status: r.status,
        issueCount: r.results.reduce((s, f) => s + f.issues.length, 0),
        reason: r.reason,
      })),
      generatedAt: new Date().toISOString(),
      pr: null,
    };

    // ── Step 8: Auto-PR, if requested and findings warrant it ────────────────
    if (autoPr) {
      const decision = shouldOpenPr(report);
      if (decision.shouldOpenPr) {
        report.pr = await openFixPr({
          owner,
          repo,
          repoUrl,
          baseBranch: targetBranch,
          headSha,
          sourceRoot,
          issues: report.issues,
          githubToken,
        });
        report.pr.reason = decision.reason;
      } else {
        report.pr = { opened: false, prUrl: null, prNumber: null, reason: decision.reason };
      }
    }

    return report;
  } finally {
    // Always clean up temp directory regardless of outcome
    await cleanup();
  }
}

export { ValidationError, RepoFetchError, ReviewGenerationError, DiffError };
