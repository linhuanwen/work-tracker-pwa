import type { DataJson } from './types';
import { migrateDataJson } from './types';

// ============================================================
// 数据迁移（导出 / 导入）工具层
//
// 导出：把当前 data.json 打包成带元信息的 JSON 快照。
// 导入：支持快照文件或裸 data.json，可覆盖或合并。
// ============================================================

export const APP_NAME = 'work-list';
export const SNAPSHOT_KIND = 'snapshot';
export const SNAPSHOT_FORMAT_VERSION = 1;

interface SnapshotEnvelope {
  app: string;
  kind: string;
  formatVersion: number;
  exportedAt: string;
  data: DataJson;
}

/** 生成可下载、可迁移的 JSON 快照文本。 */
export function createSnapshotText(data: DataJson): string {
  const envelope: SnapshotEnvelope = {
    app: APP_NAME,
    kind: SNAPSHOT_KIND,
    formatVersion: SNAPSHOT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
  return JSON.stringify(envelope, null, 2);
}

/** 生成建议的导出文件名，如 工作清单备份-2026-08-25.json。 */
export function defaultExportFileName(date?: Date): string {
  const d = date ?? new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `工作清单备份-${y}-${m}-${day}.json`;
}

/**
 * 解析导入文件文本为 DataJson。
 * 兼容两种形式：
 *  1. 本工具导出的带元信息快照（{ app, kind, formatVersion, data }）
 *  2. 裸 data.json（直接是 DataJson）
 * 内部走 migrateDataJson + validateDataJson，非法内容抛可读错误。
 */
export function parseImportText(text: string): DataJson {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('导入文件不是有效的 JSON，可能已损坏');
  }

  if (
    parsed &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    (parsed as Record<string, unknown>).kind === SNAPSHOT_KIND
  ) {
    const envelope = parsed as Record<string, unknown>;
    if (envelope.app !== APP_NAME) {
      throw new Error('此文件不是本应用导出的数据文件');
    }
    const fmt = envelope.formatVersion;
    if (typeof fmt === 'number' && fmt > SNAPSHOT_FORMAT_VERSION) {
      throw new Error('导入文件格式版本过高，请先升级应用');
    }
    return migrateDataJson(envelope.data);
  }

  return migrateDataJson(parsed);
}

export interface MergeConflictSummary {
  /** id 冲突且内容不同、被重命名的任务数 */
  remappedTaskIds: number;
  /** id 冲突且内容不同、被重命名的项目数 */
  remappedProjectIds: number;
  /** 完整相同而被跳过的任务数 */
  skippedIdenticalTasks: number;
  /** 完整相同而被跳过的项目数 */
  skippedIdenticalProjects: number;
  /** 归档 key 冲突而被保留本地的条目数 */
  skippedArchiveKeys: number;
}

const EMPTY_SUMMARY: MergeConflictSummary = {
  remappedTaskIds: 0,
  remappedProjectIds: 0,
  skippedIdenticalTasks: 0,
  skippedIdenticalProjects: 0,
  skippedArchiveKeys: 0,
};

function objectsEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function genId(prefix: string): string {
  return `${prefix}-imp-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/**
 * 合并导入：把 incoming 合并进 local，返回合并后的新 DataJson 和冲突摘要。
 *
 * 规则（见 spec Implementation Decisions）：
 * - 任务/项目 id 不冲突：追加
 * - id 冲突且内容相同：跳过
 * - id 冲突且内容不同：为导入项新 id，并同步修正 projectId
 * - 设置分类取并集
 * - 周/月/年归档按 key 合并，已存在 key 保留本地
 */
export function mergeForImport(
  local: DataJson,
  incoming: DataJson,
): { data: DataJson; summary: MergeConflictSummary } {
  const summary: MergeConflictSummary = { ...EMPTY_SUMMARY };

  // ---- 任务 ----
  const tasksByLocalId = new Map(local.tasks.map((t) => [t.id, t]));
  const newTasks: DataJson['tasks'] = [...local.tasks];

  for (const inc of incoming.tasks) {
    const existing = tasksByLocalId.get(inc.id);
    if (existing !== undefined) {
      if (objectsEqual(existing, inc)) {
        summary.skippedIdenticalTasks += 1;
        continue;
      }
      // id 冲突且内容不同：新 id
      summary.remappedTaskIds += 1;
      newTasks.push({ ...inc, id: genId('t') });
    } else {
      newTasks.push(inc);
    }
  }

  // ---- 项目 ----
  const projectsByLocalId = new Map(local.projects.map((p) => [p.id, p]));
  // incoming project id -> final merged project id（未冲突时为原 id）
  const newProjectIdMap = new Map<string, string>();
  const newProjects: DataJson['projects'] = [...local.projects];
  for (const inc of incoming.projects) {
    const existing = projectsByLocalId.get(inc.id);
    if (existing !== undefined) {
      if (objectsEqual(existing, inc)) {
        summary.skippedIdenticalProjects += 1;
        newProjectIdMap.set(inc.id, inc.id);
        continue;
      }
      const newId = genId('p');
      newProjectIdMap.set(inc.id, newId);
      summary.remappedProjectIds += 1;
      newProjects.push({ ...inc, id: newId });
    } else {
      newProjectIdMap.set(inc.id, inc.id);
      newProjects.push(inc);
    }
  }
  // 任务引用的“导入项目 id”映射为最终项目 id（任务与项目 id 分属各自命名空间）。
  // 若任务引用本地已有、未被导入改名的项目，其 projectId 不在 newProjectIdMap 中，保持不变。
  const finalTasks = newTasks.map((t) => {
    if (!t.projectId) return t;
    const mapped = newProjectIdMap.get(t.projectId);
    if (mapped !== undefined && mapped !== t.projectId) {
      return { ...t, projectId: mapped };
    }
    return t;
  });

  // ---- 设置分类并集 ----
  const catSet = new Set<string>(local.settings.categories);
  for (const c of incoming.settings.categories) {
    if (!catSet.has(c)) catSet.add(c);
  }
  const categories = [...catSet];

  // ---- 归档合并 ----
  const weeks = { ...local.archives.weeks };
  let skippedArchiveKeys = 0;
  for (const [key, value] of Object.entries(incoming.archives.weeks)) {
    if (!(key in weeks)) weeks[key] = value;
    else skippedArchiveKeys += 1;
  }
  const months = { ...local.archives.months };
  for (const [key, value] of Object.entries(incoming.archives.months)) {
    if (!(key in months)) months[key] = value;
    else skippedArchiveKeys += 1;
  }
  const years = { ...local.archives.years };
  for (const [key, value] of Object.entries(incoming.archives.years)) {
    if (!(key in years)) years[key] = value;
    else skippedArchiveKeys += 1;
  }
  summary.skippedArchiveKeys = skippedArchiveKeys;

  const merged: DataJson = {
    ...local,
    settings: {
      ...local.settings,
      categories,
    },
    projects: newProjects,
    tasks: finalTasks,
    archives: { weeks, months, years },
  };

  return { data: merged, summary };
}

/** 计算合并后 categories 增加数（供提示用）。 */
export function countMergedCategories(
  local: DataJson,
  incoming: DataJson,
): number {
  const catSet = new Set(local.settings.categories);
  let added = 0;
  for (const c of incoming.settings.categories) {
    if (!catSet.has(c)) added += 1;
  }
  return added;
}
