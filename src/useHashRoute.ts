import { useState, useEffect, useCallback } from 'react';

/** Simple hash-based router. Returns current path and a navigate function. */
export function useHashRoute(): { path: string; navigate: (to: string) => void } {
  const getPath = useCallback(() => {
    const hash = window.location.hash.replace(/^#/, '') || '/';
    // Split off query-like parts: /project/p-123
    return hash;
  }, []);

  const [path, setPath] = useState(getPath);

  useEffect(() => {
    const onHashChange = () => setPath(getPath());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [getPath]);

  const navigate = useCallback((to: string) => {
    window.location.hash = to;
  }, []);

  return { path, navigate };
}
