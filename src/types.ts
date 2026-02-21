export type MeetingType = 'standup' | 'planning' | 'retro' | 'ad_hoc';

export type ActionType = 'create_issue' | 'review_pr' | 'create_branch' | 'send_notification';

export type ActionTarget =
  | 'jira' | 'linear' | 'azure-devops'   // issue trackers
  | 'github' | 'gitlab'                   // VCS
  | 'slack' | 'teams' | 'email'           // communication
  | 'pagerduty'                           // incident management
  | 'sentry'                              // observability
  | 'confluence'                          // documentation
  | 'calendar';                           // scheduling

export type TranscriptSource =
  | 'granola' | 'fathom' | 'fireflies' | 'otter'
  | 'tldv' | 'avoma' | 'read' | 'zoom' | 'teams-meeting';

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

// ── Health checks ──────────────────────────────────────────────────────────────

export type HealthStatus = 'unchecked' | 'checking' | 'ok' | 'unreachable';

/** Keyed by PMSettings server field (e.g. 'jiraServer'). Only populated for configured integrations. */
export type HealthMap = Partial<Record<keyof PMSettings, HealthStatus>>;

// ── Integration settings ───────────────────────────────────────────────────────

export interface PMSettings {
  // ── Existing ──────────────────────────────────────────────────────
  jiraServer: string;
  jiraProjectKey: string;
  jiraToken: string;
  githubServer: string;
  githubRepo: string;
  githubToken: string;
  slackServer: string;
  slackChannel: string;
  slackToken: string;

  // ── Issue Trackers ─────────────────────────────────────────────────
  linearServer: string;
  linearTeamKey: string;
  linearToken: string;
  azureServer: string;
  azureOrg: string;
  azureProject: string;
  azureToken: string;

  // ── Version Control ────────────────────────────────────────────────
  gitlabServer: string;
  gitlabRepo: string;
  gitlabToken: string;

  // ── Communication ──────────────────────────────────────────────────
  teamsServer: string;
  teamsChannel: string;
  teamsToken: string;
  emailServer: string;
  emailTo: string;
  emailToken: string;

  // ── Incident Management ────────────────────────────────────────────
  pagerdutyServer: string;
  pagerdutyServiceId: string;
  pagerdutyToken: string;

  // ── Observability ──────────────────────────────────────────────────
  sentryServer: string;
  sentryProject: string;
  sentryToken: string;

  // ── Documentation ──────────────────────────────────────────────────
  confluenceServer: string;
  confluenceSpaceKey: string;
  confluenceToken: string;

  // ── Calendar ───────────────────────────────────────────────────────
  calendarServer: string;
  calendarId: string;
  calendarToken: string;

  // ── Meeting Intelligence (one MCP server + token per tool) ─────────
  granolaServer: string;
  granolaToken: string;
  fathomServer: string;
  fathomToken: string;
  firefliesServer: string;
  firefliesToken: string;
  otterServer: string;
  otterToken: string;
  tldvServer: string;
  tldvToken: string;
  avomaServer: string;
  avomaToken: string;
  readServer: string;
  readToken: string;
  zoomServer: string;
  zoomToken: string;
  teamsMeetingServer: string;
  teamsMeetingToken: string;
}
