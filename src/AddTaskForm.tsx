import { useState, useRef, useEffect, useCallback } from 'react';
import type { Priority } from './types';
import { useData, DEFAULT_CATEGORIES } from './DataContext';
import { Icon } from './Icon';
import styles from './AddTaskForm.module.css';

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'urgent', label: '紧急' },
  { value: 'important', label: '重要' },
  { value: 'normal', label: '日常' },
];

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface AddTaskFormProps {
  onTaskAdded?: () => void;
}

export function AddTaskForm({ onTaskAdded }: AddTaskFormProps) {
  const { data, dispatch } = useData();
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [startDate, setStartDate] = useState(getTodayStr());
  const [deadline, setDeadline] = useState('');

  const titleInputRef = useRef<HTMLInputElement>(null);
  const categories = data?.settings.categories ?? DEFAULT_CATEGORIES;

  useEffect(() => {
    if (expanded && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [expanded]);

  const submitTask = useCallback(() => {
    const trimmed = title.trim();
    if (!trimmed) return;

    const cat = category || categories[0];

    dispatch({
      type: 'ADD_TASK',
      payload: {
        title: trimmed,
        category: cat,
        priority,
        startDate: startDate || getTodayStr(),
        deadline: deadline || null,
      },
    });

    setTitle('');
    setCategory('');
    setPriority('normal');
    setStartDate(getTodayStr());
    setDeadline('');
    setExpanded(false);
    onTaskAdded?.();
  }, [
    title,
    category,
    priority,
    startDate,
    deadline,
    categories,
    dispatch,
    onTaskAdded,
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitTask();
  };

  const handleCancel = () => {
    setTitle('');
    setExpanded(false);
  };

  const handleOpen = () => {
    setExpanded(true);
  };

  if (!expanded) {
    return (
      <div
        className={styles.collapsedCard}
        onClick={handleOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleOpen();
          }
        }}
      >
        <span className={styles.collapsedIcon}>
          <Icon name="plus" size={18} />
        </span>
        <span className={styles.collapsedText}>添加新任务</span>
      </div>
    );
  }

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

      <div className={styles.field}>
        <label className={styles.label} htmlFor="task-start-date">
          起始日期
        </label>
        <input
          id="task-start-date"
          className={styles.input}
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="task-deadline">
          截止日期
        </label>
        <input
          id="task-deadline"
          className={styles.input}
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
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
