/**
 * 子任务纳入周/月/年报总结 — 组件级生成内容验证
 *
 * 直接挂载三个总结页，点击「生成」后断言归档 entry 的 markdown：
 * - 周报：整单完成任务括注（完成子任务 n 项）；推进中父任务以【推进中】(x/y) 行 + 周期内子行挂在分类下；
 *   项目推进仍走「长期项目推进」段（父任务按子任务日期归因）。
 * - 月报：「任务/项目推进」段合并项目推进与非项目推进行；量化汇总末尾追加完成子任务统计。
 * - 年报：整单完成维度要点展开全部完成子任务标题；推进中父任务单列（按年度归因）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ---- Mock CSS modules ----
vi.mock('../WeeklySummary.module.css', () => ({ default: {} }));
vi.mock('../MonthlySummary.module.css', () => ({ default: {} }));
vi.mock('../YearlyReport.module.css', () => ({ default: {} }));

vi.mock('../Icon', () => ({ Icon: () => null }));
vi.mock('../aiConfig', () => ({
  aiConfigPayload: () => ({ api_key: 'sk-test' }),
}));

// ---- 固定 today，构造与本机一致但静态的归档 key 无关的样本 ----
const today = new Date().toISOString().slice(0, 10);
const pastDay = new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10);

const TASK_DONE = {
  id: 't-done',
  projectId: null,
  title: '绩效考核任务',
  category: '绩效管理',
  priority: 'normal',
  status: 'done',
  createdDate: today,
  updatedDate: today,
  deadline: null,
  startDate: null,
  completedDate: today,
  quantities: [{ label: '考核', value: 120, unit: '人' }],
  notes: '覆盖发布与复审两阶段',
  subtasks: [
    { id: 's1', title: '发布子步一', status: 'done' }, // 旧数据无日期 → 父任务回退
    { id: 's2', title: '发布子步二', status: 'done' },
    { id: 's3', title: '留待子步', status: 'todo' },
  ],
  isLeaderAssigned: false,
  isCrossYear: false,
  isBlocked: false,
};

const TASK_PROGRESS = {
  id: 't-progress',
  projectId: null,
  title: '职称材料整理',
  category: '内部招聘',
  priority: 'normal',
  status: 'in-progress',
  createdDate: pastDay,
  updatedDate: today,
  deadline: null,
  startDate: pastDay,
  completedDate: null,
  quantities: [],
  notes: '',
  subtasks: [
    { id: 's4', title: '收集学历证明', status: 'done', completedDate: today },
    {
      id: 's5',
      title: '汇总历史数据',
      status: 'done',
      completedDate: pastDay, // 早于本周期 → 只入计数不入子行
    },
    { id: 's6', title: '生成评审名册', status: 'todo' },
  ],
  isLeaderAssigned: false,
  isCrossYear: false,
  isBlocked: false,
};

const TASK_PROJECT = {
  id: 't-project',
  projectId: 'p-1',
  title: '考核系统联调',
  category: '内部招聘',
  priority: 'normal',
  status: 'in-progress',
  createdDate: pastDay,
  updatedDate: today,
  deadline: null,
  startDate: pastDay,
  completedDate: null,
  quantities: [],
  notes: '',
  subtasks: [
    { id: 's7', title: '完成系统联调', status: 'done', completedDate: today },
  ],
  isLeaderAssigned: false,
  isCrossYear: false,
  isBlocked: false,
};

// ---- Mock DataContext ----
const mockDispatch = vi.fn();
vi.mock('../DataContext', () => ({
  useData: () => ({
    data: {
      version: 1,
      revision: 0,
      lastModified: `${today}T00:00:00.000Z`,
      settings: {
        weeklySummaryDay: 5,
        monthlySummaryDay: 28,
        aiPolishFlag: false,
        categories: ['绩效管理', '内部招聘'],
      },
      projects: [
        {
          id: 'p-1',
          title: '考核系统改造专项',
          category: '内部招聘',
          status: 'in-progress',
          startDate: pastDay,
          targetDate: '2026-12-31',
          notes: '',
          subtaskCount: { total: 1, done: 1 },
        },
      ],
      tasks: [TASK_DONE, TASK_PROGRESS, TASK_PROJECT],
      archives: {
        weeks: {},
        months: {},
        years: {
          [String(new Date().getFullYear())]: {
            tasks: [],
            summary: {
              personnelAllocation: '',
              internalRecruitment: '',
              rewardDiscipline: '',
              performance: '',
              laborRelations: '',
              leaderAssigned: '',
              other: '',
            },
            aiPolished: false,
          },
        },
      },
    },
    dispatch: mockDispatch,
    openDirectory: vi.fn(),
    saveData: vi.fn(),
    loading: false,
    error: null,
    hasStoredHandle: false,
    reopenStored: vi.fn(),
    lastFolderInfo: null,
    backendMode: false,
    backendFolderPath: null,
  }),
  DataProvider: ({ children }: any) => children,
}));

vi.mock('../Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
  ToastProvider: ({ children }: any) => children,
}));
vi.mock('../useHashRoute', () => ({
  useHashRoute: () => ({ path: '/', navigate: vi.fn() }),
}));

// ---- Import components (must follow vi.mock declarations) ----
import { WeeklySummary } from '../WeeklySummary';
import { MonthlySummary } from '../MonthlySummary';
import { YearlyReport } from '../YearlyReport';

const findDispatch = (type: string) =>
  mockDispatch.mock.calls.map((c) => c[0]).find((a) => a && a.type === type);

describe('周报：子任务纳入「本周完成任务」', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
  });

  it('整单完成括注计数；推进中父任务父行 + 周期内子行；项目任务不混入该段', () => {
    render(<WeeklySummary />);
    fireEvent.click(screen.getByText('生成本周小结'));

    const entry = findDispatch('UPDATE_ARCHIVE_WEEK')!.payload.entry;
    const doneTasks = entry.summary.doneTasks as string;
    const projectText = entry.summary.projectProgress as string;

    // 整单完成：title +（量化，完成子任务 2 项），不展开子行
    expect(doneTasks).toContain('【绩效管理】');
    expect(doneTasks).toContain(
      '- 绩效考核任务（考核 120 人，完成子任务 2 项）',
    );
    // 推进中父任务挂在所属分类下：父行 x/y（x=全部已完成，含历史周期）+ 本周完成子行；
    // 早于本周期的完成子任务只入计数不展开
    expect(doneTasks).toContain('- 【推进中】职称材料整理（2/3 已完成）');
    expect(doneTasks).toContain('  - 收集学历证明');
    expect(doneTasks).not.toContain('  - 汇总历史数据');
    // 项目任务仍归「长期项目推进」段
    expect(doneTasks).not.toContain('考核系统联调');
    expect(projectText).toContain('考核系统改造专项');
    expect(projectText).toContain('  - 完成系统联调');
    // 项目进度按真实日期归因（父任务未整单完成也计入）
    expect(projectText).toContain('本周完成 1 项子任务');
  });
});

describe('月报：任务/项目推进段与子任务统计', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
  });

  it('合并项目推进与非项目推进行；量化末尾追加完成子任务统计', () => {
    render(<MonthlySummary />);
    fireEvent.click(screen.getByText('生成本月小结'));

    const entry = findDispatch('UPDATE_ARCHIVE_MONTH')!.payload.entry;
    const quantText = entry.summary.quantitativeSummary as string;
    const projectText = entry.summary.projectReview as string;

    // 量化表 + 重点任务内容（整单完成括注）+ 统计行
    expect(quantText).toContain('| 绩效管理 | 考核 | 120 人 |');
    expect(quantText).toContain('- 绩效考核任务（完成子任务 2 项）');
    // t-done(2 项回退) + t-progress(1) + t-project(1) → 跨 3 个任务
    expect(quantText).toContain('本月完成子任务 4 项（跨 3 个任务）');

    // 任务/项目推进：项目推进行 + 非项目推进中父任务父行/子行
    expect(projectText).toContain(
      '考核系统改造专项  0% → 100%，本月完成 1 项子任务',
    );
    expect(projectText).toContain('  - 完成系统联调');
    expect(projectText).toContain('- 【推进中】职称材料整理（2/3 已完成）');
    expect(projectText).toContain('  - 收集学历证明');
    expect(projectText).not.toContain('  - 汇总历史数据');
  });
});

describe('年报：维度要点展开子任务、推进中父任务单列', () => {
  it('自动要点文本包含整单完成子任务展开与推进中父任务行', () => {
    render(<YearlyReport />);

    // 绩效管理维度（整单完成）：任务行下展开全部完成子任务标题
    expect(document.body.textContent).toContain('全年共 1 项任务');
    expect(document.body.textContent).toContain('- 绩效考核任务');
    expect(document.body.textContent).toContain('  - 发布子步一');
    expect(document.body.textContent).toContain('  - 发布子步二');
    // 内部招聘维度（无整单完成，仅推进）：推进中父任务按年度归因单列，
    // 年度内完成的子任务全部展开（7 月与本月均属 2026 年）
    expect(document.body.textContent).toContain(
      '- 【推进中】职称材料整理（2/3 已完成）',
    );
    expect(document.body.textContent).toContain('  - 收集学历证明');
    expect(document.body.textContent).toContain('  - 汇总历史数据');
    expect(document.body.textContent).toContain(
      '- 【推进中】考核系统联调（1/1 已完成）',
    );
  });
});
