import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ============================================================
// Seam S1: ThemeProvider + useTheme hook
// ============================================================

describe('ThemeProvider + useTheme', () => {
  let ThemeProvider: React.ComponentType<{ children: React.ReactNode }>;
  let useTheme: () => {
    theme: 'light' | 'dark' | 'system';
    resolved: 'light' | 'dark';
    setTheme: (t: 'light' | 'dark' | 'system') => void;
  };

  const localStorageKey = 'wjl-theme';

  beforeEach(async () => {
    localStorage.removeItem(localStorageKey);
    // Default: system prefers light
    window.matchMedia = vi.fn((query: string) => ({
      matches: query === '(prefers-color-scheme: light)' || false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const mod = await import('../ThemeContext');
    ThemeProvider = mod.ThemeProvider;
    useTheme = mod.useTheme;
  });

  afterEach(() => {
    localStorage.removeItem(localStorageKey);
  });

  it('defaults to "system" theme when no localStorage value exists', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });
    expect(result.current.theme).toBe('system');
  });

  it('resolves "system" to "light" when prefers-color-scheme is light', () => {
    window.matchMedia = vi.fn((query: string) => ({
      matches: query === '(prefers-color-scheme: light)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });
    expect(result.current.resolved).toBe('light');
  });

  it('resolves "system" to "dark" when prefers-color-scheme is dark', () => {
    window.matchMedia = vi.fn((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });
    expect(result.current.resolved).toBe('dark');
  });

  it('setTheme("dark") sets theme to dark and resolves to dark', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.theme).toBe('dark');
    expect(result.current.resolved).toBe('dark');
  });

  it('setTheme("light") sets theme to light and resolves to light', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    act(() => {
      result.current.setTheme('light');
    });

    expect(result.current.theme).toBe('light');
    expect(result.current.resolved).toBe('light');
  });

  it('persists theme choice to localStorage', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    act(() => {
      result.current.setTheme('dark');
    });

    expect(localStorage.getItem(localStorageKey)).toBe('dark');
  });

  it('reads persisted theme from localStorage on mount', () => {
    localStorage.setItem(localStorageKey, 'dark');

    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    expect(result.current.theme).toBe('dark');
    expect(result.current.resolved).toBe('dark');
  });

  it('sets data-theme attribute on document.documentElement', () => {
    // System → light
    window.matchMedia = vi.fn((query: string) => ({
      matches: false, // not dark
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    renderHook(() => useTheme(), { wrapper: ThemeProvider });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('sets data-theme="dark" when resolved theme is dark', () => {
    localStorage.setItem(localStorageKey, 'dark');

    renderHook(() => useTheme(), { wrapper: ThemeProvider });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});

// ============================================================
// Seam S2: ThemeToggle component
// ============================================================

describe('ThemeToggle', () => {
  let ThemeProvider: React.ComponentType<{ children: React.ReactNode }>;
  let ThemeToggle: React.ComponentType;

  beforeEach(async () => {
    localStorage.removeItem('wjl-theme');
    window.matchMedia = vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const ctxMod = await import('../ThemeContext');
    ThemeProvider = ctxMod.ThemeProvider;
    const toggleMod = await import('../ThemeToggle');
    ThemeToggle = toggleMod.ThemeToggle;
  });

  afterEach(() => {
    localStorage.removeItem('wjl-theme');
  });

  it('renders three theme option buttons', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(screen.getByText('浅色')).toBeDefined();
    expect(screen.getByText('深色')).toBeDefined();
    expect(screen.getByText('跟随系统')).toBeDefined();
  });

  it('highlights the active theme with aria-pressed="true"', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    // Default is system, so "跟随系统" should be pressed
    const systemBtn = screen.getByText('跟随系统').closest('button')!;
    expect(systemBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('switches theme when clicking a different option', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    const darkBtn = screen.getByText('深色').closest('button')!;
    fireEvent.click(darkBtn);

    // "深色" should now be pressed
    expect(darkBtn.getAttribute('aria-pressed')).toBe('true');

    // localStorage should be updated
    expect(localStorage.getItem('wjl-theme')).toBe('dark');
  });

  it('updates aria-pressed when switching themes', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    const lightBtn = screen.getByText('浅色').closest('button')!;
    const darkBtn = screen.getByText('深色').closest('button')!;
    const systemBtn = screen.getByText('跟随系统').closest('button')!;

    // Default: system
    expect(systemBtn.getAttribute('aria-pressed')).toBe('true');
    expect(lightBtn.getAttribute('aria-pressed')).toBe('false');
    expect(darkBtn.getAttribute('aria-pressed')).toBe('false');

    // Click light
    fireEvent.click(lightBtn);
    expect(lightBtn.getAttribute('aria-pressed')).toBe('true');
    expect(darkBtn.getAttribute('aria-pressed')).toBe('false');
    expect(systemBtn.getAttribute('aria-pressed')).toBe('false');

    // Click dark
    fireEvent.click(darkBtn);
    expect(darkBtn.getAttribute('aria-pressed')).toBe('true');
    expect(lightBtn.getAttribute('aria-pressed')).toBe('false');
    expect(systemBtn.getAttribute('aria-pressed')).toBe('false');
  });
});

// ============================================================
// Seam S3: CSS variable correctness (no hardcoded colors)
// ============================================================

describe('CSS variable usage — no hardcoded colors in module CSS', () => {

  // Hex color values that MUST be replaced by var() references
  // (case-insensitive matching)
  const FORBIDDEN_PATTERNS = [
    { hex: '#4a6cf7', token: 'var(--color-primary)' },
    { hex: '#3b5de7', token: 'var(--color-primary-hover)' },
    { hex: '#2f4cd6', token: 'var(--color-primary-active)' },
    { hex: '#e53935', token: 'var(--color-danger)' },
    { hex: '#c62828', token: 'var(--color-danger-dark)' },
    { hex: '#1a1a1a', token: 'var(--color-text)' },
    { hex: '#333', token: 'var(--color-text-heading)' },
    { hex: '#555', token: 'var(--color-text-secondary)' },
    { hex: '#999', token: 'var(--color-text-muted)' },
    { hex: '#666', token: 'var(--color-text-dim)' },
    { hex: '#b0b0b0', token: 'var(--color-text-faded)' },
  ];

  const CSS_MODULES = [
    'AddTaskForm',
    'App',
    'BottomNav',
    'HibernateDrawer',
    'InstallBanner',
    'MonthlySummary',
    'ProjectDetailPage',
    'ProjectsPage',
    'Reports',
    'Settings',
    'Sidebar',
    'TaskCard',
    'TaskEditPanel',
    'TaskList',
    'Toast',
    'UrgentZone',
    'WeeklySummary',
    'YearlyReport',
  ];

  const SRC_DIR = resolve(process.cwd(), 'src');

  for (const modName of CSS_MODULES) {
    it(`${modName}.module.css has no forbidden hardcoded hex colors`, () => {
      const filePath = resolve(SRC_DIR, `${modName}.module.css`);
      const content = readFileSync(filePath, 'utf-8');

      // Collect lines with forbidden patterns for a clear failure message
      const violations: string[] = [];

      for (const { hex, token } of FORBIDDEN_PATTERNS) {
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // Case-insensitive hex match, but exclude if already wrapped in var()
          if (line.toLowerCase().includes(hex.toLowerCase())) {
            // Skip lines that already use var(--...) for this property
            if (line.includes(token)) continue;
            // Also skip comments
            if (line.trim().startsWith('/*')) continue;
            violations.push(`  Line ${i + 1}: "${line.trim()}" — has ${hex}, should use ${token}`);
          }
        }
      }

      expect(
        violations,
        `\n${modName}.module.css has ${violations.length} hardcoded color(s):\n${violations.join('\n')}\n`,
      ).toHaveLength(0);
    });
  }

  // Validate index.css has the required dark mode tokens
  it('index.css defines [data-theme="dark"] with required color token overrides', () => {
    const filePath = resolve(SRC_DIR, 'index.css');
    const content = readFileSync(filePath, 'utf-8');

    const requiredDarkTokens = [
      '--color-primary',
      '--color-text',
      '--color-text-secondary',
      '--color-text-muted',
      '--color-danger',
      '--page-bg',
      '--glass-bg-card',
      '--glass-bg-overlay',
      '--glass-border',
    ];

    const missingTokens: string[] = [];
    for (const token of requiredDarkTokens) {
      // Look for the token inside [data-theme="dark"]
      const darkSection = content.match(/\[data-theme="dark"\][\s\S]*?(?=\[data-theme|$)/i);
      if (!darkSection || !darkSection[0].includes(token)) {
        missingTokens.push(token);
      }
    }

    expect(missingTokens, `Missing dark-mode tokens: ${missingTokens.join(', ')}`).toHaveLength(0);
  });

  // Validate that index.css defines the extended color tokens in :root
  it('index.css :root defines all required extended color tokens', () => {
    const filePath = resolve(SRC_DIR, 'index.css');
    const content = readFileSync(filePath, 'utf-8');
    const rootSection = content.match(/:root\s*\{([\s\S]*?)\}/);

    const requiredTokens = [
      '--color-text-heading',
      '--color-text-dim',
      '--color-text-faded',
      '--color-danger-dark',
      '--color-warning-dark',
      '--color-status-in-progress',
      '--color-status-done',
      '--color-status-todo',
      '--color-deadline',
      '--color-disabled',
      '--color-border-dashed',
      '--color-surface',
    ];

    if (!rootSection) {
      expect.fail('No :root block found in index.css');
    }

    const missingTokens: string[] = [];
    for (const token of requiredTokens) {
      if (!rootSection![1].includes(token)) {
        missingTokens.push(token);
      }
    }

    expect(missingTokens, `Missing :root tokens: ${missingTokens.join(', ')}`).toHaveLength(0);
  });
});
