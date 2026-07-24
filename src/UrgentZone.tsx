import { useState } from 'react';
import type { Task } from './types';
import { ConfirmDialog } from './ConfirmDialog';
import { Icon } from './Icon';
import styles from './UrgentZone.module.css';

interface UrgentZoneProps {
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onDeleteTask?: (taskId: string) => void;
  onMoveUp: (taskId: string) => void;
  onMoveDown: (taskId: string) => void;
}

export function UrgentZone({
  tasks,
  onEditTask,
  onDeleteTask,
  onMoveUp,
  onMoveDown,
}: UrgentZoneProps) {
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  if (tasks.length === 0) return null;

  const targetTask = deleteTargetId ? tasks.find(t => t.id === deleteTargetId) : null;

  return (
    <div className={styles.zone}>
      <div className={styles.header}>
        <span className={styles.headerIcon} aria-hidden="true">
          <Icon name="circle" size={12} color="#ef4444" />
        </span>
        <span className={styles.headerTitle}>紧急处理</span>
        <span className={styles.headerCount}>{tasks.length}</span>
      </div>

      <div className={styles.cards}>
        {tasks.map((task, index) => {
          const isDone = task.status === 'done';
          const isFirst = index === 0;
          const isLast = index === tasks.length - 1;

          return (
            <div key={task.id} className={styles.urgentCard}>
              {/* Card body — click to open edit panel */}
              <div
                className={styles.cardBody}
                onClick={() => onEditTask(task)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onEditTask(task);
                  }
                }}
              >
                <p
                  className={`${styles.cardTitle} ${isDone ? styles.cardTitleDone : ''}`}
                >
                  {task.title}
                </p>
                <div className={styles.cardMeta}>
                  <span className={styles.categoryTag}>{task.category}</span>
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
              </div>

              {/* Up/down reorder arrows + delete */}
              <div className={styles.arrows}>
                <button
                  className={styles.arrowBtn}
                  disabled={isFirst}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveUp(task.id);
                  }}
                  aria-label="上移"
                  title="上移"
                >
                  <Icon name="chevron-up" size={16} />
                </button>
                <button
                  className={styles.arrowBtn}
                  disabled={isLast}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveDown(task.id);
                  }}
                  aria-label="下移"
                  title="下移"
                >
                  <Icon name="chevron-down" size={16} />
                </button>
                {onDeleteTask && (
                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTargetId(task.id);
                    }}
                    aria-label="删除任务"
                    title="删除"
                  >
                    <Icon name="x" size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirm delete dialog */}
      {onDeleteTask && targetTask && (
        <ConfirmDialog
          open={deleteTargetId !== null}
          title="确认删除"
          message={`确定要删除紧急任务"${targetTask.title}"吗？此操作不可撤销。`}
          onConfirm={() => {
            onDeleteTask(targetTask.id);
            setDeleteTargetId(null);
          }}
          onCancel={() => setDeleteTargetId(null)}
        />
      )}
    </div>
  );
}
