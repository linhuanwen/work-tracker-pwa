import { useState, useEffect, useCallback } from 'react';

/**
 * Bridge to the desktop launcher's window controls (POST /api/window).
 *
 * When the app runs inside the pywebview frameless window, the launcher
 * exposes drag / minimize / maximize / close over HTTP.  In a plain
 * browser (or installed PWA) the endpoint does not exist, so the hook
 * reports `isDesktopWindow = false` and callers hide the controls.
 */

interface WindowStateResponse {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  maximized?: boolean;
}

async function postWindowAction(
  body: Record<string, unknown>,
): Promise<{ ok?: boolean; maximized?: boolean }> {
  const res = await fetch('/api/window', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export function useWindowControls() {
  const [isDesktopWindow, setIsDesktopWindow] = useState(false);
  const [maximized, setMaximized] = useState(false);

  // Probe the bridge once on mount
  useEffect(() => {
    let cancelled = false;
    fetch('/api/window')
      .then((r) => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.json();
      })
      .then((data: WindowStateResponse) => {
        if (cancelled) return;
        setIsDesktopWindow(true);
        setMaximized(Boolean(data.maximized));
        document.documentElement.classList.add('desktop-window');
      })
      .catch(() => {
        if (!cancelled) setIsDesktopWindow(false);
      });
    return () => {
      cancelled = true;
      document.documentElement.classList.remove('desktop-window');
    };
  }, []);

  // Re-sync `maximized` after viewport changes: a native drag of a
  // maximized window restores it, and the OS can (un)maximize us too.
  useEffect(() => {
    if (!isDesktopWindow) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        fetch('/api/window')
          .then((r) => r.json())
          .then((d: WindowStateResponse) => setMaximized(Boolean(d.maximized)))
          .catch(() => {});
      }, 150);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      clearTimeout(timer);
    };
  }, [isDesktopWindow]);

  const minimize = useCallback(() => {
    postWindowAction({ action: 'minimize' }).catch(() => {});
  }, []);

  const toggleMaximize = useCallback(() => {
    postWindowAction({ action: 'toggle_maximize' })
      .then((d) => {
        if (typeof d.maximized === 'boolean') setMaximized(d.maximized);
      })
      .catch(() => {});
  }, []);

  const close = useCallback(() => {
    postWindowAction({ action: 'close' }).catch(() => {});
  }, []);

  return { isDesktopWindow, maximized, minimize, toggleMaximize, close };
}
