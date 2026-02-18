import { Grid, Venue } from '@covia-ai/covialib';
import pmAssets from '../assets/operations';
import type { AnalysisResult, MeetingType } from '../types';

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
    const result = await this.venue.run('langchain:openai', {
      prompt: notes,
      systemPrompt,
      model: 'gpt-4-turbo'
    });

    // The langchain adapter returns { response: string } where response is the LLM output
    // We need to parse the JSON from the response
    const responseText = typeof result === 'string' ? result : result?.response;

    if (!responseText) {
      throw new Error('No response from meeting analysis');
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
