/**
 * F4 — AI 润色前端联调测试（/api/polish）
 *
 * 验证前端 WeeklySummary 的「请求润色」按钮真正发起 HTTP POST 到 /api/polish，
 * 覆盖成功 / 后端返回错误 / 网络失败 / loading 四种状态。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ---- Mock CSS ----
vi.mock('../WeeklySummary.module.css', () => ({
  default: {
    container: 'container', heading: 'heading', backBtn: 'backBtn',
    weekSelector: 'weekSelector', weekBtn: 'weekBtn', weekLabel: 'weekLabel',
    generateBtn: 'generateBtn', regenerateBtn: 'regenerateBtn', summaryBtn: 'summaryBtn',
    sections: 'sections', section: 'section', sectionHeader: 'sectionHeader',
    sectionTitle: 'sectionTitle', aiBtn: 'aiBtn',
    editable: 'editable', addPlanRow: 'addPlanRow', planInput: 'planInput',
    statusBar: 'statusBar', statusOk: 'statusOk', statusPending: 'statusPending',
  },
}));

vi.mock('../Icon', () => ({
  Icon: () => null,
}));

vi.mock('../aiConfig', () => ({
  aiConfigPayload: () => ({
    api_key: 'sk-test',
    endpoint: 'https://api.deepseek.com',
    model: 'deepseek-chat',
  }),
}));

// ---- Mock weeklyUtils：固定 weekKey，隔离日期计算 ----
vi.mock('../weeklyUtils', () => ({
  getWeekKey: () => '2026-W29',
  getWeekDateRange: () => ({ start: '2026-07-20', end: '2026-07-24', label: '7月20日 - 7月24日' }),
  getAdjacentWeek: (k: string) => k,
  getCompletedTasksByCategory: () => [],
  getProjectProgressChanges: () => [],
  getNextWeekPlanCandidates: () => [],
  getCoordinationItems: () => [],
}));

// ---- Mock DataContext ----
const mockDispatch = vi.fn();
vi.mock('../DataContext', () => ({
  useData: () => ({
    data: {
      version: 1, lastModified: '2026-07-23T00:00:00.000Z',
      settings: {
        weeklySummaryDay: 5, monthlySummaryDay: 28, aiPolishFlag: false,
        categories: ['人力资源', '培训'],
      },
      projects: [],
      tasks: [],
      archives: {
        weeks: {
          '2026-W29': {
            tasks: [],
            summary: {
              doneTasks: '完成人员调配 3 项',
              projectProgress: '（本周无项目子任务推进）',
              nextWeekPlan: '（暂无待办任务）',
              blockers: '（无需协调事项）',
            },
            aiPolished: false,
          },
        },
        months: {},
        years: {},
      },
    },
    dispatch: mockDispatch,
    openDirectory: vi.fn(), saveData: vi.fn(),
    loading: false, error: null,
    hasStoredHandle: false, reopenStored: vi.fn(), lastFolderInfo: null,
    backendMode: false, backendFolderPath: null,
  }),
  DataProvider: ({ children }: any) => children,
}));

// ---- Mock Toast ----
const mockShowToast = vi.fn();
vi.mock('../Toast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
  ToastProvider: ({ children }: any) => children,
}));

vi.mock('../useHashRoute', () => ({
  useHashRoute: () => ({ path: '/', navigate: vi.fn() }),
}));

// ---- Import component (must follow the vi.mock declarations) ----
import { WeeklySummary } from '../WeeklySummary';

const WEEK_KEY = '2026-W29';

describe('F4 — AI 润色前端联调 (/api/polish)', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
    mockShowToast.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('成功后发起 POST /api/polish，dispatch 更新并标记 aiPolished', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ok: true, polished: '润色后的正式表述' }),
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<WeeklySummary />);
    // 有 entry → 四个 section 各有一个「请求润色」按钮；点击第一个（本周完成任务）
    fireEvent.click(screen.getAllByText('请求润色')[0]);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/polish');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.type).toBe('week');
    expect(body.text).toBe('完成人员调配 3 项');
    expect(body.config).toEqual({
      api_key: 'sk-test',
      endpoint: 'https://api.deepseek.com',
      model: 'deepseek-chat',
    });

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'UPDATE_ARCHIVE_WEEK' }),
      );
    });

    const action = mockDispatch.mock.calls
      .map((c) => c[0])
      .find((a) => a.type === 'UPDATE_ARCHIVE_WEEK');
    expect(action.payload.weekKey).toBe(WEEK_KEY);
    expect(action.payload.entry.aiPolished).toBe(true);
    expect(action.payload.entry.summary.doneTasks).toBe('润色后的正式表述');
    expect(mockShowToast).toHaveBeenCalledWith('AI 润色完成');
  });

  it('后端返回 { ok: false } 时展示错误信息，不 dispatch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: false, error: 'AI_API_KEY 未配置' }),
        }),
      ),
    );

    render(<WeeklySummary />);
    fireEvent.click(screen.getAllByText('请求润色')[0]);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('AI_API_KEY 未配置');
    });
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('网络失败时提示用户确认桌面应用已启动，不 dispatch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('no backend'))),
    );

    render(<WeeklySummary />);
    fireEvent.click(screen.getAllByText('请求润色')[0]);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('润色请求失败，请确认桌面应用已启动');
    });
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('请求进行中按钮进入 loading（润色中…），完成后恢复', async () => {
    let resolveFetch!: (v: unknown) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );

    render(<WeeklySummary />);
    fireEvent.click(screen.getAllByText('请求润色')[0]);

    // 点击后立即进入 loading
    await waitFor(() => {
      expect(screen.getAllByText('润色中…').length).toBeGreaterThan(0);
    });

    // 放行请求
    resolveFetch({
      ok: true,
      json: () => Promise.resolve({ ok: true, polished: 'x' }),
    });

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('AI 润色完成');
    });
  });
});
