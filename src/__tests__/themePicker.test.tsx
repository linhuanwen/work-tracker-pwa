import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

/** Convert hex like #4a6cf7 to rgb(74, 108, 247) for jsdom comparison */
function hexToRgb(hex: string): string {
  const h = hex.replace(/^#/, '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

// ============================================================
// Seam S3: ThemePicker UI component
// ============================================================

const PRESET_COLORS = [
  { name: '蓝色', hex: '#4a6cf7' },
  { name: '绿色', hex: '#18a058' },
  { name: '橙色', hex: '#f0a020' },
  { name: '紫色', hex: '#7c3aed' },
];

describe('ThemePicker', () => {
  let PrimaryColorProvider: React.ComponentType<{ children: React.ReactNode }>;
  let ThemePicker: React.ComponentType;

  beforeEach(async () => {
    localStorage.removeItem('wjl-primary-color');
    document.documentElement.style.removeProperty('--color-primary');
    document.documentElement.style.removeProperty('--color-primary-hover');
    document.documentElement.style.removeProperty('--color-primary-active');

    const ctxMod = await import('../ThemeContext');
    PrimaryColorProvider = ctxMod.PrimaryColorProvider;
    const pickerMod = await import('../ThemePicker');
    ThemePicker = pickerMod.ThemePicker;
  });

  afterEach(() => {
    localStorage.removeItem('wjl-primary-color');
    document.documentElement.style.removeProperty('--color-primary');
    document.documentElement.style.removeProperty('--color-primary-hover');
    document.documentElement.style.removeProperty('--color-primary-active');
  });

  // ---- Rendering ----

  it('renders four color swatch buttons', () => {
    render(
      <PrimaryColorProvider>
        <ThemePicker />
      </PrimaryColorProvider>,
    );

    for (const { name } of PRESET_COLORS) {
      expect(screen.getByLabelText(name)).toBeDefined();
    }
  });

  it('renders each swatch with the correct background color', () => {
    render(
      <PrimaryColorProvider>
        <ThemePicker />
      </PrimaryColorProvider>,
    );

    for (const { name, hex } of PRESET_COLORS) {
      const btn = screen.getByLabelText(name);
      expect(btn.style.backgroundColor).toBe(hexToRgb(hex));
    }
  });

  // ---- Selection ----

  it('highlights the default color (#4a6cf7) as selected on mount', () => {
    render(
      <PrimaryColorProvider>
        <ThemePicker />
      </PrimaryColorProvider>,
    );

    const blueBtn = screen.getByLabelText('蓝色');
    expect(blueBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('non-selected swatches have aria-pressed="false"', () => {
    render(
      <PrimaryColorProvider>
        <ThemePicker />
      </PrimaryColorProvider>,
    );

    const greenBtn = screen.getByLabelText('绿色');
    const orangeBtn = screen.getByLabelText('橙色');
    const purpleBtn = screen.getByLabelText('紫色');

    expect(greenBtn.getAttribute('aria-pressed')).toBe('false');
    expect(orangeBtn.getAttribute('aria-pressed')).toBe('false');
    expect(purpleBtn.getAttribute('aria-pressed')).toBe('false');
  });

  // ---- Interaction ----

  it('switches selection when clicking a different color', () => {
    render(
      <PrimaryColorProvider>
        <ThemePicker />
      </PrimaryColorProvider>,
    );

    const greenBtn = screen.getByLabelText('绿色');
    fireEvent.click(greenBtn);

    expect(greenBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('persists the selected color to localStorage on click', () => {
    render(
      <PrimaryColorProvider>
        <ThemePicker />
      </PrimaryColorProvider>,
    );

    fireEvent.click(screen.getByLabelText('紫色'));

    expect(localStorage.getItem('wjl-primary-color')).toBe('#7c3aed');
  });

  it('updates CSS custom properties on click', () => {
    render(
      <PrimaryColorProvider>
        <ThemePicker />
      </PrimaryColorProvider>,
    );

    fireEvent.click(screen.getByLabelText('橙色'));

    expect(document.documentElement.style.getPropertyValue('--color-primary'))
      .toBe('#f0a020');
    expect(document.documentElement.style.getPropertyValue('--color-primary-hover'))
      .toBe('#f2aa36');
    expect(document.documentElement.style.getPropertyValue('--color-primary-active'))
      .toBe('#d38d1c');
  });

  it('updates aria-pressed across all buttons on selection change', () => {
    render(
      <PrimaryColorProvider>
        <ThemePicker />
      </PrimaryColorProvider>,
    );

    // Click green
    fireEvent.click(screen.getByLabelText('绿色'));

    expect(screen.getByLabelText('蓝色').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByLabelText('绿色').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByLabelText('橙色').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByLabelText('紫色').getAttribute('aria-pressed')).toBe('false');

    // Then click purple
    fireEvent.click(screen.getByLabelText('紫色'));

    expect(screen.getByLabelText('蓝色').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByLabelText('绿色').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByLabelText('橙色').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByLabelText('紫色').getAttribute('aria-pressed')).toBe('true');
  });
});
