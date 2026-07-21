import type { Task, Priority, TaskStatus } from './types';

/** 排除 cancelled 状态的任务 */
export function filterActiveTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.status !== 'cancelled');
}

/** 只保留 cancelled 状态的任务 */
export function filterCancelledTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.status === 'cancelled');
}

/** 按优先级分组 */
export interface PriorityGroups {
  urgent: Task[];
  important: Task[];
  normal: Task[];
}

export function groupTasksByPriority(tasks: Task[]): PriorityGroups {
  return {
    urgent: tasks.filter((t) => t.priority === 'urgent'),
    important: tasks.filter((t) => t.priority === 'important'),
    normal: tasks.filter((t) => t.priority === 'normal'),
  };
}

const PRIORITY_ORDER: Record<Priority, number> = {
  urgent: 0,
  important: 1,
  normal: 2,
};

/** 按优先级排序：urgent > important > normal */
export function sortTasksByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
  );
}

/** 格式化 ISO 日期为 "M月D日"（字符串解析，避免时区偏移） */
export function formatDate(date: string | null): string {
  if (!date) return '';
  const parts = date.split('-');
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  return `${month}月${day}日`;
}

/** 状态流转：通用的任务状态切换（不可变，返回新对象） */
export function transitionTaskStatus(task: Task, target: TaskStatus): Task {
  if (task.status === target) return task;

  const today = new Date().toISOString().slice(0, 10);

  // completedDate logic: set when transitioning TO done, clear when leaving done
  let completedDate = task.completedDate;
  if (target === 'done') {
    completedDate = today;
  } else if (task.status === 'done' && target !== 'cancelled') {
    completedDate = null;
  }
  // When transitioning from done to cancelled, keep completedDate
  // When transitioning from non-done to cancelled, keep current completedDate (usually null)

  return {
    ...task,
    status: target,
    completedDate,
    updatedDate: today,
  };
}

/** 切换任务完成状态（不可变，返回新对象）——便捷封装 */
export function toggleTaskStatus(task: Task): Task {
  const isCurrentlyDone = task.status === 'done';
  return transitionTaskStatus(task, isCurrentlyDone ? 'todo' : 'done');
}

/** 任务编辑：部分字段更新（不可变） */
export interface UpdateTaskPatch {
  title?: string;
  category?: string;
  priority?: Priority;
  deadline?: string | null;
  notes?: string;
  quantities?: Task['quantities'];
  subtasks?: Task['subtasks'];
  projectId?: string | null;
  isLeaderAssigned?: boolean;
  leaderSource?: string;
  leaderAssignedDate?: string;
  leaderDeadline?: string;
  isCrossYear?: boolean;
  isBlocked?: boolean;
  hibernateUntil?: string | null;
}

export function updateTask(task: Task, patch: UpdateTaskPatch): Task {
  if (Object.keys(patch).length === 0) return task;
  const today = new Date().toISOString().slice(0, 10);
  return { ...task, ...patch, updatedDate: today } as Task;
}

/** 紧急区上限逻辑：最多保留 5 条 urgent，超出的降为 important */
export interface LimitUrgentResult {
  tasks: Task[];
  demotedIds: string[];
}

export function limitUrgentTasks(tasks: Task[]): LimitUrgentResult {
  const URGENT_MAX = 5;

  // Find active urgent tasks (order-preserving)
  const urgentTasks = tasks.filter(
    (t) => t.priority === 'urgent' && t.status !== 'cancelled',
  );

  if (urgentTasks.length <= URGENT_MAX) {
    return { tasks: tasks.map((t) => ({ ...t })), demotedIds: [] };
  }

  // Demote excess urgent tasks to important
  const demotedIds = urgentTasks.slice(URGENT_MAX).map((t) => t.id);
  const demotedSet = new Set(demotedIds);

  const updatedTasks = tasks.map((t) => {
    if (demotedSet.has(t.id)) {
      return { ...t, priority: 'important' as Priority };
    }
    return { ...t };
  });

  return { tasks: updatedTasks, demotedIds };
}

/** 创建新任务 */
export interface CreateTaskInput {
  title: string;
  category: string;
  priority: Priority;
  projectId?: string | null;
  deadline?: string | null;
  notes?: string;
}

let _idCounter = 0;

function generateId(): string {
  _idCounter += 1;
  return `t-${Date.now().toString(36)}-${_idCounter.toString(36)}`;
}

export function createTask(input: CreateTaskInput): Task {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: generateId(),
    projectId: input.projectId ?? null,
    title: input.title,
    category: input.category,
    priority: input.priority,
    status: 'todo',
    createdDate: today,
    updatedDate: today,
    deadline: input.deadline ?? null,
    completedDate: null,
    quantities: [],
    subtasks: [],
    notes: input.notes ?? '',
    isLeaderAssigned: false,
    isCrossYear: false,
    isBlocked: false,
  };
}

// ============================================================
// 跨年休眠
// ============================================================

/** 休眠过滤结果 */
export interface HibernateFilterResult {
  active: Task[];
  hibernating: Task[];
}

/**
 * 按休眠状态拆分任务列表。
 * 休眠条件：isCrossYear 为 true 且 hibernateUntil 日期在未来。
 * @param tasks 全部任务
 * @param now 参考时间，默认当前时间
 */
export function filterHibernatingTasks(
  tasks: Task[],
  now?: Date,
): HibernateFilterResult {
  const reference = now ?? new Date();
  const today = reference.toISOString().slice(0, 10);

  const active: Task[] = [];
  const hibernating: Task[] = [];

  for (const task of tasks) {
    if (
      task.isCrossYear &&
      task.hibernateUntil &&
      task.hibernateUntil > today
    ) {
      hibernating.push(task);
    } else {
      active.push(task);
    }
  }

  return { active, hibernating };
}

/**
 * 计算默认休眠截止日期：deadline 前 60 天。
 * 如果 deadline 为空，返回 null。
 */
/** 计算子任务进度 */
export interface SubtaskProgress {
  total: number;
  done: number;
  percent: number;
}

export function calcSubtaskProgress(
  subtasks: { id: string; status: 'todo' | 'done' }[],
): SubtaskProgress {
  const total = subtasks.length;
  if (total === 0) return { total: 0, done: 0, percent: 0 };
  const done = subtasks.filter((s) => s.status === 'done').length;
  const percent = Math.floor((done / total) * 100);
  return { total, done, percent };
}

/** 根据进度百分比返回颜色 */
export function getProgressColor(percent: number): string {
  if (percent === 100) return '#4caf50';  // 绿色
  if (percent >= 67) return '#2196f3';    // 蓝色
  if (percent >= 34) return '#fb8c00';    // 黄色
  return '#e53935';                        // 红色 (0-33)
}

// ============================================================
// 子任务 CRUD helpers
// ============================================================

let _subIdCounter = 0;

function generateSubId(): string {
  _subIdCounter += 1;
  return `s-${Date.now().toString(36)}-${_subIdCounter.toString(36)}`;
}

/** 添加子任务（返回新数组） */
export function addSubtask(
  subtasks: { id: string; title: string; status: 'todo' | 'done' }[],
  title: string,
): { id: string; title: string; status: 'todo' | 'done' }[] {
  const newSub: { id: string; title: string; status: 'todo' | 'done' } = {
    id: generateSubId(),
    title: title.trim(),
    status: 'todo',
  };
  return [...subtasks, newSub];
}

/** 切换子任务勾选状态（返回新数组），id 不存在则返回原数组 */
export function toggleSubtask(
  subtasks: { id: string; title: string; status: 'todo' | 'done' }[],
  id: string,
): { id: string; title: string; status: 'todo' | 'done' }[] {
  const idx = subtasks.findIndex((s) => s.id === id);
  if (idx === -1) return subtasks;
  const updated = [...subtasks];
  updated[idx] = {
    ...updated[idx],
    status: updated[idx].status === 'done' ? 'todo' : 'done',
  };
  return updated;
}

/** 删除子任务（返回新数组），id 不存在则返回原数组 */
export function deleteSubtask(
  subtasks: { id: string; title: string; status: 'todo' | 'done' }[],
  id: string,
): { id: string; title: string; status: 'todo' | 'done' }[] {
  const idx = subtasks.findIndex((s) => s.id === id);
  if (idx === -1) return subtasks;
  return subtasks.filter((s) => s.id !== id);
}

// ============================================================
// 项目进度汇总
// ============================================================

export interface ProjectProgress {
  total: number;
  done: number;
}

/** 汇总项目下所有任务的子任务进度（排除 cancelled 状态的任务） */
export function calcProjectProgress(tasks: Task[]): ProjectProgress {
  let total = 0;
  let done = 0;
  for (const task of tasks) {
    if (task.status === 'cancelled') continue;
    for (const sub of task.subtasks) {
      total += 1;
      if (sub.status === 'done') done += 1;
    }
  }
  return { total, done };
}

// ============================================================
// 父任务确认完成
// ============================================================

/** 手动确认父任务完成。task 已为 done 时返回原对象（幂等）。 */
export function confirmTaskDone(task: Task): Task {
  if (task.status === 'done') return task;
  const today = new Date().toISOString().slice(0, 10);
  return {
    ...task,
    status: 'done',
    completedDate: today,
    updatedDate: today,
  };
}

export function calcDefaultHibernateUntil(deadline: string | null): string | null {
  if (!deadline) return null;
  const d = new Date(deadline);
  d.setDate(d.getDate() - 60);
  return d.toISOString().slice(0, 10);
}
