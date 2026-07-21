import styles from './Fab.module.css';

interface FabProps {
  onClick: () => void;
  label?: string;
}

/**
 * FAB — 浮动操作按钮
 *
 * 固定在右下角的蓝色圆形 + 图标按钮。手机端始终可见（44px+ 触摸目标）。
 * 桌面端 hover 有放大效果。点击后滚动到顶部 AddTaskForm 并聚焦输入框。
 */
export function Fab({ onClick, label = '添加任务' }: FabProps) {
  return (
    <button
      className={styles.fab}
      onClick={onClick}
      aria-label={label}
      title={label}
      type="button"
    >
      <span className={styles.fabIcon} aria-hidden="true">+</span>
    </button>
  );
}
