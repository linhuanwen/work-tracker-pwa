import type { Task } from './types';
import styles from './UrgentZone.module.css';

interface UrgentZoneProps {
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onMoveUp: (taskId: string) => void;
  onMoveDown: (taskId: string) => void;
}

export function UrgentZone({
  tasks,
  onEditTask,
  onMoveUp,
  onMoveDown,
}: UrgentZoneProps) {
  if (tasks.length === 0) return null;

  return (
    <div className={styles.zone}>
      <div className={styles.header}>
        <span className={styles.headerIcon} aria-hidden="true">
          🔴
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

              {/* Up/down reorder arrows */}
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
                  ▲
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
                  ▼
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
