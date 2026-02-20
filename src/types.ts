export type MeetingType = 'standup' | 'planning' | 'retro' | 'ad_hoc';

export type ActionType = 'create_issue' | 'review_pr' | 'create_branch' | 'send_notification';

export type ActionTarget = 'jira' | 'github' | 'slack';

export type Priority = 'critical' | 'high' | 'medium' | 'low';

export interface ActionItem {
  type: ActionType;
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

export type AnalysisStatus = 'idle' | 'analyzing' | 'success' | 'error';

export type ExecutionStepStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped';

export interface ExecutionStep {
  id: ActionTarget;
  label: string;
  icon: string;
  status: ExecutionStepStatus;
  result?: unknown;
  error?: string;
}

export interface ExecutionState {
  status: 'idle' | 'running' | 'complete' | 'error';
  steps: ExecutionStep[];
}

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
