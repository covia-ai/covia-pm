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

    // Get existing assets from venue
    let existingAssetNames: Set<string>;
    try {
      const existingAssets = await this.venue.getAssets();
      existingAssetNames = new Set(
        existingAssets
          .map(a => a.metadata?.name)
          .filter((name): name is string => typeof name === 'string')
      );
    } catch {
      // If we can't list assets, assume none exist
      existingAssetNames = new Set();
    }

    // Deploy PM assets that don't already exist
    for (const assetMetadata of pmAssets) {
      const assetName = (assetMetadata as { name?: string }).name;

      if (!assetName) {
        console.warn('Asset metadata missing name, skipping:', assetMetadata);
        continue;
      }

      if (existingAssetNames.has(assetName)) {
        console.log(`Asset ${assetName} already exists, skipping`);
        continue;
      }

      try {
        await this.venue.createAsset(assetMetadata);
        console.log(`Asset ${assetName} deployed successfully`);
      } catch (e) {
        console.error(`Failed to deploy asset ${assetName}:`, e);
        // Continue with other assets even if one fails
      }
    }

    this.assetsDeployed = true;
  }

  async analyzeMeeting(notes: string, meetingType: MeetingType = 'ad_hoc'): Promise<AnalysisResult> {
    if (!this.venue) {
      throw new Error('Not connected to venue');
    }

    const result = await this.venue.run('pm:analyzeMeeting', {
      prompt: notes,
      meetingType
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
