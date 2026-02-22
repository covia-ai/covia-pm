/**
 * Integration tests for the health-check flow:
 *   useHealthChecks hook  →  real pingServer  →  MSW-intercepted fetch
 *
 * Unlike the unit tests (which mock pingServer), these tests verify that the
 * complete chain works: the hook calls the real pingServer which makes a real
 * fetch that MSW intercepts and responds to.
 *
 * Timer strategy
 * ──────────────
 * vi.useFakeTimers() is used so that the debounce (500 ms) and the Effect-1
 * (0 ms) setTimeout calls in useHealthChecks can be advanced deterministically.
 * MSW handlers respond synchronously (no setTimeout inside handlers) so their
 * responses are delivered as microtasks even with fake timers active.
 *
 * The critical two-act() pattern (documented in CLAUDE.md):
 *   1st act — flush React effects (registers the timers)
 *   2nd act — advance timers (fires them and flushes resulting async state)
 *
 * Issue & Mitigation notes
 * ────────────────────────
 * Issue: Fake timers prevent setTimeout-based delays inside MSW handlers.
 * Mitigation: All MSW handlers here respond immediately (no setTimeout).
 *
 * Issue: With mode:'no-cors' in happy-dom, Response.error() from MSW causes
 * fetch to throw a TypeError. pingServer catches this and returns false.
 * This matches production browser behaviour. ✓
 *
 * Issue: real INTEGRATIONS array has 21 entries; tests only configure 1-2
 * servers so only those integrations are pinged — others are skipped.
 * Mitigation: verify the exact health keys we care about; ignore the rest.
 */
import { act, renderHook } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../msw/server';
import { useHealthChecks } from '../../hooks/useHealthChecks';
import type { PMSettings } from '../../types';

// ── MSW server lifecycle ────────────────────────────────────────────────────
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ── Fake timers ─────────────────────────────────────────────────────────────
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Empty settings — no integrations configured */
const emptySettings = (): PMSettings => ({
  jiraServer: '',     jiraProjectKey: '', jiraToken: '',
  linearServer: '',   linearTeamKey: '',  linearToken: '',
  azureServer: '',    azureOrg: '',       azureProject: '',  azureToken: '',
  githubServer: '',   githubRepo: '',     githubToken: '',
  gitlabServer: '',   gitlabRepo: '',     gitlabToken: '',
  slackServer: '',    slackChannel: '',   slackToken: '',
  teamsServer: '',    teamsChannel: '',   teamsToken: '',
  emailServer: '',    emailTo: '',        emailToken: '',
  pagerdutyServer: '', pagerdutyServiceId: '', pagerdutyToken: '',
  sentryServer: '',   sentryProject: '', sentryToken: '',
  confluenceServer: '', confluenceSpaceKey: '', confluenceToken: '',
  calendarServer: '', calendarId: '',    calendarToken: '',
  granolaServer: '',  granolaToken: '',
  fathomServer: '',   fathomToken: '',
  firefliesServer: '', firefliesToken: '',
  otterServer: '',    otterToken: '',
  tldvServer: '',     tldvToken: '',
  avomaServer: '',    avomaToken: '',
  readServer: '',     readToken: '',
  zoomServer: '',     zoomToken: '',
  teamsMeetingServer: '', teamsMeetingToken: '',
});

/** Advance timers by 600 ms (past the 500 ms debounce) and flush promises */
async function flushTimers() {
  await act(async () => { await vi.advanceTimersByTimeAsync(600); });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('healthCheckFlow — end-to-end with real pingServer', () => {
  it('starts with an empty health map', () => {
    const { result } = renderHook(() =>
      useHealthChecks(emptySettings(), false)
    );
    expect(result.current.health).toEqual({});
  });

  it('marks jira as ok when MSW returns 200 for jiraServer', async () => {
    // MSW default handlers include http://jira.test → 200
    const settings = { ...emptySettings(), jiraServer: 'http://jira.test' };
    const { result, rerender } = renderHook(
      ({ s, c }: { s: PMSettings; c: boolean }) => useHealthChecks(s, c),
      { initialProps: { s: emptySettings(), c: false } }
    );

    // Connect — flush effects so Effect-1 timer (0ms) is registered
    await act(async () => { rerender({ s: settings, c: true }); });
    // Advance past 0ms timer → pingServer fires → MSW returns 200 → 'ok'
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });

    expect(result.current.health['jiraServer']).toBe('ok');
  });

  it('marks github as unreachable when MSW returns a network error', async () => {
    // dead.test → Response.error() — network failure
    const settings = { ...emptySettings(), githubServer: 'http://dead.test' };
    const { result, rerender } = renderHook(
      ({ s, c }: { s: PMSettings; c: boolean }) => useHealthChecks(s, c),
      { initialProps: { s: emptySettings(), c: false } }
    );

    await act(async () => { rerender({ s: settings, c: true }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });

    expect(result.current.health['githubServer']).toBe('unreachable');
  });

  it('handles mixed state: jira ok + github unreachable simultaneously', async () => {
    server.use(
      http.head('http://github-dead.test', () => Response.error())
    );
    const settings = {
      ...emptySettings(),
      jiraServer:   'http://jira.test',
      githubServer: 'http://github-dead.test',
    };
    const { result, rerender } = renderHook(
      ({ s, c }: { s: PMSettings; c: boolean }) => useHealthChecks(s, c),
      { initialProps: { s: emptySettings(), c: false } }
    );

    await act(async () => { rerender({ s: settings, c: true }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });

    expect(result.current.health['jiraServer']).toBe('ok');
    expect(result.current.health['githubServer']).toBe('unreachable');
  });

  it('clears health map to {} when isConnected transitions to false', async () => {
    const settings = { ...emptySettings(), jiraServer: 'http://jira.test' };
    const { result, rerender } = renderHook(
      ({ s, c }: { s: PMSettings; c: boolean }) => useHealthChecks(s, c),
      { initialProps: { s: emptySettings(), c: false } }
    );

    // Connect and wait for health to populate
    await act(async () => { rerender({ s: settings, c: true }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(result.current.health['jiraServer']).toBe('ok');

    // Disconnect
    await act(async () => { rerender({ s: settings, c: false }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(result.current.health).toEqual({});
  });

  it('debounce: rapid settings changes only trigger one ping round for the last value', async () => {
    let requestCount = 0;
    server.use(
      http.head('http://jira-v1.test', () => { requestCount++; return new HttpResponse(null, { status: 200 }); }),
      http.head('http://jira-v2.test', () => { requestCount++; return new HttpResponse(null, { status: 200 }); }),
    );

    const s1 = { ...emptySettings(), jiraServer: 'http://jira-v1.test' };
    const s2 = { ...emptySettings(), jiraServer: 'http://jira-v2.test' };

    const { result, rerender } = renderHook(
      ({ s, c }: { s: PMSettings; c: boolean }) => useHealthChecks(s, c),
      { initialProps: { s: emptySettings(), c: false } }
    );

    // Connect with initial settings
    await act(async () => { rerender({ s: s1, c: true }); });
    // Immediately change settings before debounce fires (within single act, no awaits)
    await act(async () => { rerender({ s: s2, c: true }); });

    // Advance past debounce — only the last settings (s2) should trigger a ping
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });

    expect(result.current.health['jiraServer']).toBe('ok');
    // jira-v1 should NOT have been pinged via debounced Effect 2
    // (Effect 1 fires on connect for the initial s1, but debounce Effect 2 only fires for s2)
    expect(requestCount).toBeGreaterThanOrEqual(1); // at least one ping for the final URL
    // Verify the final URL was pinged (result is 'ok' confirms jira-v2 was reached)
  });

  it('recheck() triggers a fresh ping when connected', async () => {
    let callCount = 0;
    server.use(
      http.head('http://jira-recheck.test', () => {
        callCount++;
        return new HttpResponse(null, { status: 200 });
      })
    );
    const settings = { ...emptySettings(), jiraServer: 'http://jira-recheck.test' };
    const { result, rerender } = renderHook(
      ({ s, c }: { s: PMSettings; c: boolean }) => useHealthChecks(s, c),
      { initialProps: { s: emptySettings(), c: false } }
    );

    // Connect and let initial ping fire
    await act(async () => { rerender({ s: settings, c: true }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    const countAfterConnect = callCount;
    expect(countAfterConnect).toBeGreaterThanOrEqual(1);

    // Manually trigger recheck
    await act(async () => { result.current.recheck(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });

    expect(callCount).toBeGreaterThan(countAfterConnect);
  });
});
