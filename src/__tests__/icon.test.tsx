import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Icon, ICON_NAMES, type IconName } from '../Icon';

/**
 * Seam: Icon component
 *
 * Public interface:
 *   <Icon name: IconName, size?: number, className?: string, color?: string />
 *
 * Tests that the Icon wrapper renders lucide-react SVG icons correctly.
 */

describe('Icon component', () => {
  // ----------------------------------------------------------------
  // Rendering
  // ----------------------------------------------------------------

  it('renders an SVG element for every known icon name', () => {
    for (const name of ICON_NAMES) {
      const { container, unmount } = render(<Icon name={name} />);
      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
      unmount();
    }
  });

  it('renders icons at default 20px size', () => {
    const { container } = render(<Icon name="plus" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('width')).toBe('20');
    expect(svg!.getAttribute('height')).toBe('20');
  });

  it('renders icons at a custom size', () => {
    const { container } = render(<Icon name="x" size={16} />);
    const svg = container.querySelector('svg');
    expect(svg!.getAttribute('width')).toBe('16');
    expect(svg!.getAttribute('height')).toBe('16');
  });

  // ----------------------------------------------------------------
  // Props forwarding
  // ----------------------------------------------------------------

  it('applies a custom className to the SVG', () => {
    const { container } = render(<Icon name="arrow-left" className="my-icon" />);
    const svg = container.querySelector('svg');
    expect(svg!.classList.contains('my-icon')).toBe(true);
  });

  it('applies a color via the color prop', () => {
    const { container } = render(<Icon name="circle" color="#ef4444" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    // lucide forwards color to the SVG stroke; check the attribute
    expect(svg!.getAttribute('stroke')).toBe('#ef4444');
  });

  it('defaults to currentColor when no color is provided', () => {
    const { container } = render(<Icon name="check-circle" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    // lucide renders with no explicit stroke when using currentColor
    // (inherits from CSS, so stroke attribute may not be set)
    const stroke = svg!.getAttribute('stroke');
    expect(stroke === null || stroke === 'currentColor').toBe(true);
  });

  // ----------------------------------------------------------------
  // Edge cases
  // ----------------------------------------------------------------

  it('renders the X icon correctly (used for close buttons)', () => {
    const { container } = render(<Icon name="x" size={18} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('width')).toBe('18');
  });

  it('renders Plus icon correctly (used for FAB and add actions)', () => {
    const { container } = render(<Icon name="plus" size={24} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });

  it('renders the status circle icon (used for urgent indicator)', () => {
    const { container } = render(<Icon name="circle" size={12} color="#ef4444" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });

  // ----------------------------------------------------------------
  // Type constraint: IconName exhaustiveness
  // ----------------------------------------------------------------

  it('has ICON_NAMES covering all required icons', () => {
    // If this compiles, the IconName union type covers these strings
    const required: IconName[] = [
      'arrow-left',
      'arrow-right',
      'chevron-left',
      'chevron-right',
      'chevron-up',
      'chevron-down',
      'bar-chart-3',
      'bot',
      'calendar',
      'check-circle',
      'circle',
      'clipboard-list',
      'clock',
      'copy',
      'download',
      'flag',
      'folder',
      'minus',
      'moon',
      'pen-line',
      'pin',
      'plus',
      'refresh-cw',
      'restore',
      'settings',
      'sparkles',
      'square',
      'x',
    ];
    expect(required.length).toBe(ICON_NAMES.length);
    for (const name of required) {
      expect(ICON_NAMES.includes(name)).toBe(true);
    }
  });
});
