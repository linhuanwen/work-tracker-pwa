import { useCallback, useRef, useState } from 'react';
import type { DataJson } from '../types';
import { createDefaultDataJson } from '../types';

import { DATA_FILE_NAME } from './constants';
import type {
  StoredFolderInfo,
  UseFileSystemReturn,
  DataSource,
  SaveResult,
} from './types';
import {
  fetchBackendInfo,
  fetchLastFolderInfo,
  saveLastFolderInfo,
  loadBackendData,
  saveBackendData,
} from './backendApi';
import {
  storeHandle,
  getStoredHandle,
  clearStoredHandle,
  hasStoredHandleCheck,
} from './indexedDb';
import { computeNextRevision } from './revision';
import { readJsonFile, writeJsonFile } from './backup';

export function useFileSystem(): UseFileSystemReturn {
  const [data, setData] = useState<DataJson | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasHandle, setHasHandle] = useState(false);
  const [lastFolderInfo, setLastFolderInfo] = useState<StoredFolderInfo | null>(
    null,
  );
  const [backendMode, setBackendMode] = useState(false);
  const [backendFolderPath, setBackendFolderPath] = useState<string | null>(
    null,
  );
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

      await storeHandle(dirHandle);
      setHasHandle(true);
      setBackendMode(false);
      setBackendFolderPath(null);

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
      const msg = err instanceof Error ? err.message : '无法打开文件夹';
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
      if (dataSourceRef.current === 'backend' || backendMode) {
        const loaded = await loadBackendData();
        if (loaded) {
          setData(loaded);
          return loaded;
        }
      }

      const storedHandle = await getStoredHandle();
      if (!storedHandle) return null;

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
      const msg = err instanceof Error ? err.message : '无法读取数据文件';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [backendMode]);

  const saveData = useCallback(
    async (newData: DataJson): Promise<SaveResult | null> => {
      if (dataSourceRef.current === 'backend') {
        const result = await saveBackendData(newData);
        if (result.status === 'ok') {
          // 不回写 setData：保存只是持久化，内存状态由 reducer 维护。
          // 仅把新 revision 交回调用方，由调用方在 reducer 中原地更新。
          return {
            revision: result.revision,
            lastModified: new Date().toISOString(),
          };
        }
        if (result.status === 'conflict') {
          setError(
            '检测到数据已被其他设备修改，已暂停自动保存以避免覆盖。请重新打开文件夹加载最新数据。',
          );
          return null;
        }
        setError(result.message);
        return null;
      }

      const dirHandle = dirHandleRef.current;
      if (!dirHandle) {
        setError('尚未打开文件夹');
        return null;
      }
      try {
        const remote = await readJsonFile(dirHandle, DATA_FILE_NAME);
        const localRev = newData.revision ?? 0;
        const remoteRev = remote ? (remote.revision ?? 0) : localRev;
        const { conflict, next } = computeNextRevision(localRev, remoteRev);
        if (conflict) {
          setError(
            '检测到数据已被其他设备修改，已暂停自动保存以避免覆盖。请重新打开文件夹加载最新数据。',
          );
          return null;
        }

        const toSave: DataJson = {
          ...newData,
          revision: next,
          lastModified: new Date().toISOString(),
        };
        await writeJsonFile(dirHandle, DATA_FILE_NAME, toSave);
        // 不回写 setData，避免与进行中的编辑产生竞态导致输入被覆盖。
        return { revision: next, lastModified: toSave.lastModified };
      } catch (err) {
        const msg = err instanceof Error ? err.message : '保存失败';
        setError(msg);
        return null;
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
