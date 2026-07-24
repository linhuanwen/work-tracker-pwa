import { describe, it, expect } from 'vitest';

// ============================================================
// Seam S1: Color calculation utilities (pure functions)
// ============================================================

describe('lightenColor', () => {
  // Dynamic import — will fail until colorUtils.ts exists
  let lightenColor: (hex: string, amount: number) => string;
  let darkenColor: (hex: string, amount: number) => string;
  let computeColorVariants: (hex: string) => {
    primary: string;
    hover: string;
    active: string;
  };

  beforeAll(async () => {
    const mod = await import('../colorUtils');
    lightenColor = mod.lightenColor;
    darkenColor = mod.darkenColor;
    computeColorVariants = mod.computeColorVariants;
  });

  // ---------- lightenColor ----------

  it('lightens #4a6cf7 by 10% → #5c7bf8', () => {
    expect(lightenColor('#4a6cf7', 0.1)).toBe('#5c7bf8');
  });

  it('lightens #18a058 by 10% → #2faa69', () => {
    expect(lightenColor('#18a058', 0.1)).toBe('#2faa69');
  });

  it('lightens #000000 by 10% → #1a1a1a', () => {
    expect(lightenColor('#000000', 0.1)).toBe('#1a1a1a');
  });

  it('lightens #ffffff by 10% → #ffffff (already max)', () => {
    expect(lightenColor('#ffffff', 0.1)).toBe('#ffffff');
  });

  it('supports shorthand hex #abc → #b8cede (10% lighter)', () => {
    // #abc → R=170 G=187 B=204; +10% toward 255 → R=179 G=194 B=209 → #b3c2d1
    expect(lightenColor('#abc', 0.1)).toBe('#b3c2d1');
  });

  it('handles hex without hash prefix', () => {
    expect(lightenColor('4a6cf7', 0.1)).toBe('#5c7bf8');
  });

  // ---------- darkenColor ----------

  it('darkens #4a6cf7 by 12% → #415fd9', () => {
    expect(darkenColor('#4a6cf7', 0.12)).toBe('#415fd9');
  });

  it('darkens #18a058 by 12% → #158d4d', () => {
    expect(darkenColor('#18a058', 0.12)).toBe('#158d4d');
  });

  it('darkens #ffffff by 12% → #e0e0e0', () => {
    expect(darkenColor('#ffffff', 0.12)).toBe('#e0e0e0');
  });

  it('darkens #000000 by 12% → #000000 (already min)', () => {
    expect(darkenColor('#000000', 0.12)).toBe('#000000');
  });

  // ---------- computeColorVariants ----------

  it('computes hover (10% lighter) and active (12% darker) from primary', () => {
    const result = computeColorVariants('#4a6cf7');
    expect(result).toEqual({
      primary: '#4a6cf7',
      hover: '#5c7bf8',
      active: '#415fd9',
    });
  });

  it('computes variants for green preset #18a058', () => {
    const result = computeColorVariants('#18a058');
    expect(result).toEqual({
      primary: '#18a058',
      hover: '#2faa69',
      active: '#158d4d',
    });
  });

  it('computes variants for orange preset #f0a020', () => {
    const result = computeColorVariants('#f0a020');
    expect(result).toEqual({
      primary: '#f0a020',
      hover: '#f2aa36',
      active: '#d38d1c',
    });
  });

  it('computes variants for purple preset #7c3aed', () => {
    const result = computeColorVariants('#7c3aed');
    expect(result).toEqual({
      primary: '#7c3aed',
      hover: '#894eef',
      active: '#6d33d1',
    });
  });
});
