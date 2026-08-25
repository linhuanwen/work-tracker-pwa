import { describe, it, expect } from 'vitest';
import {
  backupRotationSteps,
  BACKUP_COUNT,
  BACKUP_BASENAME,
  computeNextRevision,
} from '../useFileSystem';

/**
 * 自动快照轮转逻辑（纯函数）测试。
 *
 * 轮转顺序（以 BACKUP_COUNT=5 为例）：
 *   删除 data.json.bak.4（最旧，由调用方负责）
 *   data.json.bak.3 -> .4
 *   data.json.bak.2 -> .3
 *   data.json.bak.1 -> .2
 *   data.json.bak   -> .1
 *   当前 data.json  -> data.json.bak（from=null）
 */

describe('backupRotationSteps — 自动快照轮转', () => {
  it('不包含对最旧一份快照的写入（最旧由调用方删除）', () => {
    const steps = backupRotationSteps();
    const oldest = `${BACKUP_BASENAME}.${BACKUP_COUNT - 1}`;
    expect(steps.some((s) => s.from === oldest)).toBe(false);
  });

  it('逐级后移旧快照，最后一步写入当前 data.json', () => {
    const steps = backupRotationSteps();
    expect(steps).toHaveLength(BACKUP_COUNT);

    for (let i = 0; i < BACKUP_COUNT - 1; i++) {
      const k = BACKUP_COUNT - 2 - i;
      const from = k === 0 ? BACKUP_BASENAME : `${BACKUP_BASENAME}.${k}`;
      const to = `${BACKUP_BASENAME}.${k + 1}`;
      expect(steps[i]).toEqual({ from, to });
    }

    expect(steps[BACKUP_COUNT - 1]).toEqual({
      from: null,
      to: BACKUP_BASENAME,
    });
  });

  it('count 参数可自定义轮转深度', () => {
    const steps = backupRotationSteps(3);
    expect(steps).toEqual([
      { from: `${BACKUP_BASENAME}.1`, to: `${BACKUP_BASENAME}.2` },
      { from: BACKUP_BASENAME, to: `${BACKUP_BASENAME}.1` },
      { from: null, to: BACKUP_BASENAME },
    ]);
  });

  it('count=1 时仅写入当前 data.json 到 base', () => {
    const steps = backupRotationSteps(1);
    expect(steps).toEqual([{ from: null, to: BACKUP_BASENAME }]);
  });
});

describe('computeNextRevision — 冲突检测', () => {
  it('revision 一致时无冲突并递增', () => {
    expect(computeNextRevision(3, 3)).toEqual({ conflict: false, next: 4 });
    expect(computeNextRevision(0, 0)).toEqual({ conflict: false, next: 1 });
  });

  it('revision 不一致时判定为冲突，不递增', () => {
    expect(computeNextRevision(3, 5)).toEqual({ conflict: true, next: 3 });
    expect(computeNextRevision(5, 3)).toEqual({ conflict: true, next: 5 });
  });
});
