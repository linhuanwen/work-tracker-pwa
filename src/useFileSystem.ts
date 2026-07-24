import { useCallback, useRef, useState } from 'react';
import type { DataJson } from './types';
import { createDefaultDataJson } from './types';

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

async function saveBackendData(data: DataJson): Promise<boolean> {
  try {
    const toSave: DataJson = {
      ...data,
      lastModified: new Date().toISOString(),
    };
    const resp = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toSave),
    });
    return resp.ok;
  } catch {
    return false;
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
    return JSON.parse(text) as DataJson;
  } catch (err) {
    const domErr = err as DOMException;
    if (domErr.name === 'NotFoundError') {
      return null;
    }
    throw err;
  }
}

async function writeJsonFile(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string,
  data: DataJson,
): Promise<void> {
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
    } catch {
      await clearStoredHandle();
      setHasHandle(false);
      return null;
    } finally {
      setLoading(false);
    }
  }, [backendMode]);

  const saveData = useCallback(
    async (newData: DataJson): Promise<void> => {
      const toSave: DataJson = {
        ...newData,
        lastModified: new Date().toISOString(),
      };

      if (dataSourceRef.current === 'backend') {
        const ok = await saveBackendData(toSave);
        if (ok) {
          setData(toSave);
          return;
        }
        setError('后端保存失败，请检查 wjl-config.txt 配置');
        return;
      }

      const dirHandle = dirHandleRef.current;
      if (!dirHandle) {
        setError('尚未打开文件夹');
        return;
      }
      try {
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
