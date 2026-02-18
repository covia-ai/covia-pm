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
