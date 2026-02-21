# Covia PM — Test Plan

Living reference document for the Covia PM test strategy.
Written after Phase 6 (accordion settings) and Phase 7 (MCP health checks) are merged.
No test code is included here — this is the planning document to be implemented systematically.

---

## 1. Test Stack

| Tool | Purpose |
|------|---------|
| **Vitest** | Test runner — native to Vite, zero config overhead |
| **@testing-library/react** | Component rendering and user-event simulation |
| **@testing-library/user-event** | Realistic browser interaction (type, click, focus) |
| **@testing-library/jest-dom** | DOM assertion matchers (`toBeInTheDocument`, etc.) |
| **MSW (Mock Service Worker)** | Intercept `fetch` for hooks and integration tests |
| **happy-dom** | Fast, lightweight DOM environment for Vitest |
| **Playwright** | E2E against a running dev server (deferred — separate PR) |

### Setup

```bash
pnpm add -D vitest @testing-library/react @testing-library/user-event \
  @testing-library/jest-dom msw happy-dom
```

`vitest.config.ts` additions:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
});
```

`src/test/setup.ts`:

```ts
import '@testing-library/jest-dom';
import { server } from './mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

Add to `package.json` scripts: `"test": "vitest"`, `"test:coverage": "vitest --coverage"`.

---

## 2. Unit Tests — `src/lib/venue.ts` (PMVenueClient)

Mock `Grid.connect` from `@covia-ai/covialib` and a fake `Venue` object with stubs for `run`, `createAsset`, `getAsset`.

### `connect()`
- Happy path — calls `Grid.connect(url)`, then `ensureAssets(venue)`, returns the client
- Venue unreachable — `Grid.connect` throws → `connect()` propagates the error
- Asset deploy returns 409 (conflict) — error is swallowed, no throw

### `analyzeMeeting()`
- Parses bare JSON string returned from `venue.run`
- Parses JSON embedded in a markdown fenced code block (`` ```json … ``` ``)
- Throws with descriptive message when `venue.run` returns an empty string
- Throws with descriptive message when JSON is invalid / unparseable
- `buildTargetMappings()` with no settings configured → empty targets object
- `buildTargetMappings()` with specific servers set → correct mapping for each target

### `fetchTranscript()`
- Asset found in cache (`assetId` is defined) → calls `venue.run` with the correct operation name and `callRef`
- Asset not found (assetId undefined) → throws with descriptive message

### `executeActions()`
- For each of the 12 targets (jira, linear, azure-devops, github, gitlab, slack, teams, email, pagerduty, sentry, confluence, calendar):
  - Skipped (status stays `pending`) when server field is not set in settings
  - Fires `onStepUpdate(id, 'running')` then `onStepUpdate(id, 'success')` when server is set
- One step failing (venue.run throws) does not abort the remaining steps
- Step failure calls `onStepUpdate(id, 'error', undefined, errorMessage)`

---

## 3. Unit Tests — `src/lib/serverPing.ts`

Mock global `fetch` using MSW or `vi.spyOn(global, 'fetch')`.

### `pingServer(url)`
- Returns `true` when fetch resolves (mock fetch returns any opaque response)
- Returns `true` when fetch resolves with a 405 status (POST-only MCP server)
- Returns `false` when fetch throws a `TypeError` (network error / DNS failure)
- Returns `false` when `AbortController` fires before fetch resolves (timeout reached)
- Clears the timeout (`clearTimeout`) after a successful resolve — spy on `clearTimeout`

---

## 4. Unit Tests — `src/hooks/`

Use `renderHook` from `@testing-library/react`.

### `useSettings`
- Returns `DEFAULT_SETTINGS` on first render when `localStorage` is empty
- Persists settings to `localStorage` on `saveSettings(newSettings)`
- Rehydrates from `localStorage` on mount when a prior value exists
- Merges stored partial settings with `DEFAULT_SETTINGS` (handles schema evolution)

### `useVenue`
- Status sequence: `disconnected` → `connecting` → `connected` on successful `connect(url)` call
- Transitions to `error` status when `Grid.connect` throws; exposes error message
- `disconnect()` resets status to `disconnected` and clears `venueId`
- `client.analyzeMeeting` and other methods are not callable before `connect()`

### `useHealthChecks`
- Fires `runChecks` when `isConnected` transitions from `false` to `true`
- Resets `health` to `{}` within one tick when `isConnected` transitions to `false`
- Debounces settings changes — 3 rapid `settings` updates within 400ms only triggers one ping round
- Marks all configured targets as `'checking'` before any ping resolves
- Sets `'ok'` for a target whose `pingServer` resolves `true`
- Sets `'unreachable'` for a target whose `pingServer` resolves `false`
- Does not ping hidden integrations or integrations with no server URL set
- `recheck()` triggers a new ping round when connected; is a no-op when disconnected

---

## 5. Component Tests — `src/components/`

Use `render` + `screen` + `userEvent` from `@testing-library/react`.

### `MeetingInput`
- Analyse button is disabled when `isConnected=false`
- Analyse button is disabled when the textarea is empty (even if connected)
- Transcript fetch row is absent when `availableSources=[]`
- Transcript fetch row appears and shows source selector + callRef input when `availableSources` has entries
- Clicking Fetch calls `onFetchTranscript(source, callRef)` with the selected values
- Meeting-type selector options match the four defined meeting types

### `DelegationPlan`
- Shows nothing (returns null) when `result=null` and `error=null`
- Shows error card with message when `error` is set
- Renders action items grouped by target (correct number of groups)
- Shows "No action items" empty-state card when `result.actionItems` is empty
- Execute button is disabled with warning text when no integration servers are configured
- Execute button is enabled and shows `isExecuting` spinner when `isExecuting=true`
- Shows unreachable warning paragraph when `health` has `'unreachable'` for a target used in the plan
- Execute button stays ENABLED (not disabled) even when a target is unreachable

### `SettingsPanel`
- Renders 8 category sections (Issue Trackers, Version Control, Communication, Incident, Observability, Documentation, Calendar, Meeting Intelligence sources)
- Category starts collapsed when no integration in it is configured
- Category starts expanded when at least one integration in it is configured
- Clicking a category header expands then collapses it on second click
- Clicking an integration header expands its field group
- Token field shows password input by default; clicking the eye button reveals it
- Save button calls `onSave` with the current draft values
- Cancel discards unsaved draft changes
- Health prop — configured integration with `health='checking'` shows `◌ Checking…` text with `checking` class
- Health prop — configured integration with `health='ok'` shows `● Online` text with `ok` class
- Health prop — configured integration with `health='unreachable'` shows `⚠ Unreachable` text with `unreachable` class
- Unconfigured integration always shows `○ Not set` regardless of health

### `ExecutionView`
- Renders only steps for configured target servers (skips unconfigured)
- Correct status icon per `ExecutionStepStatus` (`pending`, `running`, `success`, `error`, `skipped`)
- Result detail is collapsible / expandable on click
- Back button calls `onBack`; Reset button calls `onReset`

---

## 6. Integration Tests (Vitest + MSW)

Test interaction between hooks and components using MSW to intercept real `fetch` calls.

### Full analysis flow
1. Render `App` with a mocked `Grid.connect` that resolves
2. MSW intercepts the asset-deploy endpoint (returns 201) and the `venue.run` endpoint (returns JSON action plan)
3. User pastes meeting notes and clicks Analyse
4. Verify `DelegationPlan` renders the correct number of action item cards

### Health check flow
1. Mock `pingServer` to resolve `true` for jiraServer URL, `false` for githubServer URL
2. Connect to venue with both servers configured
3. After the debounce tick, verify jira shows `● Online`, github shows `⚠ Unreachable`
4. Disconnect — verify both statuses reset to `● Configured` (health cleared)

### Execution flow
1. Render `App` with analysis result pre-populated
2. MSW intercepts per-target `venue.run` calls, one resolves, one rejects
3. Click Execute
4. Verify step status updates in `ExecutionView`: running → success / error as each settles
5. Verify final `ExecutionState.status` is `error` (not `complete`) when any step fails

### Transcript fetch flow
1. Configure `granolaServer` in settings
2. Verify "Fetch transcript" row appears in `MeetingInput`
3. Select Granola, enter a callRef, click Fetch
4. MSW returns a transcript string
5. Verify the transcript textarea is populated with the returned text

### Settings persistence
1. Render `useSettings` hook; call `saveSettings({ jiraServer: 'http://jira.test' })`
2. Unmount and re-render the hook
3. Verify `settings.jiraServer` equals `'http://jira.test'` (rehydrated from localStorage)

---

## 7. E2E — Playwright (deferred)

Implement after unit/integration test suite is stable. These tests require a locally running Covia venue on `localhost:8080`.

- Connect to venue → badge shows "Connected"
- Open settings → configure Jira server URL → save → health check fires (◌ Checking… → ● Online or ⚠ Unreachable)
- Paste sample meeting notes → click Analyse → delegation plan renders with action items
- Click Execute → execution view shows step progress → final status card appears
- Dark mode toggle persists across reload

---

## 8. Coverage Targets

| Area | Target |
|------|--------|
| `src/lib/` | 90%+ |
| `src/hooks/` | 85%+ |
| `src/components/` | 75%+ |
| Overall | 80%+ |

---

## 9. Implementation Sequence

Work through this order — each step builds on the previous:

1. **Setup** — install tooling, create `vitest.config.ts`, `src/test/setup.ts`, MSW handlers skeleton, add `test` + `test:coverage` scripts to `package.json`
2. **`serverPing.ts` unit tests** — simplest pure-function tests; confirm MSW intercept pattern works
3. **`useSettings` unit tests** — localStorage mock, verify default + persist + rehydrate
4. **`PMVenueClient` unit tests** — mock `Grid.connect` and `Venue`; cover parse paths and executeActions
5. **`useVenue` unit tests** — status state machine via renderHook
6. **`useHealthChecks` unit tests** — fake timers (vi.useFakeTimers), mock `pingServer`
7. **Component tests** — `MeetingInput` → `DelegationPlan` → `SettingsPanel` → `ExecutionView`
8. **Integration tests** — full flows with MSW; run all tests in CI
9. **E2E with Playwright** — separate PR, requires running venue
