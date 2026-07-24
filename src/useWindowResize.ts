import { useCallback, useRef, useEffect } from 'react';

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface WindowRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface ResizeState {
  dir: ResizeDir;
  startScreenX: number;
  startScreenY: number;
  startWidth: number;
  startHeight: number;
  startLeft: number;
  startTop: number;
}

interface UseWindowResizeOptions {
  /** When true (e.g. window maximized), handles ignore mouse events. */
  disabled?: boolean;
}

const DEFAULT_RECT: WindowRect = {
  left: 100,
  top: 100,
  width: 520,
  height: 780,
};

/**
 * Hook that provides resize-start handlers for each edge/corner.
 * During drag it sends new dimensions (and position, for N/W edges)
 * to the Python backend (/api/window).
 *
 * Uses *screen* coordinates for the delta because the window itself is
 * moving/resizing; client coordinates would be relative to the moving
 * viewport and cause drift.
 *
 * Network calls are throttled with requestAnimationFrame so each frame
 * issues at most one move_resize request; a final request fires on
 * mouseup with the settled rect.
 */
export function useWindowResize(options?: UseWindowResizeOptions) {
  const resizeRef = useRef<ResizeState | null>(null);
  const rectRef = useRef<WindowRect | null>(null);
  const disabledRef = useRef(options?.disabled ?? false);
  const rafRef = useRef<number | null>(null);
  const pendingRectRef = useRef<WindowRect | null>(null);
  // OS-enforced minimum (physical px) reported by the backend; falls back
  // to the launcher's logical min for older backends / browsers.
  const minSizeRef = useRef({ width: 360, height: 480 });

  disabledRef.current = options?.disabled ?? false;

  const fetchRect = useCallback((): Promise<WindowRect> => {
    return fetch('/api/window')
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.minWidth === 'number' && data.minWidth > 0) {
          minSizeRef.current = {
            width: data.minWidth,
            height: data.minHeight ?? data.minWidth,
          };
        }
        return {
          left: data.left ?? DEFAULT_RECT.left,
          top: data.top ?? DEFAULT_RECT.top,
          width: data.width ?? DEFAULT_RECT.width,
          height: data.height ?? DEFAULT_RECT.height,
        };
      })
      .catch(() => ({ ...DEFAULT_RECT }));
  }, []);

  // Fetch initial window rect from backend once on mount
  useEffect(() => {
    fetchRect().then((rect) => {
      rectRef.current = rect;
    });
  }, [fetchRect]);

  const getRect = useCallback((): WindowRect => {
    return rectRef.current ? { ...rectRef.current } : { ...DEFAULT_RECT };
  }, []);

  const clampSize = useCallback((w: number, h: number) => {
    return {
      width: Math.max(minSizeRef.current.width, w),
      height: Math.max(minSizeRef.current.height, h),
    };
  }, []);

  const sendResize = useCallback((rect: WindowRect) => {
    const clamped = clampSize(rect.width, rect.height);
    fetch('/api/window', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'move_resize',
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(clamped.width),
        height: Math.round(clamped.height),
      }),
    }).catch(() => {});
  }, [clampSize]);

  // Schedule a rAF-throttled resize request for the pending rect
  const scheduleResize = useCallback(
    (rect: WindowRect) => {
      pendingRectRef.current = rect;
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (pendingRectRef.current) {
          sendResize(pendingRectRef.current);
          pendingRectRef.current = null;
        }
      });
    },
    [sendResize],
  );

  const onMouseDown = useCallback(
    async (dir: ResizeDir, e: React.MouseEvent) => {
      if (disabledRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      // Refresh rect from backend at drag start to avoid drift
      rectRef.current = await fetchRect();

      const init = getRect();
      resizeRef.current = {
        dir,
        startScreenX: e.screenX,
        startScreenY: e.screenY,
        startWidth: init.width,
        startHeight: init.height,
        startLeft: init.left,
        startTop: init.top,
      };
    },
    [fetchRect, getRect],
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const state = resizeRef.current;
      if (!state) return;

      // screenX is in CSS pixels, but the backend rect is in *physical*
      // pixels — convert with devicePixelRatio (e.g. 1.5 at 150% DPI) so
      // the dragged edge tracks the cursor 1:1 on any display scaling.
      const dpr = window.devicePixelRatio || 1;
      const dx = (e.screenX - state.startScreenX) * dpr;
      const dy = (e.screenY - state.startScreenY) * dpr;

      let newW = state.startWidth;
      let newH = state.startHeight;

      switch (state.dir) {
        case 'e':
          newW = state.startWidth + dx;
          break;
        case 'w':
          newW = state.startWidth - dx;
          break;
        case 's':
          newH = state.startHeight + dy;
          break;
        case 'n':
          newH = state.startHeight - dy;
          break;
        case 'se':
          newW = state.startWidth + dx;
          newH = state.startHeight + dy;
          break;
        case 'sw':
          newW = state.startWidth - dx;
          newH = state.startHeight + dy;
          break;
        case 'ne':
          newW = state.startWidth + dx;
          newH = state.startHeight - dy;
          break;
        case 'nw':
          newW = state.startWidth - dx;
          newH = state.startHeight - dy;
          break;
      }

      // Clamp first, then derive the position from the *clamped* size so
      // the stationary edge stays anchored.  (Previously position tracked
      // the cursor even after min-size clamping, so the whole window
      // slid — it looked like the window was being dragged.)
      const clamped = clampSize(newW, newH);
      newW = clamped.width;
      newH = clamped.height;

      let newX = state.startLeft;
      let newY = state.startTop;
      if (state.dir.includes('w')) {
        newX = state.startLeft + state.startWidth - newW; // right edge fixed
      }
      if (state.dir.includes('n')) {
        newY = state.startTop + state.startHeight - newH; // bottom edge fixed
      }

      // Update cached rect so subsequent drags start from the right place
      rectRef.current = { left: newX, top: newY, width: newW, height: newH };
      scheduleResize(rectRef.current);
    };

    const onMouseUp = () => {
      if (!resizeRef.current) return;
      resizeRef.current = null;
      // Flush the final position immediately, then re-sync from the
      // backend (SetWindowPos may have clamped to the window min size).
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (pendingRectRef.current) {
        sendResize(pendingRectRef.current);
        pendingRectRef.current = null;
      }
      fetchRect().then((rect) => {
        rectRef.current = rect;
      });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [scheduleResize, sendResize, fetchRect, clampSize]);

  // Cancel any in-flight rAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  // Return handlers for each edge/corner
  const handlers = {
    onN:  (e: React.MouseEvent) => onMouseDown('n', e),
    onS:  (e: React.MouseEvent) => onMouseDown('s', e),
    onE:  (e: React.MouseEvent) => onMouseDown('e', e),
    onW:  (e: React.MouseEvent) => onMouseDown('w', e),
    onNE: (e: React.MouseEvent) => onMouseDown('ne', e),
    onNW: (e: React.MouseEvent) => onMouseDown('nw', e),
    onSE: (e: React.MouseEvent) => onMouseDown('se', e),
    onSW: (e: React.MouseEvent) => onMouseDown('sw', e),
  };

  return handlers;
}
