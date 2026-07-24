import { usePrimaryColor } from './ThemeContext';
import styles from './ThemePicker.module.css';

const PRESET_COLORS = [
  { name: '蓝色', hex: '#4a6cf7' },
  { name: '绿色', hex: '#18a058' },
  { name: '橙色', hex: '#f0a020' },
  { name: '紫色', hex: '#7c3aed' },
] as const;

export function ThemePicker() {
  const { primaryColor, setPrimaryColor } = usePrimaryColor();

  return (
    <div className={styles.container} role="radiogroup" aria-label="主题色">
      {PRESET_COLORS.map(({ name, hex }) => {
        const isActive = primaryColor === hex;
        return (
          <button
            key={hex}
            className={`${styles.swatch} ${isActive ? styles.swatchActive : ''}`}
            style={{ backgroundColor: hex }}
            role="radio"
            aria-checked={isActive}
            aria-pressed={isActive}
            aria-label={name}
            title={name}
            onClick={() => setPrimaryColor(hex)}
          />
        );
      })}
    </div>
  );
}
