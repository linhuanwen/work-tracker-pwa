/**
 * Type augmentation for File System Access API methods that are
 * not yet available in TypeScript's default DOM lib.
 *
 * These are living-standard APIs supported in Chromium-based browsers:
 * - queryPermission(): check if we still have read/write permission
 * - requestPermission(): re-prompt the user for permission
 */

interface FileSystemHandlePermissionDescriptor {
  mode: 'read' | 'readwrite';
}

interface FileSystemDirectoryHandle {
  queryPermission(
    descriptor?: FileSystemHandlePermissionDescriptor,
  ): Promise<PermissionState>;
  requestPermission(
    descriptor?: FileSystemHandlePermissionDescriptor,
  ): Promise<PermissionState>;
}

interface FileSystemFileHandle {
  queryPermission(
    descriptor?: FileSystemHandlePermissionDescriptor,
  ): Promise<PermissionState>;
  requestPermission(
    descriptor?: FileSystemHandlePermissionDescriptor,
  ): Promise<PermissionState>;
}
