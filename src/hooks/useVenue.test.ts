import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVenue } from './useVenue';

// vi.hoisted runs before vi.mock factories (so mocks can reference these vars)
const { mockConnect, mockDisconnect } = vi.hoisted(() => ({
  mockConnect: vi.fn(),
  mockDisconnect: vi.fn(),
}));

// Use a regular function (not arrow) so `new PMVenueClient()` works
vi.mock('../lib/venue', () => ({
  PMVenueClient: vi.fn(function () {
    return { connect: mockConnect, disconnect: mockDisconnect };
  }),
}));

describe('useVenue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with disconnected status, null error and null venueId', () => {
    const { result } = renderHook(() => useVenue());
    expect(result.current.status).toBe('disconnected');
    expect(result.current.error).toBeNull();
    expect(result.current.venueId).toBeNull();
  });

  it('sets status to "connecting" synchronously when connect() is called', async () => {
    let resolveFn!: (v: { venueId: string }) => void;
    mockConnect.mockImplementationOnce(
      () => new Promise(resolve => { resolveFn = resolve; })
    );

    const { result } = renderHook(() => useVenue());
    act(() => { void result.current.connect('http://venue.test'); });
    expect(result.current.status).toBe('connecting');

    // Settle the promise to clean up
    await act(async () => { resolveFn({ venueId: 'v1' }); });
  });

  it('transitions to "connected" and sets venueId on success', async () => {
    mockConnect.mockResolvedValueOnce({ venueId: 'venue-abc' });

    const { result } = renderHook(() => useVenue());
    await act(async () => { await result.current.connect('http://venue.test'); });

    expect(result.current.status).toBe('connected');
    expect(result.current.venueId).toBe('venue-abc');
    expect(result.current.error).toBeNull();
  });

  it('transitions to "error" and stores error when connect() rejects with an Error', async () => {
    mockConnect.mockRejectedValueOnce(new Error('Connection refused'));

    const { result } = renderHook(() => useVenue());
    await act(async () => {
      await result.current.connect('http://bad.test').catch(() => {});
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error?.message).toBe('Connection refused');
  });

  it('wraps non-Error rejections in a new Error', async () => {
    mockConnect.mockRejectedValueOnce('plain string error');

    const { result } = renderHook(() => useVenue());
    await act(async () => {
      await result.current.connect('http://bad.test').catch(() => {});
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('plain string error');
  });

  it('resets status/venueId/error and calls client.disconnect() on disconnect()', async () => {
    mockConnect.mockResolvedValueOnce({ venueId: 'v1' });

    const { result } = renderHook(() => useVenue());
    await act(async () => { await result.current.connect('http://venue.test'); });
    expect(result.current.status).toBe('connected');

    act(() => { result.current.disconnect(); });

    expect(result.current.status).toBe('disconnected');
    expect(result.current.venueId).toBeNull();
    expect(result.current.error).toBeNull();
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('clears a previous error when connect() is called again', async () => {
    mockConnect.mockRejectedValueOnce(new Error('first error'));
    mockConnect.mockResolvedValueOnce({ venueId: 'v2' });

    const { result } = renderHook(() => useVenue());
    await act(async () => {
      await result.current.connect('http://bad.test').catch(() => {});
    });
    expect(result.current.error).not.toBeNull();

    await act(async () => { await result.current.connect('http://good.test'); });
    expect(result.current.error).toBeNull();
    expect(result.current.status).toBe('connected');
  });

  it('uses the same client instance across renders (useMemo stability)', () => {
    const { result, rerender } = renderHook(() => useVenue());
    const firstClient = result.current.client;
    rerender();
    expect(result.current.client).toBe(firstClient);
  });
});
