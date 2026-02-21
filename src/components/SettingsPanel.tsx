import { useState, useCallback } from 'react';
import type { PMSettings } from '../types';
import { INTEGRATIONS, CATEGORIES } from '../config/integrations';
import type { Integration } from '../config/integrations';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PMSettings;
  onSave: (settings: PMSettings) => void;
}

// ─── TokenField ────────────────────────────────────────────────────────────────

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

// ─── IntegrationAccordion ──────────────────────────────────────────────────────

function IntegrationAccordion({
  integration,
  draft,
  set,
  isExpanded,
  onToggle,
}: {
  integration: Integration;
  draft: PMSettings;
  set: (field: keyof PMSettings) => (value: string) => void;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isConfigured = !!(draft[integration.serverKey] as string);

  return (
    <div className={`integration-item${isExpanded ? ' expanded' : ''}`}>
      <button
        type="button"
        className="integration-header"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <span
          className="integration-icon"
          style={{ background: integration.iconColor }}
          aria-hidden="true"
        >
          {integration.icon}
        </span>
        <span className="integration-name">{integration.name}</span>
        <span className="integration-desc">{integration.description}</span>
        <span className={`integration-status${isConfigured ? ' ok' : ''}`}>
          {isConfigured ? '● Configured' : '○ Not set'}
        </span>
        <span className={`integration-chevron${isExpanded ? ' open' : ''}`} aria-hidden="true">
          ▾
        </span>
      </button>

      {isExpanded && (
        <div className="integration-body">
          {integration.fields.map(field => {
            const fieldId = `${integration.id}-${field.key}`;
            const value = draft[field.key] as string;
            const onChange = set(field.key);

            if (field.type === 'token') {
              return (
                <TokenField
                  key={field.key}
                  id={fieldId}
                  label={field.label}
                  value={value}
                  onChange={onChange}
                  placeholder={field.placeholder}
                />
              );
            }

            return (
              <div key={field.key} className="form-group">
                <label htmlFor={fieldId}>{field.label}</label>
                <input
                  id={fieldId}
                  type={field.type}
                  value={value}
                  onChange={e => onChange(e.target.value)}
                  placeholder={field.placeholder}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── CategorySection ───────────────────────────────────────────────────────────

function CategorySection({
  label,
  integrations,
  draft,
  set,
  expandedTools,
  onToggleTool,
}: {
  label: string;
  integrations: Integration[];
  draft: PMSettings;
  set: (field: keyof PMSettings) => (value: string) => void;
  expandedTools: Set<string>;
  onToggleTool: (id: string) => void;
}) {
  // Start expanded only if at least one integration in this category is configured
  const isAnyConfigured = integrations.some(i => !!(draft[i.serverKey] as string));
  const [isOpen, setIsOpen] = useState(isAnyConfigured);

  const configuredCount = integrations.filter(
    i => !!(draft[i.serverKey] as string)
  ).length;

  return (
    <div className="category-section">
      <button
        type="button"
        className="category-header"
        onClick={() => setIsOpen(o => !o)}
        aria-expanded={isOpen}
      >
        <span className="category-label">{label}</span>
        <span className="category-count">
          {configuredCount} / {integrations.length} configured
        </span>
        <span className={`category-chevron${isOpen ? ' open' : ''}`} aria-hidden="true">
          ▾
        </span>
      </button>

      {isOpen && (
        <div className="integration-list">
          {integrations.map(integration => (
            <IntegrationAccordion
              key={integration.id}
              integration={integration}
              draft={draft}
              set={set}
              isExpanded={expandedTools.has(integration.id)}
              onToggle={() => onToggleTool(integration.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SettingsPanel ─────────────────────────────────────────────────────────────

const visibleIntegrations = INTEGRATIONS.filter(i => !i.hidden);

function buildInitialExpanded(settings: PMSettings): Set<string> {
  const s = new Set<string>();
  for (const i of visibleIntegrations) {
    if (settings[i.serverKey]) s.add(i.id);
  }
  return s;
}

export function SettingsPanel({ isOpen, onClose, settings, onSave }: SettingsPanelProps) {
  const [draft, setDraft] = useState<PMSettings>(settings);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(
    () => buildInitialExpanded(settings)
  );

  // Re-sync draft and expanded state whenever the drawer opens
  const handleOpen = useCallback(() => {
    setDraft(settings);
    setExpandedTools(buildInitialExpanded(settings));
  }, [settings]);

  const set = useCallback(
    (field: keyof PMSettings) => (value: string) =>
      setDraft(d => ({ ...d, [field]: value })),
    []
  );

  const toggleTool = useCallback((id: string) => {
    setExpandedTools(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  const executionCategories = CATEGORIES.filter(c => c.group === 'execution');
  const intelligenceCategories = CATEGORIES.filter(c => c.group === 'intelligence');

  const integrationsForCategory = (catId: string) =>
    visibleIntegrations.filter(i => i.category === catId);

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
        onTransitionEnd={isOpen ? (e) => { if (e.target === e.currentTarget) handleOpen(); } : undefined}
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

          {/* ── Execution Integrations ──────────────────────────────── */}
          <p className="settings-group-heading">Execution Integrations</p>

          {executionCategories.map(cat => {
            const items = integrationsForCategory(cat.id);
            if (items.length === 0) return null;
            return (
              <CategorySection
                key={cat.id}
                label={cat.label}
                integrations={items}
                draft={draft}
                set={set}
                expandedTools={expandedTools}
                onToggleTool={toggleTool}
              />
            );
          })}

          {/* ── Meeting Intelligence ────────────────────────────────── */}
          <p className="settings-group-heading">Meeting Intelligence</p>
          <p className="settings-group-hint">
            Connect meeting transcript tools. Once a server is set, a &ldquo;Fetch transcript&rdquo;
            option appears in the notes input.
          </p>

          {intelligenceCategories.map(cat => {
            const items = integrationsForCategory(cat.id);
            if (items.length === 0) return null;
            return (
              <CategorySection
                key={cat.id}
                label={cat.label}
                integrations={items}
                draft={draft}
                set={set}
                expandedTools={expandedTools}
                onToggleTool={toggleTool}
              />
            );
          })}

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
