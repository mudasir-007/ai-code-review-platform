const ERROR_COPY = {
  REPO_NOT_FOUND: {
    title: "Couldn't find that repository.",
    hint: 'Check the URL, or confirm you have access if the repository is private.',
  },
  GIST_NOT_SUPPORTED: {
    title: 'Gists are not supported.',
    hint: 'Provide a repository URL, like https://github.com/owner/repo.',
  },
  INVALID_URL: {
    title: "That doesn't look like a GitHub repository URL.",
    hint: 'Use the format https://github.com/owner/repo.',
  },
  REPO_EMPTY: {
    title: 'This repository has no code to review.',
    hint: 'Push at least one commit, then try again.',
  },
  DEFAULT_BRANCH_MISSING: {
    title: "Couldn't determine the default branch.",
    hint: 'This is unusual for a public repository — try again shortly.',
  },
  RATE_LIMIT_LOW: {
    title: 'GitHub API rate limit reached.',
    hint: 'Wait a few minutes before starting another review.',
  },
  TOKEN_INVALID: {
    title: 'The GitHub token is invalid or expired.',
    hint: 'Generate a new token and try again.',
  },
  TOKEN_FORBIDDEN: {
    title: "This token doesn't have access to that repository.",
    hint: 'Use a token with the repo scope, or check repository permissions.',
  },
  REPO_TOO_LARGE: {
    title: 'This repository is too large to review.',
    hint: 'Try a smaller repository or a specific branch with less history.',
  },
  DOWNLOAD_TIMEOUT: {
    title: 'The repository took too long to download.',
    hint: "GitHub may be slow right now — try again in a moment.",
  },
  AI_UNAVAILABLE: {
    title: 'The AI reviewer is unavailable right now.',
    hint: 'Both providers failed to respond. Try again shortly.',
  },
};

const DEFAULT_COPY = {
  title: 'The review could not be completed.',
  hint: 'Try again, or use a different repository.',
};

export default function ErrorState({ error, onRetry }) {
  const copy = ERROR_COPY[error.code] ?? DEFAULT_COPY;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md animate-slideIn">
        <div className="relative rounded-lg border border-border bg-surface overflow-hidden">
          <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-warn" aria-hidden="true" />
          <div className="p-6 pl-7">
            <p className="font-mono text-xs text-textMuted mb-2">{error.code ?? 'ERROR'}</p>
            <h1 className="font-display text-lg font-semibold mb-2">{copy.title}</h1>
            <p className="text-textMuted leading-relaxed">{copy.hint}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-lg bg-signal px-4 py-2.5 text-sm font-medium text-ink
            hover:opacity-90 transition-opacity"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
