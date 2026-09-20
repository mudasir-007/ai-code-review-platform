import { useState } from 'react';
import { parseRepoUrl } from '../api/repositoryApi.js';

export default function AddRepositoryForm({ onAdd, adding }) {
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);

  const isValid = !!parseRepoUrl(value);

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);
    if (!isValid || adding) return;
    await onAdd(value.trim());
    setValue('');
    setTouched(false);
  }

  return (
    <form onSubmit={handleSubmit} className="mb-8">
      <div
        className={`flex items-center gap-3 rounded-lg border bg-surface px-4 py-3
          transition-colors ${
            touched && !isValid ? 'border-error' : 'border-border focus-within:border-signal'
          }`}
      >
        <span className="font-mono text-signal select-none">+</span>
        <input
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="github.com/owner/repo — track it for incremental review"
          value={value}
          disabled={adding}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => setTouched(true)}
          className="flex-1 bg-transparent font-mono text-sm text-text placeholder:text-textMuted
            outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={adding || !value}
          className="flex-shrink-0 rounded-md bg-signal px-3 py-1.5 text-sm font-medium text-ink
            transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {adding ? 'Adding…' : 'Track'}
        </button>
      </div>
      {touched && !isValid && value && (
        <p className="mt-2 text-sm text-error font-mono">
          Enter a full GitHub repository URL, like https://github.com/owner/repo
        </p>
      )}
    </form>
  );
}
