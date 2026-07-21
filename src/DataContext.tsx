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
import { createTask, toggleTaskStatus, transitionTaskStatus, updateTask } from './taskUtils';

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
import { useFileSystem } from './useFileSystem';
import { debounce } from './useAutoSave';

// ============================================================
// Actions
// ============================================================

export type Action =
  | { type: 'SET_DATA'; payload: DataJson }
  | { type: 'ADD_TASK'; payload: { title: string; category: string; priority: Priority; projectId?: string | null } }
  | { type: 'TOGGLE_TASK'; payload: { taskId: string } }
  | { type: 'UPDATE_TASK'; payload: { taskId: string; patch: UpdateTaskPatch } }
  | { type: 'TRANSITION_STATUS'; payload: { taskId: string; newStatus: TaskStatus } }
  | { type: 'DELETE_TASK'; payload: { taskId: string } }
  | { type: 'UPDATE_SETTINGS'; payload: { patch: Partial<DataJson['settings']>; oldCategory?: string } }
  | { type: 'MOVE_URGENT_UP'; payload: { taskId: string } }
  | { type: 'MOVE_URGENT_DOWN'; payload: { taskId: string } }
  | { type: 'ADD_PROJECT'; payload: { title: string; category: string; startDate: string; targetDate: string; notes: string } }
  | { type: 'UPDATE_PROJECT'; payload: { projectId: string; patch: Partial<Pick<Project, 'title' | 'category' | 'startDate' | 'targetDate' | 'notes'>> } }
  | { type: 'ARCHIVE_PROJECT'; payload: { projectId: string } }
  | { type: 'UPDATE_ARCHIVE_WEEK'; payload: { weekKey: string; entry: import('./types').WeekEntry } }
  | { type: 'UPDATE_ARCHIVE_MONTH'; payload: { monthKey: string; entry: import('./types').MonthEntry } }
  | { type: 'UPDATE_ARCHIVE_YEAR'; payload: { yearKey: string; entry: import('./types').YearEntry } };

// ============================================================
// Reducer
// ============================================================

export function dataReducer(state: DataJson, action: Action): DataJson {
  switch (action.type) {
    case 'SET_DATA':
      return action.payload;

    case 'ADD_TASK': {
      const newTask = createTask({
        title: action.payload.title,
        category: action.payload.category,
        priority: action.payload.priority,
        projectId: action.payload.projectId ?? null,
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
  saveData: (data: DataJson) => Promise<void>;
  loading: boolean;
  error: string | null;
  hasStoredHandle: boolean;
  reopenStored: () => Promise<DataJson | null>;
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
  } = useFileSystem();

  const [data, dispatch] = useReducer(
    dataReducer,
    initialData ?? (null as unknown as DataJson),
  );

  // Sync initial data from FSA hook into reducer
  useEffect(() => {
    if (initialData) {
      dispatch({ type: 'SET_DATA', payload: initialData });
    }
  }, [initialData]);

  // Auto-save on data change (debounced 500ms)
  const debouncedSaveRef = useRef(
    debounce((d: DataJson) => {
      saveData(d);
    }, 500),
  );

  const isInitialRender = useRef(true);
  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    if (data) {
      debouncedSaveRef.current(data);
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
