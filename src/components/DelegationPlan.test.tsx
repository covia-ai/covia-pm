import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DelegationPlan } from './DelegationPlan';
import type { AnalysisResult, PMSettings, HealthMap } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const emptySettings: PMSettings = {
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

const jiraSettings: PMSettings = { ...emptySettings, jiraServer: 'http://jira.test' };

const sampleResult: AnalysisResult = {
  actionItems: [
    { type: 'create_issue', description: 'Fix login bug', priority: 'high', target: 'jira' },
    { type: 'review_pr',    description: 'Review PR #42', priority: 'medium', target: 'github' },
  ],
  blockers: ['Awaiting API key'],
  decisions: ['Use PostgreSQL'],
};

const defaultProps = {
  result: null,
  error: null,
  onExecute: vi.fn(),
  settings: jiraSettings,
  isExecuting: false,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DelegationPlan', () => {
  it('renders nothing when result is null and error is null', () => {
    const { container } = render(<DelegationPlan {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows error card with message when error is set', () => {
    render(<DelegationPlan {...defaultProps} error={new Error('LLM failed')} />);
    expect(screen.getByText('Analysis Failed')).toBeInTheDocument();
    expect(screen.getByText('LLM failed')).toBeInTheDocument();
  });

  it('renders action items grouped by target', () => {
    render(<DelegationPlan {...defaultProps} result={sampleResult} settings={jiraSettings} />);
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
    expect(screen.getByText('Review PR #42')).toBeInTheDocument();
  });

  it('shows "No action items" empty state when actionItems is empty', () => {
    const emptyResult: AnalysisResult = { actionItems: [], blockers: [], decisions: [] };
    render(<DelegationPlan {...defaultProps} result={emptyResult} />);
    expect(screen.getByText(/no action items/i)).toBeInTheDocument();
  });

  it('shows blockers when present', () => {
    render(<DelegationPlan {...defaultProps} result={sampleResult} />);
    expect(screen.getByText('Awaiting API key')).toBeInTheDocument();
  });

  it('shows decisions when present', () => {
    render(<DelegationPlan {...defaultProps} result={sampleResult} />);
    expect(screen.getByText('Use PostgreSQL')).toBeInTheDocument();
  });

  it('Execute button is disabled and shows warning when no integration servers configured', () => {
    render(<DelegationPlan {...defaultProps} result={sampleResult} settings={emptySettings} />);
    expect(screen.getByRole('button', { name: /execute plan/i })).toBeDisabled();
    expect(screen.getByText(/configure integrations/i)).toBeInTheDocument();
  });

  it('Execute button is enabled when at least one server is configured', () => {
    render(<DelegationPlan {...defaultProps} result={sampleResult} settings={jiraSettings} />);
    expect(screen.getByRole('button', { name: /execute plan/i })).not.toBeDisabled();
  });

  it('Execute button calls onExecute when clicked', async () => {
    const user = userEvent.setup();
    const onExecute = vi.fn();
    render(<DelegationPlan {...defaultProps} result={sampleResult} settings={jiraSettings} onExecute={onExecute} />);
    await user.click(screen.getByRole('button', { name: /execute plan/i }));
    expect(onExecute).toHaveBeenCalledTimes(1);
  });

  it('Execute button shows spinner and "Executing…" when isExecuting=true', () => {
    render(<DelegationPlan {...defaultProps} result={sampleResult} isExecuting />);
    expect(screen.getByRole('button', { name: /executing/i })).toBeDisabled();
    expect(document.querySelector('.spinner')).toBeInTheDocument();
  });

  it('shows unreachable warning when health has "unreachable" for a used target', () => {
    const health: HealthMap = { jiraServer: 'unreachable' };
    render(<DelegationPlan {...defaultProps} result={sampleResult} health={health} />);
    expect(screen.getByText(/unreachable/i)).toBeInTheDocument();
    expect(screen.getByText(/execution may fail/i)).toBeInTheDocument();
  });

  it('Execute button stays ENABLED even when a target is unreachable', () => {
    const health: HealthMap = { jiraServer: 'unreachable' };
    render(<DelegationPlan {...defaultProps} result={sampleResult} settings={jiraSettings} health={health} />);
    expect(screen.getByRole('button', { name: /execute plan/i })).not.toBeDisabled();
  });

  it('does NOT show unreachable warning when all targeted servers are online', () => {
    const health: HealthMap = { jiraServer: 'ok', githubServer: 'ok' };
    render(<DelegationPlan {...defaultProps} result={sampleResult} health={health} />);
    expect(screen.queryByText(/execution may fail/i)).not.toBeInTheDocument();
  });
});
