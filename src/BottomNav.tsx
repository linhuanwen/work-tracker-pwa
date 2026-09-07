import { Icon } from './Icon';
import styles from './BottomNav.module.css';

export type Page = 'ongoing' | 'completed' | 'reports' | 'settings';

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
        className={`${styles.tab} ${currentPage === 'ongoing' ? styles.active : ''}`}
        onClick={() => onNavigate('ongoing')}
      >
        <span className={styles.icon}>
          <Icon name="clipboard-list" size={20} />
        </span>
        <span className={styles.label}>进行中</span>
      </button>

      <button
        className={`${styles.tab} ${currentPage === 'completed' ? styles.active : ''}`}
        onClick={() => onNavigate('completed')}
      >
        <span className={styles.icon}>
          <Icon name="check-circle" size={20} />
        </span>
        <span className={styles.label}>已完成</span>
      </button>

      {hibernatingCount > 0 && (
        <button className={styles.hibernateBtn} onClick={onOpenHibernate}>
          <span className={styles.icon}>
            <Icon name="moon" size={20} />
          </span>
          <span className={styles.label}>休眠 ({hibernatingCount})</span>
        </button>
      )}

      <button
        className={`${styles.tab} ${currentPage === 'reports' ? styles.active : ''}`}
        onClick={() => onNavigate('reports')}
      >
        <span className={styles.icon}>
          <Icon name="bar-chart-3" size={20} />
        </span>
        <span className={styles.label}>报表</span>
      </button>

      <button
        className={`${styles.tab} ${currentPage === 'settings' ? styles.active : ''}`}
        onClick={() => onNavigate('settings')}
      >
        <span className={styles.icon}>
          <Icon name="settings" size={20} />
        </span>
        <span className={styles.label}>设置</span>
      </button>
    </nav>
  );
}
