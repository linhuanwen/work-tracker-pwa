/**
 * F3 — 接上休眠抽屉
 *
 * 验证: HibernateDrawer 渲染休眠任务、激活按钮功能正确
 *       BottomNav 显示休眠任务数量 badge
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

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

// ---- Mock CSS ----
vi.mock('../HibernateDrawer.module.css', () => ({
  default: {
    overlay: 'overlay', drawer: 'drawer', handle: 'handle',
    header: 'header', title: 'title', count: 'count', closeBtn: 'closeBtn',
    empty: 'empty', list: 'list', item: 'item', itemBody: 'itemBody',
    itemTitle: 'itemTitle', itemMeta: 'itemMeta', itemCategory: 'itemCategory',
    itemDate: 'itemDate', activateBtn: 'activateBtn',
  },
}));
vi.mock('../Toast.module.css', () => ({ default: {} }));
vi.mock('../Icon', () => ({
  Icon: () => null,
}));

// ---- Mock DataContext ----
const mockDispatch = vi.fn();
vi.mock('../DataContext', () => ({
  useData: () => ({
    data: { tasks: [], projects: [], settings: { categories: [] }, archives: { weeks: {}, months: {}, years: {} }, version: 1, lastModified: '' },
    dispatch: mockDispatch,
    openDirectory: vi.fn(),
    saveData: vi.fn(),
    loading: false,
    error: null,
    hasStoredHandle: false,
    reopenStored: vi.fn(),
    lastFolderInfo: null,
  }),
  DataProvider: ({ children }: any) => children,
}));

// ---- Mock Toast ----
vi.mock('../Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
  ToastProvider: ({ children }: any) => children,
}));

import { HibernateDrawer } from '../HibernateDrawer';
import type { Task } from '../types';

function makeHibernatingTask(overrides?: Partial<Task>): Task {
  return {
    id: 't-h-1',
    projectId: null,
    title: '休眠测试任务',
    category: '其他',
    priority: 'normal',
    status: 'todo',
    createdDate: '2026-01-01',
    updatedDate: '2026-01-01',
    deadline: null,
    completedDate: null,
    quantities: [],
    subtasks: [],
    notes: '',
    isLeaderAssigned: false,
    isCrossYear: true,
    hibernateUntil: '2027-01-01',
    isBlocked: false,
    ...overrides,
  };
}

describe('F3 — 休眠抽屉 (App.tsx → HibernateDrawer)', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
  });

  describe('休眠任务列表渲染', () => {
    it('渲染休眠任务标题', () => {
      const tasks = [makeHibernatingTask()];
      render(
        <HibernateDrawer tasks={tasks} onClose={vi.fn()} />,
      );
      expect(screen.getByText('休眠任务')).toBeDefined();
    });

    it('显示休眠任务数量', () => {
      const tasks = [makeHibernatingTask(), makeHibernatingTask({ id: 't-h-2' })];
      render(
        <HibernateDrawer tasks={tasks} onClose={vi.fn()} />,
      );
      expect(screen.getByText('2 个')).toBeDefined();
    });

    it('显示每个休眠任务的标题', () => {
      const tasks = [
        makeHibernatingTask({ id: 't-h-1', title: '跨年任务A' }),
        makeHibernatingTask({ id: 't-h-2', title: '跨年任务B' }),
      ];
      render(
        <HibernateDrawer tasks={tasks} onClose={vi.fn()} />,
      );
      expect(screen.getByText('跨年任务A')).toBeDefined();
      expect(screen.getByText('跨年任务B')).toBeDefined();
    });

    it('暂无休眠任务时显示空状态', () => {
      render(
        <HibernateDrawer tasks={[]} onClose={vi.fn()} />,
      );
      expect(screen.getByText('暂无休眠任务')).toBeDefined();
    });

    it('关闭按钮可点击', () => {
      const onClose = vi.fn();
      const tasks = [makeHibernatingTask()];
      render(
        <HibernateDrawer tasks={tasks} onClose={onClose} />,
      );
      // The close button has aria-label implicitly via Icon
      const closeBtn = document.querySelector('button');
      // Find the close button in the header
      const buttons = screen.getAllByRole('button');
      // Click a close-like button
      const closeButton = buttons[0]; // First button in header is close
      if (closeButton) fireEvent.click(closeButton);
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('激活按钮功能', () => {
    it('每个休眠任务有"提前激活"按钮', () => {
      const tasks = [makeHibernatingTask()];
      render(
        <HibernateDrawer tasks={tasks} onClose={vi.fn()} />,
      );
      const activateBtn = screen.getByText('提前激活');
      expect(activateBtn).toBeDefined();
    });

    it('点击"提前激活"dispatch UPDATE_TASK 清除休眠字段', () => {
      const tasks = [makeHibernatingTask({ id: 't-h-1' })];
      render(
        <HibernateDrawer tasks={tasks} onClose={vi.fn()} />,
      );
      fireEvent.click(screen.getByText('提前激活'));
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'UPDATE_TASK',
        payload: {
          taskId: 't-h-1',
          patch: { isCrossYear: false, hibernateUntil: null },
        },
      });
    });
  });
});
