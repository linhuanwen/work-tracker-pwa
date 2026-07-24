import { describe, it, expect } from 'vitest';
import type { Task } from '../types';
import {
  isDateInYear,
  mapCategoryToDimension,
  getYearlyTasksByDimension,
  buildMonthlyTrendTable,
  buildYearlyQuantityTable,
  generateYearlyOneLiner,
} from '../yearlyUtils';

/**
 * Seams S4-S8: 年度报告纯逻辑
 *
 * Pure functions for yearly report template filling.
 * Tests verify dimension mapping, task grouping by dimension,
 * monthly trend table accuracy, total quantity aggregation,
 * and auto-generated one-liner summaries.
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

// ============================================================
// Year date util
// ============================================================

describe('isDateInYear', () => {
  it('returns true for a date within the year', () => {
    expect(isDateInYear('2026-07-15', 2026)).toBe(true);
  });

  it('returns false for a date in a different year', () => {
    expect(isDateInYear('2025-07-15', 2026)).toBe(false);
  });

  it('returns false for null date', () => {
    expect(isDateInYear(null, 2026)).toBe(false);
  });

  it('returns true for first and last day of year', () => {
    expect(isDateInYear('2026-01-01', 2026)).toBe(true);
    expect(isDateInYear('2026-12-31', 2026)).toBe(true);
  });
});

// ============================================================
// S4: 分类→维度映射 (mapCategoryToDimension)
// ============================================================

describe('mapCategoryToDimension', () => {
  it('maps 人员调配 to 人员配置', () => {
    expect(mapCategoryToDimension('人员调配')).toBe('人员配置');
  });

  it('maps 内部招聘 to 内部招聘（晋升晋等）', () => {
    expect(mapCategoryToDimension('内部招聘')).toBe('内部招聘（晋升晋等）');
  });

  it('maps 奖惩管理 to 奖惩管理', () => {
    expect(mapCategoryToDimension('奖惩管理')).toBe('奖惩管理');
  });

  it('maps 绩效管理 to 绩效管理', () => {
    expect(mapCategoryToDimension('绩效管理')).toBe('绩效管理');
  });

  it('maps 劳动关系 to 劳动关系', () => {
    expect(mapCategoryToDimension('劳动关系')).toBe('劳动关系');
  });

  it('maps 领导交办 to 领导交办', () => {
    expect(mapCategoryToDimension('领导交办')).toBe('领导交办');
  });

  it('maps 其他 to 领导交办 (fallback)', () => {
    expect(mapCategoryToDimension('其他')).toBe('领导交办');
  });

  it('maps unknown category to 领导交办 (fallback)', () => {
    expect(mapCategoryToDimension('未知分类')).toBe('领导交办');
  });

  it('maps empty string to 领导交办 (fallback)', () => {
    expect(mapCategoryToDimension('')).toBe('领导交办');
  });
});

// ============================================================
// S5: 年度维度归纳 (getYearlyTasksByDimension)
// ============================================================

describe('getYearlyTasksByDimension', () => {
  const defaultCategories = ['人员调配', '内部招聘', '奖惩管理', '绩效管理', '劳动关系', '领导交办', '其他'];

  it('groups completed tasks by dimension within the target year', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '招聘任务', category: '内部招聘', status: 'done', completedDate: '2026-03-15',
        quantities: [{ label: '资格审查', value: 30, unit: '人次' }] }),
      makeTask({ id: '2', title: '绩效任务', category: '绩效管理', status: 'done', completedDate: '2026-06-20',
        quantities: [{ label: '考核', value: 120, unit: '人' }] }),
    ];
    const result = getYearlyTasksByDimension(tasks, 2026, defaultCategories);
    const recruitment = result.find((d) => d.dimension === '内部招聘（晋升晋等）');
    const performance = result.find((d) => d.dimension === '绩效管理');
    expect(recruitment).toBeDefined();
    expect(performance).toBeDefined();
    expect(recruitment!.taskCount).toBe(1);
    expect(performance!.taskCount).toBe(1);
  });

  it('merges multiple categories into the same dimension', () => {
    // 其他, 领导交办, and unknown categories all map to 领导交办
    const tasks: Task[] = [
      makeTask({ id: '1', title: '交办任务A', category: '领导交办', status: 'done', completedDate: '2026-04-10',
        quantities: [{ label: '事项', value: 5, unit: '件' }] }),
      makeTask({ id: '2', title: '其它任务', category: '其他', status: 'done', completedDate: '2026-04-15',
        quantities: [{ label: '事项', value: 3, unit: '件' }] }),
    ];
    const result = getYearlyTasksByDimension(tasks, 2026, defaultCategories);
    const leader = result.find((d) => d.dimension === '领导交办');
    expect(leader).toBeDefined();
    expect(leader!.taskCount).toBe(2);
    // Quantities should be merged
    expect(leader!.quantities).toHaveLength(1);
    expect(leader!.quantities[0].value).toBe(8);
  });

  it('aggregates quantities within each dimension', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '审查A', category: '内部招聘', status: 'done', completedDate: '2026-03-01',
        quantities: [{ label: '资格审查', value: 20, unit: '人次' }] }),
      makeTask({ id: '2', title: '审查B', category: '内部招聘', status: 'done', completedDate: '2026-05-01',
        quantities: [{ label: '资格审查', value: 15, unit: '人次' }, { label: '助力晋升', value: 2, unit: '人' }] }),
    ];
    const result = getYearlyTasksByDimension(tasks, 2026, defaultCategories);
    const dim = result.find((d) => d.dimension === '内部招聘（晋升晋等）');
    expect(dim!.quantities).toHaveLength(2);
    const shencha = dim!.quantities.find((q) => q.label === '资格审查');
    const jinsheng = dim!.quantities.find((q) => q.label === '助力晋升');
    expect(shencha!.value).toBe(35);
    expect(jinsheng!.value).toBe(2);
  });

  it('excludes tasks from different years', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '2026任务', category: '内部招聘', status: 'done', completedDate: '2026-03-15',
        quantities: [{ label: '审查', value: 10, unit: '人次' }] }),
      makeTask({ id: '2', title: '2025任务', category: '内部招聘', status: 'done', completedDate: '2025-03-15',
        quantities: [{ label: '审查', value: 10, unit: '人次' }] }),
    ];
    const result = getYearlyTasksByDimension(tasks, 2026, defaultCategories);
    // All 6 dimensions returned, but only 内部招聘 has data
    const dim = result.find((d) => d.dimension === '内部招聘（晋升晋等）')!;
    expect(dim.taskCount).toBe(1);
    expect(dim.quantities[0].value).toBe(10);
    // Verify other dimensions are empty
    const otherDims = result.filter((d) => d.dimension !== '内部招聘（晋升晋等）');
    expect(otherDims.every((d) => d.taskCount === 0)).toBe(true);
  });

  it('excludes non-done tasks', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '已完成', category: '内部招聘', status: 'done', completedDate: '2026-03-15',
        quantities: [{ label: '审查', value: 5, unit: '人次' }] }),
      makeTask({ id: '2', title: '待办', category: '内部招聘', status: 'todo',
        quantities: [{ label: '审查', value: 5, unit: '人次' }] }),
      makeTask({ id: '3', title: '进行中', category: '内部招聘', status: 'in-progress',
        quantities: [{ label: '审查', value: 5, unit: '人次' }] }),
      makeTask({ id: '4', title: '已取消', category: '内部招聘', status: 'cancelled', completedDate: '2026-03-15',
        quantities: [{ label: '审查', value: 5, unit: '人次' }] }),
    ];
    const result = getYearlyTasksByDimension(tasks, 2026, defaultCategories);
    // Only 1 done task counted
    const dim = result.find((d) => d.dimension === '内部招聘（晋升晋等）')!;
    expect(dim.taskCount).toBe(1);
    expect(dim.quantities[0].value).toBe(5);
  });

  it('sorts dimensions in the canonical six-dimension order', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '劳动关系', category: '劳动关系', status: 'done', completedDate: '2026-06-01',
        quantities: [{ label: '处理', value: 1, unit: '件' }] }),
      makeTask({ id: '2', title: '人员调配', category: '人员调配', status: 'done', completedDate: '2026-01-01',
        quantities: [{ label: '调配', value: 1, unit: '人' }] }),
      makeTask({ id: '3', title: '绩效', category: '绩效管理', status: 'done', completedDate: '2026-03-01',
        quantities: [{ label: '考核', value: 1, unit: '次' }] }),
    ];
    const result = getYearlyTasksByDimension(tasks, 2026, defaultCategories);
    expect(result[0].dimension).toBe('人员配置');
    expect(result[1].dimension).toBe('内部招聘（晋升晋等）');
    // 绩效 should appear after recruitment, labor relations after performance
    const dims = result.map((d) => d.dimension);
    expect(dims.indexOf('绩效管理')).toBeLessThan(dims.indexOf('劳动关系'));
  });

  it('includes task titles in each dimension', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '招聘公告发布', category: '内部招聘', status: 'done', completedDate: '2026-03-15' }),
      makeTask({ id: '2', title: '面试组织', category: '内部招聘', status: 'done', completedDate: '2026-04-20' }),
    ];
    const result = getYearlyTasksByDimension(tasks, 2026, defaultCategories);
    // 内部招聘 maps to dimension at index 1 (内部招聘（晋升晋等）)
    const dim = result.find((d) => d.dimension === '内部招聘（晋升晋等）')!;
    expect(dim.taskTitles).toContain('招聘公告发布');
    expect(dim.taskTitles).toContain('面试组织');
  });

  it('keeps taskNotes aligned with taskTitles (trimmed, empty when unset)', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '招聘公告发布', category: '内部招聘', status: 'done', completedDate: '2026-03-15', notes: '  发布 3 个岗位公告  ' }),
      makeTask({ id: '2', title: '面试组织', category: '内部招聘', status: 'done', completedDate: '2026-04-20' }),
    ];
    const result = getYearlyTasksByDimension(tasks, 2026, defaultCategories);
    const dim = result.find((d) => d.dimension === '内部招聘（晋升晋等）')!;
    expect(dim.taskNotes).toHaveLength(dim.taskTitles.length);
    expect(dim.taskNotes[dim.taskTitles.indexOf('招聘公告发布')]).toBe('发布 3 个岗位公告');
    expect(dim.taskNotes[dim.taskTitles.indexOf('面试组织')]).toBe('');
  });

  it('returns all six dimensions even if some are empty (with taskCount 0)', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '唯一任务', category: '绩效管理', status: 'done', completedDate: '2026-06-01' }),
    ];
    const result = getYearlyTasksByDimension(tasks, 2026, defaultCategories);
    // All 6 dimensions should appear
    expect(result).toHaveLength(6);
    const dims = result.map((d) => d.dimension);
    expect(dims).toEqual([
      '人员配置',
      '内部招聘（晋升晋等）',
      '奖惩管理',
      '绩效管理',
      '劳动关系',
      '领导交办',
    ]);
    // Empty dimensions have taskCount 0
    const personnel = result.find((d) => d.dimension === '人员配置');
    expect(personnel!.taskCount).toBe(0);
    expect(personnel!.taskTitles).toEqual([]);
  });

  it('handles empty task list', () => {
    const result = getYearlyTasksByDimension([], 2026, defaultCategories);
    expect(result).toHaveLength(6);
    expect(result.every((d) => d.taskCount === 0)).toBe(true);
  });
});

// ============================================================
// S6: 月度趋势表 (buildMonthlyTrendTable)
// ============================================================

describe('buildMonthlyTrendTable', () => {
  const defaultCategories = ['人员调配', '内部招聘', '奖惩管理', '绩效管理', '劳动关系', '领导交办', '其他'];

  it('returns 12 rows (one per month)', () => {
    const result = buildMonthlyTrendTable([], 2026, defaultCategories);
    expect(result).toHaveLength(12);
  });

  it('each row has month label and category counts', () => {
    const result = buildMonthlyTrendTable([], 2026, defaultCategories);
    expect(result[0]).toHaveProperty('month');
    expect(result[0]).toHaveProperty('categoryCounts');
    expect(result[0]).toHaveProperty('total');
    expect(result[0].month).toBe('1月');
  });

  it('counts completed tasks per category per month', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', title: '1月任务', category: '内部招聘', status: 'done', completedDate: '2026-01-15' }),
      makeTask({ id: '2', title: '2月任务', category: '内部招聘', status: 'done', completedDate: '2026-02-10' }),
      makeTask({ id: '3', title: '2月绩效', category: '绩效管理', status: 'done', completedDate: '2026-02-20' }),
    ];
    const result = buildMonthlyTrendTable(tasks, 2026, defaultCategories);
    // January
    expect(result[0].categoryCounts['内部招聘']).toBe(1);
    expect(result[0].categoryCounts['绩效管理']).toBe(0);
    expect(result[0].total).toBe(1);
    // February
    expect(result[1].categoryCounts['内部招聘']).toBe(1);
    expect(result[1].categoryCounts['绩效管理']).toBe(1);
    expect(result[1].total).toBe(2);
    // March
    expect(result[2].total).toBe(0);
  });

  it('excludes non-done and cancelled tasks', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', category: '内部招聘', status: 'todo', completedDate: '2026-01-15' }),
      makeTask({ id: '2', category: '内部招聘', status: 'in-progress' }),
      makeTask({ id: '3', category: '内部招聘', status: 'cancelled', completedDate: '2026-01-15' }),
      makeTask({ id: '4', category: '内部招聘', status: 'done', completedDate: '2026-01-20' }),
    ];
    const result = buildMonthlyTrendTable(tasks, 2026, defaultCategories);
    expect(result[0].categoryCounts['内部招聘']).toBe(1);
  });

  it('filters by year only', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', category: '内部招聘', status: 'done', completedDate: '2026-01-15' }),
      makeTask({ id: '2', category: '内部招聘', status: 'done', completedDate: '2025-01-15' }),
    ];
    const result = buildMonthlyTrendTable(tasks, 2026, defaultCategories);
    expect(result[0].categoryCounts['内部招聘']).toBe(1);
  });

  it('total column equals sum of all category counts', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', category: '内部招聘', status: 'done', completedDate: '2026-06-01' }),
      makeTask({ id: '2', category: '绩效管理', status: 'done', completedDate: '2026-06-15' }),
      makeTask({ id: '3', category: '劳动关系', status: 'done', completedDate: '2026-06-20' }),
    ];
    const result = buildMonthlyTrendTable(tasks, 2026, defaultCategories);
    const june = result[5]; // index 5 = June
    expect(june.total).toBe(3);
    // Verify sum of individual counts equals total
    const sum = Object.values(june.categoryCounts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(june.total);
  });

  it('month labels are 1月 through 12月', () => {
    const result = buildMonthlyTrendTable([], 2026, defaultCategories);
    const labels = result.map((r) => r.month);
    expect(labels).toEqual([
      '1月', '2月', '3月', '4月', '5月', '6月',
      '7月', '8月', '9月', '10月', '11月', '12月',
    ]);
  });

  it('all category keys are present in each row even if zero', () => {
    const result = buildMonthlyTrendTable([], 2026, defaultCategories);
    for (const row of result) {
      for (const cat of defaultCategories) {
        expect(row.categoryCounts).toHaveProperty(cat);
        expect(row.categoryCounts[cat]).toBe(0);
      }
    }
  });
});

// ============================================================
// S7: 全年量化产出总表 (buildYearlyQuantityTable)
// ============================================================

describe('buildYearlyQuantityTable', () => {
  it('aggregates all quantities by label across all tasks in the year', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', category: '内部招聘', status: 'done', completedDate: '2026-03-15',
        quantities: [{ label: '资格审查', value: 100, unit: '人次' }] }),
      makeTask({ id: '2', category: '内部招聘', status: 'done', completedDate: '2026-06-15',
        quantities: [{ label: '资格审查', value: 38, unit: '人次' }] }),
    ];
    const result = buildYearlyQuantityTable(tasks, 2026);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ label: '资格审查', value: 138, unit: '人次' });
  });

  it('keeps different labels separate', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', category: '内部招聘', status: 'done', completedDate: '2026-03-15',
        quantities: [
          { label: '资格审查', value: 100, unit: '人次' },
          { label: '助力晋升', value: 12, unit: '人' },
        ] }),
    ];
    const result = buildYearlyQuantityTable(tasks, 2026);
    expect(result).toHaveLength(2);
  });

  it('merges same label across different categories', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', category: '内部招聘', status: 'done', completedDate: '2026-01-15',
        quantities: [{ label: '审查', value: 10, unit: '人次' }] }),
      makeTask({ id: '2', category: '绩效管理', status: 'done', completedDate: '2026-03-15',
        quantities: [{ label: '审查', value: 5, unit: '人次' }] }),
    ];
    const result = buildYearlyQuantityTable(tasks, 2026);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(15);
  });

  it('excludes non-done tasks', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', category: '内部招聘', status: 'todo',
        quantities: [{ label: '审查', value: 100, unit: '人次' }] }),
      makeTask({ id: '2', category: '内部招聘', status: 'done', completedDate: '2026-03-15',
        quantities: [{ label: '审查', value: 5, unit: '人次' }] }),
    ];
    const result = buildYearlyQuantityTable(tasks, 2026);
    expect(result[0].value).toBe(5);
  });

  it('filters by year', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', category: '内部招聘', status: 'done', completedDate: '2026-03-15',
        quantities: [{ label: '审查', value: 10, unit: '人次' }] }),
      makeTask({ id: '2', category: '内部招聘', status: 'done', completedDate: '2025-03-15',
        quantities: [{ label: '审查', value: 50, unit: '人次' }] }),
    ];
    const result = buildYearlyQuantityTable(tasks, 2026);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(10);
  });

  it('returns empty array for year with no done tasks', () => {
    const result = buildYearlyQuantityTable([], 2026);
    expect(result).toEqual([]);
  });

  it('handles tasks with empty quantities', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', category: '内部招聘', status: 'done', completedDate: '2026-03-15', quantities: [] }),
      makeTask({ id: '2', category: '绩效管理', status: 'done', completedDate: '2026-06-15',
        quantities: [{ label: '考核', value: 5, unit: '次' }] }),
    ];
    const result = buildYearlyQuantityTable(tasks, 2026);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('考核');
  });
});

// ============================================================
// S8: 一句话总结 (generateYearlyOneLiner)
// ============================================================

describe('generateYearlyOneLiner', () => {
  const defaultCategories = ['人员调配', '内部招聘', '奖惩管理', '绩效管理', '劳动关系', '领导交办', '其他'];

  it('generates summary with category count and total task count', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', category: '内部招聘', status: 'done', completedDate: '2026-03-15' }),
      makeTask({ id: '2', category: '绩效管理', status: 'done', completedDate: '2026-06-20' }),
      makeTask({ id: '3', category: '劳动关系', status: 'done', completedDate: '2026-09-10' }),
      makeTask({ id: '4', category: '内部招聘', status: 'done', completedDate: '2026-11-15' }),
    ];
    const result = generateYearlyOneLiner(tasks, 2026, defaultCategories);
    expect(result).toContain('3');
    expect(result).toContain('4');
  });

  it('mentions quantity labels in the summary', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', category: '内部招聘', status: 'done', completedDate: '2026-03-15',
        quantities: [{ label: '资格审查', value: 138, unit: '人次' }, { label: '助力晋升', value: 12, unit: '人' }] }),
    ];
    const result = generateYearlyOneLiner(tasks, 2026, defaultCategories);
    expect(result).toContain('资格审查');
    expect(result).toContain('助力晋升');
  });

  it('returns placeholder text for empty year', () => {
    const result = generateYearlyOneLiner([], 2026, defaultCategories);
    expect(result).toContain('暂无');
  });

  it('includes year in the summary', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', category: '内部招聘', status: 'done', completedDate: '2026-03-15' }),
    ];
    const result = generateYearlyOneLiner(tasks, 2026, defaultCategories);
    expect(result).toContain('2026');
  });
});
