import type { Task } from './types';

// ============================================================
// CSV 导出
// ============================================================

const PRIORITY_LABELS: Record<string, string> = {
  urgent: '紧急',
  important: '重要',
  normal: '日常',
};

const STATUS_LABELS: Record<string, string> = {
  todo: '待办',
  'in-progress': '进行中',
  done: '已完成',
  cancelled: '已取消',
};

/** 将量化产出数组转为合并文本 */
function formatQuantities(quantities: Task['quantities']): string {
  return quantities
    .map((q) => `${q.label}: ${q.value}${q.unit}`)
    .join('; ');
}

/** 对含逗号、引号或换行的字段做 CSV 转义 */
function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * 生成任务列表的 CSV 字符串。
 * 包含 UTF-8 BOM（Excel 兼容）和表头行。
 * 列：标题、分类、优先级、状态、创建日期、完成日期、量化产出
 */
export function generateTaskCSV(tasks: Task[]): string {
  const BOM = '﻿';
  const header = '标题,分类,优先级,状态,创建日期,完成日期,量化产出';

  const rows = tasks.map((task) => {
    const cols = [
      csvEscape(task.title),
      csvEscape(task.category),
      csvEscape(PRIORITY_LABELS[task.priority] ?? task.priority),
      csvEscape(STATUS_LABELS[task.status] ?? task.status),
      task.createdDate,
      task.completedDate ?? '',
      csvEscape(formatQuantities(task.quantities)),
    ];
    return cols.join(',');
  });

  return BOM + [header, ...rows].join('\n');
}

// ============================================================
// 报告文本生成（用于一键复制）
// ============================================================

/**
 * 将分节内容拼接为可复制的纯文本报告。
 * @param sections 标题 → 内容 的映射，按插入顺序排列
 */
export function generateReportText(sections: Record<string, string>): string {
  return Object.entries(sections)
    .map(([title, content]) => `【${title}】\n${content}`)
    .join('\n\n');
}
