import type { AnalysisResult, ActionItem, ActionTarget, Priority } from '../types';

interface DelegationPlanProps {
  result: AnalysisResult | null;
  error: Error | null;
}

const TARGET_CONFIG: Record<ActionTarget, { label: string; icon: string; color: string }> = {
  jira: { label: 'Jira', icon: 'J', color: 'var(--color-secondary)' },
  github: { label: 'GitHub', icon: 'G', color: 'var(--color-foreground)' },
  slack: { label: 'Slack', icon: 'S', color: 'var(--color-accent)' },
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

export function DelegationPlan({ result, error }: DelegationPlanProps) {
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
  const targets: ActionTarget[] = ['jira', 'github', 'slack'];
  const hasActions = result.actionItems.length > 0;
  const hasBlockers = result.blockers.length > 0;
  const hasDecisions = result.decisions.length > 0;

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
      </div>
    </section>
  );
}
