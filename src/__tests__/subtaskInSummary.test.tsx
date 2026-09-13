/**
 * 子任务纳入周/月/年报总结 — 组件级生成内容验证
 *
 * 呈现规则（2026-09-08）：
 * - 周报第一段 = 【本周完成任务】+【进行中】两小节：
 *   本周完成任务逐行展示（有已勾子任务时行内列出已完成子步骤）；
 *   进行中 = 待办/进行中任务（含项目任务），已勾子任务 = 已完成、未勾 = 待开展（快照式）；
 *   远期任务（起始日期晚于本周末）不纳入周表，从其起始周起进入总结。
 * - 月报：「任务/项目推进」段项目与非项目均逐句；量化汇总末尾统计行仅计有真实日期的本月完成。
 * - 年报：维度要点内整单完成任务与推进父任务均逐句（含无日期已勾子任务）。
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
/**
 * 夹具用的「今天」：回退到最近的周一~周五工作日。
 * 周/月报按 ISO 周（周一~周五）归期，直接用周六/周日的日期做夹具会让
 * 「本周完成任务」「本周完成子任务」整体落空（该用例曾在周末必红）。
 */
const today = (() => {
  const d = new Date();
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
})();
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
      // 旧客户端勾选 → 无 completedDate：v2 打勾即完成，同样计入父行与子行
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

describe('周报：【本周完成任务】+【进行中】成行（带分类前缀）', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
  });

  it('本周完成任务逐行 `- [分类] 标题`（有已勾子任务则行内展示）；进行中任务展示已完成/待开展子任务', () => {
    render(<WeeklySummary />);
    fireEvent.click(screen.getByText('生成本周小结'));

    const entry = findDispatch('UPDATE_ARCHIVE_WEEK')!.payload.entry;
    const doneTasks = entry.summary.doneTasks as string;
    const projectText = entry.summary.projectProgress as string;

    // 本周完成任务：无已勾子任务 → 裸标题行；有已勾子任务 → 行内展示已完成
    expect(doneTasks).toContain(
      '【本周完成任务】\n- [绩效管理] 绩效考核任务：已完成发布子步一、发布子步二。',
    );
    // 进行中：已勾子任务 = 已完成，未勾 = 待开展（快照式）
    expect(doneTasks).toContain(
      '【进行中】\n- [内部招聘] 职称材料整理：已完成收集学历证明、汇总历史数据，待开展：生成评审名册。',
    );
    // 涉及子任务完成的项目任务同样纳入第一段进行中列表
    expect(doneTasks).toContain(
      '- [内部招聘] 考核系统联调：已完成完成系统联调。',
    );
    // 「长期项目推进」段保留项目进度百分比表述
    expect(projectText).toContain(
      '考核系统改造专项：进度 0% → 100%，本周完成 1 项子任务（完成系统联调）。',
    );
  });
});

describe('月报：任务/项目推进段成句与子任务统计', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
  });

  it('合并项目推进与非项目推进行（均逐句）；量化末尾追加完成子任务统计', () => {
    render(<MonthlySummary />);
    fireEvent.click(screen.getByText('生成本月小结'));

    const entry = findDispatch('UPDATE_ARCHIVE_MONTH')!.payload.entry;
    const quantText = entry.summary.quantitativeSummary as string;
    const projectText = entry.summary.projectReview as string;

    // 量化表 + 重点任务内容（整单完成句内联子步骤）+ 统计行（仅计有真实日期的本月完成）
    expect(quantText).toContain('| 绩效管理 | 考核 | 120 人 |');
    expect(quantText).toContain('重点任务内容：');
    expect(quantText).toContain(
      '绩效考核任务：已完成，完成子步骤 2/3 项（「发布子步一」「发布子步二」），具体内容：覆盖发布与复审两阶段。',
    );
    // t-done(2 项整单回退) + s4(有日期) + s7(项目有日期) → 4 项跨 3 个任务；
    // s5 无日期不计入「本月完成」统计行（无日期不冒充本月）
    expect(quantText).toContain('本月完成子任务 4 项（跨 3 个任务）');

    // 任务/项目推进：项目推进行 + 非项目推进中父任务行（均逐句、无分类）
    expect(projectText).toContain(
      '考核系统改造专项：进度 0% → 100%，本月完成 1 项子任务（完成系统联调）。',
    );
    expect(projectText).toContain(
      '职称材料整理：进行中，2/3 子步骤已完成（收集学历证明、汇总历史数据）。',
    );
    expect(projectText).not.toContain('【');
  });
});

describe('年报：维度要点成句（整单完成 + 推进中单列）', () => {
  it('自动要点文本按任务成句：整单完成句内联子步骤；推进父任务进行中句', () => {
    render(<YearlyReport />);

    // 绩效管理维度（整单完成）：完成句内联全部完成子任务标题（x<y 用计数式）
    expect(document.body.textContent).toContain('全年共 1 项任务');
    expect(document.body.textContent).toContain(
      '绩效考核任务：已完成，完成子步骤 2/3 项（「发布子步一」「发布子步二」），具体内容：覆盖发布与复审两阶段。',
    );
    // 项目推进维度（无整单完成，仅推进）：推进父任务进行中句
    // （打勾即完成，含 7 月完成项与无日期旧项）
    expect(document.body.textContent).toContain(
      '职称材料整理：进行中，2/3 子步骤已完成（收集学历证明、汇总历史数据）。',
    );
    expect(document.body.textContent).toContain(
      '考核系统联调：进行中，1/1 子步骤已完成（完成系统联调）。',
    );
    expect(document.body.textContent).toContain(
      '推进中（已勾子步骤为当前完成情况）：',
    );
    expect(document.body.textContent).not.toContain('- 【推进中】');
  });
});
