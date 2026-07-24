import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { Tag } from '../Tag';

/**
 * Seam: Tag component
 *
 * Public interface:
 *   <Tag variant="priority" level="urgent">紧急</Tag>
 *   <Tag variant="category">人员调配</Tag>
 *   <Tag variant="date">2026-07-23</Tag>
 *
 * Three variants with distinct visual treatment:
 * - priority: colored left border (red/orange/gray per level)
 * - category: semi-transparent background
 * - date: relative time text (今天/明天/X月X日)
 */

describe('Tag component', () => {
  // ==============================================================
  // Priority variant — colored left border
  // ==============================================================

  describe('variant="priority"', () => {
    it('renders urgent priority with red left border (data-level="urgent")', () => {
      const { container } = render(
        <Tag variant="priority" level="urgent">
          紧急
        </Tag>,
      );
      const el = container.firstElementChild!;
      expect(el.getAttribute('data-variant')).toBe('priority');
      expect(el.getAttribute('data-level')).toBe('urgent');
      expect(el.textContent).toBe('紧急');
    });

    it('renders important priority with orange left border (data-level="important")', () => {
      const { container } = render(
        <Tag variant="priority" level="important">
          重要
        </Tag>,
      );
      const el = container.firstElementChild!;
      expect(el.getAttribute('data-variant')).toBe('priority');
      expect(el.getAttribute('data-level')).toBe('important');
      expect(el.textContent).toBe('重要');
    });

    it('renders normal priority with gray left border (data-level="normal")', () => {
      const { container } = render(
        <Tag variant="priority" level="normal">
          日常
        </Tag>,
      );
      const el = container.firstElementChild!;
      expect(el.getAttribute('data-variant')).toBe('priority');
      expect(el.getAttribute('data-level')).toBe('normal');
      expect(el.textContent).toBe('日常');
    });
  });

  // ==============================================================
  // Category variant — semi-transparent background
  // ==============================================================

  describe('variant="category"', () => {
    it('renders with semi-transparent background', () => {
      const { container } = render(
        <Tag variant="category">人员调配</Tag>,
      );
      const el = container.firstElementChild!;
      expect(el.getAttribute('data-variant')).toBe('category');
      expect(el.textContent).toBe('人员调配');
    });
  });

  // ==============================================================
  // Date variant — relative time text
  // ==============================================================

  describe('variant="date"', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('renders "今天" when value is today', () => {
      // Freeze time so "today" is deterministic
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-23T12:00:00'));

      const { container } = render(
        <Tag variant="date">2026-07-23</Tag>,
      );
      const el = container.firstElementChild!;
      expect(el.getAttribute('data-variant')).toBe('date');
      expect(el.textContent).toBe('今天');
    });

    it('renders "明天" when value is tomorrow', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-23T12:00:00'));

      const { container } = render(
        <Tag variant="date">2026-07-24</Tag>,
      );
      const el = container.firstElementChild!;
      expect(el.getAttribute('data-variant')).toBe('date');
      expect(el.textContent).toBe('明天');
    });

    it('renders "X月X日" format for other dates', () => {
      const { container } = render(
        <Tag variant="date">2026-03-15</Tag>,
      );
      const el = container.firstElementChild!;
      expect(el.getAttribute('data-variant')).toBe('date');
      expect(el.textContent).toBe('3月15日');
    });

    it('renders empty when value is null or empty', () => {
      const { container } = render(
        <Tag variant="date">{''}</Tag>,
      );
      const el = container.firstElementChild!;
      expect(el.textContent).toBe('');
    });
  });

  // ==============================================================
  // Custom className passthrough
  // ==============================================================

  it('applies custom className alongside variant class', () => {
    const { container } = render(
      <Tag variant="category" className="my-tag">
        测试
      </Tag>,
    );
    const el = container.firstElementChild!;
    expect(el.classList.contains('my-tag')).toBe(true);
    expect(el.getAttribute('data-variant')).toBe('category');
  });
});
