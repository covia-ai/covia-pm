import { useState, useCallback } from 'react';
import type { PMSettings } from '../types';

const STORAGE_KEY = 'covia-pm-settings';

const DEFAULT_SETTINGS: PMSettings = {
  // Existing
  jiraServer: '',
  jiraProjectKey: '',
  jiraToken: '',
  githubServer: '',
  githubRepo: '',
  githubToken: '',
  slackServer: '',
  slackChannel: '',
  slackToken: '',
  // Issue Trackers
  linearServer: '',
  linearTeamKey: '',
  linearToken: '',
  azureServer: '',
  azureOrg: '',
  azureProject: '',
  azureToken: '',
  // Version Control
  gitlabServer: '',
  gitlabRepo: '',
  gitlabToken: '',
  // Communication
  teamsServer: '',
  teamsChannel: '',
  teamsToken: '',
  emailServer: '',
  emailTo: '',
  emailToken: '',
  // Incident
  pagerdutyServer: '',
  pagerdutyServiceId: '',
  pagerdutyToken: '',
  // Observability
  sentryServer: '',
  sentryProject: '',
  sentryToken: '',
  // Documentation
  confluenceServer: '',
  confluenceSpaceKey: '',
  confluenceToken: '',
  // Calendar
  calendarServer: '',
  calendarId: '',
  calendarToken: '',
  // Wave 2 — Issue Trackers
  asanaServer: '', asanaProjectId: '', asanaToken: '',
  shortcutServer: '', shortcutTeamId: '', shortcutToken: '',
  // Wave 2 — VCS
  bitbucketServer: '', bitbucketRepo: '', bitbucketToken: '',
  azureReposServer: '', azureReposProject: '', azureReposToken: '',
  // Wave 2 — CI/CD
  githubActionsServer: '', githubActionsRepo: '', githubActionsToken: '',
  gitlabCIServer: '', gitlabCIRepo: '', gitlabCIToken: '',
  jenkinsServer: '', jenkinsJob: '', jenkinsToken: '',
  circleciServer: '', circleciProject: '', circleciToken: '',
  // Wave 2 — Observability
  datadogServer: '', datadogDashboard: '', datadogToken: '',
  grafanaServer: '', grafanaDashboard: '', grafanaToken: '',
  // Wave 2 — Security
  snykServer: '', snykProject: '', snykToken: '',
  sonarServer: '', sonarProject: '', sonarToken: '',
  ghsecServer: '', ghsecRepo: '', ghsecToken: '',
  // Wave 2 — Communication
  googleChatServer: '', googleChatSpace: '', googleChatToken: '',
  discordServer: '', discordChannel: '', discordToken: '',
  // Wave 2 — Scheduling
  outlookServer: '', outlookCalendar: '', outlookToken: '',
  // Meeting Intelligence
  granolaServer: '',
  granolaToken: '',
  fathomServer: '',
  fathomToken: '',
  firefliesServer: '',
  firefliesToken: '',
  otterServer: '',
  otterToken: '',
  tldvServer: '',
  tldvToken: '',
  avomaServer: '',
  avomaToken: '',
  readServer: '',
  readToken: '',
  zoomServer: '',
  zoomToken: '',
  teamsMeetingServer: '',
  teamsMeetingToken: '',
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
