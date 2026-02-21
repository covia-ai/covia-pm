import { useState, useCallback, useEffect, useMemo } from 'react'
import './index.css'
import { useVenue } from './hooks/useVenue'
import type { ConnectionStatus } from './hooks/useVenue'
import { useSettings } from './hooks/useSettings'
import { MeetingInput, DelegationPlan, SettingsPanel, ExecutionView } from './components'
import type { AnalysisResult, MeetingType, AnalysisStatus, ExecutionState, ExecutionStep, PMSettings, TranscriptSource } from './types'

function ConnectionIndicator({ status, venueId, error }: {
  status: ConnectionStatus;
  venueId: string | null;
  error: Error | null;
}) {
  const statusConfig = {
    disconnected: { label: 'Disconnected', className: '' },
    connecting: { label: 'Connecting...', className: 'badge-warning' },
    connected: { label: 'Connected', className: 'badge-success' },
    error: { label: 'Error', className: 'badge-error' },
  };

  const config = statusConfig[status];

  return (
    <div className="connection-indicator">
      <span className={`badge ${config.className}`}>{config.label}</span>
      {venueId && <span className="text-sm text-muted">{venueId}</span>}
      {error && <span className="text-sm text-muted">{error.message}</span>}
    </div>
  );
}

function VenueConnect({
  status,
  onConnect,
  onDisconnect
}: {
  status: ConnectionStatus;
  onConnect: (url: string) => void;
  onDisconnect: () => void;
}) {
  const [url, setUrl] = useState(import.meta.env.VITE_VENUE_URL || 'http://localhost:8080');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'connected') {
      onDisconnect();
    } else {
      onConnect(url);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="venue-connect">
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Venue URL"
        disabled={status === 'connecting' || status === 'connected'}
      />
      <button
        type="submit"
        className={status === 'connected' ? 'button-outline' : 'button-primary'}
        disabled={status === 'connecting'}
      >
        {status === 'connected' ? 'Disconnect' : status === 'connecting' ? 'Connecting...' : 'Connect'}
      </button>
    </form>
  );
}

function useDarkMode() {
  const [dark, setDark] = useState(() => localStorage.getItem('covia-pm-dark') === 'true');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('covia-pm-dark', String(dark));
  }, [dark]);

  return { dark, toggle: () => setDark(d => !d) };
}

const SOURCE_SERVER_KEYS: Record<TranscriptSource, keyof PMSettings> = {
  granola: 'granolaServer',
  fathom: 'fathomServer',
  fireflies: 'firefliesServer',
  otter: 'otterServer',
  tldv: 'tldvServer',
  avoma: 'avomaServer',
  read: 'readServer',
  zoom: 'zoomServer',
  'teams-meeting': 'teamsMeetingServer',
};

const ALL_TRANSCRIPT_SOURCES = Object.keys(SOURCE_SERVER_KEYS) as TranscriptSource[];

const STEP_DEFS: { id: ExecutionStep['id']; label: string; icon: string; serverField: keyof PMSettings }[] = [
  { id: 'jira',        label: 'Creating Jira Issues',          icon: 'J',  serverField: 'jiraServer' },
  { id: 'linear',      label: 'Creating Linear Issues',        icon: 'L',  serverField: 'linearServer' },
  { id: 'azure-devops',label: 'Creating Azure Work Items',     icon: 'A',  serverField: 'azureServer' },
  { id: 'github',      label: 'Executing GitHub Actions',      icon: 'G',  serverField: 'githubServer' },
  { id: 'gitlab',      label: 'Executing GitLab Actions',      icon: 'GL', serverField: 'gitlabServer' },
  { id: 'slack',       label: 'Sending Slack Notifications',   icon: 'S',  serverField: 'slackServer' },
  { id: 'teams',       label: 'Sending Teams Notifications',   icon: 'T',  serverField: 'teamsServer' },
  { id: 'email',       label: 'Sending Email Notifications',   icon: 'E',  serverField: 'emailServer' },
  { id: 'pagerduty',   label: 'Creating PagerDuty Incidents',  icon: 'P',  serverField: 'pagerdutyServer' },
  { id: 'sentry',      label: 'Linking Sentry Issues',         icon: 'SE', serverField: 'sentryServer' },
  { id: 'confluence',  label: 'Writing Confluence Pages',      icon: 'C',  serverField: 'confluenceServer' },
  { id: 'calendar',    label: 'Scheduling Calendar Events',    icon: 'CA', serverField: 'calendarServer' },
];

function buildExecutionSteps(settings: PMSettings): ExecutionStep[] {
  return STEP_DEFS
    .filter(s => !!(settings as unknown as Record<string, string>)[s.serverField])
    .map(({ id, label, icon }) => ({ id, label, icon, status: 'pending' as const }));
}

function App() {
  const { client, status, error, venueId, connect, disconnect } = useVenue();
  const { settings, saveSettings } = useSettings();
  const { dark, toggle: toggleDark } = useDarkMode();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>('idle');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<Error | null>(null);
  const [lastNotes, setLastNotes] = useState('');
  const [executionState, setExecutionState] = useState<ExecutionState>({ status: 'idle', steps: [] });
  const [showExecution, setShowExecution] = useState(false);

  const availableSources = useMemo(
    () => ALL_TRANSCRIPT_SOURCES.filter(s => !!(settings as unknown as Record<string, string>)[SOURCE_SERVER_KEYS[s]]),
    [settings]
  );

  const handleAnalyze = useCallback(async (notes: string, meetingType: MeetingType) => {
    setAnalysisStatus('analyzing');
    setAnalysisError(null);
    setLastNotes(notes);

    try {
      const result = await client.analyzeMeeting(notes, meetingType, settings);
      setAnalysisResult(result);
      setAnalysisStatus('success');
    } catch (e) {
      setAnalysisError(e instanceof Error ? e : new Error(String(e)));
      setAnalysisStatus('error');
    }
  }, [client, settings]);

  const handleFetchTranscript = useCallback(
    (source: TranscriptSource, callRef: string) => client.fetchTranscript(source, callRef, settings),
    [client, settings]
  );

  const handleExecute = useCallback(async () => {
    if (!analysisResult) return;

    const initialSteps = buildExecutionSteps(settings);
    setExecutionState({ status: 'running', steps: initialSteps });
    setShowExecution(true);

    let hasError = false;

    try {
      await client.executeActions(lastNotes, analysisResult, settings, (id, stepStatus, result, errorMsg) => {
        setExecutionState(prev => {
          const steps = prev.steps.map(s =>
            s.id === id ? { ...s, status: stepStatus, result, error: errorMsg } : s
          );
          if (stepStatus === 'error') hasError = true;
          return { ...prev, steps };
        });
      });
    } catch (e) {
      hasError = true;
      console.error('Execution failed:', e);
    }

    setExecutionState(prev => ({
      ...prev,
      status: hasError ? 'error' : 'complete',
    }));
  }, [client, analysisResult, lastNotes, settings]);

  const handleReset = useCallback(() => {
    setAnalysisStatus('idle');
    setAnalysisResult(null);
    setAnalysisError(null);
    setLastNotes('');
    setExecutionState({ status: 'idle', steps: [] });
    setShowExecution(false);
  }, []);

  const isConnected = status === 'connected';
  const isAnalyzing = analysisStatus === 'analyzing';
  const isExecuting = executionState.status === 'running';

  return (
    <div className="page">
      <header>
        <div className="container flex justify-between items-center">
          <a href="/" className="logo">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2"/>
              <path d="M10 16L14 20L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Covia PM</span>
          </a>
          <div className="flex items-center gap-md">
            <ConnectionIndicator status={status} venueId={venueId} error={error} />
            <nav>
              <a href="#features">Features</a>
              <a href="#about">About</a>
              <a href="https://docs.covia.ai" target="_blank" rel="noopener">Docs</a>
            </nav>
            <button
              className="settings-button"
              onClick={toggleDark}
              aria-label="Toggle dark mode"
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>
            <button
              className="settings-button"
              onClick={() => setIsSettingsOpen(true)}
              aria-label="Open configuration"
              title="Configuration"
            >
              ⚙
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container">
            <h1>Federated AI Project Management</h1>
            <p>
              Coordinate AI agents across Jira, GitHub, and Slack with shared
              execution state, immutable audit trails, and runtime policy enforcement.
            </p>
            <VenueConnect
              status={status}
              onConnect={connect}
              onDisconnect={disconnect}
            />
          </div>
        </section>

        <MeetingInput
          onAnalyze={handleAnalyze}
          isAnalyzing={isAnalyzing}
          isConnected={isConnected}
          onFetchTranscript={handleFetchTranscript}
          availableSources={availableSources}
        />

        {showExecution ? (
          <ExecutionView
            state={executionState}
            onBack={() => setShowExecution(false)}
            onReset={handleReset}
          />
        ) : (
          <DelegationPlan
            result={analysisResult}
            error={analysisError}
            onExecute={handleExecute}
            settings={settings}
            isExecuting={isExecuting}
          />
        )}

        <section className="features" id="features">
          <div className="container">
            <h2 className="text-center mb-lg">Why Covia PM?</h2>
            <div className="grid grid-3">
              <article className="card feature-card">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <h3>Federated Coordination</h3>
                <p>Agents work across organisational boundaries with no central point of control.</p>
              </article>

              <article className="card feature-card">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <h3>Immutable Audit Trail</h3>
                <p>Every action cryptographically logged to the Covia Grid for accountability.</p>
              </article>

              <article className="card feature-card">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0110 0v4"/>
                  </svg>
                </div>
                <h3>Policy Enforcement</h3>
                <p>Runtime policies prevent errors before they happen across all integrations.</p>
              </article>
            </div>
          </div>
        </section>

        <section id="about">
          <div className="container">
            <div className="card">
              <h2>Built on Covia</h2>
              <p>
                Covia PM demonstrates the power of federated AI orchestration.
                Instead of N² point-to-point integrations, a single coordination
                layer connects your entire development workflow.
              </p>
              <p className="text-muted mb-sm">
                Powered by <a href="https://www.covia.ai">Covia</a> and
                <a href="https://docs.convex.world"> Convex Lattice</a> technology.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="container flex justify-between items-center">
          <span>&copy; 2025 Covia. All rights reserved.</span>
          <nav>
            <a href="https://github.com/covia-ai">GitHub</a>
            <a href="https://docs.covia.ai">Documentation</a>
          </nav>
        </div>
      </footer>

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={saveSettings}
      />
    </div>
  )
}

export default App
