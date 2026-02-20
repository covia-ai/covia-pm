import { useState, useCallback } from 'react';
import type { PMSettings } from '../types';

const STORAGE_KEY = 'covia-pm-settings';

const DEFAULT_SETTINGS: PMSettings = {
  jiraServer: '',
  jiraProjectKey: '',
  jiraToken: '',
  githubServer: '',
  githubRepo: '',
  githubToken: '',
  slackServer: '',
  slackChannel: '',
  slackToken: '',
};

function loadSettings(): PMSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export interface UseSettingsResult {
  settings: PMSettings;
  saveSettings: (s: PMSettings) => void;
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<PMSettings>(loadSettings);

  const saveSettings = useCallback((s: PMSettings) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    setSettings(s);
  }, []);

  return { settings, saveSettings };
}
