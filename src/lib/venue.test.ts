import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PMVenueClient } from './venue';
import type { AnalysisResult } from '../types';

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockGridConnect = vi.fn();
vi.mock('@covia-ai/covialib', () => ({
  Grid: { connect: (...args: unknown[]) => mockGridConnect(...args) },
}));

vi.mock('../assets/operations', () => ({ default: [] }));

// ── Fake venue helper ─────────────────────────────────────────────────────────

function makeFakeVenue(overrides: Record<string, unknown> = {}) {
  return {
    venueId: 'venue-test-123',
    createAsset: vi.fn().mockResolvedValue(undefined),
    getAssets: vi.fn().mockResolvedValue([]),
    run: vi.fn().mockResolvedValue('{}'),
    ...overrides,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const defaultSettings = {
  jiraServer: '', jiraProjectKey: '', jiraToken: '',
  githubServer: '', githubRepo: '', githubToken: '',
  slackServer: '', slackChannel: '', slackToken: '',
  linearServer: '', linearTeamKey: '', linearToken: '',
  azureServer: '', azureOrg: '', azureProject: '', azureToken: '',
  gitlabServer: '', gitlabRepo: '', gitlabToken: '',
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PMVenueClient.connect()', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls Grid.connect with the given URL and returns the venue', async () => {
    const fakeVenue = makeFakeVenue();
    mockGridConnect.mockResolvedValueOnce(fakeVenue);

    const client = new PMVenueClient();
    const result = await client.connect('http://venue.test');

    expect(mockGridConnect).toHaveBeenCalledWith('http://venue.test');
    expect(result).toBe(fakeVenue);
    expect(client.isConnected).toBe(true);
    expect(client.venueId).toBe('venue-test-123');
  });

  it('propagates errors thrown by Grid.connect', async () => {
    mockGridConnect.mockRejectedValueOnce(new Error('Cannot reach venue'));

    const client = new PMVenueClient();
    await expect(client.connect('http://bad.test')).rejects.toThrow('Cannot reach venue');
    expect(client.isConnected).toBe(false);
  });
});

describe('PMVenueClient.ensureAssets()', () => {
  it('swallows "409" errors during asset deployment', async () => {
    const fakeVenue = makeFakeVenue({
      createAsset: vi.fn().mockRejectedValue(new Error('409 Conflict')),
    });
    mockGridConnect.mockResolvedValueOnce(fakeVenue);

    const client = new PMVenueClient();
    // Should not throw
    await expect(client.connect('http://venue.test')).resolves.toBeDefined();
  });

  it('swallows "already exists" errors during asset deployment', async () => {
    const fakeVenue = makeFakeVenue({
      createAsset: vi.fn().mockRejectedValue(new Error('Asset already exists')),
    });
    mockGridConnect.mockResolvedValueOnce(fakeVenue);

    const client = new PMVenueClient();
    await expect(client.connect('http://venue.test')).resolves.toBeDefined();
  });
});

describe('PMVenueClient.disconnect()', () => {
  it('sets isConnected to false after disconnect', async () => {
    const fakeVenue = makeFakeVenue();
    mockGridConnect.mockResolvedValueOnce(fakeVenue);

    const client = new PMVenueClient();
    await client.connect('http://venue.test');
    expect(client.isConnected).toBe(true);

    await client.disconnect();
    expect(client.isConnected).toBe(false);
    expect(client.venueId).toBeNull();
  });
});

describe('PMVenueClient.analyzeMeeting()', () => {
  it('throws "Not connected" when called before connect()', async () => {
    const client = new PMVenueClient();
    await expect(client.analyzeMeeting('notes')).rejects.toThrow('Not connected');
  });

  it('parses a bare JSON string returned by venue.run', async () => {
    const responseJson: AnalysisResult = {
      actionItems: [{ type: 'create_issue', description: 'Fix bug', priority: 'high', target: 'jira' }],
      blockers: ['Awaiting API key'],
      decisions: ['Use Jira for tracking'],
    };
    const fakeVenue = makeFakeVenue({ run: vi.fn().mockResolvedValue(JSON.stringify(responseJson)) });
    mockGridConnect.mockResolvedValueOnce(fakeVenue);

    const client = new PMVenueClient();
    await client.connect('http://venue.test');
    const result = await client.analyzeMeeting('meeting notes');

    expect(result.actionItems).toHaveLength(1);
    expect(result.blockers).toEqual(['Awaiting API key']);
    expect(result.decisions).toEqual(['Use Jira for tracking']);
  });

  it('parses JSON inside a markdown code fence', async () => {
    const responseJson: AnalysisResult = {
      actionItems: [],
      blockers: ['Deployment blocked'],
      decisions: [],
    };
    const fenced = `\`\`\`json\n${JSON.stringify(responseJson)}\n\`\`\``;
    const fakeVenue = makeFakeVenue({ run: vi.fn().mockResolvedValue(fenced) });
    mockGridConnect.mockResolvedValueOnce(fakeVenue);

    const client = new PMVenueClient();
    await client.connect('http://venue.test');
    const result = await client.analyzeMeeting('notes');

    expect(result.blockers).toEqual(['Deployment blocked']);
  });

  it('parses JSON from the .response field when run returns an object', async () => {
    const responseJson: AnalysisResult = { actionItems: [], blockers: [], decisions: ['Go to prod'] };
    const fakeVenue = makeFakeVenue({
      run: vi.fn().mockResolvedValue({ response: JSON.stringify(responseJson) }),
    });
    mockGridConnect.mockResolvedValueOnce(fakeVenue);

    const client = new PMVenueClient();
    await client.connect('http://venue.test');
    const result = await client.analyzeMeeting('notes');

    expect(result.decisions).toEqual(['Go to prod']);
  });

  it('throws on empty/null response from venue.run', async () => {
    const fakeVenue = makeFakeVenue({ run: vi.fn().mockResolvedValue(null) });
    mockGridConnect.mockResolvedValueOnce(fakeVenue);

    const client = new PMVenueClient();
    await client.connect('http://venue.test');
    await expect(client.analyzeMeeting('notes')).rejects.toThrow('No response from meeting analysis');
  });

  it('throws "Failed to parse" on invalid JSON', async () => {
    const fakeVenue = makeFakeVenue({ run: vi.fn().mockResolvedValue('not json at all') });
    mockGridConnect.mockResolvedValueOnce(fakeVenue);

    const client = new PMVenueClient();
    await client.connect('http://venue.test');
    await expect(client.analyzeMeeting('notes')).rejects.toThrow('Failed to parse analysis response');
  });

  it('normalises missing array fields to empty arrays', async () => {
    const partial = '{"actionItems": null, "blockers": null, "decisions": null}';
    const fakeVenue = makeFakeVenue({ run: vi.fn().mockResolvedValue(partial) });
    mockGridConnect.mockResolvedValueOnce(fakeVenue);

    const client = new PMVenueClient();
    await client.connect('http://venue.test');
    const result = await client.analyzeMeeting('notes');

    expect(result.actionItems).toEqual([]);
    expect(result.blockers).toEqual([]);
    expect(result.decisions).toEqual([]);
  });
});

describe('PMVenueClient.fetchTranscript()', () => {
  it('throws when not connected', async () => {
    const client = new PMVenueClient();
    await expect(client.fetchTranscript('granola', 'ref-1', defaultSettings)).rejects.toThrow('Not connected');
  });

  it('throws when the asset ID is not in the map', async () => {
    // getAssets returns empty list → assetIdMap stays empty
    const fakeVenue = makeFakeVenue({ getAssets: vi.fn().mockResolvedValue([]) });
    mockGridConnect.mockResolvedValueOnce(fakeVenue);

    const client = new PMVenueClient();
    await client.connect('http://venue.test');
    await expect(
      client.fetchTranscript('granola', 'ref-1', defaultSettings)
    ).rejects.toThrow('pm:fetchGranolaNote');
  });

  it('calls venue.run with the correct args and returns transcript', async () => {
    const assetId = 'asset-granola-id';
    const fakeVenue = makeFakeVenue({
      getAssets: vi.fn().mockResolvedValue([
        { id: assetId, metadata: { name: 'pm:fetchGranolaNote' } },
      ]),
      run: vi.fn().mockResolvedValue({ transcript: 'Meeting notes content' }),
    });
    mockGridConnect.mockResolvedValueOnce(fakeVenue);

    const settings = { ...defaultSettings, granolaServer: 'http://granola.test', granolaToken: 'tok' };
    const client = new PMVenueClient();
    await client.connect('http://venue.test');
    const text = await client.fetchTranscript('granola', 'call-ref-123', settings);

    expect(fakeVenue.run).toHaveBeenCalledWith(assetId, {
      callRef: 'call-ref-123',
      server: 'http://granola.test',
      token: 'tok',
    });
    expect(text).toBe('Meeting notes content');
  });
});

describe('PMVenueClient.executeActions()', () => {
  it('throws when not connected', async () => {
    const client = new PMVenueClient();
    const result: AnalysisResult = { actionItems: [], blockers: [], decisions: [] };
    await expect(client.executeActions('notes', result, defaultSettings, vi.fn())).rejects.toThrow('Not connected');
  });

  it('calls onStepUpdate("running") then ("success") for a configured target with action items', async () => {
    const assetId = 'jira-asset-id';
    const fakeRun = vi.fn().mockResolvedValue({ created: 1 });
    const fakeVenue = makeFakeVenue({
      getAssets: vi.fn().mockResolvedValue([
        { id: assetId, metadata: { name: 'pm:executeJiraActions' } },
      ]),
      run: fakeRun,
    });
    mockGridConnect.mockResolvedValueOnce(fakeVenue);

    const client = new PMVenueClient();
    await client.connect('http://venue.test');

    const analysisResult: AnalysisResult = {
      actionItems: [{ type: 'create_issue', description: 'Fix bug', priority: 'high', target: 'jira' }],
      blockers: [],
      decisions: [],
    };
    const onUpdate = vi.fn();
    const settings = { ...defaultSettings, jiraServer: 'http://jira.test', jiraToken: 'tok' };

    await client.executeActions('notes', analysisResult, settings, onUpdate);

    expect(onUpdate).toHaveBeenCalledWith('jira', 'running');
    expect(onUpdate).toHaveBeenCalledWith('jira', 'success', { created: 1 });
  });

  it('calls onStepUpdate("skipped") when the server field is empty', async () => {
    const fakeVenue = makeFakeVenue({ getAssets: vi.fn().mockResolvedValue([]) });
    mockGridConnect.mockResolvedValueOnce(fakeVenue);

    const client = new PMVenueClient();
    await client.connect('http://venue.test');

    const analysisResult: AnalysisResult = {
      actionItems: [{ type: 'create_issue', description: 'Fix bug', priority: 'high', target: 'jira' }],
      blockers: [],
      decisions: [],
    };
    const onUpdate = vi.fn();
    // jiraServer is empty → skip
    await client.executeActions('notes', analysisResult, defaultSettings, onUpdate);

    expect(onUpdate).toHaveBeenCalledWith('jira', 'skipped');
  });

  it('calls onStepUpdate("error") on step failure and continues remaining targets', async () => {
    const jiraAssetId = 'jira-asset';
    const githubAssetId = 'github-asset';
    const fakeRun = vi.fn()
      .mockRejectedValueOnce(new Error('Jira API error'))
      .mockResolvedValueOnce({ created: 1 });

    const fakeVenue = makeFakeVenue({
      getAssets: vi.fn().mockResolvedValue([
        { id: jiraAssetId,   metadata: { name: 'pm:executeJiraActions' } },
        { id: githubAssetId, metadata: { name: 'pm:executeGithubActions' } },
      ]),
      run: fakeRun,
    });
    mockGridConnect.mockResolvedValueOnce(fakeVenue);

    const client = new PMVenueClient();
    await client.connect('http://venue.test');

    const analysisResult: AnalysisResult = {
      actionItems: [
        { type: 'create_issue', description: 'Jira task', priority: 'high', target: 'jira' },
        { type: 'review_pr',    description: 'GitHub PR',  priority: 'low',  target: 'github' },
      ],
      blockers: [],
      decisions: [],
    };
    const onUpdate = vi.fn();
    const settings = {
      ...defaultSettings,
      jiraServer: 'http://jira.test',
      githubServer: 'http://github.test',
    };

    await client.executeActions('notes', analysisResult, settings, onUpdate);

    // Jira failed
    expect(onUpdate).toHaveBeenCalledWith('jira', 'error', undefined, 'Jira API error');
    // GitHub still processed
    expect(onUpdate).toHaveBeenCalledWith('github', 'success', { created: 1 });
  });
});
