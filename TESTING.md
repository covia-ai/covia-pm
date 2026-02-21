# Covia PM — Test Plan

Living reference document for the Covia PM test strategy.
Written after Phase 6 (accordion settings) and Phase 7 (MCP health checks) are merged.

---

## Status: Phase 8 Complete ✓

All unit and component tests implemented and passing as of 2026-02-21.

**Results: 114 tests, 9 test files — all passing**

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
| **MSW** | — | Deferred to integration tests PR |
| **Playwright** | — | E2E deferred to separate PR |

### Setup

```bash
pnpm add -D vitest@^4 @testing-library/react@^16 @testing-library/user-event@^14 \
  @testing-library/jest-dom happy-dom @vitest/coverage-v8
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

`src/test/setup.ts`:

```ts
import '@testing-library/jest-dom';
```

`package.json` scripts: `"test": "vitest"`, `"test:coverage": "vitest --coverage"`.

---

## 2. Coverage Achieved

Measured 2026-02-21 (`pnpm test:coverage`):

| Area | Stmts | Branch | Funcs | Lines | Target | Status |
|------|-------|--------|-------|-------|--------|--------|
| `src/hooks/` | **100%** | 95% | **100%** | **100%** | 85%+ | ✓ |
| `src/components/` | **85%** | 84% | 79% | 89% | 75%+ | ✓ |
| `src/lib/serverPing.ts` | **100%** | **100%** | **100%** | **100%** | 90%+ | ✓ |
| `src/lib/venue.ts` | 76% | 47% | 76% | 76% | 90%+ | partial |
| `src/lib/` overall | 77% | 48% | 79% | 77% | 90%+ | partial |
| **Overall** | **70%** | **61%** | **67%** | **71%** | 80%+ | partial |

### Uncovered areas (venue.ts)

The uncovered branches in `venue.ts` (lines 341–357, ~230, ~252) are the `executeActions` dispatch
paths for the remaining 10 integration targets beyond jira and github. These were excluded from unit
tests to keep the test suite focused — they share identical logic with the tested targets.
Full coverage of all 12 targets is deferred to integration tests (MSW).

`App.tsx` is excluded from meaningful coverage because it is the top-level orchestration component;
it is covered implicitly by integration tests (deferred).

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

## 9. Integration Tests (Vitest + MSW) — Deferred

Implement in a follow-up PR after unit suite is stable. Use MSW to intercept fetch calls.

- Full analysis flow: connect → paste notes → analyse → plan rendered
- Health check flow: connect with two servers → debounce tick → verify online/unreachable
- Execution flow: plan → execute → step progress → final status with one error
- Transcript fetch flow: configure granolaServer → fetch row → fetch → textarea populated
- Settings persistence: save → unmount → remount → verify rehydration

---

## 10. E2E — Playwright (deferred)

Implement after unit/integration test suite is stable. Requires a locally running Covia venue on `localhost:8080`.

- Connect to venue → badge shows "Connected"
- Open settings → configure Jira server URL → save → health check fires (◌ Checking… → ● Online)
- Paste sample meeting notes → click Analyse → delegation plan renders
- Click Execute → execution view shows step progress → final status card
- Dark mode toggle persists across reload
