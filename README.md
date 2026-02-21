# Covia PM

Federated AI Project Management frontend for the [Covia Grid](https://www.covia.ai). Coordinates AI agents across 12 execution integrations (Jira, Linear, Azure DevOps, GitHub, GitLab, Slack, Teams, Email, PagerDuty, Sentry, Confluence, Google Calendar) and 9 meeting intelligence tools (Granola, Fathom, Fireflies, Otter, tl;dv, Avoma, Read.ai, Zoom AI, Teams Meeting), with shared execution state, immutable audit trails, and runtime policy enforcement.

## Overview

Covia PM is a **self-deploying** React frontend that:
- Connects to any Covia Grid venue
- Automatically deploys 27 PM operations as self-hosted venue assets
- Fetches transcripts from 9 meeting intelligence tools (Granola, Fathom, Fireflies, etc.)
- Uses LLM-powered analysis to extract and route action items
- Delegates actions to 12 integration targets via MCP (Jira, Linear, GitHub, GitLab, Slack, Teams, Email, PagerDuty, Sentry, Confluence, Calendar, Azure DevOps)
- Data-driven accordion settings panel — add new integrations by editing one config file

## Prerequisites

- **Node.js** 20.19+ or 22.12+
- **pnpm** (recommended) or npm
- **Covia Venue** running locally or remotely (see [covia-repo](https://github.com/covia-ai/covia-repo))
- **covialib** cloned as sibling directory (for local development)

### Directory Structure

```
covia/
├── covialib/          # TypeScript Grid client (required)
├── covia-pm/          # This project
├── covia-repo/        # Venue server (optional, for local development)
└── ...
```

## Quick Start

### 1. Install Dependencies

```bash
# Clone covialib if not already present
cd /path/to/covia
git clone https://github.com/covia-ai/covialib.git
cd covialib && pnpm install && pnpm build

# Install covia-pm dependencies
cd ../covia-pm
pnpm install
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your venue URL
# VITE_VENUE_URL=http://localhost:8080
```

### 3. Run Development Server

```bash
pnpm dev
```

Open http://localhost:5173 in your browser.

### 4. Connect to Venue

1. Enter your venue URL in the connection form (or use the default from `.env`)
2. Click **Connect**
3. The status badge will show "Connected" with the venue ID
4. PM assets are automatically deployed on first connection

## Running the UI

### Development Mode

```bash
pnpm dev          # Start dev server with HMR
```

### Production Build

```bash
pnpm build        # Type-check and build for production
pnpm preview      # Preview production build locally
```

### Other Commands

```bash
pnpm lint         # Run ESLint
pnpm build        # Production build to dist/
```

## Connecting to a Venue

### Local Venue

1. Start the venue server (from covia-repo):
   ```bash
   cd ../covia-repo
   ./mvnw quarkus:dev
   ```

2. The venue will be available at `http://localhost:8080`

3. In Covia PM, enter `http://localhost:8080` and click Connect

### Remote Venue

Enter the full venue URL (e.g., `https://venue.covia.ai`) and click Connect.

### Connection States

| Status | Badge | Description |
|--------|-------|-------------|
| Disconnected | Gray | Not connected to any venue |
| Connecting | Yellow | Connection in progress |
| Connected | Green | Connected, assets deployed |
| Error | Red | Connection failed (see error message) |

## Current Status

All core phases are complete and working end to end:

| # | Phase | Status |
|---|-------|--------|
| 1 | Venue connection & asset deployment | ✅ Complete |
| 2 | Asset definitions (PM operation JSON) | ✅ Complete |
| 3 | Meeting analysis UI | ✅ Complete |
| 4 | Plan execution & step tracking | ✅ Complete |
| 5 | Settings, dark mode, responsive layout | ✅ Complete |
| 6 | Wave 1 — 12 execution targets + 9 transcript sources | ✅ Complete |
| 7 | Testing & documentation | Planned |

**What works today:** connect to any Covia venue → paste or fetch meeting notes → analyse with GPT-4 → review the delegation plan → execute actions against whichever integrations are configured.

---

## Phase Status & Features

### Phase 1: Foundation - COMPLETED

**What works:**
- Connect to any Covia Grid venue via URL
- Connection status indicator in header
- Automatic asset deployment on connect
- Disconnect functionality

**Files:**
- `src/lib/venue.ts` - PMVenueClient wrapper around covialib
- `src/hooks/useVenue.ts` - React hook for connection state
- `src/assets/operations/pm-placeholder.json` - Test asset

**Try it:**
1. Run `pnpm dev`
2. Enter venue URL and click Connect
3. Check browser console for asset deployment logs

---

### Phase 2: Asset Definitions - COMPLETED

**What works:**
- All PM operations defined as JSON assets
- Assets auto-deploy to venue on connect
- LLM system prompts configured for meeting analysis

**Assets deployed:**

| Asset | Purpose |
|-------|---------|
| `pm:placeholder` | Test asset for deployment verification |
| `pm:analyzeMeeting` | LLM extraction of action items from meeting notes |
| `pm:executeJiraActions` | Create Jira issues via MCP |
| `pm:executeGithubActions` | GitHub branch/PR operations via MCP |
| `pm:sendNotifications` | Slack notifications via MCP |
| `pm:fullWorkflow` | End-to-end meeting processing |

**Files:**
- `src/assets/operations/*.json` - Asset definitions
- `src/assets/operations/index.ts` - Asset registry

**Try it:**
1. Connect to a venue
2. Use venue API to list assets: `GET /api/v1/assets/`
3. Verify PM assets are registered

---

### Phase 3: Meeting Analysis UI - COMPLETED

**What works:**
- Meeting notes input textarea with placeholder examples
- Meeting type selector (standup/planning/retro/ad_hoc)
- "Analyze" button with loading spinner
- Delegation plan display showing extracted action items
- Action items grouped by target (Jira/GitHub/Slack)
- Priority badges (critical/high/medium/low)
- Blockers and decisions lists
- Error state handling

**Components:**

| Component | Purpose |
|-----------|---------|
| `MeetingInput` | Form with textarea and meeting type buttons |
| `DelegationPlan` | Displays action items grouped by target |

**Files:**
- `src/components/MeetingInput.tsx` - Meeting input form
- `src/components/DelegationPlan.tsx` - Results display
- `src/types.ts` - Shared TypeScript types

**Try it:**
1. Run `pnpm dev`
2. Connect to a venue
3. Paste meeting notes in the textarea
4. Select meeting type and click "Analyze Meeting"
5. View extracted action items in the delegation plan

**Note:** Requires a running venue with `OPENAI_API_KEY` set in the venue server environment, **or** set `VITE_OPENAI_API_KEY` in `.env.local` to pass the key directly from the frontend (development use only).

---

### Phase 4: Plan Execution - COMPLETED

**What works:**
- Execute Plan button on the delegation plan (disabled with warning if no integrations configured)
- Step-by-step execution view that replaces the delegation plan while running
- Per-step status: ⬜ pending · ⏳ running · ✅ done · ❌ failed · ➖ skipped
- Jira, GitHub, and Slack actions executed separately via their hex-ID asset references
- Collapsible per-step result display (formatted JSON) on completion
- "Back to Plan" and "Start New Analysis" buttons

**Components:**

| Component | Purpose |
|-----------|---------|
| `ExecutionView` | Step-by-step execution progress and results |

**Files:**
- `src/components/ExecutionView.tsx` — Execution progress view
- `src/lib/venue.ts` — `executeActions()` method, `buildAssetIdMap()` for hex ID resolution

**Try it:**
1. Analyse meeting notes to get a delegation plan
2. Open ⚙ Settings and configure at least one integration server URL
3. Click **Execute Plan** — the view transitions to step-by-step progress
4. Steps without a configured server show ➖ SKIPPED

**Note:** Asset hex IDs are resolved automatically after connect — `pm:executeJiraActions` etc. are looked up via `venue.getAssets()` and invoked by their content-hash IDs, as the venue does not accept arbitrary name-based invocation outside the orchestrator adapter.

---

### Phase 5: Configuration & Polish - COMPLETED

**Completed:**
- ✅ Settings panel (slide-out drawer) for MCP server endpoints
- ✅ Auth token fields with show/hide toggle
- ✅ Configuration persistence in localStorage (`covia-pm-settings`)
- ✅ Dark mode toggle (moon/sun icon, persisted in localStorage)
- ✅ Responsive design (breakpoints at 768px and 480px)
- ✅ Error boundary (full-page fallback with "Try again" button)

---

### Phase 6: Expanded Integrations & Accordion Settings — COMPLETED

**What works:**
- 18 new PM assets deployed automatically on connect (9 execution + 9 transcript-fetch)
- 12 execution targets: Jira, Linear, Azure DevOps, GitHub, GitLab, Slack, Teams, Email, PagerDuty, Sentry, Confluence, Google Calendar
- 9 meeting intelligence sources: Granola, Fathom, Fireflies, Otter, tl;dv, Avoma, Read.ai, Zoom AI, Teams Meeting
- Transcript fetch UI in meeting notes form — select source, enter meeting ID, click Fetch
- Dynamic system prompt routes LLM to only configured targets
- Dynamic execution steps — only shows steps for integrations with a server URL configured

**Data-driven integration registry (`src/config/integrations.ts`):**

| Task | How |
|------|-----|
| Add a tool | Append one `Integration` object to the `INTEGRATIONS` array |
| Remove a tool | Delete its entry |
| Hide without removing | Set `hidden: true` |
| Recategorize | Change its `category` field |

**Accordion Settings UI:**
- Categories (Issue Trackers, Version Control, etc.) are collapsible
- Each tool expands to show its fields; collapses when not in use
- `● Configured` / `○ Not set` status badge per tool
- Tools auto-expand on panel open if already configured

---

### Phase 7: Testing & Documentation — PLANNED

**Will include:**
- Unit tests for PMVenueClient
- Integration tests with mock venue
- End-to-end tests
- User guide

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_VENUE_URL` | Default venue URL | `http://localhost:8080` |
| `VITE_OPENAI_API_KEY` | OpenAI API key passed to the venue's LangChain adapter. Dev use only — prefer setting `OPENAI_API_KEY` on the venue server for production. | — |

### MCP Server Configuration

Configure MCP servers via the ⚙ Settings panel. Values are persisted in `localStorage`:

```typescript
// Each integration: server URL + config field(s) + optional auth token
// Stored in localStorage under 'covia-pm-settings'
{
  // Issue Trackers
  jiraServer: 'https://jira-mcp.example.com/mcp', jiraProjectKey: 'PROJ', jiraToken: '...',
  linearServer: '...', linearTeamKey: 'ENG', linearToken: '...',
  azureServer: '...', azureOrg: 'myorg', azureProject: 'MyProject', azureToken: '...',
  // Version Control
  githubServer: '...', githubRepo: 'org/repo', githubToken: '...',
  gitlabServer: '...', gitlabRepo: 'group/project', gitlabToken: '...',
  // Communication
  slackServer: '...', slackChannel: '#updates', slackToken: '...',
  teamsServer: '...', teamsChannel: 'General', teamsToken: '...',
  emailServer: '...', emailTo: 'stakeholders@example.com', emailToken: '...',
  // Incident / Observability / Docs / Calendar
  pagerdutyServer: '...', pagerdutyServiceId: 'P123', pagerdutyToken: '...',
  sentryServer: '...', sentryProject: 'my-project', sentryToken: '...',
  confluenceServer: '...', confluenceSpaceKey: 'ENG', confluenceToken: '...',
  calendarServer: '...', calendarId: 'primary', calendarToken: '...',
  // Meeting Intelligence (server + token per tool)
  granolaServer: '...', granolaToken: '...',
  fathomServer: '...', fathomToken: '...',
  // ... fireflies, otter, tldv, avoma, read, zoom, teamsMeeting
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      COVIA PM FRONTEND                          │
│                     (React + Vite + TypeScript)                 │
│                                                                 │
│  src/config/integrations.ts  ← single source of truth for      │
│    21 integrations across 8 categories; add/hide by editing     │
│    one file, no component code changes needed                   │
│                                                                 │
│  src/assets/operations/  (27 JSON assets, auto-deployed)        │
│    pm-analyzeMeeting           LLM action-item extraction       │
│    pm-fullWorkflow             end-to-end orchestration         │
│    ── Execution (12 targets) ──────────────────────────────     │
│    pm-executeJiraActions       pm-executeLinearActions          │
│    pm-executeAzureDevOpsActions  pm-executeGithubActions        │
│    pm-executeGitLabActions     pm-sendNotifications (Slack)     │
│    pm-sendTeamsNotifications   pm-sendEmailNotifications        │
│    pm-createPagerDutyIncidents pm-linkSentryIssues              │
│    pm-writeConfluencePages     pm-scheduleCalendarEvents        │
│    ── Transcript Fetch (9 sources) ────────────────────────     │
│    pm-fetchGranolaNote         pm-fetchFathomSummary            │
│    pm-fetchFirefliesTranscript pm-fetchOtterTranscript          │
│    pm-fetchTldvHighlights      pm-fetchAvomaSummary             │
│    pm-fetchReadSummary         pm-fetchZoomAISummary            │
│    pm-fetchTeamsMeetingSummary                                  │
│                                                                 │
│  covialib (TypeScript Grid Client)                              │
│    Grid.connect() → Venue                                       │
│    venue.createAsset() → register all 27 operations on connect  │
│    venue.run(assetId, input) → execute by content-hash ID       │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP / REST API
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        COVIA VENUE                              │
│                    (Generic Grid Node)                          │
├─────────────────────────────────────────────────────────────────┤
│  Adapters (built-in):                                           │
│    langchain    → LLM calls (OpenAI, Ollama, …)                │
│    orchestrator → Multi-step workflows                          │
│    mcp          → External tool calls via MCP servers           │
├─────────────────────────────────────────────────────────────────┤
│  All 27 PM assets registered on first connect; assets are       │
│  content-addressed — re-deploying the same JSON is a no-op.    │
└─────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
covia-pm/
├── src/
│   ├── assets/
│   │   └── operations/           # PM asset definitions (JSON) — 27 assets
│   │       ├── index.ts          # Asset registry
│   │       ├── pm-placeholder.json
│   │       ├── pm-analyzeMeeting.json
│   │       ├── pm-executeJiraActions.json
│   │       ├── pm-executeGithubActions.json
│   │       ├── pm-sendNotifications.json
│   │       ├── pm-fullWorkflow.json
│   │       └── pm-execute*.json / pm-fetch*.json  # Wave 1 assets (18 files)
│   ├── config/
│   │   └── integrations.ts       # Integration registry — add/remove/hide tools here
│   ├── hooks/
│   │   ├── useVenue.ts           # React hook for venue connection
│   │   └── useSettings.ts        # React hook for settings persistence
│   ├── lib/
│   │   └── venue.ts              # PMVenueClient class
│   ├── components/
│   │   ├── index.ts              # Barrel exports
│   │   ├── ErrorBoundary.tsx     # Full-page render error fallback
│   │   ├── MeetingInput.tsx      # Meeting notes form + transcript fetch
│   │   ├── DelegationPlan.tsx    # Action items display + Execute Plan button
│   │   ├── ExecutionView.tsx     # Step-by-step execution progress
│   │   └── SettingsPanel.tsx     # Accordion configuration drawer (data-driven)
│   ├── App.tsx                   # Main application component
│   ├── main.tsx                  # Entry point
│   ├── types.ts                  # Shared TypeScript types
│   └── index.css                 # Semantic CSS styles
├── .env.example                  # Environment template
├── .env.local                    # Local overrides — not committed
├── CLAUDE.md                     # Development guide
├── DESIGN.md                     # Architecture documentation
└── package.json
```

## Troubleshooting

### "Cannot find module '@covia-ai/covialib'"

Ensure covialib is cloned and built as a sibling directory:

```bash
cd ../covialib
pnpm install
pnpm build
```

### "Connection failed" error

1. Verify the venue is running: `curl http://localhost:8080/api/v1/status`
2. Check for CORS issues in browser console
3. Ensure the venue URL includes the protocol (`http://` or `https://`)

### Assets not deploying

Check browser console for errors. Common issues:
- Venue not reachable
- Asset already exists with different content (hash mismatch)
- Network timeout

## Related Projects

- [covialib](https://github.com/covia-ai/covialib) - TypeScript Grid client
- [covia-repo](https://github.com/covia-ai/covia-repo) - Venue server
- [covia-sdk-py](https://github.com/covia-ai/covia-sdk-py) - Python SDK
- [Covia Documentation](https://docs.covia.ai)

## License

MIT
