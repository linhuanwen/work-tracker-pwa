import type { Task } from './types';
import { useData } from './DataContext';
import { formatDate } from './taskUtils';
import { useToast } from './Toast';
import styles from './HibernateDrawer.module.css';

interface HibernateDrawerProps {
  tasks: Task[];
  onClose: () => void;
}

export function HibernateDrawer({ tasks, onClose }: HibernateDrawerProps) {
  const { dispatch } = useData();
  const { showToast } = useToast();

  const handleActivate = (taskId: string) => {
    dispatch({
      type: 'UPDATE_TASK',
      payload: {
        taskId,
        patch: { isCrossYear: false, hibernateUntil: null },
      },
    });
    showToast('任务已激活');
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.drawer}>
        <div className={styles.handle} />
        <div className={styles.header}>
          <h3 className={styles.title}>休眠任务</h3>
          <span className={styles.count}>{tasks.length} 个</span>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {tasks.length === 0 ? (
          <div className={styles.empty}>暂无休眠任务</div>
        ) : (
          <div className={styles.list}>
            {tasks.map((task) => (
              <div key={task.id} className={styles.item}>
                <div className={styles.itemBody}>
                  <p className={styles.itemTitle}>{task.title}</p>
                  <div className={styles.itemMeta}>
                    <span className={styles.itemCategory}>{task.category}</span>
                    {task.hibernateUntil && (
                      <span className={styles.itemDate}>
                        休眠至 {formatDate(task.hibernateUntil)}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className={styles.activateBtn}
                  onClick={() => handleActivate(task.id)}
                >
                  提前激活
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
