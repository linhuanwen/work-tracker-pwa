import type { Task, TaskStatus } from './types';
import type { UpdateTaskPatch } from './taskUtils';
import { TaskCard } from './TaskCard';
import styles from './CompletedTaskList.module.css';

interface CompletedTaskListProps {
  tasks: Task[];
  categories: string[];
  onTransitionStatus: (taskId: string, newStatus: TaskStatus) => void;
  onUpdateTask: (taskId: string, patch: UpdateTaskPatch) => void;
  onDeleteTask: (taskId: string) => void;
}

export function CompletedTaskList({
  tasks,
  categories,
  onTransitionStatus,
  onUpdateTask,
  onDeleteTask,
}: CompletedTaskListProps) {
  if (tasks.length === 0) {
    return <div className={styles.empty}>暂无已完成任务</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>已完成任务</span>
        <span className={styles.headerCount}>{tasks.length}</span>
      </div>
      <div className={styles.cards}>
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            categories={categories}
            onTransitionStatus={onTransitionStatus}
            onUpdateTask={onUpdateTask}
            onDelete={onDeleteTask}
          />
        ))}
      </div>
    </div>
  );
}