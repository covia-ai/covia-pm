/**
 * Integration tests for PMVenueClient (src/lib/venue.ts)
 *
 * These tests mock @covia-ai/covialib (the external venue SDK) but use the
 * REAL PMVenueClient implementation — testing the complete chain:
 *   connect → ensureAssets → buildAssetIdMap → analyze / execute / fetch
 *
 * This catches integration issues between PMVenueClient's internal methods
 * that individual unit tests cannot: for example, that the assetIdMap built
 * during connect is correctly used by executeActions dispatch.
 *
 * Issue & Mitigation notes
 * ────────────────────────
 * Issue: dispatch() only runs when server field is non-empty AND action items
 *   exist for that target AND the assetId is in the map.
 * Mitigation: tests explicitly populate all three conditions; test descriptions
 *   note which condition is intentionally missing in skip/error cases.
 *
 * Issue: analyzeMeeting uses import.meta.env.VITE_OPENAI_API_KEY which is
 *   undefined in tests.
 * Mitigation: The mock venue.run() returns the stub result regardless — the
 *   apiKey field is simply not included in the run() call (guarded by ternary).
 *
 * Issue: executeActions iterates all 12 targets sequentially. A single target
 *   error must not prevent the rest from running.
 * Mitigation: "partial failure" test verifies that after a jira error, github
 *   still completes as 'success'.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mock variables ──────────────────────────────────────────────────
const {
  mockGridConnect,
  mockCreateAsset,
  mockGetAssets,
  mockRun,
  mockVenueId,
} = vi.hoisted(() => ({
  mockGridConnect:  vi.fn(),
  mockCreateAsset:  vi.fn(),
  mockGetAssets:    vi.fn(),
  mockRun:          vi.fn(),
  mockVenueId:      'venue-abc123',
}));

// ── Module mocks ─────────────────────────────────────────────────────────────
vi.mock('@covia-ai/covialib', () => ({
  Grid: { connect: mockGridConnect },
}));

vi.mock('../../assets/operations', () => ({
  default: [
    { name: 'pm:analyzeMeeting',       adapter: 'langchain:openai', operation: {} },
    { name: 'pm:executeJiraActions',    adapter: 'mcp',              operation: {} },
    { name: 'pm:executeGithubActions',  adapter: 'mcp',              operation: {} },
    { name: 'pm:sendNotifications',     adapter: 'mcp',              operation: {} },
    { name: 'pm:fetchGranolaNote',      adapter: 'mcp',              operation: {} },
  ],
}));

// ── Import after mocks ───────────────────────────────────────────────────────
import { PMVenueClient } from '../../lib/venue';
import type { PMSettings, AnalysisResult } from '../../types';

// ── Shared fixture builders ──────────────────────────────────────────────────

function makeVenueStub() {
  return {
    venueId:     mockVenueId,
    createAsset: mockCreateAsset,
    getAssets:   mockGetAssets,
    run:         mockRun,
  };
}

/**
 * Returns a getAssets mock response containing the 5 mocked pm: assets
 * so that buildAssetIdMap populates the map correctly.
 */
function makeAssetList() {
  return [
    { id: 'analyze-hex',  metadata: { name: 'pm:analyzeMeeting' } },
    { id: 'jira-hex',     metadata: { name: 'pm:executeJiraActions' } },
    { id: 'github-hex',   metadata: { name: 'pm:executeGithubActions' } },
    { id: 'slack-hex',    metadata: { name: 'pm:sendNotifications' } },
    { id: 'granola-hex',  metadata: { name: 'pm:fetchGranolaNote' } },
  ];
}

function emptySettings(): PMSettings {
  return {
    jiraServer: '', jiraProjectKey: '', jiraToken: '',
    linearServer: '', linearTeamKey: '', linearToken: '',
    azureServer: '', azureOrg: '', azureProject: '', azureToken: '',
    githubServer: '', githubRepo: '', githubToken: '',
    gitlabServer: '', gitlabRepo: '', gitlabToken: '',
    slackServer: '', slackChannel: '', slackToken: '',
    teamsServer: '', teamsChannel: '', teamsToken: '',
    emailServer: '', emailTo: '', emailToken: '',
    pagerdutyServer: '', pagerdutyServiceId: '', pagerdutyToken: '',
    sentryServer: '', sentryProject: '', sentryToken: '',
    confluenceServer: '', confluenceSpaceKey: '', confluenceToken: '',
    calendarServer: '', calendarId: '', calendarToken: '',
    granolaServer: '', granolaToken: '',
    fathomServer: '', fathomToken: '',
    firefliesServer: '', firefliesToken: '',
    otterServer: '', otterToken: '',
    tldvServer: '', tldvToken: '',
    avomaServer: '', avomaToken: '',
    readServer: '', readToken: '',
    zoomServer: '', zoomToken: '',
    teamsMeetingServer: '', teamsMeetingToken: '',
  };
}

const validAnalysisResult: AnalysisResult = {
  actionItems: [
    { type: 'create_issue', description: 'Fix login bug', assignee: 'Alice', priority: 'high',   target: 'jira',   metadata: {} },
    { type: 'review_pr',   description: 'Review PR #42',  assignee: 'Bob',   priority: 'medium', target: 'github', metadata: {} },
  ],
  blockers: [],
  decisions: [],
};

// ── Setup ────────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mockGridConnect.mockResolvedValue(makeVenueStub());
  mockCreateAsset.mockResolvedValue({});
  mockGetAssets.mockResolvedValue(makeAssetList());
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PMVenueClient.connect() — full asset deployment chain', () => {
  it('calls Grid.connect, deploys all mocked assets, and returns the venue', async () => {
    const client = new PMVenueClient();
    const venue = await client.connect('http://localhost:8080');

    expect(mockGridConnect).toHaveBeenCalledWith('http://localhost:8080');
    // 5 assets in our mock
    expect(mockCreateAsset).toHaveBeenCalledTimes(5);
    expect(venue.venueId).toBe(mockVenueId);
    expect(client.isConnected).toBe(true);
    expect(client.venueId).toBe(mockVenueId);
  });

  it('swallows 409 / "already exists" errors so re-connect is idempotent', async () => {
    mockCreateAsset
      .mockRejectedValueOnce(new Error('409 Conflict'))
      .mockRejectedValueOnce(new Error('already exists'))
      .mockResolvedValue({});

    const client = new PMVenueClient();
    await expect(client.connect('http://localhost:8080')).resolves.toBeDefined();
    expect(client.isConnected).toBe(true);
  });

  it('propagates Grid.connect errors to the caller', async () => {
    mockGridConnect.mockRejectedValue(new Error('Connection refused'));
    const client = new PMVenueClient();
    await expect(client.connect('http://localhost:8080')).rejects.toThrow('Connection refused');
    expect(client.isConnected).toBe(false);
  });
});

describe('PMVenueClient.disconnect()', () => {
  it('sets isConnected to false and clears state', async () => {
    const client = new PMVenueClient();
    await client.connect('http://localhost:8080');
    expect(client.isConnected).toBe(true);

    await client.disconnect();
    expect(client.isConnected).toBe(false);
    expect(client.venueId).toBeNull();
  });
});

describe('PMVenueClient.analyzeMeeting() — full chain through assetIdMap', () => {
  it('calls venue.run with the correct operation and returns a parsed AnalysisResult', async () => {
    const mockResponse = JSON.stringify({
      actionItems: [{ type: 'create_issue', description: 'Test task', assignee: null, priority: 'low', target: 'jira', metadata: {} }],
      blockers: ['Server down'],
      decisions: ['Use new framework'],
    });
    mockRun.mockResolvedValueOnce(mockResponse);

    const client = new PMVenueClient();
    await client.connect('http://localhost:8080');
    const result = await client.analyzeMeeting('Sprint notes', 'standup');

    expect(mockRun).toHaveBeenCalledWith(
      'langchain:openai',
      expect.objectContaining({ prompt: 'Sprint notes', model: 'gpt-4-turbo' })
    );
    expect(result.actionItems).toHaveLength(1);
    expect(result.blockers).toEqual(['Server down']);
    expect(result.decisions).toEqual(['Use new framework']);
  });

  it('parses JSON wrapped in a markdown code fence', async () => {
    const json = { actionItems: [], blockers: [], decisions: [] };
    mockRun.mockResolvedValueOnce('```json\n' + JSON.stringify(json) + '\n```');

    const client = new PMVenueClient();
    await client.connect('http://localhost:8080');
    const result = await client.analyzeMeeting('Notes', 'retro');

    expect(result.actionItems).toEqual([]);
  });

  it('parses the response when venue.run returns an object with a .response field', async () => {
    const inner = { actionItems: [], blockers: ['Blocker A'], decisions: [] };
    mockRun.mockResolvedValueOnce({ response: JSON.stringify(inner) });

    const client = new PMVenueClient();
    await client.connect('http://localhost:8080');
    const result = await client.analyzeMeeting('Notes', 'planning');

    expect(result.blockers).toEqual(['Blocker A']);
  });

  it('throws "Not connected" when called before connect()', async () => {
    const client = new PMVenueClient();
    await expect(client.analyzeMeeting('Notes')).rejects.toThrow('Not connected');
  });

  it('throws on empty/null response', async () => {
    mockRun.mockResolvedValueOnce(null);

    const client = new PMVenueClient();
    await client.connect('http://localhost:8080');
    await expect(client.analyzeMeeting('Notes')).rejects.toThrow('No response');
  });

  it('throws "Failed to parse" on invalid JSON', async () => {
    mockRun.mockResolvedValueOnce('not valid json {{{');

    const client = new PMVenueClient();
    await client.connect('http://localhost:8080');
    await expect(client.analyzeMeeting('Notes')).rejects.toThrow('Failed to parse');
  });

  it('normalises null array fields to [] (defensive parsing)', async () => {
    const partial = { actionItems: null, blockers: null, decisions: null };
    mockRun.mockResolvedValueOnce(JSON.stringify(partial));

    const client = new PMVenueClient();
    await client.connect('http://localhost:8080');
    const result = await client.analyzeMeeting('Notes');

    expect(result.actionItems).toEqual([]);
    expect(result.blockers).toEqual([]);
    expect(result.decisions).toEqual([]);
  });
});

describe('PMVenueClient.executeActions() — dispatch chain', () => {
  it('runs configured targets and calls onStepUpdate(running) → onStepUpdate(success)', async () => {
    mockRun.mockResolvedValue({ status: 'ok' });

    const settings = {
      ...emptySettings(),
      jiraServer:   'http://jira.test',
      githubServer: 'http://github.test',
    };
    const updates: Array<[string, string]> = [];
    const onStepUpdate = (id: string, status: string) => { updates.push([id, status]); };

    const client = new PMVenueClient();
    await client.connect('http://localhost:8080');
    await client.executeActions('Notes', validAnalysisResult, settings, onStepUpdate);

    // Jira and github both have items in validAnalysisResult
    expect(updates).toContainEqual(['jira',   'running']);
    expect(updates).toContainEqual(['jira',   'success']);
    expect(updates).toContainEqual(['github', 'running']);
    expect(updates).toContainEqual(['github', 'success']);
  });

  it('calls onStepUpdate(skipped) for targets with no server URL configured', async () => {
    // Only jira is configured — github should be skipped
    const settings = { ...emptySettings(), jiraServer: 'http://jira.test' };
    const updates: Array<[string, string]> = [];
    const onStepUpdate = (id: string, status: string) => { updates.push([id, status]); };

    const client = new PMVenueClient();
    await client.connect('http://localhost:8080');
    await client.executeActions('Notes', validAnalysisResult, settings, onStepUpdate);

    expect(updates).toContainEqual(['github', 'skipped']);
  });

  it('calls onStepUpdate(skipped) for targets with no action items even if server is set', async () => {
    // emptyResult has no action items for any target
    const emptyResult: AnalysisResult = { actionItems: [], blockers: [], decisions: [] };
    const settings = { ...emptySettings(), jiraServer: 'http://jira.test' };
    const updates: Array<[string, string]> = [];

    const client = new PMVenueClient();
    await client.connect('http://localhost:8080');
    await client.executeActions('Notes', emptyResult, settings, vi.fn((id, status) => { updates.push([id, status]); }));

    expect(updates).toContainEqual(['jira', 'skipped']);
  });

  it('partial failure: one target errors, subsequent targets continue executing', async () => {
    // Issue: if jira errors and throws, github must still be dispatched.
    // Mitigation: dispatch() wraps venue.run in try/catch per target.
    mockRun
      .mockRejectedValueOnce(new Error('Jira MCP timeout'))  // jira fails
      .mockResolvedValueOnce({ status: 'ok' });              // github succeeds

    const settings = {
      ...emptySettings(),
      jiraServer:   'http://jira.test',
      githubServer: 'http://github.test',
    };
    const updates: Array<[string, string]> = [];
    const onStepUpdate = (id: string, status: string) => { updates.push([id, status]); };

    const client = new PMVenueClient();
    await client.connect('http://localhost:8080');
    await client.executeActions('Notes', validAnalysisResult, settings, onStepUpdate);

    expect(updates).toContainEqual(['jira',   'running']);
    expect(updates).toContainEqual(['jira',   'error']);    // jira failed
    expect(updates).toContainEqual(['github', 'running']);
    expect(updates).toContainEqual(['github', 'success']); // github continued
  });

  it('throws "Not connected" when called before connect()', async () => {
    const client = new PMVenueClient();
    await expect(
      client.executeActions('Notes', validAnalysisResult, emptySettings(), vi.fn())
    ).rejects.toThrow('Not connected');
  });
});

describe('PMVenueClient.fetchTranscript()', () => {
  it('calls venue.run with the correct asset hex ID and returns the transcript', async () => {
    mockRun.mockResolvedValueOnce({ transcript: 'Meeting transcript content' });

    const settings = { ...emptySettings(), granolaServer: 'http://granola.test', granolaToken: 'tok-123' };
    const client = new PMVenueClient();
    await client.connect('http://localhost:8080');

    const transcript = await client.fetchTranscript('granola', 'call-ref-456', settings);

    expect(mockRun).toHaveBeenCalledWith('granola-hex', {
      callRef: 'call-ref-456',
      server:  'http://granola.test',
      token:   'tok-123',
    });
    expect(transcript).toBe('Meeting transcript content');
  });

  it('throws "Not connected" when called before connect()', async () => {
    const client = new PMVenueClient();
    await expect(
      client.fetchTranscript('granola', 'ref', emptySettings())
    ).rejects.toThrow('Not connected');
  });

  it('throws "Asset … not found" for a source whose asset is not in the map', async () => {
    // Disconnect to clear the assetIdMap, then reconnect with an empty asset list
    mockGetAssets.mockResolvedValueOnce([]); // no pm: assets returned

    const client = new PMVenueClient();
    await client.connect('http://localhost:8080');

    await expect(
      client.fetchTranscript('granola', 'ref', { ...emptySettings(), granolaServer: 'http://granola.test' })
    ).rejects.toThrow(/not found/);
  });

  it('falls back to .summary when response has no .transcript field', async () => {
    mockRun.mockResolvedValueOnce({ summary: 'Fathom meeting summary' });

    const settings = { ...emptySettings(), granolaServer: 'http://granola.test', granolaToken: '' };
    const client = new PMVenueClient();
    await client.connect('http://localhost:8080');

    const result = await client.fetchTranscript('granola', 'ref', settings);
    expect(result).toBe('Fathom meeting summary');
  });
});
