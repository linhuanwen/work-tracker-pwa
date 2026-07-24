import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

/**
 * Seam: AddTaskForm — enhanced collapsed state
 *
 * Public interfaces tested:
 *   1. Collapsed card → click activates input with auto-focus
 *   2. Due date dropdown (今天/明天/下周一/选择日期) → sets deadline, shows Tag
 *   3. Reminder dropdown (今天16:00/明天9:00/选择日期时间) → sets deadline, shows Tag
 *   4. Enter key → dispatches ADD_TASK with defaults (no full-form expand)
 *   5. Expand arrow button → transitions to full form
 */

// ============================================================
// Hoisted mocks
// ============================================================

const { mockDispatch } = vi.hoisted(() => ({
  mockDispatch: vi.fn(),
}));

// ============================================================
// Mock CSS modules
// ============================================================

vi.mock('../AddTaskForm.module.css', () => ({
  default: {
    collapsedCard: 'collapsedCard',
    collapsedIcon: 'collapsedIcon',
    collapsedText: 'collapsedText',
    activeCollapsed: 'activeCollapsed',
    inputWrapper: 'inputWrapper',
    activeInput: 'activeInput',
    suffixArea: 'suffixArea',
    suffixBtn: 'suffixBtn',
    suffixBtnActive: 'suffixBtnActive',
    tagsRow: 'tagsRow',
    expandBtn: 'expandBtn',
    dropdown: 'dropdown',
    dropdownItem: 'dropdownItem',
    datePickerInput: 'datePickerInput',
    form: 'form',
    field: 'field',
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

// ============================================================
// Mock useData
// ============================================================

vi.mock('../DataContext', async () => {
  const actual = await vi.importActual<typeof import('../DataContext')>('../DataContext');
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

// ============================================================
// Freeze time: 2026-07-23 (Thursday)
// ============================================================

const TEST_NOW = new Date('2026-07-23T10:00:00');

// Expected calculated values (used in dispatch assertions)
const TOMORROW = '2026-07-24';
const TOMORROW_0900 = '2026-07-24T09:00';

// ============================================================
// Helpers
// ============================================================

/** Click the collapsed "添加新任务" card to activate the input. */
function activateCard() {
  const card = screen.getByText('添加新任务').closest('[role="button"]');
  expect(card).not.toBeNull();
  fireEvent.click(card!);
}

/** Get the active text input (placeholder = "输入新任务…"). */
function getInput(): HTMLInputElement {
  return screen.getByPlaceholderText('输入新任务…') as HTMLInputElement;
}

/** Type text into the active input. */
function typeTitle(text: string) {
  const input = getInput();
  fireEvent.change(input, { target: { value: text } });
}

// ============================================================
// Tests
// ============================================================

describe('AddTaskForm — collapsed state', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TEST_NOW);
    mockDispatch.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ================================================================
  // 1. Activation
  // ================================================================

  describe('activation', () => {
    it('renders collapsed card initially', () => {
      render(<AddTaskForm />);
      expect(screen.getByText('添加新任务')).toBeDefined();
      // Full form should NOT be visible
      expect(screen.queryByPlaceholderText('输入新任务…')).toBeNull();
    });

    it('activates input with auto-focus on clicking the collapsed card', () => {
      render(<AddTaskForm />);
      activateCard();

      // Input should now be visible and focused
      const input = getInput();
      expect(input).toBeDefined();
      expect(document.activeElement).toBe(input);
    });

    it('shows suffix buttons (due date, reminder, expand) when input is active', () => {
      render(<AddTaskForm />);
      activateCard();

      expect(screen.getByLabelText('设置截止日期')).toBeDefined();
      expect(screen.getByLabelText('设置提醒时间')).toBeDefined();
      expect(screen.getByLabelText('展开完整表单')).toBeDefined();
    });

    it('does NOT show suffix buttons when in idle collapsed state', () => {
      render(<AddTaskForm />);
      expect(screen.queryByLabelText('设置截止日期')).toBeNull();
      expect(screen.queryByLabelText('设置提醒时间')).toBeNull();
      expect(screen.queryByLabelText('展开完整表单')).toBeNull();
    });
  });

  // ================================================================
  // 2. Due date dropdown
  // ================================================================

  describe('due date dropdown', () => {
    it('opens dropdown when due date button is clicked', () => {
      render(<AddTaskForm />);
      activateCard();

      // Before click: no dropdown
      expect(screen.queryByText('今天')).toBeNull();

      // Click due date button
      fireEvent.click(screen.getByLabelText('设置截止日期'));

      // Dropdown should be visible with all four options
      expect(screen.getByText('今天')).toBeDefined();
      expect(screen.getByText('明天')).toBeDefined();
      expect(screen.getByText('下周一')).toBeDefined();
      expect(screen.getByText('选择日期')).toBeDefined();
    });

    it('closes dropdown when clicking the same button again (toggle)', () => {
      render(<AddTaskForm />);
      activateCard();

      fireEvent.click(screen.getByLabelText('设置截止日期'));
      expect(screen.getByText('今天')).toBeDefined();

      fireEvent.click(screen.getByLabelText('设置截止日期'));
      expect(screen.queryByText('今天')).toBeNull();
    });

    it('selecting "今天" sets deadline and shows a date Tag', () => {
      render(<AddTaskForm />);
      activateCard();

      fireEvent.click(screen.getByLabelText('设置截止日期'));
      fireEvent.click(screen.getByText('今天'));

      // Dropdown should close
      expect(screen.queryByText('明天')).toBeNull();

      // Tag should show "今天"
      const tags = document.querySelectorAll('[data-variant="date"]');
      expect(tags.length).toBe(1);
      expect(tags[0].textContent).toBe('今天');
    });

    it('selecting "明天" sets deadline and shows "明天" Tag', () => {
      render(<AddTaskForm />);
      activateCard();

      fireEvent.click(screen.getByLabelText('设置截止日期'));
      fireEvent.click(screen.getByText('明天'));

      const tags = document.querySelectorAll('[data-variant="date"]');
      expect(tags.length).toBe(1);
      expect(tags[0].textContent).toBe('明天');
    });

    it('selecting "下周一" sets deadline and shows correct date Tag', () => {
      render(<AddTaskForm />);
      activateCard();

      fireEvent.click(screen.getByLabelText('设置截止日期'));
      fireEvent.click(screen.getByText('下周一'));

      const tags = document.querySelectorAll('[data-variant="date"]');
      expect(tags.length).toBe(1);
      // Next Monday is 2026-07-27 → "7月27日" via formatDate
      expect(tags[0].textContent).toBe('7月27日');
    });

    it('selecting "选择日期" opens a native date picker input', () => {
      render(<AddTaskForm />);
      activateCard();

      fireEvent.click(screen.getByLabelText('设置截止日期'));
      fireEvent.click(screen.getByText('选择日期'));

      // A native date input should appear
      const dateInput = screen.getByTestId('due-date-picker');
      expect(dateInput).toBeDefined();
      expect((dateInput as HTMLInputElement).type).toBe('date');
    });

    it('setting a date via native picker shows the correct Tag', () => {
      render(<AddTaskForm />);
      activateCard();

      fireEvent.click(screen.getByLabelText('设置截止日期'));
      fireEvent.click(screen.getByText('选择日期'));

      const dateInput = screen.getByTestId('due-date-picker') as HTMLInputElement;
      fireEvent.change(dateInput, { target: { value: '2026-08-15' } });

      // Dropdown closes after picker selection
      // Tag should show "8月15日"
      const tags = document.querySelectorAll('[data-variant="date"]');
      expect(tags.length).toBe(1);
      expect(tags[0].textContent).toBe('8月15日');
    });
  });

  // ================================================================
  // 3. Reminder time dropdown
  // ================================================================

  describe('reminder time dropdown', () => {
    it('opens dropdown when reminder button is clicked', () => {
      render(<AddTaskForm />);
      activateCard();

      expect(screen.queryByText('今天16:00')).toBeNull();

      fireEvent.click(screen.getByLabelText('设置提醒时间'));

      expect(screen.getByText('今天16:00')).toBeDefined();
      expect(screen.getByText('明天9:00')).toBeDefined();
      expect(screen.getByText('选择日期时间')).toBeDefined();
    });

    it('closes the due date dropdown when reminder button is clicked', () => {
      render(<AddTaskForm />);
      activateCard();

      // Open due date dropdown first
      fireEvent.click(screen.getByLabelText('设置截止日期'));
      expect(screen.getByText('今天')).toBeDefined();

      // Click reminder button → due date dropdown closes, reminder opens
      fireEvent.click(screen.getByLabelText('设置提醒时间'));
      expect(screen.queryByText('今天')).toBeNull(); // due date option closed
      expect(screen.getByText('今天16:00')).toBeDefined(); // reminder option open
    });

    it('selecting "今天16:00" sets reminder and shows a date Tag', () => {
      render(<AddTaskForm />);
      activateCard();

      fireEvent.click(screen.getByLabelText('设置提醒时间'));
      fireEvent.click(screen.getByText('今天16:00'));

      // Dropdown should close
      expect(screen.queryByText('明天9:00')).toBeNull();

      // Tag should show the date
      const tags = document.querySelectorAll('[data-variant="date"]');
      expect(tags.length).toBe(1);
      expect(tags[0].textContent).toBe('今天');
    });

    it('selecting "明天9:00" sets reminder and shows "明天" Tag', () => {
      render(<AddTaskForm />);
      activateCard();

      fireEvent.click(screen.getByLabelText('设置提醒时间'));
      fireEvent.click(screen.getByText('明天9:00'));

      const tags = document.querySelectorAll('[data-variant="date"]');
      expect(tags.length).toBe(1);
      expect(tags[0].textContent).toBe('明天');
    });

    it('selecting "选择日期时间" opens a native datetime-local picker', () => {
      render(<AddTaskForm />);
      activateCard();

      fireEvent.click(screen.getByLabelText('设置提醒时间'));
      fireEvent.click(screen.getByText('选择日期时间'));

      const dtInput = screen.getByTestId('reminder-datetime-picker');
      expect(dtInput).toBeDefined();
      expect((dtInput as HTMLInputElement).type).toBe('datetime-local');
    });

    it('setting a datetime via native picker shows the correct Tag', () => {
      render(<AddTaskForm />);
      activateCard();

      fireEvent.click(screen.getByLabelText('设置提醒时间'));
      fireEvent.click(screen.getByText('选择日期时间'));

      const dtInput = screen.getByTestId('reminder-datetime-picker') as HTMLInputElement;
      fireEvent.change(dtInput, { target: { value: '2026-08-15T14:30' } });

      const tags = document.querySelectorAll('[data-variant="date"]');
      expect(tags.length).toBe(1);
      expect(tags[0].textContent).toBe('8月15日');
    });

    it('shows TWO tags when both due date and reminder are selected', () => {
      render(<AddTaskForm />);
      activateCard();

      // Set due date: 今天
      fireEvent.click(screen.getByLabelText('设置截止日期'));
      fireEvent.click(screen.getByText('今天'));

      // Set reminder: 明天9:00
      fireEvent.click(screen.getByLabelText('设置提醒时间'));
      fireEvent.click(screen.getByText('明天9:00'));

      const tags = document.querySelectorAll('[data-variant="date"]');
      expect(tags.length).toBe(2);
    });
  });

  // ================================================================
  // 4. Enter key → quick-create with defaults
  // ================================================================

  describe('Enter key submission', () => {
    it('dispatches ADD_TASK with title and default category/priority on Enter', () => {
      render(<AddTaskForm />);
      activateCard();
      typeTitle('测试任务');

      const input = getInput();
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockDispatch).toHaveBeenCalledTimes(1);
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'ADD_TASK',
        payload: {
          title: '测试任务',
          category: '测试分类', // first category is default
          priority: 'normal',   // default priority
          deadline: null,
        },
      });
    });

    it('dispatches ADD_TASK with deadline when due date is selected', () => {
      render(<AddTaskForm />);
      activateCard();
      typeTitle('带截止日期的任务');

      // Select due date: 明天
      fireEvent.click(screen.getByLabelText('设置截止日期'));
      fireEvent.click(screen.getByText('明天'));

      const input = getInput();
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'ADD_TASK',
        payload: {
          title: '带截止日期的任务',
          category: '测试分类',
          priority: 'normal',
          deadline: TOMORROW,
        },
      });
    });

    it('dispatches ADD_TASK with deadline when reminder time is selected', () => {
      render(<AddTaskForm />);
      activateCard();
      typeTitle('带提醒的任务');

      // Select reminder: 明天9:00
      fireEvent.click(screen.getByLabelText('设置提醒时间'));
      fireEvent.click(screen.getByText('明天9:00'));

      const input = getInput();
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'ADD_TASK',
        payload: {
          title: '带提醒的任务',
          category: '测试分类',
          priority: 'normal',
          deadline: TOMORROW_0900,
        },
      });
    });

    it('does NOT dispatch when title is empty on Enter', () => {
      render(<AddTaskForm />);
      activateCard();

      // Title is empty (only whitespace)
      const input = getInput();
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('does NOT dispatch when title is only whitespace on Enter', () => {
      render(<AddTaskForm />);
      activateCard();
      typeTitle('   ');

      const input = getInput();
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('clears title and collapses after successful Enter submission', () => {
      render(<AddTaskForm />);
      activateCard();
      typeTitle('完成后清空');

      const input = getInput();
      fireEvent.keyDown(input, { key: 'Enter' });

      // After submission, should go back to idle collapsed card
      expect(screen.getByText('添加新任务')).toBeDefined();
      expect(screen.queryByPlaceholderText('输入新任务…')).toBeNull();
    });

    it('calls onTaskAdded callback after Enter submission', () => {
      const onTaskAdded = vi.fn();
      render(<AddTaskForm onTaskAdded={onTaskAdded} />);
      activateCard();
      typeTitle('回调测试');

      const input = getInput();
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onTaskAdded).toHaveBeenCalledTimes(1);
    });
  });

  // ================================================================
  // 5. Expand arrow → full form
  // ================================================================

  describe('expand arrow', () => {
    it('transitions to full form when expand arrow is clicked', () => {
      render(<AddTaskForm />);
      activateCard();

      // Click the expand arrow button
      fireEvent.click(screen.getByLabelText('展开完整表单'));

      // Full form should now be visible
      // The full form has a select for category and priority buttons
      expect(screen.getByText('添加')).toBeDefined(); // submit button
      expect(screen.getByText('取消')).toBeDefined(); // cancel button
      expect(screen.getByText('紧急')).toBeDefined(); // priority button
    });

    it('pre-populates full form title from collapsed input', () => {
      render(<AddTaskForm />);
      activateCard();
      typeTitle('预填充标题');

      fireEvent.click(screen.getByLabelText('展开完整表单'));

      // The expanded form input should have the same title
      const expandedInput = screen.getByPlaceholderText('输入新任务…') as HTMLInputElement;
      expect(expandedInput.value).toBe('预填充标题');
    });

    it('shows cancel button in full form and collapses back on cancel', () => {
      render(<AddTaskForm />);
      activateCard();

      fireEvent.click(screen.getByLabelText('展开完整表单'));

      // Full form is visible
      expect(screen.getByText('取消')).toBeDefined();

      // Click cancel
      fireEvent.click(screen.getByText('取消'));

      // Back to idle collapsed card
      expect(screen.getByText('添加新任务')).toBeDefined();
      expect(screen.queryByText('取消')).toBeNull();
    });
  });
});
