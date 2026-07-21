import type { Task, TaskStatus } from './types';
import { useData } from './DataContext';
import { calcProjectProgress, getProgressColor } from './taskUtils';
import styles from './ProjectDetailPage.module.css';

interface ProjectDetailPageProps {
  projectId: string;
  onNavigate: (to: string) => void;
  onEditTask: (task: Task) => void;
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  'todo': '待办',
  'in-progress': '进行中',
  'done': '已完成',
  'cancelled': '已取消',
};

const STATUS_ORDER: TaskStatus[] = ['in-progress', 'todo', 'done', 'cancelled'];

export function ProjectDetailPage({ projectId, onNavigate, onEditTask }: ProjectDetailPageProps) {
  const { data } = useData();
  const projects = data?.projects ?? [];
  const tasks = data?.tasks ?? [];

  const project = projects.find((p) => p.id === projectId);

  if (!project) {
    return (
      <div className={styles.container}>
        <button className={styles.backBtn} onClick={() => onNavigate('/projects')}>
          ← 返回
        </button>
        <div className={styles.empty}>项目不存在或已被删除。</div>
      </div>
    );
  }

  const projectTasks = tasks.filter((t) => t.projectId === projectId);
  const progress = calcProjectProgress(projectTasks);
  const percent = progress.total > 0
    ? Math.floor((progress.done / progress.total) * 100)
    : 0;
  const activeCount = projectTasks.filter(
    (t) => t.status !== 'done' && t.status !== 'cancelled',
  ).length;
  const doneCount = projectTasks.filter((t) => t.status === 'done').length;

  // Group tasks by status
  const grouped: Record<TaskStatus, Task[]> = {
    'todo': [],
    'in-progress': [],
    'done': [],
    'cancelled': [],
  };
  for (const t of projectTasks) {
    grouped[t.status].push(t);
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <button className={styles.backBtn} onClick={() => onNavigate('/projects')}>
        ← 返回项目列表
      </button>

      {/* Project summary */}
      <div className={styles.summary}>
        <h1 className={styles.projectTitle}>{project.title}</h1>
        <div className={styles.summaryMeta}>
          <span className={styles.categoryTag}>{project.category}</span>
          {project.targetDate && (
            <span className={styles.dateTag}>目标 {project.targetDate}</span>
          )}
          <span className={styles.statTag}>
            {activeCount} 活跃 · {doneCount} 完成
          </span>
        </div>

        {/* Overall progress */}
        {progress.total > 0 && (
          <div className={styles.progressRow}>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{
                  width: `${percent}%`,
                  background: getProgressColor(percent),
                }}
              />
            </div>
            <span className={styles.progressText}>
              {progress.done}/{progress.total} ({percent}%)
            </span>
          </div>
        )}

        {project.notes && <p className={styles.notes}>{project.notes}</p>}
      </div>

      {/* Tasks grouped by status */}
      {projectTasks.length === 0 && (
        <div className={styles.empty}>
          该项目下暂无任务。在任务编辑面板中将任务关联到此项目即可。
        </div>
      )}

      {STATUS_ORDER.map((status) => {
        const groupTasks = grouped[status];
        if (groupTasks.length === 0) return null;
        return (
          <div key={status} className={styles.statusGroup}>
            <div className={styles.statusHeader}>
              <span className={styles.statusLabel}>{STATUS_LABELS[status]}</span>
              <span className={styles.statusCount}>{groupTasks.length}</span>
            </div>
            <div className={styles.taskList}>
              {groupTasks.map((task) => (
                <div
                  key={task.id}
                  className={styles.taskCard}
                  onClick={() => onEditTask(task)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onEditTask(task);
                  }}
                >
                  <span className={styles.taskTitle}>{task.title}</span>
                  <span className={styles.taskPriority}>
                    {task.priority === 'urgent' ? '紧急' : task.priority === 'important' ? '重要' : '日常'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
