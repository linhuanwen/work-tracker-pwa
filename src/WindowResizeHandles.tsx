import { useWindowResize } from './useWindowResize';
import styles from './WindowResizeHandles.module.css';

// ============================================================
// Props
// ============================================================

interface WindowResizeHandlesProps {
  /** Hide & disable handles (browser mode or maximized window). */
  disabled?: boolean;
}

// ============================================================
// Component
// ============================================================

/**
 * WindowResizeHandles — eight invisible edge/corner grips around the
 * frameless window.  Dragging one asks the launcher to move/resize the
 * OS window via POST /api/window (see useWindowResize).
 *
 * The grips are nearly invisible but NOT fully transparent — fully
 * transparent pixels are punched through by the window TransparencyKey
 * and would be unclickable.
 */
export function WindowResizeHandles({ disabled = false }: WindowResizeHandlesProps) {
  const handlers = useWindowResize({ disabled });

  if (disabled) return null;

  return (
    <>
      <div className={`${styles.handle} ${styles.n}`} data-testid="resize-n" onMouseDown={handlers.onN} />
      <div className={`${styles.handle} ${styles.s}`} data-testid="resize-s" onMouseDown={handlers.onS} />
      <div className={`${styles.handle} ${styles.e}`} data-testid="resize-e" onMouseDown={handlers.onE} />
      <div className={`${styles.handle} ${styles.w}`} data-testid="resize-w" onMouseDown={handlers.onW} />
      <div className={`${styles.handle} ${styles.ne}`} data-testid="resize-ne" onMouseDown={handlers.onNE} />
      <div className={`${styles.handle} ${styles.nw}`} data-testid="resize-nw" onMouseDown={handlers.onNW} />
      <div className={`${styles.handle} ${styles.se}`} data-testid="resize-se" onMouseDown={handlers.onSE} />
      <div className={`${styles.handle} ${styles.sw}`} data-testid="resize-sw" onMouseDown={handlers.onSW} />
    </>
  );
}
