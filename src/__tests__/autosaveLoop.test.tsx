import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

// Mock useFileSystem so we can drive the DataProvider autosave loop.
const saveDataMock = vi.fn();
let currentData: any = {
  version: 1,
  revision: 5,
  lastModified: '2026-07-23T00:00:00.000Z',
  settings: { weeklySummaryDay: 5, monthlySummaryDay: 28, aiPolishFlag: false, categories: ['A'] },
  projects: [],
  tasks: [],
  archives: { weeks: {}, months: {}, years: {} },
};

vi.mock('../useFileSystem', () => ({
  useFileSystem: () => ({
    data: currentData,
    openDirectory: vi.fn(),
    saveData: saveDataMock,
    loading: false,
    error: null,
    hasStoredHandle: true,
    reopenStored: vi.fn(),
    lastFolderInfo: null,
    backendMode: false,
    backendFolderPath: null,
  }),
}));

import React from 'react';
import { DataProvider, useData } from '../DataContext';

function useTestHarness() {
  const ctx = useData();
  return ctx;
}

describe('DataProvider autosave — no feedback loop / no clobber', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    saveDataMock.mockReset();
    currentData = {
      version: 1,
      revision: 5,
      lastModified: '2026-07-23T00:00:00.000Z',
      settings: { weeklySummaryDay: 5, monthlySummaryDay: 28, aiPolishFlag: false, categories: ['A'] },
      projects: [],
      tasks: [],
      archives: { weeks: {}, months: {}, years: {} },
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves once for one content edit; revision echo does not trigger another save', async () => {
    saveDataMock.mockResolvedValue({ revision: 6, lastModified: '2026-07-24T00:00:00.000Z' });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DataProvider>{children}</DataProvider>
    );
    const { result } = renderHook(() => useTestHarness(), { wrapper });

    // Baseline mount should not save.
    await act(async () => { await Promise.resolve(); });
    expect(saveDataMock).not.toHaveBeenCalled();

    // Simulate a content edit: add a task via dispatch.
    await act(async () => {
      result.current.dispatch({
        type: 'ADD_TASK',
        payload: { title: '新任务', category: 'A', priority: 'normal' },
      });
    });

    // Let debounce fire (500ms).
    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    // Exactly one save should have happened.
    expect(saveDataMock).toHaveBeenCalledTimes(1);

    // After the save resolved, APPLY_SAVED_REVISION changes revision only.
    // Let any further debounce timers fire; there must be NO second save.
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });
    expect(saveDataMock).toHaveBeenCalledTimes(1);
  });

  it('does not clobber edits made while a save is in-flight', async () => {
    // First save stays pending until we manually resolve it.
    let resolveFirst!: (v: { revision: number; lastModified: string }) => void;
    const firstSave = new Promise<{ revision: number; lastModified: string }>((resolve) => {
      resolveFirst = resolve;
    });
    saveDataMock
      .mockReturnValueOnce(firstSave)
      .mockResolvedValue({ revision: 7, lastModified: '2026-07-25T00:00:00.000Z' });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DataProvider>{children}</DataProvider>
    );
    const { result } = renderHook(() => useTestHarness(), { wrapper });

    // Baseline mount.
    await act(async () => { await Promise.resolve(); });
    expect(saveDataMock).not.toHaveBeenCalled();

    // Edit A → debounce fires → first save starts (A is persisted, pending).
    await act(async () => {
      result.current.dispatch({
        type: 'ADD_TASK',
        payload: { title: '任务A', category: 'A', priority: 'normal' },
      });
    });
    await act(async () => { vi.advanceTimersByTime(500); await Promise.resolve(); });
    expect(saveDataMock).toHaveBeenCalledTimes(1);

    // While first save is in-flight, user makes edit B.
    await act(async () => {
      result.current.dispatch({
        type: 'ADD_TASK',
        payload: { title: '任务B', category: 'A', priority: 'normal' },
      });
    });

    // Resolve first save (it must NOT replace reducer state with stale A-only snapshot).
    await act(async () => {
      resolveFirst({ revision: 6, lastModified: '2026-07-24T00:00:00.000Z' });
      await Promise.resolve();
    });

    // The reducer must still contain both edits (B not clobbered by A save echo).
    expect(result.current.data.tasks.map((t: any) => t.title)).toEqual(['任务A', '任务B']);

    // The pending/second debounce should persist the freshest data (with B).
    await act(async () => { vi.advanceTimersByTime(500); await Promise.resolve(); });
    expect(saveDataMock).toHaveBeenCalledTimes(2);
    const secondArg = saveDataMock.mock.calls[1][0];
    expect(secondArg.tasks.map((t: any) => t.title)).toEqual(['任务A', '任务B']);

    // No further echo-driven save.
    await act(async () => { vi.advanceTimersByTime(2000); await Promise.resolve(); });
    expect(saveDataMock).toHaveBeenCalledTimes(2);
  });
});
