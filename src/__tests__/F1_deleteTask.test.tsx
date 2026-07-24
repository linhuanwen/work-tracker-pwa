/**
 * F1 — 接上删除任务功能
 *
 * 验证: TaskCard 收到 onDelete prop 后正确渲染删除按钮
 *       点击删除 → ConfirmDialog → 确认后 dispatch DELETE_TASK
 *       取消后不 dispatch
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Polyfill dialog.showModal() / dialog.close() for jsdom
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
});

// Mock CSS modules
vi.mock('../ConfirmDialog.module.css', () => ({
  default: {
    dialog: 'dialog', content: 'content', header: 'header',
    title: 'title', message: 'message', footer: 'footer',
    cancelBtn: 'cancelBtn', confirmBtn: 'confirmBtn',
  },
}));
vi.mock('../TaskCard.module.css', () => ({
  default: {
    card: 'card', cardHeader: 'cardHeader', cardHeaderExpanded: 'cardHeaderExpanded',
    statusDot: 'statusDot', statusTodo: 'statusTodo', statusInProgress: 'statusInProgress',
    statusDone: 'statusDone', statusCancelled: 'statusCancelled',
    body: 'body', title: 'title', titleDone: 'titleDone', titleCancelled: 'titleCancelled',
    meta: 'meta', dateFooter: 'dateFooter', dateText: 'dateText',
    statusSelect: 'statusSelect', deleteBtn: 'deleteBtn',
    expandArrow: 'expandArrow', expandArrowOpen: 'expandArrowOpen',
    editPanel: 'editPanel', editLabel: 'editLabel', editInput: 'editInput',
    editSelect: 'editSelect', editRow: 'editRow', editTextarea: 'editTextarea',
    priorityBtnGroup: 'priorityBtnGroup', priorityBtn: 'priorityBtn',
    priorityBtnActive: 'priorityBtnActive',
    toggleRow: 'toggleRow', toggleLabel: 'toggleLabel', toggle: 'toggle',
    toggleSlider: 'toggleSlider',
    leaderFields: 'leaderFields', leaderBadge: 'leaderBadge',
    quantityTag: 'quantityTag',
    subtaskProgress: 'subtaskProgress', subtaskProgressTrack: 'subtaskProgressTrack',
    subtaskProgressFill: 'subtaskProgressFill', subtaskProgressCount: 'subtaskProgressCount',
    subtaskDoneBtn: 'subtaskDoneBtn',
    quantityEditList: 'quantityEditList', quantityEditRow: 'quantityEditRow',
    quantityNumberInput: 'quantityNumberInput', quantityUnitInput: 'quantityUnitInput',
    removeBtn: 'removeBtn', addQuantityBtn: 'addQuantityBtn',
    editHint: 'editHint',
  },
}));
vi.mock('../Tag.module.css', () => ({
  default: { tag: 'tag', category: 'category', priorityNormal: 'priorityNormal' },
}));
vi.mock('../ContextMenu.module.css', () => ({
  default: { menu: 'menu', item: 'item', separator: 'separator', danger: 'danger' },
}));
vi.mock('../Toast.module.css', () => ({ default: {} }));
vi.mock('../Icon', () => ({
  Icon: ({ name, size }: { name: string; size: number }) => null,
}));

import { TaskCard } from '../TaskCard';
import type { Task } from '../types';
import { ToastProvider } from '../Toast';

function makeTask(overrides?: Partial<Task>): Task {
  return {
    id: 't-test-1',
    projectId: null,
    title: '测试任务',
    category: '其他',
    priority: 'normal',
    status: 'todo',
    createdDate: '2026-07-01',
    updatedDate: '2026-07-01',
    deadline: null,
    completedDate: null,
    quantities: [],
    subtasks: [],
    notes: '',
    isLeaderAssigned: false,
    isCrossYear: false,
    isBlocked: false,
    ...overrides,
  };
}

function renderCard(task: Task, onDelete?: (id: string) => void) {
  return render(
    <ToastProvider>
      <TaskCard
        task={task}
        categories={['人力资源', '培训', '其他']}
        onTransitionStatus={vi.fn()}
        onUpdateTask={vi.fn()}
        onDelete={onDelete}
      />
    </ToastProvider>,
  );
}

describe('F1 — 删除任务 (App.tsx → TaskList → TaskCard)', () => {
  describe('删除按钮渲染', () => {
    it('传入 onDelete 时显示删除按钮', () => {
      const task = makeTask();
      renderCard(task, vi.fn());

      const deleteBtn = screen.getByLabelText('删除任务');
      expect(deleteBtn).toBeDefined();
    });

    it('不传 onDelete 时不显示删除按钮', () => {
      const task = makeTask();
      renderCard(task); // no onDelete

      const deleteBtns = screen.queryAllByLabelText('删除任务');
      expect(deleteBtns.length).toBe(0);
    });
  });

  describe('确认删除流程', () => {
    it('点击删除按钮弹出 ConfirmDialog', () => {
      const task = makeTask();
      renderCard(task, vi.fn());

      // Click the delete button
      const deleteBtn = screen.getByLabelText('删除任务');
      fireEvent.click(deleteBtn);

      // ConfirmDialog should appear with heading
      const heading = screen.getByRole('heading', { name: '确认删除' });
      expect(heading).toBeDefined();

      // The dialog message includes the task title (both card title and dialog message match)
      const messages = screen.getAllByText(/测试任务/);
      expect(messages.length).toBeGreaterThanOrEqual(2); // card title + dialog message
    });

    it('确认后调用 onDelete 并传入正确 taskId', () => {
      const task = makeTask({ id: 't-delete-me' });
      const onDelete = vi.fn();
      renderCard(task, onDelete);

      // Click delete button
      fireEvent.click(screen.getByLabelText('删除任务'));

      // Click confirm button
      const confirmBtn = screen.getByRole('button', { name: '确认删除' });
      fireEvent.click(confirmBtn);

      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onDelete).toHaveBeenCalledWith('t-delete-me');
    });

    it('取消后不调用 onDelete', () => {
      const task = makeTask();
      const onDelete = vi.fn();
      renderCard(task, onDelete);

      // Click delete button
      fireEvent.click(screen.getByLabelText('删除任务'));

      // Click cancel button
      const cancelBtn = screen.getByRole('button', { name: '取消' });
      fireEvent.click(cancelBtn);

      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  describe('已取消任务的删除', () => {
    it('已取消(cancelled)任务也可以被删除', () => {
      const task = makeTask({ status: 'cancelled' });
      const onDelete = vi.fn();
      renderCard(task, onDelete);

      // Should still have delete button
      const deleteBtn = screen.getByLabelText('删除任务');
      expect(deleteBtn).toBeDefined();

      fireEvent.click(deleteBtn);
      const confirmBtn = screen.getByRole('button', { name: '确认删除' });
      fireEvent.click(confirmBtn);
      expect(onDelete).toHaveBeenCalledWith('t-test-1');
    });
  });
});
