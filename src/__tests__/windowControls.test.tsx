import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWindowControls } from '../useWindowControls';

// ============================================================
// Helpers
// ============================================================

function mockFetchSequence(handlers: Record<string, (body?: string) => unknown>) {
  const calls: { url: string; body?: string }[] = [];
  const impl = vi.fn((url: string, init?: RequestInit) => {
    const body = init?.body as string | undefined;
    calls.push({ url, body });
    const key = `${init?.method ?? 'GET'} ${url}`;
    const handler = handlers[key] ?? handlers[`* ${url}`];
    const value = handler ? handler(body) : {};
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(value),
    } as Response);
  });
  vi.stubGlobal('fetch', impl);
  return calls;
}

function mockFetchFailure() {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('no backend'))),
  );
}

// ============================================================
// useWindowControls
// ============================================================

describe('useWindowControls', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('desktop-window');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.classList.remove('desktop-window');
  });

  it('detects desktop window when /api/window responds', async () => {
    mockFetchSequence({
      'GET /api/window': () => ({ width: 520, height: 780, maximized: false }),
    });
    const { result } = renderHook(() => useWindowControls());

    await waitFor(() => expect(result.current.isDesktopWindow).toBe(true));
    expect(result.current.maximized).toBe(false);
    expect(document.documentElement.classList.contains('desktop-window')).toBe(true);
  });

  it('reads initial maximized state from the backend', async () => {
    mockFetchSequence({
      'GET /api/window': () => ({ width: 520, height: 780, maximized: true }),
    });
    const { result } = renderHook(() => useWindowControls());

    await waitFor(() => expect(result.current.maximized).toBe(true));
  });

  it('degrades gracefully when the bridge is unavailable (browser)', async () => {
    mockFetchFailure();
    const { result } = renderHook(() => useWindowControls());

    await waitFor(() => expect(result.current.isDesktopWindow).toBe(false));
    expect(document.documentElement.classList.contains('desktop-window')).toBe(false);
  });

  it('posts minimize / close with correct payloads', async () => {
    const calls = mockFetchSequence({
      'GET /api/window': () => ({ maximized: false }),
      'POST /api/window': () => ({ ok: true }),
    });
    const { result } = renderHook(() => useWindowControls());
    await waitFor(() => expect(result.current.isDesktopWindow).toBe(true));

    act(() => result.current.minimize());
    act(() => result.current.close());

    await waitFor(() => {
      const bodies = calls
        .filter((c) => c.url === '/api/window' && c.body)
        .map((c) => JSON.parse(c.body!));
      expect(bodies).toContainEqual({ action: 'minimize' });
      expect(bodies).toContainEqual({ action: 'close' });
    });
  });

  it('toggleMaximize posts action and syncs maximized from response', async () => {
    mockFetchSequence({
      'GET /api/window': () => ({ maximized: false }),
      'POST /api/window': (body) => {
        const parsed = JSON.parse(body!);
        if (parsed.action === 'toggle_maximize') {
          return { ok: true, maximized: true };
        }
        return { ok: true };
      },
    });
    const { result } = renderHook(() => useWindowControls());
    await waitFor(() => expect(result.current.isDesktopWindow).toBe(true));
    expect(result.current.maximized).toBe(false);

    await act(async () => {
      result.current.toggleMaximize();
      // allow the promise chain to settle
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.maximized).toBe(true));
  });
});
