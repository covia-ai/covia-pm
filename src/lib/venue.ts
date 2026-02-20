import { Grid, Venue } from '@covia-ai/covialib';
import pmAssets from '../assets/operations';
import type { AnalysisResult, MeetingType, PMSettings, ExecutionStep, ExecutionStepStatus } from '../types';

export type { AnalysisResult };

export interface WorkflowConfig {
  jiraServer?: string;
  githubServer?: string;
  slackServer?: string;
  jiraProjectKey?: string;
  githubRepo?: string;
  slackChannel?: string;
}

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

    // For now, just try to create all assets
    // The venue will handle duplicates (either reject or update)
    // In the future, we could add version checking and update logic
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
        // Asset might already exist - that's OK
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

  async analyzeMeeting(notes: string, meetingType: MeetingType = 'ad_hoc'): Promise<AnalysisResult> {
    if (!this.venue) {
      throw new Error('Not connected to venue');
    }

    const meetingContext = {
      standup: 'This is a daily standup meeting. Focus on daily tasks, blockers, and handoffs.',
      planning: 'This is a sprint/project planning meeting. Extract user stories, estimates, and assignments.',
      retro: 'This is a retrospective meeting. Capture action items from retrospective discussions.',
      ad_hoc: 'This is a general meeting. Extract all action items mentioned.'
    };

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
      "target": "jira" | "github" | "slack",
      "metadata": { "any": "additional context" }
    }
  ],
  "blockers": ["List of blocking issues mentioned"],
  "decisions": ["List of decisions made in the meeting"]
}

Map actions to targets:
- Bugs, features, tasks -> target: "jira", type: "create_issue"
- Code reviews, PRs -> target: "github", type: "review_pr"
- New feature branches -> target: "github", type: "create_branch"
- Team updates, announcements -> target: "slack", type: "send_notification"

Respond with JSON only.`;

    // Call langchain:openai directly since venue requires asset hex IDs or adapter:operation format
    const openAiApiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;
    const result = await this.venue.run('langchain:openai', {
      prompt: notes,
      systemPrompt,
      model: 'gpt-4-turbo',
      ...(openAiApiKey ? { apiKey: openAiApiKey } : {})
    });

    // Log the result for debugging
    console.log('LLM result:', result);

    // The langchain adapter returns { response: string } where response is the LLM output
    // venue.run() returns the job output directly
    // Handle various response formats
    let responseText: string | undefined;

    if (typeof result === 'string') {
      responseText = result;
    } else if (result?.response) {
      responseText = result.response;
    } else if (result) {
      // Maybe the result IS the response directly
      responseText = JSON.stringify(result);
    }

    if (!responseText) {
      // Provide more context about what we received
      throw new Error(`No response from meeting analysis. Received: ${JSON.stringify(result)}`);
    }

    try {
      // Try to extract JSON from the response (LLM might include markdown code blocks)
      let jsonStr = responseText;

      // Remove markdown code blocks if present
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(jsonStr) as AnalysisResult;

      // Validate the response structure
      return {
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
        blockers: Array.isArray(parsed.blockers) ? parsed.blockers : [],
        decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      };
    } catch (e) {
      throw new Error(`Failed to parse analysis response: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
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

  async executeActions(
    notes: string,
    analysisResult: AnalysisResult,
    settings: PMSettings,
    onStepUpdate: (id: ExecutionStep['id'], status: ExecutionStepStatus, result?: unknown, error?: string) => void
  ): Promise<void> {
    if (!this.venue) throw new Error('Not connected to venue');

    const jiraItems = analysisResult.actionItems.filter(i => i.target === 'jira');
    const githubItems = analysisResult.actionItems.filter(i => i.target === 'github');
    const slackItems = analysisResult.actionItems.filter(i => i.target === 'slack');

    // Jira
    const jiraId = this.assetIdMap.get('pm:executeJiraActions');
    if (settings.jiraServer && jiraItems.length > 0 && jiraId) {
      onStepUpdate('jira', 'running');
      try {
        const result = await this.venue.run(jiraId, {
          actions: jiraItems,
          jiraServer: settings.jiraServer,
          projectKey: settings.jiraProjectKey,
          token: settings.jiraToken,
          notes,
        });
        onStepUpdate('jira', 'success', result);
      } catch (e) {
        onStepUpdate('jira', 'error', undefined, e instanceof Error ? e.message : String(e));
      }
    } else {
      onStepUpdate('jira', 'skipped');
    }

    // GitHub
    const githubId = this.assetIdMap.get('pm:executeGithubActions');
    if (settings.githubServer && githubItems.length > 0 && githubId) {
      onStepUpdate('github', 'running');
      try {
        const result = await this.venue.run(githubId, {
          actions: githubItems,
          githubServer: settings.githubServer,
          repo: settings.githubRepo,
          token: settings.githubToken,
          notes,
        });
        onStepUpdate('github', 'success', result);
      } catch (e) {
        onStepUpdate('github', 'error', undefined, e instanceof Error ? e.message : String(e));
      }
    } else {
      onStepUpdate('github', 'skipped');
    }

    // Slack
    const slackId = this.assetIdMap.get('pm:sendNotifications');
    if (settings.slackServer && slackItems.length > 0 && slackId) {
      onStepUpdate('slack', 'running');
      try {
        const result = await this.venue.run(slackId, {
          actions: slackItems,
          slackServer: settings.slackServer,
          channel: settings.slackChannel,
          token: settings.slackToken,
          notes,
        });
        onStepUpdate('slack', 'success', result);
      } catch (e) {
        onStepUpdate('slack', 'error', undefined, e instanceof Error ? e.message : String(e));
      }
    } else {
      onStepUpdate('slack', 'skipped');
    }
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
