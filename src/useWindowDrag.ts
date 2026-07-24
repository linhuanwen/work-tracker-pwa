import { useCallback, useRef, useEffect } from 'react';

/**
 * JS-driven window drag for the frameless desktop window.
 *
 * The native approach (SendMessage WM_NCLBUTTONDOWN/HTCAPTION to the
 * top-level HWND) never enters Windows' modal move loop on the pywebview
 * WinForms window, so dragging the TitleBar did nothing.  This hook moves
 * the OS window by posting move_resize to /api/window on each animation
 * frame — the same proven path as the resize handles.
 *
 * Call `startDrag` from the title bar's mousedown handler; move/up
 * listeners are window-level so the drag continues even when the cursor
 * briefly leaves the bar.
 */

interface DragState {
  startScreenX: number;
  startScreenY: number;
  startLeft: number;
  startTop: number;
  width: number;
  height: number;
}

interface UseWindowDragOptions {
  /** When true (browser mode / maximized), startDrag is a no-op. */
  disabled?: boolean;
}

export function useWindowDrag(options?: UseWindowDragOptions) {
  const dragRef = useRef<DragState | null>(null);
  const disabledRef = useRef(options?.disabled ?? false);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<{ x: number; y: number } | null>(null);

  disabledRef.current = options?.disabled ?? false;

  const sendMove = useCallback((x: number, y: number, w: number, h: number) => {
    fetch('/api/window', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'move_resize',
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(w),
        height: Math.round(h),
      }),
    }).catch(() => {});
  }, []);

  const startDrag = useCallback(
    async (e: { screenX: number; screenY: number }) => {
      if (disabledRef.current) return;

      // Anchor at the live window rect
      let rect: DragState | null = null;
      try {
        const r = await fetch('/api/window').then((res) => res.json());
        if (typeof r.left === 'number' && typeof r.width === 'number') {
          rect = {
            startScreenX: e.screenX,
            startScreenY: e.screenY,
            startLeft: r.left,
            startTop: r.top,
            width: r.width,
            height: r.height,
          };
        }
      } catch {
        // bridge unavailable
      }
      dragRef.current = rect;
    },
    [],
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const state = dragRef.current;
      if (!state) return;

      // screenX is in CSS pixels, but /api/window works in *physical*
      // pixels — at 150% DPI the window would lag the cursor 1:1.5.
      // devicePixelRatio is exactly that scale and adapts to any machine.
      const dpr = window.devicePixelRatio || 1;
      const x = state.startLeft + (e.screenX - state.startScreenX) * dpr;
      const y = state.startTop + (e.screenY - state.startScreenY) * dpr;

      pendingRef.current = { x, y };
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const pending = pendingRef.current;
        const s = dragRef.current;
        if (pending && s) {
          sendMove(pending.x, pending.y, s.width, s.height);
          pendingRef.current = null;
        }
      });
    };

    const onMouseUp = () => {
      if (!dragRef.current) return;
      const state = dragRef.current;
      dragRef.current = null;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (pendingRef.current) {
        sendMove(pendingRef.current.x, pendingRef.current.y, state.width, state.height);
        pendingRef.current = null;
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [sendMove]);

  // Cancel any in-flight rAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  return { startDrag };
}
