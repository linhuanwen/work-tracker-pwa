import { useState } from 'react';
import type { Task, Quantity, SubTask, Priority } from './types';
import { useData, DEFAULT_CATEGORIES } from './DataContext';
import { calcDefaultHibernateUntil, addSubtask, toggleSubtask, deleteSubtask } from './taskUtils';
import styles from './TaskEditPanel.module.css';

interface TaskEditPanelProps {
  task: Task;
  onClose: () => void;
}

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'urgent', label: '紧急' },
  { value: 'important', label: '重要' },
  { value: 'normal', label: '日常' },
];

export function TaskEditPanel({ task, onClose }: TaskEditPanelProps) {
  const { data, dispatch } = useData();
  const categories = data?.settings.categories ?? DEFAULT_CATEGORIES;
  const projects = data?.projects ?? [];

  // Editable fields
  const [title, setTitle] = useState(task.title);
  const [category, setCategory] = useState(task.category);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [deadline, setDeadline] = useState(task.deadline ?? '');
  const [notes, setNotes] = useState(task.notes ?? '');
  const [projectId, setProjectId] = useState(task.projectId ?? '');

  // 领导交办
  const [isLeaderAssigned, setIsLeaderAssigned] = useState(
    task.isLeaderAssigned,
  );
  const [leaderSource, setLeaderSource] = useState(task.leaderSource ?? '');
  const [leaderAssignedDate, setLeaderAssignedDate] = useState(
    task.leaderAssignedDate ?? '',
  );
  const [leaderDeadline, setLeaderDeadline] = useState(
    task.leaderDeadline ?? '',
  );

  // 量化产出
  const [quantities, setQuantities] = useState<Quantity[]>(task.quantities ?? []);

  // 子任务
  const [subtasks, setSubtasks] = useState<SubTask[]>(task.subtasks ?? []);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // 跨年休眠
  const [isCrossYear, setIsCrossYear] = useState(task.isCrossYear);
  const [hibernateUntil, setHibernateUntil] = useState(task.hibernateUntil ?? '');

  const handleAddQuantity = () => {
    setQuantities([...quantities, { label: '', value: 0, unit: '' }]);
  };

  const handleRemoveQuantity = (index: number) => {
    setQuantities(quantities.filter((_, i) => i !== index));
  };

  const handleQuantityChange = (
    index: number,
    field: keyof Quantity,
    value: string | number,
  ) => {
    const updated = quantities.map((q, i) => {
      if (i !== index) return q;
      return { ...q, [field]: field === 'value' ? Number(value) || 0 : value };
    });
    setQuantities(updated);
  };

  // Subtask handlers
  const handleAddSubtask = () => {
    const trimmed = newSubtaskTitle.trim();
    if (!trimmed) return;
    setSubtasks(addSubtask(subtasks, trimmed));
    setNewSubtaskTitle('');
  };

  const handleToggleSubtask = (subId: string) => {
    setSubtasks(toggleSubtask(subtasks, subId));
  };

  const handleDeleteSubtask = (subId: string) => {
    setSubtasks(deleteSubtask(subtasks, subId));
  };

  const handleSave = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    dispatch({
      type: 'UPDATE_TASK',
      payload: {
        taskId: task.id,
        patch: {
          title: trimmedTitle,
          category: category || categories[0],
          priority,
          deadline: deadline || null,
          notes,
          quantities,
          subtasks,
          projectId: projectId || null,
          isLeaderAssigned,
          leaderSource: isLeaderAssigned ? leaderSource.trim() : undefined,
          leaderAssignedDate: isLeaderAssigned ? leaderAssignedDate || undefined : undefined,
          leaderDeadline: isLeaderAssigned ? leaderDeadline || undefined : undefined,
          isCrossYear,
          hibernateUntil: isCrossYear && hibernateUntil ? hibernateUntil : null,
        },
      },
    });

    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className={styles.overlay}
      onClick={handleOverlayClick}
      role="dialog"
      aria-label="编辑任务"
    >
      <div className={styles.panel}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>编辑任务</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        {/* Basic fields */}
        <div className={styles.section}>
          <div className={styles.field}>
            <label className={styles.label}>任务标题</label>
            <input
              className={styles.input}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>分类</label>
            <select
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
            <label className={styles.label}>关联项目</label>
            <select
              className={styles.select}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">无</option>
              {projects
                .filter((p) => p.status !== 'archived')
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>优先级</label>
            <div style={{ display: 'flex', gap: 4 }}>
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  style={{
                    padding: '6px 14px',
                    border: '1px solid #d0d0d0',
                    borderRadius: 6,
                    fontSize: 13,
                    cursor: 'pointer',
                    background:
                      priority === p.value
                        ? p.value === 'urgent'
                          ? '#e53935'
                          : p.value === 'important'
                            ? '#fb8c00'
                            : '#757575'
                        : '#fff',
                    color: priority === p.value ? '#fff' : '#555',
                    borderColor: priority === p.value ? 'transparent' : '#d0d0d0',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>截止日期</label>
            <input
              className={styles.input}
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>备注</label>
            <textarea
              className={styles.textarea}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="备注内容…"
            />
          </div>
        </div>

        {/* 领导交办 toggle */}
        <div className={styles.section}>
          <div className={styles.toggleRow}>
            <span className={styles.toggleLabel}>领导交办</span>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={isLeaderAssigned}
                onChange={(e) => setIsLeaderAssigned(e.target.checked)}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>

          {isLeaderAssigned && (
            <div className={styles.leaderFields}>
              <div className={styles.field}>
                <label className={styles.label}>交办来源</label>
                <input
                  className={styles.input}
                  type="text"
                  value={leaderSource}
                  onChange={(e) => setLeaderSource(e.target.value)}
                  placeholder="谁交办的？"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>交办时间</label>
                <input
                  className={styles.input}
                  type="date"
                  value={leaderAssignedDate}
                  onChange={(e) => setLeaderAssignedDate(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>完成时限</label>
                <input
                  className={styles.input}
                  type="date"
                  value={leaderDeadline}
                  onChange={(e) => setLeaderDeadline(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* 量化产出 */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <span>量化产出</span>
            {quantities.length > 0 && (
              <span style={{ fontWeight: 400, fontSize: 12, color: '#999' }}>
                ({quantities.length}项)
              </span>
            )}
          </div>

          <div className={styles.quantityList}>
            {quantities.map((q, index) => (
              <div key={index} className={styles.quantityRow}>
                <input
                  className={styles.input}
                  type="text"
                  value={q.label}
                  onChange={(e) =>
                    handleQuantityChange(index, 'label', e.target.value)
                  }
                  placeholder="产出名称"
                />
                <input
                  className={styles.inputNumber}
                  type="number"
                  value={q.value || ''}
                  onChange={(e) =>
                    handleQuantityChange(index, 'value', e.target.value)
                  }
                  placeholder="数值"
                />
                <input
                  className={styles.inputUnit}
                  type="text"
                  value={q.unit}
                  onChange={(e) =>
                    handleQuantityChange(index, 'unit', e.target.value)
                  }
                  placeholder="单位"
                />
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => handleRemoveQuantity(index)}
                  aria-label="删除产出"
                  title="删除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className={styles.addQuantityBtn}
            onClick={handleAddQuantity}
          >
            + 添加产出
          </button>
        </div>

        {/* 子任务 */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <span>子任务</span>
            {subtasks.length > 0 && (
              <span style={{ fontWeight: 400, fontSize: 12, color: '#999' }}>
                ({subtasks.filter((s) => s.status === 'done').length}/{subtasks.length})
              </span>
            )}
          </div>

          <div className={styles.quantityList}>
            {subtasks.map((sub) => (
              <div key={sub.id} className={styles.quantityRow}>
                <input
                  type="checkbox"
                  checked={sub.status === 'done'}
                  onChange={() => handleToggleSubtask(sub.id)}
                  style={{ width: 18, height: 18, cursor: 'pointer', flexShrink: 0 }}
                />
                <span
                  style={{
                    flex: 1,
                    fontSize: 14,
                    textDecoration: sub.status === 'done' ? 'line-through' : 'none',
                    color: sub.status === 'done' ? '#999' : '#333',
                  }}
                >
                  {sub.title}
                </span>
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => handleDeleteSubtask(sub.id)}
                  aria-label="删除子任务"
                  title="删除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input
              className={styles.input}
              type="text"
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSubtask();
                }
              }}
              placeholder="添加子任务步骤…"
            />
            <button
              type="button"
              className={styles.addQuantityBtn}
              onClick={handleAddSubtask}
              style={{ marginTop: 0 }}
            >
              + 添加
            </button>
          </div>
        </div>

        {/* 跨年休眠 */}
        <div className={styles.section}>
          <div className={styles.toggleRow}>
            <span className={styles.toggleLabel}>跨年休眠</span>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={isCrossYear}
                onChange={(e) => {
                  setIsCrossYear(e.target.checked);
                  if (
                    e.target.checked &&
                    !hibernateUntil &&
                    deadline
                  ) {
                    const d = calcDefaultHibernateUntil(deadline);
                    if (d) setHibernateUntil(d);
                  }
                }}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>

          {isCrossYear && (
            <div className={styles.leaderFields}>
              <div className={styles.field}>
                <label className={styles.label}>
                  休眠至
                  <span style={{ fontWeight: 400, fontSize: 12, color: '#999' }}>
                    （默认截止前 60 天）
                  </span>
                </label>
                <input
                  className={styles.input}
                  type="date"
                  value={hibernateUntil}
                  onChange={(e) => setHibernateUntil(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>
            取消
          </button>
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={!title.trim()}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
