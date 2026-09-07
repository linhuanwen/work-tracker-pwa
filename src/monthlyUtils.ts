import type { SubTask, Task, Project } from './types';

// ============================================================
// Month math utilities
// ============================================================

/**
 * Check if a date string falls within a given year and month.
 */
export function isDateInMonth(
  dateStr: string | null,
  year: number,
  month: number,
): boolean {
  if (!dateStr) return false;
  const parts = dateStr.split('-');
  if (parts.length < 2) return false;
  const dateYear = parseInt(parts[0], 10);
  const dateMonth = parseInt(parts[1], 10);
  return dateYear === year && dateMonth === month;
}

/**
 * Get month key in "YYYY-MM" format.
 */
export function getMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Get Chinese label for a month.
 */
export function getMonthLabel(year: number, month: number): string {
  return `${year}年${month}月`;
}

/**
 * Get adjacent month.
 * @param direction -1 for previous, +1 for next.
 */
export function getAdjacentMonth(
  year: number,
  month: number,
  direction: number,
): { year: number; month: number } {
  let newMonth = month + direction;
  let newYear = year;
  if (newMonth < 1) {
    newMonth = 12;
    newYear -= 1;
  } else if (newMonth > 12) {
    newMonth = 1;
    newYear += 1;
  }
  return { year: newYear, month: newMonth };
}

// ============================================================
// S1: 量化汇总表 (aggregateMonthlyQuantities)
// ============================================================

export interface AggregatedQuantity {
  category: string;
  label: string;
  value: number;
  unit: string;
}

/**
 * Aggregate quantities from all completed tasks in a given month.
 * Groups by category, then merges quantities with the same label by summing values.
 * Only tasks with status 'done' and completedDate in the target month are included.
 * Cancelled tasks are excluded.
 */
export function aggregateMonthlyQuantities(
  tasks: Task[],
  year: number,
  month: number,
): AggregatedQuantity[] {
  // Filter: done tasks completed in the target month
  const completed = tasks.filter(
    (t) => t.status === 'done' && isDateInMonth(t.completedDate, year, month),
  );

  // Aggregate: key = category + label
  const aggMap: Record<string, AggregatedQuantity> = {};

  for (const task of completed) {
    for (const q of task.quantities) {
      const key = `${task.category}::${q.label}`;
      if (aggMap[key]) {
        aggMap[key].value += q.value;
      } else {
        aggMap[key] = {
          category: task.category,
          label: q.label,
          value: q.value,
          unit: q.unit,
        };
      }
    }
  }

  return Object.values(aggMap);
}

// ============================================================
// S2: 任务/项目推进 (getMonthlyProjectProgress)
// ============================================================

export interface MonthlyProjectChange {
  projectId: string;
  projectTitle: string;
  totalSubtasks: number;
  doneSubtasks: number;
  beforePercent: number;
  afterPercent: number;
  completedThisWeek: string[];
}

/**
 * Find projects that had subtasks completed in the target month.
 * Calculates progress change (before month → after month) based on subtask counts.
 */
export function getMonthlyProjectProgress(
  tasks: Task[],
  projects: Project[],
  year: number,
  month: number,
): MonthlyProjectChange[] {
  const results: MonthlyProjectChange[] = [];

  for (const project of projects) {
    const projectTasks = tasks.filter(
      (t) => t.projectId === project.id && t.status !== 'cancelled',
    );

    // Count all subtasks across all project tasks.
    // 归因规则：优先子任务自身 completedDate；旧数据缺失时回退为
    // "父任务整单在本月完成 → 其完成子任务视为本月完成"。
    let allDone = 0;
    let allTotal = 0;
    const completedThisMonth: string[] = [];

    for (const task of projectTasks) {
      for (const sub of task.subtasks) {
        allTotal += 1;
        if (sub.status === 'done') {
          allDone += 1;
        }
        if (isSubtaskDoneInMonth(sub, task, year, month)) {
          completedThisMonth.push(sub.title);
        }
      }
    }

    if (completedThisMonth.length === 0) continue;

    const afterPercent =
      allTotal > 0 ? Math.floor((allDone / allTotal) * 100) : 0;
    const beforeDone = allDone - completedThisMonth.length;
    const beforePercent =
      allTotal > 0 ? Math.floor((beforeDone / allTotal) * 100) : 0;

    results.push({
      projectId: project.id,
      projectTitle: project.title,
      totalSubtasks: allTotal,
      doneSubtasks: allDone,
      beforePercent,
      afterPercent,
      completedThisWeek: completedThisMonth,
    });
  }

  return results;
}

// ============================================================
// S2+: 子任务月度归因 & 非项目任务推进
// ============================================================

/**
 * 判断子任务是否属于给定月份完成（仅用于项目推进段按期归因与月度统计尾行）：
 * 优先用子任务自身的 completedDate；缺失（旧数据）时回退——
 * 父任务整单在本月完成则其完成子任务视为本月完成（子任务必不晚于父任务）。
 */
export function isSubtaskDoneInMonth(
  sub: SubTask,
  parent: Task,
  year: number,
  month: number,
): boolean {
  if (sub.status !== 'done') return false;
  if (sub.completedDate) return isDateInMonth(sub.completedDate, year, month);
  return (
    parent.status === 'done' && isDateInMonth(parent.completedDate, year, month)
  );
}

export interface NonProjectSubtaskProgressRow {
  id: string;
  title: string;
  total: number;
  done: number;
  /** 全部已勾子任务标题（打勾即完成，不做周期归因；快照式展示） */
  doneTitles: string[];
}

/**
 * 未整单完成（含待办/进行中）且无项目归属的任务，只要存在已勾子任务即返回其推进行，
 * 用于「任务/项目推进」段挂进度说明。呈现规则（2026-09-07 定稿）：
 * 子任务打勾即视为完成，不依赖子任务日期、也不要求父任务先改到「进行中」；
 * 父行 x/y 与子行均为当前快照，任务存续期间每期总结都会出现。
 */
export function getMonthlyNonProjectProgress(
  tasks: Task[],
): NonProjectSubtaskProgressRow[] {
  const rows: NonProjectSubtaskProgressRow[] = [];
  for (const task of tasks) {
    if (task.projectId !== null) continue;
    if (task.status === 'done' || task.status === 'cancelled') continue;
    const doneSubtasks = task.subtasks.filter((s) => s.status === 'done');
    if (doneSubtasks.length === 0) continue;
    rows.push({
      id: task.id,
      title: task.title,
      total: task.subtasks.length,
      done: doneSubtasks.length,
      doneTitles: doneSubtasks.map((s) => s.title),
    });
  }
  return rows;
}

/** 本月完成子任务统计（全部非取消任务），用于量化汇总末尾的计数行。 */
export function getMonthlySubtaskStats(
  tasks: Task[],
  year: number,
  month: number,
): { doneCount: number; taskCount: number } {
  let doneCount = 0;
  let taskCount = 0;
  for (const task of tasks) {
    if (task.status === 'cancelled') continue;
    const n = task.subtasks.filter((s) =>
      isSubtaskDoneInMonth(s, task, year, month),
    ).length;
    if (n > 0) {
      doneCount += n;
      taskCount += 1;
    }
  }
  return { doneCount, taskCount };
}

// ============================================================
// S3: 下月重点 (getNextMonthFocusCandidates)
// ============================================================

export interface MonthPlanCandidate {
  taskId: string;
  title: string;
  category: string;
}

/**
 * Find todo tasks suitable for next month's focus.
 * Criteria:
 * - status = 'todo'
 * - No deadline → always included
 * - Deadline falls within the next calendar month → included
 * - Deadline in current month or past → excluded
 * - Deadline beyond next month → excluded
 */
export function getNextMonthFocusCandidates(
  tasks: Task[],
  year: number,
  month: number,
): MonthPlanCandidate[] {
  // Calculate next month
  const next = getAdjacentMonth(year, month, 1);

  // Date range for next month
  const nextMonthStart = `${next.year}-${String(next.month).padStart(2, '0')}-01`;
  // Last day of next month
  const lastDay = new Date(next.year, next.month, 0).getDate();
  const nextMonthEnd = `${next.year}-${String(next.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // Current month start (for excluding current-month deadlines)
  const currentMonthStart = `${year}-${String(month).padStart(2, '0')}-01`;

  return tasks
    .filter((t) => {
      if (t.status !== 'todo') return false;
      // No deadline → include
      if (!t.deadline) return true;
      // Deadline in the past → exclude (before current month)
      if (t.deadline < currentMonthStart) return false;
      // Deadline in target next month range → include
      return t.deadline >= nextMonthStart && t.deadline <= nextMonthEnd;
    })
    .map((t) => ({
      taskId: t.id,
      title: t.title,
      category: t.category,
    }));
}
