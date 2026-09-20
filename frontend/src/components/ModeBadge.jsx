export default function ModeBadge({ mode, changedFiles }) {
  if (!mode) return null;

  const isIncremental = mode === 'incremental';
  const fileCount = changedFiles?.length ?? 0;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs
        ${isIncremental ? 'border-signal/40 text-signal' : 'border-border text-textMuted'}`}
      title={
        isIncremental
          ? `Diffed against the previous review — only ${fileCount} changed file${fileCount === 1 ? '' : 's'} were sent to the AI`
          : 'Whole-repository review'
      }
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isIncremental ? 'bg-signal' : 'bg-textMuted'}`} />
      {isIncremental ? `Incremental · ${fileCount} file${fileCount === 1 ? '' : 's'} changed` : 'Full review'}
    </span>
  );
}
