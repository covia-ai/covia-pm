# Covia PM - Design Document

## Overview

Covia PM is a federated AI project management frontend that coordinates agents across Jira, GitHub, and Slack. The application is **self-deploying** - it registers its own operations as assets on the Covia Grid venue, making the venue a generic execution environment.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      COVIA PM FRONTEND                          │
│                     (React + Vite + TypeScript)                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  /src/assets/operations/                                │    │
│  │    pm-analyzeMeeting.json      (LLM extraction)        │    │
│  │    pm-executeJiraActions.json  (MCP orchestration)     │    │
│  │    pm-executeGithubActions.json                        │    │
│  │    pm-sendNotifications.json                           │    │
│  │    pm-fullWorkflow.json        (end-to-end)            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                               │                                  │
│                    on connect: ensureAssets()                   │
│                               │                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  covialib (TypeScript Grid Client)                      │    │
│  │    Grid.connect() → Venue                               │    │
│  │    venue.createAsset() → register operations            │    │
│  │    venue.invoke() / venue.run() → execute               │    │
│  └─────────────────────────────────────────────────────────┘    │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP / REST API
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        COVIA VENUE                              │
│                    (Generic Grid Node)                          │
├─────────────────────────────────────────────────────────────────┤
│  Adapters (built-in):                                           │
│    langchain  → LLM calls (OpenAI, Ollama)                     │
│    orchestrator → Multi-step workflows                          │
│    mcp       → External tool calls (Jira, GitHub, Slack)       │
├─────────────────────────────────────────────────────────────────┤
│  Assets (deployed by frontend):                                 │
│    pm:analyzeMeeting     │ pm:executeJiraActions               │
│    pm:executeGithubActions │ pm:sendNotifications              │
│    pm:fullWorkflow                                              │
└─────────────────────────────────────────────────────────────────┘
```

## Core Principles

### 1. Self-Deploying Frontend

The frontend owns its business logic as **asset definitions**. On connection to a venue:

1. Compute SHA-256 hash of each asset metadata (= asset ID)
2. Check if asset exists via `venue.getAsset(id)`
3. If missing, register via `venue.createAsset(metadata)`
4. Assets are now invocable operations

This pattern ensures:
- **Portability** - Same frontend works on any Covia venue
- **Versioning** - Asset definitions versioned with frontend code
- **Self-healing** - Missing assets auto-deployed on connect
- **Decoupling** - Venue remains generic infrastructure

### 2. LLM-Powered Extraction

Meeting analysis uses the `langchain` adapter with a structured system prompt:

```json
{
  "operation": {
    "adapter": "langchain:openai",
    "model": "gpt-4",
    "systemPrompt": "Extract action items as JSON: {actionItems: [{type, description, assignee, priority, target}]}"
  }
}
```

No custom NLP code - the LLM does the work, configured via prompt.

### 3. Orchestrated Execution

Multi-step workflows use the `orchestrator` adapter with step dependencies:

```json
{
  "operation": {
    "adapter": "orchestrator",
    "steps": [
      {"op": "pm:analyzeMeeting", "input": {...}},
      {"op": "mcp:tools:call", "input": {"toolName": "create_issue", ...}},
      {"op": "mcp:tools:call", "input": {"toolName": "post_message", ...}}
    ],
    "result": {"analysis": [0, "response"], "jiraResult": [1, "result"]}
  }
}
```

### 4. MCP for External Tools

External services (Jira, GitHub, Slack) are accessed via MCP adapters:

```json
{
  "server": "https://jira-mcp.example.com/mcp",
  "toolName": "create_issue",
  "arguments": {"project": "PROJ", "summary": "..."}
}
```

## Asset Definitions

### pm:analyzeMeeting

**Purpose:** Extract action items from meeting notes using LLM

**Adapter:** `langchain:openai`

**Input:**
```typescript
{
  notes: string;      // Raw meeting notes
  meetingType: string; // standup | planning | retro | ad_hoc
}
```

**Output:**
```typescript
{
  actionItems: Array<{
    type: 'create_issue' | 'review_pr' | 'create_branch' | 'send_notification';
    description: string;
    assignee?: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    target: 'jira' | 'github' | 'slack';
    metadata?: Record<string, any>;
  }>;
  blockers: string[];
  decisions: string[];
}
```

### pm:executeJiraActions

**Purpose:** Create Jira issues from action items

**Adapter:** `orchestrator` with `mcp:tools:call` steps

**Input:**
```typescript
{
  actions: ActionItem[];  // Filtered to target: 'jira'
  jiraServer: string;     // MCP server URL
  projectKey: string;     // Jira project key
}
```

### pm:executeGithubActions

**Purpose:** Create branches/PRs from action items

**Adapter:** `orchestrator` with `mcp:tools:call` steps

**Input:**
```typescript
{
  actions: ActionItem[];  // Filtered to target: 'github'
  githubServer: string;   // MCP server URL
  repo: string;           // owner/repo
}
```

### pm:sendNotifications

**Purpose:** Send Slack notifications

**Adapter:** `orchestrator` with `mcp:tools:call` steps

**Input:**
```typescript
{
  actions: ActionItem[];  // Filtered to target: 'slack'
  slackServer: string;    // MCP server URL
  channel: string;        // Slack channel ID
}
```

### pm:fullWorkflow

**Purpose:** End-to-end meeting processing

**Adapter:** `orchestrator`

**Steps:**
1. `pm:analyzeMeeting` - Extract action items
2. `pm:executeJiraActions` - Create issues (depends on step 0)
3. `pm:executeGithubActions` - Create branches (depends on step 0)
4. `pm:sendNotifications` - Notify team (depends on steps 0, 1, 2)

## Frontend Implementation

### Venue Client

```typescript
// src/lib/venue.ts
import { Grid, Venue, Asset, CoviaError } from '@covia-ai/covialib';
import pmAssets from '../assets/operations';

export class PMVenueClient {
  private venue: Venue | null = null;
  private assetsDeployed = false;

  async connect(venueUrl: string): Promise<Venue> {
    this.venue = await Grid.connect(venueUrl);
    await this.ensureAssets();
    return this.venue;
  }

  private async ensureAssets(): Promise<void> {
    if (this.assetsDeployed || !this.venue) return;

    for (const assetMetadata of pmAssets) {
      const assetId = await this.computeAssetId(assetMetadata);

      try {
        await this.venue.getAsset(assetId);
        // Asset exists
      } catch (e) {
        if (e instanceof CoviaError && e.code === 404) {
          await this.venue.createAsset(assetMetadata);
        } else {
          throw e;
        }
      }
    }

    this.assetsDeployed = true;
  }

  private async computeAssetId(metadata: object): Promise<string> {
    const json = JSON.stringify(metadata);
    const buffer = new TextEncoder().encode(json);
    const hash = await crypto.subtle.digest('SHA-256', buffer);
    return '0x' + Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async analyzeMeeting(notes: string, meetingType = 'ad_hoc') {
    return this.venue!.run('pm:analyzeMeeting', {
      prompt: notes,
      meetingType
    });
  }

  async executeFullWorkflow(notes: string, config: WorkflowConfig) {
    return this.venue!.run('pm:fullWorkflow', {
      notes,
      ...config
    });
  }
}
```

### React Integration

```typescript
// src/hooks/useVenue.ts
import { useState, useEffect } from 'react';
import { PMVenueClient } from '../lib/venue';

export function useVenue(venueUrl: string) {
  const [client] = useState(() => new PMVenueClient());
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    client.connect(venueUrl)
      .then(() => setConnected(true))
      .catch(setError);
  }, [venueUrl]);

  return { client, connected, error };
}
```

## Data Flow

```
User pastes meeting notes
         │
         ▼
┌─────────────────────┐
│  Frontend UI        │
│  (React component)  │
└─────────┬───────────┘
          │ client.analyzeMeeting(notes)
          ▼
┌─────────────────────┐
│  PMVenueClient      │
│  (covialib wrapper) │
└─────────┬───────────┘
          │ venue.run('pm:analyzeMeeting', {prompt: notes})
          ▼
┌─────────────────────┐
│  Covia Venue        │
│  POST /api/v1/invoke│
└─────────┬───────────┘
          │ langchain:openai adapter
          ▼
┌─────────────────────┐
│  OpenAI API         │
│  (GPT-4)            │
└─────────┬───────────┘
          │ JSON response
          ▼
┌─────────────────────┐
│  Venue returns Job  │
│  with output        │
└─────────┬───────────┘
          │ {actionItems: [...], blockers: [...]}
          ▼
┌─────────────────────┐
│  Frontend displays  │
│  delegation plan    │
└─────────────────────┘
```

## Configuration

### Environment Variables

```bash
# .env
VITE_VENUE_URL=https://venue.covia.ai
VITE_OPENAI_API_KEY=sk-...  # Passed to venue for LLM calls
```

### MCP Server Configuration

MCP servers are configured per-invocation:

```typescript
await client.executeFullWorkflow(notes, {
  jiraServer: 'https://jira-mcp.example.com/mcp',
  githubServer: 'https://github-mcp.example.com/mcp',
  slackServer: 'https://slack-mcp.example.com/mcp',
  jiraProjectKey: 'PROJ',
  githubRepo: 'org/repo',
  slackChannel: '#updates'
});
```

## File Structure

```
covia-pm/
├── src/
│   ├── assets/
│   │   └── operations/
│   │       ├── index.ts                    # Export all assets
│   │       ├── pm-analyzeMeeting.json
│   │       ├── pm-executeJiraActions.json
│   │       ├── pm-executeGithubActions.json
│   │       ├── pm-sendNotifications.json
│   │       └── pm-fullWorkflow.json
│   ├── lib/
│   │   └── venue.ts                        # PMVenueClient
│   ├── hooks/
│   │   └── useVenue.ts                     # React hook
│   ├── components/
│   │   ├── MeetingInput.tsx
│   │   ├── DelegationPlan.tsx
│   │   └── ExecutionResults.tsx
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── DESIGN.md                               # This document
├── CLAUDE.md                               # Development guide
└── package.json
```

## Dependencies

```json
{
  "dependencies": {
    "@covia-ai/covialib": "^1.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "typescript": "^5.0.0",
    "vite": "^7.0.0"
  }
}
```

## Benefits

| Aspect | Benefit |
|--------|---------|
| **No backend code** | All PM logic is asset configuration + LLM prompts |
| **Portable** | Same assets work on any Covia venue |
| **Versionable** | Asset definitions versioned with frontend |
| **Auditable** | Every operation creates a Job in the Grid |
| **Extensible** | Add new operations by adding JSON files |
| **Testable** | Test assets locally before deploying |

## Implementation Roadmap

### Phase 1: Foundation (Week 1) - COMPLETED

**Goal:** Establish venue connectivity and asset deployment infrastructure

- [x] Install and configure covialib dependency
- [x] Implement `PMVenueClient` with `connect()` and `ensureAssets()`
- [x] Create `useVenue` React hook for connection state management
- [x] Add venue URL configuration (environment variable)
- [x] Build connection status indicator in UI
- [x] Test asset deployment with a single dummy operation

**Deliverable:** Frontend connects to venue and deploys placeholder asset

### Phase 2: Asset Definitions (Week 1-2)

**Goal:** Define all PM operations as deployable JSON assets

- [ ] Create `src/assets/operations/` directory structure
- [ ] Define `pm-analyzeMeeting.json` with langchain adapter config
- [ ] Define `pm-executeJiraActions.json` with orchestrator + MCP steps
- [ ] Define `pm-executeGithubActions.json`
- [ ] Define `pm-sendNotifications.json`
- [ ] Define `pm-fullWorkflow.json` (end-to-end orchestration)
- [ ] Create `index.ts` to export all assets for deployment
- [ ] Update `ensureAssets()` to deploy all operations

**Deliverable:** All PM operations registered as venue assets on connect

### Phase 3: Meeting Analysis UI (Week 2)

**Goal:** Build the meeting input and analysis display components

- [ ] Create `MeetingInput` component (textarea + meeting type selector)
- [ ] Create `DelegationPlan` component to display extracted action items
- [ ] Wire `analyzeMeeting()` to venue invocation
- [ ] Add loading states and error handling
- [ ] Style components with semantic CSS
- [ ] Group action items by target (Jira/GitHub/Slack)

**Deliverable:** User can paste meeting notes and see extracted action items

### Phase 4: Plan Execution (Week 3)

**Goal:** Execute delegation plans across external services

- [ ] Create `ExecutionResults` component with progress tracking
- [ ] Implement `executeFullWorkflow()` invocation
- [ ] Add MCP server configuration UI (Jira, GitHub, Slack URLs)
- [ ] Display per-action execution status (pending/running/success/error)
- [ ] Handle partial failures gracefully
- [ ] Add manual approval step before execution (optional)

**Deliverable:** End-to-end workflow from meeting notes to executed actions

### Phase 5: Configuration & Polish (Week 3-4)

**Goal:** Production-ready configuration and UX

- [ ] Settings panel for MCP server endpoints
- [ ] Jira project key and GitHub repo configuration
- [ ] Slack channel selection
- [ ] Persist configuration in localStorage
- [ ] Dark mode toggle (already supported in CSS)
- [ ] Responsive design verification
- [ ] Error boundary implementation

**Deliverable:** Fully configurable, polished application

### Phase 6: Testing & Documentation (Week 4)

**Goal:** Verified, documented release

- [ ] Unit tests for `PMVenueClient`
- [ ] Integration tests with mock venue
- [ ] End-to-end test with real venue (staging)
- [ ] Update CLAUDE.md with final implementation details
- [ ] Add inline code documentation
- [ ] Create user guide / README

**Deliverable:** Tested, documented v1.0 release

---

## Implementation Status

### Phase 1: Foundation (Completed)

Phase 1 established the core infrastructure for venue connectivity and asset deployment.

#### Files Created

| File | Purpose |
|------|---------|
| `src/lib/venue.ts` | PMVenueClient class wrapping covialib |
| `src/hooks/useVenue.ts` | React hook for connection state |
| `src/assets/operations/index.ts` | Asset registry exporting all PM operations |
| `src/assets/operations/pm-placeholder.json` | Test asset for deployment verification |
| `.env.example` | Environment variable template |

#### PMVenueClient Implementation

The `PMVenueClient` class (`src/lib/venue.ts`) provides:

```typescript
class PMVenueClient {
  // Connection state
  get isConnected(): boolean;
  get venueId(): string | null;

  // Lifecycle
  async connect(venueUrl: string): Promise<Venue>;
  async disconnect(): Promise<void>;

  // Asset deployment (called automatically on connect)
  private async ensureAssets(): Promise<void>;
  private async computeAssetId(metadata: object): Promise<string>;

  // Operations (to be used in Phase 3+)
  async analyzeMeeting(notes: string, meetingType?: string): Promise<AnalysisResult>;
  async executeFullWorkflow(notes: string, config: WorkflowConfig): Promise<unknown>;
  async getDeployedAssets(): Promise<string[]>;
}
```

**Key design decisions:**

1. **Lazy asset deployment** - Assets are only deployed on first connect, tracked via `assetsDeployed` flag
2. **Content-addressable IDs** - Asset IDs computed as SHA-256 hash of metadata JSON, enabling automatic versioning
3. **Error recovery** - 404 errors trigger asset creation; other errors propagate

#### useVenue Hook Implementation

The `useVenue` hook (`src/hooks/useVenue.ts`) provides React integration:

```typescript
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

function useVenue(): {
  client: PMVenueClient;
  status: ConnectionStatus;
  error: Error | null;
  venueId: string | null;
  connect: (url: string) => Promise<void>;
  disconnect: () => void;
}
```

**Usage in components:**

```tsx
function App() {
  const { status, error, venueId, connect, disconnect } = useVenue();
  // Render connection UI based on status
}
```

#### UI Components

**ConnectionIndicator** - Header badge showing connection state:
- Disconnected (neutral)
- Connecting (warning/yellow)
- Connected (success/green) + venue ID
- Error (error/red) + error message

**VenueConnect** - Hero section form:
- URL input (pre-filled from `VITE_VENUE_URL` env var)
- Connect/Disconnect button
- Disabled during connection attempt

#### Dependencies Added

```json
{
  "dependencies": {
    "@covia-ai/covialib": "link:../covialib",
    "did-resolver": "^4.1.0",
    "web-did-resolver": "^2.0.32"
  }
}
```

Note: `did-resolver` and `web-did-resolver` are transitive dependencies of covialib required for DID resolution when connecting to venues.

#### Configuration

Environment variables (`.env.example`):

```bash
VITE_VENUE_URL=http://localhost:8080
```

TypeScript configuration (`tsconfig.app.json`):
- Added `resolveJsonModule: true` for JSON asset imports

---

## Future Enhancements

1. **Asset versioning** - Include version in asset metadata, migrate on upgrade
2. **Offline mode** - Cache asset definitions in localStorage
3. **Multi-venue** - Deploy to multiple venues for redundancy
4. **Custom adapters** - Register venue-side adapters for complex logic
5. **Policy enforcement** - Add approval workflows before execution
