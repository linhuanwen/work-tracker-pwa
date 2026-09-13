/**
 * 总结正文句式 v3（2026-09-07 定稿）：去分类、按任务逐句。
 *
 * 句式统一为「任务名：状态与进度，子任务完成情况。」——
 * - 整单完成任务：已完成（+量化/子步骤/具体内容从句）；
 * - 未整单完成但已勾子步骤的父任务：进行中，x/y 子步骤已完成（已勾标题）；
 * - 项目推进：进度 x% → y%，周期内完成 n 项子任务（标题）。
 * 文本中不再出现【分类】标题或逐行分类前缀。
 */

/** 整单完成任务句参数（周/月/年三档通用） */
export interface DoneTaskSentenceParts {
  title: string;
  /** 量化产出文本，如「考核 120 人」（无则省略） */
  quantityText?: string;
  /** 任务具体内容（无则省略） */
  notes?: string;
  /** 该任务已勾子任务标题（无子任务或未勾选时为空数组） */
  doneSubtaskTitles?: string[];
  /** 该任务子任务总数，用于部分完成时输出「完成子步骤 x/y 项」 */
  subtaskTotal?: number;
}

/** 生成整单完成任务的单句，如「绩效考核：已完成，考核 120 人，子步骤「a」「b」均已完成。」 */
export function formatDoneTaskSentence(parts: DoneTaskSentenceParts): string {
  const clauses: string[] = ['已完成'];
  if (parts.quantityText) clauses.push(parts.quantityText);

  const titles = parts.doneSubtaskTitles ?? [];
  const done = titles.length;
  if (done > 0) {
    const quoted = titles.map((t) => `「${t}」`).join('');
    if (typeof parts.subtaskTotal === 'number' && done < parts.subtaskTotal) {
      clauses.push(`完成子步骤 ${done}/${parts.subtaskTotal} 项（${quoted}）`);
    } else {
      clauses.push(`子步骤 ${quoted} 均已完成`);
    }
  }

  if (parts.notes) {
    const notes = parts.notes.replace(/[。；;]+$/, '');
    clauses.push(`具体内容：${notes}`);
  }

  return `${parts.title}：${clauses.join('，')}。`;
}

export interface OngoingTaskSentenceParts {
  title: string;
  done: number;
  total: number;
  /** 全部已勾子任务标题（打勾即完成，快照式） */
  doneTitles: string[];
}

/**
 * 生成未整单完成父任务的单句，
 * 如「机务跨序列：进行中，4/7 子步骤已完成（a、b、c）。」
 */
export function formatOngoingTaskSentence(
  parts: OngoingTaskSentenceParts,
): string {
  const list = parts.doneTitles.join('、');
  return `${parts.title}：进行中，${parts.done}/${parts.total} 子步骤已完成（${list}）。`;
}

/**
 * 周报「本周完成任务」行（2026-09-08 定稿）：
 * - 无已勾子任务：`- [分类] 标题`
 * - 有已勾子任务（涉及子任务完成）：`- [分类] 标题：已完成a、b、c。`
 */
export function formatCompletedTaskLine(parts: {
  category: string;
  title: string;
  /** 该任务已勾子任务标题（无则保持裸标题行） */
  doneSubtaskTitles?: string[];
}): string {
  const done = parts.doneSubtaskTitles ?? [];
  if (done.length === 0) {
    return `- [${parts.category}] ${parts.title}`;
  }
  return `- [${parts.category}] ${parts.title}：已完成${done.join('、')}。`;
}

export interface OngoingTaskLineParts {
  category: string;
  title: string;
  /** 已勾子任务标题（打勾即完成，快照式） */
  doneTitles: string[];
  /** 未勾子任务标题（待开展） */
  todoTitles: string[];
}

/**
 * 周报「进行中」行（2026-09-08 定稿）：
 * `- [分类] 标题：已完成a、b，待开展：c、d。`
 * 已勾子任务 = 已完成，未勾 = 待开展；任一侧为空则省略该侧。
 */
export function formatOngoingTaskLine(parts: OngoingTaskLineParts): string {
  const clauses: string[] = [];
  if (parts.doneTitles.length > 0) {
    clauses.push(`已完成${parts.doneTitles.join('、')}`);
  }
  if (parts.todoTitles.length > 0) {
    clauses.push(`待开展：${parts.todoTitles.join('、')}`);
  }
  return `- [${parts.category}] ${parts.title}：${clauses.join('，')}。`;
}

export interface ProjectProgressSentenceParts {
  projectTitle: string;
  beforePercent: number;
  afterPercent: number;
  /** 周期标签：「本周」/「本月」 */
  periodLabel: string;
  /** 周期内完成子任务标题 */
  completedTitles: string[];
}

/**
 * 生成项目推进单句，
 * 如「考核系统改造专项：进度 0% → 100%，本周完成 1 项子任务（联调）。」
 */
export function formatProjectProgressSentence(
  parts: ProjectProgressSentenceParts,
): string {
  const list = parts.completedTitles.join('、');
  const suffix = list ? `（${list}）` : '';
  return `${parts.projectTitle}：进度 ${parts.beforePercent}% → ${parts.afterPercent}%，${parts.periodLabel}完成 ${parts.completedTitles.length} 项子任务${suffix}。`;
}
