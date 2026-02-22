/**
 * Integration tests for src/lib/serverPing.ts
 *
 * Uses the REAL pingServer function (no module mock) with MSW intercepting
 * the actual fetch calls at the network level.
 *
 * Key behaviour under test:
 *   - Any HTTP response (200, 405, 500) → true   (no-cors semantics)
 *   - Network-level failure             → false
 *   - AbortController timeout           → false
 *
 * These tests run with REAL timers (vi.useRealTimers) so that:
 *   1. The AbortController's setTimeout fires naturally.
 *   2. MSW's delayed handlers also resolve naturally.
 *
 * Issue & Mitigation notes:
 *   - Issue: In a browser with mode:'no-cors' the response is opaque (status 0).
 *     In happy-dom the response is not opaque, so tests can distinguish 200/405/500.
 *     Mitigation: pingServer only calls fetch and ignores the response body/status —
 *     it returns true on any resolve, false on any throw. The tests verify this
 *     invariant holds regardless of status code.
 *
 *   - Issue: happy-dom fetch may not honour mode:'no-cors' exactly as a browser does.
 *     Mitigation: pingServer's correctness does not depend on opaque-response
 *     behaviour; it only depends on resolve-vs-throw semantics which happy-dom
 *     and MSW both handle correctly.
 *
 *   - Issue: Timeout test requires real time to elapse (cannot use fake timers with
 *     a delayed MSW handler simultaneously).
 *     Mitigation: timeout value set to 80 ms, MSW delay set to 400 ms — fast enough
 *     for CI, long enough to be reliable.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../msw/server';
import { pingServer } from '../../lib/serverPing';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('pingServer — happy paths (real fetch + MSW)', () => {
  it('returns true when the server responds with 200', async () => {
    const result = await pingServer('http://jira.test');
    expect(result).toBe(true);
  });

  it('returns true when the server responds with 405 (MCP HEAD not allowed)', async () => {
    // MCP servers only accept POST; HEAD returns 405 but the server IS reachable
    const result = await pingServer('http://slack.test');
    expect(result).toBe(true);
  });

  it('returns true when the server responds with 500', async () => {
    server.use(http.head('http://error-500.test', () => new HttpResponse(null, { status: 500 })));
    const result = await pingServer('http://error-500.test');
    expect(result).toBe(true);
  });
});

describe('pingServer — unhappy paths', () => {
  it('returns false on a network-level failure (Response.error())', async () => {
    // Issue: Response.error() causes fetch to reject with a TypeError in both
    // browser and happy-dom environments.
    // Mitigation: pingServer catches all errors and returns false — verified here.
    const result = await pingServer('http://dead.test');
    expect(result).toBe(false);
  });

  it('returns false when the request times out (AbortController fires)', async () => {
    // Override slow.test to delay 400 ms; use an 80 ms timeout.
    // Issue: Test wall-clock time depends on machine speed.
    // Mitigation: gap between timeout (80 ms) and server delay (400 ms) is large
    // enough to be reliable in CI.
    server.use(
      http.head('http://slow.test', async ({ request }) => {
        await new Promise<void>((resolve, reject) => {
          const tid = setTimeout(resolve, 400);
          request.signal.addEventListener('abort', () => {
            clearTimeout(tid);
            reject(new Error('aborted'));
          });
        });
        return new HttpResponse(null, { status: 200 });
      })
    );
    const result = await pingServer('http://slow.test', 80);
    expect(result).toBe(false);
  }, 2000 /* generous test timeout */);

  it('never throws — always resolves true or false', async () => {
    // Even for an unhandled URL (MSW bypass), the function must not throw
    await expect(pingServer('http://unhandled-bypass.test', 50)).resolves.toBeDefined();
  });
});
