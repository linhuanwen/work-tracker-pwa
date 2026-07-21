import { describe, it, expect } from 'vitest';
import type { Task, SubTask } from '../types';
import {
  filterActiveTasks,
  groupTasksByPriority,
  createTask,
  transitionTaskStatus,
  updateTask,
  formatDate,
  filterCancelledTasks,
  sortTasksByPriority,
  limitUrgentTasks,
  filterHibernatingTasks,
  calcDefaultHibernateUntil,
  calcSubtaskProgress,
  getProgressColor,
  addSubtask,
  toggleSubtask,
  deleteSubtask,
  calcProjectProgress,
  confirmTaskDone,
} from '../taskUtils';

/**
 * Seam 2: Data transformation logic
 *
 * Pure functions that transform task data — filtering, grouping,
 * sorting. The primary seam is the data.json type boundary.
 */

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't-1',
    projectId: null,
    title: '测试任务',
    category: '其他',
    priority: 'normal',
    status: 'todo',
    createdDate: '2026-07-21',
    updatedDate: '2026-07-21',
    deadline: null,
    completedDate: null,
    quantities: [],
    subtasks: [],
    notes: '',
    isLeaderAssigned: false,
    isCrossYear: false,
    isBlocked: false,
    ...overrides,
  } as Task;
}

describe('filterActiveTasks', () => {
  it('excludes cancelled tasks', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', status: 'todo' }),
      makeTask({ id: '2', status: 'cancelled' }),
      makeTask({ id: '3', status: 'done' }),
      makeTask({ id: '4', status: 'in-progress' }),
    ];
    const result = filterActiveTasks(tasks);
    expect(result).toHaveLength(3);
    expect(result.map((t) => t.id)).toEqual(['1', '3', '4']);
  });

  it('returns empty array for empty input', () => {
    expect(filterActiveTasks([])).toEqual([]);
  });

  it('returns empty array when all tasks are cancelled', () => {
    const tasks = [
      makeTask({ id: '1', status: 'cancelled' }),
      makeTask({ id: '2', status: 'cancelled' }),
    ];
    expect(filterActiveTasks(tasks)).toHaveLength(0);
  });
});

describe('groupTasksByPriority', () => {
  it('groups tasks into urgent > important > normal buckets', () => {
    const tasks: Task[] = [
      makeTask({ id: 'n1', priority: 'normal' }),
      makeTask({ id: 'u1', priority: 'urgent' }),
      makeTask({ id: 'i1', priority: 'important' }),
      makeTask({ id: 'u2', priority: 'urgent' }),
      makeTask({ id: 'n2', priority: 'normal' }),
    ];
    const groups = groupTasksByPriority(tasks);
    expect(groups.urgent).toHaveLength(2);
    expect(groups.important).toHaveLength(1);
    expect(groups.normal).toHaveLength(2);
    expect(groups.urgent.map((t) => t.id)).toEqual(['u1', 'u2']);
    expect(groups.important.map((t) => t.id)).toEqual(['i1']);
    expect(groups.normal.map((t) => t.id)).toEqual(['n1', 'n2']);
  });

  it('returns empty buckets for empty input', () => {
    const groups = groupTasksByPriority([]);
    expect(groups.urgent).toEqual([]);
    expect(groups.important).toEqual([]);
    expect(groups.normal).toEqual([]);
  });
});

describe('sortTasksByPriority', () => {
  it('sorts by priority: urgent first, then important, then normal', () => {
    const tasks: Task[] = [
      makeTask({ id: 'n', priority: 'normal' }),
      makeTask({ id: 'i', priority: 'important' }),
      makeTask({ id: 'u', priority: 'urgent' }),
    ];
    const sorted = sortTasksByPriority(tasks);
    expect(sorted.map((t) => t.id)).toEqual(['u', 'i', 'n']);
  });
});

// ============================================================
// Seam A: 状态流转 — transitionTaskStatus
// ============================================================

describe('transitionTaskStatus', () => {
  const today = new Date().toISOString().slice(0, 10);

  it('transitions todo → in-progress (no date change)', () => {
    const task = makeTask({ status: 'todo', completedDate: null });
    const result = transitionTaskStatus(task, 'in-progress');
    expect(result.status).toBe('in-progress');
    expect(result.completedDate).toBeNull();
  });

  it('transitions todo → done and sets completedDate', () => {
    const task = makeTask({ status: 'todo', completedDate: null });
    const result = transitionTaskStatus(task, 'done');
    expect(result.status).toBe('done');
    expect(result.completedDate).toBe(today);
  });

  it('transitions in-progress → done and sets completedDate', () => {
    const task = makeTask({ status: 'in-progress', completedDate: null });
    const result = transitionTaskStatus(task, 'done');
    expect(result.status).toBe('done');
    expect(result.completedDate).toBe(today);
  });

  it('transitions in-progress → todo (no date change)', () => {
    const task = makeTask({ status: 'in-progress', completedDate: null });
    const result = transitionTaskStatus(task, 'todo');
    expect(result.status).toBe('todo');
    expect(result.completedDate).toBeNull();
  });

  it('transitions done → todo and clears completedDate', () => {
    const task = makeTask({ status: 'done', completedDate: '2026-07-20' });
    const result = transitionTaskStatus(task, 'todo');
    expect(result.status).toBe('todo');
    expect(result.completedDate).toBeNull();
  });

  it('transitions any status → cancelled (keeps completedDate if was done)', () => {
    const doneTask = makeTask({ status: 'done', completedDate: '2026-07-20' });
    const result = transitionTaskStatus(doneTask, 'cancelled');
    expect(result.status).toBe('cancelled');
    expect(result.completedDate).toBe('2026-07-20');
  });

  it('transitions any status → cancelled (completedDate stays null if not done)', () => {
    const todoTask = makeTask({ status: 'todo', completedDate: null });
    const result = transitionTaskStatus(todoTask, 'cancelled');
    expect(result.status).toBe('cancelled');
    expect(result.completedDate).toBeNull();
  });

  it('transitions cancelled → todo to unarchive', () => {
    const task = makeTask({ status: 'cancelled', completedDate: null });
    const result = transitionTaskStatus(task, 'todo');
    expect(result.status).toBe('todo');
    expect(result.completedDate).toBeNull();
  });

  it('returns new object (immutability)', () => {
    const task = makeTask({ status: 'todo' });
    const result = transitionTaskStatus(task, 'in-progress');
    expect(result).not.toBe(task);
  });

  it('no-op when status unchanged', () => {
    const task = makeTask({ status: 'todo' });
    const result = transitionTaskStatus(task, 'todo');
    expect(result).toBe(task);
  });

  it('sets updatedDate to today when status changes', () => {
    const today = new Date().toISOString().slice(0, 10);
    const task = makeTask({ status: 'todo', updatedDate: '2026-07-01' });
    const result = transitionTaskStatus(task, 'in-progress');
    expect(result.updatedDate).toBe(today);
  });
});

// ============================================================
// Seam B: 任务编辑 — updateTask
// ============================================================

describe('updateTask', () => {
  it('updates editable fields: title, category, priority, deadline, notes, quantities', () => {
    const task = makeTask();
    const result = updateTask(task, {
      title: '新标题',
      category: '绩效管理',
      priority: 'urgent',
      deadline: '2026-08-01',
      notes: '备注内容',
      quantities: [{ label: '面试', value: 5, unit: '人' }],
    });
    expect(result.title).toBe('新标题');
    expect(result.category).toBe('绩效管理');
    expect(result.priority).toBe('urgent');
    expect(result.deadline).toBe('2026-08-01');
    expect(result.notes).toBe('备注内容');
    expect(result.quantities).toEqual([{ label: '面试', value: 5, unit: '人' }]);
  });

  it('preserves createdDate', () => {
    const task = makeTask({ createdDate: '2026-01-15' });
    const result = updateTask(task, { title: '改标题' });
    expect(result.createdDate).toBe('2026-01-15');
  });

  it('preserves id, status, completedDate, and other non-edited fields', () => {
    const task = makeTask({
      id: 't-special',
      status: 'done',
      completedDate: '2026-07-20',
      isLeaderAssigned: true,
      subtasks: [{ id: 's1', title: '子任务', status: 'done' }],
    });
    const result = updateTask(task, { title: 'updated' });
    expect(result.id).toBe('t-special');
    expect(result.status).toBe('done');
    expect(result.completedDate).toBe('2026-07-20');
    expect(result.isLeaderAssigned).toBe(true);
    expect(result.subtasks).toEqual([{ id: 's1', title: '子任务', status: 'done' }]);
  });

  it('partial update — only changes specified fields', () => {
    const task = makeTask({ title: '原标题', category: '其他', priority: 'normal' });
    const result = updateTask(task, { priority: 'urgent' });
    expect(result.title).toBe('原标题');
    expect(result.category).toBe('其他');
    expect(result.priority).toBe('urgent');
  });

  it('returns new object (immutability)', () => {
    const task = makeTask();
    const result = updateTask(task, { title: 'changed' });
    expect(result).not.toBe(task);
  });

  it('empty patch returns same task', () => {
    const task = makeTask();
    const result = updateTask(task, {});
    expect(result).toBe(task);
  });

  it('sets updatedDate to today when patch has changes', () => {
    const today = new Date().toISOString().slice(0, 10);
    const task = makeTask({ updatedDate: '2026-07-01' });
    const result = updateTask(task, { title: 'changed' });
    expect(result.updatedDate).toBe(today);
  });
});

// ============================================================
// Seam C: 日期格式化 — formatDate
// ============================================================

describe('formatDate', () => {
  it('formats ISO date string to "M月D日"', () => {
    expect(formatDate('2026-07-20')).toBe('7月20日');
  });

  it('keeps leading zeros removed for month and day', () => {
    expect(formatDate('2026-01-05')).toBe('1月5日');
  });

  it('returns "12月31日" for year-end', () => {
    expect(formatDate('2026-12-31')).toBe('12月31日');
  });

  it('returns empty string for null', () => {
    expect(formatDate(null)).toBe('');
  });
});

// ============================================================
// Seam D: 归档过滤 — filterCancelledTasks
// ============================================================

describe('filterCancelledTasks', () => {
  it('returns only cancelled tasks', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', status: 'todo' }),
      makeTask({ id: '2', status: 'cancelled' }),
      makeTask({ id: '3', status: 'done' }),
      makeTask({ id: '4', status: 'cancelled' }),
    ];
    const result = filterCancelledTasks(tasks);
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(['2', '4']);
  });

  it('returns empty array when no tasks are cancelled', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', status: 'todo' }),
      makeTask({ id: '2', status: 'done' }),
    ];
    expect(filterCancelledTasks(tasks)).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(filterCancelledTasks([])).toEqual([]);
  });
});

// ============================================================
// Existing: createTask
// ============================================================

describe('createTask', () => {
  it('creates a task with required fields and auto-generated id + createdDate', () => {
    const newTask = createTask({
      title: '新任务',
      category: '绩效管理',
      priority: 'important',
    });
    expect(newTask.id).toMatch(/^t-/);
    expect(newTask.title).toBe('新任务');
    expect(newTask.category).toBe('绩效管理');
    expect(newTask.priority).toBe('important');
    expect(newTask.status).toBe('todo');
    expect(newTask.createdDate).toBeTruthy();
    expect(newTask.projectId).toBeNull();
    expect(newTask.deadline).toBeNull();
    expect(newTask.completedDate).toBeNull();
    expect(newTask.quantities).toEqual([]);
    expect(newTask.subtasks).toEqual([]);
    expect(newTask.notes).toBe('');
    expect(newTask.isLeaderAssigned).toBe(false);
    expect(newTask.isCrossYear).toBe(false);
    expect(newTask.isBlocked).toBe(false);
    expect(newTask.updatedDate).toBeTruthy();
  });

  it('initializes updatedDate to today', () => {
    const today = new Date().toISOString().slice(0, 10);
    const task = createTask({
      title: 'test',
      category: '其他',
      priority: 'normal',
    });
    expect(task.updatedDate).toBe(today);
  });

  it('generates unique IDs', () => {
    const a = createTask({ title: 'a', category: '其他', priority: 'normal' });
    const b = createTask({ title: 'b', category: '其他', priority: 'normal' });
    expect(a.id).not.toBe(b.id);
  });

  it('uses today as createdDate', () => {
    const today = new Date().toISOString().slice(0, 10);
    const task = createTask({
      title: 'test',
      category: '其他',
      priority: 'normal',
    });
    expect(task.createdDate).toBe(today);
  });
});

// ============================================================
// Existing: limitUrgentTasks
// ============================================================

describe('limitUrgentTasks', () => {
  it('keeps up to 5 urgent tasks unchanged', () => {
    const tasks: Task[] = [
      makeTask({ id: 'u1', priority: 'urgent' }),
      makeTask({ id: 'u2', priority: 'urgent' }),
      makeTask({ id: 'u3', priority: 'urgent' }),
      makeTask({ id: 'u4', priority: 'urgent' }),
      makeTask({ id: 'u5', priority: 'urgent' }),
    ];
    const result = limitUrgentTasks(tasks);
    expect(result.tasks.filter((t) => t.priority === 'urgent')).toHaveLength(5);
    expect(result.demotedIds).toHaveLength(0);
  });

  it('demotes 6th+ urgent task to important and returns its id', () => {
    const tasks: Task[] = [
      makeTask({ id: 'u1', priority: 'urgent' }),
      makeTask({ id: 'u2', priority: 'urgent' }),
      makeTask({ id: 'u3', priority: 'urgent' }),
      makeTask({ id: 'u4', priority: 'urgent' }),
      makeTask({ id: 'u5', priority: 'urgent' }),
      makeTask({ id: 'u6', priority: 'urgent' }),
    ];
    const result = limitUrgentTasks(tasks);
    const urgent = result.tasks.filter((t) => t.priority === 'urgent');
    expect(urgent).toHaveLength(5);
    expect(urgent.map((t) => t.id)).toEqual(['u1', 'u2', 'u3', 'u4', 'u5']);
    expect(result.demotedIds).toEqual(['u6']);
    const demoted = result.tasks.find((t) => t.id === 'u6');
    expect(demoted?.priority).toBe('important');
  });

  it('demotes all excess urgent tasks and returns all demoted ids', () => {
    const tasks: Task[] = [
      makeTask({ id: 'u1', priority: 'urgent' }),
      makeTask({ id: 'u2', priority: 'urgent' }),
      makeTask({ id: 'u3', priority: 'urgent' }),
      makeTask({ id: 'u4', priority: 'urgent' }),
      makeTask({ id: 'u5', priority: 'urgent' }),
      makeTask({ id: 'u6', priority: 'urgent' }),
      makeTask({ id: 'u7', priority: 'urgent' }),
      makeTask({ id: 'u8', priority: 'urgent' }),
    ];
    const result = limitUrgentTasks(tasks);
    expect(result.tasks.filter((t) => t.priority === 'urgent')).toHaveLength(5);
    expect(result.demotedIds).toEqual(['u6', 'u7', 'u8']);
    result.demotedIds.forEach((id) => {
      const t = result.tasks.find((tk) => tk.id === id);
      expect(t?.priority).toBe('important');
    });
  });

  it('does not demote if exactly 5 urgent tasks', () => {
    const tasks: Task[] = [
      makeTask({ id: 'u1', priority: 'urgent' }),
      makeTask({ id: 'u2', priority: 'urgent' }),
      makeTask({ id: 'u3', priority: 'urgent' }),
      makeTask({ id: 'u4', priority: 'urgent' }),
      makeTask({ id: 'u5', priority: 'urgent' }),
      makeTask({ id: 'i1', priority: 'important' }),
      makeTask({ id: 'n1', priority: 'normal' }),
    ];
    const result = limitUrgentTasks(tasks);
    expect(result.demotedIds).toHaveLength(0);
    expect(result.tasks).toHaveLength(7);
  });

  it('skips cancelled tasks when counting urgent limit', () => {
    const tasks: Task[] = [
      makeTask({ id: 'u1', priority: 'urgent' }),
      makeTask({ id: 'u2', priority: 'urgent', status: 'cancelled' }),
      makeTask({ id: 'u3', priority: 'urgent' }),
      makeTask({ id: 'u4', priority: 'urgent' }),
      makeTask({ id: 'u5', priority: 'urgent' }),
      makeTask({ id: 'u6', priority: 'urgent' }),
    ];
    const result = limitUrgentTasks(tasks);
    expect(result.demotedIds).toHaveLength(0);
    expect(result.tasks.filter((t) => t.priority === 'urgent' && t.status !== 'cancelled')).toHaveLength(5);
  });

  it('returns empty demotedIds for empty task list', () => {
    const result = limitUrgentTasks([]);
    expect(result.tasks).toEqual([]);
    expect(result.demotedIds).toEqual([]);
  });

  it('returns new array (immutability)', () => {
    const tasks: Task[] = [
      makeTask({ id: 'u1', priority: 'urgent' }),
      makeTask({ id: 'u2', priority: 'urgent' }),
      makeTask({ id: 'u3', priority: 'urgent' }),
      makeTask({ id: 'u4', priority: 'urgent' }),
      makeTask({ id: 'u5', priority: 'urgent' }),
      makeTask({ id: 'u6', priority: 'urgent' }),
    ];
    const result = limitUrgentTasks(tasks);
    expect(result.tasks).not.toBe(tasks);
    // Demoted task (u6) is a new object
    const demoted = result.tasks.find((t) => t.id === 'u6');
    const original = tasks.find((t) => t.id === 'u6');
    expect(demoted).not.toBe(original);
    expect(demoted?.priority).toBe('important');
  });
});

// ============================================================
// Seam E: 跨年休眠过滤 — filterHibernatingTasks
// ============================================================

describe('filterHibernatingTasks', () => {
  const futureDate = '2027-06-01';
  const pastDate = '2025-01-01';

  it('puts task with future hibernateUntil into hibernating bucket', () => {
    const task = makeTask({
      isCrossYear: true,
      hibernateUntil: futureDate,
    });
    const result = filterHibernatingTasks([task], new Date('2026-07-21'));
    expect(result.active).toHaveLength(0);
    expect(result.hibernating).toHaveLength(1);
    expect(result.hibernating[0].id).toBe(task.id);
  });

  it('puts task with past hibernateUntil into active bucket', () => {
    const task = makeTask({
      isCrossYear: true,
      hibernateUntil: pastDate,
    });
    const result = filterHibernatingTasks([task], new Date('2026-07-21'));
    expect(result.active).toHaveLength(1);
    expect(result.hibernating).toHaveLength(0);
  });

  it('puts task without hibernateUntil into active bucket', () => {
    const task = makeTask({
      isCrossYear: true,
      hibernateUntil: undefined,
    });
    const result = filterHibernatingTasks([task], new Date('2026-07-21'));
    expect(result.active).toHaveLength(1);
    expect(result.hibernating).toHaveLength(0);
  });

  it('puts task with isCrossYear=false into active bucket even with future hibernateUntil', () => {
    const task = makeTask({
      isCrossYear: false,
      hibernateUntil: futureDate,
    });
    const result = filterHibernatingTasks([task], new Date('2026-07-21'));
    expect(result.active).toHaveLength(1);
    expect(result.hibernating).toHaveLength(0);
  });

  it('handles mixed tasks correctly', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', isCrossYear: true, hibernateUntil: futureDate }),
      makeTask({ id: '2', isCrossYear: true, hibernateUntil: pastDate }),
      makeTask({ id: '3', isCrossYear: false }),
      makeTask({ id: '4', isCrossYear: true, hibernateUntil: '2027-12-31' }),
    ];
    const result = filterHibernatingTasks(tasks, new Date('2026-07-21'));
    expect(result.active.map((t) => t.id)).toEqual(['2', '3']);
    expect(result.hibernating.map((t) => t.id)).toEqual(['1', '4']);
  });

  it('treats hibernateUntil equal to today as active (not hibernating)', () => {
    const task = makeTask({
      isCrossYear: true,
      hibernateUntil: '2026-07-21',
    });
    const result = filterHibernatingTasks([task], new Date('2026-07-21'));
    expect(result.active).toHaveLength(1);
    expect(result.hibernating).toHaveLength(0);
  });

  it('returns empty buckets for empty input', () => {
    const result = filterHibernatingTasks([], new Date('2026-07-21'));
    expect(result.active).toEqual([]);
    expect(result.hibernating).toEqual([]);
  });

  it('uses current time when now parameter is omitted', () => {
    const task = makeTask({
      isCrossYear: true,
      hibernateUntil: '2099-01-01', // far future, definitely hibernating
    });
    const result = filterHibernatingTasks([task]);
    expect(result.active).toHaveLength(0);
    expect(result.hibernating).toHaveLength(1);
  });
});

// ============================================================
// Seam F: 默认休眠截止日期 — calcDefaultHibernateUntil
// ============================================================

describe('calcDefaultHibernateUntil', () => {
  it('returns deadline - 60 days', () => {
    const result = calcDefaultHibernateUntil('2026-09-01');
    // Sept 1 - 60 days = July 3
    expect(result).toBe('2026-07-03');
  });

  it('returns null when deadline is null', () => {
    const result = calcDefaultHibernateUntil(null);
    expect(result).toBeNull();
  });

  it('handles year boundary correctly', () => {
    const result = calcDefaultHibernateUntil('2026-02-01');
    // Feb 1 - 60 days = Dec 3, 2025
    expect(result).toBe('2025-12-03');
  });
});

// ============================================================
// Seam G: 子任务进度计算 — calcSubtaskProgress
// ============================================================

describe('calcSubtaskProgress', () => {
  it('returns all zeros for empty subtask array', () => {
    const result = calcSubtaskProgress([]);
    expect(result).toEqual({ total: 0, done: 0, percent: 0 });
  });

  it('counts done subtasks correctly', () => {
    const subtasks: SubTask[] = [
      { id: 's1', title: '步骤一', status: 'done' },
      { id: 's2', title: '步骤二', status: 'todo' },
      { id: 's3', title: '步骤三', status: 'done' },
      { id: 's4', title: '步骤四', status: 'todo' },
    ];
    const result = calcSubtaskProgress(subtasks);
    expect(result).toEqual({ total: 4, done: 2, percent: 50 });
  });

  it('returns 100% when all subtasks are done', () => {
    const subtasks: SubTask[] = [
      { id: 's1', title: '步骤一', status: 'done' },
      { id: 's2', title: '步骤二', status: 'done' },
      { id: 's3', title: '步骤三', status: 'done' },
    ];
    const result = calcSubtaskProgress(subtasks);
    expect(result).toEqual({ total: 3, done: 3, percent: 100 });
  });

  it('returns 0% when all subtasks are todo', () => {
    const subtasks: SubTask[] = [
      { id: 's1', title: '步骤一', status: 'todo' },
      { id: 's2', title: '步骤二', status: 'todo' },
    ];
    const result = calcSubtaskProgress(subtasks);
    expect(result).toEqual({ total: 2, done: 0, percent: 0 });
  });

  it('rounds percent down to integer (floor)', () => {
    const subtasks: SubTask[] = [
      { id: 's1', title: 'a', status: 'done' },
      { id: 's2', title: 'b', status: 'todo' },
      { id: 's3', title: 'c', status: 'todo' },
    ];
    const result = calcSubtaskProgress(subtasks);
    // 1/3 = 33.33% → floor 33
    expect(result).toEqual({ total: 3, done: 1, percent: 33 });
  });
});

// ============================================================
// Seam H: 进度条颜色 — getProgressColor
// ============================================================

describe('getProgressColor', () => {
  it('returns red (#e53935) for 0%', () => {
    expect(getProgressColor(0)).toBe('#e53935');
  });

  it('returns red (#e53935) for 33%', () => {
    expect(getProgressColor(33)).toBe('#e53935');
  });

  it('returns yellow (#fb8c00) for 34%', () => {
    expect(getProgressColor(34)).toBe('#fb8c00');
  });

  it('returns yellow (#fb8c00) for 66%', () => {
    expect(getProgressColor(66)).toBe('#fb8c00');
  });

  it('returns blue (#2196f3) for 67%', () => {
    expect(getProgressColor(67)).toBe('#2196f3');
  });

  it('returns blue (#2196f3) for 99%', () => {
    expect(getProgressColor(99)).toBe('#2196f3');
  });

  it('returns green (#4caf50) for 100%', () => {
    expect(getProgressColor(100)).toBe('#4caf50');
  });
});

// ============================================================
// Seam I: 子任务 CRUD helpers — addSubtask / toggleSubtask / deleteSubtask
// ============================================================

describe('addSubtask', () => {
  it('appends a new subtask with auto-generated id to the array', () => {
    const existing: SubTask[] = [
      { id: 's1', title: 'existing', status: 'todo' },
    ];
    const result = addSubtask(existing, '新步骤');
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(existing[0]); // existing entry unchanged
    expect(result[1].title).toBe('新步骤');
    expect(result[1].status).toBe('todo');
    expect(result[1].id).toMatch(/^s-/);
  });

  it('works on empty array', () => {
    const result = addSubtask([], '第一步');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('第一步');
    expect(result[0].status).toBe('todo');
  });

  it('generates unique IDs', () => {
    const a = addSubtask([], 'a');
    const b = addSubtask(a, 'b');
    expect(b).toHaveLength(2);
    expect(b[0].id).not.toBe(b[1].id);
  });

  it('returns new array (immutability)', () => {
    const existing: SubTask[] = [];
    const result = addSubtask(existing, 'test');
    expect(result).not.toBe(existing);
  });

  it('trims whitespace from title', () => {
    const result = addSubtask([], '  整理材料  ');
    expect(result[0].title).toBe('整理材料');
  });
});

describe('toggleSubtask', () => {
  const subtasks: SubTask[] = [
    { id: 's1', title: '步骤一', status: 'todo' },
    { id: 's2', title: '步骤二', status: 'done' },
    { id: 's3', title: '步骤三', status: 'todo' },
  ];

  it('toggles todo → done', () => {
    const result = toggleSubtask(subtasks, 's1');
    expect(result[0].status).toBe('done');
  });

  it('toggles done → todo', () => {
    const result = toggleSubtask(subtasks, 's2');
    expect(result[1].status).toBe('todo');
  });

  it('returns same array if id not found', () => {
    const result = toggleSubtask(subtasks, 'nonexistent');
    expect(result).toBe(subtasks);
  });

  it('returns new array on successful toggle (immutability)', () => {
    const result = toggleSubtask(subtasks, 's1');
    expect(result).not.toBe(subtasks);
  });

  it('only toggles the matching subtask, leaving others unchanged', () => {
    const result = toggleSubtask(subtasks, 's3');
    expect(result[0].status).toBe('todo'); // unchanged
    expect(result[1].status).toBe('done');  // unchanged
    expect(result[2].status).toBe('done');  // toggled
  });
});

describe('deleteSubtask', () => {
  const subtasks: SubTask[] = [
    { id: 's1', title: '步骤一', status: 'todo' },
    { id: 's2', title: '步骤二', status: 'done' },
    { id: 's3', title: '步骤三', status: 'todo' },
  ];

  it('removes the subtask by id', () => {
    const result = deleteSubtask(subtasks, 's2');
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.id)).toEqual(['s1', 's3']);
  });

  it('returns same array if id not found', () => {
    const result = deleteSubtask(subtasks, 'nonexistent');
    expect(result).toBe(subtasks);
  });

  it('returns new array on successful delete (immutability)', () => {
    const result = deleteSubtask(subtasks, 's1');
    expect(result).not.toBe(subtasks);
  });

  it('returns empty array when deleting the only subtask', () => {
    const single: SubTask[] = [{ id: 's1', title: '唯一', status: 'todo' }];
    const result = deleteSubtask(single, 's1');
    expect(result).toEqual([]);
  });
});

// ============================================================
// Seam J: 项目进度汇总 — calcProjectProgress
// ============================================================

describe('calcProjectProgress', () => {
  it('returns zeros for empty task list', () => {
    const result = calcProjectProgress([]);
    expect(result).toEqual({ total: 0, done: 0 });
  });

  it('sums subtask counts across all tasks in a project', () => {
    const tasks: Task[] = [
      makeTask({
        id: 't1',
        subtasks: [
          { id: 's1', title: 'a', status: 'done' },
          { id: 's2', title: 'b', status: 'done' },
          { id: 's3', title: 'c', status: 'todo' },
        ],
      }),
      makeTask({
        id: 't2',
        subtasks: [
          { id: 's4', title: 'd', status: 'done' },
          { id: 's5', title: 'e', status: 'todo' },
        ],
      }),
    ];
    const result = calcProjectProgress(tasks);
    // total = 3 + 2 = 5, done = 2 + 1 = 3
    expect(result).toEqual({ total: 5, done: 3 });
  });

  it('ignores tasks with empty subtasks', () => {
    const tasks: Task[] = [
      makeTask({ id: 't1', subtasks: [] }),
      makeTask({
        id: 't2',
        subtasks: [{ id: 's1', title: 'a', status: 'done' }],
      }),
    ];
    const result = calcProjectProgress(tasks);
    expect(result).toEqual({ total: 1, done: 1 });
  });

  it('returns all zeros when no task has subtasks', () => {
    const tasks: Task[] = [
      makeTask({ id: 't1', subtasks: [] }),
      makeTask({ id: 't2', subtasks: [] }),
    ];
    const result = calcProjectProgress(tasks);
    expect(result).toEqual({ total: 0, done: 0 });
  });

  it('ignores cancelled task subtasks', () => {
    const tasks: Task[] = [
      makeTask({
        id: 't1',
        status: 'cancelled',
        subtasks: [
          { id: 's1', title: 'a', status: 'done' },
          { id: 's2', title: 'b', status: 'done' },
        ],
      }),
      makeTask({
        id: 't2',
        subtasks: [{ id: 's3', title: 'c', status: 'todo' }],
      }),
    ];
    const result = calcProjectProgress(tasks);
    // cancelled task subtasks excluded
    expect(result).toEqual({ total: 1, done: 0 });
  });
});

// ============================================================
// Seam K: 父任务确认完成 — confirmTaskDone
// ============================================================

describe('confirmTaskDone', () => {
  it('sets status to done and sets completedDate when task has subtasks all done', () => {
    const today = new Date().toISOString().slice(0, 10);
    const task = makeTask({
      status: 'in-progress',
      completedDate: null,
      subtasks: [
        { id: 's1', title: 'a', status: 'done' },
        { id: 's2', title: 'b', status: 'done' },
      ],
    });
    const result = confirmTaskDone(task);
    expect(result.status).toBe('done');
    expect(result.completedDate).toBe(today);
  });

  it('sets status to done even when task has no subtasks', () => {
    const today = new Date().toISOString().slice(0, 10);
    const task = makeTask({ status: 'in-progress', subtasks: [] });
    const result = confirmTaskDone(task);
    expect(result.status).toBe('done');
    expect(result.completedDate).toBe(today);
  });

  it('sets status to done even when not all subtasks are done', () => {
    // confirm completion is a manual decision, independent of subtask state
    const today = new Date().toISOString().slice(0, 10);
    const task = makeTask({
      status: 'in-progress',
      subtasks: [
        { id: 's1', title: 'a', status: 'done' },
        { id: 's2', title: 'b', status: 'todo' },
      ],
    });
    const result = confirmTaskDone(task);
    expect(result.status).toBe('done');
    expect(result.completedDate).toBe(today);
  });

  it('is a no-op when task is already done (duplicate confirm)', () => {
    const task = makeTask({
      status: 'done',
      completedDate: '2026-07-15',
      subtasks: [
        { id: 's1', title: 'a', status: 'done' },
      ],
    });
    const result = confirmTaskDone(task);
    expect(result).toBe(task); // same reference, no change
    expect(result.status).toBe('done');
    expect(result.completedDate).toBe('2026-07-15');
  });

  it('confirming a done task does not overwrite completedDate', () => {
    const task = makeTask({
      status: 'done',
      completedDate: '2026-07-15',
    });
    const result = confirmTaskDone(task);
    expect(result.completedDate).toBe('2026-07-15');
  });

  it('can confirm from todo status', () => {
    const today = new Date().toISOString().slice(0, 10);
    const task = makeTask({ status: 'todo', completedDate: null });
    const result = confirmTaskDone(task);
    expect(result.status).toBe('done');
    expect(result.completedDate).toBe(today);
  });

  it('can confirm from cancelled status (reopen as done)', () => {
    const today = new Date().toISOString().slice(0, 10);
    const task = makeTask({ status: 'cancelled', completedDate: '2026-07-10' });
    const result = confirmTaskDone(task);
    expect(result.status).toBe('done');
    expect(result.completedDate).toBe(today);
  });

  it('returns new object on state change (immutability)', () => {
    const task = makeTask({ status: 'todo' });
    const result = confirmTaskDone(task);
    expect(result).not.toBe(task);
  });

  it('adding subtasks after confirm keeps task done', () => {
    // After confirming, user can add more subtasks but task stays done
    const today = new Date().toISOString().slice(0, 10);
    const task = makeTask({
      status: 'in-progress',
      completedDate: null,
      subtasks: [{ id: 's1', title: 'a', status: 'done' }],
    });
    const confirmed = confirmTaskDone(task);
    expect(confirmed.status).toBe('done');
    // Add a subtask after confirm — task still done unless explicitly reopened
    const withNewSubtask = {
      ...confirmed,
      subtasks: [
        ...confirmed.subtasks,
        { id: 's2', title: 'b', status: 'todo' } as SubTask,
      ],
    };
    expect(withNewSubtask.status).toBe('done');
    expect(withNewSubtask.completedDate).toBe(today);
  });

  it('sets updatedDate to today when confirming a non-done task', () => {
    const today = new Date().toISOString().slice(0, 10);
    const task = makeTask({ status: 'todo', updatedDate: '2026-07-01' });
    const result = confirmTaskDone(task);
    expect(result.updatedDate).toBe(today);
  });

  it('preserves original updatedDate when task is already done', () => {
    const task = makeTask({ status: 'done', updatedDate: '2026-07-15', completedDate: '2026-07-15' });
    const result = confirmTaskDone(task);
    expect(result.updatedDate).toBe('2026-07-15');
  });
});
