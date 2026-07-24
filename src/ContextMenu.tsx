import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './Icon';
import styles from './ContextMenu.module.css';

// ============================================================
// Types
// ============================================================

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: IconName;
  danger?: boolean;
  separator?: boolean;
  onClick?: () => void;
}

export interface ContextMenuProps {
  items: ContextMenuItem[];
  x: number;
  y: number;
  open: boolean;
  onClose: () => void;
}

// ============================================================
// Component
// ============================================================

/**
 * ContextMenu — floating right-click menu rendered via React Portal.
 *
 * Renders into document.body at the given (x, y) coordinates.
 * Supports three item variants: action, separator, danger (red).
 * Dismisses on backdrop click and ESC key.
 */
export function ContextMenu({ items, x, y, open, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // --------------------------------------------------------
  // ESC key listener
  // --------------------------------------------------------

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // --------------------------------------------------------
  // Item click handler — fire callback then close
  // --------------------------------------------------------

  const handleItemClick = useCallback(
    (item: ContextMenuItem) => {
      item.onClick?.();
      onClose();
    },
    [onClose],
  );

  // --------------------------------------------------------
  // Render nothing when closed
  // --------------------------------------------------------

  if (!open) return null;

  // --------------------------------------------------------
  // Portal render
  // --------------------------------------------------------

  return createPortal(
    <>
      {/* Transparent backdrop — catches clicks outside the menu */}
      <div
        className={styles.backdrop}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Menu panel */}
      <div
        ref={menuRef}
        role="menu"
        className={styles.menu}
        style={{ left: x, top: y }}
      >
        {items.map((item) => {
          // Separator
          if (item.separator) {
            return (
              <div
                key={item.id}
                role="separator"
                className={styles.separator}
              />
            );
          }

          // Action item (regular or danger)
          return (
            <button
              key={item.id}
              role="menuitem"
              className={`${styles.item} ${item.danger ? styles.danger : ''}`}
              onClick={() => handleItemClick(item)}
              type="button"
            >
              {item.icon && (
                <span className={styles.itemIcon}>
                  <Icon name={item.icon} size={16} />
                </span>
              )}
              <span className={styles.itemLabel}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </>,
    document.body,
  );
}
