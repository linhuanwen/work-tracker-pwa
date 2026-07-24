import { useState } from 'react';
import { useData } from './DataContext';
import { useToast } from './Toast';
import { generateReportText } from './reportUtils';
import { getWeekKey } from './weeklyUtils';
import { getMonthKey } from './monthlyUtils';
import { aiConfigPayload } from './aiConfig';
import { Icon } from './Icon';
import styles from './Reports.module.css';

type ReportTab = 'weekly' | 'monthly' | 'yearly';

export function Reports() {
  const { data } = useData();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<ReportTab>('weekly');

  if (!data) return null;

  const tabs: { key: ReportTab; label: string }[] = [
    { key: 'weekly', label: '周报' },
    { key: 'monthly', label: '月报' },
    { key: 'yearly', label: '年报' },
  ];

  // Placeholder content – will be replaced by actual report templates in #9 / #10
  const getReportSections = (): Record<string, string> => {
    const activeTasks = data.tasks.filter((t) => t.status !== 'cancelled');
    const doneTasks = data.tasks.filter((t) => t.status === 'done');

    const taskList = activeTasks
      .map((t) => `- [${t.category}] ${t.title}`)
      .join('\n');

    if (activeTab === 'weekly') {
      return {
        '本周完成任务': doneTasks.length > 0
          ? doneTasks.map((t) => `- [${t.category}] ${t.title}`).join('\n')
          : '（暂无）',
        '下周计划': taskList || '（暂无）',
        '需协调事项': '（暂无）',
      };
    }
    if (activeTab === 'monthly') {
      return {
        '量化汇总': doneTasks.length > 0
          ? `本月完成任务 ${doneTasks.length} 项`
          : '（暂无）',
        '项目回顾': '（暂无）',
        '反思与下月重点': '（暂无）',
      };
    }
    return {
      '人员调配': '（暂无）',
      '内部招聘/晋升晋等': '（暂无）',
      '奖惩管理': '（暂无）',
      '绩效管理': '（暂无）',
      '劳动关系': '（暂无）',
      '领导交办': '（暂无）',
      '其他': '（暂无）',
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

  // ---- 生成总结 Word 文档 ----
  const [generating, setGenerating] = useState(false);

  /** 优先取归档小结内容；没有归档时退回当前 Tab 的预览内容。 */
  const getSummaryPayload = (): { type: 'week' | 'month' | 'year'; key: string; sections: Record<string, string> } => {
    const now = new Date();
    if (activeTab === 'weekly') {
      const key = getWeekKey(now);
      const entry = data.archives.weeks[key];
      if (entry) {
        return {
          type: 'week',
          key,
          sections: {
            '本周完成任务': entry.summary.doneTasks,
            '长期项目推进': entry.summary.projectProgress,
            '下周计划': entry.summary.nextWeekPlan,
            '需协调事项': entry.summary.blockers,
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
            '量化汇总表': entry.summary.quantitativeSummary,
            '项目进度回顾': entry.summary.projectReview,
            '月度反思': entry.summary.reflection,
            '下月重点': entry.summary.nextMonthFocus,
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
          '人员调配': entry.summary.personnelAllocation,
          '内部招聘/晋升晋等': entry.summary.internalRecruitment,
          '奖惩管理': entry.summary.rewardDiscipline,
          '绩效管理': entry.summary.performance,
          '劳动关系': entry.summary.laborRelations,
          '领导交办': entry.summary.leaderAssigned,
          '一句话总结': entry.summary.other,
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

      {/* Action buttons */}
      <div className={styles.actions}>
        <button className={styles.actionBtn} onClick={handleCopy}>
          <Icon name="copy" size={16} /> 复制
        </button>
        <button className={styles.actionBtn} onClick={handleGenerateSummary} disabled={generating}>
          <Icon name="download" size={16} /> {generating ? '生成中…' : '生成总结'}
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
