import { describe, it, expect } from 'vitest';
import type { DataJson, Task, Project, Settings, Archive } from '../types';
import { createDefaultDataJson, validateDataJson, migrateDataJson, parseDataJson, DATA_VERSION } from '../types';

/**
 * Seam 1: data.json TypeScript types
 *
 * Tests that the TypeScript type definitions match the spec's data model
 * and that runtime validation accepts valid data / rejects invalid data.
 */

const VALID_TASK: Task = {
  id: 't-001',
  projectId: null,
  title: '完成季度绩效考核汇总',
  category: '绩效管理',
  priority: 'important',
  status: 'todo',
  createdDate: '2026-07-21',
  updatedDate: '2026-07-21',
  deadline: '2026-07-25',
  completedDate: null,
  quantities: [],
  subtasks: [],
  notes: '',
  isLeaderAssigned: false,
  isCrossYear: false,
  isBlocked: false,
};

const VALID_PROJECT: Project = {
  id: 'p-001',
  title: '2026年度内部竞聘',
  category: '内部招聘',
  status: 'in-progress',
  startDate: '2026-06-01',
  targetDate: '2026-09-30',
  notes: '',
  subtaskCount: { total: 12, done: 5 },
};

const VALID_SETTINGS: Settings = {
  weeklySummaryDay: 5,
  monthlySummaryDay: 28,
  aiPolishFlag: false,
  categories: [
    '人员调配',
    '内部招聘',
    '奖惩管理',
    '绩效管理',
    '劳动关系',
    '交办事项',
    '其他',
  ],
};

const VALID_ARCHIVE: Archive = {
  weeks: {},
  months: {},
  years: {},
};

const VALID_DATA_JSON: DataJson = {
  version: 1,
  revision: 0,
  lastModified: '2026-07-21T10:00:00.000+08:00',
  settings: VALID_SETTINGS,
  projects: [VALID_PROJECT],
  tasks: [VALID_TASK],
  archives: VALID_ARCHIVE,
};

describe('DataJson types — compile-time + runtime validation', () => {
  it('accepts a valid DataJson object', () => {
    const result = validateDataJson(VALID_DATA_JSON);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects DataJson with wrong version type', () => {
    const invalid = { ...VALID_DATA_JSON, version: '1' };
    const result = validateDataJson(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('version'))).toBe(true);
  });

  it('rejects a Task with invalid priority', () => {
    const invalidTask = { ...VALID_TASK, priority: 'critical' };
    const invalid = {
      ...VALID_DATA_JSON,
      tasks: [invalidTask],
    };
    const result = validateDataJson(invalid);
    expect(result.valid).toBe(false);
  });

  it('rejects a Task with invalid status', () => {
    const invalidTask = { ...VALID_TASK, status: 'deleted' };
    const invalid = {
      ...VALID_DATA_JSON,
      tasks: [invalidTask],
    };
    const result = validateDataJson(invalid);
    expect(result.valid).toBe(false);
  });

  it('rejects a Project with invalid status', () => {
    const invalidProject = { ...VALID_PROJECT, status: 'paused' };
    const invalid = {
      ...VALID_DATA_JSON,
      projects: [invalidProject],
    };
    const result = validateDataJson(invalid);
    expect(result.valid).toBe(false);
  });

  it('accepts a Task with all optional fields omitted', () => {
    const minimalTask: Task = {
      id: 't-min',
      projectId: null,
      title: '最小任务',
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
    };
    const data: DataJson = {
      ...VALID_DATA_JSON,
      tasks: [minimalTask],
    };
    const result = validateDataJson(data);
    expect(result.valid).toBe(true);
  });
});

describe('createDefaultDataJson', () => {
  it('returns a valid DataJson with 7 preset categories', () => {
    const data = createDefaultDataJson();
    const result = validateDataJson(data);
    expect(result.valid).toBe(true);
    expect(data.version).toBe(1);
    expect(data.settings.categories).toHaveLength(7);
    expect(data.settings.categories).toContain('交办事项');
    expect(data.tasks).toHaveLength(0);
    expect(data.projects).toHaveLength(0);
  });

  it('has lastModified set to now', () => {
    const before = new Date().toISOString();
    const data = createDefaultDataJson();
    const after = new Date().toISOString();
    expect(data.lastModified >= before).toBe(true);
    expect(data.lastModified <= after).toBe(true);
  });
});

describe('migrateDataJson — 版本迁移', () => {
  it('接受当前版本的合法数据并归一化 version 字段', () => {
    const data = migrateDataJson(VALID_DATA_JSON);
    expect(data.version).toBe(DATA_VERSION);
    expect(validateDataJson(data).valid).toBe(true);
  });

  it('version 缺失时视为 v1 并补齐 version 字段', () => {
    const { version: _omit, ...rest } = VALID_DATA_JSON;
    const data = migrateDataJson(rest);
    expect(data.version).toBe(DATA_VERSION);
  });

  it('version 高于当前版本时抛错', () => {
    const future = { ...VALID_DATA_JSON, version: DATA_VERSION + 1 };
    expect(() => migrateDataJson(future)).toThrow(/高于当前应用支持/);
  });

  it('非对象输入抛错', () => {
    expect(() => migrateDataJson(null)).toThrow(/根节点必须是对象/);
    expect(() => migrateDataJson('hello')).toThrow(/根节点必须是对象/);
    expect(() => migrateDataJson([1, 2, 3])).toThrow(/根节点必须是对象/);
  });
});

describe('parseDataJson — 安全解析', () => {
  it('解析合法 JSON 文本', () => {
    const data = parseDataJson(JSON.stringify(VALID_DATA_JSON));
    expect(data.version).toBe(DATA_VERSION);
    expect(validateDataJson(data).valid).toBe(true);
  });

  it('非法 JSON 抛错', () => {
    expect(() => parseDataJson('{ not json')).toThrow(/不是有效的 JSON/);
  });

  it('字段缺失抛错并给出原因', () => {
    const { tasks: _omit, ...rest } = VALID_DATA_JSON;
    expect(() => parseDataJson(JSON.stringify(rest))).toThrow(/内容不完整或已损坏/);
  });

  it('字段类型错误（如 version 为字符串）抛错', () => {
    const bad = { ...VALID_DATA_JSON, version: '1' };
    expect(() => parseDataJson(JSON.stringify(bad))).toThrow(/version 字段类型错误/);
  });
});
