import { useState } from 'react'
import './index.css'
import { useVenue } from './hooks/useVenue'
import type { ConnectionStatus } from './hooks/useVenue'

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

function App() {
  const { status, error, venueId, connect, disconnect } = useVenue();

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
    </div>
  )
}

export default App
