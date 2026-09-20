/**
 * scoringService.js
 *
 * Gatekeeper between "just report the issues" and "also open a PR with
 * fixes". Kept deliberately simple and tunable via env vars rather than
 * hardcoded, since what counts as "bad enough" is a judgment call.
 */

const SEVERITY_WEIGHT = { error: 3, warning: 1, info: 0 };

const DEFAULT_OPTIONS = {
  // Below this health score, auto-PR is considered regardless of issue count.
  scoreThreshold: Number(process.env.PR_SCORE_THRESHOLD ?? 60),
  // Weighted issue count (errors × 3 + warnings × 1) above which auto-PR fires
  // even if the score itself isn't terrible.
  weightedIssueThreshold: Number(process.env.PR_ISSUE_THRESHOLD ?? 8),
  // Never auto-PR when nothing but 'info' issues were found.
  minSeverity: 'warning',
};

/**
 * @param {Array<{ severity: 'error'|'warning'|'info' }>} issues
 * @returns {number}
 */
export function computeWeightedIssueScore(issues = []) {
  return issues.reduce((sum, issue) => sum + (SEVERITY_WEIGHT[issue.severity] ?? 0), 0);
}

/**
 * @param {object}   report
 * @param {number}   report.score   - 0-100 health score from the AI review
 * @param {Array}    report.issues
 * @param {object}   [options]
 * @returns {{ shouldOpenPr: boolean, reason: string, weightedIssueScore: number }}
 */
export function shouldOpenPr(report, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const weightedIssueScore = computeWeightedIssueScore(report.issues);

  const hasErrorOrWarning = report.issues.some(
    (i) => SEVERITY_WEIGHT[i.severity] >= SEVERITY_WEIGHT[opts.minSeverity],
  );

  if (!hasErrorOrWarning) {
    return { shouldOpenPr: false, reason: 'no error/warning-level issues found', weightedIssueScore };
  }

  if (report.score < opts.scoreThreshold) {
    return {
      shouldOpenPr: true,
      reason: `health score ${report.score} is below threshold ${opts.scoreThreshold}`,
      weightedIssueScore,
    };
  }

  if (weightedIssueScore >= opts.weightedIssueThreshold) {
    return {
      shouldOpenPr: true,
      reason: `weighted issue score ${weightedIssueScore} is at/above threshold ${opts.weightedIssueThreshold}`,
      weightedIssueScore,
    };
  }

  return { shouldOpenPr: false, reason: 'issues present but under both thresholds', weightedIssueScore };
}
