import type { Task, Quantity } from './types';

// ============================================================
// Year date utility
// ============================================================

/**
 * Check if a date string falls within a given year.
 */
export function isDateInYear(dateStr: string | null, year: number): boolean {
  if (!dateStr) return false;
  const dateYear = parseInt(dateStr.slice(0, 4), 10);
  return dateYear === year;
}

// ============================================================
// S4: 分类→维度映射 (mapCategoryToDimension)
// ============================================================

/** The six canonical dimensions for yearly reports */
export const YEARLY_DIMENSIONS = [
  '日常工作',
  '项目推进',
  '奖惩管理',
  '绩效管理',
  '劳动关系',
  '交办事项',
] as const;

/**
 * Map a task category to one of the six yearly report dimensions.
 * Exact matches for standard categories; "其他" and unknown categories
 * fall back to 交办事项.
 */
export function mapCategoryToDimension(category: string): string {
  switch (category) {
    case '人员调配':
      return '日常工作';
    case '内部招聘':
      return '项目推进';
    case '奖惩管理':
      return '奖惩管理';
    case '绩效管理':
      return '绩效管理';
    case '劳动关系':
      return '劳动关系';
    case '交办事项':
      return '交办事项';
    default:
      // "其他" and unknown categories → 交办事项
      return '交办事项';
  }
}

// ============================================================
// S5: 年度维度归纳 (getYearlyTasksByDimension)
// ============================================================

/** 未整单完成（含待办/进行中）且已有已勾子任务的父任务行（快照式） */
export interface YearProgressRow {
  title: string;
  /** 父任务总子任务数 */
  total: number;
  /** 父任务已勾子任务数 */
  done: number;
  /** 全部已勾子任务标题（打勾即完成，不做年份归因） */
  subtaskTitles: string[];
}

export interface DimensionSummary {
  dimension: string;
  taskCount: number;
  taskTitles: string[];
  /** 与 taskTitles 对齐的任务具体内容（无内容为空字符串） */
  taskNotes: string[];
  /** 与 taskTitles 对齐：整单完成任务展开的全部完成子任务标题（无子任务为空数组） */
  taskSubtasks: string[][];
  /** 推进中父任务（有已勾子任务即单列，快照式） */
  progressRows: YearProgressRow[];
  quantities: Quantity[];
}

/**
 * 判断子任务是否属于给定年份完成（仅用于整单完成回退与既有调用）：
 * 优先用子任务自身的 completedDate；缺失（旧数据）时回退——
 * 父任务整单在本年完成则其完成子任务视为本年完成（子任务必不晚于父任务）。
 */
export function isSubtaskDoneInYear(
  sub: { status: 'todo' | 'done'; completedDate?: string | null },
  parent: Task,
  year: number,
): boolean {
  if (sub.status !== 'done') return false;
  if (sub.completedDate) return isDateInYear(sub.completedDate, year);
  return parent.status === 'done' && isDateInYear(parent.completedDate, year);
}

/**
 * Group all completed (done) tasks in the target year by six dimensions.
 * Quantities within each dimension are aggregated by label (same label → sum values).
 * All six dimensions are always returned, even if empty (taskCount = 0).
 *
 * 子任务归入总结（呈现规则 2026-09-07 定稿）：
 * - 整单完成的任务：任务行下展开其全部完成子任务标题（taskSubtasks 与 taskTitles 对齐）；
 * - 未整单完成（含待办/进行中）的父任务：只要存在已勾子任务即单列 progressRows——
 *   打勾即完成，不依赖子任务日期；子行 = 全部已勾标题（快照式）。
 *   仅计入父任务存续期覆盖到的年份（createdDate ≤ 年末且未在年初前整单完成）。
 */
export function getYearlyTasksByDimension(
  tasks: Task[],
  year: number,
  _categories: string[],
): DimensionSummary[] {
  // Initialize all six dimensions
  const dimMap: Record<string, DimensionSummary> = {};
  for (const dim of YEARLY_DIMENSIONS) {
    dimMap[dim] = {
      dimension: dim,
      taskCount: 0,
      taskTitles: [],
      taskNotes: [],
      taskSubtasks: [],
      progressRows: [],
      quantities: [],
    };
  }

  for (const task of tasks) {
    if (task.status === 'cancelled') continue;
    const dim = mapCategoryToDimension(task.category);
    const entry = dimMap[dim];
    if (!entry) continue; // should not happen given our mapping

    if (task.status === 'done') {
      // Only done-in-year tasks belong to the completed task list
      if (!isDateInYear(task.completedDate, year)) continue;
      entry.taskCount += 1;
      entry.taskTitles.push(task.title);
      entry.taskNotes.push(task.notes.trim());
      entry.taskSubtasks.push(
        task.subtasks.filter((s) => s.status === 'done').map((s) => s.title),
      );

      // Aggregate quantities
      for (const q of task.quantities) {
        const existing = entry.quantities.find((eq) => eq.label === q.label);
        if (existing) {
          existing.value += q.value;
        } else {
          entry.quantities.push({
            label: q.label,
            value: q.value,
            unit: q.unit,
          });
        }
      }
      continue;
    }

    // 推进中父任务（打勾即完成，快照式）：
    // 父任务须在目标年份存续——创建不晚于年末；未整单完成的父任务本就无
    // completedDate，年份归属以其存续期近似，跨年存续的任务在每年报告中都会出现。
    const createdInOrBeforeYear = task.createdDate
      ? task.createdDate <= `${year}-12-31`
      : true;
    if (!createdInOrBeforeYear) continue;

    const doneSubtasks = task.subtasks.filter((s) => s.status === 'done');
    if (doneSubtasks.length === 0) continue;
    entry.progressRows.push({
      title: task.title,
      total: task.subtasks.length,
      done: doneSubtasks.length,
      subtaskTitles: doneSubtasks.map((s) => s.title),
    });
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
        categoryCounts[task.category] =
          (categoryCounts[task.category] || 0) + 1;
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
