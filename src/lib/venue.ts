import { Grid, Venue, CoviaError } from '@covia-ai/covialib';
import pmAssets from '../assets/operations';

export interface WorkflowConfig {
  jiraServer?: string;
  githubServer?: string;
  slackServer?: string;
  jiraProjectKey?: string;
  githubRepo?: string;
  slackChannel?: string;
}

export interface AnalysisResult {
  actionItems: Array<{
    type: 'create_issue' | 'review_pr' | 'create_branch' | 'send_notification';
    description: string;
    assignee?: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    target: 'jira' | 'github' | 'slack';
    metadata?: Record<string, unknown>;
  }>;
  blockers: string[];
  decisions: string[];
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

    for (const assetMetadata of pmAssets) {
      const assetId = await this.computeAssetId(assetMetadata);

      try {
        await this.venue.getAsset(assetId);
        // Asset exists, no action needed
      } catch (e) {
        if (e instanceof CoviaError && e.code === 404) {
          // Asset doesn't exist, create it
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

  async analyzeMeeting(notes: string, meetingType = 'ad_hoc'): Promise<AnalysisResult> {
    if (!this.venue) {
      throw new Error('Not connected to venue');
    }
    return this.venue.run('pm:analyzeMeeting', {
      prompt: notes,
      meetingType
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
