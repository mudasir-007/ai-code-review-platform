const STAGES = [
  { id: 'validate', label: 'Validating repository' },
  { id: 'clone', label: 'Cloning repository' },
  { id: 'secrets', label: 'Scanning for secrets' },
  { id: 'lint', label: 'Running linters' },
  { id: 'ai', label: 'Generating AI review' },
];

/**
 * @param {{ activeIndex: number, repoUrl: string }} props
 * activeIndex: index of the stage currently in progress (0-based). Stages
 * before it are complete; stages after are pending.
 */
export default function PipelineProgress({ activeIndex, repoUrl }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md animate-slideIn">
        <p className="font-mono text-xs text-textMuted mb-1">reviewing</p>
        <p className="font-mono text-sm text-signal mb-8 truncate">{repoUrl}</p>

        <ol className="space-y-0">
          {STAGES.map((stage, i) => {
            const state = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'pending';
            return (
              <li key={stage.id} className="relative flex items-start gap-4 pb-8 last:pb-0">
                {/* connecting rail */}
                {i < STAGES.length - 1 && (
                  <span
                    className={`absolute left-[7px] top-5 h-full w-[2px] ${
                      state === 'done' ? 'bg-ok' : 'bg-border'
                    }`}
                    aria-hidden="true"
                  />
                )}

                <span
                  className={`relative z-10 mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2 ${
                    state === 'done'
                      ? 'border-ok bg-ok'
                      : state === 'active'
                        ? 'border-signal bg-ink animate-pulseDot'
                        : 'border-border bg-ink'
                  }`}
                  aria-hidden="true"
                />

                <div>
                  <p
                    className={`font-mono text-sm ${
                      state === 'pending' ? 'text-textMuted' : 'text-text'
                    }`}
                  >
                    {stage.label}
                  </p>
                  <p className="text-xs text-textMuted mt-0.5">
                    {state === 'done' ? 'Done' : state === 'active' ? 'In progress…' : 'Waiting'}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
