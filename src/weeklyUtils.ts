import type { SubTask, Task, Project } from './types';

// ============================================================
// Week math utilities
// ============================================================

/**
 * Get ISO week key from a Date object.
 * Format: "2026-W29"
 * ISO week: starts Monday, week 1 contains Jan 4 (first Thursday).
 */
export function getWeekKey(date: Date): string {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7; // Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  const year = d.getUTCFullYear();
  return `${year}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Get the Monday-to-Friday date range for a given ISO week key.
 * Returns ISO date strings (YYYY-MM-DD) and a Chinese label.
 */
export function getWeekDateRange(weekKey: string): {
  start: string;
  end: string;
  label: string;
} {
  const [yearStr, weekStr] = weekKey.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);

  // Get Jan 4 of the target year (always in ISO week 1)
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7; // Sunday = 7
  // Monday of week 1
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));

  // Monday of target week
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  // Friday = Monday + 4
  const friday = new Date(monday);
  friday.setUTCDate(monday.getUTCDate() + 4);

  const toISO = (d: Date): string => d.toISOString().slice(0, 10);
  const start = toISO(monday);
  const end = toISO(friday);

  // Format label: "7月20日 - 7月24日"
  const sm = monday.getUTCMonth() + 1;
  const sd = monday.getUTCDate();
  const em = friday.getUTCMonth() + 1;
  const ed = friday.getUTCDate();
  const label = `${sm}月${sd}日 - ${em}月${ed}日`;

  return { start, end, label };
}

/**
 * Get adjacent week key.
 * @param direction -1 for previous, +1 for next.
 */
export function getAdjacentWeek(weekKey: string, direction: number): string {
  // Use a date in the middle of the week (Wednesday) and add/subtract 7 days
  const { start } = getWeekDateRange(weekKey);
  const wednesday = new Date(start);
  wednesday.setUTCDate(wednesday.getUTCDate() + 2); // Wednesday
  wednesday.setUTCDate(wednesday.getUTCDate() + direction * 7);

  return getWeekKey(wednesday);
}

/**
 * Check if a date string falls within a given week.
 */
export function isDateInWeek(dateStr: string | null, weekKey: string): boolean {
  if (!dateStr) return false;
  const { start, end } = getWeekDateRange(weekKey);
  return dateStr >= start && dateStr <= end;
}

// ============================================================
// Quantity formatting
// ============================================================

/** Format a task's quantities into readable text like "审查 15 人次，通过 14 人次" */
export function formatQuantityText(task: Task): string {
  if (task.quantities.length === 0) return '';
  return task.quantities
    .map((q) => `${q.label} ${q.value} ${q.unit}`)
    .join('，');
}

// ============================================================
// Section 1: 本周完成任务
// ============================================================

export interface CategoryTaskGroup {
  category: string;
  tasks: {
    title: string;
    quantityText: string;
    notes: string;
    /** 该任务当前已完成的子任务数（整单完成时用于括注计数） */
    doneSubtaskCount: number;
    /** 该任务已勾子任务标题（句式 v3：整单完成句内联展示） */
    doneSubtaskTitles: string[];
    /** 该任务子任务总数（部分完成时句内输出「完成子步骤 x/y 项」） */
    subtaskTotal: number;
  }[];
}

/**
 * Filter tasks completed within the given week, grouped by category.
 * Groups are ordered by `categories` array order.
 * Categories with no completed tasks are excluded.
 */
export function getCompletedTasksByCategory(
  tasks: Task[],
  weekKey: string,
  categories: string[],
): CategoryTaskGroup[] {
  const completed = tasks.filter(
    (t) => t.status === 'done' && isDateInWeek(t.completedDate, weekKey),
  );

  const grouped: Record<
    string,
    {
      title: string;
      quantityText: string;
      notes: string;
      doneSubtaskCount: number;
      doneSubtaskTitles: string[];
      subtaskTotal: number;
    }[]
  > = {};
  for (const task of completed) {
    if (!grouped[task.category]) {
      grouped[task.category] = [];
    }
    grouped[task.category].push({
      title: task.title,
      quantityText: formatQuantityText(task),
      notes: task.notes.trim(),
      doneSubtaskCount: task.subtasks.filter((s) => s.status === 'done').length,
      doneSubtaskTitles: task.subtasks
        .filter((s) => s.status === 'done')
        .map((s) => s.title),
      subtaskTotal: task.subtasks.length,
    });
  }

  // Order by categories array, exclude empty categories
  const result: CategoryTaskGroup[] = [];
  for (const cat of categories) {
    if (grouped[cat] && grouped[cat].length > 0) {
      result.push({ category: cat, tasks: grouped[cat] });
    }
  }

  return result;
}

// ============================================================
// Section 1+: 子任务周期归因 & 非项目任务推进
// ============================================================

/**
 * 判断子任务是否属于给定周完成（仅用于项目推进段按期归因）：
 * 优先用子任务自身的 completedDate；缺失（旧数据）时回退——
 * 父任务整单在本周完成则其完成子任务视为本周完成（子任务必不晚于父任务）。
 */
export function isSubtaskDoneInWeek(
  sub: SubTask,
  parent: Task,
  weekKey: string,
): boolean {
  if (sub.status !== 'done') return false;
  if (sub.completedDate) return isDateInWeek(sub.completedDate, weekKey);
  return (
    parent.status === 'done' && isDateInWeek(parent.completedDate, weekKey)
  );
}

export interface WeeklyOngoingTaskRow {
  id: string;
  title: string;
  category: string;
  /** 已勾子任务标题（打勾即完成，快照式） */
  doneTitles: string[];
  /** 未勾子任务标题（待开展） */
  todoTitles: string[];
}

/**
 * 未整单完成（待办/进行中）且有子任务的任务（含项目任务），返回其进行行。
 * 呈现规则（2026-09-08 定稿）：
 * - 已勾子任务 = 已完成，未勾子任务 = 待开展，两者均展示（快照式）；
 * - 项目任务同样纳入列表（不做项目/非项目区分）；
 * - 远期任务（startDate 晚于本周结束日）不纳入周表，从其起始周起进入；
 * - 整单完成/已取消任务不在此段（完成归「本周完成任务」）。
 */
export function getWeeklyOngoingTasks(
  tasks: Task[],
  weekEnd: string,
): WeeklyOngoingTaskRow[] {
  const rows: WeeklyOngoingTaskRow[] = [];
  for (const task of tasks) {
    if (task.status === 'done' || task.status === 'cancelled') continue;
    // 远期任务：起始日期晚于本周末，尚未进入周报总结
    if (task.startDate && task.startDate > weekEnd) continue;
    if (task.subtasks.length === 0) continue;
    rows.push({
      id: task.id,
      title: task.title,
      category: task.category,
      doneTitles: task.subtasks
        .filter((s) => s.status === 'done')
        .map((s) => s.title),
      todoTitles: task.subtasks
        .filter((s) => s.status !== 'done')
        .map((s) => s.title),
    });
  }
  return rows;
}

// ============================================================
// Section 2: 长期项目推进
// ============================================================

export interface ProjectProgressChange {
  projectId: string;
  projectTitle: string;
  totalSubtasks: number;
  doneSubtasks: number;
  beforePercent: number;
  afterPercent: number;
  completedThisWeek: string[];
}

/**
 * Find projects that had subtasks completed this week.
 * Calculates progress change (subtask-based).
 */
export function getProjectProgressChanges(
  tasks: Task[],
  projects: Project[],
  weekKey: string,
): ProjectProgressChange[] {
  const results: ProjectProgressChange[] = [];

  for (const project of projects) {
    const projectTasks = tasks.filter(
      (t) => t.projectId === project.id && t.status !== 'cancelled',
    );

    // Collect all subtasks and identify which were done this week.
    // 归因规则：优先子任务自身 completedDate；旧数据缺失时回退为
    // "父任务整单在本周完成 → 其完成子任务视为本周完成"。
    const completedThisWeek: string[] = [];
    let allDone = 0;
    let allTotal = 0;

    for (const task of projectTasks) {
      for (const sub of task.subtasks) {
        allTotal += 1;
        if (sub.status === 'done') {
          allDone += 1;
        }
        if (isSubtaskDoneInWeek(sub, task, weekKey)) {
          completedThisWeek.push(sub.title);
        }
      }
    }

    if (completedThisWeek.length === 0) continue;

    const afterPercent =
      allTotal > 0 ? Math.floor((allDone / allTotal) * 100) : 0;
    // Before: done minus this week's completions
    const beforeDone = allDone - completedThisWeek.length;
    const beforePercent =
      allTotal > 0 ? Math.floor((beforeDone / allTotal) * 100) : 0;

    results.push({
      projectId: project.id,
      projectTitle: project.title,
      totalSubtasks: allTotal,
      doneSubtasks: allDone,
      beforePercent,
      afterPercent,
      completedThisWeek,
    });
  }

  return results;
}

// ============================================================
// Section 3: 下周计划
// ============================================================

export interface PlanCandidate {
  taskId: string;
  title: string;
  category: string;
}

/**
 * Find todo tasks suitable for next week's plan.
 * Criteria: status=todo AND (no deadline OR deadline within 14 days from reference).
 * Excludes tasks with past deadlines.
 */
export function getNextWeekPlanCandidates(
  tasks: Task[],
  referenceDate: Date,
): PlanCandidate[] {
  const refISO = referenceDate.toISOString().slice(0, 10);
  const maxDate = new Date(referenceDate);
  maxDate.setDate(maxDate.getDate() + 14);
  const maxISO = maxDate.toISOString().slice(0, 10);

  return tasks
    .filter((t) => {
      if (t.status !== 'todo') return false;
      // No deadline → include
      if (!t.deadline) return true;
      // Deadline in the past → exclude
      if (t.deadline < refISO) return false;
      // Deadline within 14 days → include
      return t.deadline <= maxISO;
    })
    .map((t) => ({
      taskId: t.id,
      title: t.title,
      category: t.category,
    }));
}

// ============================================================
// Section 4: 需协调事项
// ============================================================

export interface CoordinationItem {
  taskId: string;
  title: string;
  lastUpdated: string;
  reason: 'stale' | 'blocked';
}

/**
 * Find tasks that need coordination:
 * 1. In-progress tasks not updated for more than 7 days (stale)
 * 2. Tasks manually marked as blocked
 * Blocked reason takes priority over stale (deduplication).
 */
export function getCoordinationItems(
  tasks: Task[],
  referenceDate: Date,
): CoordinationItem[] {
  const staleThreshold = new Date(referenceDate);
  staleThreshold.setDate(staleThreshold.getDate() - 7);
  const thresholdISO = staleThreshold.toISOString().slice(0, 10);

  const items: CoordinationItem[] = [];
  const seenIds = new Set<string>();

  // Pass 1: Blocked tasks (regardless of update recency)
  for (const task of tasks) {
    if (task.status !== 'in-progress') continue;
    if (task.isBlocked) {
      items.push({
        taskId: task.id,
        title: task.title,
        lastUpdated: task.updatedDate,
        reason: 'blocked',
      });
      seenIds.add(task.id);
    }
  }

  // Pass 2: Stale tasks (not updated for >7 days, not already listed as blocked)
  for (const task of tasks) {
    if (task.status !== 'in-progress') continue;
    if (seenIds.has(task.id)) continue;
    if (task.updatedDate <= thresholdISO) {
      items.push({
        taskId: task.id,
        title: task.title,
        lastUpdated: task.updatedDate,
        reason: 'stale',
      });
    }
  }

  return items;
}
