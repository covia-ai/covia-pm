import { useState } from 'react';
import type { MeetingType, TranscriptSource } from '../types';

interface MeetingInputProps {
  onAnalyze: (notes: string, meetingType: MeetingType) => void;
  isAnalyzing: boolean;
  isConnected: boolean;
  onFetchTranscript?: (source: TranscriptSource, callRef: string) => Promise<string>;
  availableSources?: TranscriptSource[];
}

const MEETING_TYPES: { value: MeetingType; label: string; description: string }[] = [
  { value: 'standup', label: 'Standup', description: 'Daily sync meeting' },
  { value: 'planning', label: 'Planning', description: 'Sprint/project planning' },
  { value: 'retro', label: 'Retrospective', description: 'Team retrospective' },
  { value: 'ad_hoc', label: 'Ad Hoc', description: 'General meeting' },
];

const SOURCE_LABELS: Record<TranscriptSource, string> = {
  granola: 'Granola',
  fathom: 'Fathom',
  fireflies: 'Fireflies.ai',
  otter: 'Otter.ai',
  tldv: 'tl;dv',
  avoma: 'Avoma',
  read: 'Read.ai',
  zoom: 'Zoom AI',
  'teams-meeting': 'Teams Meeting',
};

const PLACEHOLDER_NOTES = `Paste your meeting notes here...

Example:
- John will create a ticket for the login bug (high priority)
- Sarah needs to review PR #123 for the new feature
- Team decided to use PostgreSQL for the new service
- Blocked: waiting on design mockups from design team
- Alice will send a Slack update to #engineering about the release`;

type FetchStatus = 'idle' | 'fetching' | 'ok' | 'error';

export function MeetingInput({
  onAnalyze,
  isAnalyzing,
  isConnected,
  onFetchTranscript,
  availableSources = [],
}: MeetingInputProps) {
  const [notes, setNotes] = useState('');
  const [meetingType, setMeetingType] = useState<MeetingType>('ad_hoc');
  const [fetchSource, setFetchSource] = useState<TranscriptSource>(availableSources[0] ?? 'granola');
  const [callRef, setCallRef] = useState('');
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('idle');
  const [fetchError, setFetchError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (notes.trim() && isConnected && !isAnalyzing) {
      onAnalyze(notes, meetingType);
    }
  };

  const handleFetch = async () => {
    if (!onFetchTranscript || !callRef.trim()) return;
    setFetchStatus('fetching');
    setFetchError('');
    try {
      const transcript = await onFetchTranscript(fetchSource, callRef.trim());
      setNotes(transcript);
      setFetchStatus('ok');
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : String(e));
      setFetchStatus('error');
    }
  };

  const canSubmit = notes.trim().length > 0 && isConnected && !isAnalyzing;
  const hasSources = availableSources.length > 0 && !!onFetchTranscript;

  return (
    <section className="meeting-input-section">
      <div className="container">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Meeting Notes</h2>
            <p className="card-description">
              Paste your meeting notes below and we&rsquo;ll extract action items and delegate them to your configured integrations.
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

            {hasSources && (
              <div className="transcript-fetch">
                <select
                  value={fetchSource}
                  onChange={e => setFetchSource(e.target.value as TranscriptSource)}
                  aria-label="Transcript source"
                >
                  {availableSources.map(s => (
                    <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={callRef}
                  onChange={e => setCallRef(e.target.value)}
                  placeholder="Meeting ID or URL"
                  aria-label="Meeting ID or URL"
                />
                <button
                  type="button"
                  className="button-outline"
                  onClick={handleFetch}
                  disabled={!callRef.trim() || fetchStatus === 'fetching'}
                >
                  {fetchStatus === 'fetching' ? (
                    <><span className="spinner" /> Fetching…</>
                  ) : (
                    'Fetch'
                  )}
                </button>
              </div>
            )}

            {fetchStatus === 'ok' && (
              <p className="transcript-status transcript-status-ok">Transcript loaded</p>
            )}
            {fetchStatus === 'error' && (
              <p className="transcript-status transcript-status-error">{fetchError || 'Failed to fetch transcript'}</p>
            )}

            <div className="form-group">
              <label htmlFor="notes">
                {hasSources ? 'Notes (or paste manually)' : 'Notes'}
              </label>
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
