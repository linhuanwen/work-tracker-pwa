import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ============================================================
// Mock CSS modules
// ============================================================

vi.mock('../Sidebar.module.css', () => ({
  default: {
    sidebar: 'sidebar',
    nav: 'nav',
    navItem: 'navItem',
    navItemActive: 'navItemActive',
    icon: 'icon',
    label: 'label',
    dragHandle: 'dragHandle',
    dragging: 'dragging',
  },
}));

// ============================================================
// Test helpers
// ============================================================

const STORAGE_KEY = 'wjl-sidebar-width';

/**
 * Configure window.matchMedia to return specific matches for given queries.
 */
function mockMatchMedia(matchesMap: Record<string, boolean>) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: matchesMap[query] ?? false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

/**
 * Fire a complete drag sequence: mousedown → mousemove → mouseup.
 */
function simulateDrag(
  element: HTMLElement,
  startX: number,
  endX: number,
) {
  fireEvent.mouseDown(element, { clientX: startX, button: 0 });
  fireEvent.mouseMove(document, { clientX: endX });
  fireEvent.mouseUp(document);
}

// ============================================================
// Seam S1: Responsive rendering at three breakpoints
// ============================================================

describe('Sidebar — responsive rendering (Seam 1)', () => {
  let Sidebar: React.ComponentType<{
    currentPath: string;
    onNavigate: (route: string) => void;
  }>;

  const NAV_ITEMS = [
    { label: '任务清单', route: '/' },
    { label: '周报', route: '/weekly' },
    { label: '月报', route: '/summary/monthly' },
    { label: '年报', route: '/summary/yearly' },
    { label: '项目管理', route: '/projects' },
    { label: '设置', route: '/settings' },
  ];

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  describe('breakpoint: < 768px (mobile) — sidebar hidden', () => {
    beforeEach(async () => {
      mockMatchMedia({
        '(min-width: 768px)': false,
        '(min-width: 1024px)': false,
      });
      const mod = await import('../Sidebar');
      Sidebar = mod.Sidebar;
    });

    it('renders with data-mode="hidden"', () => {
      const { container } = render(<Sidebar currentPath="/" onNavigate={() => {}} />);
      const aside = container.querySelector('aside');
      expect(aside).not.toBeNull();
      expect(aside!.getAttribute('data-mode')).toBe('hidden');
    });

    it('does NOT render any navigation items when hidden', () => {
      render(<Sidebar currentPath="/" onNavigate={() => {}} />);
      const items = screen.queryAllByRole('button');
      expect(items).toHaveLength(0);
    });

    it('does NOT render drag handle when hidden', () => {
      render(<Sidebar currentPath="/" onNavigate={() => {}} />);
      expect(screen.queryByTestId('sidebar-drag-handle')).toBeNull();
    });
  });

  describe('breakpoint: 768px – 1023px (tablet) — icon-only mode', () => {
    beforeEach(async () => {
      mockMatchMedia({
        '(min-width: 768px)': true,
        '(min-width: 1024px)': false,
      });
      const mod = await import('../Sidebar');
      Sidebar = mod.Sidebar;
    });

    it('renders with data-mode="icons"', () => {
      render(<Sidebar currentPath="/" onNavigate={() => {}} />);
      const aside = screen.getByRole('complementary');
      expect(aside.getAttribute('data-mode')).toBe('icons');
    });

    it('renders all 6 navigation items as icon buttons', () => {
      render(<Sidebar currentPath="/" onNavigate={() => {}} />);
      const items = screen.getAllByRole('button');
      expect(items).toHaveLength(NAV_ITEMS.length);
    });

    it('renders each nav item with accessible label', () => {
      render(<Sidebar currentPath="/" onNavigate={() => {}} />);
      for (const item of NAV_ITEMS) {
        const btn = screen.getByRole('button', { name: item.label });
        expect(btn).toBeDefined();
      }
    });

    it('hides text labels visually in icon mode', () => {
      render(<Sidebar currentPath="/" onNavigate={() => {}} />);
      const labels = screen.getAllByText(/任务清单|周报|月报|年报|项目管理|设置/);
      for (const label of labels) {
        expect(label.classList.contains('label')).toBe(true);
      }
    });

    it('renders icons inside each button', () => {
      render(<Sidebar currentPath="/" onNavigate={() => {}} />);
      const items = screen.getAllByRole('button');
      for (const item of items) {
        const svg = item.querySelector('svg');
        expect(svg).not.toBeNull();
      }
    });

    it('does NOT render drag handle in icon mode', () => {
      render(<Sidebar currentPath="/" onNavigate={() => {}} />);
      expect(screen.queryByTestId('sidebar-drag-handle')).toBeNull();
    });
  });

  describe('breakpoint: ≥ 1024px (desktop) — full mode', () => {
    beforeEach(async () => {
      localStorage.removeItem(STORAGE_KEY);
      mockMatchMedia({
        '(min-width: 768px)': true,
        '(min-width: 1024px)': true,
      });
      const mod = await import('../Sidebar');
      Sidebar = mod.Sidebar;
    });

    it('renders with data-mode="full"', () => {
      render(<Sidebar currentPath="/" onNavigate={() => {}} />);
      const aside = screen.getByRole('complementary');
      expect(aside.getAttribute('data-mode')).toBe('full');
    });

    it('renders all 6 navigation items with labels visible', () => {
      render(<Sidebar currentPath="/" onNavigate={() => {}} />);
      for (const item of NAV_ITEMS) {
        const btn = screen.getByRole('button', { name: item.label });
        expect(btn).toBeDefined();
      }
    });

    it('uses default width 240px when no stored value', () => {
      render(<Sidebar currentPath="/" onNavigate={() => {}} />);
      const aside = screen.getByRole('complementary');
      expect(aside.style.width).toBe('240px');
    });

    it('reads stored width from localStorage on mount', async () => {
      localStorage.setItem(STORAGE_KEY, '300');
      // Re-import to get fresh component state
      const mod = await import('../Sidebar');
      const FreshSidebar = mod.Sidebar;

      render(<FreshSidebar currentPath="/" onNavigate={() => {}} />);
      const aside = screen.getByRole('complementary');
      expect(aside.style.width).toBe('300px');
    });

    it('clamps stored width to minimum 200px', async () => {
      localStorage.setItem(STORAGE_KEY, '120');
      const mod = await import('../Sidebar');
      const FreshSidebar = mod.Sidebar;

      render(<FreshSidebar currentPath="/" onNavigate={() => {}} />);
      const aside = screen.getByRole('complementary');
      expect(aside.style.width).toBe('200px');
    });

    it('clamps stored width to maximum 400px', async () => {
      localStorage.setItem(STORAGE_KEY, '600');
      const mod = await import('../Sidebar');
      const FreshSidebar = mod.Sidebar;

      render(<FreshSidebar currentPath="/" onNavigate={() => {}} />);
      const aside = screen.getByRole('complementary');
      expect(aside.style.width).toBe('400px');
    });

    it('renders drag handle in full mode', () => {
      render(<Sidebar currentPath="/" onNavigate={() => {}} />);
      expect(screen.getByTestId('sidebar-drag-handle')).toBeDefined();
    });
  });
});

// ============================================================
// Seam S2: Drag resize behavior
// ============================================================

describe('Sidebar — drag resize (Seam 2)', () => {
  let Sidebar: React.ComponentType<{
    currentPath: string;
    onNavigate: (route: string) => void;
  }>;

  beforeEach(async () => {
    localStorage.removeItem(STORAGE_KEY);
    mockMatchMedia({
      '(min-width: 768px)': true,
      '(min-width: 1024px)': true,
    });
    const mod = await import('../Sidebar');
    Sidebar = mod.Sidebar;
  });

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it('changes width when drag handle is dragged right', () => {
    render(<Sidebar currentPath="/" onNavigate={() => {}} />);

    const aside = screen.getByRole('complementary');
    expect(aside.style.width).toBe('240px');

    const handle = screen.getByTestId('sidebar-drag-handle');
    simulateDrag(handle, 240, 320);

    // Width should increase by 80px
    expect(aside.style.width).toBe('320px');
  });

  it('changes width when drag handle is dragged left', () => {
    render(<Sidebar currentPath="/" onNavigate={() => {}} />);

    const aside = screen.getByRole('complementary');
    expect(aside.style.width).toBe('240px');

    const handle = screen.getByTestId('sidebar-drag-handle');
    simulateDrag(handle, 240, 200);

    expect(aside.style.width).toBe('200px');
  });

  it('clamps width to minimum 200px during drag', () => {
    render(<Sidebar currentPath="/" onNavigate={() => {}} />);

    const aside = screen.getByRole('complementary');
    const handle = screen.getByTestId('sidebar-drag-handle');
    simulateDrag(handle, 240, 100);

    expect(aside.style.width).toBe('200px');
  });

  it('clamps width to maximum 400px during drag', () => {
    render(<Sidebar currentPath="/" onNavigate={() => {}} />);

    const aside = screen.getByRole('complementary');
    const handle = screen.getByTestId('sidebar-drag-handle');
    simulateDrag(handle, 240, 600);

    expect(aside.style.width).toBe('400px');
  });

  it('persists width to localStorage after drag ends', () => {
    render(<Sidebar currentPath="/" onNavigate={() => {}} />);

    const handle = screen.getByTestId('sidebar-drag-handle');
    simulateDrag(handle, 240, 350);

    expect(localStorage.getItem(STORAGE_KEY)).toBe('350');
  });

  it('does NOT save width outside valid range to localStorage', () => {
    render(<Sidebar currentPath="/" onNavigate={() => {}} />);

    const handle = screen.getByTestId('sidebar-drag-handle');
    simulateDrag(handle, 240, 50); // Below minimum

    // Should save clamped value, not the raw value
    expect(localStorage.getItem(STORAGE_KEY)).toBe('200');
  });

  it('uses persisted width from localStorage as initial width', async () => {
    localStorage.setItem(STORAGE_KEY, '280');

    const mod = await import('../Sidebar');
    const FreshSidebar = mod.Sidebar;
    render(<FreshSidebar currentPath="/" onNavigate={() => {}} />);

    const aside = screen.getByRole('complementary');
    expect(aside.style.width).toBe('280px');
  });
});

// ============================================================
// Seam S3: Route highlighting
// ============================================================

describe('Sidebar — route highlighting (Seam 3)', () => {
  let Sidebar: React.ComponentType<{
    currentPath: string;
    onNavigate: (route: string) => void;
  }>;

  const onNavigate = vi.fn();

  beforeEach(async () => {
    localStorage.removeItem(STORAGE_KEY);
    mockMatchMedia({
      '(min-width: 768px)': true,
      '(min-width: 1024px)': true,
    });
    const mod = await import('../Sidebar');
    Sidebar = mod.Sidebar;
    onNavigate.mockClear();
  });

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it('highlights "任务清单" when currentPath is "/"', () => {
    render(<Sidebar currentPath="/" onNavigate={onNavigate} />);

    const activeBtn = screen.getByRole('button', { name: '任务清单' });
    expect(activeBtn.getAttribute('aria-current')).toBe('page');

    // Other items should NOT have aria-current
    const weeklyBtn = screen.getByRole('button', { name: '周报' });
    expect(weeklyBtn.getAttribute('aria-current')).toBeNull();
  });

  it('highlights "周报" when currentPath is "/weekly"', () => {
    render(<Sidebar currentPath="/weekly" onNavigate={onNavigate} />);

    const activeBtn = screen.getByRole('button', { name: '周报' });
    expect(activeBtn.getAttribute('aria-current')).toBe('page');
  });

  it('highlights "月报" when currentPath is "/summary/monthly"', () => {
    render(<Sidebar currentPath="/summary/monthly" onNavigate={onNavigate} />);

    const activeBtn = screen.getByRole('button', { name: '月报' });
    expect(activeBtn.getAttribute('aria-current')).toBe('page');
  });

  it('highlights "年报" when currentPath is "/summary/yearly"', () => {
    render(<Sidebar currentPath="/summary/yearly" onNavigate={onNavigate} />);

    const activeBtn = screen.getByRole('button', { name: '年报' });
    expect(activeBtn.getAttribute('aria-current')).toBe('page');
  });

  it('highlights "项目管理" when currentPath is "/projects"', () => {
    render(<Sidebar currentPath="/projects" onNavigate={onNavigate} />);

    const activeBtn = screen.getByRole('button', { name: '项目管理' });
    expect(activeBtn.getAttribute('aria-current')).toBe('page');
  });

  it('highlights "项目管理" when currentPath starts with "/project/" (prefix match)', () => {
    render(<Sidebar currentPath="/project/p-123" onNavigate={onNavigate} />);

    const activeBtn = screen.getByRole('button', { name: '项目管理' });
    expect(activeBtn.getAttribute('aria-current')).toBe('page');
  });

  it('highlights "设置" when currentPath is "/settings"', () => {
    render(<Sidebar currentPath="/settings" onNavigate={onNavigate} />);

    const activeBtn = screen.getByRole('button', { name: '设置' });
    expect(activeBtn.getAttribute('aria-current')).toBe('page');
  });

  it('navigates when a nav item is clicked', () => {
    render(<Sidebar currentPath="/" onNavigate={onNavigate} />);

    const weeklyBtn = screen.getByRole('button', { name: '周报' });
    fireEvent.click(weeklyBtn);
    expect(onNavigate).toHaveBeenCalledWith('/weekly');
  });

  it('highlights exactly one item at a time', () => {
    render(<Sidebar currentPath="/weekly" onNavigate={onNavigate} />);

    const allItems = screen.getAllByRole('button');
    const activeItems = allItems.filter(
      (btn) => btn.getAttribute('aria-current') === 'page',
    );
    expect(activeItems).toHaveLength(1);
    expect(activeItems[0].getAttribute('aria-label')).toBe('周报');
  });
});
