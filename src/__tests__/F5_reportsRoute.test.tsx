/**
 * F5 — 接上 Reports 报表页
 *
 * 验证: App.tsx 有 /reports 路由，渲染 <Reports> 组件
 *       Reports 有周/月/年 Tab、一键复制、CSV 导出功能
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ---- Polyfills ----
beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  }
  if (typeof window !== 'undefined' && !window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn(() => ({
        matches: false, media: '', onchange: null,
        addListener: vi.fn(), removeListener: vi.fn(),
        addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
      })),
    });
  }
});

// ---- Mock CSS modules ----
vi.mock('../Reports.module.css', () => ({
  default: {
    container: 'container', heading: 'heading',
    tabs: 'tabs', tab: 'tab', tabActive: 'tabActive',
    actions: 'actions', actionBtn: 'actionBtn',
    preview: 'preview', section: 'section',
    sectionTitle: 'sectionTitle', sectionContent: 'sectionContent',
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
vi.mock('../UrgentZone.module.css', () => ({ default: {} }));

// ---- Mock Icon ----
vi.mock('../Icon', () => ({
  Icon: () => null,
}));

// ---- Mock route: force /reports ----
const mockNavigate = vi.fn();
vi.mock('../useHashRoute', () => ({
  useHashRoute: () => ({ path: '/reports', navigate: mockNavigate }),
}));
vi.mock('../useWindowResize', () => ({
  useWindowResize: () => ({
    onN: vi.fn(), onS: vi.fn(), onE: vi.fn(), onW: vi.fn(),
    onNE: vi.fn(), onNW: vi.fn(), onSE: vi.fn(), onSW: vi.fn(),
  }),
}));

// ---- Mock useFileSystem with valid data + some tasks ----
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
      tasks: [
        {
          id: 't-1', projectId: null, title: '完成任务A', category: '人力资源',
          priority: 'normal', status: 'done', createdDate: '2026-07-01',
          updatedDate: '2026-07-15', deadline: null, completedDate: '2026-07-15',
          quantities: [], subtasks: [], notes: '',
          isLeaderAssigned: false, isCrossYear: false, isBlocked: false,
        },
        {
          id: 't-2', projectId: null, title: '进行中任务B', category: '培训',
          priority: 'important', status: 'in-progress', createdDate: '2026-07-05',
          updatedDate: '2026-07-20', deadline: null, completedDate: null,
          quantities: [], subtasks: [], notes: '',
          isLeaderAssigned: false, isCrossYear: false, isBlocked: false,
        },
      ],
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

describe('F5 — 接上 Reports 报表页 (App.tsx /reports)', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('访问 /reports 时渲染 Reports 组件（不是主页任务列表）', () => {
    render(<App />);
    // Reports has heading "报表" AND tab buttons "周报"/"月报"/"年报"
    // The default route (home) should NOT render "周报" tab
    expect(screen.getByText('周报')).toBeDefined(); // Reports tab, not nav
  });

  it('Reports 页面有周报/月报/年报三个 Tab', () => {
    render(<App />);
    expect(screen.getByText('周报')).toBeDefined();
    expect(screen.getByText('月报')).toBeDefined();
    expect(screen.getByText('年报')).toBeDefined();
  });

  it('Reports 页面有一键复制按钮', () => {
    render(<App />);
    const copyBtn = screen.getByText('复制');
    expect(copyBtn).toBeDefined();
  });

  it('Reports 页面没有导出 CSV 按钮', () => {
    render(<App />);
    const exportBtn = screen.queryByText('导出 CSV');
    expect(exportBtn).toBeNull();
  });
});
