export default function BlockedSecrets({ error, onNewReview }) {
  const findings = error.details?.findings ?? [];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-lg animate-slideIn">
        <div className="relative rounded-lg border border-error/40 bg-surface overflow-hidden">
          <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-error" aria-hidden="true" />
          <div className="p-6 pl-7">
            <p className="font-mono text-xs uppercase tracking-widest text-error mb-2">
              Review stopped
            </p>
            <h1 className="font-display text-xl font-semibold mb-3">
              This repository wasn't reviewed.
            </h1>
            <p className="text-textMuted leading-relaxed mb-5">
              The secret scan found {error.details?.findingsCount ?? findings.length} likely
              credential{(error.details?.findingsCount ?? findings.length) === 1 ? '' : 's'} in
              the repository. To avoid sending credentials to an AI provider, the review did
              not continue past this step.
            </p>

            {findings.length > 0 && (
              <ul className="space-y-2 mb-2">
                {findings.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-md border border-border
                      bg-surfaceRaised px-3 py-2"
                  >
                    <span className="font-mono text-xs text-text truncate">
                      {f.filePath}:{f.line}
                    </span>
                    <span className="text-xs text-textMuted flex-shrink-0">{f.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <p className="text-sm text-textMuted mt-4">
          Remove or rotate these credentials, then run the review again.
        </p>

        <button
          type="button"
          onClick={onNewReview}
          className="mt-5 rounded-lg border border-border px-4 py-2.5 text-sm text-text
            hover:border-signal transition-colors"
        >
          Try a different repository
        </button>
      </div>
    </div>
  );
}
