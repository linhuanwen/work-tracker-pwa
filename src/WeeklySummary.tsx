import { useState, useCallback, useRef, useEffect } from 'react';
import { useData } from './DataContext';
import { useToast } from './Toast';
import type { WeekEntry } from './types';
import {
  getWeekKey,
  getWeekDateRange,
  getAdjacentWeek,
  getCompletedTasksByCategory,
  getProjectProgressChanges,
  getNextWeekPlanCandidates,
  getCoordinationItems,
} from './weeklyUtils';
import { createTask } from './taskUtils';
import styles from './WeeklySummary.module.css';

export function WeeklySummary() {
  const { data, dispatch } = useData();
  const { showToast } = useToast();

  const today = new Date();
  const [weekKey, setWeekKey] = useState<string>(() => getWeekKey(today));
  const [planInput, setPlanInput] = useState('');

  // Refs for contentEditable sections
  const doneRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef<HTMLDivElement>(null);
  const planRef = useRef<HTMLDivElement>(null);
  const blockersRef = useRef<HTMLDivElement>(null);

  if (!data) return null;

  const range = getWeekDateRange(weekKey);
  const existingEntry = data.archives.weeks[weekKey];

  // ---- Generate template content ----
  const generateSummary = useCallback(() => {
    // Section 1: Completed tasks by category
    const categoryGroups = getCompletedTasksByCategory(
      data.tasks,
      weekKey,
      data.settings.categories,
    );
    let doneText = '';
    if (categoryGroups.length === 0) {
      doneText = '（本周无完成任务）';
    } else {
      for (const group of categoryGroups) {
        doneText += `【${group.category}】\n`;
        for (const item of group.tasks) {
          const line = item.quantityText
            ? `- ${item.title}（${item.quantityText}）\n`
            : `- ${item.title}\n`;
          doneText += line;
        }
        doneText += '\n';
      }
      doneText = doneText.trim();
    }

    // Section 2: Project progress
    const projectChanges = getProjectProgressChanges(
      data.tasks,
      data.projects,
      weekKey,
    );
    let projectText = '';
    if (projectChanges.length === 0) {
      projectText = '（本周无项目子任务推进）';
    } else {
      for (const p of projectChanges) {
        projectText += `${p.projectTitle}  ${p.beforePercent}% → ${p.afterPercent}%，本周完成 ${p.completedThisWeek.length} 项子任务\n`;
        for (const sub of p.completedThisWeek) {
          projectText += `  - ${sub}\n`;
        }
        projectText += '\n';
      }
      projectText = projectText.trim();
    }

    // Section 3: Next week plan
    const planCandidates = getNextWeekPlanCandidates(data.tasks, today);
    let planText = '';
    if (planCandidates.length === 0) {
      planText = '（暂无待办任务）';
    } else {
      for (const p of planCandidates) {
        planText += `☐ ${p.title}\n`;
      }
      planText = planText.trim();
    }

    // Section 4: Coordination items
    const coordItems = getCoordinationItems(data.tasks, today);
    let blockersText = '';
    if (coordItems.length === 0) {
      blockersText = '（无需协调事项）';
    } else {
      for (const item of coordItems) {
        const reasonLabel = item.reason === 'blocked' ? '🔴 阻塞' : '⚠️ 停滞';
        blockersText += `- ${reasonLabel} ${item.title}（最后更新：${item.lastUpdated}）\n`;
      }
      blockersText = blockersText.trim();
    }

    // Collect task IDs for completed tasks this week
    const completedTaskIds = data.tasks
      .filter((t) => t.status === 'done')
      .filter((t) => {
        const { start, end } = getWeekDateRange(weekKey);
        return t.completedDate && t.completedDate >= start && t.completedDate <= end;
      })
      .map((t) => t.id);

    const entry: WeekEntry = {
      tasks: completedTaskIds,
      summary: {
        doneTasks: doneText,
        projectProgress: projectText,
        nextWeekPlan: planText,
        blockers: blockersText,
      },
      aiPolished: existingEntry?.aiPolished ?? false,
    };

    dispatch({ type: 'UPDATE_ARCHIVE_WEEK', payload: { weekKey, entry } });
    showToast('已生成本周小结');
  }, [data, weekKey, dispatch, showToast, existingEntry, today]);

  // ---- Save section edits ----
  const saveSection = useCallback(
    (section: keyof WeekEntry['summary'], html: string) => {
      if (!existingEntry) return;
      // Convert HTML to plain text (handle <br>, <div>, etc.)
      const text = html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<div>/gi, '\n')
        .replace(/<\/div>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();

      dispatch({
        type: 'UPDATE_ARCHIVE_WEEK',
        payload: {
          weekKey,
          entry: {
            ...existingEntry,
            summary: { ...existingEntry.summary, [section]: text },
          },
        },
      });
    },
    [existingEntry, weekKey, dispatch],
  );

  // ---- AI polish ----
  const requestAiPolish = useCallback(() => {
    if (!existingEntry) return;
    dispatch({
      type: 'UPDATE_ARCHIVE_WEEK',
      payload: {
        weekKey,
        entry: { ...existingEntry, aiPolished: false },
      },
    });
    showToast('已标记为待 AI 润色，等待本地脚本处理');
  }, [existingEntry, weekKey, dispatch, showToast]);

  // ---- Add plan task ----
  const handleAddPlanTask = useCallback(() => {
    const title = planInput.trim();
    if (!title) return;
    const task = createTask({
      title,
      category: data.settings.categories[data.settings.categories.length - 1] || '其他',
      priority: 'normal',
    });
    // Use dispatch directly since we have generated an ID
    dispatch({ type: 'SET_DATA', payload: { ...data, tasks: [...data.tasks, task] } });
    setPlanInput('');
    showToast(`已添加任务：${title}`);
  }, [planInput, data, dispatch, showToast]);

  const handlePlanKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddPlanTask();
      }
    },
    [handleAddPlanTask],
  );

  // ---- Week navigation ----
  const goPrevWeek = () => setWeekKey((w) => getAdjacentWeek(w, -1));
  const goNextWeek = () => setWeekKey((w) => getAdjacentWeek(w, 1));

  // ---- Sync contentEditable refs when entry changes ----
  useEffect(() => {
    if (existingEntry) {
      if (doneRef.current) doneRef.current.textContent = existingEntry.summary.doneTasks;
      if (projectRef.current) projectRef.current.textContent = existingEntry.summary.projectProgress;
      if (planRef.current) planRef.current.textContent = existingEntry.summary.nextWeekPlan;
      if (blockersRef.current) blockersRef.current.textContent = existingEntry.summary.blockers;
    }
  }, [existingEntry]);

  // Clear contentEditable refs when no entry exists
  useEffect(() => {
    if (!existingEntry) {
      if (doneRef.current) doneRef.current.textContent = '';
      if (projectRef.current) projectRef.current.textContent = '';
      if (planRef.current) planRef.current.textContent = '';
      if (blockersRef.current) blockersRef.current.textContent = '';
    }
  }, [existingEntry]);

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>周小结</h2>

      {/* Week selector */}
      <div className={styles.weekSelector}>
        <button className={styles.weekBtn} onClick={goPrevWeek} aria-label="上一周">
          ←
        </button>
        <span className={styles.weekLabel}>{range.label}</span>
        <button className={styles.weekBtn} onClick={goNextWeek} aria-label="下一周">
          →
        </button>
      </div>

      {/* Generate button */}
      {!existingEntry && (
        <button className={styles.generateBtn} onClick={generateSummary}>
          ✨ 生成本周小结
        </button>
      )}

      {existingEntry && (
        <button
          className={styles.generateBtn}
          onClick={generateSummary}
          style={{ opacity: 0.7, marginBottom: 4 }}
        >
          🔄 重新生成
        </button>
      )}

      {existingEntry && (
        <div className={styles.sections}>
          {/* Section 1: 本周完成任务 */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>一、本周完成任务</h3>
              <button
                className={styles.aiBtn}
                onClick={requestAiPolish}
                title="请求 AI 润色"
              >
                🤖 请求润色
              </button>
            </div>
            <div
              ref={doneRef}
              className={styles.editable}
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => saveSection('doneTasks', e.currentTarget.innerHTML)}
              data-testid="section-done"
            />
          </div>

          {/* Section 2: 长期项目推进 */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>二、长期项目推进</h3>
              <button
                className={styles.aiBtn}
                onClick={requestAiPolish}
                title="请求 AI 润色"
              >
                🤖 请求润色
              </button>
            </div>
            <div
              ref={projectRef}
              className={styles.editable}
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => saveSection('projectProgress', e.currentTarget.innerHTML)}
              data-testid="section-project"
            />
          </div>

          {/* Section 3: 下周计划 */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>三、下周计划</h3>
              <button
                className={styles.aiBtn}
                onClick={requestAiPolish}
                title="请求 AI 润色"
              >
                🤖 请求润色
              </button>
            </div>
            <div
              ref={planRef}
              className={styles.editable}
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => saveSection('nextWeekPlan', e.currentTarget.innerHTML)}
              data-testid="section-plan"
            />
            <div className={styles.addPlanRow}>
              <input
                type="text"
                className={styles.planInput}
                placeholder="+ 添加计划（输入后回车）"
                value={planInput}
                onChange={(e) => setPlanInput(e.target.value)}
                onKeyDown={handlePlanKeyDown}
                data-testid="plan-input"
              />
            </div>
          </div>

          {/* Section 4: 需协调事项 */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>四、需协调事项</h3>
              <button
                className={styles.aiBtn}
                onClick={requestAiPolish}
                title="请求 AI 润色"
              >
                🤖 请求润色
              </button>
            </div>
            <div
              ref={blockersRef}
              className={styles.editable}
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => saveSection('blockers', e.currentTarget.innerHTML)}
              data-testid="section-blockers"
            />
          </div>

          {/* Status indicator */}
          <div className={styles.statusBar}>
            {existingEntry.aiPolished ? (
              <span className={styles.statusOk}>✅ 已润色</span>
            ) : (
              <span className={styles.statusPending}>⏳ 待 AI 润色</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
