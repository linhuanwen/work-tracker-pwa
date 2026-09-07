import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import type { DataJson, Task, Project, Priority, TaskStatus } from './types';
import { DEFAULT_CATEGORIES } from './types';
import {
  createTask,
  toggleTaskStatus,
  transitionTaskStatus,
  updateTask,
} from './taskUtils';

// ============================================================
// Project helpers
// ============================================================

let _projIdCounter = 0;

function generateProjectId(): string {
  _projIdCounter += 1;
  return `p-${Date.now().toString(36)}-${_projIdCounter.toString(36)}`;
}

function createProject(input: {
  title: string;
  category: string;
  startDate: string;
  targetDate: string;
  notes: string;
}): Project {
  return {
    id: generateProjectId(),
    title: input.title,
    category: input.category,
    status: 'in-progress',
    startDate: input.startDate,
    targetDate: input.targetDate,
    notes: input.notes,
    subtaskCount: { total: 0, done: 0 },
  };
}
import type { UpdateTaskPatch } from './taskUtils';
import { useFileSystem, type SaveResult } from './useFileSystem';
import { debounce } from './useAutoSave';

// ============================================================
// Actions
// ============================================================

export type Action =
  | { type: 'SET_DATA'; payload: DataJson }
  | {
      type: 'APPLY_SAVED_REVISION';
      payload: { revision: number; lastModified: string };
    }
  | {
      type: 'ADD_TASK';
      payload: {
        title: string;
        category: string;
        priority: Priority;
        projectId?: string | null;
        deadline?: string | null;
        startDate?: string | null;
      };
    }
  | { type: 'TOGGLE_TASK'; payload: { taskId: string } }
  | { type: 'UPDATE_TASK'; payload: { taskId: string; patch: UpdateTaskPatch } }
  | {
      type: 'TRANSITION_STATUS';
      payload: { taskId: string; newStatus: TaskStatus };
    }
  | { type: 'DELETE_TASK'; payload: { taskId: string } }
  | {
      type: 'UPDATE_SETTINGS';
      payload: { patch: Partial<DataJson['settings']>; oldCategory?: string };
    }
  | { type: 'MOVE_URGENT_UP'; payload: { taskId: string } }
  | { type: 'MOVE_URGENT_DOWN'; payload: { taskId: string } }
  | {
      type: 'ADD_PROJECT';
      payload: {
        title: string;
        category: string;
        startDate: string;
        targetDate: string;
        notes: string;
      };
    }
  | {
      type: 'UPDATE_PROJECT';
      payload: {
        projectId: string;
        patch: Partial<
          Pick<
            Project,
            'title' | 'category' | 'startDate' | 'targetDate' | 'notes'
          >
        >;
      };
    }
  | { type: 'ARCHIVE_PROJECT'; payload: { projectId: string } }
  | { type: 'DELETE_PROJECT'; payload: { projectId: string } }
  | {
      type: 'UPDATE_ARCHIVE_WEEK';
      payload: { weekKey: string; entry: import('./types').WeekEntry };
    }
  | {
      type: 'UPDATE_ARCHIVE_MONTH';
      payload: { monthKey: string; entry: import('./types').MonthEntry };
    }
  | {
      type: 'UPDATE_ARCHIVE_YEAR';
      payload: { yearKey: string; entry: import('./types').YearEntry };
    };

// ============================================================
// Reducer
// ============================================================

export function dataReducer(state: DataJson, action: Action): DataJson {
  switch (action.type) {
    case 'SET_DATA':
      return action.payload;

    // 只更新保存后由后端/磁盘返回的版本元信息，不替换整个 state，
    // 从而避免与正在进行的编辑产生竞态（旧实现会用 setData→SET_DATA 覆盖全量状态）。
    case 'APPLY_SAVED_REVISION':
      return {
        ...state,
        revision: action.payload.revision,
        lastModified: action.payload.lastModified,
      };

    case 'ADD_TASK': {
      const newTask = createTask({
        title: action.payload.title,
        category: action.payload.category,
        priority: action.payload.priority,
        projectId: action.payload.projectId ?? null,
        deadline: action.payload.deadline ?? null,
        startDate: action.payload.startDate ?? null,
      });
      return {
        ...state,
        tasks: [...state.tasks, newTask],
      };
    }

    case 'ADD_PROJECT': {
      const newProject = createProject(action.payload);
      return {
        ...state,
        projects: [...state.projects, newProject],
      };
    }

    case 'UPDATE_PROJECT': {
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.payload.projectId
            ? { ...p, ...action.payload.patch }
            : p,
        ),
      };
    }

    case 'ARCHIVE_PROJECT': {
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.payload.projectId
            ? { ...p, status: 'archived' as const }
            : p,
        ),
      };
    }

    case 'DELETE_PROJECT': {
      return {
        ...state,
        projects: state.projects.filter(
          (p) => p.id !== action.payload.projectId,
        ),
      };
    }

    case 'TOGGLE_TASK': {
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.payload.taskId ? toggleTaskStatus(t) : t,
        ),
      };
    }

    case 'UPDATE_TASK': {
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.payload.taskId
            ? updateTask(t, action.payload.patch)
            : t,
        ),
      };
    }

    case 'TRANSITION_STATUS': {
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.payload.taskId
            ? transitionTaskStatus(t, action.payload.newStatus)
            : t,
        ),
      };
    }

    case 'DELETE_TASK': {
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.payload.taskId),
      };
    }

    case 'UPDATE_SETTINGS': {
      const { patch, oldCategory } = action.payload;
      const newSettings = { ...state.settings, ...patch };

      // Category rename: update all tasks using the old category name
      let updatedTasks = state.tasks;
      if (
        oldCategory &&
        patch.categories &&
        patch.categories !== state.settings.categories
      ) {
        // Find which category was renamed by comparing old and new lists
        const oldList = state.settings.categories;
        const newList = patch.categories;
        const newCat = newList.find((c) => !oldList.includes(c));
        if (newCat) {
          updatedTasks = state.tasks.map((t) =>
            t.category === oldCategory ? { ...t, category: newCat } : t,
          );
        }
      }

      return {
        ...state,
        settings: newSettings,
        tasks: updatedTasks,
      };
    }

    case 'MOVE_URGENT_UP': {
      const tasks = [...state.tasks];
      const idx = tasks.findIndex(
        (t) =>
          t.id === action.payload.taskId &&
          t.priority === 'urgent' &&
          t.status !== 'cancelled',
      );
      if (idx <= 0) return state;
      let prevIdx = idx - 1;
      while (prevIdx >= 0 && tasks[prevIdx].priority !== 'urgent') {
        prevIdx--;
      }
      if (prevIdx < 0) return state;
      [tasks[idx], tasks[prevIdx]] = [tasks[prevIdx], tasks[idx]];
      return { ...state, tasks };
    }

    case 'MOVE_URGENT_DOWN': {
      const tasks = [...state.tasks];
      const idx = tasks.findIndex(
        (t) =>
          t.id === action.payload.taskId &&
          t.priority === 'urgent' &&
          t.status !== 'cancelled',
      );
      if (idx < 0) return state;
      let nextIdx = idx + 1;
      while (nextIdx < tasks.length && tasks[nextIdx].priority !== 'urgent') {
        nextIdx++;
      }
      if (nextIdx >= tasks.length) return state;
      [tasks[idx], tasks[nextIdx]] = [tasks[nextIdx], tasks[idx]];
      return { ...state, tasks };
    }

    case 'UPDATE_ARCHIVE_WEEK': {
      return {
        ...state,
        archives: {
          ...state.archives,
          weeks: {
            ...state.archives.weeks,
            [action.payload.weekKey]: action.payload.entry,
          },
        },
      };
    }

    case 'UPDATE_ARCHIVE_MONTH': {
      return {
        ...state,
        archives: {
          ...state.archives,
          months: {
            ...state.archives.months,
            [action.payload.monthKey]: action.payload.entry,
          },
        },
      };
    }

    case 'UPDATE_ARCHIVE_YEAR': {
      return {
        ...state,
        archives: {
          ...state.archives,
          years: {
            ...state.archives.years,
            [action.payload.yearKey]: action.payload.entry,
          },
        },
      };
    }

    default:
      return state;
  }
}

// ============================================================
// Context
// ============================================================

interface DataContextValue {
  data: DataJson | null;
  dispatch: React.Dispatch<Action>;
  openDirectory: () => Promise<DataJson>;
  saveData: (data: DataJson) => Promise<SaveResult | null>;
  loading: boolean;
  error: string | null;
  hasStoredHandle: boolean;
  reopenStored: () => Promise<DataJson | null>;
  lastFolderInfo: { folderName: string; lastOpened: string } | null;
  backendMode: boolean;
  backendFolderPath: string | null;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const {
    data: initialData,
    openDirectory,
    saveData,
    loading: fsLoading,
    error: fsError,
    hasStoredHandle,
    reopenStored,
    lastFolderInfo,
    backendMode,
    backendFolderPath,
  } = useFileSystem();

  const [data, dispatch] = useReducer(
    dataReducer,
    initialData ?? (null as unknown as DataJson),
  );

  // ---- 自动保存 ----
  // 设计要点：
  //  1. 只保存“内容有变化”的数据：用内容指纹（排除 revision / lastModified）判断
  //     是否真的需要写盘，从而避免保存回写 revision 后再次触发保存的死循环。
  //  2. 保存执行时用 dataRef 取“当时最新的 reducer 状态”，而不是 debounce 排定时
  //     捕获的快照，避免保存期间用户继续输入导致数据被旧快照覆盖（输入被清空）。
  //  3. 保存成功后仅通过 APPLY_SAVED_REVISION 把新 revision 写回 reducer（不替换全量
  //     状态），保留用户进行中的编辑。
  const dataRef = useRef(data);
  dataRef.current = data;

  const lastSavedFingerprintRef = useRef<string | null>(null);

  const contentFingerprint = (d: DataJson): string =>
    JSON.stringify({
      tasks: d.tasks,
      projects: d.projects,
      archives: d.archives,
      settings: d.settings,
    });

  // Sync initial data from FSA hook into reducer。
  // 注意：只在加载（打开/重开文件夹）时同步，自动保存成功后【不】回调 setData，
  // 因此这里的 initialData 不会因普通保存而改变 → 打破“保存→SET_DATA→再保存”的死循环。
  useEffect(() => {
    if (initialData) {
      // 刚加载的数据已经在磁盘上，重置“已保存内容基线”，避免刚打开就触发一次多余保存。
      lastSavedFingerprintRef.current = contentFingerprint(initialData);
      dispatch({ type: 'SET_DATA', payload: initialData });
    }
  }, [initialData]);

  const debouncedSaveRef = useRef(
    debounce(async () => {
      const current = dataRef.current;
      if (!current) return;
      const result = await saveData(current);
      if (!result) return; // 保存失败/冲突，revision 已停下，等用户处理
      lastSavedFingerprintRef.current = contentFingerprint(current);
      dispatch({
        type: 'APPLY_SAVED_REVISION',
        payload: {
          revision: result.revision,
          lastModified: result.lastModified,
        },
      });
    }, 500),
  );

  // 自动保存触发：仅“内容有变化”时才写盘。
  // - 首次拿到数据（打开/重开文件夹）时以当前内容为基线，不触发保存；
  // - 之后若内容指纹与上次成功保存的内容一致，说明只是 revision 回写导致的重渲染，
  //   同样不触发，从而避免“保存→回写 revision→再保存”的死循环。
  useEffect(() => {
    if (!data) return;
    if (lastSavedFingerprintRef.current === null) {
      lastSavedFingerprintRef.current = contentFingerprint(data);
      return;
    }
    const fp = contentFingerprint(data);
    if (fp !== lastSavedFingerprintRef.current) {
      debouncedSaveRef.current();
    }
  }, [data]);

  const value: DataContextValue = {
    data,
    dispatch,
    openDirectory,
    saveData,
    loading: fsLoading,
    error: fsError,
    hasStoredHandle,
    reopenStored,
    lastFolderInfo,
    backendMode,
    backendFolderPath,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error('useData must be used within a DataProvider');
  }
  return ctx;
}

export { DEFAULT_CATEGORIES, type Task, type Priority };
