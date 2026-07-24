import { useState, useCallback, useRef, useEffect } from 'react';
import { useData } from './DataContext';
import { useToast } from './Toast';
import { Icon } from './Icon';
import type { YearEntry } from './types';
import {
  YEARLY_DIMENSIONS,
  getYearlyTasksByDimension,
  buildMonthlyTrendTable,
  buildYearlyQuantityTable,
  generateYearlyOneLiner,
} from './yearlyUtils';
import { useHashRoute } from './useHashRoute';
import { aiConfigPayload } from './aiConfig';
import styles from './YearlyReport.module.css';

/** Map a dimension to the corresponding YearEntry summary field */
function dimToField(dim: string): keyof YearEntry['summary'] {
  switch (dim) {
    case '人员配置': return 'personnelAllocation';
    case '内部招聘（晋升晋等）': return 'internalRecruitment';
    case '奖惩管理': return 'rewardDiscipline';
    case '绩效管理': return 'performance';
    case '劳动关系': return 'laborRelations';
    case '领导交办': return 'leaderAssigned';
    default: return 'other';
  }
}

export function YearlyReport() {
  const { data, dispatch } = useData();
  const { showToast } = useToast();
  const { navigate } = useHashRoute();

  const today = new Date();
  const [year, setYear] = useState<number>(today.getFullYear());

  // Refs for keypoint textareas (one per dimension)
  const keypointRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const oneLinerRef = useRef<HTMLTextAreaElement>(null);

  if (!data) return null;

  const yearKey = String(year);
  const existingEntry = data.archives.years[yearKey];
  const categories = data.settings.categories;

  // ---- Auto-generated content (always computed from tasks) ----
  const dimensionData = getYearlyTasksByDimension(data.tasks, year, categories);
  const monthlyTrend = buildMonthlyTrendTable(data.tasks, year, categories);
  const quantityTable = buildYearlyQuantityTable(data.tasks, year);
  const autoOneLiner = generateYearlyOneLiner(data.tasks, year, categories);

  /** Build auto-generated text for a dimension */
  const buildAutoText = (dim: (typeof dimensionData)[number]): string => {
    if (dim.taskCount === 0) return '（本年度该维度无完成任务）';

    let text = `全年共 ${dim.taskCount} 项任务`;
    if (dim.quantities.length > 0) {
      const parts = dim.quantities.map((q) => `${q.label} ${q.value} ${q.unit}`);
      text += `，量化产出：${parts.join('，')}`;
    }
    text += '\n\n任务列表：\n';
    dim.taskTitles.forEach((title, i) => {
      text += `- ${title}\n`;
      const notes = dim.taskNotes[i];
      if (notes) {
        text += `  具体内容：${notes}\n`;
      }
    });
    return text.trim();
  };

  // ---- Generate template content ----
  const generateReport = useCallback(() => {
    // Copy existing keypoint texts
    const existingSummaries = existingEntry?.summary ?? {
      personnelAllocation: '',
      internalRecruitment: '',
      rewardDiscipline: '',
      performance: '',
      laborRelations: '',
      leaderAssigned: '',
      other: '',
    };

    // Collected task IDs
    const completedTaskIds = data.tasks
      .filter((t) => t.status === 'done')
      .filter((t) => {
        if (!t.completedDate) return false;
        return parseInt(t.completedDate.slice(0, 4), 10) === year;
      })
      .map((t) => t.id);

    const entry: YearEntry = {
      tasks: completedTaskIds,
      summary: {
        personnelAllocation: existingSummaries.personnelAllocation,
        internalRecruitment: existingSummaries.internalRecruitment,
        rewardDiscipline: existingSummaries.rewardDiscipline,
        performance: existingSummaries.performance,
        laborRelations: existingSummaries.laborRelations,
        leaderAssigned: existingSummaries.leaderAssigned,
        other: existingSummaries.other || autoOneLiner,
      },
      aiPolished: existingEntry?.aiPolished ?? false,
    };

    dispatch({ type: 'UPDATE_ARCHIVE_YEAR', payload: { yearKey, entry } });
    showToast('已生成年度报告');
  }, [data, year, yearKey, dispatch, showToast, existingEntry, autoOneLiner]);

  // ---- Save keypoint for a dimension ----
  const saveKeypoint = useCallback(
    (dim: string, value: string) => {
      const field = dimToField(dim);
      const current = existingEntry ?? {
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
      dispatch({
        type: 'UPDATE_ARCHIVE_YEAR',
        payload: {
          yearKey,
          entry: {
            ...current,
            summary: { ...current.summary, [field]: value },
          },
        },
      });
    },
    [existingEntry, yearKey, dispatch],
  );

  // ---- Save one-liner ----
  const saveOneLiner = useCallback(
    (value: string) => {
      const current = existingEntry ?? {
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
      dispatch({
        type: 'UPDATE_ARCHIVE_YEAR',
        payload: {
          yearKey,
          entry: { ...current, summary: { ...current.summary, other: value } },
        },
      });
    },
    [existingEntry, yearKey, dispatch],
  );

  // ---- AI polish ----
  const [polishing, setPolishing] = useState(false);

  // ---- Generate Word summary document ----
  const [generatingDoc, setGeneratingDoc] = useState(false);

  const handleGenerateDoc = useCallback(async () => {
    if (!existingEntry) return;
    setGeneratingDoc(true);
    try {
      const sections: Record<string, string> = {};
      for (const dim of YEARLY_DIMENSIONS) {
        const field = dimToField(dim);
        sections[dim] = existingEntry.summary[field] || '';
      }
      sections['一句话总结'] = existingEntry.summary.other || autoOneLiner;

      const resp = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'year', key: yearKey, sections, config: aiConfigPayload() }),
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
  }, [existingEntry, yearKey, autoOneLiner, showToast]);

  const requestAiPolish = useCallback(async () => {
    if (!existingEntry) return;
    setPolishing(true);
    // Combine all section texts for polishing
    const combinedText = Object.entries(existingEntry.summary)
      .map(([key, value]) => `【${key}】\n${value}`)
      .join('\n\n');
    try {
      const resp = await fetch('/api/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: combinedText, type: 'year', config: aiConfigPayload() }),
      });
      const result = await resp.json();
      if (result.ok) {
        dispatch({
          type: 'UPDATE_ARCHIVE_YEAR',
          payload: {
            yearKey,
            entry: { ...existingEntry, aiPolished: true },
          },
        });
        showToast('AI 润色完成');
      } else {
        showToast(result.error || '润色失败，请检查 API 配置');
      }
    } catch {
      showToast('润色请求失败，请确认桌面应用已启动');
    } finally {
      setPolishing(false);
    }
  }, [existingEntry, yearKey, dispatch, showToast]);

  // ---- Sync keypoint refs when entry changes ----
  useEffect(() => {
    if (existingEntry) {
      for (const dim of YEARLY_DIMENSIONS) {
        const field = dimToField(dim);
        const ref = keypointRefs.current[dim];
        if (ref) ref.value = existingEntry.summary[field] || '';
      }
      if (oneLinerRef.current) {
        oneLinerRef.current.value = existingEntry.summary.other || autoOneLiner;
      }
    }
  }, [existingEntry, autoOneLiner]);

  const oneLinerValue = existingEntry?.summary?.other || autoOneLiner;

  return (
    <div className={styles.container}>
      <button className={styles.backBtn} onClick={() => navigate('/')}>
        <Icon name="arrow-left" size={16} /> 返回工作清单
      </button>
      <h2 className={styles.heading}>年度报告</h2>

      {/* Year selector */}
      <div className={styles.yearSelector}>
        <button className={styles.yearBtn} onClick={() => setYear((y) => y - 1)} aria-label="上一年">
          <Icon name="chevron-left" size={18} />
        </button>
        <span className={styles.yearLabel}>{year}年</span>
        <button className={styles.yearBtn} onClick={() => setYear((y) => y + 1)} aria-label="下一年">
          <Icon name="chevron-right" size={18} />
        </button>
      </div>

      {/* Generate button */}
      {!existingEntry && (
        <button className={styles.generateBtn} onClick={generateReport}>
          <Icon name="sparkles" size={16} /> 生成年度报告
        </button>
      )}

      {existingEntry && (
        <button
          className={`${styles.generateBtn} ${styles.regenerateBtn}`}
          onClick={generateReport}
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
          {/* AI polish button at top */}
          <div className={styles.aiBtnRow}>
            <button className={styles.aiBtn} onClick={requestAiPolish} disabled={polishing}>
              <Icon name="bot" size={14} /> {polishing ? '润色中…' : '请求 AI 润色'}
            </button>
          </div>

          {/* Six dimension blocks */}
          {dimensionData.map((dim, idx) => {
            const field = dimToField(dim.dimension);
            const keypointText = existingEntry.summary[field] || '';
            const isEmpty = dim.taskCount === 0;

            return (
              <div key={dim.dimension} className={isEmpty ? styles.dimSectionEmpty : styles.dimSection}>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle}>
                    {idx + 1}. {dim.dimension}
                  </h3>
                </div>

                {/* Auto-generated preview */}
                <div className={styles.autoPreview}>
                  {buildAutoText(dim)}
                </div>

                {/* Manual keypoint textarea */}
                <div className={styles.keypointLabel}><Icon name="pen-line" size={14} /> 关键业绩提炼：</div>
                <textarea
                  ref={(el) => { keypointRefs.current[dim.dimension] = el; }}
                  className={styles.keypointTextarea}
                  placeholder="手动提炼关键业绩…"
                  defaultValue={keypointText}
                  onBlur={(e) => saveKeypoint(dim.dimension, e.currentTarget.value)}
                  data-testid={`keypoint-${idx}`}
                />
              </div>
            );
          })}

          {/* 附 table 1: Monthly trend table */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>附表一：月度趋势表</h3>
            </div>
            <div className={styles.tableWrapper}>
              <table className={styles.auxTable}>
                <thead>
                  <tr>
                    <th>月份</th>
                    {categories.map((cat) => (
                      <th key={cat}>{cat}</th>
                    ))}
                    <th>合计</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyTrend.map((row) => (
                    <tr key={row.month}>
                      <td>{row.month}</td>
                      {categories.map((cat) => (
                        <td key={cat}>{row.categoryCounts[cat] || 0}</td>
                      ))}
                      <td className={styles.boldCell}>{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 附 table 2: Yearly quantity output table */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>附表二：全年量化产出总表</h3>
            </div>
            {quantityTable.length === 0 ? (
              <p className={styles.emptyState}>
                （本年度无量化产出记录）
              </p>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.auxTable}>
                  <thead>
                    <tr>
                      <th>指标</th>
                      <th>合计</th>
                      <th>单位</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quantityTable.map((q) => (
                      <tr key={q.label}>
                        <td>{q.label}</td>
                        <td className={styles.boldCell}>{q.value}</td>
                        <td>{q.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 一句话总结 */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>一句话总结</h3>
            </div>
            <textarea
              ref={oneLinerRef}
              className={styles.oneLinerEditor}
              defaultValue={oneLinerValue}
              onBlur={(e) => saveOneLiner(e.currentTarget.value)}
              data-testid="one-liner"
            />
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
