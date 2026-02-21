import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pingServer } from './serverPing';

describe('pingServer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('returns true when fetch resolves successfully', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(null, { status: 200 }));
    const result = await pingServer('http://example.com');
    expect(result).toBe(true);
  });

  it('returns true even for a 405 response (POST-only MCP server)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(null, { status: 405 }));
    const result = await pingServer('http://mcp-server.example.com');
    expect(result).toBe(true);
  });

  it('returns false when fetch throws TypeError (network failure)', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const result = await pingServer('http://unreachable.example.com');
    expect(result).toBe(false);
  });

  it('returns false when request times out (AbortController fires)', async () => {
    vi.spyOn(global, 'fetch').mockImplementationOnce((_url, opts) => {
      return new Promise((_resolve, reject) => {
        opts?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted', 'AbortError'));
        });
      });
    });

    const resultPromise = pingServer('http://slow-server.example.com', 100);
    // Advance time past the timeout
    vi.advanceTimersByTime(100);
    const result = await resultPromise;
    expect(result).toBe(false);
  });

  it('clears the timeout after early fetch resolution', async () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(null, { status: 200 }));
    await pingServer('http://example.com');
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('uses the custom timeout value', async () => {
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response());
    await pingServer('http://example.com', 3000);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 3000);
  });

  it('never throws — always resolves with a boolean', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('unexpected error'));
    await expect(pingServer('http://example.com')).resolves.toBe(false);
  });
});
