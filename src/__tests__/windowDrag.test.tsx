import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWindowDrag } from '../useWindowDrag';

// ============================================================
// Helpers
// ============================================================

function mockBridge(rect: Record<string, number>) {
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

const RECT = { left: 100, top: 100, width: 520, height: 780, maximized: false };

/** Flush rAF-throttled callbacks (jsdom rAF is timer-based). */
function flushRaf() {
  return new Promise((r) => setTimeout(r, 50));
}

// ============================================================
// useWindowDrag
// ============================================================

describe('useWindowDrag', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('moves the window by the cursor delta on drag', async () => {
    const posts = mockBridge(RECT);
    const { result } = renderHook(() => useWindowDrag());

    await act(async () => {
      await result.current.startDrag({ screenX: 500, screenY: 300 });
    });

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', { screenX: 560, screenY: 340 } as MouseEventInit),
      );
    });
    await flushRaf();

    expect(posts.length).toBeGreaterThan(0);
    const last = posts[posts.length - 1];
    expect(last).toEqual({
      action: 'move_resize',
      x: 160, // 100 + (560-500)
      y: 140, // 100 + (340-300)
      width: 520,
      height: 780,
    });

    // Ending the drag stops further moves
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup'));
    });
    const countAfterUp = posts.length;
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', { screenX: 900, screenY: 900 } as MouseEventInit),
      );
    });
    await flushRaf();
    expect(posts.length).toBe(countAfterUp);
  });

  it('converts the cursor delta to physical pixels via devicePixelRatio', async () => {
    // Hi-DPI machine: screenX is in CSS px, the bridge expects physical px
    vi.stubGlobal('devicePixelRatio', 1.5);
    const posts = mockBridge(RECT);
    const { result } = renderHook(() => useWindowDrag());

    await act(async () => {
      await result.current.startDrag({ screenX: 500, screenY: 300 });
    });

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', { screenX: 560, screenY: 340 } as MouseEventInit),
      );
    });
    await flushRaf();

    expect(posts.length).toBeGreaterThan(0);
    const last = posts[posts.length - 1];
    expect(last).toEqual({
      action: 'move_resize',
      x: 190, // 100 + (560-500) * 1.5
      y: 160, // 100 + (340-300) * 1.5
      width: 520,
      height: 780,
    });
  });

  it('is a no-op when disabled', async () => {
    const posts = mockBridge(RECT);
    const { result } = renderHook(() => useWindowDrag({ disabled: true }));

    await act(async () => {
      await result.current.startDrag({ screenX: 500, screenY: 300 });
    });
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', { screenX: 560, screenY: 340 } as MouseEventInit),
      );
    });
    await flushRaf();

    expect(posts.length).toBe(0);
  });
});
