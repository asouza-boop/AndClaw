import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useApiHealth } from './useApiHealth';

// Mock @/lib/api
vi.mock('@/lib/api', () => ({
  apiUrl: vi.fn((path: string) => `http://localhost:3000${path}`),
}));

describe('useApiHealth', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('returns isOnline: true when /api/health responds 200', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    
    const { result } = renderHook(() => useApiHealth());
    
    // Initial state
    expect(result.current.isChecking).toBe(true);
    
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.isOnline).toBe(true);
    expect(result.current.isChecking).toBe(false);
  });

  it('returns isOnline: false when request fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    
    const { result } = renderHook(() => useApiHealth());
    
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.isOnline).toBe(false);
    expect(result.current.isChecking).toBe(false);
  });

  it('returns isOnline: false when request times out', async () => {
    // Simulate a fetch that never resolves within 5s
    mockFetch.mockImplementationOnce((_url, options) => new Promise((resolve, reject) => {
      const timeout = setTimeout(() => resolve({ ok: true }), 10000);
      options?.signal?.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new Error('Aborted'));
      });
    }));
    
    const { result } = renderHook(() => useApiHealth());
    
    await act(async () => {
      // Advance by 5s to trigger timeout
      vi.advanceTimersByTime(5000);
    });

    // isOnline should be false because of timeout
    expect(result.current.isOnline).toBe(false);
    expect(result.current.isChecking).toBe(false);
  });

  it('retry() re-triggers the health check', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false }) // First check fails
      .mockResolvedValueOnce({ ok: true }); // Second check (retry) succeeds
    
    const { result } = renderHook(() => useApiHealth());
    
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    
    expect(result.current.isOnline).toBe(false);

    await act(async () => {
      result.current.retry();
      await vi.runAllTimersAsync();
    });

    expect(result.current.isOnline).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
