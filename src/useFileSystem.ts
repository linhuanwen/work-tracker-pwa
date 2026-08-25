// 兼容性 barrel：原有代码仍从 ./useFileSystem 导入，实际实现已迁移到 src/fs/
export {
  useFileSystem,
  computeNextRevision,
  BACKUP_COUNT,
  BACKUP_BASENAME,
  backupRotationSteps,
} from './fs';
export type {
  StoredFolderInfo,
  BackendInfo,
  DataSource,
  UseFileSystemReturn,
  SaveResult,
} from './fs';
