import { describe, it, expect } from 'vitest';
import type { Task } from '../types';
import { DEFAULT_CATEGORIES } from '../types';
import {
  isDateInYear,
  mapCategoryToDimension,
  getYearlyTasksByDimension,
  isSubtaskDoneInYear,
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
  it('默认分类一一映射到同名维度', () => {
    for (const category of DEFAULT_CATEGORIES) {
      if (category === '其他') continue;
      expect(mapCategoryToDimension(category)).toBe(category);
    }
  });

  it('maps 其他 to 其他事务 (fallback)', () => {
    expect(mapCategoryToDimension('其他')).toBe('其他事务');
  });

  it('maps unknown category to 其他事务 (fallback)', () => {
    expect(mapCategoryToDimension('未知分类')).toBe('其他事务');
  });

  it('maps empty string to 其他事务 (fallback)', () => {
    expect(mapCategoryToDimension('')).toBe('其他事务');
  });

  // 老数据兼容：早期版本内置的人力资源类分类名，仍映射到最接近的通用维度
  it('keeps legacy built-in categories mapping', () => {
    expect(mapCategoryToDimension('人员调配')).toBe('日常工作');
    expect(mapCategoryToDimension('内部招聘')).toBe('项目推进');
    expect(mapCategoryToDimension('奖惩管理')).toBe('其他事务');
    expect(mapCategoryToDimension('绩效管理')).toBe('其他事务');
    expect(mapCategoryToDimension('劳动关系')).toBe('协作沟通');
    expect(mapCategoryToDimension('领导交办')).toBe('临时交办');
  });
});

// ============================================================
// S5: 年度维度归纳 (getYearlyTasksByDimension)
// ============================================================

describe('getYearlyTasksByDimension', () => {
  const defaultCategories = DEFAULT_CATEGORIES;

  it('groups completed tasks by dimension within the target year', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '招聘任务',
        category: '项目推进',
        status: 'done',
        completedDate: '2026-03-15',
        quantities: [{ label: '资格审查', value: 30, unit: '人次' }],
      }),
      makeTask({
        id: '2',
        title: '绩效任务',
        category: '会议培训',
        status: 'done',
        completedDate: '2026-06-20',
        quantities: [{ label: '考核', value: 120, unit: '人' }],
      }),
    ];
    const result = getYearlyTasksByDimension(tasks, 2026, defaultCategories);
    const recruitment = result.find((d) => d.dimension === '项目推进');
    const performance = result.find((d) => d.dimension === '会议培训');
    expect(recruitment).toBeDefined();
    expect(performance).toBeDefined();
    expect(recruitment!.taskCount).toBe(1);
    expect(performance!.taskCount).toBe(1);
  });

  it('merges multiple categories into the same dimension', () => {
    // 「其他」与未知分类都落入「其他事务」
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '遗留事项A',
        category: '其他',
        status: 'done',
        completedDate: '2026-04-10',
        quantities: [{ label: '事项', value: 5, unit: '件' }],
      }),
      makeTask({
        id: '2',
        title: '未分类事项B',
        category: '未分类项',
        status: 'done',
        completedDate: '2026-04-15',
        quantities: [{ label: '事项', value: 3, unit: '件' }],
      }),
    ];
    const result = getYearlyTasksByDimension(tasks, 2026, defaultCategories);
    const other = result.find((d) => d.dimension === '其他事务');
    expect(other).toBeDefined();
    expect(other!.taskCount).toBe(2);
    // Quantities should be merged
    expect(other!.quantities).toHaveLength(1);
    expect(other!.quantities[0].value).toBe(8);
  });

  it('aggregates quantities within each dimension', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '审查A',
        category: '项目推进',
        status: 'done',
        completedDate: '2026-03-01',
        quantities: [{ label: '资格审查', value: 20, unit: '人次' }],
      }),
      makeTask({
        id: '2',
        title: '审查B',
        category: '项目推进',
        status: 'done',
        completedDate: '2026-05-01',
        quantities: [
          { label: '资格审查', value: 15, unit: '人次' },
          { label: '助力晋升', value: 2, unit: '人' },
        ],
      }),
    ];
    const result = getYearlyTasksByDimension(tasks, 2026, defaultCategories);
    const dim = result.find((d) => d.dimension === '项目推进');
    expect(dim!.quantities).toHaveLength(2);
    const shencha = dim!.quantities.find((q) => q.label === '资格审查');
    const jinsheng = dim!.quantities.find((q) => q.label === '助力晋升');
    expect(shencha!.value).toBe(35);
    expect(jinsheng!.value).toBe(2);
  });

  it('excludes tasks from different years', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '2026任务',
        category: '项目推进',
        status: 'done',
        completedDate: '2026-03-15',
        quantities: [{ label: '审查', value: 10, unit: '人次' }],
      }),
      makeTask({
        id: '2',
        title: '2025任务',
        category: '项目推进',
        status: 'done',
        completedDate: '2025-03-15',
        quantities: [{ label: '审查', value: 10, unit: '人次' }],
      }),
    ];
    const result = getYearlyTasksByDimension(tasks, 2026, defaultCategories);
    // All 6 dimensions returned, but only 项目推进 has data
    const dim = result.find((d) => d.dimension === '项目推进')!;
    expect(dim.taskCount).toBe(1);
    expect(dim.quantities[0].value).toBe(10);
    // Verify other dimensions are empty
    const otherDims = result.filter((d) => d.dimension !== '项目推进');
    expect(otherDims.every((d) => d.taskCount === 0)).toBe(true);
  });

  it('excludes non-done tasks', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '已完成',
        category: '项目推进',
        status: 'done',
        completedDate: '2026-03-15',
        quantities: [{ label: '审查', value: 5, unit: '人次' }],
      }),
      makeTask({
        id: '2',
        title: '待办',
        category: '项目推进',
        status: 'todo',
        quantities: [{ label: '审查', value: 5, unit: '人次' }],
      }),
      makeTask({
        id: '3',
        title: '进行中',
        category: '项目推进',
        status: 'in-progress',
        quantities: [{ label: '审查', value: 5, unit: '人次' }],
      }),
      makeTask({
        id: '4',
        title: '已取消',
        category: '项目推进',
        status: 'cancelled',
        completedDate: '2026-03-15',
        quantities: [{ label: '审查', value: 5, unit: '人次' }],
      }),
    ];
    const result = getYearlyTasksByDimension(tasks, 2026, defaultCategories);
    // Only 1 done task counted
    const dim = result.find((d) => d.dimension === '项目推进')!;
    expect(dim.taskCount).toBe(1);
    expect(dim.quantities[0].value).toBe(5);
  });

  it('sorts dimensions in the canonical six-dimension order', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '临时交办',
        category: '临时交办',
        status: 'done',
        completedDate: '2026-06-01',
        quantities: [{ label: '处理', value: 1, unit: '件' }],
      }),
      makeTask({
        id: '2',
        title: '日常工作',
        category: '日常工作',
        status: 'done',
        completedDate: '2026-01-01',
        quantities: [{ label: '调配', value: 1, unit: '人' }],
      }),
      makeTask({
        id: '3',
        title: '绩效',
        category: '会议培训',
        status: 'done',
        completedDate: '2026-03-01',
        quantities: [{ label: '考核', value: 1, unit: '次' }],
      }),
    ];
    const result = getYearlyTasksByDimension(tasks, 2026, defaultCategories);
    expect(result[0].dimension).toBe('日常工作');
    expect(result[1].dimension).toBe('项目推进');
    // 绩效 should appear after recruitment, labor relations after performance
    const dims = result.map((d) => d.dimension);
    expect(dims.indexOf('会议培训')).toBeLessThan(dims.indexOf('临时交办'));
  });

  it('includes task titles in each dimension', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '招聘公告发布',
        category: '项目推进',
        status: 'done',
        completedDate: '2026-03-15',
      }),
      makeTask({
        id: '2',
        title: '面试组织',
        category: '项目推进',
        status: 'done',
        completedDate: '2026-04-20',
      }),
    ];
    const result = getYearlyTasksByDimension(tasks, 2026, defaultCategories);
    // 项目推进 maps to dimension at index 1 (项目推进)
    const dim = result.find((d) => d.dimension === '项目推进')!;
    expect(dim.taskTitles).toContain('招聘公告发布');
    expect(dim.taskTitles).toContain('面试组织');
  });

  it('keeps taskNotes aligned with taskTitles (trimmed, empty when unset)', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '招聘公告发布',
        category: '项目推进',
        status: 'done',
        completedDate: '2026-03-15',
        notes: '  发布 3 个岗位公告  ',
      }),
      makeTask({
        id: '2',
        title: '面试组织',
        category: '项目推进',
        status: 'done',
        completedDate: '2026-04-20',
      }),
    ];
    const result = getYearlyTasksByDimension(tasks, 2026, defaultCategories);
    const dim = result.find((d) => d.dimension === '项目推进')!;
    expect(dim.taskNotes).toHaveLength(dim.taskTitles.length);
    expect(dim.taskNotes[dim.taskTitles.indexOf('招聘公告发布')]).toBe(
      '发布 3 个岗位公告',
    );
    expect(dim.taskNotes[dim.taskTitles.indexOf('面试组织')]).toBe('');
  });

  it('returns all six dimensions even if some are empty (with taskCount 0)', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '唯一任务',
        category: '会议培训',
        status: 'done',
        completedDate: '2026-06-01',
      }),
    ];
    const result = getYearlyTasksByDimension(tasks, 2026, defaultCategories);
    // All 6 dimensions should appear
    expect(result).toHaveLength(6);
    const dims = result.map((d) => d.dimension);
    expect(dims).toEqual([
      '日常工作',
      '项目推进',
      '协作沟通',
      '会议培训',
      '临时交办',
      '其他事务',
    ]);
    // Empty dimensions have taskCount 0
    const personnel = result.find((d) => d.dimension === '日常工作');
    expect(personnel!.taskCount).toBe(0);
    expect(personnel!.taskTitles).toEqual([]);
  });

  it('handles empty task list', () => {
    const result = getYearlyTasksByDimension([], 2026, defaultCategories);
    expect(result).toHaveLength(6);
    expect(result.every((d) => d.taskCount === 0)).toBe(true);
  });

  it('整单完成任务：taskSubtasks 与 taskTitles 对齐，展开全部完成子任务标题', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '招聘公告发布',
        category: '项目推进',
        status: 'done',
        completedDate: '2026-03-15',
        subtasks: [
          {
            id: 's1',
            title: '岗位需求确认',
            status: 'done',
            completedDate: '2026-03-01',
          },
          {
            id: 's2',
            title: '公告撰写',
            status: 'done',
            completedDate: '2026-03-10',
          },
          { id: 's3', title: '多渠道发布', status: 'todo' },
        ],
      }),
      makeTask({
        id: '2',
        title: '面试组织',
        category: '项目推进',
        status: 'done',
        completedDate: '2026-04-20',
      }),
    ];
    const result = getYearlyTasksByDimension(tasks, 2026, defaultCategories);
    const dim = result.find((d) => d.dimension === '项目推进')!;
    expect(dim.taskSubtasks).toHaveLength(dim.taskTitles.length);
    const idx = dim.taskTitles.indexOf('招聘公告发布');
    expect(dim.taskSubtasks[idx]).toEqual(['岗位需求确认', '公告撰写']);
    expect(dim.taskSubtasks[dim.taskTitles.indexOf('面试组织')]).toEqual([]);
    // 整单完成任务的子任务全部展开（即使完成于不同日期）
    expect(dim.taskSubtasks[idx]).toHaveLength(2);
  });

  it('推进中父任务有已勾子任务 → progressRows 父行 + 全部已勾子行（不做年份归因）', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '跨年推进任务',
        category: '项目推进',
        status: 'in-progress',
        subtasks: [
          {
            id: 's1',
            title: '本年步骤',
            status: 'done',
            completedDate: '2026-05-10',
          },
          {
            id: 's2',
            title: '去年步骤', // 完成于上年 → v2 也计入子行（打勾即完成）
            status: 'done',
            completedDate: '2025-12-20',
          },
          { id: 's3', title: '待办步骤', status: 'todo' },
        ],
      }),
      makeTask({
        id: '2',
        title: '旧数据无日期步骤',
        category: '项目推进',
        status: 'todo', // 父任务停在待办也计入
        subtasks: [{ id: 's4', title: 'x', status: 'done' }],
      }),
    ];
    const result = getYearlyTasksByDimension(tasks, 2026, defaultCategories);
    const dim = result.find((d) => d.dimension === '项目推进')!;
    expect(dim.taskCount).toBe(0); // 不占用完成计数
    expect(dim.progressRows).toHaveLength(2);
    expect(dim.progressRows[0].title).toBe('跨年推进任务');
    expect(dim.progressRows[0].done).toBe(2);
    expect(dim.progressRows[0].total).toBe(3);
    expect(dim.progressRows[0].subtaskTitles).toEqual(['本年步骤', '去年步骤']);
    expect(dim.progressRows[1].title).toBe('旧数据无日期步骤');
    expect(dim.progressRows[1].subtaskTitles).toEqual(['x']);
  });

  it('推进中父任务无任何已勾子任务 → 不产生 progressRows', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '无推进',
        category: '项目推进',
        status: 'in-progress',
        subtasks: [{ id: 's1', title: 'a', status: 'todo' }],
      }),
    ];
    const result = getYearlyTasksByDimension(tasks, 2026, defaultCategories);
    const dim = result.find((d) => d.dimension === '项目推进')!;
    expect(dim.progressRows).toEqual([]);
  });

  it('目标年份早于任务创建年份（createdDate 在年末之后）→ 不产生 progressRows', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '后年才建的任务',
        category: '项目推进',
        status: 'in-progress',
        createdDate: '2027-02-01',
        subtasks: [{ id: 's1', title: 'x', status: 'done' }],
      }),
    ];
    const result = getYearlyTasksByDimension(tasks, 2026, defaultCategories);
    const dim = result.find((d) => d.dimension === '项目推进')!;
    expect(dim.progressRows).toEqual([]);
  });

  it('推进中任务不影响量化聚合（quantities 仅来自整单完成）', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        title: '完成',
        category: '项目推进',
        status: 'done',
        completedDate: '2026-03-15',
        quantities: [{ label: '审查', value: 10, unit: '人次' }],
      }),
      makeTask({
        id: '2',
        title: '推进中',
        category: '项目推进',
        status: 'in-progress',
        quantities: [{ label: '审查', value: 99, unit: '人次' }],
        subtasks: [
          {
            id: 's1',
            title: '本年步骤',
            status: 'done',
            completedDate: '2026-05-10',
          },
        ],
      }),
    ];
    const result = getYearlyTasksByDimension(tasks, 2026, defaultCategories);
    const dim = result.find((d) => d.dimension === '项目推进')!;
    expect(dim.quantities).toHaveLength(1);
    expect(dim.quantities[0].value).toBe(10);
  });
});

describe('isSubtaskDoneInYear', () => {
  const parent = (over: Partial<Task> = {}): Task =>
    makeTask({ status: 'in-progress', ...over });

  it('按子任务 completedDate 判断年份', () => {
    const sub = {
      id: 's1',
      title: 'x',
      status: 'done' as const,
      completedDate: '2026-07-22',
    };
    expect(isSubtaskDoneInYear(sub, parent(), 2026)).toBe(true);
    expect(
      isSubtaskDoneInYear(
        { ...sub, completedDate: '2025-07-22' },
        parent(),
        2026,
      ),
    ).toBe(false);
  });

  it('todo 子任务不计入', () => {
    const sub = {
      id: 's1',
      title: 'x',
      status: 'todo' as const,
      completedDate: '2026-07-22',
    };
    expect(isSubtaskDoneInYear(sub, parent(), 2026)).toBe(false);
  });

  it('旧数据缺日期：父任务整单在本年完成 → 回退计入', () => {
    const p = makeTask({ status: 'done', completedDate: '2026-06-15' });
    const sub = { id: 's1', title: 'x', status: 'done' as const };
    expect(isSubtaskDoneInYear(sub, p, 2026)).toBe(true);
  });

  it('推进中父任务 + 子任务缺日期 → 不强行归因', () => {
    const sub = { id: 's1', title: 'x', status: 'done' as const };
    expect(isSubtaskDoneInYear(sub, parent(), 2026)).toBe(false);
  });
});

// ============================================================
// S6: 月度趋势表 (buildMonthlyTrendTable)
// ============================================================

describe('buildMonthlyTrendTable', () => {
  const defaultCategories = DEFAULT_CATEGORIES;

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
      makeTask({
        id: '1',
        title: '1月任务',
        category: '项目推进',
        status: 'done',
        completedDate: '2026-01-15',
      }),
      makeTask({
        id: '2',
        title: '2月任务',
        category: '项目推进',
        status: 'done',
        completedDate: '2026-02-10',
      }),
      makeTask({
        id: '3',
        title: '2月绩效',
        category: '会议培训',
        status: 'done',
        completedDate: '2026-02-20',
      }),
    ];
    const result = buildMonthlyTrendTable(tasks, 2026, defaultCategories);
    // January
    expect(result[0].categoryCounts['项目推进']).toBe(1);
    expect(result[0].categoryCounts['会议培训']).toBe(0);
    expect(result[0].total).toBe(1);
    // February
    expect(result[1].categoryCounts['项目推进']).toBe(1);
    expect(result[1].categoryCounts['会议培训']).toBe(1);
    expect(result[1].total).toBe(2);
    // March
    expect(result[2].total).toBe(0);
  });

  it('excludes non-done and cancelled tasks', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        category: '项目推进',
        status: 'todo',
        completedDate: '2026-01-15',
      }),
      makeTask({ id: '2', category: '项目推进', status: 'in-progress' }),
      makeTask({
        id: '3',
        category: '项目推进',
        status: 'cancelled',
        completedDate: '2026-01-15',
      }),
      makeTask({
        id: '4',
        category: '项目推进',
        status: 'done',
        completedDate: '2026-01-20',
      }),
    ];
    const result = buildMonthlyTrendTable(tasks, 2026, defaultCategories);
    expect(result[0].categoryCounts['项目推进']).toBe(1);
  });

  it('filters by year only', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        category: '项目推进',
        status: 'done',
        completedDate: '2026-01-15',
      }),
      makeTask({
        id: '2',
        category: '项目推进',
        status: 'done',
        completedDate: '2025-01-15',
      }),
    ];
    const result = buildMonthlyTrendTable(tasks, 2026, defaultCategories);
    expect(result[0].categoryCounts['项目推进']).toBe(1);
  });

  it('total column equals sum of all category counts', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        category: '项目推进',
        status: 'done',
        completedDate: '2026-06-01',
      }),
      makeTask({
        id: '2',
        category: '会议培训',
        status: 'done',
        completedDate: '2026-06-15',
      }),
      makeTask({
        id: '3',
        category: '临时交办',
        status: 'done',
        completedDate: '2026-06-20',
      }),
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
      '1月',
      '2月',
      '3月',
      '4月',
      '5月',
      '6月',
      '7月',
      '8月',
      '9月',
      '10月',
      '11月',
      '12月',
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
      makeTask({
        id: '1',
        category: '项目推进',
        status: 'done',
        completedDate: '2026-03-15',
        quantities: [{ label: '资格审查', value: 100, unit: '人次' }],
      }),
      makeTask({
        id: '2',
        category: '项目推进',
        status: 'done',
        completedDate: '2026-06-15',
        quantities: [{ label: '资格审查', value: 38, unit: '人次' }],
      }),
    ];
    const result = buildYearlyQuantityTable(tasks, 2026);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ label: '资格审查', value: 138, unit: '人次' });
  });

  it('keeps different labels separate', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        category: '项目推进',
        status: 'done',
        completedDate: '2026-03-15',
        quantities: [
          { label: '资格审查', value: 100, unit: '人次' },
          { label: '助力晋升', value: 12, unit: '人' },
        ],
      }),
    ];
    const result = buildYearlyQuantityTable(tasks, 2026);
    expect(result).toHaveLength(2);
  });

  it('merges same label across different categories', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        category: '项目推进',
        status: 'done',
        completedDate: '2026-01-15',
        quantities: [{ label: '审查', value: 10, unit: '人次' }],
      }),
      makeTask({
        id: '2',
        category: '会议培训',
        status: 'done',
        completedDate: '2026-03-15',
        quantities: [{ label: '审查', value: 5, unit: '人次' }],
      }),
    ];
    const result = buildYearlyQuantityTable(tasks, 2026);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(15);
  });

  it('excludes non-done tasks', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        category: '项目推进',
        status: 'todo',
        quantities: [{ label: '审查', value: 100, unit: '人次' }],
      }),
      makeTask({
        id: '2',
        category: '项目推进',
        status: 'done',
        completedDate: '2026-03-15',
        quantities: [{ label: '审查', value: 5, unit: '人次' }],
      }),
    ];
    const result = buildYearlyQuantityTable(tasks, 2026);
    expect(result[0].value).toBe(5);
  });

  it('filters by year', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        category: '项目推进',
        status: 'done',
        completedDate: '2026-03-15',
        quantities: [{ label: '审查', value: 10, unit: '人次' }],
      }),
      makeTask({
        id: '2',
        category: '项目推进',
        status: 'done',
        completedDate: '2025-03-15',
        quantities: [{ label: '审查', value: 50, unit: '人次' }],
      }),
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
      makeTask({
        id: '1',
        category: '项目推进',
        status: 'done',
        completedDate: '2026-03-15',
        quantities: [],
      }),
      makeTask({
        id: '2',
        category: '会议培训',
        status: 'done',
        completedDate: '2026-06-15',
        quantities: [{ label: '考核', value: 5, unit: '次' }],
      }),
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
  const defaultCategories = DEFAULT_CATEGORIES;

  it('generates summary with category count and total task count', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        category: '项目推进',
        status: 'done',
        completedDate: '2026-03-15',
      }),
      makeTask({
        id: '2',
        category: '会议培训',
        status: 'done',
        completedDate: '2026-06-20',
      }),
      makeTask({
        id: '3',
        category: '临时交办',
        status: 'done',
        completedDate: '2026-09-10',
      }),
      makeTask({
        id: '4',
        category: '项目推进',
        status: 'done',
        completedDate: '2026-11-15',
      }),
    ];
    const result = generateYearlyOneLiner(tasks, 2026, defaultCategories);
    expect(result).toContain('3');
    expect(result).toContain('4');
  });

  it('mentions quantity labels in the summary', () => {
    const tasks: Task[] = [
      makeTask({
        id: '1',
        category: '项目推进',
        status: 'done',
        completedDate: '2026-03-15',
        quantities: [
          { label: '资格审查', value: 138, unit: '人次' },
          { label: '助力晋升', value: 12, unit: '人' },
        ],
      }),
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
      makeTask({
        id: '1',
        category: '项目推进',
        status: 'done',
        completedDate: '2026-03-15',
      }),
    ];
    const result = generateYearlyOneLiner(tasks, 2026, defaultCategories);
    expect(result).toContain('2026');
  });
});
