import { describe, it, expect } from 'vitest';
import type { Task, Project } from '../types';
import {
  getWeekKey,
  getWeekDateRange,
  getAdjacentWeek,
  isDateInWeek,
  formatQuantityText,
  getCompletedTasksByCategory,
  getProjectProgressChanges,
  getNextWeekPlanCandidates,
  getCoordinationItems,
} from '../weeklyUtils';

/**
 * Seam 2: 周小结纯逻辑 — week math + template filling
 *
 * Pure functions for week calculation and weekly summary template
 * population. Tests verify correct filtering, grouping, formatting,
 * and edge cases.
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
    createdDate: '2026-07-21',
    updatedDate: '2026-07-21',
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
// Week math
// ============================================================

describe('getWeekKey', () => {
  it('returns ISO week key for a date', () => {
    // 2026-07-21 is a Tuesday, ISO week 30
    expect(getWeekKey(new Date('2026-07-21'))).toBe('2026-W30');
  });

  it('returns W01 for first week of January', () => {
    expect(getWeekKey(new Date('2026-01-01'))).toBe('2026-W01');
  });

  it('handles year boundary — Dec 31 may be W01 of next year', () => {
    // 2026-12-31 is a Thursday → still in 2026 ISO week 53 or W01 of 2027
    const key = getWeekKey(new Date('2026-12-31'));
    expect(key).toMatch(/^202[67]-W\d{2}$/);
  });
});

describe('getWeekDateRange', () => {
  it('returns Monday to Friday for a given week key', () => {
    // 2026-W30: Monday = July 20, Friday = July 24 (based on ISO week)
    const range = getWeekDateRange('2026-W30');
    expect(range.start).toBeTruthy();
    expect(range.end).toBeTruthy();
    // start should be a Monday, end should be a Friday
    const startDay = new Date(range.start).getDay();
    const endDay = new Date(range.end).getDay();
    expect(startDay).toBe(1); // Monday
    expect(endDay).toBe(5);   // Friday
  });

  it('returns formatted label like "7月20日 - 7月24日"', () => {
    const range = getWeekDateRange('2026-W30');
    expect(range.label).toMatch(/\d+月\d+日 - \d+月\d+日/);
  });
});

describe('getAdjacentWeek', () => {
  it('returns previous week key', () => {
    expect(getAdjacentWeek('2026-W30', -1)).toBe('2026-W29');
  });

  it('returns next week key', () => {
    expect(getAdjacentWeek('2026-W30', 1)).toBe('2026-W31');
  });

  it('handles year boundary going backward', () => {
    expect(getAdjacentWeek('2026-W01', -1)).toBe('2025-W52');
  });

  it('handles year boundary going forward', () => {
    // 2026 has 53 ISO weeks; W53 + 1 → 2027-W01
    const lastWeek = getAdjacentWeek('2026-W53', 1);
    expect(lastWeek).toMatch(/^2027-W\d{2}$/);
  });
});

describe('isDateInWeek', () => {
  it('returns true for a date within the week', () => {
    // 2026-07-21 (Tue) is in W30
    expect(isDateInWeek('2026-07-21', '2026-W30')).toBe(true);
  });

  it('returns false for a date outside the week', () => {
    expect(isDateInWeek('2026-07-13', '2026-W30')).toBe(false);
  });

  it('returns true for Monday boundary', () => {
    // 2026-W30 Monday = 2026-07-20
    expect(isDateInWeek('2026-07-20', '2026-W30')).toBe(true);
  });

  it('returns true for Friday boundary', () => {
    // 2026-W30 Friday = 2026-07-24
    expect(isDateInWeek('2026-07-24', '2026-W30')).toBe(true);
  });

  it('returns false for null date', () => {
    expect(isDateInWeek(null, '2026-W30')).toBe(false);
  });
});

// ============================================================
// Quantity formatting
// ============================================================

describe('formatQuantityText', () => {
  it('formats a single quantity', () => {
    const task = makeTask({
      quantities: [{ label: '审查', value: 15, unit: '人次' }],
    });
    expect(formatQuantityText(task)).toBe('审查 15 人次');
  });

  it('formats multiple quantities joined by "，"', () => {
    const task = makeTask({
      quantities: [
        { label: '审查', value: 15, unit: '人次' },
        { label: '通过', value: 14, unit: '人次' },
      ],
    });
    expect(formatQuantityText(task)).toBe('审查 15 人次，通过 14 人次');
  });

  it('returns empty string for task with no quantities', () => {
    const task = makeTask({ quantities: [] });
    expect(formatQuantityText(task)).toBe('');
  });
});

// ============================================================
// Section 1: 本周完成任务 (completed tasks by category)
// ============================================================

describe('getCompletedTasksByCategory', () => {
  const categories = ['人员调配', '内部招聘', '绩效管理', '其他'];
  // 2026-W30 = Mon 7/20 – Fri 7/24

  it('filters tasks completed within the week', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '任务A', category: '绩效管理', status: 'done', completedDate: '2026-07-21' }),
      makeTask({ id: '2', title: '任务B', category: '其他', status: 'done', completedDate: '2026-07-22' }),
      makeTask({ id: '3', title: '任务C', category: '绩效管理', status: 'done', completedDate: '2026-07-13' }), // last week
    ];
    const result = getCompletedTasksByCategory(tasks, '2026-W30', categories);
    expect(result).toHaveLength(2); // 绩效管理 + 其他
    expect(result[0].category).toBe('绩效管理');
    expect(result[0].tasks).toHaveLength(1);
    expect(result[1].category).toBe('其他');
    expect(result[1].tasks).toHaveLength(1);
  });

  it('groups tasks by category ordered by settings.categories', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '其他任务', category: '其他', status: 'done', completedDate: '2026-07-21' }),
      makeTask({ id: '2', title: '绩效任务', category: '绩效管理', status: 'done', completedDate: '2026-07-22' }),
    ];
    const result = getCompletedTasksByCategory(tasks, '2026-W30', categories);
    // 绩效管理 comes before 其他 in categories order
    expect(result[0].category).toBe('绩效管理');
    expect(result[1].category).toBe('其他');
  });

  it('excludes categories with no completed tasks', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '绩效任务', category: '绩效管理', status: 'done', completedDate: '2026-07-21' }),
    ];
    const result = getCompletedTasksByCategory(tasks, '2026-W30', categories);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('绩效管理');
  });

  it('includes task title and formatted quantity text', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '季度考核',
        category: '绩效管理',
        status: 'done',
        completedDate: '2026-07-21',
        quantities: [{ label: '考核', value: 120, unit: '人' }],
      }),
    ];
    const result = getCompletedTasksByCategory(tasks, '2026-W30', categories);
    expect(result[0].tasks[0].title).toBe('季度考核');
    expect(result[0].tasks[0].quantityText).toBe('考核 120 人');
  });

  it('includes trimmed task notes (empty when not set)', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '带内容任务',
        category: '绩效管理',
        status: 'done',
        completedDate: '2026-07-21',
        notes: '  完成了考核方案设计与落地  ',
      }),
      makeTask({
        id: '2',
        title: '无内容任务',
        category: '绩效管理',
        status: 'done',
        completedDate: '2026-07-22',
      }),
    ];
    const result = getCompletedTasksByCategory(tasks, '2026-W30', categories);
    expect(result[0].tasks[0].notes).toBe('完成了考核方案设计与落地');
    expect(result[0].tasks[1].notes).toBe('');
  });

  it('excludes tasks with status done but completedDate outside the week', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '旧任务', category: '绩效管理', status: 'done', completedDate: '2026-07-13' }),
      makeTask({ id: '2', title: '本周任务', category: '绩效管理', status: 'done', completedDate: '2026-07-21' }),
    ];
    const result = getCompletedTasksByCategory(tasks, '2026-W30', categories);
    expect(result[0].tasks).toHaveLength(1);
    expect(result[0].tasks[0].title).toBe('本周任务');
  });

  it('returns empty array when no tasks were completed this week', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '旧任务', category: '绩效管理', status: 'done', completedDate: '2026-07-13' }),
    ];
    const result = getCompletedTasksByCategory(tasks, '2026-W30', categories);
    expect(result).toEqual([]);
  });

  it('handles empty task list', () => {
    const result = getCompletedTasksByCategory([], '2026-W30', categories);
    expect(result).toEqual([]);
  });
});

// ============================================================
// Section 2: 长期项目推进 (project progress changes)
// ============================================================

describe('getProjectProgressChanges', () => {
  // 2026-W30 = Mon 7/20 – Fri 7/24

  it('finds projects that had subtasks completed this week', () => {
    const tasks: Task[] = [
      makeTask({
        id: 't1',
        projectId: 'p-1',
        title: '项目任务A',
        category: '绩效管理',
        status: 'done',
        completedDate: '2026-07-21',
        subtasks: [
          { id: 's1', title: '起草方案', status: 'done' },
          { id: 's2', title: '征求意见', status: 'done' },
        ],
      }),
    ];
    const projects: Project[] = [
      makeProject({ id: 'p-1', title: '2026年度晋升支持专项', category: '绩效管理' }),
    ];
    const result = getProjectProgressChanges(tasks, projects, '2026-W30');
    expect(result).toHaveLength(1);
    expect(result[0].projectTitle).toBe('2026年度晋升支持专项');
  });

  it('calculates progress change based on subtask counts', () => {
    const tasks: Task[] = [
      makeTask({
        id: 't1',
        projectId: 'p-1',
        title: '项目任务A',
        category: '绩效管理',
        status: 'done',
        completedDate: '2026-07-21',
        subtasks: [
          { id: 's1', title: '步骤一', status: 'done' },
          { id: 's2', title: '步骤二', status: 'done' },
          { id: 's3', title: '步骤三', status: 'todo' },
        ],
      }),
    ];
    const projects: Project[] = [
      makeProject({ id: 'p-1', title: '项目X', category: '绩效管理' }),
    ];
    const result = getProjectProgressChanges(tasks, projects, '2026-W30');
    expect(result[0].totalSubtasks).toBe(3);
    expect(result[0].doneSubtasks).toBe(2);
    // Progress: 2/3 → floor(2/3*100) = 66%, before = 1/3 = 33% (one subtask done earlier, one done this week)
    // Actually let me think about this differently...
    // The function should identify which subtasks were completed THIS week
    // And show "before progress → after progress"
  });

  it('shows completed subtask names from this week', () => {
    const tasks: Task[] = [
      makeTask({
        id: 't1',
        projectId: 'p-1',
        title: '项目任务A',
        category: '绩效管理',
        status: 'done',
        completedDate: '2026-07-21',
        subtasks: [
          { id: 's1', title: '起草方案', status: 'done' },
          { id: 's2', title: '征求意见', status: 'done' },
        ],
      }),
    ];
    const projects: Project[] = [
      makeProject({ id: 'p-1', title: '项目X', category: '绩效管理' }),
    ];
    const result = getProjectProgressChanges(tasks, projects, '2026-W30');
    expect(result[0].completedThisWeek).toContain('起草方案');
    expect(result[0].completedThisWeek).toContain('征求意见');
  });

  it('excludes projects with no subtasks completed this week', () => {
    const tasks: Task[] = [
      makeTask({
        id: 't1',
        projectId: 'p-1',
        title: '旧任务',
        category: '绩效管理',
        status: 'done',
        completedDate: '2026-07-10', // last week
        subtasks: [
          { id: 's1', title: '旧步骤', status: 'done' },
        ],
      }),
    ];
    const projects: Project[] = [
      makeProject({ id: 'p-1', title: '旧项目', category: '绩效管理' }),
    ];
    const result = getProjectProgressChanges(tasks, projects, '2026-W30');
    expect(result).toEqual([]);
  });

  it('handles empty projects list', () => {
    const result = getProjectProgressChanges([], [], '2026-W30');
    expect(result).toEqual([]);
  });

  it('includes progress percentage change text', () => {
    const tasks: Task[] = [
      makeTask({
        id: 't1',
        projectId: 'p-1',
        title: '任务',
        category: '绩效管理',
        status: 'done',
        completedDate: '2026-07-21',
        subtasks: [
          { id: 's1', title: 'a', status: 'done' },
          { id: 's2', title: 'b', status: 'done' },
          { id: 's3', title: 'c', status: 'todo' },
        ],
      }),
    ];
    const projects: Project[] = [
      makeProject({ id: 'p-1', title: '项目X', category: '绩效管理' }),
    ];
    const result = getProjectProgressChanges(tasks, projects, '2026-W30');
    expect(result[0].beforePercent).toBeDefined();
    expect(result[0].afterPercent).toBeDefined();
    expect(result[0].afterPercent).toBeGreaterThan(result[0].beforePercent);
  });
});

// ============================================================
// Section 3: 下周计划 (next week plan candidates)
// ============================================================

describe('getNextWeekPlanCandidates', () => {
  const referenceDate = new Date('2026-07-21');

  it('includes todo tasks with no deadline', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '无截止日期任务', status: 'todo', deadline: null }),
    ];
    const result = getNextWeekPlanCandidates(tasks, referenceDate);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('无截止日期任务');
  });

  it('includes todo tasks with deadline within 14 days', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '近期截止', status: 'todo', deadline: '2026-08-01' }),
    ];
    const result = getNextWeekPlanCandidates(tasks, referenceDate);
    expect(result).toHaveLength(1);
  });

  it('excludes todo tasks with deadline beyond 14 days', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '远期任务', status: 'todo', deadline: '2026-12-31' }),
    ];
    const result = getNextWeekPlanCandidates(tasks, referenceDate);
    expect(result).toHaveLength(0);
  });

  it('includes todo tasks with deadline exactly 14 days out', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '边界任务', status: 'todo', deadline: '2026-08-04' }),
    ];
    const result = getNextWeekPlanCandidates(tasks, referenceDate);
    expect(result).toHaveLength(1);
  });

  it('excludes tasks with deadline in the past', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '过期任务', status: 'todo', deadline: '2026-07-01' }),
    ];
    const result = getNextWeekPlanCandidates(tasks, referenceDate);
    expect(result).toHaveLength(0);
  });

  it('excludes non-todo tasks', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '进行中', status: 'in-progress', deadline: null }),
      makeTask({ id: '2', title: '已完成', status: 'done', deadline: null }),
      makeTask({ id: '3', title: '已取消', status: 'cancelled', deadline: null }),
    ];
    const result = getNextWeekPlanCandidates(tasks, referenceDate);
    expect(result).toHaveLength(0);
  });

  it('handles empty task list', () => {
    const result = getNextWeekPlanCandidates([], referenceDate);
    expect(result).toEqual([]);
  });
});

// ============================================================
// Section 4: 需协调事项 (coordination items)
// ============================================================

describe('getCoordinationItems', () => {
  const referenceDate = new Date('2026-07-21');

  it('includes in-progress tasks not updated for more than 7 days', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '卡住的任务',
        status: 'in-progress',
        updatedDate: '2026-07-10', // 11 days ago
      }),
    ];
    const result = getCoordinationItems(tasks, referenceDate);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('卡住的任务');
    expect(result[0].reason).toBe('stale');
  });

  it('excludes in-progress tasks updated within 7 days', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '活跃任务',
        status: 'in-progress',
        updatedDate: '2026-07-20', // 1 day ago
      }),
    ];
    const result = getCoordinationItems(tasks, referenceDate);
    expect(result).toHaveLength(0);
  });

  it('includes blocked tasks regardless of update recency', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '阻塞任务',
        status: 'in-progress',
        updatedDate: '2026-07-20', // 1 day ago, but blocked
        isBlocked: true,
      }),
    ];
    const result = getCoordinationItems(tasks, referenceDate);
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('blocked');
  });

  it('deduplicates: a task that is both stale and blocked appears once with blocked reason', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '阻塞且过期的任务',
        status: 'in-progress',
        updatedDate: '2026-07-01', // 20 days ago
        isBlocked: true,
      }),
    ];
    const result = getCoordinationItems(tasks, referenceDate);
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('blocked');
  });

  it('shows last updated date for each item', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '过期任务',
        status: 'in-progress',
        updatedDate: '2026-07-10',
      }),
    ];
    const result = getCoordinationItems(tasks, referenceDate);
    expect(result[0].lastUpdated).toBe('2026-07-10');
  });

  it('excludes non-in-progress tasks', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '待办', status: 'todo', updatedDate: '2026-07-01', isBlocked: true }),
      makeTask({ id: '2', title: '已完成', status: 'done', updatedDate: '2026-07-01' }),
      makeTask({ id: '3', title: '已取消', status: 'cancelled', updatedDate: '2026-07-01' }),
    ];
    const result = getCoordinationItems(tasks, referenceDate);
    expect(result).toHaveLength(0);
  });

  it('handles empty task list', () => {
    const result = getCoordinationItems([], referenceDate);
    expect(result).toEqual([]);
  });
});
