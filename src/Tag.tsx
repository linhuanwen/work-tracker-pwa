import { useMemo } from 'react';
import type { Priority } from './types';
import { formatDate } from './taskUtils';
import styles from './Tag.module.css';

// ============================================================
// Props
// ============================================================

interface TagProps {
  variant: 'priority' | 'category' | 'date';
  children: React.ReactNode;
  /** Required when variant="priority" — determines the border color */
  level?: Priority;
  className?: string;
}

// ============================================================
// Priority level → CSS class
// ============================================================

const LEVEL_CLASS: Record<Priority, string> = {
  urgent: styles.priorityUrgent,
  important: styles.priorityImportant,
  normal: styles.priorityNormal,
};

// ============================================================
// Relative date helpers
// ============================================================

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function relativeDateText(dateStr: string): string {
  if (!dateStr) return '';
  // Extract date portion from ISO datetime strings (e.g. "2026-07-23T16:00" → "2026-07-23")
  const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const today = getTodayStr();
  const tomorrow = getTomorrowStr();
  if (datePart === today) return '今天';
  if (datePart === tomorrow) return '明天';
  return formatDate(datePart);
}

// ============================================================
// Component
// ============================================================

export function Tag({ variant, children, level, className }: TagProps) {
  const variantClass =
    variant === 'priority'
      ? styles.priority
      : variant === 'category'
        ? styles.category
        : styles.date;

  const levelClass = level ? LEVEL_CLASS[level] : '';

  const displayText = useMemo(() => {
    if (variant === 'date') {
      return relativeDateText(String(children ?? ''));
    }
    return children;
  }, [variant, children]);

  const classList = [styles.tag, variantClass, levelClass, className]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className={classList}
      data-variant={variant}
      {...(level ? { 'data-level': level } : {})}
    >
      {displayText}
    </span>
  );
}
