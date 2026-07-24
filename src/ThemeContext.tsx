import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';

// ============================================================
// Types
// ============================================================

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  resolved: ResolvedTheme;
  setTheme: (t: Theme) => void;
}

// ============================================================
// Helpers
// ============================================================

const STORAGE_KEY = 'wjl-theme';

function getSystemPreference(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === 'system') return getSystemPreference();
  return theme;
}

function applyDataAttribute(resolved: ResolvedTheme) {
  document.documentElement.setAttribute('data-theme', resolved);
}

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // localStorage unavailable — use default
  }
  return 'system';
}

// ============================================================
// Context
// ============================================================

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const resolved = resolveTheme(theme);

  // Apply data-theme attribute whenever resolved changes
  useEffect(() => {
    applyDataAttribute(resolved);
  }, [resolved]);

  // Listen for system preference changes when theme is "system"
  useEffect(() => {
    if (theme !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      applyDataAttribute(resolveTheme('system'));
    };

    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // localStorage unavailable — silently ignore
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}

// ============================================================
// Primary Color — theme accent color with localStorage + DOM
// ============================================================

import { computeColorVariants } from './colorUtils';

const PRIMARY_COLOR_KEY = 'wjl-primary-color';
const DEFAULT_PRIMARY = '#4a6cf7';

function readStoredPrimaryColor(): string {
  try {
    const stored = localStorage.getItem(PRIMARY_COLOR_KEY);
    if (stored && /^#[0-9a-fA-F]{6}$/.test(stored)) {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }
  return DEFAULT_PRIMARY;
}

function applyPrimaryColor(hex: string) {
  const variants = computeColorVariants(hex);
  document.documentElement.style.setProperty('--color-primary', variants.primary);
  document.documentElement.style.setProperty('--color-primary-hover', variants.hover);
  document.documentElement.style.setProperty('--color-primary-active', variants.active);
}

interface PrimaryColorContextValue {
  primaryColor: string;
  setPrimaryColor: (hex: string) => void;
}

const PrimaryColorContext = createContext<PrimaryColorContextValue | null>(null);

export function PrimaryColorProvider({ children }: { children: ReactNode }) {
  const [primaryColor, setPrimaryColorState] = useState<string>(readStoredPrimaryColor);

  useEffect(() => {
    applyPrimaryColor(primaryColor);
  }, [primaryColor]);

  const setPrimaryColor = useCallback((hex: string) => {
    setPrimaryColorState(hex);
    try {
      localStorage.setItem(PRIMARY_COLOR_KEY, hex);
    } catch {
      // localStorage unavailable
    }
  }, []);

  return (
    <PrimaryColorContext.Provider value={{ primaryColor, setPrimaryColor }}>
      {children}
    </PrimaryColorContext.Provider>
  );
}

export function usePrimaryColor(): PrimaryColorContextValue {
  const ctx = useContext(PrimaryColorContext);
  if (!ctx) {
    throw new Error('usePrimaryColor must be used within a PrimaryColorProvider');
  }
  return ctx;
}
