/**
 * mergeService.js
 *
 * Combines a new (diff-only) set of findings with the issues carried over
 * from the repository's previous review, so an incremental review's report
 * still reads like a full picture of the repo — not just "here's what's
 * wrong with the 2 files you just touched".
 *
 * Rules:
 *   - Any previously-found issue in a file that was changed/removed this
 *     round is dropped — it's stale, the file has moved on and was
 *     re-reviewed (or no longer exists).
 *   - Issues in a file that was renamed are carried forward under the new
 *     path instead of being dropped.
 *   - Issues in untouched files are kept as-is.
 *   - New issues from this round are appended.
 */

function issueKey(issue) {
  return `${issue.file}::${issue.line ?? '?'}::${issue.ruleId ?? issue.category ?? ''}::${issue.message}`;
}

/**
 * @param {Array} previousIssues - issues from the repository's last stored Review
 * @param {Array} newIssues      - issues produced by this round's (diff-scoped) AI review
 * @param {Array<{ filename: string, previousFilename: string|null, status: string }>} changedFiles
 * @returns {Array} merged, deduplicated issue list
 */
export function mergeFindings(previousIssues = [], newIssues = [], changedFiles = []) {
  const removedPaths = new Set(
    changedFiles.filter((f) => f.status === 'removed').map((f) => f.filename),
  );
  const touchedOldPaths = new Set(
    changedFiles
      .filter((f) => f.status !== 'added')
      .map((f) => f.previousFilename ?? f.filename),
  );
  const renameMap = new Map(
    changedFiles
      .filter((f) => f.status === 'renamed' && f.previousFilename)
      .map((f) => [f.previousFilename, f.filename]),
  );

  const carriedOver = previousIssues
    .filter((issue) => !removedPaths.has(issue.file) && !touchedOldPaths.has(issue.file))
    .map((issue) => {
      const renamedTo = renameMap.get(issue.file);
      return renamedTo ? { ...issue, file: renamedTo } : issue;
    });

  // Findings for a renamed file that WAS re-reviewed already arrive under the
  // new path in newIssues, so carriedOver above intentionally drops the old
  // path's stale copies rather than trying to merge them.

  const merged = [...carriedOver, ...newIssues];

  const seen = new Set();
  const deduped = [];
  for (const issue of merged) {
    const key = issueKey(issue);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(issue);
  }

  return deduped;
}
