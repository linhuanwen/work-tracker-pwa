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
  /** 与父任务保持一致的可选扩展字段 */
  notes?: string;
  deadline?: string | null;
  priority?: Priority;
  quantities?: Quantity[];
  category?: string;
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
  revision: number; // 数据修改计数：每次保存 +1，用于多设备冲突检测
  lastModified: string; // ISO8601
  settings: Settings;
  projects: Project[];
  tasks: Task[];
  archives: Archive;
}

// ============================================================
// 默认数据工厂
// ============================================================

/** data.json 当前 schema 版本。升级 schema 时递增，并在 migrateDataJson 中补迁移逻辑。 */
export const DATA_VERSION = 1;

export const DEFAULT_CATEGORIES: string[] = [
  '人员调配',
  '内部招聘',
  '奖惩管理',
  '绩效管理',
  '劳动关系',
  '交办事项',
  '其他',
];

export function createDefaultDataJson(): DataJson {
  return {
    version: DATA_VERSION,
    revision: 0,
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
  if (!isNumber(data.revision))
    errors.push('revision: must be a number');
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

// ============================================================
// 数据版本迁移 & 安全解析
// ============================================================

function normalizeStringOrNull(v: unknown): string | null {
  return isString(v) ? v : null;
}

function normalizeStringOptional(v: unknown): string | undefined {
  return isString(v) ? v : undefined;
}

function normalizeTask(raw: unknown): Record<string, unknown> {
  if (!isObject(raw)) return raw as Record<string, unknown>;
  const t = raw as Record<string, unknown>;
  const today = new Date().toISOString().slice(0, 10);
  const validPriority = (isString(t.priority) && VALID_PRIORITIES.includes(t.priority as Priority))
    ? t.priority
    : 'normal';
  const validStatus = (isString(t.status) && VALID_TASK_STATUSES.includes(t.status as TaskStatus))
    ? t.status
    : 'todo';
  return {
    ...t,
    projectId: normalizeStringOrNull(t.projectId),
    deadline: normalizeStringOrNull(t.deadline),
    completedDate: normalizeStringOrNull(t.completedDate),
    title: isString(t.title) ? t.title : '',
    category: isString(t.category) ? t.category : '',
    priority: validPriority,
    status: validStatus,
    createdDate: isString(t.createdDate) ? t.createdDate : today,
    updatedDate: isString(t.updatedDate) ? t.updatedDate : today,
    notes: isString(t.notes) ? t.notes : '',
    quantities: isArray(t.quantities) ? t.quantities : [],
    subtasks: isArray(t.subtasks) ? t.subtasks : [],
    isLeaderAssigned: isBoolean(t.isLeaderAssigned) ? t.isLeaderAssigned : false,
    isCrossYear: isBoolean(t.isCrossYear) ? t.isCrossYear : false,
    isBlocked: isBoolean(t.isBlocked) ? t.isBlocked : false,
    leaderSource: normalizeStringOptional(t.leaderSource),
    leaderAssignedDate: normalizeStringOptional(t.leaderAssignedDate),
    leaderDeadline: normalizeStringOptional(t.leaderDeadline),
    hibernateUntil: normalizeStringOptional(t.hibernateUntil),
  };
}

function normalizeProject(raw: unknown): Record<string, unknown> {
  if (!isObject(raw)) return raw as Record<string, unknown>;
  const p = raw as Record<string, unknown>;
  const subtaskCount = isObject(p.subtaskCount) ? p.subtaskCount : {};
  return {
    ...p,
    notes: isString(p.notes) ? p.notes : '',
    subtaskCount: {
      total: isNumber((subtaskCount as Record<string, unknown>).total)
        ? (subtaskCount as Record<string, unknown>).total
        : 0,
      done: isNumber((subtaskCount as Record<string, unknown>).done)
        ? (subtaskCount as Record<string, unknown>).done
        : 0,
    },
  };
}

function normalizeSettings(raw: unknown): Record<string, unknown> {
  if (!isObject(raw)) {
    return {
      weeklySummaryDay: 5,
      monthlySummaryDay: 28,
      aiPolishFlag: false,
      categories: [...DEFAULT_CATEGORIES],
    };
  }
  const s = raw as Record<string, unknown>;
  return {
    weeklySummaryDay: isNumber(s.weeklySummaryDay) ? s.weeklySummaryDay : 5,
    monthlySummaryDay: isNumber(s.monthlySummaryDay) ? s.monthlySummaryDay : 28,
    aiPolishFlag: isBoolean(s.aiPolishFlag) ? s.aiPolishFlag : false,
    categories: isArray(s.categories) ? s.categories : [...DEFAULT_CATEGORIES],
  };
}

/**
 * 将任意来源的 data.json 内容迁移到当前数据版本。
 *
 * - 非对象 → 抛错
 * - version 缺失 → 视为 1（项目自 v1 起步，早期文件可能缺少该字段）
 * - version 高于当前 → 抛错（数据由更新版本的应用写出，需先升级应用）
 * - version 低于当前 → 依次执行各版本迁移（当前无迁移，预留钩子）
 *
 * 迁移同时会做字段级补齐：缺失/类型错误的可选字段会被删除或设成默认值，
 * 缺失的必填字段会被补成安全的默认值，从而兼容由旧版本或手动编辑产生的 data.json。
 */
export function migrateDataJson(raw: unknown): DataJson {
  if (!isObject(raw)) {
    throw new Error('数据文件格式错误：根节点必须是对象');
  }

  // version 字段：缺失容忍（早期文件），存在但非数字视为损坏
  const rawVersion = raw.version;
  if (rawVersion !== undefined && typeof rawVersion !== 'number') {
    throw new Error('数据文件 version 字段类型错误，可能已损坏');
  }
  const version = typeof rawVersion === 'number' ? rawVersion : 1;
  if (version > DATA_VERSION) {
    throw new Error(
      `数据文件版本 ${version} 高于当前应用支持的版本 ${DATA_VERSION}，请升级应用后再打开`,
    );
  }

  const rawRecord = raw as Record<string, unknown>;
  const rawTasks = rawRecord.tasks;
  const rawProjects = rawRecord.projects;

  const data: Record<string, unknown> = {
    ...rawRecord,
    version: DATA_VERSION,
    // revision 缺失视为 0（老数据），后续保存时递增
    revision: typeof rawRecord.revision === 'number' ? rawRecord.revision : 0,
    settings: isObject(rawRecord.settings)
      ? normalizeSettings(rawRecord.settings)
      : rawRecord.settings,
    tasks: isArray(rawTasks) ? rawTasks.map(normalizeTask) : rawTasks,
    projects: isArray(rawProjects)
      ? rawProjects.map(normalizeProject)
      : rawProjects,
  };

  return data as unknown as DataJson;
}

/**
 * 解析 data.json 文本为 DataJson。
 *
 * 顺序：JSON.parse → migrateDataJson（版本迁移）→ validateDataJson（字段校验）。
 * 任一环节失败都会抛错，错误消息面向用户，可直接展示。
 */
export function parseDataJson(text: string): DataJson {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('数据文件不是有效的 JSON，可能已损坏');
  }

  const migrated = migrateDataJson(parsed);
  const result = validateDataJson(migrated);
  if (!result.valid) {
    throw new Error(
      `数据文件内容不完整或已损坏：${result.errors.slice(0, 3).join('；')}`,
    );
  }
  return migrated;
}
