import { useState } from 'react';
import type { MeetingType } from '../types';

interface MeetingInputProps {
  onAnalyze: (notes: string, meetingType: MeetingType) => void;
  isAnalyzing: boolean;
  isConnected: boolean;
}

const MEETING_TYPES: { value: MeetingType; label: string; description: string }[] = [
  { value: 'standup', label: 'Standup', description: 'Daily sync meeting' },
  { value: 'planning', label: 'Planning', description: 'Sprint/project planning' },
  { value: 'retro', label: 'Retrospective', description: 'Team retrospective' },
  { value: 'ad_hoc', label: 'Ad Hoc', description: 'General meeting' },
];

const PLACEHOLDER_NOTES = `Paste your meeting notes here...

Example:
- John will create a ticket for the login bug (high priority)
- Sarah needs to review PR #123 for the new feature
- Team decided to use PostgreSQL for the new service
- Blocked: waiting on design mockups from design team
- Alice will send a Slack update to #engineering about the release`;

export function MeetingInput({ onAnalyze, isAnalyzing, isConnected }: MeetingInputProps) {
  const [notes, setNotes] = useState('');
  const [meetingType, setMeetingType] = useState<MeetingType>('ad_hoc');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (notes.trim() && isConnected && !isAnalyzing) {
      onAnalyze(notes, meetingType);
    }
  };

  const canSubmit = notes.trim().length > 0 && isConnected && !isAnalyzing;

  return (
    <section className="meeting-input-section">
      <div className="container">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Meeting Notes</h2>
            <p className="card-description">
              Paste your meeting notes below and we'll extract action items for Jira, GitHub, and Slack.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="meeting-type">Meeting Type</label>
              <div className="meeting-type-selector">
                {MEETING_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    className={`meeting-type-option ${meetingType === type.value ? 'active' : ''}`}
                    onClick={() => setMeetingType(type.value)}
                    title={type.description}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={PLACEHOLDER_NOTES}
                rows={12}
                disabled={isAnalyzing}
              />
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="button-primary"
                disabled={!canSubmit}
              >
                {isAnalyzing ? (
                  <>
                    <span className="spinner" />
                    Analyzing...
                  </>
                ) : (
                  'Analyze Meeting'
                )}
              </button>
              {!isConnected && (
                <span className="form-hint text-muted">
                  Connect to a venue to analyze meetings
                </span>
              )}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
