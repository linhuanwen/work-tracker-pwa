import { useState, useEffect, useCallback, useRef } from 'react';
import { Icon, type IconName } from './Icon';
import styles from './Sidebar.module.css';

// ============================================================
// Types
// ============================================================

interface NavItem {
  label: string;
  icon: IconName;
  route: string;
  /**
   * When set, the nav item is active when currentPath equals `route`
   * OR starts with this prefix string. Use when sub-routes should
   * highlight the parent nav item (e.g. /project/:id → "项目管理").
   */
  matchPrefix?: string;
}

export interface SidebarProps {
  /** Current hash route path (e.g. "/", "/weekly"). */
  currentPath: string;
  /** Called when the user clicks a nav item. */
  onNavigate: (route: string) => void;
}

// ============================================================
// Constants
// ============================================================

const STORAGE_KEY = 'wjl-sidebar-width';
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export const NAV_ITEMS: NavItem[] = [
  { label: '任务清单', icon: 'clipboard-list', route: '/' },
  { label: '周报', icon: 'clipboard-list', route: '/weekly' },
  { label: '月报', icon: 'calendar', route: '/summary/monthly' },
  { label: '年报', icon: 'bar-chart-3', route: '/summary/yearly' },
  { label: '项目管理', icon: 'folder', route: '/projects', matchPrefix: '/project' },
  { label: '设置', icon: 'settings', route: '/settings' },
];

// ============================================================
// Hook: useMediaQuery
// ============================================================

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

// ============================================================
// Helpers
// ============================================================

function readStoredWidth(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      const num = Number(stored);
      if (!isNaN(num)) {
        return Math.min(Math.max(num, MIN_WIDTH), MAX_WIDTH);
      }
    }
  } catch {
    // localStorage unavailable — use default
  }
  return DEFAULT_WIDTH;
}

function isActive(item: NavItem, currentPath: string): boolean {
  if (currentPath === item.route) return true;
  if (item.matchPrefix && currentPath.startsWith(item.matchPrefix)) return true;
  return false;
}

// ============================================================
// Component
// ============================================================

export function Sidebar({ currentPath, onNavigate }: SidebarProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isTablet = useMediaQuery('(min-width: 768px)');

  const mode: 'hidden' | 'icons' | 'full' =
    !isTablet ? 'hidden' : isDesktop ? 'full' : 'icons';

  const [width, setWidth] = useState<number>(readStoredWidth);
  const [dragging, setDragging] = useState(false);

  // ---- Publish effective sidebar width as CSS custom property ----
  useEffect(() => {
    const effectiveWidth = mode === 'full'
      ? Math.round(width)
      : mode === 'icons'
        ? 56
        : 0;
    document.documentElement.style.setProperty(
      '--sidebar-width',
      `${effectiveWidth}px`,
    );
    return () => {
      document.documentElement.style.removeProperty('--sidebar-width');
    };
  }, [mode, width]);

  // Refs for drag state (synchronous reads inside native event handlers)
  const draggingRef = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const latestWidthRef = useRef(width);

  // Keep latestWidthRef in sync
  useEffect(() => {
    latestWidthRef.current = width;
  }, [width]);

  // ---- Drag: mouseDown on handle ----
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isDesktop) return;
      e.preventDefault();
      e.stopPropagation();
      draggingRef.current = true;
      dragStartX.current = e.clientX;
      dragStartWidth.current = width;
      latestWidthRef.current = width;
      setDragging(true);
    },
    [isDesktop, width],
  );

  // ---- Drag: mouseMove + mouseUp on window ----
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - dragStartX.current;
      const newWidth = Math.min(
        Math.max(dragStartWidth.current + dx, MIN_WIDTH),
        MAX_WIDTH,
      );
      latestWidthRef.current = newWidth;
      setWidth(newWidth);
    };

    const onMouseUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setDragging(false);
      try {
        localStorage.setItem(STORAGE_KEY, String(latestWidthRef.current));
      } catch {
        // localStorage unavailable
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []); // Stable listeners — check draggingRef synchronously

  // ---- Render: hidden mode ----
  if (mode === 'hidden') {
    return (
      <aside
        className={styles.sidebar}
        data-mode="hidden"
        role="complementary"
        style={{ width: 0, display: 'none' }}
      />
    );
  }

  const sidebarWidth = isDesktop ? Math.round(width) : 56;

  return (
    <aside
      className={`${styles.sidebar} ${dragging ? styles.dragging : ''}`}
      data-mode={mode}
      role="complementary"
      style={{ width: `${sidebarWidth}px` }}
    >
      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item, currentPath);
          return (
            <button
              key={item.route}
              className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
              onClick={() => onNavigate(item.route)}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              title={mode === 'icons' ? item.label : undefined}
            >
              <span className={styles.icon}>
                <Icon name={item.icon} size={20} />
              </span>
              <span className={styles.label}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Drag handle — only in full mode */}
      {isDesktop && (
        <div
          className={styles.dragHandle}
          data-testid="sidebar-drag-handle"
          onMouseDown={handleMouseDown}
        />
      )}
    </aside>
  );
}
