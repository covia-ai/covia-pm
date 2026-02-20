import { useState } from 'react';
import type { PMSettings } from '../types';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PMSettings;
  onSave: (settings: PMSettings) => void;
}

function TokenField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <div className="token-field-wrapper">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? 'Optional auth token'}
          autoComplete="off"
        />
        <button
          type="button"
          className="token-toggle"
          onClick={() => setVisible(v => !v)}
          aria-label={visible ? 'Hide token' : 'Show token'}
        >
          {visible ? '🙈' : '👁'}
        </button>
      </div>
    </div>
  );
}

export function SettingsPanel({ isOpen, onClose, settings, onSave }: SettingsPanelProps) {
  const [draft, setDraft] = useState<PMSettings>(settings);

  // Sync draft when settings prop changes (e.g. on open)
  const handleOpen = () => {
    setDraft(settings);
  };

  const set = (field: keyof PMSettings) => (value: string) =>
    setDraft(d => ({ ...d, [field]: value }));

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  return (
    <>
      {isOpen && (
        <div
          className="settings-drawer-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`settings-drawer${isOpen ? ' open' : ''}`}
        aria-label="Configuration panel"
        onTransitionEnd={isOpen ? handleOpen : undefined}
      >
        <div className="settings-drawer-header">
          <h2>Configuration</h2>
          <button
            type="button"
            className="button-outline settings-close"
            onClick={onClose}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        <div className="settings-drawer-body">

          {/* Jira */}
          <section className="settings-section">
            <h3>Jira</h3>
            <div className="form-group">
              <label htmlFor="jira-server">MCP Server URL</label>
              <input
                id="jira-server"
                type="url"
                value={draft.jiraServer}
                onChange={e => set('jiraServer')(e.target.value)}
                placeholder="https://jira-mcp.example.com/mcp"
              />
            </div>
            <div className="form-group">
              <label htmlFor="jira-project">Project Key</label>
              <input
                id="jira-project"
                type="text"
                value={draft.jiraProjectKey}
                onChange={e => set('jiraProjectKey')(e.target.value)}
                placeholder="e.g. PROJ"
              />
            </div>
            <TokenField
              id="jira-token"
              label="Auth Token"
              value={draft.jiraToken}
              onChange={set('jiraToken')}
            />
          </section>

          {/* GitHub */}
          <section className="settings-section">
            <h3>GitHub</h3>
            <div className="form-group">
              <label htmlFor="github-server">MCP Server URL</label>
              <input
                id="github-server"
                type="url"
                value={draft.githubServer}
                onChange={e => set('githubServer')(e.target.value)}
                placeholder="https://github-mcp.example.com/mcp"
              />
            </div>
            <div className="form-group">
              <label htmlFor="github-repo">Repository</label>
              <input
                id="github-repo"
                type="text"
                value={draft.githubRepo}
                onChange={e => set('githubRepo')(e.target.value)}
                placeholder="owner/repo"
              />
            </div>
            <TokenField
              id="github-token"
              label="Auth Token"
              value={draft.githubToken}
              onChange={set('githubToken')}
            />
          </section>

          {/* Slack */}
          <section className="settings-section">
            <h3>Slack</h3>
            <div className="form-group">
              <label htmlFor="slack-server">MCP Server URL</label>
              <input
                id="slack-server"
                type="url"
                value={draft.slackServer}
                onChange={e => set('slackServer')(e.target.value)}
                placeholder="https://slack-mcp.example.com/mcp"
              />
            </div>
            <div className="form-group">
              <label htmlFor="slack-channel">Channel</label>
              <input
                id="slack-channel"
                type="text"
                value={draft.slackChannel}
                onChange={e => set('slackChannel')(e.target.value)}
                placeholder="#engineering"
              />
            </div>
            <TokenField
              id="slack-token"
              label="Auth Token"
              value={draft.slackToken}
              onChange={set('slackToken')}
            />
          </section>
        </div>

        <div className="settings-drawer-footer">
          <button type="button" className="button-primary" onClick={handleSave}>
            Save Configuration
          </button>
          <button type="button" className="button-outline" onClick={onClose}>
            Cancel
          </button>
        </div>
      </aside>
    </>
  );
}
