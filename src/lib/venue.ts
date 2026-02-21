import { Grid, Venue } from '@covia-ai/covialib';
import pmAssets from '../assets/operations';
import type { AnalysisResult, MeetingType, PMSettings, ExecutionStep, ExecutionStepStatus, TranscriptSource } from '../types';

export type { AnalysisResult };

export interface WorkflowConfig {
  jiraServer?: string;
  githubServer?: string;
  slackServer?: string;
  jiraProjectKey?: string;
  githubRepo?: string;
  slackChannel?: string;
}

const FETCH_ASSET_NAMES: Record<TranscriptSource, string> = {
  granola:       'pm:fetchGranolaNote',
  fathom:        'pm:fetchFathomSummary',
  fireflies:     'pm:fetchFirefliesTranscript',
  otter:         'pm:fetchOtterTranscript',
  tldv:          'pm:fetchTldvHighlights',
  avoma:         'pm:fetchAvomaSummary',
  read:          'pm:fetchReadSummary',
  zoom:          'pm:fetchZoomAISummary',
  'teams-meeting': 'pm:fetchTeamsMeetingSummary',
};

// Maps each TranscriptSource to its server/token field names in PMSettings
const FETCH_SERVER_KEYS: Record<TranscriptSource, keyof PMSettings> = {
  granola:       'granolaServer',
  fathom:        'fathomServer',
  fireflies:     'firefliesServer',
  otter:         'otterServer',
  tldv:          'tldvServer',
  avoma:         'avomaServer',
  read:          'readServer',
  zoom:          'zoomServer',
  'teams-meeting': 'teamsMeetingServer',
};

const FETCH_TOKEN_KEYS: Record<TranscriptSource, keyof PMSettings> = {
  granola:       'granolaToken',
  fathom:        'fathomToken',
  fireflies:     'firefliesToken',
  otter:         'otterToken',
  tldv:          'tldvToken',
  avoma:         'avomaToken',
  read:          'readToken',
  zoom:          'zoomToken',
  'teams-meeting': 'teamsMeetingToken',
};

export class PMVenueClient {
  private venue: Venue | null = null;
  private assetsDeployed = false;
  private assetIdMap = new Map<string, string>();

  get isConnected(): boolean {
    return this.venue !== null;
  }

  get venueId(): string | null {
    return this.venue?.venueId ?? null;
  }

  async connect(venueUrl: string): Promise<Venue> {
    this.venue = await Grid.connect(venueUrl);
    await this.ensureAssets();
    return this.venue;
  }

  async disconnect(): Promise<void> {
    this.venue = null;
    this.assetsDeployed = false;
    this.assetIdMap.clear();
  }

  private async ensureAssets(): Promise<void> {
    if (this.assetsDeployed || !this.venue) return;

    for (const assetMetadata of pmAssets) {
      const assetName = (assetMetadata as { name?: string }).name;

      if (!assetName) {
        console.warn('Asset metadata missing name, skipping:', assetMetadata);
        continue;
      }

      try {
        await this.venue.createAsset(assetMetadata);
        console.log(`Asset ${assetName} deployed successfully`);
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        if (errorMsg.includes('409') || errorMsg.includes('already exists')) {
          console.log(`Asset ${assetName} already exists`);
        } else {
          console.warn(`Asset ${assetName} deployment issue:`, errorMsg);
        }
      }
    }

    this.assetsDeployed = true;
    await this.buildAssetIdMap();
  }

  private async buildAssetIdMap(): Promise<void> {
    if (!this.venue) return;
    try {
      const assets = await this.venue.getAssets();
      for (const asset of assets) {
        const name = asset.metadata?.name;
        if (name?.startsWith('pm:')) {
          this.assetIdMap.set(name, asset.id);
        }
      }
      console.log('Asset ID map built:', Object.fromEntries(this.assetIdMap));
    } catch (e) {
      console.warn('Failed to build asset ID map:', e);
    }
  }

  private buildTargetMappings(settings?: PMSettings): string {
    const lines: string[] = [];

    if (!settings || settings.jiraServer)
      lines.push('- Bugs, features, tasks → target: "jira", type: "create_issue"');
    if (settings?.linearServer)
      lines.push('- Bugs, features, tasks (if using Linear) → target: "linear", type: "create_issue"');
    if (settings?.azureServer)
      lines.push('- Work items, user stories (Azure DevOps) → target: "azure-devops", type: "create_issue"');
    if (!settings || settings.githubServer)
      lines.push('- Code reviews, pull requests → target: "github", type: "review_pr"');
    if (!settings || settings.githubServer)
      lines.push('- New feature branches → target: "github", type: "create_branch"');
    if (settings?.gitlabServer)
      lines.push('- Merge requests (GitLab) → target: "gitlab", type: "review_pr"');
    if (settings?.gitlabServer)
      lines.push('- New feature branches (GitLab) → target: "gitlab", type: "create_branch"');
    if (!settings || settings.slackServer)
      lines.push('- Team updates, announcements → target: "slack", type: "send_notification"');
    if (settings?.teamsServer)
      lines.push('- Team updates (Microsoft Teams) → target: "teams", type: "send_notification"');
    if (settings?.emailServer)
      lines.push('- External communications, stakeholder updates → target: "email", type: "send_notification"');
    if (settings?.pagerdutyServer)
      lines.push('- Critical blockers, production incidents → target: "pagerduty", type: "create_issue"');
    if (settings?.sentryServer)
      lines.push('- Error tracking, bug reports from monitoring → target: "sentry", type: "create_issue"');
    if (settings?.confluenceServer)
      lines.push('- Documentation tasks, decisions to document → target: "confluence", type: "create_issue"');
    if (settings?.calendarServer)
      lines.push('- Follow-up meetings, scheduled deadlines → target: "calendar", type: "send_notification"');

    return lines.join('\n');
  }

  async analyzeMeeting(notes: string, meetingType: MeetingType = 'ad_hoc', settings?: PMSettings): Promise<AnalysisResult> {
    if (!this.venue) {
      throw new Error('Not connected to venue');
    }

    const meetingContext = {
      standup: 'This is a daily standup meeting. Focus on daily tasks, blockers, and handoffs.',
      planning: 'This is a sprint/project planning meeting. Extract user stories, estimates, and assignments.',
      retro: 'This is a retrospective meeting. Capture action items from retrospective discussions.',
      ad_hoc: 'This is a general meeting. Extract all action items mentioned.'
    };

    const targetMappings = this.buildTargetMappings(settings);
    const validTargets = settings
      ? [
          settings.jiraServer && 'jira',
          settings.linearServer && 'linear',
          settings.azureServer && 'azure-devops',
          settings.githubServer && 'github',
          settings.gitlabServer && 'gitlab',
          settings.slackServer && 'slack',
          settings.teamsServer && 'teams',
          settings.emailServer && 'email',
          settings.pagerdutyServer && 'pagerduty',
          settings.sentryServer && 'sentry',
          settings.confluenceServer && 'confluence',
          settings.calendarServer && 'calendar',
        ].filter(Boolean).join(' | ')
      : '"jira" | "github" | "slack"';

    const systemPrompt = `You are an expert project manager assistant. Analyze the provided meeting notes and extract structured information.

Meeting context: ${meetingContext[meetingType]}

You MUST respond with valid JSON only, no markdown or explanation. Use this exact schema:

{
  "actionItems": [
    {
      "type": "create_issue" | "review_pr" | "create_branch" | "send_notification",
      "description": "Clear description of the action",
      "assignee": "Person's name or null if unassigned",
      "priority": "critical" | "high" | "medium" | "low",
      "target": ${validTargets},
      "metadata": { "any": "additional context" }
    }
  ],
  "blockers": ["List of blocking issues mentioned"],
  "decisions": ["List of decisions made in the meeting"]
}

Map actions to targets:
${targetMappings}

Respond with JSON only.`;

    const openAiApiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;
    const result = await this.venue.run('langchain:openai', {
      prompt: notes,
      systemPrompt,
      model: 'gpt-4-turbo',
      ...(openAiApiKey ? { apiKey: openAiApiKey } : {})
    });

    console.log('LLM result:', result);

    let responseText: string | undefined;

    if (typeof result === 'string') {
      responseText = result;
    } else if (result?.response) {
      responseText = result.response;
    } else if (result) {
      responseText = JSON.stringify(result);
    }

    if (!responseText) {
      throw new Error(`No response from meeting analysis. Received: ${JSON.stringify(result)}`);
    }

    try {
      let jsonStr = responseText;
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(jsonStr) as AnalysisResult;

      return {
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
        blockers: Array.isArray(parsed.blockers) ? parsed.blockers : [],
        decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      };
    } catch (e) {
      throw new Error(`Failed to parse analysis response: ${e instanceof Error ? e.message : 'Unknown error'}`, { cause: e });
    }
  }

  async fetchTranscript(source: TranscriptSource, callRef: string, settings: PMSettings): Promise<string> {
    if (!this.venue) throw new Error('Not connected to venue');

    const assetName = FETCH_ASSET_NAMES[source];
    const assetId = this.assetIdMap.get(assetName);
    if (!assetId) throw new Error(`Asset ${assetName} not found — ensure the venue is connected`);

    const server = settings[FETCH_SERVER_KEYS[source]] as string;
    const token = settings[FETCH_TOKEN_KEYS[source]] as string;

    const result = await this.venue.run(assetId, { callRef, server, token });
    return result?.transcript ?? result?.summary ?? JSON.stringify(result);
  }

  async executeActions(
    notes: string,
    analysisResult: AnalysisResult,
    settings: PMSettings,
    onStepUpdate: (id: ExecutionStep['id'], status: ExecutionStepStatus, result?: unknown, error?: string) => void
  ): Promise<void> {
    if (!this.venue) throw new Error('Not connected to venue');

    const byTarget = (target: string) => analysisResult.actionItems.filter(i => i.target === target);

    const dispatch = async (
      target: ExecutionStep['id'],
      assetName: string,
      serverField: string,
      input: Record<string, unknown>
    ) => {
      const assetId = this.assetIdMap.get(assetName);
      const server = (settings as unknown as Record<string, string>)[serverField];
      const items = byTarget(target);
      if (server && items.length > 0 && assetId) {
        onStepUpdate(target, 'running');
        try {
          const result = await this.venue!.run(assetId, { actions: items, notes, ...input });
          onStepUpdate(target, 'success', result);
        } catch (e) {
          onStepUpdate(target, 'error', undefined, e instanceof Error ? e.message : String(e));
        }
      } else {
        onStepUpdate(target, 'skipped');
      }
    };

    await dispatch('jira', 'pm:executeJiraActions', 'jiraServer', {
      jiraServer: settings.jiraServer, projectKey: settings.jiraProjectKey, token: settings.jiraToken,
    });
    await dispatch('linear', 'pm:executeLinearActions', 'linearServer', {
      linearServer: settings.linearServer, teamKey: settings.linearTeamKey, token: settings.linearToken,
    });
    await dispatch('azure-devops', 'pm:executeAzureDevOpsActions', 'azureServer', {
      azureServer: settings.azureServer, org: settings.azureOrg, project: settings.azureProject, token: settings.azureToken,
    });
    await dispatch('github', 'pm:executeGithubActions', 'githubServer', {
      githubServer: settings.githubServer, repo: settings.githubRepo, token: settings.githubToken,
    });
    await dispatch('gitlab', 'pm:executeGitLabActions', 'gitlabServer', {
      gitlabServer: settings.gitlabServer, repo: settings.gitlabRepo, token: settings.gitlabToken,
    });
    await dispatch('slack', 'pm:sendNotifications', 'slackServer', {
      slackServer: settings.slackServer, channel: settings.slackChannel, token: settings.slackToken,
    });
    await dispatch('teams', 'pm:sendTeamsNotifications', 'teamsServer', {
      teamsServer: settings.teamsServer, channel: settings.teamsChannel, token: settings.teamsToken,
    });
    await dispatch('email', 'pm:sendEmailNotifications', 'emailServer', {
      emailServer: settings.emailServer, to: settings.emailTo, token: settings.emailToken,
    });
    await dispatch('pagerduty', 'pm:createPagerDutyIncidents', 'pagerdutyServer', {
      pagerdutyServer: settings.pagerdutyServer, serviceId: settings.pagerdutyServiceId, token: settings.pagerdutyToken,
    });
    await dispatch('sentry', 'pm:linkSentryIssues', 'sentryServer', {
      sentryServer: settings.sentryServer, project: settings.sentryProject, token: settings.sentryToken,
    });
    await dispatch('confluence', 'pm:writeConfluencePages', 'confluenceServer', {
      confluenceServer: settings.confluenceServer, spaceKey: settings.confluenceSpaceKey, token: settings.confluenceToken,
    });
    await dispatch('calendar', 'pm:scheduleCalendarEvents', 'calendarServer', {
      calendarServer: settings.calendarServer, calendarId: settings.calendarId, token: settings.calendarToken,
    });
  }

  async executeFullWorkflow(notes: string, config: WorkflowConfig): Promise<unknown> {
    if (!this.venue) {
      throw new Error('Not connected to venue');
    }
    return this.venue.run('pm:fullWorkflow', {
      notes,
      ...config
    });
  }

  async getDeployedAssets(): Promise<string[]> {
    if (!this.venue) {
      throw new Error('Not connected to venue');
    }
    const assets = await this.venue.getAssets();
    return assets
      .filter(a => a.metadata?.name?.startsWith('pm:'))
      .map(a => a.metadata?.name ?? a.id);
  }
}
