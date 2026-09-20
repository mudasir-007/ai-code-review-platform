export default function PrBanner({ pr }) {
  // pr is null when autoPr wasn't requested for this review — render nothing,
  // don't imply a PR decision was made when it wasn't asked for.
  if (!pr) return null;

  if (pr.opened) {
    return (
      <div className="rounded-lg border border-ok/30 bg-ok/5 p-4 mb-6 flex items-start gap-3">
        <span className="h-1.5 w-1.5 rounded-full bg-ok mt-1.5 flex-shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm text-ok font-medium mb-0.5">Fix PR opened</p>
          <p className="text-sm text-textMuted mb-2">{pr.reason}</p>
          <a
            href={pr.prUrl}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs text-signal hover:underline break-all"
          >
            {pr.prUrl} →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 mb-6 flex items-start gap-3">
      <span className="h-1.5 w-1.5 rounded-full bg-textMuted mt-1.5 flex-shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm text-text font-medium mb-0.5">No PR opened</p>
        <p className="text-sm text-textMuted">{pr.reason}</p>
      </div>
    </div>
  );
}
