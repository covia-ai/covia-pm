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
# .env.example / .env.local
VITE_VENUE_URL=https://venue.covia.ai

# Development only: passes OpenAI key directly to the venue's LangChain adapter.
# Prefer setting OPENAI_API_KEY on the venue server for production.
VITE_OPENAI_API_KEY=sk-...
```

### MCP Server Configuration

MCP servers are configured via the settings panel (persisted in `localStorage`) and passed at invocation time:

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
│   │       ├── pm-placeholder.json
│   │       ├── pm-analyzeMeeting.json
│   │       ├── pm-executeJiraActions.json
│   │       ├── pm-executeGithubActions.json
│   │       ├── pm-sendNotifications.json
│   │       └── pm-fullWorkflow.json
│   ├── lib/
│   │   └── venue.ts                        # PMVenueClient
│   ├── hooks/
│   │   ├── useVenue.ts                     # Venue connection state
│   │   └── useSettings.ts                  # Settings persistence (localStorage)
│   ├── components/
│   │   ├── index.ts                        # Barrel exports
│   │   ├── ErrorBoundary.tsx               # Full-page render error fallback
│   │   ├── MeetingInput.tsx
│   │   ├── DelegationPlan.tsx              # Action items + Execute Plan button
│   │   ├── ExecutionView.tsx               # Step-by-step execution progress
│   │   └── SettingsPanel.tsx               # Configuration slide-out drawer
│   ├── types.ts                            # Shared TypeScript types
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── .env.example                            # Environment template
├── .env.local                              # Local overrides (not committed)
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

### Phase 2: Asset Definitions (Week 1-2) - COMPLETED

**Goal:** Define all PM operations as deployable JSON assets

- [x] Create `src/assets/operations/` directory structure
- [x] Define `pm-analyzeMeeting.json` with langchain adapter config
- [x] Define `pm-executeJiraActions.json` with orchestrator + MCP steps
- [x] Define `pm-executeGithubActions.json`
- [x] Define `pm-sendNotifications.json`
- [x] Define `pm-fullWorkflow.json` (end-to-end orchestration)
- [x] Create `index.ts` to export all assets for deployment
- [x] Update `ensureAssets()` to deploy all operations

**Deliverable:** All PM operations registered as venue assets on connect

### Phase 3: Meeting Analysis UI (Week 2) - COMPLETED

**Goal:** Build the meeting input and analysis display components

- [x] Create `MeetingInput` component (textarea + meeting type selector)
- [x] Create `DelegationPlan` component to display extracted action items
- [x] Wire `analyzeMeeting()` to venue invocation
- [x] Add loading states and error handling
- [x] Style components with semantic CSS
- [x] Group action items by target (Jira/GitHub/Slack)

**Deliverable:** User can paste meeting notes and see extracted action items

### Phase 4: Plan Execution (Week 3) - COMPLETED

**Goal:** Execute delegation plans across external services

- [x] Create `ExecutionView` component with per-step progress tracking
- [x] Implement `executeActions()` on `PMVenueClient` (Jira / GitHub / Slack sub-operations)
- [x] Resolve PM asset hex IDs via `buildAssetIdMap()` after connect (venue requires hex IDs, not names)
- [x] Execute Plan button on `DelegationPlan` — disabled with warning when no integrations configured
- [x] Display per-step status (pending / running / success / error / skipped)
- [x] Collapsible result display per step on completion
- [x] "Back to Plan" and "Start New Analysis" navigation

**Deliverable:** End-to-end workflow from meeting notes to executed actions

### Phase 5: Configuration & Polish (Week 3-4) - COMPLETED

**Goal:** Production-ready configuration and UX

- [x] Settings panel for MCP server endpoints
- [x] Jira project key and GitHub repo configuration
- [x] Slack channel selection
- [x] Auth tokens (Jira, GitHub, Slack) with show/hide toggle
- [x] Persist configuration in localStorage
- [x] Dark mode toggle (moon/sun icon, persisted in localStorage)
- [x] Responsive design (breakpoints at 768px and 480px)
- [x] Error boundary (full-page fallback with "Try again" button)

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

### Phase 2: Asset Definitions (Completed)

Phase 2 defined all PM operations as deployable JSON assets using the venue adapter system.

#### Files Created

| File | Purpose |
|------|---------|
| `src/assets/operations/pm-analyzeMeeting.json` | LLM-powered meeting analysis using langchain:openai |
| `src/assets/operations/pm-executeJiraActions.json` | Jira issue creation via MCP |
| `src/assets/operations/pm-executeGithubActions.json` | GitHub branch/PR operations via MCP |
| `src/assets/operations/pm-sendNotifications.json` | Slack notifications via MCP |
| `src/assets/operations/pm-fullWorkflow.json` | End-to-end orchestration of all operations |

#### pm:analyzeMeeting Implementation

The meeting analysis asset uses the `langchain:openai` adapter with a structured system prompt:

```json
{
  "name": "pm:analyzeMeeting",
  "operation": {
    "adapter": "langchain:openai",
    "input": {
      "properties": {
        "prompt": { "type": "string", "description": "Meeting notes to analyze" },
        "meetingType": { "enum": ["standup", "planning", "retro", "ad_hoc"] },
        "model": { "default": "gpt-4-turbo" },
        "apiKey": { "type": "string", "secret": true }
      },
      "required": ["prompt"]
    },
    "systemPrompt": "You are an expert project manager assistant..."
  }
}
```

**Output schema** (enforced via system prompt):
```typescript
{
  actionItems: Array<{
    type: 'create_issue' | 'review_pr' | 'create_branch' | 'send_notification';
    description: string;
    assignee: string | null;
    priority: 'critical' | 'high' | 'medium' | 'low';
    target: 'jira' | 'github' | 'slack';
    metadata?: Record<string, unknown>;
  }>;
  blockers: string[];
  decisions: string[];
}
```

**Target mapping logic** (in system prompt):
- Bugs, features, tasks → `target: "jira"`, `type: "create_issue"`
- Code reviews, PRs → `target: "github"`, `type: "review_pr"`
- New feature branches → `target: "github"`, `type: "create_branch"`
- Team updates, announcements → `target: "slack"`, `type: "send_notification"`

#### MCP Execution Assets

The three execution assets follow a consistent pattern using the orchestrator adapter with MCP tool calls:

**pm:executeJiraActions:**
```json
{
  "name": "pm:executeJiraActions",
  "operation": {
    "adapter": "orchestrator",
    "input": {
      "properties": {
        "actions": { "type": "array", "description": "Actions filtered to target='jira'" },
        "jiraServer": { "type": "string", "description": "MCP server URL" },
        "projectKey": { "type": "string", "description": "Jira project key" },
        "token": { "type": "string", "secret": true }
      }
    },
    "steps": [{
      "op": "mcp:tools:call",
      "input": {
        "server": ["input", "jiraServer"],
        "toolName": ["const", "create_issue"],
        "arguments": {
          "project": ["input", "projectKey"],
          "actions": ["input", "actions"]
        }
      }
    }]
  }
}
```

**pm:executeGithubActions** and **pm:sendNotifications** follow the same pattern with their respective MCP tool names (`github_operations`, `post_message`).

#### Orchestrator Syntax Reference

The orchestrator adapter uses a special syntax for referencing values:

| Syntax | Description | Example |
|--------|-------------|---------|
| `["input", "field"]` | Reference from operation input | `["input", "jiraServer"]` |
| `["const", value]` | Use a constant value | `["const", "create_issue"]` |
| `[stepIndex, "field"]` | Reference from step output | `[0, "response"]` |
| `[stepIndex]` | Reference entire step output | `[1]` |

#### pm:fullWorkflow Implementation

The full workflow orchestrates all operations in sequence:

```json
{
  "name": "pm:fullWorkflow",
  "operation": {
    "adapter": "orchestrator",
    "input": {
      "properties": {
        "notes": { "type": "string" },
        "meetingType": { "enum": ["standup", "planning", "retro", "ad_hoc"] },
        "jiraServer": { "type": "string" },
        "jiraProjectKey": { "type": "string" },
        "githubServer": { "type": "string" },
        "githubRepo": { "type": "string" },
        "slackServer": { "type": "string" },
        "slackChannel": { "type": "string" },
        "openaiApiKey": { "type": "string", "secret": true },
        "jiraToken": { "type": "string", "secret": true },
        "githubToken": { "type": "string", "secret": true },
        "slackToken": { "type": "string", "secret": true }
      },
      "required": ["notes"]
    },
    "steps": [
      { "op": "pm:analyzeMeeting", "name": "Analyze Meeting Notes" },
      { "op": "pm:executeJiraActions", "name": "Create Jira Issues" },
      { "op": "pm:executeGithubActions", "name": "Execute GitHub Actions" },
      { "op": "pm:sendNotifications", "name": "Send Slack Notifications" }
    ],
    "result": {
      "analysis": [0, "response"],
      "jiraResults": [1],
      "githubResults": [2],
      "slackResults": [3]
    }
  }
}
```

**Execution flow:**
```
Step 0: pm:analyzeMeeting (LLM extraction)
    ↓ extracts actionItems, blockers, decisions
Step 1: pm:executeJiraActions  ←─┐
Step 2: pm:executeGithubActions ←┼─ All receive actions from Step 0
Step 3: pm:sendNotifications   ←─┘
    ↓
Result: aggregated outputs from all steps
```

#### Asset Registry Update

Updated `src/assets/operations/index.ts` to export all assets:

```typescript
import pmPlaceholder from './pm-placeholder.json';
import pmAnalyzeMeeting from './pm-analyzeMeeting.json';
import pmExecuteJiraActions from './pm-executeJiraActions.json';
import pmExecuteGithubActions from './pm-executeGithubActions.json';
import pmSendNotifications from './pm-sendNotifications.json';
import pmFullWorkflow from './pm-fullWorkflow.json';

const pmAssets: object[] = [
  pmPlaceholder,
  pmAnalyzeMeeting,
  pmExecuteJiraActions,
  pmExecuteGithubActions,
  pmSendNotifications,
  pmFullWorkflow,
];

export default pmAssets;

// Named exports for direct access
export {
  pmPlaceholder,
  pmAnalyzeMeeting,
  pmExecuteJiraActions,
  pmExecuteGithubActions,
  pmSendNotifications,
  pmFullWorkflow,
};
```

#### Key Design Decisions

1. **LLM-driven extraction** - Meeting analysis uses a detailed system prompt rather than custom NLP code, making it easy to modify behavior by updating the prompt

2. **Target-based routing** - Actions are tagged with `target` field (jira/github/slack) for filtering by execution assets

3. **MCP abstraction** - External services accessed via MCP protocol, allowing venue-side configuration of actual integrations

4. **Flexible authentication** - Each execution asset accepts optional tokens, falling back to venue configuration if not provided

5. **Partial execution support** - Full workflow accepts optional server URLs; missing configurations result in skipped steps rather than errors

6. **Content-addressable deployment** - Asset IDs computed from JSON content hash ensures automatic redeployment when definitions change

### Phase 3: Meeting Analysis UI (Completed)

Phase 3 built the user interface for meeting analysis, connecting the frontend to the venue's LLM-powered extraction.

#### Files Created

| File | Purpose |
|------|---------|
| `src/types.ts` | Shared TypeScript types for the application |
| `src/components/MeetingInput.tsx` | Meeting notes input form |
| `src/components/DelegationPlan.tsx` | Action items display grouped by target |
| `src/components/index.ts` | Component barrel exports |

#### Shared Types (`src/types.ts`)

```typescript
export type MeetingType = 'standup' | 'planning' | 'retro' | 'ad_hoc';
export type ActionTarget = 'jira' | 'github' | 'slack';
export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type AnalysisStatus = 'idle' | 'analyzing' | 'success' | 'error';

export interface ActionItem {
  type: 'create_issue' | 'review_pr' | 'create_branch' | 'send_notification';
  description: string;
  assignee?: string | null;
  priority: Priority;
  target: ActionTarget;
  metadata?: Record<string, unknown>;
}

export interface AnalysisResult {
  actionItems: ActionItem[];
  blockers: string[];
  decisions: string[];
}
```

#### MeetingInput Component

The `MeetingInput` component provides:

```typescript
interface MeetingInputProps {
  onAnalyze: (notes: string, meetingType: MeetingType) => void;
  isAnalyzing: boolean;
  isConnected: boolean;
}
```

**Features:**
- Meeting type selector (standup/planning/retro/ad_hoc) with button group
- Large textarea with placeholder example
- Analyze button with loading spinner
- Disabled state when not connected or analyzing
- Form validation (requires notes text)

#### DelegationPlan Component

The `DelegationPlan` component displays analysis results:

```typescript
interface DelegationPlanProps {
  result: AnalysisResult | null;
  error: Error | null;
}
```

**Features:**
- Groups action items by target (Jira/GitHub/Slack)
- Target cards with colored icons (J/G/S) and item counts
- Action item cards with:
  - Type label (Create Issue, Review PR, etc.)
  - Priority badge (critical/high/medium/low)
  - Description text
  - Assignee (if present)
- Blockers list (if any)
- Decisions list (if any)
- Error state display

#### PMVenueClient Updates

Updated `analyzeMeeting()` method to parse LLM responses:

```typescript
async analyzeMeeting(notes: string, meetingType: MeetingType = 'ad_hoc'): Promise<AnalysisResult> {
  const result = await this.venue.run('pm:analyzeMeeting', { prompt: notes, meetingType });

  // Extract JSON from LLM response (handles markdown code blocks)
  const responseText = result?.response;
  let jsonStr = responseText;
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  return JSON.parse(jsonStr) as AnalysisResult;
}
```

#### App.tsx Integration

```typescript
function App() {
  const { client, status, error, venueId, connect, disconnect } = useVenue();
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>('idle');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<Error | null>(null);

  const handleAnalyze = useCallback(async (notes: string, meetingType: MeetingType) => {
    setAnalysisStatus('analyzing');
    try {
      const result = await client.analyzeMeeting(notes, meetingType);
      setAnalysisResult(result);
      setAnalysisStatus('success');
    } catch (e) {
      setAnalysisError(e instanceof Error ? e : new Error(String(e)));
      setAnalysisStatus('error');
    }
  }, [client]);

  return (
    <>
      <MeetingInput onAnalyze={handleAnalyze} isAnalyzing={...} isConnected={...} />
      <DelegationPlan result={analysisResult} error={analysisError} />
    </>
  );
}
```

#### CSS Additions

New styles added for Phase 3 components:
- `.meeting-input-section` - Background section styling
- `.meeting-type-selector` / `.meeting-type-option` - Button group for meeting types
- `.spinner` - Loading animation
- `.delegation-plan-section` - Results section
- `.delegation-grid` - Responsive grid for target groups
- `.target-group` / `.target-header` / `.target-icon` - Target card styling
- `.action-item` / `.action-item-header` - Action item card styling
- `.blockers-list` / `.decisions-list` - List styling
- `.error-card` - Error state styling

#### Key Design Decisions

1. **Controlled form state** - MeetingInput manages its own local state, only calling `onAnalyze` on submit

2. **Graceful JSON parsing** - Handles LLM responses that may include markdown code blocks

3. **Visual grouping** - Actions grouped by target system for clear delegation overview

4. **Priority visualization** - Color-coded badges for quick priority assessment

5. **Progressive disclosure** - Blockers and decisions only shown when present

6. **Loading feedback** - Spinner and disabled states during analysis

### Phase 4: Plan Execution (Completed)

Phase 4 added execution of the delegation plan — running Jira, GitHub, and Slack sub-operations on the venue and displaying live progress to the user.

#### Key Technical Detail: Asset Invocation by Hex ID

The venue only accepts `adapter:operation` strings (e.g. `langchain:openai`) or **content-hash hex IDs** in its `POST /api/v1/invoke/` endpoint. Calling `venue.run('pm:executeJiraActions', ...)` fails because `pm` is not a registered adapter.

**Solution:** After `ensureAssets()` deploys all assets, `buildAssetIdMap()` calls `venue.getAssets()` and builds a `name → hexId` map for every asset whose name starts with `pm:`. `executeActions()` looks up hex IDs from this map before invoking.

#### Files Created

| File | Purpose |
|------|---------|
| `src/components/ExecutionView.tsx` | Step-by-step execution progress, results, and navigation |

#### Files Modified

| File | Change |
|------|--------|
| `src/types.ts` | Added `ExecutionStepStatus`, `ExecutionStep`, `ExecutionState` types |
| `src/lib/venue.ts` | Added `assetIdMap`, `buildAssetIdMap()`, `executeActions()` |
| `src/components/DelegationPlan.tsx` | Added `onExecute`, `settings`, `isExecuting` props; Execute Plan button and integration warning |
| `src/components/index.ts` | Exported `ExecutionView` |
| `src/index.css` | Added execution view, step row, and results styles |
| `src/App.tsx` | Added `executionState`, `showExecution`, `lastNotes`, `handleExecute`, `handleReset`; conditional rendering of `ExecutionView` / `DelegationPlan` |

#### executeActions() Method

```typescript
async executeActions(
  notes: string,
  analysisResult: AnalysisResult,
  settings: PMSettings,
  onStepUpdate: (id: ActionTarget, status: ExecutionStepStatus, result?: unknown, error?: string) => void
): Promise<void>
```

Runs three sub-operations sequentially. For each target (jira / github / slack):
- If the corresponding server URL is configured **and** the analysis contains actions for that target → invokes the venue operation by hex ID, calls `onStepUpdate` with `running` then `success` or `error`
- Otherwise → calls `onStepUpdate` with `skipped`

#### ExecutionView Component

```typescript
interface ExecutionViewProps {
  state: ExecutionState;
  onBack: () => void;  // Returns to delegation plan
  onReset: () => void; // Clears all state for new analysis
}
```

**Structure:**
- Header title changes: "Executing Plan…" → "Execution Complete" / "Execution Failed"
- Step list: one row per step with status icon, label, and badge
- Results section (on completion): `<details>` per step with formatted JSON or error text
- Footer: "Back to Plan" always visible; "Start New Analysis" shown when done

#### Key Design Decisions

1. **Sequential execution** — Steps run one after another so earlier failures don't block later ones, and progress is visible to the user as each step completes

2. **Skip vs. error** — Steps are `skipped` when no server is configured or no actions target that system; `error` only when the venue invocation itself fails

3. **View swap** — The execution view replaces the delegation plan section while running, avoiding layout shifts; "Back to Plan" restores the delegation plan without losing analysis results

4. **Integration warning** — When no integration servers are configured, the Execute Plan button is disabled and an inline warning directs the user to ⚙ Settings

---

### Phase 5: Configuration & Polish (Completed)

Phase 5 added a settings panel, dark mode, responsive breakpoints, and an error boundary.

#### Bug Fixes (covialib)

Two bugs in `covialib/src/Venue.ts` were fixed as a prerequisite:

1. **`venue.run()` did not poll for job completion** — The `/api/v1/invoke/` endpoint returns immediately with a `PENDING` job. `run()` now polls `/api/v1/jobs/{id}` at 500 ms intervals until the job reaches a terminal status (`COMPLETE`, `FAILED`, `CANCELLED`, or `REJECTED`), then returns `job.output`.

2. **Failed jobs returned `undefined` instead of an error** — When a job reaches `FAILED` status, `run()` now throws a `CoviaError` containing the job's error message, surfacing real failure reasons (e.g. missing OpenAI API key) to the frontend.

#### OpenAI API Key — Frontend Pass-through

When the venue server does not have `OPENAI_API_KEY` set in its environment, the key can be passed directly from the frontend via the `VITE_OPENAI_API_KEY` environment variable in `.env.local`. The `PMVenueClient.analyzeMeeting()` method reads `import.meta.env.VITE_OPENAI_API_KEY` and includes it as `apiKey` in the `langchain:openai` invocation.

> **Note:** This is a development convenience only. For production, set `OPENAI_API_KEY` on the venue server process.

#### Files Created

| File | Purpose |
|------|---------|
| `src/hooks/useSettings.ts` | Loads/saves `PMSettings` to `localStorage` key `covia-pm-settings` |
| `src/components/SettingsPanel.tsx` | Slide-out drawer with Jira / GitHub / Slack configuration sections |

#### Files Modified

| File | Change |
|------|--------|
| `src/types.ts` | Added `PMSettings` interface |
| `src/components/index.ts` | Exported `SettingsPanel` |
| `src/index.css` | Added drawer, backdrop, section heading, and token field styles |
| `src/App.tsx` | Added `useSettings` hook, `isSettingsOpen` state, ⚙ header button, and `<SettingsPanel>` render |

#### PMSettings Type

```typescript
export interface PMSettings {
  jiraServer: string;
  jiraProjectKey: string;
  jiraToken: string;
  githubServer: string;
  githubRepo: string;
  githubToken: string;
  slackServer: string;
  slackChannel: string;
  slackToken: string;
}
```

#### useSettings Hook

```typescript
// src/hooks/useSettings.ts
export function useSettings(): { settings: PMSettings; saveSettings: (s: PMSettings) => void }
```

- Reads from `localStorage` key `covia-pm-settings` on mount
- `saveSettings()` serialises to JSON and persists immediately
- Merges with `DEFAULT_SETTINGS` so new fields added in future are always present

#### SettingsPanel Component

```typescript
interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PMSettings;
  onSave: (settings: PMSettings) => void;
}
```

**Structure:**
- Fixed-position drawer (right side), 420 px wide, slides in via CSS `transform` transition
- Semi-transparent backdrop — clicking it closes the drawer
- Three sections: **Jira**, **GitHub**, **Slack** — each with server URL, project/repo/channel, and auth token
- Token fields use `type="password"` with an inline show/hide toggle button
- **Save Configuration** commits to `localStorage` and closes; **Cancel** discards changes

#### Key Design Decisions

1. **Draft state** — `SettingsPanel` keeps a local `draft` copy of settings while open. Changes are only committed to `localStorage` on **Save**, not on every keystroke.

2. **Token security** — Tokens are stored in `localStorage` for development convenience. For production deployments the venue server should hold credentials server-side; token fields should be cleared or omitted.

3. **Settings passed to workflow** — The `settings` object from `useSettings` is available in `App.tsx` and is passed directly into `executeActions()` as part of Phase 4.

#### Dark Mode Toggle

A `useDarkMode` hook in `App.tsx` toggles the `.dark` class on `document.documentElement`, activating the CSS variable overrides already defined in `index.css`. The preference is persisted in `localStorage` under `covia-pm-dark`. A moon/sun SVG button in the header triggers the toggle.

#### Responsive Design

Two breakpoints were added to `index.css`:

- **768px** — scales down `h1`/`h2`/`h3`, reduces container padding, hides header nav links, stacks the venue-connect form and footer vertically, expands the settings drawer to full width, and stacks the execute-plan footer.
- **480px** — truncates long venue IDs in the connection indicator with `text-overflow: ellipsis`.

#### Error Boundary

`src/components/ErrorBoundary.tsx` is a class component wrapping `<App />` in `main.tsx`. It catches unhandled render errors via `getDerivedStateFromError`, logs them with `componentDidCatch`, and displays a centred fallback card with the error message and a "Try again" button that calls `this.setState({ error: null })` to re-attempt rendering.

---

## Future Enhancements

1. **Asset versioning** - Include version in asset metadata, migrate on upgrade
2. **Offline mode** - Cache asset definitions in localStorage
3. **Multi-venue** - Deploy to multiple venues for redundancy
4. **Custom adapters** - Register venue-side adapters for complex logic
5. **Policy enforcement** - Add approval workflows before execution

---

## Integration Roadmap

The platform's MCP adapter architecture makes each new integration a JSON asset definition plus a compatible MCP server. The marginal cost of adding a tool is low once the pattern is established. Integrations are grouped into three delivery waves ordered by breadth of coverage and availability of MCP servers.

### Current Integrations (Phases 1–4)

| Integration | Operations |
|-------------|------------|
| **Jira** | Create issues from action items |
| **GitHub** | Create branches, open PRs |
| **Slack** | Send channel notifications |

---

### Wave 1 — High Coverage (Phase 7) — COMPLETED

Wave 1 expanded the platform from 3 to 12 execution targets and added transcript-fetch support for 9 meeting intelligence tools. All 18 new assets are deployed automatically on venue connect.

#### Project Management

| Tool | Asset | Operations |
|------|-------|------------|
| **Linear** | `pm:executeLinearActions` | Create issues, set priority, assign to cycles |
| **Azure DevOps / Boards** | `pm:executeAzureDevOpsActions` | Create work items, link to PRs |
| **Confluence** | `pm:writeConfluencePages` | Auto-document decisions and action items |

#### Communication

| Tool | Asset | Operations |
|------|-------|------------|
| **Microsoft Teams** | `pm:sendTeamsNotifications` | Post to channels, create meeting follow-up cards |
| **Email** | `pm:sendEmailNotifications` | Universal fallback via SMTP / SendGrid / Resend |

#### Incident Management

| Tool | Asset | Operations |
|------|-------|------------|
| **PagerDuty** | `pm:createPagerDutyIncidents` | Escalate blockers to incidents, set severity |

#### Observability

| Tool | Asset | Operations |
|------|-------|------------|
| **Sentry** | `pm:linkSentryIssues` | Create issues from error spikes, link to action items |

#### Version Control

| Tool | Asset | Operations |
|------|-------|------------|
| **GitLab** | `pm:executeGitLabActions` | Create branches, open MRs, trigger pipelines |

#### Calendar

| Tool | Asset | Operations |
|------|-------|------------|
| **Google Calendar** | `pm:scheduleFollowUps` | Create follow-up events from action items |

#### Meeting Intelligence

Integrating with call summary tools removes the manual paste step entirely — the agent fetches the transcript or AI summary directly from the tool and feeds it into `pm:analyzeMeeting`. Each tool exposes a slightly different API surface (some provide raw transcripts, others structured summaries with pre-extracted action items), so each gets its own asset to handle the mapping correctly.

| Tool | Asset | Notes |
|------|-------|-------|
| **Granola** | `pm:fetchGranolaNote` | Pulls the AI-enhanced meeting note; Granola structures notes as editable docs so the asset extracts the transcript or summary section |
| **Fathom** | `pm:fetchFathomSummary` | Fetches the AI-generated summary and action items; Fathom already extracts items so the asset can optionally bypass `pm:analyzeMeeting` and map directly |
| **Fireflies.ai** | `pm:fetchFirefliesTranscript` | Fetches full transcript and/or AI summary via Fireflies GraphQL API |
| **Otter.ai** | `pm:fetchOtterTranscript` | Pulls transcript from Otter conversation by meeting ID or URL |
| **tl;dv** | `pm:fetchTldvHighlights` | Retrieves highlights, clips, and summary; useful for async review workflows |
| **Avoma** | `pm:fetchAvomaSummary` | Fetches structured meeting notes including agenda, notes, and action items |
| **Read.ai** | `pm:fetchReadSummary` | Pulls meeting report including engagement metrics and extracted topics |
| **Zoom AI Companion** | `pm:fetchZoomAISummary` | Retrieves Zoom's built-in AI meeting summary (no third-party tool required for Zoom users) |
| **Microsoft Copilot (Teams)** | `pm:fetchTeamsMeetingSummary` | Pulls Teams meeting intelligence summary via Graph API |

**Fetch-then-analyse pattern:**

```
pm:fetchGranolaNote  (or any source above)
        │
        ▼  transcript / summary text
pm:analyzeMeeting    (LLM extraction → structured ActionItems)
        │
        ▼
pm:executeJiraActions / pm:executeGitLabActions / pm:sendTeamsNotifications …
```

Tools like Fathom and Avoma that already extract action items can optionally short-circuit `pm:analyzeMeeting` and feed directly into the execution layer, reducing LLM calls for structured sources.

**Wave 1 deliverables:** 18 new PM assets, 12 execution targets, 9 transcript sources, accordion settings panel, transcript fetch UI, dynamic system prompt, dynamic execution steps.

---

---

### Phase 7 Implementation Details

#### Data-Driven Integration Registry

A new file `src/config/integrations.ts` is the single source of truth for all integrations. The `SettingsPanel` renders entirely from this config — no integration-specific JSX exists in the component.

```typescript
export interface Integration {
  id: string;           // unique; matches ActionTarget or TranscriptSource
  name: string;
  description: string;  // shown in collapsed accordion header
  category: string;     // matches CategoryDef.id
  icon: string;         // 1–3 char abbreviation for the coloured badge
  iconColor: string;    // oklch() CSS color for badge background
  serverKey: keyof PMSettings;  // determines "● Configured" badge
  fields: IntegrationField[];
  hidden?: boolean;     // true → not rendered (developer toggle)
}
```

| Task | How |
|------|-----|
| Add a tool | Append one `Integration` object to `INTEGRATIONS` array |
| Remove a tool | Delete its entry |
| Hide without removing | Set `hidden: true` |
| Recategorize | Change `category` field |
| Reorder | Move position in array |

#### Accordion Settings Panel

`SettingsPanel.tsx` is fully data-driven. Key sub-components:

- **`CategorySection`** — collapsible section header showing `X / Y configured` counter; starts expanded
- **`IntegrationAccordion`** — per-tool row with coloured icon badge, name, description, `● Configured` / `○ Not set` status, and expand/collapse chevron. Tools start expanded if they already have a server URL configured.

#### Venue Client Additions

| Method | Description |
|--------|-------------|
| `buildTargetMappings(settings?)` | Generates LLM system prompt routing lines for configured targets only |
| `fetchTranscript(source, callRef, settings)` | Fetches transcript from a meeting intelligence tool via its MCP asset |
| `executeActions()` refactored | Now uses a `dispatch()` helper; handles all 12 targets |

#### MeetingInput Transcript Fetch

When one or more meeting intelligence server URLs are configured, a fetch row appears above the notes textarea:

```
[Granola ▼]  [meeting-id-or-url________________]  [Fetch]
✓ Transcript loaded
```

On success, the textarea is populated with the returned transcript/summary and analysis proceeds as normal.

#### Files Changed

| File | Change |
|------|--------|
| `src/config/integrations.ts` | **NEW** — integration registry (21 integrations, 8 categories) |
| `src/types.ts` | Expanded `ActionTarget` (12 values), added `TranscriptSource` (9 values), expanded `PMSettings` (62 fields) |
| `src/assets/operations/` | 18 new JSON assets (9 execution + 9 fetch) |
| `src/assets/operations/index.ts` | Registers all 27 assets |
| `src/lib/venue.ts` | `buildTargetMappings`, `fetchTranscript`, `dispatch` helper, 12-target `executeActions` |
| `src/hooks/useSettings.ts` | `DEFAULT_SETTINGS` expanded with all new fields |
| `src/components/SettingsPanel.tsx` | Rewritten — accordion UI driven by config (230 lines vs 687) |
| `src/components/MeetingInput.tsx` | Added transcript fetch section |
| `src/App.tsx` | `buildExecutionSteps(settings)`, `availableSources`, `handleFetchTranscript` |
| `src/index.css` | Accordion styles (category + integration item) |


### Wave 2 — Enterprise Completeness (Phase 8)

Fills gaps for enterprise organisations: Microsoft-stack teams, security and compliance workflows, DevOps pipelines, and broader observability.

#### Project Management

| Tool | Asset | Operations |
|------|-------|------------|
| **Asana** | `pm:executeAsanaActions` | Create tasks, assign to projects |
| **Shortcut** | `pm:executeShortcutActions` | Create stories, set epics |

#### Version Control & Code

| Tool | Asset | Operations |
|------|-------|------------|
| **Bitbucket** | `pm:executeBitbucketActions` | Create branches, open PRs (Atlassian stack) |
| **Azure Repos** | `pm:executeAzureReposActions` | PRs and branch policies |

#### CI/CD

| Tool | Asset | Operations |
|------|-------|------------|
| **GitHub Actions** | `pm:triggerGitHubWorkflows` | Trigger workflow runs, report status |
| **GitLab CI** | `pm:triggerGitLabPipelines` | Trigger pipelines, link to action items |
| **Jenkins** | `pm:triggerJenkinsBuilds` | Trigger and monitor build jobs |
| **CircleCI** | `pm:triggerCircleCIBuilds` | Pipeline triggers |

#### Observability

| Tool | Asset | Operations |
|------|-------|------------|
| **Datadog** | `pm:linkDatadogMonitors` | Attach monitors to action items, create dashboards |
| **Grafana** | `pm:embedGrafanaDashboards` | Snapshot dashboards into meeting summaries |

#### Code Quality & Security

| Tool | Asset | Operations |
|------|-------|------------|
| **Snyk** | `pm:createSnykIssues` | Jira/Linear tickets from vulnerability scans |
| **SonarQube** | `pm:linkSonarQubeGates` | Quality gate failures → action items |
| **GitHub Advanced Security** | `pm:linkSecurityAlerts` | Security alerts → tracked issues |

#### Communication

| Tool | Asset | Operations |
|------|-------|------------|
| **Google Chat** | `pm:sendGoogleChatNotifications` | Google Workspace orgs |
| **Discord** | `pm:sendDiscordNotifications` | Developer communities, open source projects |

#### Scheduling

| Tool | Asset | Operations |
|------|-------|------------|
| **Outlook / Microsoft 365** | `pm:scheduleOutlookEvents` | Enterprise calendar follow-ups |

**Wave 2 goal:** No engineering team is excluded — any combination of Microsoft, Atlassian, Google, or open-source stack is fully supported.

---

### Wave 3 — Breadth & Customer Lifecycle (Phase 9)

Extends the platform beyond the engineering team into the full product lifecycle: customer feedback, support queues, sales pipeline, infrastructure, and time tracking.

#### Customer Feedback & Support

| Tool | Asset | Operations |
|------|-------|------------|
| **Zendesk** | `pm:linkZendeskTickets` | Customer-reported bugs → engineering backlog |
| **Intercom** | `pm:linkIntercomConversations` | Support threads → tracked issues |
| **Canny** | `pm:syncCannyRequests` | Public feature votes → prioritised backlog items |
| **HubSpot** | `pm:linkHubSpotDeals` | Feature requests from sales context |
| **Salesforce** | `pm:linkSalesforceOpportunities` | Enterprise deal-driven feature tracking |

#### Infrastructure

| Tool | Asset | Operations |
|------|-------|------------|
| **ArgoCD** | `pm:trackArgoCDDeployments` | Link action items to deployment status |
| **Terraform Cloud** | `pm:trackTerraformRuns` | Infrastructure changes → tracked items |

#### Documentation

| Tool | Asset | Operations |
|------|-------|------------|
| **Notion** | `pm:writeNotionPages` | Docs + lightweight project databases |
| **Google Docs** | `pm:writeGoogleDocs` | Meeting minutes auto-written from analysis |

#### Video & Async

| Tool | Asset | Operations |
|------|-------|------------|
| **Zoom** | `pm:fetchZoomTranscripts` | Pull recording transcripts automatically |
| **Loom** | `pm:createLoomVideos` | Async video updates for action item summaries |

#### Time Tracking

| Tool | Asset | Operations |
|------|-------|------------|
| **Harvest / Toggl** | `pm:logTimeEstimates` | Log effort estimates against created issues |
| **Tempo** | `pm:syncTempoWorklogs` | Jira-native time tracking |

#### Incident Management

| Tool | Asset | Operations |
|------|-------|------------|
| **OpsGenie** | `pm:createOpsGenieAlerts` | Atlassian-stack incident routing |
| **FireHydrant** | `pm:openFireHydrantIncidents` | Modern incident management |

**Wave 3 goal:** Connect the full product lifecycle — from customer feedback and sales through to infrastructure and post-incident review.

---

### Platform Capabilities Roadmap

Beyond individual integrations, several cross-cutting platform capabilities are needed to support the growing integration surface:

| Capability | Phase | Description |
|------------|-------|-------------|
| **Integration registry UI** | 7 ✅ | Data-driven accordion settings panel; add/hide/remove tools in `src/config/integrations.ts` |
| **MCP server health checks** | 7 | Ping configured servers on connect; surface failures before execution |
| **Per-step approval gates** | 8 | Optional human confirmation before destructive actions (e.g. creating incidents) |
| **Execution history log** | 8 | Persistent log of past executions with results, linked to meeting notes |
| **Asset versioning** | 8 | Embed semver in asset metadata; re-deploy on version mismatch |
| **Webhook triggers** | 9 | Inbound webhooks from Sentry/Datadog/GitHub → auto-trigger analysis |
| **Multi-venue routing** | 9 | Route different action types to different venues (org boundaries) |
| **Approval policy engine** | 9 | Rules governing which actions require human sign-off |
| **Audit trail viewer** | 9 | Browse immutable Grid job log within the PM UI |
