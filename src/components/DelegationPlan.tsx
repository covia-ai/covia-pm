import type { AnalysisResult, ActionItem, ActionTarget, Priority, PMSettings, HealthMap } from '../types';

interface DelegationPlanProps {
  result: AnalysisResult | null;
  error: Error | null;
  onExecute: () => void;
  settings: PMSettings;
  isExecuting: boolean;
  health?: HealthMap;
}

const TARGET_CONFIG: Record<ActionTarget, { label: string; icon: string; color: string }> = {
  jira:         { label: 'Jira',         icon: 'J',  color: 'var(--color-secondary)' },
  linear:       { label: 'Linear',       icon: 'L',  color: 'var(--color-primary)' },
  'azure-devops':{ label: 'Azure DevOps',icon: 'A',  color: 'var(--color-secondary-light)' },
  github:       { label: 'GitHub',       icon: 'G',  color: 'var(--color-foreground)' },
  gitlab:       { label: 'GitLab',       icon: 'GL', color: 'var(--color-warning)' },
  slack:        { label: 'Slack',        icon: 'S',  color: 'var(--color-accent)' },
  teams:        { label: 'Teams',        icon: 'T',  color: 'var(--color-secondary)' },
  email:        { label: 'Email',        icon: 'E',  color: 'var(--color-muted-foreground)' },
  pagerduty:    { label: 'PagerDuty',    icon: 'P',  color: 'var(--color-error)' },
  sentry:       { label: 'Sentry',       icon: 'SE', color: 'var(--color-error)' },
  confluence:   { label: 'Confluence',   icon: 'C',  color: 'var(--color-secondary)' },
  calendar:     { label: 'Calendar',     icon: 'CA', color: 'var(--color-success)' },
};

const PRIORITY_CONFIG: Record<Priority, { label: string; className: string }> = {
  critical: { label: 'Critical', className: 'badge-error' },
  high: { label: 'High', className: 'badge-warning' },
  medium: { label: 'Medium', className: 'badge' },
  low: { label: 'Low', className: 'badge' },
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  create_issue: 'Create Issue',
  review_pr: 'Review PR',
  create_branch: 'Create Branch',
  send_notification: 'Notification',
};

const TARGET_SERVER_KEY: Record<ActionTarget, keyof PMSettings> = {
  jira:           'jiraServer',
  linear:         'linearServer',
  'azure-devops': 'azureServer',
  github:         'githubServer',
  gitlab:         'gitlabServer',
  slack:          'slackServer',
  teams:          'teamsServer',
  email:          'emailServer',
  pagerduty:      'pagerdutyServer',
  sentry:         'sentryServer',
  confluence:     'confluenceServer',
  calendar:       'calendarServer',
};

const ALL_INTEGRATION_SERVER_FIELDS: (keyof PMSettings)[] = Object.values(TARGET_SERVER_KEY);

function groupByTarget(items: ActionItem[]): Record<ActionTarget, ActionItem[]> {
  return items.reduce((acc, item) => {
    if (!acc[item.target]) {
      acc[item.target] = [];
    }
    acc[item.target].push(item);
    return acc;
  }, {} as Record<ActionTarget, ActionItem[]>);
}

function ActionItemCard({ item }: { item: ActionItem }) {
  const priority = PRIORITY_CONFIG[item.priority];
  const actionLabel = ACTION_TYPE_LABELS[item.type] || item.type;

  return (
    <div className="action-item">
      <div className="action-item-header">
        <span className="action-type">{actionLabel}</span>
        <span className={`badge ${priority.className}`}>{priority.label}</span>
      </div>
      <p className="action-description">{item.description}</p>
      {item.assignee && (
        <div className="action-assignee">
          <span className="text-muted">Assignee:</span> {item.assignee}
        </div>
      )}
    </div>
  );
}

function TargetGroup({ target, items }: { target: ActionTarget; items: ActionItem[] }) {
  const config = TARGET_CONFIG[target];

  return (
    <div className="target-group">
      <div className="target-header">
        <span className="target-icon" style={{ backgroundColor: config.color }}>
          {config.icon}
        </span>
        <h4>{config.label}</h4>
        <span className="badge">{items.length}</span>
      </div>
      <div className="target-items">
        {items.map((item, index) => (
          <ActionItemCard key={index} item={item} />
        ))}
      </div>
    </div>
  );
}

export function DelegationPlan({ result, error, onExecute, settings, isExecuting, health }: DelegationPlanProps) {
  if (error) {
    return (
      <section className="delegation-plan-section">
        <div className="container">
          <div className="card error-card">
            <h3>Analysis Failed</h3>
            <p className="text-muted">{error.message}</p>
          </div>
        </div>
      </section>
    );
  }

  if (!result) {
    return null;
  }

  const grouped = groupByTarget(result.actionItems);
  const targets = Object.keys(grouped) as ActionTarget[];
  const hasActions = result.actionItems.length > 0;
  const hasBlockers = result.blockers.length > 0;
  const hasDecisions = result.decisions.length > 0;
  const hasAnyIntegration = ALL_INTEGRATION_SERVER_FIELDS.some(
    f => !!(settings as unknown as Record<string, string>)[f]
  );
  const hasUnreachable = health != null && result.actionItems.some(
    item => health[TARGET_SERVER_KEY[item.target]] === 'unreachable'
  );

  return (
    <section className="delegation-plan-section">
      <div className="container">
        <h2 className="section-title">Delegation Plan</h2>
        <p className="section-description text-muted">
          {result.actionItems.length} action item{result.actionItems.length !== 1 ? 's' : ''} extracted
        </p>

        {hasActions ? (
          <div className="delegation-grid">
            {targets.map((target) => {
              const items = grouped[target] || [];
              if (items.length === 0) return null;
              return <TargetGroup key={target} target={target} items={items} />;
            })}
          </div>
        ) : (
          <div className="card">
            <p className="text-muted text-center">No action items found in the meeting notes.</p>
          </div>
        )}

        {(hasBlockers || hasDecisions) && (
          <div className="grid grid-2 mt-lg">
            {hasBlockers && (
              <div className="card">
                <h4>Blockers</h4>
                <ul className="blockers-list">
                  {result.blockers.map((blocker, index) => (
                    <li key={index}>{blocker}</li>
                  ))}
                </ul>
              </div>
            )}

            {hasDecisions && (
              <div className="card">
                <h4>Decisions</h4>
                <ul className="decisions-list">
                  {result.decisions.map((decision, index) => (
                    <li key={index}>{decision}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="execute-plan-footer">
          {!hasAnyIntegration && (
            <p className="execute-warning">
              ⚠ Configure integrations in ⚙ Settings before executing
            </p>
          )}
          {hasUnreachable && (
            <p className="execute-warning">
              ⚠ One or more target servers are unreachable — execution may fail
            </p>
          )}
          <button
            className="button-primary execute-button"
            onClick={onExecute}
            disabled={!hasAnyIntegration || isExecuting}
          >
            {isExecuting ? (
              <><span className="spinner" /> Executing…</>
            ) : (
              'Execute Plan'
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
