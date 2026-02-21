import { useState, useEffect, useCallback, useRef } from 'react';
import type { PMSettings, HealthMap } from '../types';
import { INTEGRATIONS } from '../config/integrations';
import { pingServer } from '../lib/serverPing';

export interface UseHealthChecksResult {
  health: HealthMap;
  recheck: () => void;
}

export function useHealthChecks(
  settings: PMSettings,
  isConnected: boolean
): UseHealthChecksResult {
  const [health, setHealth] = useState<HealthMap>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Runs all configured integration pings in parallel.
  // runChecks identity changes only when settings changes (via useCallback deps),
  // which is exactly when we want to re-trigger effects.
  const runChecks = useCallback(async () => {
    const targets = INTEGRATIONS
      .filter(i => !i.hidden && !!(settings[i.serverKey] as string))
      .map(i => ({ serverKey: i.serverKey, url: settings[i.serverKey] as string }));

    if (targets.length === 0) {
      setHealth({});
      return;
    }

    // Mark all targets as 'checking' in one synchronous update
    setHealth(prev => {
      const next = { ...prev };
      for (const { serverKey } of targets) {
        next[serverKey] = 'checking';
      }
      return next;
    });

    // Fire all pings in parallel; update state as each one settles
    await Promise.allSettled(
      targets.map(async ({ serverKey, url }) => {
        const reachable = await pingServer(url);
        setHealth(prev => ({ ...prev, [serverKey]: reachable ? 'ok' : 'unreachable' }));
      })
    );
  }, [settings]);

  // Effect 1: fire runChecks when isConnected transitions to true; reset on disconnect.
  // Both branches use setTimeout so setHealth is never called synchronously in the
  // effect body (react-hooks/set-state-in-effect requires async setState).
  useEffect(() => {
    if (!isConnected) {
      const id = setTimeout(() => setHealth({}), 0);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => { void runChecks(); }, 0);
    return () => clearTimeout(id);
  }, [isConnected, runChecks]);

  // Effect 2: debounced re-check when settings change while connected.
  // useSettings returns a new object reference on every saveSettings() call,
  // so this fires precisely when the user saves — not on every keystroke.
  useEffect(() => {
    if (!isConnected) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void runChecks(); }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [settings, isConnected, runChecks]);

  const recheck = useCallback(() => {
    if (isConnected) void runChecks();
  }, [isConnected, runChecks]);

  return { health, recheck };
}
