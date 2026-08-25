/**
 * T2 — 任务卡片接入子任务编辑
 *
 * 验证 TaskCard 展开后的行内编辑面板包含子任务编辑器，
 * 添加/勾选/删除子任务会通过 onUpdateTask 以 UpdateTaskPatch.subtasks 提交。
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Task } from '../types';
import type { UpdateTaskPatch } from '../taskUtils';
import { TaskCard } from '../TaskCard';

// Polyfill dialog for ConfirmDialog
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

vi.mock('../ConfirmDialog.module.css', () => ({
  default: {
    dialog: 'dialog', content: 'content', header: 'header', title: 'title',
    message: 'message', footer: 'footer', cancelBtn: 'cancelBtn',
    confirmBtn: 'confirmBtn',
  },
}));
vi.mock('../TaskCard.module.css', () => ({
  default: {
    card: 'card', cardHeader: 'cardHeader', cardHeaderExpanded: 'cardHeaderExpanded',
    statusTodo: 'statusTodo', statusInProgress: 'statusInProgress',
    statusDone: 'statusDone', statusCancelled: 'statusCancelled',
    body: 'body', title: 'title', titleDone: 'titleDone', titleCancelled: 'titleCancelled',
    meta: 'meta', statusSelect: 'statusSelect', deleteBtn: 'deleteBtn',
    expandArrow: 'expandArrow', expandArrowOpen: 'expandArrowOpen',
    editPanel: 'editPanel', editLabel: 'editLabel', editInput: 'editInput',
    editSelect: 'editSelect', editRow: 'editRow', editTextarea: 'editTextarea',
    priorityBtnGroup: 'priorityBtnGroup', priorityBtn: 'priorityBtn',
    priorityBtnActive: 'priorityBtnActive', toggleRow: 'toggleRow',
    toggleLabel: 'toggleLabel', toggle: 'toggle', toggleSlider: 'toggleSlider',
    leaderFields: 'leaderFields', leaderBadge: 'leaderBadge',
    subtaskProgress: 'subtaskProgress', subtaskProgressTrack: 'subtaskProgressTrack',
    subtaskProgressFill: 'subtaskProgressFill', subtaskProgressCount: 'subtaskProgressCount',
    subtaskDoneBtn: 'subtaskDoneBtn', quantityEditList: 'quantityEditList',
    quantityEditRow: 'quantityEditRow', quantityNumberInput: 'quantityNumberInput',
    quantityUnitInput: 'quantityUnitInput', removeBtn: 'removeBtn',
    addQuantityBtn: 'addQuantityBtn', editHint: 'editHint',
  },
}));
vi.mock('../SubtaskEditor.module.css', () => ({
  default: {
    section: 'section', sectionTitle: 'sectionTitle', sectionCounter: 'sectionCounter',
    subtaskList: 'subtaskList', subtaskRow: 'subtaskRow',
    subtaskCheckbox: 'subtaskCheckbox', subtaskTitle: 'subtaskTitle',
    subtaskTitleDone: 'subtaskTitleDone', subtaskInputRow: 'subtaskInputRow',
    input: 'input', addBtn: 'addBtn', removeBtn: 'removeBtn',
  },
}));
vi.mock('../Tag.module.css', () => ({
  default: { tag: 'tag', category: 'category', priorityNormal: 'priorityNormal' },
}));
vi.mock('../ContextMenu.module.css', () => ({
  default: { menu: 'menu', item: 'item', separator: 'separator', danger: 'danger', label: 'label', icon: 'icon' },
}));
vi.mock('../Toast.module.css', () => ({ default: {} }));
vi.mock('../Icon', () => ({
  Icon: ({ name, size }: { name: string; size: number }) => null,
}));

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
    subtasks: [
      { id: 's1', title: '步骤一', status: 'todo' },
    ],
    notes: '',
    isLeaderAssigned: false,
    isCrossYear: false,
    isBlocked: false,
    ...overrides,
  };
}

describe('T2 — TaskCard 子任务接入', () => {
  function setup() {
    const onUpdateTask = vi.fn();
    const task = makeTask();
    render(
      <TaskCard
        task={task}
        categories={['其他']}
        onTransitionStatus={vi.fn()}
        onUpdateTask={onUpdateTask}
      />,
    );
    // expand the card
    fireEvent.click(screen.getByRole('button', { name: /测试任务|task/i }));
    return { onUpdateTask, task };
  }

  it('展开任务卡片后显示子任务编辑器', () => {
    setup();
    expect(screen.getByText('步骤一')).toBeDefined();
  });

  it('添加子任务会提交 patch.subtasks', () => {
    const { onUpdateTask } = setup();
    fireEvent.change(screen.getByPlaceholderText('添加子任务步骤…'), {
      target: { value: '新步骤' },
    });
    fireEvent.click(screen.getByRole('button', { name: /添加子任务/ }));
    expect(onUpdateTask).toHaveBeenCalledTimes(1);
    const patch: UpdateTaskPatch = onUpdateTask.mock.calls[0][1];
    expect(patch.subtasks).toHaveLength(2);
    expect(patch.subtasks![1].title).toBe('新步骤');
  });

  it('勾选子任务会提交 patch.subtasks', () => {
    const { onUpdateTask } = setup();
    fireEvent.click(screen.getByLabelText('标记子任务完成：步骤一'));
    const patch: UpdateTaskPatch = onUpdateTask.mock.calls[0][1];
    expect(patch.subtasks![0].status).toBe('done');
  });
});
