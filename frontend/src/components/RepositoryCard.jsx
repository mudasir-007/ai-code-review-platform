import { useState } from 'react';

function shortSha(sha) {
  return sha ? sha.slice(0, 7) : null;
}

export default function RepositoryCard({
  repo,
  running,
  onRunReview,
  historyExpanded,
  onToggleHistory,
  children, // history panel, rendered by the parent when expanded
}) {
  const [autoPr, setAutoPr] = useState(false);
  const [forceFull, setForceFull] = useState(false);

  const hasBeenReviewed = !!repo.lastReviewedSha;

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <p className="font-mono text-sm text-text truncate">{repo.fullName}</p>
          <p className="font-mono text-xs text-textMuted mt-1">
            {hasBeenReviewed
              ? `last reviewed at ${shortSha(repo.lastReviewedSha)} on ${repo.lastReviewedBranch}`
              : 'not reviewed yet — next run will be a full review'}
          </p>
        </div>
        <a
          href={repo.url}
          target="_blank"
          rel="noreferrer"
          className="flex-shrink-0 font-mono text-xs text-textMuted hover:text-signal transition-colors"
        >
          view on GitHub ↗
        </a>
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <label className="flex items-center gap-2 text-sm text-textMuted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoPr}
            onChange={(e) => setAutoPr(e.target.checked)}
            disabled={running}
            className="accent-signal"
          />
          Auto-PR if findings cross threshold
        </label>
        {hasBeenReviewed && (
          <label className="flex items-center gap-2 text-sm text-textMuted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={forceFull}
              onChange={(e) => setForceFull(e.target.checked)}
              disabled={running}
              className="accent-signal"
            />
            Force full review (skip diff)
          </label>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onRunReview(repo.id, { autoPr, forceFull })}
          disabled={running}
          className="rounded-md bg-signal px-4 py-2 text-sm font-medium text-ink
            transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {running
            ? 'Reviewing…'
            : hasBeenReviewed && !forceFull
              ? 'Review changes since last time'
              : 'Run full review'}
        </button>
        <button
          type="button"
          onClick={() => onToggleHistory(repo.id)}
          className="rounded-md border border-border px-3 py-2 text-sm text-textMuted
            hover:text-text hover:border-signal transition-colors"
        >
          {historyExpanded ? 'Hide history' : 'History'}
        </button>
      </div>

      {historyExpanded && <div className="mt-4">{children}</div>}
    </div>
  );
}
