import type { DataJson } from '../types';

export interface StoredFolderInfo {
  folderName: string;
  lastOpened: string; // ISO timestamp
}

export interface BackendInfo {
  dataFolderPath?: string;
  lastFolderName?: string;
  lastOpened?: string;
}

export type DataSource = 'backend' | 'fsa' | null;

/** 成功保存后由持久层返回的元信息，用于回写 reducer 的 revision 等字段。 */
export interface SaveResult {
  revision: number;
  lastModified: string;
}

export interface UseFileSystemReturn {
  /** Currently loaded data, or null if not yet opened */
  data: DataJson | null;
  /** Open a directory picker and load/init data.json */
  openDirectory: () => Promise<DataJson>;
  /**
   * Write data back to data.json。保存成功后返回新的 revision 与 lastModified，
   * 失败或冲突时返回 null（错误信息写入 error）。
   */
  saveData: (data: DataJson) => Promise<SaveResult | null>;
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
  /** True when running under the desktop launcher with a configured dataFolderPath */
  backendMode: boolean;
  /** The configured backend data folder path, if any */
  backendFolderPath: string | null;
}
