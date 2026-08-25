import { useState, useCallback } from 'react';
import type { SubTask, Priority, Quantity } from './types';
import { Icon } from './Icon';
import styles from './SubtaskEditor.module.css';

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'urgent', label: '紧急' },
  { value: 'important', label: '重要' },
  { value: 'normal', label: '日常' },
];

interface SubtaskEditorProps {
  subtasks: SubTask[];
  categories?: string[];
  onAdd: (title: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: Partial<SubTask>) => void;
}

export function SubtaskEditor({
  subtasks,
  categories,
  onAdd,
  onToggle,
  onDelete,
  onUpdate,
}: SubtaskEditorProps) {
  const [newTitle, setNewTitle] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const doneCount = subtasks.filter((s) => s.status === 'done').length;

  const handleAdd = useCallback(() => {
    const title = newTitle.trim();
    if (!title) return;
    onAdd(title);
    setNewTitle('');
  }, [newTitle, onAdd]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAdd();
      }
    },
    [handleAdd],
  );

  const handleQuantityChange = (
    subId: string,
    index: number,
    field: keyof Quantity,
    value: string | number,
  ) => {
    const sub = subtasks.find((s) => s.id === subId);
    if (!sub) return;
    const current = sub.quantities ?? [];
    const updated = current.map((q, i) =>
      i === index
        ? { ...q, [field]: field === 'value' ? Number(value) || 0 : value }
        : q,
    );
    onUpdate(subId, { quantities: updated });
  };

  const handleRemoveQuantity = (subId: string, index: number) => {
    const sub = subtasks.find((s) => s.id === subId);
    if (!sub) return;
    onUpdate(subId, {
      quantities: (sub.quantities ?? []).filter((_, i) => i !== index),
    });
  };

  const handleAddQuantity = (subId: string) => {
    const sub = subtasks.find((s) => s.id === subId);
    if (!sub) return;
    onUpdate(subId, {
      quantities: [...(sub.quantities ?? []), { label: '', value: 0, unit: '' }],
    });
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>
        <span>子任务</span>
        {subtasks.length > 0 && (
          <span className={styles.sectionCounter}>
            ({doneCount}/{subtasks.length})
          </span>
        )}
      </div>

      {subtasks.length > 0 && (
        <ul className={styles.subtaskList}>
          {subtasks.map((sub) => {
            const expanded = expandedId === sub.id;
            const priority = sub.priority ?? 'normal';
            const quantities = sub.quantities ?? [];
            const deadline = sub.deadline ?? '';
            const category = sub.category ?? '';

            return (
              <li key={sub.id} className={styles.subtaskItem}>
                <div className={styles.subtaskRow}>
                  <input
                    type="checkbox"
                    className={styles.subtaskCheckbox}
                    checked={sub.status === 'done'}
                    onChange={() => onToggle(sub.id)}
                    aria-label={`标记子任务完成：${sub.title}`}
                  />
                  <span
                    className={
                      sub.status === 'done'
                        ? styles.subtaskTitleDone
                        : styles.subtaskTitle
                    }
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedId(expanded ? null : sub.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setExpandedId(expanded ? null : sub.id);
                      }
                    }}
                  >
                    {sub.title}
                  </span>
                  <button
                    type="button"
                    className={styles.expandBtn}
                    onClick={() => setExpandedId(expanded ? null : sub.id)}
                    aria-label={expanded ? `收起子任务：${sub.title}` : `展开子任务：${sub.title}`}
                    title={expanded ? '收起' : '展开'}
                  >
                    <Icon name="chevron-right" size={14} />
                  </button>
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => onDelete(sub.id)}
                    aria-label={`删除子任务：${sub.title}`}
                    title="删除"
                  >
                    <Icon name="x" size={14} />
                  </button>
                </div>

                {expanded && (
                  <div className={styles.subtaskDetails}>
                    <label className={styles.detailsLabel}>
                      标题
                      <input
                        className={styles.detailsInput}
                        type="text"
                        value={sub.title}
                        onChange={(e) =>
                          onUpdate(sub.id, { title: e.target.value })
                        }
                      />
                    </label>

                    <label className={styles.detailsLabel}>
                      具体内容
                      <textarea
                        className={styles.detailsTextarea}
                        rows={2}
                        value={sub.notes ?? ''}
                        onChange={(e) =>
                          onUpdate(sub.id, { notes: e.target.value })
                        }
                        placeholder="添加具体内容…"
                      />
                    </label>

                    <div className={styles.detailsRow}>
                      <label className={styles.detailsLabel}>
                        截止日期
                        <input
                          className={styles.detailsInput}
                          type="date"
                          value={deadline}
                          onChange={(e) =>
                            onUpdate(sub.id, {
                              deadline: e.target.value || null,
                            })
                          }
                        />
                      </label>

                      <label className={styles.detailsLabel}>
                        优先级
                        <select
                          className={styles.detailsInput}
                          value={priority}
                          onChange={(e) =>
                            onUpdate(sub.id, {
                              priority: e.target.value as Priority,
                            })
                          }
                        >
                          {PRIORITIES.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    {categories && (
                      <label className={styles.detailsLabel}>
                        分类
                        <select
                          className={styles.detailsInput}
                          value={category}
                          onChange={(e) =>
                            onUpdate(sub.id, { category: e.target.value })
                          }
                        >
                          {categories.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    <div className={styles.detailsLabel}>
                      <span>量化产出</span>
                      <div className={styles.quantityList}>
                        {quantities.map((q, index) => (
                          <div key={index} className={styles.quantityRow}>
                            <input
                              className={styles.quantityInput}
                              type="text"
                              value={q.label}
                              onChange={(e) =>
                                handleQuantityChange(sub.id, index, 'label', e.target.value)
                              }
                              placeholder="产出名称"
                            />
                            <input
                              className={styles.quantityNumber}
                              type="number"
                              value={q.value || ''}
                              onChange={(e) =>
                                handleQuantityChange(sub.id, index, 'value', e.target.value)
                              }
                              placeholder="数值"
                            />
                            <input
                              className={styles.quantityUnit}
                              type="text"
                              value={q.unit}
                              onChange={(e) =>
                                handleQuantityChange(sub.id, index, 'unit', e.target.value)
                              }
                              placeholder="单位"
                            />
                            <button
                              type="button"
                              className={styles.removeBtn}
                              onClick={() => handleRemoveQuantity(sub.id, index)}
                              aria-label={`删除产出：${q.label || '未命名'}`}
                              title="删除"
                            >
                              <Icon name="x" size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        className={styles.addQuantityBtn}
                        onClick={() => handleAddQuantity(sub.id)}
                      >
                        <Icon name="plus" size={14} /> 添加产出
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className={styles.subtaskInputRow}>
        <input
          className={styles.input}
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="添加子任务步骤…"
        />
        <button
          type="button"
          className={styles.addBtn}
          onClick={handleAdd}
        >
          <Icon name="plus" size={14} /> 添加子任务
        </button>
      </div>
    </div>
  );
}