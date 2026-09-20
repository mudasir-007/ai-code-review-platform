import ModeBadge from './ModeBadge.jsx';

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ReviewHistoryList({ reviews, loading, error }) {
  if (loading) {
    return <p className="text-sm text-textMuted font-mono">Loading history…</p>;
  }

  if (error) {
    return <p className="text-sm text-error font-mono">{error}</p>;
  }

  if (!reviews || reviews.length === 0) {
    return <p className="text-sm text-textMuted font-mono">No reviews yet.</p>;
  }

  return (
    <ul className="space-y-2 border-t border-border pt-4">
      {reviews.map((review) => (
        <li
          key={review.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surfaceRaised px-3 py-2.5"
        >
          <div className="flex items-center gap-3 min-w-0">
            <ModeBadge mode={review.mode} changedFiles={review.changedFiles} />
            <span className="font-display text-sm font-medium">{review.score ?? '—'}/100</span>
            <span className="text-xs text-textMuted font-mono truncate">{formatDate(review.createdAt)}</span>
          </div>
          {review.prCreated && review.prUrl ? (
            <a
              href={review.prUrl}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs text-signal hover:underline flex-shrink-0"
            >
              PR #{review.prNumber} →
            </a>
          ) : (
            <span className="font-mono text-xs text-textMuted flex-shrink-0">no PR</span>
          )}
        </li>
      ))}
    </ul>
  );
}
