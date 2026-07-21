import type { Task, Quantity } from './types';

// ============================================================
// Year date utility
// ============================================================

/**
 * Check if a date string falls within a given year.
 */
export function isDateInYear(
  dateStr: string | null,
  year: number,
): boolean {
  if (!dateStr) return false;
  const dateYear = parseInt(dateStr.slice(0, 4), 10);
  return dateYear === year;
}

// ============================================================
// S4: 分类→维度映射 (mapCategoryToDimension)
// ============================================================

/** The six canonical dimensions for yearly reports */
export const YEARLY_DIMENSIONS = [
  '人员配置',
  '内部招聘（晋升晋等）',
  '奖惩管理',
  '绩效管理',
  '劳动关系',
  '领导交办',
] as const;

/**
 * Map a task category to one of the six yearly report dimensions.
 * Exact matches for standard categories; "其他" and unknown categories
 * fall back to 领导交办.
 */
export function mapCategoryToDimension(category: string): string {
  switch (category) {
    case '人员调配':
      return '人员配置';
    case '内部招聘':
      return '内部招聘（晋升晋等）';
    case '奖惩管理':
      return '奖惩管理';
    case '绩效管理':
      return '绩效管理';
    case '劳动关系':
      return '劳动关系';
    case '领导交办':
      return '领导交办';
    default:
      // "其他" and unknown categories → 领导交办
      return '领导交办';
  }
}

// ============================================================
// S5: 年度维度归纳 (getYearlyTasksByDimension)
// ============================================================

export interface DimensionSummary {
  dimension: string;
  taskCount: number;
  taskTitles: string[];
  quantities: Quantity[];
}

/**
 * Group all completed (done) tasks in the target year by six dimensions.
 * Quantities within each dimension are aggregated by label (same label → sum values).
 * All six dimensions are always returned, even if empty (taskCount = 0).
 */
export function getYearlyTasksByDimension(
  tasks: Task[],
  year: number,
  _categories: string[],
): DimensionSummary[] {
  // Filter done tasks in the target year
  const yearTasks = tasks.filter(
    (t) => t.status === 'done' && isDateInYear(t.completedDate, year),
  );

  // Initialize all six dimensions
  const dimMap: Record<string, DimensionSummary> = {};
  for (const dim of YEARLY_DIMENSIONS) {
    dimMap[dim] = {
      dimension: dim,
      taskCount: 0,
      taskTitles: [],
      quantities: [],
    };
  }

  // Group tasks by dimension
  for (const task of yearTasks) {
    const dim = mapCategoryToDimension(task.category);
    const entry = dimMap[dim];
    if (!entry) continue; // should not happen given our mapping

    entry.taskCount += 1;
    entry.taskTitles.push(task.title);

    // Aggregate quantities
    for (const q of task.quantities) {
      const existing = entry.quantities.find((eq) => eq.label === q.label);
      if (existing) {
        existing.value += q.value;
      } else {
        entry.quantities.push({ label: q.label, value: q.value, unit: q.unit });
      }
    }
  }

  return YEARLY_DIMENSIONS.map((dim) => dimMap[dim]);
}

// ============================================================
// S6: 月度趋势表 (buildMonthlyTrendTable)
// ============================================================

export interface MonthlyTrendRow {
  month: string; // "1月" through "12月"
  categoryCounts: Record<string, number>; // category → count
  total: number;
}

/**
 * Build a 12-row monthly trend table.
 * Each row = one month (1月–12月), columns = category counts + total.
 * Only counts done tasks (excludes cancelled).
 */
export function buildMonthlyTrendTable(
  tasks: Task[],
  year: number,
  categories: string[],
): MonthlyTrendRow[] {
  const rows: MonthlyTrendRow[] = [];

  for (let month = 1; month <= 12; month++) {
    // Initialize category counts to zero
    const categoryCounts: Record<string, number> = {};
    for (const cat of categories) {
      categoryCounts[cat] = 0;
    }

    // Count done tasks completed in this month of the target year
    for (const task of tasks) {
      if (task.status !== 'done') continue;
      if (!task.completedDate) continue;
      const parts = task.completedDate.split('-');
      if (parts.length < 2) continue;
      const taskYear = parseInt(parts[0], 10);
      const taskMonth = parseInt(parts[1], 10);
      if (taskYear === year && taskMonth === month) {
        categoryCounts[task.category] = (categoryCounts[task.category] || 0) + 1;
      }
    }

    const total = Object.values(categoryCounts).reduce((a, b) => a + b, 0);

    rows.push({
      month: `${month}月`,
      categoryCounts,
      total,
    });
  }

  return rows;
}

// ============================================================
// S7: 全年量化产出总表 (buildYearlyQuantityTable)
// ============================================================

export interface QuantityTotal {
  label: string;
  value: number;
  unit: string;
}

/**
 * Aggregate all quantities from all done tasks in the target year.
 * Merges by label across all categories.
 */
export function buildYearlyQuantityTable(
  tasks: Task[],
  year: number,
): QuantityTotal[] {
  const doneTasks = tasks.filter(
    (t) => t.status === 'done' && isDateInYear(t.completedDate, year),
  );

  const aggMap: Record<string, QuantityTotal> = {};

  for (const task of doneTasks) {
    for (const q of task.quantities) {
      if (aggMap[q.label]) {
        aggMap[q.label].value += q.value;
      } else {
        aggMap[q.label] = { label: q.label, value: q.value, unit: q.unit };
      }
    }
  }

  return Object.values(aggMap);
}

// ============================================================
// S8: 一句话总结 (generateYearlyOneLiner)
// ============================================================

/**
 * Generate a one-line summary for the year.
 * Format: "2026年全年完成 N 类工作共 M 项任务，量化产出涵盖……"
 */
export function generateYearlyOneLiner(
  tasks: Task[],
  year: number,
  _categories: string[],
): string {
  const doneTasks = tasks.filter(
    (t) => t.status === 'done' && isDateInYear(t.completedDate, year),
  );

  if (doneTasks.length === 0) {
    return `${year}年暂无已完成任务`;
  }

  // Count distinct categories with work
  const catsWithWork = new Set(doneTasks.map((t) => t.category));
  const categoryCount = catsWithWork.size;

  // Total task count
  const taskCount = doneTasks.length;

  // Collect all quantity labels
  const qTable = buildYearlyQuantityTable(tasks, year);
  const labelList = qTable.map((q) => q.label);

  let summary = `${year}年全年完成 ${categoryCount} 类工作共 ${taskCount} 项任务`;

  if (labelList.length > 0) {
    summary += `，量化产出涵盖${labelList.join('、')}`;
  }

  summary += '。';

  return summary;
}
