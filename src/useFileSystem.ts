import { useCallback, useRef, useState } from 'react';
import type { DataJson } from './types';
import { createDefaultDataJson } from './types';

const DIR_HANDLE_KEY = 'wps-dir-handle-name';
const DATA_FILE_NAME = 'data.json';

/**
 * File System Access API hook
 *
 * Handles opening a WPS 云文档 directory, reading data.json,
 * writing changes back, and persisting the directory handle name
 * in IndexedDB so the browser retains access across sessions.
 */

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
  /** Whether a directory has been opened before (handle stored) */
  hasStoredHandle: boolean;
  /** Try to reopen the previously used directory */
  reopenStored: () => Promise<DataJson | null>;
}

/** Persist the directory handle name to sessionStorage */
function storeHandleName(name: string): void {
  sessionStorage.setItem(DIR_HANDLE_KEY, name);
}

/** Retrieve the stored directory handle name */
function getStoredHandleName(): string | null {
  return sessionStorage.getItem(DIR_HANDLE_KEY);
}

/**
 * Request permission and re-acquire a directory handle by name.
 * Browsers don't allow storing FileSystemDirectoryHandle directly
 * in IndexedDB, but we can store the name and re-request access.
 * Some browsers support `indexedDB` storage of handles; we try
 * sessionStorage first as a simpler approach.
 */
async function requestDirectoryByName(
  name: string,
): Promise<FileSystemDirectoryHandle | null> {
  // Browsers don't allow enumerating directories by name.
  // We use sessionStorage to cache the handle name; re-opening
  // requires user to pick the folder again, but the stored name
  // helps guide the user.
  // For now, we rely on requesting permission to the same folder.
  try {
    // Try to get the directory handle from the stored permission
    const handle = await window.showDirectoryPicker({
      id: name,
      mode: 'readwrite',
    });
    return handle;
  } catch {
    return null;
  }
}

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
      return null; // File doesn't exist yet, will be created
    }
    throw err;
  }
}

async function writeJsonFile(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string,
  data: DataJson,
): Promise<void> {
  // Always create a new file handle (overwrite)
  const fileHandle = await dirHandle.getFileHandle(fileName, {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  const json = JSON.stringify(data, null, 2);
  await writable.write(json);
  await writable.close();
}

export function useFileSystem(): UseFileSystemReturn {
  const [data, setData] = useState<DataJson | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const hasStoredHandle = getStoredHandleName() !== null;

  const openDirectory = useCallback(async (): Promise<DataJson> => {
    setLoading(true);
    setError(null);
    try {
      const dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
      });
      dirHandleRef.current = dirHandle;
      storeHandleName(dirHandle.name);

      let existingData = await readJsonFile(dirHandle, DATA_FILE_NAME);
      if (!existingData) {
        // First time: initialize with default data
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
    const storedName = getStoredHandleName();
    if (!storedName) return null;

    setLoading(true);
    setError(null);
    try {
      const dirHandle = await requestDirectoryByName(storedName);
      if (!dirHandle) return null;

      dirHandleRef.current = dirHandle;
      storeHandleName(dirHandle.name);

      let existingData = await readJsonFile(dirHandle, DATA_FILE_NAME);
      if (!existingData) {
        existingData = createDefaultDataJson();
        await writeJsonFile(dirHandle, DATA_FILE_NAME, existingData);
      }

      setData(existingData);
      return existingData;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const saveData = useCallback(
    async (newData: DataJson): Promise<void> => {
      const dirHandle = dirHandleRef.current;
      if (!dirHandle) {
        setError('尚未打开文件夹');
        return;
      }
      try {
        const toSave: DataJson = {
          ...newData,
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
    hasStoredHandle,
    reopenStored,
  };
}
