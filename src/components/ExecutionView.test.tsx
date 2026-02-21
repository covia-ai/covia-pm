import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExecutionView } from './ExecutionView';
import type { ExecutionState, ExecutionStep } from '../types';

function makeStep(overrides: Partial<ExecutionStep> = {}): ExecutionStep {
  return {
    id: 'jira',
    label: 'Creating Jira Issues',
    icon: 'J',
    status: 'pending',
    ...overrides,
  };
}

function makeState(overrides: Partial<ExecutionState> = {}): ExecutionState {
  return {
    status: 'running',
    steps: [],
    ...overrides,
  };
}

describe('ExecutionView', () => {
  it('renders all steps from state.steps', () => {
    const state = makeState({
      steps: [
        makeStep({ id: 'jira',   label: 'Creating Jira Issues' }),
        makeStep({ id: 'github', label: 'Executing GitHub Actions' }),
      ],
    });
    render(<ExecutionView state={state} onBack={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getByText('Creating Jira Issues')).toBeInTheDocument();
    expect(screen.getByText('Executing GitHub Actions')).toBeInTheDocument();
  });

  it('shows spinner element for a step with status "running"', () => {
    const state = makeState({ steps: [makeStep({ status: 'running' })] });
    const { container } = render(<ExecutionView state={state} onBack={vi.fn()} onReset={vi.fn()} />);
    expect(container.querySelector('.spinner')).toBeInTheDocument();
  });

  it('shows PENDING badge for pending status', () => {
    const state = makeState({ steps: [makeStep({ status: 'pending' })] });
    render(<ExecutionView state={state} onBack={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getByText('PENDING')).toBeInTheDocument();
  });

  it('shows DONE badge for success status', () => {
    const state = makeState({ steps: [makeStep({ status: 'success' })] });
    render(<ExecutionView state={state} onBack={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getByText('DONE')).toBeInTheDocument();
  });

  it('shows FAILED badge for error status', () => {
    const state = makeState({ steps: [makeStep({ status: 'error' })] });
    render(<ExecutionView state={state} onBack={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getByText('FAILED')).toBeInTheDocument();
  });

  it('shows SKIPPED badge for skipped status', () => {
    const state = makeState({ steps: [makeStep({ status: 'skipped' })] });
    render(<ExecutionView state={state} onBack={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getByText('SKIPPED')).toBeInTheDocument();
  });

  it('hides results section when no step has a result or error', () => {
    const state = makeState({
      status: 'complete',
      steps: [makeStep({ status: 'success' })],
    });
    render(<ExecutionView state={state} onBack={vi.fn()} onReset={vi.fn()} />);
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(screen.queryByText('Results')).not.toBeInTheDocument();
  });

  it('shows results section with <details> when a step has a result', () => {
    const state = makeState({
      status: 'complete',
      steps: [makeStep({ status: 'success', result: { created: 1 }, label: 'Jira Step' })],
    });
    render(<ExecutionView state={state} onBack={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getByText('Results')).toBeInTheDocument();
    // Label appears in both the step row AND the <summary> element
    const labels = screen.getAllByText('Jira Step');
    expect(labels.length).toBeGreaterThanOrEqual(2);
  });

  it('shows error text in results for a failed step', () => {
    const state = makeState({
      status: 'error',
      steps: [makeStep({ status: 'error', error: 'API timeout', label: 'Creating Jira Issues' })],
    });
    render(<ExecutionView state={state} onBack={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getByText('API timeout')).toBeInTheDocument();
  });

  it('calls onBack when "Back to Plan" button is clicked', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const state = makeState({ status: 'running', steps: [] });
    render(<ExecutionView state={state} onBack={onBack} onReset={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /back to plan/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('does NOT show "Start New Analysis" while still running', () => {
    const state = makeState({ status: 'running', steps: [] });
    render(<ExecutionView state={state} onBack={vi.fn()} onReset={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /start new analysis/i })).not.toBeInTheDocument();
  });

  it('shows "Start New Analysis" and calls onReset when execution is complete', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    const state = makeState({ status: 'complete', steps: [] });
    render(<ExecutionView state={state} onBack={vi.fn()} onReset={onReset} />);
    const btn = screen.getByRole('button', { name: /start new analysis/i });
    await user.click(btn);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('shows "Start New Analysis" when execution has error status', () => {
    const state = makeState({ status: 'error', steps: [] });
    render(<ExecutionView state={state} onBack={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getByRole('button', { name: /start new analysis/i })).toBeInTheDocument();
  });

  it('renders correct title per execution status', () => {
    const { rerender } = render(
      <ExecutionView state={makeState({ status: 'running' })} onBack={vi.fn()} onReset={vi.fn()} />
    );
    expect(screen.getByText('Executing Plan…')).toBeInTheDocument();

    rerender(
      <ExecutionView state={makeState({ status: 'complete' })} onBack={vi.fn()} onReset={vi.fn()} />
    );
    expect(screen.getByText('Execution Complete')).toBeInTheDocument();

    rerender(
      <ExecutionView state={makeState({ status: 'error' })} onBack={vi.fn()} onReset={vi.fn()} />
    );
    expect(screen.getByText('Execution Failed')).toBeInTheDocument();
  });
});
