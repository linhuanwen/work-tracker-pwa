/**
 * 通用 debounce 工具
 * 延迟 `delay` 毫秒后执行回调，期间重复调用会重置计时器
 */
export function debounce<T extends unknown[]>(
  fn: (...args: T) => void,
  delay = 500,
): (...args: T) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: T) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delay);
  };
}
