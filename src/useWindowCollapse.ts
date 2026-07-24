import { useCallback, useRef, useState } from 'react';

/**
 * Collapse/expand the desktop window to a title-bar-only strip.
 *
 * Collapsing shrinks the OS window to the title bar height (36 CSS px,
 * converted to physical px via devicePixelRatio — the /api/window bridge
 * works in physical pixels); expanding restores the height saved at
 * collapse time.  Position and width are preserved by re-reading the
 * live rect from the backend on each toggle.
 *
 * The launcher's OS-level min size (240×32 logical) sits below the
 * strip height at any DPI, so the OS never clamps the collapsed height.
 */

// --titlebar-h in index.css
const TITLEBAR_CSS_HEIGHT = 36;

interface WindowRectResponse {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
}

interface UseWindowCollapseOptions {
  /** When true (browser mode / maximized), collapse is a no-op. */
  disabled?: boolean;
}

export function useWindowCollapse(options?: UseWindowCollapseOptions) {
  const [collapsed, setCollapsed] = useState(false);
  const savedHeightRef = useRef<number | null>(null);
  const disabledRef = useRef(options?.disabled ?? false);
  disabledRef.current = options?.disabled ?? false;

  const fetchRect = useCallback((): Promise<WindowRectResponse | null> => {
    return fetch('/api/window')
      .then((r) => r.json())
      .catch(() => null);
  }, []);

  const postHeight = useCallback((rect: WindowRectResponse, height: number) => {
    fetch('/api/window', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'move_resize',
        x: Math.round(rect.left ?? 0),
        y: Math.round(rect.top ?? 0),
        width: Math.round(rect.width ?? 0),
        height: Math.round(height),
      }),
    }).catch(() => {});
  }, []);

  const collapse = useCallback(async () => {
    if (disabledRef.current) return;
    const rect = await fetchRect();
    if (!rect || typeof rect.height !== 'number') return;
    savedHeightRef.current = rect.height;
    const dpr = window.devicePixelRatio || 1;
    postHeight(rect, TITLEBAR_CSS_HEIGHT * dpr);
    setCollapsed(true);
  }, [fetchRect, postHeight]);

  const expand = useCallback(async () => {
    const rect = await fetchRect();
    if (rect) {
      const dpr = window.devicePixelRatio || 1;
      // Prefer the height saved at collapse; fall back to the reported
      // UI min height so expand never leaves a strip-sized window.
      const fallback = rect.minHeight ?? 480 * dpr;
      postHeight(rect, savedHeightRef.current ?? fallback);
    }
    savedHeightRef.current = null;
    setCollapsed(false);
  }, [fetchRect, postHeight]);

  const toggleCollapse = useCallback(() => {
    if (collapsed) {
      expand();
    } else {
      collapse();
    }
  }, [collapsed, collapse, expand]);

  return { collapsed, collapse, expand, toggleCollapse };
}
