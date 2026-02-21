import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHealthChecks } from './useHealthChecks';
import type { PMSettings } from '../types';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPingServer = vi.fn();

vi.mock('../lib/serverPing', () => ({
  pingServer: (...args: unknown[]) => mockPingServer(...args),
}));

vi.mock('../config/integrations', () => ({
  INTEGRATIONS: [
    { id: 'jira',   serverKey: 'jiraServer',   hidden: false },
    { id: 'github', serverKey: 'githubServer', hidden: false },
    { id: 'hidden', serverKey: 'slackServer',  hidden: true  },
  ],
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const emptySettings: PMSettings = {
  jiraServer: '', jiraProjectKey: '', jiraToken: '',
  githubServer: '', githubRepo: '', githubToken: '',
  slackServer: '', slackChannel: '', slackToken: '',
  linearServer: '', linearTeamKey: '', linearToken: '',
  azureServer: '', azureOrg: '', azureProject: '', azureToken: '',
  gitlabServer: '', gitlabRepo: '', gitlabToken: '',
  teamsServer: '', teamsChannel: '', teamsToken: '',
  emailServer: '', emailTo: '', emailToken: '',
  pagerdutyServer: '', pagerdutyServiceId: '', pagerdutyToken: '',
  sentryServer: '', sentryProject: '', sentryToken: '',
  confluenceServer: '', confluenceSpaceKey: '', confluenceToken: '',
  calendarServer: '', calendarId: '', calendarToken: '',
  granolaServer: '', granolaToken: '',
  fathomServer: '', fathomToken: '',
  firefliesServer: '', firefliesToken: '',
  otterServer: '', otterToken: '',
  tldvServer: '', tldvToken: '',
  avomaServer: '', avomaToken: '',
  readServer: '', readToken: '',
  zoomServer: '', zoomToken: '',
  teamsMeetingServer: '', teamsMeetingToken: '',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useHealthChecks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts with an empty health map', () => {
    const { result } = renderHook(() => useHealthChecks(emptySettings, false));
    expect(result.current.health).toEqual({});
  });

  it('does not ping when isConnected=false and no servers configured', async () => {
    renderHook(() => useHealthChecks(emptySettings, false));
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(mockPingServer).not.toHaveBeenCalled();
  });

  it('fires pings when isConnected transitions from false to true', async () => {
    mockPingServer.mockResolvedValue(true);
    const settings = { ...emptySettings, jiraServer: 'http://jira.test' };

    const { rerender } = renderHook(
      ({ s, c }: { s: PMSettings; c: boolean }) => useHealthChecks(s, c),
      { initialProps: { s: settings, c: false } }
    );

    // Separate act: flush effects from rerender (registers the 0ms timer)
    await act(async () => { rerender({ s: settings, c: true }); });
    // Separate act: fire the timer and flush resulting async state
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });

    expect(mockPingServer).toHaveBeenCalledWith('http://jira.test');
  });

  it('sets target to "checking" before ping resolves', async () => {
    // mockPingServer never settles so we can catch the intermediate state
    mockPingServer.mockImplementation(() => new Promise(() => {}));
    const settings = { ...emptySettings, jiraServer: 'http://jira.test' };

    const { result, rerender } = renderHook(
      ({ s, c }: { s: PMSettings; c: boolean }) => useHealthChecks(s, c),
      { initialProps: { s: settings, c: false } }
    );

    // Flush effects from rerender first (registers the 0ms timer)
    await act(async () => { rerender({ s: settings, c: true }); });
    // Fire the 0ms timer; runChecks sets 'checking' synchronously before ping suspends
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });

    expect(result.current.health.jiraServer).toBe('checking');
  });

  it('sets "ok" when pingServer resolves true', async () => {
    mockPingServer.mockResolvedValue(true);
    const settings = { ...emptySettings, jiraServer: 'http://jira.test' };

    const { result, rerender } = renderHook(
      ({ s, c }: { s: PMSettings; c: boolean }) => useHealthChecks(s, c),
      { initialProps: { s: settings, c: false } }
    );

    await act(async () => { rerender({ s: settings, c: true }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });

    expect(result.current.health.jiraServer).toBe('ok');
  });

  it('sets "unreachable" when pingServer resolves false', async () => {
    mockPingServer.mockResolvedValue(false);
    const settings = { ...emptySettings, jiraServer: 'http://jira.test' };

    const { result, rerender } = renderHook(
      ({ s, c }: { s: PMSettings; c: boolean }) => useHealthChecks(s, c),
      { initialProps: { s: settings, c: false } }
    );

    await act(async () => { rerender({ s: settings, c: true }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });

    expect(result.current.health.jiraServer).toBe('unreachable');
  });

  it('skips hidden integrations even when their server URL is set', async () => {
    mockPingServer.mockResolvedValue(true);
    const settings = { ...emptySettings, slackServer: 'http://slack.test' };

    const { rerender } = renderHook(
      ({ s, c }: { s: PMSettings; c: boolean }) => useHealthChecks(s, c),
      { initialProps: { s: settings, c: false } }
    );

    await act(async () => { rerender({ s: settings, c: true }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });

    expect(mockPingServer).not.toHaveBeenCalledWith('http://slack.test');
  });

  it('skips integrations with no server URL configured', async () => {
    mockPingServer.mockResolvedValue(true);
    // Only jira configured; github has empty server
    const settings = { ...emptySettings, jiraServer: 'http://jira.test' };

    const { rerender } = renderHook(
      ({ s, c }: { s: PMSettings; c: boolean }) => useHealthChecks(s, c),
      { initialProps: { s: settings, c: false } }
    );

    await act(async () => { rerender({ s: settings, c: true }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });

    // Should be called for jira only, not with empty string
    expect(mockPingServer).toHaveBeenCalledWith('http://jira.test');
    expect(mockPingServer).not.toHaveBeenCalledWith('');
  });

  it('clears health to {} when isConnected transitions to false', async () => {
    mockPingServer.mockResolvedValue(true);
    const settings = { ...emptySettings, jiraServer: 'http://jira.test' };

    const { result, rerender } = renderHook(
      ({ s, c }: { s: PMSettings; c: boolean }) => useHealthChecks(s, c),
      { initialProps: { s: settings, c: true } }
    );

    // Let initial pings complete (effects already registered timers on mount)
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(result.current.health.jiraServer).toBe('ok');

    // Disconnect: flush effects from rerender, then fire the 0ms setHealth({}) timer
    await act(async () => { rerender({ s: settings, c: false }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });

    expect(result.current.health).toEqual({});
  });

  // The hook fires an immediate ping via Effect 1 (0ms) and a debounced one via
  // Effect 2 (500ms) on settings change. Rapid rerenders cancel and reschedule
  // both timers, so the final settled values come from the last settings object.
  it('only pings with the last settings URL after rapid settings changes', async () => {
    mockPingServer.mockResolvedValue(true);
    const settings1 = { ...emptySettings, jiraServer: 'http://jira-1.test' };
    const settings2 = { ...emptySettings, jiraServer: 'http://jira-2.test' };
    const settings3 = { ...emptySettings, jiraServer: 'http://jira-3.test' };

    const { rerender } = renderHook(
      ({ s, c }: { s: PMSettings; c: boolean }) => useHealthChecks(s, c),
      { initialProps: { s: settings1, c: true } }
    );

    // Wait for initial pings to complete
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    vi.clearAllMocks();

    // Rapid settings changes within the same act — each rerender cancels previous timers
    await act(async () => {
      rerender({ s: settings2, c: true });
      rerender({ s: settings3, c: true });
    });
    // Now let all pending timers fire
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });

    // Only settings3's URL should have been pinged
    expect(mockPingServer).not.toHaveBeenCalledWith('http://jira-1.test');
    expect(mockPingServer).not.toHaveBeenCalledWith('http://jira-2.test');
    expect(mockPingServer).toHaveBeenCalledWith('http://jira-3.test');
  });

  it('recheck() triggers a new ping round when connected', async () => {
    mockPingServer.mockResolvedValue(true);
    const settings = { ...emptySettings, jiraServer: 'http://jira.test' };

    const { result, rerender } = renderHook(
      ({ s, c }: { s: PMSettings; c: boolean }) => useHealthChecks(s, c),
      { initialProps: { s: settings, c: true } }
    );

    // Let initial pings complete
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    vi.clearAllMocks();
    rerender({ s: settings, c: true });

    await act(async () => {
      result.current.recheck();
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(mockPingServer).toHaveBeenCalled();
  });

  it('recheck() is a no-op when disconnected', async () => {
    const { result } = renderHook(() => useHealthChecks(emptySettings, false));
    await act(async () => {
      result.current.recheck();
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(mockPingServer).not.toHaveBeenCalled();
  });
});
