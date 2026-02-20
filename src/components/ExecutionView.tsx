import type { ExecutionState, ExecutionStep, ExecutionStepStatus } from '../types';

interface ExecutionViewProps {
  state: ExecutionState;
  onBack: () => void;
  onReset: () => void;
}

const STATUS_ICONS: Record<ExecutionStepStatus, string> = {
  pending: '⬜',
  running: '⏳',
  success: '✅',
  error: '❌',
  skipped: '➖',
};

const STATUS_LABELS: Record<ExecutionStepStatus, string> = {
  pending: 'PENDING',
  running: 'RUNNING',
  success: 'DONE',
  error: 'FAILED',
  skipped: 'SKIPPED',
};

const STATUS_BADGE_CLASS: Record<ExecutionStepStatus, string> = {
  pending: 'badge',
  running: 'badge badge-warning',
  success: 'badge badge-success',
  error: 'badge badge-error',
  skipped: 'badge',
};

function StepRow({ step }: { step: ExecutionStep }) {
  return (
    <div className="execution-step">
      <span className="execution-step-icon">
        {step.status === 'running' ? (
          <span className="spinner" />
        ) : (
          STATUS_ICONS[step.status]
        )}
      </span>
      <span className="execution-step-label">{step.label}</span>
      <span className={STATUS_BADGE_CLASS[step.status]}>
        {STATUS_LABELS[step.status]}
      </span>
    </div>
  );
}

const TITLE_MAP: Record<ExecutionState['status'], string> = {
  idle: 'Executing Plan…',
  running: 'Executing Plan…',
  complete: 'Execution Complete',
  error: 'Execution Failed',
};

export function ExecutionView({ state, onBack, onReset }: ExecutionViewProps) {
  const title = TITLE_MAP[state.status];
  const isDone = state.status === 'complete' || state.status === 'error';
  const stepsWithResults = state.steps.filter(s => s.result !== undefined || s.error !== undefined);

  return (
    <section className="execution-view-section">
      <div className="container">
        <h2 className="section-title">{title}</h2>

        <div className="card execution-view">
          {state.steps.map(step => (
            <StepRow key={step.id} step={step} />
          ))}
        </div>

        {isDone && stepsWithResults.length > 0 && (
          <div className="execution-results-section mt-lg">
            <h3 className="mb-sm">Results</h3>
            {stepsWithResults.map(step => (
              <details key={step.id} className="execution-results">
                <summary>{step.label}</summary>
                {step.error ? (
                  <pre className="execution-results-pre error-text">{step.error}</pre>
                ) : (
                  <pre className="execution-results-pre">{JSON.stringify(step.result, null, 2)}</pre>
                )}
              </details>
            ))}
          </div>
        )}

        <div className="execute-plan-footer">
          <button className="button-outline" onClick={onBack}>
            Back to Plan
          </button>
          {isDone && (
            <button className="button-primary" onClick={onReset}>
              Start New Analysis
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
