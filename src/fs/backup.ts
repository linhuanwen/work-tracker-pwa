import { parseDataJson } from '../types';
import type { DataJson } from '../types';

export const BACKUP_COUNT = 5;
export const BACKUP_BASENAME = 'data.json.bak';

/**
 * 返回备份轮转步骤（纯函数，便于测试）。
 * 每条 step：把 `from` 文件的内容写到 `to`；`from === null` 表示写入当前 data.json 内容。
 * 最旧的一份（`{basename}.{count-1}`）由调用方先删除。
 */
export function backupRotationSteps(
  count = BACKUP_COUNT,
): { from: string | null; to: string }[] {
  const steps: { from: string | null; to: string }[] = [];
  for (let i = count - 1; i >= 1; i--) {
    const from = i === 1 ? BACKUP_BASENAME : `${BACKUP_BASENAME}.${i - 1}`;
    steps.push({ from, to: `${BACKUP_BASENAME}.${i}` });
  }
  steps.push({ from: null, to: BACKUP_BASENAME });
  return steps;
}

async function tryRemoveEntry(
  dirHandle: FileSystemDirectoryHandle,
  name: string,
): Promise<void> {
  try {
    await dirHandle.removeEntry(name);
  } catch (err) {
    if ((err as DOMException).name !== 'NotFoundError') throw err;
  }
}

async function readTextIfExists(
  dirHandle: FileSystemDirectoryHandle,
  name: string,
): Promise<string | null> {
  try {
    const fileHandle = await dirHandle.getFileHandle(name);
    const file = await fileHandle.getFile();
    return await file.text();
  } catch (err) {
    if ((err as DOMException).name === 'NotFoundError') return null;
    throw err;
  }
}

async function writeTextFile(
  dirHandle: FileSystemDirectoryHandle,
  name: string,
  content: string,
): Promise<void> {
  const fileHandle = await dirHandle.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

/** 覆盖 data.json 前，把当前内容轮转进 .bak 快照链（保留最近 BACKUP_COUNT 份）。 */
export async function rotateBackups(
  dirHandle: FileSystemDirectoryHandle,
  currentContent: string,
): Promise<void> {
  const steps = backupRotationSteps();
  await tryRemoveEntry(dirHandle, `${BACKUP_BASENAME}.${BACKUP_COUNT - 1}`);

  for (const step of steps) {
    if (step.from === null) {
      await writeTextFile(dirHandle, step.to, currentContent);
      continue;
    }
    const content = await readTextIfExists(dirHandle, step.from);
    if (content !== null) {
      await writeTextFile(dirHandle, step.to, content);
    } else {
      await tryRemoveEntry(dirHandle, step.to);
    }
  }
}

/** 数据损坏时把坏文件另存为带时间戳的 .corrupt 文件，便于排查，且不覆盖原坏文件。 */
export async function backupCorruptFile(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string,
): Promise<void> {
  try {
    const fileHandle = await dirHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    const text = await file.text();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await writeTextFile(dirHandle, `${fileName}.corrupt-${stamp}`, text);
  } catch {
    // 备份失败不阻断主流程——仍抛出原始错误
  }
}

export async function readJsonFile(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string,
): Promise<DataJson | null> {
  try {
    const fileHandle = await dirHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return parseDataJson(text);
  } catch (err) {
    const domErr = err as DOMException;
    if (domErr.name === 'NotFoundError') {
      return null;
    }
    await backupCorruptFile(dirHandle, fileName);
    throw err;
  }
}

export async function writeJsonFile(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string,
  data: DataJson,
): Promise<void> {
  const currentContent = await readTextIfExists(dirHandle, fileName);
  if (currentContent !== null) {
    await rotateBackups(dirHandle, currentContent);
  }

  const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  const json = JSON.stringify(data, null, 2);
  await writable.write(json);
  await writable.close();
}
