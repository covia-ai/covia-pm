import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsPanel } from './SettingsPanel';
import type { PMSettings, HealthMap } from '../types';

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

const jiraConfigured: PMSettings = { ...emptySettings, jiraServer: 'http://jira.test' };

function renderPanel(
  props: Partial<{
    isOpen: boolean;
    settings: PMSettings;
    onSave: (s: PMSettings) => void;
    onClose: () => void;
    health: HealthMap;
  }> = {}
) {
  return render(
    <SettingsPanel
      isOpen={props.isOpen ?? true}
      onClose={props.onClose ?? vi.fn()}
      settings={props.settings ?? emptySettings}
      onSave={props.onSave ?? vi.fn()}
      health={props.health}
    />
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SettingsPanel', () => {
  it('is closed (no "open" class) when isOpen=false', () => {
    const { container } = renderPanel({ isOpen: false });
    const aside = container.querySelector('aside.settings-drawer');
    expect(aside).not.toHaveClass('open');
  });

  it('has "open" class on the aside when isOpen=true', () => {
    const { container } = renderPanel({ isOpen: true });
    const aside = container.querySelector('aside.settings-drawer');
    expect(aside).toHaveClass('open');
  });

  it('renders the "Execution Integrations" heading', () => {
    renderPanel();
    expect(screen.getByText('Execution Integrations')).toBeInTheDocument();
  });

  it('renders the "Meeting Intelligence" heading', () => {
    renderPanel();
    expect(screen.getByText('Meeting Intelligence')).toBeInTheDocument();
  });

  it('renders category labels such as "Issue Trackers"', () => {
    renderPanel();
    // Category headers are rendered as buttons
    expect(screen.getByRole('button', { name: /issue trackers/i })).toBeInTheDocument();
  });

  it('category starts collapsed when no integration in it is configured', async () => {
    renderPanel({ settings: emptySettings });
    // The category "Issue Trackers" should be collapsed — Jira integration button not visible
    expect(screen.queryByRole('button', { name: /jira/i })).not.toBeInTheDocument();
  });

  it('category starts expanded when an integration in it is configured', () => {
    renderPanel({ settings: jiraConfigured });
    // Issue Trackers category should be expanded, so Jira integration visible
    expect(screen.getByRole('button', { name: /jira/i })).toBeInTheDocument();
  });

  it('clicking a collapsed category header expands it', async () => {
    const user = userEvent.setup();
    renderPanel({ settings: emptySettings });

    const catHeader = screen.getByRole('button', { name: /issue trackers/i });
    await user.click(catHeader);

    // After expanding, Jira integration button should appear
    expect(screen.getByRole('button', { name: /jira/i })).toBeInTheDocument();
  });

  it('clicking an expanded category header collapses it again', async () => {
    const user = userEvent.setup();
    renderPanel({ settings: emptySettings });

    const catHeader = screen.getByRole('button', { name: /issue trackers/i });
    // Expand
    await user.click(catHeader);
    expect(screen.getByRole('button', { name: /jira/i })).toBeInTheDocument();
    // Collapse
    await user.click(catHeader);
    expect(screen.queryByRole('button', { name: /jira/i })).not.toBeInTheDocument();
  });

  it('clicking an integration header expands its field group', async () => {
    const user = userEvent.setup();
    // Use emptySettings so Jira starts collapsed (jiraConfigured would start it expanded)
    renderPanel({ settings: emptySettings });

    // Expand the Issue Trackers category first
    await user.click(screen.getByRole('button', { name: /issue trackers/i }));

    // Now expand the Jira integration
    await user.click(screen.getByRole('button', { name: /jira/i }));

    // Fields should appear — Jira has a "MCP Server URL" field
    expect(screen.getByLabelText(/mcp server url/i)).toBeInTheDocument();
  });

  it('token field is password type by default', async () => {
    const user = userEvent.setup();
    renderPanel({ settings: jiraConfigured });
    await user.click(screen.getByRole('button', { name: /jira/i }));
    await user.click(screen.getByRole('button', { name: /jira/i })); // expand (toggle once)

    // Find password input — there may be multiple; just check at least one
    const passwordInputs = screen.getAllByDisplayValue('').filter(el =>
      (el as HTMLInputElement).type === 'password'
    );
    expect(passwordInputs.length).toBeGreaterThan(0);
  });

  it('Save button calls onSave with the current draft values', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderPanel({ settings: jiraConfigured, onSave });
    await user.click(screen.getByRole('button', { name: /save configuration/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ jiraServer: 'http://jira.test' }));
  });

  it('Cancel button calls onClose and does not call onSave', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();
    renderPanel({ onSave, onClose });
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('unconfigured integration shows "○ Not set"', async () => {
    const user = userEvent.setup();
    renderPanel({ settings: emptySettings });
    // Expand Issue Trackers category
    await user.click(screen.getByRole('button', { name: /issue trackers/i }));

    const jiraHeader = screen.getByRole('button', { name: /jira/i });
    expect(within(jiraHeader).getByText('○ Not set')).toBeInTheDocument();
  });

  it('configured integration (no health prop) shows "● Configured"', async () => {
    const user = userEvent.setup();
    renderPanel({ settings: jiraConfigured });

    const jiraHeader = screen.getByRole('button', { name: /jira/i });
    expect(within(jiraHeader).getByText('● Configured')).toBeInTheDocument();
  });

  it('shows "◌ Checking…" when health[serverKey]="checking"', async () => {
    const user = userEvent.setup();
    const health: HealthMap = { jiraServer: 'checking' };
    renderPanel({ settings: jiraConfigured, health });

    const jiraHeader = screen.getByRole('button', { name: /jira/i });
    expect(within(jiraHeader).getByText('◌ Checking…')).toBeInTheDocument();
  });

  it('shows "● Online" when health[serverKey]="ok"', async () => {
    const user = userEvent.setup();
    const health: HealthMap = { jiraServer: 'ok' };
    renderPanel({ settings: jiraConfigured, health });

    const jiraHeader = screen.getByRole('button', { name: /jira/i });
    expect(within(jiraHeader).getByText('● Online')).toBeInTheDocument();
  });

  it('shows "⚠ Unreachable" when health[serverKey]="unreachable"', async () => {
    const user = userEvent.setup();
    const health: HealthMap = { jiraServer: 'unreachable' };
    renderPanel({ settings: jiraConfigured, health });

    const jiraHeader = screen.getByRole('button', { name: /jira/i });
    expect(within(jiraHeader).getByText('⚠ Unreachable')).toBeInTheDocument();
  });

  it('unconfigured integration always shows "○ Not set" regardless of health', async () => {
    const user = userEvent.setup();
    // Even if health says 'ok', unconfigured integration should show "○ Not set"
    const health: HealthMap = { jiraServer: 'ok' };
    renderPanel({ settings: emptySettings, health });
    await user.click(screen.getByRole('button', { name: /issue trackers/i }));

    const jiraHeader = screen.getByRole('button', { name: /jira/i });
    expect(within(jiraHeader).getByText('○ Not set')).toBeInTheDocument();
  });
});
