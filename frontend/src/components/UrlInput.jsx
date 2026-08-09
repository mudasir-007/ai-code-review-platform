import { useState } from 'react';

export default function UrlInput({ onSubmit, disabled }) {
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);

  const isValid = /^https?:\/\/(www\.)?github\.com\/[^/]+\/[^/]+/.test(value.trim());

  function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);
    if (!isValid || disabled) return;
    onSubmit(value.trim());
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-xl animate-slideIn">
        <p className="font-mono text-xs tracking-widest text-signal uppercase mb-3">
          repo review
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold leading-tight mb-3">
          Review a repository before you review the PR.
        </h1>
        <p className="text-textMuted mb-8 max-w-md">
          Paste a GitHub repository URL. We'll validate it, scan for secrets, run the
          right linters, and hand the findings to an AI reviewer.
        </p>

        <form onSubmit={handleSubmit} className="relative">
          <div
            className={`flex items-center gap-3 rounded-lg border bg-surface px-4 py-3.5
              transition-colors ${
                touched && !isValid
                  ? 'border-error'
                  : 'border-border focus-within:border-signal'
              }`}
          >
            <span className="font-mono text-signal select-none">$</span>
            <input
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="github.com/owner/repo"
              value={value}
              disabled={disabled}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => setTouched(true)}
              className="flex-1 bg-transparent font-mono text-sm text-text placeholder:text-textMuted
                outline-none disabled:opacity-50"
              aria-invalid={touched && !isValid}
              aria-describedby="url-error"
            />
          </div>

          {touched && !isValid && (
            <p id="url-error" className="mt-2 text-sm text-error font-mono">
              Enter a full GitHub repository URL, like https://github.com/owner/repo
            </p>
          )}

          <button
            type="submit"
            disabled={disabled}
            className="mt-4 w-full rounded-lg bg-signal py-3 font-body font-medium text-ink
              transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Start review
          </button>
        </form>
      </div>
    </div>
  );
}
