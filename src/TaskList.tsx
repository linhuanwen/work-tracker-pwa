import { useState } from 'react';
import type { Task, TaskStatus } from './types';
import type { UpdateTaskPatch } from './taskUtils';
import { filterActiveTasks, filterCancelledTasks, groupTasksByPriority } from './taskUtils';
import { TaskCard } from './TaskCard';
import { UrgentZone } from './UrgentZone';
import styles from './TaskList.module.css';

// ============================================================
// Props
// ============================================================

interface TaskListProps {
  tasks: Task[];
  categories: string[];
  onTransitionStatus: (taskId: string, newStatus: TaskStatus) => void;
  onUpdateTask: (taskId: string, patch: UpdateTaskPatch) => void;
  onEditTask: (task: Task) => void;
  onMoveUrgentUp: (taskId: string) => void;
  onMoveUrgentDown: (taskId: string) => void;
  toast: (message: string) => void;
}

// ============================================================
// 常量
// ============================================================

const GROUP_CONFIG = {
  urgent: {
    label: '紧急',
    dotClass: styles.groupDotUrgent,
  },
  important: {
    label: '重要',
    dotClass: styles.groupDotImportant,
  },
  normal: {
    label: '日常任务',
    dotClass: styles.groupDotNormal,
  },
} as const;

// ============================================================
// Component
// ============================================================

export function TaskList({
  tasks,
  categories,
  onTransitionStatus,
  onUpdateTask,
  onEditTask,
  onMoveUrgentUp,
  onMoveUrgentDown,
  toast: _toast,
}: TaskListProps) {
  const active = filterActiveTasks(tasks);
  const cancelled = filterCancelledTasks(tasks);
  const groups = groupTasksByPriority(active);

  const [archiveOpen, setArchiveOpen] = useState(false);

  return (
    <div className={styles.container}>
      {/* ================================================ */}
      {/* 紧急区 */}
      {/* ================================================ */}
      <UrgentZone
        tasks={groups.urgent}
        onEditTask={onEditTask}
        onMoveUp={onMoveUrgentUp}
        onMoveDown={onMoveUrgentDown}
      />

      {/* ================================================ */}
      {/* 活跃任务（按优先级分组，紧急区已提走） */}
      {/* ================================================ */}
      {active.length === 0 && cancelled.length === 0 && (
        <div className={styles.empty}>
          暂无任务。在上方输入框添加第一个任务吧。
        </div>
      )}

      {active.length === 0 && cancelled.length > 0 && (
        <div className={styles.empty}>
          所有任务已归档。在下方"已归档"区查看已取消的任务。
        </div>
      )}

      {/* Only important and normal groups (urgent is in UrgentZone) */}
      {(['important', 'normal'] as const).map((priority) => {
        const groupTasks = groups[priority];
        if (groupTasks.length === 0) return null;
        const cfg = GROUP_CONFIG[priority];
        return (
          <div key={priority} className={styles.group}>
            <div className={styles.groupHeader}>
              <span
                className={`${styles.groupDot} ${cfg.dotClass}`}
                aria-hidden="true"
              />
              <span className={styles.groupTitle}>{cfg.label}</span>
              <span className={styles.groupCount}>
                {groupTasks.length}
              </span>
            </div>
            <div className={styles.cards}>
              {groupTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  categories={categories}
                  onTransitionStatus={onTransitionStatus}
                  onUpdateTask={onUpdateTask}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* ================================================ */}
      {/* 已归档折叠区（取消的任务） */}
      {/* ================================================ */}
      {cancelled.length > 0 && (
        <div className={styles.archiveSection}>
          <button
            className={styles.archiveToggle}
            onClick={() => setArchiveOpen((prev) => !prev)}
            type="button"
          >
            <span
              className={`${styles.archiveArrow} ${archiveOpen ? styles.archiveArrowOpen : ''}`}
              aria-hidden="true"
            >
              ▸
            </span>
            已归档
            <span className={styles.archiveCount}>{cancelled.length}</span>
          </button>

          {archiveOpen && (
            <div className={styles.archiveCards}>
              {cancelled.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  categories={categories}
                  onTransitionStatus={onTransitionStatus}
                  onUpdateTask={onUpdateTask}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
