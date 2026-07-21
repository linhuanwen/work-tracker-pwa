import styles from './BottomNav.module.css';

export type Page = 'tasks' | 'reports' | 'settings';

interface BottomNavProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  hibernatingCount: number;
  onOpenHibernate: () => void;
}

export function BottomNav({
  currentPage,
  onNavigate,
  hibernatingCount,
  onOpenHibernate,
}: BottomNavProps) {
  return (
    <nav className={styles.nav}>
      <button
        className={`${styles.tab} ${currentPage === 'tasks' ? styles.active : ''}`}
        onClick={() => onNavigate('tasks')}
      >
        <span className={styles.icon}>📋</span>
        <span className={styles.label}>任务</span>
      </button>

      {hibernatingCount > 0 && (
        <button className={styles.hibernateBtn} onClick={onOpenHibernate}>
          <span className={styles.icon}>💤</span>
          <span className={styles.label}>休眠 ({hibernatingCount})</span>
        </button>
      )}

      <button
        className={`${styles.tab} ${currentPage === 'reports' ? styles.active : ''}`}
        onClick={() => onNavigate('reports')}
      >
        <span className={styles.icon}>📊</span>
        <span className={styles.label}>报表</span>
      </button>

      <button
        className={`${styles.tab} ${currentPage === 'settings' ? styles.active : ''}`}
        onClick={() => onNavigate('settings')}
      >
        <span className={styles.icon}>⚙️</span>
        <span className={styles.label}>设置</span>
      </button>
    </nav>
  );
}
