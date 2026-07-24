/**
 * F2 — 接上设置页路由
 *
 * 验证: App.tsx 有 /settings hash route，渲染 <Settings> 组件
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';

// ---- Polyfills ----
beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  }
  // jsdom doesn't implement matchMedia
  if (typeof window !== 'undefined' && !window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }
});

// ---- Mock CSS modules ----
vi.mock('../Settings.module.css', () => ({
  default: {
    container: 'container', heading: 'heading',
    backBtn: 'backBtn', sections: 'sections', section: 'section',
    sectionTitle: 'sectionTitle', input: 'input', select: 'select',
    addBtn: 'addBtn', removeBtn: 'removeBtn', saveBtn: 'saveBtn',
    categoryList: 'categoryList', categoryItem: 'categoryItem',
    label: 'label', hint: 'hint', row: 'row',
    themeSection: 'themeSection',
  },
}));
vi.mock('../App.module.css', () => ({
  default: {
    app: 'app', header: 'header', title: 'title', subtitle: 'subtitle',
    nav: 'nav', navBtn: 'navBtn', folderBar: 'folderBar',
    folderPath: 'folderPath', folderBtn: 'folderBtn',
    error: 'error', fab: 'fab', bottomFolderBar: 'bottomFolderBar',
    bottomFolderLabel: 'bottomFolderLabel', changeFolderBtn: 'changeFolderBtn',
    dragBar: 'dragBar', dragHandle: 'dragHandle',
    resizeEdge: 'resizeEdge', resizeN: 'resizeN', resizeS: 'resizeS',
    resizeE: 'resizeE', resizeW: 'resizeW', resizeNE: 'resizeNE',
    resizeNW: 'resizeNW', resizeSE: 'resizeSE', resizeSW: 'resizeSW',
  },
}));
vi.mock('../Sidebar.module.css', () => ({
  default: { sidebar: 'sidebar', nav: 'nav', navItem: 'navItem', navItemActive: 'navItemActive', icon: 'icon', label: 'label', dragHandle: 'dragHandle', dragging: 'dragging' },
}));
vi.mock('../BottomNav.module.css', () => ({
  default: { nav: 'nav', tab: 'tab', active: 'active', icon: 'icon', label: 'label', hibernateBtn: 'hibernateBtn' },
}));
vi.mock('../HibernateDrawer.module.css', () => ({ default: {} }));
vi.mock('../Toast.module.css', () => ({ default: {} }));
vi.mock('../ThemeToggle.module.css', () => ({ default: {} }));
vi.mock('../ThemePicker.module.css', () => ({ default: {} }));
vi.mock('../InstallBanner.module.css', () => ({ default: {} }));
vi.mock('../Fab.module.css', () => ({ default: {} }));
vi.mock('../AddTaskForm.module.css', () => ({ default: {} }));
vi.mock('../TaskList.module.css', () => ({ default: {} }));
vi.mock('../TaskCard.module.css', () => ({
  default: { card: 'card', cardHeader: 'cardHeader', body: 'body', title: 'title', meta: 'meta', dateFooter: 'dateFooter', statusSelect: 'statusSelect', expandArrow: 'expandArrow', deleteBtn: 'deleteBtn', editPanel: 'editPanel' },
}));
vi.mock('../Tag.module.css', () => ({ default: {} }));
vi.mock('../ConfirmDialog.module.css', () => ({
  default: { dialog: 'dialog', content: 'content', header: 'header', title: 'title', message: 'message', footer: 'footer', cancelBtn: 'cancelBtn', confirmBtn: 'confirmBtn' },
}));
vi.mock('../ContextMenu.module.css', () => ({ default: {} }));

// ---- Mock Icon (no-op render) ----
vi.mock('../Icon', () => ({
  Icon: () => null,
}));

// ---- Mock route: force /settings ----
const mockNavigate = vi.fn();
vi.mock('../useHashRoute', () => ({
  useHashRoute: () => ({ path: '/settings', navigate: mockNavigate }),
}));
vi.mock('../useWindowResize', () => ({
  useWindowResize: () => ({
    onN: vi.fn(), onS: vi.fn(), onE: vi.fn(), onW: vi.fn(),
    onNE: vi.fn(), onNW: vi.fn(), onSE: vi.fn(), onSW: vi.fn(),
  }),
}));

// ---- Mock useFileSystem with valid data ----
const mockSaveData = vi.fn();
vi.mock('../useFileSystem', () => ({
  useFileSystem: () => ({
    data: {
      version: 1,
      lastModified: '2026-07-23T00:00:00.000Z',
      settings: {
        weeklySummaryDay: 5,
        monthlySummaryDay: 28,
        aiPolishFlag: false,
        categories: ['人力资源', '培训', '招聘', '绩效', '其他'],
      },
      projects: [],
      tasks: [],
      archives: { weeks: {}, months: {}, years: {} },
    },
    openDirectory: vi.fn(),
    saveData: mockSaveData,
    loading: false,
    error: null,
    hasStoredHandle: true,
    reopenStored: vi.fn().mockResolvedValue(null),
    lastFolderInfo: null,
  }),
}));

// ---- Mock ThemeContext ----
vi.mock('../ThemeContext', () => ({
  ThemeProvider: ({ children }: any) => children,
  PrimaryColorProvider: ({ children }: any) => children,
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
  usePrimaryColor: () => ['#3b82f6', vi.fn()],
}));

// ---- Now import App ----
import App from '../App';

// ================================================================
// Tests
// ================================================================

describe('F2 — 设置页路由 (App.tsx /settings)', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('访问 /settings 时渲染 Settings 组件标题', () => {
    render(<App />);
    // Settings component renders <h2>设置</h2> + BottomNav tab "设置"
    const headings = screen.getAllByText('设置');
    // At least 2: Settings heading + BottomNav tab
    expect(headings.length).toBeGreaterThanOrEqual(2);
  });

  it('Settings 页面有分类管理区域', () => {
    render(<App />);
    const categoryLabel = screen.getByText('分类管理');
    expect(categoryLabel).toBeDefined();
  });

  it('Settings 页面有周结日配置', () => {
    render(<App />);
    const weekDayLabel = screen.getByText('周结日');
    expect(weekDayLabel).toBeDefined();
  });

  it('Settings 页面有月结日配置', () => {
    render(<App />);
    const monthDayLabel = screen.getByText('月结日');
    expect(monthDayLabel).toBeDefined();
  });

  it('Settings 页面有分类增删功能（添加分类按钮）', () => {
    render(<App />);
    // Settings has "添加分类" button for CRUD
    const addCatBtn = screen.getByText('+ 添加分类');
    expect(addCatBtn).toBeDefined();
  });
});
