import { describe, it, expect } from 'vitest';
import type { Task } from '../types';
import { generateTaskCSV, generateReportText } from '../reportUtils';

/**
 * Seam: CSV 生成格式 + 报告文本生成
 *
 * Pure functions that generate CSV strings and formatted report text
 * from task data. Tests verify correct format for Excel compatibility
 * and clipboard copy.
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

describe('generateTaskCSV', () => {
  it('generates header row with correct Chinese column names', () => {
    const csv = generateTaskCSV([]);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('标题,分类,优先级,状态,创建日期,完成日期,量化产出');
  });

  it('starts with UTF-8 BOM for Excel compatibility', () => {
    const csv = generateTaskCSV([]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('generates a data row for a single task', () => {
    const task = makeTask({
      title: '完成季度考核',
      category: '绩效管理',
      priority: 'important',
      status: 'done',
      createdDate: '2026-07-01',
      completedDate: '2026-07-15',
      quantities: [{ label: '考核人数', value: 120, unit: '人' }],
    });
    const csv = generateTaskCSV([task]);
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(2); // header + 1 data row
    expect(lines[1]).toContain('完成季度考核');
    expect(lines[1]).toContain('绩效管理');
    expect(lines[1]).toContain('重要');
    expect(lines[1]).toContain('已完成');
    expect(lines[1]).toContain('2026-07-01');
    expect(lines[1]).toContain('2026-07-15');
    expect(lines[1]).toContain('考核人数: 120人');
  });

  it('quotes fields that contain ASCII commas', () => {
    const task = makeTask({
      title: '调研,分析及汇报',
    });
    const csv = generateTaskCSV([task]);
    const lines = csv.trim().split('\n');
    expect(lines[1]).toMatch(/^"调研,分析及汇报"/);
  });

  it('handles multiple quantities as semicolon-separated text', () => {
    const task = makeTask({
      quantities: [
        { label: '人数', value: 50, unit: '人' },
        { label: '场次', value: 3, unit: '场' },
      ],
    });
    const csv = generateTaskCSV([task]);
    const lines = csv.trim().split('\n');
    expect(lines[1]).toContain('人数: 50人; 场次: 3场');
  });

  it('renders empty quantities as empty string', () => {
    const task = makeTask({ quantities: [] });
    const csv = generateTaskCSV([task]);
    const lines = csv.trim().split('\n');
    const cols = lines[1].split(',');
    expect(cols[cols.length - 1]).toBe('');
  });

  it('renders null completedDate as empty', () => {
    const task = makeTask({ completedDate: null });
    const csv = generateTaskCSV([task]);
    const lines = csv.trim().split('\n');
    const cols = lines[1].split(',');
    expect(cols[5]).toBe('');
  });

  it('generates correct number of data rows', () => {
    const tasks = [
      makeTask({ id: '1', title: '任务A' }),
      makeTask({ id: '2', title: '任务B' }),
      makeTask({ id: '3', title: '任务C' }),
    ];
    const csv = generateTaskCSV(tasks);
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(4); // header + 3
  });

  it('maps priority and status to Chinese labels', () => {
    const task = makeTask({
      priority: 'urgent',
      status: 'in-progress',
    });
    const csv = generateTaskCSV([task]);
    expect(csv).toContain('紧急');
    expect(csv).toContain('进行中');
  });
});

describe('generateReportText', () => {
  it('generates text from a map of section titles to content', () => {
    const sections: Record<string, string> = {
      '本周完成任务': '- 任务A\n- 任务B',
      '下周计划': '- 任务C',
    };
    const text = generateReportText(sections);
    expect(text).toContain('本周完成任务');
    expect(text).toContain('- 任务A');
    expect(text).toContain('下周计划');
    expect(text).toContain('- 任务C');
  });

  it('separates sections with blank lines', () => {
    const sections: Record<string, string> = {
      'A': 'Content A',
      'B': 'Content B',
    };
    const text = generateReportText(sections);
    expect(text).toMatch(/Content A\n\n【B】/);
  });
});
