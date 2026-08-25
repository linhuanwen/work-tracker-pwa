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
