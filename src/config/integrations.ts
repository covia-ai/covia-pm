import type { PMSettings } from '../types';

export type FieldType = 'url' | 'text' | 'token';

export interface IntegrationField {
  key: keyof PMSettings;
  label: string;
  type: FieldType;
  placeholder: string;
}

export interface Integration {
  /** Unique identifier — matches ActionTarget or TranscriptSource where applicable */
  id: string;
  name: string;
  /** Short subtitle shown in collapsed accordion header */
  description: string;
  /** Matches a CategoryDef.id */
  category: string;
  /** 1–3 character abbreviation shown in the coloured icon badge */
  icon: string;
  /** CSS color value for the icon badge background (oklch preferred) */
  iconColor: string;
  /** The PMSettings key whose non-empty value marks this integration as "Configured" */
  serverKey: keyof PMSettings;
  fields: IntegrationField[];
  /**
   * Set to true to hide this integration from the UI entirely.
   * The integration stays in the array so its config is preserved — just not rendered.
   * Toggle back to false (or remove the property) to restore visibility.
   */
  hidden?: boolean;
}

export interface CategoryDef {
  id: string;
  label: string;
  group: 'execution' | 'intelligence';
}

// ─── Categories ────────────────────────────────────────────────────────────────

export const CATEGORIES: CategoryDef[] = [
  { id: 'issue-trackers',  label: 'Issue Trackers',       group: 'execution' },
  { id: 'vcs',             label: 'Version Control',       group: 'execution' },
  { id: 'cicd',            label: 'CI / CD',               group: 'execution' },
  { id: 'communication',   label: 'Communication',         group: 'execution' },
  { id: 'incident',        label: 'Incident Management',   group: 'execution' },
  { id: 'observability',   label: 'Observability',         group: 'execution' },
  { id: 'security',        label: 'Security & Quality',    group: 'execution' },
  { id: 'documentation',   label: 'Documentation',         group: 'execution' },
  { id: 'calendar',        label: 'Calendar',              group: 'execution' },
  { id: 'meeting-tools',   label: 'Meeting Tools',         group: 'intelligence' },
];

// ─── Integrations ──────────────────────────────────────────────────────────────
// To add a new integration: append an entry below. No component code changes needed.
// To hide an integration: set hidden: true. To remove: delete the entry.

export const INTEGRATIONS: Integration[] = [

  // ── Issue Trackers ──────────────────────────────────────────────────────────

  {
    id: 'jira',
    name: 'Jira',
    description: 'Atlassian issue & project tracker',
    category: 'issue-trackers',
    icon: 'J',
    iconColor: 'oklch(0.52 0.16 255)',
    serverKey: 'jiraServer',
    fields: [
      { key: 'jiraServer',     label: 'MCP Server URL', type: 'url',   placeholder: 'https://jira-mcp.example.com/mcp' },
      { key: 'jiraProjectKey', label: 'Project Key',    type: 'text',  placeholder: 'e.g. PROJ' },
      { key: 'jiraToken',      label: 'Auth Token',     type: 'token', placeholder: 'Optional auth token' },
    ],
  },

  {
    id: 'linear',
    name: 'Linear',
    description: 'Modern issue tracker for engineering teams',
    category: 'issue-trackers',
    icon: 'L',
    iconColor: 'oklch(0.50 0.19 285)',
    serverKey: 'linearServer',
    fields: [
      { key: 'linearServer',  label: 'MCP Server URL', type: 'url',   placeholder: 'https://linear-mcp.example.com/mcp' },
      { key: 'linearTeamKey', label: 'Team Key',       type: 'text',  placeholder: 'e.g. ENG' },
      { key: 'linearToken',   label: 'API Key',        type: 'token', placeholder: 'lin_api_...' },
    ],
  },

  {
    id: 'azure-devops',
    name: 'Azure DevOps',
    description: 'Microsoft work items & pipelines',
    category: 'issue-trackers',
    icon: 'Az',
    iconColor: 'oklch(0.48 0.14 250)',
    serverKey: 'azureServer',
    fields: [
      { key: 'azureServer',  label: 'MCP Server URL', type: 'url',   placeholder: 'https://azure-mcp.example.com/mcp' },
      { key: 'azureOrg',     label: 'Organisation',   type: 'text',  placeholder: 'e.g. myorg' },
      { key: 'azureProject', label: 'Project',        type: 'text',  placeholder: 'e.g. MyProject' },
      { key: 'azureToken',   label: 'Personal Access Token', type: 'token', placeholder: 'PAT token' },
    ],
  },

  // ── Version Control ─────────────────────────────────────────────────────────

  {
    id: 'github',
    name: 'GitHub',
    description: 'Pull requests & branch management',
    category: 'vcs',
    icon: 'GH',
    iconColor: 'oklch(0.30 0.02 260)',
    serverKey: 'githubServer',
    fields: [
      { key: 'githubServer', label: 'MCP Server URL', type: 'url',   placeholder: 'https://github-mcp.example.com/mcp' },
      { key: 'githubRepo',   label: 'Repository',     type: 'text',  placeholder: 'owner/repo' },
      { key: 'githubToken',  label: 'Auth Token',     type: 'token', placeholder: 'ghp_...' },
    ],
  },

  {
    id: 'gitlab',
    name: 'GitLab',
    description: 'Merge requests & branch operations',
    category: 'vcs',
    icon: 'GL',
    iconColor: 'oklch(0.60 0.17 45)',
    serverKey: 'gitlabServer',
    fields: [
      { key: 'gitlabServer', label: 'MCP Server URL', type: 'url',   placeholder: 'https://gitlab-mcp.example.com/mcp' },
      { key: 'gitlabRepo',   label: 'Project Path',   type: 'text',  placeholder: 'group/project' },
      { key: 'gitlabToken',  label: 'Personal Access Token', type: 'token', placeholder: 'glpat-...' },
    ],
  },

  // ── Communication ───────────────────────────────────────────────────────────

  {
    id: 'slack',
    name: 'Slack',
    description: 'Team notifications & announcements',
    category: 'communication',
    icon: 'S',
    iconColor: 'oklch(0.50 0.18 310)',
    serverKey: 'slackServer',
    fields: [
      { key: 'slackServer',  label: 'MCP Server URL', type: 'url',   placeholder: 'https://slack-mcp.example.com/mcp' },
      { key: 'slackChannel', label: 'Channel',        type: 'text',  placeholder: '#engineering' },
      { key: 'slackToken',   label: 'Auth Token',     type: 'token', placeholder: 'xoxb-...' },
    ],
  },

  {
    id: 'teams',
    name: 'Microsoft Teams',
    description: 'Team messages & channel posts',
    category: 'communication',
    icon: 'T',
    iconColor: 'oklch(0.52 0.15 255)',
    serverKey: 'teamsServer',
    fields: [
      { key: 'teamsServer',  label: 'MCP Server URL', type: 'url',   placeholder: 'https://teams-mcp.example.com/mcp' },
      { key: 'teamsChannel', label: 'Channel',        type: 'text',  placeholder: 'General' },
      { key: 'teamsToken',   label: 'Auth Token',     type: 'token', placeholder: 'Optional auth token' },
    ],
  },

  {
    id: 'email',
    name: 'Email',
    description: 'Stakeholder & external communications',
    category: 'communication',
    icon: '@',
    iconColor: 'oklch(0.50 0.08 260)',
    serverKey: 'emailServer',
    fields: [
      { key: 'emailServer', label: 'MCP Server URL',      type: 'url',   placeholder: 'https://email-mcp.example.com/mcp' },
      { key: 'emailTo',     label: 'Default Recipient(s)', type: 'text',  placeholder: 'stakeholders@example.com' },
      { key: 'emailToken',  label: 'Auth Token',          type: 'token', placeholder: 'Optional auth token' },
    ],
  },

  // ── Incident Management ─────────────────────────────────────────────────────

  {
    id: 'pagerduty',
    name: 'PagerDuty',
    description: 'Critical incidents & on-call alerts',
    category: 'incident',
    icon: 'PD',
    iconColor: 'oklch(0.52 0.18 145)',
    serverKey: 'pagerdutyServer',
    fields: [
      { key: 'pagerdutyServer',    label: 'MCP Server URL', type: 'url',   placeholder: 'https://pagerduty-mcp.example.com/mcp' },
      { key: 'pagerdutyServiceId', label: 'Service ID',     type: 'text',  placeholder: 'e.g. P123ABC' },
      { key: 'pagerdutyToken',     label: 'API Token',      type: 'token', placeholder: 'Optional auth token' },
    ],
  },

  // ── Observability ───────────────────────────────────────────────────────────

  {
    id: 'sentry',
    name: 'Sentry',
    description: 'Error tracking & performance monitoring',
    category: 'observability',
    icon: 'Se',
    iconColor: 'oklch(0.48 0.18 345)',
    serverKey: 'sentryServer',
    fields: [
      { key: 'sentryServer',  label: 'MCP Server URL', type: 'url',   placeholder: 'https://sentry-mcp.example.com/mcp' },
      { key: 'sentryProject', label: 'Project Slug',   type: 'text',  placeholder: 'e.g. my-project' },
      { key: 'sentryToken',   label: 'Auth Token',     type: 'token', placeholder: 'Optional auth token' },
    ],
  },

  // ── Documentation ───────────────────────────────────────────────────────────

  {
    id: 'confluence',
    name: 'Confluence',
    description: 'Decisions, docs & knowledge base pages',
    category: 'documentation',
    icon: 'Cf',
    iconColor: 'oklch(0.50 0.15 255)',
    serverKey: 'confluenceServer',
    fields: [
      { key: 'confluenceServer',   label: 'MCP Server URL', type: 'url',   placeholder: 'https://confluence-mcp.example.com/mcp' },
      { key: 'confluenceSpaceKey', label: 'Space Key',      type: 'text',  placeholder: 'e.g. ENG' },
      { key: 'confluenceToken',    label: 'Auth Token',     type: 'token', placeholder: 'Optional auth token' },
    ],
  },

  // ── Calendar ────────────────────────────────────────────────────────────────

  {
    id: 'calendar',
    name: 'Google Calendar',
    description: 'Follow-up meetings & deadline scheduling',
    category: 'calendar',
    icon: 'Ca',
    iconColor: 'oklch(0.55 0.16 35)',
    serverKey: 'calendarServer',
    fields: [
      { key: 'calendarServer', label: 'MCP Server URL', type: 'url',   placeholder: 'https://calendar-mcp.example.com/mcp' },
      { key: 'calendarId',     label: 'Calendar ID',    type: 'text',  placeholder: 'primary' },
      { key: 'calendarToken',  label: 'Auth Token',     type: 'token', placeholder: 'Optional auth token' },
    ],
  },

  // ── Wave 2 — Issue Trackers ──────────────────────────────────────────

  {
    id: 'asana',
    name: 'Asana',
    description: 'Tasks & project management',
    category: 'issue-trackers',
    icon: 'As',
    iconColor: 'oklch(0.55 0.15 30)',
    serverKey: 'asanaServer',
    fields: [
      { key: 'asanaServer',    label: 'MCP Server URL', type: 'url',   placeholder: 'https://asana-mcp.example.com/mcp' },
      { key: 'asanaProjectId', label: 'Project GID',    type: 'text',  placeholder: 'e.g. 1234567890' },
      { key: 'asanaToken',     label: 'Access Token',   type: 'token', placeholder: 'Personal access token' },
    ],
  },

  {
    id: 'shortcut',
    name: 'Shortcut',
    description: 'Stories & epics for engineering teams',
    category: 'issue-trackers',
    icon: 'Sc',
    iconColor: 'oklch(0.50 0.18 295)',
    serverKey: 'shortcutServer',
    fields: [
      { key: 'shortcutServer', label: 'MCP Server URL', type: 'url',   placeholder: 'https://shortcut-mcp.example.com/mcp' },
      { key: 'shortcutTeamId', label: 'Team ID',        type: 'text',  placeholder: 'e.g. team-id' },
      { key: 'shortcutToken',  label: 'API Token',      type: 'token', placeholder: 'Shortcut API token' },
    ],
  },

  // ── Wave 2 — Version Control ──────────────────────────────────────────

  {
    id: 'bitbucket',
    name: 'Bitbucket',
    description: 'PRs & branches (Atlassian stack)',
    category: 'vcs',
    icon: 'Bb',
    iconColor: 'oklch(0.48 0.18 255)',
    serverKey: 'bitbucketServer',
    fields: [
      { key: 'bitbucketServer', label: 'MCP Server URL', type: 'url',   placeholder: 'https://bitbucket-mcp.example.com/mcp' },
      { key: 'bitbucketRepo',   label: 'Repository',     type: 'text',  placeholder: 'workspace/repo-slug' },
      { key: 'bitbucketToken',  label: 'App Password',   type: 'token', placeholder: 'Bitbucket app password' },
    ],
  },

  {
    id: 'azure-repos',
    name: 'Azure Repos',
    description: 'PRs & branch policies in Azure DevOps',
    category: 'vcs',
    icon: 'AR',
    iconColor: 'oklch(0.48 0.14 250)',
    serverKey: 'azureReposServer',
    fields: [
      { key: 'azureReposServer',  label: 'MCP Server URL', type: 'url',   placeholder: 'https://azure-repos-mcp.example.com/mcp' },
      { key: 'azureReposProject', label: 'Project',        type: 'text',  placeholder: 'e.g. MyProject' },
      { key: 'azureReposToken',   label: 'PAT',            type: 'token', placeholder: 'Personal access token' },
    ],
  },

  // ── Wave 2 — CI/CD ────────────────────────────────────────────────────

  {
    id: 'github-actions',
    name: 'GitHub Actions',
    description: 'Trigger workflow runs',
    category: 'cicd',
    icon: 'GA',
    iconColor: 'oklch(0.30 0.02 260)',
    serverKey: 'githubActionsServer',
    fields: [
      { key: 'githubActionsServer', label: 'MCP Server URL', type: 'url',   placeholder: 'https://gh-actions-mcp.example.com/mcp' },
      { key: 'githubActionsRepo',   label: 'Repository',     type: 'text',  placeholder: 'owner/repo' },
      { key: 'githubActionsToken',  label: 'Auth Token',     type: 'token', placeholder: 'ghp_...' },
    ],
  },

  {
    id: 'gitlab-ci',
    name: 'GitLab CI',
    description: 'Trigger pipeline runs',
    category: 'cicd',
    icon: 'GC',
    iconColor: 'oklch(0.60 0.17 45)',
    serverKey: 'gitlabCIServer',
    fields: [
      { key: 'gitlabCIServer', label: 'MCP Server URL', type: 'url',   placeholder: 'https://gitlab-ci-mcp.example.com/mcp' },
      { key: 'gitlabCIRepo',   label: 'Project Path',   type: 'text',  placeholder: 'group/project' },
      { key: 'gitlabCIToken',  label: 'Access Token',   type: 'token', placeholder: 'glpat-...' },
    ],
  },

  {
    id: 'jenkins',
    name: 'Jenkins',
    description: 'Trigger & monitor build jobs',
    category: 'cicd',
    icon: 'Jk',
    iconColor: 'oklch(0.50 0.12 50)',
    serverKey: 'jenkinsServer',
    fields: [
      { key: 'jenkinsServer', label: 'MCP Server URL', type: 'url',   placeholder: 'https://jenkins-mcp.example.com/mcp' },
      { key: 'jenkinsJob',    label: 'Job Name',       type: 'text',  placeholder: 'e.g. my-pipeline' },
      { key: 'jenkinsToken',  label: 'API Token',      type: 'token', placeholder: 'Jenkins API token' },
    ],
  },

  {
    id: 'circleci',
    name: 'CircleCI',
    description: 'Trigger pipeline runs',
    category: 'cicd',
    icon: 'CC',
    iconColor: 'oklch(0.52 0.14 145)',
    serverKey: 'circleciServer',
    fields: [
      { key: 'circleciServer',  label: 'MCP Server URL', type: 'url',   placeholder: 'https://circleci-mcp.example.com/mcp' },
      { key: 'circleciProject', label: 'Project Slug',   type: 'text',  placeholder: 'gh/org/repo' },
      { key: 'circleciToken',   label: 'API Token',      type: 'token', placeholder: 'Personal API token' },
    ],
  },

  // ── Wave 2 — Observability ────────────────────────────────────────────

  {
    id: 'datadog',
    name: 'Datadog',
    description: 'Monitors, alerts & dashboards',
    category: 'observability',
    icon: 'DD',
    iconColor: 'oklch(0.55 0.16 60)',
    serverKey: 'datadogServer',
    fields: [
      { key: 'datadogServer',    label: 'MCP Server URL', type: 'url',   placeholder: 'https://datadog-mcp.example.com/mcp' },
      { key: 'datadogDashboard', label: 'Dashboard ID',   type: 'text',  placeholder: 'Optional dashboard ID' },
      { key: 'datadogToken',     label: 'API Key',        type: 'token', placeholder: 'Datadog API key' },
    ],
  },

  {
    id: 'grafana',
    name: 'Grafana',
    description: 'Dashboard snapshots & metric context',
    category: 'observability',
    icon: 'Gf',
    iconColor: 'oklch(0.58 0.16 35)',
    serverKey: 'grafanaServer',
    fields: [
      { key: 'grafanaServer',    label: 'MCP Server URL', type: 'url',   placeholder: 'https://grafana-mcp.example.com/mcp' },
      { key: 'grafanaDashboard', label: 'Dashboard UID',  type: 'text',  placeholder: 'Optional dashboard UID' },
      { key: 'grafanaToken',     label: 'Service Token',  type: 'token', placeholder: 'Grafana service account token' },
    ],
  },

  // ── Wave 2 — Security & Quality ───────────────────────────────────────

  {
    id: 'snyk',
    name: 'Snyk',
    description: 'Vulnerability scanning & dependency security',
    category: 'security',
    icon: 'Sn',
    iconColor: 'oklch(0.50 0.20 145)',
    serverKey: 'snykServer',
    fields: [
      { key: 'snykServer',  label: 'MCP Server URL', type: 'url',   placeholder: 'https://snyk-mcp.example.com/mcp' },
      { key: 'snykProject', label: 'Project ID',     type: 'text',  placeholder: 'Snyk project ID or slug' },
      { key: 'snykToken',   label: 'API Token',      type: 'token', placeholder: 'Snyk API token' },
    ],
  },

  {
    id: 'sonarqube',
    name: 'SonarQube',
    description: 'Code quality gates & static analysis',
    category: 'security',
    icon: 'SQ',
    iconColor: 'oklch(0.52 0.14 220)',
    serverKey: 'sonarServer',
    fields: [
      { key: 'sonarServer',  label: 'MCP Server URL', type: 'url',   placeholder: 'https://sonar-mcp.example.com/mcp' },
      { key: 'sonarProject', label: 'Project Key',    type: 'text',  placeholder: 'e.g. my-project' },
      { key: 'sonarToken',   label: 'User Token',     type: 'token', placeholder: 'SonarQube user token' },
    ],
  },

  {
    id: 'github-security',
    name: 'GitHub Security',
    description: 'Advanced Security, Dependabot & code scanning',
    category: 'security',
    icon: 'GS',
    iconColor: 'oklch(0.35 0.05 260)',
    serverKey: 'ghsecServer',
    fields: [
      { key: 'ghsecServer', label: 'MCP Server URL', type: 'url',   placeholder: 'https://ghsec-mcp.example.com/mcp' },
      { key: 'ghsecRepo',   label: 'Repository',     type: 'text',  placeholder: 'owner/repo' },
      { key: 'ghsecToken',  label: 'Auth Token',     type: 'token', placeholder: 'ghp_... (security_events scope)' },
    ],
  },

  // ── Wave 2 — Communication ────────────────────────────────────────────

  {
    id: 'google-chat',
    name: 'Google Chat',
    description: 'Google Workspace team messages',
    category: 'communication',
    icon: 'GC',
    iconColor: 'oklch(0.55 0.18 140)',
    serverKey: 'googleChatServer',
    fields: [
      { key: 'googleChatServer', label: 'MCP Server URL', type: 'url',   placeholder: 'https://gchat-mcp.example.com/mcp' },
      { key: 'googleChatSpace',  label: 'Space Name/ID',  type: 'text',  placeholder: 'spaces/XXXXXX' },
      { key: 'googleChatToken',  label: 'Auth Token',     type: 'token', placeholder: 'Service account or OAuth token' },
    ],
  },

  {
    id: 'discord',
    name: 'Discord',
    description: 'Developer communities & team servers',
    category: 'communication',
    icon: 'Di',
    iconColor: 'oklch(0.52 0.20 280)',
    serverKey: 'discordServer',
    fields: [
      { key: 'discordServer',  label: 'MCP Server URL', type: 'url',   placeholder: 'https://discord-mcp.example.com/mcp' },
      { key: 'discordChannel', label: 'Channel',        type: 'text',  placeholder: 'channel-name or ID' },
      { key: 'discordToken',   label: 'Bot Token',      type: 'token', placeholder: 'Discord bot token' },
    ],
  },

  // ── Wave 2 — Scheduling ───────────────────────────────────────────────

  {
    id: 'outlook',
    name: 'Outlook / M365',
    description: 'Microsoft 365 calendar follow-ups',
    category: 'calendar',
    icon: 'Ou',
    iconColor: 'oklch(0.48 0.16 255)',
    serverKey: 'outlookServer',
    fields: [
      { key: 'outlookServer',   label: 'MCP Server URL', type: 'url',   placeholder: 'https://outlook-mcp.example.com/mcp' },
      { key: 'outlookCalendar', label: 'Calendar ID',    type: 'text',  placeholder: 'user@org.com or primary' },
      { key: 'outlookToken',    label: 'Graph API Token',type: 'token', placeholder: 'Microsoft Graph OAuth token' },
    ],
  },

  // ── Meeting Intelligence ─────────────────────────────────────────────────────

  {
    id: 'granola',
    name: 'Granola',
    description: 'AI-enhanced meeting notes',
    category: 'meeting-tools',
    icon: 'Gr',
    iconColor: 'oklch(0.58 0.15 80)',
    serverKey: 'granolaServer',
    fields: [
      { key: 'granolaServer', label: 'MCP Server URL', type: 'url',   placeholder: 'https://granola-mcp.example.com/mcp' },
      { key: 'granolaToken',  label: 'API Key',        type: 'token', placeholder: 'Optional auth token' },
    ],
  },

  {
    id: 'fathom',
    name: 'Fathom',
    description: 'Meeting summaries & action items',
    category: 'meeting-tools',
    icon: 'Fa',
    iconColor: 'oklch(0.52 0.15 200)',
    serverKey: 'fathomServer',
    fields: [
      { key: 'fathomServer', label: 'MCP Server URL', type: 'url',   placeholder: 'https://fathom-mcp.example.com/mcp' },
      { key: 'fathomToken',  label: 'API Key',        type: 'token', placeholder: 'Optional auth token' },
    ],
  },

  {
    id: 'fireflies',
    name: 'Fireflies.ai',
    description: 'Full meeting transcription',
    category: 'meeting-tools',
    icon: 'Ff',
    iconColor: 'oklch(0.52 0.18 300)',
    serverKey: 'firefliesServer',
    fields: [
      { key: 'firefliesServer', label: 'MCP Server URL', type: 'url',   placeholder: 'https://fireflies-mcp.example.com/mcp' },
      { key: 'firefliesToken',  label: 'API Key',        type: 'token', placeholder: 'Optional auth token' },
    ],
  },

  {
    id: 'otter',
    name: 'Otter.ai',
    description: 'Real-time transcription & summaries',
    category: 'meeting-tools',
    icon: 'Ot',
    iconColor: 'oklch(0.52 0.14 175)',
    serverKey: 'otterServer',
    fields: [
      { key: 'otterServer', label: 'MCP Server URL', type: 'url',   placeholder: 'https://otter-mcp.example.com/mcp' },
      { key: 'otterToken',  label: 'API Key',        type: 'token', placeholder: 'Optional auth token' },
    ],
  },

  {
    id: 'tldv',
    name: 'tl;dv',
    description: 'Meeting highlights & clips',
    category: 'meeting-tools',
    icon: 'td',
    iconColor: 'oklch(0.48 0.18 340)',
    serverKey: 'tldvServer',
    fields: [
      { key: 'tldvServer', label: 'MCP Server URL', type: 'url',   placeholder: 'https://tldv-mcp.example.com/mcp' },
      { key: 'tldvToken',  label: 'API Key',        type: 'token', placeholder: 'Optional auth token' },
    ],
  },

  {
    id: 'avoma',
    name: 'Avoma',
    description: 'AI meeting assistant & CRM sync',
    category: 'meeting-tools',
    icon: 'Av',
    iconColor: 'oklch(0.52 0.15 250)',
    serverKey: 'avomaServer',
    fields: [
      { key: 'avomaServer', label: 'MCP Server URL', type: 'url',   placeholder: 'https://avoma-mcp.example.com/mcp' },
      { key: 'avomaToken',  label: 'API Key',        type: 'token', placeholder: 'Optional auth token' },
    ],
  },

  {
    id: 'read',
    name: 'Read.ai',
    description: 'Meeting intelligence & analytics',
    category: 'meeting-tools',
    icon: 'Rd',
    iconColor: 'oklch(0.42 0.14 260)',
    serverKey: 'readServer',
    fields: [
      { key: 'readServer', label: 'MCP Server URL', type: 'url',   placeholder: 'https://read-mcp.example.com/mcp' },
      { key: 'readToken',  label: 'API Key',        type: 'token', placeholder: 'Optional auth token' },
    ],
  },

  {
    id: 'zoom',
    name: 'Zoom AI',
    description: 'Zoom meeting summaries',
    category: 'meeting-tools',
    icon: 'Zm',
    iconColor: 'oklch(0.50 0.18 255)',
    serverKey: 'zoomServer',
    fields: [
      { key: 'zoomServer', label: 'MCP Server URL', type: 'url',   placeholder: 'https://zoom-mcp.example.com/mcp' },
      { key: 'zoomToken',  label: 'API Key',        type: 'token', placeholder: 'Optional auth token' },
    ],
  },

  {
    id: 'teams-meeting',
    name: 'Teams Meeting',
    description: 'Microsoft Teams Copilot transcripts',
    category: 'meeting-tools',
    icon: 'TM',
    iconColor: 'oklch(0.52 0.15 255)',
    serverKey: 'teamsMeetingServer',
    fields: [
      { key: 'teamsMeetingServer', label: 'MCP Server URL', type: 'url',   placeholder: 'https://teams-meeting-mcp.example.com/mcp' },
      { key: 'teamsMeetingToken',  label: 'API Key',        type: 'token', placeholder: 'Optional auth token' },
    ],
  },
];
