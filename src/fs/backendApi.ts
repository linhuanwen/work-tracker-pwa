import type { DataJson } from '../types';
import type { StoredFolderInfo, BackendInfo } from './types';

/** 后端保存结果。 */
export type SaveBackendResult =
  | { status: 'ok'; revision: number }
  | { status: 'conflict'; serverRevision: number }
  | { status: 'error'; message: string };

export async function fetchBackendInfo(): Promise<BackendInfo | null> {
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

export async function fetchLastFolderInfo(): Promise<StoredFolderInfo | null> {
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

export async function saveLastFolderInfo(
  info: StoredFolderInfo,
): Promise<void> {
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

export async function setBackendDataFolder(
  dataFolderPath: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const resp = await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataFolderPath,
        lastFolderName: dataFolderPath.split(/[\\/]/).pop() || dataFolderPath,
        lastOpened: new Date().toISOString(),
      }),
    });
    const result = (await resp.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
    } | null;
    if (resp.ok && result?.ok !== false) return { ok: true };
    return {
      ok: false,
      error: result?.error ?? `保存失败（HTTP ${resp.status}）`,
    };
  } catch {
    return { ok: false, error: '后端不可达，请确认桌面应用已启动' };
  }
}

export async function loadBackendData(): Promise<DataJson | null> {
  try {
    const resp = await fetch('/api/data', { cache: 'no-store' });
    if (!resp.ok) return null;
    return (await resp.json()) as DataJson;
  } catch {
    return null;
  }
}

export async function saveBackendData(
  data: DataJson,
): Promise<SaveBackendResult> {
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
      return {
        status: 'ok',
        revision: result?.revision ?? expectedRevision + 1,
      };
    }
    if (resp.status === 409 && result?.conflict) {
      return {
        status: 'conflict',
        serverRevision: result.serverRevision ?? -1,
      };
    }
    return {
      status: 'error',
      message: result?.error ?? `保存失败（HTTP ${resp.status}）`,
    };
  } catch {
    return { status: 'error', message: '后端不可达，请确认桌面应用已启动' };
  }
}
