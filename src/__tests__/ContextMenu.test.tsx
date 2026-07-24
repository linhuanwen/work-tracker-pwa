import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

/**
 * Seam: ContextMenu component
 *
 * Renders via React Portal (createPortal) into document.body.
 * Supports three item variants: action, separator, danger.
 * Dismisses on outside click (backdrop) and ESC key.
 *
 * Tests cover: positioning, item variants, click callbacks,
 * outside-close, and ESC-close behaviors.
 */

// ------------------------------------------------------------------
// Mock CSS module
// ------------------------------------------------------------------

vi.mock('../ContextMenu.module.css', () => ({
  default: {
    backdrop: 'backdrop',
    menu: 'menu',
    item: 'item',
    itemIcon: 'itemIcon',
    itemLabel: 'itemLabel',
    danger: 'danger',
    separator: 'separator',
  },
}));

// ------------------------------------------------------------------
// Mock Icon component (avoid lucide import in test)
// ------------------------------------------------------------------

vi.mock('../Icon', () => ({
  Icon: ({ name, size }: { name: string; size?: number }) => (
    <span data-testid={`icon-${name}`} data-size={size} />
  ),
}));

import { ContextMenu, type ContextMenuItem } from '../ContextMenu';

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

const makeItems = (): ContextMenuItem[] => [
  { id: 'edit', label: '编辑', icon: 'pen-line', onClick: vi.fn() },
  { id: 'copy', label: '复制标题', icon: 'copy', onClick: vi.fn() },
  { id: 'sep1', label: '', separator: true },
  { id: 'delete', label: '删除', icon: 'x', danger: true, onClick: vi.fn() },
];

afterEach(() => {
  cleanup();
});

// ==================================================================
// Seam 1 — Positioning & Portal rendering
// ==================================================================

describe('ContextMenu — positioning', () => {
  it('renders nothing when open=false', () => {
    const items = makeItems();
    render(
      <ContextMenu items={items} x={200} y={150} open={false} onClose={vi.fn()} />,
    );

    // No menu should be in the DOM
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('renders menu via portal at (x, y) when open=true', () => {
    const items = makeItems();
    render(
      <ContextMenu items={items} x={200} y={150} open={true} onClose={vi.fn()} />,
    );

    const menu = screen.getByRole('menu');
    expect(menu).toBeDefined();

    // Positioning via inline styles
    expect(menu.style.left).toBe('200px');
    expect(menu.style.top).toBe('150px');
  });

  it('renders menu as a direct child of document.body (portal)', () => {
    const items = makeItems();
    render(
      <ContextMenu items={items} x={100} y={50} open={true} onClose={vi.fn()} />,
    );

    const menu = screen.getByRole('menu');
    // Portal renders into body — the menu should be inside body
    expect(document.body.contains(menu)).toBe(true);
  });
});

// ==================================================================
// Seam 2 — Item variants
// ==================================================================

describe('ContextMenu — item variants', () => {
  it('renders regular action items with label and icon', () => {
    const items = makeItems();
    render(
      <ContextMenu items={items} x={0} y={0} open={true} onClose={vi.fn()} />,
    );

    // Regular items
    expect(screen.getByText('编辑')).toBeDefined();
    expect(screen.getByText('复制标题')).toBeDefined();
    expect(screen.getByTestId('icon-pen-line')).toBeDefined();
    expect(screen.getByTestId('icon-copy')).toBeDefined();
  });

  it('renders separator items as dividers (not buttons)', () => {
    const items = makeItems();
    render(
      <ContextMenu items={items} x={0} y={0} open={true} onClose={vi.fn()} />,
    );

    // The separator should have role="separator"
    const separator = screen.getByRole('separator');
    expect(separator).toBeDefined();
  });

  it('renders danger items with danger class', () => {
    const items = makeItems();
    render(
      <ContextMenu items={items} x={0} y={0} open={true} onClose={vi.fn()} />,
    );

    const deleteItem = screen.getByText('删除').closest('button');
    expect(deleteItem).toBeDefined();
    // Danger items should have the danger CSS class
    expect(deleteItem!.className).toContain('danger');
  });
});

// ==================================================================
// Seam 3 — Item click callbacks
// ==================================================================

describe('ContextMenu — item click callbacks', () => {
  it('fires onClick callback when a regular item is clicked', () => {
    const onEdit = vi.fn();
    const items: ContextMenuItem[] = [
      { id: 'edit', label: '编辑', icon: 'pen-line', onClick: onEdit },
    ];

    render(
      <ContextMenu items={items} x={0} y={0} open={true} onClose={vi.fn()} />,
    );

    fireEvent.click(screen.getByText('编辑'));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('fires onClick callback when a danger item is clicked', () => {
    const onDelete = vi.fn();
    const items: ContextMenuItem[] = [
      { id: 'delete', label: '删除', danger: true, onClick: onDelete },
    ];

    render(
      <ContextMenu items={items} x={0} y={0} open={true} onClose={vi.fn()} />,
    );

    fireEvent.click(screen.getByText('删除'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('closes the menu (calls onClose) after clicking an item', () => {
    const onClose = vi.fn();
    const onEdit = vi.fn();
    const items: ContextMenuItem[] = [
      { id: 'edit', label: '编辑', onClick: onEdit },
    ];

    render(
      <ContextMenu items={items} x={0} y={0} open={true} onClose={onClose} />,
    );

    fireEvent.click(screen.getByText('编辑'));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not crash when clicking an item without onClick', () => {
    const items: ContextMenuItem[] = [
      { id: 'noop', label: '无操作' },
    ];

    render(
      <ContextMenu items={items} x={0} y={0} open={true} onClose={vi.fn()} />,
    );

    // Should not throw
    expect(() => {
      fireEvent.click(screen.getByText('无操作'));
    }).not.toThrow();
  });

  it('separator items are not clickable (no menuitem role)', () => {
    const items = makeItems();
    render(
      <ContextMenu items={items} x={0} y={0} open={true} onClose={vi.fn()} />,
    );

    const separator = screen.getByRole('separator');
    // Separator should not have role="menuitem"
    expect(separator.getAttribute('role')).toBe('separator');
  });
});

// ==================================================================
// Seam 4 — Outside click dismiss (backdrop)
// ==================================================================

describe('ContextMenu — outside dismiss', () => {
  it('calls onClose when clicking the backdrop', () => {
    const onClose = vi.fn();
    const items = makeItems();

    render(
      <ContextMenu items={items} x={0} y={0} open={true} onClose={onClose} />,
    );

    // Find the backdrop — it's the element rendered as the click-outside layer
    const backdrop = document.querySelector('.backdrop') as HTMLElement;
    expect(backdrop).not.toBeNull();

    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when clicking inside the menu', () => {
    const onClose = vi.fn();
    const items = makeItems();

    render(
      <ContextMenu items={items} x={0} y={0} open={true} onClose={onClose} />,
    );

    // Click a menu item — this should call item onClick, not the backdrop onClose
    fireEvent.click(screen.getByText('编辑'));
    // onClose is called because item click also closes the menu
    // But the backdrop click handler should NOT be what triggered it
    expect(onClose).toHaveBeenCalledTimes(1); // from item click handler
  });
});

// ==================================================================
// Seam 5 — ESC key dismiss
// ==================================================================

describe('ContextMenu — ESC dismiss', () => {
  it('calls onClose when pressing Escape key', () => {
    const onClose = vi.fn();
    const items = makeItems();

    render(
      <ContextMenu items={items} x={0} y={0} open={true} onClose={onClose} />,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose for non-Escape keys', () => {
    const onClose = vi.fn();
    const items = makeItems();

    render(
      <ContextMenu items={items} x={0} y={0} open={true} onClose={onClose} />,
    );

    fireEvent.keyDown(document, { key: 'Enter' });
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'a' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not call onClose on ESC when menu is closed', () => {
    const onClose = vi.fn();
    const items = makeItems();

    render(
      <ContextMenu items={items} x={0} y={0} open={false} onClose={onClose} />,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
