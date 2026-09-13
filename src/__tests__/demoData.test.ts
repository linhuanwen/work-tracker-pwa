/**
 * 示例数据 demo/data.json 必须始终能被应用解析。
 *
 * 它既是新用户导入后看到的第一屏内容，也是 README 截图与文档演示的取景数据；
 * 一旦数据 schema 演进（新增必填字段、改枚举值）而示例没跟上，用户导入就会失败。
 * 这里刻意不做「日期新鲜度」断言——那是脚本 `scripts/make_demo_data.py` 的职责，
 * 放进测试会变成到点必红的定时炸弹。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseDataJson, DEFAULT_CATEGORIES } from '../types';

const DEMO_PATH = resolve(process.cwd(), 'demo', 'data.json');

describe('demo/data.json 示例数据', () => {
  it('能被 parseDataJson 完整解析并通过 schema 校验', () => {
    const data = parseDataJson(readFileSync(DEMO_PATH, 'utf8'));

    expect(data.version).toBe(1);
    expect(data.settings.categories).toEqual(DEFAULT_CATEGORIES);
    expect(data.projects.length).toBeGreaterThan(0);
    expect(data.tasks.length).toBeGreaterThan(10);
  });

  it('覆盖演示所需的关键形态：项目子任务、量化产出、交办事项、跨年休眠、阻塞', () => {
    const data = parseDataJson(readFileSync(DEMO_PATH, 'utf8'));
    const tasks = data.tasks;

    expect(tasks.some((t) => t.subtasks.length > 0)).toBe(true);
    expect(tasks.some((t) => t.quantities.length > 0)).toBe(true);
    expect(tasks.some((t) => t.isLeaderAssigned)).toBe(true);
    expect(tasks.some((t) => t.isCrossYear && t.hibernateUntil)).toBe(true);
    expect(tasks.some((t) => t.isBlocked)).toBe(true);
    expect(data.projects.some((p) => p.subtaskCount.total > 0)).toBe(true);
  });

  it('自带周/月/年归档内容，新用户导入后小结页不是空的', () => {
    const data = parseDataJson(readFileSync(DEMO_PATH, 'utf8'));

    expect(Object.keys(data.archives.weeks).length).toBeGreaterThan(0);
    expect(Object.keys(data.archives.months).length).toBeGreaterThan(0);
    expect(Object.keys(data.archives.years).length).toBeGreaterThan(0);

    const [weekEntry] = Object.values(data.archives.weeks);
    expect(weekEntry.summary.doneTasks.length).toBeGreaterThan(0);
    const [yearEntry] = Object.values(data.archives.years);
    expect(yearEntry.summary.other.length).toBeGreaterThan(0);
  });
});
