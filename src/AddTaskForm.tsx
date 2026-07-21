import { useState } from 'react';
import type { Priority } from './types';
import { useData, DEFAULT_CATEGORIES } from './DataContext';
import styles from './AddTaskForm.module.css';

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'urgent', label: '紧急' },
  { value: 'important', label: '重要' },
  { value: 'normal', label: '日常' },
];

interface AddTaskFormProps {
  onTaskAdded?: () => void;
}

export function AddTaskForm({ onTaskAdded }: AddTaskFormProps) {
  const { data, dispatch } = useData();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');

  const categories = data?.settings.categories ?? DEFAULT_CATEGORIES;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    const cat = category || categories[0];
    dispatch({
      type: 'ADD_TASK',
      payload: { title: trimmed, category: cat, priority },
    });
    setTitle('');
    onTaskAdded?.();
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="task-title">
            任务标题
          </label>
          <input
            id="task-title"
            className={styles.input}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="输入新任务…"
            autoFocus
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="task-category">
            分类
          </label>
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

        <div className={styles.field}>
          <span className={styles.label}>优先级</span>
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

        <button
          type="submit"
          className={styles.submitBtn}
          disabled={!title.trim()}
        >
          添加
        </button>
      </div>
    </form>
  );
}
