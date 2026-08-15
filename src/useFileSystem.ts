import { useCallback, useRef, useState } from 'react';
import type { DataJson } from './types';
import { createDefaultDataJson, parseDataJson } from './types';

const DB_NAME = 'wjl-fs-handles';
const DB_VERSION = 1;
const STORE_NAME = 'handles';
const HANDLE_KEY = 'current-dir';
const DATA_FILE_NAME = 'data.json';

/**
 * File System Access API hook
 *
 * Persists the FileSystemDirectoryHandle in IndexedDB so the browser can
 * silently re-acquire readwrite access across sessions (no picker UI).
 *
 * Also supports a "backend mode" when running under launcher.py: if the
 * Python backend reports a configured `dataFolderPath`, all file I/O is
 * delegated to `/api/data` endpoints, bypassing the browser picker entirely.
 */

export interface StoredFolderInfo {
  folderName: string;
  lastOpened: string; // ISO timestamp
}

interface BackendInfo {
  dataFolderPath?: string;
  lastFolderName?: string;
  lastOpened?: string;
}

type DataSource = 'backend' | 'fsa' | null;

interface UseFileSystemReturn {
  /** Currently loaded data, or null if not yet opened */
  data: DataJson | null;
  /** Open a directory picker and load/init data.json */
  openDirectory: () => Promise<DataJson>;
  /** Write data back to data.json */
  saveData: (data: DataJson) => Promise<void>;
  /** Whether an operation is in progress */
  loading: boolean;
  /** Error message, if any */
  error: string | null;
  /** Whether a directory has been opened before (handle stored in IndexedDB) */
  hasStoredHandle: boolean;
  /** Try to reopen the previously used directory (silent if permission persisted) */
  reopenStored: () => Promise<DataJson | null>;
  /** Info about the last-used folder from Python backend */
  lastFolderInfo: StoredFolderInfo | null;
  /** True when running under launcher.py with a configured dataFolderPath */
  backendMode: boolean;
  /** The configured backend data folder path, if any */
  backendFolderPath: string | null;
}

// ============================================================
// IndexedDB helpers — persist the live FileSystemDirectoryHandle
// ============================================================

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function storeHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function getStoredHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
    req.onsuccess = () => {
      db.close();
      resolve(req.result ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

async function clearStoredHandle(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function hasStoredHandleCheck(): Promise<boolean> {
  const handle = await getStoredHandle();
  return handle !== null;
}

// ============================================================
// Python backend helpers
// ============================================================

async function fetchBackendInfo(): Promise<BackendInfo | null> {
  try {
    const resp = await fetch('/api/state', { cache: 'no-store' });
    if (!resp.ok) return null;
    const state = await resp.json();
    if (state.dataFolderPath) {
      return {
        dataFolderPath: state.dataFolderPath,
        lastFolderName: state.lastFolderName,
        lastOpened: state.lastOpened,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchLastFolderInfo(): Promise<StoredFolderInfo | null> {
  try {
    const resp = await fetch('/api/state', { cache: 'no-store' });
    if (!resp.ok) return null;
    const state = await resp.json();
    if (state.lastFolderName && state.lastOpened) {
      return {
        folderName: state.lastFolderName,
        lastOpened: state.lastOpened,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function saveLastFolderInfo(info: StoredFolderInfo): Promise<void> {
  try {
    await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lastFolderName: info.folderName,
        lastOpened: info.lastOpened,
      }),
    });
  } catch {
    // Non-critical — IndexedDB is the primary store in FSA mode
  }
}

async function loadBackendData(): Promise<DataJson | null> {
  try {
    const resp = await fetch('/api/data', { cache: 'no-store' });
    if (!resp.ok) return null;
    return (await resp.json()) as DataJson;
  } catch {
    return null;
  }
}

/** 后端保存结果。 */
type SaveBackendResult =
  | { status: 'ok'; revision: number }
  | { status: 'conflict'; serverRevision: number }
  | { status: 'error'; message: string };

async function saveBackendData(data: DataJson): Promise<SaveBackendResult> {
  const expectedRevision = data.revision ?? 0;
  const body = {
    ...data,
    lastModified: new Date().toISOString(),
    expectedRevision,
  };
  try {
    const resp = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = (await resp.json().catch(() => null)) as {
      ok?: boolean;
      conflict?: boolean;
      revision?: number;
      serverRevision?: number;
      error?: string;
    } | null;

    if (resp.ok) {
      return { status: 'ok', revision: result?.revision ?? expectedRevision + 1 };
    }
    if (resp.status === 409 && result?.conflict) {
      return { status: 'conflict', serverRevision: result.serverRevision ?? -1 };
    }
    return { status: 'error', message: result?.error ?? `保存失败（HTTP ${resp.status}）` };
  } catch {
    return { status: 'error', message: '后端不可达，请确认桌面应用已启动' };
  }
}

// ============================================================
// 冲突检测（revision 计数）
// ============================================================

/**
 * 计算保存后的 revision 并检测冲突（纯函数，便于测试）。
 * - local === remote：无外部修改，next = local + 1
 * - local !== remote：磁盘已被其他设备改动，返回 conflict
 */
export function computeNextRevision(
  local: number,
  remote: number,
): { conflict: boolean; next: number } {
  if (local !== remote) return { conflict: true, next: local };
  return { conflict: false, next: local + 1 };
}

// ============================================================
// 自动快照（data.json 备份轮转）
// ============================================================

export const BACKUP_COUNT = 5;
export const BACKUP_BASENAME = 'data.json.bak';

/**
 * 返回备份轮转步骤（纯函数，便于测试）。
 * 每条 step：把 `from` 文件的内容写到 `to`；`from === null` 表示写入当前 data.json 内容。
 * 最旧的一份（`{basename}.{count-1}`）由调用方先删除。
 */
export function backupRotationSteps(count = BACKUP_COUNT): { from: string | null; to: string }[] {
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
async function rotateBackups(
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
async function backupCorruptFile(
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

// ============================================================
// File I/O helpers
// ============================================================

async function readJsonFile(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string,
): Promise<DataJson | null> {
  try {
    const fileHandle = await dirHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    const text = await file.text();
    // 解析 + 版本迁移 + 字段校验，任一失败抛错（错误信息面向用户）
    return parseDataJson(text);
  } catch (err) {
    const domErr = err as DOMException;
    if (domErr.name === 'NotFoundError') {
      return null;
    }
    // 数据损坏：先备份坏文件，再抛出，避免在坏数据上继续运行
    await backupCorruptFile(dirHandle, fileName);
    throw err;
  }
}

async function writeJsonFile(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string,
  data: DataJson,
): Promise<void> {
  // 覆盖前先把当前内容轮转进快照链（保留最近 BACKUP_COUNT 份）
  const currentContent = await readTextIfExists(dirHandle, fileName);
  if (currentContent !== null) {
    await rotateBackups(dirHandle, currentContent);
  }

  const fileHandle = await dirHandle.getFileHandle(fileName, {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  const json = JSON.stringify(data, null, 2);
  await writable.write(json);
  await writable.close();
}

// ============================================================
// Hook
// ============================================================

export function useFileSystem(): UseFileSystemReturn {
  const [data, setData] = useState<DataJson | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasHandle, setHasHandle] = useState(false);
  const [lastFolderInfo, setLastFolderInfo] = useState<StoredFolderInfo | null>(null);
  const [backendMode, setBackendMode] = useState(false);
  const [backendFolderPath, setBackendFolderPath] = useState<string | null>(null);
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const dataSourceRef = useRef<DataSource>(null);

  // Check backend + IndexedDB on mount (runs once)
  const checkedRef = useRef(false);
  if (!checkedRef.current) {
    checkedRef.current = true;

    fetchBackendInfo().then((info) => {
      if (info?.dataFolderPath) {
        setBackendMode(true);
        setBackendFolderPath(info.dataFolderPath);
        setHasHandle(true);
        setLastFolderInfo({
          folderName: info.lastFolderName ?? info.dataFolderPath,
          lastOpened: info.lastOpened ?? new Date().toISOString(),
        });
        dataSourceRef.current = 'backend';
        loadBackendData().then((loaded) => {
          if (loaded) setData(loaded);
        });
      } else {
        hasStoredHandleCheck().then(setHasHandle);
        fetchLastFolderInfo().then(setLastFolderInfo);
      }
    });
  }

  const openDirectory = useCallback(async (): Promise<DataJson> => {
    setLoading(true);
    setError(null);
    try {
      const dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
      });
      dirHandleRef.current = dirHandle;
      dataSourceRef.current = 'fsa';

      // Persist the actual handle in IndexedDB
      await storeHandle(dirHandle);
      setHasHandle(true);
      // Leaving backend mode: user explicitly picked a different folder
      setBackendMode(false);
      setBackendFolderPath(null);

      // Persist folder name to Python backend
      await saveLastFolderInfo({
        folderName: dirHandle.name,
        lastOpened: new Date().toISOString(),
      });
      setLastFolderInfo({
        folderName: dirHandle.name,
        lastOpened: new Date().toISOString(),
      });

      let existingData = await readJsonFile(dirHandle, DATA_FILE_NAME);
      if (!existingData) {
        existingData = createDefaultDataJson();
        await writeJsonFile(dirHandle, DATA_FILE_NAME, existingData);
      }

      setData(existingData);
      return existingData;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : '无法打开文件夹';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reopenStored = useCallback(async (): Promise<DataJson | null> => {
    setLoading(true);
    setError(null);
    try {
      // Backend mode: reload from Python-managed folder
      if (dataSourceRef.current === 'backend' || backendMode) {
        const loaded = await loadBackendData();
        if (loaded) {
          setData(loaded);
          return loaded;
        }
      }

      const storedHandle = await getStoredHandle();
      if (!storedHandle) return null;

      // Check current permission state
      const opts: FileSystemHandlePermissionDescriptor = { mode: 'readwrite' };
      let permission = await storedHandle.queryPermission(opts);

      if (permission !== 'granted') {
        permission = await storedHandle.requestPermission(opts);
        if (permission !== 'granted') {
          await clearStoredHandle();
          setHasHandle(false);
          return null;
        }
      }

      dirHandleRef.current = storedHandle;
      dataSourceRef.current = 'fsa';

      let existingData = await readJsonFile(storedHandle, DATA_FILE_NAME);
      if (!existingData) {
        existingData = createDefaultDataJson();
        await writeJsonFile(storedHandle, DATA_FILE_NAME, existingData);
      }

      await saveLastFolderInfo({
        folderName: storedHandle.name,
        lastOpened: new Date().toISOString(),
      });

      setData(existingData);
      return existingData;
    } catch (err) {
      // 读取/校验失败（如数据损坏）时保留已存 handle，避免用户误以为从未打开过文件夹；
      // 错误消息交给 setError 展示，用户可重试或查看 .corrupt 备份。
      const msg = err instanceof Error ? err.message : '无法读取数据文件';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [backendMode]);

  const saveData = useCallback(
    async (newData: DataJson): Promise<void> => {
      // backend 模式：POST 带 expectedRevision，由后端做冲突检测并递增 revision
      if (dataSourceRef.current === 'backend') {
        const result = await saveBackendData(newData);
        if (result.status === 'ok') {
          setData({
            ...newData,
            revision: result.revision,
            lastModified: new Date().toISOString(),
          });
          return;
        }
        if (result.status === 'conflict') {
          setError(
            '检测到数据已被其他设备修改，已暂停自动保存以避免覆盖。请重新打开文件夹加载最新数据。',
          );
          return;
        }
        setError(result.message);
        return;
      }

      const dirHandle = dirHandleRef.current;
      if (!dirHandle) {
        setError('尚未打开文件夹');
        return;
      }
      try {
        // FSA 模式：写盘前读磁盘当前 revision，对比内存 revision 做冲突检测
        const remote = await readJsonFile(dirHandle, DATA_FILE_NAME);
        const localRev = newData.revision ?? 0;
        const remoteRev = remote ? (remote.revision ?? 0) : localRev;
        const { conflict, next } = computeNextRevision(localRev, remoteRev);
        if (conflict) {
          setError(
            '检测到数据已被其他设备修改，已暂停自动保存以避免覆盖。请重新打开文件夹加载最新数据。',
          );
          return;
        }

        const toSave: DataJson = {
          ...newData,
          revision: next,
          lastModified: new Date().toISOString(),
        };
        await writeJsonFile(dirHandle, DATA_FILE_NAME, toSave);
        setData(toSave);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : '保存失败';
        setError(msg);
      }
    },
    [],
  );

  return {
    data,
    openDirectory,
    saveData,
    loading,
    error,
    hasStoredHandle: hasHandle,
    reopenStored,
    lastFolderInfo,
    backendMode,
    backendFolderPath,
  };
}
