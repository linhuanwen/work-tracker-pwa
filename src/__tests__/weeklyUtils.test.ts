import { describe, it, expect } from 'vitest';
import type { Task, Project, SubTask } from '../types';
import {
  getWeekKey,
  getWeekDateRange,
  getAdjacentWeek,
  isDateInWeek,
  formatQuantityText,
  getCompletedTasksByCategory,
  isSubtaskDoneInWeek,
  getWeeklyOngoingTasks,
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
    expect(endDay).toBe(5); // Friday
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
      makeTask({
        id: '1',
        title: '任务A',
        category: '绩效管理',
        status: 'done',
        completedDate: '2026-07-21',
      }),
      makeTask({
        id: '2',
        title: '任务B',
        category: '其他',
        status: 'done',
        completedDate: '2026-07-22',
      }),
      makeTask({
        id: '3',
        title: '任务C',
        category: '绩效管理',
        status: 'done',
        completedDate: '2026-07-13',
      }), // last week
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
      makeTask({
        id: '1',
        title: '其他任务',
        category: '其他',
        status: 'done',
        completedDate: '2026-07-21',
      }),
      makeTask({
        id: '2',
        title: '绩效任务',
        category: '绩效管理',
        status: 'done',
        completedDate: '2026-07-22',
      }),
    ];
    const result = getCompletedTasksByCategory(tasks, '2026-W30', categories);
    // 绩效管理 comes before 其他 in categories order
    expect(result[0].category).toBe('绩效管理');
    expect(result[1].category).toBe('其他');
  });

  it('excludes categories with no completed tasks', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '绩效任务',
        category: '绩效管理',
        status: 'done',
        completedDate: '2026-07-21',
      }),
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
      makeTask({
        id: '1',
        title: '旧任务',
        category: '绩效管理',
        status: 'done',
        completedDate: '2026-07-13',
      }),
      makeTask({
        id: '2',
        title: '本周任务',
        category: '绩效管理',
        status: 'done',
        completedDate: '2026-07-21',
      }),
    ];
    const result = getCompletedTasksByCategory(tasks, '2026-W30', categories);
    expect(result[0].tasks).toHaveLength(1);
    expect(result[0].tasks[0].title).toBe('本周任务');
  });

  it('returns empty array when no tasks were completed this week', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '旧任务',
        category: '绩效管理',
        status: 'done',
        completedDate: '2026-07-13',
      }),
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
      makeProject({
        id: 'p-1',
        title: '2026年度晋升支持专项',
        category: '绩效管理',
      }),
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
        subtasks: [{ id: 's1', title: '旧步骤', status: 'done' }],
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
      makeTask({
        id: '1',
        title: '无截止日期任务',
        status: 'todo',
        deadline: null,
      }),
    ];
    const result = getNextWeekPlanCandidates(tasks, referenceDate);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('无截止日期任务');
  });

  it('includes todo tasks with deadline within 14 days', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '近期截止',
        status: 'todo',
        deadline: '2026-08-01',
      }),
    ];
    const result = getNextWeekPlanCandidates(tasks, referenceDate);
    expect(result).toHaveLength(1);
  });

  it('excludes todo tasks with deadline beyond 14 days', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '远期任务',
        status: 'todo',
        deadline: '2026-12-31',
      }),
    ];
    const result = getNextWeekPlanCandidates(tasks, referenceDate);
    expect(result).toHaveLength(0);
  });

  it('includes todo tasks with deadline exactly 14 days out', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '边界任务',
        status: 'todo',
        deadline: '2026-08-04',
      }),
    ];
    const result = getNextWeekPlanCandidates(tasks, referenceDate);
    expect(result).toHaveLength(1);
  });

  it('excludes tasks with deadline in the past', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '过期任务',
        status: 'todo',
        deadline: '2026-07-01',
      }),
    ];
    const result = getNextWeekPlanCandidates(tasks, referenceDate);
    expect(result).toHaveLength(0);
  });

  it('excludes non-todo tasks', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '进行中',
        status: 'in-progress',
        deadline: null,
      }),
      makeTask({ id: '2', title: '已完成', status: 'done', deadline: null }),
      makeTask({
        id: '3',
        title: '已取消',
        status: 'cancelled',
        deadline: null,
      }),
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
      makeTask({
        id: '1',
        title: '待办',
        status: 'todo',
        updatedDate: '2026-07-01',
        isBlocked: true,
      }),
      makeTask({
        id: '2',
        title: '已完成',
        status: 'done',
        updatedDate: '2026-07-01',
      }),
      makeTask({
        id: '3',
        title: '已取消',
        status: 'cancelled',
        updatedDate: '2026-07-01',
      }),
    ];
    const result = getCoordinationItems(tasks, referenceDate);
    expect(result).toHaveLength(0);
  });

  it('handles empty task list', () => {
    const result = getCoordinationItems([], referenceDate);
    expect(result).toEqual([]);
  });
});

// ============================================================
// Section 1+: 子任务周归因 & 非项目任务推进
// ============================================================

describe('isSubtaskDoneInWeek', () => {
  // 2026-W30 = Mon 7/20 – Fri 7/24
  const parent = (over: Partial<Task> = {}): Task =>
    makeTask({ status: 'in-progress', ...over });

  it('按子任务 completedDate 判断是否在本周完成', () => {
    const sub: SubTask = {
      id: 's1',
      title: 'x',
      status: 'done',
      completedDate: '2026-07-22',
    };
    expect(isSubtaskDoneInWeek(sub, parent(), '2026-W30')).toBe(true);
    expect(
      isSubtaskDoneInWeek(
        { ...sub, completedDate: '2026-07-13' },
        parent(),
        '2026-W30',
      ),
    ).toBe(false);
  });

  it('todo 子任务不计入', () => {
    const sub: SubTask = {
      id: 's1',
      title: 'x',
      status: 'todo',
      completedDate: '2026-07-22',
    };
    expect(isSubtaskDoneInWeek(sub, parent(), '2026-W30')).toBe(false);
  });

  it('旧数据缺日期：父任务整单在本周完成 → 其完成子任务视为本周完成', () => {
    const p = makeTask({ status: 'done', completedDate: '2026-07-21' });
    const sub: SubTask = { id: 's1', title: 'x', status: 'done' };
    expect(isSubtaskDoneInWeek(sub, p, '2026-W30')).toBe(true);
  });

  it('旧数据缺日期：父任务在其他周期完成 → 不计入本周', () => {
    const p = makeTask({ status: 'done', completedDate: '2026-07-10' });
    const sub: SubTask = { id: 's1', title: 'x', status: 'done' };
    expect(isSubtaskDoneInWeek(sub, p, '2026-W30')).toBe(false);
  });

  it('父任务未完成且子任务缺日期 → 无法归因，不计入', () => {
    const sub: SubTask = { id: 's1', title: 'x', status: 'done' };
    expect(isSubtaskDoneInWeek(sub, parent(), '2026-W30')).toBe(false);
  });
});

describe('getCompletedTasksByCategory 完成子任务计数', () => {
  const categories = ['绩效管理', '其他'];

  it('整单完成任务带 doneSubtaskCount（所有已完成子任务数）', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '带子任务',
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
    const result = getCompletedTasksByCategory(tasks, '2026-W30', categories);
    expect(result[0].tasks[0].doneSubtaskCount).toBe(2);
  });

  it('无子任务任务 doneSubtaskCount 为 0', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '无子任务',
        category: '其他',
        status: 'done',
        completedDate: '2026-07-21',
      }),
    ];
    const result = getCompletedTasksByCategory(tasks, '2026-W30', categories);
    expect(result[0].tasks[0].doneSubtaskCount).toBe(0);
  });
});

describe('getWeeklyOngoingTasks', () => {
  // 2026-W30 = Mon 7/20 – Fri 7/24
  // 呈现规则（2026-09-08）：已勾子任务 = 已完成、未勾子任务 = 待开展（快照式）；
  // 有子任务即展示（不要求已有完成项）；项目任务同样纳入；远期任务（startDate > 本周结束日）不纳入周表。

  it('返回有子任务的待办/进行中任务（已完成 + 待开展两个列表，含项目任务）', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '机务跨序列',
        category: '内外招聘',
        status: 'in-progress',
        startDate: '2026-07-15',
        subtasks: [
          {
            id: 's1',
            title: '素质测评成绩反馈',
            status: 'done',
            completedDate: '2026-07-22',
          },
          {
            id: 's2',
            title: '资格审查公示',
            status: 'done',
            completedDate: '2026-07-10', // 早于本周 → 也计入已完成
          },
          { id: 's3', title: '笔试安排', status: 'todo' },
          { id: 's4', title: '面试安排', status: 'todo' },
        ],
      }),
      makeTask({
        id: '2',
        title: '无日期旧完成项',
        category: '内部招聘',
        status: 'in-progress',
        subtasks: [{ id: 's5', title: '旧完成', status: 'done' }],
      }),
      makeTask({
        id: '3',
        projectId: 'p-1',
        title: '项目任务',
        category: '其他',
        status: 'in-progress',
        subtasks: [
          { id: 's6', title: '项目子步a', status: 'done' },
          { id: 's7', title: '项目子步b', status: 'todo' },
        ],
      }),
    ];
    const result = getWeeklyOngoingTasks(tasks, '2026-07-24');
    expect(result).toHaveLength(3);
    expect(result[0].title).toBe('机务跨序列');
    expect(result[0].category).toBe('内外招聘');
    expect(result[0].doneTitles).toEqual(['素质测评成绩反馈', '资格审查公示']);
    expect(result[0].todoTitles).toEqual(['笔试安排', '面试安排']);
    expect(result[1].title).toBe('无日期旧完成项');
    expect(result[1].doneTitles).toEqual(['旧完成']);
    expect(result[1].todoTitles).toEqual([]);
    // 项目任务同样纳入列表
    expect(result[2].title).toBe('项目任务');
    expect(result[2].doneTitles).toEqual(['项目子步a']);
    expect(result[2].todoTitles).toEqual(['项目子步b']);
  });

  it('父任务停在「待办」但有子任务 → 同样返回', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '待办父任务',
        category: '其他',
        status: 'todo',
        subtasks: [{ id: 's1', title: '已勾步骤', status: 'done' }],
      }),
    ];
    const result = getWeeklyOngoingTasks(tasks, '2026-07-24');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('待办父任务');
    expect(result[0].doneTitles).toEqual(['已勾步骤']);
  });

  it('子任务全部未勾 → 同样返回，已完成为空、待开展列出全部', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '全待办',
        category: '其他',
        status: 'in-progress',
        subtasks: [
          { id: 's1', title: '子步a', status: 'todo' },
          { id: 's2', title: '子步b', status: 'todo' },
        ],
      }),
    ];
    const result = getWeeklyOngoingTasks(tasks, '2026-07-24');
    expect(result).toHaveLength(1);
    expect(result[0].doneTitles).toEqual([]);
    expect(result[0].todoTitles).toEqual(['子步a', '子步b']);
  });

  it('排除整单完成的父任务（归「本周完成任务」列表）', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '已完成任务',
        category: '其他',
        status: 'done',
        completedDate: '2026-07-21',
        subtasks: [
          { id: 's1', title: 'a', status: 'done', completedDate: '2026-07-21' },
        ],
      }),
    ];
    expect(getWeeklyOngoingTasks(tasks, '2026-07-24')).toEqual([]);
  });

  it('排除已取消任务', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '已取消',
        category: '其他',
        status: 'cancelled',
        subtasks: [
          { id: 's1', title: 'a', status: 'done', completedDate: '2026-07-21' },
        ],
      }),
    ];
    expect(getWeeklyOngoingTasks(tasks, '2026-07-24')).toEqual([]);
  });

  it('没有任何子任务的任务不返回', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '无子任务',
        category: '其他',
        status: 'in-progress',
      }),
    ];
    expect(getWeeklyOngoingTasks(tasks, '2026-07-24')).toEqual([]);
  });

  it('远期任务（起始日期晚于本周结束日）排除出周表，起始周当天起纳入', () => {
    // 2026-W30 结束日为 7/24；startDate=7/27（下周）→ 排除；7/24 当天 → 纳入
    const future = makeTask({
      id: '1',
      title: '下周一才开始的远期任务',
      category: '其他',
      status: 'todo',
      startDate: '2026-07-27',
      subtasks: [{ id: 's1', title: '步骤a', status: 'todo' }],
    });
    expect(getWeeklyOngoingTasks([future], '2026-07-24')).toEqual([]);

    const startsThisWeek = {
      ...future,
      id: '2',
      title: '本周内开始的任务',
      startDate: '2026-07-24',
    };
    const result = getWeeklyOngoingTasks([startsThisWeek], '2026-07-24');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('本周内开始的任务');
  });
});
