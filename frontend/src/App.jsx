import { useEffect, useRef, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import AuthPage from './components/AuthPage.jsx';
import AppHeader from './components/AppHeader.jsx';
import UrlInput from './components/UrlInput.jsx';
import PipelineProgress from './components/PipelineProgress.jsx';
import ReportView from './components/ReportView.jsx';
import BlockedSecrets from './components/BlockedSecrets.jsx';
import ErrorState from './components/ErrorState.jsx';
import { submitReview, ReviewApiError } from './api.js';
import { MOCK_REPORT, MOCK_SECRETS_BLOCKED_ERROR } from './mockData.js';

// Dev-only preview: visit /?demo=report or /?demo=blocked to see those
// screens instantly, without a running backend. Not used in production.
function getDemoParam() {
  return new URLSearchParams(window.location.search).get('demo');
}

// Full-page spinner shown while the auth session is being restored from
// localStorage on the very first render.
function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <svg
        className="animate-spin text-signal"
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
      <p className="font-mono text-xs text-textMuted tracking-widest uppercase">Loading…</p>
    </div>
  );
}

// Inner component that can safely use useAuth() because it's rendered
// inside <AuthProvider>.
function AppInner() {
  const { user, loading } = useAuth();

  const demo = getDemoParam();
  const [screen, setScreen] = useState(
    demo === 'report' ? 'report' : demo === 'blocked' ? 'blocked' : 'input',
  );
  const [repoUrl, setRepoUrl] = useState(demo ? MOCK_REPORT.repoUrl : '');
  const [report, setReport] = useState(demo === 'report' ? MOCK_REPORT : null);
  const [error, setError] = useState(demo === 'blocked' ? MOCK_SECRETS_BLOCKED_ERROR : null);
  const [stageIndex, setStageIndex] = useState(0);
  const progressTimer = useRef(null);

  function resetToInput() {
    clearInterval(progressTimer.current);
    setScreen('input');
    setReport(null);
    setError(null);
    setStageIndex(0);
  }

  async function handleSubmit(url) {
    setRepoUrl(url);
    setScreen('running');
    setStageIndex(0);

    // Advance the visual stepper while the request is in flight.
    progressTimer.current = setInterval(() => {
      setStageIndex((i) => (i < 4 ? i + 1 : i));
    }, 1800);

    try {
      const result = await submitReview({ repoUrl: url });
      clearInterval(progressTimer.current);
      setReport(result);
      setScreen('report');
    } catch (err) {
      clearInterval(progressTimer.current);
      if (err instanceof ReviewApiError && err.code === 'SECRETS_FOUND') {
        setError(err);
        setScreen('blocked');
      } else if (err instanceof ReviewApiError) {
        setError(err);
        setScreen('error');
      } else {
        setError({ code: 'UNKNOWN_ERROR', message: 'Unexpected error.' });
        setScreen('error');
      }
    }
  }

  useEffect(() => () => clearInterval(progressTimer.current), []);

  // 1. Restoring session from localStorage — show spinner
  if (loading) return <LoadingScreen />;

  // 2. Not authenticated — show Login / Register page
  if (!user) return <AuthPage />;

  // 3. Authenticated — show main app with sticky header
  return (
    <>
      <AppHeader />
      {/* pt-14 offsets the fixed header height */}
      <div className="pt-14">
        {screen === 'running' && (
          <PipelineProgress activeIndex={stageIndex} repoUrl={repoUrl} />
        )}
        {screen === 'report' && report && (
          <ReportView report={report} onNewReview={resetToInput} />
        )}
        {screen === 'blocked' && error && (
          <BlockedSecrets error={error} onNewReview={resetToInput} />
        )}
        {screen === 'error' && error && (
          <ErrorState error={error} onRetry={resetToInput} />
        )}
        {screen === 'input' && (
          <UrlInput onSubmit={handleSubmit} disabled={false} />
        )}
      </div>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
