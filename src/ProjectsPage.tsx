import { useState, useCallback } from 'react';
import type { Project } from './types';
import { useData, DEFAULT_CATEGORIES } from './DataContext';
import { calcProjectProgress, getProgressColor } from './taskUtils';
import { ConfirmDialog } from './ConfirmDialog';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';
import { Icon } from './Icon';
import styles from './ProjectsPage.module.css';

interface ProjectsPageProps {
  onNavigate: (to: string) => void;
}

export function ProjectsPage({ onNavigate }: ProjectsPageProps) {
  const { data, dispatch } = useData();
  const projects = data?.projects ?? [];
  const tasks = data?.tasks ?? [];
  const categories = data?.settings.categories ?? DEFAULT_CATEGORIES;

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState(categories[0]);
  const [formStartDate, setFormStartDate] = useState('');
  const [formTargetDate, setFormTargetDate] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Confirm delete state
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const deleteTargetProject = deleteProjectId ? projects.find(p => p.id === deleteProjectId) : null;

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    projectId: string | null;
  }>({ open: false, x: 0, y: 0, projectId: null });

  const activeProjects = projects.filter((p) => p.status !== 'archived');
  const archivedProjects = projects.filter((p) => p.status === 'archived');

  const resetForm = () => {
    setFormTitle('');
    setFormCategory(categories[0]);
    setFormStartDate('');
    setFormTargetDate('');
    setFormNotes('');
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (project: Project) => {
    setFormTitle(project.title);
    setFormCategory(project.category);
    setFormStartDate(project.startDate);
    setFormTargetDate(project.targetDate);
    setFormNotes(project.notes);
    setEditingId(project.id);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = formTitle.trim();
    if (!trimmed) return;

    if (editingId) {
      dispatch({
        type: 'UPDATE_PROJECT',
        payload: {
          projectId: editingId,
          patch: {
            title: trimmed,
            category: formCategory,
            startDate: formStartDate,
            targetDate: formTargetDate,
            notes: formNotes,
          },
        },
      });
    } else {
      dispatch({
        type: 'ADD_PROJECT',
        payload: {
          title: trimmed,
          category: formCategory,
          startDate: formStartDate || new Date().toISOString().slice(0, 10),
          targetDate: formTargetDate || '',
          notes: formNotes,
        },
      });
    }

    resetForm();
  };

  const handleArchive = (projectId: string) => {
    dispatch({ type: 'ARCHIVE_PROJECT', payload: { projectId } });
  };

  // Context menu
  const handleProjectContextMenu = useCallback(
    (e: React.MouseEvent, projectId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setCtxMenu({ open: true, x: e.clientX, y: e.clientY, projectId });
    },
    [],
  );

  const closeContextMenu = useCallback(() => {
    setCtxMenu((prev) => ({ ...prev, open: false }));
  }, []);

  // Build context menu items for the selected project
  const ctxProject = ctxMenu.projectId
    ? projects.find((p) => p.id === ctxMenu.projectId)
    : null;

  const ctxMenuItems: ContextMenuItem[] = ctxProject
    ? [
        {
          id: 'edit',
          label: '编辑',
          icon: 'pen-line',
          onClick: () => handleEdit(ctxProject),
        },
        { id: 'sep-1', label: '', separator: true },
        {
          id: 'delete',
          label: '删除',
          icon: 'x',
          danger: true,
          onClick: () => setDeleteProjectId(ctxProject.id),
        },
      ]
    : [];

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => onNavigate('/')}>
          <Icon name="arrow-left" size={16} /> 返回
        </button>
        <h1 className={styles.title}>项目</h1>
        <button
          className={styles.addBtn}
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
        >
          <Icon name="plus" size={16} /> 新建
        </button>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <form className={styles.form} onSubmit={handleSubmit}>
          <h3 className={styles.formTitle}>
            {editingId ? '编辑项目' : '新建项目'}
          </h3>
          <div className={styles.field}>
            <label className={styles.label}>项目名称</label>
            <input
              className={styles.input}
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="项目名称"
              autoFocus
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>分类</label>
            <select
              className={styles.select}
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.dateRow}>
            <div className={styles.field}>
              <label className={styles.label}>开始日期</label>
              <input
                className={styles.input}
                type="date"
                value={formStartDate}
                onChange={(e) => setFormStartDate(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>目标日期</label>
              <input
                className={styles.input}
                type="date"
                value={formTargetDate}
                onChange={(e) => setFormTargetDate(e.target.value)}
              />
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>备注</label>
            <textarea
              className={styles.textarea}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="备注…"
              rows={2}
            />
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={resetForm}>
              取消
            </button>
            <button type="submit" className={styles.submitBtn} disabled={!formTitle.trim()}>
              {editingId ? '保存' : '创建'}
            </button>
          </div>
        </form>
      )}

      {/* Active projects */}
      <div className={styles.list}>
        {activeProjects.length === 0 && archivedProjects.length === 0 && (
          <div className={styles.empty}>暂无项目，点击右上角"新建"创建第一个项目。</div>
        )}

        {activeProjects.map((project) => {
          const projectTasks = tasks.filter((t) => t.projectId === project.id);
          const progress = calcProjectProgress(projectTasks);
          const percent = progress.total > 0
            ? Math.floor((progress.done / progress.total) * 100)
            : 0;
          const activeCount = projectTasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled').length;
          const doneCount = projectTasks.filter((t) => t.status === 'done').length;

          return (
            <div
              key={project.id}
              className={styles.card}
              onContextMenu={(e) => handleProjectContextMenu(e, project.id)}
              onClick={() => onNavigate(`/project/${project.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onNavigate(`/project/${project.id}`);
              }}
            >
              <div className={styles.cardBody}>
                <div className={styles.cardTitle}>{project.title}</div>
                <div className={styles.cardMeta}>
                  <span className={styles.categoryTag}>{project.category}</span>
                  {project.targetDate && (
                    <span className={styles.dateTag}>
                      目标 {project.targetDate}
                    </span>
                  )}
                  <span className={styles.taskCount}>
                    {activeCount} 活跃 · {doneCount} 完成
                  </span>
                </div>
                {/* Progress bar */}
                {progress.total > 0 && (
                  <div className={styles.progressRow}>
                    <div className={styles.progressBar}>
                      <div
                        className={styles.progressFill}
                        style={{
                          width: `${percent}%`,
                          background: getProgressColor(percent),
                        }}
                      />
                    </div>
                    <span className={styles.progressText}>
                      {progress.done}/{progress.total}
                    </span>
                  </div>
                )}
              </div>
              <div className={styles.cardActions}>
                <button
                  className={styles.editBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(project);
                  }}
                  aria-label="编辑项目"
                >
                  编辑
                </button>
                <button
                  className={styles.archiveBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleArchive(project.id);
                  }}
                  aria-label="归档项目"
                >
                  归档
                </button>
                <button
                  className={styles.deleteBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteProjectId(project.id);
                  }}
                  aria-label="删除项目"
                >
                  删除
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Archived projects */}
      {archivedProjects.length > 0 && (
        <div className={styles.archivedSection}>
          <h3 className={styles.archivedTitle}>已归档 ({archivedProjects.length})</h3>
          {archivedProjects.map((project) => (
            <div
              key={project.id}
              className={`${styles.card} ${styles.cardArchived}`}
              onClick={() => onNavigate(`/project/${project.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onNavigate(`/project/${project.id}`);
              }}
            >
              <div className={styles.cardBody}>
                <div className={styles.cardTitle}>{project.title}</div>
                <div className={styles.cardMeta}>
                  <span className={styles.categoryTag}>{project.category}</span>
                  <span className={styles.archivedBadge}>已归档</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm delete dialog */}
      {deleteTargetProject && (
        <ConfirmDialog
          open={deleteProjectId !== null}
          title="确认删除"
          message={`确定要删除项目"${deleteTargetProject.title}"吗？该项目下的任务不会被删除，但会解除关联。此操作不可撤销。`}
          onConfirm={() => {
            dispatch({ type: 'DELETE_PROJECT', payload: { projectId: deleteTargetProject.id } });
            setDeleteProjectId(null);
          }}
          onCancel={() => setDeleteProjectId(null)}
        />
      )}

      {/* Right-click context menu */}
      <ContextMenu
        items={ctxMenuItems}
        x={ctxMenu.x}
        y={ctxMenu.y}
        open={ctxMenu.open}
        onClose={closeContextMenu}
      />
    </div>
  );
}
