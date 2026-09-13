import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { mockDispatch } = vi.hoisted(() => ({
  mockDispatch: vi.fn(),
}));

vi.mock('../AddTaskForm.module.css', () => ({
  default: {
    collapsedCard: 'collapsedCard',
    collapsedIcon: 'collapsedIcon',
    collapsedText: 'collapsedText',
    form: 'form',
    field: 'field',
    label: 'label',
    input: 'input',
    row: 'row',
    select: 'select',
    priorityGroup: 'priorityGroup',
    priorityBtn: 'priorityBtn',
    priorityBtnActive: 'priorityBtnActive',
    actions: 'actions',
    submitBtn: 'submitBtn',
    cancelBtn: 'cancelBtn',
  },
}));

vi.mock('../DataContext', async () => {
  const actual =
    await vi.importActual<typeof import('../DataContext')>('../DataContext');
  return {
    ...actual,
    useData: () => ({
      data: {
        settings: { categories: ['测试分类', '类别二'] },
      },
      dispatch: mockDispatch,
    }),
  };
});

import { AddTaskForm } from '../AddTaskForm';

const TEST_NOW = new Date('2026-07-23T10:00:00');

describe('AddTaskForm — direct full form', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TEST_NOW);
    mockDispatch.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders collapsed card initially and does not show the full form', () => {
    render(<AddTaskForm />);
    expect(screen.getByText('添加新任务')).toBeDefined();
    expect(screen.queryByPlaceholderText('输入新任务…')).toBeNull();
  });

  it('opens full form in one click with all required fields', () => {
    render(<AddTaskForm />);
    const card = screen.getByText('添加新任务').closest('[role="button"]');
    fireEvent.click(card!);

    expect(screen.getByPlaceholderText('输入新任务…')).toBeDefined();
    expect(screen.getByRole('combobox')).toBeDefined();
    expect(screen.getByText('紧急')).toBeDefined();
    expect(screen.getByText('重要')).toBeDefined();
    expect(screen.getByText('日常')).toBeDefined();
    expect(screen.getByLabelText('起始日期')).toBeDefined();
    expect(screen.getByLabelText('截止日期')).toBeDefined();
  });

  it('does not show the old separate due-date/reminder quick buttons', () => {
    render(<AddTaskForm />);
    const card = screen.getByText('添加新任务').closest('[role="button"]');
    fireEvent.click(card!);

    expect(screen.queryByLabelText('设置截止日期')).toBeNull();
    expect(screen.queryByLabelText('设置提醒时间')).toBeNull();
  });

  it('dispatches ADD_TASK with default startDate and no deadline on submit', () => {
    render(<AddTaskForm />);
    const card = screen.getByText('添加新任务').closest('[role="button"]');
    fireEvent.click(card!);

    const input = screen.getByPlaceholderText(
      '输入新任务…',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '测试任务' } });
    fireEvent.click(screen.getByText('添加'));

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'ADD_TASK',
      payload: {
        title: '测试任务',
        category: '测试分类',
        priority: 'normal',
        startDate: '2026-07-23',
        deadline: null,
      },
    });
  });

  it('submits with selected deadline and custom start date', () => {
    render(<AddTaskForm />);
    const card = screen.getByText('添加新任务').closest('[role="button"]');
    fireEvent.click(card!);

    const input = screen.getByPlaceholderText(
      '输入新任务…',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '带日期的任务' } });

    const start = screen.getByLabelText('起始日期') as HTMLInputElement;
    fireEvent.change(start, { target: { value: '2026-11-01' } });

    const deadline = screen.getByLabelText('截止日期') as HTMLInputElement;
    fireEvent.change(deadline, { target: { value: '2026-12-31' } });

    fireEvent.click(screen.getByText('添加'));

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'ADD_TASK',
      payload: {
        title: '带日期的任务',
        category: '测试分类',
        priority: 'normal',
        startDate: '2026-11-01',
        deadline: '2026-12-31',
      },
    });
  });

  it('cancel collapses the form and clears title', () => {
    render(<AddTaskForm />);
    const card = screen.getByText('添加新任务').closest('[role="button"]');
    fireEvent.click(card!);

    const input = screen.getByPlaceholderText(
      '输入新任务…',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '待取消' } });
    fireEvent.click(screen.getByText('取消'));

    expect(screen.getByText('添加新任务')).toBeDefined();
    expect(screen.queryByPlaceholderText('输入新任务…')).toBeNull();
  });
});
