import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TitleBar } from '../TitleBar';

// ============================================================
// Mock CSS modules
// ============================================================

vi.mock('../TitleBar.module.css', () => ({
  default: {
    titleBar: 'titleBar',
    brand: 'brand',
    brandIcon: 'brandIcon',
    brandName: 'brandName',
    controls: 'controls',
    controlBtn: 'controlBtn',
    closeBtn: 'closeBtn',
  },
}));

// ============================================================
// Helpers
// ============================================================

function renderTitleBar(overrides: Partial<Parameters<typeof TitleBar>[0]> = {}) {
  const props = {
    isDesktopWindow: true,
    maximized: false,
    collapsed: false,
    onStartDrag: vi.fn(),
    onToggleCollapse: vi.fn(),
    onMinimize: vi.fn(),
    onToggleMaximize: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<TitleBar {...props} />);
  return props;
}

// ============================================================
// TitleBar
// ============================================================

describe('TitleBar', () => {
  it('renders brand and all window controls in desktop mode', () => {
    renderTitleBar();
    expect(screen.getByText('工作清单')).toBeTruthy();
    expect(screen.getByLabelText('收起')).toBeTruthy();
    expect(screen.getByLabelText('最小化')).toBeTruthy();
    expect(screen.getByLabelText('最大化')).toBeTruthy();
    expect(screen.getByLabelText('关闭')).toBeTruthy();
  });

  it('hides window controls in browser mode', () => {
    renderTitleBar({ isDesktopWindow: false });
    expect(screen.getByText('工作清单')).toBeTruthy();
    expect(screen.queryByLabelText('收起')).toBeNull();
    expect(screen.queryByLabelText('最小化')).toBeNull();
    expect(screen.queryByLabelText('最大化')).toBeNull();
    expect(screen.queryByLabelText('关闭')).toBeNull();
  });

  it('starts native drag on left mousedown of the bar', () => {
    const props = renderTitleBar();
    fireEvent.mouseDown(screen.getByTestId('titlebar'), { button: 0 });
    expect(props.onStartDrag).toHaveBeenCalledTimes(1);
  });

  it('does not start drag in browser mode', () => {
    const props = renderTitleBar({ isDesktopWindow: false });
    fireEvent.mouseDown(screen.getByTestId('titlebar'), { button: 0 });
    expect(props.onStartDrag).not.toHaveBeenCalled();
  });

  it('ignores mousedown originating from control buttons', () => {
    const props = renderTitleBar();
    fireEvent.mouseDown(screen.getByLabelText('关闭'), { button: 0 });
    expect(props.onStartDrag).not.toHaveBeenCalled();
  });

  it('toggles maximize on double click (not from buttons)', () => {
    const props = renderTitleBar();
    fireEvent.doubleClick(screen.getByTestId('titlebar'));
    expect(props.onToggleMaximize).toHaveBeenCalledTimes(1);

    fireEvent.doubleClick(screen.getByLabelText('最大化'));
    // still only the first call — button-origin dblclick is ignored
    expect(props.onToggleMaximize).toHaveBeenCalledTimes(1);
  });

  it('shows restore affordance when maximized', () => {
    renderTitleBar({ maximized: true });
    expect(screen.getByLabelText('还原')).toBeTruthy();
    expect(screen.queryByLabelText('最大化')).toBeNull();
  });

  it('hides the collapse button while maximized', () => {
    renderTitleBar({ maximized: true });
    expect(screen.queryByLabelText('收起')).toBeNull();
  });

  it('wires the collapse button', () => {
    const props = renderTitleBar();
    fireEvent.click(screen.getByLabelText('收起'));
    expect(props.onToggleCollapse).toHaveBeenCalledTimes(1);
  });

  it('when collapsed: shows 放下, hides maximize, double-click expands', () => {
    const props = renderTitleBar({ collapsed: true });
    expect(screen.getByLabelText('放下')).toBeTruthy();
    expect(screen.queryByLabelText('最大化')).toBeNull();

    fireEvent.doubleClick(screen.getByTestId('titlebar'));
    expect(props.onToggleCollapse).toHaveBeenCalledTimes(1);
    expect(props.onToggleMaximize).not.toHaveBeenCalled();
  });

  it('wires minimize and close buttons', () => {
    const props = renderTitleBar();
    fireEvent.click(screen.getByLabelText('最小化'));
    expect(props.onMinimize).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByLabelText('关闭'));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
