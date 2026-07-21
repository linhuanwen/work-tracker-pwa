import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce } from '../useAutoSave';

/**
 * Seam 3: Auto-save debounce
 *
 * The debounce utility delays execution until 500ms of inactivity.
 * The actual File System Access API call is mocked at this seam.
 */

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call the function immediately', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 500);
    debounced('data');
    expect(fn).not.toHaveBeenCalled();
  });

  it('calls the function after the delay', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 500);
    debounced('data');
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('data');
  });

  it('only calls once when triggered multiple times within delay', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 500);
    debounced('a');
    vi.advanceTimersByTime(200);
    debounced('b');
    vi.advanceTimersByTime(200);
    debounced('c');
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });

  it('uses the latest arguments', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 500);
    debounced('first');
    vi.advanceTimersByTime(400);
    debounced('second');
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledWith('second');
  });

  it('can be called again after the delay expires', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 500);
    debounced('first');
    vi.advanceTimersByTime(500);
    debounced('second');
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('defaults to 500ms delay', () => {
    const fn = vi.fn();
    const debounced = debounce(fn);
    debounced('data');
    vi.advanceTimersByTime(499);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
