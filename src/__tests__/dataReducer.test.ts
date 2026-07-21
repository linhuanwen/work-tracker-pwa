import { describe, it, expect } from 'vitest';
import type { DataJson, WeekEntry, MonthEntry, YearEntry } from '../types';
import { createDefaultDataJson } from '../types';
import { dataReducer } from '../DataContext';

/**
 * Seam 3: Reducer extension — archive persistence + auto updatedDate
 *
 * Tests that the dataReducer correctly handles new actions:
 * - UPDATE_ARCHIVE_WEEK: persists weekly summary to archives.weeks
 * - UPDATE_ARCHIVE_MONTH: persists monthly summary to archives.months
 * - UPDATE_ARCHIVE_YEAR: persists yearly report to archives.years
 * - UPDATE_TASK: auto-sets updatedDate via taskUtils.updateTask
 * - TRANSITION_STATUS: auto-sets updatedDate via taskUtils.transitionTaskStatus
 */

function makeData(overrides?: Partial<DataJson>): DataJson {
  return { ...createDefaultDataJson(), ...overrides };
}

describe('dataReducer — UPDATE_ARCHIVE_WEEK', () => {
  it('saves a WeekEntry to archives.weeks[weekKey]', () => {
    const state = makeData();
    const weekEntry: WeekEntry = {
      tasks: ['t-1', 't-2'],
      summary: {
        doneTasks: '- 任务A\n- 任务B',
        projectProgress: '项目X 50% → 67%',
        nextWeekPlan: '- 任务C',
        blockers: '（无）',
      },
      aiPolished: false,
    };

    const next = dataReducer(state, {
      type: 'UPDATE_ARCHIVE_WEEK',
      payload: { weekKey: '2026-W30', entry: weekEntry },
    });

    expect(next.archives.weeks['2026-W30']).toEqual(weekEntry);
  });

  it('overwrites existing week entry for the same key', () => {
    const oldEntry: WeekEntry = {
      tasks: ['t-old'],
      summary: { doneTasks: 'old', projectProgress: '', nextWeekPlan: '', blockers: '' },
      aiPolished: true,
    };
    const state = makeData();
    state.archives.weeks['2026-W30'] = oldEntry;

    const newEntry: WeekEntry = {
      tasks: ['t-new'],
      summary: { doneTasks: 'new', projectProgress: '', nextWeekPlan: '', blockers: '' },
      aiPolished: false,
    };

    const next = dataReducer(state, {
      type: 'UPDATE_ARCHIVE_WEEK',
      payload: { weekKey: '2026-W30', entry: newEntry },
    });

    expect(next.archives.weeks['2026-W30']).toEqual(newEntry);
  });

  it('preserves other week entries', () => {
    const state = makeData();
    const existingEntry: WeekEntry = {
      tasks: ['t-existing'],
      summary: { doneTasks: 'old week', projectProgress: '', nextWeekPlan: '', blockers: '' },
      aiPolished: false,
    };
    state.archives.weeks['2026-W29'] = existingEntry;

    const newEntry: WeekEntry = {
      tasks: ['t-new'],
      summary: { doneTasks: 'new week', projectProgress: '', nextWeekPlan: '', blockers: '' },
      aiPolished: false,
    };

    const next = dataReducer(state, {
      type: 'UPDATE_ARCHIVE_WEEK',
      payload: { weekKey: '2026-W30', entry: newEntry },
    });

    expect(next.archives.weeks['2026-W29']).toEqual(existingEntry);
    expect(next.archives.weeks['2026-W30']).toEqual(newEntry);
  });

  it('does not mutate the previous state (immutability)', () => {
    const state = makeData();
    const entry: WeekEntry = {
      tasks: ['t-1'],
      summary: { doneTasks: 'test', projectProgress: '', nextWeekPlan: '', blockers: '' },
      aiPolished: false,
    };

    const next = dataReducer(state, {
      type: 'UPDATE_ARCHIVE_WEEK',
      payload: { weekKey: '2026-W30', entry },
    });

    expect(next).not.toBe(state);
    expect(next.archives).not.toBe(state.archives);
    expect(next.archives.weeks).not.toBe(state.archives.weeks);
  });

  it('preserves months and years archives unchanged', () => {
    const state = makeData();
    const entry: WeekEntry = {
      tasks: ['t-1'],
      summary: { doneTasks: 'test', projectProgress: '', nextWeekPlan: '', blockers: '' },
      aiPolished: false,
    };

    const next = dataReducer(state, {
      type: 'UPDATE_ARCHIVE_WEEK',
      payload: { weekKey: '2026-W30', entry },
    });

    expect(next.archives.months).toBe(state.archives.months);
    expect(next.archives.years).toBe(state.archives.years);
  });
});

describe('dataReducer — UPDATE_ARCHIVE_MONTH', () => {
  it('saves a MonthEntry to archives.months[monthKey]', () => {
    const state = makeData();
    const monthEntry: MonthEntry = {
      tasks: ['t-1', 't-2'],
      summary: {
        quantitativeSummary: '| 内部招聘 | 资格审查 | 45 人次 |',
        projectReview: '项目X 50% → 67%',
        reflection: '本月工作顺利推进',
        nextMonthFocus: '- 下月任务A\n- 下月任务B',
      },
      aiPolished: false,
    };

    const next = dataReducer(state, {
      type: 'UPDATE_ARCHIVE_MONTH',
      payload: { monthKey: '2026-07', entry: monthEntry },
    });

    expect(next.archives.months['2026-07']).toEqual(monthEntry);
  });

  it('preserves weeks and years archives unchanged', () => {
    const state = makeData();
    const monthEntry: MonthEntry = {
      tasks: ['t-1'],
      summary: {
        quantitativeSummary: 'test',
        projectReview: '',
        reflection: '',
        nextMonthFocus: '',
      },
      aiPolished: false,
    };

    const next = dataReducer(state, {
      type: 'UPDATE_ARCHIVE_MONTH',
      payload: { monthKey: '2026-07', entry: monthEntry },
    });

    expect(next.archives.weeks).toBe(state.archives.weeks);
    expect(next.archives.years).toBe(state.archives.years);
  });
});

describe('dataReducer — UPDATE_ARCHIVE_YEAR', () => {
  it('saves a YearEntry to archives.years[yearKey]', () => {
    const state = makeData();
    const yearEntry: YearEntry = {
      tasks: ['t-1', 't-2'],
      summary: {
        personnelAllocation: '全年完成调配 5 人次',
        internalRecruitment: '全年完成资格审查 138 人次，助力晋升 12 人',
        rewardDiscipline: '',
        performance: '全年完成考核 4 次',
        laborRelations: '',
        leaderAssigned: '',
        other: '',
      },
      aiPolished: false,
    };

    const next = dataReducer(state, {
      type: 'UPDATE_ARCHIVE_YEAR',
      payload: { yearKey: '2026', entry: yearEntry },
    });

    expect(next.archives.years['2026']).toEqual(yearEntry);
  });

  it('preserves weeks and months archives unchanged', () => {
    const state = makeData();
    const yearEntry: YearEntry = {
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
    };

    const next = dataReducer(state, {
      type: 'UPDATE_ARCHIVE_YEAR',
      payload: { yearKey: '2026', entry: yearEntry },
    });

    expect(next.archives.weeks).toBe(state.archives.weeks);
    expect(next.archives.months).toBe(state.archives.months);
  });
});

describe('dataReducer — updatedDate auto-set', () => {
  it('UPDATE_TASK sets updatedDate to today', () => {
    const state = makeData({
      tasks: [
        {
          id: 't-1',
          projectId: null,
          title: '旧标题',
          category: '其他',
          priority: 'normal',
          status: 'todo',
          createdDate: '2026-07-01',
          updatedDate: '2026-07-01',
          deadline: null,
          completedDate: null,
          quantities: [],
          subtasks: [],
          notes: '',
          isLeaderAssigned: false,
          isCrossYear: false,
          isBlocked: false,
        },
      ],
    });

    const today = new Date().toISOString().slice(0, 10);
    const next = dataReducer(state, {
      type: 'UPDATE_TASK',
      payload: { taskId: 't-1', patch: { title: '新标题' } },
    });

    expect(next.tasks[0].updatedDate).toBe(today);
  });

  it('TRANSITION_STATUS sets updatedDate to today', () => {
    const state = makeData({
      tasks: [
        {
          id: 't-1',
          projectId: null,
          title: '任务',
          category: '其他',
          priority: 'normal',
          status: 'todo',
          createdDate: '2026-07-01',
          updatedDate: '2026-07-01',
          deadline: null,
          completedDate: null,
          quantities: [],
          subtasks: [],
          notes: '',
          isLeaderAssigned: false,
          isCrossYear: false,
          isBlocked: false,
        },
      ],
    });

    const today = new Date().toISOString().slice(0, 10);
    const next = dataReducer(state, {
      type: 'TRANSITION_STATUS',
      payload: { taskId: 't-1', newStatus: 'done' },
    });

    expect(next.tasks[0].updatedDate).toBe(today);
    expect(next.tasks[0].status).toBe('done');
    expect(next.tasks[0].completedDate).toBe(today);
  });
});
