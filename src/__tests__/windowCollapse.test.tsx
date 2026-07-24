import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWindowCollapse } from '../useWindowCollapse';

// ============================================================
// Helpers
// ============================================================

function mockBridge(rect: Record<string, number | boolean>) {
  const posts: Record<string, unknown>[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts.push(JSON.parse(init.body as string));
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(rect),
      } as Response);
    }),
  );
  return posts;
}

const RECT = {
  left: 100,
  top: 100,
  width: 780,
  height: 1440,
  maximized: false,
  minWidth: 540,
  minHeight: 720,
};

// ============================================================
// useWindowCollapse
// ============================================================

describe('useWindowCollapse', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shrinks the window to the title bar height (physical px) on collapse', async () => {
    // Hi-DPI machine: bridge works in physical px, title bar is 36 CSS px
    vi.stubGlobal('devicePixelRatio', 1.5);
    const posts = mockBridge(RECT);
    const { result } = renderHook(() => useWindowCollapse());

    await act(async () => {
      await result.current.collapse();
    });

    expect(result.current.collapsed).toBe(true);
    expect(posts.length).toBe(1);
    expect(posts[0]).toEqual({
      action: 'move_resize',
      x: 100,
      y: 100,
      width: 780,
      height: 54, // 36 * 1.5
    });
  });

  it('restores the saved height on expand', async () => {
    const posts = mockBridge(RECT);
    const { result } = renderHook(() => useWindowCollapse());

    await act(async () => {
      await result.current.collapse();
    });
    await act(async () => {
      await result.current.expand();
    });

    expect(result.current.collapsed).toBe(false);
    expect(posts.length).toBe(2);
    expect(posts[1]).toEqual({
      action: 'move_resize',
      x: 100,
      y: 100,
      width: 780,
      height: 1440,
    });
  });

  it('toggles between collapse and expand', async () => {
    const posts = mockBridge(RECT);
    const { result } = renderHook(() => useWindowCollapse());

    await act(async () => {
      await result.current.toggleCollapse();
    });
    expect(result.current.collapsed).toBe(true);

    await act(async () => {
      await result.current.toggleCollapse();
    });
    expect(result.current.collapsed).toBe(false);
    expect(posts.length).toBe(2);
  });

  it('is a no-op when disabled', async () => {
    const posts = mockBridge(RECT);
    const { result } = renderHook(() => useWindowCollapse({ disabled: true }));

    await act(async () => {
      await result.current.collapse();
    });

    expect(result.current.collapsed).toBe(false);
    expect(posts.length).toBe(0);
  });
});
