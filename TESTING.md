# Covia PM — Test Plan

Living reference document for the Covia PM test strategy.

---

## Status: Integration Tests Complete ✓

All unit, component, and integration tests implemented and passing as of 2026-02-23.

**Results: 147 tests, 12 test files — all passing**

| File | Tests | Status |
|------|-------|--------|
| `src/lib/serverPing.test.ts` | 7 | ✓ |
| `src/lib/venue.test.ts` | 19 | ✓ |
| `src/hooks/useSettings.test.ts` | 7 | ✓ |
| `src/hooks/useVenue.test.ts` | 8 | ✓ |
| `src/hooks/useHealthChecks.test.ts` | 12 | ✓ |
| `src/components/MeetingInput.test.tsx` | 15 | ✓ |
| `src/components/DelegationPlan.test.tsx` | 13 | ✓ |
| `src/components/SettingsPanel.test.tsx` | 19 | ✓ |
| `src/components/ExecutionView.test.tsx` | 14 | ✓ |
| `src/test/integration/pingServer.integration.test.ts` | 6 | ✓ |
| `src/test/integration/healthCheckFlow.integration.test.ts` | 7 | ✓ |
| `src/test/integration/venueClient.integration.test.ts` | 20 | ✓ |

---

## 1. Test Stack

| Tool | Version | Purpose |
|------|---------|---------|
| **Vitest** | ^4 | Test runner — native to Vite, zero config overhead |
| **@testing-library/react** | ^16 | Component rendering (React 19 compatible) |
| **@testing-library/user-event** | ^14 | Realistic browser interaction (type, click, focus) |
| **@testing-library/jest-dom** | ^6 | DOM assertion matchers (`toBeInTheDocument`, etc.) |
| **happy-dom** | ^20 | Fast, lightweight DOM environment for Vitest |
| **@vitest/coverage-v8** | ^4 | Coverage reports via V8 |
| **MSW** | ^2 | HTTP-level fetch interception for integration tests |
| **Playwright** | — | E2E deferred to separate PR |

### Setup

```bash
pnpm add -D vitest@^4 @testing-library/react@^16 @testing-library/user-event@^14 \
  @testing-library/jest-dom happy-dom @vitest/coverage-v8 msw
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/test/**', 'src/assets/**', 'src/main.tsx'],
    },
  },
});
```

`src/test/setup.ts` — jest-dom matchers only:

```ts
import '@testing-library/jest-dom';
```

MSW server (`src/test/msw/server.ts`) is managed per integration test file (not in global setup) to
avoid interfering with unit tests that spy on `global.fetch` directly.

`package.json` scripts: `"test": "vitest"`, `"test:coverage": "vitest --coverage"`.

---

## 2. Coverage Achieved

Measured 2026-02-23 (`pnpm test:coverage`):

| Area | Stmts | Branch | Funcs | Lines | Target | Status |
|------|-------|--------|-------|-------|--------|--------|
| `src/hooks/` | **100%** | 95% | **100%** | **100%** | 85%+ | ✓ |
| `src/components/` | **85%** | 84% | 79% | 89% | 75%+ | ✓ |
| `src/config/integrations.ts` | **100%** | **100%** | **100%** | **100%** | — | ✓ |
| `src/lib/serverPing.ts` | **100%** | **100%** | **100%** | **100%** | 90%+ | ✓ |
| `src/lib/venue.ts` | 81% | 52% | 76% | 82% | 90%+ | partial |
| `src/lib/` overall | 82% | 52% | 79% | 83% | 90%+ | partial |
| **Overall** | **71%** | **63%** | **67%** | **72%** | 80%+ | partial |

### Remaining gaps

`venue.ts` lines 341–357: the `dispatch()` calls for 10 remaining targets (linear, azure-devops,
gitlab, teams, email, pagerduty, sentry, confluence, calendar, slack notification paths). These share
identical logic with the already-tested jira and github dispatch paths. Covered at the integration
test level conceptually; individual dispatch lines are excluded to avoid test bloat.

`App.tsx`: top-level orchestration component — excluded from meaningful unit/integration coverage;
covered by E2E tests (deferred).

`ErrorBoundary.tsx`: requires a deliberately thrown render error — deferred to E2E.

---

## 3. Unit Tests — `src/lib/serverPing.ts` ✓

7 tests — `vi.spyOn(global, 'fetch')` + `vi.useFakeTimers()`.

- Returns `true` when fetch resolves (happy path)
- Returns `true` even for a 405 response (no-cors opaque response)
- Returns `false` when fetch throws TypeError (network failure)
- Returns `false` when AbortController fires at timeout
- `clearTimeout` always called even on early resolve
- Custom timeout value honoured
- Never throws (always resolves true/false)

---

## 4. Unit Tests — `src/lib/venue.ts` (PMVenueClient) ✓

19 tests — mocks `@covia-ai/covialib` and `../assets/operations`.

- `connect()`: calls `Grid.connect`, builds asset map, returns venue
- `connect()`: propagates error when `Grid.connect` throws
- `ensureAssets()`: swallows '409' errors (idempotent deploy)
- `ensureAssets()`: swallows 'already exists' errors
- `disconnect()`: sets `isConnected` false, clears assetIdMap
- `analyzeMeeting()`: parses bare JSON string from `venue.run`
- `analyzeMeeting()`: parses JSON inside markdown code fence
- `analyzeMeeting()`: parses JSON from `.response` field when run returns object
- `analyzeMeeting()`: throws on empty/null response
- `analyzeMeeting()`: throws 'Failed to parse' on invalid JSON
- `analyzeMeeting()`: normalises null array fields to `[]`
- `fetchTranscript()`: throws 'Not connected' when venue=null
- `fetchTranscript()`: throws 'Asset not found' for unknown assetId
- `fetchTranscript()`: happy path — calls `venue.run` with correct args
- `executeActions()`: `onStepUpdate('running')` then `('success')` for configured target
- `executeActions()`: `onStepUpdate('skipped')` when server field is empty
- `executeActions()`: `onStepUpdate('error')` on failure; continues remaining targets

---

## 5. Unit Tests — `src/hooks/useSettings.ts` ✓

7 tests — `localStorage.clear()` in `beforeEach`.

- Returns `DEFAULT_SETTINGS` when localStorage empty
- `saveSettings()` writes JSON to `localStorage`
- Rehydrates on mount from pre-populated localStorage
- Merges partial stored object with defaults (schema evolution)
- Falls back to defaults on malformed JSON
- `saveSettings` has stable identity across re-renders

---

## 6. Unit Tests — `src/hooks/useVenue.ts` ✓

8 tests — `vi.mock('../lib/venue', ...)` with `vi.hoisted()` for constructor mock.

> **Note**: `PMVenueClient` must be mocked with a regular function (not arrow function) since
> it is used with `new`. Variables referenced in `vi.mock` factories must be created with
> `vi.hoisted()` because `vi.mock` is hoisted before imports.

- Initial state: `status='disconnected'`, `error=null`, `venueId=null`
- `connect()` sets status to `'connecting'` synchronously before await
- `connect()` success → `status='connected'`, `venueId` populated
- `connect()` rejects with `Error` → `status='error'`, `error.message` preserved
- `connect()` rejects with non-Error → wrapped in `new Error(String(e))`
- `disconnect()` → `status='disconnected'`, `venueId/error` cleared, `client.disconnect()` called
- Prior error cleared when `connect()` called again
- Same client instance across renders (useMemo stability)

---

## 7. Unit Tests — `src/hooks/useHealthChecks.ts` ✓

12 tests — `vi.useFakeTimers()` in `beforeEach`, `vi.advanceTimersByTimeAsync()` for async flushing.

> **Key pattern**: Use *separate* `act()` calls for rerender (to flush React effects/register
> timers) and timer advancement (to fire timers and flush resulting async state updates).
> Putting both in a single `act()` can cause effects to not run before timers are advanced.
>
> ```ts
> await act(async () => { rerender({ c: true }); }); // flush effects first
> await act(async () => { await vi.advanceTimersByTimeAsync(10); }); // then fire timers
> ```

- Starts with empty health map
- No pings when `isConnected=false` and no servers configured
- Pings fire when `isConnected` transitions false → true
- Targets set to `'checking'` before pings resolve (caught with never-resolving mock)
- Sets `'ok'` when `pingServer` resolves `true`
- Sets `'unreachable'` when `pingServer` resolves `false`
- Skips hidden integrations even when server URL is set
- Skips integrations with no server URL configured
- Clears health to `{}` when `isConnected` transitions to false
- Rapid settings changes only trigger pings for the last URL (debounce behaviour)
- `recheck()` triggers a new ping round when connected
- `recheck()` is a no-op when disconnected

---

## 8. Component Tests — `src/components/` ✓

### `MeetingInput` (15 tests)

- Analyse button disabled when `isConnected=false`
- Analyse button disabled when textarea empty (even if connected)
- Analyse button enabled → calls `onAnalyze` with notes + meetingType
- "Connect to a venue" helper text shown when disconnected
- 4 meeting type buttons rendered; clicking one makes it active
- Transcript fetch row absent when `availableSources=[]` or `onFetchTranscript` not passed
- Transcript fetch row present when `availableSources=['granola']` + handler provided
- Fetch button disabled when `callRef` is empty
- Fetch success → textarea populated with returned transcript
- Fetch error → error message shown

### `DelegationPlan` (13 tests)

- Returns null when `result=null`, `error=null`
- Shows error card when error is set
- Renders action items grouped by target
- Shows "No action items" empty state when `result.actionItems=[]`
- Execute button disabled + warning when no integration servers configured
- Execute button enabled when at least one server configured
- Execute button shows spinner when `isExecuting=true`
- Unreachable warning shown when health has `'unreachable'` for a used target
- Execute button stays ENABLED even when a target is unreachable
- Does not show unreachable warning when all targeted servers are online

### `SettingsPanel` (19 tests)

- Closed (no `open` class) when `isOpen=false`
- Has `open` class when `isOpen=true`
- Renders "Execution Integrations" heading
- Renders "Meeting Intelligence" heading
- Renders category labels such as "Issue Trackers"
- Category starts collapsed when no integration in it is configured
- Category starts expanded when an integration is configured
- Clicking collapsed category expands it
- Clicking expanded category collapses it
- Clicking integration header expands its field group
- Token field is password type by default
- Save button calls `onSave` with current draft values
- Cancel button calls `onClose`, does not call `onSave`
- Unconfigured integration shows `○ Not set`
- Configured (no health) shows `● Configured`
- `health='checking'` shows `◌ Checking…`
- `health='ok'` shows `● Online`
- `health='unreachable'` shows `⚠ Unreachable`
- Unconfigured integration shows `○ Not set` regardless of health prop

### `ExecutionView` (14 tests)

- Renders all steps from `state.steps`
- Spinner element present for step with `status='running'`
- PENDING badge for pending status
- DONE badge for success status
- FAILED badge for error status
- SKIPPED badge for skipped status
- Results section hidden when no step has result or error
- Results section shown with `<details>` when a step has a result
- Error text shown in results for a failed step
- `onBack` called when "Back to Plan" button is clicked
- "Start New Analysis" not shown while still running
- "Start New Analysis" shown and calls `onReset` when complete
- "Start New Analysis" shown when status is error
- Correct title per execution status (Executing… / Execution Complete / Execution Failed)

---

## 9. Integration Tests (Vitest + MSW) ✓

MSW intercepts fetch calls at the HTTP level. Integration tests use real module implementations
(not mocked) to verify the full chain. Each integration test file manages its own MSW server
lifecycle; MSW is NOT in the global setup so unit tests that spy on `global.fetch` are unaffected.

### Infrastructure

- `src/test/msw/handlers.ts` — reusable handlers for test URLs (`http://jira.test`, `http://dead.test`, etc.)
- `src/test/msw/server.ts` — `setupServer(...handlers)` singleton

### `pingServer` integration (6 tests) — real fetch + MSW, real timers

Tests the complete `pingServer` function end-to-end without any `vi.spyOn(fetch)`.

**Happy paths:**
- Returns `true` when MSW returns 200
- Returns `true` when MSW returns 405 (MCP HEAD-not-allowed — server IS reachable)
- Returns `true` when MSW returns 500 (any HTTP response = reachable)

**Unhappy paths:**
- Returns `false` when MSW returns `Response.error()` (network failure)
- Returns `false` when request times out (MSW delays 400 ms, timeout set to 80 ms)
- Never throws — always resolves `true` or `false`

**Issues & mitigations:**
- Issue: Timeout test requires real time (can't combine fake timers with delayed MSW handlers).
  Mitigation: Small timeout (80 ms) + generous delay gap (400 ms) — reliable in CI.
- Issue: `mode:'no-cors'` in happy-dom doesn't produce opaque responses like a real browser.
  Mitigation: `pingServer` ignores response status/body — only resolve-vs-throw matters. ✓

### `healthCheckFlow` integration (7 tests) — real `useHealthChecks` + real `pingServer` + MSW + fake timers

Verifies the complete chain: hook effect → `pingServer` → real `fetch` → MSW → health state update.
MSW handlers respond synchronously (no setTimeout inside), so fake timers work correctly.

- Starts with empty health map
- Marks jira as `ok` when MSW returns 200
- Marks github as `unreachable` when MSW returns `Response.error()`
- Mixed state: jira=ok + github=unreachable simultaneously
- Clears health map to `{}` on disconnect
- Debounce: rapid settings changes only trigger one ping round for the last value
- `recheck()` triggers a fresh ping when connected

### `venueClient` integration (20 tests) — real `PMVenueClient` + mocked covialib

Tests the full PMVenueClient method chain end-to-end with a stubbed Venue object.
Covers scenarios that cross internal method boundaries (connect → assetIdMap → execute).

**connect() chain (3 tests):**
- Deploys all assets and populates assetIdMap on first connect
- Swallows 409/"already exists" so re-connect is idempotent
- Propagates `Grid.connect` errors

**disconnect() (1 test):**
- Sets `isConnected` false and clears venueId

**analyzeMeeting() (7 tests):**
- Happy path — correct `venue.run` args, parsed `AnalysisResult` returned
- Parses JSON in markdown code fence
- Parses response from `.response` field
- Throws 'Not connected' before `connect()`
- Throws on null/empty response
- Throws 'Failed to parse' on invalid JSON
- Normalises null array fields to `[]`

**executeActions() (5 tests):**
- Configured targets → `running` → `success`
- Unconfigured server → `skipped`
- No action items for target → `skipped` even if server is set
- Partial failure: one target errors, rest continue executing
- Throws 'Not connected' before `connect()`

**fetchTranscript() (4 tests):**
- Happy path — correct hex ID used, transcript returned
- Falls back to `.summary` when no `.transcript` field
- Throws 'Not connected' before `connect()`
- Throws 'Asset … not found' when assetIdMap is empty

---

## 10. E2E — Playwright (deferred)

Implement after unit/integration test suite is stable. Requires a locally running Covia venue on `localhost:8080`.

- Connect to venue → badge shows "Connected"
- Open settings → configure Jira server URL → save → health check fires (◌ Checking… → ● Online)
- Paste sample meeting notes → click Analyse → delegation plan renders
- Click Execute → execution view shows step progress → final status card
- Dark mode toggle persists across reload
