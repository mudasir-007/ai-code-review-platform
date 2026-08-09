const SEVERITY_STYLE = {
  error: { rail: 'bg-error', text: 'text-error', label: 'Error' },
  warning: { rail: 'bg-warn', text: 'text-warn', label: 'Warning' },
  info: { rail: 'bg-textMuted', text: 'text-textMuted', label: 'Info' },
};

const CATEGORY_LABEL = {
  security: 'Security',
  lint: 'Lint',
  style: 'Style',
  logic: 'Logic',
  performance: 'Performance',
};

/** One file's worth of issues, grouped, ordered by severity. */
export default function IssueFileGroup({ file, issues }) {
  const sorted = [...issues].sort((a, b) => {
    const order = { error: 0, warning: 1, info: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border bg-surfaceRaised">
        <p className="font-mono text-sm text-text truncate">{file}</p>
      </div>
      <ul>
        {sorted.map((issue, i) => {
          const sev = SEVERITY_STYLE[issue.severity] ?? SEVERITY_STYLE.info;
          return (
            <li
              key={i}
              className="relative flex gap-3 px-4 py-3.5 border-b border-border last:border-b-0"
            >
              <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${sev.rail}`} aria-hidden="true" />
              <div className="flex-1 min-w-0 pl-2">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className={`font-mono text-xs font-medium ${sev.text}`}>{sev.label}</span>
                  <span className="text-xs text-textMuted">
                    {CATEGORY_LABEL[issue.category] ?? issue.category}
                  </span>
                  {issue.line != null && (
                    <span className="font-mono text-xs text-textMuted">line {issue.line}</span>
                  )}
                </div>
                <p className="text-sm text-text mb-1">{issue.message}</p>
                {issue.suggestion && (
                  <p className="text-sm text-textMuted">
                    <span className="text-signal">Fix: </span>
                    {issue.suggestion}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
