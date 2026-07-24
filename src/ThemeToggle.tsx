import { useTheme, type Theme } from './ThemeContext';
import styles from './ThemeToggle.module.css';

const OPTIONS: { value: Theme; label: string; emoji: string }[] = [
  { value: 'light', label: '浅色', emoji: '☀️' },
  { value: 'dark', label: '深色', emoji: '🌙' },
  { value: 'system', label: '跟随系统', emoji: '💻' },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className={styles.container} role="radiogroup" aria-label="主题模式">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          className={`${styles.option} ${theme === opt.value ? styles.optionActive : ''}`}
          role="radio"
          aria-checked={theme === opt.value}
          aria-pressed={theme === opt.value}
          onClick={() => setTheme(opt.value)}
        >
          <span className={styles.emoji}>{opt.emoji}</span>
          <span className={styles.label}>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
