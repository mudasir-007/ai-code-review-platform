/**
 * fixGenerationService.js
 *
 * Second AI pass, only triggered when scoringService.shouldOpenPr() says the
 * review is bad enough. Takes the highest-severity issues plus the diff
 * hunks (or full file content, for a full review) that produced them and
 * asks the model for a corrected version of each affected file — not just a
 * description of the fix, an actual patch we can commit.
 *
 * Reuses aiProviderService.generateReview() as a generic Groq→Gemini caller;
 * only the prompt and response shape are specific to this step.
 */

import { generateReview } from './aiProviderService.js';

const MAX_ISSUES_TO_FIX = 10;
const MAX_FILES_TO_FIX = 6;

const SYSTEM_PROMPT = `You are an expert software engineer producing minimal, correct code fixes.

IMPORTANT: You MUST respond with ONLY valid JSON — no markdown, no code fences, no prose before or after.

Your response must match this exact schema:
{
  "prTitle": "<short imperative PR title, e.g. 'Fix null-check and SQL injection issues'>",
  "prBody": "<2-4 sentence PR description summarizing what was fixed and why>",
  "fixes": [
    {
      "file": "<relative file path, must match one of the provided files exactly>",
      "newContent": "<the FULL corrected file content, not a diff>",
      "explanation": "<1-2 sentences on what changed in this file>"
    }
  ]
}

Rules:
- Only include files you are actually changing.
- newContent must be the complete file — it will directly replace the file on disk.
- Make the smallest change that fixes the flagged issue(s); do not refactor unrelated code.
- Preserve existing formatting/style conventions visible in the file.
- If you cannot safely fix an issue without more context, omit that file rather than guessing.`;

function buildUserPrompt({ repoUrl, issues, fileContents }) {
  const lines = [];
  lines.push(`## Repository: ${repoUrl}`);
  lines.push('');
  lines.push(`## Issues to fix (${issues.length})`);
  for (const issue of issues) {
    lines.push(`- [${issue.severity.toUpperCase()}] ${issue.file}:${issue.line ?? '?'} — ${issue.message}`);
    if (issue.suggestion) lines.push(`  suggestion: ${issue.suggestion}`);
  }
  lines.push('');
  lines.push('## Current file contents');
  for (const [file, content] of Object.entries(fileContents)) {
    lines.push(`\n### ${file}`);
    lines.push('```');
    lines.push(content);
    lines.push('```');
  }
  lines.push('');
  lines.push('---');
  lines.push('Produce the JSON response now.');
  return lines.join('\n');
}

function parseFixResponse(text) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { parsed = JSON.parse(match[0]); } catch { /* fall through */ }
    }
  }
  if (!parsed || typeof parsed !== 'object') {
    return { prTitle: 'Automated fixes from AI code review', prBody: '', fixes: [] };
  }
  return {
    prTitle: typeof parsed.prTitle === 'string' ? parsed.prTitle : 'Automated fixes from AI code review',
    prBody: typeof parsed.prBody === 'string' ? parsed.prBody : '',
    fixes: Array.isArray(parsed.fixes)
      ? parsed.fixes
          .filter((f) => typeof f.file === 'string' && typeof f.newContent === 'string')
          .map((f) => ({ file: f.file, newContent: f.newContent, explanation: f.explanation ?? '' }))
      : [],
  };
}

/**
 * @param {object} options
 * @param {string} options.repoUrl
 * @param {Array}  options.issues        - the report's issues (already sorted worst-first by caller)
 * @param {Record<string,string>} options.fileContents - path -> current full file content, for every
 *                                          file referenced by `issues` (capped to MAX_FILES_TO_FIX)
 * @returns {Promise<{ prTitle: string, prBody: string, fixes: Array<{file:string,newContent:string,explanation:string}>, providerUsed: string }>}
 */
export async function generateFixes({ repoUrl, issues, fileContents }) {
  const topIssues = [...issues]
    .sort((a, b) => {
      const order = { error: 0, warning: 1, info: 2 };
      return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
    })
    .slice(0, MAX_ISSUES_TO_FIX);

  const filesNeeded = [...new Set(topIssues.map((i) => i.file))].slice(0, MAX_FILES_TO_FIX);
  const scopedFileContents = Object.fromEntries(
    filesNeeded.filter((f) => fileContents[f] !== undefined).map((f) => [f, fileContents[f]]),
  );

  const userPrompt = buildUserPrompt({ repoUrl, issues: topIssues, fileContents: scopedFileContents });
  const { text, providerUsed } = await generateReview(SYSTEM_PROMPT, userPrompt);
  const { prTitle, prBody, fixes } = parseFixResponse(text);

  return { prTitle, prBody, fixes, providerUsed };
}
