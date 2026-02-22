/**
 * Reusable MSW request handlers for integration tests.
 *
 * URL conventions used in tests:
 *   http://jira.test      — reachable (200)
 *   http://github.test    — reachable (200)
 *   http://slack.test     — reachable MCP-style (405, still "online")
 *   http://dead.test      — network-level failure (Response.error())
 *   http://slow.test      — delayed 500 ms (use with a short timeout to test abort)
 */
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.head('http://jira.test',   () => new HttpResponse(null, { status: 200 })),
  http.head('http://github.test', () => new HttpResponse(null, { status: 200 })),
  // MCP servers commonly return 405 for HEAD — should still be treated as reachable
  http.head('http://slack.test',  () => new HttpResponse(null, { status: 405 })),
  // Simulate a network-level failure
  http.head('http://dead.test',   () => Response.error()),
  // Simulate a slow server (used for timeout tests — keep handler but override in test)
  http.head('http://slow.test',   async () => {
    await new Promise(r => setTimeout(r, 500));
    return new HttpResponse(null, { status: 200 });
  }),
];
