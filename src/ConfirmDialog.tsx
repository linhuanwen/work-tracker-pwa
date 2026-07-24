import { useEffect, useRef, useCallback } from 'react';
import styles from './ConfirmDialog.module.css';

// ============================================================
// Props
// ============================================================

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// ============================================================
// Component
// ============================================================

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '确认删除',
  cancelLabel = '取消',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Show/hide the native dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      // Only showModal if not already open (prevents multiple calls)
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [open]);

  // Detect backdrop clicks: clicking the <dialog> itself (not content inside)
  const handleDialogClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) {
        onCancel();
      }
    },
    [onCancel],
  );

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onClick={handleDialogClick}
      onClose={onCancel}
    >
      <div className={styles.content}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
        </div>

        <p className={styles.message}>{message}</p>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
