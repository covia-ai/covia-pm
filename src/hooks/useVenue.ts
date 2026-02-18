import { useState, useCallback, useMemo } from 'react';
import { PMVenueClient } from '../lib/venue';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface UseVenueResult {
  client: PMVenueClient;
  status: ConnectionStatus;
  error: Error | null;
  venueId: string | null;
  connect: (url: string) => Promise<void>;
  disconnect: () => void;
}

export function useVenue(): UseVenueResult {
  const client = useMemo(() => new PMVenueClient(), []);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<Error | null>(null);
  const [venueId, setVenueId] = useState<string | null>(null);

  const connect = useCallback(async (url: string) => {
    setStatus('connecting');
    setError(null);

    try {
      const venue = await client.connect(url);
      setVenueId(venue.venueId);
      setStatus('connected');
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setStatus('error');
    }
  }, [client]);

  const disconnect = useCallback(() => {
    client.disconnect();
    setStatus('disconnected');
    setVenueId(null);
    setError(null);
  }, [client]);

  return { client, status, error, venueId, connect, disconnect };
}
