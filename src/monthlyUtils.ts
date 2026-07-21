import type { Task, Project } from './types';

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
    (t) =>
      t.status === 'done' &&
      isDateInMonth(t.completedDate, year, month),
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
// S2: 项目进度回顾 (getMonthlyProjectProgress)
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
 * Only considers tasks that were completed (status 'done') in the target month.
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

    // Count all subtasks across all project tasks
    let allDone = 0;
    let allTotal = 0;
    const completedThisMonth: string[] = [];

    for (const task of projectTasks) {
      for (const sub of task.subtasks) {
        allTotal += 1;
        if (sub.status === 'done') {
          allDone += 1;
        }
      }
      // If this task was completed this month, its done subtasks are "completed this month"
      if (
        task.status === 'done' &&
        isDateInMonth(task.completedDate, year, month)
      ) {
        for (const sub of task.subtasks) {
          if (sub.status === 'done') {
            completedThisMonth.push(sub.title);
          }
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
