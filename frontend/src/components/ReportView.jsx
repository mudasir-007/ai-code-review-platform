import ScoreGauge from './ScoreGauge.jsx';
import IssueFileGroup from './IssueCard.jsx';
import LinterRunPanel from './LinterRunPanel.jsx';

function groupByFile(issues) {
  const map = new Map();
  for (const issue of issues) {
    if (!map.has(issue.file)) map.set(issue.file, []);
    map.get(issue.file).push(issue);
  }
  return [...map.entries()];
}

export default function ReportView({ report, onNewReview }) {
  const fileGroups = groupByFile(report.issues);

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-2xl animate-slideIn">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 gap-4">
          <div className="min-w-0">
            <p className="font-mono text-xs text-textMuted mb-1 truncate">{report.repoUrl}</p>
            <p className="font-mono text-xs text-textMuted">
              {report.defaultBranch} · reviewed with {report.providerUsed}
            </p>
          </div>
          <button
            type="button"
            onClick={onNewReview}
            className="flex-shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-textMuted
              hover:text-text hover:border-signal transition-colors"
          >
            New review
          </button>
        </div>

        {/* Score + summary */}
        <div className="rounded-lg border border-border bg-surface p-6 mb-6">
          <ScoreGauge score={report.score} />
          <p className="text-text mt-5 leading-relaxed">{report.summary}</p>

          {report.languages.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {report.languages.map((lang) => (
                <span
                  key={lang}
                  className="font-mono text-xs px-2 py-1 rounded border border-border text-textMuted"
                >
                  {lang}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Validation warnings */}
        {report.validationWarnings?.length > 0 && (
          <div className="rounded-lg border border-warn/30 bg-warn/5 p-4 mb-6">
            <ul className="space-y-1">
              {report.validationWarnings.map((w, i) => (
                <li key={i} className="text-sm text-warn flex gap-2">
                  <span aria-hidden="true">·</span>
                  {w.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Linter runs */}
        <div className="mb-6">
          <LinterRunPanel runs={report.linterRuns} />
        </div>

        {/* Issues */}
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-display text-lg font-semibold">Findings</h2>
          <span className="text-sm text-textMuted">
            {report.issues.length} issue{report.issues.length === 1 ? '' : 's'}
          </span>
        </div>

        {fileGroups.length === 0 ? (
          <div className="rounded-lg border border-ok/30 bg-ok/5 p-6 text-center">
            <p className="text-ok font-medium">No issues found.</p>
            <p className="text-sm text-textMuted mt-1">Nothing here needs your attention.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {fileGroups.map(([file, issues]) => (
              <IssueFileGroup key={file} file={file} issues={issues} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
