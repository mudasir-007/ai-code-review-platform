import { useState } from 'react';

const STATUS_STYLE = {
  success: { dot: 'bg-ok', text: 'text-ok' },
  failed: { dot: 'bg-textMuted', text: 'text-textMuted' },
  skipped: { dot: 'bg-textMuted', text: 'text-textMuted' },
};

function statusMessage(run) {
  if (run.status === 'success') {
    return run.issueCount > 0 ? `${run.issueCount} issue${run.issueCount === 1 ? '' : 's'}` : 'Clean';
  }
  if (run.status === 'failed') {
    return run.reason === 'binary_not_found' ? 'Not installed on this server' : 'Did not run';
  }
  return 'Skipped — no matching files';
}

export default function LinterRunPanel({ runs }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="font-mono text-sm text-text">
          Linter runs <span className="text-textMuted">({runs.length})</span>
        </span>
        <span className="text-textMuted text-sm">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <ul className="border-t border-border divide-y divide-border">
          {runs.map((run) => {
            const style = STATUS_STYLE[run.status] ?? STATUS_STYLE.skipped;
            return (
              <li key={run.linter} className="flex items-center gap-3 px-4 py-2.5">
                <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${style.dot}`} aria-hidden="true" />
                <span className="font-mono text-sm text-text flex-1">{run.linter}</span>
                <span className={`text-xs ${style.text}`}>{statusMessage(run)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
