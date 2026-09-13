/**
 * F5 — 接上 Reports 报表页
 *
 * 验证: App.tsx 有 /reports 路由，渲染 <Reports> 组件
 *       Reports 有周/月/年 Tab、一键复制、CSV 导出功能
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { mockReopenStored } = vi.hoisted(() => ({
  mockReopenStored: vi.fn(),
}));

// ---- Polyfills ----
beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '');
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open');
    };
  }
  if (typeof window !== 'undefined' && !window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn(() => ({
        matches: false,
        media: '',
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
vi.mock('../Reports.module.css', () => ({
  default: {
    container: 'container',
    heading: 'heading',
    tabs: 'tabs',
    tab: 'tab',
    tabActive: 'tabActive',
    actions: 'actions',
    actionBtn: 'actionBtn',
    weekHint: 'weekHint',
    preview: 'preview',
    section: 'section',
    sectionTitle: 'sectionTitle',
    sectionContent: 'sectionContent',
  },
}));
vi.mock('../App.module.css', () => ({
  default: {
    app: 'app',
    header: 'header',
    title: 'title',
    subtitle: 'subtitle',
    nav: 'nav',
    navBtn: 'navBtn',
    folderBar: 'folderBar',
    folderPath: 'folderPath',
    folderBtn: 'folderBtn',
    error: 'error',
    fab: 'fab',
    bottomFolderBar: 'bottomFolderBar',
    bottomFolderLabel: 'bottomFolderLabel',
    changeFolderBtn: 'changeFolderBtn',
    dragBar: 'dragBar',
    dragHandle: 'dragHandle',
    resizeEdge: 'resizeEdge',
    resizeN: 'resizeN',
    resizeS: 'resizeS',
    resizeE: 'resizeE',
    resizeW: 'resizeW',
    resizeNE: 'resizeNE',
    resizeNW: 'resizeNW',
    resizeSE: 'resizeSE',
    resizeSW: 'resizeSW',
  },
}));
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
vi.mock('../BottomNav.module.css', () => ({
  default: {
    nav: 'nav',
    tab: 'tab',
    active: 'active',
    icon: 'icon',
    label: 'label',
    hibernateBtn: 'hibernateBtn',
  },
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
  default: {
    card: 'card',
    cardHeader: 'cardHeader',
    body: 'body',
    title: 'title',
    meta: 'meta',
    dateFooter: 'dateFooter',
    statusSelect: 'statusSelect',
    expandArrow: 'expandArrow',
    deleteBtn: 'deleteBtn',
    editPanel: 'editPanel',
  },
}));
vi.mock('../Tag.module.css', () => ({ default: {} }));
vi.mock('../ConfirmDialog.module.css', () => ({
  default: {
    dialog: 'dialog',
    content: 'content',
    header: 'header',
    title: 'title',
    message: 'message',
    footer: 'footer',
    cancelBtn: 'cancelBtn',
    confirmBtn: 'confirmBtn',
  },
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
    onN: vi.fn(),
    onS: vi.fn(),
    onE: vi.fn(),
    onW: vi.fn(),
    onNE: vi.fn(),
    onNW: vi.fn(),
    onSE: vi.fn(),
    onSW: vi.fn(),
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
          id: 't-1',
          projectId: null,
          title: '完成任务A',
          category: '人力资源',
          priority: 'normal',
          status: 'done',
          createdDate: '2026-07-01',
          updatedDate: '2026-07-15',
          deadline: null,
          completedDate: '2026-07-22',
          quantities: [],
          subtasks: [],
          notes: '',
          isLeaderAssigned: false,
          isCrossYear: false,
          isBlocked: false,
        },
        {
          id: 't-2',
          projectId: null,
          title: '进行中任务B',
          category: '培训',
          priority: 'important',
          status: 'in-progress',
          createdDate: '2026-07-05',
          updatedDate: '2026-07-20',
          deadline: null,
          completedDate: null,
          quantities: [],
          subtasks: [
            { id: 's1', title: '步骤一', status: 'done' },
            { id: 's2', title: '步骤二', status: 'todo' },
          ],
          notes: '',
          isLeaderAssigned: false,
          isCrossYear: false,
          isBlocked: false,
        },
      ],
      archives: { weeks: {}, months: {}, years: {} },
    },
    openDirectory: vi.fn(),
    saveData: mockSaveData,
    loading: false,
    error: null,
    hasStoredHandle: true,
    reopenStored: mockReopenStored,
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
    mockSaveData.mockClear();
    mockReopenStored.mockReset();
    mockReopenStored.mockResolvedValue(null);
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

  it('周报列表按【本周完成任务】+【进行中】两小节展示，按举例格式成行', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-23T10:00:00')); // W30: 7/20-7/24
    try {
      render(<App />);
      // 本周完成任务：`- [分类] 标题` 逐行
      expect(screen.getByText('【本周完成任务】')).toBeDefined();
      expect(screen.getByText('- [人力资源] 完成任务A')).toBeDefined();
      // 进行中：已完成 + 待开展 子任务列表
      expect(screen.getByText('【进行中】')).toBeDefined();
      expect(
        screen.getByText(
          '- [培训] 进行中任务B：已完成步骤一，待开展：步骤二。',
        ),
      ).toBeDefined();
      // 不再出现 下周计划 / 需协调事项
      expect(screen.queryByText('【下周计划】')).toBeNull();
      expect(screen.queryByText('【需协调事项】')).toBeNull();
      // 显示当周统计范围，帮助判断归属
      expect(screen.getByText('当周统计范围：7月20日 - 7月24日')).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('点击「更新」重读磁盘数据并刷新报表列表内容', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-07-23T10:00:00')); // W30: 7/20-7/24
    try {
      const freshData = {
        version: 1,
        lastModified: '2026-07-23T01:00:00.000Z',
        settings: {
          weeklySummaryDay: 5,
          monthlySummaryDay: 28,
          aiPolishFlag: false,
          categories: ['人力资源', '培训', '招聘', '绩效', '其他'],
        },
        projects: [],
        tasks: [
          {
            id: 't-9',
            projectId: null,
            title: '最新完成任务X',
            category: '人力资源',
            priority: 'normal',
            status: 'done',
            createdDate: '2026-07-10',
            updatedDate: '2026-07-22',
            deadline: null,
            completedDate: '2026-07-22',
            quantities: [],
            subtasks: [],
            notes: '',
            isLeaderAssigned: false,
            isCrossYear: false,
            isBlocked: false,
          },
        ],
        archives: { weeks: {}, months: {}, years: {} },
      };
      mockReopenStored.mockResolvedValue(freshData);

      render(<App />);
      // 初始列表没有该任务
      expect(screen.queryByText('- [人力资源] 最新完成任务X')).toBeNull();

      fireEvent.click(screen.getByText('更新'));

      // 重读完成后列表显示磁盘上的最新任务
      expect(
        await screen.findByText('- [人力资源] 最新完成任务X'),
      ).toBeDefined();
      expect(mockReopenStored).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
