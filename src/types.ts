// ============================================================
// data.json TypeScript 类型定义
// 基于 docs/specs/0001-pwa-todo-work-journal.md 数据模型章节
// ============================================================

/** 任务优先级 */
export type Priority = 'urgent' | 'important' | 'normal';

/** 任务状态 */
export type TaskStatus = 'todo' | 'in-progress' | 'done' | 'cancelled';

/** 项目状态 */
export type ProjectStatus = 'in-progress' | 'completed' | 'archived';

/** 量化产出指标 */
export interface Quantity {
  label: string;
  value: number;
  unit: string;
}

/** 子任务 */
export interface SubTask {
  id: string;
  title: string;
  status: 'todo' | 'done';
}

/** 任务 */
export interface Task {
  id: string;
  projectId: string | null;
  title: string;
  category: string;
  priority: Priority;
  status: TaskStatus;
  createdDate: string; // ISO date
  updatedDate: string; // ISO date — last modification date
  deadline: string | null; // ISO date
  completedDate: string | null; // ISO date
  quantities: Quantity[];
  subtasks: SubTask[];
  notes: string;
  isLeaderAssigned: boolean;
  leaderSource?: string;
  leaderAssignedDate?: string;
  leaderDeadline?: string;
  isCrossYear: boolean;
  isBlocked: boolean;
  hibernateUntil?: string; // ISO date
}

/** 项目 */
export interface Project {
  id: string;
  title: string;
  category: string;
  status: ProjectStatus;
  startDate: string; // ISO date
  targetDate: string; // ISO date
  notes: string;
  subtaskCount: { total: number; done: number };
}

/** 周小结条目 */
export interface WeekEntry {
  tasks: string[]; // task IDs
  summary: {
    doneTasks: string; // markdown
    projectProgress: string; // markdown
    nextWeekPlan: string; // markdown
    blockers: string; // markdown
  };
  aiPolished: boolean;
}

/** 月小结条目 */
export interface MonthEntry {
  tasks: string[]; // task IDs
  summary: {
    quantitativeSummary: string; // markdown
    projectReview: string; // markdown
    reflection: string; // markdown
    nextMonthFocus: string; // markdown
  };
  aiPolished: boolean;
}

/** 年小结条目 */
export interface YearEntry {
  tasks: string[]; // task IDs
  summary: {
    personnelAllocation: string;
    internalRecruitment: string;
    rewardDiscipline: string;
    performance: string;
    laborRelations: string;
    leaderAssigned: string;
    other: string;
  };
  aiPolished: boolean;
}

/** 归档数据 */
export interface Archive {
  weeks: Record<string, WeekEntry>;
  months: Record<string, MonthEntry>;
  years: Record<string, YearEntry>;
}

/** 年度计划章节 */
export interface AnnualPlanSection {
  title: string;
  source: string;
  goals: string[];
}

/** 年度计划 */
export interface AnnualPlan {
  year: number;
  sections: AnnualPlanSection[];
}

/** 设置 */
export interface Settings {
  weeklySummaryDay: number; // 1-7, 1=周一
  monthlySummaryDay: number; // 1-28
  aiPolishFlag: boolean;
  categories: string[];
  annualPlan?: AnnualPlan;
}

/** data.json 顶层结构 */
export interface DataJson {
  version: number;
  lastModified: string; // ISO8601
  settings: Settings;
  projects: Project[];
  tasks: Task[];
  archives: Archive;
}

// ============================================================
// 默认数据工厂
// ============================================================

export const DEFAULT_CATEGORIES: string[] = [
  '人员调配',
  '内部招聘',
  '奖惩管理',
  '绩效管理',
  '劳动关系',
  '领导交办',
  '其他',
];

export function createDefaultDataJson(): DataJson {
  return {
    version: 1,
    lastModified: new Date().toISOString(),
    settings: {
      weeklySummaryDay: 5, // 周五
      monthlySummaryDay: 28,
      aiPolishFlag: false,
      categories: [...DEFAULT_CATEGORIES],
    },
    projects: [],
    tasks: [],
    archives: {
      weeks: {},
      months: {},
      years: {},
    },
  };
}

// ============================================================
// 运行时校验（用于测试接缝）
// ============================================================

const VALID_PRIORITIES: readonly string[] = ['urgent', 'important', 'normal'];
const VALID_TASK_STATUSES: readonly string[] = [
  'todo',
  'in-progress',
  'done',
  'cancelled',
];
const VALID_PROJECT_STATUSES: readonly string[] = [
  'in-progress',
  'completed',
  'archived',
];

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function fail(path: string, msg: string): string {
  return `${path}: ${msg}`;
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}
function isNumber(v: unknown): v is number {
  return typeof v === 'number';
}
function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean';
}
function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}
function isNull(v: unknown): v is null {
  return v === null;
}
function isStringOrNull(v: unknown): v is string | null {
  return isString(v) || isNull(v);
}

function validateTask(task: unknown, idx: number, errors: string[]): void {
  const p = `tasks[${idx}]`;
  if (!isObject(task)) {
    errors.push(fail(p, 'must be an object'));
    return;
  }
  if (!isString(task.id)) errors.push(fail(p + '.id', 'must be a string'));
  if (!isStringOrNull(task.projectId))
    errors.push(fail(p + '.projectId', 'must be string or null'));
  if (!isString(task.title))
    errors.push(fail(p + '.title', 'must be a string'));
  if (!isString(task.category))
    errors.push(fail(p + '.category', 'must be a string'));
  if (!VALID_PRIORITIES.includes(task.priority as string))
    errors.push(
      fail(p + '.priority', `must be one of ${VALID_PRIORITIES.join(', ')}`),
    );
  if (!VALID_TASK_STATUSES.includes(task.status as string))
    errors.push(
      fail(
        p + '.status',
        `must be one of ${VALID_TASK_STATUSES.join(', ')}`,
      ),
    );
  if (!isString(task.createdDate))
    errors.push(fail(p + '.createdDate', 'must be a string'));
  if (!isString(task.updatedDate))
    errors.push(fail(p + '.updatedDate', 'must be a string'));
  if (!isStringOrNull(task.deadline))
    errors.push(fail(p + '.deadline', 'must be string or null'));
  if (!isStringOrNull(task.completedDate))
    errors.push(fail(p + '.completedDate', 'must be string or null'));
  if (!isArray(task.quantities))
    errors.push(fail(p + '.quantities', 'must be an array'));
  if (!isArray(task.subtasks))
    errors.push(fail(p + '.subtasks', 'must be an array'));
  if (!isString(task.notes)) errors.push(fail(p + '.notes', 'must be a string'));
  if (!isBoolean(task.isLeaderAssigned))
    errors.push(fail(p + '.isLeaderAssigned', 'must be a boolean'));
  if (!isBoolean(task.isCrossYear))
    errors.push(fail(p + '.isCrossYear', 'must be a boolean'));
  if (!isBoolean(task.isBlocked))
    errors.push(fail(p + '.isBlocked', 'must be a boolean'));
  // optional fields
  if (task.leaderSource !== undefined && !isString(task.leaderSource))
    errors.push(fail(p + '.leaderSource', 'must be a string if present'));
  if (task.leaderAssignedDate !== undefined && !isString(task.leaderAssignedDate))
    errors.push(fail(p + '.leaderAssignedDate', 'must be a string if present'));
  if (task.leaderDeadline !== undefined && !isString(task.leaderDeadline))
    errors.push(fail(p + '.leaderDeadline', 'must be a string if present'));
  if (task.hibernateUntil !== undefined && !isString(task.hibernateUntil))
    errors.push(fail(p + '.hibernateUntil', 'must be a string if present'));
}

function validateProject(
  project: unknown,
  idx: number,
  errors: string[],
): void {
  const p = `projects[${idx}]`;
  if (!isObject(project)) {
    errors.push(fail(p, 'must be an object'));
    return;
  }
  if (!isString(project.id)) errors.push(fail(p + '.id', 'must be a string'));
  if (!isString(project.title))
    errors.push(fail(p + '.title', 'must be a string'));
  if (!isString(project.category))
    errors.push(fail(p + '.category', 'must be a string'));
  if (!VALID_PROJECT_STATUSES.includes(project.status as string))
    errors.push(
      fail(
        p + '.status',
        `must be one of ${VALID_PROJECT_STATUSES.join(', ')}`,
      ),
    );
  if (!isString(project.startDate))
    errors.push(fail(p + '.startDate', 'must be a string'));
  if (!isString(project.targetDate))
    errors.push(fail(p + '.targetDate', 'must be a string'));
  if (!isString(project.notes))
    errors.push(fail(p + '.notes', 'must be a string'));
  if (!isObject(project.subtaskCount))
    errors.push(fail(p + '.subtaskCount', 'must be an object'));
  else {
    if (!isNumber(project.subtaskCount.total))
      errors.push(fail(p + '.subtaskCount.total', 'must be a number'));
    if (!isNumber(project.subtaskCount.done))
      errors.push(fail(p + '.subtaskCount.done', 'must be a number'));
  }
}

function validateSettings(settings: unknown, errors: string[]): void {
  const p = 'settings';
  if (!isObject(settings)) {
    errors.push(fail(p, 'must be an object'));
    return;
  }
  if (!isNumber(settings.weeklySummaryDay))
    errors.push(fail(p + '.weeklySummaryDay', 'must be a number'));
  if (!isNumber(settings.monthlySummaryDay))
    errors.push(fail(p + '.monthlySummaryDay', 'must be a number'));
  if (!isBoolean(settings.aiPolishFlag))
    errors.push(fail(p + '.aiPolishFlag', 'must be a boolean'));
  if (!isArray(settings.categories))
    errors.push(fail(p + '.categories', 'must be an array'));
}

export function validateDataJson(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isObject(data)) {
    errors.push('root: must be an object');
    return { valid: false, errors };
  }

  if (!isNumber(data.version))
    errors.push('version: must be a number');
  if (!isString(data.lastModified))
    errors.push('lastModified: must be a string');

  validateSettings(data.settings, errors);

  if (!isArray(data.tasks))
    errors.push('tasks: must be an array');
  else
    (data.tasks as unknown[]).forEach((t, i) => validateTask(t, i, errors));

  if (!isArray(data.projects))
    errors.push('projects: must be an array');
  else
    (data.projects as unknown[]).forEach((p, i) =>
      validateProject(p, i, errors),
    );

  if (!isObject(data.archives))
    errors.push('archives: must be an object');

  return { valid: errors.length === 0, errors };
}
