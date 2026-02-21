import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSettings } from './useSettings';

const STORAGE_KEY = 'covia-pm-settings';

describe('useSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns all-empty-string settings when localStorage is empty', () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.settings.jiraServer).toBe('');
    expect(result.current.settings.githubServer).toBe('');
    expect(result.current.settings.granolaServer).toBe('');
  });

  it('persists settings to localStorage when saveSettings is called', () => {
    const { result } = renderHook(() => useSettings());
    act(() => {
      result.current.saveSettings({ ...result.current.settings, jiraServer: 'http://jira.test' });
    });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.jiraServer).toBe('http://jira.test');
  });

  it('updates in-memory settings when saveSettings is called', () => {
    const { result } = renderHook(() => useSettings());
    act(() => {
      result.current.saveSettings({ ...result.current.settings, githubServer: 'http://github.test' });
    });
    expect(result.current.settings.githubServer).toBe('http://github.test');
  });

  it('rehydrates from localStorage on mount', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ jiraServer: 'http://stored-jira.test' }));
    const { result } = renderHook(() => useSettings());
    expect(result.current.settings.jiraServer).toBe('http://stored-jira.test');
  });

  it('merges partial stored object with defaults (missing keys get empty string)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ jiraServer: 'http://jira.test' }));
    const { result } = renderHook(() => useSettings());
    expect(result.current.settings.jiraServer).toBe('http://jira.test');
    expect(result.current.settings.githubServer).toBe('');
    expect(result.current.settings.granolaServer).toBe('');
  });

  it('falls back to defaults when localStorage contains malformed JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not-valid-json{{{');
    const { result } = renderHook(() => useSettings());
    expect(result.current.settings.jiraServer).toBe('');
  });

  it('saveSettings has stable identity across re-renders', () => {
    const { result, rerender } = renderHook(() => useSettings());
    const firstRef = result.current.saveSettings;
    rerender();
    expect(result.current.saveSettings).toBe(firstRef);
  });
});
