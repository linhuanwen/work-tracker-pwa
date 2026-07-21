import { useState, useEffect, useRef, useCallback } from 'react';
import type { Task, TaskStatus } from './types';
import type { UpdateTaskPatch } from './taskUtils';
import { limitUrgentTasks, filterHibernatingTasks } from './taskUtils';
import { DataProvider, useData } from './DataContext';
import { AddTaskForm } from './AddTaskForm';
import { TaskList } from './TaskList';
import { TaskEditPanel } from './TaskEditPanel';
import { ToastProvider, useToast } from './Toast';
import { InstallBanner } from './InstallBanner';
import { useHashRoute } from './useHashRoute';
import { ProjectsPage } from './ProjectsPage';
import { ProjectDetailPage } from './ProjectDetailPage';
import { WeeklySummary } from './WeeklySummary';
import { MonthlySummary } from './MonthlySummary';
import { YearlyReport } from './YearlyReport';
import styles from './App.module.css';

function AppShell() {
  const {
    data,
    dispatch,
    openDirectory,
    loading,
    error,
    hasStoredHandle,
    reopenStored,
  } = useData();

  const { showToast } = useToast();
  const addFormRef = useRef<HTMLDivElement>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const { path, navigate } = useHashRoute();

  // Try to reopen previously used directory on mount
  useEffect(() => {
    if (hasStoredHandle && !data) {
      reopenStored();
    }
  }, [hasStoredHandle, data, reopenStored]);

  // Split tasks into active and hibernating
  const { active: activeTasks } = data
    ? filterHibernatingTasks(data.tasks)
    : { active: [] as Task[] };

  const handleTransitionStatus = (taskId: string, newStatus: TaskStatus) => {
    dispatch({ type: 'TRANSITION_STATUS', payload: { taskId, newStatus } });
  };

  const handleUpdateTask = (taskId: string, patch: UpdateTaskPatch) => {
    dispatch({ type: 'UPDATE_TASK', payload: { taskId, patch } });

    // If priority changed to urgent, check limit and auto-demote
    if (patch.priority === 'urgent' && data) {
      const updatedTasks: Task[] = data.tasks.map((t) =>
        t.id === taskId ? { ...t, ...patch } as Task : t,
      );
      const result = limitUrgentTasks(updatedTasks);
      if (result.demotedIds.length > 0) {
        result.demotedIds.forEach((id) => {
          dispatch({
            type: 'UPDATE_TASK',
            payload: { taskId: id, patch: { priority: 'important' } },
          });
        });
        showToast(
          `已自动降级 ${result.demotedIds.length} 条紧急任务为"重要"（上限 5 条）`,
        );
      }
    }
  };

  const handleEditTask = useCallback((task: Task) => {
    setEditingTask(task);
  }, []);

  const handleMoveUrgentUp = useCallback(
    (taskId: string) => {
      dispatch({ type: 'MOVE_URGENT_UP', payload: { taskId } });
    },
    [dispatch],
  );

  const handleMoveUrgentDown = useCallback(
    (taskId: string) => {
      dispatch({ type: 'MOVE_URGENT_DOWN', payload: { taskId } });
    },
    [dispatch],
  );

  const handleAddTaskToast = useCallback(() => {
    if (data) {
      const result = limitUrgentTasks(data.tasks);
      if (result.demotedIds.length > 0) {
        result.demotedIds.forEach((id) => {
          dispatch({
            type: 'UPDATE_TASK',
            payload: { taskId: id, patch: { priority: 'important' } },
          });
        });
        showToast(
          `已自动降级 ${result.demotedIds.length} 条紧急任务为"重要"（上限 5 条）`,
        );
      }
    }
  }, [data, dispatch, showToast]);

  const handleFabClick = useCallback(() => {
    addFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const titleInput = document.getElementById('task-title');
    if (titleInput) {
      titleInput.focus();
    }
  }, []);

  const isReady = data !== null;

  // Route: project detail
  const projectDetailMatch = path.match(/^\/project\/(.+)$/);
  if (projectDetailMatch) {
    return (
      <div className={styles.app}>
        <ProjectDetailPage
          projectId={projectDetailMatch[1]}
          onNavigate={navigate}
          onEditTask={(task) => setEditingTask(task)}
        />
        {editingTask && (
          <TaskEditPanel
            task={editingTask}
            onClose={() => setEditingTask(null)}
          />
        )}
      </div>
    );
  }

  // Route: weekly summary
  if (path === '/weekly') {
    return (
      <div className={styles.app}>
        <WeeklySummary />
      </div>
    );
  }

  // Route: monthly summary
  if (path === '/summary/monthly') {
    return (
      <div className={styles.app}>
        <MonthlySummary />
      </div>
    );
  }

  // Route: yearly report
  if (path === '/summary/yearly') {
    return (
      <div className={styles.app}>
        <YearlyReport />
      </div>
    );
  }

  // Route: projects list
  if (path === '/projects') {
    return (
      <div className={styles.app}>
        <ProjectsPage onNavigate={navigate} />
      </div>
    );
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>工作清单</h1>
        <p className={styles.subtitle}>个人工作管理 & 自动小结</p>
      </header>

      {/* Navigation */}
      {isReady && (
        <nav className={styles.nav}>
          <button
            className={styles.navBtn}
            onClick={() => navigate('/weekly')}
          >
            📋 周小结
          </button>
          <button
            className={styles.navBtn}
            onClick={() => navigate('/summary/monthly')}
          >
            📅 月小结
          </button>
          <button
            className={styles.navBtn}
            onClick={() => navigate('/summary/yearly')}
          >
            📊 年度报告
          </button>
          <button
            className={styles.navBtn}
            onClick={() => navigate('/projects')}
          >
            📁 项目
          </button>
        </nav>
      )}

      {!isReady && (
        <div className={styles.folderBar}>
          <button
            className={styles.folderBtn}
            onClick={openDirectory}
            disabled={loading}
          >
            {loading ? '加载中…' : '打开数据文件夹'}
          </button>
          <span className={styles.folderPath}>
            请选择 WPS 云文档文件夹（包含或将要创建 data.json）
          </span>
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {isReady && (
        <>
          <div ref={addFormRef}>
            <AddTaskForm onTaskAdded={handleAddTaskToast} />
          </div>
          <TaskList
            tasks={activeTasks}
            categories={data.settings.categories}
            onTransitionStatus={handleTransitionStatus}
            onUpdateTask={handleUpdateTask}
            onEditTask={handleEditTask}
            onMoveUrgentUp={handleMoveUrgentUp}
            onMoveUrgentDown={handleMoveUrgentDown}
            toast={showToast}
          />
          <button
            onClick={handleFabClick}
            style={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: '#4a6cf7',
              color: '#fff',
              border: 'none',
              fontSize: 24,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(74,108,247,0.3)',
              zIndex: 50,
            }}
            aria-label="添加任务"
          >
            +
          </button>
        </>
      )}

      {/* Edit modal (invoked from UrgentZone) */}
      {editingTask && (
        <TaskEditPanel
          task={editingTask}
          onClose={() => setEditingTask(null)}
        />
      )}

      <InstallBanner />
    </div>
  );
}

export default function App() {
  return (
    <DataProvider>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </DataProvider>
  );
}
