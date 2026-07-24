import { useState, useCallback, useRef, useEffect } from 'react';
import { useData } from './DataContext';
import { useToast } from './Toast';
import { Icon } from './Icon';
import type { MonthEntry } from './types';
import { createTask } from './taskUtils';
import { useHashRoute } from './useHashRoute';
import { aiConfigPayload } from './aiConfig';
import {
  getMonthKey,
  getMonthLabel,
  getAdjacentMonth,
  aggregateMonthlyQuantities,
  getMonthlyProjectProgress,
  getNextMonthFocusCandidates,
} from './monthlyUtils';
import styles from './MonthlySummary.module.css';

export function MonthlySummary() {
  const { data, dispatch } = useData();
  const { showToast } = useToast();
  const { navigate } = useHashRoute();

  const today = new Date();
  const [year, setYear] = useState<number>(today.getFullYear());
  const [month, setMonth] = useState<number>(today.getMonth() + 1);
  const [planInput, setPlanInput] = useState('');

  // Refs for contentEditable sections
  const quantRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef<HTMLDivElement>(null);
  const reflectionRef = useRef<HTMLTextAreaElement>(null);
  const focusRef = useRef<HTMLDivElement>(null);

  if (!data) return null;

  const monthKey = getMonthKey(year, month);
  const monthLabel = getMonthLabel(year, month);
  const existingEntry = data.archives.months[monthKey];

  // ---- Generate template content ----
  const generateSummary = useCallback(() => {
    // Completed tasks this month (reused by Section 1 and task-ID collection)
    const monthDoneTasks = data.tasks
      .filter((t) => t.status === 'done')
      .filter((t) => {
        if (!t.completedDate) return false;
        const parts = t.completedDate.split('-');
        return parseInt(parts[0], 10) === year && parseInt(parts[1], 10) === month;
      });

    // Section 1: Quantitative summary table
    const quantities = aggregateMonthlyQuantities(data.tasks, year, month);
    let quantText = '';
    if (quantities.length === 0) {
      quantText = '（本月无量化产出）';
    } else {
      quantText = '| 分类 | 指标 | 合计 |\n|------|------|------|\n';
      for (const q of quantities) {
        quantText += `| ${q.category} | ${q.label} | ${q.value} ${q.unit} |\n`;
      }
    }

    // Section 1 追加：重点任务内容（标题 + 具体内容）
    const notedTasks = monthDoneTasks.filter((t) => t.notes.trim());
    if (notedTasks.length > 0) {
      quantText += '\n重点任务内容：\n';
      for (const t of notedTasks) {
        quantText += `- ${t.title}\n  具体内容：${t.notes.trim()}\n`;
      }
      quantText = quantText.trim();
    }

    // Section 2: Project progress review
    const projectChanges = getMonthlyProjectProgress(
      data.tasks,
      data.projects,
      year,
      month,
    );
    let projectText = '';
    if (projectChanges.length === 0) {
      projectText = '（本月无项目子任务推进）';
    } else {
      for (const p of projectChanges) {
        projectText += `${p.projectTitle}  ${p.beforePercent}% → ${p.afterPercent}%，本月完成 ${p.completedThisWeek.length} 项子任务\n`;
        for (const sub of p.completedThisWeek) {
          projectText += `  - ${sub}\n`;
        }
        projectText += '\n';
      }
      projectText = projectText.trim();
    }

    // Section 3: Monthly reflection (always empty for manual input)
    const reflectionText = existingEntry?.summary.reflection ?? '';

    // Section 4: Next month focus
    const focusCandidates = getNextMonthFocusCandidates(data.tasks, year, month);
    let focusText = '';
    if (focusCandidates.length === 0) {
      focusText = '（暂无下月到期任务）';
    } else {
      for (const f of focusCandidates) {
        focusText += `☐ [${f.category}] ${f.title}\n`;
      }
      focusText = focusText.trim();
    }

    // Collect task IDs for completed tasks this month
    const completedTaskIds = monthDoneTasks.map((t) => t.id);

    const entry: MonthEntry = {
      tasks: completedTaskIds,
      summary: {
        quantitativeSummary: quantText,
        projectReview: projectText,
        reflection: reflectionText,
        nextMonthFocus: focusText,
      },
      aiPolished: existingEntry?.aiPolished ?? false,
    };

    dispatch({ type: 'UPDATE_ARCHIVE_MONTH', payload: { monthKey, entry } });
    showToast('已生成本月小结');
  }, [data, year, month, dispatch, showToast, existingEntry]);

  // ---- Save section edits ----
  const saveSection = useCallback(
    (section: keyof MonthEntry['summary'], value: string) => {
      if (!existingEntry) return;
      dispatch({
        type: 'UPDATE_ARCHIVE_MONTH',
        payload: {
          monthKey,
          entry: {
            ...existingEntry,
            summary: { ...existingEntry.summary, [section]: value },
          },
        },
      });
    },
    [existingEntry, monthKey, dispatch],
  );

  const saveContentEditable = useCallback(
    (section: keyof MonthEntry['summary'], html: string) => {
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
      saveSection(section, text);
    },
    [saveSection],
  );

  // ---- AI polish ----
  const [polishingSection, setPolishingSection] = useState<string | null>(null);

  // ---- Generate Word summary document ----
  const [generatingDoc, setGeneratingDoc] = useState(false);

  const handleGenerateDoc = useCallback(async () => {
    if (!existingEntry) return;
    setGeneratingDoc(true);
    try {
      const sections = {
        '量化汇总表': existingEntry.summary.quantitativeSummary,
        '项目进度回顾': existingEntry.summary.projectReview,
        '月度反思': existingEntry.summary.reflection,
        '下月重点': existingEntry.summary.nextMonthFocus,
      };
      const resp = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'month', key: monthKey, sections, config: aiConfigPayload() }),
      });
      const result = await resp.json();
      if (result.ok) {
        showToast(`已生成：${result.path}`);
      } else {
        showToast(result.error || '生成总结文档失败');
      }
    } catch {
      showToast('生成失败，请确认桌面应用已启动');
    } finally {
      setGeneratingDoc(false);
    }
  }, [existingEntry, monthKey, showToast]);

  const requestAiPolish = useCallback(async (sectionKey: string, text: string) => {
    if (!existingEntry) return;
    setPolishingSection(sectionKey);
    try {
      const resp = await fetch('/api/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, type: 'month', config: aiConfigPayload() }),
      });
      const result = await resp.json();
      if (result.ok && result.polished) {
        dispatch({
          type: 'UPDATE_ARCHIVE_MONTH',
          payload: {
            monthKey,
            entry: {
              ...existingEntry,
              summary: { ...existingEntry.summary, [sectionKey]: result.polished },
              aiPolished: true,
            },
          },
        });
        showToast('AI 润色完成');
      } else {
        showToast(result.error || '润色失败，请检查 API 配置');
      }
    } catch {
      showToast('润色请求失败，请确认桌面应用已启动');
    } finally {
      setPolishingSection(null);
    }
  }, [existingEntry, monthKey, dispatch, showToast]);

  // ---- Add plan task ----
  const handleAddPlanTask = useCallback(() => {
    const title = planInput.trim();
    if (!title) return;
    const lastCat = data.settings.categories[data.settings.categories.length - 1] || '其他';
    const task = createTask({ title, category: lastCat, priority: 'normal' });
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

  // ---- Month navigation ----
  const goPrevMonth = () => {
    const prev = getAdjacentMonth(year, month, -1);
    setYear(prev.year);
    setMonth(prev.month);
  };
  const goNextMonth = () => {
    const next = getAdjacentMonth(year, month, 1);
    setYear(next.year);
    setMonth(next.month);
  };

  // ---- Sync contentEditable refs when entry changes ----
  useEffect(() => {
    if (existingEntry) {
      if (quantRef.current) quantRef.current.textContent = existingEntry.summary.quantitativeSummary;
      if (projectRef.current) projectRef.current.textContent = existingEntry.summary.projectReview;
      if (reflectionRef.current) reflectionRef.current.value = existingEntry.summary.reflection;
      if (focusRef.current) focusRef.current.textContent = existingEntry.summary.nextMonthFocus;
    }
  }, [existingEntry]);

  // Clear when no entry
  useEffect(() => {
    if (!existingEntry) {
      if (quantRef.current) quantRef.current.textContent = '';
      if (projectRef.current) projectRef.current.textContent = '';
      if (reflectionRef.current) reflectionRef.current.value = '';
      if (focusRef.current) focusRef.current.textContent = '';
    }
  }, [existingEntry]);

  return (
    <div className={styles.container}>
      <button className={styles.backBtn} onClick={() => navigate('/')}>
        <Icon name="arrow-left" size={16} /> 返回工作清单
      </button>
      <h2 className={styles.heading}>月小结</h2>

      {/* Month selector */}
      <div className={styles.monthSelector}>
        <button className={styles.monthBtn} onClick={goPrevMonth} aria-label="上一月">
          <Icon name="chevron-left" size={18} />
        </button>
        <span className={styles.monthLabel}>{monthLabel}</span>
        <button className={styles.monthBtn} onClick={goNextMonth} aria-label="下一月">
          <Icon name="chevron-right" size={18} />
        </button>
      </div>

      {/* Generate button */}
      {!existingEntry && (
        <button className={styles.generateBtn} onClick={generateSummary}>
          <Icon name="sparkles" size={16} /> 生成本月小结
        </button>
      )}

      {existingEntry && (
        <button
          className={`${styles.generateBtn} ${styles.regenerateBtn}`}
          onClick={generateSummary}
        >
          <Icon name="refresh-cw" size={16} /> 重新生成
        </button>
      )}

      {existingEntry && (
        <button
          className={`${styles.generateBtn} ${styles.summaryBtn}`}
          onClick={handleGenerateDoc}
          disabled={generatingDoc}
        >
          <Icon name="download" size={16} /> {generatingDoc ? '生成中…' : '生成总结文档'}
        </button>
      )}

      {existingEntry && (
        <div className={styles.sections}>
          {/* Section 1: 量化汇总表 */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>一、量化汇总表</h3>
              <button
                className={styles.aiBtn}
                onClick={() => requestAiPolish('quantitativeSummary', existingEntry.summary.quantitativeSummary)}
                disabled={polishingSection === 'quantitativeSummary'}
                title="请求 AI 润色"
              >
                <Icon name="bot" size={14} /> {polishingSection === 'quantitativeSummary' ? '润色中…' : '请求润色'}
              </button>
            </div>
            <div
              ref={quantRef}
              className={styles.editable}
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => saveContentEditable('quantitativeSummary', e.currentTarget.innerHTML)}
              data-testid="section-quant"
            />
          </div>

          {/* Section 2: 项目进度回顾 */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>二、项目进度回顾</h3>
              <button
                className={styles.aiBtn}
                onClick={() => requestAiPolish('projectReview', existingEntry.summary.projectReview)}
                disabled={polishingSection === 'projectReview'}
                title="请求 AI 润色"
              >
                <Icon name="bot" size={14} /> {polishingSection === 'projectReview' ? '润色中…' : '请求润色'}
              </button>
            </div>
            <div
              ref={projectRef}
              className={styles.editable}
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => saveContentEditable('projectReview', e.currentTarget.innerHTML)}
              data-testid="section-project"
            />
          </div>

          {/* Section 3: 月度反思 */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>三、月度反思</h3>
              <button
                className={styles.aiBtn}
                onClick={() => requestAiPolish('reflection', existingEntry.summary.reflection)}
                disabled={polishingSection === 'reflection'}
                title="请求 AI 润色"
              >
                <Icon name="bot" size={14} /> {polishingSection === 'reflection' ? '润色中…' : '请求润色'}
              </button>
            </div>
            <textarea
              ref={reflectionRef}
              className={styles.reflectionTextarea}
              placeholder="写写本月的收获与不足…"
              onBlur={(e) => saveSection('reflection', e.currentTarget.value)}
              data-testid="section-reflection"
            />
          </div>

          {/* Section 4: 下月重点 */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>四、下月重点</h3>
              <button
                className={styles.aiBtn}
                onClick={() => requestAiPolish('nextMonthFocus', existingEntry.summary.nextMonthFocus)}
                disabled={polishingSection === 'nextMonthFocus'}
                title="请求 AI 润色"
              >
                <Icon name="bot" size={14} /> {polishingSection === 'nextMonthFocus' ? '润色中…' : '请求润色'}
              </button>
            </div>
            <div
              ref={focusRef}
              className={styles.editable}
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => saveContentEditable('nextMonthFocus', e.currentTarget.innerHTML)}
              data-testid="section-focus"
            />
            <div className={styles.addPlanRow}>
              <input
                type="text"
                className={styles.planInput}
                placeholder="+ 添加下月任务（输入后回车）"
                value={planInput}
                onChange={(e) => setPlanInput(e.target.value)}
                onKeyDown={handlePlanKeyDown}
                data-testid="plan-input"
              />
            </div>
          </div>

          {/* Status indicator */}
          <div className={styles.statusBar}>
            {existingEntry.aiPolished ? (
              <span className={styles.statusOk}><Icon name="check-circle" size={14} /> 已润色</span>
            ) : (
              <span className={styles.statusPending}><Icon name="clock" size={14} /> 待 AI 润色</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
