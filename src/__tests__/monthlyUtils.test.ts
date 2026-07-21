import { describe, it, expect } from 'vitest';
import type { Task, Project } from '../types';
import {
  isDateInMonth,
  getMonthKey,
  getMonthLabel,
  getAdjacentMonth,
  aggregateMonthlyQuantities,
  getMonthlyProjectProgress,
  getNextMonthFocusCandidates,
} from '../monthlyUtils';

/**
 * Seams S1-S3: 月小结纯逻辑
 *
 * Pure functions for monthly aggregation and template filling.
 * Tests verify correct filtering, quantity merging across tasks,
 * project progress tracking, and next-month candidate selection.
 */

// ============================================================
// Helpers
// ============================================================

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't-1',
    projectId: null,
    title: '测试任务',
    category: '其他',
    priority: 'normal',
    status: 'todo',
    createdDate: '2026-07-15',
    updatedDate: '2026-07-15',
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

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p-1',
    title: '测试项目',
    category: '其他',
    status: 'in-progress',
    startDate: '2026-01-01',
    targetDate: '2026-12-31',
    notes: '',
    subtaskCount: { total: 0, done: 0 },
    ...overrides,
  };
}

// ============================================================
// Month math
// ============================================================

describe('isDateInMonth', () => {
  it('returns true for a date within the month', () => {
    expect(isDateInMonth('2026-07-15', 2026, 7)).toBe(true);
  });

  it('returns true for first day of month', () => {
    expect(isDateInMonth('2026-07-01', 2026, 7)).toBe(true);
  });

  it('returns true for last day of month', () => {
    expect(isDateInMonth('2026-07-31', 2026, 7)).toBe(true);
  });

  it('returns false for a date in a different month', () => {
    expect(isDateInMonth('2026-08-01', 2026, 7)).toBe(false);
  });

  it('returns false for a date in a different year', () => {
    expect(isDateInMonth('2025-07-15', 2026, 7)).toBe(false);
  });

  it('returns false for null date', () => {
    expect(isDateInMonth(null, 2026, 7)).toBe(false);
  });

  it('handles February correctly (non-leap year)', () => {
    expect(isDateInMonth('2026-02-28', 2026, 2)).toBe(true);
    expect(isDateInMonth('2026-03-01', 2026, 2)).toBe(false);
  });
});

describe('getMonthKey', () => {
  it('returns YYYY-MM format', () => {
    expect(getMonthKey(2026, 7)).toBe('2026-07');
  });

  it('pads single-digit months with zero', () => {
    expect(getMonthKey(2026, 1)).toBe('2026-01');
    expect(getMonthKey(2026, 12)).toBe('2026-12');
  });
});

describe('getMonthLabel', () => {
  it('returns Chinese label for the month', () => {
    expect(getMonthLabel(2026, 7)).toBe('2026年7月');
  });

  it('handles January', () => {
    expect(getMonthLabel(2026, 1)).toBe('2026年1月');
  });
});

describe('getAdjacentMonth', () => {
  it('returns previous month', () => {
    expect(getAdjacentMonth(2026, 7, -1)).toEqual({ year: 2026, month: 6 });
  });

  it('returns next month', () => {
    expect(getAdjacentMonth(2026, 7, 1)).toEqual({ year: 2026, month: 8 });
  });

  it('handles year boundary going backward', () => {
    expect(getAdjacentMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });

  it('handles year boundary going forward', () => {
    expect(getAdjacentMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
  });
});

// ============================================================
// S1: 量化汇总表 (aggregateMonthlyQuantities)
// ============================================================

describe('aggregateMonthlyQuantities', () => {
  it('filters only done tasks completed in the target month', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '本月完成', category: '内部招聘', status: 'done', completedDate: '2026-07-10',
        quantities: [{ label: '审查', value: 5, unit: '人次' }] }),
      makeTask({ id: '2', title: '上月完成', category: '内部招聘', status: 'done', completedDate: '2026-06-28',
        quantities: [{ label: '审查', value: 3, unit: '人次' }] }),
      makeTask({ id: '3', title: '未完成', category: '内部招聘', status: 'todo',
        quantities: [{ label: '审查', value: 1, unit: '人次' }] }),
      makeTask({ id: '4', title: '进行中', category: '内部招聘', status: 'in-progress',
        quantities: [{ label: '审查', value: 1, unit: '人次' }] }),
    ];
    const result = aggregateMonthlyQuantities(tasks, 2026, 7);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('内部招聘');
    expect(result[0].value).toBe(5); // only the done+completed-in-July task
  });

  it('aggregates quantities by category, merging same label values', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1', title: '资格审查A', category: '内部招聘', status: 'done',
        completedDate: '2026-07-05',
        quantities: [{ label: '资格审查', value: 30, unit: '人次' }],
      }),
      makeTask({
        id: '2', title: '资格审查B', category: '内部招聘', status: 'done',
        completedDate: '2026-07-15',
        quantities: [{ label: '资格审查', value: 15, unit: '人次' }],
      }),
    ];
    const result = aggregateMonthlyQuantities(tasks, 2026, 7);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('资格审查');
    expect(result[0].value).toBe(45);
    expect(result[0].unit).toBe('人次');
  });

  it('keeps different labels separate within same category', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1', title: '审查任务', category: '内部招聘', status: 'done',
        completedDate: '2026-07-05',
        quantities: [{ label: '资格审查', value: 30, unit: '人次' }],
      }),
      makeTask({
        id: '2', title: '晋升任务', category: '内部招聘', status: 'done',
        completedDate: '2026-07-10',
        quantities: [{ label: '助力晋升', value: 3, unit: '人' }],
      }),
    ];
    const result = aggregateMonthlyQuantities(tasks, 2026, 7);
    expect(result).toHaveLength(2);
    const labels = result.map((r) => `${r.label}=${r.value}`);
    expect(labels).toContain('资格审查=30');
    expect(labels).toContain('助力晋升=3');
  });

  it('isolates quantities across different categories (same label, separate groups)', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1', title: '招聘审查', category: '内部招聘', status: 'done',
        completedDate: '2026-07-05',
        quantities: [{ label: '审查', value: 20, unit: '人次' }],
      }),
      makeTask({
        id: '2', title: '绩效审查', category: '绩效管理', status: 'done',
        completedDate: '2026-07-10',
        quantities: [{ label: '审查', value: 10, unit: '人次' }],
      }),
    ];
    const result = aggregateMonthlyQuantities(tasks, 2026, 7);
    const recruitment = result.find((r) => r.category === '内部招聘');
    const performance = result.find((r) => r.category === '绩效管理');
    expect(recruitment?.value).toBe(20);
    expect(performance?.value).toBe(10);
  });

  it('handles tasks with multiple quantities', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1', title: '综合任务', category: '内部招聘', status: 'done',
        completedDate: '2026-07-05',
        quantities: [
          { label: '资格审查', value: 30, unit: '人次' },
          { label: '助力晋升', value: 1, unit: '人' },
        ],
      }),
    ];
    const result = aggregateMonthlyQuantities(tasks, 2026, 7);
    expect(result).toHaveLength(2);
  });

  it('handles cross-task quantity merging with multiple quantities per task', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1', title: '任务A', category: '内部招聘', status: 'done',
        completedDate: '2026-07-05',
        quantities: [
          { label: '资格审查', value: 30, unit: '人次' },
          { label: '助力晋升', value: 1, unit: '人' },
        ],
      }),
      makeTask({
        id: '2', title: '任务B', category: '内部招聘', status: 'done',
        completedDate: '2026-07-15',
        quantities: [
          { label: '资格审查', value: 15, unit: '人次' },
          { label: '助力晋升', value: 2, unit: '人' },
        ],
      }),
    ];
    const result = aggregateMonthlyQuantities(tasks, 2026, 7);
    const shencha = result.find((r) => r.label === '资格审查');
    const jinsheng = result.find((r) => r.label === '助力晋升');
    expect(shencha?.value).toBe(45);
    expect(jinsheng?.value).toBe(3);
  });

  it('returns empty array for month with no completed tasks', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '任务', category: '内部招聘', status: 'done', completedDate: '2026-06-15' }),
    ];
    const result = aggregateMonthlyQuantities(tasks, 2026, 7);
    expect(result).toEqual([]);
  });

  it('returns empty array for empty task list', () => {
    const result = aggregateMonthlyQuantities([], 2026, 7);
    expect(result).toEqual([]);
  });

  it('skips tasks with empty quantities array', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '无量化', category: '内部招聘', status: 'done', completedDate: '2026-07-10', quantities: [] }),
      makeTask({ id: '2', title: '有量化', category: '内部招聘', status: 'done', completedDate: '2026-07-15',
        quantities: [{ label: '审查', value: 5, unit: '人次' }] }),
    ];
    const result = aggregateMonthlyQuantities(tasks, 2026, 7);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(5);
  });

  it('excludes cancelled tasks even if they have completedDate', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1', title: '已取消', category: '内部招聘', status: 'cancelled',
        completedDate: '2026-07-10',
        quantities: [{ label: '审查', value: 10, unit: '人次' }],
      }),
    ];
    const result = aggregateMonthlyQuantities(tasks, 2026, 7);
    expect(result).toEqual([]);
  });
});

// ============================================================
// S2: 项目进度回顾 (getMonthlyProjectProgress)
// ============================================================

describe('getMonthlyProjectProgress', () => {
  it('finds projects that had subtasks completed in the target month', () => {
    const tasks: Task[] = [
      makeTask({
        id: 't1', projectId: 'p-1', title: '项目任务',
        category: '绩效管理', status: 'done',
        completedDate: '2026-07-15',
        subtasks: [
          { id: 's1', title: '起草方案', status: 'done' },
          { id: 's2', title: '征求意见', status: 'done' },
        ],
      }),
    ];
    const projects: Project[] = [
      makeProject({ id: 'p-1', title: '年度晋升专项', category: '绩效管理' }),
    ];
    const result = getMonthlyProjectProgress(tasks, projects, 2026, 7);
    expect(result).toHaveLength(1);
    expect(result[0].projectTitle).toBe('年度晋升专项');
  });

  it('calculates before/after progress percentages', () => {
    const tasks: Task[] = [
      makeTask({
        id: 't1', projectId: 'p-1', title: '任务',
        category: '绩效管理', status: 'done',
        completedDate: '2026-07-15',
        subtasks: [
          { id: 's1', title: '步骤一', status: 'done' },
          { id: 's2', title: '步骤二', status: 'done' },
          { id: 's3', title: '步骤三', status: 'todo' },
          { id: 's4', title: '步骤四', status: 'todo' },
        ],
      }),
    ];
    const projects: Project[] = [
      makeProject({ id: 'p-1', title: '项目X', category: '绩效管理' }),
    ];
    const result = getMonthlyProjectProgress(tasks, projects, 2026, 7);
    expect(result[0].totalSubtasks).toBe(4);
    expect(result[0].doneSubtasks).toBe(2);
    expect(result[0].afterPercent).toBe(50);
  });

  it('aggregates progress across multiple tasks in same project for the month', () => {
    const tasks: Task[] = [
      makeTask({
        id: 't1', projectId: 'p-1', title: '任务A',
        category: '绩效管理', status: 'done',
        completedDate: '2026-07-10',
        subtasks: [
          { id: 's1', title: '阶段一-1', status: 'done' },
          { id: 's2', title: '阶段一-2', status: 'todo' },
        ],
      }),
      makeTask({
        id: 't2', projectId: 'p-1', title: '任务B',
        category: '绩效管理', status: 'done',
        completedDate: '2026-07-20',
        subtasks: [
          { id: 's3', title: '阶段二-1', status: 'done' },
          { id: 's4', title: '阶段二-2', status: 'done' },
        ],
      }),
    ];
    const projects: Project[] = [
      makeProject({ id: 'p-1', title: '多任务项目', category: '绩效管理' }),
    ];
    const result = getMonthlyProjectProgress(tasks, projects, 2026, 7);
    expect(result).toHaveLength(1);
    expect(result[0].totalSubtasks).toBe(4);
    expect(result[0].doneSubtasks).toBe(3);
    expect(result[0].completedThisWeek).toHaveLength(3); // all 3 done subtasks from tasks done this month
  });

  it('excludes projects with no task completions this month', () => {
    const tasks: Task[] = [
      makeTask({
        id: 't1', projectId: 'p-1', title: '旧任务',
        category: '绩效管理', status: 'done',
        completedDate: '2026-06-15',
        subtasks: [
          { id: 's1', title: '旧步骤', status: 'done' },
        ],
      }),
    ];
    const projects: Project[] = [
      makeProject({ id: 'p-1', title: '旧项目', category: '绩效管理' }),
    ];
    const result = getMonthlyProjectProgress(tasks, projects, 2026, 7);
    expect(result).toEqual([]);
  });

  it('handles empty projects list', () => {
    const result = getMonthlyProjectProgress([], [], 2026, 7);
    expect(result).toEqual([]);
  });

  it('handles project with no tasks at all', () => {
    const tasks: Task[] = [];
    const projects: Project[] = [
      makeProject({ id: 'p-1', title: '空项目', category: '绩效管理' }),
    ];
    const result = getMonthlyProjectProgress(tasks, projects, 2026, 7);
    expect(result).toEqual([]);
  });

  it('lists completed subtask titles from this month', () => {
    const tasks: Task[] = [
      makeTask({
        id: 't1', projectId: 'p-1', title: '任务',
        category: '绩效管理', status: 'done',
        completedDate: '2026-07-15',
        subtasks: [
          { id: 's1', title: '起草方案', status: 'done' },
          { id: 's2', title: '征求意见', status: 'todo' },
        ],
      }),
    ];
    const projects: Project[] = [
      makeProject({ id: 'p-1', title: '项目X', category: '绩效管理' }),
    ];
    const result = getMonthlyProjectProgress(tasks, projects, 2026, 7);
    expect(result[0].completedThisWeek).toContain('起草方案');
    expect(result[0].completedThisWeek).not.toContain('征求意见');
  });

  it('shows beforePercent as 0 when no subtasks were done before this month', () => {
    // All done this month → before = 0
    const tasks: Task[] = [
      makeTask({
        id: 't1', projectId: 'p-1', title: '任务',
        category: '绩效管理', status: 'done',
        completedDate: '2026-07-15',
        subtasks: [
          { id: 's1', title: '新步骤', status: 'done' },
          { id: 's2', title: '待做', status: 'todo' },
        ],
      }),
    ];
    const projects: Project[] = [
      makeProject({ id: 'p-1', title: '新项目', category: '绩效管理' }),
    ];
    const result = getMonthlyProjectProgress(tasks, projects, 2026, 7);
    expect(result[0].beforePercent).toBe(0);
    expect(result[0].afterPercent).toBe(50);
  });
});

// ============================================================
// S3: 下月重点 (getNextMonthFocusCandidates)
// ============================================================

describe('getNextMonthFocusCandidates', () => {
  it('returns todo tasks with deadline in the next month', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '下月任务', category: '内部招聘', status: 'todo', deadline: '2026-08-15' }),
    ];
    const result = getNextMonthFocusCandidates(tasks, 2026, 7);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('下月任务');
  });

  it('returns todo tasks with no deadline (always relevant)', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '无截止日', category: '内部招聘', status: 'todo', deadline: null }),
    ];
    const result = getNextMonthFocusCandidates(tasks, 2026, 7);
    expect(result).toHaveLength(1);
  });

  it('excludes tasks with deadline beyond next month', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '远期', category: '内部招聘', status: 'todo', deadline: '2026-12-31' }),
    ];
    const result = getNextMonthFocusCandidates(tasks, 2026, 7);
    expect(result).toHaveLength(0);
  });

  it('excludes tasks with deadline in the past', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '过期', category: '内部招聘', status: 'todo', deadline: '2026-06-01' }),
    ];
    const result = getNextMonthFocusCandidates(tasks, 2026, 7);
    expect(result).toHaveLength(0);
  });

  it('includes tasks with deadline on the first day of next month', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '月初截止', category: '内部招聘', status: 'todo', deadline: '2026-08-01' }),
    ];
    const result = getNextMonthFocusCandidates(tasks, 2026, 7);
    expect(result).toHaveLength(1);
  });

  it('includes tasks with deadline on the last day of next month', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '月末截止', category: '内部招聘', status: 'todo', deadline: '2026-08-31' }),
    ];
    const result = getNextMonthFocusCandidates(tasks, 2026, 7);
    expect(result).toHaveLength(1);
  });

  it('excludes tasks with deadline in current month', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '本月截止', category: '内部招聘', status: 'todo', deadline: '2026-07-20' }),
    ];
    const result = getNextMonthFocusCandidates(tasks, 2026, 7);
    expect(result).toHaveLength(0);
  });

  it('excludes non-todo tasks', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '进行中', category: '内部招聘', status: 'in-progress', deadline: '2026-08-15' }),
      makeTask({ id: '2', title: '已完成', category: '内部招聘', status: 'done', deadline: '2026-08-15' }),
      makeTask({ id: '3', title: '已取消', category: '内部招聘', status: 'cancelled', deadline: '2026-08-15' }),
    ];
    const result = getNextMonthFocusCandidates(tasks, 2026, 7);
    expect(result).toHaveLength(0);
  });

  it('handles year boundary (December → next January)', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '明年一月', category: '内部招聘', status: 'todo', deadline: '2027-01-10' }),
    ];
    const result = getNextMonthFocusCandidates(tasks, 2026, 12);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('明年一月');
  });

  it('handles empty task list', () => {
    const result = getNextMonthFocusCandidates([], 2026, 7);
    expect(result).toEqual([]);
  });

  it('returns taskId, title, and category in each candidate', () => {
    const tasks: Task[] = [
      makeTask({ id: 'task-abc', title: '测试', category: '绩效管理', status: 'todo', deadline: '2026-08-01' }),
    ];
    const result = getNextMonthFocusCandidates(tasks, 2026, 7);
    expect(result[0]).toEqual({
      taskId: 'task-abc',
      title: '测试',
      category: '绩效管理',
    });
  });
});
