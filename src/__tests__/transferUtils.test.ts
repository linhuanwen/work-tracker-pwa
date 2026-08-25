/**
 * T3 — 数据迁移工具层 transferUtils
 *
 * 验证：快照生成、导入解析、覆盖、合并与冲突处理。
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createSnapshotText,
  defaultExportFileName,
  parseImportText,
  mergeForImport,
  countMergedCategories,
} from '../transferUtils';
import { createDefaultDataJson } from '../types';
import type { DataJson, Task, Project } from '../types';

function makeTask(id: string, overrides?: Partial<Task>): Task {
  return {
    id,
    projectId: null,
    title: `任务 ${id}`,
    category: '其他',
    priority: 'normal',
    status: 'todo',
    createdDate: '2026-08-01',
    updatedDate: '2026-08-01',
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

function makeProject(id: string, overrides?: Partial<Project>): Project {
  return {
    id,
    title: `项目 ${id}`,
    category: '其他',
    status: 'in-progress',
    startDate: '2026-08-01',
    targetDate: '2026-12-31',
    notes: '',
    subtaskCount: { total: 0, done: 0 },
    ...overrides,
  };
}

describe('T3 — transferUtils 快照生成与解析', () => {
  it('导出文本可被解析回原始数据', () => {
    const data = createDefaultDataJson();
    data.tasks = [makeTask('t1')];
    data.projects = [makeProject('p1')];

    const text = createSnapshotText(data);
    const parsed = parseImportText(text);

    expect(parsed.tasks).toHaveLength(1);
    expect(parsed.tasks[0].id).toBe('t1');
    expect(parsed.projects[0].id).toBe('p1');
  });

  it('生成的推荐文件名包含日期', () => {
    const name = defaultExportFileName(new Date('2026-08-25T00:00:00Z'));
    expect(name).toMatch(/^工作清单备份-2026-08-25\.json$/);
  });

  it('兼容导入裸 data.json（无快照包装）', () => {
    const data = createDefaultDataJson();
    data.tasks = [makeTask('t-x')];

    const parsed = parseImportText(JSON.stringify(data));
    expect(parsed.tasks[0].id).toBe('t-x');
  });

  it('非法 JSON 抛出可读错误', () => {
    expect(() => parseImportText('{{{ not json')).toThrow(/不是有效的 JSON/);
  });

  it('非本应用的快照文件被拒绝', () => {
    const text = JSON.stringify({ app: 'other', kind: 'snapshot', data: {} });
    expect(() => parseImportText(text)).toThrow(/不是本应用导出的/);
  });
});

describe('T3 — mergeForImport 合并规则', () => {
  it('不冲突的任务和项目直接合并', () => {
    const local = createDefaultDataJson();
    local.tasks = [makeTask('t-local')];
    local.projects = [makeProject('p-local')];

    const incoming = createDefaultDataJson();
    incoming.tasks = [makeTask('t-incoming')];
    incoming.projects = [makeProject('p-incoming')];

    const { data, summary } = mergeForImport(local, incoming);
    expect(data.tasks.map((t) => t.id).sort()).toEqual(['t-incoming', 't-local']);
    expect(data.projects).toHaveLength(2);
    expect(summary.remappedTaskIds).toBe(0);
    expect(summary.remappedProjectIds).toBe(0);
  });

  it('id 冲突且内容相同时跳过', () => {
    const local = createDefaultDataJson();
    local.tasks = [makeTask('tx')];
    const incoming = createDefaultDataJson();
    incoming.tasks = [makeTask('tx')];

    const { data, summary } = mergeForImport(local, incoming);
    expect(data.tasks).toHaveLength(1);
    expect(summary.skippedIdenticalTasks).toBe(1);
  });

  it('id 冲突且内容不同时生成新 id 并保留双方', () => {
    const local = createDefaultDataJson();
    local.tasks = [makeTask('t1', { title: '本地标题' })];
    const incoming = createDefaultDataJson();
    incoming.tasks = [makeTask('t1', { title: '导入标题' })];

    const { data, summary } = mergeForImport(local, incoming);
    expect(data.tasks).toHaveLength(2);
    expect(summary.remappedTaskIds).toBe(1);
    // 两个 id 不同
    const ids = data.tasks.map((t) => t.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('任务 projectId 引用随冲突项目 id 重映射', () => {
    const local = createDefaultDataJson();
    local.projects = [makeProject('p1', { title: '本地项目' })];

    const incoming = createDefaultDataJson();
    incoming.projects = [makeProject('p1', { title: '导入项目' })];
    incoming.tasks = [makeTask('t-new', { projectId: 'p1' })];

    const { data } = mergeForImport(local, incoming);
    const newProj = data.projects.find((p) => p.title === '导入项目')!;
    const newTask = data.tasks.find((t) => t.id === 't-new')!;
    expect(newTask.projectId).toBe(newProj.id);
  });

  it('分类取并集', () => {
    const local = createDefaultDataJson();
    local.settings.categories = ['人员调配', '其他'];
    const incoming = createDefaultDataJson();
    incoming.settings.categories = ['其他', '新分类A'];

    const { data } = mergeForImport(local, incoming);
    expect(data.settings.categories).toContain('人员调配');
    expect(data.settings.categories).toContain('其他');
    expect(data.settings.categories).toContain('新分类A');
    expect(countMergedCategories(local, incoming)).toBe(1);
  });

  it('归档按 key 合并，已存在保留本地', () => {
    const local = createDefaultDataJson();
    local.archives.weeks['2026-W34'] = {
      tasks: [], summary: { doneTasks: '本地', projectProgress: '', nextWeekPlan: '', blockers: '' }, aiPolished: false,
    };
    const incoming = createDefaultDataJson();
    incoming.archives.weeks['2026-W34'] = {
      tasks: [], summary: { doneTasks: '导入', projectProgress: '', nextWeekPlan: '', blockers: '' }, aiPolished: false,
    };
    incoming.archives.weeks['2026-W35'] = {
      tasks: [], summary: { doneTasks: '新增周', projectProgress: '', nextWeekPlan: '', blockers: '' }, aiPolished: false,
    };

    const { data, summary } = mergeForImport(local, incoming);
    expect(Object.keys(data.archives.weeks)).toContain('2026-W34');
    expect(Object.keys(data.archives.weeks)).toContain('2026-W35');
    expect(data.archives.weeks['2026-W34'].summary.doneTasks).toBe('本地');
    expect(summary.skippedArchiveKeys).toBe(1);
  });
});

describe('T3 — 额外边界场景', () => {
  it('快照 formatVersion 过高时拒绝导入', () => {
    const text = JSON.stringify({
      app: 'work-list', kind: 'snapshot', formatVersion: 99,
      exportedAt: 'x', data: createDefaultDataJson(),
    });
    expect(() => parseImportText(text)).toThrow(/格式版本过高/);
  });

  it('合并导入保持 local 的 revision 不变（避免冲突检测拦截）', () => {
    const local = createDefaultDataJson();
    local.revision = 42;
    const incoming = createDefaultDataJson();
    incoming.revision = 999;

    const { data } = mergeForImport(local, incoming);
    expect(data.revision).toBe(42);
  });

  it('导入任务引用本地已有项目 id 时保持引用不变', () => {
    const local = createDefaultDataJson();
    local.projects = [makeProject('p-local')];
    local.tasks = [makeTask('t-local', { projectId: 'p-local' })];

    // 导入任务引用本地项目 id（该 id 在导入文件中不存在）
    const incoming = createDefaultDataJson();
    incoming.tasks = [makeTask('t-new', { title: '引用本地项目', projectId: 'p-local' })];

    const { data } = mergeForImport(local, incoming);
    const newTask = data.tasks.find((t) => t.id === 't-new')!;
    expect(newTask.projectId).toBe('p-local');
  });

  it('空导入（无任务/项目）合并不改变本地数据', () => {
    const local = createDefaultDataJson();
    local.tasks = [makeTask('t1')];
    local.projects = [makeProject('p1')];
    const incoming = createDefaultDataJson();

    const { data, summary } = mergeForImport(local, incoming);
    expect(data.tasks).toHaveLength(1);
    expect(data.projects).toHaveLength(1);
    expect(summary.remappedTaskIds).toBe(0);
    expect(summary.remappedProjectIds).toBe(0);
  });

  it('覆盖导入语义：使用导入文件自身内容（含其 revision）', () => {
    const incoming = createDefaultDataJson();
    incoming.tasks = [makeTask('t-only')];
    incoming.revision = 7;
    // 覆盖 = 直接用 parseImportText 的结果，不走 mergeForImport
    const result = parseImportText(createSnapshotText(incoming));
    expect(result.tasks).toHaveLength(1);
    // revision 已由导入文件带出（语义正确，实验性保留）
    expect(result.revision).toBe(7);
  });
});
