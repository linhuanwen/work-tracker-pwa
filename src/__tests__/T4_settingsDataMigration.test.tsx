/**
 * T4 — 设置页数据迁移 UI
 *
 * 验证：
 * - 设置页显示“数据迁移”区块和导出/导入按钮
 * - 选择文件后显示导入预览（任务/项目数量）与导入方式按钮
 * - 覆盖导入触发 SET_DATA
 * - 合并导入触发 SET_DATA
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../Settings.module.css', () => ({
  default: {
    container: 'container', heading: 'heading', section: 'section',
    sectionTitle: 'sectionTitle', migrationHint: 'migrationHint',
    migrationRow: 'migrationRow', migrationBtn: 'migrationBtn',
    migrationBtnDanger: 'migrationBtnDanger', migrationBtnGhost: 'migrationBtnGhost',
    importPreview: 'importPreview', aiField: 'aiField', aiLabel: 'aiLabel',
    aiInput: 'aiInput', aiSaveBtn: 'aiSaveBtn', aiHint: 'aiHint',
    catList: 'catList', catItem: 'catItem', catName: 'catName',
    catCount: 'catCount', catActions: 'catActions', catEditBtn: 'catEditBtn',
    catDelBtn: 'catDelBtn', catInput: 'catInput', addRow: 'addRow',
    addBtn: 'addBtn', addConfirmBtn: 'addConfirmBtn', dayRow: 'dayRow',
    dayLabel: 'dayLabel', daySelect: 'daySelect',
  },
}));
vi.mock('../ThemeToggle', () => ({ ThemeToggle: () => null }));
vi.mock('../ThemePicker', () => ({ ThemePicker: () => null }));
vi.mock('../Toast.module.css', () => ({ default: {} }));

// Mock useData
const mockDispatch = vi.fn();
const mockShowToast = vi.fn();
vi.mock('../DataContext', () => ({
  useData: () => ({
    data: {
      version: 1,
      revision: 0,
      lastModified: '2026-08-25T00:00:00.000Z',
      settings: {
        weeklySummaryDay: 5,
        monthlySummaryDay: 28,
        aiPolishFlag: false,
        categories: ['人员调配', '其他'],
      },
      projects: [],
      tasks: [
        { id: 't1', projectId: null, title: '本地任务', category: '其他', priority: 'normal', status: 'todo', createdDate: '2026-08-01', updatedDate: '2026-08-01', deadline: null, completedDate: null, quantities: [], subtasks: [], notes: '', isLeaderAssigned: false, isCrossYear: false, isBlocked: false },
      ],
      archives: { weeks: {}, months: {}, years: {} },
    },
    dispatch: mockDispatch,
  }),
}));
vi.mock('../useToast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

// Mock transferUtils
vi.mock('../transferUtils', () => ({
  createSnapshotText: vi.fn(() => '{"snapshot"}'),
  defaultExportFileName: vi.fn(() => '工作清单备份-2026-08-25.json'),
  parseImportText: vi.fn((text: string) => ({
    version: 1,
    revision: 5,
    lastModified: '2026-08-20T00:00:00.000Z',
    settings: {
      weeklySummaryDay: 5,
      monthlySummaryDay: 28,
      aiPolishFlag: false,
      categories: ['人员调配', '培训', '其他'],
    },
    projects: [{ id: 'p1', title: '导入项目', category: '其他', status: 'in-progress', startDate: '2026-08-01', targetDate: '2026-12-31', notes: '', subtaskCount: { total: 0, done: 0 } }],
    tasks: [
      { id: 't-import', projectId: null, title: '导入任务', category: '其他', priority: 'normal', status: 'todo', createdDate: '2026-08-01', updatedDate: '2026-08-01', deadline: null, completedDate: null, quantities: [], subtasks: [], notes: '', isLeaderAssigned: false, isCrossYear: false, isBlocked: false },
    ],
    archives: { weeks: {}, months: {}, years: {} },
  })),
  mergeForImport: vi.fn((local, incoming) => ({
    data: { ...local },
    summary: { remappedTaskIds: 0, remappedProjectIds: 0, skippedIdenticalTasks: 0, skippedIdenticalProjects: 0, skippedArchiveKeys: 0 },
  })),
}));

import { Settings } from '../Settings';

// Mock global FileReader
class MockFileReader {
  result: string | null = null;
  onload: (() => void) | null = null;
  readAsText(file: unknown) {
    this.result = '{"imported": true}';
    if (this.onload) this.onload();
  }
}
vi.stubGlobal('FileReader', MockFileReader);
vi.stubGlobal('Blob', class Blob { constructor(public parts: unknown[]) {} });
vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });

describe('T4 — 设置页数据迁移', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
    mockShowToast.mockClear();
  });

  it('显示数据迁移区块和导出/导入按钮', () => {
    render(<Settings />);
    expect(screen.getByText('数据迁移')).toBeDefined();
    expect(screen.getByRole('button', { name: '导出全部数据' })).toBeDefined();
    expect(screen.getByRole('button', { name: '导入数据文件…' })).toBeDefined();
  });

  it('选择文件后显示导入预览及覆盖/合并按钮', async () => {
    render(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: '导入数据文件…' }));
    const input = screen.getByRole('button', { name: '导入数据文件…' }).parentElement!.querySelector('input')!;
    fireEvent.change(input, { target: { files: [new File(['{}'], 'backup.json')] } });

    await waitFor(() => {
      expect(screen.getByText(/backup\.json/)).toBeDefined();
      expect(screen.getByRole('button', { name: '合并导入' })).toBeDefined();
      expect(screen.getByRole('button', { name: '覆盖导入' })).toBeDefined();
      expect(screen.getByRole('button', { name: '取消' })).toBeDefined();
    });
  });

  it('点击合并导入触发 SET_DATA', async () => {
    render(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: '导入数据文件…' }));
    const input = screen.getByRole('button', { name: '导入数据文件…' }).parentElement!.querySelector('input')!;
    fireEvent.change(input, { target: { files: [new File(['{}'], 'backup.json')] } });

    await waitFor(() => screen.getByRole('button', { name: '合并导入' }));
    fireEvent.click(screen.getByRole('button', { name: '合并导入' }));
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_DATA', payload: expect.any(Object) });
  });
});
