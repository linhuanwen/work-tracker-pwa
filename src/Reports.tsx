import { useState, useCallback } from 'react';
import { useData } from './DataContext';
import { useToast } from './Toast';
import { generateReportText } from './reportUtils';
import {
  getWeekKey,
  getWeekDateRange,
  getCompletedTasksByCategory,
  getWeeklyOngoingTasks,
} from './weeklyUtils';
import {
  formatCompletedTaskLine,
  formatOngoingTaskLine,
} from './summarySentences';
import { getMonthKey } from './monthlyUtils';
import { aiConfigPayload } from './aiConfig';
import { Icon } from './Icon';
import styles from './Reports.module.css';

type ReportTab = 'weekly' | 'monthly' | 'yearly';

export function Reports({ disabled = false }: { disabled?: boolean }) {
  const { data, dispatch, saveData, reopenStored, loading } = useData();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<ReportTab>('weekly');
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // 「更新」：先落盘内存中的编辑，再重读共享文件夹的最新数据并替换内存，
  // 让报表列表反映磁盘上（其他窗口/其他设备写入）的最新内容。
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (data) await saveData(data);
      const fresh = await reopenStored();
      if (fresh) {
        dispatch({ type: 'SET_DATA', payload: fresh });
        showToast('已更新为最新数据');
      } else {
        showToast('未找到共享数据文件，请先设置共享文件夹');
      }
    } catch {
      showToast('更新失败，请检查数据文件');
    } finally {
      setRefreshing(false);
    }
  }, [data, saveData, reopenStored, dispatch, showToast]);

  if (!data) return null;

  if (disabled) {
    return (
      <div className={styles.container}>
        <h2 className={styles.heading}>报表</h2>
        <div className={styles.disabledHint}>
          未设置共享文件夹，报表功能暂不启用。
          <br />
          请先到「设置 → 共享文件夹」完成云同步文件夹设置。
        </div>
      </div>
    );
  }

  const tabs: { key: ReportTab; label: string }[] = [
    { key: 'weekly', label: '周报' },
    { key: 'monthly', label: '月报' },
    { key: 'yearly', label: '年报' },
  ];

  // Placeholder content – will be replaced by actual report templates in #9 / #10
  const getReportSections = (): Record<string, string> => {
    const doneTasks = data.tasks.filter((t) => t.status === 'done');

    if (activeTab === 'weekly') {
      // 周报列表：只展示「本周完成任务」+「进行中」两小节（2026-09-08 定稿）：
      // - 本周完成任务：仅 status=done 且完成日落在当周的任务，逐行 `- [分类] 标题`
      // - 进行中：待办/进行中任务，有子任务则展示已完成/待开展（打勾=已完成，未勾=待开展）
      // - 远期任务（起始日期晚于本周末）不纳入；下周计划/需协调事项不再出现在列表
      const now = new Date();
      const weekKey = getWeekKey(now);
      const { end } = getWeekDateRange(weekKey);
      const reportTasks = data.tasks.filter(
        (t) => !t.startDate || t.startDate <= end,
      );

      const completedGroups = getCompletedTasksByCategory(
        reportTasks,
        weekKey,
        data.settings.categories,
      );
      const doneList: string[] = [];
      for (const group of completedGroups) {
        for (const item of group.tasks) {
          doneList.push(
            formatCompletedTaskLine({
              category: group.category,
              title: item.title,
              doneSubtaskTitles: item.doneSubtaskTitles,
            }),
          );
        }
      }

      const progressRows = getWeeklyOngoingTasks(reportTasks, end);
      const ongoingList = progressRows.map((row) =>
        formatOngoingTaskLine({
          category: row.category,
          title: row.title,
          doneTitles: row.doneTitles,
          todoTitles: row.todoTitles,
        }),
      );

      return {
        本周完成任务: doneList.length > 0 ? doneList.join('\n') : '（暂无）',
        进行中: ongoingList.length > 0 ? ongoingList.join('\n') : '（暂无）',
      };
    }
    if (activeTab === 'monthly') {
      return {
        量化汇总:
          doneTasks.length > 0
            ? `本月完成任务 ${doneTasks.length} 项`
            : '（暂无）',
        '任务/项目推进': '（暂无）',
        反思与下月重点: '（暂无）',
      };
    }
    return {
      日常工作: '（暂无）',
      项目推进: '（暂无）',
      协作沟通: '（暂无）',
      会议培训: '（暂无）',
      临时交办: '（暂无）',
      其他事务: '（暂无）',
      一句话总结: '（暂无）',
    };
  };

  const handleCopy = async () => {
    const sections = getReportSections();
    const text = generateReportText(sections);
    try {
      await navigator.clipboard.writeText(text);
      showToast('已复制');
    } catch {
      showToast('复制失败，请手动选择复制');
    }
  };

  /** 优先取归档小结内容；没有归档时退回当前 Tab 的预览内容。 */
  const getSummaryPayload = (): {
    type: 'week' | 'month' | 'year';
    key: string;
    sections: Record<string, string>;
  } => {
    const now = new Date();
    if (activeTab === 'weekly') {
      const key = getWeekKey(now);
      const entry = data.archives.weeks[key];
      if (entry) {
        return {
          type: 'week',
          key,
          sections: {
            本周完成任务: entry.summary.doneTasks,
            长期项目推进: entry.summary.projectProgress,
            下周计划: entry.summary.nextWeekPlan,
            需协调事项: entry.summary.blockers,
          },
        };
      }
      return { type: 'week', key, sections: getReportSections() };
    }
    if (activeTab === 'monthly') {
      const key = getMonthKey(now.getFullYear(), now.getMonth() + 1);
      const entry = data.archives.months[key];
      if (entry) {
        return {
          type: 'month',
          key,
          sections: {
            量化汇总表: entry.summary.quantitativeSummary,
            '任务/项目推进': entry.summary.projectReview,
            月度反思: entry.summary.reflection,
            下月重点: entry.summary.nextMonthFocus,
          },
        };
      }
      return { type: 'month', key, sections: getReportSections() };
    }
    const key = String(now.getFullYear());
    const entry = data.archives.years[key];
    if (entry) {
      return {
        type: 'year',
        key,
        sections: {
          日常工作: entry.summary.personnelAllocation,
          项目推进: entry.summary.internalRecruitment,
          协作沟通: entry.summary.rewardDiscipline,
          会议培训: entry.summary.performance,
          临时交办: entry.summary.laborRelations,
          其他事务: entry.summary.leaderAssigned,
          一句话总结: entry.summary.other,
        },
      };
    }
    return { type: 'year', key, sections: getReportSections() };
  };

  const handleGenerateSummary = async () => {
    setGenerating(true);
    try {
      const payload = getSummaryPayload();
      const resp = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, config: aiConfigPayload() }),
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
      setGenerating(false);
    }
  };

  const sections = getReportSections();

  // 当前统计周范围提示（周报 tab）：帮用户判断“哪些任务应该在本周列表里”
  const currentWeekLabel =
    activeTab === 'weekly'
      ? getWeekDateRange(getWeekKey(new Date())).label
      : null;

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>报表</h2>

      {/* Tabs */}
      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {currentWeekLabel && (
        <div className={styles.weekHint}>当周统计范围：{currentWeekLabel}</div>
      )}

      {/* Action buttons */}
      <div className={styles.actions}>
        <button
          className={styles.actionBtn}
          onClick={handleRefresh}
          disabled={refreshing || loading}
        >
          <Icon name="refresh-cw" size={16} /> {refreshing ? '更新中…' : '更新'}
        </button>
        <button className={styles.actionBtn} onClick={handleCopy}>
          <Icon name="copy" size={16} /> 复制
        </button>
        <button
          className={styles.actionBtn}
          onClick={handleGenerateSummary}
          disabled={generating}
        >
          <Icon name="download" size={16} />{' '}
          {generating ? '生成中…' : '生成总结'}
        </button>
      </div>

      {/* Preview */}
      <div className={styles.preview}>
        {Object.entries(sections).map(([title, content]) => (
          <div key={title} className={styles.section}>
            <h4 className={styles.sectionTitle}>【{title}】</h4>
            <pre className={styles.sectionContent}>{content}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
