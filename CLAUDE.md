# Covia PM — Development Guide

## Overview

Covia PM is a **self-deploying** React frontend that coordinates AI agents across 12 execution integrations and 9 meeting intelligence tools via the Covia Grid. It registers its own operation definitions as venue assets on connect, so the venue stays generic infrastructure and all PM logic lives in this repository.

---

## Tech Stack

| Tool | Version | Role |
|------|---------|------|
| Vite | 7 | Build tool / dev server |
| React | 19 | UI framework |
| TypeScript | 5 | Type safety |
| pnpm | 10+ | Package manager |
| Semantic CSS | — | Styling (no Tailwind) |
| Vitest | 4 | Test runner |
| @testing-library/react | 16 | Component tests (React 19 compatible) |

---

## Quick Start

```bash
# Build covialib first (must be a sibling directory)
cd ../covialib && pnpm install && pnpm build

# Install and run covia-pm
cd ../covia-pm
pnpm install
cp .env.example .env      # set VITE_VENUE_URL
pnpm dev                  # http://localhost:5173
```

---

## Scripts

```bash
pnpm dev              # Start dev server with HMR
pnpm build            # Type-check + production build → dist/
pnpm preview          # Preview production build
pnpm lint             # ESLint
pnpm test             # Run unit/component tests (Vitest)
pnpm test:coverage    # Run tests with V8 coverage report
```

---

## Project Structure

```
covia-pm/
├── src/
│   ├── assets/operations/        # 24 PM asset definitions (JSON)
│   │   ├── index.ts              # Asset registry — exports all assets for deployment
│   │   ├── pm-placeholder.json   # Deployment smoke-test asset
│   │   ├── pm-analyzeMeeting.json
│   │   ├── pm-fullWorkflow.json
│   │   ├── pm-execute*.json      # 10 execution targets (Jira, Linear, Azure, …)
│   │   ├── pm-send*.json         # 3 notification targets (Slack, Teams, Email)
│   │   └── pm-fetch*.json        # 9 transcript-fetch sources (Granola, Fathom, …)
│   │
│   ├── config/
│   │   └── integrations.ts       # Integration registry — SINGLE SOURCE OF TRUTH
│   │                             # Drives SettingsPanel, health checks, and execution
│   │
│   ├── lib/
│   │   ├── venue.ts              # PMVenueClient — Grid wrapper, asset dispatch
│   │   └── serverPing.ts         # Reachability check (no-cors HEAD + AbortController)
│   │
│   ├── hooks/
│   │   ├── useVenue.ts           # Connection state machine
│   │   ├── useSettings.ts        # localStorage persistence for PMSettings
│   │   └── useHealthChecks.ts    # Per-integration MCP server health polling
│   │
│   ├── components/
│   │   ├── MeetingInput.tsx      # Notes textarea + meeting type + transcript fetch UI
│   │   ├── DelegationPlan.tsx    # Action item groups + Execute Plan button
│   │   ├── ExecutionView.tsx     # Step-by-step execution progress + results
│   │   ├── SettingsPanel.tsx     # Accordion drawer — fully data-driven from integrations.ts
│   │   ├── ErrorBoundary.tsx     # Full-page render-error fallback
│   │   └── index.ts              # Barrel exports
│   │
│   ├── test/
│   │   └── setup.ts              # @testing-library/jest-dom import
│   │
│   ├── App.tsx                   # Root component — orchestrates all hooks + views
│   ├── types.ts                  # Shared TypeScript types (PMSettings, AnalysisResult, …)
│   ├── main.tsx                  # Entry point — wraps App in ErrorBoundary
│   └── index.css                 # Semantic CSS with Covia colour palette (OKLCH)
│
├── vitest.config.ts              # Test config — happy-dom, globals, coverage
├── CLAUDE.md                     # This file
├── DESIGN.md                     # Architecture + integration roadmap
├── TESTING.md                    # Test strategy and coverage report
└── .env.example                  # Environment variable template
```

---

## Architecture Patterns

### 1. Self-Deploying Assets

On every `Grid.connect()`, `ensureAssets()` in `PMVenueClient` deploys all 24 asset JSON files to the venue. Assets are content-addressed (SHA-256 of JSON metadata), so re-deploying the same JSON is a no-op (venue returns 409 / "already exists", which is swallowed).

```
Grid.connect(url)
  └─ ensureAssets()
       └─ for each asset in src/assets/operations/index.ts:
            venue.createAsset(metadata)   ← no-op if already exists
```

### 2. Hex ID Invocation

The venue only accepts `adapter:op` strings (e.g. `langchain:openai`) or **content-hash hex IDs** in its invoke endpoint. Named PM assets (`pm:executeJiraActions`) are not invocable by name. After `ensureAssets()`, `buildAssetIdMap()` calls `venue.getAssets()` and maps `pm:*` names → hex IDs. `executeActions()` uses this map.

```
buildAssetIdMap()  →  { 'pm:executeJiraActions': '0xabcd…', … }
executeActions()   →  venue.run('0xabcd…', input)
```

### 3. Integration Registry

`src/config/integrations.ts` is the single source of truth. Every integration (`INTEGRATIONS` array entry) drives:
- The accordion categories and fields in `SettingsPanel`
- Which server URLs `useHealthChecks` pings
- Which targets `executeActions` dispatches to

To **add** an integration: append one `Integration` object to `INTEGRATIONS`. To **hide** without deleting: set `hidden: true`.

### 4. MCP Health Checks

`useHealthChecks(settings, isConnected)` polls configured server URLs with a 5-second no-cors HEAD request (`serverPing.ts`). Returns a `HealthMap` — `'checking' | 'ok' | 'unreachable'` per `serverKey`. Consumed by `SettingsPanel` (status badge) and `DelegationPlan` (unreachable warning).

Two effects run:
- **Effect 1 (0ms)** — fires immediately when `isConnected` changes or settings change
- **Effect 2 (500ms debounce)** — fires when settings change (prevents ping storm on every keystroke)

---

## Adding a New Integration

1. **Add the asset JSON** in `src/assets/operations/`:
   ```bash
   cp pm-executeJiraActions.json pm-executeAsanaActions.json
   # Edit to match Asana's MCP tool names and input schema
   ```

2. **Register the asset** in `src/assets/operations/index.ts`:
   ```ts
   import pmExecuteAsanaActions from './pm-executeAsanaActions.json';
   // add to pmAssets array
   ```

3. **Add settings fields** to `PMSettings` in `src/types.ts`:
   ```ts
   asanaServer: string;
   asanaTeamId: string;
   asanaToken: string;
   ```

4. **Add defaults** in `src/hooks/useSettings.ts` under `DEFAULT_SETTINGS`.

5. **Register the integration** in `src/config/integrations.ts`:
   ```ts
   {
     id: 'asana',
     name: 'Asana',
     description: 'Create tasks in Asana projects',
     category: 'issue-trackers',
     icon: 'As',
     iconColor: 'oklch(0.55 0.15 30)',
     serverKey: 'asanaServer',
     fields: [
       { key: 'asanaServer', label: 'MCP Server URL', placeholder: 'https://…', type: 'url' },
       { key: 'asanaTeamId', label: 'Team ID',        placeholder: 'team-id'   },
       { key: 'asanaToken',  label: 'Token',           placeholder: 'Bearer …', type: 'password' },
     ],
   }
   ```

6. **Add the dispatch case** in `PMVenueClient.executeActions()` in `src/lib/venue.ts`:
   ```ts
   await dispatch('asana', settings.asanaServer, 'pm:executeAsanaActions', {
     actions: grouped['asana'] ?? [],
     asanaServer: settings.asanaServer,
     teamId: settings.asanaTeamId,
     token: settings.asanaToken,
   });
   ```

7. **Extend the `ActionTarget` union** in `src/types.ts` if the LLM should route to this target.

8. **Update `buildTargetMappings()`** in `venue.ts` to include the new target in the system prompt.

That's it — the SettingsPanel accordion, health checks, and execution flow all pick up the new integration automatically.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_VENUE_URL` | `http://localhost:8080` | Pre-filled venue URL in the connection form |
| `VITE_OPENAI_API_KEY` | — | Dev convenience: passed as `apiKey` to the venue's LangChain adapter. **Production:** set `OPENAI_API_KEY` on the venue server instead |

Copy `.env.example` → `.env` and set as needed. Never commit `.env.local`.

---

## Styling Guidelines

This project uses **semantic CSS** with CSS custom properties. No utility-first frameworks.

### Colour Palette (OKLCH)

```css
--color-primary:   oklch(0.5033 0.1829 292.42)  /* Purple */
--color-secondary: oklch(0.646  0.1423 253.92)  /* Blue */
--color-accent:    oklch(0.7957 0.1526 77.54)   /* Gold */
--color-success:   oklch(0.6    0.15   145)      /* Green */
--color-warning:   oklch(0.7    0.15   70)       /* Amber */
--color-error:     oklch(0.55   0.2    25)       /* Red */
```

### Dark Mode

Toggle by adding/removing `.dark` on `<html>`. Preference persisted in `localStorage` under `covia-pm-dark`.

### Class Conventions

- `.card` — bordered card container with shadow
- `.button-primary` / `.button-secondary` / `.button-outline` — button variants
- `.badge` / `.badge-success` / `.badge-error` — status badges
- `.spinner` — CSS keyframe loading spinner
- `.integration-status.ok` / `.checking` / `.unreachable` — health badge states

---

## Testing

Tests live alongside source files in `*.test.ts` / `*.test.tsx`.

```bash
pnpm test             # watch mode
pnpm test --run       # single pass (CI)
pnpm test:coverage    # coverage report
```

### Key Patterns

**Fake timers + async hook state (useHealthChecks pattern)**

Use *separate* `act()` calls — one to flush effects (register timers), one to advance timers and flush resulting async state:

```ts
// CORRECT
await act(async () => { rerender({ connected: true }); }); // flush effects
await act(async () => { await vi.advanceTimersByTimeAsync(10); }); // fire timers
```

**Class constructor mocks (useVenue pattern)**

Use `vi.hoisted()` for variables referenced in mock factories, and regular functions (not arrows) for constructor mocks:

```ts
const { mockConnect } = vi.hoisted(() => ({ mockConnect: vi.fn() }));
vi.mock('../lib/venue', () => ({
  PMVenueClient: vi.fn(function () { return { connect: mockConnect }; }),
}));
```

**Coverage targets**

| Area | Target | Achieved |
|------|--------|---------|
| `src/hooks/` | 85%+ | 100% |
| `src/components/` | 75%+ | 85% |
| `src/lib/serverPing.ts` | 90%+ | 100% |

---

## Common Gotchas

### "is not a constructor" in vi.mock
Arrow functions can't be `new`-called. Use `vi.fn(function() {...})` for class mocks, and `vi.hoisted()` for variables the mock factory references.

### react-hooks/set-state-in-effect lint error
ESLint forbids calling `setState` synchronously inside a `useEffect` body. Wrap in `setTimeout(..., 0)` to defer:
```ts
useEffect(() => {
  const id = setTimeout(() => setHealth({}), 0);
  return () => clearTimeout(id);
}, [isConnected]);
```

### TypeScript JSON imports
`tsconfig.app.json` has `"resolveJsonModule": true` so asset JSON files import cleanly. No special configuration needed.

### Asset hex IDs
Never call `venue.run('pm:executeJiraActions', ...)` directly — the venue doesn't accept `pm:` as an adapter prefix. Always use the hex ID from `assetIdMap`. This is handled automatically in `PMVenueClient.executeActions()`.

### covialib must be built
`@covia-ai/covialib` is linked via `"link:../covialib"`. If it's not built, TypeScript will fail to find types. Run `pnpm build` in the covialib directory before starting covia-pm.
