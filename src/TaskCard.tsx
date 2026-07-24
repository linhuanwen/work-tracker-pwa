import { useState, useCallback } from 'react';
import type { Task, TaskStatus, Priority } from './types';
import type { UpdateTaskPatch } from './taskUtils';
import { calcSubtaskProgress, getProgressColor } from './taskUtils';
import { Tag } from './Tag';
import { ConfirmDialog } from './ConfirmDialog';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';
import { Icon } from './Icon';
import styles from './TaskCard.module.css';

// ============================================================
// 常量
// ============================================================

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: '待办' },
  { value: 'in-progress', label: '进行中' },
  { value: 'done', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
];

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'urgent', label: '紧急' },
  { value: 'important', label: '重要' },
  { value: 'normal', label: '日常' },
];

const STATUS_CLASS: Record<TaskStatus, string> = {
  'todo': styles.statusTodo,
  'in-progress': styles.statusInProgress,
  'done': styles.statusDone,
  'cancelled': styles.statusCancelled,
};

// ============================================================
// Props
// ============================================================

interface TaskCardProps {
  task: Task;
  categories: string[];
  onTransitionStatus: (taskId: string, newStatus: TaskStatus) => void;
  onUpdateTask: (taskId: string, patch: UpdateTaskPatch) => void;
  onDelete?: (taskId: string) => void;
}

// ============================================================
// Component
// ============================================================

export function TaskCard({
  task,
  categories,
  onTransitionStatus,
  onUpdateTask,
  onDelete,
}: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
  }>({ open: false, x: 0, y: 0 });

  const toggleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      e.stopPropagation();
      const newStatus = e.target.value as TaskStatus;
      if (newStatus !== task.status) {
        onTransitionStatus(task.id, newStatus);
      }
    },
    [task.id, task.status, onTransitionStatus],
  );

  const handleFieldChange = useCallback(
    (patch: UpdateTaskPatch) => {
      onUpdateTask(task.id, patch);
    },
    [task.id, onUpdateTask],
  );

  // Context menu
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setCtxMenu({ open: true, x: e.clientX, y: e.clientY });
    },
    [],
  );

  const closeContextMenu = useCallback(() => {
    setCtxMenu((prev) => ({ ...prev, open: false }));
  }, []);

  const handleCopyTitle = useCallback(() => {
    navigator.clipboard.writeText(task.title).catch(() => {
      // Fallback: silently ignore — non-secure context or permission denied
    });
  }, [task.title]);

  const handleToggleComplete = useCallback(() => {
    const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done';
    onTransitionStatus(task.id, newStatus);
  }, [task.id, task.status, onTransitionStatus]);

  const ctxMenuItems: ContextMenuItem[] = [
    {
      id: 'edit',
      label: '编辑',
      icon: 'pen-line',
      onClick: () => setExpanded(true),
    },
    {
      id: 'copy-title',
      label: '复制标题',
      icon: 'copy',
      onClick: handleCopyTitle,
    },
    {
      id: 'toggle-complete',
      label: task.status === 'done' ? '标记为待办' : '切换完成状态',
      icon: 'check-circle',
      onClick: handleToggleComplete,
    },
    { id: 'sep-1', label: '', separator: true },
    {
      id: 'delete',
      label: '删除',
      icon: 'x',
      danger: true,
      onClick: () => setConfirmDelete(true),
    },
  ];

  const isCancelled = task.status === 'cancelled';
  const isDone = task.status === 'done';

  // Subtask progress
  const subtaskProgress = calcSubtaskProgress(task.subtasks);
  const hasSubtasks = subtaskProgress.total > 0;
  const allSubtasksDone = hasSubtasks && subtaskProgress.done === subtaskProgress.total;
  const progressColor = getProgressColor(subtaskProgress.percent);

  return (
    <div className={styles.card} onContextMenu={handleContextMenu}>
      {/* ================================================ */}
      {/* 折叠视图 */}
      {/* ================================================ */}
      <div
        className={`${styles.cardHeader} ${expanded ? styles.cardHeaderExpanded : ''}`}
        onClick={toggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleExpand();
          }
        }}
      >
        {/* 优先级图标：日常=白色圆点 / 重要=黄色小旗 */}
        <span className={styles.priorityIcon} aria-hidden="true">
          {task.priority === 'important' ? (
            <Icon name="flag" size={14} color="var(--color-warning)" />
          ) : (
            <Icon name="circle" size={10} color="#ffffff" />
          )}
        </span>

        {/* 主体 */}
        <div className={styles.body}>
          <p
            className={`${styles.title} ${isDone ? styles.titleDone : ''} ${isCancelled ? styles.titleCancelled : ''}`}
          >
            {task.title}
          </p>

          <div className={styles.meta}>
            <Tag variant="category">{task.category}</Tag>

            <Tag variant="priority" level={task.priority}>
              {PRIORITY_OPTIONS.find((p) => p.value === task.priority)?.label}
            </Tag>

            {task.deadline && (
              <Tag variant="date">{task.deadline}</Tag>
            )}

            {task.isLeaderAssigned && (
              <span className={styles.leaderBadge}>交办</span>
            )}

            {task.quantities.length > 0 &&
              task.quantities.map((q, qi) => (
                <span key={qi} className={styles.quantityTag}>
                  {q.label}: {q.value}
                  {q.unit}
                </span>
              ))}
          </div>

          {/* 子任务进度条 */}
          {hasSubtasks && (
            <div
              className={styles.subtaskProgress}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.subtaskProgressTrack}>
                <div
                  className={styles.subtaskProgressFill}
                  style={{
                    width: `${subtaskProgress.percent}%`,
                    background: progressColor,
                  }}
                />
              </div>
              <span className={styles.subtaskProgressCount}>
                {subtaskProgress.done}/{subtaskProgress.total}
              </span>
              {/* 全部子任务完成后显示"确认完成"按钮；已完成的父任务不显示 */}
              {allSubtasksDone && !isDone && (
                <button
                  type="button"
                  className={styles.subtaskDoneBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTransitionStatus(task.id, 'done');
                  }}
                >
                  确认完成？
                </button>
              )}
            </div>
          )}

        </div>

        {/* 状态切换下拉 */}
        <select
          className={`${styles.statusSelect} ${STATUS_CLASS[task.status]}`}
          value={task.status}
          onChange={handleStatusChange}
          onClick={(e) => e.stopPropagation()}
          aria-label="任务状态"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* 删除按钮 */}
        {onDelete && (
          <button
            type="button"
            className={styles.deleteBtn}
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(true);
            }}
            aria-label="删除任务"
            title="删除"
          >
            <Icon name="x" size={16} />
          </button>
        )}

        {/* 展开箭头 */}
        <span
          className={`${styles.expandArrow} ${expanded ? styles.expandArrowOpen : ''}`}
          aria-hidden="true"
        >
          <Icon name="chevron-right" size={16} />
        </span>
      </div>

      {/* ================================================ */}
      {/* 行内编辑面板（展开时可见） */}
      {/* ================================================ */}
      {expanded && (
        <div
          className={styles.editPanel}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 标题 */}
          <label className={styles.editLabel}>
            标题
            <input
              className={styles.editInput}
              type="text"
              value={task.title}
              onChange={(e) => handleFieldChange({ title: e.target.value })}
            />
          </label>

          {/* 分类 + 优先级 同行 */}
          <div className={styles.editRow}>
            <label className={styles.editLabel}>
              分类
              <select
                className={styles.editSelect}
                value={task.category}
                onChange={(e) =>
                  handleFieldChange({ category: e.target.value })
                }
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.editLabel}>
              优先级
              <div className={styles.priorityBtnGroup}>
                {PRIORITY_OPTIONS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className={`${styles.priorityBtn} ${
                      task.priority === p.value
                        ? styles.priorityBtnActive
                        : ''
                    }`}
                    onClick={() => handleFieldChange({ priority: p.value })}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </label>
          </div>

          {/* 截止日期 */}
          <label className={styles.editLabel}>
            截止日期
            <input
              className={styles.editInput}
              type="date"
              value={task.deadline ?? ''}
              onChange={(e) =>
                handleFieldChange({
                  deadline: e.target.value || null,
                })
              }
            />
          </label>

          {/* 具体内容 */}
          <label className={styles.editLabel}>
            具体内容
            <textarea
              className={styles.editTextarea}
              rows={2}
              value={task.notes}
              onChange={(e) => handleFieldChange({ notes: e.target.value })}
              placeholder="添加具体内容…"
            />
          </label>

          {/* 领导交办 toggle */}
          <div className={styles.toggleRow}>
            <span className={styles.toggleLabel}>领导交办</span>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={task.isLeaderAssigned}
                onChange={(e) => {
                  const checked = e.target.checked;
                  handleFieldChange({
                    isLeaderAssigned: checked,
                    leaderSource: checked ? (task.leaderSource ?? '') : undefined,
                    leaderAssignedDate: checked
                      ? (task.leaderAssignedDate ?? '')
                      : undefined,
                    leaderDeadline: checked
                      ? (task.leaderDeadline ?? '')
                      : undefined,
                  });
                }}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>

          {task.isLeaderAssigned && (
            <div className={styles.leaderFields}>
              <label className={styles.editLabel}>
                交办来源
                <input
                  className={styles.editInput}
                  type="text"
                  value={task.leaderSource ?? ''}
                  onChange={(e) =>
                    handleFieldChange({ leaderSource: e.target.value })
                  }
                  placeholder="谁交办的？"
                />
              </label>
              <label className={styles.editLabel}>
                交办时间
                <input
                  className={styles.editInput}
                  type="date"
                  value={task.leaderAssignedDate ?? ''}
                  onChange={(e) =>
                    handleFieldChange({
                      leaderAssignedDate: e.target.value || undefined,
                    })
                  }
                />
              </label>
              <label className={styles.editLabel}>
                完成时限
                <input
                  className={styles.editInput}
                  type="date"
                  value={task.leaderDeadline ?? ''}
                  onChange={(e) =>
                    handleFieldChange({
                      leaderDeadline: e.target.value || undefined,
                    })
                  }
                />
              </label>
            </div>
          )}

          {/* 量化产出（多条目） */}
          <div className={styles.editLabel}>
            <span>
              量化产出
              {task.quantities.length > 0 && (
                <span className={styles.editHint}>
                  （{task.quantities.length}项）
                </span>
              )}
            </span>
            <div className={styles.quantityEditList}>
              {task.quantities.map((q, index) => (
                <div key={index} className={styles.quantityEditRow}>
                  <input
                    className={styles.editInput}
                    type="text"
                    value={q.label}
                    onChange={(e) => {
                      const updated = task.quantities.map((item, i) =>
                        i === index ? { ...item, label: e.target.value } : item,
                      );
                      handleFieldChange({ quantities: updated });
                    }}
                    placeholder="产出名称"
                  />
                  <input
                    className={styles.quantityNumberInput}
                    type="number"
                    value={q.value || ''}
                    onChange={(e) => {
                      const updated = task.quantities.map((item, i) =>
                        i === index
                          ? { ...item, value: Number(e.target.value) || 0 }
                          : item,
                      );
                      handleFieldChange({ quantities: updated });
                    }}
                    placeholder="数值"
                  />
                  <input
                    className={styles.quantityUnitInput}
                    type="text"
                    value={q.unit}
                    onChange={(e) => {
                      const updated = task.quantities.map((item, i) =>
                        i === index ? { ...item, unit: e.target.value } : item,
                      );
                      handleFieldChange({ quantities: updated });
                    }}
                    placeholder="单位"
                  />
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => {
                      const updated = task.quantities.filter(
                        (_, i) => i !== index,
                      );
                      handleFieldChange({ quantities: updated });
                    }}
                    aria-label="删除产出"
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
              onClick={() => {
                const updated = [
                  ...task.quantities,
                  { label: '', value: 0, unit: '' },
                ];
                handleFieldChange({ quantities: updated });
              }}
            >
              <Icon name="plus" size={14} /> 添加产出
            </button>
          </div>
        </div>
      )}

      {/* Confirm delete dialog */}
      {onDelete && (
        <ConfirmDialog
          open={confirmDelete}
          title="确认删除"
          message={`确定要删除任务"${task.title}"吗？此操作不可撤销。`}
          onConfirm={() => {
            onDelete(task.id);
            setConfirmDelete(false);
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      {/* Right-click context menu */}
      <ContextMenu
        items={ctxMenuItems}
        x={ctxMenu.x}
        y={ctxMenu.y}
        open={ctxMenu.open}
        onClose={closeContextMenu}
      />
    </div>
  );
}
