import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  listRepositories,
  addRepository,
  triggerRepositoryReview,
  listRepositoryReviews,
  RepositoryApiError,
} from '../api/repositoryApi.js';
import AddRepositoryForm from './AddRepositoryForm.jsx';
import RepositoryCard from './RepositoryCard.jsx';
import ReviewHistoryList from './ReviewHistoryList.jsx';
import ReportView from './ReportView.jsx';

export default function RepositoriesPage() {
  const { token } = useAuth();

  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState(null);

  const [runningId, setRunningId] = useState(null);
  const [runError, setRunError] = useState(null);

  const [historyExpandedId, setHistoryExpandedId] = useState(null);
  const [historyCache, setHistoryCache] = useState({});

  const [activeReport, setActiveReport] = useState(null); // { repoId, report } | null

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const list = await listRepositories(token);
        if (!cancelled) setRepos(list);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof RepositoryApiError ? err.message : 'Could not load repositories.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token]);

  async function handleAdd(url) {
    setAdding(true);
    setAddError(null);
    try {
      const repo = await addRepository(token, { url });
      setRepos((prev) => [repo, ...prev]);
    } catch (err) {
      setAddError(err instanceof RepositoryApiError ? err.message : 'Could not add repository.');
    } finally {
      setAdding(false);
    }
  }

  async function handleRunReview(repoId, options) {
    setRunningId(repoId);
    setRunError(null);
    try {
      const { report } = await triggerRepositoryReview(token, repoId, options);
      // Reflect the new lastReviewedSha immediately so the card's "last
      // reviewed" line and the full/incremental button label update without
      // a full re-fetch.
      setRepos((prev) =>
        prev.map((r) =>
          r.id === repoId ? { ...r, lastReviewedSha: report.headSha, lastReviewedBranch: report.defaultBranch } : r,
        ),
      );
      // Invalidate cached history for this repo so it refetches next time
      // it's expanded, picking up the review we just created.
      setHistoryCache((prev) => {
        const next = { ...prev };
        delete next[repoId];
        return next;
      });
      setActiveReport({ repoId, report });
    } catch (err) {
      setRunError({
        repoId,
        message: err instanceof RepositoryApiError ? err.message : 'The review could not be completed.',
      });
    } finally {
      setRunningId(null);
    }
  }

  async function handleToggleHistory(repoId) {
    const opening = historyExpandedId !== repoId;
    setHistoryExpandedId(opening ? repoId : null);
    if (!opening || historyCache[repoId]) return;

    setHistoryCache((prev) => ({ ...prev, [repoId]: { reviews: null, loading: true, error: null } }));
    try {
      const reviews = await listRepositoryReviews(token, repoId);
      setHistoryCache((prev) => ({ ...prev, [repoId]: { reviews, loading: false, error: null } }));
    } catch (err) {
      setHistoryCache((prev) => ({
        ...prev,
        [repoId]: { reviews: null, loading: false, error: err instanceof RepositoryApiError ? err.message : 'Could not load history.' },
      }));
    }
  }

  // A report is open — show it full-screen, same as the one-off review flow,
  // but "New review" goes back to the repository list instead of a blank input.
  if (activeReport) {
    return <ReportView report={activeReport.report} onNewReview={() => setActiveReport(null)} />;
  }

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-2xl animate-slideIn">
        <p className="font-mono text-xs tracking-widest text-signal uppercase mb-3">
          tracked repositories
        </p>
        <h1 className="font-display text-2xl font-semibold mb-2">Review only what changed.</h1>
        <p className="text-textMuted mb-8 max-w-md">
          Repositories you track here remember the last commit reviewed. Every review after the first
          only sends the diff to the AI, and can optionally open a PR with fixes when findings cross the
          threshold.
        </p>

        <AddRepositoryForm onAdd={handleAdd} adding={adding} />
        {addError && <p className="text-sm text-error font-mono -mt-6 mb-6">{addError}</p>}

        {loading && <p className="text-sm text-textMuted font-mono">Loading repositories…</p>}
        {loadError && <p className="text-sm text-error font-mono">{loadError}</p>}

        {!loading && !loadError && repos.length === 0 && (
          <div className="rounded-lg border border-border bg-surface p-6 text-center">
            <p className="text-text font-medium">No repositories tracked yet.</p>
            <p className="text-sm text-textMuted mt-1">Add one above to start reviewing it incrementally.</p>
          </div>
        )}

        <div className="space-y-4">
          {repos.map((repo) => (
            <div key={repo.id}>
              <RepositoryCard
                repo={repo}
                running={runningId === repo.id}
                onRunReview={handleRunReview}
                historyExpanded={historyExpandedId === repo.id}
                onToggleHistory={handleToggleHistory}
              >
                <ReviewHistoryList
                  reviews={historyCache[repo.id]?.reviews}
                  loading={historyCache[repo.id]?.loading}
                  error={historyCache[repo.id]?.error}
                />
              </RepositoryCard>
              {runError?.repoId === repo.id && (
                <p className="text-sm text-error font-mono mt-2 px-1">{runError.message}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
