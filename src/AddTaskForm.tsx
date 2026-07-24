import { useState, useRef, useEffect, useCallback } from 'react';
import type { Priority } from './types';
import { useData, DEFAULT_CATEGORIES } from './DataContext';
import { Icon } from './Icon';
import { Tag } from './Tag';
import styles from './AddTaskForm.module.css';

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'urgent', label: '紧急' },
  { value: 'important', label: '重要' },
  { value: 'normal', label: '日常' },
];

// ============================================================
// Date helpers
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

function getNextMondayStr(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon, …, 6=Sat
  const daysUntil = day === 1 ? 7 : (8 - day) % 7;
  d.setDate(d.getDate() + daysUntil);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ============================================================
// Props
// ============================================================

interface AddTaskFormProps {
  onTaskAdded?: () => void;
}

// ============================================================
// Component
// ============================================================

export function AddTaskForm({ onTaskAdded }: AddTaskFormProps) {
  const { data, dispatch } = useData();
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [reminderTime, setReminderTime] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<'dueDate' | 'reminder' | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const activeInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLInputElement>(null);
  const dateTimePickerRef = useRef<HTMLInputElement>(null);

  const categories = data?.settings.categories ?? DEFAULT_CATEGORIES;

  // Focus when activating
  useEffect(() => {
    if (active && activeInputRef.current) {
      activeInputRef.current.focus();
    }
  }, [active]);

  // Focus when expanding
  useEffect(() => {
    if (expanded && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [expanded]);

  // Auto-open native date picker
  useEffect(() => {
    if (showDatePicker && datePickerRef.current) {
      if (typeof datePickerRef.current.showPicker === 'function') {
        datePickerRef.current.showPicker();
      }
    }
  }, [showDatePicker]);

  // Auto-open native datetime picker
  useEffect(() => {
    if (showDateTimePicker && dateTimePickerRef.current) {
      if (typeof dateTimePickerRef.current.showPicker === 'function') {
        dateTimePickerRef.current.showPicker();
      }
    }
  }, [showDateTimePicker]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!openDropdown) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openDropdown]);

  // Collapse active state when clicking outside (only if empty)
  useEffect(() => {
    if (!active) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (!title.trim() && !dueDate && !reminderTime && !openDropdown) {
          setActive(false);
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [active, title, dueDate, reminderTime, openDropdown]);

  // ============================================================
  // Submit task (shared between Enter in active mode and form submit)
  // ============================================================

  const submitTask = useCallback(() => {
    const trimmed = title.trim();
    if (!trimmed) return;

    const cat = category || categories[0];
    const deadline = reminderTime || dueDate;

    dispatch({
      type: 'ADD_TASK',
      payload: { title: trimmed, category: cat, priority, deadline },
    });
    setTitle('');
    setCategory('');
    setPriority('normal');
    setDueDate(null);
    setReminderTime(null);
    setActive(false);
    setExpanded(false);
    setOpenDropdown(null);
    setShowDatePicker(false);
    setShowDateTimePicker(false);
    onTaskAdded?.();
  }, [title, category, priority, dueDate, reminderTime, categories, dispatch, onTaskAdded]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitTask();
  };

  const handleActiveKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitTask();
    }
  };

  const handleCancel = () => {
    setTitle('');
    setExpanded(false);
    setActive(false);
  };

  const handleExpand = () => {
    setActive(false);
    setExpanded(true);
  };

  // Due date handlers
  const handleDueDateSelect = (value: string) => {
    setDueDate(value);
    setOpenDropdown(null);
    setShowDatePicker(false);
  };

  const handleChooseDate = () => {
    setOpenDropdown(null);
    setShowDatePicker(true);
  };

  // Reminder handlers
  const handleReminderSelect = (value: string) => {
    setReminderTime(value);
    setOpenDropdown(null);
    setShowDateTimePicker(false);
  };

  const handleChooseDateTime = () => {
    setOpenDropdown(null);
    setShowDateTimePicker(true);
  };

  // ============================================================
  // Render: idle collapsed state
  // ============================================================
  if (!expanded && !active) {
    return (
      <div
        className={styles.collapsedCard}
        onClick={() => setActive(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setActive(true);
        }}
      >
        <span className={styles.collapsedIcon}><Icon name="plus" size={20} /></span>
        <span className={styles.collapsedText}>添加新任务</span>
      </div>
    );
  }

  // ============================================================
  // Render: active collapsed state (input + suffix + tags)
  // ============================================================
  if (!expanded && active) {
    return (
      <div className={styles.activeCollapsed} ref={containerRef}>
        <div className={styles.inputWrapper}>
          <input
            ref={activeInputRef}
            className={styles.activeInput}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleActiveKeyDown}
            placeholder="输入新任务…"
          />
          <div className={styles.suffixArea}>
            <button
              type="button"
              aria-label="设置截止日期"
              className={`${styles.suffixBtn} ${openDropdown === 'dueDate' ? styles.suffixBtnActive : ''}`}
              onClick={() => setOpenDropdown(openDropdown === 'dueDate' ? null : 'dueDate')}
            >
              <Icon name="calendar" size={18} />
            </button>
            <button
              type="button"
              aria-label="设置提醒时间"
              className={`${styles.suffixBtn} ${openDropdown === 'reminder' ? styles.suffixBtnActive : ''}`}
              onClick={() => setOpenDropdown(openDropdown === 'reminder' ? null : 'reminder')}
            >
              <Icon name="clock" size={18} />
            </button>
            <button
              type="button"
              aria-label="展开完整表单"
              className={styles.expandBtn}
              onClick={handleExpand}
            >
              <Icon name="chevron-up" size={16} />
            </button>
          </div>

          {/* Due date dropdown */}
          {openDropdown === 'dueDate' && (
            <div className={styles.dropdown} role="menu">
              <button
                type="button"
                className={styles.dropdownItem}
                role="menuitem"
                onClick={() => handleDueDateSelect(getTodayStr())}
              >
                今天
              </button>
              <button
                type="button"
                className={styles.dropdownItem}
                role="menuitem"
                onClick={() => handleDueDateSelect(getTomorrowStr())}
              >
                明天
              </button>
              <button
                type="button"
                className={styles.dropdownItem}
                role="menuitem"
                onClick={() => handleDueDateSelect(getNextMondayStr())}
              >
                下周一
              </button>
              <button
                type="button"
                className={styles.dropdownItem}
                role="menuitem"
                onClick={handleChooseDate}
              >
                选择日期
              </button>
            </div>
          )}

          {/* Reminder dropdown */}
          {openDropdown === 'reminder' && (
            <div className={styles.dropdown} role="menu">
              <button
                type="button"
                className={styles.dropdownItem}
                role="menuitem"
                onClick={() => handleReminderSelect(`${getTodayStr()}T16:00`)}
              >
                今天16:00
              </button>
              <button
                type="button"
                className={styles.dropdownItem}
                role="menuitem"
                onClick={() => handleReminderSelect(`${getTomorrowStr()}T09:00`)}
              >
                明天9:00
              </button>
              <button
                type="button"
                className={styles.dropdownItem}
                role="menuitem"
                onClick={handleChooseDateTime}
              >
                选择日期时间
              </button>
            </div>
          )}

          {/* Native date picker (due date) */}
          {showDatePicker && (
            <input
              type="date"
              ref={datePickerRef}
              data-testid="due-date-picker"
              className={styles.datePickerInput}
              onChange={(e) => {
                if (e.target.value) handleDueDateSelect(e.target.value);
              }}
            />
          )}

          {/* Native datetime picker (reminder) */}
          {showDateTimePicker && (
            <input
              type="datetime-local"
              ref={dateTimePickerRef}
              data-testid="reminder-datetime-picker"
              className={styles.datePickerInput}
              onChange={(e) => {
                if (e.target.value) handleReminderSelect(e.target.value);
              }}
            />
          )}
        </div>

        {/* Tags row */}
        {(dueDate || reminderTime) && (
          <div className={styles.tagsRow}>
            {dueDate && <Tag variant="date">{dueDate}</Tag>}
            {reminderTime && <Tag variant="date">{reminderTime}</Tag>}
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // Render: expanded full form
  // ============================================================
  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <input
          id="task-title"
          ref={titleInputRef}
          className={styles.input}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="输入新任务…"
        />
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <select
            id="task-category"
            className={styles.select}
            value={category || categories[0]}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.priorityGroup}>
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              type="button"
              className={`${styles.priorityBtn} ${
                priority === p.value ? styles.priorityBtnActive : ''
              }`}
              data-priority={p.value}
              onClick={() => setPriority(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.actions}>
        <button
          type="submit"
          className={styles.submitBtn}
          disabled={!title.trim()}
        >
          添加
        </button>
        <button
          type="button"
          className={styles.cancelBtn}
          onClick={handleCancel}
        >
          取消
        </button>
      </div>
    </form>
  );
}
