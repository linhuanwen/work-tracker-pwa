import { useState } from 'react';
import { useData } from './DataContext';
import { useToast } from './Toast';
import { generateTaskCSV, generateReportText } from './reportUtils';
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

  const handleExportCSV = () => {
    const csv = generateTaskCSV(data.tasks);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `任务导出_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('已导出');
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
          📋 复制
        </button>
        <button className={styles.actionBtn} onClick={handleExportCSV}>
          📥 导出 CSV
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
