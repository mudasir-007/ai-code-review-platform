/**
 * reviewService.js
 *
 * Full pipeline orchestrator:
 *   1. Fetch & extract repo   (repoService)
 *   2. Scan for secrets       (secretScanner)
 *   3. Run all linters        (linterService)
 *   4. Build AI prompt
 *   5. Call AI with fallback  (aiProviderService)
 *   6. Parse & return ReviewReport
 */

import { fetchAndExtractRepo, RepoFetchError } from './repoService.js';
import { runLinters } from './linterService.js';
import { generateReview, ReviewGenerationError } from './aiProviderService.js';

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
 * @typedef {Object} ReviewReport
 * @property {string}        repoUrl
 * @property {string[]}      languages
 * @property {'groq'|'gemini'} providerUsed
 * @property {string}        summary
 * @property {number}        score          - 0–100 code health score
 * @property {ReviewIssue[]} issues
 * @property {number}        secretsFound
 * @property {number}        lintIssuesFound
 * @property {object}        linterRuns     - Per-linter status summary
 * @property {string}        generatedAt
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

function buildUserPrompt({ repoUrl, languages, lintResults, linterRuns }) {
  const lines = [];

  lines.push(`## Repository: ${repoUrl}`);
  lines.push(`## Detected Languages: ${languages.join(', ') || 'unknown'}`);
  lines.push('');

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

// ─── GitHub URL parser ────────────────────────────────────────────────────────

function parseGitHubUrl(repoUrl) {
  const match = repoUrl
    .trim()
    .replace(/\.git$/, '')
    .match(/github\.com[/:]([^/]+)\/([^/]+)/);

  if (!match) {
    throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
  }

  return { owner: match[1], repo: match[2] };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Runs the full review pipeline against a GitHub repository.
 *
 * @param {object}  options
 * @param {string}  options.repoUrl      - e.g. https://github.com/owner/repo
 * @param {string}  [options.branch]     - Branch to review (default: main)
 * @param {string}  [options.githubToken]- GitHub PAT for private repos
 * @returns {Promise<ReviewReport>}
 */
export async function reviewRepository({ repoUrl, branch = 'main', githubToken }) {
  const { owner, repo } = parseGitHubUrl(repoUrl);

  // ── Step 1: Fetch repo ─────────────────────────────────────────────────────
  const { sourceRoot, cleanup } = await fetchAndExtractRepo({
    owner,
    repo,
    branch,
    githubToken,
  });

  try {
    // ── Step 2 + 3: Lint (secrets scanner can be added here later) ────────────
    const { results: lintResults, runs: linterRuns, detection } = await runLinters(sourceRoot);

    const totalLintIssues = lintResults.reduce((sum, f) => sum + f.issues.length, 0);

    // ── Step 4: Build prompt ──────────────────────────────────────────────────
    const userPrompt = buildUserPrompt({
      repoUrl,
      languages: detection.languages,
      lintResults,
      linterRuns,
    });

    // ── Step 5: Call AI ───────────────────────────────────────────────────────
    const { text, providerUsed } = await generateReview(SYSTEM_PROMPT, userPrompt);

    // ── Step 6: Parse & assemble report ──────────────────────────────────────
    const { summary, score, issues } = parseAiResponse(text);

    /** @type {ReviewReport} */
    const report = {
      repoUrl,
      languages: detection.languages,
      providerUsed,
      summary,
      score,
      issues,
      secretsFound: 0,       // secret scanner integration point
      lintIssuesFound: totalLintIssues,
      linterRuns: linterRuns.map((r) => ({
        linter: r.linter,
        status: r.status,
        issueCount: r.results.reduce((s, f) => s + f.issues.length, 0),
        reason: r.reason,
      })),
      generatedAt: new Date().toISOString(),
    };

    return report;
  } finally {
    // Always clean up temp directory
    await cleanup();
  }
}
