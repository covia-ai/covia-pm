# Covia PM

Federated AI project management frontend for the [Covia Grid](https://www.covia.ai).

Paste or fetch meeting notes → LLM extracts action items → execute across 12 integrations in one click.

---

## What It Does

Covia PM is a **self-deploying** React app. When you connect to any Covia venue it automatically registers 24 PM operation definitions as venue assets, then uses them to:

- **Analyse** meeting notes with GPT-4 (or any LLM the venue is configured for) to extract action items, blockers, and decisions
- **Fetch transcripts** directly from 9 meeting intelligence tools so you never have to copy-paste
- **Execute** the delegation plan across whichever integrations are configured — each target runs independently so a Jira failure doesn't block GitHub

### Execution integrations (12)

| Category | Tools |
|----------|-------|
| Issue trackers | Jira, Linear, Azure DevOps |
| Version control | GitHub, GitLab |
| Communication | Slack, Microsoft Teams, Email |
| Incident management | PagerDuty |
| Observability | Sentry |
| Documentation | Confluence |
| Calendar | Google Calendar |

### Meeting intelligence sources (9)

Granola · Fathom · Fireflies · Otter · tl;dv · Avoma · Read.ai · Zoom AI Companion · Microsoft Teams Meeting

---

## Prerequisites

- Node.js 20.19+ or 22.12+
- pnpm 10+
- **covialib** built as a sibling directory (`../covialib`)
- A running Covia venue (local or remote)

### Directory layout

```
covia/
├── covialib/    ← must exist and be built
├── covia-pm/    ← this project
└── covia-repo/  ← optional: venue server for local development
```

---

## Quick Start

```bash
# 1. Build covialib (required dependency, linked locally)
cd ../covialib && pnpm install && pnpm build

# 2. Install covia-pm
cd ../covia-pm
pnpm install

# 3. Configure environment
cp .env.example .env
# Edit .env — set VITE_VENUE_URL to your venue address

# 4. Start dev server
pnpm dev
# → http://localhost:5173
```

---

## Running Against a Local Venue

```bash
# Start the venue server (from covia-repo)
cd ../covia-repo
./mvnw quarkus:dev
# → http://localhost:8080

# In .env:
VITE_VENUE_URL=http://localhost:8080
```

The venue must have an LLM configured. For development you can pass an OpenAI key directly from the frontend:

```bash
# .env.local (not committed)
VITE_OPENAI_API_KEY=sk-...
```

> **Note:** For production, set `OPENAI_API_KEY` in the venue server's environment instead.

---

## Using the App

### 1. Connect

Enter your venue URL and click **Connect**. The header badge turns green and shows the venue ID. All 24 PM assets are deployed automatically on first connect — this is a no-op on subsequent connects.

### 2. Configure integrations

Click **⚙ Settings** to open the configuration drawer. Enter the MCP server URLs for the tools you want to use. Auth tokens are stored in `localStorage`. Only integrations with a server URL configured will appear in the execution plan.

Each integration shows a live health indicator:

| Badge | Meaning |
|-------|---------|
| `○ Not set` | No server URL configured |
| `● Configured` | URL set, health unknown |
| `◌ Checking…` | Ping in progress |
| `● Online` | Server reachable |
| `⚠ Unreachable` | Server did not respond |

### 3. Get meeting notes

Either paste notes directly into the textarea, or use the **Fetch** row to pull a transcript from a connected meeting intelligence tool (enter the meeting ID or URL for the selected source).

### 4. Analyse

Select the meeting type (standup / planning / retro / ad hoc) and click **Analyse Meeting**. The delegation plan appears with action items grouped by target integration.

### 5. Execute

Review the plan, then click **Execute Plan**. A step-by-step progress view replaces the plan. Steps for unconfigured integrations are automatically skipped. Expand each completed step to see the raw result.

---

## Commands

```bash
pnpm dev              # Development server with HMR
pnpm build            # Type-check + production build → dist/
pnpm preview          # Preview production build locally
pnpm lint             # ESLint
pnpm test             # Unit and component tests (Vitest, watch mode)
pnpm test --run       # Single test pass (CI)
pnpm test:coverage    # Coverage report
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_VENUE_URL` | `http://localhost:8080` | Pre-filled venue URL |
| `VITE_OPENAI_API_KEY` | — | OpenAI key passed to the venue's LangChain adapter. Dev use only. |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       COVIA PM FRONTEND                          │
│                   (React 19 + Vite 7 + TypeScript)               │
│                                                                  │
│  src/config/integrations.ts  ← single source of truth           │
│    21 integrations, 8 categories                                 │
│    drives: SettingsPanel · health checks · execution dispatch    │
│                                                                  │
│  src/assets/operations/  ← 24 JSON assets, auto-deployed         │
│    pm-analyzeMeeting           LLM extraction (langchain)        │
│    pm-fullWorkflow             end-to-end orchestration          │
│    pm-execute* / pm-send*      12 execution targets (MCP)        │
│    pm-fetch*                   9 transcript sources (MCP)        │
│                                                                  │
│  covialib  (TypeScript Grid Client)                              │
│    Grid.connect() → deploy assets → build hex ID map            │
│    venue.run(hexId, input) → execute operations                  │
└─────────────────────────────────┬────────────────────────────────┘
                                  │ HTTP
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│                          COVIA VENUE                             │
│  Adapters: langchain (LLM) · orchestrator · mcp (tools)         │
│  All 24 PM assets registered on first connect                    │
└──────────────────────────────────────────────────────────────────┘
```

---

## Project Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Venue connectivity and asset deployment | ✅ |
| 2 | Asset definitions (24 PM operation JSONs) | ✅ |
| 3 | Meeting analysis UI | ✅ |
| 4 | Plan execution with step tracking | ✅ |
| 5 | Settings, dark mode, responsive layout, error boundary | ✅ |
| 6 | Wave 1 — 12 execution targets, 9 transcript sources, accordion UI | ✅ |
| 7 | MCP health checks | ✅ |
| 8 | Unit and component test suite (114 tests) | ✅ |
| — | Integration tests (MSW), E2E (Playwright) | Planned |
| — | Wave 2 — enterprise integrations (Asana, Bitbucket, Datadog, …) | Planned |

---

## Troubleshooting

**`Cannot find module '@covia-ai/covialib'`**
Build covialib first: `cd ../covialib && pnpm build`

**`Connection failed`**
- Verify the venue is running: `curl http://localhost:8080/api/v1/status`
- Check for CORS errors in the browser console
- Ensure the URL includes the protocol (`http://` or `https://`)

**Analysis returns an error**
The venue needs an LLM configured. Set `OPENAI_API_KEY` on the venue server, or add `VITE_OPENAI_API_KEY=sk-...` to `.env.local` for development.

**Integration shows ⚠ Unreachable**
The MCP server URL is set but the server did not respond to a HEAD request within 5 seconds. Check that the MCP server is running and accessible from the browser.

---

## Related Projects

- [covialib](https://github.com/covia-ai/covialib) — TypeScript Grid client
- [covia-repo](https://github.com/covia-ai/covia-repo) — Venue server
- [covia-sdk-py](https://github.com/covia-ai/covia-sdk-py) — Python SDK
- [Covia Documentation](https://docs.covia.ai)

---

## For Contributors

See [CLAUDE.md](./CLAUDE.md) for the development guide covering architecture patterns, how to add integrations, testing conventions, and common gotchas.

---

## Licence

MIT
