import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MeetingInput } from './MeetingInput';

const defaultProps = {
  onAnalyze: vi.fn(),
  isAnalyzing: false,
  isConnected: true,
};

describe('MeetingInput', () => {
  it('renders the textarea and Analyze button', () => {
    render(<MeetingInput {...defaultProps} />);
    expect(screen.getByRole('textbox', { name: /notes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyze meeting/i })).toBeInTheDocument();
  });

  it('Analyze button is disabled when not connected', () => {
    render(<MeetingInput {...defaultProps} isConnected={false} />);
    expect(screen.getByRole('button', { name: /analyze meeting/i })).toBeDisabled();
  });

  it('Analyze button is disabled when textarea is empty (even if connected)', async () => {
    render(<MeetingInput {...defaultProps} />);
    // Button disabled by default with empty textarea
    expect(screen.getByRole('button', { name: /analyze meeting/i })).toBeDisabled();
  });

  it('Analyze button is disabled while isAnalyzing=true', async () => {
    render(<MeetingInput {...defaultProps} isAnalyzing />);
    expect(screen.getByRole('button', { name: /analyzing/i })).toBeDisabled();
  });

  it('calls onAnalyze with notes and meetingType on submit', async () => {
    const user = userEvent.setup();
    const onAnalyze = vi.fn();
    render(<MeetingInput {...defaultProps} onAnalyze={onAnalyze} />);

    await user.type(screen.getByRole('textbox', { name: /notes/i }), 'Fix the bug');
    await user.click(screen.getByRole('button', { name: /analyze meeting/i }));

    expect(onAnalyze).toHaveBeenCalledWith('Fix the bug', 'ad_hoc');
  });

  it('shows "Connect to a venue" hint when disconnected', () => {
    render(<MeetingInput {...defaultProps} isConnected={false} />);
    expect(screen.getByText(/connect to a venue/i)).toBeInTheDocument();
  });

  it('does NOT show the connect hint when connected', () => {
    render(<MeetingInput {...defaultProps} />);
    expect(screen.queryByText(/connect to a venue/i)).not.toBeInTheDocument();
  });

  it('renders 4 meeting type buttons', () => {
    render(<MeetingInput {...defaultProps} />);
    expect(screen.getByRole('button', { name: /standup/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /planning/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retrospective/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ad hoc/i })).toBeInTheDocument();
  });

  it('selecting a meeting type makes it active and calls onAnalyze with that type', async () => {
    const user = userEvent.setup();
    const onAnalyze = vi.fn();
    render(<MeetingInput {...defaultProps} onAnalyze={onAnalyze} />);

    await user.click(screen.getByRole('button', { name: /planning/i }));
    await user.type(screen.getByRole('textbox', { name: /notes/i }), 'Sprint planning notes');
    await user.click(screen.getByRole('button', { name: /analyze meeting/i }));

    expect(onAnalyze).toHaveBeenCalledWith('Sprint planning notes', 'planning');
  });

  it('does not show transcript fetch row when no availableSources', () => {
    render(<MeetingInput {...defaultProps} availableSources={[]} />);
    expect(screen.queryByLabelText(/transcript source/i)).not.toBeInTheDocument();
  });

  it('does not show transcript fetch row when onFetchTranscript not provided', () => {
    render(<MeetingInput {...defaultProps} availableSources={['granola']} />);
    expect(screen.queryByLabelText(/transcript source/i)).not.toBeInTheDocument();
  });

  it('shows transcript fetch row when sources and handler both provided', () => {
    render(
      <MeetingInput
        {...defaultProps}
        availableSources={['granola', 'fathom']}
        onFetchTranscript={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/transcript source/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/meeting id or url/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fetch/i })).toBeInTheDocument();
  });

  it('Fetch button is disabled when callRef is empty', () => {
    render(
      <MeetingInput
        {...defaultProps}
        availableSources={['granola']}
        onFetchTranscript={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /^fetch$/i })).toBeDisabled();
  });

  it('Fetch success populates the textarea with the returned transcript', async () => {
    const user = userEvent.setup();
    const onFetchTranscript = vi.fn().mockResolvedValue('Transcript text here');

    render(
      <MeetingInput
        {...defaultProps}
        availableSources={['granola']}
        onFetchTranscript={onFetchTranscript}
      />
    );

    await user.type(screen.getByLabelText(/meeting id or url/i), 'call-123');
    await user.click(screen.getByRole('button', { name: /^fetch$/i }));

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /notes/i })).toHaveValue('Transcript text here');
    });
    expect(screen.getByText(/transcript loaded/i)).toBeInTheDocument();
  });

  it('Fetch error shows an error message', async () => {
    const user = userEvent.setup();
    const onFetchTranscript = vi.fn().mockRejectedValue(new Error('Network error'));

    render(
      <MeetingInput
        {...defaultProps}
        availableSources={['granola']}
        onFetchTranscript={onFetchTranscript}
      />
    );

    await user.type(screen.getByLabelText(/meeting id or url/i), 'bad-ref');
    await user.click(screen.getByRole('button', { name: /^fetch$/i }));

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });
});
