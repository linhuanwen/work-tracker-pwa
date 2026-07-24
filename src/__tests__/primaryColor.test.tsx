import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';

// ============================================================
// Seam S2: PrimaryColor context — localStorage + DOM CSS vars
// ============================================================

const STORAGE_KEY = 'wjl-primary-color';

const PRESET_COLORS = [
  { name: '蓝色', hex: '#4a6cf7' },
  { name: '绿色', hex: '#18a058' },
  { name: '橙色', hex: '#f0a020' },
  { name: '紫色', hex: '#7c3aed' },
] as const;

describe('PrimaryColorProvider + usePrimaryColor', () => {
  let PrimaryColorProvider: React.ComponentType<{ children: React.ReactNode }>;
  let usePrimaryColor: () => {
    primaryColor: string;
    setPrimaryColor: (hex: string) => void;
  };

  beforeEach(async () => {
    localStorage.removeItem(STORAGE_KEY);
    // Reset any inline style left by previous tests
    document.documentElement.style.removeProperty('--color-primary');
    document.documentElement.style.removeProperty('--color-primary-hover');
    document.documentElement.style.removeProperty('--color-primary-active');

    const mod = await import('../ThemeContext');
    PrimaryColorProvider = mod.PrimaryColorProvider;
    usePrimaryColor = mod.usePrimaryColor;
  });

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    document.documentElement.style.removeProperty('--color-primary');
    document.documentElement.style.removeProperty('--color-primary-hover');
    document.documentElement.style.removeProperty('--color-primary-active');
  });

  // ---- Default value ----

  it('defaults primaryColor to #4a6cf7 when no localStorage value exists', () => {
    const { result } = renderHook(() => usePrimaryColor(), {
      wrapper: PrimaryColorProvider,
    });
    expect(result.current.primaryColor).toBe('#4a6cf7');
  });

  // ---- localStorage read ----

  it('reads persisted primaryColor from localStorage on mount', () => {
    localStorage.setItem(STORAGE_KEY, '#18a058');

    const { result } = renderHook(() => usePrimaryColor(), {
      wrapper: PrimaryColorProvider,
    });

    expect(result.current.primaryColor).toBe('#18a058');
  });

  // ---- localStorage write ----

  it('persists primaryColor to localStorage when setPrimaryColor is called', () => {
    const { result } = renderHook(() => usePrimaryColor(), {
      wrapper: PrimaryColorProvider,
    });

    act(() => {
      result.current.setPrimaryColor('#7c3aed');
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBe('#7c3aed');
  });

  // ---- DOM CSS custom property writes ----

  it('writes --color-primary to document.documentElement.style on mount', () => {
    renderHook(() => usePrimaryColor(), { wrapper: PrimaryColorProvider });

    expect(document.documentElement.style.getPropertyValue('--color-primary'))
      .toBe('#4a6cf7');
  });

  it('writes --color-primary-hover (10% lighter) on mount', () => {
    renderHook(() => usePrimaryColor(), { wrapper: PrimaryColorProvider });

    expect(document.documentElement.style.getPropertyValue('--color-primary-hover'))
      .toBe('#5c7bf8');
  });

  it('writes --color-primary-active (12% darker) on mount', () => {
    renderHook(() => usePrimaryColor(), { wrapper: PrimaryColorProvider });

    expect(document.documentElement.style.getPropertyValue('--color-primary-active'))
      .toBe('#415fd9');
  });

  it('updates all three CSS properties when setPrimaryColor changes', () => {
    const { result } = renderHook(() => usePrimaryColor(), {
      wrapper: PrimaryColorProvider,
    });

    act(() => {
      result.current.setPrimaryColor('#f0a020');
    });

    expect(document.documentElement.style.getPropertyValue('--color-primary'))
      .toBe('#f0a020');
    expect(document.documentElement.style.getPropertyValue('--color-primary-hover'))
      .toBe('#f2aa36');
    expect(document.documentElement.style.getPropertyValue('--color-primary-active'))
      .toBe('#d38d1c');
  });

  it('updates CSS properties immediately when switching to each preset', () => {
    const { result } = renderHook(() => usePrimaryColor(), {
      wrapper: PrimaryColorProvider,
    });

    for (const { hex } of PRESET_COLORS) {
      act(() => {
        result.current.setPrimaryColor(hex);
      });

      expect(document.documentElement.style.getPropertyValue('--color-primary'))
        .toBe(hex);
    }
  });

  // ---- Error boundary ----

  it('throws when usePrimaryColor is used outside PrimaryColorProvider', () => {
    // Suppress console.error for this expected throw
    const prev = console.error;
    console.error = () => {};

    expect(() => {
      renderHook(() => usePrimaryColor());
    }).toThrow('usePrimaryColor must be used within a PrimaryColorProvider');

    console.error = prev;
  });
});
