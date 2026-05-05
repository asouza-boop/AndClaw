import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDigestEvents } from './useDigestEvents';
import { useQueryClient } from '@tanstack/react-query';

// Mock useQueryClient
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: vi.fn(),
}));

// Mock @/lib/api
vi.mock('@/lib/api', () => ({
  apiUrl: vi.fn((path: string) => `http://localhost:3000${path}`),
  getToken: vi.fn(() => 'test-token'),
}));

// Mock EventSource
const MockEventSource = vi.fn().mockImplementation(function (this: any, url: string, options: any) {
  this.url = url;
  this.options = options;
  this.close = vi.fn();
  this.onmessage = null;
  this.onerror = null;
});

describe('useDigestEvents', () => {
  let mockInvalidateQueries: any;

  beforeEach(() => {
    mockInvalidateQueries = vi.fn();
    (useQueryClient as any).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    });
    vi.stubGlobal('EventSource', MockEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('opens EventSource on mount with correct URL and token', () => {
    renderHook(() => useDigestEvents());
    expect(MockEventSource).toHaveBeenCalledWith(
      'http://localhost:3000/api/events/digest?token=test-token',
      { withCredentials: true }
    );
  });

  it('closes EventSource on unmount', () => {
    const { unmount } = renderHook(() => useDigestEvents());
    const instance = MockEventSource.mock.instances[0];
    unmount();
    expect(instance.close).toHaveBeenCalled();
  });

  it('invalidates queries and calls onDigested on memory.digested message', () => {
    const onDigested = vi.fn();
    renderHook(() => useDigestEvents(onDigested));
    const instance = MockEventSource.mock.instances[0];

    // Simulate message
    const event = {
      data: JSON.stringify({ type: 'memory.digested', timestamp: '2026-01-01' }),
    };
    
    if (instance.onmessage) {
      instance.onmessage(event as MessageEvent);
    }

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['memory'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['links'] });
    expect(onDigested).toHaveBeenCalledWith(expect.objectContaining({ type: 'memory.digested' }));
  });

  it('fails silently on EventSource error', () => {
    renderHook(() => useDigestEvents());
    const instance = MockEventSource.mock.instances[0];

    if (instance.onerror) {
      expect(() => instance.onerror!(new Event('error'))).not.toThrow();
    }
    expect(instance.close).toHaveBeenCalled();
  });
});
