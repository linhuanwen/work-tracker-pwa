import type { MouseEvent } from 'react';
import { Icon } from './Icon';
import styles from './TitleBar.module.css';

// ============================================================
// Props
// ============================================================

interface TitleBarProps {
  /** False in plain browser / PWA — window controls are hidden. */
  isDesktopWindow: boolean;
  maximized: boolean;
  /** True while the window is collapsed to a title-bar-only strip. */
  collapsed: boolean;
  /** Called with the initiating mouse event to begin a JS window drag. */
  onStartDrag: (e: MouseEvent) => void;
  onToggleCollapse: () => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
}

// ============================================================
// Component
// ============================================================

/**
 * TitleBar — custom window title bar for the frameless desktop window.
 *
 * Dragging is JS-driven (useWindowDrag posts move_resize over the
 * /api/window bridge).  Double-click toggles maximize, or expands
 * again while collapsed.  In a plain browser the bar still shows the
 * brand, but the window control buttons are hidden.
 */
export function TitleBar({
  isDesktopWindow,
  maximized,
  collapsed,
  onStartDrag,
  onToggleCollapse,
  onMinimize,
  onToggleMaximize,
  onClose,
}: TitleBarProps) {
  const isFromButton = (e: MouseEvent) =>
    (e.target as HTMLElement).closest('button') !== null;

  const handleMouseDown = (e: MouseEvent) => {
    if (!isDesktopWindow) return;
    if (e.button !== 0 || isFromButton(e)) return;
    e.preventDefault();
    onStartDrag(e);
  };

  const handleDoubleClick = (e: MouseEvent) => {
    if (!isDesktopWindow || isFromButton(e)) return;
    if (collapsed) {
      onToggleCollapse(); // 收起状态下双击 = 放下
      return;
    }
    onToggleMaximize();
  };

  return (
    <header
      className={styles.titleBar}
      data-testid="titlebar"
      data-desktop={isDesktopWindow ? 'true' : 'false'}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      <div className={styles.brand}>
        <span className={styles.brandIcon} aria-hidden="true">
          <Icon name="clipboard-list" size={15} />
        </span>
        <span className={styles.brandName}>工作清单</span>
      </div>

      {isDesktopWindow && (
        <div className={styles.controls}>
          {!maximized && (
            <button
              type="button"
              className={styles.controlBtn}
              onClick={onToggleCollapse}
              aria-label={collapsed ? '放下' : '收起'}
              title={collapsed ? '放下' : '收起'}
            >
              <Icon name={collapsed ? 'chevron-down' : 'chevron-up'} size={14} />
            </button>
          )}
          <button
            type="button"
            className={styles.controlBtn}
            onClick={onMinimize}
            aria-label="最小化"
            title="最小化"
          >
            <Icon name="minus" size={14} />
          </button>
          {!collapsed && (
            <button
              type="button"
              className={styles.controlBtn}
              onClick={onToggleMaximize}
              aria-label={maximized ? '还原' : '最大化'}
              title={maximized ? '还原' : '最大化'}
            >
              <Icon name={maximized ? 'restore' : 'square'} size={12} />
            </button>
          )}
          <button
            type="button"
            className={`${styles.controlBtn} ${styles.closeBtn}`}
            onClick={onClose}
            aria-label="关闭"
            title="关闭（隐藏到托盘，右键托盘图标可退出）"
          >
            <Icon name="x" size={15} />
          </button>
        </div>
      )}
    </header>
  );
}
