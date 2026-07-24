import { useState, useEffect, useCallback } from 'react';
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
import { Reports } from './Reports';
import { Icon } from './Icon';
import { ThemeProvider, PrimaryColorProvider } from './ThemeContext';
import { Sidebar } from './Sidebar';
import { Settings } from './Settings';
import { BottomNav } from './BottomNav';
import { HibernateDrawer } from './HibernateDrawer';
import { TitleBar } from './TitleBar';
import { WindowResizeHandles } from './WindowResizeHandles';
import { useWindowControls } from './useWindowControls';
import { useWindowDrag } from './useWindowDrag';
import { useWindowCollapse } from './useWindowCollapse';
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
    lastFolderInfo,
    backendMode,
    backendFolderPath,
  } = useData();

  const { showToast } = useToast();
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const { path, navigate } = useHashRoute();

  // Frameless desktop window bridge — in a plain browser every control
  // degrades gracefully (isDesktopWindow === false).
  const {
    isDesktopWindow,
    maximized,
    minimize,
    toggleMaximize,
    close,
  } = useWindowControls();

  // Title-bar drag — JS-driven (the native HTCAPTION move loop never
  // engages on the pywebview WinForms window).
  const { startDrag } = useWindowDrag({
    disabled: !isDesktopWindow || maximized,
  });

  // Collapse-to-titlebar — shrinks the OS window to the title bar and
  // hides the content area; expand restores the previous height.
  const { collapsed, toggleCollapse } = useWindowCollapse({
    disabled: !isDesktopWindow || maximized,
  });

  // Auto-reopen previously used folder on mount
  const [autoLoading, setAutoLoading] = useState(hasStoredHandle);
  const [reopenFailed, setReopenFailed] = useState(false);
  const [hibernateOpen, setHibernateOpen] = useState(false);

  const isReady = data !== null;

  useEffect(() => {
    if (hasStoredHandle && !data) {
      setAutoLoading(true);
      reopenStored()
        .then((result) => {
          if (!result) setReopenFailed(true);
        })
        .finally(() => setAutoLoading(false));
    }
  }, [hasStoredHandle, data, reopenStored]);

  // Show initial picker when no stored handle, or when stored handle reopen failed
  const showInitialPicker = !isReady && !autoLoading && (!hasStoredHandle || reopenFailed);

  // Split tasks into active and hibernating
  const { active: activeTasks, hibernating: hibernatingTasks } = data
    ? filterHibernatingTasks(data.tasks)
    : { active: [] as Task[], hibernating: [] as Task[] };

  const handleTransitionStatus = (taskId: string, newStatus: TaskStatus) => {
    dispatch({ type: 'TRANSITION_STATUS', payload: { taskId, newStatus } });
  };

  const handleUpdateTask = (taskId: string, patch: UpdateTaskPatch) => {
    dispatch({ type: 'UPDATE_TASK', payload: { taskId, patch } });

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

  const handleDeleteTask = useCallback(
    (taskId: string) => {
      dispatch({ type: 'DELETE_TASK', payload: { taskId } });
    },
    [dispatch],
  );

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

  // Route: project detail
  const projectDetailMatch = path.match(/^\/project\/(.+)$/);

  // Main-page header date, e.g. "7月23日 星期四"
  const dateLabel = new Date().toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  // ---- Build page content based on route ----
  let pageContent: React.ReactNode;

  if (projectDetailMatch) {
    pageContent = (
      <>
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
      </>
    );
  } else if (path === '/weekly') {
    pageContent = <WeeklySummary />;
  } else if (path === '/summary/monthly') {
    pageContent = <MonthlySummary />;
  } else if (path === '/summary/yearly') {
    pageContent = <YearlyReport />;
  } else if (path === '/projects') {
    pageContent = <ProjectsPage onNavigate={navigate} />;
  } else if (path === '/settings') {
    pageContent = <Settings />;
  } else if (path === '/reports') {
    pageContent = <Reports />;
  } else {
    pageContent = (
      <>
        <header className={styles.header}>
          <div className={styles.headerText}>
            <h1 className={styles.title}>{dateLabel}</h1>
            <p className={styles.subtitle}>个人工作管理 · 自动小结</p>
          </div>
          {isReady && hibernatingTasks.length > 0 && (
            <button
              type="button"
              className={styles.hibernateEntry}
              onClick={() => setHibernateOpen(true)}
            >
              <Icon name="moon" size={15} />
              <span>休眠 {hibernatingTasks.length}</span>
            </button>
          )}
        </header>

        {/* Auto-loading state */}
        {autoLoading && !isReady && (
          <div className={styles.folderBar}>
            <span className={styles.folderPath}>正在自动打开上次的文件夹…</span>
          </div>
        )}

        {/* Initial folder picker (no stored handle, or reopen failed) */}
        {showInitialPicker && (
          <div className={styles.folderBar}>
            <button
              className={styles.folderBtn}
              onClick={openDirectory}
              disabled={loading}
            >
              {loading ? '加载中…' : lastFolderInfo
                ? `重新打开「${lastFolderInfo.folderName}」`
                : '打开数据文件夹'}
            </button>
            <span className={styles.folderPath}>
              {lastFolderInfo
                ? `上次使用：${lastFolderInfo.folderName}（${new Date(lastFolderInfo.lastOpened).toLocaleDateString('zh-CN')}）`
                : '请选择包含 data.json 的文件夹（如 WPS 云文档/共享）'}
            </span>
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}

        {isReady && (
          <>
            <AddTaskForm onTaskAdded={handleAddTaskToast} />
            <TaskList
              tasks={activeTasks}
              categories={data.settings.categories}
              onTransitionStatus={handleTransitionStatus}
              onUpdateTask={handleUpdateTask}
              onEditTask={handleEditTask}
              onDeleteTask={handleDeleteTask}
              onMoveUrgentUp={handleMoveUrgentUp}
              onMoveUrgentDown={handleMoveUrgentDown}
              toast={showToast}
            />

            {/* Bottom folder bar: show current folder + change option */}
            <div className={styles.bottomFolderBar}>
              <span className={styles.bottomFolderLabel}>
                <Icon name="folder" size={14} />
                {backendMode
                  ? `默认文件夹：${backendFolderPath ?? '已配置'}（最后保存 ${data.lastModified ? new Date(data.lastModified).toLocaleString('zh-CN') : '—'}）`
                  : `数据文件夹：${data.lastModified ? `最后保存 ${new Date(data.lastModified).toLocaleString('zh-CN')}` : '已加载'}`}
              </span>
              <button
                className={styles.changeFolderBtn}
                onClick={openDirectory}
                disabled={loading}
                title={backendMode ? '临时切换到其他文件夹（重启后仍使用默认文件夹）' : '更换文件夹'}
              >
                {loading ? '…' : (backendMode ? '临时切换' : '更换文件夹')}
              </button>
            </div>
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
      </>
    );
  }

  // ---- BottomNav page derivation ----
  const bottomNavPage = (
    path === '/settings' ? 'settings' as const :
    path === '/' ? 'tasks' as const :
    'reports' as const
  );

  const handleBottomNav = (page: 'tasks' | 'reports' | 'settings') => {
    if (page === 'tasks') navigate('/');
    else if (page === 'reports') navigate('/reports');
    else navigate('/settings');
  };

  return (
    <>
      {/* Custom window chrome — drag region + collapse + min/max/close */}
      <TitleBar
        isDesktopWindow={isDesktopWindow}
        maximized={maximized}
        collapsed={collapsed}
        onStartDrag={startDrag}
        onToggleCollapse={toggleCollapse}
        onMinimize={minimize}
        onToggleMaximize={toggleMaximize}
        onClose={close}
      />

      {/* Frameless window resize grips (desktop window only) */}
      <WindowResizeHandles disabled={!isDesktopWindow || maximized || collapsed} />

      {/* Sidebar — handles its own visibility based on screen width */}
      {!collapsed && <Sidebar currentPath={path} onNavigate={navigate} />}

      {/* Scroll container — scrolling stays inside the rounded frame.
          display:none (not unmount) when collapsed so in-progress form
          state survives a collapse/expand cycle. */}
      <div
        className={styles.scroll}
        style={collapsed ? { display: 'none' } : undefined}
      >
        <div className={styles.app}>
          {pageContent}
        </div>
      </div>

      {/* Bottom navigation — mobile only */}
      {!collapsed && isReady && (
        <BottomNav
          currentPage={bottomNavPage}
          onNavigate={handleBottomNav}
          hibernatingCount={hibernatingTasks.length}
          onOpenHibernate={() => setHibernateOpen(true)}
        />
      )}

      {/* Hibernate drawer */}
      {!collapsed && hibernateOpen && (
        <HibernateDrawer
          tasks={hibernatingTasks}
          onClose={() => setHibernateOpen(false)}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <PrimaryColorProvider>
        <DataProvider>
          <ToastProvider>
            <AppShell />
          </ToastProvider>
        </DataProvider>
      </PrimaryColorProvider>
    </ThemeProvider>
  );
}
