/**
 * T1 — SubtaskEditor 组件
 *
 * 验证子任务编辑器外部行为：
 * - 渲染子任务列表和完成计数
 * - 添加子任务回调
 * - 勾选/取消完成回调
 * - 删除子任务回调
 * - 空标题不允许添加
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SubtaskEditor } from '../SubtaskEditor';
import type { SubTask } from '../types';

vi.mock('../SubtaskEditor.module.css', () => ({
  default: {
    section: 'section',
    sectionTitle: 'sectionTitle',
    sectionCounter: 'sectionCounter',
    subtaskList: 'subtaskList',
    subtaskRow: 'subtaskRow',
    subtaskCheckbox: 'subtaskCheckbox',
    subtaskTitle: 'subtaskTitle',
    subtaskTitleDone: 'subtaskTitleDone',
    subtaskInputRow: 'subtaskInputRow',
    input: 'input',
    addBtn: 'addBtn',
    removeBtn: 'removeBtn',
    subtaskItem: 'subtaskItem',
    expandBtn: 'expandBtn',
    subtaskDetails: 'subtaskDetails',
    detailsLabel: 'detailsLabel',
    detailsInput: 'detailsInput',
    detailsTextarea: 'detailsTextarea',
    quantityList: 'quantityList',
    quantityRow: 'quantityRow',
    quantityInput: 'quantityInput',
    quantityNumber: 'quantityNumber',
    quantityUnit: 'quantityUnit',
    addQuantityBtn: 'addQuantityBtn',
  },
}));

vi.mock('../Icon', () => ({
  Icon: ({ name, size }: { name: string; size: number }) => null,
}));

function makeSubtasks(): SubTask[] {
  return [
    { id: 's1', title: '准备材料', status: 'done' },
    { id: 's2', title: '提交申请', status: 'todo' },
  ];
}

function renderEditor(overrides?: {
  subtasks?: SubTask[];
  onAdd?: (title: string) => void;
  onToggle?: (id: string) => void;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, patch: Partial<SubTask>) => void;
}) {
  const props = {
    subtasks: overrides?.subtasks ?? makeSubtasks(),
    onAdd: overrides?.onAdd ?? vi.fn(),
    onToggle: overrides?.onToggle ?? vi.fn(),
    onDelete: overrides?.onDelete ?? vi.fn(),
    onUpdate: overrides?.onUpdate ?? vi.fn(),
  };
  render(<SubtaskEditor {...props} />);
  return props;
}

describe('T1 — SubtaskEditor', () => {
  it('渲染子任务标题和完成计数', () => {
    renderEditor();

    expect(screen.getByText('准备材料')).toBeDefined();
    expect(screen.getByText('提交申请')).toBeDefined();
    expect(screen.getByText(/1\/2/)).toBeDefined();
  });

  it('点击添加按钮时以去除首尾空格的标题调用 onAdd', () => {
    const onAdd = vi.fn();
    renderEditor({ subtasks: [], onAdd });

    fireEvent.change(screen.getByPlaceholderText('添加子任务步骤…'), {
      target: { value: '  整理文档  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /添加子任务/ }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith('整理文档');
  });

  it('按 Enter 也能添加子任务', () => {
    const onAdd = vi.fn();
    renderEditor({ subtasks: [], onAdd });

    fireEvent.change(screen.getByPlaceholderText('添加子任务步骤…'), {
      target: { value: '发送邮件' },
    });
    fireEvent.keyDown(screen.getByPlaceholderText('添加子任务步骤…'), {
      key: 'Enter',
    });

    expect(onAdd).toHaveBeenCalledWith('发送邮件');
  });

  it('空标题不会触发 onAdd', () => {
    const onAdd = vi.fn();
    renderEditor({ subtasks: [], onAdd });

    fireEvent.change(screen.getByPlaceholderText('添加子任务步骤…'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /添加子任务/ }));

    expect(onAdd).not.toHaveBeenCalled();
  });

  it('勾选子任务时以对应 id 调用 onToggle', () => {
    const onToggle = vi.fn();
    renderEditor({ onToggle });

    fireEvent.click(screen.getByLabelText('标记子任务完成：提交申请'));

    expect(onToggle).toHaveBeenCalledWith('s2');
  });

  it('点击删除按钮时以对应 id 调用 onDelete', () => {
    const onDelete = vi.fn();
    renderEditor({ onDelete });

    fireEvent.click(screen.getByLabelText('删除子任务：准备材料'));

    expect(onDelete).toHaveBeenCalledWith('s1');
  });

  it('没有子任务时不显示 0/0 之外的列表', () => {
    renderEditor({ subtasks: [] });

    expect(screen.queryByText(/0\/0/)).toBeDefined();
    expect(screen.queryByText('准备材料')).toBeNull();
  });
});

describe('T1 — 子任务详情编辑', () => {
  it('点击子任务标题展开详情表单', () => {
    renderEditor();
    fireEvent.click(screen.getByText('准备材料'));
    expect(screen.getByLabelText('具体内容')).toBeDefined();
    expect(screen.getByText('量化产出')).toBeDefined();
  });

  it('修改具体内容时调用 onUpdate', () => {
    const onUpdate = vi.fn();
    renderEditor({ onUpdate });
    fireEvent.click(screen.getByText('准备材料'));
    fireEvent.change(screen.getByLabelText('具体内容'), {
      target: { value: '整理所有材料并核对' },
    });
    expect(onUpdate).toHaveBeenCalledWith('s1', {
      notes: '整理所有材料并核对',
    });
  });

  it('点击添加产出时调用 onUpdate 追加一条产出', () => {
    const onUpdate = vi.fn();
    renderEditor({ onUpdate });
    fireEvent.click(screen.getByText('准备材料'));
    fireEvent.click(screen.getByRole('button', { name: /添加产出/ }));
    expect(onUpdate).toHaveBeenCalledWith('s1', {
      quantities: [expect.objectContaining({ label: '', value: 0, unit: '' })],
    });
  });
});
